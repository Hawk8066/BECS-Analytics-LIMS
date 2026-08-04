/**
 * Reload BECS reference data (Parameters + Clients) from `BECS Database.xlsx`.
 *
 * Wipes ALL existing parameters & clients (and the demo samples / quotations /
 * invoices that reference them) and re-imports fresh from the workbook:
 *   - "Test"      sheet -> Parameter   (name, matrix, method, unit, price)
 *   - "Client"    sheet -> Client      (Lahore parent-lab clients)
 *   - "TP Client" sheet -> Client      (third-party / export clients)
 *
 * Re-runnable: run again any time to discard and reload.
 *   npx tsx prisma/import-becs-db.ts ["path/to/BECS Database.xlsx"]
 */
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import path from "node:path";
import { PrismaClient, Prisma } from "@prisma/client";
import { SECTORS } from "../src/lib/sectors";

const prisma = new PrismaClient();

const LAHORE_FACILITY_ID = "0fc6071c-6cf7-4e00-8454-507853e51734";
const DEFAULT_FILE = path.join(
  process.cwd(),
  "docs",
  "ISO_Documents",
  "BECS Database.xlsx",
);

// ---------- minimal ZIP reader (central directory) ----------
function unzip(file: string): Map<string, Buffer> {
  const buf = readFileSync(file);
  // End of Central Directory record
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("Not a zip file (no EOCD).");
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);

  const out = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break; // central dir header
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString("utf8", off + 46, off + 46 + nameLen);

    // local header -> data start
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const comp = buf.subarray(dataStart, dataStart + compSize);
    out.set(name, method === 0 ? comp : inflateRawSync(comp));

    off += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

// ---------- minimal XLSX cell reader ----------
function decode(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#10;/g, "\n")
    .replace(/&amp;/g, "&");
}

function colIdx(ref: string): number {
  const m = ref.match(/^([A-Z]+)/)!;
  let n = 0;
  for (const c of m[1]) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

function sharedStrings(xml: string): string[] {
  const out: string[] = [];
  const siRe = /<si>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = siRe.exec(xml))) {
    const tRe = /<t[^>]*>([\s\S]*?)<\/t>/g;
    let t: RegExpExecArray | null;
    let s = "";
    while ((t = tRe.exec(m[1]))) s += t[1];
    out.push(decode(s));
  }
  return out;
}

function rows(xml: string, ss: string[]): string[][] {
  const result: string[][] = [];
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(xml))) {
    const cells: string[] = [];
    const cRe = /<c\s+([^>]*?)(\/>|>([\s\S]*?)<\/c>)/g;
    let cm: RegExpExecArray | null;
    while ((cm = cRe.exec(rm[1]))) {
      const attrs = cm[1];
      const body = cm[3] ?? "";
      const refM = attrs.match(/r="([A-Z]+\d+)"/);
      if (!refM) continue;
      const idx = colIdx(refM[1]);
      const typeM = attrs.match(/t="([^"]+)"/);
      const type = typeM ? typeM[1] : null;
      const vM = body.match(/<v>([\s\S]*?)<\/v>/);
      const isM = body.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/);
      let val = "";
      if (isM) val = decode(isM[1]);
      else if (type === "s" && vM) val = ss[parseInt(vM[1], 10)];
      else if (vM) val = decode(vM[1]);
      cells[idx] = val;
    }
    result.push(cells);
  }
  return result;
}

const clean = (v: unknown): string | null => {
  const s = (v == null ? "" : String(v)).trim();
  return s && s !== "-" ? s : null;
};

// "Rs / Test" -> PKR paisa (integer), or null.
function toPaisa(v: unknown): number | null {
  const s = (v == null ? "" : String(v)).replace(/,/g, "").trim();
  if (!s || !/^\d+(\.\d+)?$/.test(s)) return null;
  return Math.round(parseFloat(s) * 100);
}

