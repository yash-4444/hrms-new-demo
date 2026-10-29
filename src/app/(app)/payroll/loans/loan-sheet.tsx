"use client";

import { Ban, Banknote, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, inr, pct } from "@/lib/format";
import {
  LOAN_KIND_LABEL,
  LOAN_MISKEYED_EMI,
  LOAN_PERQ_THRESHOLD,
  LOAN_SBI_RATE,
  loanPerquisite,
  type Loan,
} from "@/mock/finance-loans";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/overlays";
import { DetailList, DetailRow } from "@/components/people/person-cell";
import { Gated } from "@/components/shell/page";
import { DownloadButton, FinStatus } from "@/components/finance/kit";
import { LOAN_STATUS_BADGE } from "./loan-columns";

export type LoanAction = "approve" | "reject" | "disburse" | "foreclose";

export function LoanSheet({
  loan,
  onOpenChange,
  onAction,
}: {
  loan: Loan | null;
  onOpenChange: (v: boolean) => void;
  onAction: (loan: Loan, action: LoanAction) => void;
}) {
  const perq = loan ? loanPerquisite(loan) : null;
  return (
    <Sheet open={!!loan} onOpenChange={onOpenChange}>
      <SheetContent width="sm:max-w-2xl">
        {loan && perq && (
          <>
            <SheetHeader>
              <SheetTitle>
                {loan.id} · {loan.name}
              </SheetTitle>
              <SheetDescription>
                {LOAN_KIND_LABEL[loan.kind]} · {loan.purpose}
              </SheetDescription>
            </SheetHeader>
            <SheetBody className="flex flex-col gap-4 overflow-y-auto">
              {loan.flag && (
                <Alert tone="danger" title="Mis-keyed September instalment">
                  {loan.flag} Correct the input to {inr(LOAN_MISKEYED_EMI, { decimals: false })} on Payroll Inputs and
                  recalculate the run.
                </Alert>
              )}
              <DetailList>
                <DetailRow label="Status">
                  <FinStatus status={LOAN_STATUS_BADGE[loan.status]} />
                </DetailRow>
                <DetailRow label="Principal">{inr(loan.principal, { decimals: false })}</DetailRow>
                <DetailRow label="Interest">
                  {loan.ratePct === 0 ? "Interest-free" : `${pct(loan.ratePct, 2)} p.a., reducing balance`}
                </DetailRow>
                <DetailRow label="EMI">
                  {inr(loan.emi, { decimals: false })} × {loan.tenureMonths} months from {loan.schedule[0]?.label ?? "—"}
                </DetailRow>
                <DetailRow label="Outstanding">{inr(loan.outstanding, { decimals: false })}</DetailRow>
                <DetailRow label="Requested">{fmtDate(loan.requestedOn)}</DetailRow>
                <DetailRow label="Sanctioned">
                  {loan.sanctionedOn ? `${fmtDate(loan.sanctionedOn)} by ${loan.sanctionedBy}` : "Awaiting approval"}
                </DetailRow>
                <DetailRow label="Disbursed">{loan.disbursedOn ? fmtDate(loan.disbursedOn) : "Not yet"}</DetailRow>
              </DetailList>

              <section aria-labelledby="perq-h" className="rounded-md border border-border bg-subtle p-3 text-xs">
                <h3 id="perq-h" className="font-semibold">
                  Perquisite on concessional interest · Rule 3(7)(i)
                </h3>
                {perq.taxable ? (
                  <p className="mt-1 text-muted-foreground">
                    Principal exceeds {inr(LOAN_PERQ_THRESHOLD, { decimals: false })} and the rate charged (
                    {pct(loan.ratePct, 2)}) is below the SBI benchmark ({pct(LOAN_SBI_RATE, 2)}). The perquisite is (
                    {pct(LOAN_SBI_RATE, 2)} − {pct(loan.ratePct, 2)}) × month-end balance ÷ 12, added to taxable salary
                    and reported in Form 12BA:{" "}
                    <strong className="tnum text-foreground">{inr(perq.fyTotal, { decimals: false })}</strong> for FY
                    2026-27 across {perq.monthly.length} months.
                  </p>
                ) : (
                  <p className="mt-1 text-muted-foreground">
                    {loan.medicalExempt
                      ? "Exempt — the loan is for treatment of a disease specified in Rule 3A."
                      : loan.principal <= LOAN_PERQ_THRESHOLD
                        ? `No perquisite — aggregate loan is within ${inr(LOAN_PERQ_THRESHOLD, { decimals: false })}.`
                        : "No perquisite — the rate charged is at or above the SBI benchmark."}
                  </p>
                )}
              </section>

              {loan.schedule.length > 0 && (
                <section aria-labelledby="sched-h">
                  <div className="mb-1.5 flex items-center justify-between">
                    <h3 id="sched-h" className="text-sm font-semibold">
                      EMI schedule
                    </h3>
                    <DownloadButton
                      fileName={`${loan.id}-schedule.xlsx`}
                      description={`${loan.schedule.length} instalments for ${loan.name}`}
                      label="Schedule"
                    />
                  </div>
                  <div className="max-h-80 overflow-auto rounded-md border border-border">
                    <table className="w-full text-xs">
                      <caption className="sr-only">EMI schedule for {loan.id}</caption>
                      <thead className="sticky top-0 bg-muted text-muted-foreground">
                        <tr>
                          {["#", "Month", "Opening", "Interest", "Principal", "EMI", "Closing"].map((h, i) => (
                            <th key={h} scope="col" className={cn("px-2 py-1.5 font-medium", i > 1 ? "text-right" : "text-left")}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {loan.schedule.map((s) => (
                          <tr
                            key={s.no}
                            className={cn(
                              "border-t border-border",
                              s.state === "current" && "bg-primary-soft/60",
                              s.state === "recovered" && "text-muted-foreground",
                            )}
                          >
                            <td className="tnum px-2 py-1">{s.no}</td>
                            <td className="px-2 py-1">
                              {s.label}
                              {s.state === "current" && <span className="ml-1 text-[10px] font-medium">· Sep run</span>}
                            </td>
                            {[s.opening, s.interest, s.principal, s.emi, s.closing].map((v, i) => (
                              <td key={i} className="tnum px-2 py-1 text-right">
                                {inr(v, { decimals: false })}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </SheetBody>
            <SheetFooter>
              {loan.status === "pending_approval" && (
                <>
                  <Gated menuKey="payroll.loans" action="A">
                    <Button variant="outline" onClick={() => onAction(loan, "reject")}>
                      <X /> Reject
                    </Button>
                  </Gated>
                  <Gated menuKey="payroll.loans" action="A">
                    <Button onClick={() => onAction(loan, "approve")}>
                      <Check /> Approve &amp; sanction
                    </Button>
                  </Gated>
                </>
              )}
              {loan.status === "sanctioned" && (
                <Gated menuKey="payroll.loans" action="E">
                  <Button onClick={() => onAction(loan, "disburse")}>
                    <Banknote /> Mark disbursed
                  </Button>
                </Gated>
              )}
              {loan.status === "active" && (
                <Gated menuKey="payroll.loans" action="E">
                  <Button variant="destructive" onClick={() => onAction(loan, "foreclose")}>
                    <Ban /> Foreclose
                  </Button>
                </Gated>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
