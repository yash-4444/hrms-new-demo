/* ============================================================================
   Hiring AI — deterministic, explainable signals for the recruiter screens.
   Everything is computed from the candidate, requisition, job posting and
   interview fixtures. These are aids for a human reviewer: nothing here ranks,
   shortlists or rejects anyone on its own.
   ========================================================================== */

import { mulberry32 } from "@/lib/utils";
import { TENANT, branchById, deptName, gradeById } from "@/mock/org";
import { employeeByCode } from "@/mock/employees";
import {
  jobByReq,
  requisitionByCode,
  type Candidate,
  type Interview,
} from "@/mock/hiring";

/** Skills the requisition calls for, per department. Mirrors the pools candidates are drawn from. */
const REQ_SKILL_POOL: Record<string, string[]> = {
  ENG: ["Go", "TypeScript", "PostgreSQL", "Kubernetes", "AWS", "Kafka", "React", "gRPC", "Terraform", "System Design"],
  PRD: ["Discovery", "Roadmapping", "SQL", "Statutory Compliance", "Pricing", "Stakeholder Management"],
  DES: ["Figma", "Design Systems", "Accessibility", "Prototyping", "User Research", "Interaction Design"],
  SAL: ["MEDDIC", "Enterprise Sales", "Salesforce", "Negotiation", "Forecasting", "Partner Channel"],
  MKT: ["Demand Gen", "HubSpot", "Attribution", "Lifecycle", "Paid Media", "Field Marketing"],
  CSM: ["Onboarding", "Renewals", "QBRs", "Escalation Management", "Adoption Analytics"],
  FIN: ["Ind AS", "GST", "TDS", "Reconciliations", "FP&A", "Statutory Audit"],
  ITO: ["Kubernetes", "Terraform", "AWS", "Incident Response", "Observability", "Linux"],
  HR: ["Talent Acquisition", "Sourcing", "HRIS", "Employer Branding"],
};

export const skillPoolFor = (departmentId: string) => REQ_SKILL_POOL[departmentId] ?? REQ_SKILL_POOL.ENG;

export interface ReqProfile {
  mustHave: string[];
  niceToHave: string[];
  minYears: number;
  maxYears: number;
  budgetMax: number;
  experienceLabel: string;
}

/** First sentence, keeping its full stop. */
const firstSentence = (t: string) => {
  const k = t.indexOf(". ");
  return k < 0 ? t : t.slice(0, k + 1);
};

const seedOf = (s: string) => Number(s.replace(/\D/g, "")) * 7907 + s.length;

/** What the requisition asks for — must-haves, nice-to-haves, experience band, budget. */
export function reqProfile(reqCode: string, departmentId: string): ReqProfile {
  const pool = skillPoolFor(departmentId);
  const rng = mulberry32(seedOf(reqCode));
  const shuffled = [...pool].map((s) => ({ s, k: rng() })).sort((a, b) => a.k - b.k).map((x) => x.s);
  const mustCount = pool.length <= 4 ? 2 : 4;
  const req = requisitionByCode(reqCode);
  const job = jobByReq(reqCode);
  const level = gradeById(req?.gradeId ?? "G3")?.level ?? 3;
  const m = job?.experience.match(/(\d+)\D+(\d+)/);
  const minYears = m ? Number(m[1]) : level + 2;
  const maxYears = m ? Number(m[2]) : level + 6;
  return {
    mustHave: shuffled.slice(0, mustCount),
    niceToHave: shuffled.slice(mustCount, mustCount + 2),
    minYears,
    maxYears,
    budgetMax: req?.budgetMaxCtc ?? 0,
    experienceLabel: `${minYears}–${maxYears} years`,
  };
}

export interface MatchDriver {
  label: string;
  detail: string;
  weight: number;
}

export interface CandidateMatch {
  score: number;
  band: "Strong" | "Good" | "Partial";
  profile: ReqProfile;
  matched: string[];
  missing: string[];
  bonus: string[];
  strengths: string[];
  gaps: string[];
  drivers: MatchDriver[];
}

