"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import {
  canApproveSample,
  canCoordinateTesting,
  ANALYST_DESIGNATIONS,
} from "@/lib/auth/perms";
import { publish } from "@/lib/feed/publish";
import { writeAudit } from "@/lib/audit/audit-log";
import { nextNumber } from "@/lib/numbering";
import { judgeConformity } from "@/lib/conformity";

export type FormState = { error?: string };

// Coordinator assigns each parameter to an internal analyst OR an external
// (outsourced) lab. The form submits one `assign_<sampleParameterId>` field per
// row: "" (unassigned) | `analyst:<userId>` | `lab:<labId>`. A parameter is
// assigned to an analyst XOR outsourced to a lab, never both. The sample moves
// to ASSIGNED only once every parameter has one or the other.
export async function assignParameters(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!canCoordinateTesting(actor.designation))
    return { error: "Not permitted to assign samples." };

  const sampleId = String(formData.get("sampleId"));
  const sample = await prisma.sample.findUnique({
    where: { id: sampleId },
    include: {
      parameters: {
        select: {
          id: true,
          assignedToId: true,
          outsourceLabId: true,
          outsourceBillId: true,
          resultValue: true,
        },
      },
    },
  });
  if (!sample) return { error: "Sample not found." };
  if (sample.status !== "REGISTERED" && sample.status !== "ASSIGNED")
    return { error: "Assignments are locked once results are in." };

  // Valid targets: active ANALYSTs at the sample's lab, and any outsource lab.
  const [roster, labs] = await Promise.all([
    prisma.user.findMany({
      where: {
        designation: { in: [...ANALYST_DESIGNATIONS] },
        status: "ACTIVE",
        facilityId: sample.facilityId,
      },
      select: { id: true },
    }),
    prisma.outsourceLab.findMany({ select: { id: true } }),
  ]);
  const analystIds = new Set(roster.map((a) => a.id));
  const labIds = new Set(labs.map((l) => l.id));

  const updates = [];
  // `updates` only holds promises, so collect the analysts who newly picked up
  // work here — they are the people who get a personal notification below.
  const newlyAssigned = new Set<string>();
  for (const p of sample.parameters) {
    // Locked once a result is produced, or once the outsourced test is billed.
    if (p.resultValue || p.outsourceBillId) continue;
    const raw = String(formData.get(`assign_${p.id}`) ?? "").trim();
    // Resolve the choice into the mutually-exclusive column pair.
    let assignedToId: string | null = null;
    let outsourceLabId: string | null = null;
    if (raw.startsWith("analyst:")) {
      assignedToId = raw.slice("analyst:".length);
      if (!analystIds.has(assignedToId))
        return { error: "One of the selected analysts is not valid for this lab." };
    } else if (raw.startsWith("lab:")) {
      outsourceLabId = raw.slice("lab:".length);
      if (!labIds.has(outsourceLabId))
        return { error: "One of the selected outsource labs no longer exists." };
    }
    // Skip if unchanged.
    if (assignedToId === p.assignedToId && outsourceLabId === p.outsourceLabId)
      continue;
    if (assignedToId) newlyAssigned.add(assignedToId);
    // Always write both columns so switching analyst↔lab clears the other side.
    updates.push(
      prisma.sampleParameter.update({
        where: { id: p.id },
        data: { assignedToId, outsourceLabId },
      }),
    );
  }
  if (updates.length > 0) await prisma.$transaction(updates);

  // Recompute the sample's state: ASSIGNED only when every parameter has a
  // target (analyst or lab); otherwise it stays (or drops back to) REGISTERED.
  const fresh = await prisma.sampleParameter.findMany({
    where: { sampleId },
    select: { assignedToId: true, outsourceLabId: true },
  });
  const allAssigned =
    fresh.length > 0 && fresh.every((p) => p.assignedToId || p.outsourceLabId);
  const nextStatus = allAssigned ? "ASSIGNED" : "REGISTERED";
  if (nextStatus !== sample.status) {
    await prisma.sample.update({
      where: { id: sampleId },
      data: { status: nextStatus },
    });
  }

  await writeAudit({
    actorId: actor.id,
    action: "UPDATE",
    entityType: "Sample",
    entityId: sampleId,
    after: { assignedParameters: updates.length, status: nextStatus },
    facilityId: sample.facilityId,
    sectionId: sample.sectionId,
  });
  if (updates.length > 0) {
    await publish({
      template: "sampleAssigned",
      params: { labId: sample.labId, sampleId, count: updates.length },
      actor,
      facilityId: sample.facilityId,
      sectionId: sample.sectionId,
      to: [...newlyAssigned],
    });
  }
  revalidatePath(`/app/samples/${sampleId}`);
  return {};
}

