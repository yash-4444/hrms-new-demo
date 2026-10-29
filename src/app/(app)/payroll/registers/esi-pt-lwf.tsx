"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CalendarClock, HeartPulse, MapPinned } from "lucide-react";
import { inr, num } from "@/lib/format";
import { TENANT } from "@/mock/org";
import { ESI_GROSS_CEILING, type PayRun } from "@/mock/payroll";
import { lwfLines, registerLines, sumBy, type LwfLine, type RegisterLine } from "@/mock/finance-run";
import { Card } from "@/components/ui/card";
import { Alert, Badge } from "@/components/ui/primitives";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { PersonCell } from "@/components/people/person-cell";
import { MoneyCell, ReconcileCheck } from "@/components/finance/kit";

/* ESI, Professional Tax and Labour Welfare Fund registers. */

const person: ColumnDef<RegisterLine, unknown> = {
  accessorKey: "name",
  header: "Employee",
  cell: ({ row }) => <PersonCell name={row.original.name} subtitle={`${row.original.code} · ${row.original.branch}`} />,
};

const money = (key: keyof RegisterLine, label: string): ColumnDef<RegisterLine, unknown> => ({
  accessorKey: key,
  header: () => <span className="block text-right">{label}</span>,
  cell: ({ getValue }) => <MoneyCell value={Number(getValue())} />,
});

const ESI_COLUMNS: ColumnDef<RegisterLine, unknown>[] = [
  person,
  money("gross", "ESI wage (gross)"),
  money("esi", "EE 0.75%"),
  money("employerEsi", "ER 3.25%"),
];

export function EsiRegister({ run }: { run: PayRun }) {
  const lines = registerLines(run.id);
  const covered = lines.filter((l) => l.esiCovered);
  const lowest = Math.min(...lines.map((l) => l.gross));
  return (
    <div className="flex flex-col gap-3">
      <StatRow cols={4}>
        <StatTile label="Covered employees" value={num(covered.length)} icon={HeartPulse} hint={`Code ${TENANT.esiCode}`} />
        <StatTile label="Wage ceiling" value={inr(ESI_GROSS_CEILING, { decimals: false })} hint="Monthly gross, inclusive" />
        <StatTile label="Employee share" value={inr(sumBy(covered, (l) => l.esi), { decimals: false })} />
        <StatTile label="Employer share" value={inr(sumBy(covered, (l) => l.employerEsi), { decimals: false })} />
      </StatRow>
      {covered.length === 0 && (
        <Alert tone="info" icon={HeartPulse} title="No ESI contribution is due for this run">
          ESI applies where monthly gross is {inr(ESI_GROSS_CEILING, { decimals: false })} or less. The lowest gross in{" "}
          {run.code} is {inr(lowest, { decimals: false })} — every employee is above the ceiling, so they are covered by
          the group health policy instead. A nil ESI return is still filed for the contribution period.
        </Alert>
      )}
      <DataTable<RegisterLine>
        columns={ESI_COLUMNS}
        data={covered}
        getRowId={(l) => l.code}
        searchKeys={["name", "code"]}
        exportName={`esi-register-${run.periodId}`}
        dense
        emptyIcon={HeartPulse}
        emptyTitle="Nil ESI register"
        emptyDescription={`No employee in ${run.label} earns ₹21,000 or less in monthly gross.`}
      />
    </div>
  );
}

const PT_COLUMNS: ColumnDef<RegisterLine, unknown>[] = [
  person,
  { accessorKey: "state", header: "State", cell: ({ getValue }) => <MutedCell>{String(getValue())}</MutedCell> },
  money("gross", "Gross"),
  money("pt", "PT"),
  {
    accessorKey: "ptRule",
    header: "Slab applied",
    cell: ({ getValue }) => <span className="block max-w-[360px] truncate text-xs text-muted-foreground">{String(getValue())}</span>,
  },
];

