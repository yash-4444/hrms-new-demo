"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, Minus, Briefcase } from "lucide-react";
import { num } from "@/lib/format";
import { EMPLOYMENT_TYPE_ROWS, type EmploymentTypeRow } from "@/mock/masters";
import { MasterTable, type MasterField } from "@/components/org/master-table";
import { MutedCell, NumCell } from "@/components/data-table";

const FIELDS: MasterField[] = [
  { name: "id", label: "Code", required: true, lockOnEdit: true, placeholder: "PT", pattern: { re: /^[A-Z]{2,4}$/, message: "2–4 uppercase letters." } },
  { name: "name", label: "Name", required: true, placeholder: "Part-time" },
  { name: "probationMonths", label: "Probation (months)", kind: "number", required: true, min: 0, max: 12 },
  { name: "noticeDays", label: "Notice period (days)", kind: "number", required: true, min: 0, max: 120 },
  { name: "pf", label: "Provident Fund applicable", kind: "switch" },
  { name: "esi", label: "ESI applicable", kind: "switch", hint: "Only for gross wages up to ₹21,000 a month." },
  { name: "gratuity", label: "Gratuity eligible", kind: "switch" },
  { name: "leavePolicy", label: "Leave policy", required: true },
];

function Flag({ on, label }: { on: boolean; label: string }) {
  return on ? (
    <span className="inline-flex items-center gap-1 text-xs text-success-fg">
      <Check className="size-3.5" aria-hidden />
      <span className="sr-only">{label}: </span>Yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Minus className="size-3.5" aria-hidden />
      <span className="sr-only">{label}: </span>No
    </span>
  );
}

export default function EmploymentTypesPage() {
  const [rows, setRows] = React.useState<EmploymentTypeRow[]>(EMPLOYMENT_TYPE_ROWS);
  const total = rows.reduce((a, r) => a + r.headcount, 0);

  const columns = React.useMemo<ColumnDef<EmploymentTypeRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Employment type",
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-foreground">{row.original.name}</p>
            <p className="tnum text-[11px] text-muted-foreground">{row.original.id}</p>
          </div>
        ),
      },
      { accessorKey: "probationMonths", header: "Probation", cell: ({ getValue }) => <NumCell>{(getValue() as number) ? `${getValue()} months` : "None"}</NumCell> },
      { accessorKey: "noticeDays", header: "Notice", cell: ({ getValue }) => <NumCell>{`${getValue()} days`}</NumCell> },
      { accessorKey: "pf", header: "PF", cell: ({ getValue }) => <Flag on={getValue() as boolean} label="PF" /> },
      { accessorKey: "esi", header: "ESI", cell: ({ getValue }) => <Flag on={getValue() as boolean} label="ESI" /> },
      { accessorKey: "gratuity", header: "Gratuity", cell: ({ getValue }) => <Flag on={getValue() as boolean} label="Gratuity" /> },
      { accessorKey: "leavePolicy", header: "Leave policy", cell: ({ getValue }) => <MutedCell>{getValue() as string}</MutedCell> },
      { accessorKey: "headcount", header: "Employees", cell: ({ getValue }) => <NumCell>{num(getValue() as number)}</NumCell> },
    ],
    [],
  );

  return (
    <MasterTable<EmploymentTypeRow>
      menuKey="org.employment_types"
      title="Employment Types"
      description={`How someone is engaged decides probation, notice and statutory eligibility. ${num(total)} employees are classified — the full directory.`}
      noun="employment type"
      plural="employment types"
      icon={Briefcase}
      rows={rows}
      onRowsChange={setRows}
      columns={columns}
      fields={FIELDS}
      searchKeys={["name", "id", "leavePolicy"]}
      uniqueField={{ name: "id", get: (r) => r.id, message: "That code is already used." }}
      deactivateWarning={(r) => (r.headcount ? `${r.headcount} employees are on this type. They keep it until their contract is changed.` : undefined)}
      toValues={(r) => ({
        id: r?.id ?? "",
        name: r?.name ?? "",
        probationMonths: String(r?.probationMonths ?? 0),
        noticeDays: String(r?.noticeDays ?? 30),
        pf: String(r?.pf ?? true),
        esi: String(r?.esi ?? false),
        gratuity: String(r?.gratuity ?? true),
        leavePolicy: r?.leavePolicy ?? "Standard — India 2026",
      })}
      fromValues={(v, existing) => ({
        id: v.id.toUpperCase(),
        name: v.name,
        probationMonths: Number(v.probationMonths),
        noticeDays: Number(v.noticeDays),
        pf: v.pf === "true",
        esi: v.esi === "true",
        gratuity: v.gratuity === "true",
        leavePolicy: v.leavePolicy,
        headcount: existing?.headcount ?? 0,
      })}
    />
  );
}
