"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, LogOut, PanelLeft, ServerCog, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONSOLE_NAV, consoleSegmentLabel } from "@/lib/console-nav";
import { PERSONA_GROUPS, isPlatformRole, personaById, type RoleId } from "@/lib/rbac";
import { useApp } from "@/components/app-state";
import { useConsole } from "@/components/console/console-state";
import { ThemeToggle } from "@/components/shell/topbar";
import { SupportSessionBanner } from "@/components/shell/support-session";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, Separator } from "@/components/ui/primitives";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/overlays";

/* ============================================================================
   The Platform Console's own shell. Same primitives and theming as the tenant
   app, but a different frame: an inverted "Platform Console" brand, the
   console nav (CONSOLE_NAV, never NAV), no tenant name, no tenant switcher,
   no My Space, no approvals inbox. The operator is outside every tenant and
   the chrome says so on every screen.
   ========================================================================== */

function ConsoleBrand() {
  return (
    <Link
      href="/console"
      className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-foreground text-background">
        <ServerCog className="size-3.5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold leading-tight tracking-tight">Platform Console</span>
        <span className="block truncate text-[10px] leading-tight text-muted-foreground">HRMS-NEW · vendor operations</span>
      </span>
    </Link>
  );
}

function ConsoleNavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname().replace(/\/+$/, "") || "/";
  /* Longest matching href wins; the overview matches only itself. */
  const active = CONSOLE_NAV.flatMap((g) => g.items.map((i) => i.href))
    .filter((h) => pathname === h || (h !== "/console" && pathname.startsWith(h + "/")))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav aria-label="Platform Console" className="scrollbar-thin flex-1 overflow-y-auto px-2 py-2">
      {CONSOLE_NAV.map((group) => (
        <div key={group.label} className="mb-2 last:mb-0">
          <p className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={item.href === active ? "page" : undefined}
                  className={cn(
                    "flex h-7 items-center gap-2 rounded-md px-2 text-xs font-medium transition-colors",
                    item.href === active
                      ? "bg-primary-soft text-primary-soft-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <item.icon className="size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function ScopeNote() {
  return (
    <div className="shrink-0 border-t border-border p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <ShieldCheck className="size-3" aria-hidden /> Outside all tenants
      </p>
      <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
        Tenant data opens only through a recorded support session.
      </p>
    </div>
  );
}

function ConsoleSidebar() {
  return (
    <aside className="hidden w-[216px] shrink-0 flex-col border-r border-border bg-card lg:flex">
      <ConsoleBrand />
      <ConsoleNavList />
      <ScopeNote />
    </aside>
  );
}

function ConsoleMobileNav() {
  const [open, setOpen] = React.useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open console navigation">
          <PanelLeft />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" width="sm:max-w-[240px]" className="p-0">
        <ConsoleBrand />
        <ConsoleNavList onNavigate={() => setOpen(false)} />
        <ScopeNote />
      </SheetContent>
    </Sheet>
  );
}

/** The operator's account menu — and, for the demo, the way back into a tenant persona. */
function OperatorMenu() {
  const { persona, setRole } = useApp();
  const router = useRouter();
  const tenantGroups = PERSONA_GROUPS.filter((g) => !g.roles.some(isPlatformRole));
  const switchTo = (id: RoleId) => {
    setRole(id);
    router.push("/dashboard");
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2 pl-1.5 pr-2" aria-label="Operator menu and persona switcher">
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
        className="scrollbar-thin max-h-(--radix-dropdown-menu-content-available-height) w-[300px] overflow-y-auto"
      >
        <div className="px-2 py-1.5">
          <p className="text-xs font-medium">{persona.name}</p>
          <p className="text-[11px] text-muted-foreground">{persona.email}</p>
          <Badge variant="muted" className="mt-1.5">
            {persona.title} · {persona.department}
          </Badge>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Leave the console — view a tenant as</DropdownMenuLabel>
        {tenantGroups.map((g) => (
          <DropdownMenuGroup key={g.label}>
            <p className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {g.label}
            </p>
            {g.roles.map(personaById).map((p) => (
              <DropdownMenuItem key={p.id} onSelect={() => switchTo(p.id)} title={p.description} className="gap-2.5 py-1">
                <Avatar name={p.name} size={20} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-foreground">{p.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{p.role}</span>
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild destructive>
          <Link href="/login">
            <LogOut /> Sign out
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ConsoleTopbar() {
  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-1.5 border-b border-border bg-card px-2 lg:px-3">
      <ConsoleMobileNav />
      <span className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-background">
        <ServerCog className="size-3.5" aria-hidden />
        Platform Console
      </span>
      <span className="hidden items-center gap-1.5 text-xs text-muted-foreground md:inline-flex">
        <span className="size-1.5 rounded-full bg-success" aria-hidden />
        Production · 4 regions
      </span>
      <div className="ml-auto flex items-center gap-0.5">
        <ThemeToggle />
        <Separator orientation="vertical" className="mx-1 h-5" />
        <OperatorMenu />
      </div>
    </header>
  );
}

function ConsoleBreadcrumbs() {
  const pathname = usePathname();
  const { tenantById } = useConsole();
  const segments = pathname.split("/").filter(Boolean);
  const label = (seg: string) => tenantById(seg)?.name ?? consoleSegmentLabel(seg);
  return (
    <nav aria-label="Breadcrumb" className="flex h-8 items-center gap-1 border-b border-border bg-subtle px-3 lg:px-4">
      <ol className="flex min-w-0 items-center gap-1 text-xs">
        {segments.map((seg, i) => {
          const href = "/" + segments.slice(0, i + 1).join("/");
          const last = i === segments.length - 1;
          return (
            <li key={href} className="flex min-w-0 items-center gap-1">
              {i > 0 && <ChevronRight className="size-3 shrink-0 text-muted-foreground/60" aria-hidden />}
              {last ? (
                <span className="truncate font-medium text-foreground" aria-current="page">
                  {label(seg)}
                </span>
              ) : (
                <Link href={href} className="truncate text-muted-foreground hover:text-foreground">
                  {label(seg)}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function ConsoleShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <ConsoleSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <SupportSessionBanner where="console" />
        <ConsoleTopbar />
        <ConsoleBreadcrumbs />
        <main id="main" className="scrollbar-thin min-w-0 flex-1 overflow-y-auto p-3 lg:p-4">
          {children}
        </main>
      </div>
    </div>
  );
}
