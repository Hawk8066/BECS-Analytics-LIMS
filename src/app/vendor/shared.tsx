import { Badge } from "@/components/ui/badge";

export function pkr(paisa: number | null): string {
  if (paisa == null) return "—";
  return "PKR " + (paisa / 100).toLocaleString("en-PK");
}

const PO_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  ISSUED: "secondary",
  RECEIVED: "default",
  CANCELLED: "destructive",
};

export function PoStatus({ status }: { status: string }) {
  return <Badge variant={PO_VARIANT[status] ?? "secondary"}>{status}</Badge>;
}

export function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-2 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{value || "—"}</span>
    </div>
  );
}
