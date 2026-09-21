import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/current-user";

/** Shared guard and queries for the client portal's two routes. */

export async function requireClient() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.designation !== "CLIENT" || !user.clientId) redirect("/app");
  const client = await prisma.client.findUnique({ where: { id: user.clientId } });
  // The account points at a client that no longer exists — treat as signed out
  // rather than rendering a portal with nothing behind it.
  if (!client) redirect("/login");
  return { user, clientId: user.clientId, client };
}

export function clientSamples(clientId: string) {
  return prisma.sample.findMany({
    where: { clientId },
    include: { report: true },
    orderBy: { createdAt: "desc" },
  });
}

export function clientSampleCount(clientId: string) {
  return prisma.sample.count({ where: { clientId } });
}

/** The postal address as stored, one line per field, blanks dropped. */
export function clientAddress(client: {
  addressLine1: string | null;
  addressLine2: string | null;
  addressLine3: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
}) {
  return [
    client.addressLine1,
    client.addressLine2,
    client.addressLine3,
    [client.city, client.province, client.country].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join("\n");
}
