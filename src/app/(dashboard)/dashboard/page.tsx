import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { StatsBar } from "@/components/features/StatsBar";
import { ApplicationList } from "@/components/features/ApplicationList";
import { UpcomingPanel } from "@/components/features/UpcomingPanel";
import { AddApplicationModal } from "@/components/features/AddApplicationModal";

export default async function DashboardPage() {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: applications } = await supabase
    .from("applications")
    .select("*")
    .order("updated_at", { ascending: false });

  const now = new Date().toISOString();
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .gte("event_date", now)
    .order("event_date", { ascending: true })
    .limit(5);

  const apps = applications ?? [];
  const upcomingEvents = events ?? [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-gray-900 dark:text-gray-100">
            Applications
          </h1>
          <p className="text-sm text-gray-500">
            Track your internship pipeline
          </p>
        </div>
        <AddApplicationModal />
      </div>
      <StatsBar applications={apps} />
      <ApplicationList applications={apps} events={upcomingEvents} />
      {upcomingEvents.length > 0 && (
        <UpcomingPanel events={upcomingEvents} />
      )}
    </div>
  );
}
