"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Calculator } from "lucide-react";
import { fmtDate, inr } from "@/lib/format";
import { PAY_RUNS, payRunRows, type PayComponent, type Payslip } from "@/mock/payroll";
import { useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Alert, Separator } from "@/components/ui/primitives";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/overlays";

/* ----------------------------------------------------------------------------
   "Explain every number" for self-service. Every line is the same traced
   component the pay run renders, so the employee sees the rule, the rule with
   their own figures substituted, and the result — without needing access to
   the payroll module. Payroll staff additionally get a link to the full run
   breakdown, offered only where that page is pre-rendered in the export.
   -------------------------------------------------------------------------- */

const money = (n: number) => inr(n, { decimals: false });

/** The run breakdown exists only for the two live runs, for employees each run pays. */
function runBreakdownExists(runId: string, code: string) {
  return (
    PAY_RUNS.some((r) => r.id === runId) && payRunRows(runId).some((r) => r.employeeCode === code)
  );
}

function TraceLine({ c, sign = "" }: { c: PayComponent; sign?: string }) {
  return (
    <li className="rounded-md border border-border px-3 py-2">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="font-medium">{c.label}</span>
        <span className="tnum shrink-0 font-semibold">
          {sign}
          {money(c.amount)}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{c.trace.formula}</p>
      <p className="tnum mt-0.5 break-words font-mono text-[11px] text-foreground/80">
        {c.trace.substituted}
      </p>
      {c.trace.note && <p className="mt-1 text-[11px] text-muted-foreground">{c.trace.note}</p>}
    </li>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</dt>
          <dd className="tnum mt-0.5 text-xs font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PayslipExplainSheet({
  slip,
  open,
  onOpenChange,
}: {
  slip: Payslip;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { can } = useApp();
  const showRunLink = can("payroll.runs") && runBreakdownExists(slip.runId, slip.employee.code);
  const tds = slip.statutory.find((c) => c.code === "TDS");
  const lop = slip.deductions.find((c) => c.code === "LOP");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent width="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>How your {slip.periodLabel} pay was calculated</SheetTitle>
          <SheetDescription>
            Annual CTC {money(slip.annualCtc)} · monthly CTC {money(slip.monthlyCtc)} · pay date{" "}
            {fmtDate(slip.payDate)}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-4">
          <div>
            <Heading>Days</Heading>
            <Facts
              rows={[
                ["Days in month", String(slip.daysInMonth)],
                ["Days on roll", String(slip.payableDays)],
                ["Loss-of-pay days", String(slip.lopDays)],
                ["Paid days", String(slip.paidDays)],
              ]}
            />
            {slip.prorated && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                You joined on {fmtDate(slip.employee.joiningDate)}, so every fixed earning is pro-rated
                to {slip.payableDays} of {slip.daysInMonth} days.
              </p>
            )}
            {lop && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                {slip.lopDays} loss-of-pay day{slip.lopDays === 1 ? "" : "s"} cost {money(lop.amount)} —
                see the Loss of Pay line under deductions.
              </p>
            )}
          </div>

          <div>
            <Heading>Earnings · {money(slip.gross)}</Heading>
            <ul className="flex flex-col gap-1.5">
              {slip.earnings.map((c) => (
                <TraceLine key={c.code} c={c} />
              ))}
            </ul>
          </div>

          <div>
            <Heading>Deductions · {money(slip.totalDeductions)}</Heading>
            <ul className="flex flex-col gap-1.5">
              {[...slip.statutory, ...slip.deductions].map((c) => (
                <TraceLine key={c.code} c={c} sign="− " />
              ))}
            </ul>
          </div>

          <div className="rounded-md bg-primary-soft px-3 py-2.5 text-primary-soft-foreground">
            <p className="tnum flex flex-wrap items-baseline justify-between gap-2 text-xs font-semibold">
              <span>
                Net pay = {money(slip.gross)} − {money(slip.totalDeductions)}
              </span>
              <span className="text-sm">{money(slip.net)}</span>
            </p>
          </div>

          {tds && (
            <div>
              <Heading>Income tax for the year</Heading>
              <Facts rows={tds.trace.inputs.map((i): [string, string] => [i.label, i.value])} />
              <p className="mt-2 text-[11px] text-muted-foreground">
                This month&rsquo;s TDS is {money(tds.amount)}. {tds.trace.note}
              </p>
            </div>
          )}

          <Separator />

          <div>
            <Heading>Year to date · {slip.fy}</Heading>
            <Facts
              rows={[
                ["Gross earnings", money(slip.ytd.gross)],
                ["Deductions", money(slip.ytd.deductions)],
                ["Net pay", money(slip.ytd.net)],
                ["TDS deducted", money(slip.ytd.tds)],
                ["Your PF contribution", money(slip.ytd.pf)],
                ["Employer cost this month", money(slip.employerTotal)],
              ]}
            />
          </div>

          {slip.status !== "paid" && (
            <Alert tone="info" title="Not final yet">
              The {slip.periodLabel} run is still open, so these figures can change until Finance
              approves it.
            </Alert>
          )}
        </SheetBody>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {showRunLink && (
            <Button asChild>
              <Link href={`/payroll/runs/${slip.runId}/employee/${slip.employee.code}`}>
                <Calculator /> Open in the pay run <ArrowRight />
              </Link>
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
