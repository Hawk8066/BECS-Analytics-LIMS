import { prisma } from "@/lib/db";

// Gap-free, facility/section-prefixed, concurrency-safe identifiers (SSOT §11, BR-7).
// The atomic `increment` inside upsert guarantees no duplicate counters under
// concurrency. Callers compose the series `key` (e.g. "SAMPLE:LHR:2026").

export interface NumberParams {
  key: string;
  prefix: string; // e.g. "LHR-S"
  year?: number; // included in the rendered id and resets per (key) by convention
  pad?: number; // zero-pad width for the counter (default 5)
}

export async function nextNumber({
  key,
  prefix,
  year,
  pad = 5,
}: NumberParams): Promise<string> {
  const seq = await prisma.sequence.upsert({
    where: { key },
    update: { counter: { increment: 1 } },
    create: { key, prefix, year: year ?? null, counter: 1 },
  });

  const segments = [prefix];
  if (year) segments.push(String(year));
  segments.push(String(seq.counter).padStart(pad, "0"));
  return segments.join("-");
}
