"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { Tables } from "@/types/supabase";

type Application = Tables<"applications">;

export function StatsBar({ applications }: { applications: Application[] }) {
  const total = applications.length;
  const interviewing = applications.filter(
    (a) => a.status === "interview"
  ).length;
  const offers = applications.filter((a) => a.status === "offer").length;
  const responding = applications.filter((a) =>
    ["interview", "oa", "offer"].includes(a.status)
  ).length;
  const responseRate =
    total === 0 ? 0 : Math.round((responding / total) * 100);

  const stats = [
    { label: "Total", value: total },
    { label: "Interviewing", value: interviewing },
    { label: "Offers", value: offers },
    { label: "Response rate", value: `${responseRate}%` },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {stat.label}
            </p>
            <p className="mt-1 text-2xl font-medium text-gray-900 dark:text-gray-100">
              {stat.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
