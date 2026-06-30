import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { canAdminister } from "@/lib/auth/perms";
import { getModel, delegateFor } from "@/lib/admin/registry";
import { displayValue } from "@/lib/admin/values";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 200;

export default async function ModelListPage({
  params,
}: {
  params: Promise<{ model: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  if (!canAdminister(user.designation)) redirect("/app");

  const { model: modelName } = await params;
  const model = getModel(modelName);
  if (!model) notFound();

  const hasCreatedAt = model.fields.some((f) => f.name === "createdAt");
  const orderBy = hasCreatedAt
    ? { createdAt: "desc" as const }
    : model.idField
      ? { [model.idField]: "asc" as const }
      : undefined;

  const rows: Record<string, unknown>[] = await delegateFor(model).findMany({
    take: PAGE_SIZE,
    ...(orderBy ? { orderBy } : {}),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/app/admin" className="underline">
              Admin
            </Link>{" "}
            / {model.name}
          </p>
          <h1 className="text-2xl font-semibold">{model.name}</h1>
          <p className="text-sm text-muted-foreground">
            Showing up to {PAGE_SIZE} rows
            {model.idField ? "" : " — read-only (composite key)"}.
          </p>
        </div>
        {model.idField && (
          <Link
            href={`/app/admin/${model.name}/new`}
            className={buttonVariants({ size: "sm" })}
          >
            New record
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {model.listColumns.map((c) => (
                <TableHead key={c}>{c}</TableHead>
              ))}
              {model.idField && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => {
              const id = model.idField ? String(row[model.idField]) : String(i);
              return (
                <TableRow key={id}>
                  {model.listColumns.map((c) => {
                    const v = displayValue(row[c]);
                    return (
                      <TableCell key={c} className="max-w-[260px] truncate font-mono text-xs">
                        {v.length > 60 ? v.slice(0, 60) + "…" : v}
                      </TableCell>
                    );
                  })}
                  {model.idField && (
                    <TableCell className="text-right">
                      <Link
                        href={`/app/admin/${model.name}/${id}`}
                        className="text-sm underline"
                      >
                        Edit
                      </Link>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={model.listColumns.length + (model.idField ? 1 : 0)}
                  className="text-center text-muted-foreground"
                >
                  No rows.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
