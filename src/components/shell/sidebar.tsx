"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, ChevronsLeft, ChevronsRight, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV, navItemVisible } from "@/lib/nav";
import { useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/primitives";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/overlays";

function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link
      href="/dashboard"
      className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
        H
      </span>
      {!collapsed && (
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold leading-tight tracking-tight">HRMS-NEW</span>
          <span className="block truncate text-[10px] leading-tight text-muted-foreground">
            Stellar Technologies
          </span>
        </span>
      )}
    </Link>
  );
}

/* ---------------------------------------------- remembered group state */

/* Which groups the user opened or closed, keyed by group label. Lives in
   localStorage so it survives a refresh; every access is guarded because
   storage can throw (private mode, blocked site data) — then it is kept in
   memory for the session instead. */
const GROUPS_KEY = "hrms.sidebar.groups";
const groupListeners = new Set<() => void>();
let groupMemory = "{}";

function readGroups() {
  try {
    return window.localStorage.getItem(GROUPS_KEY) ?? groupMemory;
  } catch {
    return groupMemory;
  }
}

function writeGroup(label: string, open: boolean) {
  let current: Record<string, boolean> = {};
  try {
    current = JSON.parse(readGroups());
  } catch {
    /* corrupted value — start over */
  }
  groupMemory = JSON.stringify({ ...current, [label]: open });
  try {
    window.localStorage.setItem(GROUPS_KEY, groupMemory);
  } catch {
    /* storage unavailable — the in-memory copy still works */
  }
  groupListeners.forEach((l) => l());
}

function subscribeGroups(listener: () => void) {
  groupListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    groupListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function useStoredGroups(): Record<string, boolean> {
  const raw = React.useSyncExternalStore(subscribeGroups, readGroups, () => "{}");
  return React.useMemo(() => {
    try {
      return JSON.parse(raw) as Record<string, boolean>;
    } catch {
      return {};
    }
  }, [raw]);
}

/** Groups longer than this start collapsed, unless they hold the active route. */
const LONG_GROUP = 8;

function NavList({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can, approvalCount, exceptionCount, ticketCount } = useApp();
  const stored = useStoredGroups();
  /* The pathname on which the user folded the active group — it stays folded
     until they navigate elsewhere. */
  const [foldedActiveAt, setFoldedActiveAt] = React.useState<string | null>(null);

  const counts = { approvals: approvalCount, exceptions: exceptionCount, tickets: ticketCount };

  const groups = NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => navItemVisible(i, can)),
  })).filter((g) => g.items.length > 0);

  /* Longest matching href wins, so /assets/requests lights up Asset Requests
     and not Assets as well. */
  const activeHref = groups
    .flatMap((g) => g.items.map((i) => i.href))
    .filter((h) => pathname === h || (h !== "/dashboard" && pathname.startsWith(h + "/")))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav aria-label="Main" className="scrollbar-thin flex-1 overflow-y-auto px-2 py-2">
      {groups.map((group) => {
        const holdsActive = group.items.some((i) => i.href === activeHref);
        const open =
          collapsed ||
          (holdsActive && foldedActiveAt !== pathname) ||
          (stored[group.label] ?? group.items.length <= LONG_GROUP);
        const hiddenCount = open
          ? 0
          : group.items.reduce((n, i) => n + (i.badge ? counts[i.badge] : 0), 0);
        const listId = `nav-${group.label.toLowerCase().replace(/[^a-z]+/g, "-")}`;

        const toggle = () => {
          if (holdsActive) setFoldedActiveAt(open ? pathname : null);
          writeGroup(group.label, !open);
        };

        return (
          <div key={group.label} className="mb-2 last:mb-0">
            {!collapsed && (
              <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                aria-controls={listId}
                className="group/head flex w-full items-center gap-1 rounded-sm px-2 pb-1 pt-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0 flex-1 truncate">{group.label}</span>
                {hiddenCount > 0 && (
                  <span className="tnum rounded-full bg-destructive px-1.5 text-[10px] font-semibold normal-case leading-4 tracking-normal text-destructive-foreground">
                    {hiddenCount}
                  </span>
                )}
                <ChevronRight
                  className={cn("size-3 shrink-0 transition-transform", open && "rotate-90")}
                  aria-hidden
                />
              </button>
            )}
            {collapsed && <div className="mx-2 my-1.5 h-px bg-border" />}
            {open && (
              <ul id={listId} className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = item.href === activeHref;
                  const count = item.badge ? counts[item.badge] : 0;
                  const link = (
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex h-7 items-center gap-2 rounded-md px-2 text-xs font-medium transition-colors",
                        collapsed && "justify-center px-0",
                        active
                          ? "bg-primary-soft text-primary-soft-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <item.icon className="size-4 shrink-0" aria-hidden />
                      {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                      {!collapsed && count > 0 && (
                        <span className="tnum rounded-full bg-destructive px-1.5 text-[10px] font-semibold leading-4 text-destructive-foreground">
                          {count}
                        </span>
                      )}
                      {collapsed && count > 0 && (
                        <span className="absolute ml-5 mt-[-14px] size-1.5 rounded-full bg-destructive" aria-hidden />
                      )}
                    </Link>
                  );
                  return (
                    <li key={item.href} className="relative">
                      {collapsed ? (
                        <Hint text={count > 0 ? `${item.label} (${count})` : item.label} side="right">
                          {link}
                        </Hint>
                      ) : (
                        link
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

/* ---------------------------------------------------- responsive rail */

/* Below lg the sidebar is a sheet behind the hamburger (MobileNav); from lg to
   xl it is an icon rail; from xl it is full width unless the user collapses it. */
const WIDE_QUERY = "(min-width: 1280px)";

function subscribeWide(listener: () => void) {
  const mq = window.matchMedia(WIDE_QUERY);
  mq.addEventListener("change", listener);
  return () => mq.removeEventListener("change", listener);
}

function useWideViewport() {
  return React.useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => true,
  );
}

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, persona } = useApp();
  const wide = useWideViewport();
  const collapsed = sidebarCollapsed || !wide;
  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-border bg-card transition-[width] duration-150 lg:flex",
        collapsed ? "w-[52px]" : "w-[216px]",
      )}
    >
      <Brand collapsed={collapsed} />
      <NavList collapsed={collapsed} />
      <div className="shrink-0 border-t border-border p-2">
        {!collapsed && (
          <p className="mb-1.5 px-1 text-[10px] leading-tight text-muted-foreground">
            Viewing as <span className="font-medium text-foreground">{persona.role}</span>
          </p>
        )}
        {wide && (
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className={cn("w-full text-muted-foreground", collapsed && "justify-center px-0")}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight /> : <ChevronsLeft />}
            {!collapsed && <span className="ml-1">Collapse</span>}
          </Button>
        )}
      </div>
    </aside>
  );
}

/** Below lg: the sidebar becomes a sheet behind the hamburger. */
export function MobileNav() {
  const [open, setOpen] = React.useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
          <PanelLeft />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" width="sm:max-w-[240px]" className="p-0">
        <Brand />
        <NavList onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
