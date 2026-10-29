"use client";

import * as React from "react";
import { Crosshair, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { deptName } from "@/mock/org";
import { SPAN_OF_CONTROL } from "@/mock/insights";
import { mockAction } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { AI_TONE, AiBadge, AiExplainButton } from "@/components/ai/ai-ui";

/* ============================================================================
   AI span-of-control hint for /org-chart. Flags managers whose number of
   direct reports sits outside the healthy band — wide spans (more than 10)
   thin out coaching time, a single report is usually a layer that can be
   flattened. Computed from the same reporting lines the chart draws.
   ========================================================================== */

export const WIDE_SPAN = 10;

export type SpanFlag = "wide" | "single";

/** The flag a manager card carries, or null when the span is in the band. */
export function spanFlag(directs: number): SpanFlag | null {
  if (directs > WIDE_SPAN) return "wide";
  if (directs === 1) return "single";
  return null;
}

const FLAGGED = SPAN_OF_CONTROL.managers
  .map((m) => ({ ...m, flag: spanFlag(m.span) }))
  .filter((m): m is typeof m & { flag: SpanFlag } => m.flag !== null);

/** Small violet chip for a flagged manager card. */
export function SpanFlagChip({ flag, directs }: { flag: SpanFlag; directs: number }) {
  return (
    <span
      className={cn("inline-flex items-center gap-0.5 rounded border px-1 text-[10px] font-medium", AI_TONE.chip)}
      title={
        flag === "wide"
          ? `AI hint: ${directs} direct reports is above the ${WIDE_SPAN}-report guideline`
          : "AI hint: a single direct report — consider flattening this layer"
      }
    >
      ✨ {flag === "wide" ? "Wide span" : "Span 1"}
    </span>
  );
}

export function OrgSpanHint({
  department,
  onShow,
}: {
  /** Department id from the chart filter, or "all". */
  department: string;
  onShow: (code: string) => void;
}) {
  const [hidden, setHidden] = React.useState(false);
  const rows = department === "all" ? FLAGGED : FLAGGED.filter((m) => m.department === deptName(department));
  if (hidden || rows.length === 0) return null;

  const wide = rows.filter((m) => m.flag === "wide");
  const single = rows.filter((m) => m.flag === "single");

  return (
    <div className={cn("rounded-md border p-3", AI_TONE.soft)} role="note" aria-label="AI span-of-control hint">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <AiBadge />
          <p className="text-xs font-semibold text-foreground">Span-of-control check</p>
        </div>
        <div className="flex items-center gap-1">
          <AiExplainButton
            title="How managers are flagged"
            summary={`Company average is ${SPAN_OF_CONTROL.average.toFixed(1)} direct reports per manager across ${SPAN_OF_CONTROL.managers.length} people managers.`}
            drivers={[
              { label: `More than ${WIDE_SPAN} direct reports`, detail: "Above the guideline, 1:1 cadence and review quality tend to drop. Consider a team lead or splitting the team.", weight: wide.length || 1 },
              { label: "Exactly one direct report", detail: "Often a layer that adds approval hops without coaching load. Consider merging the layer.", weight: single.length || 1 },
            ]}
            footnote="A structural hint for HR to review — the org chart is never changed automatically."
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Dismiss span-of-control hint"
            onClick={() => {
              setHidden(true);
              mockAction("Hint dismissed", { tone: "info", undo: () => setHidden(false) });
            }}
          >
            <X aria-hidden />
          </Button>
        </div>
      </div>
      <p className="mt-1.5 text-xs text-foreground/90">
        {wide.length > 0 && (
          <>
            <span className="tnum font-medium">{wide.length}</span> manager{wide.length === 1 ? " has" : "s have"} more than{" "}
            {WIDE_SPAN} direct reports
          </>
        )}
        {wide.length > 0 && single.length > 0 && " and "}
        {single.length > 0 && (
          <>
            <span className="tnum font-medium">{single.length}</span> manager{single.length === 1 ? " has" : "s have"} a single direct report
          </>
        )}
        . Review whether these teams need a lead, a split or a merged layer.
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {rows.map((m) => (
          <li key={m.code}>
            <button
              type="button"
              onClick={() => onShow(m.code)}
              className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[11px] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Show ${m.name} on the chart — ${m.span} direct report${m.span === 1 ? "" : "s"}`}
            >
              <Crosshair className="size-3 text-muted-foreground" aria-hidden />
              <span className="font-medium text-foreground">{m.name}</span>
              <span className="tnum text-muted-foreground">
                {m.span} direct{m.span === 1 ? "" : "s"} · {m.department}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-muted-foreground">AI suggestion — review before use.</p>
    </div>
  );
}
