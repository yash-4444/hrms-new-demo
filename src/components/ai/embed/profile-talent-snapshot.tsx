"use client";

import * as React from "react";
import { EyeOff, Quote, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoleId } from "@/lib/rbac";
import { descendantsOf, type Employee } from "@/mock/employees";
import { riskForCode, type RiskBand, type RiskDriver } from "@/mock/ai";
import { FEEDBACK, summariseFeedback } from "@/mock/engage-performance";
import { COMPANY_VALUES, KUDOS } from "@/mock/engage-recognition";
import { performanceFor } from "@/mock/people-extras";
import { mockAction, useApp } from "@/components/app-state";
import { Section } from "@/components/shell/page";
import { AI_TONE, AiBadge, AiExplainButton, AiSuggestionCard } from "@/components/ai/ai-ui";

/* ============================================================================
   AI "Talent snapshot" on /employees/[id].

   Strengths come from the feedback, recognition and review fixtures; the
   flight-risk band is the same ATTRITION_RISK row /ai/insights shows. It is a
   people-manager read-out, so it is shown only to HR, the owner, the direct
   manager and the head of the employee's line — and never to the employee
   looking at their own profile.
   ========================================================================== */

/** Who may see an employee's talent snapshot. */
export function canSeeTalentSnapshot(role: RoleId, viewerCode: string, emp: Employee) {
  if (viewerCode === emp.code) return false;
  if (role === "hr_admin" || role === "tenant_owner") return true;
  if (role === "manager") return emp.managerCode === viewerCode;
  if (role === "department_head") return descendantsOf(viewerCode).some((d) => d.code === emp.code);
  return false;
}

interface Strength {
  label: string;
  evidence: string;
  quote?: string;
}

function strengthsFor(emp: Employee): { strengths: Strength[]; develop: Strength[] } {
  const themes = summariseFeedback(FEEDBACK.filter((f) => f.toCode === emp.code));
  const strengths: Strength[] = themes
    .filter((t) => t.kind === "strength")
    .slice(0, 2)
    .map((t) => ({
      label: t.theme,
      evidence: `${t.evidence} feedback note${t.evidence === 1 ? "" : "s"} this cycle`,
      quote: t.quote,
    }));

  const kudos = KUDOS.filter((k) => k.status === "posted" && k.toCodes.includes(emp.code));
  if (kudos.length) {
    const top = kudos[0];
    const value = COMPANY_VALUES.find((v) => v.id === top.valueId)?.name ?? top.valueId;
    strengths.push({
      label: `Recognised for “${value}”`,
      evidence: `${kudos.length} kudos received · ${kudos.reduce((a, k) => a + k.points, 0)} points`,
      quote: top.message,
    });
  }

  const perf = performanceFor(emp.code);
  const last = perf?.cycles.at(-1);
  if (last && last.finalRating >= 3.8) {
    strengths.push({ label: last.band, evidence: `Final rating ${last.finalRating.toFixed(1)} in ${last.cycle}` });
  }
  if (perf && perf.goalCompletion >= 70) {
    strengths.push({ label: "Delivers on goals", evidence: `${Math.round(perf.goalCompletion)}% weighted goal completion this year` });
  }
  if (strengths.length < 2 && emp.skills.length) {
    strengths.push({ label: "Core skills on record", evidence: emp.skills.slice(0, 3).join(" · ") });
  }

  const develop: Strength[] = themes
    .filter((t) => t.kind === "development")
    .slice(0, 2)
    .map((t) => ({ label: t.theme, evidence: `${t.evidence} constructive note${t.evidence === 1 ? "" : "s"}`, quote: t.quote }));

  return { strengths: strengths.slice(0, 3), develop };
}

/** One retention action per risk driver — phrased as a suggestion, not a decision. */
function actionFor(d: RiskDriver, first: string): { title: string; body: string } {
  const l = d.label.toLowerCase();
  if (l.includes("increment") || l.includes("below grade"))
    return { title: "Propose an off-cycle compensation review", body: `${d.detail} Raise a benchmarking request with HR before the next cycle rather than waiting for April.` };
  if (l.includes("manager changed"))
    return { title: "Schedule a skip-level 1:1", body: `${first} has had two reporting-line changes. A skip-level conversation in the next two weeks helps re-anchor expectations.` };
  if (l.includes("mon/fri") || l.includes("overtime"))
    return { title: "Check workload in the next 1:1", body: `${d.detail} Ask about workload and flexibility before reading anything into it.` };
  if (l.includes("rating"))
    return { title: "Agree a development plan", body: `${d.detail} A written plan with two or three goals for the next half usually helps more than a rating discussion.` };
  if (l.includes("tenure"))
    return { title: "Discuss career path and internal moves", body: `${d.detail} Share open internal roles and a growth path for the next 12 months.` };
  if (l.includes("resignation"))
    return { title: "Plan knowledge transfer", body: `${first} is serving notice. Focus on handover and a good exit interview rather than retention.` };
  return { title: "Talk it through in the next 1:1", body: d.detail };
}

const BAND_TONE: Record<RiskBand, string> = {
  High: "border-destructive/30 bg-destructive-soft text-destructive-fg",
  Medium: "border-warning/30 bg-warning-soft text-warning-fg",
  Low: "border-success/30 bg-success-soft text-success-fg",
};

