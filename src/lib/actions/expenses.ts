"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { canManageOutsourceBilling } from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";
import { nextNumber } from "@/lib/numbering";
import { postJournal } from "@/lib/finance/posting";
import { expenseAccountFor, sourceAccountFor } from "@/lib/finance/accounts";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from "@/lib/labels";

export type FormState = { error?: string; ok?: boolean };

function toPaisa(pkr: string): number {
  const n = parseFloat(pkr);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/**
 * Record a running cost that is paid outright — a utility bill, rent, fuel.
 * Posts Dr <expense account> / Cr Bank (or Cash); nothing sits in payables
 * because the money has already left.
 */
export async function recordExpense(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!canManageOutsourceBilling(actor.designation))
    return { error: "Not permitted to record expenses." };

  const raw = String(formData.get("category") || "");
  const category = EXPENSE_CATEGORIES.find((c) => c === raw);
  if (!category) return { error: "Choose what the payment was for." };

  const amount = toPaisa(String(formData.get("amount") || "0"));
  if (amount <= 0) return { error: "Amount must be greater than zero." };

  const payee = String(formData.get("payee") || "").trim() || null;
  const memo = String(formData.get("memo") || "").trim() || null;
  const paidFrom = String(formData.get("paidFrom") || "BANK") === "CASH" ? "CASH" : "BANK";

  // DateInput submits ISO yyyy-mm-dd; an empty field means "today".
  const spentAtRaw = String(formData.get("spentAt") || "").trim();
  const spentAt = spentAtRaw ? new Date(`${spentAtRaw}T00:00:00Z`) : new Date();
  if (Number.isNaN(spentAt.getTime())) return { error: "Enter a valid date." };

  const facility = await prisma.facility.findUnique({
    where: { id: actor.facilityId },
  });
  const year = new Date().getFullYear();
  const expenseNo = await nextNumber({
    key: `EXP:${facility!.code}:${year}`,
    prefix: `EXP-${facility!.code}`,
    year,
    pad: 5,
  });

  const entry = await postJournal({
    memo: `${expenseNo} — ${payee ?? EXPENSE_CATEGORY_LABELS[category]}`,
    createdById: actor.id,
    lines: [
      { accountCode: expenseAccountFor(category), debit: amount },
      { accountCode: sourceAccountFor(paidFrom), credit: amount },
    ],
  });
  const expense = await prisma.expense.create({
    data: {
      expenseNo,
      category,
      payee,
      memo,
      amount,
      paidFrom,
      spentAt,
      journalEntryId: entry.id,
      facilityId: actor.facilityId,
      createdById: actor.id,
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "Expense",
    entityId: expense.id,
    after: { expenseNo, category, amount, payee, paidFrom },
    facilityId: actor.facilityId,
  });

  revalidatePath("/app/finance/expenses");
  revalidatePath("/app/finance");
  return { ok: true };
}
