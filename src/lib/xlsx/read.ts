/**
 * Dependency-free .xlsx reader.
 *
 * An .xlsx file is a ZIP of XML parts. We read the central directory, inflate
 * the parts we need, and pull cell text out of the sheet XML. Ported from the
 * one-off reader in `prisma/import-becs-db.ts`, with two changes needed for
 * browser uploads:
 *   - takes a Buffer instead of a file path
 *   - resolves worksheets by their real sheet name (via workbook.xml + rels)
 *     rather than assuming `sheet1.xml`, `sheet2.xml`, …
 *
 * Every cell comes back as a string; typing is the caller's job (see
 * `src/lib/xlsx/rows.ts`, which coerces against the Prisma field type).
 */
import { inflateRawSync } from "node:zlib";

export interface Sheet {
  name: string;
  /** Row-major cells. Sparse: a gap in the sheet leaves an empty string. */
  rows: string[][];
}

// ---------- ZIP (central directory) ----------

function unzip(buf: Buffer): Map<string, Buffer> {
  // End of Central Directory record — scan back from the tail for its signature.
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("Not a valid .xlsx file (no ZIP end-of-directory record).");

  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);

  const out = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    if (off + 46 > buf.length) break;
    if (buf.readUInt32LE(off) !== 0x02014b50) break; // central directory header
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString("utf8", off + 46, off + 46 + nameLen);

    // The local header repeats the name/extra lengths — data starts after them.
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const comp = buf.subarray(dataStart, dataStart + compSize);

    try {
      out.set(name, method === 0 ? comp : inflateRawSync(comp));
    } catch {
      // A part we can't inflate is skipped rather than failing the whole file.
    }

    off += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

// ---------- XML helpers ----------

function decode(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#10;/g, "\n")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, "&");
}

/** "AB12" -> zero-based column index. */
function colIdx(ref: string): number {
  const m = ref.match(/^([A-Z]+)/);
  if (!m) return 0;
  let n = 0;
  for (const c of m[1]) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

function sharedStrings(xml: string): string[] {
  const out: string[] = [];
  const siRe = /<si>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = siRe.exec(xml))) {
    // A shared string may be split across several runs (<r><t>…</t></r>).
    const tRe = /<t[^>]*>([\s\S]*?)<\/t>/g;
    let t: RegExpExecArray | null;
    let s = "";
    while ((t = tRe.exec(m[1]))) s += t[1];
    out.push(decode(s));
  }
  return out;
}

function parseRows(xml: string, ss: string[]): string[][] {
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
      if (isM) val = decode(isM[1]); // inline string
      else if (type === "s" && vM) val = ss[parseInt(vM[1], 10)] ?? "";
      else if (type === "b" && vM) val = vM[1] === "1" ? "true" : "false";
      else if (vM) val = decode(vM[1]);
      cells[idx] = val;
    }
    // Normalise the sparse array so callers can index positionally.
    for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = "";
    result.push(cells);
  }
  return result;
}

/** Sheet name -> worksheet part path, in workbook order. */
function sheetParts(zip: Map<string, Buffer>): Array<{ name: string; part: string }> {
  const wb = zip.get("xl/workbook.xml")?.toString("utf8");
  const rels = zip.get("xl/_rels/workbook.xml.rels")?.toString("utf8");
  if (!wb) return [];

  const relTarget = new Map<string, string>();
  if (rels) {
    const re = /<Relationship\b[^>]*\/>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(rels))) {
      const id = m[0].match(/Id="([^"]+)"/)?.[1];
      const target = m[0].match(/Target="([^"]+)"/)?.[1];
      if (id && target) relTarget.set(id, target.replace(/^\/?xl\//, "").replace(/^\//, ""));
    }
  }

  const out: Array<{ name: string; part: string }> = [];
  const sheetRe = /<sheet\b[^>]*\/?>/g;
  let m: RegExpExecArray | null;
  let fallback = 0;
  while ((m = sheetRe.exec(wb))) {
    fallback++;
    const name = decode(m[0].match(/name="([^"]*)"/)?.[1] ?? `Sheet${fallback}`);
    const rid = m[0].match(/r:id="([^"]+)"/)?.[1];
    const target = rid ? relTarget.get(rid) : undefined;
    const part = `xl/${target ?? `worksheets/sheet${fallback}.xml`}`;
    out.push({ name, part });
  }
  return out;
}

/** Parse an .xlsx buffer into its sheets, in workbook order. */
export function readWorkbook(buf: Buffer): Sheet[] {
  const zip = unzip(buf);

  const ssPart = zip.get("xl/sharedStrings.xml");
  const ss = ssPart ? sharedStrings(ssPart.toString("utf8")) : [];

  const parts = sheetParts(zip);
  if (parts.length === 0) throw new Error("No worksheets found in the workbook.");

  const sheets: Sheet[] = [];
  for (const { name, part } of parts) {
    const xml = zip.get(part);
    if (!xml) continue;
    sheets.push({ name, rows: parseRows(xml.toString("utf8"), ss) });
  }
  if (sheets.length === 0) throw new Error("No readable worksheets found in the workbook.");
  return sheets;
}

/**
 * Excel stores dates as a day count from 1899-12-30 (the 1900 leap-year bug is
 * baked into the epoch). Cells therefore arrive as bare numbers; convert only
 * when the target field is a date.
 */
export function excelSerialToDate(serial: number): Date {
  const ms = Math.round(serial * 86400 * 1000);
  return new Date(Date.UTC(1899, 11, 30) + ms);
}
