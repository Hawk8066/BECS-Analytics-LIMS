import { limitText } from "@/lib/conformity";
import { pendingTests, requireOutsourceLab } from "@/lib/portal/outsource";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OutsourceResultForm } from "./result-form";

export default async function OutsourcePendingPage() {
  const { labId } = await requireOutsourceLab();
  const pending = await pendingTests(labId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Awaiting your result</h1>
        <p className="text-sm text-muted-foreground">
          Enter results for the parameters subcontracted to your lab. Samples are
          identified by a coded Lab ID.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {pending.length} test{pending.length === 1 ? "" : "s"} pending
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing pending. Submitted results are under Submitted.
            </p>
          ) : (
            pending.map((sp) => {
              const limit = limitText(
                sp.limitMin,
                sp.limitMax,
                sp.unit || sp.parameter.unit,
              );
              return (
                <div key={sp.id} className="space-y-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-mono">{sp.sample.labId}</span>
                    <span className="text-muted-foreground">·</span>
                    <span>{sp.sample.sampleType}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="font-medium">
                      {sp.parameter.name}
                      {(sp.unit || sp.parameter.unit) && (
                        <span className="text-muted-foreground">
                          {" "}
                          ({sp.unit || sp.parameter.unit})
                        </span>
                      )}
                    </span>
                    {limit && (
                      <span className="text-xs text-muted-foreground">
                        acceptance {limit}
                      </span>
                    )}
                  </div>
                  <OutsourceResultForm sampleParameterId={sp.id} />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
