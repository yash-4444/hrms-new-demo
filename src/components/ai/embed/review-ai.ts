/* ============================================================================
   Review-cycle AI helpers — pure and deterministic. Summarises review forms
   into themes, drafts a manager comment from goals + ratings, and computes
   rating-bias signals for calibration. Nothing here writes a rating.
   ========================================================================== */

import { employeeByCode, employeeName } from "@/mock/employees";
import {
  CALIBRATION_CHIPS,
  COMPETENCIES,
  goalsFor,
  overallRating,
  ratingAnchor,
  type CompetencyReview,
  type ReviewForm,
} from "@/mock/growth";
import type { ExplainDriver } from "@/components/ai";

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const compName = (id: string) => COMPETENCIES.find((c) => c.id === id)?.name ?? id;

/* --------------------------------------------------- feedback summary */

/** Phrases the summariser counts across manager and peer comments. */
const THEMES: { label: string; tone: "strength" | "growth"; re: RegExp }[] = [
  { label: "Cross-team collaboration", tone: "strength", re: /cross-team|across teams|shared work|partner/i },
  { label: "Clear written communication", tone: "strength", re: /writer|design doc|written|write-ups/i },
  { label: "Reliable, predictable delivery", tone: "strength", re: /dependable|reliable|consistent|ahead of the plan|delivered/i },
  { label: "Generous with help and review", tone: "strength", re: /generous|patient|code review|blocked/i },
  { label: "Calm under changing priorities", tone: "strength", re: /calm|unflappable|re-planned|moves/i },
  { label: "Scope and next-level impact", tone: "growth", re: /scope|next step|step up/i },
  { label: "Follow-through on actions", tone: "growth", re: /follow-through|follow-ups|tickets age|incident action/i },
  { label: "Deliberate work on one gap", tone: "growth", re: /deliberate work|honest gap|coaching|idp/i },
];

export interface CycleSummary {
  forms: number;
  submitted: number;
  pendingSelf: number;
  pendingManager: number;
  avgManager: number;
  avgSelf: number;
  distribution: { rating: number; label: string; count: number }[];
  strengths: { name: string; avg: number }[];
  development: { name: string; avg: number }[];
  themes: { label: string; tone: "strength" | "growth"; mentions: number }[];
  divergentForms: number;
  drivers: ExplainDriver[];
}

