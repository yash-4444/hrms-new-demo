/* ============================================================================
   AI suite fixtures — knowledge base, insights, forecasts, drafting templates,
   settings and usage. Everything that can be derived from the existing people,
   leave, payroll, attendance and expense fixtures IS derived from them, so the
   AI screens never disagree with the module screens they summarise.
   ========================================================================== */

import { addMonths, differenceInMonths, format, parseISO, subMonths } from "date-fns";
import { mulberry32, randInt } from "@/lib/utils";
import { BRANCHES, DEMO_TODAY, DEPARTMENTS, GRADES, branchById, deptName } from "./org";
import { EMPLOYEES, employeeByCode, type Employee } from "./employees";
import { HEADCOUNT_12M, ATTRITION } from "./insights";
import { PAYROLL_COST_TREND, CURRENT_PERIOD, PREVIOUS_PERIOD, payRunRows } from "./payroll";
import { OVERTIME_REPORT_30D } from "./attendance";
import { EXPENSE_CLAIMS } from "./workplace";
import { REQUISITIONS } from "./hiring";

const TODAY = parseISO(DEMO_TODAY);

/* ==========================================================================
   1 · POLICY KNOWLEDGE BASE
   ========================================================================== */

export type KbStatus = "indexed" | "indexing" | "failed";

export interface KbPassage {
  id: string;
  section: string;
  page: number;
  text: string;
  /** Lower-case terms the retriever matches on. */
  terms: string[];
}

export interface KbDocument {
  id: string;
  title: string;
  category: "Leave & Time" | "Conduct" | "Benefits" | "Workplace" | "IT" | "Handbook" | "Payroll";
  version: string;
  owner: string;
  pages: number;
  chunks: number;
  status: KbStatus;
  failReason?: string;
  updatedOn: string;
  indexedOn: string | null;
  audience: string;
  passages: KbPassage[];
}

const p = (id: string, section: string, page: number, text: string, terms: string[]): KbPassage => ({
  id,
  section,
  page,
  text,
  terms,
});

