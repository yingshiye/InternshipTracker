"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditApplicationModal } from "./EditApplicationModal";
import type { Tables } from "@/types/supabase";

type Event = Tables<"events">;
type Application = Tables<"applications">;

function formatEventDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function UpcomingPanel({
  events,
  allEvents,
  applications,
}: {
  events: Event[];
  allEvents: Event[];
  applications: Application[];
}) {
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const applicationsById = new Map(applications.map((application) => [application.id, application]));

  return (
    <>
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {events.slice(0, 5).map((event) => {
          const isOfferRelated = /offer|deadline/i.test(event.title);
          const application = applicationsById.get(event.application_id);
          return (
            <button
              key={event.id}
              type="button"
              onClick={() => application && setSelectedApplication(application)}
              disabled={!application}
              aria-label={application ? `Open ${application.company} application for ${event.title}` : undefined}
              className="flex w-full items-center gap-3 rounded-md px-1 py-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 disabled:cursor-default"
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  isOfferRelated ? "bg-chart-5" : "bg-chart-4"
                }`}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">{event.title}</span>
                {application && (
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {application.company} · {application.role}
                  </span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatEventDate(event.event_date)}
              </span>
            </button>
          );
        })}
      </CardContent>
    </Card>
    {selectedApplication && (
      <EditApplicationModal
        application={selectedApplication}
        events={allEvents.filter(
          (event) => event.application_id === selectedApplication.id,
        )}
        open
        onOpenChange={(open) => !open && setSelectedApplication(null)}
      />
    )}
    </>
  );
}
