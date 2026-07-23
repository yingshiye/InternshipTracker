"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Copy, Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { deleteResume, duplicateResume, setResumeArchived } from "@/lib/resume/resumes";
import type { Resume } from "@/lib/resume/types";
import { AddResumeModal } from "./AddResumeModal";
import { RenameResumeModal } from "./RenameResumeModal";

export function ResumesPanel({
  activeResumes,
  archivedResumes,
}: {
  activeResumes: Resume[];
  archivedResumes: Resume[];
}) {
  const [tab, setTab] = useState<"active" | "archived">("active");
  const resumes = tab === "active" ? activeResumes : archivedResumes;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-md border border-gray-200 p-0.5 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setTab("active")}
            className={`rounded px-3 py-1 text-sm transition-colors ${
              tab === "active"
                ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            }`}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setTab("archived")}
            className={`rounded px-3 py-1 text-sm transition-colors ${
              tab === "archived"
                ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            }`}
          >
            Archived
          </button>
        </div>
        <AddResumeModal />
      </div>

      {resumes.length === 0 ? (
        <Card className="items-center justify-center py-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tab === "active" ? "No resumes yet. Create one to get started." : "No archived resumes."}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {resumes.map((resume) => (
            <ResumeRow key={resume.id} resume={resume} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResumeRow({ resume }: { resume: Resume }) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDuplicate() {
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const result = await duplicateResume(supabase, resume.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
  }

  async function handleArchiveToggle() {
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const result = await setResumeArchived(supabase, resume.id, resume.revision, resume.archived_at === null);
    setBusy(false);
    if (!result.ok) {
      setError(
        result.reason === "revision_conflict"
          ? "This resume changed elsewhere — refresh and try again."
          : result.message,
      );
      return;
    }
    router.refresh();
  }

  async function handleDelete() {
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const result = await deleteResume(supabase, resume.id, resume.revision);
    setBusy(false);
    if (!result.ok) {
      setError(
        result.reason === "has_versions"
          ? "This resume has saved versions and can't be permanently deleted — archive it instead."
          : result.reason === "revision_conflict"
            ? "This resume changed elsewhere — refresh and try again."
            : result.message,
      );
      return;
    }
    setDeleteOpen(false);
    router.refresh();
  }

  return (
    <>
      <Card className="flex-row items-center justify-between gap-4 px-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{resume.name}</p>
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
            {[resume.target_role, resume.target_company].filter(Boolean).join(" · ") ||
              "No target role or company set"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setRenameOpen(true)}
            title="Edit"
            className="rounded p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700 dark:hover:bg-gray-900 dark:hover:text-gray-200"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDuplicate}
            disabled={busy}
            title="Duplicate"
            className="rounded p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 dark:hover:bg-gray-900 dark:hover:text-gray-200"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleArchiveToggle}
            disabled={busy}
            title={resume.archived_at ? "Unarchive" : "Archive"}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 dark:hover:bg-gray-900 dark:hover:text-gray-200"
          >
            {resume.archived_at ? (
              <ArchiveRestore className="h-3.5 w-3.5" />
            ) : (
              <Archive className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            title="Delete"
            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </Card>
      {error && !deleteOpen && (
        <p className="px-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      <RenameResumeModal resume={resume} open={renameOpen} onOpenChange={setRenameOpen} />

      <Dialog
        open={deleteOpen}
        onOpenChange={(next) => {
          if (!next) setError(null);
          setDeleteOpen(next);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-medium">Permanently delete resume?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            This removes{" "}
            <span className="font-medium text-gray-900 dark:text-gray-100">{resume.name}</span> and
            all its sections, entries, and bullets. This can&apos;t be undone.
          </p>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={busy}>
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
