"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, Siren, XCircle } from "lucide-react";
import { fmtDateTime, num, pct } from "@/lib/format";
import { INCIDENTS, SERVICE_HEALTH, type HealthStatus, type Incident } from "@/mock/platform";
import { mockAction } from "@/components/app-state";
import { DataTable } from "@/components/data-table";
import { Sparkline } from "@/components/charts";
import { CardsSkeleton, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/primitives";
import { TonePill, type PTone } from "@/components/platform/kit";

const H: Record<HealthStatus, { label: string; tone: PTone; icon: React.ElementType; spark: "good" | "warning" | "critical" }> = {
  healthy: { label: "Healthy", tone: "success", icon: CheckCircle2, spark: "good" },
  degraded: { label: "Degraded", tone: "warning", icon: AlertTriangle, spark: "warning" },
  unhealthy: { label: "Unhealthy", tone: "danger", icon: XCircle, spark: "critical" },
};

const SEV_TONE: Record<Incident["severity"], PTone> = { "SEV-1": "danger", "SEV-2": "serious", "SEV-3": "warning" };

export default function HealthPage() {
  const loading = useFakeLoad();
  const [checking, setChecking] = React.useState(false);
  const degraded = SERVICE_HEALTH.filter((s) => s.status !== "healthy");
  const overall: HealthStatus = SERVICE_HEALTH.some((s) => s.status === "unhealthy") ? "unhealthy" : degraded.length ? "degraded" : "healthy";

  const columns = React.useMemo<ColumnDef<Incident, unknown>[]>(
    () => [
      { accessorKey: "id", header: "Incident", cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span> },
      { accessorKey: "severity", header: "Severity", cell: ({ row }) => <TonePill tone={SEV_TONE[row.original.severity]}>{row.original.severity}</TonePill> },
      {
        accessorKey: "title",
        header: "Summary",
        cell: ({ row }) => (
          <div className="max-w-[420px] text-xs">
            <p className="font-medium">{row.original.title}</p>
            <p className="text-muted-foreground">{row.original.impact}</p>
          </div>
        ),
      },
      { accessorKey: "service", header: "Service", cell: ({ row }) => <span className="text-xs">{row.original.service}</span> },
      { accessorKey: "startedAt", header: "Started", cell: ({ row }) => <span className="tnum text-xs">{fmtDateTime(row.original.startedAt)}</span> },
      {
        accessorKey: "resolvedAt",
        header: "Status",
        cell: ({ row }) =>
          row.original.resolvedAt ? (
            <TonePill tone="success">Resolved {fmtDateTime(row.original.resolvedAt)}</TonePill>
          ) : (
            <TonePill tone="warning" icon={Siren}>Investigating</TonePill>
          ),
      },
    ],
    [],
  );

  return (
    <PageBody>
      <PageHeader
        title="System Health"
        description="Live status of every dependency behind this tenant. Only SQL Server can make the platform unhealthy; cache, queue, storage and providers degrade gracefully."
        actions={
          <Button
            size="sm"
            variant="outline"
            disabled={checking}
            onClick={() => {
              setChecking(true);
              setTimeout(() => {
                setChecking(false);
                mockAction("Health checks re-run", { description: `${SERVICE_HEALTH.length - degraded.length} healthy · ${degraded.length} degraded · 0 unhealthy`, tone: "info" });
              }, 900);
            }}
          >
            <RefreshCw className={checking ? "animate-spin" : undefined} /> {checking ? "Checking…" : "Run checks"}
          </Button>
        }
      />

      {loading ? (
        <>
          <CardsSkeleton count={8} height={120} />
          <TableSkeleton rows={4} />
        </>
      ) : (
        <>
          <Alert
            tone={overall === "healthy" ? "success" : overall === "degraded" ? "warning" : "danger"}
            icon={H[overall].icon}
            title={overall === "healthy" ? "All systems operational" : `Partially degraded — ${degraded.map((d) => d.name).join(", ")}`}
          >
            {overall === "healthy" ? "Every check passed in the last minute." : degraded.map((d) => d.detail).join(" ")}
          </Alert>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {SERVICE_HEALTH.map((s) => {
              const m = H[s.status];
              return (
                <Card key={s.id} className="flex flex-col gap-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{s.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{s.kind}</p>
                    </div>
                    <TonePill tone={m.tone} icon={m.icon}>{m.label}</TonePill>
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <p className="tnum text-lg font-semibold">{num(s.latencyMs)} ms</p>
                      <p className="text-[11px] text-muted-foreground">latency · {pct(s.uptime30d, 2)} uptime (30 d)</p>
                    </div>
                    <Sparkline data={s.spark} tone={m.spark} ariaLabel={`${s.name} latency over the last 24 hours`} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{s.detail}</p>
                </Card>
              );
            })}
            <Card className="flex flex-col justify-center gap-1 p-3">
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold">
                <Activity className="size-4" aria-hidden /> Status endpoints
              </p>
              <p className="font-mono text-[11px] text-muted-foreground">GET /api/v1/health — anonymous, status only</p>
              <p className="font-mono text-[11px] text-muted-foreground">GET /api/v1/health/detailed — Admin role</p>
            </Card>
          </div>

          <Section title="Incidents" description="Last 60 days. Customer-facing status page: status.hrms-cloud.in">
            <DataTable
              columns={columns}
              data={INCIDENTS}
              searchKeys={["title", "service", "id"]}
              searchPlaceholder="Search incidents…"
              rowTone={(i) => (i.resolvedAt ? undefined : "warning")}
              exportName="incidents"
              emptyIcon={CheckCircle2}
              emptyTitle="No incidents"
              emptyDescription="Nothing has gone wrong in the last 60 days."
              pageSize={10}
            />
          </Section>
        </>
      )}
    </PageBody>
  );
}
