"use client";

import * as React from "react";
import {
  AlertTriangle,
  Ban,
  Check,
  CircleDashed,
  Construction,
  CreditCard,
  Gauge,
  Hourglass,
  LogOut,
  Timer,
  Trash2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { num } from "@/lib/format";
import { PLAN_META, STATUS_LABEL, type PlanId, type RiskKind, type TenantRisk, type TenantStatus } from "@/mock/console-tenants";
import { EmptyState } from "@/components/ui/primitives";
import { PageBody, PageHeader } from "@/components/shell/page";
import { TonePill, type PTone } from "@/components/platform/kit";
import { consoleNavItem } from "@/lib/console-nav";

/* ============================================================================
   Shared bits for every Platform Console screen: the tenant status and plan
   pills, the seat meter used in tables, risk pills and the "coming soon"
   placeholder. Later console screens should reuse these rather than restyle.
   ========================================================================== */

const STATUS_STYLE: Record<TenantStatus, { tone: PTone; icon: React.ElementType }> = {
  active: { tone: "success", icon: Check },
  trial: { tone: "info", icon: Hourglass },
  suspended: { tone: "danger", icon: Ban },
  pending: { tone: "warning", icon: CircleDashed },
  churned: { tone: "neutral", icon: LogOut },
  scheduled_deletion: { tone: "serious", icon: Trash2 },
};

/** Tenant lifecycle status — colour, icon and label, never colour alone. */
export function TenantStatusBadge({ status, className }: { status: TenantStatus; className?: string }) {
  const s = STATUS_STYLE[status];
  return (
    <TonePill tone={s.tone} icon={s.icon} className={className}>
      {STATUS_LABEL[status]}
    </TonePill>
  );
}

const PLAN_TONE: Record<PlanId, PTone> = { free: "neutral", pro: "accent", enterprise: "info" };

export function PlanBadge({ plan, className }: { plan: PlanId; className?: string }) {
  return (
    <TonePill tone={PLAN_TONE[plan]} className={className}>
      {PLAN_META[plan].label}
    </TonePill>
  );
}

/** Seats used against the limit, as a figure over a thin bar. Table-cell sized. */
export function SeatMeter({ used, limit, className }: { used: number; limit: number; className?: string }) {
  const ratio = limit ? used / limit : 0;
  const bar = ratio >= 1 ? "bg-destructive" : ratio >= 0.9 ? "bg-warning" : "bg-primary";
  return (
    <div className={cn("flex w-[112px] flex-col gap-1", className)}>
      <span className="tnum text-xs">
        <span className="font-medium text-foreground">{num(used)}</span>
        <span className="text-muted-foreground"> / {num(limit)}</span>
      </span>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label={`Seats used: ${num(used)} of ${num(limit)}`}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
      >
        <div className={cn("h-full rounded-full", bar)} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </div>
    </div>
  );
}

const RISK_ICON: Record<RiskKind, React.ElementType> = {
  seats: Users,
  payment: CreditCard,
  trial: Timer,
  errors: AlertTriangle,
};

export function RiskPill({ risk }: { risk: TenantRisk }) {
  return (
    <TonePill tone={risk.severity === "danger" ? "danger" : "warning"} icon={RISK_ICON[risk.kind]}>
      {risk.label}
    </TonePill>
  );
}

/** Requests per minute against the plan's rate limit, e.g. "1,880 / 2,000 rpm". */
export function RateLimitFigure({ peak, plan }: { peak: number; plan: PlanId }) {
  const limit = PLAN_META[plan].rateLimit;
  const hot = peak / limit >= 0.9;
  return (
    <span className={cn("tnum inline-flex items-center gap-1 text-xs", hot ? "text-warning-fg" : "text-foreground")}>
      <Gauge className="size-3 shrink-0" aria-hidden />
      {num(peak)} / {num(limit)} rpm
    </span>
  );
}

/** Placeholder for a console screen that is registered in the nav but not built yet. */
export function ConsoleComingSoon({ href }: { href: string }) {
  const item = consoleNavItem(href);
  return (
    <PageBody>
      <PageHeader title={item?.label ?? "Coming soon"} description={item?.description} />
      <EmptyState
        icon={item?.icon ?? Construction}
        title="Coming soon"
        description={`${item?.label ?? "This screen"} is part of the Platform Console and is being built next. Everything it needs is already in the console's tenant data.`}
      />
    </PageBody>
  );
}
