"use client";

import type { Tables } from "@/types/supabase";

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

  return (
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
          {application.applied_date ? formatDate(application.applied_date) : "—"}
        </p>
      </div>

      {/* Updated */}
      <div>
        <p className="text-xs text-gray-400">
          {relativeTime(application.updated_at)}
        </p>
      </div>

      {/* Next interview */}
      <div>
        {nextEventDate ? (
          <p
            className={`text-[13px] ${
              isEventSoon
                ? "text-amber-600 dark:text-amber-400"
                : "text-gray-900 dark:text-gray-100"
            }`}
          >
            {formatDate(nextEventDate.toISOString())}
          </p>
        ) : (
          <p className="text-[13px] text-gray-400">—</p>
        )}
      </div>

      {/* Contact */}
      <div>
        <p className="text-[13px] text-gray-400">—</p>
      </div>
    </div>
  );
}
