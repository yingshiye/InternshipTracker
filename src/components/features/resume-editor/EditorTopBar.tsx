"use client";

import Link from "next/link";
import { ArrowLeft, Undo2, Redo2, Check, Loader2, CloudOff, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditor } from "./useEditorController";
import type { SaveStatus } from "./editor-types";

const STATUS_LABEL: Record<SaveStatus, string> = {
  idle: "All changes saved",
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
          : Check;
  const color = status === "failed" ? "text-red-600" : status === "offline" ? "text-amber-600" : "text-gray-500";
  return (
    <span className={`flex items-center gap-1.5 text-xs ${color}`} aria-live="polite">
      <Icon className={`h-3.5 w-3.5 ${status === "saving" || status === "retrying" ? "animate-spin" : ""}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function EditorTopBar({ resumeName }: { resumeName: string }) {
  const { saveStatus, canUndo, canRedo, undo, redo, conflict, reconcile, lastError, retryLast } = useEditor();

  return (
    <div className="flex flex-col border-b border-gray-100 dark:border-gray-800">
      <div className="flex h-14 items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-3">
          <Link href="/resumes" className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-100" aria-label="Back to resumes">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{resumeName}</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={saveStatus} />
          {saveStatus === "failed" && !conflict && (
            <Button variant="outline" size="sm" onClick={retryLast} className="h-7 gap-1 text-xs">
              <RefreshCw className="h-3 w-3" /> Retry
            </Button>
          )}
          <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />
          <Button variant="ghost" size="sm" onClick={() => void undo()} disabled={!canUndo || conflict} aria-label="Undo" className="h-8 w-8 p-0">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void redo()} disabled={!canRedo || conflict} aria-label="Redo" className="h-8 w-8 p-0">
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {conflict && (
        <div className="flex items-center justify-between gap-3 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            This resume was updated in another tab or window. Reload to see the latest and continue editing.
          </span>
          <Button variant="outline" size="sm" onClick={reconcile} className="h-7 text-xs">
            Reload
          </Button>
        </div>
      )}
      {lastError && saveStatus === "failed" && !conflict && (
        <div className="bg-red-50 px-4 py-1.5 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">{lastError}</div>
      )}
    </div>
  );
}