export function TalentSnapshotCard({ employee }: { employee: Employee }) {
  const { role, persona, can } = useApp();
  const [dismissed, setDismissed] = React.useState<string[]>([]);
  const [accepted, setAccepted] = React.useState<string[]>([]);

  const visible = can("ai.insights", "V") && canSeeTalentSnapshot(role, persona.employeeId, employee);
  const { strengths, develop } = React.useMemo(() => strengthsFor(employee), [employee]);
  if (!visible) return null;

  const risk = riskForCode(employee.code);
  const first = employee.name.split(" ")[0];
  const actions =
    risk && risk.band !== "Low"
      ? risk.drivers.map((d) => ({ id: d.label, ...actionFor(d, first) })).filter((a) => !dismissed.includes(a.id))
      : [];

  return (
    <Section
      title="Talent snapshot"
      description="Generated from feedback, recognition, reviews and the attrition model. Review before acting."
      actions={
        <span className="flex items-center gap-1.5">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <EyeOff className="size-3" aria-hidden /> Not visible to {first}
          </span>
          <AiBadge />
        </span>
      }
      className="border-violet-200 dark:border-violet-400/25"
    >
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-3">
          <div>
            <h3 className="text-xs font-semibold text-foreground">Strengths</h3>
            {strengths.length ? (
              <ul className="mt-1.5 flex flex-col gap-2">
                {strengths.map((s) => (
                  <li key={s.label} className={cn("rounded-md border px-2.5 py-2 text-xs", AI_TONE.soft)}>
                    <p className="font-medium text-foreground">{s.label}</p>
                    <p className="text-[11px] text-muted-foreground">{s.evidence}</p>
                    {s.quote && (
                      <p className="mt-1 flex gap-1 text-[11px] text-foreground/80">
                        <Quote className={cn("mt-px size-3 shrink-0", AI_TONE.icon)} aria-hidden />
                        <span className="line-clamp-2">{s.quote}</span>
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Not enough feedback or review history yet to summarise strengths.
              </p>
            )}
          </div>
          {develop.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-foreground">Development themes</h3>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {develop.map((d) => (
                  <li key={d.label} className="rounded-md border border-border bg-card px-2 py-1 text-[11px]">
                    <span className="font-medium text-foreground">{d.label}</span>
                    <span className="text-muted-foreground"> · {d.evidence}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-foreground">Flight risk</h3>
              {risk && (
                <AiExplainButton
                  title={`Why ${risk.band.toLowerCase()} risk?`}
                  summary={`Score ${risk.score} of 100 from the attrition model, refreshed weekly. Top drivers:`}
                  drivers={risk.drivers.map((d) => ({ label: d.label, detail: d.detail, weight: d.weight }))}
                  footnote="Explainable signal only — never used for automated decisions, and never shown to the employee."
                />
              )}
            </div>
            {risk ? (
              <>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={cn("rounded-md border px-2 py-0.5 text-xs font-semibold", BAND_TONE[risk.band])}>
                    {risk.band} risk
                  </span>
                  <span className="tnum text-xs text-muted-foreground">Score {risk.score}</span>
                  {risk.trend !== 0 && (
                    <span className="tnum flex items-center gap-0.5 text-[11px] text-muted-foreground">
                      {risk.trend > 0 ? <TrendingUp className="size-3" aria-hidden /> : <TrendingDown className="size-3" aria-hidden />}
                      {risk.trend > 0 ? "+" : ""}
                      {risk.trend} vs last month
                    </span>
                  )}
                </div>
                <ul className="mt-2 flex flex-col gap-1 text-[11px] text-muted-foreground">
                  {risk.drivers.length ? (
                    risk.drivers.map((d) => <li key={d.label}>• {d.label}</li>)
                  ) : (
                    <li>No material drivers in the last 12 months.</li>
                  )}
                </ul>
              </>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Not scored — the model covers active employees below the leadership level.
              </p>
            )}
          </div>

          {risk && risk.band !== "Low" && (
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold text-foreground">Suggested retention actions</h3>
              {actions.length === 0 && (
                <p className="text-[11px] text-muted-foreground">All suggestions dismissed.</p>
              )}
              {actions.map((a) =>
                accepted.includes(a.id) ? (
                  <p key={a.id} className="rounded-md border border-border px-2.5 py-1.5 text-[11px] text-success-fg" role="status">
                    Added to {first}&apos;s action plan: {a.title}
                  </p>
                ) : (
                  <AiSuggestionCard
                    key={a.id}
                    title={a.title}
                    body={a.body}
                    acceptLabel="Add to action plan"
                    onAccept={() => {
                      setAccepted((x) => [...x, a.id]);
                      mockAction(`Added to ${first}'s action plan`, {
                        description: a.title,
                        undo: () => setAccepted((x) => x.filter((v) => v !== a.id)),
                      });
                    }}
                    onDismiss={() => {
                      setDismissed((x) => [...x, a.id]);
                      mockAction("Suggestion dismissed", {
                        tone: "info",
                        description: "Feedback logged — it will not be suggested again for this driver.",
                        undo: () => setDismissed((x) => x.filter((v) => v !== a.id)),
                      });
                    }}
                  />
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}