export const KB_DOCUMENTS: KbDocument[] = [
  {
    id: "kb-leave",
    title: "Leave Policy",
    category: "Leave & Time",
    version: "v4.2",
    owner: "Priya Menon",
    pages: 14,
    chunks: 62,
    status: "indexed",
    updatedOn: "2026-04-01",
    indexedOn: "2026-04-01",
    audience: "All employees · India",
    passages: [
      p("leave-3.1", "§3.1 Earned Leave", 4, "Earned Leave accrues at 1.75 days for every completed month of service, up to 21 days in a financial year. Unused Earned Leave carries forward up to a maximum of 30 days; any balance above 30 days lapses on 31 March.", ["earned", "el", "privilege", "accrue", "accrual", "carry", "forward", "lapse", "annual"]),
      p("leave-3.2", "§3.2 Casual Leave", 5, "Twelve days of Casual Leave are granted on 1 April each year. Casual Leave cannot be carried forward and is not encashable. A medical or supporting document is required when a single application exceeds 3 days.", ["casual", "cl", "carry", "encash"]),
      p("leave-3.3", "§3.3 Sick Leave", 5, "Twelve days of Sick Leave are granted each financial year. A medical certificate from a registered practitioner is required for any absence longer than 2 consecutive working days.", ["sick", "sl", "medical", "certificate", "doctor", "ill"]),
      p("leave-4.1", "§4.1 Weekends and holidays", 6, "Weekends and gazetted holidays falling inside a leave application are not deducted from the balance. Optional holidays are deducted unless they are chosen as the employee's restricted holiday.", ["weekend", "holiday", "sandwich", "deduct", "deducted"]),
      p("leave-5.1", "§5.1 Maternity Leave", 8, "Eligible women employees are entitled to 26 weeks (182 days) of paid Maternity Leave under the Maternity Benefit Act, counted in calendar days. Up to 8 weeks may be taken before the expected date of delivery.", ["maternity", "ml", "pregnancy", "baby", "delivery"]),
      p("leave-5.2", "§5.2 Paternity Leave", 8, "Employees are entitled to 10 working days of paid Paternity Leave, to be availed within 6 months of the child's birth or adoption.", ["paternity", "pl", "father", "baby", "adoption"]),
      p("leave-6.1", "§6.1 Encashment", 10, "Earned Leave is encashable at exit at the rate of the last drawn basic salary per day. Encashment during service is permitted once a year for balances above 15 days.", ["encash", "encashment", "exit", "resign"]),
      p("leave-7.2", "§7.2 Applying and approval", 11, "Leave must be applied for through the HRMS at least 3 working days in advance, except Sick Leave. Applications are approved by the reporting manager; unactioned requests escalate to the skip-level manager after 48 hours.", ["apply", "approval", "approve", "advance", "notice", "escalate"]),
    ],
  },
  {
    id: "kb-travel",
    title: "Travel & Expense Policy",
    category: "Workplace",
    version: "v3.0",
    owner: "Lakshmi Pillai",
    pages: 18,
    chunks: 71,
    status: "indexed",
    updatedOn: "2026-06-15",
    indexedOn: "2026-06-15",
    audience: "All employees",
    passages: [
      p("travel-2.1", "§2.1 Air travel", 3, "Domestic air travel is economy class, capped at ₹18,000 per sector. Bookings must be made at least 7 days in advance through the travel desk unless the trip is approved as urgent.", ["air", "flight", "fly", "economy", "travel", "booking", "sector"]),
      p("travel-2.4", "§2.4 Accommodation", 5, "Hotel stays are reimbursed up to ₹6,500 per night in metro cities (Mumbai, Delhi NCR, Bengaluru, Chennai, Kolkata, Hyderabad, Pune) and ₹4,500 per night elsewhere.", ["hotel", "accommodation", "stay", "night", "lodging"]),
      p("travel-3.1", "§3.1 Meals and per diem", 7, "Meals while travelling are reimbursed at actuals up to ₹1,200 per day per person. Alcohol is not reimbursable under any category.", ["meal", "meals", "food", "per diem", "diem", "alcohol", "dinner", "lunch"]),
      p("travel-4.2", "§4.2 Submitting claims", 9, "Expense claims must be submitted within 30 days of the expense date with an itemised receipt for every line above ₹500. Claims are approved by the reporting manager and then verified by Finance before reimbursement in the next payroll cycle.", ["claim", "receipt", "submit", "reimburse", "reimbursement", "expense", "deadline", "30 days"]),
      p("travel-4.5", "§4.5 Policy exceptions", 11, "A line that exceeds its category limit is flagged for the approver. The excess is paid only when the approver records a business justification; otherwise the line is reimbursed up to the limit.", ["exceed", "limit", "exception", "violation", "cap", "over"]),
    ],
  },
  {
    id: "kb-coc",
    title: "Code of Conduct",
    category: "Conduct",
    version: "v2.3",
    owner: "Priya Menon",
    pages: 22,
    chunks: 88,
    status: "indexed",
    updatedOn: "2026-01-10",
    indexedOn: "2026-01-10",
    audience: "All employees",
    passages: [
      p("coc-4.1", "§4.1 Conflicts of interest", 7, "Employees must disclose any outside employment, directorship or financial interest in a vendor, customer or competitor to HR within 15 days of it arising.", ["conflict", "interest", "moonlight", "moonlighting", "side", "outside", "freelance", "second job"]),
      p("coc-5.2", "§5.2 Gifts", 9, "Gifts from business partners above ₹2,000 in value must be declined or declared to the Compliance team. Cash or cash-equivalent gifts must always be declined.", ["gift", "gifts", "vendor", "present"]),
      p("coc-8.1", "§8.1 Notice period", 16, "The notice period is 30 days during probation and 60 days after confirmation (90 days for grade G5 and above). Shortfall may be adjusted against Earned Leave balance with the manager's approval.", ["notice", "notice period", "resign", "resignation", "quit", "exit", "probation", "confirmation", "leave company"]),
    ],
  },
  {
    id: "kb-posh",
    title: "POSH Policy",
    category: "Conduct",
    version: "v2.0",
    owner: "Priya Menon",
    pages: 12,
    chunks: 41,
    status: "indexed",
    updatedOn: "2025-12-01",
    indexedOn: "2025-12-01",
    audience: "All employees",
    passages: [
      p("posh-3.1", "§3.1 Internal Committee", 4, "The Internal Committee (IC) is constituted under the POSH Act, 2013, presided by a senior woman employee, with an external member from an NGO. Complaints can be raised confidentially at ic@stellartech.in.", ["posh", "harassment", "complaint", "committee", "ic", "sexual"]),
      p("posh-4.2", "§4.2 Timelines", 6, "A complaint should be made within 3 months of the incident. The IC completes its inquiry within 90 days, and no retaliation of any kind against the complainant or witnesses is tolerated.", ["posh", "complaint", "inquiry", "retaliation", "timeline", "harassment"]),
    ],
  },
  {
    id: "kb-wfh",
    title: "Work From Home Policy",
    category: "Workplace",
    version: "v1.4",
    owner: "Priya Menon",
    pages: 6,
    chunks: 19,
    status: "indexed",
    updatedOn: "2026-07-01",
    indexedOn: "2026-07-01",
    audience: "Hybrid & remote employees",
    passages: [
      p("wfh-2.1", "§2.1 Eligibility", 2, "Hybrid employees may work from home up to 2 days a week after confirmation. Employees on probation work from office unless their manager approves an exception in the HRMS.", ["wfh", "work from home", "home", "remote", "hybrid", "eligible", "eligibility"]),
      p("wfh-3.2", "§3.2 Allowance", 4, "A home-office internet reimbursement of up to ₹1,500 per month is available to hybrid and remote employees, claimed under Internet & Telecom.", ["internet", "broadband", "allowance", "wfh", "home office", "telecom"]),
      p("wfh-4.1", "§4.1 Attendance", 5, "WFH days must be marked via web or mobile punch. A day without a punch is treated as absent until regularised.", ["wfh", "punch", "attendance", "mark"]),
    ],
  },
  {
    id: "kb-it",
    title: "IT Acceptable Use Policy",
    category: "IT",
    version: "v3.1",
    owner: "Rohan Mehta",
    pages: 9,
    chunks: 33,
    status: "indexed",
    updatedOn: "2026-03-20",
    indexedOn: "2026-03-20",
    audience: "All employees",
    passages: [
      p("it-2.3", "§2.3 Company devices", 3, "Company laptops must be encrypted, locked when unattended, and returned on the last working day. Loss must be reported to IT within 24 hours.", ["laptop", "device", "lost", "loss", "return", "asset", "stolen"]),
      p("it-4.1", "§4.1 Software", 6, "Only software from the approved catalogue may be installed. Requests for other software are raised as an IT helpdesk ticket and reviewed within 2 working days.", ["software", "install", "licence", "license", "application"]),
    ],
  },
  {
    id: "kb-handbook",
    title: "Employee Handbook 2026",
    category: "Handbook",
    version: "2026.1",
    owner: "Priya Menon",
    pages: 64,
    chunks: 241,
    status: "indexed",
    updatedOn: "2026-02-15",
    indexedOn: "2026-02-15",
    audience: "All employees",
    passages: [
      p("hb-2.4", "§2.4 Working hours", 9, "Standard working hours are 9 hours a day including a 1-hour break, Monday to Friday. Arrivals later than 10:00 beyond the 15-minute grace are recorded as late.", ["hours", "working hours", "timing", "late", "grace", "shift"]),
      p("hb-6.1", "§6.1 Probation and confirmation", 21, "New joiners serve a probation of 6 months. Confirmation is recorded by HR after the manager's review and is effective from the first of the following month.", ["probation", "confirmation", "confirm", "new joiner"]),
      p("hb-9.3", "§9.3 Health insurance", 37, "Employees, spouse, two children and parents are covered under the group medical policy for ₹5,00,000 per family per year. Parents' cover is optional and premium-shared.", ["insurance", "medical", "health", "mediclaim", "family", "parents", "hospital"]),
    ],
  },
  {
    id: "kb-holidays",
    title: "Holiday Calendar 2026",
    category: "Leave & Time",
    version: "2026",
    owner: "Priya Menon",
    pages: 2,
    chunks: 6,
    status: "indexed",
    updatedOn: "2025-12-12",
    indexedOn: "2025-12-12",
    audience: "India branches",
    passages: [
      p("hol-1", "India calendar", 1, "India branches observe 10 gazetted holidays in 2026 plus up to 2 optional holidays chosen from the restricted list (Makar Sankranti, Ugadi, Dr. Ambedkar Jayanti, Deepavali second day).", ["holiday", "holidays", "optional", "restricted", "festival", "calendar"]),
    ],
  },
  {
    id: "kb-gratuity",
    title: "Gratuity & PF FAQ",
    category: "Payroll",
    version: "v1.2",
    owner: "Rahul Desai",
    pages: 7,
    chunks: 24,
    status: "indexed",
    updatedOn: "2026-05-05",
    indexedOn: "2026-05-05",
    audience: "India employees",
    passages: [
      p("gpf-1", "Q1 Gratuity eligibility", 1, "Gratuity is payable on exit after 5 years of continuous service, at 15 days' last drawn basic for every completed year, capped at ₹20,00,000 under the Payment of Gratuity Act.", ["gratuity", "5 years", "exit", "eligibility"]),
      p("gpf-3", "Q3 PF contribution", 2, "Both employee and employer contribute 12% of basic to the Provident Fund, capped at a wage ceiling of ₹15,000 (₹1,800 a month) unless the employee opts in to contribute on full basic.", ["pf", "provident", "epf", "uan", "contribution", "12%"]),
      p("gpf-5", "Q5 PF withdrawal", 3, "PF withdrawal and transfer are done on the EPFO member portal using your UAN. HR does not process withdrawals but can verify your KYC on request.", ["pf", "withdraw", "withdrawal", "transfer", "uan", "epfo"]),
    ],
  },
  {
    id: "kb-relocation",
    title: "Relocation Assistance Guideline",
    category: "Benefits",
    version: "v1.0",
    owner: "Lakshmi Pillai",
    pages: 5,
    chunks: 0,
    status: "indexing",
    updatedOn: "2026-09-15",
    indexedOn: null,
    audience: "Transferees and new joiners",
    passages: [],
  },
  {
    id: "kb-esop",
    title: "ESOP Plan 2024 (scanned)",
    category: "Benefits",
    version: "v1.0",
    owner: "Arjun Kapoor",
    pages: 31,
    chunks: 0,
    status: "failed",
    failReason: "Scanned PDF without a text layer — OCR confidence 41% is below the 80% threshold. Upload a searchable PDF.",
    updatedOn: "2026-09-02",
    indexedOn: null,
    audience: "ESOP grantees",
    passages: [],
  },
];

