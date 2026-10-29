"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { BadgeCheck } from "lucide-react";
import { num } from "@/lib/format";
import { DEPARTMENTS, GRADES, deptName, gradeById } from "@/mock/org";
import { DESIGNATION_ROWS, type DesignationRow } from "@/mock/masters";
import { MasterTable, type MasterField } from "@/components/org/master-table";
import { MutedCell, NumCell } from "@/components/data-table";
import { Badge } from "@/components/ui/primitives";
import { FilterSelect } from "@/components/ui/overlays";

const TRACKS: DesignationRow["track"][] = ["Individual contributor", "People manager", "Leadership"];

const FIELDS: MasterField[] = [
  { name: "title", label: "Designation title", required: true, wide: true, placeholder: "Principal Engineer" },
  { name: "departmentId", label: "Department", kind: "select", required: true, options: DEPARTMENTS.map((d) => ({ value: d.id, label: d.name })) },
  { name: "gradeId", label: "Default grade", kind: "select", required: true, options: GRADES.map((g) => ({ value: g.id, label: g.label })), hint: "Pre-fills the grade on offers and promotions." },
  { name: "track", label: "Career track", kind: "select", required: true, options: TRACKS.map((t) => ({ value: t, label: t })) },
];


export default function DesignationsPage() {
  const [rows, setRows] = React.useState<DesignationRow[]>(DESIGNATION_ROWS);
  const [dept, setDept] = React.useState("all");
  const [track, setTrack] = React.useState("all");

  const columns = React.useMemo<ColumnDef<DesignationRow, unknown>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Designation",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-medium text-foreground">{row.original.title}</p>
            <p className="tnum text-[11px] text-muted-foreground">{row.original.id}</p>
          </div>
        ),
      },
      { id: "dept", header: "Department", accessorFn: (r) => deptName(r.departmentId), cell: ({ getValue }) => <MutedCell>{getValue() as string}</MutedCell> },
      { id: "grade", header: "Grade", accessorFn: (r) => r.gradeId, cell: ({ row }) => <Badge variant="outline">{gradeById(row.original.gradeId)?.label ?? row.original.gradeId}</Badge> },
      {
        accessorKey: "track",
        header: "Track",
        cell: ({ getValue }) => {
          const t = getValue() as string;
          return <Badge variant={t === "Leadership" ? "soft" : "muted"}>{t}</Badge>;
        },
      },
      { accessorKey: "headcount", header: "Employees", cell: ({ getValue }) => <NumCell>{num(getValue() as number)}</NumCell> },
    ],
    [],
  );

  const total = rows.reduce((a, r) => a + r.headcount, 0);

  return (
    <MasterTable<DesignationRow>
      menuKey="org.designations"
      title="Designations"
      description={`${num(rows.length)} titles across ${DEPARTMENTS.length} departments, mapped to a default grade and career track. Employee counts reconcile to ${num(total)} people.`}
      noun="designation"
      plural="designations"
      icon={BadgeCheck}
      rows={rows}
      onRowsChange={setRows}
      columns={columns}
      fields={FIELDS}
      searchKeys={["title", "id"]}
      filter={(r) => (dept === "all" || r.departmentId === dept) && (track === "all" || r.track === track)}
      filters={
        <>
          <FilterSelect label="Department" value={dept} onValueChange={setDept} options={DEPARTMENTS.map((d) => ({ value: d.id, label: d.name }))} width="w-[190px]" />
          <FilterSelect label="Track" value={track} onValueChange={setTrack} options={TRACKS.map((t) => ({ value: t, label: t }))} width="w-[200px]" />
        </>
      }
      uniqueField={{ name: "title", get: (r) => r.title, message: "This designation already exists." }}
      deactivateWarning={(r) => (r.headcount ? `${r.headcount} employees currently hold this title — they keep it, but it can't be used on new offers.` : undefined)}
      toValues={(r) => ({
        title: r?.title ?? "",
        departmentId: r?.departmentId ?? "ENG",
        gradeId: r?.gradeId ?? "G2",
        track: r?.track ?? "Individual contributor",
      })}
      fromValues={(v, existing, all) => ({
        id: existing?.id ?? `DSG-${String(all.length + 1).padStart(3, "0")}`,
        title: v.title,
        departmentId: v.departmentId,
        gradeId: v.gradeId,
        track: v.track as DesignationRow["track"],
        headcount: existing?.headcount ?? 0,
      })}
    />
  );
}
