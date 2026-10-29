"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarClock } from "lucide-react";
import { inr, num } from "@/lib/format";
import { sum } from "@/lib/utils";
import { TRAVEL_ADV_RECOVERY_RUNS } from "@/mock/finance-travel";
import { DataTable, MutedCell } from "@/components/data-table";
import { PersonCell } from "@/components/people/person-cell";
import { Section } from "@/components/shell/page";
import { MoneyCell, ReconcileCheck } from "@/components/finance/kit";
import type { AdvRow } from "./columns";

interface InstalmentRow {
  id: string;
  advanceId: string;
  employeeCode: string;
  employeeName: string;
  runId: string;
  run: string;
  instalment: string;
  amount: number;
}

const COLUMNS: ColumnDef<InstalmentRow, unknown>[] = [
  { accessorKey: "advanceId", header: "Advance", cell: ({ row }) => <span className="font-mono text-[11px]">{row.original.advanceId}</span> },
  {
    accessorKey: "employeeName",
    header: "Employee",
    cell: ({ row }) => <PersonCell name={row.original.employeeName} code={row.original.employeeCode} size={22} />,
  },
  { accessorKey: "run", header: "Pay run", cell: ({ row }) => <span className="text-xs">{row.original.run}</span> },
  { accessorKey: "runId", header: "Run ID", cell: ({ row }) => <MutedCell>{row.original.runId}</MutedCell> },
  { accessorKey: "instalment", header: "Instalment", cell: ({ row }) => <MutedCell>{row.original.instalment}</MutedCell> },
  { accessorKey: "amount", header: "Deduction", cell: ({ row }) => <MoneyCell value={row.original.amount} /> },
];

/**
 * Advances whose settlement deadline lapsed are recovered as a non-taxable
 * deduction in the next monthly pay runs. This lists every scheduled instalment.
 */
export function RecoverySection({ rows }: { rows: AdvRow[] }) {
  const recovering = rows.filter((r) => r.status === "recovering");
  const instalments: InstalmentRow[] = recovering.flatMap((r) =>
    r.recovery.map((p, i) => ({
      id: `${r.id}-${p.runId}`,
      advanceId: r.id,
      employeeCode: r.employeeCode,
      employeeName: r.employeeName,
      runId: p.runId,
      run: p.label,
      instalment: `${i + 1} of ${r.recovery.length}`,
      amount: p.amount,
    })),
  );
  const byRun = TRAVEL_ADV_RECOVERY_RUNS.map((run) => {
    const lines = instalments.filter((i) => i.runId === run.runId);
    return { ...run, count: lines.length, amount: sum(lines.map((l) => l.amount)) };
  });

  return (
    <Section
      title="Recovery through payroll"
      description="Overdue balances are deducted in the next monthly runs and appear as “Travel advance recovery” on the payslip, and enter Payroll Inputs as a one-time deduction when each period opens (October onwards)."
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {byRun.map((r) => (
            <div key={r.runId} className="rounded-md border border-border bg-subtle px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <CalendarClock className="size-3.5" aria-hidden /> {r.label} run
              </p>
              <p className="tnum mt-1 text-base font-semibold">{inr(r.amount, { decimals: false })}</p>
              <p className="text-[11px] text-muted-foreground">
                {num(r.count)} deduction{r.count === 1 ? "" : "s"} · {r.runId}
              </p>
            </div>
          ))}
        </div>
        <ReconcileCheck
          label="Schedule covers every recovering balance"
          left={sum(instalments.map((i) => i.amount))}
          right={sum(recovering.map((r) => r.outstanding))}
          leftLabel="Σ scheduled instalments"
          rightLabel="Σ outstanding on recovering advances"
        />
        <DataTable<InstalmentRow>
          columns={COLUMNS}
          data={instalments}
          getRowId={(r) => r.id}
          searchKeys={["advanceId", "employeeName", "run"]}
          searchPlaceholder="Search advance, employee or run…"
          exportName="travel-advance-recovery-schedule"
          pageSize={10}
          dense
          emptyIcon={CalendarClock}
          emptyTitle="No recoveries scheduled"
          emptyDescription="When an overdue advance is sent to payroll, its monthly instalments are listed here."
        />
      </div>
    </Section>
  );
}
