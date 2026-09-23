import { redirect } from "next/navigation";
import { PrepRoadmap } from "@/components/features/PrepRoadmap";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function PrepPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: progress } = await supabase
    .from("study_task_progress")
    .select("task_id,status")
    .eq("user_id", user.id);

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-primary">2027 recruiting sprint</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Interview prep</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          A focused 21-day SWE plan for the active fall recruiting window: high-frequency data structures,
          timed coding, deliberate review, and interview communication. Plan for 4–5 focused hours per day.
        </p>
      </div>

      <PrepRoadmap userId={user.id} initialProgress={progress ?? []} />
    </div>
  );
}
