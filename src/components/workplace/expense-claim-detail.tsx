"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDateTime, inr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
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
import { ReceiptStrip } from "./expense-receipt";
import type { ExpenseClaim, ExpenseLine } from "@/mock/workplace";

/* ============================================================================
   Claim detail — the read view shared by every tab, plus the two pieces the
   claim form reuses: the policy sentence and the amber inline alert.
   ========================================================================== */

/** The exact wording quoted to the claimant and to the approver. */
export function violationSentence(opts: {
  category: string;
  limit: number;
  basis: string;
  excess: number;
}) {
  return `Over the ${opts.category} limit of ${inr(opts.limit)} ${opts.basis} — this line is ${inr(
    opts.excess,
  )} above the cap and needs an approver exception.`;
}

/** Amber, icon + full sentence. Never a colour-only cue. */
export function ViolationAlert({
  category,
  limit,
  basis,
  excess,
  className,
}: {
  category: string;
  limit: number;
  basis: string;
  excess: number;
  className?: string;
}) {
  return (
    <Alert tone="warning" icon={AlertTriangle} className={className}>
      {violationSentence({ category, limit, basis, excess })}
    </Alert>
  );
}

/** Table-cell indicator: icon + words, used in every claim list. */
export function PolicyCell({ count }: { count: number }) {
  if (count === 0) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-muted-foreground">
        <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
        Within policy
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-warning-fg">
      <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
      {count} over limit
    </span>
  );
}

/** Every line of a claim, with the over-limit warning repeated under breaches. */
export function ExpenseLineTable({ lines, className }: { lines: ExpenseLine[]; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-md border border-border", className)}>
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-subtle">
            <tr className="border-b border-border">
              <th scope="col" className="px-2.5 py-1.5 text-left font-medium text-muted-foreground">
                Category
              </th>
              <th scope="col" className="px-2.5 py-1.5 text-left font-medium text-muted-foreground">
                Date
              </th>
              <th scope="col" className="px-2.5 py-1.5 text-left font-medium text-muted-foreground">
                Description
              </th>
              <th scope="col" className="px-2.5 py-1.5 text-right font-medium text-muted-foreground">
                Policy cap
              </th>
              <th scope="col" className="px-2.5 py-1.5 text-right font-medium text-muted-foreground">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <React.Fragment key={l.id}>
                <tr className={cn("border-b border-border", l.violation && "bg-warning-soft/40")}>
                  <td className="whitespace-nowrap px-2.5 py-1.5 font-medium">{l.category}</td>
                  <td className="tnum whitespace-nowrap px-2.5 py-1.5 text-muted-foreground">
                    {fmtDate(l.date)}
                  </td>
                  <td className="max-w-[280px] truncate px-2.5 py-1.5" title={l.description}>
                    {l.description}
                  </td>
                  <td className="tnum whitespace-nowrap px-2.5 py-1.5 text-right text-muted-foreground">
                    {inr(l.limit)}
                  </td>
                  <td
                    className={cn(
                      "tnum whitespace-nowrap px-2.5 py-1.5 text-right font-medium",
                      l.violation && "text-warning-fg",
                    )}
                  >
                    {inr(l.amount)}
                  </td>
                </tr>
                {l.violation && (
                  <tr className="border-b border-border last:border-0">
                    <td colSpan={5} className="px-2.5 py-1.5">
                      <ViolationAlert
                        category={l.category}
                        limit={l.limit}
                        basis={l.limitBasis}
                        excess={l.excess}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Submitted → routed → decided → reimbursed, with the decision note. */
export function ApprovalTrail({ claim }: { claim: ExpenseClaim }) {
  const steps: { label: string; meta: string; status: string }[] = [];

  if (claim.submittedOn) {
    steps.push({
      label: `Submitted by ${claim.employeeName}`,
      meta: fmtDateTime(claim.submittedOn),
      status: "submitted",
    });
    steps.push({
      label: `Routed to ${claim.approverName} for approval`,
      meta: `${claim.department} · approver ${claim.approverCode}`,
      status: "pending",
    });
  } else {
    steps.push({
      label: "Saved as a draft",
      meta: "Not submitted — only you can see this claim.",
      status: "draft",
    });
  }

  if (claim.decidedOn) {
    steps.push({
      label: `${claim.status === "rejected" ? "Rejected" : "Approved"} by ${claim.approverName}`,
      meta: fmtDateTime(claim.decidedOn),
      status: claim.status === "rejected" ? "rejected" : "approved",
    });
  }
  if (claim.reimbursedOn) {
    steps.push({
      label: "Reimbursed with the monthly payout",
      meta: fmtDate(claim.reimbursedOn),
      status: "completed",
    });
  }
  if (claim.status === "cancelled") {
    steps.push({
      label: "Withdrawn by the claimant",
      meta: "The approver no longer sees this claim in their queue.",
      status: "cancelled",
    });
  }

  return (
    <ol className="flex flex-col gap-2.5">
      {steps.map((s, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <StatusBadge status={s.status} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">{s.label}</p>
            <p className="tnum text-xs text-muted-foreground">{s.meta}</p>
          </div>
        </li>
      ))}
      {claim.decisionNote && (
        <li className="rounded-md border border-border bg-subtle px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Decision note
          </p>
          <p className="mt-0.5 text-xs text-foreground">{claim.decisionNote}</p>
        </li>
      )}
    </ol>
  );
}

/* ------------------------------------------------------------------- sheet */

export function ExpenseClaimDetail({
  claim,
  onOpenChange,
}: {
  claim: ExpenseClaim | null;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Sheet open={!!claim} onOpenChange={onOpenChange}>
      <SheetContent side="right" width="sm:max-w-2xl">
        {claim && (
          <>
            <SheetHeader>
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="tnum">{claim.claimNo}</SheetTitle>
                <StatusBadge status={claim.status} />
                {claim.hasViolation && <PolicyCell count={claim.violationCount} />}
              </div>
              <SheetDescription>{claim.purpose}</SheetDescription>
            </SheetHeader>

            <SheetBody className="flex flex-col gap-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
                <Detail label="Employee" value={`${claim.employeeName} · ${claim.employeeCode}`} />
                <Detail label="Department" value={claim.department} />
                <Detail label="Approver" value={claim.approverName} />
                <Detail
                  label="Claim period"
                  value={`${fmtDate(claim.periodFrom)} – ${fmtDate(claim.periodTo)}`}
                  tnum
                />
                <Detail label="Lines" value={String(claim.lines.length)} tnum />
                <Detail label="Total claimed" value={inr(claim.total)} tnum />
              </dl>

              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold text-foreground">Expense lines</h3>
                <ExpenseLineTable lines={claim.lines} />
                <p className="tnum text-right text-xs font-semibold text-foreground">
                  Total {inr(claim.total)}
                </p>
              </section>

              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold text-foreground">
                  Receipts
                  <span className="ml-1 font-normal text-muted-foreground">
                    ({claim.lines.length} attached)
                  </span>
                </h3>
                <ReceiptStrip lines={claim.lines} />
              </section>

              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold text-foreground">Approval trail</h3>
                <ApprovalTrail claim={claim} />
              </section>
            </SheetBody>

            <SheetFooter>
              <span className="mr-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Receipt className="size-3.5" aria-hidden />
                Reimbursed with the payroll run of the month the claim is approved in.
              </span>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Detail({ label, value, tnum }: { label: string; value: string; tnum?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("truncate text-xs font-medium text-foreground", tnum && "tnum")}>{value}</dd>
    </div>
  );
}
