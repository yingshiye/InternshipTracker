"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, ChevronDown, ChevronRight, Lightbulb, MapPin, Wand2, X } from "lucide-react";
import { useEditor } from "./useEditorController";
import { useMeasurements } from "./MeasurementContext";
import { useDismissedFindings } from "./useDismissedFindings";
import { runResumeCheck, sortFindings, type Finding, type Severity } from "@/lib/resume/check";
import { buildPreflightEntries } from "./preflight-input";

const SEVERITY_META: Record<Severity, { icon: typeof AlertCircle; label: string; className: string }> = {
  error: { icon: AlertCircle, label: "Errors", className: "text-red-600" },
  warning: { icon: AlertTriangle, label: "Warnings", className: "text-amber-600" },
  suggestion: { icon: Lightbulb, label: "Suggestions", className: "text-blue-600" },
};

export function ResumeCheckPanel({ userId }: { userId: string }) {
  const { draft, library, style, setStyle } = useEditor();
  const { measurements } = useMeasurements();
  const { isDismissed, dismiss, pruneTo, restoreAll, dismissedCount } = useDismissedFindings(userId, draft.resume.id);
  const [collapsed, setCollapsed] = useState(false);

  // The library-derived flags (orphaned source, unapplied update) are computed
  // once here from the in-memory library rather than per rule.
  const libraryFlags = useMemo(() => {
    const map = new Map<string, { sourceMissing: boolean; libraryUpdateAvailable: boolean }>();
    for (const e of buildPreflightEntries(draft, library)) {
      map.set(e.id, { sourceMissing: e.sourceMissing, libraryUpdateAvailable: e.libraryUpdateAvailable });
    }
    return map;
  }, [draft, library]);

  const findings = useMemo(() => {
    const sections = draft.sections.map((s) => ({ id: s.id, title: s.title, layout_kind: s.layout_kind }));
    const entries = draft.entries.map((e) => ({
      id: e.id, section_id: e.section_id, title: e.title, organization: e.organization,
      start_date: e.start_date, end_date: e.end_date, education_data: e.education_data, skills_data: e.skills_data,
      source_block_id: e.source_block_id,
      sourceMissing: libraryFlags.get(e.id)?.sourceMissing ?? false,
      libraryUpdateAvailable: libraryFlags.get(e.id)?.libraryUpdateAvailable ?? false,
    }));
    const bullets = draft.bullets.map((b) => ({ id: b.id, entry_id: b.entry_id, content: b.content }));
    const header = draft.header
      ? {
          full_name: draft.header.full_name, email: draft.header.email,
          linkedin_url: draft.header.linkedin_url, github_url: draft.header.github_url, portfolio_url: draft.header.portfolio_url,
        }
      : null;
    return sortFindings(
      runResumeCheck({ header, sections, entries, bullets, style, targetLength: draft.resume.target_length, measurements }),
    );
  }, [draft, style, measurements, libraryFlags]);

  // Prune stored dismissals down to currently-active fingerprints.
  useEffect(() => {
    pruneTo(new Set(findings.map((f) => f.fingerprint)));
  }, [findings, pruneTo]);

  const visible = findings.filter((f) => !isDismissed(f.fingerprint));
  const grouped: Record<Severity, Finding[]> = {
    error: visible.filter((f) => f.severity === "error"),
    warning: visible.filter((f) => f.severity === "warning"),
    suggestion: visible.filter((f) => f.severity === "suggestion"),
  };

  const locate = (finding: Finding) => {
    if (!finding.targetId) return;
    const el =
      document.querySelector(`[data-entry-id="${finding.targetId}"]`) ??
      document.querySelector(`[data-bullet-id="${finding.targetId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      (el as HTMLElement).animate([{ background: "rgba(250,204,21,0.35)" }, { background: "transparent" }], { duration: 1200 });
    }
  };

  const fix = (finding: Finding) => {
    if (finding.ruleId === "small_body_font") setStyle({ body_font_size_pt: 10 });
    else if (finding.ruleId === "small_margins") setStyle({ margin_in: 0.5 });
  };

  return (
    <div className="flex flex-1 flex-col p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-1 text-sm font-medium text-gray-900 dark:text-gray-100"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          Resume Check
          {collapsed && visible.length > 0 && <span className="text-xs font-normal text-gray-400">({visible.length})</span>}
        </button>
        {dismissedCount > 0 && (
          <button type="button" onClick={restoreAll} className="text-xs text-gray-400 hover:text-gray-600">
            Restore {dismissedCount} dismissed
          </button>
        )}
      </div>

      {!collapsed && (visible.length === 0 ? (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">No issues found.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {(["error", "warning", "suggestion"] as Severity[]).map((sev) => {
            const items = grouped[sev];
            if (items.length === 0) return null;
            const Meta = SEVERITY_META[sev];
            const Icon = Meta.icon;
            return (
              <div key={sev}>
                <p className={`mb-1 flex items-center gap-1.5 text-xs font-medium ${Meta.className}`}>
                  <Icon className="h-3.5 w-3.5" /> {Meta.label} ({items.length})
                </p>
                <ul className="flex flex-col gap-1">
                  {items.map((f) => (
                    <li key={f.id} className="rounded-md border border-gray-100 px-2.5 py-2 text-sm dark:border-gray-800">
                      <p className="text-gray-700 dark:text-gray-300">{f.message}</p>
                      <div className="mt-1 flex items-center gap-2">
                        {f.targetId && (
                          <button type="button" onClick={() => locate(f)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700">
                            <MapPin className="h-3 w-3" /> Locate
                          </button>
                        )}
                        {f.canFix && (
                          <button type="button" onClick={() => fix(f)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700">
                            <Wand2 className="h-3 w-3" /> Fix
                          </button>
                        )}
                        <button type="button" onClick={() => dismiss(f.fingerprint)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700">
                          <X className="h-3 w-3" /> Dismiss
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
