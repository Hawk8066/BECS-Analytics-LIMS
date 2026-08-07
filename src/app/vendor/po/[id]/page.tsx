import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { PrintButton } from "@/components/print-button";
import { PoDocument } from "@/components/procurement/po-document";

export default async function VendorPOPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.designation !== "VENDOR" || !user.vendorId) redirect("/app");

  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      vendor: true,
      lines: true,
      pr: { select: { prNo: true, facilityId: true } },
    },
  });
  // A vendor may only view its own orders.
  if (!po || po.vendorId !== user.vendorId) notFound();

  const facility = await prisma.facility.findUnique({
    where: { id: po.pr.facilityId },
    select: { name: true },
  });

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #po-doc, #po-doc * { visibility: visible !important; }
          #po-doc { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
          @page { size: A4; margin: 14mm; }
        }
      `}</style>

      <div className="space-y-4">
        <div className="flex items-center justify-between print:hidden">
          <Link href="/vendor" className="text-sm text-muted-foreground underline">
            ← Back to portal
          </Link>
          <PrintButton />
        </div>

        <PoDocument
          po={{
            poNo: po.poNo,
            status: po.status,
            createdAt: po.createdAt,
            amount: po.amount,
            prNo: po.pr.prNo,
            vendor: po.vendor,
            lines: po.lines,
          }}
          facilityName={facility?.name ?? null}
          issuedByName=""
        />
      </div>
    </>
  );
}