/** Match score of a candidate to the requisition, 0–100, with the drivers behind it. */
export function matchCandidate(c: Candidate): CandidateMatch {
  const profile = reqProfile(c.reqCode, c.departmentId);
  const has = new Set(c.skills);
  const matched = profile.mustHave.filter((s) => has.has(s));
  const missing = profile.mustHave.filter((s) => !has.has(s));
  const bonus = profile.niceToHave.filter((s) => has.has(s));

  const skillPts = Math.round((matched.length / Math.max(1, profile.mustHave.length)) * 50);
  const bonusPts = bonus.length * 5;
  const y = c.experienceYears;
  const expPts =
    y >= profile.minYears && y <= profile.maxYears
      ? 20
      : y < profile.minYears
        ? Math.max(4, 20 - (profile.minYears - y) * 6)
        : 15;
  const over = profile.budgetMax ? (c.expectedCtc - profile.budgetMax) / profile.budgetMax : 0;
  const budgetPts = over <= 0 ? 15 : over <= 0.1 ? 8 : 2;
  const noticePts = c.noticePeriodDays <= 30 ? 5 : c.noticePeriodDays <= 60 ? 3 : 0;
  const score = Math.max(28, Math.min(97, 5 + skillPts + bonusPts + expPts + budgetPts + noticePts));
  const band: CandidateMatch["band"] = score >= 80 ? "Strong" : score >= 60 ? "Good" : "Partial";

  const strengths: string[] = [];
  const gaps: string[] = [];
  if (matched.length) strengths.push(`${matched.length} of ${profile.mustHave.length} must-have skills on the resume — ${matched.join(", ")}`);
  if (bonus.length) strengths.push(`Nice-to-have: ${bonus.join(", ")}`);
  if (expPts === 20) strengths.push(`${y} years of experience — inside the ${profile.experienceLabel} band`);
  else if (y > profile.maxYears) strengths.push(`${y} years of experience — above the ${profile.experienceLabel} band`);
  if (over <= 0 && profile.budgetMax) strengths.push("Expected CTC sits inside the requisition budget");
  if (c.noticePeriodDays <= 30) strengths.push(c.noticePeriodDays === 0 ? "Can join immediately" : `Short notice period — ${c.noticePeriodDays} days`);

  missing.forEach((s) => gaps.push(`No evidence of ${s} on the resume`));
  if (y < profile.minYears) gaps.push(`${y} years of experience — below the ${profile.minYears}-year minimum`);
  if (over > 0) gaps.push(`Expected CTC ${Math.round(over * 100)}% above the budget maximum`);
  if (c.noticePeriodDays > 60) gaps.push(`Notice period of ${c.noticePeriodDays} days — negotiate an early release`);

  const drivers: MatchDriver[] = [
    { label: "Must-have skills", detail: `${matched.length} of ${profile.mustHave.length} matched (${profile.mustHave.join(", ")})`, weight: skillPts },
    { label: "Experience fit", detail: `${y} years against ${profile.experienceLabel}`, weight: expPts },
    { label: "Budget fit", detail: profile.budgetMax ? `Expected ${Math.round(c.expectedCtc / 100000)}L vs budget max ${Math.round(profile.budgetMax / 100000)}L` : "No budget on the requisition", weight: budgetPts },
    { label: "Nice-to-have skills", detail: bonus.length ? bonus.join(", ") : "None of " + profile.niceToHave.join(", "), weight: bonusPts },
    { label: "Availability", detail: c.noticePeriodDays === 0 ? "Immediate joiner" : `${c.noticePeriodDays}-day notice`, weight: noticePts },
  ].sort((a, b) => b.weight - a.weight);

  return { score, band, profile, matched, missing, bonus, strengths, gaps, drivers };
}

const SKILL_QUESTIONS: Record<string, string> = {
  Kubernetes: "Walk me through how you would debug a pod stuck in CrashLoopBackOff in production.",
  Kafka: "How would you guarantee exactly-once processing for a payroll event stream on Kafka?",
  PostgreSQL: "A query on a 50-million-row table slowed from 40 ms to 4 s overnight. How do you investigate?",
  "System Design": "Design a service that computes monthly pay for 300,000 employees in under an hour.",
  Salesforce: "How do you keep opportunity stages in Salesforce honest enough to forecast from?",
  MEDDIC: "Take a deal you lost. Which MEDDIC element was weakest, and what would you do differently?",
  Figma: "How do you structure a Figma library so that engineers can trust it as the source of truth?",
  Accessibility: "How do you test a data-heavy table for keyboard and screen-reader users?",
  GST: "Explain how you would reconcile GSTR-2B with the purchase register at month end.",
  TDS: "Walk through the TDS computation for an employee who joins mid-year with prior-employer income.",
};

