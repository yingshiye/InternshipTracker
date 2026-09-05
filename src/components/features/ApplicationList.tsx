"use client";

import { useState } from "react";
import type { Tables } from "@/types/supabase";
import { TooltipProvider } from "@/components/ui/tooltip";
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
    <TooltipProvider>
      <section className="overflow-hidden rounded-lg border border-border bg-card" aria-labelledby="applications-table-title">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="applications-table-title" className="text-sm font-semibold text-foreground">Applications</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "application" : "applications"}
          </p>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0" role="group" aria-label="Filter applications by status">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
              className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                filter === f.value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-muted/35 text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Company / Role</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Applied</th>
              <th className="px-3 py-2.5 font-medium">Next step</th>
              <th className="w-[132px] px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  {applications.length === 0
                    ? 'No applications yet — click "Add application" to get started.'
                    : "No applications match this filter."}
                </td>
              </tr>
            ) : (
              filtered.map((app) => (
                <ApplicationRow key={app.id} application={app} events={events} />
              ))
            )}
          </tbody>
        </table>
      </div>
      </section>
    </TooltipProvider>
  );
}
