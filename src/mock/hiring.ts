import { addDays, differenceInDays, format, parseISO } from "date-fns";
import { mulberry32, pick, randInt, seededShuffle } from "@/lib/utils";
import { DEMO_TODAY, GRADES, branchById, deptById } from "./org";
import { EMPLOYEES, employeeByCode } from "./employees";

/* ============================================================================
   HIRING fixtures — 12 requisitions, 12 job postings, 60 candidates, a full
   interview schedule with scorecards, and the offers that came out of it.

   Everything is generated from fixed seeds off DEMO_TODAY, never from
   Date.now(), so the server render and the client hydration agree exactly.

   Numbers that must reconcile (a demo dies when a column does not add up):
     • 60 candidates, one per pipeline row, stage counts sum to 60
     • requisition.filled === candidates hired against that requisition
     • the funnel is derived from the candidates, never hand-typed
     • every offer CTC breakup sums to the offer CTC to the rupee
   ========================================================================== */

const TODAY = parseISO(DEMO_TODAY);
const iso = (d: Date) => format(d, "yyyy-MM-dd");
const daysAgo = (n: number) => iso(addDays(TODAY, -n));
const daysAhead = (n: number) => iso(addDays(TODAY, n));

/* --------------------------------------------------------------- pipeline */

export type PipelineStage =
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "hired"
  | "rejected";

export interface StageDef {
  id: PipelineStage;
  label: string;
  /** What a recruiter is actually waiting on in this column. */
  hint: string;
}

/** Board column order — Applied → Screening → Interview → Offer → Hired / Rejected. */
export const PIPELINE_STAGES: StageDef[] = [
  { id: "applied", label: "Applied", hint: "New applications awaiting a first read" },
  { id: "screening", label: "Screening", hint: "Recruiter screen and compensation alignment" },
  { id: "interview", label: "Interview", hint: "In the interview loop with the panel" },
  { id: "offer", label: "Offer", hint: "Offer drafted, approved or out with the candidate" },
  { id: "hired", label: "Hired", hint: "Offer accepted — onboarding handover done" },
  { id: "rejected", label: "Rejected", hint: "Closed out, with a reason on record" },
];

export const stageLabel = (s: PipelineStage) =>
  PIPELINE_STAGES.find((x) => x.id === s)?.label ?? s;

export const CANDIDATE_SOURCES = [
  "Referral",
  "LinkedIn",
  "Naukri",
  "Careers site",
  "Agency",
] as const;
export type CandidateSource = (typeof CANDIDATE_SOURCES)[number];

export const POSTING_CHANNELS = [
  "LinkedIn",
  "Naukri",
  "Referrals",
  "Careers site",
] as const;
export type PostingChannel = (typeof POSTING_CHANNELS)[number];

export const INTERVIEW_ROUNDS = [
  "Screening",
  "Technical 1",
  "Technical 2",
  "System Design",
  "Hiring Manager",
  "Culture",
] as const;
export type InterviewRound = (typeof INTERVIEW_ROUNDS)[number];

export const INTERVIEW_MODES = ["Video call", "In person", "Telephonic"] as const;
export type InterviewMode = (typeof INTERVIEW_MODES)[number];

/* ----------------------------------------------------------- requisitions */

/** Approval state of the requisition itself — a key from STATUS_MAP. */
export type ReqApproval = "approved" | "pending" | "rejected";
/** Lifecycle of the opening — a key from STATUS_MAP. */
export type ReqStatus = "open" | "on_hold" | "filled" | "closed";

export interface Requisition {
  id: string;
  code: string;
  role: string;
  departmentId: string;
  branchId: string;
  gradeId: string;
  headcount: number;
  /** Positions closed so far — always equals the hired candidates on this req. */
  filled: number;
  hiringManagerCode: string;
  recruiterCode: string;
  approvalStatus: ReqApproval;
  status: ReqStatus;
  raisedDate: string;
  targetCloseDate: string;
  budgetMinCtc: number;
  budgetMaxCtc: number;
  priority: "Critical" | "High" | "Normal";
  replacementFor: string | null;
  justification: string;
}

interface ReqSeed
  extends Omit<Requisition, "id" | "filled" | "recruiterCode" | "departmentId"> {
  departmentId: string;
  recruiterIdx: number;
}

const REQ_SEEDS: ReqSeed[] = [
  {
    code: "REQ-2026-001",
    role: "Senior Backend Engineer",
    departmentId: "ENG",
    branchId: "BLR",
    gradeId: "G3",
    headcount: 2,
    hiringManagerCode: "STL-0031",
    recruiterIdx: 0,
    approvalStatus: "approved",
    status: "open",
    raisedDate: daysAgo(90),
    targetCloseDate: daysAhead(14),
    budgetMinCtc: 1800000,
    budgetMaxCtc: 2400000,
    priority: "Critical",
    replacementFor: null,
    justification:
      "Payroll calculation service is carrying 14 open reliability actions with two engineers. Two senior backend hires unblock the statutory engine rewrite planned for Q3.",
  },
  {
    code: "REQ-2026-002",
    role: "Staff Engineer, Platform",
    departmentId: "ENG",
    branchId: "BLR",
    gradeId: "G4",
    headcount: 1,
    hiringManagerCode: "STL-0004",
    recruiterIdx: 0,
    approvalStatus: "approved",
    status: "open",
    raisedDate: daysAgo(117),
    targetCloseDate: daysAhead(9),
    budgetMinCtc: 2600000,
    budgetMaxCtc: 3000000,
    priority: "Critical",
    replacementFor: null,
    justification:
      "No single owner for the multi-tenant data isolation model. A staff hire takes the platform roadmap off the VP's desk and unblocks the US data-residency commitment.",
  },
  {
    code: "REQ-2026-003",
    role: "Software Engineer, Frontend",
    departmentId: "ENG",
    branchId: "PNQ",
    gradeId: "G2",
    headcount: 3,
    hiringManagerCode: "STL-0031",
    recruiterIdx: 1,
    approvalStatus: "approved",
    status: "open",
    raisedDate: daysAgo(72),
    targetCloseDate: daysAhead(29),
    budgetMinCtc: 1000000,
    budgetMaxCtc: 1400000,
    priority: "High",
    replacementFor: null,
    justification:
      "Pune delivery centre is scaling the self-service module. Three frontend engineers land the new attendance and leave experiences without pulling the Bengaluru team off payroll.",
  },
  {
    code: "REQ-2026-004",
    role: "Senior Software Engineer",
    departmentId: "ENG",
    branchId: "EWR",
    gradeId: "G3",
    headcount: 1,
    hiringManagerCode: "STL-0004",
    recruiterIdx: 2,
    approvalStatus: "approved",
    status: "open",
    raisedDate: daysAgo(50),
    targetCloseDate: daysAhead(50),
    budgetMinCtc: 1900000,
    budgetMaxCtc: 2300000,
    priority: "High",
    replacementFor: null,
    justification:
      "Eastern-timezone coverage for the US customer base. Today every production escalation after 19:00 IST waits until the next Bengaluru morning.",
  },
  {
    code: "REQ-2026-005",
    role: "Product Manager, Payroll",
    departmentId: "PRD",
    branchId: "BLR",
    gradeId: "G3",
    headcount: 1,
    hiringManagerCode: "STL-0006",
    recruiterIdx: 1,
    approvalStatus: "approved",
    status: "filled",
    raisedDate: daysAgo(106),
    targetCloseDate: daysAhead(4),
    budgetMinCtc: 1700000,
    budgetMaxCtc: 2200000,
    priority: "High",
    replacementFor: "STL-0071",
    justification:
      "Backfill for the payroll PM who exited in June. The statutory roadmap (PF, ESI, PT, TDS) has had no product owner for eleven weeks.",
  },
  {
    code: "REQ-2026-006",
    role: "Senior Product Designer",
    departmentId: "DES",
    branchId: "BLR",
    gradeId: "G3",
    headcount: 1,
    hiringManagerCode: "STL-0011",
    recruiterIdx: 3,
    approvalStatus: "pending",
    status: "open",
    raisedDate: daysAgo(23),
    targetCloseDate: daysAhead(65),
    budgetMinCtc: 1500000,
    budgetMaxCtc: 1900000,
    priority: "Normal",
    replacementFor: null,
    justification:
      "Design is at a 1:16 ratio against engineering. A senior designer takes ownership of the component library and the accessibility audit backlog.",
  },
  {
    code: "REQ-2026-007",
    role: "Enterprise Account Executive",
    departmentId: "SAL",
    branchId: "BLR",
    gradeId: "G3",
    headcount: 2,
    hiringManagerCode: "STL-0005",
    recruiterIdx: 2,
    approvalStatus: "approved",
    status: "open",
    raisedDate: daysAgo(128),
    targetCloseDate: daysAhead(2),
    budgetMinCtc: 1400000,
    budgetMaxCtc: 1800000,
    priority: "Critical",
    replacementFor: null,
    justification:
      "Enterprise pipeline above ₹1 Cr ACV is being worked by two AEs against a quota set for four. Coverage gap is the single largest risk to the H2 number.",
  },
  {
    code: "REQ-2026-008",
    role: "Account Executive, US East",
    departmentId: "SAL",
    branchId: "EWR",
    gradeId: "G3",
    headcount: 1,
    hiringManagerCode: "STL-0005",
    recruiterIdx: 2,
    approvalStatus: "approved",
    status: "open",
    raisedDate: daysAgo(64),
    targetCloseDate: daysAhead(44),
    budgetMinCtc: 1600000,
    budgetMaxCtc: 2000000,
    priority: "High",
    replacementFor: null,
    justification:
      "Newark has one AE covering the entire eastern seaboard. Inbound from the HR-tech partner network is going unworked for nine days on average.",
  },
  {
    code: "REQ-2026-009",
    role: "Demand Generation Manager",
    departmentId: "MKT",
    branchId: "BLR",
    gradeId: "G4",
    headcount: 1,
    hiringManagerCode: "STL-0013",
    recruiterIdx: 3,
    approvalStatus: "approved",
    status: "on_hold",
    raisedDate: daysAgo(149),
    targetCloseDate: daysAgo(1),
    budgetMinCtc: 1900000,
    budgetMaxCtc: 2500000,
    priority: "Normal",
    replacementFor: null,
    justification:
      "Paused at the September budget review pending the FY27 marketing plan. Two finalists are on hold and have been told the timeline honestly.",
  },
  {
    code: "REQ-2026-010",
    role: "Customer Success Manager",
    departmentId: "CSM",
    branchId: "PNQ",
    gradeId: "G3",
    headcount: 2,
    hiringManagerCode: "STL-0007",
    recruiterIdx: 1,
    approvalStatus: "approved",
    status: "open",
    raisedDate: daysAgo(79),
    targetCloseDate: daysAhead(19),
    budgetMinCtc: 1300000,
    budgetMaxCtc: 1700000,
    priority: "High",
    replacementFor: null,
    justification:
      "Book of business per CSM has crossed 38 accounts against a target of 25. Renewal risk is concentrated in the mid-market segment.",
  },
  {
    code: "REQ-2026-011",
    role: "Senior Finance Analyst",
    departmentId: "FIN",
    branchId: "PNQ",
    gradeId: "G3",
    headcount: 1,
    hiringManagerCode: "STL-0017",
    recruiterIdx: 3,
    approvalStatus: "pending",
    status: "open",
    raisedDate: daysAgo(15),
    targetCloseDate: daysAhead(76),
    budgetMinCtc: 1400000,
    budgetMaxCtc: 1800000,
    priority: "Normal",
    replacementFor: null,
    justification:
      "Month-end close is running to day 9 against a day-5 commitment. An analyst owning reconciliations and the PF/ESI filings pulls it back.",
  },
  {
    code: "REQ-2026-012",
    role: "Site Reliability Engineer",
    departmentId: "ITO",
    branchId: "BLR",
    gradeId: "G3",
    headcount: 1,
    hiringManagerCode: "STL-0010",
    recruiterIdx: 0,
    approvalStatus: "approved",
    status: "open",
    raisedDate: daysAgo(42),
    targetCloseDate: daysAhead(55),
    budgetMinCtc: 1600000,
    budgetMaxCtc: 2100000,
    priority: "High",
    replacementFor: null,
    justification:
      "On-call is carried by three engineers with no formal rotation. An SRE owns the paging policy, the error budget and the quarterly DR drill.",
  },
];

