"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Ban,
  Building2,
  CreditCard,
  Headset,
  Hourglass,
  IndianRupee,
  Plus,
  Rocket,
  ShieldAlert,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtAgo, inrCompact, num } from "@/lib/format";
import { GROWTH_TREND, PLATFORM_EVENTS, consoleKpis, planMix, type PlatformEventKind } from "@/mock/console-overview";
import { tenantRisks } from "@/mock/console-tenants";
import { useConsole } from "@/components/console/console-state";
import { CreateTenantDialog } from "@/components/console/create-tenant-dialog";
import { PlanBadge, RiskPill } from "@/components/console/kit";
import { useTenantActions } from "@/components/console/tenant-actions";
import { BarCompareChart, DonutChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, ChartSkeleton, PageBody, PageHeader, Section, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";

const EVENT_ICON: Record<PlatformEventKind, { icon: React.ElementType; tone: string }> = {
  signup: { icon: UserPlus, tone: "bg-info-soft text-info-fg" },
  upgrade: { icon: TrendingUp, tone: "bg-success-soft text-success-fg" },
  downgrade: { icon: TrendingDown, tone: "bg-neutral-soft text-neutral-fg" },
  payment: { icon: CreditCard, tone: "bg-destructive-soft text-destructive-fg" },
  suspension: { icon: Ban, tone: "bg-destructive-soft text-destructive-fg" },
  support: { icon: Headset, tone: "bg-warning-soft text-warning-fg" },
  incident: { icon: ShieldAlert, tone: "bg-destructive-soft text-destructive-fg" },
  deletion: { icon: Trash2, tone: "bg-serious-soft text-serious-fg" },
  release: { icon: Rocket, tone: "bg-primary-soft text-primary-soft-foreground" },
};

export default function ConsoleOverviewPage() {
  const loading = useFakeLoad();
  const { tenants } = useConsole();
  const { open, dialogs } = useTenantActions();
  const [creating, setCreating] = React.useState(false);

  const k = consoleKpis(tenants);
  const mix = planMix(tenants);
  const atRisk = tenants
    .map((t) => ({ t, risks: tenantRisks(t) }))
    .filter((r) => r.risks.length > 0)
    .sort((a, b) => b.risks.filter((x) => x.severity === "danger").length - a.risks.filter((x) => x.severity === "danger").length || b.t.mrr - a.t.mrr);
  const thisMonth = GROWTH_TREND[GROWTH_TREND.length - 1];
  const lastMonth = GROWTH_TREND[GROWTH_TREND.length - 2];
  const mrrDelta = ((thisMonth.mrr - lastMonth.mrr) / lastMonth.mrr) * 100;

  return (
    <PageBody>
      <PageHeader
        title="Platform overview"
        description="Every organisation on HRMS-NEW at a glance — growth, revenue and the tenants that need an operator today. Revenue is reported in INR."
        actions={
          <>
            <Button size="sm" variant="outline" asChild>
              <Link href="/console/tenants">
                <Building2 /> All tenants
              </Link>
            </Button>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus /> Create tenant
            </Button>
          </>
        }
      />

      {loading ? (
        <>
          <CardsSkeleton count={6} />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <ChartSkeleton />
            <ChartSkeleton />
          </div>
        </>
      ) : (
        <>
          <StatRow cols={3} className="xl:grid-cols-6">
            <StatTile label="Total tenants" value={num(k.total)} icon={Building2} hint="Excludes churned" href="/console/tenants" />
            <StatTile label="Active" value={num(k.active)} icon={Activity} tone="good" hint={`${num(k.trials)} more on trial`} href="/console/tenants?status=active" />
            <StatTile
              label="Trials ending ≤ 7 days"
              value={num(k.trialsEndingSoon)}
              icon={Hourglass}
              tone={k.trialsEndingSoon ? "warning" : "neutral"}
              hint="No card on file yet"
              href="/console/tenants?status=trial"
            />
            <StatTile label="Suspended" value={num(k.suspended)} icon={Ban} tone={k.suspended ? "critical" : "neutral"} hint="Billing or policy holds" href="/console/tenants?status=suspended" />
            <StatTile label="Employees on platform" value={num(k.employees)} icon={Users} hint="Seats in use, active + trial" />
            <StatTile
              label="MRR"
              value={inrCompact(k.mrr)}
              icon={IndianRupee}
              deltaValue={mrrDelta}
              deltaLabel="vs Aug"
              footer={<span className="tnum">ARR {inrCompact(k.arr)}</span>}
            />
          </StatRow>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <BarCompareChart
              title="Sign-ups and churn"
              description="New tenants created and tenants lost, per month. September is month to date."
              data={GROWTH_TREND as unknown as Record<string, string | number>[]}
              xKey="month"
              xLabelFormat={(m) => m.slice(0, 3)}
              series={[
                { key: "signups", label: "Sign-ups" },
                { key: "churned", label: "Churned" },
              ]}
              height={240}
            />
            <DonutChart
              title="Plan mix"
              description="Live tenants by plan (excludes churned and closing)."
              data={mix}
              centreValue={num(mix.reduce((a, m) => a + m.value, 0))}
              centreLabel="tenants"
              height={240}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Section
              title="Tenants at risk"
              description="Seat limit reached, failed payments, trials about to end, or a high error rate."
              bodyClassName="p-0"
              actions={<span className="tnum text-xs text-muted-foreground">{atRisk.length} tenants</span>}
            >
              {atRisk.length === 0 ? (
                <EmptyState icon={AlertTriangle} title="Nothing at risk" description="Every live tenant is within its limits." className="m-4" />
              ) : (
                <ul className="divide-y divide-border">
                  {atRisk.map(({ t, risks }) => (
                    <li key={t.id} className="flex flex-wrap items-start gap-x-3 gap-y-1.5 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5">
                          <Link href={`/console/tenants/${t.id}`} className="truncate text-xs font-medium text-foreground hover:underline">
                            {t.name}
                          </Link>
                          <PlanBadge plan={t.plan} />
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{risks[0].detail}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {risks.map((r) => (
                            <RiskPill key={r.kind} risk={r} />
                          ))}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {risks.some((r) => r.kind === "trial") && (
                          <Button size="sm" variant="outline" onClick={() => open("trial", t)}>
                            Extend trial
                          </Button>
                        )}
                        {risks.some((r) => r.kind === "seats") && (
                          <Button size="sm" variant="outline" onClick={() => open("plan", t)}>
                            Add seats
                          </Button>
                        )}
                        <Button size="icon-sm" variant="ghost" asChild>
                          <Link href={`/console/tenants/${t.id}`} aria-label={`Open ${t.name}`}>
                            <ArrowRight />
                          </Link>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Recent platform events" description="Sign-ups, billing, support and incidents across every tenant." bodyClassName="p-0">
              <ol className="divide-y divide-border">
                {PLATFORM_EVENTS.map((e) => {
                  const meta = EVENT_ICON[e.kind];
                  const body = (
                    <>
                      <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full", meta.tone)} aria-hidden>
                        <meta.icon className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-medium text-foreground">{e.title}</span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{e.detail}</span>
                        <span className="tnum mt-0.5 block text-[10px] text-muted-foreground">
                          {fmtAgo(e.at)} · {e.actor}
                        </span>
                      </span>
                    </>
                  );
                  return (
                    <li key={e.id}>
                      {e.tenantId ? (
                        <Link href={`/console/tenants/${e.tenantId}`} className="flex gap-2.5 px-4 py-2.5 transition-colors hover:bg-muted">
                          {body}
                        </Link>
                      ) : (
                        <div className="flex gap-2.5 px-4 py-2.5">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </Section>
          </div>
        </>
      )}

      <CreateTenantDialog open={creating} onOpenChange={setCreating} />
      {dialogs}
    </PageBody>
  );
}
