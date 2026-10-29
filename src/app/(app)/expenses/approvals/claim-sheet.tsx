"use client";

import * as React from "react";
import { Check, FileImage, FileText, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDateShort, inr } from "@/lib/format";
import type { ExpenseClaim, ExpenseLine } from "@/mock/workplace";
import { EXP_STAGE_LABEL, type ExpChainStep } from "@/mock/finance-expense";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/overlays";
import { Alert, Avatar, Badge } from "@/components/ui/primitives";
import { AiBadge } from "@/components/ai";

/* ============================================================================
   Claim preview drawer — shared by /expenses/approvals and /expenses/finance.
   Each line renders a receipt card built from the line itself (merchant, date,
   amount, file name), so the reviewer can match the bill against the claim.
   ========================================================================== */

function merchantOf(description: string) {
  return description.split(/ — |, /)[0];
}

function ReceiptCard({ line, flagged }: { line: ExpenseLine; flagged?: string }) {
  const Icon = line.receiptKind === "pdf" ? FileText : FileImage;
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-md border bg-card p-3",
        line.violation ? "border-warning/40" : "border-border",
        flagged && "border-violet-300 dark:border-violet-400/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold">{line.category}</p>
          <p className="text-[11px] text-muted-foreground">{line.description}</p>
        </div>
        <span className="tnum shrink-0 text-sm font-semibold">{inr(line.amount, { decimals: false })}</span>
      </div>

      {/* the rendered receipt */}
      <figure
        aria-label={`Receipt ${line.receipt}`}
        className="rounded border border-dashed border-border bg-subtle px-3 py-2.5 font-mono text-[10px] leading-relaxed text-muted-foreground"
      >
        <p className="text-center text-[11px] font-semibold text-foreground">{merchantOf(line.description)}</p>
        <p className="text-center">Tax invoice · {fmtDate(line.date)}</p>
        <div className="my-1.5 border-t border-dashed border-border" />
        <p className="flex justify-between">
          <span>Taxable value</span>
          <span className="tnum">{inr(Math.round(line.amount / 1.18), { decimals: false })}</span>
        </p>
        <p className="flex justify-between">
          <span>GST 18%</span>
          <span className="tnum">{inr(line.amount - Math.round(line.amount / 1.18), { decimals: false })}</span>
        </p>
        <p className="flex justify-between font-semibold text-foreground">
          <span>Total</span>
          <span className="tnum">{inr(line.amount, { decimals: false })}</span>
        </p>
        <figcaption className="mt-1.5 flex items-center gap-1 border-t border-dashed border-border pt-1.5">
          <Icon className="size-3" aria-hidden /> {line.receipt}
        </figcaption>
      </figure>

      {line.violation && (
        <Alert tone="warning" icon={TriangleAlert}>
          {inr(line.excess, { decimals: false })} over the {line.category} cap of {inr(line.limit, { decimals: false })}{" "}
          ({line.limitBasis}).
        </Alert>
      )}
      {flagged && (
        <p className="flex items-center gap-1.5 text-[11px] text-violet-700 dark:text-violet-300">
          <AiBadge /> Possible duplicate of {flagged}
        </p>
      )}
    </div>
  );
}

export function ClaimSheet({
  claim,
  onOpenChange,
  chain,
  flaggedLineId,
  flaggedAgainst,
  footer,
}: {
  claim: ExpenseClaim | null;
  onOpenChange: (open: boolean) => void;
  chain?: ExpChainStep[];
  flaggedLineId?: string;
  flaggedAgainst?: string;
  footer?: React.ReactNode;
}) {
  return (
    <Sheet open={!!claim} onOpenChange={onOpenChange}>
      <SheetContent width="sm:max-w-lg">
        {claim && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2.5">
                <Avatar name={claim.employeeName} size={32} />
                <span className="min-w-0">
                  <span className="block truncate">{claim.claimNo}</span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {claim.employeeName} · {claim.department}
                  </span>
                </span>
              </SheetTitle>
              <SheetDescription>
                {claim.purpose} · {fmtDateShort(claim.periodFrom)} – {fmtDate(claim.periodTo)}
              </SheetDescription>
            </SheetHeader>
            <SheetBody className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="tnum text-base font-semibold">{inr(claim.total, { decimals: false })}</span>
                <Badge variant="muted">
                  {claim.lines.length} line{claim.lines.length === 1 ? "" : "s"}
                </Badge>
                {claim.hasViolation && (
                  <Badge variant="outline" className="border-warning/40 text-warning-fg">
                    {claim.violationCount} policy violation{claim.violationCount === 1 ? "" : "s"}
                  </Badge>
                )}
              </div>

              {chain && (
                <ol aria-label="Approval chain" className="flex flex-col gap-1.5">
                  {chain.map((s, i) => (
                    <li key={s.stage} className="flex items-center gap-2 text-xs">
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                          s.state === "done" && "border-success/30 bg-success-soft text-success-fg",
                          s.state === "current" && "border-primary/40 bg-primary-soft text-primary-soft-foreground",
                          s.state === "pending" && "border-border bg-muted text-muted-foreground",
                        )}
                      >
                        {s.state === "done" ? <Check className="size-3" aria-hidden /> : i + 1}
                      </span>
                      <span className="font-medium">{EXP_STAGE_LABEL[s.stage]}</span>
                      <span className="text-muted-foreground">· {s.approver}</span>
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        {s.state === "done" ? "Approved" : s.state === "current" ? "Awaiting decision" : "Next"}
                      </span>
                    </li>
                  ))}
                </ol>
              )}

              <div className="flex flex-col gap-2.5">
                {claim.lines.map((l) => (
                  <ReceiptCard
                    key={l.id}
                    line={l}
                    flagged={l.id === flaggedLineId ? flaggedAgainst : undefined}
                  />
                ))}
              </div>
            </SheetBody>
            {footer && <SheetFooter>{footer}</SheetFooter>}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