/* ------------------------------------------------- recruiter & panel pools */

/** Real HR employees, so every recruiter on screen resolves in the directory. */
const RECRUITER_CODES: string[] = (() => {
  const hr = EMPLOYEES.filter((e) => e.departmentId === "HR" && e.status !== "exited").map(
    (e) => e.code,
  );
  const preferred = ["STL-0058", "STL-0009"].filter((c) => hr.includes(c));
  const rest = hr.filter((c) => !preferred.includes(c));
  return [...preferred, ...rest].slice(0, 4);
})();

export const RECRUITERS = RECRUITER_CODES.map((code) => ({
  code,
  name: employeeByCode(code)?.name ?? code,
}));

/** Senior-most people in a department — the natural interview panel. */
const panelPool = (() => {
  const byDept = new Map<string, string[]>();
  for (const e of EMPLOYEES) {
    if (e.status === "exited") continue;
    const list = byDept.get(e.departmentId) ?? [];
    list.push(e.code);
    byDept.set(e.departmentId, list);
  }
  for (const [dept, codes] of byDept) {
    codes.sort((a, b) => {
      const ea = employeeByCode(a)!;
      const eb = employeeByCode(b)!;
      return ea.level - eb.level || a.localeCompare(b);
    });
    byDept.set(dept, codes.slice(0, 8));
  }
  return byDept;
})();

export const REQUISITIONS: Requisition[] = REQ_SEEDS.map((s) => ({
  id: s.code,
  code: s.code,
  role: s.role,
  departmentId: s.departmentId,
  branchId: s.branchId,
  gradeId: s.gradeId,
  headcount: s.headcount,
  filled: 0, // reconciled against hired candidates below
  hiringManagerCode: s.hiringManagerCode,
  recruiterCode: RECRUITER_CODES[s.recruiterIdx % RECRUITER_CODES.length],
  approvalStatus: s.approvalStatus,
  status: s.status,
  raisedDate: s.raisedDate,
  targetCloseDate: s.targetCloseDate,
  budgetMinCtc: s.budgetMinCtc,
  budgetMaxCtc: s.budgetMaxCtc,
  priority: s.priority,
  replacementFor: s.replacementFor,
  justification: s.justification,
}));

export const requisitionByCode = (code: string) =>
  REQUISITIONS.find((r) => r.code === code);

/** Days the requisition has been open — the ageing column. */
export const reqAgeingDays = (r: Requisition) =>
  differenceInDays(TODAY, parseISO(r.raisedDate));

/* ------------------------------------------------------------ job postings */

export interface JobPosting {
  id: string;
  reqCode: string;
  title: string;
  departmentId: string;
  branchId: string;
  location: string;
  employmentType: "Full-time" | "Contract";
  workMode: "On-site" | "Hybrid" | "Remote";
  experience: string;
  published: boolean;
  postedDate: string;
  channels: PostingChannel[];
  summary: string;
  responsibilities: string[];
  requirements: string[];
  views: number;
}

interface JobCopy {
  reqCode: string;
  workMode: JobPosting["workMode"];
  experience: string;
  channels: PostingChannel[];
  summary: string;
  responsibilities: string[];
  requirements: string[];
  views: number;
}

