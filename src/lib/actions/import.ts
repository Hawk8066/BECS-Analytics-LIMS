"use server";

/**
 * Admin-only bulk import of records from an .xlsx workbook.
 *
 * One action serves every model: columns are matched to Prisma field names via
 * the same DMMF registry the admin panel uses, so no per-model wiring is
 * needed. Two modes share the identical parse/validate path:
 *   - "validate" — dry run, reports what would happen and writes nothing
 *   - "import"   — commits, all-or-nothing, inside a single transaction
 *
 * Every created record gets an audit row (BR-5).
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { canAdminister } from "@/lib/auth/perms";
import { getModel, type AdminModel } from "@/lib/admin/registry";
import { toPlain } from "@/lib/admin/values";
import { readWorkbook } from "@/lib/xlsx/read";
import { mapSheet, type ImportIssue } from "@/lib/xlsx/rows";
import { autoFillPlan } from "@/lib/xlsx/plan";
import { afterImport } from "@/lib/xlsx/after-import";

export interface ImportState {
  /** Set once a run has happened, so the UI knows to show the result panel. */
  ran?: boolean;
  mode?: "validate" | "import";
  /** Fatal problem — nothing was parsed. */
  error?: string;
  model?: string;
  sheetName?: string;
  sheetNames?: string[];
  headers?: string[];
  /** Field names the columns resolved to (nulls dropped). */
  matched?: string[];
  /** Fields the server filled in itself. */
  autoFilled?: string[];
  totalRows?: number;
  validRows?: number;
  issues?: ImportIssue[];
  /** Issues beyond the display cap. */
  moreIssues?: number;
  imported?: number;
  /** Extra work the import did for this model, e.g. saved sector prices. */
  note?: string;
}

const MAX_ISSUES = 50;
const MAX_ROWS = 5000;

async function requireAdmin() {
  const actor = await requireUser();
  if (!canAdminister(actor.designation)) {
    throw new Error("Forbidden: application admin access required.");
  }
  return actor;
}

export async function importExcel(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const actor = await requireAdmin();

  const modelName = String(formData.get("__model") ?? "");
  const path = String(formData.get("__path") ?? "");
  const mode = formData.get("__mode") === "import" ? "import" : "validate";
  const wantedSheet = String(formData.get("__sheet") ?? "").trim();

  const model = getModel(modelName);
  if (!model) return { ran: true, mode, error: `Unknown model: ${modelName}` };
  if (!model.idField) {
    return { ran: true, mode, error: `${modelName} has no single-column primary key.` };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ran: true, mode, error: "Choose an .xlsx file to import." };
  }

  // ---- parse ----
  let sheets;
  try {
    sheets = readWorkbook(Buffer.from(await file.arrayBuffer()));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not read the workbook.";
    return { ran: true, mode, model: model.name, error: msg };
  }

  const sheetNames = sheets.map((s) => s.name);
  const sheet = wantedSheet
    ? sheets.find((s) => s.name.toLowerCase() === wantedSheet.toLowerCase())
    : sheets[0];
  if (!sheet) {
    return {
      ran: true,
      mode,
      model: model.name,
      sheetNames,
      error: `No sheet named "${wantedSheet}" in this workbook.`,
    };
  }

  const plan = autoFillPlan(model, actor);
  const mapped = mapSheet(sheet, model, { autoFilled: plan.names });

  const base: ImportState = {
    ran: true,
    mode,
    model: model.name,
    sheetName: sheet.name,
    sheetNames,
    headers: mapped.headers,
    matched: mapped.columns.filter((c) => c !== null).map((c) => c!.name),
    autoFilled: [...plan.names],
    totalRows: mapped.totalRows,
    validRows: mapped.rows.length,
    issues: mapped.issues.slice(0, MAX_ISSUES),
    moreIssues: Math.max(0, mapped.issues.length - MAX_ISSUES),
  };

  if (mapped.rows.length > MAX_ROWS) {
    return {
      ...base,
      error: `This sheet has ${mapped.rows.length} rows; the limit per import is ${MAX_ROWS}. Split it into smaller files.`,
    };
  }

  // All-or-nothing: any problem blocks the whole file.
  if (mapped.issues.length > 0) {
    return {
      ...base,
      error:
        mode === "import"
          ? `Nothing was imported — fix the ${mapped.issues.length} problem(s) below and try again.`
          : undefined,
    };
  }

  if (mode === "validate") return base;

  if (mapped.rows.length === 0) {
    return { ...base, error: "There are no rows to import." };
  }

  // ---- commit ----
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // Reserve the whole number range in one atomic bump, so concurrent
        // imports can't collide and the series stays gap-free (SSOT §11).
        let counter = 0;
        if (plan.numbering) {
          const n = mapped.rows.length;
          const seq = await tx.sequence.upsert({
            where: { key: plan.numbering.key },
            update: { counter: { increment: n } },
            create: { key: plan.numbering.key, prefix: plan.numbering.prefix, counter: n },
          });
          counter = seq.counter - n; // first number issued is counter + 1
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const txDelegate = (tx as any)[model.delegate];
        const created: Array<Record<string, unknown>> = [];

        for (const row of mapped.rows) {
          const data = { ...plan.stamps, ...row };

          if (plan.numbering && data[plan.numbering.field] === undefined) {
            counter += 1;
            data[plan.numbering.field] =
              `${plan.numbering.prefix}-${String(counter).padStart(plan.numbering.pad, "0")}`;
          }

          created.push(await txDelegate.create({ data }));
        }

        await tx.auditLog.createMany({
          data: created.map((rec) => ({
            actorId: actor.id,
            action: "CREATE" as const,
            entityType: model.name,
            entityId: String(rec[model.idField!]),
            after: toPlain(rec) as object,
            facilityId: (rec.facilityId as string | undefined) ?? null,
            sectionId: (rec.sectionId as string | undefined) ?? null,
          })),
        });

        return {
          imported: created.length,
          note: await afterImport(tx, model, created, actor.id),
        };
      },
      { timeout: 120_000 },
    );

    if (path) revalidatePath(path);
    revalidatePath(`/app/admin/${model.name}`);

    return { ...base, imported: result.imported, note: result.note ?? undefined };
  } catch (err) {
    return { ...base, error: writeErrorMessage(err, model) };
  }
}

/** Turn a Prisma write failure into something an operator can act on. */
function writeErrorMessage(err: unknown, model: AdminModel): string {
  const raw = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string })?.code;

  if (code === "P2002") {
    const target = (err as { meta?: { target?: string[] } })?.meta?.target;
    const on = Array.isArray(target) ? ` on ${target.join(", ")}` : "";
    return `Nothing was imported — the file contains a duplicate value${on} that must be unique.`;
  }
  if (code === "P2003") {
    return "Nothing was imported — a row references a record that doesn't exist (check any *Id columns).";
  }
  return `Nothing was imported — ${model.name} write failed: ${raw.split("\n").slice(-1)[0]}`;
}
