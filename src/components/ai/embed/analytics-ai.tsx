"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { inrCompact, pct } from "@/lib/format";
import { BRANCHES, DEPARTMENTS } from "@/mock/org";
import { EMPLOYEES } from "@/mock/employees";
import {
  COST_BY_CENTRE,
  GENDER_BY_DEPT,
  LEAVE_UTILISATION,
  PAYROLL_COST_TREND,
  RECRUITMENT_FUNNEL,
  SOURCE_MIX,
  TIME_TO_FILL,
  attritionFor,
  scopeMatcher,
} from "@/mock/insights";
import { useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";
import { AI_TONE, AiBadge, AiExplainButton, type ExplainDriver } from "@/components/ai";

/* ============================================================================
   Analytics AI — an "Ask a question" bar that hands off to /ai/ask, and one
   insight callout per chart. Every insight is computed from the same fixture
   the chart beside it draws, so the sentence can never disagree with the bars.
   ========================================================================== */

export interface ChartInsight {
  text: string;
  summary: string;
  drivers: ExplainDriver[];
}

const pts = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)} pts`;

/** The branch whose attrition moved most vs the prior year, and the department behind it. */
export const ATTRITION_INSIGHT: ChartInsight = (() => {
  const staffed = BRANCHES.filter((b) => EMPLOYEES.some((e) => e.branchId === b.id && e.status !== "exited"));
  const rows = staffed.map((b) => ({ b, a: attritionFor(scopeMatcher(b.id, "all")) }));
  const top = rows.reduce((x, y) => (y.a.delta > x.a.delta ? y : x), rows[0]);
  const depts = DEPARTMENTS.map((d) => ({ d, a: attritionFor(scopeMatcher(top.b.id, d.id)) })).filter((x) => x.a.leavers12m > 0);
  const driver = depts.reduce((x, y) => (y.a.delta > x.a.delta ? y : x), depts[0]);
  const verb = top.a.delta >= 0 ? "rose" : "fell";
  return {
    text: `Attrition in ${top.b.city} ${verb} ${Math.abs(top.a.delta).toFixed(1)} pts to ${pct(top.a.rate)}${driver ? `, driven by ${driver.d.name}` : ""}.`,
    summary: `Largest year-on-year movement of the ${rows.length} staffed branches (rolling 12 months vs the 12 before).`,
    drivers: [
      { label: `${top.b.city}: ${pct(top.a.prevRate)} → ${pct(top.a.rate)}`, detail: `${top.a.leavers12m} exits · ${pct(top.a.voluntaryPct)} voluntary`, weight: Math.abs(top.a.delta) },
      ...(driver
        ? [{ label: `${driver.d.name} in ${top.b.city}: ${pts(driver.a.delta)}`, detail: `${driver.a.leavers12m} exits · ${pct(driver.a.rate)} rate`, weight: Math.abs(driver.a.delta) }]
        : []),
      ...rows
        .filter((r) => r !== top)
        .sort((x, y) => y.a.delta - x.a.delta)
        .slice(0, 2)
        .map((r) => ({ label: `${r.b.city}: ${pts(r.a.delta)}`, detail: `Now ${pct(r.a.rate)}`, weight: Math.abs(r.a.delta) })),
    ],
  };
})();

export const COST_INSIGHT: ChartInsight = (() => {
  const now = PAYROLL_COST_TREND.at(-1)!;
  const prev = PAYROLL_COST_TREND.at(-2)!;
  const d = ((now.gross - prev.gross) / Math.max(1, prev.gross)) * 100;
  const top = COST_BY_CENTRE[0];
  const total = COST_BY_CENTRE.reduce((a, c) => a + c.value, 0);
  return {
    text: `Gross pay ${d >= 0 ? "up" : "down"} ${Math.abs(d).toFixed(1)}% month on month; ${top.department} carries ${pct((top.value / Math.max(1, total)) * 100)} of monthly cost.`,
    summary: `${prev.month} → ${now.month}, from the payroll cost trend and the cost-centre split.`,
    drivers: [
      { label: `${prev.month} gross ${inrCompact(prev.gross)} → ${now.month} ${inrCompact(now.gross)}`, weight: Math.abs(d) },
      ...COST_BY_CENTRE.slice(0, 3).map((c) => ({ label: `${c.department} · ${inrCompact(c.value)} / month`, detail: `${c.headcount} people · ${inrCompact(c.perHead)} average CTC`, weight: c.value })),
    ],
  };
})();

export const HIRING_INSIGHT: ChartInsight = (() => {
  const top = RECRUITMENT_FUNNEL[0]?.value ?? 0;
  const hired = RECRUITMENT_FUNNEL.at(-1)?.value ?? 0;
  const src = SOURCE_MIX.reduce((a, b) => (b.value > a.value ? b : a), SOURCE_MIX[0]);
  const srcTotal = SOURCE_MIX.reduce((a, b) => a + b.value, 0);
  const slow = TIME_TO_FILL.reduce((a, b) => (b.days > a.days ? b : a), TIME_TO_FILL[0]);
  const drop = RECRUITMENT_FUNNEL.slice(1).map((s, i) => ({ s, from: RECRUITMENT_FUNNEL[i], rate: s.value / Math.max(1, RECRUITMENT_FUNNEL[i].value) }));
  const worst = drop.reduce((a, b) => (b.rate < a.rate ? b : a), drop[0]);
  return {
    text: `${pct((hired / Math.max(1, top)) * 100)} of applicants reach hire; the steepest drop is ${worst.from.stage} → ${worst.s.stage}. ${slow.dept} is slowest to fill at ${slow.days} days.`,
    summary: "From the candidate funnel, source mix and time-to-fill fixtures shown on this tab.",
    drivers: [
      { label: `${worst.from.stage} → ${worst.s.stage}: ${pct(worst.rate * 100)} conversion`, weight: 1 - worst.rate },
      { label: `${src.name} is the top source`, detail: `${pct((src.value / Math.max(1, srcTotal)) * 100)} of candidates`, weight: src.value / Math.max(1, srcTotal) },
      { label: `${slow.dept}: ${slow.days} days to fill`, weight: slow.days / 100 },
    ],
  };
})();

export const DIVERSITY_INSIGHT: ChartInsight = (() => {
  const low = GENDER_BY_DEPT.at(-1)!;
  const high = GENDER_BY_DEPT[0];
  return {
    text: `Female representation ranges from ${pct(low.femalePct)} in ${low.dept} to ${pct(high.femalePct)} in ${high.dept}.`,
    summary: "Spread across departments — a hiring-slate signal, not a judgement on any individual.",
    drivers: [
      { label: `${low.dept}: ${low.female} of ${low.female + low.male}`, weight: low.femalePct },
      { label: `${high.dept}: ${high.female} of ${high.female + high.male}`, weight: high.femalePct },
    ],
  };
})();

export const LEAVE_INSIGHT: ChartInsight = (() => {
  const total = LEAVE_UTILISATION.reduce((a, l) => a + l.value, 0);
  const sorted = [...LEAVE_UTILISATION].sort((a, b) => b.value - a.value);
  const lop = LEAVE_UTILISATION.find((l) => l.name === "Loss of Pay");
  return {
    text: `${sorted[0].name} is ${pct((sorted[0].value / Math.max(1, total)) * 100)} of leave days taken${lop ? `; Loss of Pay is ${pct((lop.value / Math.max(1, total)) * 100)}` : ""}.`,
    summary: "Share of leave days by type, financial year to date.",
    drivers: sorted.slice(0, 3).map((l) => ({ label: `${l.name}: ${l.value.toLocaleString("en-IN")} days`, weight: l.value })),
  };
})();

/** Violet callout under a chart: one AI sentence plus a "Why?" popover. */
export function InsightCallout({ insight, className }: { insight: ChartInsight; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 rounded-md border px-3 py-2", AI_TONE.soft, className)}>
      <AiBadge label="AI insight" />
      <p className="min-w-0 flex-1 text-xs text-foreground">{insight.text}</p>
      <AiExplainButton
        title="How this insight was computed"
        summary={insight.summary}
        drivers={insight.drivers}
        footnote="Generated from the charts on this page — verify before quoting it."
      />
    </div>
  );
}

const ASK_SUGGESTIONS = ["Attrition in Pune last quarter", "Payroll cost by department", "Joiners vs leavers last 12 months"];

/** "Ask a question" bar — routes to /ai/ask?q=… for personas who can open it. */
export function AnalyticsAskBar() {
  const { can } = useApp();
  const router = useRouter();
  const [q, setQ] = React.useState("");
  if (!can("ai.ask", "V")) return null;
  const go = (text: string) => {
    const t = text.trim();
    if (t) router.push(`/ai/ask?q=${encodeURIComponent(t)}`);
  };
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        go(q);
      }}
      className={cn("flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center", AI_TONE.soft)}
    >
      <div className="flex items-center gap-2">
        <Sparkles className={cn("size-4 shrink-0", AI_TONE.icon)} aria-hidden />
        <span className="text-xs font-semibold whitespace-nowrap">Ask a question</span>
      </div>
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          aria-label="Ask a question about your workforce data"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. Attrition in Pune last quarter"
          className="h-8 pl-8"
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {ASK_SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => go(s)}
            className="hidden rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground xl:inline-flex"
          >
            {s}
          </button>
        ))}
        <Button type="submit" size="sm" className={AI_TONE.solid} disabled={!q.trim()}>
          Ask <ArrowRight aria-hidden />
        </Button>
      </div>
    </form>
  );
}