export const KB_STATS = {
  documents: KB_DOCUMENTS.length,
  indexed: KB_DOCUMENTS.filter((d) => d.status === "indexed").length,
  chunks: KB_DOCUMENTS.reduce((a, d) => a + d.chunks, 0),
  questions30d: 1846,
  answeredPct: 91.4,
  deflectedTickets: 312,
};

export const KB_TOP_QUESTIONS = [
  { question: "How many earned leaves carry forward?", count: 214, doc: "Leave Policy" },
  { question: "What is the hotel limit in Mumbai?", count: 167, doc: "Travel & Expense Policy" },
  { question: "When is the next holiday?", count: 158, doc: "Holiday Calendar 2026" },
  { question: "How many WFH days am I allowed?", count: 131, doc: "Work From Home Policy" },
  { question: "What is my notice period?", count: 118, doc: "Code of Conduct" },
  { question: "Are parents covered in health insurance?", count: 96, doc: "Employee Handbook 2026" },
  { question: "When do I become eligible for gratuity?", count: 74, doc: "Gratuity & PF FAQ" },
];

export const KB_UNANSWERED = [
  { question: "Is there a sabbatical policy?", count: 23, suggestion: "No document covers sabbaticals — add a section to the Leave Policy." },
  { question: "How does the ESOP vesting schedule work?", count: 19, suggestion: "ESOP Plan 2024 failed to index — re-upload a searchable PDF." },
  { question: "Can I claim a standing desk for home?", count: 14, suggestion: "WFH Policy §3 covers internet only — clarify equipment reimbursement." },
  { question: "What is the relocation allowance for Pune?", count: 11, suggestion: "Relocation guideline is still indexing — re-check after it completes." },
  { question: "Do interns get Casual Leave?", count: 8, suggestion: "Leave Policy is silent on interns — add an applicability table." },
];

export const KB_DEFLECTION_TREND = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"].map((m, i) => ({
  month: `${m} 26`,
  deflected: [188, 214, 243, 266, 291, 312][i],
  raised: [142, 131, 126, 118, 109, 101][i],
}));

/* --------------------------------------------------------- retrieval */

export interface KbHit {
  doc: KbDocument;
  passage: KbPassage;
  score: number;
}

const STOP = new Set(["the", "a", "an", "is", "are", "what", "how", "many", "much", "can", "i", "my", "do", "does", "for", "of", "to", "in", "on", "me", "we", "our", "there", "any", "policy", "about", "tell", "and", "or", "with", "it", "be", "if", "when", "per"]);

/**
 * Deterministic keyword retriever. A passage scores one point per matched term
 * (multi-word terms score double). Only indexed documents are searched.
 */
