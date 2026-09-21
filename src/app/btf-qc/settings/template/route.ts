import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canAdminister } from "@/lib/auth/perms";
import { writeWorkbook } from "@/lib/xlsx/write";
import { lotTemplateRows } from "@/lib/qc/lot-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A ready-to-fill .xlsx for the bulk lot import.
 *
 * The example row uses a product that actually exists, so the Product column
 * cannot be filled in with a name the importer will then reject — the most
 * likely way a first attempt fails.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user || user.status !== "ACTIVE") return new Response(null, { status: 401 });
  if (!canAdminister(user.designation)) return new Response(null, { status: 403 });

  // ProductType carries facilityId but declares no `facility` relation, so the
  // id has to be resolved first.
  const facility = await prisma.facility.findFirst({
    where: { code: "RYK" },
    select: { id: true },
  });
  const product = facility
    ? await prisma.productType.findFirst({
        where: { facilityId: facility.id },
        orderBy: { sortOrder: "asc" },
        select: { name: true },
      })
    : null;

  const buf = writeWorkbook([
    { name: "QC lots", rows: lotTemplateRows(product?.name) },
  ]);

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="qc-lots-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
