import type { Designation } from "@prisma/client";

// Human-readable labels for the Designation enum (UI display).
export const DESIGNATION_LABELS: Record<Designation, string> = {
  ADMIN: "Administrator",
  CLIENT: "Client",
  COO: "COO",
  OPERATIONS_MANAGER: "Operations Manager",
  LAB_MANAGER_RYK: "Lab Manager (RYK)",
  ANALYST: "Analyst",
  LAB_ASSISTANT: "Lab Assistant",
  LAB_ATTENDANT: "Lab Attendant",
  LIAISON_OFFICER: "Liaison Officer",
  ACCOUNTANT: "Accountant",
  PURCHASE_OFFICER: "Purchase Officer",
  STORE_INCHARGE: "Store In-charge",
  IT_OFFICER: "IT Officer",
  SALES_MARKETING_OFFICER: "Sales & Marketing Officer",
};

export function designationLabel(d: Designation): string {
  return DESIGNATION_LABELS[d] ?? d;
}
