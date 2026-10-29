/* ==========================================================================
   Growth · continuous performance — feedback & 360, one-on-ones,
   improvement plans and succession. Built on the people in employees.ts and
   the active review cycle in growth.ts so every name and box reconciles.
   ========================================================================== */

import { EMPLOYEES, employeeByCode } from "./employees";
import { ACTIVE_CYCLE, CALIBRATION_CHIPS } from "./growth";
import { ATTRITION_RISK } from "./ai";

/* ------------------------------------------------------------- feedback */

export type FeedbackKind = "praise" | "constructive";
export type FeedbackTheme =
  | "Ownership"
  | "Code quality"
  | "Communication"
  | "Mentoring"
  | "Estimation"
  | "Customer focus"
  | "Documentation"
  | "Delegation";

export const STRENGTH_THEMES: FeedbackTheme[] = ["Ownership", "Code quality", "Mentoring", "Customer focus"];
export const DEVELOPMENT_THEMES: FeedbackTheme[] = ["Communication", "Estimation", "Documentation", "Delegation"];

export interface FeedbackItem {
  id: string;
  fromCode: string;
  toCode: string;
  anonymous: boolean;
  kind: FeedbackKind;
  themes: FeedbackTheme[];
  text: string;
  date: string;
  cycleId: string;
  /** Requested as part of a 360, or given unprompted. */
  source: "unprompted" | "360";
}

type Seed = [from: string, to: string, kind: FeedbackKind, themes: FeedbackTheme[], text: string, date: string, anon?: boolean, source?: "360"];

const SEEDS: Seed[] = [
  ["STL-0143", "STL-0142", "praise", ["Ownership"], "You picked up the payslip PDF regression on a Friday evening and had a fix with tests by Monday standup. Nobody asked you to.", "2026-09-14"],
  ["STL-0031", "STL-0142", "praise", ["Code quality", "Ownership"], "The retry wrapper you wrote for the bank-file upload is the cleanest code in that service. It has already saved two incidents.", "2026-09-10"],
  ["STL-0145", "STL-0142", "constructive", ["Estimation"], "Sprint 18 slipped because the migration estimate was half of what it took. Break unknowns into a spike next time.", "2026-09-08", false, "360"],
  ["STL-0146", "STL-0142", "praise", ["Mentoring"], "Nandini told me your pairing sessions are the reason she shipped her first feature in three weeks.", "2026-09-05", true, "360"],
  ["STL-0144", "STL-0142", "constructive", ["Communication"], "In design review you went quiet when you disagreed — then raised it in Slack afterwards. Say it in the room; you are usually right.", "2026-09-03", true, "360"],
  ["STL-0149", "STL-0142", "praise", ["Customer focus"], "The way you joined the Acme escalation call and explained the attendance sync delay in plain English calmed the customer down.", "2026-08-28"],
  ["STL-0147", "STL-0142", "constructive", ["Documentation"], "The new accrual job has no runbook. I lost an hour at 2 a.m. working out how to re-run it safely.", "2026-08-25", false, "360"],
  ["STL-0148", "STL-0142", "praise", ["Mentoring", "Code quality"], "Your PR comments teach rather than just block. I have started copying your review checklist.", "2026-08-21"],
  ["STL-0145", "STL-0142", "praise", ["Ownership"], "Took the on-call handover seriously — the incident notes were the best this quarter.", "2026-08-18"],
  ["STL-0031", "STL-0142", "constructive", ["Estimation", "Communication"], "Flag scope risk earlier. I heard about the holiday-calendar delay from the PM before I heard it from you.", "2026-08-12"],
  ["STL-0142", "STL-0148", "praise", ["Ownership"], "You owned the leave-balance bug end to end, including the customer note. That is senior behaviour.", "2026-09-11"],
  ["STL-0142", "STL-0143", "praise", ["Mentoring"], "Thanks for walking me through the Kafka consumer lag dashboards — saved me a day.", "2026-09-02"],
  ["STL-0142", "STL-0031", "constructive", ["Delegation"], "Could you let one of us run the sprint demo? It would help us practise talking to stakeholders.", "2026-08-30", true],
  ["STL-0031", "STL-0147", "constructive", ["Ownership", "Estimation"], "Three of the last four tickets rolled over. Let's agree smaller slices and a mid-sprint check.", "2026-09-09"],
  ["STL-0009", "STL-0031", "praise", ["Mentoring"], "Your team's 1:1 completion is 100% this quarter — the best in Engineering.", "2026-09-07"],
  ["STL-0004", "STL-0031", "constructive", ["Delegation"], "You are still the reviewer on 60% of PRs. Make Pranav a code owner for payroll-core.", "2026-08-26"],
  ["STL-0058", "STL-0009", "praise", ["Customer focus"], "The way you handled the Pune walk-in drive complaints turned two angry candidates into joiners.", "2026-09-12"],
  ["STL-0017", "STL-0009", "praise", ["Communication"], "Clear, early comms on the PF rate change. Payroll had zero tickets about it.", "2026-09-01"],
];

