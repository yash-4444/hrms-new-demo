"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Clock, Moon } from "lucide-react";
import { num } from "@/lib/format";
import { SHIFT_ROWS, shiftHours, type ShiftRow } from "@/mock/masters";
import { MasterTable, type MasterField } from "@/components/org/master-table";
import { shiftSwatch } from "@/components/org/bits";
import { MutedCell, NumCell } from "@/components/data-table";
import { Section } from "@/components/shell/page";
import { Badge } from "@/components/ui/primitives";

const WEEKLY_OFF = ["Sat, Sun", "Sun", "Sun + 2nd & 4th Sat", "Mon, Tue", "Rotational (2 days)"];
const COLOURS = [1, 2, 3, 4, 5, 6, 7, 8];
const COLOUR_NAME = ["Blue", "Teal", "Amber", "Green", "Rose", "Indigo", "Violet", "Slate"];

const FIELDS: MasterField[] = [
  { name: "id", label: "Shift code", required: true, lockOnEdit: true, placeholder: "SUP-W", pattern: { re: /^[A-Z][A-Z0-9-]{1,7}$/, message: "2–8 uppercase letters, digits or hyphens." } },
  { name: "name", label: "Shift name", required: true },
  { name: "start", label: "Start time", kind: "time", required: true },
  { name: "end", label: "End time", kind: "time", required: true, hint: "An end before the start makes it an overnight shift." },
  { name: "breakMin", label: "Break (minutes)", kind: "number", required: true, min: 0, max: 120 },
  { name: "graceMin", label: "Late-mark grace (minutes)", kind: "number", required: true, min: 0, max: 60 },
  { name: "weeklyOff", label: "Weekly-off pattern", kind: "select", required: true, options: WEEKLY_OFF.map((w) => ({ value: w, label: w })) },
  { name: "color", label: "Colour on the roster", kind: "select", required: true, options: COLOURS.map((c) => ({ value: String(c), label: COLOUR_NAME[c - 1] })) },
  { name: "timezone", label: "Timezone", kind: "select", required: true, options: ["Asia/Kolkata", "America/New_York"].map((t) => ({ value: t, label: t })) },
];

/** 24-hour strip showing when the shift runs — overnight shifts wrap. */
function Timeline({ s }: { s: ShiftRow }) {
  const toH = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h + m / 60;
  };
  const a = toH(s.start);
  const b = toH(s.end);
  const segs = b > a ? [[a, b]] : [[a, 24], [0, b]];
  return (
    <div className="relative h-2.5 w-40 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${s.start} to ${s.end}${s.overnight ? ", overnight" : ""}`}>
      {segs.map(([x, y], i) => (
        <span key={i} className="absolute inset-y-0 rounded-full" style={{ left: `${(x / 24) * 100}%`, width: `${((y - x) / 24) * 100}%`, background: shiftSwatch(s.color) }} />
      ))}
    </div>
  );
}

export default function ShiftsPage() {
  const [rows, setRows] = React.useState<ShiftRow[]>(SHIFT_ROWS);

  const columns = React.useMemo<ColumnDef<ShiftRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Shift",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="size-3 shrink-0 rounded-sm" style={{ background: shiftSwatch(row.original.color) }} aria-hidden />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 font-medium text-foreground">
                {row.original.name}
                {row.original.overnight && (
                  <Badge variant="muted">
                    <Moon className="size-3" aria-hidden />
                    Overnight
                  </Badge>
                )}
              </p>
              <p className="tnum text-[11px] text-muted-foreground">{row.original.id}</p>
            </div>
          </div>
        ),
      },
      {
        id: "time",
        header: "Timing",
        accessorFn: (r) => r.start,
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <span className="tnum text-xs">
              {row.original.start} – {row.original.end}
            </span>
            <Timeline s={row.original} />
          </div>
        ),
      },
      { id: "hours", header: "Net hours", accessorFn: (r) => shiftHours(r), cell: ({ getValue }) => <NumCell>{`${(getValue() as number).toFixed(2)} h`}</NumCell> },
      { accessorKey: "breakMin", header: "Break", cell: ({ getValue }) => <NumCell>{`${getValue()} min`}</NumCell> },
      { accessorKey: "graceMin", header: "Grace", cell: ({ getValue }) => <NumCell>{`${getValue()} min`}</NumCell> },
      { accessorKey: "weeklyOff", header: "Weekly off", cell: ({ getValue }) => <MutedCell>{getValue() as string}</MutedCell> },
      { accessorKey: "timezone", header: "Timezone", cell: ({ getValue }) => <span className="text-xs">{getValue() as string}</span> },
      { accessorKey: "employees", header: "Employees", cell: ({ getValue }) => <NumCell>{num(getValue() as number)}</NumCell> },
    ],
    [],
  );

  const total = rows.reduce((a, r) => a + r.employees, 0);

  return (
    <MasterTable<ShiftRow>
      menuKey="org.shifts"
      title="Shifts"
      description="Shift definitions used by attendance, overtime and the roster board. Grace decides the late mark; net hours after break drive the 540-minute overtime threshold."
      noun="shift"
      plural="shifts"
      icon={Clock}
      rows={rows}
      onRowsChange={setRows}
      columns={columns}
      fields={FIELDS}
      searchKeys={["name", "id", "weeklyOff"]}
      uniqueField={{ name: "id", get: (r) => r.id, message: "That shift code is already used." }}
      deactivateWarning={(r) => (r.employees ? `${r.employees} employees are on this shift today. Re-roster them before it stops resolving.` : undefined)}
      toValues={(r) => ({
        id: r?.id ?? "",
        name: r?.name ?? "",
        start: r?.start ?? "09:30",
        end: r?.end ?? "18:30",
        breakMin: String(r?.breakMin ?? 60),
        graceMin: String(r?.graceMin ?? 15),
        weeklyOff: r?.weeklyOff ?? "Sat, Sun",
        color: String(r?.color ?? 1),
        timezone: r?.timezone ?? "Asia/Kolkata",
      })}
      fromValues={(v, existing) => ({
        id: v.id.toUpperCase(),
        name: v.name,
        start: v.start,
        end: v.end,
        breakMin: Number(v.breakMin),
        graceMin: Number(v.graceMin),
        overnight: v.end <= v.start,
        weeklyOff: v.weeklyOff,
        color: Number(v.color),
        timezone: v.timezone,
        employees: existing?.employees ?? 0,
      })}
    >
      <Section title="Who is on which shift" description={`${num(total)} employees — every person in the directory resolves to exactly one shift.`}>
        <div className="flex h-3 w-full overflow-hidden rounded-full" role="img" aria-label="Employees by shift">
          {rows
            .filter((r) => r.employees)
            .map((r) => (
              <span key={r.id} style={{ width: `${(r.employees / Math.max(1, total)) * 100}%`, background: shiftSwatch(r.color) }} />
            ))}
        </div>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {rows
            .filter((r) => r.employees)
            .map((r) => (
              <li key={r.id} className="flex items-center gap-1.5 text-xs">
                <span className="size-2 rounded-full" style={{ background: shiftSwatch(r.color) }} aria-hidden />
                {r.name}
                <span className="tnum text-muted-foreground">{num(r.employees)}</span>
              </li>
            ))}
        </ul>
      </Section>
    </MasterTable>
  );
}
