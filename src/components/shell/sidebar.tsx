"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV } from "@/lib/nav";
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

function NavList({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can, approvalCount, exceptionCount, ticketCount } = useApp();

  const counts = { approvals: approvalCount, exceptions: exceptionCount, tickets: ticketCount };

  const groups = NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => can(i.menuKey, "V")),
  })).filter((g) => g.items.length > 0);

  return (
    <nav aria-label="Main" className="scrollbar-thin flex-1 overflow-y-auto px-2 py-2">
      {groups.map((group) => (
        <div key={group.label} className="mb-2 last:mb-0">
          {!collapsed && (
            <p className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
          )}
          {collapsed && <div className="mx-2 my-1.5 h-px bg-border" />}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
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
        </div>
      ))}
    </nav>
  );
}

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, persona } = useApp();
  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-border bg-card transition-[width] duration-150 lg:flex",
        sidebarCollapsed ? "w-[52px]" : "w-[216px]",
      )}
    >
      <Brand collapsed={sidebarCollapsed} />
      <NavList collapsed={sidebarCollapsed} />
      <div className="shrink-0 border-t border-border p-2">
        {!sidebarCollapsed && (
          <p className="mb-1.5 px-1 text-[10px] leading-tight text-muted-foreground">
            Viewing as <span className="font-medium text-foreground">{persona.role}</span>
          </p>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className={cn("w-full text-muted-foreground", sidebarCollapsed && "justify-center px-0")}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <ChevronsRight /> : <ChevronsLeft />}
          {!sidebarCollapsed && <span className="ml-1">Collapse</span>}
        </Button>
      </div>
    </aside>
  );
}

/** md and below: the sidebar becomes a sheet. */
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
