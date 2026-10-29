"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Landmark } from "lucide-react";
import { inr, inrCompact, num, pct } from "@/lib/format";
import { DEPARTMENTS, deptName } from "@/mock/org";
import { EMPLOYEES } from "@/mock/employees";
import { COST_CENTRE_ROWS, type CostCentreRow } from "@/mock/masters";
import { MasterTable, type MasterField } from "@/components/org/master-table";
import { EmployeeLink } from "@/components/org/bits";
import { MutedCell, NumCell } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { Progress } from "@/components/ui/primitives";

const GL = { re: /^\d{6}$/, message: "GL codes are 6 digits." };

const FIELDS: MasterField[] = [
  { name: "id", label: "Cost centre code", required: true, lockOnEdit: true, placeholder: "CC-4001", pattern: { re: /^CC-\d{4}$/, message: "Use the format CC-0000." } },
  { name: "name", label: "Name", required: true },
  { name: "departmentId", label: "Department", kind: "select", required: true, options: DEPARTMENTS.map((d) => ({ value: d.id, label: d.name })) },
  { name: "ownerCode", label: "Budget owner", kind: "select", required: true, options: EMPLOYEES.filter((e) => e.level <= 1).map((e) => ({ value: e.code, label: `${e.name} · ${e.designation}` })) },
  { name: "glSalary", label: "GL — salaries & wages", required: true, pattern: GL },
  { name: "glEmployerPf", label: "GL — employer PF / ESI", required: true, pattern: GL },
  { name: "glBonus", label: "GL — bonus & incentives", required: true, pattern: GL },
  { name: "glReimbursement", label: "GL — reimbursements", required: true, pattern: GL },
  { name: "annualBudget", label: "Annual people budget (INR)", kind: "number", required: true, min: 0 },
];

export default function CostCentresPage() {
  const [rows, setRows] = React.useState<CostCentreRow[]>(COST_CENTRE_ROWS);
  const monthly = rows.reduce((a, r) => a + r.monthlyCost, 0);
  const budget = rows.reduce((a, r) => a + r.annualBudget, 0);

  const columns = React.useMemo<ColumnDef<CostCentreRow, unknown>[]>(
    () => [
      {
        accessorKey: "id",
        header: "Cost centre",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-medium text-foreground">{row.original.name}</p>
            <p className="tnum text-[11px] text-muted-foreground">{row.original.id}</p>
          </div>
        ),
      },
      { id: "dept", header: "Department", accessorFn: (r) => deptName(r.departmentId), cell: ({ getValue }) => <MutedCell>{getValue() as string}</MutedCell> },
      { id: "owner", header: "Owner", accessorFn: (r) => r.ownerCode, cell: ({ row }) => <EmployeeLink code={row.original.ownerCode} /> },
      {
        id: "gl",
        header: "GL mapping",
        accessorFn: (r) => `${r.glSalary} ${r.glEmployerPf} ${r.glBonus} ${r.glReimbursement}`,
        cell: ({ row }) => (
          <div className="tnum grid grid-cols-2 gap-x-3 text-[11px] leading-tight">
            <span><span className="text-muted-foreground">Sal </span>{row.original.glSalary}</span>
            <span><span className="text-muted-foreground">PF </span>{row.original.glEmployerPf}</span>
            <span><span className="text-muted-foreground">Bon </span>{row.original.glBonus}</span>
            <span><span className="text-muted-foreground">Reimb </span>{row.original.glReimbursement}</span>
          </div>
        ),
      },
      { accessorKey: "headcount", header: "Headcount", cell: ({ getValue }) => <NumCell>{num(getValue() as number)}</NumCell> },
      { accessorKey: "monthlyCost", header: "Monthly CTC", cell: ({ getValue }) => <NumCell>{inr(getValue() as number)}</NumCell> },
      {
        id: "util",
        header: "Budget used",
        accessorFn: (r) => (r.monthlyCost * 12) / Math.max(1, r.annualBudget),
        cell: ({ row }) => {
          const u = (row.original.monthlyCost * 12) / Math.max(1, row.original.annualBudget);
          return (
            <div className="w-28">
              <div className="tnum mb-1 flex justify-between text-[11px]">
                <span>{pct(u * 100, 0)}</span>
                <span className="text-muted-foreground">{inrCompact(row.original.annualBudget)}</span>
              </div>
              <Progress value={u * 100} tone={u > 0.97 ? "warning" : "accent"} aria-label={`Budget used ${pct(u * 100, 0)}`} />
            </div>
          );
        },
      },
    ],
    [],
  );

  return (
    <MasterTable<CostCentreRow>
      menuKey="org.cost_centres"
      title="Cost Centres"
      description="Where people cost lands in the books. Every payroll component posts to the GL codes mapped here when the pay run's journal is exported to Finance."
      noun="cost centre"
      plural="cost centres"
      icon={Landmark}
      rows={rows}
      onRowsChange={setRows}
      columns={columns}
      fields={FIELDS}
      searchKeys={["id", "name", "glSalary"]}
      uniqueField={{ name: "id", get: (r) => r.id, message: "This cost centre code already exists." }}
      deactivateWarning={(r) => (r.headcount ? `${r.headcount} employees post their salary cost here. The next payroll journal will fail validation for them.` : undefined)}
      toValues={(r) => ({
        id: r?.id ?? "",
        name: r?.name ?? "",
        departmentId: r?.departmentId ?? "ENG",
        ownerCode: r?.ownerCode ?? "",
        glSalary: r?.glSalary ?? "",
        glEmployerPf: r?.glEmployerPf ?? "",
        glBonus: r?.glBonus ?? "",
        glReimbursement: r?.glReimbursement ?? "",
        annualBudget: r ? String(r.annualBudget) : "",
      })}
      fromValues={(v, existing) => ({
        id: v.id.toUpperCase(),
        name: v.name,
        departmentId: v.departmentId,
        ownerCode: v.ownerCode,
        glSalary: v.glSalary,
        glEmployerPf: v.glEmployerPf,
        glBonus: v.glBonus,
        glReimbursement: v.glReimbursement,
        headcount: existing?.headcount ?? 0,
        monthlyCost: existing?.monthlyCost ?? 0,
        annualBudget: Number(v.annualBudget),
      })}
    >
      <StatRow cols={3}>
        <StatTile label="Monthly people cost" value={inrCompact(monthly)} hint={`${inr(monthly)} across ${rows.length} cost centres`} icon={Landmark} />
        <StatTile label="Annual budget" value={inrCompact(budget)} hint="FY 2026-27 approved plan" />
        <StatTile label="Run-rate vs budget" value={pct(((monthly * 12) / Math.max(1, budget)) * 100, 1)} tone="good" hint="Annualised CTC ÷ budget" />
      </StatRow>
    </MasterTable>
  );
}