const JOB_COPY: JobCopy[] = [
  {
    reqCode: "REQ-2026-001",
    workMode: "Hybrid",
    experience: "5–8 years",
    channels: ["LinkedIn", "Naukri", "Referrals", "Careers site"],
    summary:
      "Own the services that calculate what 340,000 people across our customers get paid. You will work on the payroll calculation engine — the part of Stellar where a rounding error is a support ticket and a compliance event.",
    responsibilities: [
      "Design and ship services in Go and TypeScript that compute gross, deductions and net pay against Indian statutory rules (PF, ESI, PT, TDS).",
      "Take the statutory engine rewrite from design document to production behind a component-level feature flag.",
      "Build the calculation trace that lets a payroll admin see the formula, the resolved inputs and the output for every component.",
      "Carry the pager for the services you own, and write the runbook before the first incident, not after it.",
      "Review design documents from the wider platform group and mentor two engineers through their first on-call rotation.",
    ],
    requirements: [
      "5+ years building backend services in a typed language — Go, Java, Kotlin or TypeScript on Node.",
      "Real experience with PostgreSQL beyond CRUD: query plans, partitioning and migrations on live tables.",
      "You have owned a system where correctness mattered more than throughput — payments, ledger, billing or payroll.",
      "Comfortable writing the test that proves the money is right, and arguing for the one that is missing.",
      "Nice to have: exposure to Indian payroll statutes, or to multi-tenant data isolation.",
    ],
    views: 1284,
  },
  {
    reqCode: "REQ-2026-002",
    workMode: "Hybrid",
    experience: "9–13 years",
    channels: ["LinkedIn", "Referrals", "Careers site"],
    summary:
      "A staff-level role with a specific mandate: own the multi-tenant data isolation model end to end, and get us to a credible US data-residency commitment within two quarters.",
    responsibilities: [
      "Own the tenancy model — schema strategy, key management, and the migration path from the shared schema we have today.",
      "Write the architecture decision records the rest of engineering will build against for the next three years.",
      "Partner with the Newark team on data residency, and with Finance on the cost model that comes with it.",
      "Set the technical bar in design review without becoming the bottleneck in it.",
    ],
    requirements: [
      "9+ years in backend or platform engineering, including time at genuine multi-tenant scale.",
      "You have led a migration that could not take downtime, and can describe what went wrong during it.",
      "Fluent in one of Go, Java or Rust, and unbothered about which one the team picks.",
      "Track record of writing documents that changed what other teams did.",
    ],
    views: 862,
  },
  {
    reqCode: "REQ-2026-003",
    workMode: "Hybrid",
    experience: "2–4 years",
    channels: ["LinkedIn", "Naukri", "Careers site"],
    summary:
      "Build the screens 340 employees open every morning. The Pune team owns self-service — attendance, leave, payslips — where a confusing interaction becomes an HR ticket within the hour.",
    responsibilities: [
      "Ship features in React and TypeScript against a design system you will help extend.",
      "Own the punch-in experience: it must work on a four-year-old Android phone on a weak connection.",
      "Write component tests that survive a refactor, and Playwright flows for the three journeys we cannot break.",
      "Work directly with Design on accessibility — keyboard parity and screen-reader labels are acceptance criteria here, not follow-ups.",
    ],
    requirements: [
      "2+ years writing production React with TypeScript.",
      "You understand the browser: layout, reflow, bundle size and what actually makes a page feel fast.",
      "Some exposure to WCAG 2.2 AA, or a strong willingness to learn it properly.",
      "Nice to have: experience with TanStack Table, Recharts or a comparable data-heavy UI stack.",
    ],
    views: 2041,
  },
  {
    reqCode: "REQ-2026-004",
    workMode: "Hybrid",
    experience: "5–9 years",
    channels: ["LinkedIn", "Referrals", "Careers site"],
    summary:
      "Our first senior engineering hire in Newark. You will give the US customer base an engineer in their own timezone, and help the Bengaluru team hand over cleanly at the end of their day.",
    responsibilities: [
      "Own production escalations for US customers during Eastern hours and close the handover loop with Bengaluru.",
      "Build the US payroll integration surface — ADP and Gusto connectors are first on the list.",
      "Represent the customer's timezone in design review, where it is otherwise easy to forget.",
      "Set up the on-call rotation for the US pod as it grows past you.",
    ],
    requirements: [
      "5+ years of backend or full-stack engineering in a SaaS product company.",
      "Authorised to work in the United States; based in or willing to relocate to the Newark / NYC metro.",
      "Comfortable being the only engineer online for several hours a day — and disciplined about writing things down.",
      "Nice to have: familiarity with US payroll, benefits or HRIS integrations.",
    ],
    views: 517,
  },
  {
    reqCode: "REQ-2026-005",
    workMode: "Hybrid",
    experience: "5–8 years",
    channels: ["LinkedIn", "Naukri", "Referrals", "Careers site"],
    summary:
      "Own the payroll product: the statutory roadmap, the pay-run experience, and the part of Stellar customers trust with their most sensitive numbers.",
    responsibilities: [
      "Own the payroll roadmap from discovery through launch, including the PF, ESI, PT and TDS compliance backlog.",
      "Sit with payroll administrators during a live run — the roadmap comes out of that, not out of a spreadsheet.",
      "Write specifications precise enough that a statutory rule change is a config change, not a release.",
      "Partner with Finance and Legal on every filing deadline we commit a customer to.",
    ],
    requirements: [
      "5+ years in product management, at least two of them on a compliance-heavy or fintech product.",
      "You can read an Act, a circular and a customer complaint and turn all three into one requirement.",
      "Comfortable with SQL and with pulling your own numbers.",
      "Nice to have: prior work on Indian payroll, HRIS or accounting software.",
    ],
    views: 1136,
  },
  {
    reqCode: "REQ-2026-006",
    workMode: "Hybrid",
    experience: "5–8 years",
    channels: ["LinkedIn", "Referrals", "Careers site"],
    summary:
      "Design for density. Stellar is used by HR administrators for six hours a day — this is not a marketing site, and the craft is in the table, the form and the empty state.",
    responsibilities: [
      "Own the component library alongside engineering, including the dark theme and the accessibility audit backlog.",
      "Design the data-dense surfaces — pay-run tables, the RBAC matrix, the calibration grid — where information density is the feature.",
      "Run usability sessions with real HR administrators, and bring back what they actually did, not what they said.",
      "Hold the line on one visual language across forty screens and nine modules.",
    ],
    requirements: [
      "5+ years designing complex B2B or enterprise software, with a portfolio that shows tables and forms, not just landing pages.",
      "Fluent in Figma, including variables, auto-layout and a component library other people have to use.",
      "You can argue about contrast ratios with evidence.",
      "Nice to have: you have shipped a design system that survived its second year.",
    ],
    views: 1604,
  },
  {
    reqCode: "REQ-2026-007",
    workMode: "Hybrid",
    experience: "6–10 years",
    channels: ["LinkedIn", "Naukri", "Referrals", "Careers site"],
    summary:
      "Carry an enterprise quota against HR leaders at companies of 1,000 to 10,000 employees. Long cycles, real evaluations, and a product that survives a technical bake-off.",
    responsibilities: [
      "Own a named enterprise territory from first meeting through security review to signature.",
      "Run a MEDDIC-qualified pipeline and keep the forecast honest, including the deals that are slipping.",
      "Bring Product into the room when the answer is a roadmap conversation, not a discount.",
      "Partner with Customer Success on the first ninety days, because the renewal starts at handover.",
    ],
    requirements: [
      "6+ years of B2B SaaS sales, at least three carrying an enterprise quota above ₹3 Cr.",
      "You have closed deals that needed a procurement and an infosec review, and you know how long those take.",
      "Credible with a CHRO and with a CIO in the same meeting.",
      "Nice to have: HR tech, payroll or fintech domain experience.",
    ],
    views: 933,
  },
  {
    reqCode: "REQ-2026-008",
    workMode: "Remote",
    experience: "5–9 years",
    channels: ["LinkedIn", "Referrals", "Careers site"],
    summary:
      "Take the eastern seaboard. You will be our second seller in the US, working inbound from the HR-tech partner network plus a named-account list you help build.",
    responsibilities: [
      "Own new business across the US East territory, from qualification to close.",
      "Work the partner-sourced pipeline that is currently going unattended for over a week at a time.",
      "Feed US-specific product gaps back to the Bengaluru product team with evidence attached.",
      "Represent Stellar at two HR-tech conferences a year.",
    ],
    requirements: [
      "5+ years of SaaS new-business sales in the US market.",
      "Authorised to work in the United States; East Coast based.",
      "Comfortable selling a product whose engineering team is ten and a half hours ahead of you.",
      "Nice to have: HCM, payroll or PEO experience.",
    ],
    views: 488,
  },
  {
    reqCode: "REQ-2026-009",
    workMode: "Hybrid",
    experience: "7–10 years",
    channels: ["LinkedIn", "Naukri", "Careers site"],
    summary:
      "Own pipeline generation as a number, not an activity. This role reports to the Director of Marketing and is accountable for sourced pipeline against the enterprise quota.",
    responsibilities: [
      "Own the demand plan across paid, lifecycle, events and the partner channel.",
      "Build the attribution model that Sales and Finance both agree to use.",
      "Run the experiment backlog with a stated hypothesis and a stop rule for each test.",
      "Manage two marketing executives and the agency relationship.",
    ],
    requirements: [
      "7+ years in B2B demand generation, including ownership of a pipeline number.",
      "Hands-on with HubSpot or Marketo, and with the reporting layer on top of it.",
      "You can tell the difference between a channel that works and a channel that is last-click flattering.",
      "Nice to have: experience marketing to HR and Finance buyers in India.",
    ],
    views: 741,
  },
  {
    reqCode: "REQ-2026-010",
    workMode: "Hybrid",
    experience: "4–7 years",
    channels: ["LinkedIn", "Naukri", "Referrals", "Careers site"],
    summary:
      "Own a book of mid-market accounts through onboarding, adoption and renewal. Our CSMs are expected to know the customer's payroll calendar as well as the customer does.",
    responsibilities: [
      "Own retention and expansion for roughly 25 accounts in the Pune-managed book.",
      "Run onboarding for new customers through their first two pay runs — the period that decides the renewal.",
      "Hold quarterly business reviews with usage data, not with a template.",
      "Escalate product gaps with a business case, and follow them through to the roadmap.",
    ],
    requirements: [
      "4+ years in customer success or account management at a B2B SaaS company.",
      "Comfortable with a spreadsheet and a QBR deck in the same afternoon.",
      "You have saved a renewal that looked lost, and can explain exactly how.",
      "Nice to have: HRIS, payroll or finance software experience.",
    ],
    views: 1372,
  },
  {
    reqCode: "REQ-2026-011",
    workMode: "On-site",
    experience: "4–7 years",
    channels: ["Naukri", "LinkedIn", "Careers site"],
    summary:
      "Bring month-end close back to day five. You will own reconciliations, statutory filings and the management reporting pack for a 340-person company across three countries.",
    responsibilities: [
      "Own the monthly close calendar, reconciliations and the variance commentary that goes to the CFO.",
      "Prepare and file PF, ESI, PT and TDS returns on time, every month, with the working papers attached.",
      "Support the statutory audit and the quarterly board pack.",
      "Partner with Payroll on the cost-centre allocation model.",
    ],
    requirements: [
      "CA, CMA or an MBA in Finance with 4+ years of relevant experience.",
      "Strong Ind AS fundamentals and hands-on GST and TDS compliance experience.",
      "Advanced Excel; exposure to Tally and to a modern ERP.",
      "Nice to have: experience in a multi-country entity structure.",
    ],
    views: 968,
  },
  {
    reqCode: "REQ-2026-012",
    workMode: "Hybrid",
    experience: "4–8 years",
    channels: ["LinkedIn", "Naukri", "Referrals", "Careers site"],
    summary:
      "Our first dedicated SRE. Today on-call is three engineers and goodwill. You will replace that with a rotation, an error budget and a DR drill that actually runs.",
    responsibilities: [
      "Own the paging policy, the escalation matrix and the postmortem process — blameless, written and followed up.",
      "Define SLOs with the service teams and hold the error budget conversation when one is spent.",
      "Own the Terraform estate across AWS, and the quarterly disaster-recovery exercise.",
      "Reduce alert noise: the first target is halving pages that need no action.",
    ],
    requirements: [
      "4+ years in SRE, infrastructure or platform operations.",
      "Deep with Kubernetes, Terraform and one major cloud — AWS preferred.",
      "You have written a postmortem that changed how a team worked.",
      "Nice to have: experience running compliance-relevant workloads (SOC 2, ISO 27001).",
    ],
    views: 1105,
  },
];

export const JOBS: JobPosting[] = JOB_COPY.map((copy, i) => {
  const req = REQUISITIONS.find((r) => r.code === copy.reqCode)!;
  const branch = branchById(req.branchId);
  const published = req.approvalStatus === "approved" && req.status !== "filled";
  return {
    id: `JOB-2026-${String(i + 1).padStart(3, "0")}`,
    reqCode: req.code,
    title: req.role,
    departmentId: req.departmentId,
    branchId: req.branchId,
    location: branch ? `${branch.city}, ${branch.countryName}` : req.branchId,
    employmentType: "Full-time",
    workMode: copy.workMode,
    experience: copy.experience,
    published,
    postedDate: iso(addDays(parseISO(req.raisedDate), 3)),
    channels: copy.channels,
    summary: copy.summary,
    responsibilities: copy.responsibilities,
    requirements: copy.requirements,
    views: copy.views,
  };
});

export const jobByReq = (reqCode: string) => JOBS.find((j) => j.reqCode === reqCode);
export const jobById = (id: string) => JOBS.find((j) => j.id === id);

