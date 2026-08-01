import type {
  CustomLinks,
  EducationData,
  LayoutKind,
  SkillsData,
  StyleSettings,
  TargetLength,
  VersionType,
} from "@/types/supabase";
import { normalizeStyleSettings } from "./style";

/**
 * Safe reader for the immutable snapshot stored in `resume_versions.snapshot`.
 *
 * A snapshot is a historical record written by `create_resume_version` and can
 * never be rewritten, so this module has to cope with every shape that RPC has
 * ever produced. It therefore *reads defensively and never mutates*: the input
 * jsonb is only ever read from, and the returned object is freshly built.
 *
 * Nothing here interprets stored strings as markup. Every text value comes back
 * as a plain string and the viewer renders it as a text node, so a snapshot
 * that somehow contains HTML is displayed literally rather than executed.
 */

export const CURRENT_SNAPSHOT_SCHEMA_VERSION = 1;

export type SnapshotBullet = {
  content: string;
  sort_order: number;
};

export type SnapshotEntry = {
  title: string | null;
  subtitle: string | null;
  organization: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  education_data: EducationData | null;
  skills_data: SkillsData | null;
  sort_order: number;
  bullets: SnapshotBullet[];
};

export type SnapshotSection = {
  title: string;
  layout_kind: LayoutKind;
  sort_order: number;
  entries: SnapshotEntry[];
};

export type SnapshotHeader = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  custom_links: CustomLinks;
};

export type SnapshotResumeMeta = {
  name: string | null;
  target_company: string | null;
  target_role: string | null;
  style_settings: StyleSettings;
  target_length: TargetLength;
};

export type ParsedSnapshot = {
  schemaVersion: number;
  /** True when the field was absent and we fell back to schema version 1. */
  schemaVersionInferred: boolean;
  resume: SnapshotResumeMeta;
  header: SnapshotHeader | null;
  sections: SnapshotSection[];
  draftRevision: number | null;
  versionNumber: number | null;
  versionType: VersionType | null;
  createdAt: string | null;
  /**
   * Non-fatal problems found while reading. The snapshot is still displayable;
   * these explain what had to be skipped or defaulted so the viewer can say so
   * instead of silently showing an incomplete document.
   */
  issues: string[];
};

export type SnapshotParseResult =
  | { ok: true; snapshot: ParsedSnapshot }
  | { ok: false; error: string };

const LAYOUT_KINDS: LayoutKind[] = ["entry", "education", "skills"];
const TARGET_LENGTHS: TargetLength[] = ["one_page", "two_pages", "no_limit"];
const VERSION_TYPES: VersionType[] = ["manual", "exported", "submitted"];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Any non-string (including numbers and objects) reads as absent, never as "[object Object]". */
function readText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readInt(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : null;
}

/**
 * education_data / skills_data are read structurally rather than through the
 * write-path validators: a validator's job is to reject bad *input*, but a
 * snapshot is already-written history that must still be displayable. Unknown
 * keys are dropped, malformed members are skipped.
 */
