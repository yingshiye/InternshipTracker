"use client";

import { useState } from "react";
import { Pencil, Trash2, CalendarPlus, FileCheck2, FilePlus2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Tables } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { EditApplicationModal } from "./EditApplicationModal";
import { AddEventModal } from "./AddEventModal";
import { AttachResumeVersionDialog } from "./AttachResumeVersionDialog";

type Application = Tables<"applications">;
type Event = Tables<"events">;

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const STATUS_CLASSES: Record<Application["status"], string> = {
  wishlist: "bg-chart-1/15 text-chart-1 dark:bg-chart-1/20",
  applied: "bg-chart-2/15 text-chart-2 dark:bg-chart-2/20",
  oa: "bg-chart-3/15 text-chart-3 dark:bg-chart-3/20",
  interview: "bg-chart-4/15 text-chart-4 dark:bg-chart-4/20",
  offer: "bg-chart-5/15 text-chart-5 dark:bg-chart-5/20",
  rejected: "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<Application["status"], string> = {
  wishlist: "wishlist",
  applied: "applied",
  oa: "OA",
  interview: "interview",
  offer: "offer",
  rejected: "rejected",
};

export function ApplicationRow({
  application,
  events,
}: {
  application: Application;
  events: Event[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const router = useRouter();

  const initials = application.company.slice(0, 2).toUpperCase();

  const now = new Date();
  const nextEvent = events
    .filter(
      (e) =>
        e.application_id === application.id && new Date(e.event_date) > now
    )
    .sort(
      (a, b) =>
        new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
    )[0];

  const nextEventDate = nextEvent ? new Date(nextEvent.event_date) : null;
  const isEventSoon =
    nextEventDate !== null &&
    nextEventDate.getTime() - now.getTime() < 7 * 86_400_000;

  async function handleDelete() {
    setDeleteError(null);
    setDeleting(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("applications")
      .delete()
      .eq("id", application.id);

    if (error) {
      setDeleteError(error.message);
      setDeleting(false);
    } else {
      setDeleteOpen(false);
      router.refresh();
    }
  }

  return (
    <>
      <tr className="group transition-colors hover:bg-muted/45">
        {/* Company / Role */}
        <td className="px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-semibold text-muted-foreground">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{application.company}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{application.role}</p>
            </div>
          </div>
        </td>

        {/* Status */}
        <td className="px-3 py-3">
          <span
            className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${STATUS_CLASSES[application.status]}`}
          >
            {STATUS_LABELS[application.status]}
          </span>
        </td>

        {/* Applied */}
        <td className="px-3 py-3">
          <p className="text-[13px] text-muted-foreground">
            {application.applied_date
              ? formatDate(application.applied_date)
              : "—"}
          </p>
        </td>

        {/* Next event */}
        <td className="px-3 py-3">
          {nextEventDate ? (
            <div>
              <p className="max-w-[220px] truncate text-[13px] text-foreground">
                {nextEvent!.title}
              </p>
              <p
                className={`mt-0.5 text-xs ${
                  isEventSoon
                    ? "text-chart-4"
                    : "text-muted-foreground"
                }`}
              >
                {formatDate(nextEventDate.toISOString())}
              </p>
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">No next step</p>
          )}
        </td>

        {/* Actions */}
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-0.5 opacity-70 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <button
            onClick={() => setEditOpen(true)}
            title="Edit application"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setResumeOpen(true)}
            title={
              application.submitted_resume_version_id
                ? "A submitted resume version is attached"
                : "Attach a submitted resume version"
            }
            aria-label={
              application.submitted_resume_version_id
                ? "Change the attached resume version"
                : "Attach a resume version"
            }
            className={`rounded-md p-1.5 hover:bg-accent ${
              application.submitted_resume_version_id
                ? "text-chart-5 hover:text-chart-5"
                : "text-muted-foreground hover:text-accent-foreground"
            }`}
          >
            {application.submitted_resume_version_id ? (
              <FileCheck2 className="h-3.5 w-3.5" />
            ) : (
              <FilePlus2 className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={() => setAddEventOpen(true)}
            title="Add event"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              setDeleteError(null);
              setDeleteOpen(true);
            }}
            title="Delete application"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          </div>
        </td>
      </tr>

      {editOpen && (
        <EditApplicationModal
          application={application}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}

      <AddEventModal
        application={application}
        open={addEventOpen}
        onOpenChange={setAddEventOpen}
      />

      {resumeOpen && (
        <AttachResumeVersionDialog
          application={application}
          open={resumeOpen}
          onOpenChange={setResumeOpen}
        />
      )}

      {/* Delete confirmation */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(next) => {
          if (!next) setDeleteError(null);
          setDeleteOpen(next);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-medium">
              Delete application?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete{" "}
            <span className="font-medium text-foreground">
              {application.company} — {application.role}
            </span>{" "}
            and all its events. This cannot be undone.
          </p>
          {deleteError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {deleteError}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
