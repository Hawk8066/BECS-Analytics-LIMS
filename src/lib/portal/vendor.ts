import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/current-user";

/** Shared guard and queries for the vendor portal's three routes. */

export async function requireVendor() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.designation !== "VENDOR" || !user.vendorId) redirect("/app");
  const vendor = await prisma.vendor.findUnique({ where: { id: user.vendorId } });
  // The account points at a vendor that no longer exists — treat as signed out
  // rather than rendering a portal with nothing behind it.
  if (!vendor) redirect("/login");
  return { user, vendorId: user.vendorId, vendor };
}

export function vendorOrders(vendorId: string) {
  return prisma.purchaseOrder.findMany({
    where: { vendorId },
    orderBy: { createdAt: "desc" },
  });
}

export function vendorQuotations(vendorId: string) {
  return prisma.quotation.findMany({
    where: { vendorId },
    include: { pr: { select: { prNo: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/** Counts for the sidebar badges. */
export async function vendorCounts(vendorId: string) {
  const [orders, quotations] = await Promise.all([
    // Open work only: a delivered or cancelled PO is history, not a to-do.
    prisma.purchaseOrder.count({ where: { vendorId, status: "ISSUED" } }),
    prisma.quotation.count({ where: { vendorId } }),
  ]);
  return { orders, quotations };
}