function readEducationData(value: unknown): EducationData | null {
  if (!isPlainObject(value)) return null;
  const out: EducationData = {};
  for (const key of ["degree", "field_of_study", "minor", "gpa"] as const) {
    const text = readText(value[key]);
    if (text !== null && text.trim() !== "") out[key] = text;
  }
  for (const key of ["honors", "coursework", "details"] as const) {
    const raw = value[key];
    if (!Array.isArray(raw)) continue;
    const items = raw.filter((i): i is string => typeof i === "string" && i.trim() !== "");
    if (items.length > 0) out[key] = items;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function readSkillsData(value: unknown): SkillsData | null {
  if (!isPlainObject(value)) return null;
  const raw = value.categories;
  if (!Array.isArray(raw)) return null;
  const categories: SkillsData["categories"] = [];
  for (const cat of raw) {
    if (!isPlainObject(cat)) continue;
    const label = readText(cat.label);
    if (label === null) continue;
    const items = Array.isArray(cat.items)
      ? cat.items.filter((i): i is string => typeof i === "string")
      : [];
    categories.push({ label, items });
  }
  return categories.length > 0 ? { categories } : null;
}

function readCustomLinks(value: unknown): CustomLinks {
  if (!isPlainObject(value) || !Array.isArray(value.links)) return { links: [] };
  const links: CustomLinks["links"] = [];
  for (const link of value.links) {
    if (!isPlainObject(link)) continue;
    const label = readText(link.label);
    const url = readText(link.url);
    if (label === null || url === null) continue;
    links.push({ label, url });
  }
  return { links };
}

function readHeader(value: unknown): SnapshotHeader | null {
  if (!isPlainObject(value)) return null;
  return {
    full_name: readText(value.full_name),
    email: readText(value.email),
    phone: readText(value.phone),
    location: readText(value.location),
    linkedin_url: readText(value.linkedin_url),
    github_url: readText(value.github_url),
    portfolio_url: readText(value.portfolio_url),
    custom_links: readCustomLinks(value.custom_links),
  };
}

function readBullets(value: unknown, issues: string[], where: string): SnapshotBullet[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    issues.push(`${where}: bullets were not a list and were skipped`);
    return [];
  }
  const bullets: SnapshotBullet[] = [];
  value.forEach((raw, i) => {
    if (!isPlainObject(raw)) {
      issues.push(`${where}: bullet ${i + 1} was malformed and was skipped`);
      return;
    }
    const content = readText(raw.content);
    if (content === null) {
      issues.push(`${where}: bullet ${i + 1} had no text and was skipped`);
      return;
    }
    bullets.push({ content, sort_order: readInt(raw.sort_order) ?? i + 1 });
  });
  return bullets.sort((a, b) => a.sort_order - b.sort_order);
}

function readEntries(value: unknown, issues: string[], where: string): SnapshotEntry[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    issues.push(`${where}: entries were not a list and were skipped`);
    return [];
  }
  const entries: SnapshotEntry[] = [];
  value.forEach((raw, i) => {
    if (!isPlainObject(raw)) {
      issues.push(`${where}: entry ${i + 1} was malformed and was skipped`);
      return;
    }
    entries.push({
      title: readText(raw.title),
      subtitle: readText(raw.subtitle),
      organization: readText(raw.organization),
      location: readText(raw.location),
      start_date: readText(raw.start_date),
      end_date: readText(raw.end_date),
      education_data: readEducationData(raw.education_data),
      skills_data: readSkillsData(raw.skills_data),
      sort_order: readInt(raw.sort_order) ?? i + 1,
      bullets: readBullets(raw.bullets, issues, `${where} › entry ${i + 1}`),
    });
  });
  return entries.sort((a, b) => a.sort_order - b.sort_order);
}

function readResumeMeta(value: unknown): SnapshotResumeMeta {
  const obj = isPlainObject(value) ? value : {};
  const targetLength = readText(obj.target_length);
  return {
    name: readText(obj.name),
    target_company: readText(obj.target_company),
    target_role: readText(obj.target_role),
    // normalizeStyleSettings already coerces anything unexpected to the
    // documented defaults, so an old or partial style object still renders.
    style_settings: normalizeStyleSettings(obj.style_settings),
    target_length: TARGET_LENGTHS.includes(targetLength as TargetLength)
      ? (targetLength as TargetLength)
      : "one_page",
  };
}

/**
 * Parse a stored snapshot.
 *
 * Hard-rejects (returns `ok: false`) only when the value is not an object or
 * carries no readable `sections` array — at that point there is no document to
 * show. Everything else degrades to a partial display plus an entry in
 * `issues`, because refusing to render a slightly odd historical record would
 * lose the user's only copy of it.
 */
