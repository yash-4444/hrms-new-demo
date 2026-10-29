"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/primitives";
import { AI_TONE, useCopilot } from "@/components/ai";

/* ============================================================================
   "✨ Explain my payslip" — opens HR Copilot with a month-over-month question
   about the payslip on screen. Personas without Copilot (or outside the
   provider) fall back to the formula-trace sheet the page already has.
   ========================================================================== */

export function PayslipExplainButton({
  periodLabel,
  prevLabel,
  onFallback,
  className,
}: {
  periodLabel: string;
  /** The month before, when there is one. */
  prevLabel?: string;
  onFallback: () => void;
  className?: string;
}) {
  const copilot = useCopilot();
  const { can } = useApp();
  const viaCopilot = !!copilot && can("ai.copilot", "V");
  const question = prevLabel
    ? `Explain my payslip — why is my net pay for ${periodLabel} different from ${prevLabel}?`
    : `Explain my payslip for ${periodLabel}`;

  return (
    <Hint text={viaCopilot ? "Opens HR Copilot with a plain-language, month-over-month explanation" : "Opens the formula trace for every line"}>
      <Button
        variant="outline"
        size="sm"
        className={cn(
          "border-violet-300/70 text-violet-700 hover:bg-violet-50 dark:border-violet-400/30 dark:text-violet-200 dark:hover:bg-violet-500/15",
          AI_TONE.ring,
          className,
        )}
        onClick={() => (viaCopilot ? copilot!.ask(question) : onFallback())}
      >
        <Sparkles aria-hidden /> Explain my payslip
      </Button>
    </Hint>
  );
}
