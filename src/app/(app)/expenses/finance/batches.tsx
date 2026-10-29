"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Landmark } from "lucide-react";
import { fmtDate, inr } from "@/lib/format";
import { sum } from "@/lib/utils";
import { EXP_PAYOUT_BATCHES, type ExpFinanceRow, type ExpPayoutBatch } from "@/mock/finance-expense";
import { Section } from "@/components/shell/page";
import { DataTable, MutedCell } from "@/components/data-table";
import { DownloadButton, FinStatus, MoneyCell, ReconcileCheck } from "@/components/finance/kit";

/* ============================================================================
   Payout batches — every released claim sits in exactly one batch, so the
   batch totals must add up to the released claims. The check is on screen.
   ========================================================================== */

interface BatchRow extends ExpPayoutBatch {
  count: number;
  total: number;
}

export function PayoutBatches({ rows }: { rows: ExpFinanceRow[] }) {
  const released = rows.filter((r) => r.status === "released_payroll" || r.status === "released_direct");
  const batches: BatchRow[] = EXP_PAYOUT_BATCHES.map((b) => {
    const inBatch = rows.filter((r) => r.batchId === b.id);
    return { ...b, count: inBatch.length, total: sum(inBatch.map((r) => r.total)) };
  });

  const columns = React.useMemo<ColumnDef<BatchRow, unknown>[]>(
    () => [
      {
        accessorKey: "label",
        header: "Batch",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.label}</p>
            <p className="tnum text-[11px] text-muted-foreground">{row.original.id}</p>
          </div>
        ),
      },
      {
        accessorKey: "mode",
        header: "Payout route",
        cell: ({ row }) => (
          <FinStatus status={row.original.mode === "payroll" ? "released_payroll" : "released_direct"} />
        ),
      },
      { accessorKey: "payDate", header: "Pay date", cell: ({ row }) => fmtDate(row.original.payDate) },
      { accessorKey: "reference", header: "Reference", cell: ({ row }) => <MutedCell>{row.original.reference}</MutedCell> },
      { accessorKey: "count", header: "Claims", cell: ({ row }) => <MutedCell>{row.original.count}</MutedCell> },
      { accessorKey: "total", header: "Total", cell: ({ row }) => <MoneyCell value={row.original.total} /> },
      {
        id: "file",
        header: "",
        enableHiding: false,
        cell: ({ row }) => (
          <DownloadButton
            size="icon-sm"
            variant="ghost"
            disabled={row.original.count === 0}
            label="Download"
            fileName={
              row.original.mode === "payroll"
                ? `${row.original.id}-payroll-input.csv`
                : `${row.original.id}-HDFC-NEFT.txt`
            }
            description={`${row.original.count} claims · ${inr(row.original.total, { decimals: false })}`}
          />
        ),
      },
    ],
    [],
  );

  return (
    <Section
      title="Payout batches"
      description="Payroll releases are paid as a non-taxable reimbursement earning on the October 2026 run; direct payments go out in the next NEFT file."
      bodyClassName="flex flex-col gap-3"
    >
      <DataTable<BatchRow>
        columns={columns}
        data={batches}
        getRowId={(b) => b.id}
        exportName="expense-payout-batches"
        dense
        emptyIcon={Landmark}
        emptyTitle="No payout batches open"
        emptyDescription="Release a verified claim to payroll or direct payment to open a batch."
      />
      <ReconcileCheck
        label="Batches reconcile"
        left={sum(batches.map((b) => b.total))}
        right={sum(released.map((r) => r.total))}
        leftLabel={`Σ ${batches.length} batch totals`}
        rightLabel={`Σ ${released.length} released claims`}
      />
    </Section>
  );
}
