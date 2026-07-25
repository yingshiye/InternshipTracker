import type { CustomLinks, EducationData, SkillsData } from "@/types/supabase";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const HTML_TAG_RE = /<\/?[a-zA-Z][^>]*>/;

/**
 * Shared plain-text rule for every resume-builder text field: no HTML,
 * and no embedded newlines. A bullet/title/label may be long enough to
 * wrap visually (that's ordinary CSS word-wrap), but a stored newline can
 * only represent a manually-created paragraph break, which isn't allowed.
 */
export function assertPlainText(value: string, fieldName = "value"): void {
  if (HTML_TAG_RE.test(value)) {
    throw new ValidationError(`${fieldName} must not contain HTML`);
  }
  if (/[\n\r]/.test(value)) {
    throw new ValidationError(`${fieldName} must not contain line breaks`);
  }
}

export function normalizePlainText(value: string, fieldName = "value"): string {
  const trimmed = value.trim();
  assertPlainText(trimmed, fieldName);
  return trimmed;
}

/** Empty/whitespace-only input is treated as absent (null), not "". */
export function normalizeOptionalText(value: string | null | undefined, fieldName = "value"): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  assertPlainText(trimmed, fieldName);
  return trimmed;
}

// ─── education_data ─────────────────────────────────────────────────────────

const EDUCATION_SCALAR_KEYS = ["degree", "field_of_study", "minor", "gpa"] as const;
const EDUCATION_ARRAY_KEYS = ["honors", "coursework", "details"] as const;
const EDUCATION_KEYS = new Set<string>([...EDUCATION_SCALAR_KEYS, ...EDUCATION_ARRAY_KEYS]);

/**
 * Empty/whitespace-only optional scalars are dropped (treated as absent,
 * not stored as ""). Empty arrays (after filtering blank entries) are
 * omitted entirely rather than stored as []. GPA is free-form plain text
 * ("3.8", "3.8/4.0", "Major GPA: 3.9" are all valid) — no format is
 * enforced beyond the shared plain-text rule.
 */
export function validateEducationData(input: unknown): EducationData {
  if (input === null || input === undefined) return {};
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("education_data must be an object");
  }
  const obj = input as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (!EDUCATION_KEYS.has(key)) {
      throw new ValidationError(`education_data has an unknown property "${key}"`);
    }
  }

  const result: EducationData = {};

  for (const key of EDUCATION_SCALAR_KEYS) {
    const raw = obj[key];
    if (raw === undefined || raw === null) continue;
    if (typeof raw !== "string") throw new ValidationError(`education_data.${key} must be a string`);
    const trimmed = raw.trim();
    if (trimmed === "") continue;
    assertPlainText(trimmed, `education_data.${key}`);
    result[key] = trimmed;
  }

  for (const key of EDUCATION_ARRAY_KEYS) {
    const raw = obj[key];
    if (raw === undefined || raw === null) continue;
    if (!Array.isArray(raw)) throw new ValidationError(`education_data.${key} must be an array`);
    const cleaned: string[] = [];
    for (const item of raw) {
      if (typeof item !== "string") throw new ValidationError(`education_data.${key} items must be strings`);
      const trimmed = item.trim();
      if (trimmed === "") continue;
      assertPlainText(trimmed, `education_data.${key}`);
      cleaned.push(trimmed);
    }
    if (cleaned.length > 0) result[key] = cleaned;
  }

  return result;
}

// ─── skills_data ────────────────────────────────────────────────────────────

/**
 * Category order and item order are preserved exactly as given — this
 * validator only filters/rejects, never reorders. A missing/empty category
 * label is a hard error (likely a real mistake). A category left with zero
 * items after filtering is silently removed (nothing meaningful to reject
 * about it). Duplicate items within a category are silently de-duplicated
 * (first occurrence wins). Duplicate category labels across the array are
 * a hard error.
 */
