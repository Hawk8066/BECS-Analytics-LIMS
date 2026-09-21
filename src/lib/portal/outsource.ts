import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/current-user";

/**
 * Shared data for the outsource-lab portal, now that its two sections are two
 * routes. Keeping the select in one place is the point: it is a blinding
 * boundary, and a second copy is how a client name eventually leaks into a
 * subcontractor's screen.
 */

/** Blinded: ONLY the coded Lab ID, sample type and parameter. Never the client,
 * client ref, third-party name, instructions or standard name. */
const SELECT = {
  id: true,
  unit: true,
  limitMin: true,
  limitMax: true,
  resultValue: true,
  conformity: true,
  registerNo: true,
  enteredAt: true,
  parameter: { select: { name: true, unit: true } },
  sample: { select: { labId: true, sampleType: true } },
} as const;

export type OutsourceTest = Awaited<ReturnType<typeof pendingTests>>[number];

/** The signed-in lab, or a redirect. Every route and the layout calls this. */
export async function requireOutsourceLab() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.designation !== "OUTSOURCE_LAB" || !user.outsourceLabId)
    redirect("/app");
  return { user, labId: user.outsourceLabId };
}

/** Awaiting our result — only while the sample is still open for entry. */
export function pendingTests(labId: string) {
  return prisma.sampleParameter.findMany({
    where: {
      outsourceLabId: labId,
      resultValue: null,
      sample: { status: "ASSIGNED" },
    },
    select: SELECT,
    orderBy: { createdAt: "asc" },
  });
}

/** Already submitted, kept visible after the sample advances. */
export function submittedTests(labId: string) {
  return prisma.sampleParameter.findMany({
    where: { outsourceLabId: labId, resultValue: { not: null } },
    select: SELECT,
    orderBy: { enteredAt: "desc" },
    take: 100,
  });
}

export function pendingCount(labId: string) {
  return prisma.sampleParameter.count({
    where: {
      outsourceLabId: labId,
      resultValue: null,
      sample: { status: "ASSIGNED" },
    },
  });
}
