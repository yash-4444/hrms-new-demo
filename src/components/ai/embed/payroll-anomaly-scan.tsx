"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ScanSearch, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { inr, num } from "@/lib/format";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState, Hint } from "@/components/ui/primitives";
import { FilterSelect } from "@/components/ui/overlays";
import { AI_TONE, AiBadge, AiConfidence, AiExplainButton } from "@/components/ai";
import { scanPayRun, type PayFlag, type PayFlagSeverity } from "./payroll-scan";

/* ============================================================================
   "✨ AI anomaly scan" for /payroll/runs/[id]. Variance vs the previous run,
   per employee, with a reason and drivers. The scan never edits the run —
   Mark reviewed and Dismiss are recorded against the flag only.
   ========================================================================== */

const money = (n: number) => inr(n, { decimals: false });
const PREVIEW = 6;

const SEV_CLS: Record<PayFlagSeverity, string> = {
  High: "border-destructive/30 bg-destructive-soft text-destructive-fg",
  Medium: "border-warning/30 bg-warning-soft text-warning-fg",
  Low: "border-border bg-muted text-muted-foreground",
};

export function PayrollAnomalyScan({
  runId,
  hasBreakdown,
  hardExceptionCount,
}: {
  runId: string;
  hasBreakdown: boolean;
  /** Open hard exceptions — shown for context; the scan skips those employees. */
  hardExceptionCount: number;
}) {
  const { can } = useApp();
  const scan = React.useMemo(() => scanPayRun(runId), [runId]);
  const [state, setState] = React.useState<Record<string, "reviewed" | "dismissed">>({});
  const [severity, setSeverity] = React.useState("all");
  const [showAll, setShowAll] = React.useState(false);

  if (!scan || !scan.previous) return null;
  const canEdit = can("payroll.runs", "E");
  const canBreakdown = hasBreakdown && can("payroll.runs", "V");

  const open = scan.flags.filter((f) => !state[f.id]);
  const filtered = open.filter((f) => severity === "all" || f.severity === severity);
  const shown = showAll ? filtered : filtered.slice(0, PREVIEW);
  const high = open.filter((f) => f.severity === "High").length;
  const handled = Object.keys(state).length;

  const decide = (f: PayFlag, to: "reviewed" | "dismissed") => {
    setState((s) => ({ ...s, [f.id]: to }));
    mockAction(to === "reviewed" ? `Flag reviewed — ${f.name}` : `Flag dismissed — ${f.name}`, {
      description:
        to === "reviewed"
          ? "Recorded on the run audit trail. The run itself is unchanged."
          : "The scan will not raise this movement again for this run.",
      tone: to === "reviewed" ? "success" : "info",
      undo: () =>
        setState((s) => {
          const n = { ...s };
          delete n[f.id];
          return n;
        }),
    });
  };

  return (
    <Card className={cn("flex flex-col overflow-hidden border", AI_TONE.soft)}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-violet-200 px-4 py-2.5 dark:border-violet-400/25">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
            <Sparkles className={cn("size-4", AI_TONE.icon)} aria-hidden />
            AI anomaly scan
            <AiBadge />
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {num(scan.scanned)} employees compared with {scan.previous.label}.{" "}
            {num(open.length)} movement{open.length === 1 ? "" : "s"} to review beyond the{" "}
            {num(hardExceptionCount)} hard exception{hardExceptionCount === 1 ? "" : "s"} above
            {high > 0 ? ` · ${num(high)} high` : ""}
            {handled > 0 ? ` · ${num(handled)} handled` : ""}.
          </p>
        </div>
        <FilterSelect
          label="Severity"
          value={severity}
          onValueChange={setSeverity}
          allLabel="All"
          options={[
            { value: "High", label: "High" },
            { value: "Medium", label: "Medium" },
            { value: "Low", label: "Low" },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ScanSearch}
          title={open.length === 0 ? "Every flag has been handled" : "No flags at this severity"}
          description="The scan compares net pay, LOP, arrears, overtime, tax and recoveries for every employee against the previous month."
          className="border-0 bg-transparent"
        />
      ) : (
        <ul className="bg-card">
          {shown.map((f) => (
            <li key={f.id} className="flex flex-wrap items-start gap-3 border-b border-border px-4 py-3 last:border-0">
              <span className={cn("mt-0.5 shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold", SEV_CLS[f.severity])}>
                {f.severity}
              </span>
              <div className="min-w-[220px] flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
                  {f.title}
                  <Badge variant="muted">{f.name}</Badge>
                  <Badge variant="outline">{f.kind}</Badge>
                  {f.inInsights && (
                    <Hint text="The same signal is listed on AI insights → Anomalies.">
                      <span className={cn("rounded-md border px-1 py-px text-[10px]", AI_TONE.chip)}>Also in insights</span>
                    </Hint>
                  )}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{f.reason}</p>
                <p className="tnum mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span>
                    Net {f.before !== null ? `${money(f.before)} → ` : ""}
                    <span className="font-medium text-foreground">{money(f.after)}</span>
                  </span>
                  <span>
                    {f.department} · {f.branch}
                  </span>
                  <AiConfidence value={f.confidence} />
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                <AiExplainButton
                  title="Why was this flagged?"
                  summary={`${f.title}. Ranked by size of the change; the run is not altered.`}
                  drivers={f.drivers}
                />
                {canBreakdown && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/payroll/runs/${runId}/employee/${f.code}`}>Breakdown</Link>
                  </Button>
                )}
                {canEdit ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => decide(f, "dismissed")} aria-label={`Dismiss flag for ${f.name}`}>
                      <X /> Dismiss
                    </Button>
                    <Button size="sm" className={AI_TONE.solid} onClick={() => decide(f, "reviewed")}>
                      <Check /> Mark reviewed
                    </Button>
                  </>
                ) : (
                  <Hint text="Only payroll staff with edit rights can record a review.">
                    <span className="inline-flex cursor-not-allowed">
                      <Button size="sm" disabled>
                        <Check /> Mark reviewed
                      </Button>
                    </span>
                  </Hint>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-violet-200 px-4 py-2 text-[11px] text-muted-foreground dark:border-violet-400/25">
        <span>AI suggestion — review before use. The scan flags; a person decides. Nothing here blocks locking the run.</span>
        {filtered.length > PREVIEW && (
          <Button size="sm" variant="ghost" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
            {showAll ? "Show fewer" : `Show all ${num(filtered.length)}`}
          </Button>
        )}
      </div>
    </Card>
  );
}
