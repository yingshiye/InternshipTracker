"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { Tables } from "@/types/supabase";

type Application = Tables<"applications">;

export function StatsBar({ applications }: { applications: Application[] }) {
  const total = applications.length;
  const assessments = applications.filter((a) => a.status === "oa").length;
  const interviews = applications.filter((a) => a.status === "interview").length;
  const offers = applications.filter((a) => a.status === "offer").length;

  const stats = [
    { label: "Applications", value: total },
    { label: "Online assessments", value: assessments },
    { label: "Interviews", value: interviews },
    { label: "Offers", value: offers },
  ];

  return (
    <section aria-label="Application overview" className="grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-4">
      {stats.map((stat) => (
        <Card
          key={stat.label}
          className="rounded-none border-b border-r border-border py-0 ring-0 even:border-r-0 nth-[n+3]:border-b-0 sm:border-b-0 sm:even:border-r sm:last:border-r-0"
        >
          <CardContent className="p-4 sm:p-5">
            <p className="text-xs font-medium text-muted-foreground sm:text-sm">{stat.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              {stat.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
