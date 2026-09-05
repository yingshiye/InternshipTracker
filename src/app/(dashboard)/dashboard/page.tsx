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

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .order("event_date", { ascending: true });

  const apps = applications ?? [];
  const allEvents = events ?? [];
  const now = new Date().getTime();
  const upcomingEvents = allEvents.filter(
    (event) => new Date(event.event_date).getTime() >= now,
  );

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Applications
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track your internship pipeline
          </p>
        </div>
        <AddApplicationModal />
      </div>
      <StatsBar applications={apps} />
      <ApplicationList applications={apps} events={allEvents} />
      {upcomingEvents.length > 0 && (
        <UpcomingPanel
          events={upcomingEvents}
          allEvents={allEvents}
          applications={apps}
        />
      )}
    </div>
  );
}