export function parseSnapshot(raw: unknown): SnapshotParseResult {
  if (!isPlainObject(raw)) {
    return { ok: false, error: "This version's stored data is not readable." };
  }

  const rawSections = raw.sections;
  if (!Array.isArray(rawSections)) {
    return { ok: false, error: "This version's stored data has no readable sections." };
  }

  const issues: string[] = [];

  const declaredVersion = readInt(raw.snapshot_schema_version);
  // Snapshots written before Step 3 have no schema-version field. They are
  // structurally identical to version 1, so they are read as version 1 rather
  // than rejected — and the stored JSON is never rewritten to add the field.
  const schemaVersion = declaredVersion ?? CURRENT_SNAPSHOT_SCHEMA_VERSION;
  const schemaVersionInferred = declaredVersion === null;
  if (declaredVersion !== null && declaredVersion > CURRENT_SNAPSHOT_SCHEMA_VERSION) {
    issues.push(
      `This version was written by a newer format (v${declaredVersion}); some content may not be shown.`,
    );
  }

  const sections: SnapshotSection[] = [];
  rawSections.forEach((rawSection, i) => {
    if (!isPlainObject(rawSection)) {
      issues.push(`Section ${i + 1} was malformed and was skipped.`);
      return;
    }
    const title = readText(rawSection.title);
    const layoutKind = readText(rawSection.layout_kind);
    if (title === null || !LAYOUT_KINDS.includes(layoutKind as LayoutKind)) {
      issues.push(`Section ${i + 1} was malformed and was skipped.`);
      return;
    }
    sections.push({
      title,
      layout_kind: layoutKind as LayoutKind,
      sort_order: readInt(rawSection.sort_order) ?? i + 1,
      entries: readEntries(rawSection.entries, issues, `Section "${title}"`),
    });
  });
  sections.sort((a, b) => a.sort_order - b.sort_order);

  const versionType = readText(raw.version_type);

  return {
    ok: true,
    snapshot: {
      schemaVersion,
      schemaVersionInferred,
      resume: readResumeMeta(raw.resume),
      header: readHeader(raw.header),
      sections,
      draftRevision: readInt(raw.draft_revision),
      versionNumber: readInt(raw.version_number),
      versionType: VERSION_TYPES.includes(versionType as VersionType)
        ? (versionType as VersionType)
        : null,
      createdAt: readText(raw.created_at),
      issues,
    },
  };
}

/**
 * Project the live editor draft into the same shape a snapshot parses into, so
 * "current draft vs. version" can reuse exactly the version-vs-version
 * comparison instead of a second, subtly different code path.
 */
export function draftToComparable(input: {
  resume: {
    name: string;
    target_company: string | null;
    target_role: string | null;
    style_settings: unknown;
    target_length: TargetLength;
  };
  header: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
    location: string | null;
    linkedin_url: string | null;
    github_url: string | null;
    portfolio_url: string | null;
    custom_links: unknown;
  } | null;
  sections: { id: string; title: string; layout_kind: LayoutKind; sort_order: number }[];
  entries: {
    id: string;
    section_id: string;
    title: string | null;
    subtitle: string | null;
    organization: string | null;
    location: string | null;
    start_date: string | null;
    end_date: string | null;
    education_data: unknown;
    skills_data: unknown;
    sort_order: number;
  }[];
  bullets: { id: string; entry_id: string; content: string; sort_order: number }[];
}): ParsedSnapshot {
  const bulletsByEntry = new Map<string, SnapshotBullet[]>();
  for (const b of [...input.bullets].sort((x, y) => x.sort_order - y.sort_order)) {
    const list = bulletsByEntry.get(b.entry_id) ?? [];
    list.push({ content: b.content, sort_order: b.sort_order });
    bulletsByEntry.set(b.entry_id, list);
  }

  const entriesBySection = new Map<string, SnapshotEntry[]>();
  for (const e of [...input.entries].sort((x, y) => x.sort_order - y.sort_order)) {
    const list = entriesBySection.get(e.section_id) ?? [];
    list.push({
      title: e.title,
      subtitle: e.subtitle,
      organization: e.organization,
      location: e.location,
      start_date: e.start_date,
      end_date: e.end_date,
      education_data: readEducationData(e.education_data),
      skills_data: readSkillsData(e.skills_data),
      sort_order: e.sort_order,
      bullets: bulletsByEntry.get(e.id) ?? [],
    });
    entriesBySection.set(e.section_id, list);
  }

  return {
    schemaVersion: CURRENT_SNAPSHOT_SCHEMA_VERSION,
    schemaVersionInferred: false,
    resume: readResumeMeta(input.resume),
    header: readHeader(input.header),
    sections: [...input.sections]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => ({
        title: s.title,
        layout_kind: s.layout_kind,
        sort_order: s.sort_order,
        entries: entriesBySection.get(s.id) ?? [],
      })),
    draftRevision: null,
    versionNumber: null,
    versionType: null,
    createdAt: null,
    issues: [],
  };
}
