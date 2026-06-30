import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/db";
import { signUndertaking } from "@/lib/actions/undertaking";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const UNDERTAKING_TEXT = `I undertake to act impartially and to safeguard the
confidentiality of all client information and test data handled in the course of
my duties at BECS Analytics. I will declare any conflict of interest, will not
allow commercial, financial, or other pressures to compromise the integrity of
testing or reporting, and will comply with the laboratory's impartiality and
confidentiality policy.`;

export default async function UndertakingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const undertaking = await prisma.impartialityUndertaking.findUnique({
    where: { userId: user.id },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Impartiality &amp; Confidentiality Undertaking
        </h1>
        <p className="text-sm text-muted-foreground">
          E-signed acknowledgement (recorded with a signature and audit entry).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Undertaking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-line text-sm leading-relaxed">
            {UNDERTAKING_TEXT}
          </p>
          {undertaking ? (
            <Badge>
              Signed on {formatDate(undertaking.signedAt)}
            </Badge>
          ) : (
            <form action={signUndertaking}>
              <Button type="submit">I agree &amp; sign</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
