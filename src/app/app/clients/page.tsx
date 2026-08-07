import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canRegisterClient } from "@/lib/auth/perms";
import { formatDate } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";
import { ImportExcel } from "@/components/import-excel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ sector?: string; q?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const { sector: sectorParam, q: qParam } = await searchParams;
  const sector = sectorParam?.trim() || null;
  const q = qParam?.trim() || null;
  const needle = q?.toLowerCase() ?? "";

  // Sorted by sector (then company) so the list groups by sector by default.
  const clients = await prisma.client.findMany({
    where: user.canReadCrossSection ? {} : { facilityId: user.facilityId },
    orderBy: [{ sector: "asc" }, { company: "asc" }],
  });

  const sectors = [
    ...new Set(clients.map((c) => c.sector).filter((s): s is string => !!s)),
  ].sort();

  const matchesQuery = (c: (typeof clients)[number]) =>
    !needle ||
    [
      c.clientNo,
      c.company,
      c.contactPerson,
      c.contactNumber,
      c.email,
      c.city,
      c.ntn,
      c.stn,
    ].some((v) => v?.toLowerCase().includes(needle));
  const visible = clients.filter(
    (c) => (!sector || c.sector === sector) && matchesQuery(c),
  );

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${
      active
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-muted"
    }`;

  // Preserve the active sector/search across links.
  const buildHref = (params: { sector?: string | null; q?: string | null }) => {
    const sp = new URLSearchParams();
    if (params.sector) sp.set("sector", params.sector);
    if (params.q) sp.set("q", params.q);
    const s = sp.toString();
    return s ? `/app/clients?${s}` : "/app/clients";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-sm text-muted-foreground">
            {sector || q
              ? `${visible.length} of ${clients.length}${
                  sector ? ` · ${sector}` : ""
                }${q ? ` · "${q}"` : ""}`
              : `${clients.length} registered`}
          </p>
        </div>
        {canRegisterClient(user.designation) && (
          <Link href="/app/clients/new" className={buttonVariants()}>
            Register client
          </Link>
        )}
      </div>

      <ImportExcel model="Client" path="/app/clients" label="clients" />

      <form
        method="GET"
        action="/app/clients"
        className="flex flex-wrap items-center gap-2"
      >
        {sector && <input type="hidden" name="sector" value={sector} />}
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search company, contact, email, NTN…"
          className="h-9 w-full max-w-sm rounded-md border bg-transparent px-3 text-sm"
        />
        <button type="submit" className={buttonVariants({ size: "sm" })}>
          Search
        </button>
        {q && (
          <Link
            href={buildHref({ sector })}
            className="text-sm text-muted-foreground underline"
          >
            Clear
          </Link>
        )}
      </form>

      {sectors.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Sector:</span>
          <Link href={buildHref({ q })} className={chip(!sector)}>
            All
          </Link>
          {sectors.map((s) => (
            <Link
              key={s}
              href={buildHref({ sector: s, q })}
              className={chip(sector === s)}
            >
              {s}
            </Link>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client No</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Sector</TableHead>
              <TableHead>Contact person</TableHead>
              <TableHead>Contact number</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>NTN</TableHead>
              <TableHead>STN</TableHead>
              <TableHead>Registered</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">
                  <Link href={`/app/clients/${c.id}`} className="hover:underline">
                    {c.clientNo}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={`/app/clients/${c.id}`} className="hover:underline">
                    {c.company}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{c.sector ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{c.contactPerson ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{c.contactNumber ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{c.ntn ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{c.stn ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDate(c.createdAt)}
                </TableCell>
              </TableRow>
            ))}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  {sector ? `No clients in ${sector}.` : "No clients yet."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
