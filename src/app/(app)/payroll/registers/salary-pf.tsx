"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Landmark, Table2 } from "lucide-react";
import { inr, num } from "@/lib/format";
import { TENANT } from "@/mock/org";
import type { PayRun } from "@/mock/payroll";
import { EPS_MONTHLY_CAP, registerLines, sumBy, type RegisterLine } from "@/mock/finance-run";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { PersonCell } from "@/components/people/person-cell";
import { MoneyCell, ReconcileCheck } from "@/components/finance/kit";

/* Salary and PF registers. */

const money = (key: keyof RegisterLine, label: string, strong = false): ColumnDef<RegisterLine, unknown> => ({
  accessorKey: key,
  header: () => <span className="block text-right">{label}</span>,
  cell: ({ getValue }) => <MoneyCell value={Number(getValue())} className={strong ? "font-semibold" : undefined} />,
});

const person: ColumnDef<RegisterLine, unknown> = {
  accessorKey: "name",
  header: "Employee",
  cell: ({ row }) => <PersonCell name={row.original.name} subtitle={`${row.original.code} · ${row.original.department}`} />,
};

const SALARY_COLUMNS: ColumnDef<RegisterLine, unknown>[] = [
  person,
  { accessorKey: "costCentre", header: "Cost centre", cell: ({ getValue }) => <MutedCell>{String(getValue())}</MutedCell> },
  {
    accessorKey: "paidDays",
    header: () => <span className="block text-right">Paid days</span>,
    cell: ({ row }) => (
      <NumCell>
        {num(row.original.paidDays, 1)}
        <span className="text-muted-foreground"> / {row.original.daysInMonth}</span>
      </NumCell>
    ),
  },
  money("basic", "Basic"),
  money("hra", "HRA"),
  money("conveyance", "Conveyance"),
  money("medical", "Medical"),
  money("lta", "LTA"),
  money("perf", "Perf. pay"),
  money("special", "Special"),
  money("overtime", "Overtime"),
  money("arrears", "Arrears"),
  money("gross", "Gross", true),
  money("pf", "PF"),
  money("esi", "ESI"),
  money("pt", "PT"),
  money("tds", "TDS"),
  money("lop", "LOP"),
  money("advance", "Advance"),
  money("net", "Net pay", true),
  money("employerCost", "Employer cost"),
];

export function SalaryRegister({ run }: { run: PayRun }) {
  const lines = registerLines(run.id);
  const t = run.totals;
  return (
    <div className="flex flex-col gap-3">
      <StatRow cols={4}>
        <StatTile label="Employees" value={num(lines.length)} icon={Table2} hint={`${run.code} · India payroll`} />
        <StatTile label="Gross" value={inr(sumBy(lines, (l) => l.gross), { decimals: false })} />
        <StatTile label="Deductions" value={inr(sumBy(lines, (l) => l.deductions), { decimals: false })} />
        <StatTile label="Net pay" value={inr(sumBy(lines, (l) => l.net), { decimals: false })} tone="accent" />
      </StatRow>
      <div className="grid gap-2 lg:grid-cols-3">
        <ReconcileCheck label="Gross" leftLabel="Σ register" left={sumBy(lines, (l) => l.gross)} rightLabel="run" right={t.gross} />
        <ReconcileCheck label="Net pay" leftLabel="Σ register" left={sumBy(lines, (l) => l.net)} rightLabel="run" right={t.net} />
        <ReconcileCheck
          label="Employer cost"
          leftLabel="Σ register"
          left={sumBy(lines, (l) => l.employerCost)}
          rightLabel="run"
          right={t.employerCost}
        />
      </div>
      <DataTable<RegisterLine>
        columns={SALARY_COLUMNS}
        data={lines}
        getRowId={(l) => l.code}
        searchKeys={["name", "code", "department", "costCentre"]}
        searchPlaceholder="Search employee, department or cost centre…"
        exportName={`salary-register-${run.periodId}`}
        dense
        rowTone={(l) => (l.net < 0 ? "danger" : undefined)}
        emptyIcon={Table2}
        emptyTitle="No employee matches"
        emptyDescription="Clear the search to see every line in the register."
      />
    </div>
  );
}

const PF_COLUMNS: ColumnDef<RegisterLine, unknown>[] = [
  person,
  { accessorKey: "uan", header: "UAN", cell: ({ getValue }) => <MutedCell>{String(getValue())}</MutedCell> },
  money("basic", "Basic earned"),
  money("pfWage", "PF wage"),
  money("pf", "EE share 12%"),
  money("eps", "ER EPS 8.33%"),
  money("epfEmployer", "ER EPF diff."),
  money("employerPf", "ER total", true),
];

export function PfRegister({ run }: { run: PayRun }) {
  const lines = registerLines(run.id);
  const ee = sumBy(lines, (l) => l.pf);
  const eps = sumBy(lines, (l) => l.eps);
  const epf = sumBy(lines, (l) => l.epfEmployer);
  const er = sumBy(lines, (l) => l.employerPf);
  const capped = lines.filter((l) => l.eps === EPS_MONTHLY_CAP).length;
  return (
    <div className="flex flex-col gap-3">
      <StatRow cols={4}>
        <StatTile label="Members" value={num(lines.length)} icon={Landmark} hint={`Establishment ${TENANT.pfCode}`} />
        <StatTile label="Employee share (A/c 1)" value={inr(ee, { decimals: false })} />
        <StatTile label="Pension — EPS (A/c 10)" value={inr(eps, { decimals: false })} hint={`${num(capped)} capped at ₹1,250`} />
        <StatTile label="Employer EPF (A/c 1)" value={inr(epf, { decimals: false })} hint="12% less the EPS share" />
      </StatRow>
      <div className="grid gap-2 lg:grid-cols-2">
        <ReconcileCheck label="Employer split" leftLabel="EPS + EPF" left={eps + epf} rightLabel="employer PF in run" right={er} />
        <ReconcileCheck
          label="Remittance"
          leftLabel="EE + ER"
          left={ee + er}
          rightLabel="ECR challan (A/c 1 + 10)"
          right={sumBy(lines, (l) => l.pf + l.employerPf)}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        PF wage is earned Basic capped at the ₹15,000 statutory ceiling. EPS is 8.33% of the PF wage, capped at ₹1,250;
        the remainder of the employer&apos;s 12% goes to EPF. EDLI and admin charges are billed on the challan and are not
        part of the employee register.
      </p>
      <DataTable<RegisterLine>
        columns={PF_COLUMNS}
        data={lines}
        getRowId={(l) => l.code}
        searchKeys={["name", "code", "uan"]}
        searchPlaceholder="Search name, code or UAN…"
        exportName={`pf-register-${run.periodId}`}
        dense
        emptyIcon={Landmark}
        emptyTitle="No member matches"
        emptyDescription="Clear the search to see every PF member in this run."
      />
    </div>
  );
}
