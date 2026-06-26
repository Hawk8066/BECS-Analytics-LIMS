"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import {
  canApproveSample,
  canCoordinateTesting,
} from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";
import { saveFile } from "@/lib/storage/local";
import { nextNumber } from "@/lib/numbering";

export type FormState = { error?: string };

// Coordinator assigns a sample to an analyst (OM @ Lahore / Lab Manager @ RYK).
export async function assignSample(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canCoordinateTesting(actor.designation))
    throw new Error("Not permitted to assign samples.");

  const sampleId = String(formData.get("sampleId"));
  const analystId = String(formData.get("analystId"));
  const sample = await prisma.sample.findUnique({ where: { id: sampleId } });
  if (!sample) throw new Error("Sample not found.");

  await prisma.sample.update({
    where: { id: sampleId },
    data: { assignedToId: analystId, status: "ASSIGNED" },
  });
  await writeAudit({
    actorId: actor.id,
    action: "UPDATE",
    entityType: "Sample",
    entityId: sampleId,
    after: { assignedToId: analystId, status: "ASSIGNED" },
    facilityId: sample.facilityId,
    sectionId: sample.sectionId,
  });
  revalidatePath(`/app/samples/${sampleId}`);
}

// Analyst enters a result + uploads the raw-data photo (BR-17 out-of-cal flag).
export async function enterResult(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  const sampleParameterId = String(formData.get("sampleParameterId"));
  const resultValue = String(formData.get("resultValue") || "").trim();
  const calculations = String(formData.get("calculations") || "").trim();
  const outOfCalibration = formData.get("outOfCalibration") === "on";

  const sp = await prisma.sampleParameter.findUnique({
    where: { id: sampleParameterId },
    include: { sample: true },
  });
  if (!sp) return { error: "Line item not found." };
  if (sp.sample.assignedToId !== actor.id)
    return { error: "Only the assigned analyst can enter results." };
  if (!resultValue) return { error: "Result is required." };

  let rawDataAttachmentId = sp.rawDataAttachmentId;
  const file = formData.get("photo");
  if (file instanceof File && file.size > 0) {
    const buf = Buffer.from(await file.arrayBuffer());
    const { storageKey, sha256 } = await saveFile(buf, {
      dir: `raw-data/${sp.sampleId}`,
      fileName: file.name,
    });
    const att = await prisma.attachment.create({
      data: {
        ownerType: "SampleParameter",
        ownerId: sp.id,
        kind: "RAW_DATA_PHOTO",
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        storageKey,
        sha256,
        uploadedById: actor.id,
        status: "APPROVED",
      },
    });
    rawDataAttachmentId = att.id;
  }
  if (!rawDataAttachmentId)
    return { error: "A raw-data photo is required." };

  await prisma.sampleParameter.update({
    where: { id: sp.id },
    data: {
      resultValue,
      calculations: calculations || null,
      outOfCalibration,
      rawDataAttachmentId,
      enteredById: actor.id,
      enteredAt: new Date(),
    },
  });
  await writeAudit({
    actorId: actor.id,
    action: "UPDATE",
    entityType: "SampleParameter",
    entityId: sp.id,
    after: { resultValue, outOfCalibration },
    facilityId: sp.sample.facilityId,
    sectionId: sp.sample.sectionId,
  });
  revalidatePath(`/app/samples/${sp.sampleId}`);
  return {};
}

// Analyst submits the completed sample for verification.
export async function submitForVerification(formData: FormData): Promise<void> {
  const actor = await requireUser();
  const sampleId = String(formData.get("sampleId"));
  const sample = await prisma.sample.findUnique({
    where: { id: sampleId },
    include: { parameters: true },
  });
  if (!sample) throw new Error("Sample not found.");
  if (sample.assignedToId !== actor.id)
    throw new Error("Only the assigned analyst can submit.");
  if (!sample.parameters.every((p) => p.resultValue))
    throw new Error("All parameters must have results first.");

  await prisma.sample.update({
    where: { id: sampleId },
    data: { status: "RESULTS_ENTERED" },
  });
  await writeAudit({
    actorId: actor.id,
    action: "UPDATE",
    entityType: "Sample",
    entityId: sampleId,
    after: { status: "RESULTS_ENTERED" },
    facilityId: sample.facilityId,
    sectionId: sample.sectionId,
  });
  revalidatePath(`/app/samples/${sampleId}`);
}

