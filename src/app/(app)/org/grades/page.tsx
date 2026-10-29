"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Layers } from "lucide-react";
import { inr, inrCompact, num } from "@/lib/format";
import { COMPA_BUCKETS, GRADE_ROWS, type GradeRow } from "@/mock/masters";
import { MasterTable, type MasterField } from "@/components/org/master-table";
import { NumCell } from "@/components/data-table";
import { BarCompareChart } from "@/components/charts";
import { Hint } from "@/components/ui/primitives";

const FIELDS: MasterField[] = [
  { name: "id", label: "Grade code", required: true, lockOnEdit: true, placeholder: "G8", pattern: { re: /^G\d{1,2}$/, message: "Use G followed by a number, e.g. G8." } },
  { name: "label", label: "Grade name", required: true, placeholder: "Senior Director" },
  { name: "level", label: "Level", kind: "number", required: true, min: 1, max: 20 },
  { name: "min", label: "Band minimum (₹ / year)", kind: "number", required: true, min: 100000 },
  { name: "max", label: "Band maximum (₹ / year)", kind: "number", required: true, min: 100000, hint: "Midpoint is calculated as (min + max) ÷ 2." },
];

/** Six-bucket compa-ratio histogram, drawn inline in the row. */
function CompaMini({ row }: { row: GradeRow }) {
  const max = Math.max(1, ...row.compa.map((c) => c.count));
  return (
    <Hint text={row.compa.map((c) => `${c.bucket}: ${c.count}`).join(" · ")}>
      <div className="flex h-7 items-end gap-0.5" role="img" aria-label={`Compa-ratio distribution: ${row.compa.map((c) => `${c.bucket} ${c.count}`).join(", ")}`}>
        {row.compa.map((c, i) => (
          <span
            key={c.bucket}
            className="w-2.5 rounded-sm"
            style={{
              height: `${Math.max(8, (c.count / max) * 100)}%`,
              background: c.count === 0 ? "var(--muted)" : i < 2 ? "var(--warning)" : i > 3 ? "var(--serious)" : "var(--series-1)",
            }}
          />
        ))}
      </div>
    </Hint>
  );
}

export default function GradesPage() {
  const [rows, setRows] = React.useState<GradeRow[]>(GRADE_ROWS);

  const columns = React.useMemo<ColumnDef<GradeRow, unknown>[]>(
    () => [
      {
        accessorKey: "id",
        header: "Grade",
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-foreground">
              {row.original.id} · {row.original.label}
            </p>
            <p className="tnum text-[11px] text-muted-foreground">Level {row.original.level}</p>
          </div>
        ),
      },
      { accessorKey: "min", header: "Min", cell: ({ getValue }) => <NumCell>{inr(getValue() as number)}</NumCell> },
      { accessorKey: "mid", header: "Mid", cell: ({ getValue }) => <NumCell className="font-semibold">{inr(getValue() as number)}</NumCell> },
      { accessorKey: "max", header: "Max", cell: ({ getValue }) => <NumCell>{inr(getValue() as number)}</NumCell> },
      {
        id: "band",
        header: "Band spread",
        accessorFn: (r) => (r.max - r.min) / Math.max(1, r.min),
        cell: ({ row }) => <NumCell>{`${Math.round(((row.original.max - row.original.min) / Math.max(1, row.original.min)) * 100)}%`}</NumCell>,
      },
      { accessorKey: "headcount", header: "Employees", cell: ({ getValue }) => <NumCell>{num(getValue() as number)}</NumCell> },
      { accessorKey: "avgCtc", header: "Avg CTC", cell: ({ getValue }) => <NumCell>{(getValue() as number) ? inrCompact(getValue() as number) : "—"}</NumCell> },
      {
        accessorKey: "avgCompa",
        header: "Avg compa",
        cell: ({ getValue }) => {
          const v = getValue() as number;
          return <NumCell className={v && (v < 0.9 || v > 1.1) ? "text-warning-fg" : undefined}>{v ? v.toFixed(2) : "—"}</NumCell>;
        },
      },
      { id: "dist", header: "Compa distribution", enableSorting: false, cell: ({ row }) => <CompaMini row={row.original} /> },
    ],
    [],
  );

  const chartData = rows.map((r) => ({
    grade: r.id,
    ...Object.fromEntries(r.compa.map((c, i) => [`b${i}`, c.count])),
  }));

  return (
    <MasterTable<GradeRow>
      menuKey="org.grades"
      title="Grades & Bands"
      description="Salary bands in INR per grade. Compa-ratio = CTC ÷ band midpoint; below 0.90 is a retention risk, above 1.10 is paid past the market midpoint."
      noun="grade"
      plural="grades"
      icon={Layers}
      rows={rows}
      onRowsChange={setRows}
      columns={columns}
      fields={FIELDS}
      searchKeys={["id", "label"]}
      uniqueField={{ name: "id", get: (r) => r.id, message: "That grade code already exists." }}
      deactivateWarning={(r) => (r.headcount ? `${r.headcount} employees sit in ${r.id}. Their band is frozen until they are re-graded.` : undefined)}
      toValues={(r) => ({
        id: r?.id ?? "",
        label: r?.label ?? "",
        level: String(r?.level ?? rows.length + 1),
        min: r ? String(r.min) : "",
        max: r ? String(r.max) : "",
      })}
      fromValues={(v, existing) => {
        const min = Number(v.min);
        const max = Math.max(min, Number(v.max));
        return {
          id: v.id.toUpperCase(),
          label: v.label,
          level: Number(v.level),
          min,
          max,
          mid: Math.round((min + max) / 2),
          headcount: existing?.headcount ?? 0,
          avgCtc: existing?.avgCtc ?? 0,
          avgCompa: existing?.avgCompa ?? 0,
          compa: existing?.compa ?? COMPA_BUCKETS.map((b) => ({ bucket: b, count: 0 })),
        };
      }}
    >
      <BarCompareChart
        title="Compa-ratio distribution by grade"
        description={`Employees per compa-ratio bucket. ${num(rows.reduce((a, r) => a + r.headcount, 0))} employees in total.`}
        data={chartData}
        xKey="grade"
        stacked
        height={220}
        series={COMPA_BUCKETS.map((b, i) => ({ key: `b${i}`, label: b }))}
      />
    </MasterTable>
  );
}
