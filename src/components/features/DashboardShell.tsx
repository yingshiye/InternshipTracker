"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  Eye,
  FileText,
  Layers,
  LayoutDashboard,
  Menu,
  Moon,
  PanelLeftOpen,
  Sun,
  X,
} from "lucide-react";
import { LogoutButton } from "@/components/features/LogoutButton";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/watchlist", label: "Watchlist", icon: Eye },
  { href: "/resumes", label: "Resumes", icon: FileText },
  { href: "/resume-blocks", label: "Resume blocks", icon: Layers },
];

export function DashboardShell({
  children,
  changedCount,
}: {
  children: React.ReactNode;
  changedCount: number;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const syncPreferences = window.setTimeout(() => {
      const savedCollapsed = window.localStorage.getItem("sidebar-collapsed") === "true";
      const savedTheme = window.localStorage.getItem("theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const nextDark = savedTheme ? savedTheme === "dark" : prefersDark;
      setCollapsed(savedCollapsed);
      setDark(nextDark);
      document.documentElement.classList.toggle("dark", nextDark);
    }, 0);

    return () => window.clearTimeout(syncPreferences);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  function toggleTheme() {
    const nextDark = !dark;
    setDark(nextDark);
    window.localStorage.setItem("theme", nextDark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", nextDark);
  }

  function toggleCollapsed() {
    const nextCollapsed = !collapsed;
    setCollapsed(nextCollapsed);
    window.localStorage.setItem("sidebar-collapsed", String(nextCollapsed));
  }

  const sidebar = (
    <>
      <div className="flex h-14 items-center border-b border-sidebar-border px-3">
        <Link href="/dashboard" className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
            IT
          </span>
          {!collapsed && (
            <span className="truncate text-sm font-semibold tracking-tight">Internship Tracker</span>
          )}
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:hidden"
        >
          <X className="size-4" />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-2" aria-label="Primary navigation">
        {navigation.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              aria-current={active ? "page" : undefined}
              title={collapsed ? item.label : undefined}
              className={cn(
                "relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
                collapsed && "justify-center px-0"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {item.href === "/watchlist" && changedCount > 0 && (
                <span
                  aria-label={`${changedCount} watchlist changes`}
                  className={cn(
                    "ml-auto size-1.5 rounded-full bg-amber-500",
                    collapsed && "absolute right-2 top-2"
                  )}
                />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-sidebar-border p-2">
        <button
          type="button"
          onClick={toggleTheme}
          title={collapsed ? (dark ? "Use light theme" : "Use dark theme") : undefined}
          className={cn(
            "flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            collapsed && "justify-center px-0"
          )}
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {!collapsed && <span>{dark ? "Light mode" : "Dark mode"}</span>}
        </button>
        <LogoutButton collapsed={collapsed} />
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "hidden h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:flex",
            collapsed && "justify-center px-0"
          )}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <ChevronLeft className="size-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[1px] md:hidden"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed && "md:w-[68px]"
        )}
      >
        {sidebar}
      </aside>
      <div className={cn("min-w-0 transition-[padding] duration-200 md:pl-60", collapsed && "md:pl-[68px]")}>
        <header className="sticky top-0 z-30 flex h-14 items-center border-b border-border bg-background/95 px-4 backdrop-blur md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Menu className="size-5" />
          </button>
          <span className="ml-2 text-sm font-semibold">Internship Tracker</span>
        </header>
        <main className="min-h-screen bg-background">{children}</main>
      </div>
    </div>
  );
}
