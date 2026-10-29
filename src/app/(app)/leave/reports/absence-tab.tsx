"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarX2 } from "lucide-react";
import { num } from "@/lib/format";
import { leaveTrend, type AbsenceRow } from "@/mock/finance-time";
import { BarCompareChart } from "@/components/charts";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { PersonCell } from "@/components/people/person-cell";
import { Hint } from "@/components/ui/primitives";

const dayCell = (v: number) => <NumCell className={v === 0 ? "font-normal text-muted-foreground" : undefined}>{num(v, v % 1 ? 1 : 0)}</NumCell>;

export function AbsenceTab({ rows, exportName }: { rows: AbsenceRow[]; exportName: string }) {
  const columns = React.useMemo<ColumnDef<AbsenceRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Employee",
        cell: ({ row }) => (
          <PersonCell name={row.original.name} subtitle={`${row.original.code} · ${row.original.designation}`} href={`/employees/${row.original.code}`} />
        ),
      },
      { accessorKey: "department", header: "Department", cell: ({ getValue }) => <MutedCell>{getValue() as string}</MutedCell> },
      { accessorKey: "el", header: "EL", cell: ({ getValue }) => dayCell(getValue() as number) },
      { accessorKey: "cl", header: "CL", cell: ({ getValue }) => dayCell(getValue() as number) },
      { accessorKey: "sl", header: "SL", cell: ({ getValue }) => dayCell(getValue() as number) },
      { accessorKey: "lop", header: "LOP", cell: ({ getValue }) => dayCell(getValue() as number) },
      { accessorKey: "other", header: "Other", cell: ({ getValue }) => dayCell(getValue() as number) },
      { accessorKey: "total", header: "Total days", cell: ({ getValue }) => <NumCell className="font-semibold">{num(getValue() as number, 1)}</NumCell> },
      { accessorKey: "spells", header: "Unplanned spells", cell: ({ getValue }) => dayCell(getValue() as number) },
      {
        accessorKey: "bradford",
        header: "Bradford factor",
        cell: ({ getValue }) => {
          const v = getValue() as number;
          return (
            <NumCell className={v >= 125 ? "text-destructive-fg" : v >= 50 ? "text-warning-fg" : undefined}>{num(v, v % 1 ? 1 : 0)}</NumCell>
          );
        },
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        Approved leave taken from 1 Apr 2026 to date.{" "}
        <Hint text="Spells² × unplanned days (CL, SL, LOP). 50+ prompts a conversation, 125+ a formal review.">
          <span tabIndex={0} className="cursor-help underline decoration-dotted underline-offset-2">
            How is the Bradford factor scored?
          </span>
        </Hint>
      </p>
      <DataTable<AbsenceRow>
        columns={columns}
        data={rows}
        getRowId={(r) => r.code}
        searchKeys={["name", "code", "department"]}
        exportName={exportName}
        emptyIcon={CalendarX2}
        emptyTitle="No absence recorded for these filters"
        emptyDescription="Nobody in scope has approved leave this financial year yet."
        rowTone={(r) => (r.bradford >= 125 ? "danger" : r.bradford >= 50 ? "warning" : undefined)}
      />
    </div>
  );
}

export function TrendTab({ codes }: { codes: Set<string> | null }) {
  const data = React.useMemo(() => leaveTrend(codes), [codes]);
  return (
    <BarCompareChart
      title="Leave trend"
      description="Approved leave days by month of start, FY 2026-27 to date"
      data={data}
      xKey="month"
      series={[
        { key: "EL", label: "Earned" },
        { key: "CL", label: "Casual" },
        { key: "SL", label: "Sick" },
        { key: "LOP", label: "Loss of pay" },
        { key: "Other", label: "Other" },
      ]}
      valueFormat={(v) => `${num(v, v % 1 ? 1 : 0)} d`}
      stacked
      height={280}
    />
  );
}