export function validateSkillsData(input: unknown): SkillsData {
  if (input === null || input === undefined) return { categories: [] };
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("skills_data must be an object");
  }
  const obj = input as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (key !== "categories") throw new ValidationError(`skills_data has an unknown property "${key}"`);
  }

  const rawCategories = obj.categories;
  if (rawCategories === undefined) return { categories: [] };
  if (!Array.isArray(rawCategories)) throw new ValidationError("skills_data.categories must be an array");

  const seenLabels = new Set<string>();
  const categories: SkillsData["categories"] = [];

  for (const rawCat of rawCategories) {
    if (typeof rawCat !== "object" || rawCat === null || Array.isArray(rawCat)) {
      throw new ValidationError("skills_data category entries must be objects");
    }
    const catObj = rawCat as Record<string, unknown>;
    for (const key of Object.keys(catObj)) {
      if (key !== "label" && key !== "items") {
        throw new ValidationError(`skills_data category has an unknown property "${key}"`);
      }
    }

    if (typeof catObj.label !== "string") throw new ValidationError("skills_data category label is required");
    const label = catObj.label.trim();
    if (label === "") throw new ValidationError("skills_data category label must not be empty");
    assertPlainText(label, "skills_data category label");
    if (seenLabels.has(label)) {
      throw new ValidationError(`skills_data has a duplicate category label "${label}"`);
    }
    seenLabels.add(label);

    if (!Array.isArray(catObj.items)) throw new ValidationError("skills_data category items must be an array");
    const seenItems = new Set<string>();
    const items: string[] = [];
    for (const rawItem of catObj.items) {
      if (typeof rawItem !== "string") throw new ValidationError("skills_data category items must be strings");
      const trimmed = rawItem.trim();
      if (trimmed === "") continue;
      assertPlainText(trimmed, "skills_data category item");
      if (seenItems.has(trimmed)) continue;
      seenItems.add(trimmed);
      items.push(trimmed);
    }

    if (items.length === 0) continue;
    categories.push({ label, items });
  }

  return { categories };
}

// ─── Resume-link URL validation ─────────────────────────────────────────────
// Deliberately independent from src/lib/url.ts's normalizeUrl(), which is
// built for job-URL deduplication and strips fragments/trailing slashes —
// exactly the parts of a URL a resume link (a portfolio anchor, a GitHub
// repo path, a query string) needs to keep.

const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/**
 * Trims whitespace, detects any existing URI scheme (not just "://"
 * schemes — mailto:, javascript:, data:, file: all have a scheme without
 * "//") and rejects anything other than http/https, defaults to https://
 * only when no scheme was present at all, then parses and re-confirms the
 * protocol. Preserves path, query string, and fragment — the URL
 * constructor's toString() may still apply standard URL normalization
 * (lowercasing the hostname, percent-encoding, a trailing slash where the
 * spec requires one); this does not claim byte-for-byte preservation of
 * the original input, only of its path/query/fragment semantics.
 */
export function validateHttpUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new ValidationError("URL is required");

  const schemeMatch = SCHEME_RE.exec(trimmed);
  let candidate: string;
  if (schemeMatch) {
    const scheme = schemeMatch[0].slice(0, -1).toLowerCase();
    if (scheme !== "http" && scheme !== "https") {
      throw new ValidationError("URL must use http or https");
    }
    candidate = trimmed;
  } else {
    candidate = `https://${trimmed}`;
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new ValidationError("Enter a valid URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ValidationError("URL must use http or https");
  }

  return url.toString();
}

// ─── custom_links ───────────────────────────────────────────────────────────

export function validateCustomLinks(input: unknown): CustomLinks {
  if (input === null || input === undefined) return { links: [] };
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("custom_links must be an object");
  }
  const obj = input as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (key !== "links") throw new ValidationError(`custom_links has an unknown property "${key}"`);
  }

  const rawLinks = obj.links;
  if (rawLinks === undefined) return { links: [] };
  if (!Array.isArray(rawLinks)) throw new ValidationError("custom_links.links must be an array");

  const links: CustomLinks["links"] = [];
  for (const rawLink of rawLinks) {
    if (typeof rawLink !== "object" || rawLink === null || Array.isArray(rawLink)) {
      throw new ValidationError("custom_links.links entries must be objects");
    }
    const linkObj = rawLink as Record<string, unknown>;
    for (const key of Object.keys(linkObj)) {
      if (key !== "label" && key !== "url") {
        throw new ValidationError(`custom_links link has an unknown property "${key}"`);
      }
    }

    if (typeof linkObj.label !== "string") throw new ValidationError("custom_links link label is required");
    const label = linkObj.label.trim();
    if (label === "") throw new ValidationError("custom_links link label must not be empty");
    assertPlainText(label, "custom_links link label");

    if (typeof linkObj.url !== "string") throw new ValidationError("custom_links link url is required");
    const url = validateHttpUrl(linkObj.url);

    links.push({ label, url });
  }

  return { links };
}
