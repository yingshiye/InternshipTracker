import type { StyleSettings, TargetLength, EducationData, SkillsData } from "@/types/supabase";
import { fnv1a } from "./fingerprint";

/**
 * Deterministic Resume Check. A pure function of the draft content, style
 * settings, target length, and DOM-derived measurements (supplied by the
 * editor's measurement hook). No randomness, no time, no network — the same
 * input always yields the same findings, which is what makes fingerprint-based
 * dismissal stable.
 */

export type Severity = "error" | "warning" | "suggestion";
export type FindingTargetKind = "resume" | "header" | "section" | "entry" | "bullet";

export type Finding = {
  id: string; // stable per (rule, target) — used for React keys and Locate
  ruleId: string;
  severity: Severity;
  targetKind: FindingTargetKind;
  targetId: string | null;
  message: string;
  fingerprint: string; // for localStorage dismissal; changes when the problem or severity changes
  canFix: boolean;
};

export type CheckSection = { id: string; title: string; layout_kind: "entry" | "education" | "skills" };
export type CheckEntry = {
  id: string;
  section_id: string;
  title: string | null;
  organization: string | null;
  start_date: string | null;
  end_date: string | null;
  education_data: EducationData | null;
  skills_data: SkillsData | null;
};
export type CheckBullet = { id: string; entry_id: string; content: string };
export type CheckHeader = {
  full_name: string | null;
  email: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
} | null;

export type CheckMeasurements = {
  pageCount: number;
  overflowPx: number; // content height beyond the printable area (>0 = overflow)
  nearOverflowRatio: number; // fraction of the last page's printable height used [0..1]
  unusedRatio: number; // fraction of total page space left empty [0..1]
  renderFailed: boolean;
  clippedBulletIds: string[];
  bulletLineCounts: Record<string, number>;
};

export type ResumeCheckInput = {
  header: CheckHeader;
  sections: CheckSection[];
  entries: CheckEntry[];
  bullets: CheckBullet[];
  style: StyleSettings;
  targetLength: TargetLength;
  measurements: CheckMeasurements;
};

const MAX_BULLET_LINES = 3;
const TOO_MANY_BULLETS = 8;
const TOO_MANY_ENTRIES = 8;
const NEAR_OVERFLOW = 0.92;
const EXCESS_UNUSED = 0.4;
const SIMILARITY = 0.8;

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value) ? value : `https://${value}`);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function targetPageLimit(target: TargetLength): number | null {
  if (target === "one_page") return 1;
  if (target === "two_pages") return 2;
  return null;
}

