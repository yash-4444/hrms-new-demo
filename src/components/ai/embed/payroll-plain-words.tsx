"use client";

import * as React from "react";
import { Copy, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { inr } from "@/lib/format";
import { mockAction } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { AI_TONE, AiBadge, AiExplainButton, AiFeedback } from "@/components/ai";
import { explainPayslip } from "./payroll-scan";

/* ============================================================================
   "Explain in plain words" — a month-over-month summary of one payslip for
   the employee breakdown page. Computed from the two payslips; no model call.
   ========================================================================== */

const money = (n: number) => inr(n, { decimals: false });

export function PayrollPlainWords({ runId, employeeCode }: { runId: string; employeeCode: string }) {
  const ex = React.useMemo(() => explainPayslip(runId, employeeCode), [runId, employeeCode]);
  const [open, setOpen] = React.useState(true);
  if (!ex) return null;

  const text = ex.sentences.join(" ");
  const drivers = ex.lines.slice(0, 5).map((l) => ({
    label: `${l.label}: ${money(l.before)} → ${money(l.now)}`,
    detail: l.deduction ? "Deduction" : "Earning",
    weight: Math.abs(l.now - l.before),
  }));

  return (
    <section className={cn("rounded-lg border p-4", AI_TONE.soft)} aria-labelledby="plain-words-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="plain-words-title" className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
          <Sparkles className={cn("size-4", AI_TONE.icon)} aria-hidden />
          Explain in plain words
          <AiBadge />
        </h2>
        <div className="flex items-center gap-1.5">
          {drivers.length > 0 && (
            <AiExplainButton
              title="What moved"
              summary={`${ex.prevLabel} → ${ex.periodLabel}, largest change first.`}
              drivers={drivers}
              footnote="Figures come from the traced components below — expand any row to check the rule."
            />
          )}
          <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? "Hide" : "Show"}
          </Button>
        </div>
      </div>
      {open && (
        <>
          <ul className="mt-2 flex flex-col gap-1.5 text-xs leading-relaxed text-foreground">
            {ex.sentences.map((s) => (
              <li key={s} className="flex gap-2">
                <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full bg-violet-500 dark:bg-violet-400")} aria-hidden />
                {s}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-violet-200 pt-2 dark:border-violet-400/25">
            <p className="text-[11px] text-muted-foreground">
              AI summary — review before sharing with the employee. Numbers match the traced payslip.
            </p>
            <div className="flex items-center gap-1.5">
              <AiFeedback />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard?.writeText(text).catch(() => undefined);
                  mockAction("Explanation copied", { description: "Paste it into the helpdesk reply or an email." });
                }}
              >
                <Copy /> Copy
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
