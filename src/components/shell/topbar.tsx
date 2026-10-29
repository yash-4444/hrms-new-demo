"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Bell,
  Check,
  ChevronRight,
  Inbox,
  LogOut,
  Monitor,
  Moon,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtAgo } from "@/lib/format";
import { PERSONA_GROUPS, personaById, personaHotkey } from "@/lib/rbac";
import { ALL_NAV_ITEMS, menuKeyForPath, segmentLabel } from "@/lib/nav";
import { useApp } from "@/components/app-state";
import { CopilotLauncher } from "@/components/ai";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, Hint, Kbd, Separator } from "@/components/ui/primitives";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/overlays";
import { MobileNav } from "./sidebar";
import { CommandPalette } from "./command-palette";

/* ------------------------------------------------------------ role switch */

function RoleSwitcher() {
  const { role, persona, setRole } = useApp();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2 pl-1.5 pr-2" aria-label="Switch persona">
          <Avatar name={persona.name} size={20} />
          <span className="hidden min-w-0 flex-col items-start leading-none sm:flex">
            <span className="text-xs font-medium">{persona.shortName}</span>
            <span className="text-[10px] text-muted-foreground">{persona.role}</span>
          </span>
          <ChevronRight className="size-3 rotate-90 opacity-50" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="scrollbar-thin max-h-(--radix-dropdown-menu-content-available-height) w-[320px] overflow-y-auto"
      >
        <DropdownMenuLabel>View the demo as</DropdownMenuLabel>
        {PERSONA_GROUPS.map((g, gi) => (
          <DropdownMenuGroup key={g.label}>
            {gi > 0 && <DropdownMenuSeparator />}
            <p className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {g.label}
            </p>
            {g.roles.map(personaById).map((p) => {
              const hotkey = personaHotkey(p.id);
              return (
                <DropdownMenuItem
                  key={p.id}
                  onSelect={() => setRole(p.id)}
                  title={p.description}
                  className="gap-2.5 py-1.5"
                >
                  <Avatar name={p.name} size={22} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-medium text-foreground">{p.name}</span>
                      {role === p.id && <Check className="size-3 shrink-0 text-primary" aria-label="Current" />}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {p.role} · {p.title}
                    </span>
                  </span>
                  {hotkey && <Kbd className="shrink-0">⌥{hotkey}</Kbd>}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        ))}
        <DropdownMenuSeparator />
        <p className="px-2 py-1 text-[10px] leading-snug text-muted-foreground">
          <span className="font-medium text-foreground">{persona.role}:</span> {persona.description}
        </p>
        <p className="px-2 pb-1 text-[10px] text-muted-foreground">
          Switching is instant — no reload. Nav, dashboard and permitted actions all change.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* --------------------------------------------------------------- theme */

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change theme">
          {!mounted ? (
            <Sun />
          ) : theme === "dark" ? (
            <Moon />
          ) : theme === "system" ? (
            <Monitor />
          ) : (
            <Sun />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setTheme("light")}>
          <Sun /> Light {mounted && theme === "light" && <Check className="ml-auto size-3" />}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme("dark")}>
          <Moon /> Dark {mounted && theme === "dark" && <Check className="ml-auto size-3" />}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme("system")}>
          <Monitor /> System {mounted && theme === "system" && <Check className="ml-auto size-3" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* -------------------------------------------------------- notifications */

function NotificationBell() {
  const { notifications, unreadCount, markAllRead, markRead, can } = useApp();
  const [open, setOpen] = React.useState(false);
  /* A notification only links where this persona may go. */
  const reachable = (href?: string) => {
    if (!href) return false;
    const key = menuKeyForPath(href);
    return !key || can(key);
  };
  const toneDot = {
    info: "bg-info",
    warning: "bg-warning",
    success: "bg-success",
    danger: "bg-destructive",
  } as const;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications, ${unreadCount} unread`}>
          <Bell />
          {unreadCount > 0 && (
            <span className="tnum absolute -right-0.5 -top-0.5 flex min-w-[15px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-[15px] text-destructive-foreground">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-xs font-semibold">Notifications</p>
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={markAllRead}>
            Mark all read
          </Button>
        </div>
        <ul className="scrollbar-thin max-h-[360px] overflow-y-auto">
          {notifications.map((n) => {
            const body = (
              <>
                <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", toneDot[n.tone ?? "info"])} aria-hidden />
                <span className="min-w-0">
                  <span className={cn("block text-xs leading-snug", !n.read && "font-medium")}>{n.title}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{n.body}</span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">{fmtAgo(n.at)}</span>
                </span>
              </>
            );
            const cls = cn("flex gap-2.5 px-3 py-2.5 transition-colors", !n.read && "bg-primary-soft/35");
            return (
              <li key={n.id} className="border-b border-border last:border-0">
                {n.href && reachable(n.href) ? (
                  <Link
                    href={n.href}
                    onClick={() => {
                      markRead(n.id);
                      setOpen(false);
                    }}
                    className={cn(cls, "hover:bg-muted")}
                  >
                    {body}
                  </Link>
                ) : (
                  <button type="button" onClick={() => markRead(n.id)} className={cn(cls, "w-full text-left hover:bg-muted")}>
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <div className="border-t border-border px-3 py-1.5 text-center">
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
            <Link href="/notifications" onClick={() => setOpen(false)}>
              View all notifications
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------ breadcrumbs */

/* Only real pages are links: a nav route, or a record id directly under one
   (/payroll/runs/PR-2026-09). Grouping segments such as /admin, /payroll or
   /payroll/runs/<id>/employee have no page of their own and render as text. */
const NAV_HREFS = new Set(ALL_NAV_ITEMS.map((i) => i.href));

/** A record id: has a digit, dash-separated alphanumerics (PR-2026-09, STL-0001, 42). */
const isIdSegment = (seg: string) => /\d/.test(seg) && /^[a-z0-9]+(-[a-z0-9]+)*$/i.test(seg);

function isRoutable(segments: string[], i: number) {
  if (NAV_HREFS.has("/" + segments.slice(0, i + 1).join("/"))) return true;
  return isIdSegment(segments[i]) && NAV_HREFS.has("/" + segments.slice(0, i).join("/"));
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex h-8 items-center gap-1 border-b border-border bg-subtle px-3 lg:px-4">
      <ol className="flex min-w-0 items-center gap-1 text-xs">
        <li>
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
            Home
          </Link>
        </li>
        {segments.map((seg, i) => {
          const href = "/" + segments.slice(0, i + 1).join("/");
          const last = i === segments.length - 1;
          const isId = isIdSegment(seg);
          return (
            <li key={href} className="flex min-w-0 items-center gap-1">
              <ChevronRight className="size-3 shrink-0 text-muted-foreground/60" aria-hidden />
              {last ? (
                <span className="truncate font-medium text-foreground" aria-current="page">
                  {isId ? seg.toUpperCase() : segmentLabel(seg)}
                </span>
              ) : !isRoutable(segments, i) ? (
                <span className="truncate text-muted-foreground">{isId ? seg.toUpperCase() : segmentLabel(seg)}</span>
              ) : (
                <Link href={href} className="truncate text-muted-foreground hover:text-foreground">
                  {isId ? seg.toUpperCase() : segmentLabel(seg)}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ---------------------------------------------------------------- topbar */

export function Topbar() {
  const { setCommandOpen, approvalCount, persona, can } = useApp();

  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-1.5 border-b border-border bg-card px-2 lg:px-3">
      <MobileNav />

      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        className="group flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-subtle px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:max-w-sm"
        aria-label="Open global search"
      >
        <Search className="size-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-left">Search employees, screens, actions…</span>
        <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
      </button>

      <div className="ml-auto flex items-center gap-0.5">
        <CopilotLauncher className="mr-1 h-8" />

        {can("team.approvals") && (
          <Hint text={`Approvals inbox — ${approvalCount} item${approvalCount === 1 ? "" : "s"} waiting on you`}>
            <Button variant="ghost" size="icon" className="relative" asChild>
              <Link href="/approvals" aria-label={`Approvals inbox, ${approvalCount} pending`}>
                <Inbox />
                {approvalCount > 0 && (
                  <span className="tnum absolute -right-0.5 -top-0.5 flex min-w-[15px] items-center justify-center rounded-full bg-warning px-1 text-[9px] font-bold leading-[15px] text-[#3a2800]">
                    {approvalCount}
                  </span>
                )}
              </Link>
            </Button>
          </Hint>
        )}

        <NotificationBell />
        <ThemeToggle />

        <Separator orientation="vertical" className="mx-1 h-5" />

        <RoleSwitcher />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Account menu">
              <Avatar name={persona.name} size={24} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-xs font-medium">{persona.name}</p>
              <p className="text-[11px] text-muted-foreground">{persona.email}</p>
              <Badge variant="muted" className="mt-1.5">
                {persona.employeeId} · {persona.branch}
              </Badge>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/me">
                <UserRound /> My profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/me/security">
                <ShieldCheck /> Security &amp; sessions
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/me/preferences">
                <Settings /> Preferences
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild destructive>
              <Link href="/login">
                <LogOut /> Sign out
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandPalette />
    </header>
  );
}
