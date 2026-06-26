import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type LogRow = {
  id: string;
  createdAt: Date;
  action: string;
  entityType: string;
  entityId: string;
  actor: { email: string } | null;
};

const ACTION_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  CREATE: "secondary",
  UPDATE: "outline",
  APPROVE: "default",
  SIGN: "default",
  REJECT: "destructive",
  DELETE: "destructive",
  DECODE: "default",
  LOGIN: "outline",
};

function ts(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export function AuditLogTable({ logs }: { logs: LogRow[] }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Entity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {ts(l.createdAt)}
              </TableCell>
              <TableCell className="text-sm">
                {l.actor?.email ?? "system"}
              </TableCell>
              <TableCell>
                <Badge variant={ACTION_VARIANT[l.action] ?? "outline"}>
                  {l.action}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-xs">
                {l.entityType}
                <span className="text-muted-foreground"> · {l.entityId.slice(0, 8)}</span>
              </TableCell>
            </TableRow>
          ))}
          {logs.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                No activity in scope.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
