// Static letterhead / controlled-document constants for the printed Test Report,
// taken from the current BECS Analytics report template (BECS/FF/708/01). The
// address is per-facility; everything else is company-wide. Hardcoded on
// purpose — change here to change the report masthead and footer.

export interface Letterhead {
  /** Masthead title. */
  name: string;
  /** Address lines shown under the title. */
  addressLines: string[];
  /** Company National Tax Number. */
  ntn: string;
  /** Accreditation box (PNAC / ISO 17025). */
  accreditation: { body: string; labNo: string; standard: string };
  /** Stated lab environmental ranges during testing. */
  environmental: { temperature: string; humidity: string };
}

const COMPANY = {
  name: "BECS Analytics",
  ntn: "8497332",
  accreditation: { body: "PNAC", labNo: "LAB 316", standard: "17025" },
  environmental: { temperature: "15 – 35 °C", humidity: "45 – 75%" },
};

// Address per facility code (Facility.code — "LAHORE" / "RYK").
const ADDRESS_BY_CODE: Record<string, string[]> = {
  LAHORE: ["41-Tariq Ismail Road, Link Raiwind Road, Lahore"],
  // TODO: confirm the Rahim Yar Khan facility's street address for its reports.
  RYK: ["Rahim Yar Khan"],
};

/** Letterhead for a facility; falls back to the Lahore address if unknown. */
export function letterheadFor(facilityCode: string | null | undefined): Letterhead {
  const addressLines =
    (facilityCode ? ADDRESS_BY_CODE[facilityCode] : undefined) ??
    ADDRESS_BY_CODE.LAHORE;
  return { ...COMPANY, addressLines };
}

// Standing notes printed under the results (controlled-document boilerplate).
export const REPORT_NOTES: string[] = [
  "Test report shall not be reproduced except in full, without written permission of BECS Analytics.",
  'BECS Analytics is accredited by "Pakistan National Accreditation Council" with Lab # 316.',
  "Test report is solely based on particular sample and sample information provided by the Client.",
  "Conformity statement is reported on the basis of the Client's request.",
];

export const DECISION_RULE =
  "If the sum of the result and uncertainty is < the specified / claimed / permissible limit, the sample is declared Fit, and vice versa.";

// Controlled-document reference (shown in the footer).
export const DOC_CONTROL =
  "BECS/FF/708/01, Revision 01, Issue 02, Issue date 10/04/2025";
