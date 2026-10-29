"use client";

import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { STEPS } from "./types";

/** Six-step rail. Completed steps (and the current one) are buttons; the rest are locked until reached. */
export function WizardStepper({
  step,
  done,
  canOpen,
  onJump,
}: {
  step: number;
  done: Set<number>;
  canOpen: (i: number) => boolean;
  onJump: (i: number) => void;
}) {
  return (
    <nav aria-label="Pre-joining steps">
      <ol className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:gap-0.5 md:overflow-visible">
        {STEPS.map((s, i) => {
          const isDone = done.has(i);
          const current = i === step;
          const open = canOpen(i);
          return (
            <li key={s.key} className="shrink-0">
              <button
                type="button"
                disabled={!open}
                onClick={() => onJump(i)}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  current ? "bg-primary-soft font-semibold text-primary-soft-foreground" : "text-foreground",
                  open && !current && "hover:bg-muted",
                  !open && "cursor-not-allowed text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "tnum flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                    isDone
                      ? "border-success bg-success-soft text-success-fg"
                      : current
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground",
                  )}
                  aria-hidden
                >
                  {isDone ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                </span>
                <span className="whitespace-nowrap">{s.label}</span>
                {isDone && <span className="sr-only">(completed)</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Back / Save-and-continue row shared by every step. The primary button submits the step's form. */
export function StepFooter({
  onBack,
  nextLabel = "Save and continue",
  disabled,
}: {
  onBack?: () => void;
  nextLabel?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
      {onBack ? (
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft />
          Back
        </Button>
      ) : (
        <span />
      )}
      <Button type="submit" disabled={disabled}>
        {nextLabel}
        <ArrowRight />
      </Button>
    </div>
  );
}
