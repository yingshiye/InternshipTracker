import type { DateFormat } from "@/types/supabase";

/**
 * Month-level date handling for the resume editor.
 *
 * Dates are stored in Postgres `date` columns as YYYY-MM-DD strings. The
 * editor only cares about month granularity, so we persist the first of the
 * month (YYYY-MM-01) and display only year+month. All parsing works on the
 * string components directly — never `new Date(str)` — so a date-only value
 * can never shift a month due to local-timezone conversion.
 *
 * No English month names or abbreviations are ever produced. Month numbers
 * are always zero-padded.
 */

export type YearMonth = { year: number; month: number }; // month is 1-12

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const YEAR_MONTH = /^(\d{4})-(\d{2})$/;

/** Parse a stored date/month string into {year, month} without Date/timezone. */
export function parseYearMonth(value: string | null | undefined): YearMonth | null {
  if (!value) return null;
  const iso = ISO_DATE.exec(value);
  if (iso) {
    const month = Number(iso[2]);
    if (month < 1 || month > 12) return null;
    return { year: Number(iso[1]), month };
  }
  const ym = YEAR_MONTH.exec(value);
  if (ym) {
    const month = Number(ym[2]);
    if (month < 1 || month > 12) return null;
    return { year: Number(ym[1]), month };
  }
  return null;
}

/** Canonical storage form for a selected month: YYYY-MM-01. */
export function toStoredDate(ym: YearMonth | null): string | null {
  if (!ym) return null;
  return `${String(ym.year).padStart(4, "0")}-${String(ym.month).padStart(2, "0")}-01`;
}

/** The value for a month-type <input type="month">, i.e. YYYY-MM. */
export function toMonthInputValue(value: string | null | undefined): string {
  const ym = parseYearMonth(value);
  if (!ym) return "";
  return `${String(ym.year).padStart(4, "0")}-${String(ym.month).padStart(2, "0")}`;
}

/** Convert a month-input value (YYYY-MM) back to stored form (YYYY-MM-01). */
export function fromMonthInputValue(value: string): string | null {
  const ym = parseYearMonth(value);
  return toStoredDate(ym);
}

/** Format a single stored month per the resume's date_format. Empty → "". */
export function formatMonth(value: string | null | undefined, format: DateFormat): string {
  const ym = parseYearMonth(value);
  if (!ym) return "";
  const mm = String(ym.month).padStart(2, "0");
  const yyyy = String(ym.year).padStart(4, "0");
  switch (format) {
    case "MM YYYY":
      return `${mm} ${yyyy}`;
    case "MM/YYYY":
      return `${mm}/${yyyy}`;
    case "YYYY":
      return yyyy;
  }
}

/**
 * Format a start–end date range. A null/empty end date renders as "Present"
 * for a start that exists (an ongoing entry). Uses an en dash separator.
 */
export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
  format: DateFormat,
): string {
  const startStr = formatMonth(start, format);
  const hasStart = startStr !== "";
  const endStr = formatMonth(end, format);
  const endLabel = end ? endStr : hasStart ? "Present" : "";
  if (hasStart && endLabel) return `${startStr} – ${endLabel}`;
  if (hasStart) return startStr;
  return endLabel;
}