/** Five interview questions aimed at the gaps first, then the role. */
export function interviewQuestions(c: Candidate, m: CandidateMatch): { q: string; why: string }[] {
  const out: { q: string; why: string }[] = [];
  m.missing.forEach((s) =>
    out.push({ q: SKILL_QUESTIONS[s] ?? `Tell me about a time you used ${s}, or how you would ramp up on it in your first 60 days.`, why: `Gap — ${s} is a must-have not shown on the resume` }),
  );
  if (c.experienceYears < m.profile.minYears)
    out.push({ q: "Describe the largest piece of work you owned end to end — scope, decisions and the outcome.", why: "Gap — experience below the band; probe ownership" });
  if (m.gaps.some((g) => g.startsWith("Expected CTC")))
    out.push({ q: "What matters most to you in this move beyond compensation?", why: "Gap — expected CTC above budget" });
  m.matched.slice(0, 2).forEach((s) =>
    out.push({ q: SKILL_QUESTIONS[s] ?? `What is the hardest problem you solved with ${s}?`, why: `Depth check — ${s} claimed on the resume` }),
  );
  out.push({ q: `Why ${TENANT.name}, and why a ${c.role} role now?`, why: "Motivation and fit" });
  out.push({ q: "Tell me about a decision you disagreed with. How did you handle it?", why: "Collaboration and judgement" });
  out.push({ q: `What would you want to have shipped or changed in your first 90 days as ${c.role}?`, why: "Expectations and ramp-up" });
  return out.slice(0, 5);
}

export interface ScorecardSummary {
  rounds: number;
  cards: number;
  avg: number;
  recs: Record<string, number>;
  top: { competency: string; avg: number } | null;
  low: { competency: string; avg: number } | null;
  quotes: { by: string; round: string; text: string }[];
  text: string;
}

/** Aggregates submitted scorecards into a short neutral summary. Null when none exist. */
export function summariseScorecards(interviews: Interview[]): ScorecardSummary | null {
  const done = interviews.filter((i) => i.scorecards.length > 0);
  const cards = done.flatMap((i) => i.scorecards.map((s) => ({ s, round: i.round })));
  if (!cards.length) return null;
  const avg = cards.reduce((a, x) => a + x.s.overall, 0) / cards.length;
  const recs: Record<string, number> = {};
  cards.forEach(({ s }) => (recs[s.recommendation] = (recs[s.recommendation] ?? 0) + 1));
  const comp = new Map<string, number[]>();
  cards.forEach(({ s }) => s.competencies.forEach((c) => comp.set(c.competency, [...(comp.get(c.competency) ?? []), c.rating])));
  const avgs = [...comp.entries()].map(([competency, r]) => ({ competency, avg: r.reduce((a, b) => a + b, 0) / r.length })).sort((a, b) => b.avg - a.avg);
  const top = avgs[0] ?? null;
  const low = avgs.length > 1 ? avgs[avgs.length - 1] : null;
  const quotes = cards.slice(0, 2).map(({ s, round }) => ({
    by: employeeByCode(s.panelCode)?.name ?? s.panelCode,
    round,
    text: firstSentence(s.feedback),
  }));
  const recText = Object.entries(recs).map(([k, v]) => `${v} ${k}`).join(", ");
  const text = `Across ${done.length} round${done.length === 1 ? "" : "s"} and ${cards.length} scorecard${cards.length === 1 ? "" : "s"}, the panel averaged **${avg.toFixed(1)} / 5** (${recText}).${top ? ` Strongest signal: **${top.competency}** (${top.avg.toFixed(1)}).` : ""}${low && low.avg < (top?.avg ?? 5) ? ` Weakest: **${low.competency}** (${low.avg.toFixed(1)}) — worth probing in the next round.` : ""}`;
  return { rounds: done.length, cards: cards.length, avg, recs, top, low, quotes, text };
}

/* ------------------------------------------------------------- JD writer */

export interface JdInput {
  role: string;
  departmentId: string;
  branchId: string;
  gradeId?: string;
  experience?: string;
  workMode?: string;
  skills?: string[];
  justification?: string;
}

export interface JdDraft {
  summary: string;
  responsibilities: string[];
  requirements: string[];
  niceToHave: string[];
}

