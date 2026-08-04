import type { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/current-user";
import { canAdminister } from "@/lib/auth/perms";
import { getModel } from "@/lib/admin/registry";
import { writeWorkbook } from "@/lib/xlsx/write";
import { exportSheet, templateSheet, type ExportScope } from "@/lib/xlsx/export";
import { autoFillPlan } from "@/lib/xlsx/plan";

export const runtime = "nodejs";
// Always reflects current data — never served from the route cache.
export const dynamic = "force-dynamic";

/**
 * Admin-only Excel export, the counterpart to the import action.
 *
 *   GET /api/export/Client                 -> every client, importable columns
 *   GET /api/export/Client?scope=all       -> every scalar column, id included
 *   GET /api/export/Client?template=1      -> headers only, ready to fill in
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ model: string }> },
) {
  const user = await getSessionUser();
  if (!user || user.status !== "ACTIVE") return new Response("Unauthorized", { status: 401 });
  if (!canAdminister(user.designation)) return new Response("Forbidden", { status: 403 });

  const { model: modelName } = await params;
  const model = getModel(modelName);
  if (!model) return new Response(`Unknown model: ${modelName}`, { status: 404 });

  const url = new URL(req.url);
  const template = url.searchParams.get("template") === "1";
  const scope: ExportScope = url.searchParams.get("scope") === "all" ? "all" : "importable";

  let buf: Buffer;
  try {
    const sheet = template
      ? templateSheet(model, autoFillPlan(model, user).names)
      : await exportSheet(model, scope);
    buf = writeWorkbook([sheet]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Export failed.";
    return new Response(`Export failed: ${msg}`, { status: 500 });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = template ? `${model.name}-template.xlsx` : `${model.name}-${stamp}.xlsx`;

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": String(buf.length),
      "Cache-Control": "no-store",
    },
  });
}
