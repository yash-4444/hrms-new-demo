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
  Sun,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtAgo } from "@/lib/format";
import { PERSONAS } from "@/lib/rbac";
import { segmentLabel } from "@/lib/nav";
import { useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, Hint, Kbd, Separator } from "@/components/ui/primitives";
import {
  DropdownMenu,
  DropdownMenuContent,
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
      <DropdownMenuContent align="end" className="w-[320px]">
        <DropdownMenuLabel>View the demo as</DropdownMenuLabel>
        {PERSONAS.map((p, i) => (
          <DropdownMenuItem
            key={p.id}
            onSelect={() => setRole(p.id)}
            className="items-start gap-2.5 py-2"
          >
            <Avatar name={p.name} size={26} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-foreground">{p.name}</span>
                {role === p.id && <Check className="size-3 text-primary" aria-label="Current" />}
              </span>
              <span className="block text-[11px] text-muted-foreground">
                {p.role} · {p.title}
              </span>
              <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">{p.description}</span>
            </span>
            <Kbd className="mt-0.5 shrink-0">⌥{i + 1}</Kbd>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <p className="px-2 py-1 text-[10px] text-muted-foreground">
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
  const { notifications, unreadCount, markAllRead, markRead } = useApp();
  const toneDot = {
    info: "bg-info",
    warning: "bg-warning",
    success: "bg-success",
    danger: "bg-destructive",
  } as const;
  return (
    <Popover>
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
          {notifications.map((n) => (
            <li key={n.id} className="border-b border-border last:border-0">
              <Link
                href={n.href ?? "#"}
                onClick={() => markRead(n.id)}
                className={cn(
                  "flex gap-2.5 px-3 py-2.5 transition-colors hover:bg-muted",
                  !n.read && "bg-primary-soft/35",
                )}
              >
                <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", toneDot[n.tone ?? "info"])} aria-hidden />
                <span className="min-w-0">
                  <span className={cn("block text-xs leading-snug", !n.read && "font-medium")}>{n.title}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{n.body}</span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">{fmtAgo(n.at)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------ breadcrumbs */

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
          const isId = /^[a-z]{2,4}-?\d+$/i.test(seg) || /^\d+$/.test(seg);
          return (
            <li key={href} className="flex min-w-0 items-center gap-1">
              <ChevronRight className="size-3 shrink-0 text-muted-foreground/60" aria-hidden />
              {last ? (
                <span className="truncate font-medium text-foreground" aria-current="page">
                  {isId ? seg.toUpperCase() : segmentLabel(seg)}
                </span>
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
  const { setCommandOpen, approvalCount, persona } = useApp();

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
        <Hint text={`Approvals inbox — ${approvalCount} item${approvalCount === 1 ? "" : "s"} waiting on you`}>
          <Button variant="ghost" size="icon" className="relative" asChild>
            <Link href="/leave/approvals" aria-label={`Approvals inbox, ${approvalCount} pending`}>
              <Inbox />
              {approvalCount > 0 && (
                <span className="tnum absolute -right-0.5 -top-0.5 flex min-w-[15px] items-center justify-center rounded-full bg-warning px-1 text-[9px] font-bold leading-[15px] text-[#3a2800]">
                  {approvalCount}
                </span>
              )}
            </Link>
          </Button>
        </Hint>

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
              <Link href={`/employees/${persona.employeeId}`}>
                <UserRound /> My profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/settings">
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
