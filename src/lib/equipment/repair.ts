import type { RepairKind, RepairSite, RepairStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";
import {
  canInspectGoods,
  canIssueGatePass,
  canManageEquipment,
  canReceiveRepair,
} from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";
import { nextNumber } from "@/lib/numbering";
import { createPRFromLines } from "@/lib/procurement/create-pr";

/**
 * Equipment repair (Module 05 §5.2). A repair is a case file that raises its own
 * Purchase Request into the normal full procurement path and then tracks what
 * procurement cannot: the asset's condition, its movement off the premises, its
 * return, and its requalification.
 *
 * The logic lives here rather than in the server actions so it takes an explicit
 * actor and can be driven from a script — the same split `createPRFromLines`
 * uses. The `"use server"` wrappers in lib/actions/equipment-repair.ts are thin.
 *
 * Every function re-reads what it is given, refuses out-of-order transitions,
 * and writes its audit trail against the ASSET's facility/section (BR-5, BR-6).
 */

/** Statuses in which a repair is still live — used for the one-open-repair rule. */
export const OPEN_REPAIR_STATUSES: RepairStatus[] = [
  "REQUESTED",
  "GATE_PASSED",
  "RECEIVED",
  "INSPECTED",
];

export const REPAIR_STATUS_LABEL: Record<RepairStatus, string> = {
  REQUESTED: "Requested",
  GATE_PASSED: "Out for repair",
  RECEIVED: "Received back",
  INSPECTED: "Inspected",
  IN_SERVICE: "Back in service",
  CANCELLED: "Cancelled",
};

export const REPAIR_KIND_LABEL: Record<RepairKind, string> = {
  BREAKDOWN: "Breakdown",
  MAINTENANCE: "Maintenance",
};

export const REPAIR_SITE_LABEL: Record<RepairSite, string> = {
  ON_SITE: "On-site",
  OFF_SITE: "Off-site",
};

export function repairStatusVariant(
  status: RepairStatus,
): "default" | "secondary" | "outline" | "destructive" {
  if (status === "IN_SERVICE") return "default";
  if (status === "CANCELLED") return "outline";
  if (status === "GATE_PASSED") return "destructive"; // the asset is not here
  return "secondary";
}

/**
 * The repair vendor. Mirrors resolveCalibrator: `null` means the id was given
 * but is unknown (the caller errors), `{null, null}` means "not decided yet —
 * the comparative will award it".
 */
async function resolveRepairVendor(
  value: string | null | undefined,
): Promise<{ vendorId: string | null; vendorName: string | null } | null> {
  const v = (value ?? "").trim();
  if (!v) return { vendorId: null, vendorName: null };
  const vendor = await prisma.vendor.findUnique({
    where: { id: v },
    select: { id: true, company: true },
  });
  if (!vendor) return null;
  return { vendorId: vendor.id, vendorName: vendor.company };
}

/** Records may only be opened against an asset the actor can actually see. */
function assertInScope(
  actor: SessionUser,
  row: { facilityId: string; sectionId: string },
) {
  if (
    !actor.canReadCrossSection &&
    (row.facilityId !== actor.facilityId || row.sectionId !== actor.sectionId)
  )
    throw new Error("That equipment belongs to another lab.");
}

export interface OpenRepairInput {
  equipmentId: string;
  kind: RepairKind;
  reason: string;
  site: RepairSite;
  /** Optional nomination; the comparative award overwrites it. */
  vendorId?: string | null;
  priority?: string | null;
  note?: string | null;
}

/**
 * Open a repair case and raise its PR. A breakdown takes the asset out of
 * service immediately; planned maintenance leaves it usable until it actually
 * goes away, since maintenance is often booked weeks ahead.
 */
export async function openRepairCase(actor: SessionUser, input: OpenRepairInput) {
  if (!canManageEquipment(actor.designation))
    throw new Error("Not permitted to raise repair requests.");

  const eq = await prisma.equipment.findUnique({
    where: { id: input.equipmentId },
    select: {
      id: true,
      assetTag: true,
      name: true,
      make: true,
      model: true,
      serialNo: true,
      status: true,
      facilityId: true,
      sectionId: true,
    },
  });
  if (!eq) throw new Error("Equipment not found.");
  assertInScope(actor, eq);
  if (eq.status === "RETIRED")
    throw new Error("That asset is retired — it cannot be sent for repair.");

  const open = await prisma.equipmentRepair.findFirst({
    where: { equipmentId: eq.id, status: { in: OPEN_REPAIR_STATUSES } },
    select: { repairNo: true },
  });
  if (open)
    throw new Error(
      `${eq.assetTag} already has an open repair (${open.repairNo}). Close it before raising another.`,
    );

  const vendor = await resolveRepairVendor(input.vendorId);
  if (!vendor) throw new Error("That vendor is no longer registered.");

  const reason = input.reason.trim();
  if (reason.length < 5)
    throw new Error("Describe the fault or the maintenance required.");

  const facility = await prisma.facility.findUnique({
    where: { id: eq.facilityId },
    select: { code: true },
  });
  if (!facility) throw new Error("That lab no longer exists.");
  const year = new Date().getFullYear();
  const repairNo = await nextNumber({
    key: `REPAIR:${facility.code}:${year}`,
    prefix: `REP-${facility.code}`,
    year,
    pad: 4,
  });

  // The PR belongs to the asset's lab, whoever is typing (BR-6). Its single line
  // is a service line, so pathForCategory routes it FULL — repairs never take
  // the simplified path (BR-EQ-1).
  const makeModel = [eq.make, eq.model].filter(Boolean).join(" ");
  const siteText =
    input.site === "OFF_SITE"
      ? "Off-site repair at vendor premises (gate pass required)"
      : "On-site repair at the lab";
  const pr = await createPRFromLines(
    actor,
    [
      {
        description: `Repair — ${eq.name} (${eq.assetTag})`,
        specification:
          [makeModel, eq.serialNo ? `S/N ${eq.serialNo}` : null, siteText]
            .filter(Boolean)
            .join(" · ") || null,
        category: "EQUIPMENT_REPAIR",
        quantity: 1,
        justification: `${REPAIR_KIND_LABEL[input.kind]}: ${reason}`,
        priority:
          input.priority?.trim() ||
          (input.kind === "BREAKDOWN" ? "High" : "Normal"),
      },
    ],
    `Equipment repair ${repairNo} · asset ${eq.assetTag}${
      vendor.vendorName ? ` · proposed vendor: ${vendor.vendorName}` : ""
    }`,
    { facilityId: eq.facilityId, sectionId: eq.sectionId },
  );

  const takeOutOfService = input.kind === "BREAKDOWN";
  const repair = await prisma.$transaction(async (tx) => {
    const created = await tx.equipmentRepair.create({
      data: {
        repairNo,
        equipmentId: eq.id,
        kind: input.kind,
        reason,
        site: input.site,
        prId: pr.id,
        vendorId: vendor.vendorId,
        vendorName: vendor.vendorName,
        note: input.note?.trim() || null,
        requestedById: actor.id,
        facilityId: eq.facilityId,
        sectionId: eq.sectionId,
      },
    });
    if (takeOutOfService && eq.status !== "UNDER_REPAIR")
      await tx.equipment.update({
        where: { id: eq.id },
        data: { status: "UNDER_REPAIR" },
      });
    return created;
  });

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "EquipmentRepair",
    entityId: repair.id,
    after: {
      repairNo,
      assetTag: eq.assetTag,
      kind: input.kind,
      site: input.site,
      prNo: pr.prNo,
      vendor: vendor.vendorName,
    },
    facilityId: eq.facilityId,
    sectionId: eq.sectionId,
  });
  if (takeOutOfService && eq.status !== "UNDER_REPAIR")
    await writeAudit({
      actorId: actor.id,
      action: "UPDATE",
      entityType: "Equipment",
      entityId: eq.id,
      before: { status: eq.status },
      after: { status: "UNDER_REPAIR", repairNo },
      facilityId: eq.facilityId,
      sectionId: eq.sectionId,
    });

  return { id: repair.id, repairNo, prId: pr.id, prNo: pr.prNo };
}

