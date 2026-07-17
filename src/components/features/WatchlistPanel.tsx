"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  const [removing, setRemoving] = useState(false);
  const router = useRouter();

  async function handleMarkAsSeen() {
    setMarkingAsSeen(true);
    const supabase = getSupabaseBrowserClient();

    const { data: snapshot } = await supabase
      .from("url_snapshots")
      .select("content_hash")
      .eq("url", item.url)
      .maybeSingle();

    await supabase
      .from("user_watchlist")
      .update({
        has_changes: false,
        notified_hash: snapshot?.content_hash ?? null,
      })
      .eq("id", item.id);

    setMarkingAsSeen(false);
    router.refresh();
  }

  async function handleRemove() {
    setRemoving(true);
    const supabase = getSupabaseBrowserClient();
    await supabase.from("user_watchlist").delete().eq("id", item.id);
    setRemoving(false);
    router.refresh();
  }

  return (
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

        <Button
          size="sm"
          variant="outline"
          onClick={handleMarkAsSeen}
          disabled={markingAsSeen || !item.has_changes}
        >
          {markingAsSeen ? "Marking…" : "Mark as seen"}
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              title="Remove from watchlist"
              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove from watchlist?</AlertDialogTitle>
            </AlertDialogHeader>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This will stop monitoring{" "}
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {item.company}
              </span>{" "}
              for new job openings.
            </p>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRemove} disabled={removing}>
                {removing ? "Removing…" : "Remove"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Card>
  );
}
