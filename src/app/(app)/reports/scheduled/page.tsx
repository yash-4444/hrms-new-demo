"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarClock, MoreHorizontal, Pause, Pencil, Play, Plus, Send } from "lucide-react";
import { fmtDateTime } from "@/lib/format";
import { SCHEDULED_REPORTS, describeSchedule, type ScheduledReport } from "@/mock/platform";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, MutedCell } from "@/components/data-table";
import { Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/primitives";
import {
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  FilterSelect,
} from "@/components/ui/overlays";
import { TonePill } from "@/components/platform/kit";
import { ScheduleDialog } from "@/components/platform/schedule-dialog";

export default function ScheduledReportsPage() {
  const loading = useFakeLoad();
  const { can, persona } = useApp();
  const [rows, setRows] = React.useState<ScheduledReport[]>(SCHEDULED_REPORTS);
  const [moduleFilter, setModuleFilter] = React.useState("all");
  const [stateFilter, setStateFilter] = React.useState("all");
  const [dialog, setDialog] = React.useState<{ open: boolean; editing: ScheduledReport | null }>({ open: false, editing: null });
  const [pausing, setPausing] = React.useState<ScheduledReport | null>(null);

  const patch = (id: string, p: Partial<ScheduledReport>) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const canEdit = can("reports.scheduled", "E");

  const runNow = (r: ScheduledReport) => {
    patch(r.id, { lastStatus: "completed", lastRunAt: "2026-09-16T14:35:00" });
    mockAction(`${r.report} is running`, { description: `${r.format} will be emailed to ${r.recipients.length} recipient${r.recipients.length === 1 ? "" : "s"} in about a minute. The schedule is unchanged.`, tone: "info" });
  };

  const data = rows.filter(
    (r) => (moduleFilter === "all" || r.module === moduleFilter) && (stateFilter === "all" || (stateFilter === "paused" ? r.paused : !r.paused)),
  );

  const columns: ColumnDef<ScheduledReport, unknown>[] = [
    {
      accessorKey: "report",
      header: "Report",
      cell: ({ row }) => (
        <div className="text-xs">
          <p className="font-medium">{row.original.report}</p>
          <p className="text-[11px] text-muted-foreground">{row.original.module} · owner {row.original.owner}</p>
        </div>
      ),
    },
    { id: "frequency", header: "Frequency", cell: ({ row }) => <span className="text-xs">{describeSchedule(row.original.schedule)}</span> },
    {
      accessorKey: "nextRunAt",
      header: "Next run",
      cell: ({ row }) => (row.original.paused ? <TonePill tone="neutral" icon={Pause}>Paused</TonePill> : <span className="tnum text-xs">{fmtDateTime(row.original.nextRunAt)}</span>),
    },
    {
      accessorKey: "recipients",
      header: "Recipients",
      cell: ({ row }) => (
        <div className="max-w-[240px] text-xs">
          <p className="truncate">{row.original.recipients[0]}</p>
          {row.original.recipients.length > 1 && <p className="text-[11px] text-muted-foreground">+{row.original.recipients.length - 1} more</p>}
        </div>
      ),
    },
    { accessorKey: "format", header: "Format", cell: ({ row }) => <Badge variant="muted">{row.original.format}</Badge> },
    {
      accessorKey: "lastStatus",
      header: "Last run",
      cell: ({ row }) =>
        row.original.lastRunAt ? (
          <div className="flex flex-col gap-0.5">
            <StatusBadge status={row.original.lastStatus} />
            <span className="tnum text-[11px] text-muted-foreground">{fmtDateTime(row.original.lastRunAt)}</span>
          </div>
        ) : (
          <MutedCell>Not run yet</MutedCell>
        ),
    },
    {
      id: "__a",
      header: "",
      enableHiding: false,
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.report}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{r.report}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => runNow(r)}>
                  <Send /> Run now
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!canEdit} onSelect={() => setDialog({ open: true, editing: r })}>
                  <Pencil /> Edit schedule
                </DropdownMenuItem>
                {r.paused ? (
                  <DropdownMenuItem
                    disabled={!canEdit}
                    onSelect={() => {
                      patch(r.id, { paused: false });
                      mockAction(`${r.report} resumed`, { description: `Next run ${fmtDateTime(r.nextRunAt)}.` });
                    }}
                  >
                    <Play /> Resume
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem destructive disabled={!canEdit} onSelect={() => setPausing(r)}>
                    <Pause /> Pause
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  return (
    <PageBody>
      <PageHeader
        title="Scheduled Reports"
        description="Reports that build themselves and land in the right inboxes. Every delivery is a sign-in-protected link, never an attachment, and only to company addresses."
        actions={
          <Gated menuKey="reports.scheduled" action="C">
            <Button size="sm" onClick={() => setDialog({ open: true, editing: null })}>
              <Plus /> Schedule report
            </Button>
          </Gated>
        }
      />

      {loading ? (
        <TableSkeleton />
      ) : (
        <DataTable
          columns={columns}
          data={data}
          searchKeys={["report", "owner", "module"]}
          searchPlaceholder="Search reports…"
          filters={
            <>
              <FilterSelect label="Module" value={moduleFilter} onValueChange={setModuleFilter} options={[...new Set(rows.map((r) => r.module))].map((m) => ({ value: m, label: m }))} />
              <FilterSelect label="State" value={stateFilter} onValueChange={setStateFilter} options={[{ value: "active", label: "Active" }, { value: "paused", label: "Paused" }]} />
            </>
          }
          rowTone={(r) => (r.lastStatus === "failed" ? "danger" : undefined)}
          onRowClick={canEdit ? (r) => setDialog({ open: true, editing: r }) : undefined}
          exportName="scheduled-reports"
          emptyIcon={CalendarClock}
          emptyTitle="No scheduled reports"
          emptyDescription="Schedule a report to have it delivered automatically."
          emptyAction={
            <Gated menuKey="reports.scheduled" action="C">
              <Button size="sm" onClick={() => setDialog({ open: true, editing: null })}>
                <Plus /> Schedule report
              </Button>
            </Gated>
          }
        />
      )}

      <ScheduleDialog
        open={dialog.open}
        editing={dialog.editing}
        owner={persona.name}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        onSave={(r, isNew) => {
          setRows((prev) => (isNew ? [r, ...prev] : prev.map((x) => (x.id === r.id ? r : x))));
          mockAction(isNew ? `${r.report} scheduled` : `${r.report} schedule updated`, { description: `${describeSchedule(r.schedule)}. Next run ${fmtDateTime(r.nextRunAt)}.` });
        }}
      />

      <ConfirmDialog
        open={!!pausing}
        onOpenChange={(v) => !v && setPausing(null)}
        title={`Pause ${pausing?.report ?? ""}?`}
        description={`${pausing?.recipients.length ?? 0} recipient(s) stop receiving it until someone resumes the schedule. Missed runs are not back-filled.`}
        confirmLabel="Pause schedule"
        destructive
        onConfirm={() => {
          if (!pausing) return;
          patch(pausing.id, { paused: true });
          mockAction(`${pausing.report} paused`, { tone: "warning" });
        }}
      />
    </PageBody>
  );
}
