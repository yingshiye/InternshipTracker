import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/features/LogoutButton";

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

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-950">
        <div className="flex h-14 items-center border-b border-gray-100 px-4 dark:border-gray-800">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Internship tracker
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-900"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
        </nav>
        <div className="border-t border-gray-100 p-2 dark:border-gray-800">
          <LogoutButton />
        </div>
      </aside>
      <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950">
        {children}
      </main>
    </div>
  );
}