export interface IssueGatePassInput {
  repairId: string;
  vendorId?: string | null;
  outDate: Date;
  expectedReturnDate?: Date | null;
  accessories?: string | null;
  purpose?: string | null;
}

/**
 * Release the asset for off-site repair (BR-EQ-5). The COO must have approved
 * the spend first — an instrument does not leave the building on an unapproved
 * request.
 */
export async function issueGatePassFor(
  actor: SessionUser,
  input: IssueGatePassInput,
) {
  if (!canIssueGatePass(actor.designation))
    throw new Error("Not permitted to issue gate passes.");

  const repair = await prisma.equipmentRepair.findUnique({
    where: { id: input.repairId },
    include: {
      equipment: { select: { id: true, assetTag: true, status: true } },
      pr: { select: { prNo: true, status: true } },
      gatePasses: { where: { status: "OUT" }, select: { gatePassNo: true } },
    },
  });
  if (!repair) throw new Error("Repair not found.");
  assertInScope(actor, repair);
  if (repair.site !== "OFF_SITE")
    throw new Error("On-site repairs do not need a gate pass.");
  if (repair.status !== "REQUESTED")
    throw new Error(
      `This repair is ${REPAIR_STATUS_LABEL[repair.status].toLowerCase()} — a gate pass can only be issued while it is requested.`,
    );
  if (repair.gatePasses.length > 0)
    throw new Error(
      `${repair.gatePasses[0].gatePassNo} is still open — close it before issuing another.`,
    );
  if (repair.pr.status !== "APPROVED" && repair.pr.status !== "ORDERED")
    throw new Error(
      `${repair.pr.prNo} is not approved yet — the COO must approve it before the asset leaves.`,
    );

  const posted = await resolveRepairVendor(input.vendorId);
  if (!posted) throw new Error("That vendor is no longer registered.");
  // Prefer the vendor named on this pass, else whoever the case already names.
  const vendorId = posted.vendorId ?? repair.vendorId;
  const vendorName = posted.vendorName ?? repair.vendorName;
  if (!vendorId)
    throw new Error(
      "Choose the vendor the equipment is going to before issuing the pass.",
    );

  if (Number.isNaN(input.outDate.getTime()))
    throw new Error("Enter a valid date of despatch.");
  if (
    input.expectedReturnDate &&
    input.expectedReturnDate.getTime() < input.outDate.getTime()
  )
    throw new Error("Expected return cannot be before the despatch date.");

  const facility = await prisma.facility.findUnique({
    where: { id: repair.facilityId },
    select: { code: true },
  });
  if (!facility) throw new Error("That lab no longer exists.");
  const year = new Date().getFullYear();
  const gatePassNo = await nextNumber({
    key: `GATEPASS:${facility.code}:${year}`,
    prefix: `GP-${facility.code}`,
    year,
    pad: 4,
  });

  const pass = await prisma.$transaction(async (tx) => {
    const created = await tx.gatePass.create({
      data: {
        gatePassNo,
        repairId: repair.id,
        equipmentId: repair.equipmentId,
        vendorId,
        vendorName,
        outDate: input.outDate,
        expectedReturnDate: input.expectedReturnDate ?? null,
        accessories: input.accessories?.trim() || null,
        purpose: input.purpose?.trim() || repair.reason,
        issuedById: actor.id,
        facilityId: repair.facilityId,
        sectionId: repair.sectionId,
      },
    });
    await tx.equipmentRepair.update({
      where: { id: repair.id },
      data: {
        status: "GATE_PASSED",
        // The pass settles who is actually doing the work.
        vendorId,
        vendorName,
      },
    });
    if (repair.equipment.status !== "UNDER_REPAIR")
      await tx.equipment.update({
        where: { id: repair.equipmentId },
        data: { status: "UNDER_REPAIR" },
      });
    return created;
  });

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "GatePass",
    entityId: pass.id,
    after: {
      gatePassNo,
      repairNo: repair.repairNo,
      assetTag: repair.equipment.assetTag,
      vendor: vendorName,
      outDate: input.outDate.toISOString(),
    },
    facilityId: repair.facilityId,
    sectionId: repair.sectionId,
  });
  if (repair.equipment.status !== "UNDER_REPAIR")
    await writeAudit({
      actorId: actor.id,
      action: "UPDATE",
      entityType: "Equipment",
      entityId: repair.equipmentId,
      before: { status: repair.equipment.status },
      after: { status: "UNDER_REPAIR", gatePassNo },
      facilityId: repair.facilityId,
      sectionId: repair.sectionId,
    });

  return { id: pass.id, gatePassNo };
}

