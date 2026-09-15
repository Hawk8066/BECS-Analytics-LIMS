import { prisma } from "@/lib/db";
import { nextNumber } from "@/lib/numbering";
import { ACCOUNTS } from "@/lib/finance/accounts";

// Double-entry posting (ADR-0004, BR-16). Every financial event posts a balanced
// journal entry (Σ debits = Σ credits). Amounts in PKR paisa.
export type PostingLine = {
  accountCode: string;
  debit?: number;
  credit?: number;
};

export async function postJournal(opts: {
  memo: string;
  createdById?: string | null;
  lines: PostingLine[];
}) {
  const totalDr = opts.lines.reduce((s, l) => s + (l.debit ?? 0), 0);
  const totalCr = opts.lines.reduce((s, l) => s + (l.credit ?? 0), 0);
  if (totalDr !== totalCr) throw new Error("Journal entry is not balanced.");
  if (totalDr === 0) throw new Error("Journal entry is empty.");

  const codes = [...new Set(opts.lines.map((l) => l.accountCode))];
  const accounts = await prisma.chartOfAccount.findMany({
    where: { code: { in: codes } },
  });
  const byCode = new Map(accounts.map((a) => [a.code, a.id]));
  // A code in the canonical chart that the database hasn't got yet is created on
  // first use, so adding an account is a code change alone — no reseed. Anything
  // outside the chart is a typo and still fails.
  for (const c of codes) {
    if (byCode.has(c)) continue;
    const canonical = ACCOUNTS.find((a) => a.code === c);
    if (!canonical) throw new Error(`Account ${c} not found.`);
    const created = await prisma.chartOfAccount.upsert({
      where: { code: c },
      update: {},
      create: canonical,
    });
    byCode.set(c, created.id);
  }

  const year = new Date().getFullYear();
  const entryNo = await nextNumber({ key: `JE:${year}`, prefix: "JE", year, pad: 6 });

  return prisma.journalEntry.create({
    data: {
      entryNo,
      memo: opts.memo,
      createdById: opts.createdById ?? null,
      lines: {
        create: opts.lines.map((l) => ({
          accountId: byCode.get(l.accountCode)!,
          debit: l.debit ?? 0,
          credit: l.credit ?? 0,
        })),
      },
    },
  });
}