export function PtRegister({ run }: { run: PayRun }) {
  const lines = registerLines(run.id);
  const states = Array.from(new Set(lines.map((l) => l.state)));
  const total = sumBy(lines, (l) => l.pt);
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {states.map((s) => {
          const rows = lines.filter((l) => l.state === s);
          const amount = sumBy(rows, (l) => l.pt);
          return (
            <Card key={s} className="p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <MapPinned className="size-3.5 text-muted-foreground" aria-hidden /> {s}
                </span>
                <Badge variant="muted">{num(rows.length)} employees</Badge>
              </div>
              <p className="tnum mt-2 text-lg font-semibold">{inr(amount, { decimals: false })}</p>
              <p className="text-xs text-muted-foreground">
                {num(rows.filter((r) => r.pt > 0).length)} liable · {rows[0]?.ptRule}
              </p>
            </Card>
          );
        })}
      </div>
      <ReconcileCheck
        label="PT by state"
        leftLabel="Σ state totals"
        left={states.reduce((acc, s) => acc + sumBy(lines.filter((l) => l.state === s), (l) => l.pt), 0)}
        rightLabel="Σ PT deducted in run"
        right={total}
      />
      <DataTable<RegisterLine>
        columns={PT_COLUMNS}
        data={lines}
        getRowId={(l) => l.code}
        searchKeys={["name", "code", "state"]}
        exportName={`pt-register-${run.periodId}`}
        dense
        emptyIcon={MapPinned}
        emptyTitle="No employee matches"
        emptyDescription="Clear the search to see the whole PT register."
      />
    </div>
  );
}

const LWF_COLUMNS: ColumnDef<LwfLine, unknown>[] = [
  { accessorKey: "state", header: "State", cell: ({ getValue }) => <span className="font-medium">{String(getValue())}</span> },
  { accessorKey: "frequency", header: "Frequency" },
  {
    accessorKey: "employees",
    header: () => <span className="block text-right">Employees</span>,
    cell: ({ getValue }) => <NumCell>{num(Number(getValue()))}</NumCell>,
  },
  {
    id: "rate",
    header: "Rate (EE / ER)",
    cell: ({ row }) => (
      <span className="tnum text-xs">
        {inr(row.original.employee, { decimals: false })} / {inr(row.original.employer, { decimals: false })}
      </span>
    ),
  },
  {
    id: "now",
    header: () => <span className="block text-right">This period</span>,
    cell: ({ row }) => <MoneyCell value={row.original.employeeThisPeriod + row.original.employerThisPeriod} />,
  },
  { accessorKey: "nextMonthLabel", header: "Next deduction" },
  {
    id: "next",
    header: () => <span className="block text-right">Next liability (EE + ER)</span>,
    cell: ({ row }) => <MoneyCell value={row.original.nextEmployee + row.original.nextEmployer} />,
  },
  { accessorKey: "dueBy", header: "Remit by", cell: ({ getValue }) => <MutedCell>{String(getValue())}</MutedCell> },
];

export function LwfRegister({ run }: { run: PayRun }) {
  const lines = lwfLines(run.id);
  const dueNow = lines.some((l) => l.dueThisPeriod);
  return (
    <div className="flex flex-col gap-3">
      {!dueNow && (
        <Alert tone="info" icon={CalendarClock} title={`Nil LWF for ${run.label}`}>
          Labour Welfare Fund is deducted only in the contribution months — December for Karnataka and Telangana, June
          and December for Maharashtra. {run.label} is not one of them, so the register is nil; the next deduction is
          projected below from current headcount.
        </Alert>
      )}
      <DataTable<LwfLine>
        columns={LWF_COLUMNS}
        data={lines}
        getRowId={(l) => l.state}
        exportName={`lwf-register-${run.periodId}`}
        emptyIcon={CalendarClock}
        emptyTitle="No LWF state configured"
        emptyDescription="Add a Labour Welfare Fund rule under Statutory Setup."
      />
    </div>
  );
}
