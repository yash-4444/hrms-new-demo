import { employeeByCode } from "./employees";
import { FORMER, SEPARATIONS, reasonLabel, type SeparationType } from "./lifecycle-exit";

/* ============================================================================
   Alumni and exit interviews. The three completed separations appear here
   with the same codes, dates and reasons; the rest are earlier leavers. Two
   alumni came back — their rows link to the current employee record.
   ========================================================================== */

export type RehireEligibility = "eligible" | "not_eligible";

export interface Alumnus {
  code: string;
  name: string;
  lastDesignation: string;
  departmentId: string;
  branchId: string;
  joiningDate: string;
  exitDate: string;
  type: SeparationType;
  reason: string;
  rehire: RehireEligibility;
  rehireNote: string;
  personalEmail: string;
  nowAt: string;
  /** Set when the alumnus rejoined — the current employee code. */
  boomerangCode: string | null;
}

const a = (
  code: string, name: string, lastDesignation: string, departmentId: string, branchId: string, joiningDate: string, exitDate: string,
  type: SeparationType, reason: string, rehire: RehireEligibility, rehireNote: string, nowAt: string, boomerangCode: string | null = null,
): Alumnus => ({
  code, name, lastDesignation, departmentId, branchId, joiningDate, exitDate, type, reason, rehire, rehireNote, nowAt, boomerangCode,
  personalEmail: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@gmail.com`,
});

const fromSeparations: Alumnus[] = FORMER.map((f) => {
  const s = SEPARATIONS.find((x) => x.code === f.code)!;
  const nowAt = { "STL-X0412": "Retired · advisory roles", "STL-X0418": "CRED", "STL-X0421": "Georgia Tech (MS CS)" }[f.code] ?? "—";
  return a(f.code, f.name, f.designation, f.departmentId, f.branchId, f.joiningDate, f.lwd, f.type, reasonLabel(s), "eligible", f.type === "retirement" ? "Eligible for consulting engagements" : "Regretted exit — fast-track if they return", nowAt);
});

const boomerang = (code: string, prevDesignation: string, joined: string, left: string, reason: string) => {
  const e = employeeByCode(code)!;
  return a(`${code}-P`, e.name, prevDesignation, e.departmentId, e.branchId, joined, left, "voluntary", reason, "eligible", `Rejoined ${e.joiningDate} as ${e.designation}`, "Stellar (rejoined)", code);
};

export const ALUMNI: Alumnus[] = [
  ...fromSeparations,
  a("STL-X0409", "Farhan Qureshi", "Account Executive", "SAL", "BLR", "2022-03-14", "2026-07-31", "voluntary", "Better opportunity", "eligible", "Met quota 5 of 6 quarters", "HubSpot"),
  a("STL-X0405", "Megha Rastogi", "Product Designer", "DES", "BLR", "2021-10-04", "2026-07-17", "voluntary", "Better opportunity", "eligible", "Strong portfolio; manager would rehire", "Razorpay"),
  a("STL-X0402", "Vivek Anand", "Senior CSM", "CSM", "PNQ", "2020-02-17", "2026-06-30", "voluntary", "Relocation", "eligible", "Moved to Hyderabad — remote roles only", "Freshworks"),
  a("STL-X0398", "Pallavi Joshi", "Senior Software Engineer", "ENG", "PNQ", "2019-11-11", "2026-06-12", "voluntary", "Better opportunity", "eligible", "Regretted — tech lead track if she returns", "Atlassian"),
  a("STL-X0395", "Rakesh Yadav", "IT Support Associate", "ITO", "BLR", "2023-01-09", "2026-05-29", "involuntary", "Misconduct", "not_eligible", "Terminated after a POSH inquiry — permanent no-rehire", "—"),
  a("STL-X0391", "Kriti Malhotra", "Marketing Manager", "MKT", "BLR", "2021-05-03", "2026-05-15", "voluntary", "Personal reasons", "eligible", "Career break; open to part-time", "Career break"),
  a("STL-X0387", "Joseph Mathew", "Software Engineer", "ENG", "BLR", "2022-08-01", "2026-04-30", "voluntary", "Better opportunity", "eligible", "Left during appraisal cycle; counter-offer declined", "Google"),
  a("STL-X0383", "Nisha Agarwal", "Finance Analyst", "FIN", "PNQ", "2023-04-17", "2026-04-10", "involuntary", "Performance", "not_eligible", "Exited after a PIP — eligible again after 24 months", "—"),
  a("STL-X0379", "Harsh Vardhan", "Senior Account Executive", "SAL", "PNQ", "2020-09-21", "2026-03-31", "voluntary", "Better opportunity", "eligible", "Top performer FY25", "Salesforce"),
  a("STL-X0371", "Tejas Kulkarni", "Customer Success Executive", "CSM", "PNQ", "2024-02-05", "2026-02-27", "involuntary", "Role redundancy", "eligible", "Role eliminated in the support restructure", "Zoho"),
  a("STL-X0366", "Ayesha Khan", "Engineering Manager", "ENG", "BLR", "2018-07-16", "2026-01-30", "voluntary", "Better opportunity", "eligible", "Skip-level would rehire into a different org", "Microsoft"),
  boomerang("STL-0156", "Product Manager", "2021-06-07", "2024-02-29", "Higher studies"),
  boomerang("STL-0317", "Site Reliability Engineer", "2020-01-13", "2023-11-30", "Better opportunity"),
];

/* ---------------------------------------------------------- exit interviews */

export const EXIT_QUESTIONS = [
  { key: "recommend", label: "Would you recommend Stellar as a place to work?" },
  { key: "manager", label: "How was your working relationship with your manager?" },
  { key: "growth", label: "Did you see a clear growth path here?" },
  { key: "pay", label: "Was your pay fair for your role and market?" },
] as const;
export type RatingKey = (typeof EXIT_QUESTIONS)[number]["key"];

export const THEMES = ["Career growth", "Manager relationship", "Compensation", "Work-life balance", "Relocation & personal", "Role clarity"] as const;
export type Theme = (typeof THEMES)[number];

export interface ExitInterview {
  id: string;
  code: string;
  name: string;
  designation: string;
  departmentId: string;
  exitDate: string;
  status: "scheduled" | "completed";
  scheduledOn: string;
  interviewer: string;
  primaryReason: string;
  ratings: Record<RatingKey, number> | null;
  keepUs: string;
  wouldReturn: "Yes" | "Maybe" | "No" | null;
  themes: Theme[];
}

type Done = [code: string, ratings: [number, number, number, number], keepUs: string, wouldReturn: "Yes" | "Maybe" | "No", themes: Theme[]];

const DONE: Done[] = [
  ["STL-X0418", [4, 4, 2, 3], "A visible path to tech lead. I asked twice in two years and the answer was always 'next cycle'.", "Maybe", ["Career growth"]],
  ["STL-X0421", [5, 5, 4, 4], "Nothing really — the MS was always the plan. Sponsorship or a sabbatical policy might have kept me.", "Yes", ["Career growth"]],
  ["STL-X0412", [5, 4, 3, 4], "Superannuation. A structured handover to a successor a year earlier would have helped the team.", "Yes", ["Role clarity"]],
  ["STL-X0409", [3, 3, 3, 2], "Commission accelerators above 100% — the plan capped out exactly when I was overperforming.", "Maybe", ["Compensation"]],
  ["STL-X0405", [4, 2, 2, 3], "Design reviews felt like approvals, not critique. I wanted a design lead who mentored.", "Maybe", ["Manager relationship", "Career growth"]],
  ["STL-X0402", [4, 4, 3, 3], "Remote-first for CS would have let me stay after the move to Hyderabad.", "Yes", ["Relocation & personal", "Work-life balance"]],
  ["STL-X0398", [4, 3, 2, 3], "Staff-engineer promotions need a written rubric. Mine stalled on 'not enough visibility'.", "Maybe", ["Career growth", "Role clarity"]],
  ["STL-X0391", [4, 4, 3, 3], "Part-time or a four-day week. Campaign crunches every quarter were not sustainable.", "Yes", ["Work-life balance"]],
  ["STL-X0387", [3, 3, 2, 2], "Pay correction at the appraisal, not a counter-offer after I resigned.", "No", ["Compensation", "Career growth"]],
  ["STL-X0379", [4, 2, 3, 3], "My regional head and I disagreed on territory carve-ups and nobody arbitrated.", "Maybe", ["Manager relationship"]],
  ["STL-X0371", [3, 3, 2, 3], "Earlier notice of the restructure and an internal move into onboarding.", "Maybe", ["Role clarity"]],
  ["STL-X0366", [3, 1, 3, 4], "A different reporting line. Skip-levels happened once a year — far too rare.", "No", ["Manager relationship", "Work-life balance"]],
  ["STL-X0383", [2, 3, 2, 3], "Clearer expectations in the first 90 days; the PIP goals were the first written goals I got.", "No", ["Role clarity", "Manager relationship"]],
];

const INTERVIEWERS = ["Pooja Agarwal", "Priya Menon"];

export const EXIT_INTERVIEWS: ExitInterview[] = [
  ...DONE.map(([code, r, keepUs, wouldReturn, themes], i): ExitInterview => {
    const al = ALUMNI.find((x) => x.code === code)!;
    return {
      id: `EXI-2026-${String(i + 1).padStart(3, "0")}`, code, name: al.name, designation: al.lastDesignation, departmentId: al.departmentId,
      exitDate: al.exitDate, status: "completed", scheduledOn: al.exitDate, interviewer: INTERVIEWERS[i % 2], primaryReason: al.reason,
      ratings: { recommend: r[0], manager: r[1], growth: r[2], pay: r[3] }, keepUs, wouldReturn, themes,
    };
  }),
  ...[
    ["SEP-2026-011", "2026-09-22"],
    ["SEP-2026-012", "2026-09-25"],
    ["SEP-2026-014", "2026-10-09"],
  ].map(([sepId, on], i): ExitInterview => {
    const s = SEPARATIONS.find((x) => x.id === sepId)!;
    return {
      id: `EXI-2026-${String(i + 21).padStart(3, "0")}`, code: s.code, name: s.name, designation: s.designation, departmentId: s.departmentId,
      exitDate: s.lwd, status: "scheduled", scheduledOn: on, interviewer: INTERVIEWERS[i % 2], primaryReason: reasonLabel(s),
      ratings: null, keepUs: "", wouldReturn: null, themes: [],
    };
  }),
];

/** Share of completed interviews mentioning each theme — what the AI summary cites. */
export const THEME_SHARE = (() => {
  const done = EXIT_INTERVIEWS.filter((x) => x.status === "completed");
  return THEMES.map((t) => {
    const hits = done.filter((x) => x.themes.includes(t));
    return { theme: t, count: hits.length, pct: Math.round((hits.length / done.length) * 100), quotes: hits.slice(0, 2).map((h) => h.keepUs) };
  }).sort((x, y) => y.count - x.count);
})();
