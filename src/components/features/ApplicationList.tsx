"use client";

import { useState } from "react";
import type { Tables } from "@/types/supabase";
import { ApplicationRow } from "./ApplicationRow";

type Application = Tables<"applications">;
type Event = Tables<"events">;
type StatusFilter = Application["status"] | "all";

const FILTERS: { label: string; value: StatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Wishlist", value: "wishlist" },
  { label: "Applied", value: "applied" },
  { label: "OA", value: "oa" },
  { label: "Interview", value: "interview" },
  { label: "Offer", value: "offer" },
  { label: "Rejected", value: "rejected" },
];

export function ApplicationList({
  applications,
  events,
}: {
  applications: Application[];
  events: Event[];
}) {
  const [filter, setFilter] = useState<StatusFilter>("all");

  const filtered =
    filter === "all"
      ? applications
      : applications.filter((a) => a.status === filter);

  return (
    <div className="flex flex-col gap-3">
      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              filter === f.value
                ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 border-b border-gray-100 pb-2 text-xs text-gray-400 dark:border-gray-800">
        <span>Company / Role</span>
        <span>Status</span>
        <span>Applied</span>
        <span>Updated</span>
        <span>Next interview</span>
        <span>Actions</span>
      </div>

      {/* Rows */}
      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">
          {applications.length === 0
            ? 'No applications yet — click "Add application" to get started.'
            : "No applications match this filter."}
        </p>
      ) : (
        filtered.map((app) => (
          <ApplicationRow key={app.id} application={app} events={events} />
        ))
      )}
    </div>
  );
}
