// App-wide date/time formatting. Display format is DD/MM/YYYY everywhere and
// times are shown in Pakistan Standard Time (PKT, UTC+5, no DST). Values are
// stored/transported as UTC ISO and only converted for view.

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000; // Asia/Karachi = UTC+5 (fixed)

function parts(value: Date | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  // Shift to PKT, then read UTC fields (date-only values at 00:00Z stay same day).
  const k = new Date(d.getTime() + PKT_OFFSET_MS);
  const dd = String(k.getUTCDate()).padStart(2, "0");
  const mm = String(k.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = k.getUTCFullYear();
  const hh = String(k.getUTCHours()).padStart(2, "0");
  const min = String(k.getUTCMinutes()).padStart(2, "0");
  return { dd, mm, yyyy, hh, min };
}

/** DD/MM/YYYY (empty string for null/invalid). */
export function formatDate(value: Date | string | null | undefined): string {
  const p = parts(value);
  return p ? `${p.dd}/${p.mm}/${p.yyyy}` : "";
}

// 12-hour clock with AM/PM (times are already shifted to Pakistan time).
function clock12(hh: string, min: string): string {
  const h = Number(hh);
  const mer = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${min} ${mer}`;
}

/** DD/MM/YYYY h:mm AM/PM. */
export function formatDateTime(value: Date | string | null | undefined): string {
  const p = parts(value);
  return p ? `${p.dd}/${p.mm}/${p.yyyy} ${clock12(p.hh, p.min)}` : "";
}

/** h:mm AM/PM (time only). */
export function formatTime(value: Date | string | null | undefined): string {
  const p = parts(value);
  return p ? clock12(p.hh, p.min) : "";
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
