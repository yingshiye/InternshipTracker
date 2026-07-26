/**
 * Suggested export filename / temporary document title.
 *
 * The browser owns the filename a user actually saves: Chrome seeds the Save
 * as PDF dialog from `document.title`, but the user can type anything, and no
 * page script can read back what they chose. Everything here is therefore a
 * *suggestion* only.
 *
 * No UUIDs, no ids of any kind — a filename is user-visible text and should
 * read like a document name.
 */

const MAX_COMPONENT_LENGTH = 40;
const MAX_TOTAL_LENGTH = 120;

/**
 * Reduce one component to filename-safe characters.
 *
 * Removed: the Windows-forbidden set `< > : " / \ | ? *`, control characters,
 * and leading/trailing dots (a leading dot hides the file on Unix; a trailing
 * dot is dropped by Windows). Whitespace and separator runs collapse to a
 * single underscore so "Acme   Corp" and "Acme Corp" agree.
 */
export function sanitizeFilenameComponent(input: string): string {
  const cleaned = input
    // Control characters are exactly what must go, hence the escape range.
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[<>:"/\\|?*]/g, " ")
    .replace(/[\s_]+/g, "_")
    .replace(/^[._]+/, "")
    .replace(/[._]+$/, "");
  return cleaned.slice(0, MAX_COMPONENT_LENGTH).replace(/_+$/, "");
}

/** Local calendar date as YYYY-MM-DD — never `toISOString`, which shifts by timezone. */
export function localDateStamp(date: Date = new Date()): string {
  const y = String(date.getFullYear()).padStart(4, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type FilenameInput = {
  fullName?: string | null;
  company?: string | null;
  role?: string | null;
  date?: Date;
};

/**
 * `FirstName_LastName_Company_Role_YYYY-MM-DD`, with empty components dropped
 * rather than leaving double underscores. Falls back to `Resume_YYYY-MM-DD`
 * when nothing usable survives sanitization.
 */
export function buildExportFilename(input: FilenameInput): string {
  const stamp = localDateStamp(input.date ?? new Date());
  const parts = [input.fullName, input.company, input.role]
    .map((p) => (typeof p === "string" ? sanitizeFilenameComponent(p) : ""))
    .filter((p) => p.length > 0);

  if (parts.length === 0) return `Resume_${stamp}`;

  let name = `${parts.join("_")}_${stamp}`;
  if (name.length > MAX_TOTAL_LENGTH) {
    // Trim the body, never the date — the date is what makes two exports of
    // the same resume distinguishable in a downloads folder.
    const budget = MAX_TOTAL_LENGTH - stamp.length - 1;
    name = `${parts.join("_").slice(0, budget).replace(/_+$/, "")}_${stamp}`;
  }
  return name;
}
