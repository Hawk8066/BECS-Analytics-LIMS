import "server-only";

/**
 * Data the Register-sample form needs. Shared by the standalone /app/samples/new
 * page (which also honours a ?quotation deep-link) and the popup on the samples
 * list, so the two can never drift apart.
 */
import { prisma } from "@/lib/db";
import { priceEntry } from "@/lib/pricing";
import type { SessionUser } from "@/lib/auth/session";

const LAB_NAMES: Record<string, string> = {
  LAHORE: "Lahore",
  RYK: "Rahimyar Khan",
};

export async function loadSampleFormData(user: SessionUser) {
  const [
    clients,
    parameters,
    facilities,
    packages,
    standards,
    quotations,
    thirdParties,
  ] = await Promise.all([
    prisma.client.findMany({
      where: user.canReadCrossSection ? {} : { facilityId: user.facilityId },
      orderBy: { company: "asc" },
    }),
    prisma.parameter.findMany({
      where: { approvedAt: { not: null } },
      orderBy: { name: "asc" },
    }),
    prisma.facility.findMany({ orderBy: { code: "asc" } }),
    prisma.package.findMany({
      orderBy: { name: "asc" },
      include: { parameters: { select: { parameterId: true } } },
    }),
    // Conformity standards, with each parameter's snapshot-able limit.
    prisma.standard.findMany({
      orderBy: { name: "asc" },
      include: { limits: { select: { parameterId: true, min: true, max: true } } },
    }),
    // Only accepted quotations can be booked; scoped to clients this user sees.
    prisma.testQuotation.findMany({
      where: {
        status: "ACCEPTED",
        ...(user.canReadCrossSection ? {} : { client: { facilityId: user.facilityId } }),
      },
      include: {
        client: { select: { company: true } },
        items: true,
        _count: { select: { samples: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Third parties a report can be issued in the name of (facility-scoped).
    prisma.thirdParty.findMany({
      where: user.canReadCrossSection ? {} : { facilityId: user.facilityId },
      orderBy: { company: "asc" },
    }),
  ]);

  return {
    thirdParties: thirdParties.map((t) => ({ id: t.id, label: t.company })),
    labs: facilities.map((f) => ({ id: f.id, name: LAB_NAMES[f.code] ?? f.name })),
    defaultLabId: user.facilityId,
    matrices: [
      ...new Set(parameters.map((p) => p.matrix).filter((m): m is string => !!m)),
    ].sort(),
    clients: clients.map((c) => ({ id: c.id, label: c.company, sector: c.sector })),
    parameters: parameters.map((p) => ({
      id: p.id,
      name: p.name,
      unit: p.unit,
      matrix: p.matrix,
      accredited: p.accredited,
      price: priceEntry(p),
    })),
    packages: packages.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      matrix: pkg.matrix,
      parameterIds: pkg.parameters.map((x) => x.parameterId),
      price: priceEntry(pkg),
    })),
    standards: standards.map((s) => ({
      id: s.id,
      name: s.name,
      matrix: s.matrix,
      // parameterId → its limit, so registration can snapshot the bounds.
      limits: s.limits.map((l) => ({
        parameterId: l.parameterId,
        min: l.min,
        max: l.max,
      })),
    })),
    quotations: quotations.map((q) => ({
      id: q.id,
      quoteNo: q.quoteNo,
      clientId: q.clientId,
      clientLabel: q.client.company,
      sector: q.sector,
      priority: q.priority,
      total: q.total,
      sampleType: q.sampleType,
      // How many samples the quote is for, and how many are already booked.
      sampleQty: q.sampleQty,
      booked: q._count.samples,
      items: q.items.map((it) => ({
        kind: it.kind === "PACKAGE" ? ("PACKAGE" as const) : ("PARAMETER" as const),
        refId: it.refId,
        name: it.name,
        price: it.price - it.discount, // quoted net (after per-line discount)
      })),
    })),
  };
}
