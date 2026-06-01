"use client";

import { useState } from "react";
import { Pencil, Trash2, CalendarPlus } from "lucide-react";
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

type Application = Tables<"applications">;
type Event = Tables<"events">;

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const STATUS_CLASSES: Record<Application["status"], string> = {
  wishlist: "bg-gray-100 text-gray-600 border-gray-200",
  applied: "bg-blue-50 text-blue-800 border-blue-200",
  oa: "bg-purple-50 text-purple-800 border-purple-200",
  interview: "bg-amber-50 text-amber-800 border-amber-200",
  offer: "bg-green-50 text-green-800 border-green-200",
  rejected: "bg-gray-100 text-gray-600 border-gray-200",
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
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] items-center gap-4 rounded-lg border border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
        {/* Company / Role */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
              {application.company}
            </p>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
              {application.role}
            </p>
          </div>
        </div>

        {/* Status */}
        <div>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[application.status]}`}
          >
            {STATUS_LABELS[application.status]}
          </span>
        </div>

        {/* Applied */}
        <div>
          <p className="text-[13px] text-gray-900 dark:text-gray-100">
            {application.applied_date
              ? formatDate(application.applied_date)
              : "—"}
          </p>
        </div>

        {/* Updated */}
        <div>
          <p className="text-xs text-gray-400">
            {relativeTime(application.updated_at)}
          </p>
        </div>

        {/* Next event */}
        <div>
          {nextEventDate ? (
            <div>
              <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                {nextEvent!.title}
              </p>
              <p
                className={`text-[13px] ${
                  isEventSoon
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-gray-900 dark:text-gray-100"
                }`}
              >
                {formatDate(nextEventDate.toISOString())}
              </p>
            </div>
          ) : (
            <p className="text-[13px] text-gray-400">—</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setEditOpen(true)}
            title="Edit application"
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setAddEventOpen(true)}
            title="Add event"
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              setDeleteError(null);
              setDeleteOpen(true);
            }}
            title="Delete application"
            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

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
          <p className="text-sm text-gray-600 dark:text-gray-400">
            This will permanently delete{" "}
            <span className="font-medium text-gray-900 dark:text-gray-100">
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
