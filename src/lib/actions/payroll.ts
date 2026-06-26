"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { canApprovePayroll, canManagePayroll } from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";
import { postJournal } from "@/lib/finance/posting";
import { computePayrollItem } from "@/lib/finance/payroll";

function toPaisa(x: FormDataEntryValue | null): number {
  const n = parseFloat(String(x ?? "0"));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
function toInt(x: FormDataEntryValue | null): number {
  const n = parseInt(String(x ?? "0"), 10);
  return Number.isFinite(n) ? n : 0;
}

// Accountant sets/updates an employee's salary structure (PKR inputs).
export async function setSalaryStructure(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canManagePayroll(actor.designation))
    throw new Error("Not permitted to set salary structures.");

  const userId = String(formData.get("userId"));
  const data = {
    basic: toPaisa(formData.get("basic")),
    houseRent: toPaisa(formData.get("houseRent")),
    conveyance: toPaisa(formData.get("conveyance")),
    medical: toPaisa(formData.get("medical")),
    otherAllowances: toPaisa(formData.get("otherAllowances")),
    providentFundPct: toInt(formData.get("providentFundPct")),
    eobi: toPaisa(formData.get("eobi")),
  };
  await prisma.salaryStructure.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
  await writeAudit({
    actorId: actor.id,
    action: "UPDATE",
    entityType: "SalaryStructure",
    entityId: userId,
    after: { basic: data.basic },
  });
  revalidatePath("/app/finance/payroll/structures");
}

// Prepare a monthly payroll run (DRAFT) computing each item from its structure.
export async function createPayrollRun(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canManagePayroll(actor.designation))
    throw new Error("Not permitted to prepare payroll.");

  const period = String(formData.get("period") || "");
  if (!/^\d{4}-\d{2}$/.test(period))
    throw new Error("Period must be in YYYY-MM format.");

  const facility = await prisma.facility.findUnique({
    where: { id: actor.facilityId },
  });
  const runNo = `PAY-${facility!.code}-${period}`;
  const existing = await prisma.payrollRun.findUnique({ where: { runNo } });
  if (existing) redirect(`/app/finance/payroll/${existing.id}`);

  const structures = await prisma.salaryStructure.findMany();
  if (structures.length === 0)
    throw new Error("No salary structures defined.");

  const run = await prisma.payrollRun.create({
    data: {
      runNo,
      period,
      facilityId: actor.facilityId,
      createdById: actor.id,
      items: {
        create: structures.map((s) => {
          const c = computePayrollItem(s);
          return {
            userId: s.userId,
            gross: c.gross,
            incomeTax: c.incomeTax,
            providentFund: c.providentFund,
            eobi: c.eobi,
            advances: c.advances,
            netPay: c.netPay,
          };
        }),
      },
    },
  });
  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "PayrollRun",
    entityId: run.id,
    after: { runNo, items: structures.length },
    facilityId: actor.facilityId,
  });
  redirect(`/app/finance/payroll/${run.id}`);
}

// COO approves the run; posts Dr Payroll Expense / Cr Bank (net) + AP (deductions).
export async function approvePayrollRun(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canApprovePayroll(actor.designation))
    throw new Error("Only the COO can approve payroll.");

  const id = String(formData.get("runId"));
  const run = await prisma.payrollRun.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!run) throw new Error("Run not found.");
  if (run.status !== "DRAFT") throw new Error("Run is already approved.");

  const gross = run.items.reduce((s, i) => s + i.gross, 0);
  const net = run.items.reduce((s, i) => s + i.netPay, 0);
  const deductions = gross - net;

  const lines = [
    { accountCode: "5100", debit: gross }, // Payroll Expense
    { accountCode: "1010", credit: net }, // Bank
  ];
  if (deductions > 0) lines.push({ accountCode: "2000", credit: deductions }); // AP (statutory)

  const entry = await postJournal({
    memo: `Payroll ${run.runNo}`,
    createdById: actor.id,
    lines,
  });
  await prisma.payrollRun.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedById: actor.id,
      approvedAt: new Date(),
      journalEntryId: entry.id,
    },
  });
  await writeAudit({
    actorId: actor.id,
    action: "APPROVE",
    entityType: "PayrollRun",
    entityId: id,
    after: { status: "APPROVED", gross, net },
    facilityId: run.facilityId,
  });
  revalidatePath(`/app/finance/payroll/${id}`);
}
