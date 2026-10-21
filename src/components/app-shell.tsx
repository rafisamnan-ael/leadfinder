"use client";

import {
  Clock3,
  History,
  LayoutDashboard,
  Menu,
  Radar,
  Search,
  Settings,
  Star,
  Users,
  FileSearch,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { Sheet } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/search", label: "Lead Search", icon: Search },
  { href: "/templates", label: "Search Templates", icon: FileSearch },
  { href: "/leads", label: "Saved Leads", icon: Users },
  { href: "/history", label: "Search History", icon: History },
  { href: "/favorites", label: "Favorites", icon: Star },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

function NavLinks({ onNavigate, compact }: { onNavigate?: () => void; compact?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Main navigation">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-sidebar-accent text-sidebar-foreground shadow-sm"
                : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
              )}
              aria-hidden
            />
            <span className="truncate">{label}</span>
            {active && !compact && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-foreground/70" aria-hidden />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 px-3 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
      aria-label="LeadFinder home"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Radar className="h-4.5 w-4.5" aria-hidden />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[15px] font-semibold tracking-tight">LeadFinder</span>
        <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Prospect Engine
        </span>
      </span>
    </Link>
  );
}

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/search": "Lead Search",
  "/templates": "Search Templates",
  "/leads": "Saved Leads",
  "/history": "Search History",
  "/favorites": "Favorites",
  "/settings": "Settings",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [openAt, setOpenAt] = React.useState<string | null>(null);
  const mobileOpen = openAt !== null && openAt === pathname;

  const title =
    PAGE_TITLES[
      Object.keys(PAGE_TITLES)
        .filter((p) => (p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(`${p}/`)))
        .sort((a, b) => b.length - a.length)[0] ?? "/"
    ] ?? "LeadFinder";

  return (
    <div className="flex min-h-screen w-full">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="px-3 py-5">
          <Brand />
        </div>
        <NavLinks />
        <div className="mt-auto border-t border-sidebar-border px-4 py-4">
          <div className="rounded-lg bg-sidebar-accent/60 p-3">
            <p className="text-[11px] font-medium leading-relaxed text-muted-foreground">
              Queries open public Google results. LeadFinder does not scrape Google or LinkedIn
              and does not store personal data.
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      <Sheet
        open={mobileOpen}
        onOpenChange={(next) => setOpenAt(next ? pathname : null)}
      >
        <div className="px-3 py-5 pr-10">
          <Brand />
        </div>
        <NavLinks onNavigate={() => setOpenAt(null)} />
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:px-6">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
            onClick={() => setOpenAt(pathname)}
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-sm font-semibold tracking-tight md:text-base">{title}</h1>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Link
              href="/search"
              className="hidden h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:inline-flex"
            >
              <Clock3 className="h-3.5 w-3.5" aria-hidden />
              New search
            </Link>
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-6 md:py-7">{children}</main>
      </div>
    </div>
  );
}
