"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDownRight, ArrowUpRight, GitCompareArrows } from "lucide-react";
import { cn } from "@/lib/utils";
import { inr, num } from "@/lib/format";
import { runById, type PayRun } from "@/mock/payroll";
import {
  VARIANCE_REASON_LABEL,
  previousRunId,
  sumBy,
  varianceLines,
  type VarianceLine,
  type VarianceReason,
} from "@/mock/finance-run";
import { Badge } from "@/components/ui/primitives";
import { FilterSelect } from "@/components/ui/overlays";
import { DataTable } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { PersonCell } from "@/components/people/person-cell";
import { MoneyCell, ReconcileCheck } from "@/components/finance/kit";
import { Section } from "@/components/shell/page";

/* Variance register — every employee whose net pay moved, with the reasons. */

const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${inr(Math.abs(v), { decimals: false })}`;

const COLUMNS: ColumnDef<VarianceLine, unknown>[] = [
  {
    accessorKey: "name",
    header: "Employee",
    cell: ({ row }) => <PersonCell name={row.original.name} subtitle={`${row.original.code} · ${row.original.department}`} />,
  },
  {
    accessorKey: "prevNet",
    header: () => <span className="block text-right">Last month</span>,
    cell: ({ getValue }) => <MoneyCell value={Number(getValue())} />,
  },
  {
    accessorKey: "curNet",
    header: () => <span className="block text-right">This month</span>,
    cell: ({ getValue }) => <MoneyCell value={Number(getValue())} />,
  },
  {
    accessorKey: "delta",
    header: () => <span className="block text-right">Change</span>,
    cell: ({ getValue }) => {
      const v = Number(getValue());
      return (
        <span className={cn("tnum block text-right font-semibold", v < 0 ? "text-destructive-fg" : "text-success-fg")}>
          {signed(v)}
        </span>
      );
    },
  },
  {
    id: "reasons",
    accessorFn: (r) => r.primary,
    header: "Reasons",
    cell: ({ row }) => (
      <span className="flex flex-wrap gap-1">
        {row.original.drivers.map((d) => (
          <Badge key={d.reason} variant={d.reason === row.original.primary ? "soft" : "muted"} className="tnum">
            {VARIANCE_REASON_LABEL[d.reason]} {signed(d.amount)}
          </Badge>
        ))}
      </span>
    ),
  },
];

export function VarianceRegister({ run }: { run: PayRun }) {
  const [reason, setReason] = React.useState("all");
  const prev = runById(previousRunId(run.id) ?? "");
  const lines = varianceLines(run.id);
  const filtered = reason === "all" ? lines : lines.filter((l) => l.drivers.some((d) => d.reason === reason));
  const totalDelta = sumBy(lines, (l) => l.delta);

  const byReason = (Object.keys(VARIANCE_REASON_LABEL) as VarianceReason[]).map((r) => ({
    reason: r,
    count: lines.filter((l) => l.drivers.some((d) => d.reason === r)).length,
    amount: sumBy(lines, (l) => sumBy(l.drivers.filter((d) => d.reason === r), (d) => d.amount)),
  }));

  if (!prev) return null;
  return (
    <div className="flex flex-col gap-3">
      <StatRow cols={4}>
        <StatTile label={`Net pay · ${prev.label}`} value={inr(prev.totals.net, { decimals: false })} />
        <StatTile label={`Net pay · ${run.label}`} value={inr(run.totals.net, { decimals: false })} tone="accent" />
        <StatTile
          label="Change"
          value={signed(run.totals.net - prev.totals.net)}
          icon={run.totals.net >= prev.totals.net ? ArrowUpRight : ArrowDownRight}
        />
        <StatTile label="Employees with a change" value={num(lines.length)} icon={GitCompareArrows} hint={`of ${num(run.employeeCount)}`} />
      </StatRow>
      <ReconcileCheck
        label="Variance explained"
        leftLabel="Σ employee changes"
        left={totalDelta}
        rightLabel={`${run.code} net − ${prev.code} net`}
        right={run.totals.net - prev.totals.net}
        format={signed}
      />
      <Section title="Change by reason" description="Each employee's change is split into drivers that add back to it exactly.">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {byReason
            .filter((b) => b.count > 0)
            .map((b) => (
              <button
                key={b.reason}
                type="button"
                aria-pressed={reason === b.reason}
                onClick={() => setReason(reason === b.reason ? "all" : b.reason)}
                className={cn(
                  "rounded-md border p-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  reason === b.reason ? "border-primary/40 bg-primary-soft" : "border-border hover:bg-muted",
                )}
              >
                <span className="block text-xs font-medium">{VARIANCE_REASON_LABEL[b.reason]}</span>
                <span className="tnum mt-0.5 block text-sm font-semibold">{signed(b.amount)}</span>
                <span className="text-[11px] text-muted-foreground">{num(b.count)} employees</span>
              </button>
            ))}
        </div>
        {byReason.find((b) => b.reason === "leaver")?.count === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            No leavers between {prev.label} and {run.label} — exits are settled through full and final, not the run.
          </p>
        )}
      </Section>
      <DataTable<VarianceLine>
        columns={COLUMNS}
        data={filtered}
        getRowId={(l) => l.code}
        searchKeys={["name", "code", "department"]}
        exportName={`variance-register-${run.periodId}`}
        dense
        filters={
          <FilterSelect
            label="Reason"
            value={reason}
            onValueChange={setReason}
            width="w-[220px]"
            options={byReason.filter((b) => b.count > 0).map((b) => ({ value: b.reason, label: VARIANCE_REASON_LABEL[b.reason] }))}
          />
        }
        emptyIcon={GitCompareArrows}
        emptyTitle="No change for this reason"
        emptyDescription="Pick another reason, or clear the filter to see every employee whose pay moved."
      />
    </div>
  );
}