const DEPT_FOCUS: Record<string, string[]> = {
  ENG: ["Design, build and run services that are correct to the rupee and the minute", "Review code and raise the bar on testing, observability and on-call hygiene", "Break ambiguous product problems into small, shippable increments"],
  PRD: ["Own discovery with customers and turn it into a clear, sequenced roadmap", "Write crisp specs and make trade-offs explicit for engineering and design", "Track adoption after launch and close the loop with customers"],
  DES: ["Design end-to-end flows for HR, payroll and finance users", "Contribute to and govern the design system", "Run usability studies and turn findings into decisions"],
  SAL: ["Own a territory of mid-market and enterprise accounts end to end", "Build pipeline with marketing and partners and forecast it accurately", "Run disciplined deal cycles from discovery to signature"],
  MKT: ["Plan and run campaigns that create qualified pipeline", "Own attribution and report on what actually works", "Partner with sales on events, content and field programmes"],
  CSM: ["Own onboarding and adoption for a book of customers", "Run QBRs and grow renewals and expansion", "Be the customer's voice inside product and engineering"],
  FIN: ["Own month-end close, reconciliations and statutory filings", "Partner with payroll on accruals, TDS and audit readiness", "Build reporting that leadership can make decisions from"],
  ITO: ["Run the infrastructure and internal IT that every team depends on", "Automate provisioning, patching and access reviews", "Lead incident response and blameless post-mortems"],
  HR: ["Run full-cycle hiring with hiring managers", "Build sourcing pipelines and employer brand", "Keep the HRIS clean and the candidate experience excellent"],
};

/** Deterministic JD from the requisition's fields. Placeholders are marked [[like this]]. */
export function generateJd(i: JdInput): JdDraft {
  const city = branchById(i.branchId)?.city ?? i.branchId;
  const dept = deptName(i.departmentId);
  const grade = i.gradeId ? gradeById(i.gradeId) : undefined;
  const pool = skillPoolFor(i.departmentId);
  const skills = i.skills?.length ? i.skills : pool.slice(0, 4);
  const exp = i.experience ?? (grade ? `${grade.level + 2}–${grade.level + 6} years` : "[[Experience band]]");
  const role = i.role.trim() || "[[Role title]]";
  return {
    summary: `${TENANT.name} builds the HR and payroll platform that growing Indian companies run their people operations on. We are hiring a ${role} for our ${dept} team in ${city}${i.workMode ? ` (${i.workMode})` : ""}.${i.justification?.trim() ? ` ${firstSentence(i.justification.trim())}` : ""}`,
    responsibilities: [...(DEPT_FOCUS[i.departmentId] ?? DEPT_FOCUS.ENG), "Mentor colleagues and document decisions so the team scales with you"],
    requirements: [`${exp} of relevant experience`, `Hands-on with ${skills.join(", ")}`, "Clear written communication and good judgement under ambiguity"],
    niceToHave: [...pool.filter((s) => !skills.includes(s)).slice(0, 2).map((s) => `Exposure to ${s}`), "Experience in HR, payroll or another regulated domain"],
  };
}

export function jdToText(d: JdDraft): string {
  return [
    d.summary,
    "",
    "What you'll do",
    ...d.responsibilities.map((r) => `- ${r}`),
    "",
    "What you'll bring",
    ...d.requirements.map((r) => `- ${r}`),
    "",
    "Nice to have",
    ...d.niceToHave.map((r) => `- ${r}`),
    "",
    "We are an equal-opportunity employer and welcome applicants of every background.",
  ].join("\n");
}

/** Reads an edited JD back into posting fields. */
export function parseJd(text: string): Pick<JdDraft, "summary" | "responsibilities" | "requirements"> {
  const lines = text.split("\n").map((l) => l.trim());
  const summary = lines.find((l) => l && !l.startsWith("- ")) ?? "";
  const section = (head: RegExp) => {
    const start = lines.findIndex((l) => head.test(l));
    if (start < 0) return [];
    const out: string[] = [];
    for (let k = start + 1; k < lines.length && (lines[k].startsWith("- ") || !lines[k]); k++) if (lines[k]) out.push(lines[k].slice(2));
    return out;
  };
  return { summary, responsibilities: section(/^what you.ll do/i), requirements: section(/^what you.ll bring/i) };
}
