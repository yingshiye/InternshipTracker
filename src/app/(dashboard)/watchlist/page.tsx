import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { WatchlistPanel } from "@/components/features/WatchlistPanel";

export default async function WatchlistPage() {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: items } = await supabase
    .from("user_watchlist")
    .select("*")
    .order("has_changes", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-medium text-gray-900 dark:text-gray-100">
          Watchlist
        </h1>
        <p className="text-sm text-gray-500">
          Sites you&apos;re monitoring for job openings.
        </p>
      </div>
      <WatchlistPanel items={items ?? []} />
    </div>
  );
}