// Coordinator verifies results (segregation of duty: must differ from analyst, BR-4).
export async function verifySample(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canCoordinateTesting(actor.designation))
    throw new Error("Not permitted to verify.");

  const sampleId = String(formData.get("sampleId"));
  const sample = await prisma.sample.findUnique({ where: { id: sampleId } });
  if (!sample) throw new Error("Sample not found.");
  if (sample.assignedToId === actor.id)
    throw new Error("Verifier must differ from the analyst (BR-4).");

  await prisma.sample.update({
    where: { id: sampleId },
    data: { status: "VERIFIED" },
  });
  await prisma.signature.create({
    data: {
      signerId: actor.id,
      subjectType: "Sample",
      subjectId: sampleId,
      meaning: "verified",
    },
  });
  await writeAudit({
    actorId: actor.id,
    action: "UPDATE",
    entityType: "Sample",
    entityId: sampleId,
    after: { status: "VERIFIED" },
    facilityId: sample.facilityId,
    sectionId: sample.sectionId,
  });
  revalidatePath(`/app/samples/${sampleId}`);
}

// COO approves and generates the hash-sealed final report; decode is unlocked.
export async function approveSample(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canApproveSample(actor.designation))
    throw new Error("Only the COO can approve.");

  const sampleId = String(formData.get("sampleId"));
  const sample = await prisma.sample.findUnique({
    where: { id: sampleId },
    include: { parameters: { include: { parameter: true } } },
  });
  if (!sample) throw new Error("Sample not found.");
  if (sample.status !== "VERIFIED")
    throw new Error("Sample must be verified before approval.");

  const facility = await prisma.facility.findUnique({
    where: { id: sample.facilityId },
  });
  const year = new Date().getFullYear();
  const reportNo = await nextNumber({
    key: `REPORT:${facility!.code}:${year}`,
    prefix: `${facility!.code}-R`,
    year,
    pad: 6,
  });

  const snapshot = JSON.stringify({
    labId: sample.labId,
    parameters: sample.parameters.map((p) => ({
      name: p.parameter.name,
      unit: p.parameter.unit,
      result: p.resultValue,
      outOfCalibration: p.outOfCalibration,
    })),
    approvedAt: new Date().toISOString(),
  });
  const contentHash = createHash("sha256").update(snapshot).digest("hex");
  const qrText = `${reportNo}|${contentHash.slice(0, 16)}`;

  await prisma.$transaction([
    prisma.finalReport.create({
      data: {
        reportNo,
        sampleId,
        contentHash,
        qrText,
        approvedById: actor.id,
        decodedAt: new Date(),
      },
    }),
    prisma.sample.update({
      where: { id: sampleId },
      data: { status: "REPORTED" },
    }),
    prisma.signature.create({
      data: {
        signerId: actor.id,
        subjectType: "Sample",
        subjectId: sampleId,
        meaning: "approved",
        contentHash,
      },
    }),
  ]);

  await writeAudit({
    actorId: actor.id,
    action: "APPROVE",
    entityType: "Sample",
    entityId: sampleId,
    after: { status: "REPORTED", reportNo },
    facilityId: sample.facilityId,
    sectionId: sample.sectionId,
  });
  await writeAudit({
    actorId: actor.id,
    action: "DECODE",
    entityType: "FinalReport",
    entityId: reportNo,
    facilityId: sample.facilityId,
    sectionId: sample.sectionId,
  });
  revalidatePath(`/app/samples/${sampleId}`);
}
