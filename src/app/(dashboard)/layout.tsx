import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/features/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { count: changedCount } = await supabase
    .from("user_watchlist")
    .select("id", { count: "exact", head: true })
    .eq("has_changes", true);

  return <DashboardShell changedCount={changedCount ?? 0}>{children}</DashboardShell>;
}
