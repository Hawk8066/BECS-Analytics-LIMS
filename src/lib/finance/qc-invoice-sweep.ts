import "server-only";
import { prisma } from "@/lib/db";
import {
  QC_FACILITY_CODE,
  generateMonthlyQcInvoice,
} from "@/lib/finance/qc-invoice";

/**
 * Month-end generation without a scheduler.
 *
 * There is no cron, queue or worker in this app, so "raise the invoice on the
 * last day of the month" is done the same way feed retention is: opportunistically,
 * off a page someone was going to load anyway, self-throttled per process.
 *
 * The sweep walks every closed month that still has unbilled approved lots and
 * raises the invoice for it. Because `generateMonthlyQcInvoice` is idempotent,
 * running it on every request would be correct too — the throttle only exists to
 * keep it off the hot path.
 *
 * Invoices raised this way have no `issuedById`: nobody pressed anything, and
 * attributing an automatic posting to whoever happened to open the page would be
 * a lie in the audit trail. Pressing the button on the QC reports page attributes
 * it to that user instead.
 */
const THROTTLE_MS = 10 * 60 * 1000;
/** Never walk back further than this, so a stale dataset cannot fan out. */
const MAX_MONTHS = 24;

let lastSweptAt = 0;

export async function sweepMonthlyQcInvoices(): Promise<void> {
  const now = Date.now();
  if (now - lastSweptAt < THROTTLE_MS) return;
  lastSweptAt = now; // set before awaiting so concurrent loads do not pile up

  try {
    const facility = await prisma.facility.findFirst({
      where: { code: QC_FACILITY_CODE },
      select: { id: true, qcBillingClientId: true },
    });
    // No facility, or no client configured to consolidate onto: nothing this
    // sweep can do. The QC reports screen says so and offers the picker.
    if (!facility?.qcBillingClientId) return;

    // The oldest approved-but-unbilled lot decides how far back to walk. With
    // nothing outstanding there is nothing to do, which is the usual case.
    const oldest = await prisma.qcLot.findFirst({
      where: {
        facilityId: facility.id,
        status: "APPROVED",
        invoiceId: null,
        approvedAt: { not: null },
      },
      orderBy: { approvedAt: "asc" },
      select: { approvedAt: true },
    });
    if (!oldest?.approvedAt) return;

    const today = new Date();
    // Last closed month: this month has not ended, so it is never billed here.
    const lastClosed = new Date(today.getFullYear(), today.getMonth(), 1);
    const cursor = new Date(
      oldest.approvedAt.getFullYear(),
      oldest.approvedAt.getMonth(),
      1,
    );

    for (let i = 0; i < MAX_MONTHS && cursor < lastClosed; i += 1) {
      await generateMonthlyQcInvoice({
        year: cursor.getFullYear(),
        month0: cursor.getMonth(),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  } catch (e) {
    // Never let billing generation break the page that triggered it.
    console.error("[qc-invoice] monthly sweep failed", e);
  }
}
