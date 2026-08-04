"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { canRegisterSample } from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";
import { nextCounter } from "@/lib/numbering";

// Short facility prefix for the sample Lab ID (Facility.code -> report prefix).
const LAB_PREFIX: Record<string, string> = { LAHORE: "LHR", RYK: "RYK" };

export type FormState = { error?: string };

const SampleSchema = z.object({
  clientId: z.string().min(1, "Select a client"),
  facilityId: z.string().min(1, "Select a lab"),
  sampleType: z.string().min(1, "Sample type is required"),
  clientSampleRef: z.string().optional(),
  quantity: z.string().optional(),
  physicalCondition: z.string().optional(),
  priority: z.string().optional(),
  instructions: z.string().optional(),
  thirdPartyName: z.string().optional(),
  /** Accepted quotation this sample is booked against, if any. */
  quotationId: z.string().optional(),
  /** Conformity standard the sample is judged against, if any (on request). */
  standardId: z.string().optional(),
});

// Sample registration: LO (Lahore) / Lab Manager (RYK). Assigns a coded Lab ID
// (SSOT §11) and begins blinding (SSOT §8).
export async function registerSample(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!canRegisterSample(actor.designation))
    return { error: "Not permitted to register samples." };

  const parsed = SampleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const parameterIds = formData
    .getAll("parameterIds")
    .map(String)
    .filter(Boolean);
  const packageIds = formData.getAll("packageIds").map(String).filter(Boolean);

  // How many separate samples to register (a quote may be for several).
  const countRaw = parseInt(String(formData.get("sampleCount") ?? "1"), 10);
  let sampleCount = Number.isFinite(countRaw) && countRaw > 0 ? countRaw : 1;

  // Booking against a quotation: only an accepted one, and only for the client
  // it was quoted to — otherwise the sample would claim agreed work it doesn't
  // have. The link is what makes the tests traceable back to what was agreed.
  const quotationId = d.quotationId?.trim() || null;
  if (quotationId) {
    const quotation = await prisma.testQuotation.findUnique({
      where: { id: quotationId },
      select: { status: true, clientId: true, quoteNo: true, sampleQty: true, _count: { select: { samples: true } } },
    });
    if (!quotation) return { error: "That quotation no longer exists." };
    if (quotation.status !== "ACCEPTED")
      return {
        error: `Quotation ${quotation.quoteNo} is ${quotation.status.toLowerCase()}; only an accepted quotation can be booked.`,
      };
    if (quotation.clientId !== d.clientId)
      return { error: `Quotation ${quotation.quoteNo} belongs to a different client.` };
    // A quote is for a fixed number of samples; never register more than remain.
    const remaining = Math.max(0, quotation.sampleQty - quotation._count.samples);
    if (remaining === 0)
      return { error: `All ${quotation.sampleQty} samples for ${quotation.quoteNo} are already registered.` };
    sampleCount = Math.min(sampleCount, remaining);
  } else {
    sampleCount = 1; // walk-in samples are registered one at a time
  }

  // Expand selected packages into their parameters and union with direct picks.
  const paramSet = new Set(parameterIds);
  if (packageIds.length > 0) {
    const links = await prisma.packageParameter.findMany({
      where: { packageId: { in: packageIds } },
      select: { parameterId: true },
    });
    for (const l of links) paramSet.add(l.parameterId);
  }
  const finalParameterIds = [...paramSet];
  if (finalParameterIds.length === 0)
    return { error: "Select at least one parameter or package." };

  // Chosen lab (facility) + its lab section.
  const facility = await prisma.facility.findUnique({
    where: { id: d.facilityId },
  });
  if (!facility) return { error: "Selected lab not found." };
  const labSection = await prisma.section.findFirst({
    where: { facilityId: facility.id, type: { in: ["LAHORE_LAB", "RYK_LAB"] } },
  });
  if (!labSection)
    return { error: "No lab section configured for the selected lab." };

  // On-request conformity: resolve the chosen standard's limits into a map so
  // each test can snapshot its bounds. Snapshotting (rather than referencing)
  // keeps the sample's verdict stable even if the standard is later revised.
  const standardId = d.standardId?.trim() || null;
  const limitByParam = new Map<string, { min: number | null; max: number | null }>();
  if (standardId) {
    const standard = await prisma.standard.findUnique({
      where: { id: standardId },
      select: { limits: { select: { parameterId: true, min: true, max: true } } },
    });
    if (!standard) return { error: "That standard no longer exists." };
    for (const l of standard.limits)
      limitByParam.set(l.parameterId, { min: l.min, max: l.max });
  }

  const now = new Date();
  const year = now.getFullYear();
  // Lab ID period segment: YYMM (e.g. June 2026 -> "2606").
  const yymm = `${String(year % 100).padStart(2, "0")}${String(
    now.getMonth() + 1,
  ).padStart(2, "0")}`;
  const labPrefix = LAB_PREFIX[facility.code] ?? facility.code;
  const baseRef = d.clientSampleRef?.trim() || null;
  const parameterData = finalParameterIds.map((parameterId) => {
    const u = String(formData.get(`unit_${parameterId}`) ?? "").trim();
    const limit = limitByParam.get(parameterId);
    return {
      parameterId,
      unit: u || null,
      limitMin: limit?.min ?? null,
      limitMax: limit?.max ?? null,
    };
  });

  // Register `sampleCount` separate samples — each its own coded Lab ID and its
  // own record, all carrying the same tests. A quote for N samples becomes N.
  const created: string[] = [];
  for (let i = 0; i < sampleCount; i++) {
    // Lab ID: LHR-YYMM-XXXX. The serial resets per facility per year; YYMM marks
    // the registration month.
    const serial = await nextCounter(`SAMPLE:${facility.code}:${year}`);
    const labId = `${labPrefix}-${yymm}-${String(serial).padStart(4, "0")}`;
    const sample = await prisma.sample.create({
      data: {
        labId,
        clientId: d.clientId,
        sampleType: d.sampleType,
        // Keep client refs distinct when several are booked at once.
        clientSampleRef: baseRef ? (sampleCount > 1 ? `${baseRef}-${i + 1}` : baseRef) : null,
        quantity: d.quantity?.trim() || null,
        physicalCondition: d.physicalCondition?.trim() || null,
        priority: d.priority || null,
        instructions: d.instructions || null,
        thirdPartyName: d.thirdPartyName || null,
        quotationId,
        standardId,
        facilityId: facility.id,
        sectionId: labSection.id,
        registeredById: actor.id,
        parameters: { create: parameterData },
      },
    });
    created.push(sample.id);

    await writeAudit({
      actorId: actor.id,
      action: "CREATE",
      entityType: "Sample",
      entityId: sample.id,
      after: { labId, parameters: finalParameterIds.length, quotationId },
      facilityId: facility.id,
      sectionId: labSection.id,
    });
  }

  revalidatePath("/app/samples");
  // One sample → open it; several → the list, where they all appear.
  redirect(created.length === 1 ? `/app/samples/${created[0]}` : "/app/samples");
}
