import type { EducationData, SkillsData, StyleSettings, TargetLength } from "@/types/supabase";
import { targetPageLimit } from "./measure";

/**
 * Pre-export checks, classified by how much they should get in the user's way.
 *
 * This is intentionally *not* the same list as the always-on Resume Check
 * panel. Resume Check is advisory while you edit; preflight is the last gate
 * before an immutable version is minted, so it also covers the things that
 * only matter at that moment (is the draft actually saved, can this browser
 * print at all). A pure function of its input — no DOM, no network, no clock.
 */

export type PreflightSeverity = "blocking" | "warning" | "info";

export type PreflightIssue = {
  id: string;
  severity: PreflightSeverity;
  message: string;
  /** What the user should do about it, when that isn't obvious from the message. */
  hint?: string;
};

export type PreflightSaveState = "saved" | "unsaved" | "saving" | "failed" | "conflict";

export type PreflightInput = {
  saveState: PreflightSaveState;
  printSupported: boolean;
  header: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
    linkedin_url: string | null;
    github_url: string | null;
    portfolio_url: string | null;
  } | null;
  resume: {
    target_company: string | null;
    target_role: string | null;
    target_length: TargetLength;
  };
  sections: { id: string; title: string; layout_kind: "entry" | "education" | "skills" }[];
  entries: {
    id: string;
    section_id: string;
    title: string | null;
    organization: string | null;
    education_data: EducationData | null;
    skills_data: SkillsData | null;
    source_block_id: string | null;
    /** True when source_block_id points at a library block that no longer exists. */
    sourceMissing: boolean;
    /** True when the source library block has changes not yet applied. */
    libraryUpdateAvailable: boolean;
  }[];
  bullets: { id: string; entry_id: string; content: string }[];
  style: StyleSettings;
  measurements: { pageCount: number; renderFailed: boolean; bulletLineCounts: Record<string, number> };
};

const LONG_BULLET_LINES = 3;

