import "server-only";
import { prisma } from "@/lib/db";
import { readScope } from "@/lib/db/scope";
import type { SessionUser } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/capability-store";
import type { CapabilityKey } from "@/lib/auth/capabilities";
import { stockLevel } from "@/lib/inventory";

/**
 * Standing work, derived at read time — the bell's "Tasks" tab.
 *
 * Why derived rather than stored: "3 PRs await your approval", "5 items at
 * reorder", "2 calibrations due" are ongoing *conditions*, not events. There is
 * no discrete moment to fire on (and no cron/worker in this app). Computing them
 * on read means they self-clear the instant the work is done, can never be stale,
 * need no dedupe or retention, and require ZERO changes to any server action.
 *
 * Blinding is guaranteed by construction: `count()` returns a bare number, so a
 * task line physically cannot contain client identity.
 *
 * A provider only runs for a viewer who holds its capability, so the queries are
 * also the authorisation boundary.
 */

export interface TaskProvider {
  key: string;
  capability: CapabilityKey;
  href: string;
  label: (n: number) => string;
  count: (user: SessionUser) => Promise<number>;
}

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** 30 days out — the window used for "due soon" style tasks. */
function soon(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d;
}

export const TASK_PROVIDERS: TaskProvider[] = [
  // --- Personnel -------------------------------------------------------------
  {
    key: "profilesPending",
    capability: "approveProfile",
    href: "/app/personnel",
    label: (n) => `${plural(n, "profile")} awaiting your approval`,
    count: (u) =>
      prisma.user.count({
        where: { ...readScope(u), status: "PENDING_APPROVAL" },
      }),
  },
  {
    key: "functionsPending",
    capability: "approveFunction",
    href: "/app/functions",
    label: (n) => `${plural(n, "function")} awaiting approval`,
    count: () => prisma.function.count({ where: { approvedAt: null } }),
  },
  {
    key: "leavePending",
    capability: "approveLeave",
    href: "/app/leave",
    label: (n) => `${plural(n, "leave application")} to decide`,
    count: (u) =>
      prisma.leaveApplication.count({
        where: { ...readScope(u), status: "PENDING" },
      }),
  },

  // --- Samples & testing -----------------------------------------------------
  {
    key: "samplesToAssign",
    capability: "coordinateTesting",
    href: "/app/samples",
    label: (n) => `${plural(n, "sample")} to assign`,
    count: (u) =>
      prisma.sample.count({ where: { ...readScope(u), status: "REGISTERED" } }),
  },
  {
    key: "samplesToVerify",
    capability: "coordinateTesting",
    href: "/app/samples",
    label: (n) => `${plural(n, "sample")} to verify`,
    count: (u) =>
      prisma.sample.count({
        where: { ...readScope(u), status: "RESULTS_ENTERED" },
      }),
  },
  {
    key: "samplesToApprove",
    capability: "approveSample",
    href: "/app/samples",
    label: (n) => `${plural(n, "sample")} awaiting your approval`,
    count: (u) =>
      prisma.sample.count({ where: { ...readScope(u), status: "VERIFIED" } }),
  },

  // --- Procurement -----------------------------------------------------------
  {
    key: "prsToVerify",
    capability: "verifyPR",
    href: "/app/procurement",
    label: (n) => `${plural(n, "purchase request")} to verify`,
    count: (u) =>
      prisma.purchaseRequest.count({
        where: { ...readScope(u), status: "SUBMITTED" },
      }),
  },
  {
    key: "prsToApprove",
    capability: "approvePR",
    href: "/app/procurement",
    label: (n) => `${plural(n, "purchase request")} awaiting your approval`,
    count: (u) =>
      prisma.purchaseRequest.count({
        where: { ...readScope(u), status: "VERIFIED" },
      }),
  },

  // --- Stores ----------------------------------------------------------------
  {
    key: "issueRequestsPending",
    capability: "manageStore",
    href: "/app/inventory",
    label: (n) => `${plural(n, "issue request")} to decide`,
    count: () => prisma.issueRequest.count({ where: { status: "PENDING" } }),
  },
  {
    key: "itemsAtReorder",
    capability: "manageStore",
    href: "/app/inventory",
    label: (n) => `${plural(n, "item")} at or below reorder level`,
    count: async () => {
      const items = await prisma.inventoryItem.findMany({
        select: { quantity: true, reorderLevel: true },
      });
      return items.filter((i) => stockLevel(i.quantity, i.reorderLevel) !== "OK")
        .length;
    },
  },

  // --- Equipment & materials (time-based, evaluated on read) -----------------
  {
    key: "calibrationsDue",
    capability: "manageEquipment",
    href: "/app/equipment",
    label: (n) => `${plural(n, "instrument")} due for calibration`,
    count: (u) =>
      prisma.equipment.count({
        where: {
          ...readScope(u),
          calibrations: { none: { validUntil: { gte: soon() } } },
        },
      }),
  },

  // --- Production QC ---------------------------------------------------------
  {
    key: "qcLotsToApprove",
    capability: "approveLot",
    href: "/btf-qc",
    label: (n) => `${plural(n, "QC lot")} awaiting your review`,
    count: () => prisma.qcLot.count({ where: { status: "SUBMITTED" } }),
  },

  // --- Finance ---------------------------------------------------------------
  {
    key: "payrollToApprove",
    capability: "approvePayroll",
    href: "/app/finance/payroll",
    label: (n) => `${plural(n, "payroll run")} awaiting your approval`,
    count: () => prisma.payrollRun.count({ where: { status: "DRAFT" } }),
  },
];

export interface TaskItem {
  key: string;
  text: string;
  href: string;
  count: number;
}

/** Run every provider the viewer holds the capability for; drop empty ones. */
export async function getTasks(user: SessionUser): Promise<TaskItem[]> {
  const mine = TASK_PROVIDERS.filter((p) =>
    hasCapability(p.capability, user.designation),
  );
  const counts = await Promise.all(
    mine.map(async (p) => {
      try {
        return await p.count(user);
      } catch {
        return 0; // one broken provider must not empty the whole tab
      }
    }),
  );
  return mine
    .map((p, i) => ({
      key: p.key,
      text: p.label(counts[i]),
      href: p.href,
      count: counts[i],
    }))
    .filter((t) => t.count > 0);
}
