"use client";

import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PipelineStage } from "@/mock/hiring";
import { PUBLIC_STAGES } from "@/mock/lifecycle-public";

type StepState = "done" | "current" | "upcoming" | "stopped";

const STATE_TEXT: Record<StepState, string> = {
  done: "Completed",
  current: "In progress",
  upcoming: "Upcoming",
  stopped: "Not progressed",
};

/** Five public stages; a rejected application stops, politely, at the stage it reached. */
export function StageStepper({ stage, rejectedAtStage }: { stage: PipelineStage; rejectedAtStage: PipelineStage | null }) {
  const rejected = stage === "rejected";
  const anchor = rejected ? (rejectedAtStage ?? "applied") : stage;
  const at = PUBLIC_STAGES.findIndex((s) => s.id === anchor);

  const stateOf = (i: number): StepState => {
    if (rejected) return i < at ? "done" : i === at ? "stopped" : "upcoming";
    if (stage === "hired") return "done";
    return i < at ? "done" : i === at ? "current" : "upcoming";
  };

  return (
    <ol className="flex flex-col gap-3 sm:flex-row sm:gap-0" aria-label="Application progress">
      {PUBLIC_STAGES.map((s, i) => {
        const st = stateOf(i);
        const last = i === PUBLIC_STAGES.length - 1;
        return (
          <li
            key={s.id}
            className="relative flex items-start gap-2.5 sm:flex-1 sm:flex-col sm:items-center sm:gap-1.5 sm:text-center"
            aria-current={st === "current" || st === "stopped" ? "step" : undefined}
          >
            {!last && (
              <span
                aria-hidden
                className={cn(
                  "absolute hidden h-0.5 sm:block sm:left-[calc(50%+14px)] sm:right-[calc(-50%+14px)] sm:top-[13px]",
                  st === "done" ? "bg-success" : "bg-border",
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                st === "done" && "border-success bg-success-soft text-success-fg",
                st === "current" && "border-primary bg-primary text-primary-foreground ring-4 ring-primary/20",
                st === "upcoming" && "border-border bg-card text-muted-foreground",
                st === "stopped" && "border-border bg-muted text-muted-foreground",
              )}
              aria-hidden
            >
              {st === "done" ? <Check className="size-3.5" strokeWidth={3} /> : st === "stopped" ? <Minus className="size-3.5" /> : i + 1}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className={cn("text-xs font-medium", st === "upcoming" ? "text-muted-foreground" : "text-foreground")}>
                {s.label}
              </span>
              <span className="text-[11px] text-muted-foreground">{STATE_TEXT[st]}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
