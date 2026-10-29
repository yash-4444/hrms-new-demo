"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Inbox, RotateCcw } from "lucide-react";
import { fmtTime, num } from "@/lib/format";
import type { FailedPunch, IngestBatch } from "@/mock/finance-time";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/overlays";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { Gated, Section } from "@/components/shell/page";
import { FinStatus } from "@/components/finance/kit";

/** Reasons a replay cannot fix — they need a master-data change first. */
export const NEEDS_MASTER_FIX = ["Enrolment id not mapped to an employee", "Employee inactive on the punch date"];

export function IngestTab({
  batches,
  failed,
  onReplay,
}: {
  batches: IngestBatch[];
  failed: FailedPunch[];
  onReplay: (ids: string[]) => void;
}) {
  const [confirm, setConfirm] = React.useState<{ ids: string[]; clear?: () => void } | null>(null);

  const batchCols = React.useMemo<ColumnDef<IngestBatch, unknown>[]>(
    () => [
      { accessorKey: "id", header: "Batch", cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span> },
      { accessorKey: "deviceId", header: "Device", cell: ({ getValue }) => <MutedCell>{getValue() as string}</MutedCell> },
      { accessorKey: "receivedAt", header: "Received at", cell: ({ getValue }) => <span className="tnum text-xs">{fmtTime(getValue() as string)}</span> },
      { accessorKey: "received", header: "Received", cell: ({ getValue }) => <NumCell>{num(getValue() as number)}</NumCell> },
      { accessorKey: "processed", header: "Processed", cell: ({ getValue }) => <NumCell className="text-success-fg">{num(getValue() as number)}</NumCell> },
      {
        id: "queued",
        header: "In queue",
        accessorFn: (b) => b.received - b.processed - b.failed,
        cell: ({ getValue }) => <NumCell>{num(getValue() as number)}</NumCell>,
      },
      {
        accessorKey: "failed",
        header: "Failed",
        cell: ({ getValue }) => (
          <NumCell className={(getValue() as number) > 0 ? "text-destructive-fg" : undefined}>{num(getValue() as number)}</NumCell>
        ),
      },
      {
        id: "state",
        header: "State",
        accessorFn: (b) => (b.failed > 0 ? "failed" : b.received > b.processed ? "received" : "processed"),
        cell: ({ getValue }) => <FinStatus status={getValue() as string} />,
      },
    ],
    [],
  );

  const failedCols = React.useMemo<ColumnDef<FailedPunch, unknown>[]>(
    () => [
      { accessorKey: "punchAt", header: "Punch time", cell: ({ getValue }) => <span className="tnum text-xs">{fmtTime(getValue() as string)}</span> },
      { accessorKey: "deviceId", header: "Device", cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span> },
      { accessorKey: "badgeId", header: "Badge id", cell: ({ getValue }) => <span className="tnum">{getValue() as string}</span> },
      {
        accessorKey: "employeeName",
        header: "Employee",
        cell: ({ row }) =>
          row.original.employeeCode ? (
            <span>
              {row.original.employeeName} <span className="text-[11px] text-muted-foreground">{row.original.employeeCode}</span>
            </span>
          ) : (
            <MutedCell>Unmapped badge</MutedCell>
          ),
      },
      { accessorKey: "reason", header: "Failure reason", cell: ({ getValue }) => <span className="text-xs">{getValue() as string}</span> },
      {
        id: "fix",
        header: "Fix",
        accessorFn: (p) => (NEEDS_MASTER_FIX.includes(p.reason) ? "Master data" : "Replay"),
        cell: ({ getValue }) => <MutedCell>{getValue() as string}</MutedCell>,
      },
    ],
    [],
  );

  const replayable = failed.filter((p) => !NEEDS_MASTER_FIX.includes(p.reason));

  return (
    <div className="flex flex-col gap-3">
      <Section
        title="Failed punches"
        description="Punches the ingestion job could not attach to an attendance day. Replay re-runs matching after a clock or template fix."
        actions={
          <Gated menuKey="time.devices" action="E">
            <Button size="sm" disabled={!replayable.length} onClick={() => setConfirm({ ids: failed.map((p) => p.id) })}>
              <RotateCcw /> Replay all failed
            </Button>
          </Gated>
        }
        bodyClassName="p-3"
      >
        <DataTable<FailedPunch>
          columns={failedCols}
          data={failed}
          getRowId={(p) => p.id}
          searchKeys={["employeeName", "badgeId", "deviceId", "reason"]}
          exportName="failed-punches"
          enableSelection
          emptyIcon={Inbox}
          emptyTitle="No failed punches"
          emptyDescription="Every punch received today was matched to an employee and an attendance day."
          bulkActions={(sel, clear) => (
            <Gated menuKey="time.devices" action="E">
              <Button size="sm" variant="outline" onClick={() => setConfirm({ ids: sel.map((p) => p.id), clear })}>
                <RotateCcw /> Replay {sel.length}
              </Button>
            </Gated>
          )}
        />
      </Section>

      <Section title="Ingestion queue" description="Batches pushed by devices today, newest first." bodyClassName="p-3">
        <DataTable<IngestBatch>
          columns={batchCols}
          data={batches}
          getRowId={(b) => b.id}
          searchKeys={["id", "deviceId"]}
          exportName="ingestion-batches"
          dense
          emptyIcon={Inbox}
          emptyTitle="No batches received today"
          emptyDescription="Devices push punches every two hours; the first batch lands at shift start."
          rowTone={(b) => (b.failed > 0 ? "warning" : undefined)}
        />
      </Section>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={`Replay ${confirm?.ids.length ?? 0} failed punch${confirm?.ids.length === 1 ? "" : "es"}?`}
        description="Each punch is matched again against the employee master and the device clock offset. Punches that still fail on an unmapped badge or an inactive employee stay in this list."
        confirmLabel="Replay punches"
        onConfirm={() => {
          if (confirm) onReplay(confirm.ids);
          confirm?.clear?.();
        }}
      />
    </div>
  );
}
