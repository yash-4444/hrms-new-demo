"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, CircleSlash, Cog, Loader2, Play, RotateCcw, XCircle } from "lucide-react";
import { fmtDateTime, hms, num } from "@/lib/format";
import { JOB_DEFS, JOB_RUNS, type JobRun, type JobStatus } from "@/mock/platform";
import { mockAction } from "@/components/app-state";
import { DataTable, NumCell, MutedCell } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import {
  ConfirmDialog,
  FilterSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/overlays";
import { TonePill, type PTone } from "@/components/platform/kit";

const STATUS_META: Record<JobStatus, { label: string; tone: PTone; icon: React.ElementType }> = {
  succeeded: { label: "Succeeded", tone: "success", icon: CheckCircle2 },
  failed: { label: "Failed", tone: "danger", icon: XCircle },
  running: { label: "Running", tone: "info", icon: Loader2 },
  skipped: { label: "Skipped", tone: "neutral", icon: CircleSlash },
};

const jobLabel = (id: string) => JOB_DEFS.find((j) => j.id === id)?.label ?? id;

/** The run key a manual trigger would use right now (DEMO_NOW = 2026-09-16 14:35). */
function currentRunKey(jobId: string) {
  switch (jobId) {
    case "leave-accrual": return "2026-09";
    case "leave-year-end": return "2026";
    case "payroll-calc":
    case "payslip-gen": return "PAYRUN-2026-09";
    case "attrition": return "2026-09-16";
    case "ai-index": return "20260916-14";
    case "doc-ocr": return "BATCH-20260916-14";
    case "email-outbox": return "20260916-1435";
    default: return "DEVICE-20260916-1435";
  }
}

export default function JobsPage() {
  const loading = useFakeLoad();
  const [runs, setRuns] = React.useState<JobRun[]>(JOB_RUNS);
  const [jobFilter, setJobFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [retrying, setRetrying] = React.useState<JobRun | null>(null);
  const [triggerJob, setTriggerJob] = React.useState("leave-accrual");
  const [confirmTrigger, setConfirmTrigger] = React.useState(false);

  const data = React.useMemo(
    () => runs.filter((r) => (jobFilter === "all" || r.jobId === jobFilter) && (statusFilter === "all" || r.status === statusFilter)),
    [runs, jobFilter, statusFilter],
  );

  const count = (s: JobStatus) => runs.filter((r) => r.status === s).length;

  const addRun = (r: Omit<JobRun, "id">) => setRuns((prev) => [{ id: `RUN-M${prev.length + 1}`, ...r }, ...prev]);

  const trigger = () => {
    const key = currentRunKey(triggerJob);
    const prior = runs.find((r) => r.jobId === triggerJob && r.runKey === key && (r.status === "succeeded" || r.status === "running"));
    if (prior) {
      addRun({ jobId: triggerJob, runKey: key, status: "skipped", trigger: "manual", startedAt: "2026-09-16T14:35:00", durationSec: 0, records: 0, message: `Duplicate run prevented — ${jobLabel(triggerJob).toLowerCase()} already ${prior.status === "running" ? "running" : "succeeded"} for ${key} (${prior.id}). Nothing was changed.` });
      mockAction("Run skipped — already done for this period", {
        description: `${jobLabel(triggerJob)} already ${prior.status === "running" ? "running" : "succeeded"} for ${key}. The run ledger's unique key blocks a double credit.`,
        tone: "warning",
      });
      return;
    }
    addRun({ jobId: triggerJob, runKey: key, status: "running", trigger: "manual", startedAt: "2026-09-16T14:35:00", durationSec: null, records: 0, message: "Queued and started by you." });
    mockAction(`${jobLabel(triggerJob)} started`, { description: `Run key ${key}. Progress appears in this ledger.`, tone: "info" });
  };

  const retry = (r: JobRun) => {
    setRuns((prev) => [
      { ...r, id: `${r.id}-R`, status: "succeeded", trigger: "manual", startedAt: "2026-09-16T14:35:00", durationSec: 41, records: r.jobId === "doc-ocr" ? 14 : 334, message: `Retry of ${r.id} succeeded.` },
      ...prev,
    ]);
    mockAction(`Retried ${r.runKey}`, { description: `${jobLabel(r.jobId)} completed on retry. The failed run stays in the ledger for audit.` });
  };

  const columns = React.useMemo<ColumnDef<JobRun, unknown>[]>(
    () => [
      { accessorKey: "jobId", header: "Job", cell: ({ row }) => <span className="text-xs font-medium">{jobLabel(row.original.jobId)}</span> },
      { accessorKey: "runKey", header: "Run key", cell: ({ row }) => <span className="font-mono text-[11px]">{row.original.runKey}</span> },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const m = STATUS_META[row.original.status];
          return <TonePill tone={m.tone} icon={m.icon}>{m.label}</TonePill>;
        },
      },
      { accessorKey: "startedAt", header: "Started", cell: ({ row }) => <span className="tnum text-xs">{fmtDateTime(row.original.startedAt)}</span> },
      {
        accessorKey: "durationSec",
        header: "Duration",
        cell: ({ row }) => (row.original.durationSec === null ? <MutedCell>running…</MutedCell> : <NumCell>{hms(row.original.durationSec)}</NumCell>),
      },
      { accessorKey: "records", header: "Records", cell: ({ row }) => <NumCell>{num(row.original.records)}</NumCell> },
      { accessorKey: "trigger", header: "Trigger", cell: ({ row }) => <span className="text-xs capitalize text-muted-foreground">{row.original.trigger}</span> },
      { accessorKey: "message", header: "Message", cell: ({ row }) => <p className="max-w-[360px] text-xs text-muted-foreground">{row.original.message}</p> },
      {
        id: "__a",
        header: "",
        enableHiding: false,
        cell: ({ row }) =>
          row.original.status === "failed" ? (
            <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
              <Gated menuKey="admin.jobs" action="X">
                <Button size="sm" variant="outline" onClick={() => setRetrying(row.original)}>
                  <RotateCcw /> Retry
                </Button>
              </Gated>
            </div>
          ) : null,
      },
    ],
    [],
  );

  const skippedExample = runs.find((r) => r.status === "skipped");

  return (
    <PageBody>
      <PageHeader
        title="Background Jobs"
        description="The run ledger for every scheduled and on-demand job. Each run is keyed by job + period; a second run for a key that already succeeded is skipped, never double-applied."
      />

      {loading ? (
        <>
          <CardsSkeleton />
          <TableSkeleton />
        </>
      ) : (
        <>
          <StatRow>
            <StatTile label="Succeeded" value={count("succeeded")} icon={CheckCircle2} tone="good" onClick={() => setStatusFilter("succeeded")} />
            <StatTile label="Failed" value={count("failed")} icon={XCircle} tone={count("failed") ? "critical" : "neutral"} onClick={() => setStatusFilter("failed")} hint="Retry after fixing the cause" />
            <StatTile label="Running" value={count("running")} icon={Loader2} onClick={() => setStatusFilter("running")} />
            <StatTile label="Skipped (idempotent)" value={count("skipped")} icon={CircleSlash} onClick={() => setStatusFilter("skipped")} hint="Duplicate runs prevented" />
          </StatRow>

          {skippedExample && (
            <Alert tone="info" icon={CircleSlash} title="Idempotency guard">
              {skippedExample.message}
            </Alert>
          )}

          <Section title="Trigger a run" description="Runs use the current period's key. If that key already succeeded, the run is recorded as Skipped.">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={triggerJob} onValueChange={setTriggerJob}>
                <SelectTrigger className="w-[280px]" aria-label="Job to run">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JOB_DEFS.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="font-mono text-[11px] text-muted-foreground">key {currentRunKey(triggerJob)}</span>
              <Gated menuKey="admin.jobs" action="X">
                <Button size="sm" onClick={() => setConfirmTrigger(true)}>
                  <Play /> Trigger now
                </Button>
              </Gated>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {JOB_DEFS.find((j) => j.id === triggerJob)?.description} Schedule: {JOB_DEFS.find((j) => j.id === triggerJob)?.schedule}.
            </p>
          </Section>

          <DataTable
            columns={columns}
            data={data}
            searchKeys={["runKey", "message", "id"]}
            searchPlaceholder="Search run key or message…"
            filters={
              <>
                <FilterSelect label="Job" value={jobFilter} onValueChange={setJobFilter} width="w-[220px]" options={JOB_DEFS.map((j) => ({ value: j.id, label: j.label }))} />
                <FilterSelect label="Status" value={statusFilter} onValueChange={setStatusFilter} options={(Object.keys(STATUS_META) as JobStatus[]).map((s) => ({ value: s, label: STATUS_META[s].label }))} />
              </>
            }
            rowTone={(r) => (r.status === "failed" ? "danger" : undefined)}
            exportName="job-runs"
            emptyIcon={Cog}
            emptyTitle="No runs match"
            emptyDescription="Clear the filters to see the full run ledger."
          />
        </>
      )}

      <ConfirmDialog
        open={!!retrying}
        onOpenChange={(v) => !v && setRetrying(null)}
        title={`Retry ${retrying ? jobLabel(retrying.jobId) : ""} for ${retrying?.runKey ?? ""}?`}
        description="The run re-executes with the same key. It is safe to retry: records already processed are detected and skipped."
        confirmLabel="Retry run"
        onConfirm={() => retrying && retry(retrying)}
      />
      <ConfirmDialog
        open={confirmTrigger}
        onOpenChange={setConfirmTrigger}
        title={`Run ${jobLabel(triggerJob)} now?`}
        description={`Run key ${currentRunKey(triggerJob)}. Manual runs are attributed to you in the audit log.`}
        confirmLabel="Run now"
        onConfirm={trigger}
      />
    </PageBody>
  );
}
