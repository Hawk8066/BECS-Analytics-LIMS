import { UNDERTAKING } from "@/content/iso-documents";
import { signUndertaking } from "@/lib/actions/undertaking";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Blocking gate shown across the app until the user signs the current year's
// undertaking (first sign-in, and again at the start of each year).
export function UndertakingGate({ year }: { year: number }) {
  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Sign your {year} Impartiality &amp; Confidentiality Undertaking
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            You must sign this undertaking before continuing. It is required on your
            first sign-in and again at the start of each calendar year.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed">
          <p>{UNDERTAKING.intro}</p>
          <ol className="list-decimal space-y-2 pl-5">
            {UNDERTAKING.clauses.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ol>
          <form action={signUndertaking}>
            <Button type="submit">I agree &amp; sign</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
