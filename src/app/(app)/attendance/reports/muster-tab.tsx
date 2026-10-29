"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { num } from "@/lib/format";
import { MUSTER_LEGEND, musterDaysIn, musterRoll, type MusterCode, type MusterRow } from "@/mock/finance-time";
import { DataTable, NumCell } from "@/components/data-table";
import { PersonCell } from "@/components/people/person-cell";
import { applyFilters, exportNameFor, type ReportFilters } from "./report-filters";

const CODE_CLASS: Record<MusterCode, string> = {
  P: "bg-success-soft text-success-fg",
  OT: "bg-info-soft text-info-fg",
  HD: "bg-warning-soft text-warning-fg",
  A: "bg-destructive-soft text-destructive-fg",
  L: "bg-primary-soft text-primary-soft-foreground",
  H: "bg-muted text-foreground",
  WO: "text-muted-foreground",
  "—": "text-muted-foreground",
  "": "",
};

export function MusterTab({ filters }: { filters: ReportFilters }) {
  const rows = React.useMemo(() => applyFilters(musterRoll(filters.month), filters), [filters]);
  const dim = musterDaysIn(filters.month);

  const columns = React.useMemo<ColumnDef<MusterRow, unknown>[]>(() => {
    const dayCols: ColumnDef<MusterRow, unknown>[] = Array.from({ length: dim }, (_, i) => {
      const iso = `${filters.month}-${String(i + 1).padStart(2, "0")}`;
      return {
        id: `d${i + 1}`,
        header: String(i + 1),
        accessorFn: (r) => r.days[i],
        enableSorting: false,
        cell: ({ row }) => {
          const code = row.original.days[i];
          return (
            <span
              title={`${format(parseISO(iso), "EEE dd MMM")}: ${MUSTER_LEGEND.find((l) => l.code === code)?.label ?? "Future"}`}
              className={cn(
                "tnum mx-auto flex h-5 min-w-6 items-center justify-center rounded-sm px-0.5 text-[10px] font-semibold",
                CODE_CLASS[code],
              )}
            >
              {code}
            </span>
          );
        },
      };
    });
    return [
      {
        accessorKey: "name",
        header: "Employee",
        cell: ({ row }) => (
          <PersonCell
            name={row.original.name}
            subtitle={`${row.original.code} · ${row.original.department}`}
            size={22}
            href={`/employees/${row.original.code}`}
          />
        ),
      },
      ...dayCols,
      { accessorKey: "present", header: "P", cell: ({ getValue }) => <NumCell>{num(getValue() as number)}</NumCell> },
      { accessorKey: "halfDays", header: "HD", cell: ({ getValue }) => <NumCell>{num(getValue() as number)}</NumCell> },
      {
        accessorKey: "absent",
        header: "A",
        cell: ({ getValue }) => (
          <NumCell className={(getValue() as number) > 0 ? "text-destructive-fg" : undefined}>
            {num(getValue() as number)}
          </NumCell>
        ),
      },
      { accessorKey: "leave", header: "L", cell: ({ getValue }) => <NumCell>{num(getValue() as number)}</NumCell> },
      { accessorKey: "holidays", header: "H", cell: ({ getValue }) => <NumCell>{num(getValue() as number)}</NumCell> },
      { accessorKey: "weeklyOffs", header: "WO", cell: ({ getValue }) => <NumCell>{num(getValue() as number)}</NumCell> },
      {
        accessorKey: "payableDays",
        header: "Payable",
        cell: ({ getValue }) => <NumCell className="font-semibold">{num(getValue() as number, 1)}</NumCell>,
      },
    ];
  }, [dim, filters.month]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground" aria-label="Legend">
        {MUSTER_LEGEND.map((l) => (
          <span key={l.code} className="inline-flex items-center gap-1">
            <span className={cn("flex h-4 min-w-6 items-center justify-center rounded-sm px-0.5 text-[10px] font-semibold", CODE_CLASS[l.code])}>
              {l.code}
            </span>
            {l.label}
          </span>
        ))}
        <span className="ml-auto">Payable = P + OT + ½·HD + L + H + WO</span>
      </div>
      <DataTable<MusterRow>
        columns={columns}
        data={rows}
        dense
        pageSize={20}
        getRowId={(r) => r.code}
        searchKeys={["name", "code", "department"]}
        searchPlaceholder="Search employee…"
        exportName={exportNameFor("muster-roll", filters)}
        emptyIcon={CalendarDays}
        emptyTitle="No one on the muster roll for these filters"
        emptyDescription="Widen the branch or department filter — the roll covers employees with a punch history in the period."
        rowTone={(r) => (r.absent >= 3 ? "danger" : undefined)}
      />
    </div>
  );
}
