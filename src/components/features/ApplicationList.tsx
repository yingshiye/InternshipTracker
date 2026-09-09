"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { Tables } from "@/types/supabase";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getNextEvent } from "@/lib/applications/next-event";
import { ApplicationRow } from "./ApplicationRow";

type Application = Tables<"applications">;
type Event = Tables<"events">;
type StatusFilter = Application["status"] | "all";
type SortColumn = "company" | "status" | "applied_date" | "next_step";
type SortDirection = "asc" | "desc";

const FILTERS: { label: string; value: StatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Wishlist", value: "wishlist" },
  { label: "Applied", value: "applied" },
  { label: "OA", value: "oa" },
  { label: "Interview", value: "interview" },
  { label: "Offer", value: "offer" },
  { label: "Rejected", value: "rejected" },
];

const STATUS_ORDER: Record<Application["status"], number> = {
  wishlist: 0,
  applied: 1,
  oa: 2,
  interview: 3,
  offer: 4,
  rejected: 5,
};

const COLUMNS: { key: SortColumn; label: string; className: string }[] = [
  { key: "company", label: "Company / Role", className: "px-4 py-2.5" },
  { key: "status", label: "Status", className: "px-3 py-2.5" },
  { key: "applied_date", label: "Applied", className: "px-3 py-2.5" },
  { key: "next_step", label: "Next step", className: "px-3 py-2.5" },
];

export function ApplicationList({
  applications,
  events,
  userId,
}: {
  applications: Application[];
  events: Event[];
  userId: string;
}) {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("applied_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const nextEventByAppId = useMemo(() => {
    const now = new Date();
    const map = new Map<string, Event | null>();
    for (const app of applications) {
      map.set(app.id, getNextEvent(app.id, events, now));
    }
    return map;
  }, [applications, events]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return applications.filter((a) => {
      if (filter !== "all" && a.status !== filter) return false;
      if (
        term &&
        !a.company.toLowerCase().includes(term) &&
        !a.role.toLowerCase().includes(term)
      ) {
        return false;
      }
      return true;
    });
  }, [applications, filter, search]);

  const sorted = useMemo(() => {
    const dir = sortDirection === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortColumn) {
        case "company": {
          return (
            (a.company.localeCompare(b.company) ||
              a.role.localeCompare(b.role)) * dir
          );
        }
        case "status":
          return (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) * dir;
        case "applied_date": {
          if (!a.applied_date && !b.applied_date) return 0;
          if (!a.applied_date) return 1;
          if (!b.applied_date) return -1;
          return (
            (new Date(a.applied_date).getTime() -
              new Date(b.applied_date).getTime()) *
            dir
          );
        }
        case "next_step": {
          const ea = nextEventByAppId.get(a.id);
          const eb = nextEventByAppId.get(b.id);
          if (!ea && !eb) return 0;
          if (!ea) return 1;
          if (!eb) return -1;
          return (
            (new Date(ea.event_date).getTime() -
              new Date(eb.event_date).getTime()) *
            dir
          );
        }
        default:
          return 0;
      }
    });
  }, [filtered, sortColumn, sortDirection, nextEventByAppId]);

  function toggleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  }

  return (
    <TooltipProvider>
      <section className="overflow-hidden rounded-lg border border-border bg-card" aria-labelledby="applications-table-title">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="applications-table-title" className="text-sm font-semibold text-foreground">Applications</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {sorted.length} {sorted.length === 1 ? "application" : "applications"}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company or role…"
            aria-label="Search applications by company or role"
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-[200px]"
          />
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
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-muted/35 text-[11px] uppercase tracking-wide text-muted-foreground">
              {COLUMNS.map((col) => {
                const isActive = sortColumn === col.key;
                const ariaSort = isActive
                  ? sortDirection === "asc"
                    ? "ascending"
                    : "descending"
                  : "none";
                return (
                  <th key={col.key} className={`${col.className} font-medium`} aria-sort={ariaSort}>
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="flex items-center gap-1 rounded-sm text-[11px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {col.label}
                      {isActive ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="h-3 w-3" aria-hidden="true" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" aria-hidden="true" />
                      )}
                    </button>
                  </th>
                );
              })}
              <th className="w-[132px] px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  {applications.length === 0
                    ? 'No applications yet — click "Add application" to get started.'
                    : "No applications match this filter."}
                </td>
              </tr>
            ) : (
              sorted.map((app) => (
                <ApplicationRow
                  key={app.id}
                  application={app}
                  events={events}
                  nextEvent={nextEventByAppId.get(app.id) ?? null}
                  userId={userId}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
      </section>
    </TooltipProvider>
  );
}