export function summariseCycle(forms: ReviewForm[]): CycleSummary | null {
  if (!forms.length) return null;
  const managerDone = forms.filter((f) => f.status !== "self_pending" && f.status !== "manager_pending");
  const ratings = managerDone.map((f) => overallRating(f, "manager"));
  const selfs = forms.filter((f) => f.status !== "self_pending").map((f) => overallRating(f, "self"));
  const avg = (xs: number[]) => (xs.length ? round2(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

  const byComp = COMPETENCIES.map((c) => {
    const vals = managerDone.flatMap((f) => f.competencies.filter((x) => x.competencyId === c.id).map((x) => x.manager));
    return { name: c.name, avg: avg(vals) };
  }).sort((a, b) => b.avg - a.avg);

  const comments = managerDone.flatMap((f) => f.competencies.flatMap((c) => [c.managerComment, c.peerComment]));
  const themes = THEMES.map((t) => ({ label: t.label, tone: t.tone, mentions: comments.filter((c) => t.re.test(c)).length }))
    .filter((t) => t.mentions > 0)
    .sort((a, b) => b.mentions - a.mentions);

  const distribution = [1, 2, 3, 4, 5].map((r) => ({
    rating: r,
    label: ratingAnchor(r).short,
    count: ratings.filter((x) => Math.round(x) === r).length,
  }));
  const divergentForms = forms.filter((f) => f.competencies.some((c) => Math.abs(c.self - c.manager) >= 2)).length;
  const avgManager = avg(ratings);
  const avgSelf = avg(selfs);

  return {
    forms: forms.length,
    submitted: managerDone.length,
    pendingSelf: forms.filter((f) => f.status === "self_pending").length,
    pendingManager: forms.filter((f) => f.status === "manager_pending").length,
    avgManager,
    avgSelf,
    distribution,
    strengths: byComp.slice(0, 2),
    development: byComp.slice(-2).reverse(),
    themes: themes.slice(0, 5),
    divergentForms,
    drivers: [
      { label: `${managerDone.length} of ${forms.length} manager reviews read`, detail: "Forms still waiting on self or manager input are excluded from ratings and themes.", weight: managerDone.length },
      { label: `${comments.length} manager and peer comments scanned`, detail: "Themes are phrase matches across comments, counted once per comment.", weight: comments.length / 4 },
      { label: `Self ${avgSelf.toFixed(2)} vs manager ${avgManager.toFixed(2)}`, detail: "Weighted by competency weight, same as the form's overall.", weight: Math.abs(avgSelf - avgManager) * 10 + 1 },
    ],
  };
}

/* ------------------------------------------------- manager comment draft */

/** Drafts an editable manager summary from the live ratings and the reviewee's goals. */
export function draftManagerComment(form: ReviewForm, draft: CompetencyReview[]): string {
  const emp = employeeByCode(form.employeeCode);
  const first = emp?.firstName ?? employeeName(form.employeeCode).split(" ")[0];
  const live: ReviewForm = { ...form, competencies: draft };
  const overall = overallRating(live, "manager");
  const sorted = [...draft].sort((a, b) => b.manager - a.manager || b.peer - a.peer);
  const top = sorted.slice(0, 2).map((c) => compName(c.competencyId).toLowerCase());
  const low = sorted.at(-1)!;
  const goals = goalsFor(form.employeeCode);
  const achieved = goals.filter((g) => g.status === "achieved" || g.status === "on_track");
  const atRisk = goals.filter((g) => g.status === "at_risk" || g.status === "off_track");
  const lead = goals.slice().sort((a, b) => b.weightage - a.weightage)[0];
  const gap = draft.filter((c) => Math.abs(c.self - c.manager) >= 2).map((c) => compName(c.competencyId));

  const parts: string[] = [];
  parts.push(
    `${overall >= 3.75 ? "A strong half" : overall >= 2.75 ? "A solid half" : "A mixed half"} from ${first}. The clearest strengths are ${top.join(" and ")}, which peers echo in their feedback.`,
  );
  if (lead) {
    parts.push(
      `On goals, ${achieved.length} of ${goals.length} are on track or achieved; the largest, "${lead.title}", is at ${lead.progress}% progress.`,
    );
  }
  if (atRisk.length) parts.push(`${atRisk.length === 1 ? `"${atRisk[0].title}" is` : `${atRisk.length} goals are`} at risk and needs a recovery plan before the next check-in.`);
  parts.push(`The area to work on is ${compName(low.competencyId).toLowerCase()} (rated ${low.manager}); we will agree one concrete action for it.`);
  if (gap.length) parts.push(`Our ratings differ on ${gap.join(", ")} — worth discussing in the review meeting.`);
  parts.push(`Proposed rating: ${Math.round(overall)} (${ratingAnchor(overall).short}).`);
  return parts.join(" ");
}

/* --------------------------------------------------- calibration bias */

export interface BiasSignal {
  managerCode: string;
  manager: string;
  count: number;
  avg: number;
  delta: number;
  kind: "leniency" | "severity";
  drivers: ExplainDriver[];
}

const COHORT_AVG = round2(CALIBRATION_CHIPS.reduce((a, c) => a + c.managerRating, 0) / Math.max(1, CALIBRATION_CHIPS.length));

/** Company (cohort) average manager rating — the yardstick for bias. */
export const CALIBRATION_AVG = COHORT_AVG;

/** Teams of 2+ whose average proposal sits 0.4+ away from the cohort average. */
export function calibrationBias(minDelta = 0.4): BiasSignal[] {
  const by = new Map<string, number[]>();
  for (const c of CALIBRATION_CHIPS) {
    const m = employeeByCode(c.employeeCode)?.managerCode;
    if (!m) continue;
    by.set(m, [...(by.get(m) ?? []), c.managerRating]);
  }
  return [...by.entries()]
    .map(([managerCode, rs]) => {
      const avg = round2(rs.reduce((a, b) => a + b, 0) / rs.length);
      const delta = round1(avg - COHORT_AVG);
      return { managerCode, manager: employeeName(managerCode), count: rs.length, avg, delta, rs };
    })
    .filter((x) => x.count >= 2 && Math.abs(x.delta) >= minDelta)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .map(({ rs, ...x }) => ({
      ...x,
      kind: x.delta > 0 ? ("leniency" as const) : ("severity" as const),
      drivers: [
        { label: `Team average ${x.avg.toFixed(2)} vs cohort ${COHORT_AVG.toFixed(2)}`, detail: `${x.count} people in this calibration cohort report to ${x.manager}.`, weight: Math.abs(x.delta) * 10 },
        { label: `${rs.filter((r) => r >= 3.5).length} of ${rs.length} proposed at 'Exceeds' or above`, detail: "Rounded weighted manager rating carried in from the review form.", weight: rs.filter((r) => r >= 3.5).length + 1 },
        { label: "Small-team caveat", detail: x.count < 4 ? "Fewer than 4 people — a genuine strong or weak team can look like bias." : "Large enough that the gap is unlikely to be chance alone.", weight: x.count < 4 ? 1 : 3 },
      ],
    }));
}

/** Bias of one manager's own review forms (e.g. Vikram's team) against the cohort. */
export function teamBias(forms: ReviewForm[]) {
  const done = forms.filter((f) => f.status !== "self_pending" && f.status !== "manager_pending");
  if (done.length < 2) return null;
  const avg = round2(done.reduce((a, f) => a + overallRating(f, "manager"), 0) / done.length);
  return { count: done.length, avg, delta: round1(avg - COHORT_AVG) };
}
