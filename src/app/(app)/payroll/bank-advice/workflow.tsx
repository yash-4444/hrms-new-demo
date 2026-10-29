"use client";

import * as React from "react";
import { Check, FileCog, ShieldCheck, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "@/lib/format";
import { useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { DecisionDialog } from "@/components/finance/kit";
import { GatedBlocked } from "../payslips/run-select";

/* ============================================================================
   Maker-checker strip for a bank advice batch. Payroll Admin (X) generates,
   the Finance Controller (A) approves — and never the same person.
   ========================================================================== */

export type AdviceStage = "blocked" | "ready" | "generated" | "approved" | "paid";

export interface Stamp {
  by: string;
  at: string;
}

const STEPS: { stage: AdviceStage; label: string }[] = [
  { stage: "ready", label: "Run approved" },
  { stage: "generated", label: "Generated · maker" },
  { stage: "approved", label: "Approved · checker" },
  { stage: "paid", label: "Uploaded & paid" },
];

const ORDER: AdviceStage[] = ["blocked", "ready", "generated", "approved", "paid"];

export function AdviceWorkflow({
  stage,
  maker,
  checker,
  blockReason,
  onGenerate,
  onApprove,
  onReject,
  subject,
}: {
  stage: AdviceStage;
  maker: Stamp | null;
  checker: Stamp | null;
  blockReason: string;
  onGenerate: () => void;
  onApprove: () => void;
  onReject: (comment: string) => void;
  subject: string;
}) {
  const { persona } = useApp();
  const [rejecting, setRejecting] = React.useState(false);
  const at = ORDER.indexOf(stage);
  const selfCheck = stage === "generated" && maker?.by === persona.name;

  const generateReason =
    stage === "blocked" ? blockReason : stage === "ready" ? null : "Already generated — reject it to regenerate.";
  const approveReason =
    stage !== "generated"
      ? stage === "approved" || stage === "paid"
        ? "Already approved."
        : "Nothing to approve — the maker has not generated the file yet."
      : selfCheck
        ? "Segregation of duties: the maker of a bank file cannot also approve it."
        : null;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-2" aria-label={`${subject} progress`}>
        {STEPS.map((s, i) => {
          const done = at >= ORDER.indexOf(s.stage);
          const stamp = s.stage === "generated" ? maker : s.stage === "approved" ? checker : null;
          return (
            <li key={s.stage} className="flex items-center gap-1">
              {i > 0 && <span className={cn("h-px w-4", done ? "bg-success" : "bg-border")} aria-hidden />}
              <span
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
                  done ? "border-success/25 bg-success-soft text-success-fg" : "border-border text-muted-foreground",
                )}
                aria-current={ORDER[at + 1] === s.stage ? "step" : undefined}
              >
                {done && <Check className="size-3" aria-hidden />}
                <span className="font-medium">{s.label}</span>
                {stamp && done && (
                  <span className="hidden opacity-80 md:inline">
                    · {stamp.by}, {fmtDateTime(stamp.at)}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        <GatedBlocked menuKey="payroll.bank_advice" action="X" reason={generateReason}>
          <Button size="sm" variant={stage === "ready" ? "default" : "outline"} disabled={!!generateReason} onClick={onGenerate}>
            <FileCog /> Generate
          </Button>
        </GatedBlocked>
        <GatedBlocked menuKey="payroll.bank_advice" action="A" reason={approveReason}>
          <Button size="sm" variant="outline" disabled={!!approveReason} onClick={() => setRejecting(true)}>
            <Undo2 /> Reject
          </Button>
        </GatedBlocked>
        <GatedBlocked menuKey="payroll.bank_advice" action="A" reason={approveReason}>
          <Button size="sm" disabled={!!approveReason} onClick={onApprove}>
            <ShieldCheck /> Approve
          </Button>
        </GatedBlocked>
      </div>
      <DecisionDialog
        open={rejecting}
        onOpenChange={setRejecting}
        title={`Reject ${subject}?`}
        description="The file is discarded and returns to the maker to regenerate. Your reason is recorded on the batch."
        confirmLabel="Reject file"
        onConfirm={onReject}
      />
    </div>
  );
}