function words(content: string): string[] {
  return content.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

export function runResumeCheck(input: ResumeCheckInput): Finding[] {
  const { header, sections, entries, bullets, style, targetLength, measurements: m } = input;
  const findings: Finding[] = [];
  const bulletsByEntry = new Map<string, CheckBullet[]>();
  for (const b of bullets) {
    const list = bulletsByEntry.get(b.entry_id) ?? [];
    list.push(b);
    bulletsByEntry.set(b.entry_id, list);
  }
  const entriesBySection = new Map<string, CheckEntry[]>();
  for (const e of entries) {
    const list = entriesBySection.get(e.section_id) ?? [];
    list.push(e);
    entriesBySection.set(e.section_id, list);
  }
  const sectionById = new Map(sections.map((s) => [s.id, s]));

  const push = (
    ruleId: string,
    severity: Severity,
    targetKind: FindingTargetKind,
    targetId: string | null,
    message: string,
    signal: string,
    canFix = false,
  ) => {
    const id = `${ruleId}:${targetId ?? "resume"}`;
    findings.push({
      id,
      ruleId,
      severity,
      targetKind,
      targetId,
      message,
      fingerprint: fnv1a(`${ruleId}:${targetId ?? "resume"}:${severity}:${signal}`),
      canFix,
    });
  };

  // ── Errors ────────────────────────────────────────────────────────────────
  if (m.renderFailed) {
    push("preview_render_failed", "error", "resume", null, "The resume preview failed to render.", "failed");
  }
  const limit = targetPageLimit(targetLength);
  if (limit !== null && m.pageCount > limit) {
    push(
      "exceeds_target_length",
      "error",
      "resume",
      null,
      `Resume is ${m.pageCount} pages but the target is ${limit} page${limit > 1 ? "s" : ""}.`,
      `${m.pageCount}>${limit}`,
    );
  }
  if (m.overflowPx > 0) {
    push("printable_overflow", "error", "resume", null, "Content overflows the printable page area.", `${Math.round(m.overflowPx)}`);
  }
  for (const bid of m.clippedBulletIds) {
    push("clipped_content", "error", "bullet", bid, "This content is clipped and not fully visible.", "clipped");
  }
  if (!header || !header.full_name?.trim()) {
    push("missing_contact_name", "error", "header", null, "Add your full name to the header.", header?.full_name ? "set" : "missing");
  }
  if (!header || !header.email?.trim()) {
    push("missing_contact_email", "error", "header", null, "Add a contact email to the header.", header?.email ? "set" : "missing");
  }
  for (const e of entries) {
    const layout = sectionById.get(e.section_id)?.layout_kind;
    if (layout === "entry" && !e.title?.trim() && !e.organization?.trim()) {
      push("missing_entry_fields", "error", "entry", e.id, "This entry needs a title or organization.", "empty");
    } else if (layout === "education" && !(e.education_data && Object.keys(e.education_data).length > 0)) {
      push("missing_entry_fields", "error", "entry", e.id, "This education entry has no details.", "empty");
    } else if (layout === "skills" && !(e.skills_data && e.skills_data.categories?.length > 0)) {
      push("missing_entry_fields", "error", "entry", e.id, "This skills entry has no skills.", "empty");
    }
  }

  // ── Warnings ────────────────────────────────────────────────────────────────
  if (style.body_font_size_pt < 10) {
    push("small_body_font", "warning", "resume", null, `Body font is ${style.body_font_size_pt} pt (below 10 pt).`, `${style.body_font_size_pt}`, true);
  }
  if (style.margin_in < 0.5) {
    push("small_margins", "warning", "resume", null, `Margins are ${style.margin_in}\" (below 0.5\").`, `${style.margin_in}`, true);
  }
  if (style.body_font_size_pt < 10 && style.margin_in < 0.5 && style.line_spacing === "compact") {
    push("excessive_compression", "warning", "resume", null, "Layout is heavily compressed; readability may suffer.", "compressed");
  }
  if (m.overflowPx <= 0 && m.nearOverflowRatio >= NEAR_OVERFLOW) {
    push("close_to_overflow", "warning", "resume", null, "Content nearly fills the page and may overflow.", `${Math.round(m.nearOverflowRatio * 100)}`);
  }
  for (const s of sections) {
    const es = entriesBySection.get(s.id) ?? [];
    if (es.length === 0) {
      push("empty_section", "warning", "section", s.id, `Section "${s.title}" is empty.`, "empty");
    }
    if (es.length > TOO_MANY_ENTRIES) {
      push("too_many_entries", "suggestion", "section", s.id, `Section "${s.title}" has ${es.length} entries.`, `${es.length}`);
    }
  }
  for (const e of entries) {
    const layout = sectionById.get(e.section_id)?.layout_kind;
    const es = bulletsByEntry.get(e.id) ?? [];
    if (layout === "entry" && es.length === 0) {
      push("entry_without_bullets", "warning", "entry", e.id, "This entry has no bullet points.", "none");
    }
    if (es.length > TOO_MANY_BULLETS) {
      push("too_many_bullets", "suggestion", "entry", e.id, `This entry has ${es.length} bullets.`, `${es.length}`);
    }
    if (e.end_date && !e.start_date) {
      push("inconsistent_dates", "warning", "entry", e.id, "This entry has an end date but no start date.", "end_only");
    }
  }
  for (const b of bullets) {
    const lines = m.bulletLineCounts[b.id];
    if (typeof lines === "number" && lines > MAX_BULLET_LINES) {
      push("long_bullet", "warning", "bullet", b.id, `This bullet spans ${lines} lines (over ${MAX_BULLET_LINES}).`, `${lines}`);
    }
  }
  if (header) {
    for (const [field, url] of [
      ["linkedin_url", header.linkedin_url],
      ["github_url", header.github_url],
      ["portfolio_url", header.portfolio_url],
    ] as const) {
      if (url && url.trim() && !isValidHttpUrl(url)) {
        push(`invalid_url_${field}`, "warning", "header", null, `The ${field.replace("_url", "")} link is not a valid URL.`, fnv1a(url));
      }
    }
  }

  // ── Suggestions ─────────────────────────────────────────────────────────────
  if (m.unusedRatio >= EXCESS_UNUSED) {
    push("excess_unused_space", "suggestion", "resume", null, "There is a lot of unused page space.", `${Math.round(m.unusedRatio * 100)}`);
  }
  // Repeated action verbs (first word of each bullet).
  const verbCounts = new Map<string, number>();
  for (const b of bullets) {
    const first = words(b.content)[0];
    if (first) verbCounts.set(first, (verbCounts.get(first) ?? 0) + 1);
  }
  for (const [verb, count] of verbCounts) {
    if (count > 2) {
      push(`repeated_verb_${verb}`, "suggestion", "resume", null, `The action verb "${verb}" is used ${count} times.`, `${count}`);
    }
  }
  // Highly similar bullet pairs.
  const tokenSets = bullets.map((b) => ({ id: b.id, set: new Set(words(b.content)) }));
  const seenPairs = new Set<string>();
  for (let i = 0; i < tokenSets.length; i++) {
    for (let j = i + 1; j < tokenSets.length; j++) {
      if (tokenSets[i].set.size === 0 || tokenSets[j].set.size === 0) continue;
      if (jaccard(tokenSets[i].set, tokenSets[j].set) >= SIMILARITY) {
        const key = [tokenSets[i].id, tokenSets[j].id].sort().join(":");
        if (seenPairs.has(key)) continue;
        seenPairs.add(key);
        push(`similar_bullets_${key}`, "suggestion", "bullet", tokenSets[i].id, "Two bullets are very similar.", key);
      }
    }
  }

  return findings;
}

export const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, suggestion: 2 };

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
