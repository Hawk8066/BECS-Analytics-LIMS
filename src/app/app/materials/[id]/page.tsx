import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canManageMaterials } from "@/lib/auth/perms";
import { MaterialAttachmentForm } from "./attachment-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const KIND_OPTIONS: Record<string, string[]> = {
  CHEMICAL: ["COA", "MSDS"],
  CRM: ["REF_CERT"],
  GLASSWARE: ["CAL_CERT"],
  LAB_SUPPLY: ["DOC"],
};

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-2 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{value || "—"}</span>
    </div>
  );
}

export default async function MaterialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const item = await prisma.materialItem.findUnique({ where: { id } });
  if (!item) notFound();
  if (
    !user.canReadCrossSection &&
    (item.facilityId !== user.facilityId || item.sectionId !== user.sectionId)
  ) {
    notFound();
  }

  const attachments = await prisma.attachment.findMany({
    where: { ownerType: "MaterialItem", ownerId: id },
    orderBy: { createdAt: "desc" },
  });
  const canManage = canManageMaterials(user.designation);
  const kinds = KIND_OPTIONS[item.type] ?? ["DOC"];
  const missingCoA =
    item.type === "CHEMICAL" && !attachments.some((a) => a.kind === "COA");

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{item.name}</h1>
        <Badge variant="outline">{item.type}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Field label="Lot No" value={item.lotNo} />
          {item.type === "CRM" && (
            <Field label="Certified value" value={item.certifiedValue} />
          )}
          <Field
            label="Expiry"
            value={item.expiry ? item.expiry.toISOString().slice(0, 10) : null}
          />
          <Field label="Unit" value={item.unit} />
        </CardContent>
      </Card>

      {missingCoA && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This chemical has no Certificate of Analysis (CoA) attached — it cannot
          be stocked until a CoA is provided (BR-EQ-3).
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Certificates &amp; documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kind</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Uploaded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attachments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Badge variant="secondary">{a.kind}</Badge>
                  </TableCell>
                  <TableCell>
                    <a
                      href={`/api/files/${a.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#1ca9e6] hover:underline"
                    >
                      {a.fileName}
                    </a>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.createdAt.toISOString().slice(0, 10)}
                  </TableCell>
                </TableRow>
              ))}
              {attachments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    No documents attached.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {canManage && (
            <MaterialAttachmentForm materialId={item.id} kinds={kinds} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
