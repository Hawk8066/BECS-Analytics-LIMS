// App-wide date formatting. Display format is DD/MM/YYYY everywhere; values are
// stored/transported as ISO (yyyy-mm-dd / full ISO) and only formatted for view.

function parts(value: Date | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  // Use UTC so a date-only value (stored at midnight UTC) isn't shifted a day.
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return { dd, mm, yyyy, hh, min };
}

/** DD/MM/YYYY (empty string for null/invalid). */
export function formatDate(value: Date | string | null | undefined): string {
  const p = parts(value);
  return p ? `${p.dd}/${p.mm}/${p.yyyy}` : "";
}

/** DD/MM/YYYY HH:mm UTC. */
export function formatDateTime(value: Date | string | null | undefined): string {
  const p = parts(value);
  return p ? `${p.dd}/${p.mm}/${p.yyyy} ${p.hh}:${p.min} UTC` : "";
}

/** ISO yyyy-mm-dd (for date input values), empty string for null/invalid. */
export function toISODate(value: Date | string | null | undefined): string {
  const p = parts(value);
  return p ? `${p.yyyy}-${p.mm}-${p.dd}` : "";
}

// --- DD/MM/YYYY text-entry helpers (shared by DateInput and dynamic editors) ---

/** Progressive mask of free typed digits into DD/MM/YYYY. */
export function maskDMY(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 8); // DDMMYYYY
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  return [dd, mm, yyyy].filter((x) => x.length > 0).join("/");
}

/** DD/MM/YYYY -> ISO yyyy-mm-dd; "" if incomplete/invalid (rejects overflow). */
export function dmyToISO(display: string): string {
  const m = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  const [, dd, mm, yyyy] = m;
  const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  if (
    d.getUTCFullYear() !== Number(yyyy) ||
    d.getUTCMonth() + 1 !== Number(mm) ||
    d.getUTCDate() !== Number(dd)
  )
    return "";
  return `${yyyy}-${mm}-${dd}`;
}
