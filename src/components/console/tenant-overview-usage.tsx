"use client";

import * as React from "react";
import { fmtAgo, fmtDate, num } from "@/lib/format";
import { COUNTRY_META, PLAN_META, tenantRisks, type ConsoleTenant } from "@/mock/console-tenants";
import { tenantApiUsage, tenantSeatTrend } from "@/mock/console-tenant-detail";
import { RiskPill } from "@/components/console/kit";
import { BarCompareChart, TrendLineChart } from "@/components/charts";
import { Section } from "@/components/shell/page";
import { Facts, Meter } from "@/components/platform/kit";
import { Alert } from "@/components/ui/primitives";

/* Tenant detail — the Overview and Usage tabs. */

export function TenantOverviewTab({ tenant: t }: { tenant: ConsoleTenant }) {
  const risks = tenantRisks(t);
  const plan = PLAN_META[t.plan];
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Section title="Organisation" description="As registered on the platform. Tenant-side settings are not visible here.">
        <Facts
          cols={2}
          items={[
            { label: "Legal name", value: t.legalName },
            { label: "Tenant id", value: <span className="font-mono">{t.id}</span> },
            { label: "Owner", value: t.ownerName },
            { label: "Owner email", value: <a href={`mailto:${t.ownerEmail}`} className="text-primary hover:underline">{t.ownerEmail}</a> },
            { label: "Workspace", value: <span className="font-mono">{t.subdomain}.hrms-new.app</span> },
            { label: "Industry", value: t.industry },
            { label: "Region", value: `${COUNTRY_META[t.country].label} · ${COUNTRY_META[t.country].region}` },
            { label: "Data residency", value: COUNTRY_META[t.country].dataResidency },
            { label: "Created", value: fmtDate(t.createdAt) },
            { label: "Last active", value: fmtAgo(t.lastActiveAt) },
            { label: "Legal entities", value: num(t.legalEntities) },
            { label: "Employees", value: `${num(t.seatsUsed)} active` },
          ]}
        />
      </Section>
      <div className="flex flex-col gap-4">
        <Section title="Health" description="What needs an operator's attention.">
          {risks.length ? (
            <ul className="flex flex-col gap-2.5">
              {risks.map((r) => (
                <li key={r.kind} className="flex flex-col gap-1">
                  <RiskPill risk={r} />
                  <p className="text-[11px] text-muted-foreground">{r.detail}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No open risks — within seats, paid up and error-free.</p>
          )}
          {t.statusNote && !risks.some((r) => r.kind === "payment") && (
            <Alert tone="neutral" className="mt-3">
              {t.statusNote}
            </Alert>
          )}
        </Section>
        <Section title="Limits" description={`${plan.label} plan entitlements.`}>
          <div className="flex flex-col gap-3">
            <Meter label="Seats" used={t.seatsUsed} limit={t.seatLimit} warnAt={0.9} />
            <Meter label="Storage (GB)" used={t.storageUsedGb} limit={plan.storageGb} format={(n) => num(n, n % 1 ? 1 : 0)} />
            <Meter label="Peak API (req / min)" used={t.apiPeakRpm} limit={plan.rateLimit} warnAt={0.9} />
          </div>
        </Section>
      </div>
    </div>
  );
}

export function TenantUsageTab({ tenant: t }: { tenant: ConsoleTenant }) {
  const plan = PLAN_META[t.plan];
  const api = React.useMemo(() => tenantApiUsage(t), [t]);
  const seats = React.useMemo(() => tenantSeatTrend(t), [t]);
  const throttled = api.filter((d) => d.peakRpm >= plan.rateLimit).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Section>
          <Meter label="Seats used" used={t.seatsUsed} limit={t.seatLimit} warnAt={0.9} />
          <p className="mt-2 text-[11px] text-muted-foreground">{num(Math.max(0, t.seatLimit - t.seatsUsed))} seats free.</p>
        </Section>
        <Section>
          <Meter label="Storage (GB)" used={t.storageUsedGb} limit={plan.storageGb} format={(n) => num(n, n % 1 ? 1 : 0)} />
          <p className="mt-2 text-[11px] text-muted-foreground">Documents, payslips and exports, all legal entities.</p>
        </Section>
        <Section>
          <Meter label="Peak API today (req / min)" used={t.apiPeakRpm} limit={plan.rateLimit} warnAt={0.9} />
          <p className="mt-2 text-[11px] text-muted-foreground">
            PerTenant rate limit for {plan.label}: {num(plan.rateLimit)} / min, then HTTP 429.
          </p>
        </Section>
      </div>

      {throttled > 0 && (
        <Alert tone="warning" title={`Rate-limited on ${throttled} of the last 30 days`}>
          Requests above {num(plan.rateLimit)} / min were rejected with 429. Consider a higher plan or a batch import window.
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <TrendLineChart
          title="Peak API rate"
          description="Busiest minute each day, last 30 days, against the plan's rate limit."
          data={api as unknown as Record<string, string | number>[]}
          xKey="day"
          series={[{ key: "peakRpm", label: "Peak req / min" }]}
          referenceLine={{ value: plan.rateLimit, label: `${plan.label} limit ${num(plan.rateLimit)}` }}
          height={220}
        />
        <BarCompareChart
          title="API requests"
          description="Total requests per day, in thousands."
          data={api as unknown as Record<string, string | number>[]}
          xKey="day"
          xLabelFormat={(d) => d.slice(0, 2)}
          series={[{ key: "requestsK", label: "Requests (K)" }]}
          valueFormat={(v) => `${num(v, 1)}K`}
          height={220}
        />
      </div>
      <TrendLineChart
        title="Seats in use"
        description="Active employees at each month end, Apr – Sep 2026, against purchased seats."
        data={seats as unknown as Record<string, string | number>[]}
        xKey="month"
        series={[
          { key: "seats", label: "Seats in use" },
          { key: "limit", label: "Seat limit" },
        ]}
        height={200}
      />
    </div>
  );
}
