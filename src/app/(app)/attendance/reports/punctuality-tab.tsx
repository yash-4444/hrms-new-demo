"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { AlarmClock, LogOut, Timer, Users } from "lucide-react";
import { fmtDate, hm, inr, num } from "@/lib/format";
import { earlyGoers, lateComers, overtimeCost, type OvertimeCostRow, type PunctualityRow } from "@/mock/finance-time";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { PersonCell } from "@/components/people/person-cell";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { MoneyCell, ReconcileCheck } from "@/components/finance/kit";
import { applyFilters, exportNameFor, type ReportFilters } from "./report-filters";

const personCol = <T extends { name: string; code: string; department: string; branch: string }>(): ColumnDef<T, unknown> => ({
  accessorKey: "name",
  header: "Employee",
  cell: ({ row }) => (
    <PersonCell
      name={row.original.name}
      subtitle={`${row.original.code} · ${row.original.department}`}
      href={`/employees/${row.original.code}`}
    />
  ),
});

export function PunctualityTab({ filters, mode }: { filters: ReportFilters; mode: "late" | "early" }) {
  const rows = React.useMemo(
    () =>
      applyFilters(mode === "late" ? lateComers(filters.month) : earlyGoers(filters.month), filters).sort(
        (a, b) => b.days - a.days || b.totalMinutes - a.totalMinutes,
      ),
    [filters, mode],
  );
  const late = mode === "late";
  const totalDays = rows.reduce((s, r) => s + r.days, 0);
  const totalMinutes = rows.reduce((s, r) => s + r.totalMinutes, 0);

  const columns = React.useMemo<ColumnDef<PunctualityRow, unknown>[]>(
    () => [
      personCol<PunctualityRow>(),
      { accessorKey: "branch", header: "Branch", cell: ({ getValue }) => <MutedCell>{getValue() as string}</MutedCell> },
      { accessorKey: "days", header: late ? "Late days" : "Early-out days", cell: ({ getValue }) => <NumCell>{num(getValue() as number)}</NumCell> },
      { accessorKey: "avgMinutes", header: late ? "Avg late by" : "Avg left early by", cell: ({ getValue }) => <NumCell>{hm(getValue() as number)}</NumCell> },
      { accessorKey: "totalMinutes", header: "Total time", cell: ({ getValue }) => <NumCell>{hm(getValue() as number)}</NumCell> },
      {
        accessorKey: "worstMinutes",
        header: "Worst day",
        cell: ({ row }) => (
          <NumCell>
            {hm(row.original.worstMinutes)} <span className="font-normal text-muted-foreground">· {fmtDate(row.original.worstDate)}</span>
          </NumCell>
        ),
      },
      ...(late
        ? [
            {
              accessorKey: "withinGraceDays",
              header: "Within grace",
              cell: ({ getValue }) => <NumCell className="text-muted-foreground">{num(getValue() as number)}</NumCell>,
            } as ColumnDef<PunctualityRow, unknown>,
          ]
        : []),
    ],
    [late],
  );

  return (
    <div className="flex flex-col gap-3">
      <StatRow cols={3}>
        <StatTile label={late ? "Late-comers" : "Early-goers"} value={num(rows.length)} icon={Users} hint="Employees with at least one instance" />
        <StatTile label={late ? "Late instances" : "Early-out instances"} value={num(totalDays)} icon={late ? AlarmClock : LogOut} />
        <StatTile
          label="Time lost"
          value={hm(totalMinutes)}
          icon={Timer}
          hint={late ? "Minutes past the 09:30 threshold" : "Minutes before the 18:30 shift end"}
        />
      </StatRow>
      <DataTable<PunctualityRow>
        columns={columns}
        data={rows}
        getRowId={(r) => r.code}
        searchKeys={["name", "code", "department"]}
        exportName={exportNameFor(late ? "late-comers" : "early-goers", filters)}
        emptyIcon={late ? AlarmClock : LogOut}
        emptyTitle={late ? "No late arrivals in this period" : "No early exits in this period"}
        emptyDescription="Everyone in scope kept to the shift. Try another month or widen the filters."
        rowTone={(r) => (r.days >= 6 ? "warning" : undefined)}
      />
    </div>
  );
}

export function OvertimeTab({ filters }: { filters: ReportFilters }) {
  const rows = React.useMemo(
    () => applyFilters(overtimeCost(filters.month), filters).sort((a, b) => b.cost - a.cost),
    [filters],
  );
  const hours = Math.round(rows.reduce((s, r) => s + r.otHours, 0) * 10) / 10;
  const cost = rows.reduce((s, r) => s + r.cost, 0);
  const recomputed = rows.reduce((s, r) => s + Math.round(r.otHours * r.hourlyBasic * 2), 0);

  const columns = React.useMemo<ColumnDef<OvertimeCostRow, unknown>[]>(
    () => [
      personCol<OvertimeCostRow>(),
      { accessorKey: "branch", header: "Branch", cell: ({ getValue }) => <MutedCell>{getValue() as string}</MutedCell> },
      { accessorKey: "otDays", header: "OT days", cell: ({ getValue }) => <NumCell>{num(getValue() as number)}</NumCell> },
      { accessorKey: "otHours", header: "OT hours", cell: ({ getValue }) => <NumCell>{num(getValue() as number, 1)}</NumCell> },
      {
        accessorKey: "hourlyBasic",
        header: "Hourly basic",
        cell: ({ getValue }) => <NumCell>{inr(getValue() as number, { decimals: true })}</NumCell>,
      },
      { accessorKey: "cost", header: "OT cost (2×)", cell: ({ getValue }) => <MoneyCell value={getValue() as number} /> },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-3">
      <StatRow cols={3}>
        <StatTile label="Employees on overtime" value={num(rows.length)} icon={Users} />
        <StatTile label="Overtime hours" value={num(hours, 1)} icon={Timer} hint="Worked minutes above the 9-hour band" />
        <StatTile label="Overtime cost" value={inr(cost, { decimals: false })} tone="accent" hint="Hours × basic ÷ (days × 8) × 2" />
      </StatRow>
      <ReconcileCheck
        label="Cost check"
        leftLabel="Σ row costs"
        left={cost}
        rightLabel="Σ hours × hourly basic × 2"
        right={recomputed}
      />
      <DataTable<OvertimeCostRow>
        columns={columns}
        data={rows}
        getRowId={(r) => r.code}
        searchKeys={["name", "code", "department"]}
        exportName={exportNameFor("overtime", filters)}
        emptyIcon={Timer}
        emptyTitle="No overtime recorded"
        emptyDescription="Nobody in scope worked past the overtime band this month."
      />
    </div>
  );
}