export function searchKnowledge(question: string, limit = 3): KbHit[] {
  const q = ` ${question.toLowerCase().replace(/[^a-z0-9₹% ]+/g, " ")} `;
  const words = q.split(/\s+/).filter((w) => w && !STOP.has(w));
  const hits: KbHit[] = [];
  for (const doc of KB_DOCUMENTS) {
    if (doc.status !== "indexed") continue;
    for (const passage of doc.passages) {
      let score = 0;
      for (const t of passage.terms) {
        if (t.includes(" ")) {
          if (q.includes(` ${t} `) || q.includes(t)) score += 2;
        } else if (words.includes(t) || words.some((w) => w.length > 4 && t.length > 4 && (w.startsWith(t) || t.startsWith(w)))) {
          score += 1;
        }
      }
      if (score > 0) hits.push({ doc, passage, score });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Confidence for a retrieval result — 0..100, shown beside every policy answer. */
export function kbConfidence(hits: KbHit[]): number {
  if (!hits.length) return 0;
  const top = hits[0].score;
  return Math.min(96, 52 + top * 14 + (hits.length > 1 ? 4 : 0));
}

/* ==========================================================================
   2 · ATTRITION RISK
   ========================================================================== */

export type RiskBand = "High" | "Medium" | "Low";

export interface RiskDriver {
  label: string;
  weight: number;
  detail: string;
}

export interface AttritionRiskRow {
  code: string;
  name: string;
  designation: string;
  departmentId: string;
  department: string;
  branchId: string;
  branch: string;
  managerCode: string | null;
  tenureMonths: number;
  score: number;
  band: RiskBand;
  drivers: RiskDriver[];
  /** Movement vs last month's score. */
  trend: number;
}

function gradeMid(gradeId: string) {
  const g = GRADES.find((x) => x.id === gradeId);
  return g ? (g.minCtc + g.maxCtc) / 2 : 0;
}

function riskFor(e: Employee): AttritionRiskRow {
  const seed = mulberry32(Number(e.code.replace(/\D/g, "")) * 7919 + 13);
  const tenureMonths = differenceInMonths(TODAY, parseISO(e.joiningDate));
  const drivers: RiskDriver[] = [];

  const sinceIncrement = Math.min(tenureMonths, randInt(seed, 5, 30));
  if (sinceIncrement >= 18) {
    drivers.push({ label: `No increment in ${sinceIncrement} months`, weight: 18 + (sinceIncrement - 18), detail: `Last revision ${format(subMonths(TODAY, sinceIncrement), "MMM yyyy")}; peers in grade ${e.gradeId} were revised within 12 months.` });
  }

  const mid = gradeMid(e.gradeId);
  const compa = mid ? e.ctc / mid : 1;
  if (compa < 0.9) {
    const below = Math.round((1 - compa) * 100);
    drivers.push({ label: `Pay ${below}% below grade midpoint`, weight: 10 + below, detail: `CTC is ${Math.round(compa * 100)}% of the ${e.gradeId} midpoint.` });
  }

  const mgrChanges = seed() < 0.18 ? 2 : seed() < 0.3 ? 1 : 0;
  if (mgrChanges === 2) {
    drivers.push({ label: "Manager changed twice in 12 months", weight: 16, detail: "Two reporting-line changes since Oct 2025 (re-org of the team)." });
  }

  if (seed() < 0.22) {
    drivers.push({ label: "Leave pattern: Mon/Fri spikes", weight: 12, detail: "5 of the last 7 single-day leaves were adjacent to a weekend." });
  }

  if (seed() < 0.2) {
    drivers.push({ label: "Rating dropped 4 → 3", weight: 14, detail: "FY 2025-26 rating 3 after 4 the previous cycle." });
  }

  if (tenureMonths >= 18 && tenureMonths <= 36) {
    drivers.push({ label: "Tenure in the 18–36 month exit window", weight: 9, detail: `${tenureMonths} months of service — the band where 41% of voluntary exits happened last year.` });
  }

  if (seed() < 0.15) {
    drivers.push({ label: "Overtime 3 of the last 4 weeks", weight: 10, detail: "Average 10.4 h days over the last 30 days." });
  }

  if (e.status === "notice") {
    drivers.unshift({ label: "Resignation on record", weight: 40, detail: "Serving notice — included for completeness, not a prediction." });
  }

  drivers.sort((a, b) => b.weight - a.weight);
  const raw = 6 + drivers.reduce((a, d) => a + d.weight, 0) * 0.84 + randInt(seed, 0, 6);
  const score = Math.max(4, Math.min(96, Math.round(raw)));
  const band: RiskBand = score >= 70 ? "High" : score >= 40 ? "Medium" : "Low";
  return {
    code: e.code,
    name: e.name,
    designation: e.designation,
    departmentId: e.departmentId,
    department: deptName(e.departmentId),
    branchId: e.branchId,
    branch: branchById(e.branchId)?.city ?? e.branchId,
    managerCode: e.managerCode,
    tenureMonths,
    score,
    band,
    drivers: drivers.slice(0, 3),
    trend: randInt(seed, -6, 9),
  };
}

export const ATTRITION_RISK: AttritionRiskRow[] = EMPLOYEES.filter(
  (e) => e.status !== "exited" && e.level > 0,
)
  .map(riskFor)
  .sort((a, b) => b.score - a.score);

export const riskForCode = (code: string) => ATTRITION_RISK.find((r) => r.code === code);

/* ==========================================================================
   3 · ANOMALIES
   ========================================================================== */

export type AnomalySeverity = "High" | "Medium" | "Low";
export type AnomalyKind = "Payroll variance" | "Attendance" | "Expense" | "Overtime";

export interface Anomaly {
  id: string;
  kind: AnomalyKind;
  severity: AnomalySeverity;
  title: string;
  subject: string;
  subjectCode: string | null;
  evidence: string[];
  suggestedAction: string;
  detectedOn: string;
  href: string;
  /** Menu key that can see this anomaly. */
  audience: "payroll" | "time" | "expense";
  confidence: number;
}

function buildAnomalies(): Anomaly[] {
  const out: Anomaly[] = [];

  /* payroll — largest per-employee net movements, computed from the two runs */
  const cur = new Map(payRunRows(CURRENT_PERIOD.runId).map((r) => [r.employeeCode, r]));
  const prev = payRunRows(PREVIOUS_PERIOD.runId);
  const moves = prev
    .map((r) => {
      const c = cur.get(r.employeeCode);
      // Rows already raised as pay-run exceptions are handled there, not here.
      if (!c || r.net <= 0 || c.net <= 0 || c.exceptionType || r.exceptionType) return null;
      return { row: c, prevLop: r.lopDays, before: r.net, after: c.net, pct: ((c.net - r.net) / r.net) * 100 };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null && Math.abs(x.pct) >= 5)
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
    .slice(0, 3);
  moves.forEach((m, i) => {
    out.push({
      id: `an-pay-${i}`,
      kind: "Payroll variance",
      severity: Math.abs(m.pct) >= 20 ? "High" : "Medium",
      title: `Net pay ${m.pct < 0 ? "down" : "up"} ${Math.abs(m.pct).toFixed(1)}% vs ${PREVIOUS_PERIOD.shortLabel}`,
      subject: m.row.name,
      subjectCode: m.row.employeeCode,
      evidence: [
        `${PREVIOUS_PERIOD.shortLabel} net ₹${Math.round(m.before).toLocaleString("en-IN")} → ${CURRENT_PERIOD.shortLabel} ₹${Math.round(m.after).toLocaleString("en-IN")}`,
        m.row.lopDays > 0
          ? `${m.row.lopDays} LOP day(s) in ${CURRENT_PERIOD.shortLabel} vs ${m.prevLop} in ${PREVIOUS_PERIOD.shortLabel}`
          : m.prevLop > 0
            ? `${m.prevLop} LOP day(s) in ${PREVIOUS_PERIOD.shortLabel}, none in ${CURRENT_PERIOD.shortLabel}`
            : "No change in LOP — the movement is in one-time components (arrears, bonus or recoveries)",
        `${m.row.department} · ${m.row.branch}`,
      ],
      suggestedAction:
        m.row.lopDays > 0
          ? "Confirm the LOP days with attendance before locking the run."
          : m.prevLop > 0
            ? "Expected rebound after last month's LOP — confirm no LOP reversal is also paid as arrears."
            : "Review component-level changes on the payslip trace before locking.",
      detectedOn: DEMO_TODAY,
      href: "/payroll/runs",
      audience: "payroll",
      confidence: 92,
    });
  });

  /* attendance — buddy punch and impossible travel */
  const blr = EMPLOYEES.filter((e) => e.branchId === "BLR" && e.status === "active" && e.level === 3);
  const a1 = blr[11];
  const a2 = blr[12];
  if (a1 && a2) {
    out.push({
      id: "an-att-buddy",
      kind: "Attendance",
      severity: "High",
      title: "Possible buddy punching",
      subject: `${a1.name} & ${a2.name}`,
      subjectCode: a1.code,
      evidence: [
        "Punch-ins within 40 seconds of each other on the same biometric device on 7 of the last 10 working days",
        `${a2.name}'s laptop first came online 52 minutes after the recorded punch-in on 5 of those days`,
        "Both on Bengaluru Tower B entrance reader BIO-BLR-02",
      ],
      suggestedAction: "Ask the reporting manager to verify; do not take disciplinary action on this signal alone.",
      detectedOn: "2026-09-15",
      href: "/attendance/team",
      audience: "time",
      confidence: 74,
    });
  }
  const pnq = EMPLOYEES.find((e) => e.branchId === "PNQ" && e.workMode === "Hybrid" && e.status === "active" && e.level === 3);
  if (pnq) {
    out.push({
      id: "an-att-geo",
      kind: "Attendance",
      severity: "Medium",
      title: "Impossible travel between punches",
      subject: pnq.name,
      subjectCode: pnq.code,
      evidence: [
        "Mobile GPS punch-in at Pune (Hinjewadi) 09:12 on 14 Sep",
        "Mobile GPS punch-out at Bengaluru (Whitefield) 09:34 the same day — 735 km in 22 minutes",
        "Device ID changed between the two punches",
      ],
      suggestedAction: "Request a regularisation with the correct location, and re-register the device.",
      detectedOn: "2026-09-14",
      href: "/attendance/amendments",
      audience: "time",
      confidence: 88,
    });
  }

  /* expense — identical amount + category lines by the same claimant */
  const seen = new Map<string, { claimNo: string; date: string }>();
  let dup: { claim: (typeof EXPENSE_CLAIMS)[number]; other: string; amount: number; category: string; date: string } | null = null;
  for (const c of EXPENSE_CLAIMS) {
    for (const l of c.lines) {
      const key = `${c.employeeCode}|${l.category}|${l.amount}`;
      const hit = seen.get(key);
      if (hit && hit.claimNo !== c.claimNo) {
        dup = { claim: c, other: hit.claimNo, amount: l.amount, category: l.category, date: l.date };
        break;
      }
      seen.set(key, { claimNo: c.claimNo, date: l.date });
    }
    if (dup) break;
  }
  const dupClaim = dup?.claim ?? EXPENSE_CLAIMS[0];
  if (dupClaim) {
    out.push({
      id: "an-exp-dup",
      kind: "Expense",
      severity: "High",
      title: "Duplicate receipt across two claims",
      subject: dupClaim.employeeName,
      subjectCode: dupClaim.employeeCode,
      evidence: dup
        ? [
            `${dup.category} line of ₹${dup.amount.toLocaleString("en-IN")} appears in ${dup.other} and ${dup.claim.claimNo}`,
            "Receipt image hash similarity 97% (same merchant, same invoice number)",
            `Line date ${format(parseISO(dup.date), "dd MMM yyyy")}`,
          ]
        : [`Receipt in ${dupClaim.claimNo} matches an earlier reimbursed claim`, "Receipt image hash similarity 97%"],
      suggestedAction: "Hold the later line and ask the claimant to confirm; reimbursed amount is unaffected until then.",
      detectedOn: "2026-09-13",
      href: "/expenses",
      audience: "expense",
      confidence: 97,
    });
  }

  /* overtime — top of the 30-day overtime report */
  const ot = [...OVERTIME_REPORT_30D].sort((a, b) => b.otHours - a.otHours)[0];
  if (ot) {
    out.push({
      id: "an-ot-1",
      kind: "Overtime",
      severity: ot.otHours > 30 ? "High" : "Medium",
      title: "Sustained overtime above policy",
      subject: ot.name,
      subjectCode: ot.code,
      evidence: [
        `${ot.otHours} overtime hours across ${ot.otDays} days in the last 30 days`,
        `Average ${ot.avgDailyHours} h per day against a 9 h shift`,
        `${ot.department} · ${ot.branch}`,
      ],
      suggestedAction: "Discuss workload with the manager; overtime above 50 h a quarter needs a Factories Act register entry.",
      detectedOn: DEMO_TODAY,
      href: "/attendance/reports",
      audience: "time",
      confidence: 99,
    });
  }

  const sev = { High: 0, Medium: 1, Low: 2 };
  return out.sort((a, b) => sev[a.severity] - sev[b.severity]);
}

export const ANOMALIES: Anomaly[] = buildAnomalies();

/* ==========================================================================
   4 · WORKFORCE FORECAST
   ========================================================================== */

export interface ForecastPoint extends Record<string, string | number> {
  month: string;
  actual: number;
  forecast: number;
  low: number;
  high: number;
}

const monthlyAttrition = ATTRITION.rate / 100 / 12;
const openPositions = REQUISITIONS.filter((r) => r.status === "open").reduce((a, r) => a + (r.headcount - r.filled), 0);

let forecastLeavers = 0;

export const HEADCOUNT_FORECAST: ForecastPoint[] = (() => {
  const last = HEADCOUNT_12M[HEADCOUNT_12M.length - 1];
  const history: ForecastPoint[] = HEADCOUNT_12M.slice(-6).map((p) => ({
    month: p.month,
    actual: p.headcount,
    forecast: p.headcount,
    low: p.headcount,
    high: p.headcount,
  }));
  let hc = last.headcount;
  const fills = Math.ceil(openPositions / 6);
  const future: ForecastPoint[] = Array.from({ length: 6 }, (_, i) => {
    const leavers = Math.round(hc * monthlyAttrition);
    forecastLeavers += leavers;
    hc = hc + fills - leavers;
    const spread = Math.round(hc * 0.012 * (i + 1));
    return {
      month: format(addMonths(parseISO(`${last.monthIso}-01`.slice(0, 10)), i + 1), "MMM yy"),
      actual: 0,
      forecast: hc,
      low: hc - spread,
      high: hc + Math.round(spread * 0.6),
    };
  });
  return [...history, ...future];
})();

export const PAYROLL_FORECAST: ForecastPoint[] = (() => {
  const hist = PAYROLL_COST_TREND.slice(-6);
  const last = hist[hist.length - 1];
  const out: ForecastPoint[] = hist.map((p) => ({ month: p.month, actual: p.ctc, forecast: p.ctc, low: p.ctc, high: p.ctc }));
  const hcLast = HEADCOUNT_FORECAST[5].forecast;
  for (let i = 0; i < 6; i++) {
    const hc = HEADCOUNT_FORECAST[6 + i].forecast;
    // Cost follows headcount at today's average cost per head; no revision falls in this window.
    const v = Math.round((last.ctc * (hc / hcLast)) / 1000) * 1000;
    const spread = Math.round(v * 0.015 * (i + 1));
    out.push({ month: HEADCOUNT_FORECAST[6 + i].month, actual: 0, forecast: v, low: v - spread, high: v + spread });
  }
  return out;
})();

/** Totals behind the headcount forecast, for the narrative above the charts. */
export const FORECAST_SUMMARY = { leavers6m: forecastLeavers, openPositions };

export const HIRING_NEEDS = DEPARTMENTS.map((d) => {
  const open = REQUISITIONS.filter((r) => r.status === "open" && r.departmentId === d.id).reduce((a, r) => a + (r.headcount - r.filled), 0);
  const backfill = Math.round(d.headcount * monthlyAttrition * 6);
  return { department: d.name, open, backfill, total: open + backfill };
})
  .filter((r) => r.total > 0)
  .sort((a, b) => b.total - a.total);

export const FORECAST_ASSUMPTIONS = [
  `Monthly attrition of ${(monthlyAttrition * 100).toFixed(2)}% — the trailing 12-month rate (${ATTRITION.rate}%) ÷ 12`,
  `${openPositions} open requisition positions filled evenly over 6 months`,
  "No salary revisions inside the window — the next merit cycle is April 2027",
  "No change in statutory rates (PF, ESI, PT)",
];

/* ==========================================================================
   5 · ENGAGEMENT SIGNALS
   ========================================================================== */

export const PULSE_TREND = ["Oct 25", "Nov 25", "Dec 25", "Jan 26", "Feb 26", "Mar 26", "Apr 26", "May 26", "Jun 26", "Jul 26", "Aug 26", "Sep 26"].map(
  (month, i) => ({
    month,
    sentiment: [68, 70, 72, 71, 69, 66, 64, 67, 70, 72, 71, 73][i],
    participation: [71, 74, 69, 78, 76, 72, 81, 79, 77, 80, 82, 84][i],
  }),
);

export const PULSE_THEMES = [
  { theme: "Manager support", mentions: 214, sentiment: 0.62, trend: "up" as const, quote: "My manager unblocks me fast and gives credit publicly." },
  { theme: "Learning & growth", mentions: 176, sentiment: 0.31, trend: "up" as const, quote: "The new L&D budget is great — would like more time to use it." },
  { theme: "Compensation", mentions: 158, sentiment: -0.38, trend: "down" as const, quote: "Increment cycle felt opaque this year." },
  { theme: "Workload", mentions: 133, sentiment: -0.27, trend: "flat" as const, quote: "Release weeks are heavy; we need better planning." },
  { theme: "Hybrid / WFH", mentions: 97, sentiment: 0.44, trend: "flat" as const, quote: "Two WFH days is the right balance." },
  { theme: "Facilities & commute", mentions: 64, sentiment: -0.12, trend: "down" as const, quote: "Whitefield traffic adds two hours a day." },
];

export const PULSE_BY_DEPT = DEPARTMENTS.map((d, i) => ({
  department: d.name,
  score: [71, 76, 79, 64, 74, 66, 72, 81, 69][i],
}));

/* ==========================================================================
   6 · AI SETTINGS, USAGE, AUDIT, EVALUATION
   ========================================================================== */

export type AiFeatureId =
  | "copilot"
  | "policy_qa"
  | "helpdesk_ai"
  | "recruitment_ai"
  | "drafting"
  | "analytics_qa"
  | "attrition"
  | "anomaly"
  | "receipt_ocr";

export interface AiFeature {
  id: AiFeatureId;
  label: string;
  description: string;
  enabled: boolean;
  /** Persona role ids the capability is switched on for. */
  roles: string[];
  writes: boolean;
}

export const AI_ROLE_COLUMNS: { id: string; short: string; label: string }[] = [
  { id: "employee", short: "E", label: "Employee" },
  { id: "manager", short: "M", label: "Manager" },
  { id: "hr_admin", short: "H", label: "HR Admin" },
  { id: "payroll_admin", short: "P", label: "Payroll Admin" },
  { id: "recruiter", short: "R", label: "Recruiter" },
  { id: "finance_controller", short: "F", label: "Finance Controller" },
  { id: "department_head", short: "D", label: "Department Head" },
  { id: "helpdesk_agent", short: "K", label: "HR Ops Agent" },
  { id: "it_admin", short: "I", label: "IT & Asset Admin" },
  { id: "auditor", short: "A", label: "Auditor" },
];

const ALL_ROLES = AI_ROLE_COLUMNS.map((r) => r.id);

export const AI_FEATURES: AiFeature[] = [
  { id: "copilot", label: "AI Copilot", description: "Conversational assistant across modules, scoped to the asker's permissions.", enabled: true, roles: ALL_ROLES.filter((r) => r !== "auditor"), writes: true },
  { id: "policy_qa", label: "Policy Q&A", description: "Answers from indexed policy documents with citations.", enabled: true, roles: ALL_ROLES, writes: false },
  { id: "helpdesk_ai", label: "Helpdesk AI", description: "Suggested replies, ticket triage and auto-deflection.", enabled: true, roles: ["hr_admin", "helpdesk_agent", "it_admin"], writes: true },
  { id: "recruitment_ai", label: "Recruitment AI", description: "Resume parsing, shortlist summaries and JD drafting. Human decides every stage move.", enabled: true, roles: ["hr_admin", "recruiter", "manager"], writes: false },
  { id: "drafting", label: "Drafting Studio", description: "Letters, JDs, announcements and review comments.", enabled: true, roles: ["hr_admin", "recruiter", "manager", "helpdesk_agent"], writes: false },
  { id: "analytics_qa", label: "Analytics Q&A", description: "Natural-language questions answered from approved reports only.", enabled: true, roles: ["hr_admin", "manager", "payroll_admin", "finance_controller", "department_head", "auditor"], writes: false },
  { id: "attrition", label: "Attrition insights", description: "Explainable flight-risk scores. Never used for automated decisions.", enabled: true, roles: ["hr_admin", "manager", "department_head"], writes: false },
  { id: "anomaly", label: "Anomaly detection", description: "Payroll variance, attendance integrity, duplicate receipts, overtime.", enabled: true, roles: ["hr_admin", "payroll_admin", "finance_controller", "auditor"], writes: false },
  { id: "receipt_ocr", label: "Receipt OCR", description: "Reads amount, date and merchant from expense receipts.", enabled: false, roles: ["employee", "manager", "finance_controller"], writes: false },
];

export interface AiGuardrail {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  locked?: boolean;
}

export const AI_GUARDRAILS: AiGuardrail[] = [
  { id: "pii_pan", label: "Redact PAN", description: "PAN numbers are masked before any text leaves the tenant boundary.", enabled: true },
  { id: "pii_aadhaar", label: "Redact Aadhaar", description: "Aadhaar numbers are masked; full numbers are never sent to the model.", enabled: true, locked: true },
  { id: "pii_bank", label: "Redact bank account numbers", description: "Only the last 4 digits are ever shown to the model.", enabled: true },
  { id: "pii_salary", label: "Redact salary figures for non-payroll roles", description: "Salary amounts are replaced with bands unless the asker holds a payroll grant.", enabled: true },
  { id: "confirm_write", label: "Confirm before any write", description: "The assistant proposes an action card; nothing is created until the user confirms.", enabled: true, locked: true },
  { id: "human_review", label: "Human review for hiring & performance", description: "AI output on candidates and ratings is advisory and can never move a stage or set a rating.", enabled: true, locked: true },
  { id: "injection", label: "Prompt-injection protection", description: "Instructions inside uploaded documents and tickets are treated as data, never commands.", enabled: true },
  { id: "retention", label: "30-day conversation retention", description: "Chats are purged after 30 days; the audit log is kept for 7 years.", enabled: true },
];

export const AI_PROVIDER = {
  provider: "Configurable (Azure OpenAI · AWS Bedrock · self-hosted)",
  active: "Azure OpenAI — Central India",
  modelTier: "Enterprise · high-accuracy tier",
  region: "India (Pune / Mumbai)",
  noTraining: true,
  contract: "Zero data retention · no training on tenant data · DPA signed 12 Jan 2026",
};

export const AI_QUOTA = {
  tier: "Enterprise",
  monthlyRequests: 60000,
  monthlyTokens: 40_000_000,
};

export const AI_USAGE_BY_MONTH = ["Apr 26", "May 26", "Jun 26", "Jul 26", "Aug 26", "Sep 26"].map((month, i) => {
  const requests = [18240, 22610, 26180, 29940, 33120, 21480][i];
  const tokens = [11.2, 13.9, 16.4, 18.7, 21.1, 13.6][i] * 1_000_000;
  return { month, requests, tokens, cost: Math.round((tokens / 1000) * 0.62) };
});

export const AI_USAGE_BY_FEATURE = [
  { feature: "AI Copilot", requests: 9840, tokens: 6_420_000 },
  { feature: "Policy Q&A", requests: 5210, tokens: 2_980_000 },
  { feature: "Helpdesk AI", requests: 2460, tokens: 1_610_000 },
  { feature: "Drafting Studio", requests: 1320, tokens: 1_480_000 },
  { feature: "Analytics Q&A", requests: 1140, tokens: 520_000 },
  { feature: "Recruitment AI", requests: 860, tokens: 410_000 },
  { feature: "Anomaly detection", requests: 410, tokens: 140_000 },
  { feature: "Attrition insights", requests: 240, tokens: 40_000 },
].map((r) => ({ ...r, cost: Math.round((r.tokens / 1000) * 0.62) }));

export const AI_EVAL = {
  testSetSize: 420,
  accuracy: 94.3,
  accuracyPrev: 92.8,
  citationPrecision: 97.1,
  thumbsUpRate: 88.6,
  deflectionRate: 41.2,
  refusalCorrectness: 99.5,
  lastRun: "2026-09-14",
  byCategory: [
    { category: "Leave", accuracy: 97.8 },
    { category: "Payroll", accuracy: 95.1 },
    { category: "Policy", accuracy: 93.9 },
    { category: "Attendance", accuracy: 94.6 },
    { category: "Expenses", accuracy: 92.4 },
    { category: "Analytics", accuracy: 89.7 },
  ],
};

export interface AiAuditEntry {
  id: string;
  at: string;
  actorCode: string;
  actorName: string;
  role: string;
  feature: string;
  prompt: string;
  tools: string;
  outcome: "answered" | "refused" | "action_confirmed" | "action_declined" | "fallback";
  redactions: number;
}

export const AI_AUDIT_LOG: AiAuditEntry[] = (() => {
  const seed = mulberry32(2207);
  const rows: [string, string, string, string, string, AiAuditEntry["outcome"], number][] = [
    ["STL-0142", "Employee", "AI Copilot", "Apply casual leave next Friday", "Leave balance · Holiday calendar · Leave application", "action_confirmed", 0],
    ["STL-0142", "Employee", "AI Copilot", "What is Karthik's salary?", "Permission check", "refused", 1],
    ["STL-0031", "Reporting Manager", "AI Copilot", "Approve all low-risk requests", "Approvals inbox · Leave balance", "action_confirmed", 0],
    ["STL-0031", "Reporting Manager", "Attrition insights", "Who in my team is at risk?", "Attrition model", "answered", 0],
    ["STL-0009", "HR Admin", "Analytics Q&A", "Attrition in Pune last quarter", "Attrition Analysis report", "answered", 0],
    ["STL-0017", "Payroll Admin", "AI Copilot", "Summarise payroll exceptions", "Pay run · Exceptions", "answered", 3],
    ["STL-0058", "Recruiter", "Drafting Studio", "Offer letter — Senior Backend Engineer", "Offer · Template library", "answered", 2],
    ["STL-0142", "Employee", "Policy Q&A", "How many WFH days am I allowed?", "Knowledge base", "answered", 0],
    ["STL-0144", "Employee", "AI Copilot", "Why is my net pay lower this month?", "Payslip · Pay run", "answered", 0],
    ["STL-0147", "Employee", "AI Copilot", "Regularise my missed punch on 11 Sep", "Attendance · Amendments", "action_declined", 0],
    ["STL-0009", "HR Admin", "AI Copilot", "Onboarding status of new joiners", "Onboarding · Employees", "answered", 0],
    ["STL-0001", "Tenant Owner", "Analytics Q&A", "Overtime cost by department this month", "Late Arrivals & Overtime report", "answered", 0],
    ["STL-0143", "Employee", "AI Copilot", "Write me a poem about Mondays", "—", "fallback", 0],
    ["STL-0146", "Employee", "Policy Q&A", "Is there a sabbatical policy?", "Knowledge base", "fallback", 0],
    ["STL-0058", "Recruiter", "AI Copilot", "Summarise shortlist for REQ-2026-003", "Candidates · Scorecards", "answered", 4],
    ["STL-0009", "HR Admin", "Helpdesk AI", "Suggested reply for HD-2026-0412", "Ticket thread · Knowledge base", "answered", 1],
  ];
  return Array.from({ length: 48 }, (_, i) => {
    const r = rows[i % rows.length];
    const day = 16 - Math.floor(i / 4);
    const hh = 9 + ((i * 3) % 9);
    const mm = randInt(seed, 0, 59);
    return {
      id: `aia-${String(i + 1).padStart(4, "0")}`,
      at: `2026-09-${String(Math.max(1, day)).padStart(2, "0")}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`,
      actorCode: r[0],
      actorName: employeeByCode(r[0])?.name ?? r[0],
      role: r[1],
      feature: r[2],
      prompt: r[3],
      tools: r[4],
      outcome: r[5],
      redactions: r[6],
    };
  });
})();

/* ==========================================================================
   7 · DRAFTING STUDIO TEMPLATES
   ========================================================================== */

export type StudioTemplateId =
  | "offer"
  | "appointment"
  | "experience"
  | "warning"
  | "jd"
  | "announcement"
  | "policy_summary"
  | "review_comment"
  | "rejection"
  | "welcome";

export interface StudioTemplate {
  id: StudioTemplateId;
  label: string;
  description: string;
  subject: "candidate" | "employee" | "none";
  /** Free-text field label shown in the form, e.g. "Key points". */
  noteLabel: string;
  notePlaceholder: string;
}

export const STUDIO_TEMPLATES: StudioTemplate[] = [
  { id: "offer", label: "Offer letter", description: "From an approved offer — CTC, joining date, reporting line.", subject: "candidate", noteLabel: "Special terms", notePlaceholder: "e.g. Joining bonus clawback within 12 months" },
  { id: "appointment", label: "Appointment letter", description: "Issued on joining — terms of employment.", subject: "employee", noteLabel: "Additional clauses", notePlaceholder: "e.g. Probation of 6 months" },
  { id: "experience", label: "Experience letter", description: "Service certificate on exit.", subject: "employee", noteLabel: "Highlights", notePlaceholder: "e.g. Led the payments re-platform" },
  { id: "warning", label: "Warning letter", description: "Formal warning — conduct or attendance.", subject: "employee", noteLabel: "Incident summary", notePlaceholder: "e.g. 6 unregularised absences in August" },
  { id: "jd", label: "Job description", description: "From a requisition — role, responsibilities, must-haves.", subject: "none", noteLabel: "Must-have skills", notePlaceholder: "e.g. Go, Kafka, PostgreSQL" },
  { id: "announcement", label: "Announcement", description: "Company-wide or branch notice.", subject: "none", noteLabel: "What is being announced", notePlaceholder: "e.g. Deepavali holidays on 8–9 Nov" },
  { id: "policy_summary", label: "Policy summary", description: "Plain-language summary of an indexed policy.", subject: "none", noteLabel: "Policy", notePlaceholder: "e.g. Work From Home Policy" },
  { id: "review_comment", label: "Performance review comment", description: "Balanced manager comment from goals and feedback.", subject: "employee", noteLabel: "Observations", notePlaceholder: "e.g. Shipped 3 of 4 goals; mentoring juniors" },
  { id: "rejection", label: "Rejection email", description: "Respectful candidate decline.", subject: "candidate", noteLabel: "Feedback to share", notePlaceholder: "e.g. Strong fundamentals; system design depth" },
  { id: "welcome", label: "Welcome email", description: "Day-one welcome for a new joiner.", subject: "employee", noteLabel: "First-week plan", notePlaceholder: "e.g. Buddy: Karthik Reddy; laptop at desk" },
];

/* ==========================================================================
   8 · COPILOT CONVERSATION HISTORY (seed)
   ========================================================================== */

export interface ConversationSeed {
  id: string;
  title: string;
  at: string;
  firstQuestion: string;
}

export const CONVERSATION_SEEDS: Record<string, ConversationSeed[]> = {
  employee: [
    { id: "cv-e1", title: "Leave balance", at: "2026-09-15T10:12:00", firstQuestion: "What's my leave balance?" },
    { id: "cv-e2", title: "Net pay question", at: "2026-09-12T16:40:00", firstQuestion: "Why is my net pay lower this month?" },
    { id: "cv-e3", title: "WFH eligibility", at: "2026-09-08T11:05:00", firstQuestion: "How many WFH days am I allowed?" },
  ],
  manager: [
    { id: "cv-m1", title: "Pending approvals", at: "2026-09-16T09:20:00", firstQuestion: "Summarise my pending approvals" },
    { id: "cv-m2", title: "Team attrition risk", at: "2026-09-11T15:02:00", firstQuestion: "Who in my team is at risk of leaving?" },
  ],
  hr_admin: [
    { id: "cv-h1", title: "Headcount & attrition", at: "2026-09-16T08:55:00", firstQuestion: "What's our attrition rate this year?" },
    { id: "cv-h2", title: "New joiner onboarding", at: "2026-09-14T12:30:00", firstQuestion: "Onboarding status of new joiners" },
  ],
  payroll_admin: [{ id: "cv-p1", title: "September exceptions", at: "2026-09-16T09:45:00", firstQuestion: "Summarise payroll exceptions" }],
  finance_controller: [{ id: "cv-f1", title: "Payroll exceptions", at: "2026-09-16T10:05:00", firstQuestion: "Summarise payroll exceptions" }],
  recruiter: [
    { id: "cv-r1", title: "Shortlist summary", at: "2026-09-15T17:20:00", firstQuestion: "Summarise the candidate shortlist" },
    { id: "cv-r2", title: "Offer letter draft", at: "2026-09-10T14:15:00", firstQuestion: "Draft an offer letter" },
  ],
  tenant_owner: [{ id: "cv-o1", title: "Headcount", at: "2026-09-16T08:30:00", firstQuestion: "What's our headcount and attrition?" }],
};

/* convenience re-exports used by several AI screens */
export const AI_BRANCH_OPTIONS = BRANCHES.map((b) => ({ value: b.id, label: b.city }));
export const AI_DEPT_OPTIONS = DEPARTMENTS.map((d) => ({ value: d.id, label: d.name }));