export interface ReceiveRepairInput {
  repairId: string;
  returnedOn: Date;
  note?: string | null;
}

/**
 * Take the asset back in. Off-site work closes the gate pass it left on, so a
 * movement always has both halves; on-site work simply records that the job is
 * finished. The asset stays out of service until it is inspected and requalified.
 */
export async function receiveRepairedEquipment(
  actor: SessionUser,
  input: ReceiveRepairInput,
) {
  if (!canReceiveRepair(actor.designation))
    throw new Error("Not permitted to receive equipment.");

  const repair = await prisma.equipmentRepair.findUnique({
    where: { id: input.repairId },
    include: {
      equipment: { select: { assetTag: true } },
      gatePasses: { where: { status: "OUT" }, orderBy: { outDate: "desc" } },
    },
  });
  if (!repair) throw new Error("Repair not found.");
  assertInScope(actor, repair);

  const openPass = repair.gatePasses[0];
  if (repair.site === "OFF_SITE") {
    if (repair.status !== "GATE_PASSED" || !openPass)
      throw new Error(
        "This asset is not out on a gate pass — there is nothing to receive.",
      );
  } else if (repair.status !== "REQUESTED") {
    throw new Error(
      `This repair is ${REPAIR_STATUS_LABEL[repair.status].toLowerCase()} — it cannot be received now.`,
    );
  }

  if (Number.isNaN(input.returnedOn.getTime()))
    throw new Error("Enter a valid date.");
  if (input.returnedOn.getTime() > Date.now())
    throw new Error("The return date cannot be in the future.");
  if (openPass && input.returnedOn.getTime() < openPass.outDate.getTime())
    throw new Error("The return date cannot be before the asset went out.");

  await prisma.$transaction(async (tx) => {
    if (openPass)
      await tx.gatePass.update({
        where: { id: openPass.id },
        data: {
          status: "RETURNED",
          actualReturnDate: input.returnedOn,
          receivedById: actor.id,
        },
      });
    await tx.equipmentRepair.update({
      where: { id: repair.id },
      data: {
        status: "RECEIVED",
        receivedOn: input.returnedOn,
        note: input.note?.trim() || repair.note,
      },
    });
  });

  if (openPass)
    await writeAudit({
      actorId: actor.id,
      action: "UPDATE",
      entityType: "GatePass",
      entityId: openPass.id,
      before: { status: "OUT" },
      after: {
        status: "RETURNED",
        actualReturnDate: input.returnedOn.toISOString(),
      },
      facilityId: repair.facilityId,
      sectionId: repair.sectionId,
    });
  await writeAudit({
    actorId: actor.id,
    action: "UPDATE",
    entityType: "EquipmentRepair",
    entityId: repair.id,
    before: { status: repair.status },
    after: { status: "RECEIVED", receivedOn: input.returnedOn.toISOString() },
    facilityId: repair.facilityId,
    sectionId: repair.sectionId,
  });

  return { id: repair.id };
}

