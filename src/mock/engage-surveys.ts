/* ==========================================================================
   Engagement · surveys and pulse. The September engagement survey reconciles
   with ai.ts PULSE_TREND / PULSE_BY_DEPT / PULSE_THEMES.
   ========================================================================== */

import { DEPARTMENTS } from "./org";
import { PULSE_BY_DEPT, PULSE_THEMES, PULSE_TREND } from "./ai";

export type QuestionKind = "likert" | "enps" | "text";

export interface SurveyQuestion {
  id: string;
  kind: QuestionKind;
  text: string;
  /** Driver this question rolls up to on the heatmap. */
  driver?: string;
}

export type SurveyKind = "Engagement" | "eNPS pulse" | "Onboarding" | "Exit";
export type SurveyStatus = "active" | "closed" | "scheduled" | "draft";

export interface Survey {
  id: string;
  title: string;
  kind: SurveyKind;
  status: SurveyStatus;
  anonymous: boolean;
  opensOn: string;
  closesOn: string;
  audience: string;
  invited: number;
  responded: number;
  questions: SurveyQuestion[];
  /** Has the signed-in persona already responded? Seeded per survey. */
  respondedByMe: boolean;
}

const LIKERT = (id: string, text: string, driver: string): SurveyQuestion => ({ id, kind: "likert", text, driver });
const ENPS: SurveyQuestion = { id: "enps", kind: "enps", text: "How likely are you to recommend Stellar as a place to work to a friend? (0–10)" };

export const SURVEYS: Survey[] = [
  {
    id: "SRV-2026-09", title: "Engagement Survey — September 2026", kind: "Engagement", status: "active", anonymous: true,
    opensOn: "2026-09-08", closesOn: "2026-09-26", audience: "All employees", invited: 336, responded: 282, respondedByMe: false,
    questions: [
      LIKERT("q1", "I know what is expected of me at work.", "Clarity"),
      LIKERT("q2", "My manager gives me useful feedback at least monthly.", "Manager support"),
      LIKERT("q3", "I have the opportunity to learn and grow here.", "Growth"),
      LIKERT("q4", "My workload is sustainable over the long term.", "Workload"),
      LIKERT("q5", "I believe I am paid fairly for the work I do.", "Recognition & pay"),
      LIKERT("q6", "I feel safe raising concerns without fear of consequences.", "Belonging"),
      ENPS,
      { id: "t1", kind: "text", text: "What is one thing we should change in the next six months?" },
    ],
  },
  {
    id: "SRV-PULSE-Q3", title: "eNPS Pulse — Q3", kind: "eNPS pulse", status: "closed", anonymous: true,
    opensOn: "2026-07-01", closesOn: "2026-07-10", audience: "All employees", invited: 331, responded: 265, respondedByMe: true,
    questions: [ENPS, { id: "t1", kind: "text", text: "What is the main reason for your score?" }],
  },
  {
    id: "SRV-ONB-30", title: "Onboarding check-in — Day 30", kind: "Onboarding", status: "active", anonymous: false,
    opensOn: "2026-04-01", closesOn: "2027-03-31", audience: "Joiners at 30 days (rolling)", invited: 41, responded: 34, respondedByMe: false,
    questions: [
      LIKERT("q1", "My laptop and accounts were ready on day one.", "Readiness"),
      LIKERT("q2", "My buddy helped me find my feet.", "Belonging"),
      LIKERT("q3", "I understand how my work connects to the team's goals.", "Clarity"),
      { id: "t1", kind: "text", text: "What would have made your first month easier?" },
    ],
  },
  {
    id: "SRV-EXIT", title: "Exit survey", kind: "Exit", status: "active", anonymous: false,
    opensOn: "2026-04-01", closesOn: "2027-03-31", audience: "Employees serving notice (rolling)", invited: 19, responded: 15, respondedByMe: false,
    questions: [
      LIKERT("q1", "My role matched what was described when I joined.", "Clarity"),
      LIKERT("q2", "I had a clear path to grow here.", "Growth"),
      LIKERT("q3", "I would consider returning to Stellar.", "Belonging"),
      { id: "t1", kind: "text", text: "What is the main reason you are leaving?" },
    ],
  },
  {
    id: "SRV-PULSE-Q4", title: "eNPS Pulse — Q4", kind: "eNPS pulse", status: "scheduled", anonymous: true,
    opensOn: "2026-10-05", closesOn: "2026-10-14", audience: "All employees", invited: 0, responded: 0, respondedByMe: false,
    questions: [ENPS, { id: "t1", kind: "text", text: "What is the main reason for your score?" }],
  },
];

