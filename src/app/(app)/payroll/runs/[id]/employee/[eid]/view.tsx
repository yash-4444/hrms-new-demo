"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeIndianRupee,
  Calculator,
  ChevronDown,
  ChevronRight,
  Download,
  Landmark,
  Printer,
  Receipt,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, inr, num } from "@/lib/format";
import { TENANT } from "@/mock/org";
import {
  EXCEPTION_META,
  amountInWords,
  payslipFor,
  runById,
  type PayComponent,
} from "@/mock/payroll";
import { mockAction } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, Avatar, Badge, EmptyState, Separator } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { ShareBar } from "@/components/charts";
import {
  PageBody,
  PageHeader,
  Section,
  useFakeLoad,
} from "@/components/shell/page";
import { PayrollPlainWords } from "@/components/ai/embed/payroll-plain-words";

/* ============================================================================
   The money shot.

   Every component row carries a three-line trace — the rule in symbols, the
   same rule with every input resolved, and the output:

       PF = min(Basic × 0.12, 1800)
          = min(2880, 1800)
          = 1800

   That is what turns "a nice mock" into "they actually built payroll".
   ========================================================================== */

export default function PayslipBreakdownPage() {
  const loading = useFakeLoad();
  const params = useParams<{ id: string; eid: string }>();
  const runId = String(params.id);
  const employeeCode = String(params.eid);

  const run = runById(runId);
  const slip = payslipFor(runId, employeeCode);
  const [openAll, setOpenAll] = React.useState(false);
  const [open, setOpen] = React.useState<Set<string>>(new Set());

  const toggle = (code: string) =>
    setOpen((s) => {
      const n = new Set(s);
      n.has(code) ? n.delete(code) : n.add(code);
      return n;
    });

  const isOpen = (code: string) => openAll || open.has(code);

  if (!slip || !run) {
    return (
      <PageBody>
        <PageHeader title="Breakdown unavailable" />
        <EmptyState
          icon={BadgeIndianRupee}
          title="No payslip for this employee in this run"
          description="Only employees on the Indian payroll are priced by this engine — the Newark branch is processed by an external provider."
          action={
            <Button size="sm" asChild>
              <Link href={`/payroll/runs/${runId}`}>Back to the run</Link>
            </Button>
          }
        />
      </PageBody>
    );
  }

  if (loading) {
    return (
      <PageBody>
        <PageHeader title={slip.employee.name} description="Computing the breakdown…" />
        <Card className="h-[420px] animate-pulse bg-muted" />
      </PageBody>
    );
  }

  const e = slip.employee;

  return (
    <PageBody>
      <PageHeader
        title={`${e.name} — ${slip.periodLabel}`}
        description={
          <>
            {e.code} · {e.designation} · {e.department} ({e.costCentre}) · {e.branch} ·{" "}
            grade {e.gradeLabel}
          </>
        }
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/payroll/runs/${runId}`}>
                <ArrowLeft /> Back to run
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-pressed={openAll}
              onClick={() => setOpenAll((v) => !v)}
            >
              <Calculator /> {openAll ? "Collapse all traces" : "Explain every number"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer /> Print
            </Button>
            <Button
              size="sm"
              onClick={() =>
                mockAction("Payslip download queued", {
                  description: `${e.code}-${slip.periodId}.pdf — not written to disk in the demo.`,
                })
              }
            >
              <Download /> Download payslip
            </Button>
          </>
        }
      />

      {slip.exceptionType && (
        <Alert
          tone="danger"
          icon={AlertTriangle}
          title={EXCEPTION_META[slip.exceptionType].label}
        >
          {EXCEPTION_META[slip.exceptionType].blurb} This employee is blocking the{" "}
          {run.label} run from being locked.
        </Alert>
      )}

      <PayrollPlainWords runId={runId} employeeCode={employeeCode} />

      {/* ------------------------------------------------- payslip header */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border bg-subtle p-4">
          <div className="flex items-start gap-3">
            <Avatar name={e.name} size={44} />
            <div>
              <p className="text-sm font-semibold">{e.name}</p>
              <p className="text-xs text-muted-foreground">
                {e.designation} · joined {fmtDate(e.joiningDate)} · {e.employmentType}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <Badge variant="muted">PAN {e.pan}</Badge>
                <Badge variant="muted">UAN {e.uan}</Badge>
                <Badge variant={e.hasBankDetails ? "muted" : "outline"}>
                  {e.hasBankDetails ? `A/C ••••${e.bankAccountLast4}` : "No bank account on file"}
                </Badge>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold">{TENANT.legalName}</p>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              CIN {TENANT.cin} · PAN {TENANT.pan} · TAN {TENANT.tan}
              <br />
              PF {TENANT.pfCode} · ESI {TENANT.esiCode}
            </p>
            <StatusBadge status={slip.status} className="mt-1.5" />
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 p-4 sm:grid-cols-4 lg:grid-cols-7">
          {[
            ["Pay period", `${fmtDate(slip.periodStart)} – ${fmtDate(slip.periodEnd)}`],
            ["Pay date", fmtDate(slip.payDate)],
            ["Financial year", slip.fy],
            ["Days in month", String(slip.daysInMonth)],
            ["Payable days", String(slip.payableDays)],
            ["LOP days", String(slip.lopDays)],
            ["Paid days", String(slip.paidDays)],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</dt>
              <dd className="tnum mt-0.5 text-xs font-medium">{v}</dd>
            </div>
          ))}
        </dl>

        {slip.prorated && (
          <p className="border-t border-border bg-warning-soft px-4 py-2 text-xs text-warning-fg">
            <AlertTriangle className="mr-1 inline size-3" aria-hidden />
            This month is pro-rated: {slip.payableDays} of {slip.daysInMonth} days are payable, so
            every fixed component below is scaled by {slip.payableDays}/{slip.daysInMonth}.
          </p>
        )}
      </Card>

      {/* --------------------------------------------- the net-pay hero */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Net pay for {slip.periodLabel}
            </p>
            <p
              className={cn(
                "mt-1 text-lg font-semibold tracking-tight",
                slip.net < 0 && "text-destructive-fg",
              )}
            >
              {inr(slip.net)}
            </p>
            <p className="mt-0.5 text-xs italic text-muted-foreground">
              {amountInWords(slip.net)}
            </p>
          </div>
          <div className="min-w-[280px] flex-1">
            <ShareBar
              segments={[
                { key: "net", label: "Net pay", value: Math.max(0, slip.net), status: "good" },
                {
                  key: "stat",
                  label: "Statutory",
                  value: slip.statutoryTotal,
                  status: "serious",
                },
                {
                  key: "other",
                  label: "Other deductions",
                  value: slip.otherDeductionsTotal,
                  status: "critical",
                },
              ]}
              total={slip.gross}
              valueFormat={(v) => inr(v, { decimals: false })}
              height={10}
            />
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-4">
          {[
            ["Gross earnings", inr(slip.gross), Wallet],
            ["Statutory deductions", inr(slip.statutoryTotal), Landmark],
            ["Other deductions", inr(slip.otherDeductionsTotal), Receipt],
            ["Cost to company", inr(slip.costToCompany), BadgeIndianRupee],
          ].map(([k, v, Icon]) => {
            const I = Icon as React.ElementType;
            return (
              <div key={k as string} className="rounded-md border border-border bg-subtle p-2.5">
                <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <I className="size-3" aria-hidden /> {k as string}
                </p>
                <p className="tnum mt-0.5 text-sm font-semibold">{v as string}</p>
              </div>
            );
          })}
        </dl>
      </Card>

      {/* ------------------------------ earnings | deductions, two columns */}
      <div className="grid gap-3 lg:grid-cols-2">
        <ComponentTable
          title="Earnings"
          description="What the employee is paid before any deduction."
          components={slip.earnings}
          total={slip.gross}
          totalLabel="Gross earnings"
          isOpen={isOpen}
          toggle={toggle}
          tone="success"
        />
        <ComponentTable
          title="Deductions"
          description="Recoveries and voluntary deductions. Statutory items are listed separately below."
          components={slip.deductions}
          total={slip.otherDeductionsTotal}
          totalLabel="Total other deductions"
          isOpen={isOpen}
          toggle={toggle}
          tone="danger"
          emptyNote="No non-statutory deductions this month."
        />
      </div>

      {/* ------------------------------------------ statutory, on its own */}
      <ComponentTable
        title="Statutory deductions"
        description="Provident Fund, Employees' State Insurance, Professional Tax and TDS — computed under the Indian statutory model."
        components={slip.statutory}
        total={slip.statutoryTotal}
        totalLabel="Total statutory"
        isOpen={isOpen}
        toggle={toggle}
        tone="serious"
      />

      {/* --------------------------------------- employer contributions */}
      <ComponentTable
        title="Employer contributions"
        description="Paid by Stellar on top of gross — part of cost to company, never deducted from the employee."
        components={slip.employer}
        total={slip.employerTotal}
        totalLabel="Total employer cost"
        isOpen={isOpen}
        toggle={toggle}
        tone="info"
      />

      {/* -------------------------------------------------------- YTD */}
      <Section
        title={`Year to date · ${slip.fy}`}
        description="Cumulative figures from the start of the financial year through this period."
      >
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ["Gross", slip.ytd.gross],
            ["Deductions", slip.ytd.deductions],
            ["Net paid", slip.ytd.net],
            ["TDS", slip.ytd.tds],
            ["PF (employee)", slip.ytd.pf],
          ].map(([k, v]) => (
            <div key={k as string} className="rounded-md border border-border bg-subtle p-2.5">
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {k as string}
              </dt>
              <dd className="tnum mt-0.5 text-sm font-semibold">
                {inr(v as number, { decimals: false })}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Annual CTC {inr(slip.annualCtc, { decimals: false })} · monthly CTC{" "}
          {inr(slip.monthlyCtc, { decimals: false })} · structure{" "}
          <Link href="/payroll/structures" className="text-primary hover:underline">
            {slip.structureId}
          </Link>
        </p>
      </Section>
    </PageBody>
  );
}

/* ----------------------------------------------------- component table */

function ComponentTable({
  title,
  description,
  components,
  total,
  totalLabel,
  isOpen,
  toggle,
  tone,
  emptyNote,
}: {
  title: string;
  description: string;
  components: PayComponent[];
  total: number;
  totalLabel: string;
  isOpen: (code: string) => boolean;
  toggle: (code: string) => void;
  tone: "success" | "danger" | "serious" | "info";
  emptyNote?: string;
}) {
  const accent = {
    success: "bg-success",
    danger: "bg-destructive",
    serious: "bg-serious",
    info: "bg-info",
  }[tone];

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="relative border-b border-border px-4 py-2.5">
        <span className={cn("absolute inset-y-0 left-0 w-0.5", accent)} aria-hidden />
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>

      {components.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">
          {emptyNote ?? "Nothing in this section this month."}
        </p>
      ) : (
        <ul className="flex-1">
          {components.map((c) => {
            const expanded = isOpen(c.code);
            return (
              <li key={c.code} className="border-b border-border last:border-0">
                <button
                  type="button"
                  onClick={() => toggle(c.code)}
                  aria-expanded={expanded}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {expanded ? (
                    <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  ) : (
                    <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{c.label}</span>
                    <span className="block font-mono text-[10px] text-muted-foreground">
                      {c.code}
                      {!c.taxable && c.group === "earning" ? " · non-taxable" : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="tnum block text-xs font-semibold">
                      {inr(c.amount, { decimals: false })}
                    </span>
                    <span className="tnum block text-[10px] text-muted-foreground">
                      YTD {inr(c.ytd, { decimals: false })}
                    </span>
                  </span>
                </button>

                {expanded && (
                  <div className="border-t border-border bg-subtle px-4 py-3">
                    <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <Calculator className="size-3" aria-hidden /> Explain this number
                    </p>

                    {/* the three-line trace */}
                    <div className="overflow-x-auto rounded-md border border-border bg-card p-2.5">
                      <table className="w-full font-mono text-[11px] leading-relaxed">
                        <tbody>
                          <tr>
                            <td className="w-8 pr-2 align-top text-muted-foreground">rule</td>
                            <td className="whitespace-pre text-foreground">{c.trace.formula}</td>
                          </tr>
                          <tr>
                            <td className="pr-2 align-top text-muted-foreground">=</td>
                            <td className="whitespace-pre text-foreground">{c.trace.substituted}</td>
                          </tr>
                          <tr>
                            <td className="pr-2 align-top text-muted-foreground">=</td>
                            <td className="tnum whitespace-pre font-semibold text-foreground">
                              {c.trace.result}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {c.trace.inputs.length > 0 && (
                      <>
                        <Separator className="my-2.5" />
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Resolved inputs
                        </p>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                          {c.trace.inputs.map((i) => (
                            <div key={i.label} className="flex items-baseline justify-between gap-2">
                              <dt className="truncate text-[11px] text-muted-foreground">{i.label}</dt>
                              <dd className="tnum shrink-0 text-[11px] font-medium">{i.value}</dd>
                            </div>
                          ))}
                        </dl>
                      </>
                    )}

                    {c.trace.note && (
                      <p className="mt-2 border-t border-border pt-2 text-[11px] leading-relaxed text-muted-foreground">
                        {c.trace.note}
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-border bg-subtle px-4 py-2.5">
        <span className="text-xs font-semibold">{totalLabel}</span>
        <span className="tnum text-sm font-semibold">{inr(total)}</span>
      </div>
    </Card>
  );
}