export interface InspectRepairInput {
  repairId: string;
  decision: "ACCEPTED" | "REJECTED";
  note?: string | null;
}

/**
 * Inspect the returned work (BR-11). Rejecting sends the case back to REQUESTED
 * so the asset can go out again on a fresh gate pass.
 */
export async function inspectRepair(
  actor: SessionUser,
  input: InspectRepairInput,
) {
  if (!canInspectGoods(actor.designation))
    throw new Error("Not permitted to inspect repairs.");

  const repair = await prisma.equipmentRepair.findUnique({
    where: { id: input.repairId },
    select: {
      id: true,
      status: true,
      facilityId: true,
      sectionId: true,
      repairNo: true,
    },
  });
  if (!repair) throw new Error("Repair not found.");
  assertInScope(actor, repair);
  if (repair.status !== "RECEIVED")
    throw new Error("Only received equipment can be inspected.");

  const accepted = input.decision === "ACCEPTED";
  await prisma.equipmentRepair.update({
    where: { id: repair.id },
    data: {
      status: accepted ? "INSPECTED" : "REQUESTED",
      inspectionResult: input.decision,
      inspectedById: actor.id,
      inspectedAt: new Date(),
      inspectionNote: input.note?.trim() || null,
      // A rejected repair goes back out, so the return is no longer recorded.
      receivedOn: accepted ? undefined : null,
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: accepted ? "APPROVE" : "REJECT",
    entityType: "EquipmentRepair",
    entityId: repair.id,
    before: { status: repair.status },
    after: {
      status: accepted ? "INSPECTED" : "REQUESTED",
      decision: input.decision,
    },
    facilityId: repair.facilityId,
    sectionId: repair.sectionId,
  });

  return { id: repair.id, decision: input.decision };
}

/** The qualifications a repair still needs before the asset may be used again. */
export function missingQualifications(
  passed: { type: string }[],
): ("IQ" | "OQ" | "PQ")[] {
  const done = new Set(passed.map((q) => q.type));
  return (["IQ", "OQ", "PQ"] as const).filter((t) => !done.has(t));
}

/**
 * Return the asset to service. Requalification is mandatory: IQ, OQ and PQ must
 * each have passed for THIS repair (BR-EQ-6).
 */
export async function closeRepair(
  actor: SessionUser,
  input: { repairId: string },
) {
  if (!canManageEquipment(actor.designation))
    throw new Error("Not permitted to return equipment to service.");

  const repair = await prisma.equipmentRepair.findUnique({
    where: { id: input.repairId },
    include: {
      equipment: { select: { id: true, status: true, assetTag: true } },
      gatePasses: { where: { status: "OUT" }, select: { gatePassNo: true } },
      qualifications: {
        where: { result: "PASS" },
        select: { type: true },
      },
    },
  });
  if (!repair) throw new Error("Repair not found.");
  assertInScope(actor, repair);
  if (repair.status !== "INSPECTED" || repair.inspectionResult !== "ACCEPTED")
    throw new Error(
      "The repair must be received and inspected as accepted first.",
    );
  if (repair.gatePasses.length > 0)
    throw new Error(
      `${repair.gatePasses[0].gatePassNo} is still open — close it before returning the asset to service.`,
    );
  const missing = missingQualifications(repair.qualifications);
  if (missing.length > 0)
    throw new Error(
      `Record ${missing.join(", ")} (PASS) for this repair before returning the asset to service.`,
    );

  const restores = repair.equipment.status === "UNDER_REPAIR";
  await prisma.$transaction(async (tx) => {
    await tx.equipmentRepair.update({
      where: { id: repair.id },
      data: { status: "IN_SERVICE", closedAt: new Date() },
    });
    if (restores)
      await tx.equipment.update({
        where: { id: repair.equipmentId },
        data: { status: "ACTIVE" },
      });
  });

  await writeAudit({
    actorId: actor.id,
    action: "UPDATE",
    entityType: "EquipmentRepair",
    entityId: repair.id,
    before: { status: repair.status },
    after: { status: "IN_SERVICE" },
    facilityId: repair.facilityId,
    sectionId: repair.sectionId,
  });
  if (restores)
    await writeAudit({
      actorId: actor.id,
      action: "UPDATE",
      entityType: "Equipment",
      entityId: repair.equipmentId,
      before: { status: "UNDER_REPAIR" },
      after: { status: "ACTIVE", repairNo: repair.repairNo },
      facilityId: repair.facilityId,
      sectionId: repair.sectionId,
    });

  return { id: repair.id };
}

/**
 * Abandon a repair. The PR is left alone — it is rejected through procurement by
 * whoever verifies it, not silently from here.
 */
export async function cancelRepair(
  actor: SessionUser,
  input: { repairId: string; reason?: string | null },
) {
  if (!canManageEquipment(actor.designation))
    throw new Error("Not permitted to cancel repair requests.");

  const repair = await prisma.equipmentRepair.findUnique({
    where: { id: input.repairId },
    include: {
      equipment: { select: { id: true, status: true } },
      gatePasses: { where: { status: "OUT" }, select: { gatePassNo: true } },
    },
  });
  if (!repair) throw new Error("Repair not found.");
  assertInScope(actor, repair);
  if (!OPEN_REPAIR_STATUSES.includes(repair.status))
    throw new Error("This repair is already closed.");
  if (repair.gatePasses.length > 0)
    throw new Error(
      `${repair.gatePasses[0].gatePassNo} is still open — the asset is off-site. Receive it back first.`,
    );

  // Only restore the asset if nothing else is holding it out of service.
  const otherOpen = await prisma.equipmentRepair.count({
    where: {
      equipmentId: repair.equipmentId,
      id: { not: repair.id },
      status: { in: OPEN_REPAIR_STATUSES },
    },
  });
  const restores = repair.equipment.status === "UNDER_REPAIR" && otherOpen === 0;

  await prisma.$transaction(async (tx) => {
    await tx.equipmentRepair.update({
      where: { id: repair.id },
      data: {
        status: "CANCELLED",
        closedAt: new Date(),
        note: input.reason?.trim() || repair.note,
      },
    });
    if (restores)
      await tx.equipment.update({
        where: { id: repair.equipmentId },
        data: { status: "ACTIVE" },
      });
  });

  await writeAudit({
    actorId: actor.id,
    action: "UPDATE",
    entityType: "EquipmentRepair",
    entityId: repair.id,
    before: { status: repair.status },
    after: { status: "CANCELLED", reason: input.reason ?? null },
    facilityId: repair.facilityId,
    sectionId: repair.sectionId,
  });

  return { id: repair.id };
}
