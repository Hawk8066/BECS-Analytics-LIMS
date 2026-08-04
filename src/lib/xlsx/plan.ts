/**
 * What the importer fills in on the operator's behalf.
 *
 * Shared by the import action and the on-page column hint so the two can never
 * disagree about which columns a spreadsheet actually needs.
 */
import type { AdminModel } from "@/lib/admin/registry";
import { isPaisaField } from "@/lib/money";
import { canApproveParameter } from "@/lib/auth/perms";
import type { SessionUser } from "@/lib/auth/session";

export interface Numbering {
  field: string;
  key: string;
  prefix: string;
  pad: number;
}

/** Models whose human-readable number the server generates on import (SSOT §11). */
export const NUMBERED: Record<string, Numbering> = {
  Client: { field: "clientNo", key: "CLIENT", prefix: "CLI", pad: 5 },
};

export interface AutoFillPlan {
  /** Constant values stamped onto every imported row. */
  stamps: Record<string, string | Date>;
  numbering: Numbering | null;
  /** All field names the server supplies — not needed as sheet columns. */
  names: Set<string>;
}

/**
 * Facility/section stamps come from the actor (ADR-0003); a column in the sheet
 * always wins over a stamp.
 */
export function autoFillPlan(model: AdminModel, actor: SessionUser): AutoFillPlan {
  const has = (n: string) => model.fields.some((f) => f.name === n && f.editable);
  const stamps: Record<string, string | Date> = {};

  if (has("facilityId") && actor.facilityId) stamps.facilityId = actor.facilityId;
  if (has("sectionId") && actor.sectionId) stamps.sectionId = actor.sectionId;
  if (has("createdById")) stamps.createdById = actor.id;

  // An uploaded parameter sheet is the lab's master list, not a proposal. When
  // the uploader may approve parameters (COO/admin), the rows land approved and
  // are usable straight away — the same rule createParameter applies to one the
  // COO types in. Anyone else's upload still waits for COO approval.
  if (
    model.name === "Parameter" &&
    has("approvedAt") &&
    canApproveParameter(actor.designation)
  ) {
    stamps.approvedAt = new Date();
  }

  const numbering = NUMBERED[model.name];
  const resolved = numbering && has(numbering.field) ? numbering : null;

  const names = new Set(Object.keys(stamps));
  if (resolved) names.add(resolved.field);

  return { stamps, numbering: resolved, names };
}

/** Split a model's fields into what an operator must, may, and must not supply. */
export function columnHints(model: AdminModel, plan: AutoFillPlan) {
  const required: string[] = [];
  const optional: string[] = [];
  for (const f of model.fields) {
    if (!f.editable) continue;
    if (plan.names.has(f.name)) continue;
    if (f.isRequired && !f.hasDefault) required.push(f.name);
    else optional.push(f.name);
  }
  // Called out separately: these are written in rupees, not the paisa they're
  // stored as, and an operator has no way to guess that from the column name.
  const money = [...required, ...optional].filter((n) => isPaisaField(model.name, n));
  return { required, optional, money, autoFilled: [...plan.names] };
}
