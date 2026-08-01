"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, Info, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getVersion } from "@/lib/resume/versions";
import { parseSnapshot, type ParsedSnapshot } from "@/lib/resume/snapshot";
import { buildExportFilename } from "@/lib/resume/filename";
import { runPreflight, hasBlockingIssues, type PreflightIssue, type PreflightSaveState, type PreflightSeverity } from "@/lib/resume/preflight";
import {
  exportReducer,
  INITIAL_EXPORT_CONTEXT,
  isExportInFlight,
  EXPORT_STATE_LABEL,
} from "@/lib/resume/export-machine";
import { useEditor } from "./useEditorController";
import { useMeasurements } from "./MeasurementContext";
import { PrintDocument } from "./PrintDocument";
import { buildPreflightEntries } from "./preflight-input";

const FONT_TIMEOUT_MS = 5000;
const PREPARE_TIMEOUT_MS = 8000;

const SEVERITY_META: Record<PreflightSeverity, { icon: typeof AlertCircle; label: string; className: string }> = {
  blocking: { icon: AlertCircle, label: "Must fix before exporting", className: "text-red-600" },
  warning: { icon: AlertTriangle, label: "Worth checking", className: "text-amber-600" },
  info: { icon: Info, label: "For information", className: "text-blue-600" },
};

/**
 * Export flow. The ordering the whole feature rests on:
 *
 *   save → preflight → create the `exported` version → render *that snapshot*
 *   → wait for fonts → set the title → print → restore the title
 *
 * The version is minted before printing, never after, and the printed document
 * is built from the version's own snapshot rather than from editor state, so
 * the PDF and the immutable record cannot drift apart.
 */
