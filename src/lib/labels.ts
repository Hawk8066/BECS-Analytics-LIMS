import type { Designation, ExpenseCategory } from "@prisma/client";

// Human-readable labels for the Designation enum (UI display).
export const DESIGNATION_LABELS: Record<Designation, string> = {
  ADMIN: "Administrator",
  CLIENT: "Client",
  VENDOR: "Vendor",
  OUTSOURCE_LAB: "Outsourced Lab",
  COO: "COO",
  OPERATIONS_MANAGER: "Operations Manager",
  LAB_MANAGER_RYK: "Lab Manager (RYK)",
  ANALYST: "Analyst",
  ANALYST_RYK: "Analyst (RYK)",
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

// What a recorded running cost was for (Expense.category).
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  UTILITY: "Utility (electricity, gas, water, internet)",
  RENT: "Rent",
  TRANSPORT: "Transport & fuel",
  MAINTENANCE: "Repairs & maintenance",
  OFFICE: "Office & admin",
  OTHER: "Other",
};

/** The ExpenseCategory values, in the order they are offered in the form. */
export const EXPENSE_CATEGORIES = Object.keys(
  EXPENSE_CATEGORY_LABELS,
) as ExpenseCategory[];