// Auto-advance: with several analysts (and possibly external labs) on one
// sample, no single person "owns" it to submit — so the sample moves to
// RESULTS_ENTERED on its own once the last outstanding result is saved. Shared
// by internal (enterResult) and external (enterOutsourcedResult) entry.
async function maybeAdvanceToResultsEntered(
  sample: {
    id: string;
    labId: string;
    status: string;
    facilityId: string;
    sectionId: string;
  },
  actorId: string,
): Promise<void> {
  if (sample.status !== "ASSIGNED") return;
  const remaining = await prisma.sampleParameter.count({
    where: { sampleId: sample.id, resultValue: null },
  });
  if (remaining > 0) return;
  await prisma.sample.update({
    where: { id: sample.id },
    data: { status: "RESULTS_ENTERED" },
  });
  await writeAudit({
    actorId,
    action: "UPDATE",
    entityType: "Sample",
    entityId: sample.id,
    after: { status: "RESULTS_ENTERED", via: "auto-advance" },
    facilityId: sample.facilityId,
    sectionId: sample.sectionId,
  });
  // Nobody "owns" this transition (it fires when the last result lands), so the
  // actor is the analyst who completed it — enough to stamp and scope the event.
  await publish({
    template: "sampleResultsEntered",
    params: { labId: sample.labId, sampleId: sample.id },
    actor: {
      id: actorId,
      facilityId: sample.facilityId,
      sectionId: sample.sectionId,
    },
  });
}

// Analyst enters a result, citing the physical lab register + page where the
// raw data is recorded (the legal raw record for in-house tests).
export async function enterResult(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  const sampleParameterId = String(formData.get("sampleParameterId"));
  const resultValue = String(formData.get("resultValue") || "").trim();
  const calculations = String(formData.get("calculations") || "").trim();
  const outOfCalibration = formData.get("outOfCalibration") === "on";
  // The register field is entered as a bare number under a fixed "BECS/RG/"
  // prefix; store the full reference.
  const registerRaw = String(formData.get("registerNo") || "").trim();
  const pageNo = String(formData.get("pageNo") || "").trim();

  const sp = await prisma.sampleParameter.findUnique({
    where: { id: sampleParameterId },
    include: { sample: true },
  });
  if (!sp) return { error: "Line item not found." };
  if (sp.assignedToId !== actor.id)
    return { error: "Only the analyst assigned to this parameter can enter its result." };
  if (!resultValue) return { error: "Result is required." };
  if (!registerRaw || !pageNo)
    return { error: "Register # and Page # are required." };
  if (!/^\d+$/.test(registerRaw))
    return { error: "Register # must be a number." };
  const registerNo = `BECS/RG/${registerRaw}`;

  // If the sample is being conformed, judge this result against the limit that
  // was snapshotted at registration (null when there's no limit or the result
  // isn't numeric — recorded, not judged).
  const conformity = judgeConformity(resultValue, sp.limitMin, sp.limitMax);

  await prisma.sampleParameter.update({
    where: { id: sp.id },
    data: {
      resultValue,
      calculations: calculations || null,
      outOfCalibration,
      conformity,
      registerNo,
      pageNo,
      enteredById: actor.id,
      enteredAt: new Date(),
    },
  });
  await writeAudit({
    actorId: actor.id,
    action: "UPDATE",
    entityType: "SampleParameter",
    entityId: sp.id,
    after: { resultValue, registerNo, pageNo, conformity },
    facilityId: sp.sample.facilityId,
    sectionId: sp.sample.sectionId,
  });

  await maybeAdvanceToResultsEntered(sp.sample, actor.id);

  revalidatePath(`/app/samples/${sp.sampleId}`);
  return {};
}

