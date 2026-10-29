"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarX2 } from "lucide-react";
import { sum } from "@/lib/utils";
import { fmtDate, fmtDay, inr, num } from "@/lib/format";
import { DEPARTMENTS } from "@/mock/org";
import {
  PAYROLL_INPUT_CUTOFF,
  PAYROLL_INPUT_LOP,
  PAYROLL_INPUT_RUN_TOTALS,
  lopDaysDetail,
  type PayrollInputLopRow,
} from "@/mock/finance-payroll";
import { MoneyCell, ReconcileCheck } from "@/components/finance/kit";
import { Alert, Badge } from "@/components/ui/primitives";
import {
  FilterSelect,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/overlays";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { PersonCell } from "@/components/people/person-cell";

/** Loss-of-pay days for September 2026, exactly as the run calculated them, with the dated days behind each. */
export function LopTab() {
  const [dept, setDept] = React.useState("all");
  const [drill, setDrill] = React.useState<PayrollInputLopRow | null>(null);
  const rows = PAYROLL_INPUT_LOP.filter((r) => dept === "all" || r.departmentId === dept);
  const detail = drill ? lopDaysDetail(drill.employeeCode) : [];

  const columns = React.useMemo<ColumnDef<PayrollInputLopRow, unknown>[]>(
    () => [
      { accessorKey: "name", header: "Employee", cell: ({ row }) => <PersonCell name={row.original.name} code={row.original.employeeCode} /> },
      { accessorKey: "department", header: "Department", cell: ({ row }) => <MutedCell>{row.original.department}</MutedCell> },
      { accessorKey: "branch", header: "Branch", cell: ({ row }) => <MutedCell>{row.original.branch}</MutedCell> },
      { accessorKey: "payableDays", header: "Payable days", cell: ({ row }) => <NumCell>{row.original.payableDays}</NumCell> },
      {
        accessorKey: "lopDays",
        header: "LOP days",
        cell: ({ row }) => (
          <NumCell className={row.original.exceeds ? "text-destructive-fg font-semibold" : undefined}>{num(row.original.lopDays, 1)}</NumCell>
        ),
      },
      { accessorKey: "perDayRate", header: "Per-day rate", cell: ({ row }) => <MoneyCell value={row.original.perDayRate} decimals /> },
      { accessorKey: "lopAmount", header: "LOP deduction", cell: ({ row }) => <MoneyCell value={row.original.lopAmount} /> },
      {
        id: "flag",
        header: "Check",
        cell: ({ row }) =>
          row.original.exceeds ? <Badge variant="outline" className="border-destructive/30 text-destructive-fg">Exceeds payable days</Badge> : <MutedCell>OK</MutedCell>,
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 lg:grid-cols-2">
        <ReconcileCheck label="LOP days" left={sum(PAYROLL_INPUT_LOP.map((r) => r.lopDays))} right={PAYROLL_INPUT_RUN_TOTALS.lopDays} leftLabel="Σ inputs" rightLabel="run" format={(v) => num(v, 1)} />
        <ReconcileCheck label="LOP amount" left={sum(PAYROLL_INPUT_LOP.map((r) => r.lopAmount))} right={PAYROLL_INPUT_RUN_TOTALS.lop} leftLabel="Σ inputs" rightLabel="run LOP" />
      </div>
      <DataTable<PayrollInputLopRow>
        columns={columns}
        data={rows}
        getRowId={(r) => r.employeeCode}
        searchKeys={["name", "employeeCode", "department"]}
        searchPlaceholder="Search name or code…"
        exportName="lop-inputs-sep-2026"
        onRowClick={setDrill}
        rowTone={(r) => (r.exceeds ? "danger" : undefined)}
        emptyIcon={CalendarX2}
        emptyTitle="No loss of pay in this department"
        emptyDescription="Everyone in this department was on attendance or approved paid leave up to the cut-off."
        filters={
          <FilterSelect label="Department" value={dept} onValueChange={setDept} allLabel="All" width="w-[190px]" options={DEPARTMENTS.map((d) => ({ value: d.id, label: d.name }))} />
        }
      />

      <Sheet open={!!drill} onOpenChange={(v) => !v && setDrill(null)}>
        <SheetContent width="sm:max-w-lg">
          {drill && (
            <>
              <SheetHeader>
                <SheetTitle>{drill.name} · {num(drill.lopDays, 1)} LOP days</SheetTitle>
                <SheetDescription>
                  {drill.employeeCode} · {drill.department} · attendance cut-off {fmtDate(PAYROLL_INPUT_CUTOFF)}
                </SheetDescription>
              </SheetHeader>
              <SheetBody className="flex flex-col gap-3">
                {drill.exceeds && (
                  <Alert tone="danger" title="LOP exceeds payable days">
                    {num(drill.lopDays)} days were keyed against a {drill.payableDays}-day month. Only the dated days below are
                    supported by attendance and leave — correct the input before the run is locked.
                  </Alert>
                )}
                <ol className="divide-y divide-border rounded-md border border-border">
                  {detail.map((d) => (
                    <li key={d.date} className="flex items-start gap-3 px-3 py-2 text-xs">
                      <span className="w-28 shrink-0 font-medium">{fmtDay(d.date)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block">{d.source}</span>
                        <span className="block font-mono text-[11px] text-muted-foreground">{d.reference}</span>
                      </span>
                      <span className="tnum shrink-0 font-medium">{d.days === 1 ? "1 day" : "½ day"}</span>
                    </li>
                  ))}
                </ol>
                <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-xs">
                  <span>
                    {num(sum(detail.map((d) => d.days)), 1)} days × {inr(drill.perDayRate)} per day
                  </span>
                  <span className="tnum font-semibold">{inr(drill.lopAmount, { decimals: false })} deducted</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Days after the cut-off are assumed present; any absence between 16 and 30 September is trued up in the
                  October run.
                </p>
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
