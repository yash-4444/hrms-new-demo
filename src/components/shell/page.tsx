"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { menuKeyForPath } from "@/lib/nav";
import { MENU_META, type Action, type MenuKey } from "@/lib/rbac";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Hint, Skeleton } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/overlays";

/* --------------------------------------------------------- page scaffold */

export function PageHeader({
  title,
  description,
  actions,
  tabs,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  tabs?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
          {description && (
            <p className="mt-0.5 max-w-3xl text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div>}
      </div>
      {tabs}
    </div>
  );
}

export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-4", className)}>{children}</div>;
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card className={cn("flex flex-col", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-4 py-2.5">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold tracking-tight">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </div>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </Card>
  );
}

/* ------------------------------------------------------- permission gates */

/** Wraps a control so a role without the grant sees it disabled WITH a reason. */
export function Gated({
  menuKey,
  action = "V",
  children,
  fallback,
  hide,
}: {
  menuKey: MenuKey;
  action?: Action;
  children: React.ReactElement<{ disabled?: boolean }>;
  fallback?: React.ReactNode;
  hide?: boolean;
}) {
  const { can, why } = useApp();
  if (can(menuKey, action)) return children;
  if (hide) return <>{fallback ?? null}</>;
  return (
    <Hint text={why(menuKey, action)}>
      <span className="inline-flex cursor-not-allowed">
        {React.cloneElement(children, { disabled: true })}
      </span>
    </Hint>
  );
}

/** Route-level guard — renders the Access denied state on a restricted route. */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { can, persona } = useApp();
  const key = menuKeyForPath(pathname);
  const [requesting, setRequesting] = React.useState(false);

  if (!key || can(key, "V")) return <>{children}</>;

  const meta = MENU_META.find((m) => m.key === key);
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="max-w-lg p-6 text-center">
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-destructive-soft text-destructive-fg">
          <ShieldAlert className="size-5" aria-hidden />
        </div>
        <h1 className="text-base font-semibold">Access denied</h1>
        <p className="mt-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{persona.name}</span> is signed in as{" "}
          <span className="font-medium text-foreground">{persona.role}</span>, which has no{" "}
          <span className="font-medium text-foreground">View</span> grant on{" "}
          <span className="font-medium text-foreground">{meta?.label ?? key}</span>.
        </p>
        <div className="mt-3 rounded-md border border-border bg-subtle p-2.5 text-left">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Required permission
          </p>
          <p className="mt-1 font-mono text-xs text-foreground">
            {meta?.module ?? "—"} › {meta?.label ?? key} · V
          </p>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Switch persona from the top bar to see this screen — or ask your tenant owner for the grant.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
          {can("admin.roles") ? (
            <Button size="sm" asChild>
              <Link href="/admin/roles">View the role matrix</Link>
            </Button>
          ) : (
            <Button size="sm" onClick={() => setRequesting(true)}>
              Request access
            </Button>
          )}
        </div>
      </Card>
      <ConfirmDialog
        open={requesting}
        onOpenChange={setRequesting}
        title={`Request access to ${meta?.label ?? key}`}
        description="Your tenant owner reviews the request. Access is granted per role, so they may add the grant to your role or give you a time-boxed override."
        confirmLabel="Send request"
        comment={{ label: "Why do you need access?", placeholder: "e.g. Covering for the payroll team during month-end close." }}
        onConfirm={(reason) =>
          mockAction("Access request sent", {
            description: `${meta?.label ?? key} · View — "${reason}". You will be notified when it is decided.`,
          })
        }
      />
    </div>
  );
}

/* --------------------------------------------------------- loading states */

/**
 * Holds the skeleton for ~400 ms on first mount so navigation feels like a
 * real app fetching data. Mock-only theatre, deliberately.
 */
export function useFakeLoad(ms = 400) {
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return loading;
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1.5">
        <Skeleton className="h-7 w-[200px]" />
        <Skeleton className="h-7 w-[130px]" />
        <Skeleton className="ml-auto h-7 w-[90px]" />
      </div>
      <div className="overflow-hidden rounded-md border border-border">
        <Skeleton className="h-8 w-full rounded-none" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-t border-border px-2.5 py-2">
            <Skeleton className="h-3.5 w-1/4" />
            <Skeleton className="h-3.5 w-1/6" />
            <Skeleton className="h-3.5 w-1/5" />
            <Skeleton className="ml-auto h-3.5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardsSkeleton({ count = 4, height = 88 }: { count?: number; height?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} style={{ height }} />
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = 240 }: { height?: number }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-2 h-3 w-64" />
      <Skeleton className="mt-4 w-full" style={{ height }} />
    </div>
  );
}