export const FEEDBACK: FeedbackItem[] = SEEDS.map(([fromCode, toCode, kind, themes, text, date, anon, source], i) => ({
  id: `FB-${String(i + 1).padStart(3, "0")}`,
  fromCode,
  toCode,
  anonymous: !!anon,
  kind,
  themes,
  text,
  date,
  cycleId: ACTIVE_CYCLE.id,
  source: source ?? "unprompted",
}));

export interface ThemeSummary {
  theme: FeedbackTheme;
  kind: "strength" | "development";
  evidence: number;
  quote: string;
}

/** Groups the feedback a person received this cycle into strength / development themes. */
export function summariseFeedback(items: FeedbackItem[]): ThemeSummary[] {
  const out: ThemeSummary[] = [];
  for (const theme of [...STRENGTH_THEMES, ...DEVELOPMENT_THEMES]) {
    const hits = items.filter((f) => f.themes.includes(theme));
    if (!hits.length) continue;
    const kind = STRENGTH_THEMES.includes(theme) ? "strength" : "development";
    const best = hits.find((h) => (kind === "strength" ? h.kind === "praise" : h.kind === "constructive")) ?? hits[0];
    out.push({ theme, kind, evidence: hits.length, quote: best.text });
  }
  return out.sort((a, b) => b.evidence - a.evidence);
}

/* --------------------------------------------------------- 360 requests */

export type RaterRelation = "Manager" | "Peer" | "Direct report" | "Cross-functional";
export type RaterStatus = "submitted" | "pending" | "declined";

export interface Rater {
  code: string;
  relation: RaterRelation;
  status: RaterStatus;
}

export interface Request360 {
  id: string;
  cycleId: string;
  subjectCode: string;
  raters: Rater[];
  requestedOn: string;
  dueOn: string;
}

export const REQUESTS_360: Request360[] = [
  {
    id: "R360-001",
    cycleId: ACTIVE_CYCLE.id,
    subjectCode: "STL-0142",
    requestedOn: "2026-09-01",
    dueOn: "2026-09-26",
    raters: [
      { code: "STL-0031", relation: "Manager", status: "submitted" },
      { code: "STL-0145", relation: "Peer", status: "submitted" },
      { code: "STL-0146", relation: "Peer", status: "submitted" },
      { code: "STL-0144", relation: "Peer", status: "submitted" },
      { code: "STL-0147", relation: "Peer", status: "submitted" },
      { code: "STL-0006", relation: "Cross-functional", status: "pending" },
    ],
  },
  {
    id: "R360-002",
    cycleId: ACTIVE_CYCLE.id,
    subjectCode: "STL-0031",
    requestedOn: "2026-09-02",
    dueOn: "2026-09-26",
    raters: [
      { code: "STL-0004", relation: "Manager", status: "submitted" },
      { code: "STL-0142", relation: "Direct report", status: "submitted" },
      { code: "STL-0145", relation: "Direct report", status: "pending" },
      { code: "STL-0149", relation: "Direct report", status: "declined" },
      { code: "STL-0009", relation: "Cross-functional", status: "submitted" },
    ],
  },
  {
    id: "R360-003",
    cycleId: ACTIVE_CYCLE.id,
    subjectCode: "STL-0145",
    requestedOn: "2026-09-04",
    dueOn: "2026-09-30",
    raters: [
      { code: "STL-0031", relation: "Manager", status: "pending" },
      { code: "STL-0142", relation: "Peer", status: "pending" },
      { code: "STL-0143", relation: "Peer", status: "submitted" },
    ],
  },
  {
    id: "R360-004",
    cycleId: ACTIVE_CYCLE.id,
    subjectCode: "STL-0058",
    requestedOn: "2026-09-03",
    dueOn: "2026-09-26",
    raters: [
      { code: "STL-0009", relation: "Manager", status: "submitted" },
      { code: "STL-0017", relation: "Cross-functional", status: "submitted" },
      { code: "STL-0031", relation: "Cross-functional", status: "pending" },
    ],
  },
];