async function main() {
  const file = process.argv[2] || DEFAULT_FILE;
  console.log(`Reading ${file}`);
  const zip = unzip(file);
  const ss = sharedStrings(zip.get("xl/sharedStrings.xml")!.toString("utf8"));
  const testRows = rows(zip.get("xl/worksheets/sheet1.xml")!.toString("utf8"), ss);
  const clientRows = rows(zip.get("xl/worksheets/sheet2.xml")!.toString("utf8"), ss);
  const tpRows = rows(zip.get("xl/worksheets/sheet3.xml")!.toString("utf8"), ss);

  const isData = (r: string[]) => r[0] && /^\d+$/.test(String(r[0]).trim());

  // ----- Parameters (Test sheet) -----
  const paramMap = new Map<string, { name: string; matrix: string | null; method: string | null; unit: string | null; price: number | null }>();
  for (const r of testRows.filter(isData)) {
    const name = clean(r[4]);
    if (!name) continue;
    const matrix = clean(r[3]);
    const key = `${name.toLowerCase()}|${(matrix ?? "").toLowerCase()}`;
    if (paramMap.has(key)) continue; // dedupe on (name, matrix)
    paramMap.set(key, {
      name,
      matrix,
      method: clean(r[5]),
      unit: clean(r[6]),
      price: toPaisa(r[10]),
    });
  }
  const params = [...paramMap.values()];

  // ----- Clients (Client sheet) -----
  const clients: Array<Record<string, string | null>> = [];
  for (const r of clientRows.filter(isData)) {
    const company = clean(r[3]);
    if (!company) continue;
    clients.push({
      company,
      sector: clean(r[2]),
      addressLine1: clean(r[4]),
      addressLine2: clean(r[5]),
      city: clean(r[6]),
      ntn: clean(r[7]),
      stn: clean(r[8]),
      contactPerson: clean(r[9]),
      contactNumber: clean(r[10]),
      email: clean(r[11]),
      address: null,
    });
  }

  // ----- Third-party / export clients (TP Client sheet) -----
  // Rows 1-5: col3 = local exporter, col4 = foreign third-party, col7 = country.
  // Row  6 : plain local client (no third-party name; address starts at col4).
  for (const r of tpRows.filter(isData)) {
    const hasContact = clean(r[8]) || clean(r[9]) || clean(r[10]);
    if (hasContact) {
      // plain local client shape
      const company = clean(r[3]);
      if (!company) continue;
      clients.push({
        company,
        sector: clean(r[2]),
        addressLine1: clean(r[4]),
        addressLine2: clean(r[5]),
        city: clean(r[7]),
        ntn: null,
        stn: null,
        contactPerson: clean(r[8]),
        contactNumber: clean(r[9]),
        email: clean(r[10]),
        address: null,
      });
    } else {
      // export shape: foreign third-party client, exporter recorded in `address`
      const company = clean(r[4]) ?? clean(r[3]);
      if (!company) continue;
      const exporter = clean(r[3]);
      clients.push({
        company,
        sector: clean(r[2]),
        addressLine1: clean(r[5]),
        addressLine2: clean(r[6]),
        city: null,
        country: clean(r[7]),
        ntn: null,
        stn: null,
        contactPerson: clean(r[8]),
        contactNumber: clean(r[9]),
        email: clean(r[10]),
        address: exporter ? `Export via: ${exporter}` : null,
      });
    }
  }

  console.log(`Parsed ${params.length} parameters, ${clients.length} clients.`);

  await prisma.$transaction(async (tx) => {
    // ---- discard dependent + previous data ----
    await tx.sampleParameter.deleteMany();
    await tx.finalReport.deleteMany();
    await tx.sample.deleteMany();
    await tx.testQuotationItem.deleteMany();
    await tx.testQuotation.deleteMany();
    await tx.payment.deleteMany();
    await tx.invoice.deleteMany();
    // portal-user logins point at a client; detach before deleting clients
    await tx.user.updateMany({ where: { clientId: { not: null } }, data: { clientId: null } });
    await tx.parameterSectorPrice.deleteMany();
    await tx.packageParameter.deleteMany();
    await tx.client.deleteMany();
    await tx.parameter.deleteMany();

    // ---- reload parameters ----
    if (params.length)
      await tx.parameter.createMany({ data: params, skipDuplicates: true });

    // ---- save each price for every sector ----
    // The sheet lists one price per test but the app prices per sector, and only
    // a ParameterSectorPrice row counts as a saved price (lib/pricing.ts). Same
    // fan-out the Excel importer does — see lib/xlsx/after-import.ts.
    const priced = await tx.parameter.findMany({
      where: { price: { not: null } },
      select: { id: true, price: true },
    });
    if (priced.length)
      await tx.parameterSectorPrice.createMany({
        data: priced.flatMap((p) =>
          SECTORS.map((sector) => ({ parameterId: p.id, sector, price: p.price! })),
        ),
        skipDuplicates: true,
      });

    // ---- reload clients with sequential CLI-##### numbers ----
    let n = 0;
    for (const c of clients) {
      n += 1;
      await tx.client.create({
        // `c` is built dynamically from the sheet, so its `company` is only
        // known to be present at runtime (rows without one are skipped above).
        data: {
          clientNo: `CLI-${String(n).padStart(5, "0")}`,
          facilityId: LAHORE_FACILITY_ID,
          ...c,
        } as Prisma.ClientUncheckedCreateInput,
      });
    }

    // ---- keep the CLIENT sequence in step so future creates don't collide ----
    await tx.sequence.upsert({
      where: { key: "CLIENT" },
      update: { counter: n },
      create: { key: "CLIENT", prefix: "CLI", counter: n },
    });
  }, { timeout: 120000 });

  const [pc, cc] = await Promise.all([prisma.parameter.count(), prisma.client.count()]);
  console.log(`Done. Parameters in DB: ${pc}, Clients in DB: ${cc}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