export const surveyById = (id: string) => SURVEYS.find((s) => s.id === id) ?? null;

/* ------------------------------------------------------------- results */

export interface EnpsSplit {
  promoters: number;
  passives: number;
  detractors: number;
}

/** Splits are hand-set so promoters + passives + detractors = responded. */
export const ENPS_SPLIT: Record<string, EnpsSplit> = {
  "SRV-2026-09": { promoters: 118, passives: 109, detractors: 55 },
  "SRV-PULSE-Q3": { promoters: 98, passives: 108, detractors: 59 },
  "SRV-ONB-30": { promoters: 19, passives: 11, detractors: 4 },
  "SRV-EXIT": { promoters: 3, passives: 5, detractors: 7 },
};

export const enpsScore = (s: EnpsSplit) => {
  const total = s.promoters + s.passives + s.detractors;
  return total ? Math.round(((s.promoters - s.detractors) / total) * 100) : 0;
};

export const ENPS_TREND = [
  { quarter: "Q4 FY25", enps: 14 },
  { quarter: "Q1 FY26", enps: 18 },
  { quarter: "Q2 FY26", enps: 11 },
  { quarter: "Q3 FY26", enps: 15 },
  { quarter: "Q4 FY26", enps: 22 },
];

export const SENTIMENT_TREND = PULSE_TREND;

/** Driver favourability (% agree) by department. Department means match PULSE_BY_DEPT. */
export function driverHeatmap(survey: Survey) {
  const drivers = [...new Set(survey.questions.filter((q) => q.driver).map((q) => q.driver!))];
  const offsets = [4, 2, -1, -9, -6, 3, 5, -3];
  const values = PULSE_BY_DEPT.map((d, di) =>
    drivers.map((_, qi) => Math.max(30, Math.min(95, d.score + offsets[(qi + di) % offsets.length]))),
  );
  return { rows: PULSE_BY_DEPT.map((d) => d.department), columns: drivers, values };
}

/** Participation by department — sums to the survey's responded count. */
export function participationByDept(survey: Survey) {
  const total = DEPARTMENTS.reduce((a, d) => a + d.headcount, 0);
  const last = DEPARTMENTS.length - 1;
  let invitedLeft = survey.invited;
  let left = survey.responded;
  return DEPARTMENTS.map((d, i) => {
    const invited = i === last ? invitedLeft : Math.round((d.headcount / total) * survey.invited);
    const responded = i === last ? left : Math.min(invited, Math.round((d.headcount / total) * survey.responded));
    invitedLeft -= invited;
    left -= responded;
    return { department: d.name, invited, responded, rate: invited ? Math.round((responded / invited) * 100) : 0 };
  });
}

export interface ThemeInsight {
  theme: string;
  mentions: number;
  sentiment: number;
  quote: string;
  comments: string[];
}

const EXTRA_COMMENTS: Record<string, string[]> = {
  "Manager support": ["Weekly 1:1s actually happen now.", "My manager defends our roadmap in leadership meetings."],
  "Learning & growth": ["I got approval for the dbt course within a day.", "Would love a clearer path to staff engineer."],
  Compensation: ["No one explained how the increment percentage was decided.", "Market correction for G2 engineers is overdue."],
  Workload: ["Release weeks mean 11-hour days for QA.", "Too many parallel projects in Customer Success."],
  "Hybrid / WFH": ["Keep the two WFH days, please.", "Anchor days help — Tuesday collaboration is great."],
  "Facilities & commute": ["Shuttle from Whitefield would help a lot.", "Pune office AC on weekends would be nice."],
};

export const SURVEY_THEMES: ThemeInsight[] = PULSE_THEMES.map((t) => ({
  theme: t.theme,
  mentions: t.mentions,
  sentiment: t.sentiment,
  quote: t.quote,
  comments: EXTRA_COMMENTS[t.theme] ?? [],
}));
