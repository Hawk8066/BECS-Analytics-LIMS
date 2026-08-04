import "server-only";

/**
 * Props the New-quotation form needs. Shared by the standalone /app/quotations/new
 * page and the popup on the quotations list, so the two can't drift apart.
 */
import { prisma } from "@/lib/db";
import {
  canRegisterClient,
  canManageParameters,
} from "@/lib/auth/perms";
import { priceEntry } from "@/lib/pricing";
import type { SessionUser } from "@/lib/auth/session";

export async function loadQuotationFormData(user: SessionUser) {
  const [clients, parameters, packages] = await Promise.all([
    prisma.client.findMany({ orderBy: { company: "asc" } }),
    prisma.parameter.findMany({
      where: { approvedAt: { not: null } },
      orderBy: { name: "asc" },
    }),
    prisma.package.findMany({
      orderBy: { name: "asc" },
      include: { parameters: { select: { parameterId: true } } },
    }),
  ]);

  return {
    canAddClient: canRegisterClient(user.designation),
    canAddParameter: canManageParameters(user.designation),
    clients: clients.map((c) => ({ id: c.id, label: c.company, sector: c.sector })),
    matrices: [
      ...new Set(parameters.map((p) => p.matrix).filter((m): m is string => !!m)),
    ].sort(),
    units: [
      ...new Set(parameters.map((p) => p.unit).filter((u): u is string => !!u)),
    ].sort(),
    parameters: parameters.map((p) => ({
      id: p.id,
      name: p.name,
      unit: p.unit,
      matrix: p.matrix,
      price: priceEntry(p),
    })),
    packages: packages.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      matrix: pkg.matrix,
      parameterIds: pkg.parameters.map((x) => x.parameterId),
      price: priceEntry(pkg),
    })),
  };
}