// An outsource lab's representative enters the result for a parameter that was
// subcontracted to their lab. Mirrors enterResult but is gated by the lab tenancy
// (not the analyst id), and requires the external lab's report as the attachment.
export async function enterOutsourcedResult(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (actor.designation !== "OUTSOURCE_LAB" || !actor.outsourceLabId)
    return { error: "Only an outsource-lab representative can enter this result." };

  const sampleParameterId = String(formData.get("sampleParameterId"));
  const resultValue = String(formData.get("resultValue") || "").trim();
  // The external lab's own report/certificate number (stored in registerNo).
  const reportNo = String(formData.get("reportNo") || "").trim();

  const sp = await prisma.sampleParameter.findUnique({
    where: { id: sampleParameterId },
    include: { sample: true },
  });
  if (!sp) return { error: "Line item not found." };
  // Tenancy: the parameter must be outsourced to this representative's lab.
  if (!sp.outsourceLabId || sp.outsourceLabId !== actor.outsourceLabId)
    return { error: "This test is not outsourced to your lab." };
  if (sp.assignedToId)
    return { error: "This test is assigned to an in-house analyst." };
  if (sp.sample.status !== "ASSIGNED")
    return { error: "This sample is no longer open for result entry." };
  if (!resultValue) return { error: "Result is required." };
  if (!reportNo) return { error: "Report # is required." };

  const conformity = judgeConformity(resultValue, sp.limitMin, sp.limitMax);

  await prisma.sampleParameter.update({
    where: { id: sp.id },
    data: {
      resultValue,
      conformity,
      registerNo: reportNo,
      enteredById: actor.id,
      enteredAt: new Date(),
    },
  });
  await writeAudit({
    actorId: actor.id,
    action: "UPDATE",
    entityType: "SampleParameter",
    entityId: sp.id,
    after: { resultValue, conformity, reportNo, outsourced: true },
    facilityId: sp.sample.facilityId,
    sectionId: sp.sample.sectionId,
  });

  await maybeAdvanceToResultsEntered(sp.sample, actor.id);

  revalidatePath("/outsource");
  return {};
}

// Coordinator verifies results (segregation of duty: must differ from analyst, BR-4).
export async function verifySample(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canCoordinateTesting(actor.designation))
    throw new Error("Not permitted to verify.");

  const sampleId = String(formData.get("sampleId"));
  const sample = await prisma.sample.findUnique({
    where: { id: sampleId },
    include: { parameters: { select: { assignedToId: true, enteredById: true } } },
  });
  if (!sample) throw new Error("Sample not found.");
  // BR-4: the verifier can't be any analyst who ran or was assigned a test here.
  if (
    sample.parameters.some(
      (p) => p.enteredById === actor.id || p.assignedToId === actor.id,
    )
  )
    throw new Error("Verifier must differ from the analysts who ran the tests (BR-4).");

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
  await publish({
    template: "sampleVerified",
    params: { labId: sample.labId, sampleId },
    actor,
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
    include: {
      parameters: {
        include: {
          parameter: true,
          outsourceLab: { select: { labNo: true, name: true } },
        },
      },
    },
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
    standardId: sample.standardId,
    parameters: sample.parameters.map((p) => ({
      name: p.parameter.name,
      unit: p.parameter.unit,
      result: p.resultValue,
      outOfCalibration: p.outOfCalibration,
      // Conformity verdict + the limit it was judged against, so the seal
      // covers the pass/fail shown on the report.
      limitMin: p.limitMin,
      limitMax: p.limitMax,
      conformity: p.conformity,
      // Source attribution: subcontracting is sealed into the report hash.
      source: p.outsourceLabId
        ? { kind: "OUTSOURCED", labNo: p.outsourceLab?.labNo, name: p.outsourceLab?.name }
        : { kind: "IN_HOUSE" },
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
  await publish({
    template: "sampleApproved",
    params: { labId: sample.labId, sampleId, reportNo },
    actor,
    facilityId: sample.facilityId,
    sectionId: sample.sectionId,
  });
  revalidatePath(`/app/samples/${sampleId}`);
}
