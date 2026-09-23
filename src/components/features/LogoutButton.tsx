"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

export function LogoutButton({ collapsed = false }: { collapsed?: boolean }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const button = (
    <button
      type="button"
      onClick={handleLogout}
      aria-label="Sign out"
      className={cn(
        "flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        collapsed && "md:justify-center md:px-0"
      )}
    >
      <LogOut className="h-4 w-4" />
      <span className={cn(collapsed && "md:hidden")}>Sign out</span>
    </button>
  );

  return collapsed ? <Tooltip label="Sign out">{button}</Tooltip> : button;
}
