"use client";

import { useCallback, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { setApplicationResumeVersion, findTargetMismatches } from "@/lib/resume/applications";
import { describeRpcError } from "@/lib/resume/rpc";
import { runPreflight, hasBlockingIssues, type PreflightIssue } from "@/lib/resume/preflight";
import { useEditor } from "./useEditorController";
import { useMeasurements } from "./MeasurementContext";
import { buildPreflightEntries } from "./preflight-input";

export type SubmitTargetApplication = {
  id: string;
  company: string;
  role: string;
  submitted_resume_version_id: string | null;
};

type Phase = "idle" | "working" | "blocked" | "confirm_replace" | "done" | "failed";

/**
 * The submit half of the application flow, shown in the editor when it was
 * opened from an application.
 *
 * Order matters and is the same as export, minus the printing: save → preflight
 * → create a `submitted` immutable version → attach that version. The version
 * is created before the association, so an application can never point at
 * something that does not exist, and an existing association is never replaced
 * without an explicit confirmation.
 */
export function SubmitForApplicationPanel({ application }: { application: SubmitTargetApplication }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const { draft, library, style, saveStatus, conflict, hasUnsavedChanges, flushPendingSaves, createVersion } =
    useEditor();
  const { measurements } = useMeasurements();

  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [issues, setIssues] = useState<PreflightIssue[]>([]);
  const [createdVersion, setCreatedVersion] = useState<{ id: string; number: number } | null>(null);

  const mismatches = findTargetMismatches(
    { company: application.company, role: application.role },
    { target_company: draft.resume.target_company, target_role: draft.resume.target_role },
  );

  const attach = useCallback(
    async (versionId: string, confirmReplace: boolean) => {
      const result = await setApplicationResumeVersion(supabase, application.id, versionId, confirmReplace);
      if (result.ok) {
        setPhase("done");
        setMessage("This application now records that exact version.");
        return;
      }
      if (result.reason === "replacement_not_confirmed") {
        setPhase("confirm_replace");
        setMessage(null);
        return;
      }
      setPhase("failed");
      setMessage(describeRpcError(result.reason));
    },
    [supabase, application.id],
  );

  const run = useCallback(async () => {
    if (phase === "working") return; // double-submit guard
    setPhase("working");
    setMessage(null);
    setIssues([]);

    const flushed = await flushPendingSaves();
    if (!flushed) {
      setPhase("failed");
      setMessage("Your changes could not be saved, so no submitted version was created.");
      return;
    }

    const fresh = runPreflight({
      saveState: "saved",
      // Printing is not part of this flow, so print support must not block it.
      printSupported: true,
      header: draft.header,
      resume: {
        target_company: draft.resume.target_company,
        target_role: draft.resume.target_role,
        target_length: draft.resume.target_length,
      },
      sections: draft.sections.map((s) => ({ id: s.id, title: s.title, layout_kind: s.layout_kind })),
      entries: buildPreflightEntries(draft, library),
      bullets: draft.bullets.map((b) => ({ id: b.id, entry_id: b.entry_id, content: b.content })),
      style,
      measurements,
    });
    setIssues(fresh);
    if (hasBlockingIssues(fresh)) {
      setPhase("blocked");
      setMessage("Fix the blocking issues before creating a submitted version.");
      return;
    }

    const version = await createVersion("submitted");
    if (!version.ok) {
      setPhase("failed");
      setMessage(version.message);
      return;
    }
    setCreatedVersion({ id: version.versionId, number: version.versionNumber });
    await attach(version.versionId, false);
  }, [phase, flushPendingSaves, draft, library, style, measurements, createVersion, attach]);

  const blocked = conflict || saveStatus === "failed";
  const blockingIssues = issues.filter((i) => i.severity === "blocking");

  return (
    <div className="border-b border-blue-100 bg-blue-50 px-4 py-3 text-sm print:hidden dark:border-blue-900 dark:bg-blue-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-blue-900 dark:text-blue-200">
            Submitting this resume for {application.company} — {application.role}
          </p>
          <p className="text-xs text-blue-800 dark:text-blue-300">
            Saves your changes, runs preflight, records an immutable submitted version, and attaches that version to
            the application.
          </p>
        </div>
        <Button
          size="sm"
          className="shrink-0 gap-1.5"
          disabled={phase === "working" || blocked}
          onClick={() => void run()}
        >
          <Send className="h-3.5 w-3.5" />
          {phase === "working" ? "Working…" : "Create submitted version"}
        </Button>
      </div>

      {mismatches.length > 0 && phase !== "done" && (
        <div className="mt-2 rounded-md bg-amber-100 px-2.5 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <p className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-3.5 w-3.5" /> The resume&apos;s target does not match this application
          </p>
          <ul className="mt-0.5">
            {mismatches.map((m) => (
              <li key={m.field}>
                {m.field === "company" ? "Company" : "Role"}: application says{" "}
                <span className="font-medium">{m.applicationValue}</span>, resume targets{" "}
                <span className="font-medium">{m.resumeValue ?? "nothing"}</span>.
              </li>
            ))}
          </ul>
          <p className="mt-0.5">
            Nothing is rewritten either way — continue if that is intentional, or edit the resume details first.
          </p>
        </div>
      )}

      {hasUnsavedChanges && phase === "idle" && (
        <p className="mt-2 text-xs text-blue-800 dark:text-blue-300">
          You have unsaved changes; they will be saved first.
        </p>
      )}

      {blockingIssues.length > 0 && (
        <ul role="alert" className="mt-2 rounded-md bg-red-50 px-2.5 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          {blockingIssues.map((i) => (
            <li key={i.id}>{i.message}</li>
          ))}
        </ul>
      )}

      {message && (
        <p
          role="status"
          aria-live="polite"
          className={`mt-2 flex items-center gap-1.5 text-xs ${
            phase === "done" ? "text-green-800 dark:text-green-300" : "text-red-700 dark:text-red-300"
          }`}
        >
          {phase === "done" && <CheckCircle2 className="h-3.5 w-3.5" />}
          {message}
          {phase === "done" && createdVersion ? ` (version ${createdVersion.number})` : ""}
        </p>
      )}

      {phase === "confirm_replace" && createdVersion && (
        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs dark:border-amber-900 dark:bg-amber-950">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            This application already has a submitted version attached.
          </p>
          <p className="mt-0.5 text-amber-800 dark:text-amber-300">
            Version {createdVersion.number} was created and kept. Replace the attached version with it? The previous
            version is not deleted.
          </p>
          <div className="mt-1.5 flex justify-end gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setPhase("idle")}>
              Keep the existing link
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={() => void attach(createdVersion.id, true)}>
              Replace
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
