"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Tables } from "@/types/supabase";

type Event = Tables<"events">;

function formatEventDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function UpcomingPanel({ events }: { events: Event[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {events.map((event) => {
          const isOfferRelated = /offer|deadline/i.test(event.title);
          return (
            <div key={event.id} className="flex items-center gap-3">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  isOfferRelated ? "bg-green-500" : "bg-amber-400"
                }`}
              />
              <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                {event.title}
              </span>
              <span className="text-xs text-gray-400">
                {formatEventDate(event.event_date)}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