/** Normalized for duplicate detection: case- and punctuation-insensitive. */
function titleKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function runPreflight(input: PreflightInput): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  const { header, resume, sections, entries, bullets, measurements: m } = input;

  // ── Blocking: the export cannot faithfully represent a saved draft ────────
  if (input.saveState === "conflict") {
    issues.push({
      id: "conflict",
      severity: "blocking",
      message: "This resume was changed somewhere else.",
      hint: "Reload the latest saved version before exporting so the PDF and the saved version match.",
    });
  } else if (input.saveState === "failed") {
    issues.push({
      id: "save_failed",
      severity: "blocking",
      message: "The last change could not be saved.",
      hint: "Retry the save, then run preflight again.",
    });
  } else if (input.saveState === "unsaved" || input.saveState === "saving") {
    issues.push({
      id: "unsaved_changes",
      severity: "blocking",
      message: "There are changes that have not been saved yet.",
      hint: "Export saves them first — this clears itself once the save finishes.",
    });
  }

  if (!input.printSupported) {
    issues.push({
      id: "print_unsupported",
      severity: "blocking",
      message: "This browser cannot open a print dialog.",
      hint: "Use desktop Google Chrome to save a PDF.",
    });
  }

  if (m.renderFailed) {
    issues.push({
      id: "render_failed",
      severity: "blocking",
      message: "The resume preview could not be rendered.",
    });
  }

  // ── Blocking: the document itself is not exportable ──────────────────────
  if (!header?.full_name?.trim()) {
    issues.push({ id: "missing_full_name", severity: "blocking", message: "The resume has no full name." });
  }

  const hasContact = Boolean(
    header?.email?.trim() ||
      header?.phone?.trim() ||
      header?.linkedin_url?.trim() ||
      header?.github_url?.trim() ||
      header?.portfolio_url?.trim(),
  );
  if (!hasContact) {
    issues.push({
      id: "missing_contact",
      severity: "blocking",
      message: "The resume has no contact method.",
      hint: "Add an email, phone number, or profile link to the header.",
    });
  }

  if (sections.length === 0 || entries.length === 0) {
    issues.push({
      id: "empty_resume",
      severity: "blocking",
      message: "The resume has no content to export.",
    });
  }

  // ── Warnings: exportable, but worth a second look ────────────────────────
  const entriesBySection = new Map<string, typeof entries>();
  for (const e of entries) {
    const list = entriesBySection.get(e.section_id) ?? [];
    list.push(e);
    entriesBySection.set(e.section_id, list);
  }

  for (const s of sections) {
    if ((entriesBySection.get(s.id) ?? []).length === 0) {
      issues.push({ id: `empty_section:${s.id}`, severity: "warning", message: `Section "${s.title}" is empty.` });
    }
  }

  const seenTitles = new Map<string, string>();
  for (const s of sections) {
    const key = titleKey(s.title);
    if (key === "") continue;
    const first = seenTitles.get(key);
    if (first !== undefined) {
      issues.push({
        id: `duplicate_section_title:${s.id}`,
        severity: "warning",
        message: `Two sections are both called "${s.title}".`,
      });
    } else {
      seenTitles.set(key, s.id);
    }
  }

  const sectionById = new Map(sections.map((s) => [s.id, s]));
  for (const e of entries) {
    const layout = sectionById.get(e.section_id)?.layout_kind;

    if (layout === "entry" && !e.title?.trim()) {
      issues.push({ id: `empty_entry_title:${e.id}`, severity: "warning", message: "An entry has no title." });
    }

    if (layout === "education") {
      if (!e.title?.trim()) {
        issues.push({
          id: `missing_education_institution:${e.id}`,
          severity: "warning",
          message: "An education entry has no institution.",
        });
      }
      if (!e.education_data?.degree?.trim()) {
        issues.push({
          id: `missing_education_degree:${e.id}`,
          severity: "warning",
          message: `Education entry "${e.title?.trim() || "Untitled"}" has no degree.`,
        });
      }
    }

    if (layout === "skills") {
      const categories = e.skills_data?.categories ?? [];
      if (categories.length === 0) {
        issues.push({ id: `empty_skills:${e.id}`, severity: "warning", message: "A skills section has no categories." });
      }
      for (const [i, cat] of categories.entries()) {
        if (cat.items.length === 0) {
          issues.push({
            id: `empty_skills_category:${e.id}:${i}`,
            severity: "warning",
            message: `Skills category "${cat.label || "Untitled"}" has no items.`,
          });
        }
      }
    }

    if (e.sourceMissing) {
      issues.push({
        id: `orphaned_source:${e.id}`,
        severity: "warning",
        message: `"${e.title?.trim() || e.organization?.trim() || "An entry"}" refers to a library block that no longer exists.`,
        hint: "The entry itself is unaffected — only the link back to the library is gone.",
      });
    }
    if (e.libraryUpdateAvailable) {
      issues.push({
        id: `library_update:${e.id}`,
        severity: "warning",
        message: `"${e.title?.trim() || e.organization?.trim() || "An entry"}" has unapplied library changes.`,
      });
    }
  }

  for (const b of bullets) {
    const lines = m.bulletLineCounts[b.id];
    if (typeof lines === "number" && lines > LONG_BULLET_LINES) {
      issues.push({
        id: `long_bullet:${b.id}`,
        severity: "warning",
        message: `A bullet runs to ${lines} lines.`,
      });
    }
  }

  const limit = targetPageLimit(resume.target_length);
  if (limit !== null && m.pageCount > limit) {
    issues.push({
      id: "target_length_exceeded",
      severity: "warning",
      message: `The resume is ${m.pageCount} pages but the target is ${limit} page${limit > 1 ? "s" : ""}.`,
    });
  }

  if (!resume.target_company?.trim()) {
    issues.push({ id: "missing_target_company", severity: "warning", message: "No target company is set on this resume." });
  }
  if (!resume.target_role?.trim()) {
    issues.push({ id: "missing_target_role", severity: "warning", message: "No target role is set on this resume." });
  }

  // ── Informational ────────────────────────────────────────────────────────
  issues.push({
    id: "page_count",
    severity: "info",
    message: `The resume renders as ${m.pageCount} page${m.pageCount === 1 ? "" : "s"}.`,
  });
  issues.push({
    id: "browser_filename",
    severity: "info",
    message: "Your browser decides the final saved filename — the suggested name only pre-fills the dialog.",
  });

  return issues;
}

export function countBySeverity(issues: PreflightIssue[]): Record<PreflightSeverity, number> {
  return {
    blocking: issues.filter((i) => i.severity === "blocking").length,
    warning: issues.filter((i) => i.severity === "warning").length,
    info: issues.filter((i) => i.severity === "info").length,
  };
}

export function hasBlockingIssues(issues: PreflightIssue[]): boolean {
  return issues.some((i) => i.severity === "blocking");
}
