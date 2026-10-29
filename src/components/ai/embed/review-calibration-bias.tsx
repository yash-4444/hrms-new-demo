"use client";

import * as React from "react";
import { Scale, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { AI_TONE, AiBadge, AiExplainButton } from "@/components/ai";
import { reviewFormsForManager } from "@/mock/growth";
import { CALIBRATION_AVG, calibrationBias, teamBias } from "./review-ai";

/* ============================================================================
   Rating-bias hint for /reviews/calibration. Compares each manager's average
   proposal with the cohort average and names leniency or severity. It is a
   prompt for the facilitator — it never moves a chip or changes a rating.
   ========================================================================== */

const sign = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toFixed(1)}`;

export function CalibrationBiasHint() {
  const { persona } = useApp();
  const signals = React.useMemo(() => calibrationBias(), []);
  const mine = React.useMemo(() => teamBias(reviewFormsForManager(persona.employeeId)), [persona.employeeId]);
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());

  const visible = signals.filter((s) => !dismissed.has(s.managerCode));
  const showMine = mine && Math.abs(mine.delta) >= 0.3 && !dismissed.has("__mine");
  if (!visible.length && !showMine) return null;

  return (
    <section className={cn("rounded-lg border p-4", AI_TONE.soft)} aria-labelledby="ai-bias-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="ai-bias-title" className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
            <Sparkles className={cn("size-4", AI_TONE.icon)} aria-hidden />
            Rating-bias check
            <AiBadge />
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Average proposed rating by reporting manager vs the cohort average of {CALIBRATION_AVG.toFixed(2)}. Teams of 2+ that sit 0.4 or more away are listed.
          </p>
        </div>
      </div>

      {showMine && mine && (
        <div className="mt-3 flex flex-wrap items-start gap-2 rounded-md border border-violet-200 bg-card p-2.5 text-xs dark:border-violet-400/25">
          <Scale className={cn("mt-0.5 size-3.5 shrink-0", AI_TONE.icon)} aria-hidden />
          <p className="min-w-0 flex-1">
            <span className="font-medium">
              Your team&apos;s average is {Math.abs(mine.delta).toFixed(1)} {mine.delta >= 0 ? "above" : "below"} company
            </span>{" "}
            ({mine.avg.toFixed(2)} across {mine.count} submitted reviews) —{" "}
            {mine.delta >= 0 ? "check for leniency before the session." : "check for severity before the session."}
          </p>
          <Button size="icon-sm" variant="ghost" aria-label="Dismiss your team's hint" onClick={() => setDismissed((d) => new Set(d).add("__mine"))}>
            <X />
          </Button>
        </div>
      )}

      {visible.length > 0 && (
        <ul className="mt-3 flex flex-col divide-y divide-border overflow-hidden rounded-md border border-border bg-card">
          {visible.map((s) => (
            <li key={s.managerCode} className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
              <span className="min-w-[160px] flex-1">
                <span className="font-medium">{s.manager}</span>
                <span className="text-muted-foreground"> · {s.count} in cohort · avg {s.avg.toFixed(2)}</span>
              </span>
              <Badge
                variant="outline"
                className={s.kind === "leniency" ? "border-warning/30 bg-warning-soft text-warning-fg" : "border-primary/25 bg-primary-soft text-primary-soft-foreground"}
              >
                {sign(s.delta)} · possible {s.kind}
              </Badge>
              <AiExplainButton
                title={`Why ${s.manager}'s team is flagged`}
                summary={`${s.kind === "leniency" ? "Higher" : "Lower"} than the cohort by ${Math.abs(s.delta).toFixed(1)}. A prompt to look at evidence, not a correction.`}
                drivers={s.drivers}
              />
              <Button size="sm" variant="ghost" onClick={() => setDismissed((d) => new Set(d).add(s.managerCode))}>
                Dismiss
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">
        AI suggestion — review before use. No rating or box placement is changed automatically; the facilitator decides.
      </p>
    </section>
  );
}
