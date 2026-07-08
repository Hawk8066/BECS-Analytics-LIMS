import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/db";
import { signUndertaking } from "@/lib/actions/undertaking";
import {
  IMPARTIALITY_POLICY,
  CONFIDENTIALITY_POLICY,
  UNDERTAKING,
  type PolicyDoc,
} from "@/content/iso-documents";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function PolicyCard({ doc }: { doc: PolicyDoc }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{doc.title}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {doc.code} · v{doc.version}
        </p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-relaxed">
        {doc.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </CardContent>
    </Card>
  );
}

export default async function UndertakingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const signings = await prisma.impartialityUndertaking.findMany({
    where: { userId: user.id },
    orderBy: { year: "desc" },
  });
  const currentYear = new Date().getFullYear();
  const signedThisYear = signings.find((s) => s.year === currentYear);

  const policiesPanel = (
    <div className="space-y-6">
      <PolicyCard doc={IMPARTIALITY_POLICY} />
      <PolicyCard doc={CONFIDENTIALITY_POLICY} />
    </div>
  );

  const undertakingPanel = (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Impartiality &amp; Confidentiality Undertaking
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {UNDERTAKING.code} · v{UNDERTAKING.version}
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm leading-relaxed">
        <p>{UNDERTAKING.intro}</p>
        <ol className="list-decimal space-y-2 pl-5">
          {UNDERTAKING.clauses.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ol>
        {signedThisYear ? (
          <Badge>
            Signed for {currentYear} on {formatDate(signedThisYear.signedAt)}
          </Badge>
        ) : (
          <form action={signUndertaking} className="space-y-2">
            <p className="text-sm font-medium text-amber-700">
              Your {currentYear} undertaking is not yet signed.
            </p>
            <Button type="submit">I agree &amp; sign</Button>
          </form>
        )}

        <div className="border-t pt-4">
          <p className="mb-2 text-sm font-medium">Signing log</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Year</TableHead>
                <TableHead>Signed on</TableHead>
                <TableHead>Version</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {signings.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.year}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(s.signedAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">v{s.version}</TableCell>
                </TableRow>
              ))}
              {signings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    Not signed yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  const tabs: TabItem[] = [
    { key: "policies", label: "Policies", content: policiesPanel },
    {
      key: "undertaking",
      label: "Undertaking",
      badge: signedThisYear ? "✓" : undefined,
      content: undertakingPanel,
    },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Impartiality &amp; Confidentiality</h1>
        <p className="text-sm text-muted-foreground">
          Laboratory policies and the e-signed personnel undertaking (ISO/IEC 17025).
        </p>
      </div>
      <Tabs tabs={tabs} defaultTab="policies" />
    </div>
  );
}
