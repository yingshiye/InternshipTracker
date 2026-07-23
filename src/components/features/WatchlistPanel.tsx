"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/supabase";
import { AddWatchlistModal } from "./AddWatchlistModal";

type WatchlistItem = Tables<"user_watchlist">;

export function WatchlistPanel({ items }: { items: WatchlistItem[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          Watchlist
        </h2>
        <AddWatchlistModal />
      </div>

      {items.length === 0 ? (
        <Card className="items-center justify-center py-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No sites added yet. Add a company careers page to get notified
            when roles open up.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <WatchlistRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function WatchlistRow({ item }: { item: WatchlistItem }) {
  const [markingAsSeen, setMarkingAsSeen] = useState(false);
  const [seenError, setSeenError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const router = useRouter();

  async function handleMarkAsSeen() {
    setSeenError(null);
    setMarkingAsSeen(true);
    const supabase = getSupabaseBrowserClient();

    // has_changes is the only "seen" state and it lives entirely in
    // user_watchlist — no read of the shared url_snapshots row required.
    const { error } = await supabase
      .from("user_watchlist")
      .update({ has_changes: false })
      .eq("id", item.id);

    if (error) {
      setSeenError(error.message);
      setMarkingAsSeen(false);
    } else {
      setMarkingAsSeen(false);
      router.refresh();
    }
  }

  async function handleRemove() {
    setDeleteError(null);
    setDeleting(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("user_watchlist")
      .delete()
      .eq("id", item.id);

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
      <Card className="flex-row items-center justify-between gap-4 px-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
            {item.company}
          </p>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-xs text-gray-500 hover:underline dark:text-gray-400"
          >
            {item.url}
          </a>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${
                item.has_changes ? "bg-amber-400" : "bg-gray-300 dark:bg-gray-600"
              }`}
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {item.has_changes ? "Changes detected" : "No changes"}
            </span>
          </div>

          <div className="flex flex-col items-end gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={handleMarkAsSeen}
              disabled={markingAsSeen || !item.has_changes}
            >
              {markingAsSeen ? "Marking…" : "Mark as seen"}
            </Button>
            {seenError && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {seenError}
              </p>
            )}
          </div>

          <button
            onClick={() => {
              setDeleteError(null);
              setDeleteOpen(true);
            }}
            title="Remove from watchlist"
            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </Card>

      {/* Remove confirmation */}
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
              Remove from watchlist?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            This will stop monitoring{" "}
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {item.company}
            </span>{" "}
            for new job openings.
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
              onClick={handleRemove}
              disabled={deleting}
            >
              {deleting ? "Removing…" : "Remove"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
