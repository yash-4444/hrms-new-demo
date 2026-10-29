"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpRight, CircleSlash } from "lucide-react";
import { inr, num } from "@/lib/format";
import { CURRENT_PERIOD, PAY_RUNS } from "@/mock/payroll";
import { LEAVE_REPORT_LOP, LEAVE_REPORT_LOP_TOTALS, type LopReportRow } from "@/mock/finance-time";
import { useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { PersonCell } from "@/components/people/person-cell";
import { MoneyCell, ReconcileCheck } from "@/components/finance/kit";

export function LopTab({ rows, exportName }: { rows: LopReportRow[]; exportName: string }) {
  const { can } = useApp();
  const run = PAY_RUNS[0];
  const days = rows.reduce((s, r) => s + r.lopDays, 0);
  const amount = rows.reduce((s, r) => s + r.lopAmount, 0);

  const columns = React.useMemo<ColumnDef<LopReportRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Employee",
        cell: ({ row }) => (
          <PersonCell name={row.original.name} subtitle={`${row.original.code} · ${row.original.designation}`} href={`/employees/${row.original.code}`} />
        ),
      },
      { accessorKey: "department", header: "Department", cell: ({ getValue }) => <MutedCell>{getValue() as string}</MutedCell> },
      { accessorKey: "branch", header: "Branch", cell: ({ getValue }) => <MutedCell>{getValue() as string}</MutedCell> },
      { accessorKey: "payableDays", header: "Payable days", cell: ({ getValue }) => <NumCell>{num(getValue() as number)}</NumCell> },
      {
        accessorKey: "lopDays",
        header: "LOP days",
        cell: ({ row }) => (
          <NumCell className={row.original.overrun ? "text-destructive-fg" : undefined}>
            {num(row.original.lopDays, row.original.lopDays % 1 ? 1 : 0)}
            {row.original.overrun && (
              <Badge variant="outline" className="ml-1.5 border-destructive/30 text-destructive-fg">
                exceeds payable
              </Badge>
            )}
          </NumCell>
        ),
      },
      { accessorKey: "perDayRate", header: "Per-day rate", cell: ({ getValue }) => <MoneyCell value={getValue() as number} /> },
      { accessorKey: "lopAmount", header: "LOP deduction", cell: ({ getValue }) => <MoneyCell value={getValue() as number} className="font-semibold" /> },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-3">
      <StatRow cols={3}>
        <StatTile label="Employees with LOP" value={num(rows.length)} icon={CircleSlash} hint={`${CURRENT_PERIOD.label} pay run`} />
        <StatTile label="LOP days" value={num(days, 1)} />
        <StatTile label="LOP deduction" value={inr(amount, { decimals: false })} tone="accent" hint="Earned gross ÷ payable days × LOP days" />
      </StatRow>

      <ReconcileCheck
        label="Agrees with the pay run"
        leftLabel="LOP employees in this report (all scopes)"
        left={LEAVE_REPORT_LOP_TOTALS.employees}
        rightLabel={`${run.code} LOP employees`}
        right={run.lopEmployeeCount}
        format={(v) => num(v)}
      />

      <DataTable<LopReportRow>
        columns={columns}
        data={rows}
        getRowId={(r) => r.code}
        searchKeys={["name", "code", "department"]}
        exportName={exportName}
        emptyIcon={CircleSlash}
        emptyTitle="No loss of pay in scope this month"
        emptyDescription="Nobody in scope has unapproved absence or LOP leave in September 2026."
        rowTone={(r) => (r.overrun ? "danger" : undefined)}
        toolbar={
          can("payroll.runs", "V") ? (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/payroll/runs/${run.id}`}>
                Open {run.code} <ArrowUpRight />
              </Link>
            </Button>
          ) : undefined
        }
      />
      {LEAVE_REPORT_LOP.length !== rows.length && (
        <p className="text-[11px] text-muted-foreground">
          Showing {num(rows.length)} of {num(LEAVE_REPORT_LOP.length)} LOP employees after filters.
        </p>
      )}
    </div>
  );
}
