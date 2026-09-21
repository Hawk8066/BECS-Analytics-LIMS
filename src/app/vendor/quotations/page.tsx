import Link from "next/link";
import { formatDate } from "@/lib/format";
import { requireVendor, vendorQuotations } from "@/lib/portal/vendor";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { pkr } from "../shared";

export default async function VendorQuotationsPage() {
  const { vendorId } = await requireVendor();
  const quotations = await vendorQuotations(vendorId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My quotations</h1>
        <p className="text-sm text-muted-foreground">
          Quotations you have submitted against purchase requests.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {quotations.length} quotation{quotations.length === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PR No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Selected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotations.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`/vendor/quotations/${q.id}`}
                        className="hover:underline"
                      >
                        {q.pr.prNo}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(q.createdAt)}
                    </TableCell>
                    <TableCell>{pkr(q.amount)}</TableCell>
                    <TableCell>
                      {q.selected ? (
                        <Badge>Selected</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {quotations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No quotations yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
