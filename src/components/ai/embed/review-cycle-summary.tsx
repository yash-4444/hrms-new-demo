"use client";

import * as React from "react";
import { Sparkles, ThumbsUp, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { num } from "@/lib/format";
import { useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { AI_TONE, AiBadge, AiExplainButton, AiFeedback, useCopilot } from "@/components/ai";
import type { ReviewForm } from "@/mock/growth";
import { summariseCycle } from "./review-ai";

/* ============================================================================
   "✨ AI feedback summary" for a review cycle. Reads the forms in the viewer's
   scope (their own reportees, or the whole cycle for HR) and reports
   completion, the rating spread and recurring themes. Read-only.
   ========================================================================== */

export function ReviewCycleSummary({ forms, cycleName, scopeLabel }: { forms: ReviewForm[]; cycleName: string; scopeLabel: string }) {
  const s = React.useMemo(() => summariseCycle(forms), [forms]);
  const copilot = useCopilot();
  const { can } = useApp();
  const [hidden, setHidden] = React.useState(false);
  if (!s || hidden) return null;
  const maxCount = Math.max(1, ...s.distribution.map((d) => d.count));

  return (
    <section className={cn("rounded-lg border p-4", AI_TONE.soft)} aria-labelledby="ai-cycle-summary">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="ai-cycle-summary" className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
            <Sparkles className={cn("size-4", AI_TONE.icon)} aria-hidden />
            AI feedback summary
            <AiBadge />
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {cycleName} · {scopeLabel} · {num(s.submitted)} of {num(s.forms)} manager reviews in
            {s.pendingSelf + s.pendingManager > 0 &&
              ` · waiting on ${[s.pendingSelf && `${s.pendingSelf} self`, s.pendingManager && `${s.pendingManager} manager`].filter(Boolean).join(" and ")}`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <AiExplainButton title="How this summary was built" drivers={s.drivers} footnote="Summaries inform the conversation — they never set or change a rating." />
          <Button size="sm" variant="ghost" onClick={() => setHidden(true)}>
            Dismiss
          </Button>
        </div>
      </div>

      <div className="mt-3 grid gap-4 md:grid-cols-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Manager rating spread</p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {s.distribution.map((d) => (
              <li key={d.rating} className="flex items-center gap-2 text-[11px]">
                <span className="tnum w-3 font-semibold">{d.rating}</span>
                <span className="h-1.5 flex-1 rounded-full bg-muted" aria-hidden>
                  <span className="block h-1.5 rounded-full bg-violet-500 dark:bg-violet-400" style={{ width: `${(d.count / maxCount) * 100}%` }} />
                </span>
                <span className="tnum w-24 text-muted-foreground">
                  {num(d.count)} · {d.label}
                </span>
              </li>
            ))}
          </ul>
          <p className="tnum mt-1.5 text-[11px] text-muted-foreground">
            Average manager {s.avgManager.toFixed(2)} · self {s.avgSelf.toFixed(2)}
            {s.divergentForms > 0 && ` · ${s.divergentForms} form${s.divergentForms === 1 ? "" : "s"} with a 2-point gap`}
          </p>
        </div>

        <div>
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <ThumbsUp className="size-3" aria-hidden /> Strongest competencies
          </p>
          <ul className="mt-1.5 flex flex-col gap-1 text-xs">
            {s.strengths.map((c) => (
              <li key={c.name} className="flex justify-between gap-2">
                {c.name} <span className="tnum text-muted-foreground">{c.avg.toFixed(1)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <TrendingUp className="size-3" aria-hidden /> Development themes
          </p>
          <ul className="mt-1.5 flex flex-col gap-1 text-xs">
            {s.development.map((c) => (
              <li key={c.name} className="flex justify-between gap-2">
                {c.name} <span className="tnum text-muted-foreground">{c.avg.toFixed(1)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Recurring themes in comments</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {s.themes.map((t) => (
              <li
                key={t.label}
                className={cn(
                  "rounded-md border px-1.5 py-0.5 text-[11px]",
                  t.tone === "strength" ? "border-success/30 bg-success-soft text-success-fg" : "border-warning/30 bg-warning-soft text-warning-fg",
                )}
              >
                {t.label} <span className="tnum opacity-80">· {t.mentions}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted-foreground">Green = praised, amber = development area.</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-violet-200 pt-2 dark:border-violet-400/25">
        <p className="text-[11px] text-muted-foreground">AI suggestion — review before use. Individual comments stay visible only to their authorised readers.</p>
        <div className="flex items-center gap-1.5">
          <AiFeedback />
          {copilot && can("ai.copilot", "V") && (
            <Button size="sm" variant="outline" onClick={() => copilot.ask(`Summarise the ${cycleName} review feedback for my team`)}>
              <Sparkles /> Ask Copilot
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
