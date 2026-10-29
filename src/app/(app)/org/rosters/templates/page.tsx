"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarRange, Copy, LayoutGrid } from "lucide-react";
import { num } from "@/lib/format";
import { OFF, ROSTER_TEMPLATE_ROWS, SHIFT_GROUP_ROWS, SHIFT_ROWS, shiftById, shiftHours, type RosterTemplateRow } from "@/mock/masters";
import { MasterTable, type MasterField } from "@/components/org/master-table";
import { ShiftChip } from "@/components/org/bits";
import { mockAction, useApp } from "@/components/app-state";
import { MutedCell, NumCell } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/overlays";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SHIFT_OPTIONS = [{ value: OFF, label: "Weekly off" }, ...SHIFT_ROWS.map((s) => ({ value: s.id, label: `${s.id} · ${s.name}` }))];

const FIELDS: MasterField[] = [
  { name: "name", label: "Template name", required: true, wide: true },
  { name: "shiftGroupId", label: "Shift group", kind: "select", required: true, options: SHIFT_GROUP_ROWS.map((g) => ({ value: g.id, label: g.name })) },
  { name: "cycleDays", label: "Cycle", kind: "select", required: true, options: [{ value: "7", label: "7 days" }, { value: "14", label: "14 days (repeats week 1)" }] },
  ...DAYS.map((d, i) => ({ name: `d${i}`, label: d, kind: "select" as const, required: true, options: SHIFT_OPTIONS })),
];

const weeklyHours = (pattern: string[]) =>
  pattern.reduce((a, p) => {
    const s = p === OFF ? undefined : shiftById(p);
    return a + (s ? shiftHours(s) : 0);
  }, 0);

export default function RosterTemplatesPage() {
  const [rows, setRows] = React.useState<RosterTemplateRow[]>(ROSTER_TEMPLATE_ROWS);
  const { can } = useApp();
  const canCreate = can("org.roster_templates", "C");

  const duplicate = React.useCallback(
    (r: RosterTemplateRow) => {
      setRows((rs) => [{ ...r, id: `RT-${String(rs.length + 1).padStart(2, "0")}`, name: `${r.name} (copy)`, usedBy: 0 }, ...rs]);
      mockAction(`${r.name} duplicated`, { description: "Edit the copy's pattern before applying it to a roster." });
    },
    [],
  );

  const columns = React.useMemo<ColumnDef<RosterTemplateRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Template",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-medium text-foreground">{row.original.name}</p>
            <p className="tnum text-[11px] text-muted-foreground">
              {row.original.id} · {row.original.cycleDays}-day cycle
            </p>
          </div>
        ),
      },
      {
        id: "pattern",
        header: "Pattern (Mon → Sun)",
        enableSorting: false,
        accessorFn: (r) => r.pattern.join(" "),
        cell: ({ row }) => (
          <div className="grid grid-cols-7 gap-0.5">
            {row.original.pattern.map((p, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <span className="text-[9px] font-semibold uppercase text-muted-foreground">{DAYS[i]}</span>
                <ShiftChip id={p} compact className="w-full justify-center px-1" />
              </div>
            ))}
          </div>
        ),
      },
      { id: "hours", header: "Hours / week", accessorFn: (r) => weeklyHours(r.pattern), cell: ({ getValue }) => <NumCell>{`${(getValue() as number).toFixed(1)} h`}</NumCell> },
      { id: "group", header: "Shift group", accessorFn: (r) => SHIFT_GROUP_ROWS.find((g) => g.id === r.shiftGroupId)?.name ?? r.shiftGroupId, cell: ({ getValue }) => <MutedCell>{getValue() as string}</MutedCell> },
      { accessorKey: "usedBy", header: "Employees on it", cell: ({ getValue }) => <NumCell>{num(getValue() as number)}</NumCell> },
    ],
    [],
  );

  return (
    <MasterTable<RosterTemplateRow>
      menuKey="org.roster_templates"
      title="Roster Templates"
      description="Reusable weekly patterns. Apply one to a shift group from the roster board and the whole week is filled in a click; weekly hours are checked against the 48-hour limit."
      noun="roster template"
      plural="roster templates"
      icon={CalendarRange}
      rows={rows}
      onRowsChange={setRows}
      columns={columns}
      fields={FIELDS}
      dialogSize="lg"
      searchKeys={["name", "id"]}
      headerActions={
        <Button size="sm" variant="outline" asChild>
          <Link href="/org/rosters">
            <LayoutGrid aria-hidden />
            Roster board
          </Link>
        </Button>
      }
      rowActions={(r) => (
        <DropdownMenuItem disabled={!canCreate} onSelect={() => duplicate(r)}>
          <Copy aria-hidden />
          Duplicate
        </DropdownMenuItem>
      )}
      uniqueField={{ name: "name", get: (r) => r.name, message: "A template with this name already exists." }}
      deactivateWarning={(r) => (r.usedBy ? `${r.usedBy} employees' rosters were generated from this template. Published weeks are not changed.` : undefined)}
      toValues={(r) => ({
        name: r?.name ?? "",
        shiftGroupId: r?.shiftGroupId ?? "SG-01",
        cycleDays: String(r?.cycleDays ?? 7),
        ...Object.fromEntries(DAYS.map((_, i) => [`d${i}`, r?.pattern[i] ?? (i < 5 ? "GEN" : OFF)])),
      })}
      fromValues={(v, existing, all) => ({
        id: existing?.id ?? `RT-${String(all.length + 1).padStart(2, "0")}`,
        name: v.name,
        cycleDays: (v.cycleDays === "14" ? 14 : 7) as 7 | 14,
        pattern: DAYS.map((_, i) => v[`d${i}`]),
        shiftGroupId: v.shiftGroupId,
        usedBy: existing?.usedBy ?? 0,
      })}
    />
  );
}