export function ExportDialog({
  open,
  onOpenChange,
  userId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const {
    draft,
    library,
    style,
    saveStatus,
    conflict,
    hasUnsavedChanges,
    flushPendingSaves,
    currentRevision,
    createVersion,
  } = useEditor();
  const { measurements } = useMeasurements();

  const [ctx, dispatch] = useReducer(exportReducer, INITIAL_EXPORT_CONTEXT);
  const [printSnapshot, setPrintSnapshot] = useState<ParsedSnapshot | null>(null);
  // While a run is in flight the list is pinned to the results the run was
  // authorised against, so the panel cannot change under the user mid-export.
  const [pinnedIssues, setPinnedIssues] = useState<PreflightIssue[] | null>(null);
  const previousTitle = useRef<string | null>(null);
  void userId;

  const printSupported = typeof window !== "undefined" && typeof window.print === "function";

  const saveState: PreflightSaveState = conflict
    ? "conflict"
    : saveStatus === "failed"
      ? "failed"
      : saveStatus === "saving"
        ? "saving"
        : hasUnsavedChanges
          ? "unsaved"
          : "saved";

  const preflightInput = useMemo(
    () => ({
      saveState,
      printSupported,
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
    }),
    [saveState, printSupported, draft, library, style, measurements],
  );

  // Live preflight while nothing is running, so the panel is informative
  // before the user commits to anything. Derived rather than stored: an effect
  // that called setState here would re-render on every keystroke upstream.
  const liveIssues = useMemo(() => runPreflight(preflightInput), [preflightInput]);
  const issues = pinnedIssues ?? liveIssues;

  const suggestedFilename = useMemo(
    () =>
      buildExportFilename({
        fullName: draft.header?.full_name,
        company: draft.resume.target_company,
        role: draft.resume.target_role,
      }),
    [draft.header?.full_name, draft.resume.target_company, draft.resume.target_role],
  );

  // A change landing mid-run would desynchronise the printed page from the
  // minted version, so the run is abandoned rather than repaired.
  const runRevision = useRef<number | null>(null);
  useEffect(() => {
    if (!isExportInFlight(ctx.state)) return;
    if (conflict) dispatch({ type: "CONFLICT" });
  }, [conflict, ctx.state]);

  const runExport = useCallback(async () => {
    if (isExportInFlight(ctx.state)) return; // double-click guard
    dispatch({ type: "START" });
    setPinnedIssues(null);

    // 1–3. Save anything pending and confirm no write is still in flight.
    const flushed = await flushPendingSaves();
    if (!flushed) {
      dispatch({ type: "SAVE_FAILED", message: "Your changes could not be saved, so the export was stopped." });
      return;
    }
    dispatch({ type: "SAVE_OK" });

    // 4–5. Re-run preflight against the now-saved state.
    const fresh = runPreflight({ ...preflightInput, saveState: "saved" });
    setPinnedIssues(fresh);
    if (hasBlockingIssues(fresh)) {
      dispatch({ type: "PREFLIGHT_BLOCKED", message: "Fix the blocking issues below, then export again." });
      return;
    }
    const revision = currentRevision();
    runRevision.current = revision;
    dispatch({ type: "PREFLIGHT_CLEAR", revision });

    // 6. Mint the immutable exported version — before printing, never after.
    const version = await createVersion("exported");
    if (!version.ok) {
      if (version.conflict) dispatch({ type: "CONFLICT" });
      else dispatch({ type: "VERSION_FAILED", message: version.message });
      return;
    }
    dispatch({ type: "VERSION_CREATED", versionId: version.versionId, versionNumber: version.versionNumber });

    // 7. Render exactly that version's snapshot.
    const row = await getVersion(supabase, version.versionId);
    const parsed = row ? parseSnapshot(row.snapshot) : null;
    if (!parsed || !parsed.ok) {
      dispatch({
        type: "VERSION_FAILED",
        message: "The exported version was created, but its stored data could not be read back for printing.",
      });
      return;
    }
    setPrintSnapshot(parsed.snapshot);

    // 8. Wait for the font and for the portal to lay out. Both are bounded —
    // a font that never resolves must not hang the flow forever.
    try {
      await withTimeout(document.fonts?.ready ?? Promise.resolve(), FONT_TIMEOUT_MS);
    } catch {
      dispatch({ type: "PREPARE_TIMEOUT", reason: "fonts_timeout" });
      return;
    }
    try {
      await withTimeout(nextFrames(2), PREPARE_TIMEOUT_MS);
    } catch {
      dispatch({ type: "PREPARE_TIMEOUT", reason: "prepare_timeout" });
      return;
    }

    if (runRevision.current !== currentRevision()) {
      dispatch({ type: "REVISION_CHANGED" });
      return;
    }
    dispatch({ type: "PREPARED" });
  }, [ctx.state, flushPendingSaves, preflightInput, currentRevision, createVersion, supabase]);

  // 9–12. Print, then always put the title back.
  useEffect(() => {
    if (ctx.state !== "printing" || !printSnapshot) return;
    if (!printSupported) {
      dispatch({ type: "PRINT_UNSUPPORTED" });
      return;
    }
    previousTitle.current = document.title;
    document.body.classList.add("resume-printing");
    document.title = suggestedFilename;
    try {
      window.print();
      dispatch({ type: "PRINT_OPENED" });
    } catch {
      dispatch({ type: "PRINT_UNSUPPORTED" });
    } finally {
      document.title = previousTitle.current ?? document.title;
      previousTitle.current = null;
      document.body.classList.remove("resume-printing");
    }
  }, [ctx.state, printSnapshot, printSupported, suggestedFilename]);

  // Safety net: if the component unmounts mid-print the title and body class
  // must not be left in the print state.
  useEffect(
    () => () => {
      if (previousTitle.current !== null) document.title = previousTitle.current;
      document.body.classList.remove("resume-printing");
    },
    [],
  );

  const grouped: Record<PreflightSeverity, PreflightIssue[]> = {
    blocking: issues.filter((i) => i.severity === "blocking"),
    warning: issues.filter((i) => i.severity === "warning"),
    info: issues.filter((i) => i.severity === "info"),
  };
  const blocked = grouped.blocking.length > 0;
  const busy = isExportInFlight(ctx.state);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Closing mid-run would orphan the print document, so the dialog stays
        // put until the run finishes one way or another.
        if (busy) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export to PDF</DialogTitle>
          <DialogDescription>
            Your changes are saved, an immutable “exported” version is recorded, and then your browser&apos;s print
            dialog opens. Choose “Save as PDF” there. Use desktop Google Chrome for reliable Letter-size output.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-1">
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin text-gray-500" />}
            <span className="text-gray-700 dark:text-gray-300">{EXPORT_STATE_LABEL[ctx.state]}</span>
            {ctx.versionNumber !== null && (
              <span className="text-xs text-gray-500">· version {ctx.versionNumber} recorded</span>
            )}
          </div>

          {ctx.message && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {ctx.message}
            </p>
          )}

          {ctx.state === "completed" && (
            <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
              The print dialog was opened and version {ctx.versionNumber} was recorded. Whether a file was actually
              saved is up to you and your browser — a web page cannot tell.
            </p>
          )}

          <div>
            <p className="text-xs text-gray-500">Suggested filename</p>
            <p className="font-mono text-sm text-gray-800 dark:text-gray-200">{suggestedFilename}.pdf</p>
            <p className="mt-0.5 text-xs text-gray-400">
              Your browser fills its save dialog from the page title and controls the final name.
            </p>
          </div>

          <section aria-label="Preflight results" className="flex flex-col gap-3">
            {(["blocking", "warning", "info"] as PreflightSeverity[]).map((sev) => {
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
                    {items.map((issue) => (
                      <li
                        key={issue.id}
                        className="rounded-md border border-gray-100 px-2.5 py-1.5 text-sm dark:border-gray-800"
                      >
                        <p className="text-gray-700 dark:text-gray-300">{issue.message}</p>
                        {issue.hint && <p className="text-xs text-gray-500">{issue.hint}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Close
            </Button>
            <Button onClick={() => void runExport()} disabled={busy || (blocked && ctx.state !== "idle")} className="gap-1.5">
              <Printer className="h-4 w-4" />
              {ctx.state === "completed" ? "Export again" : "Save PDF"}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Mounted only from the exported version's own snapshot. */}
      {printSnapshot && <PrintDocument snapshot={printSnapshot} />}
    </Dialog>
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** Resolve after N animation frames, so the portal has actually laid out. */
function nextFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    let remaining = count;
    const step = () => {
      remaining -= 1;
      if (remaining <= 0) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