/* -------------------------------------------------------------- candidates */

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  reqCode: string;
  role: string;
  departmentId: string;
  branchId: string;
  location: string;
  stage: PipelineStage;
  /** For rejected rows — the stage the candidate was rejected out of. */
  rejectedAtStage: PipelineStage | null;
  rejectionReason: string | null;
  currentCompany: string;
  currentTitle: string;
  experienceYears: number;
  currentCtc: number;
  expectedCtc: number;
  noticePeriodDays: number;
  source: CandidateSource;
  referredBy: string | null;
  appliedDate: string;
  /** Date the candidate entered the current stage. */
  stageSince: string;
  stageAgeDays: number;
  rating: number;
  resumeFile: string;
  skills: string[];
  summary: string;
  ownerCode: string;
}

interface CandSeed {
  name: string;
  reqCode: string;
  stage: PipelineStage;
  source: CandidateSource;
  company: string;
  rejectedAtStage?: PipelineStage;
}

const CAND_SEEDS: CandSeed[] = [
  /* REQ-2026-001 · Senior Backend Engineer · Bengaluru */
  { name: "Nikhil Bansal", reqCode: "REQ-2026-001", stage: "hired", source: "Referral", company: "Razorpay" },
  { name: "Aditya Kulkarni", reqCode: "REQ-2026-001", stage: "offer", source: "LinkedIn", company: "Zeta" },
  { name: "Sneha Deshpande", reqCode: "REQ-2026-001", stage: "interview", source: "Naukri", company: "Chargebee" },
  { name: "Rohit Malhotra", reqCode: "REQ-2026-001", stage: "interview", source: "Referral", company: "PhonePe" },
  { name: "Harini Subramanian", reqCode: "REQ-2026-001", stage: "screening", source: "LinkedIn", company: "Postman" },
  { name: "Varun Chowdhury", reqCode: "REQ-2026-001", stage: "applied", source: "Careers site", company: "Hasura" },
  { name: "Ritika Sinha", reqCode: "REQ-2026-001", stage: "applied", source: "Naukri", company: "Freshworks" },
  { name: "Gayatri Naidu", reqCode: "REQ-2026-001", stage: "applied", source: "LinkedIn", company: "BrowserStack" },
  { name: "Sameer Khanna", reqCode: "REQ-2026-001", stage: "rejected", source: "Agency", company: "Infosys", rejectedAtStage: "interview" },

  /* REQ-2026-002 · Staff Engineer, Platform · Bengaluru */
  { name: "Pranav Mukherjee", reqCode: "REQ-2026-002", stage: "offer", source: "Referral", company: "Zerodha" },
  { name: "Ashwin Krishnan", reqCode: "REQ-2026-002", stage: "interview", source: "LinkedIn", company: "Swiggy" },
  { name: "Madhuri Bose", reqCode: "REQ-2026-002", stage: "screening", source: "Agency", company: "Flipkart" },
  { name: "Chetan Hegde", reqCode: "REQ-2026-002", stage: "applied", source: "Careers site", company: "Amagi" },
  { name: "Faisal Sheikh", reqCode: "REQ-2026-002", stage: "rejected", source: "Naukri", company: "Wipro", rejectedAtStage: "screening" },

  /* REQ-2026-003 · Software Engineer, Frontend · Pune */
  { name: "Ishita Joshi", reqCode: "REQ-2026-003", stage: "hired", source: "Careers site", company: "Mindtickle" },
  { name: "Tarun Bhat", reqCode: "REQ-2026-003", stage: "hired", source: "Referral", company: "Icertis" },
  { name: "Deepika Rane", reqCode: "REQ-2026-003", stage: "offer", source: "LinkedIn", company: "Whatfix" },
  { name: "Yashwanth Gowda", reqCode: "REQ-2026-003", stage: "interview", source: "Naukri", company: "Thoughtworks" },
  { name: "Bhavana Pillai", reqCode: "REQ-2026-003", stage: "screening", source: "LinkedIn", company: "Persistent Systems" },
  { name: "Manish Agarwal", reqCode: "REQ-2026-003", stage: "applied", source: "Naukri", company: "Tata Consultancy Services" },
  { name: "Swati Kulkarni", reqCode: "REQ-2026-003", stage: "applied", source: "Careers site", company: "Zluri" },
  { name: "Kiran Patil", reqCode: "REQ-2026-003", stage: "rejected", source: "Agency", company: "Cognizant", rejectedAtStage: "applied" },

  /* REQ-2026-004 · Senior Software Engineer · Newark NJ */
  { name: "Emily Thompson", reqCode: "REQ-2026-004", stage: "interview", source: "LinkedIn", company: "Datadog" },
  { name: "Brian Okafor", reqCode: "REQ-2026-004", stage: "screening", source: "Referral", company: "MongoDB" },
  { name: "Rachel Novak", reqCode: "REQ-2026-004", stage: "applied", source: "Careers site", company: "Audible" },
  { name: "Kevin O'Brien", reqCode: "REQ-2026-004", stage: "rejected", source: "Agency", company: "Verizon", rejectedAtStage: "interview" },

  /* REQ-2026-005 · Product Manager, Payroll · Bengaluru */
  { name: "Aishwarya Menon", reqCode: "REQ-2026-005", stage: "hired", source: "Referral", company: "Darwinbox" },
  { name: "Siddharth Rao", reqCode: "REQ-2026-005", stage: "offer", source: "LinkedIn", company: "Keka" },
  { name: "Namrata Verma", reqCode: "REQ-2026-005", stage: "interview", source: "Naukri", company: "greytHR" },
  { name: "Abhishek Sethi", reqCode: "REQ-2026-005", stage: "screening", source: "Careers site", company: "Zoho" },
  { name: "Pooja Mishra", reqCode: "REQ-2026-005", stage: "applied", source: "LinkedIn", company: "Meesho" },

  /* REQ-2026-006 · Senior Product Designer · Bengaluru */
  { name: "Tanvi Saxena", reqCode: "REQ-2026-006", stage: "interview", source: "Referral", company: "CRED" },
  { name: "Naveen Prabhu", reqCode: "REQ-2026-006", stage: "screening", source: "LinkedIn", company: "Nykaa" },
  { name: "Anjali Chauhan", reqCode: "REQ-2026-006", stage: "applied", source: "Careers site", company: "Groww" },
  { name: "Rashmi Banerjee", reqCode: "REQ-2026-006", stage: "applied", source: "Naukri", company: "Myntra" },

  /* REQ-2026-007 · Enterprise Account Executive · Bengaluru */
  { name: "Sandeep Rathi", reqCode: "REQ-2026-007", stage: "hired", source: "Agency", company: "Sprinklr" },
  { name: "Divya Nambiar", reqCode: "REQ-2026-007", stage: "offer", source: "Referral", company: "Freshworks" },
  { name: "Imran Qureshi", reqCode: "REQ-2026-007", stage: "interview", source: "LinkedIn", company: "Salesforce India" },
  { name: "Lakshmi Varma", reqCode: "REQ-2026-007", stage: "screening", source: "Naukri", company: "Zoho" },
  { name: "Prakash Dutta", reqCode: "REQ-2026-007", stage: "applied", source: "Careers site", company: "Uniphore" },
  { name: "Vaishnavi Shetty", reqCode: "REQ-2026-007", stage: "rejected", source: "LinkedIn", company: "HighRadius", rejectedAtStage: "offer" },

  /* REQ-2026-008 · Account Executive, US East · Newark NJ */
  { name: "Sarah Miller", reqCode: "REQ-2026-008", stage: "offer", source: "LinkedIn", company: "Gusto" },
  { name: "David García", reqCode: "REQ-2026-008", stage: "interview", source: "Referral", company: "Paylocity" },
  { name: "Jessica Rossi", reqCode: "REQ-2026-008", stage: "screening", source: "Careers site", company: "TriNet" },
  { name: "Michael Whitaker", reqCode: "REQ-2026-008", stage: "applied", source: "Agency", company: "ADP" },

  /* REQ-2026-009 · Demand Generation Manager · Bengaluru (on hold) */
  { name: "Meera Raghavan", reqCode: "REQ-2026-009", stage: "interview", source: "LinkedIn", company: "Zomato" },
  { name: "Ganesh Iyer", reqCode: "REQ-2026-009", stage: "applied", source: "Naukri", company: "Dream11" },
  { name: "Nandini Sharma", reqCode: "REQ-2026-009", stage: "applied", source: "Careers site", company: "Paytm" },

  /* REQ-2026-010 · Customer Success Manager · Pune */
  { name: "Karthik Menon", reqCode: "REQ-2026-010", stage: "hired", source: "Referral", company: "Innovaccer" },
  { name: "Shreya Pathak", reqCode: "REQ-2026-010", stage: "offer", source: "Naukri", company: "Locus" },
  { name: "Anand Bhatia", reqCode: "REQ-2026-010", stage: "interview", source: "LinkedIn", company: "Fi Money" },
  { name: "Neha Kaur", reqCode: "REQ-2026-010", stage: "screening", source: "Careers site", company: "Slice" },
  { name: "Sanjana Rao", reqCode: "REQ-2026-010", stage: "applied", source: "Naukri", company: "Jupiter" },
  { name: "Girish Kamath", reqCode: "REQ-2026-010", stage: "rejected", source: "Agency", company: "Navi", rejectedAtStage: "screening" },

  /* REQ-2026-011 · Senior Finance Analyst · Pune */
  { name: "Priyanka Shukla", reqCode: "REQ-2026-011", stage: "interview", source: "Naukri", company: "Deloitte India" },
  { name: "Ravi Tiwari", reqCode: "REQ-2026-011", stage: "screening", source: "LinkedIn", company: "KPMG India" },
  { name: "Zoya Ansari", reqCode: "REQ-2026-011", stage: "applied", source: "Careers site", company: "EY India" },

  /* REQ-2026-012 · Site Reliability Engineer · Bengaluru */
  { name: "Suresh Yadav", reqCode: "REQ-2026-012", stage: "screening", source: "Referral", company: "Turno" },
  { name: "Aditi Bhandari", reqCode: "REQ-2026-012", stage: "screening", source: "LinkedIn", company: "Zomato" },
  { name: "Mohit Jain", reqCode: "REQ-2026-012", stage: "rejected", source: "Agency", company: "Rippling India", rejectedAtStage: "interview" },
];

