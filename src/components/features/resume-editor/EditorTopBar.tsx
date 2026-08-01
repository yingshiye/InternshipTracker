"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Undo2,
  Redo2,
  Check,
  Loader2,
  CloudOff,
  AlertTriangle,
  RefreshCw,
  Pencil,
  History,
  BookmarkCheck,
  Printer,
  CircleDot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditor } from "./useEditorController";
import { ResumeMetadataDialog } from "./ResumeMetadataDialog";
import { VersionHistoryDialog } from "./VersionHistoryDialog";
import { ExportDialog } from "./ExportDialog";
import type { SaveStatus } from "./editor-types";

const STATUS_LABEL: Record<SaveStatus, string> = {
  idle: "All changes saved",
  unsaved: "Unsaved changes",
  saving: "Saving…",
  saved: "Saved",
  offline: "Offline",
  failed: "Save failed",
  retrying: "Retrying…",
};

function StatusPill({ status }: { status: SaveStatus }) {
  const Icon =
    status === "saving" || status === "retrying"
      ? Loader2
      : status === "offline"
        ? CloudOff
        : status === "failed"
          ? AlertTriangle
          : status === "unsaved"
            ? CircleDot
            : Check;
  const color =
    status === "failed"
      ? "text-red-600"
      : status === "offline" || status === "unsaved"
        ? "text-amber-600"
        : "text-gray-500";
  return (
    <span
      className={`flex items-center gap-1.5 text-xs ${color}`}
      // Save outcomes are announced, not just shown, so a screen-reader user
      // learns that a change persisted without hunting for the pill.
      role="status"
      aria-live="polite"
    >
      <Icon className={`h-3.5 w-3.5 ${status === "saving" || status === "retrying" ? "animate-spin" : ""}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function EditorTopBar({ userId }: { userId: string }) {
  const { draft, saveStatus, canUndo, canRedo, undo, redo, conflict, reconcile, lastError, retryLast, createVersion } =
    useEditor();
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [checkpointBusy, setCheckpointBusy] = useState(false);
  const [checkpointMessage, setCheckpointMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const handleCheckpoint = async () => {
    if (checkpointBusy) return; // a double click must not mint two versions
    setCheckpointBusy(true);
    setCheckpointMessage(null);
    const result = await createVersion("manual");
    setCheckpointMessage(
      result.ok
        ? { ok: true, text: `Checkpoint saved as version ${result.versionNumber}.` }
        : { ok: false, text: result.message },
    );
    setCheckpointBusy(false);
  };

  // A checkpoint records what is on the server, so it is only meaningful once
  // everything is actually there.
  const checkpointBlocked =
    conflict || saveStatus === "unsaved" || saveStatus === "saving" || saveStatus === "failed";

  return (
    <div className="flex flex-col border-b border-gray-100 print:hidden dark:border-gray-800">
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/resumes"
            className="rounded text-gray-500 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 dark:hover:text-gray-100"
            aria-label="Back to resumes"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                {draft.resume.name}
              </span>
              <button
                type="button"
                onClick={() => setMetadataOpen(true)}
                aria-label="Edit resume name, target company and role"
                className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-1 dark:hover:bg-gray-800"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
            <p className="truncate text-xs text-gray-400">
              {draft.resume.target_company || draft.resume.target_role
                ? [draft.resume.target_company, draft.resume.target_role].filter(Boolean).join(" · ")
                : "No target company or role set"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={saveStatus} />
          {saveStatus === "failed" && !conflict && (
            <Button variant="outline" size="sm" onClick={retryLast} className="h-7 gap-1 text-xs">
              <RefreshCw className="h-3 w-3" /> Retry
            </Button>
          )}
          <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void undo()}
            disabled={!canUndo || conflict}
            aria-label="Undo"
            className="h-8 w-8 p-0"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void redo()}
            disabled={!canRedo || conflict}
            aria-label="Redo"
            className="h-8 w-8 p-0"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleCheckpoint()}
            disabled={checkpointBusy || checkpointBlocked}
            className="h-8 gap-1.5 text-xs"
            title={checkpointBlocked ? "Save your changes first — a checkpoint records the saved resume." : undefined}
          >
            <BookmarkCheck className="h-3.5 w-3.5" /> Save checkpoint
          </Button>
          <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)} className="h-8 gap-1.5 text-xs">
            <History className="h-3.5 w-3.5" /> Version history
          </Button>
          <Button size="sm" onClick={() => setExportOpen(true)} className="h-8 gap-1.5 text-xs">
            <Printer className="h-3.5 w-3.5" /> Export PDF
          </Button>
        </div>
      </div>

      {checkpointMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-center justify-between gap-3 px-4 py-1.5 text-xs ${
            checkpointMessage.ok
              ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300"
              : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
          }`}
        >
          <span>{checkpointMessage.text}</span>
          <button type="button" onClick={() => setCheckpointMessage(null)} className="rounded underline underline-offset-2">
            Dismiss
          </button>
        </div>
      )}

      {conflict && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              This resume was changed in another tab or window, so further saves were stopped rather than overwrite the
              newer version. Your text is still on screen — copy anything you need, then reload to continue from the
              latest saved resume.
            </span>
          </span>
          <Button variant="outline" size="sm" onClick={reconcile} className="h-7 shrink-0 text-xs">
            Reload latest
          </Button>
        </div>
      )}

      {lastError && saveStatus === "failed" && !conflict && (
        <div role="alert" className="bg-red-50 px-4 py-1.5 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          {lastError} Retrying is safe — it re-sends only this one change.
        </div>
      )}

      {metadataOpen && <ResumeMetadataDialog open={metadataOpen} onOpenChange={setMetadataOpen} />}
      {historyOpen && <VersionHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} />}
      {exportOpen && <ExportDialog open={exportOpen} onOpenChange={setExportOpen} userId={userId} />}
    </div>
  );
}
