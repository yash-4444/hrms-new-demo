"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, Gauge, Hourglass, Octagon, Play, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtAgo, fmtDateTime, hm, num } from "@/lib/format";
import { JOBS, type BackgroundJob, type JobStatus, type TenantLoad } from "@/mock/console-health";
import { demoNowMs, mockAction } from "@/components/app-state";
import { PlanBadge, RateLimitFigure } from "@/components/console/kit";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { TonePill, useSimulatedTask, type PTone } from "@/components/platform/kit";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/overlays";

/* System Health — background jobs and the per-tenant load table. Every job
   writes a run-ledger row guarded by a filtered unique index, so "Run now"
   for a period that already ran is a no-op, never a double credit. */

const JOB_STYLE: Record<JobStatus, { label: string; tone: PTone; icon: React.ElementType }> = {
  succeeded: { label: "Succeeded", tone: "success", icon: Check },
  running: { label: "Running", tone: "info", icon: Hourglass },
  failed: { label: "Failed — retrying", tone: "danger", icon: Octagon },
};

function TableHeading({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

const dur = (sec: number) => (sec < 60 ? `${sec}s` : hm(sec / 60));

export function JobsSection() {
  const [jobs, setJobs] = React.useState<BackgroundJob[]>(JOBS);
  const [confirming, setConfirming] = React.useState<BackgroundJob | null>(null);
  const { runningKey, progress, start } = useSimulatedTask(1600);

  const run = (j: BackgroundJob) => {
    if (j.periodDone) {
      mockAction(`${j.name}: nothing to do`, { description: `Run-ledger key ${j.ledgerKey} already exists — a second run is a no-op, not a double credit.`, tone: "info" });
      return;
    }
    start(j.id, () => {
      const at = format(new Date(demoNowMs()), "yyyy-MM-dd'T'HH:mm:ss");
      setJobs((js) => js.map((x) => (x.id === j.id ? { ...x, status: "succeeded", lastRunAt: at, durationSec: 2 } : x)));
      mockAction(`${j.name} completed`, { description: `Run-ledger row written for ${j.ledgerKey}.` });
    });
  };

  const columns = React.useMemo<ColumnDef<BackgroundJob, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Job",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-medium text-foreground">{row.original.name}</p>
            <p className="text-[11px] text-muted-foreground">{row.original.schedule}</p>
          </div>
        ),
      },
      {
        accessorKey: "lastRunAt",
        header: "Last run",
        cell: ({ row }) => (
          <div className="text-xs">
            <p className="tnum">{fmtDateTime(row.original.lastRunAt)}</p>
            <p className="text-[11px] text-muted-foreground">{fmtAgo(row.original.lastRunAt)}</p>
          </div>
        ),
      },
      { accessorKey: "durationSec", header: "Duration", cell: ({ row }) => <NumCell>{dur(row.original.durationSec)}</NumCell> },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const j = row.original;
          if (runningKey === j.id)
            return (
              <TonePill tone="info" icon={Hourglass}>
                Running {progress}%
              </TonePill>
            );
          const s = JOB_STYLE[j.status];
          return (
            <div className="flex flex-col gap-0.5">
              <TonePill tone={s.tone} icon={s.icon}>
                {s.label}
              </TonePill>
              <span className="max-w-[240px] truncate text-[11px] text-muted-foreground">{j.note}</span>
            </div>
          );
        },
      },
      { accessorKey: "nextRunAt", header: "Next run", cell: ({ row }) => <MutedCell>{row.original.nextRunAt ? fmtDateTime(row.original.nextRunAt) : "On demand"}</MutedCell> },
      { accessorKey: "ledgerKey", header: "Run-ledger key", cell: ({ row }) => <code className="whitespace-nowrap rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{row.original.ledgerKey}</code> },
      {
        id: "__a",
        header: "",
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button size="sm" variant="outline" disabled={!!runningKey || row.original.status === "running"} onClick={() => setConfirming(row.original)}>
              <Play /> Run now
            </Button>
          </div>
        ),
      },
    ],
    [runningKey, progress],
  );

  return (
    <>
      <div className="flex flex-col gap-2">
        <TableHeading title="Background jobs" description="Hrms.Workers consumers. Every run is keyed in the run ledger, so re-running a finished period changes nothing." />
        <DataTable columns={columns} data={jobs} getRowId={(j) => j.id} enableColumnFilters={false} rowTone={(j) => (j.status === "failed" ? "danger" : undefined)} exportName="platform-jobs" canExport emptyIcon={Workflow} dense />
      </div>
      <ConfirmDialog
        open={!!confirming}
        onOpenChange={(v) => !v && setConfirming(null)}
        title={`Run ${confirming?.name ?? ""} now?`}
        description={
          confirming?.periodDone
            ? `The current period already has a run-ledger row (${confirming.ledgerKey}). The run will start and immediately no-op.`
            : `Starts an out-of-schedule run for every tenant due. It writes ${confirming?.ledgerKey ?? ""} on completion.`
        }
        confirmLabel="Run now"
        onConfirm={() => confirming && run(confirming)}
      />
    </>
  );
}

export function NoisyNeighbours({ rows }: { rows: TenantLoad[] }) {
  const columns = React.useMemo<ColumnDef<TenantLoad, unknown>[]>(
    () => [
      {
        id: "tenant",
        header: "Tenant",
        accessorFn: (r) => r.tenant.name,
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-1.5">
            <Link href={`/console/tenants/${row.original.tenant.id}`} className="truncate text-xs font-medium text-foreground hover:underline">
              {row.original.tenant.name}
            </Link>
            <PlanBadge plan={row.original.tenant.plan} />
          </div>
        ),
      },
      {
        id: "rpm",
        header: "Peak vs limit",
        accessorFn: (r) => r.utilisation,
        cell: ({ row }) => (
          <div className="flex w-[150px] flex-col gap-1">
            <RateLimitFigure peak={row.original.peakRpm} plan={row.original.tenant.plan} />
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="meter" aria-label="Share of rate limit" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(row.original.utilisation * 100)}>
              <div className={cn("h-full rounded-full", row.original.utilisation >= 0.9 ? "bg-warning" : "bg-primary")} style={{ width: `${Math.min(100, row.original.utilisation * 100)}%` }} />
            </div>
          </div>
        ),
      },
      { accessorKey: "throttled", header: "429s (24 h)", cell: ({ row }) => <NumCell className={row.original.throttled ? "text-warning-fg" : undefined}>{num(row.original.throttled)}</NumCell> },
      { accessorKey: "errorRate", header: "Error rate", cell: ({ row }) => <NumCell className={row.original.errorRate >= 2 ? "text-destructive-fg" : undefined}>{row.original.errorRate.toFixed(1)}%</NumCell> },
      { accessorKey: "slowQueries", header: "Slow queries > 500 ms", cell: ({ row }) => <NumCell>{num(row.original.slowQueries)}</NumCell> },
    ],
    [],
  );
  return (
    <div className="flex flex-col gap-2">
      <TableHeading title="Noisy neighbours" description="Live tenants closest to their plan's PerTenant rate limit over the last 24 hours. Throttled requests get 429 with Retry-After: 60." />
      <DataTable columns={columns} data={rows} getRowId={(r) => r.tenant.id} enableColumnFilters={false} pageSize={8} rowTone={(r) => (r.errorRate >= 2 ? "danger" : r.utilisation >= 0.9 ? "warning" : undefined)} exportName="tenant-load" canExport emptyIcon={Gauge} dense />
    </div>
  );
}
