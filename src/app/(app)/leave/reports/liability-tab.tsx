"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Landmark, Wallet } from "lucide-react";
import { inr, num } from "@/lib/format";
import { liabilityByDepartment, type LiabilityRow } from "@/mock/finance-time";
import { BarCompareChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { PersonCell } from "@/components/people/person-cell";
import { Section } from "@/components/shell/page";
import { MoneyCell, ReconcileCheck } from "@/components/finance/kit";

export function LiabilityTab({ rows, exportName }: { rows: LiabilityRow[]; exportName: string }) {
  const depts = React.useMemo(() => liabilityByDepartment(rows), [rows]);
  const total = rows.reduce((s, r) => s + r.liability, 0);
  const deptTotal = depts.reduce((s, d) => s + d.liability, 0);
  const days = rows.reduce((s, r) => s + r.elBalance, 0);

  const columns = React.useMemo<ColumnDef<LiabilityRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Employee",
        cell: ({ row }) => (
          <PersonCell name={row.original.name} subtitle={`${row.original.code} · ${row.original.gradeId}`} href={`/employees/${row.original.code}`} />
        ),
      },
      { accessorKey: "department", header: "Department", cell: ({ getValue }) => <MutedCell>{getValue() as string}</MutedCell> },
      { accessorKey: "elBalance", header: "EL balance (days)", cell: ({ getValue }) => <NumCell>{num(getValue() as number, 2)}</NumCell> },
      { accessorKey: "monthlyBasic", header: "Monthly basic", cell: ({ getValue }) => <MoneyCell value={getValue() as number} /> },
      {
        accessorKey: "perDayBasic",
        header: "Per-day basic (÷ 30)",
        cell: ({ getValue }) => <NumCell>{inr(getValue() as number, { decimals: true })}</NumCell>,
      },
      { accessorKey: "liability", header: "Liability", cell: ({ getValue }) => <MoneyCell value={getValue() as number} className="font-semibold" /> },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-3">
      <StatRow cols={3}>
        <StatTile label="Encashment liability" value={inr(total, { decimals: false })} icon={Landmark} tone="accent" hint="Provision for the balance sheet" />
        <StatTile label="Encashable EL days" value={num(days, 1)} icon={Wallet} hint={`${num(rows.length)} employees with a positive balance`} />
        <StatTile label="Average per employee" value={inr(rows.length ? Math.round(total / rows.length) : 0, { decimals: false })} />
      </StatRow>

      <ReconcileCheck
        label="Provision reconciles"
        leftLabel="Σ departments"
        left={deptTotal}
        rightLabel="Σ employee rows"
        right={total}
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <BarCompareChart
          title="Liability by department"
          description="Encashable EL × per-day basic"
          data={depts}
          xKey="department"
          series={[{ key: "liability", label: "Liability" }]}
          valueFormat={(v) => inr(v, { decimals: false })}
          horizontal
        />
        <Section title="Department summary" bodyClassName="p-0">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">Department</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Employees</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">EL days</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Liability</th>
              </tr>
            </thead>
            <tbody>
              {depts.map((d) => (
                <tr key={d.departmentId} className="border-t border-border">
                  <td className="px-3 py-1.5">{d.department}</td>
                  <td className="tnum px-3 py-1.5 text-right">{num(d.employees)}</td>
                  <td className="tnum px-3 py-1.5 text-right">{num(d.days, 2)}</td>
                  <td className="tnum px-3 py-1.5 text-right font-medium">{inr(d.liability, { decimals: false })}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-semibold">
                <td className="px-3 py-2">Total</td>
                <td className="tnum px-3 py-2 text-right">{num(rows.length)}</td>
                <td className="tnum px-3 py-2 text-right">{num(days, 2)}</td>
                <td className="tnum px-3 py-2 text-right">{inr(deptTotal, { decimals: false })}</td>
              </tr>
            </tfoot>
          </table>
        </Section>
      </div>

      <DataTable<LiabilityRow>
        columns={columns}
        data={rows}
        getRowId={(r) => r.code}
        searchKeys={["name", "code", "department"]}
        exportName={exportName}
        emptyIcon={Landmark}
        emptyTitle="No encashable balance in scope"
        emptyDescription="Nobody in scope carries an Earned Leave balance on the India payroll."
      />
    </div>
  );
}