/* --------------------------------------------------------- succession */

export type Readiness = "now" | "1-2" | "3+";
export const READINESS_LABEL: Record<Readiness, string> = {
  now: "Ready now",
  "1-2": "Ready in 1–2 yrs",
  "3+": "Ready in 3+ yrs",
};

export interface Successor {
  code: string;
  readiness: Readiness;
  /** Nine-box placement id from growth.ts NINE_BOXES. */
  boxId: string;
}

export interface CriticalRole {
  id: string;
  title: string;
  incumbentCode: string;
  departmentId: string;
  criticality: "Critical" | "High";
  successors: Successor[];
}

/** Senior-ish people in a department other than the incumbent — the natural bench. */
function bench(dept: string, exclude: string[], n: number) {
  return EMPLOYEES.filter(
    (e) => e.departmentId === dept && e.status !== "exited" && !exclude.includes(e.code) && ["G4", "G5"].includes(e.gradeId),
  ).slice(0, n);
}

const BOX_CYCLE = ["star", "high_performer", "growth", "core"];
const READY_CYCLE: Readiness[] = ["now", "1-2", "1-2", "3+"];

function role(id: string, title: string, incumbentCode: string, criticality: CriticalRole["criticality"], named: Successor[], extra = 0): CriticalRole {
  const inc = employeeByCode(incumbentCode);
  const dept = inc?.departmentId ?? "ENG";
  const more = bench(dept, [incumbentCode, ...named.map((s) => s.code)], extra).map((e, i) => ({
    code: e.code,
    readiness: READY_CYCLE[(i + named.length) % READY_CYCLE.length],
    boxId: BOX_CYCLE[(i + 1) % BOX_CYCLE.length],
  }));
  return { id, title, incumbentCode, departmentId: dept, criticality, successors: [...named, ...more] };
}

export const CRITICAL_ROLES: CriticalRole[] = [
  role("CR-01", "VP Engineering", "STL-0004", "Critical", [{ code: "STL-0031", readiness: "1-2", boxId: "high_performer" }], 2),
  role("CR-02", "Chief Revenue Officer", "STL-0005", "Critical", [{ code: "STL-0013", readiness: "1-2", boxId: "growth" }], 1),
  role("CR-03", "Chief Financial Officer", "STL-0008", "Critical", [{ code: "STL-0017", readiness: "3+", boxId: "core" }], 0),
  role("CR-04", "Head of People Operations", "STL-0009", "Critical", [{ code: "STL-0058", readiness: "1-2", boxId: "star" }], 0),
  role("CR-05", "Chief Product Officer", "STL-0006", "High", [{ code: "STL-0011", readiness: "now", boxId: "high_performer" }], 1),
  role("CR-06", "Director of IT", "STL-0010", "High", [], 2),
  role("CR-07", "Director of Customer Success", "STL-0007", "High", [], 0),
  role("CR-08", "Engineering Manager — Payroll Core", "STL-0031", "High", [
    { code: "STL-0145", readiness: "now", boxId: "star" },
    { code: "STL-0143", readiness: "1-2", boxId: "high_performer" },
    { code: "STL-0142", readiness: "3+", boxId: "growth" },
  ]),
  role("CR-09", "Payroll Manager", "STL-0017", "High", [], 1),
];

/** Bench strength: ready-now counts double, 3+ yrs counts half. */
export function benchStrength(r: CriticalRole): "Strong" | "Adequate" | "Weak" | "None" {
  const score = r.successors.reduce((a, s) => a + (s.readiness === "now" ? 2 : s.readiness === "1-2" ? 1 : 0.5), 0);
  if (score === 0) return "None";
  if (score >= 3) return "Strong";
  if (score >= 1.5) return "Adequate";
  return "Weak";
}

export const flightRiskFor = (code: string) => ATTRITION_RISK.find((r) => r.code === code);

/** Employees in the calibration "risk" box — the natural PIP candidates. */
export const RISK_BOX_CODES = CALIBRATION_CHIPS.filter((c) => c.boxId === "risk").map((c) => c.employeeCode);