const CANDIDATE_SKILLS: Record<string, string[]> = {
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

const CURRENT_TITLES: Record<string, string[]> = {
  ENG: ["Software Engineer II", "Senior Software Engineer", "Backend Engineer", "Member of Technical Staff", "Lead Engineer"],
  PRD: ["Product Manager", "Senior Product Manager", "Associate Product Manager"],
  DES: ["Product Designer", "Senior Product Designer", "UX Designer"],
  SAL: ["Account Executive", "Senior Account Executive", "Enterprise Sales Manager"],
  MKT: ["Demand Generation Lead", "Growth Marketing Manager", "Marketing Manager"],
  CSM: ["Customer Success Manager", "Senior CSM", "Account Manager"],
  FIN: ["Finance Analyst", "Senior Associate — Audit", "Assistant Manager — Finance"],
  ITO: ["Site Reliability Engineer", "DevOps Engineer", "Infrastructure Engineer"],
  HR: ["Talent Partner", "Recruiter"],
};

const REJECTION_REASONS: Record<string, string[]> = {
  applied: [
    "Profile is three grades below the bar for this requisition.",
    "No overlap with the core stack; screened out at CV review.",
  ],
  screening: [
    "Compensation expectation is 42% above the approved band and not negotiable.",
    "Notice period of 120 days does not work against the target close date.",
    "Looking for a fully remote role; this requisition is hybrid in Bengaluru.",
  ],
  interview: [
    "Technical depth did not clear the bar in the second round — panel was unanimous.",
    "Strong on delivery, thin on system design at the level this role needs.",
    "Withdrew after round two, citing a counter-offer from the current employer.",
  ],
  offer: [
    "Declined the offer and accepted a competing one at a higher fixed component.",
  ],
};

const SUMMARY_TEMPLATES: Record<string, string[]> = {
  ENG: [
    "Backend engineer with production ownership of a high-write transactional service; comfortable in the query plan as well as the code.",
    "Spent the last three years on payments infrastructure, including a ledger migration that ran without downtime.",
    "Full-stack by history, backend by preference. Writes unusually clear design documents.",
  ],
  PRD: [
    "Product manager out of compliance-heavy fintech; has shipped statutory features against hard filing deadlines.",
    "Comes from an HRIS background and has sat through live payroll runs with customers.",
  ],
  DES: [
    "Enterprise-first designer with a portfolio built on tables, forms and dense dashboards rather than landing pages.",
    "Owns a design system in current role, including its dark theme and accessibility audit.",
  ],
  SAL: [
    "Enterprise seller with a consistent record against a ₹4 Cr quota in HR and finance software.",
    "Strong on procurement and infosec cycles; brings a named-account list into the territory.",
  ],
  MKT: [
    "Demand-gen leader who owns a pipeline number rather than an MQL count.",
    "Built the attribution model that Sales and Finance both signed off on at the last company.",
  ],
  CSM: [
    "Manages a 30-account mid-market book with net revenue retention above 110%.",
    "Onboarding specialist; has taken customers through their first two pay runs repeatedly.",
  ],
  FIN: [
    "Qualified CA with four years of close, reconciliation and statutory filing ownership.",
    "Audit background, now in industry; comfortable owning the month-end calendar end to end.",
  ],
  ITO: [
    "SRE with paging-policy and error-budget ownership across a 60-service Kubernetes estate.",
    "Infrastructure engineer who has run a real disaster-recovery exercise, not a tabletop one.",
  ],
  HR: ["Talent partner with full-cycle recruiting ownership across engineering and go-to-market."],
};

/** Deterministic age of a candidate in their current stage. */
const STAGE_AGE_RANGE: Record<PipelineStage, [number, number]> = {
  applied: [1, 12],
  screening: [2, 16],
  interview: [3, 24],
  offer: [4, 21],
  hired: [6, 48],
  rejected: [5, 40],
};

const STAGE_RATING_RANGE: Record<PipelineStage, [number, number]> = {
  applied: [26, 38],
  screening: [30, 42],
  interview: [34, 46],
  offer: [40, 48],
  hired: [42, 50],
  rejected: [20, 34],
};

/** Strip accents so "David García" yields a clean slug. */
const deaccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

function resumeName(name: string) {
  const parts = deaccent(name.toLowerCase())
    .replace(/[^a-z\s]/g, "")
    .trim()
    .split(/\s+/);
  return `${parts.slice(1).join("-")}-${parts[0]}-resume.pdf`;
}

function candidateEmail(name: string, i: number) {
  const slug = deaccent(name.toLowerCase())
    .replace(/[^a-z\s]/g, "")
    .trim()
    .split(/\s+/)
    .join(".");
  const hosts = ["gmail.com", "outlook.com", "protonmail.com", "hey.com"];
  return `${slug}@${hosts[i % hosts.length]}`;
}

export const CANDIDATES: Candidate[] = (() => {
  const rng = mulberry32(90216);
  return CAND_SEEDS.map((seed, i) => {
    const req = REQUISITIONS.find((r) => r.code === seed.reqCode)!;
    const branch = branchById(req.branchId);
    const us = req.branchId === "EWR";
    const grade = GRADES.find((g) => g.id === req.gradeId)!;

    /* Nobody can have been in a stage, or have applied, before the
       requisition that created the opening was raised. */
    const reqAge = differenceInDays(TODAY, parseISO(req.raisedDate));
    const [ageMin, ageMax] = STAGE_AGE_RANGE[seed.stage];
    const stageAgeDays = Math.min(randInt(rng, ageMin, ageMax), Math.max(1, reqAge - 2));
    const stageSince = daysAgo(stageAgeDays);

    const appliedAge = Math.min(
      Math.max(1, reqAge - 1),
      stageAgeDays + randInt(rng, 2, 26) * (seed.stage === "applied" ? 0 : 1),
    );
    const appliedDate = daysAgo(Math.max(stageAgeDays, appliedAge));

    const [rMin, rMax] = STAGE_RATING_RANGE[seed.stage];
    const rating = randInt(rng, rMin, rMax) / 10;

    const currentCtc =
      Math.round((grade.minCtc * (0.72 + rng() * 0.34)) / 10000) * 10000;
    const expectedCtc =
      Math.round((currentCtc * (1.22 + rng() * 0.3)) / 10000) * 10000;

    const notice = pick(rng, us ? [0, 14, 14, 30] : [0, 15, 30, 30, 45, 60, 90]);
    const skillPool = CANDIDATE_SKILLS[req.departmentId] ?? CANDIDATE_SKILLS.ENG;
    const skills = seededShuffle(rng, skillPool).slice(0, randInt(rng, 3, 5));
    const titles = CURRENT_TITLES[req.departmentId] ?? CURRENT_TITLES.ENG;
    const summaries = SUMMARY_TEMPLATES[req.departmentId] ?? SUMMARY_TEMPLATES.ENG;

    const rejectedAtStage = seed.rejectedAtStage ?? null;
    const rejectionReason = rejectedAtStage
      ? pick(rng, REJECTION_REASONS[rejectedAtStage] ?? REJECTION_REASONS.interview)
      : null;

    const referredBy =
      seed.source === "Referral"
        ? (employeeByCode(req.hiringManagerCode)?.name ??
          employeeByCode(req.recruiterCode)?.name ??
          null)
        : null;

    return {
      id: `CAN-2026-${String(i + 1).padStart(3, "0")}`,
      name: seed.name,
      email: candidateEmail(seed.name, i),
      phone: us
        ? `+1 ${randInt(rng, 201, 989)} ${randInt(rng, 200, 999)} ${String(randInt(rng, 0, 9999)).padStart(4, "0")}`
        : `+91 ${randInt(rng, 70, 99)}${String(randInt(rng, 0, 99999999)).padStart(8, "0")}`,
      reqCode: req.code,
      role: req.role,
      departmentId: req.departmentId,
      branchId: req.branchId,
      location: branch ? `${branch.city}` : req.branchId,
      stage: seed.stage,
      rejectedAtStage,
      rejectionReason,
      currentCompany: seed.company,
      currentTitle: pick(rng, titles),
      experienceYears: randInt(rng, grade.level + 2, grade.level + 7),
      currentCtc,
      expectedCtc,
      noticePeriodDays: notice,
      source: seed.source,
      referredBy,
      appliedDate,
      stageSince,
      stageAgeDays,
      rating,
      resumeFile: resumeName(seed.name),
      skills,
      summary: pick(rng, summaries),
      ownerCode: req.recruiterCode,
    };
  });
})();

export const candidateById = (id: string) => CANDIDATES.find((c) => c.id === id);
export const candidatesForReq = (reqCode: string) =>
  CANDIDATES.filter((c) => c.reqCode === reqCode);
export const candidatesInStage = (stage: PipelineStage) =>
  CANDIDATES.filter((c) => c.stage === stage);

/* Reconcile requisition.filled against the candidates actually hired. */
for (const req of REQUISITIONS) {
  req.filled = CANDIDATES.filter(
    (c) => c.reqCode === req.code && c.stage === "hired",
  ).length;
}

/* -------------------------------------------------------------- interviews */

export interface CompetencyScore {
  competency: string;
  /** 1–5, whole or half steps. */
  rating: number;
}

export interface Scorecard {
  panelCode: string;
  competencies: CompetencyScore[];
  overall: number;
  recommendation: "Strong Hire" | "Hire" | "No Hire" | "Strong No Hire";
  feedback: string;
  submittedAt: string;
}

export interface Interview {
  id: string;
  candidateId: string;
  candidateName: string;
  reqCode: string;
  role: string;
  round: InterviewRound;
  panelCodes: string[];
  /** yyyy-MM-dd */
  date: string;
  /** HH:mm, 24h */
  time: string;
  /** ISO local date-time, for fmtDateTime */
  startsAt: string;
  durationMins: number;
  mode: InterviewMode;
  /** Meeting link or room name. */
  venue: string;
  status: "scheduled" | "completed" | "cancelled";
  scorecards: Scorecard[];
}

const COMPETENCIES: Record<InterviewRound, string[]> = {
  Screening: ["Communication", "Role fit", "Motivation", "Compensation alignment"],
  "Technical 1": ["Data structures", "Problem solving", "Code quality", "Debugging"],
  "Technical 2": ["Domain depth", "API design", "Testing rigour", "Production sense"],
  "System Design": ["Requirement framing", "Scalability", "Trade-off reasoning", "Data modelling"],
  "Hiring Manager": ["Ownership", "Stakeholder communication", "Delivery record", "Growth mindset"],
  Culture: ["Collaboration", "Feedback orientation", "Integrity", "Curiosity"],
};

const FEEDBACK: Record<InterviewRound, string[]> = {
  Screening: [
    "Clear on why they are looking and what they want next — the answer was specific, not rehearsed. Compensation expectation sits inside the band. Notice period is the only open item.",
    "Strong communicator. Walked through the last two years of work without needing prompting and was honest about what they did not own. Flagged a competing process in its final round.",
    "Good role fit on paper and in conversation. Slightly vague on the reason for the last move; worth a second pass with the hiring manager.",
    "Motivation is genuine — has used the product category as a customer and had opinions about it. Expectation is 12% above band, recommend we discuss rather than screen out.",
  ],
  "Technical 1": [
    "Solved the rate-limiting problem cleanly and reached the sliding-window variant without a hint. Code was readable first time and they wrote the edge-case test before being asked.",
    "Comfortable with data structures. Took a long route to the first solution but self-corrected once the complexity was called out, which is the behaviour we want.",
    "Debugging was the strongest signal: found the off-by-one in the pagination cursor by reasoning about it, not by printing everything.",
    "Correct solution, but the code needed three passes before it read well and the naming stayed poor after review. Bar is a Hire at the junior band, not at this one.",
  ],
  "Technical 2": [
    "Deep on PostgreSQL — explained why a partial index was the wrong tool for this query and what they would measure instead. Production instincts are real, not theoretical.",
    "Knows the domain. Discussed idempotency in payment retries with examples from an incident they owned, including what the postmortem changed.",
    "Testing discipline is good; they separated the contract test from the integration test without being nudged. Weaker on observability — no clear view on what they would alert on.",
    "Answers were accurate but shallow when pushed past the first layer. Fine for the grade below; not a clear signal at this level.",
  ],
  "System Design": [
    "Framed the requirements before drawing anything, which already puts them ahead. Landed on an event-sourced ledger with a projection for balances and defended the read-model cost honestly.",
    "Good scalability reasoning — sized the write path from the stated payroll cycle rather than guessing, and identified the month-end spike as the real design constraint.",
    "Trade-offs were the strength. Chose the boring solution twice and said why. Missed the multi-region replication lag question but recovered with a sensible fallback.",
    "Design was workable but generic. Could not explain how their data model would survive a statutory rule change, which is exactly the pressure this system takes.",
  ],
  "Hiring Manager": [
    "Ownership is evident — described a two-quarter migration they carried including the part where they had to go back to the leadership team and reset the date.",
    "Clear, calm communicator. Handled the disagreement scenario by separating the decision from the person, and gave a real example rather than a principle.",
    "Delivery record checks out against the CV. Growth mindset is genuine: named a skill gap unprompted and described what they are doing about it.",
    "Pleasant conversation but the examples stayed at team level. For this grade I need evidence of influence outside their own reporting line.",
  ],
  Culture: [
    "Collaborative by instinct. Described pairing with a struggling teammate without framing themselves as the hero of the story.",
    "Takes feedback well — we tested it live with a mild challenge and they engaged with it rather than defending.",
    "Curious in a useful direction: asked three questions about how we handle statutory changes, which is the hardest part of this product.",
    "Integrity signal was strong; volunteered a mistake that cost their team a release and what they changed afterwards.",
  ],
};

function recommendationFor(overall: number): Scorecard["recommendation"] {
  if (overall >= 4.3) return "Strong Hire";
  if (overall >= 3.6) return "Hire";
  if (overall >= 2.8) return "No Hire";
  return "Strong No Hire";
}

/** Which rounds a candidate has been through, given the stage they are in. */
function roundsForCandidate(c: Candidate): InterviewRound[] {
  const technical = ["ENG", "ITO"].includes(c.departmentId);
  const full: InterviewRound[] = technical
    ? ["Screening", "Technical 1", "System Design", "Hiring Manager", "Culture"]
    : ["Screening", "Technical 1", "Technical 2", "Hiring Manager", "Culture"];

  const reached = c.stage === "rejected" ? (c.rejectedAtStage ?? "interview") : c.stage;
  switch (reached) {
    case "applied":
      return [];
    case "screening":
      return full.slice(0, 1);
    case "interview":
      return full.slice(0, 3);
    case "offer":
      return full.slice(0, 4);
    case "hired":
      return full;
    default:
      return full.slice(0, 2);
  }
}

const TIME_SLOTS = ["09:30", "10:30", "11:30", "12:00", "14:00", "15:00", "16:00", "17:00"];

function toWeekday(d: Date, forward: boolean) {
  const day = d.getDay();
  if (day === 0) return addDays(d, forward ? 1 : -2);
  if (day === 6) return addDays(d, forward ? 2 : -1);
  return d;
}

export const INTERVIEWS: Interview[] = (() => {
  const rng = mulberry32(51477);
  const out: Interview[] = [];
  let n = 0;

  for (const c of CANDIDATES) {
    const rounds = roundsForCandidate(c);
    if (!rounds.length) continue;

    const dept = c.departmentId;
    const req = requisitionByCode(c.reqCode)!;
    const pool = panelPool.get(dept) ?? [req.hiringManagerCode];

    /* The last round of an in-flight candidate is still ahead of us; earlier
       rounds are behind. That is what makes the calendar look alive. */
    const inFlight = c.stage === "interview" || c.stage === "screening";
    const lastUpcoming = inFlight && rng() > 0.25;

    rounds.forEach((round, ri) => {
      n += 1;
      const isLast = ri === rounds.length - 1;
      const upcoming = lastUpcoming && isLast;

      /* Completed rounds walk backwards from the current stage, but never
         past the day the requisition was raised. */
      const reqAge = differenceInDays(TODAY, parseISO(req.raisedDate));
      const offset = upcoming
        ? randInt(rng, 0, 16)
        : -Math.min(
            c.stageAgeDays + (rounds.length - ri) * randInt(rng, 3, 7),
            Math.max(1, reqAge - 1),
          );
      const date = toWeekday(addDays(TODAY, offset), upcoming);
      const time = pick(rng, TIME_SLOTS);
      const mode: InterviewMode =
        round === "Screening"
          ? pick(rng, ["Telephonic", "Video call", "Video call"] as InterviewMode[])
          : c.branchId === "EWR"
            ? "Video call"
            : pick(rng, ["Video call", "Video call", "In person"] as InterviewMode[]);

      const panelSize = round === "Screening" ? 1 : randInt(rng, 1, 3);
      const panelCodes: string[] = [];
      if (round === "Screening") {
        panelCodes.push(req.recruiterCode);
      } else if (round === "Hiring Manager") {
        panelCodes.push(req.hiringManagerCode);
      }
      while (panelCodes.length < panelSize) {
        const pickCode = pick(rng, pool);
        if (!panelCodes.includes(pickCode)) panelCodes.push(pickCode);
      }

      const status: Interview["status"] = upcoming
        ? "scheduled"
        : c.stage === "rejected" && isLast && rng() > 0.82
          ? "cancelled"
          : "completed";

      const scorecards: Scorecard[] =
        status === "completed"
          ? panelCodes.map((panelCode, pi) => {
              const base = c.stage === "rejected" && isLast ? 2.4 : c.rating * 0.86 + 0.5;
              const competencies = COMPETENCIES[round].map((competency) => {
                const raw = base + (rng() - 0.45) * 1.1;
                return {
                  competency,
                  rating: Math.min(5, Math.max(1, Math.round(raw * 2) / 2)),
                };
              });
              const overall =
                Math.round(
                  (competencies.reduce((a, b) => a + b.rating, 0) / competencies.length) * 10,
                ) / 10;
              return {
                panelCode,
                competencies,
                overall,
                recommendation: recommendationFor(overall),
                feedback: FEEDBACK[round][(n + pi) % FEEDBACK[round].length],
                submittedAt: `${iso(addDays(date, 0))}T${time}:00`,
              };
            })
          : [];

      out.push({
        id: `INT-2026-${String(n).padStart(3, "0")}`,
        candidateId: c.id,
        candidateName: c.name,
        reqCode: c.reqCode,
        role: c.role,
        round,
        panelCodes,
        date: iso(date),
        time,
        startsAt: `${iso(date)}T${time}:00`,
        durationMins: round === "Screening" ? 30 : round === "System Design" ? 75 : 60,
        mode,
        venue:
          mode === "Video call"
            ? `meet.stellartech.in/${c.id.toLowerCase()}-${ri + 1}`
            : mode === "In person"
              ? pick(rng, ["Meeting Room 3B — Tycho", "Meeting Room 2A — Kepler", "Interview Room — Ground floor"])
              : `Call to ${c.phone}`,
        status,
        scorecards,
      });
    });
  }

  return out.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
})();

export const interviewById = (id: string) => INTERVIEWS.find((i) => i.id === id);
export const interviewsForCandidate = (candidateId: string) =>
  INTERVIEWS.filter((i) => i.candidateId === candidateId);
export const interviewsOn = (date: string) => INTERVIEWS.filter((i) => i.date === date);
export const UPCOMING_INTERVIEWS = INTERVIEWS.filter(
  (i) => i.status === "scheduled" && i.date >= DEMO_TODAY,
);

/* ------------------------------------------------------------------ offers */

/** Offer lifecycle — every value is a key already present in STATUS_MAP. */
export type OfferStatus = "pending" | "approved" | "hired" | "rejected" | "expired";

export const OFFER_STATUS_LABEL: Record<OfferStatus, string> = {
  pending: "Pending approval",
  approved: "Released",
  hired: "Accepted",
  rejected: "Declined",
  expired: "Lapsed",
};

export interface CtcComponent {
  label: string;
  /** monthly amount in INR; annual = monthly * 12 */
  monthly: number;
  annual: number;
  group: "Fixed" | "Retirals" | "Variable";
  note?: string;
}

export interface ApprovalStep {
  actorCode: string;
  role: string;
  action: "Raised" | "Approved" | "Awaiting" | "Declined";
  at: string | null;
  comment: string | null;
}

export interface Offer {
  id: string;
  candidateId: string;
  candidateName: string;
  reqCode: string;
  role: string;
  departmentId: string;
  branchId: string;
  gradeId: string;
  status: OfferStatus;
  ctc: number;
  /** Sums exactly to `ctc`. */
  breakup: CtcComponent[];
  joiningBonus: number;
  offerDate: string;
  validTill: string;
  joiningDate: string;
  respondedAt: string | null;
  approvals: ApprovalStep[];
  notes: string;
}

/** Earnings breakup for an annual CTC. The balancing component is Special Allowance. */
export function buildCtcBreakup(ctc: number): CtcComponent[] {
  const basic = Math.round(ctc * 0.4);
  const hra = Math.round(basic * 0.5);
  const lta = Math.round(basic * 0.0833);
  const telecom = 24000;
  const employerPf = Math.min(Math.round(basic * 0.12), 21600);
  const gratuity = Math.round(basic * 0.0481);
  const variable = Math.round(ctc * 0.1);
  const special = ctc - (basic + hra + lta + telecom + employerPf + gratuity + variable);

  const mk = (
    label: string,
    annual: number,
    group: CtcComponent["group"],
    note?: string,
  ): CtcComponent => ({
    label,
    annual,
    monthly: Math.round(annual / 12),
    group,
    note,
  });

  return [
    mk("Basic salary", basic, "Fixed", "40% of CTC — the base for PF and gratuity"),
    mk("House rent allowance", hra, "Fixed", "50% of basic"),
    mk("Leave travel allowance", lta, "Fixed", "Claimable twice in a block of four years"),
    mk("Telephone & internet", telecom, "Fixed", "Reimbursed against bills"),
    mk("Special allowance", special, "Fixed", "Balancing component"),
    mk("Employer PF contribution", employerPf, "Retirals", "12% of basic, capped at ₹1,800 per month"),
    mk("Gratuity provision", gratuity, "Retirals", "4.81% of basic, payable after 5 years"),
    mk("Performance pay", variable, "Variable", "10% of CTC, paid against the annual review"),
  ];
}

interface OfferSeed {
  candidateName: string;
  status: OfferStatus;
  /** Days ago the offer was raised. */
  raisedAgo: number;
  joiningIn: number;
  bump: number;
  joiningBonus: number;
  notes: string;
}

const OFFER_SEEDS: OfferSeed[] = [
  {
    candidateName: "Nikhil Bansal",
    status: "hired",
    raisedAgo: 26,
    joiningIn: 20,
    bump: 1.02,
    joiningBonus: 150000,
    notes: "Accepted within 48 hours. Joining bonus covers the notice buy-out at the current employer.",
  },
  {
    candidateName: "Ishita Joshi",
    status: "hired",
    raisedAgo: 41,
    joiningIn: 4,
    bump: 0.99,
    joiningBonus: 0,
    notes: "Background verification cleared. Pre-joining kit and laptop allocation raised with IT.",
  },
  {
    candidateName: "Tarun Bhat",
    status: "hired",
    raisedAgo: 34,
    joiningIn: 11,
    bump: 1.0,
    joiningBonus: 75000,
    notes: "Relocating from Hyderabad; one-time relocation support approved outside CTC.",
  },
  {
    candidateName: "Aishwarya Menon",
    status: "hired",
    raisedAgo: 47,
    joiningIn: -9,
    bump: 1.04,
    joiningBonus: 0,
    notes: "Joined on schedule — requisition REQ-2026-005 closed as filled on the joining date.",
  },
  {
    candidateName: "Sandeep Rathi",
    status: "hired",
    raisedAgo: 30,
    joiningIn: 15,
    bump: 0.98,
    joiningBonus: 100000,
    notes: "Variable component set at 40:60 fixed-to-variable per the enterprise sales plan.",
  },
  {
    candidateName: "Karthik Menon",
    status: "hired",
    raisedAgo: 22,
    joiningIn: 25,
    bump: 1.01,
    joiningBonus: 0,
    notes: "Accepted after a one-round compensation discussion. Pune reporting location confirmed.",
  },
  {
    candidateName: "Aditya Kulkarni",
    status: "pending",
    raisedAgo: 3,
    joiningIn: 60,
    bump: 1.08,
    joiningBonus: 200000,
    notes: "8% above the approved band — VP Engineering sign-off required before release.",
  },
  {
    candidateName: "Pranav Mukherjee",
    status: "approved",
    raisedAgo: 9,
    joiningIn: 74,
    bump: 1.0,
    joiningBonus: 250000,
    notes: "Released 9 days ago. Candidate has asked for a week to close a competing process.",
  },
  {
    candidateName: "Deepika Rane",
    status: "approved",
    raisedAgo: 6,
    joiningIn: 52,
    bump: 1.0,
    joiningBonus: 0,
    notes: "Released after the panel debrief. Verbal acceptance received, awaiting signed copy.",
  },
  {
    candidateName: "Siddharth Rao",
    status: "approved",
    raisedAgo: 12,
    joiningIn: 48,
    bump: 1.03,
    joiningBonus: 125000,
    notes: "Second offer against REQ-2026-005 in case the joined candidate does not confirm past probation.",
  },
  {
    candidateName: "Divya Nambiar",
    status: "approved",
    raisedAgo: 8,
    joiningIn: 39,
    bump: 1.0,
    joiningBonus: 0,
    notes: "Standard enterprise AE plan. On-target earnings shared as a separate annexure.",
  },
  {
    candidateName: "Sarah Miller",
    status: "pending",
    raisedAgo: 2,
    joiningIn: 45,
    bump: 1.06,
    joiningBonus: 0,
    notes: "US offer — awaiting Finance confirmation of the USD conversion and the benefits rider.",
  },
  {
    candidateName: "Shreya Pathak",
    status: "approved",
    raisedAgo: 5,
    joiningIn: 66,
    bump: 1.0,
    joiningBonus: 0,
    notes: "Released with a 60-day notice allowance built into the joining date.",
  },
  {
    candidateName: "Vaishnavi Shetty",
    status: "rejected",
    raisedAgo: 19,
    joiningIn: 30,
    bump: 1.0,
    joiningBonus: 0,
    notes: "Declined — accepted a competing offer with a higher fixed component. Kept warm for the next cycle.",
  },
];

export const OFFERS: Offer[] = (() => {
  const rng = mulberry32(77021);
  return OFFER_SEEDS.map((seed, i) => {
    const cand = CANDIDATES.find((c) => c.name === seed.candidateName)!;
    const req = requisitionByCode(cand.reqCode)!;
    const raw = cand.expectedCtc * seed.bump;
    const ctc =
      Math.round(
        Math.min(Math.max(raw, req.budgetMinCtc), req.budgetMaxCtc * 1.08) / 10000,
      ) * 10000;

    const offerDate = daysAgo(seed.raisedAgo);
    const joiningDate = daysAhead(seed.joiningIn);
    const validTill = iso(addDays(parseISO(offerDate), 10));

    const hm = req.hiringManagerCode;
    const approvals: ApprovalStep[] = [
      {
        actorCode: req.recruiterCode,
        role: "Recruiter",
        action: "Raised",
        at: `${offerDate}T10:15:00`,
        comment: `Offer raised at ${Math.round((ctc / req.budgetMaxCtc) * 100)}% of the approved band ceiling.`,
      },
      {
        actorCode: hm,
        role: "Hiring Manager",
        action: "Approved",
        at: `${iso(addDays(parseISO(offerDate), 1))}T12:40:00`,
        comment: "Panel debrief is unanimous. Approved at the proposed number.",
      },
      {
        actorCode: "STL-0009",
        role: "HR Admin",
        action:
          seed.status === "pending"
            ? "Awaiting"
            : seed.status === "rejected"
              ? "Approved"
              : "Approved",
        at:
          seed.status === "pending"
            ? null
            : `${iso(addDays(parseISO(offerDate), 1))}T16:05:00`,
        comment:
          seed.status === "pending"
            ? "Above the approved band — waiting on the compensation committee note."
            : "Band, grade and internal parity checked against the Engineering ladder.",
      },
      {
        actorCode: "STL-0008",
        role: "Finance",
        action: seed.status === "pending" ? "Awaiting" : "Approved",
        at:
          seed.status === "pending"
            ? null
            : `${iso(addDays(parseISO(offerDate), 2))}T11:20:00`,
        comment:
          seed.status === "pending"
            ? "Blocked on the HR Admin step."
            : "Within the department's FY27 headcount budget for this cost centre.",
      },
    ];

    const respondedAt =
      seed.status === "hired"
        ? `${iso(addDays(parseISO(offerDate), randInt(rng, 1, 5)))}T09:30:00`
        : seed.status === "rejected"
          ? `${iso(addDays(parseISO(offerDate), randInt(rng, 4, 9)))}T18:10:00`
          : null;

    return {
      id: `OFF-2026-${String(i + 1).padStart(3, "0")}`,
      candidateId: cand.id,
      candidateName: cand.name,
      reqCode: cand.reqCode,
      role: cand.role,
      departmentId: cand.departmentId,
      branchId: cand.branchId,
      gradeId: req.gradeId,
      status: seed.status,
      ctc,
      breakup: buildCtcBreakup(ctc),
      joiningBonus: seed.joiningBonus,
      offerDate,
      validTill,
      joiningDate,
      respondedAt,
      approvals,
      notes: seed.notes,
    };
  });
})();

export const offerById = (id: string) => OFFERS.find((o) => o.id === id);
export const offerForCandidate = (candidateId: string) =>
  OFFERS.find((o) => o.candidateId === candidateId);

/* ---------------------------------------------------------------- timeline */

export interface TimelineEvent {
  at: string;
  title: string;
  detail: string;
  kind: "application" | "stage" | "interview" | "note" | "offer" | "decision";
  actor?: string;
}

/** Activity trail for one candidate, newest first. */
export function candidateTimeline(candidateId: string): TimelineEvent[] {
  const c = candidateById(candidateId);
  if (!c) return [];
  const req = requisitionByCode(c.reqCode);
  const recruiter = employeeByCode(c.ownerCode)?.name ?? "Recruiting";
  const events: TimelineEvent[] = [];

  events.push({
    at: `${c.appliedDate}T09:05:00`,
    title: `Applied via ${c.source}`,
    detail:
      c.source === "Referral"
        ? `Referred by ${c.referredBy ?? "an employee"} for ${c.role} (${c.reqCode}).`
        : `Application received for ${c.role} (${c.reqCode}). Resume ${c.resumeFile} attached.`,
    kind: "application",
    actor: c.source === "Referral" ? (c.referredBy ?? recruiter) : "Careers portal",
  });

  if (c.stage !== "applied" && c.rejectedAtStage !== "applied") {
    events.push({
      at: `${iso(addDays(parseISO(c.appliedDate), 2))}T11:20:00`,
      title: "Moved to Screening",
      detail: `Profile shortlisted against the ${req?.role ?? c.role} scorecard. Current CTC and notice period captured.`,
      kind: "stage",
      actor: recruiter,
    });
  }

  for (const iv of interviewsForCandidate(c.id)) {
    events.push({
      at: iv.startsAt,
      title:
        iv.status === "scheduled"
          ? `${iv.round} scheduled`
          : iv.status === "cancelled"
            ? `${iv.round} cancelled`
            : `${iv.round} completed`,
      detail:
        iv.status === "scheduled"
          ? `${iv.mode} · ${iv.durationMins} min · panel of ${iv.panelCodes.length}.`
          : iv.status === "cancelled"
            ? "Cancelled by the panel; candidate was informed the same day."
            : `${iv.scorecards.length} scorecard${iv.scorecards.length === 1 ? "" : "s"} submitted · average ${
                iv.scorecards.length
                  ? (
                      iv.scorecards.reduce((a, s) => a + s.overall, 0) / iv.scorecards.length
                    ).toFixed(1)
                  : "—"
              } / 5.`,
      kind: "interview",
      actor: iv.panelCodes.map((p) => employeeByCode(p)?.name ?? p).join(", "),
    });
  }

  const offer = offerForCandidate(c.id);
  if (offer) {
    events.push({
      at: `${offer.offerDate}T10:15:00`,
      title: "Offer raised",
      detail: `Annual CTC proposed for grade ${offer.gradeId}. Valid till ${offer.validTill}.`,
      kind: "offer",
      actor: recruiter,
    });
    if (offer.status !== "pending") {
      events.push({
        at: `${iso(addDays(parseISO(offer.offerDate), 2))}T11:20:00`,
        title: "Offer released to candidate",
        detail: `Approval trail complete — hiring manager, HR and Finance. Joining date proposed as ${offer.joiningDate}.`,
        kind: "offer",
        actor: "Priya Menon",
      });
    }
    if (offer.respondedAt) {
      events.push({
        at: offer.respondedAt,
        title: offer.status === "hired" ? "Offer accepted" : "Offer declined",
        detail: offer.notes,
        kind: "decision",
        actor: c.name,
      });
    }
  }

  if (c.stage === "rejected") {
    events.push({
      at: `${c.stageSince}T17:45:00`,
      title: `Rejected at ${stageLabel(c.rejectedAtStage ?? "interview")}`,
      detail: c.rejectionReason ?? "Closed out of the pipeline.",
      kind: "decision",
      actor: recruiter,
    });
  }

  if (c.stage === "hired") {
    events.push({
      at: `${c.stageSince}T09:00:00`,
      title: "Marked as hired",
      detail: `Handed over to onboarding. Requisition ${c.reqCode} updated — ${
        req ? `${req.filled} of ${req.headcount}` : "1 of 1"
      } positions closed.`,
      kind: "decision",
      actor: "Priya Menon",
    });
  }

  return events.sort((a, b) => b.at.localeCompare(a.at));
}

/* ------------------------------------------------------------------ stats */

/** Stage counts on the board — always sums to CANDIDATES.length. */
export const STAGE_COUNTS: Record<PipelineStage, number> = PIPELINE_STAGES.reduce(
  (acc, s) => {
    acc[s.id] = CANDIDATES.filter((c) => c.stage === s.id).length;
    return acc;
  },
  {} as Record<PipelineStage, number>,
);

/**
 * Recruitment funnel — how many candidates REACHED each stage, derived from
 * the pipeline plus where each rejected candidate dropped out. It reconciles
 * with STAGE_COUNTS by construction.
 */
export const RECRUITMENT_FUNNEL: { stage: string; value: number }[] = (() => {
  const order: PipelineStage[] = ["applied", "screening", "interview", "offer", "hired"];
  const out: { stage: string; value: number }[] = [];
  let reached = CANDIDATES.length;
  order.forEach((stage, i) => {
    out.push({ stage: stageLabel(stage), value: reached });
    if (i === order.length - 1) return;
    const stuck = CANDIDATES.filter((c) => c.stage === stage).length;
    const dropped = CANDIDATES.filter(
      (c) => c.stage === "rejected" && c.rejectedAtStage === stage,
    ).length;
    reached = reached - stuck - dropped;
  });
  return out;
})();

export const SOURCE_MIX = CANDIDATE_SOURCES.map((source) => ({
  name: source,
  value: CANDIDATES.filter((c) => c.source === source).length,
}));

/** Days from requisition raised to the hired candidate entering "hired". */
export const TIME_TO_FILL_DAYS = (() => {
  const hired = CANDIDATES.filter((c) => c.stage === "hired");
  if (!hired.length) return 0;
  const total = hired.reduce((a, c) => {
    const req = requisitionByCode(c.reqCode);
    if (!req) return a;
    return a + differenceInDays(parseISO(c.stageSince), parseISO(req.raisedDate));
  }, 0);
  return Math.round(total / hired.length);
})();

export const HIRING_KPIS = {
  openRequisitions: REQUISITIONS.filter((r) => r.status === "open").length,
  onHold: REQUISITIONS.filter((r) => r.status === "on_hold").length,
  pendingApproval: REQUISITIONS.filter((r) => r.approvalStatus === "pending").length,
  openPositions: REQUISITIONS.filter((r) => r.status === "open").reduce(
    (a, r) => a + (r.headcount - r.filled),
    0,
  ),
  ageingOver45: REQUISITIONS.filter(
    (r) => r.status === "open" && reqAgeingDays(r) > 45,
  ).length,
  offersOut: OFFERS.filter((o) => o.status === "approved").length,
  offersPending: OFFERS.filter((o) => o.status === "pending").length,
  offersAccepted: OFFERS.filter((o) => o.status === "hired").length,
  timeToFillDays: TIME_TO_FILL_DAYS,
  activeCandidates: CANDIDATES.filter(
    (c) => c.stage !== "hired" && c.stage !== "rejected",
  ).length,
  interviewsThisWeek: INTERVIEWS.filter(
    (i) =>
      i.status === "scheduled" &&
      i.date >= DEMO_TODAY &&
      differenceInDays(parseISO(i.date), TODAY) <= 6,
  ).length,
  /** Accepted ÷ (accepted + declined), as a percentage. */
  offerAcceptanceRate: (() => {
    const accepted = OFFERS.filter((o) => o.status === "hired").length;
    const declined = OFFERS.filter((o) => o.status === "rejected").length;
    return accepted + declined === 0
      ? 0
      : Math.round((accepted / (accepted + declined)) * 1000) / 10;
  })(),
};

/* ------------------------------------------------------------- convenience */

export const reqLabel = (code: string) => {
  const r = requisitionByCode(code);
  return r ? `${r.code} · ${r.role}` : code;
};

export const deptLabel = (id: string) => deptById(id)?.name ?? id;
export const branchLabel = (id: string) => branchById(id)?.city ?? id;

/** Department / branch option lists for the filter rows. */
export const HIRING_DEPARTMENTS = Array.from(
  new Set(REQUISITIONS.map((r) => r.departmentId)),
).map((id) => ({ value: id, label: deptLabel(id) }));

export const HIRING_BRANCHES = Array.from(
  new Set(REQUISITIONS.map((r) => r.branchId)),
).map((id) => ({ value: id, label: branchLabel(id) }));

export const REQ_OPTIONS = REQUISITIONS.map((r) => ({
  value: r.code,
  label: `${r.code} · ${r.role}`,
}));
