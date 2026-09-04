"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RotateCcw, Eye, GitCompare, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getVersion, listVersionSummaries, type VersionSummary } from "@/lib/resume/versions";
import { parseSnapshot, draftToComparable, type ParsedSnapshot } from "@/lib/resume/snapshot";
import { compareSnapshots } from "@/lib/resume/version-compare";
import type { VersionType } from "@/lib/resume/types";
import { useEditor } from "./useEditorController";
import { SnapshotViewer } from "./SnapshotViewer";
import { VersionCompareView } from "./VersionCompareView";

const TYPE_LABEL: Record<VersionType, string> = {
  manual: "Checkpoint",
  exported: "Exported",
  submitted: "Submitted",
};

const TYPE_CLASS: Record<VersionType, string> = {
  manual: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  exported: "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  submitted: "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300",
};

type Mode =
  | { kind: "list" }
  | { kind: "view"; versionId: string }
  | { kind: "compare"; leftId: string | "draft"; rightId: string };

/**
 * Version history. Snapshots are fetched one at a time on demand — the list
 * itself is metadata only, so opening this dialog never pulls every stored
 * snapshot into the browser.
 */
export function VersionHistoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const { draft, restoreFromVersion, saveStatus, conflict } = useEditor();

  const [versions, setVersions] = useState<VersionSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [snapshots, setSnapshots] = useState<Record<string, ParsedSnapshot>>({});
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<VersionSummary | null>(null);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [compareLeft, setCompareLeft] = useState<string>("draft");

  useEffect(() => {
    let cancelled = false;
    listVersionSummaries(supabase, draft.resume.id)
      .then((rows) => {
        if (!cancelled) setVersions(rows);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Version history could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, draft.resume.id]);

  const loadSnapshot = useCallback(
    async (versionId: string): Promise<ParsedSnapshot | null> => {
      const cached = snapshots[versionId];
      if (cached) return cached;
      setSnapshotError(null);
      const row = await getVersion(supabase, versionId);
      if (!row) {
        setSnapshotError("That version could not be loaded.");
        return null;
      }
      const parsed = parseSnapshot(row.snapshot);
      if (!parsed.ok) {
        setSnapshotError(parsed.error);
        return null;
      }
      setSnapshots((prev) => ({ ...prev, [versionId]: parsed.snapshot }));
      return parsed.snapshot;
    },
    [snapshots, supabase],
  );

  const draftComparable = useMemo(
    () =>
      draftToComparable({
        resume: draft.resume,
        header: draft.header,
        sections: draft.sections,
        entries: draft.entries,
        bullets: draft.bullets,
      }),
    [draft],
  );

  const openView = async (versionId: string) => {
    setBusy(true);
    const snap = await loadSnapshot(versionId);
    setBusy(false);
    if (snap) setMode({ kind: "view", versionId });
  };

  const openCompare = async (rightId: string) => {
    setBusy(true);
    const right = await loadSnapshot(rightId);
    const left = compareLeft === "draft" ? draftComparable : await loadSnapshot(compareLeft);
    setBusy(false);
    if (right && left) setMode({ kind: "compare", leftId: compareLeft, rightId });
  };

  const handleRestore = async () => {
    if (!restoreTarget || busy) return;
    setBusy(true);
    setRestoreMessage(null);
    const result = await restoreFromVersion(restoreTarget.id);
    setBusy(false);
    if (result.ok) {
      setRestoreMessage(`Restored from version ${restoreTarget.version_number}. Every version was kept.`);
      setRestoreTarget(null);
      // The restore created a new draft revision, so previously loaded
      // comparisons against "current draft" are stale.
      setMode({ kind: "list" });
    } else {
      setRestoreMessage(result.message);
    }
  };

  // Restoring overwrites the draft body, so it must not race an unsaved edit.
  const restoreBlocked = conflict || saveStatus === "unsaved" || saveStatus === "saving" || saveStatus === "failed";

  const body = () => {
    if (mode.kind === "view") {
      const snap = snapshots[mode.versionId];
      return (
        <div className="flex flex-col gap-3">
          <Button variant="ghost" size="sm" className="self-start" onClick={() => setMode({ kind: "list" })}>
            ← Back to all versions
          </Button>
          {snap ? <SnapshotViewer snapshot={snap} /> : <p className="text-sm text-gray-500">Loading…</p>}
        </div>
      );
    }

    if (mode.kind === "compare") {
      const right = snapshots[mode.rightId];
      const left = mode.leftId === "draft" ? draftComparable : snapshots[mode.leftId];
      const leftLabel =
        mode.leftId === "draft"
          ? "current draft"
          : `version ${versions?.find((v) => v.id === mode.leftId)?.version_number ?? "?"}`;
      const rightLabel = `version ${versions?.find((v) => v.id === mode.rightId)?.version_number ?? "?"}`;
      return (
        <div className="flex flex-col gap-3">
          <Button variant="ghost" size="sm" className="self-start" onClick={() => setMode({ kind: "list" })}>
            ← Back to all versions
          </Button>
          {left && right ? (
            <VersionCompareView diff={compareSnapshots(left, right)} beforeLabel={leftLabel} afterLabel={rightLabel} />
          ) : (
            <p className="text-sm text-gray-500">Loading…</p>
          )}
        </div>
      );
    }

    if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;
    if (versions === null) {
      return (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading versions…
        </p>
      );
    }
    if (versions.length === 0) {
      return (
        <p className="text-sm text-gray-500">
          No versions yet. Use “Save checkpoint” to record the resume as it stands, or export it — an exported version
          is created automatically before printing.
        </p>
      );
    }

    return (
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 text-xs text-gray-500">
          Compare against
          <select
            value={compareLeft}
            onChange={(e) => setCompareLeft(e.target.value)}
            className="rounded-md border border-gray-200 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="draft">Current draft</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                Version {v.version_number}
              </option>
            ))}
          </select>
        </label>

        <ul className="flex flex-col gap-1.5">
          {versions.map((v) => {
            const snap = snapshots[v.id];
            return (
              <li key={v.id} className="rounded-md border border-gray-100 p-2.5 dark:border-gray-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                      Version {v.version_number}
                      <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${TYPE_CLASS[v.version_type]}`}>
                        {TYPE_LABEL[v.version_type]}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(v.created_at).toLocaleString()}
                      {snap?.draftRevision !== null && snap?.draftRevision !== undefined
                        ? ` · draft revision ${snap.draftRevision}`
                        : ""}
                      {snap?.resume.target_company || snap?.resume.target_role
                        ? ` · ${[snap?.resume.target_company, snap?.resume.target_role].filter(Boolean).join(" / ")}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => void openView(v.id)}>
                      <Eye className="h-3 w-3" /> View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      disabled={compareLeft === v.id}
                      onClick={() => void openCompare(v.id)}
                    >
                      <GitCompare className="h-3 w-3" /> Compare
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      disabled={restoreBlocked}
                      title={restoreBlocked ? "Save or reload your current changes first." : undefined}
                      onClick={() => setRestoreTarget(v)}
                    >
                      <RotateCcw className="h-3 w-3" /> Restore
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="flex items-center gap-1.5 text-xs text-gray-400">
          <Lock className="h-3 w-3" /> Versions are immutable — they cannot be edited or deleted, including by a
          restore.
        </p>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] min-w-0 overflow-hidden p-0 sm:max-w-[min(96vw,70rem)]">
        <DialogHeader className="border-b px-5 py-4 pr-12">
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>
            Immutable snapshots of this resume. View one, compare it against the current draft or another version, or
            restore the draft from it.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 overflow-y-auto px-5 pb-5">
          {snapshotError && (
            <p role="alert" className="mt-4 text-sm text-red-600">
              {snapshotError}
            </p>
          )}
          {restoreMessage && (
            <p role="status" aria-live="polite" className="mt-4 rounded-md bg-muted px-3 py-2 text-sm">
              {restoreMessage}
            </p>
          )}

          <div className="pt-4">{body()}</div>

          {restoreTarget && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              Restore the draft from version {restoreTarget.version_number}?
            </p>
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
              This replaces the current header, sections, entries, bullets, style settings and target length with that
              version&apos;s content, in one atomic operation. Every saved version is kept. Entries restored this way
              are no longer linked to a library block.
            </p>
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setRestoreTarget(null)} disabled={busy}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void handleRestore()} disabled={busy}>
                {busy ? "Restoring…" : "Restore"}
              </Button>
            </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
