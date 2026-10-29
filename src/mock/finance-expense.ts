import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { round2, sum } from "@/lib/utils";
import { DEMO_TODAY, deptById, deptName } from "./org";
import { EMPLOYEES, employeeByCode, employeeName } from "./employees";
import {
  EXPENSE_CLAIMS,
  EXPENSE_POLICY,
  policyFor,
  type ExpenseCategory,
  type ExpenseClaim,
  type ExpenseLine,
} from "./workplace";

/* ============================================================================
   W5 · Expense approvals, finance review and policy fixtures.

   The base fifty claims come from `@/mock/workplace` untouched. Ten more claims
   (EXP-2026-0051…0060) are filed after that snapshot so that every approver
   persona has a queue, and three of them carry a line that repeats an earlier,
   already-approved receipt of the same employee — the duplicate-detection story.
   ========================================================================== */

/** Approval chain thresholds — the same numbers the policy screen edits. */
export const EXP_DEPT_HEAD_THRESHOLD = 25000;
export const EXP_FINANCE_THRESHOLD = 100000;

const TODAY = parseISO(DEMO_TODAY);
const shift = (isoDate: string, d: number) => format(addDays(parseISO(isoDate), d), "yyyy-MM-dd");

/* ------------------------------------------------------- extra claims */

type LineSeed = [ExpenseCategory, number, string, string];

function makeClaim(
  seq: number,
  code: string,
  purpose: string,
  seeds: LineSeed[],
  status: "submitted" | "approved",
  submittedOn: string,
): ExpenseClaim {
  const claimNo = `EXP-2026-${String(seq).padStart(4, "0")}`;
  const emp = employeeByCode(code)!;
  const approverCode = emp.managerCode ?? "STL-0008";
  const lines: ExpenseLine[] = seeds.map(([category, amount, date, description], i) => {
    const policy = policyFor(category)!;
    const excess = Math.max(0, round2(amount - policy.limit));
    const pdf = (seq + i) % 2 === 0;
    return {
      id: `${claimNo}-L${i + 1}`,
      category,
      date,
      description,
      amount,
      receipt: `${pdf ? "invoice" : "IMG"}_${seq}${i + 1}.${pdf ? "pdf" : "jpg"}`,
      receiptKind: pdf ? "pdf" : "photo",
      limit: policy.limit,
      limitBasis: policy.basis,
      excess,
      violation: excess > 0,
    };
  });
  const violationCount = lines.filter((l) => l.violation).length;
  const dates = lines.map((l) => l.date).sort();
  return {
    id: claimNo,
    claimNo,
    employeeCode: code,
    employeeName: emp.name,
    department: deptName(emp.departmentId),
    purpose,
    periodFrom: dates[0],
    periodTo: dates[dates.length - 1],
    lines,
    total: round2(sum(lines.map((l) => l.amount))),
    status,
    submittedOn: `${submittedOn}T10:15:00`,
    approverCode,
    approverName: employeeName(approverCode),
    decidedOn: status === "approved" ? `${shift(submittedOn, 2)}T16:40:00` : null,
    decisionNote: null,
    reimbursedOn: null,
    violationCount,
    hasViolation: violationCount > 0,
    search: `${claimNo} ${emp.name} ${emp.code} ${purpose}`.toLowerCase(),
  };
}

const SALES = EMPLOYEES.filter((e) => e.departmentId === "SAL" && e.status !== "exited" && e.level === 3);

/** Copies one line of an earlier claim — same category, amount and description, a day later. */
function echo(claimNo: string, category: ExpenseCategory): LineSeed {
  const src = EXPENSE_CLAIMS.find((c) => c.claimNo === claimNo)!.lines.find((l) => l.category === category)!;
  return [category, src.amount, shift(src.date, 1), src.description];
}

const EXTRA_CLAIMS: ExpenseClaim[] = [
  /* Bills for TRV-2026-0001, travelled 08–09 Sep (see TRAVEL_SEEDS in workplace.ts). */
  makeClaim(51, "STL-0142", "Customer QBR travel — Tata Digital, Mumbai", [
    ["Travel – Air", 12480, "2026-09-08", "IndiGo 6E-2134 Bengaluru → Mumbai, customer QBR"],
    ["Travel – Cab", 1860, "2026-09-08", "Ola Prime — Mumbai airport to Bandra Kurla Complex"],
    ["Accommodation", 5900, "2026-09-08", "Lemon Tree Premier, Mumbai — 1 night"],
    ["Meals", 980, "2026-09-09", "Working lunch with the Tata Digital integration team"],
  ], "submitted", "2026-09-12"),
  makeClaim(52, "STL-0144", "Certification reimbursement under the L&D policy", [
    ["Training", 27500, "2026-09-02", "Certified Kubernetes Administrator exam and prep course"],
  ], "submitted", "2026-09-10"),
  makeClaim(53, "STL-0146", "Monthly home-office and connectivity reimbursement", [
    ["Internet & Telecom", 1499, "2026-09-05", "ACT Fibernet broadband — home office, September"],
    ["Office Supplies", 2350, "2026-09-06", "Ergonomic footrest and laptop riser for the home desk"],
  ], "submitted", "2026-09-14"),
  makeClaim(54, "STL-0149", "On-site UAT support — Apollo Retail, Chennai", [
    ["Travel – Air", 9870, "2026-09-01", "IndiGo 6E-777 Bengaluru → Chennai, on-site UAT"],
    ["Accommodation", 7450, "2026-09-01", "Novotel Chennai OMR — 1 night, UAT war-room"],
    ["Meals", 1150, "2026-09-02", "Breakfast and dinner, day two of the on-site"],
    ["Travel – Cab", 2240, "2026-09-03", "Meru — hotel to client office, three trips over two days"],
  ], "submitted", "2026-09-11"),
  makeClaim(55, SALES[0].code, "Client escalation visit — Fincraft, Mumbai", [
    ["Travel – Air", 16200, "2026-09-03", "Air India AI-639 Bengaluru → Mumbai, escalation visit"],
    ["Accommodation", 6300, "2026-09-03", "Trident BKC, Mumbai — 1 night"],
    ["Client Entertainment", 6850, "2026-09-04", "Dinner with Fincraft procurement team, 4 attendees"],
    ["Travel – Cab", 2100, "2026-09-04", "Uber — Bandra Kurla Complex to Mumbai airport"],
  ], "submitted", "2026-09-09"),
  makeClaim(56, SALES[1].code, "Partner summit attendance — Dubai, hosted sponsor booth", [
    ["Travel – Air", 17850, "2026-08-24", "Emirates EK-569 Bengaluru → Dubai, partner summit"],
    ["Travel – Air", 17600, "2026-08-28", "Emirates EK-568 Dubai → Bengaluru, return sector"],
    ["Accommodation", 6400, "2026-08-24", "Novotel World Trade Centre, Dubai — night 1"],
    ["Accommodation", 6400, "2026-08-25", "Novotel World Trade Centre, Dubai — night 2"],
    ["Accommodation", 6400, "2026-08-26", "Novotel World Trade Centre, Dubai — night 3"],
    ["Accommodation", 6400, "2026-08-27", "Novotel World Trade Centre, Dubai — night 4"],
    ["Client Entertainment", 4950, "2026-08-25", "Partner dinner — Gulf distribution channel, 5 attendees"],
    ["Client Entertainment", 4950, "2026-08-26", "Lunch with the Zeta Payments evaluation committee"],
    ["Client Entertainment", 4950, "2026-08-27", "Booth hospitality — summit day two"],
    ["Meals", 1150, "2026-08-24", "Meals, summit day one"],
    ["Meals", 1150, "2026-08-25", "Meals, summit day two"],
    ["Meals", 1150, "2026-08-26", "Meals, summit day three"],
    ["Meals", 1150, "2026-08-27", "Meals, summit day four"],
    ["Training", 24500, "2026-08-20", "Summit delegate pass and partner enablement track"],
  ], "submitted", "2026-09-02"),
  makeClaim(57, SALES[2].code, "Delivery review with the Pune engineering pod", [
    ["Meals", 1100, "2026-09-07", "Meals during the Pune delivery review"],
    ["Travel – Cab", 1950, "2026-09-07", "Uber — Viman Nagar to Hinjewadi, vendor meeting"],
    ["Office Supplies", 1800, "2026-09-08", "Whiteboard markers, sticky notes and A3 pads for the design studio"],
  ], "submitted", "2026-09-13"),
  makeClaim(58, "STL-0148", "Delivery review hotel stay — Mumbai", [
    echo("EXP-2026-0012", "Accommodation"),
    ["Meals", 860, "2026-07-17", "Meals during the delivery review"],
    ["Travel – Cab", 1740, "2026-07-17", "Uber — hotel to client office"],
  ], "approved", "2026-09-05"),
  makeClaim(59, "STL-0014", "Customer QBR travel — Tata Digital, Mumbai", [
    echo("EXP-2026-0017", "Travel – Air"),
    ["Travel – Cab", 1420, "2026-08-08", "Ola Prime — Mumbai airport to Bandra Kurla Complex"],
  ], "approved", "2026-09-06"),
  makeClaim(60, "STL-0036", "Delivery review with the Pune engineering pod", [
    echo("EXP-2026-0039", "Accommodation"),
    ["Meals", 720, "2026-06-15", "Meals during the Pune delivery review"],
  ], "approved", "2026-09-04"),
];

export const EXP_ALL_CLAIMS: ExpenseClaim[] = [...EXPENSE_CLAIMS, ...EXTRA_CLAIMS];

/* -------------------------------------------------- approval queue */

export type ExpApprovalStage = "manager" | "dept_head" | "finance";

export const EXP_STAGE_LABEL: Record<ExpApprovalStage, string> = {
  manager: "Reporting manager",
  dept_head: "Department head",
  finance: "Finance controller",
};

export interface ExpChainStep {
  stage: ExpApprovalStage;
  approver: string;
  state: "done" | "current" | "pending";
}

export interface ExpApprovalItem extends ExpenseClaim {
  stage: ExpApprovalStage;
  chain: ExpChainStep[];
  deptHeadCode: string;
  ageDays: number;
  lineCount: number;
}

/** The stages a claim of this size must clear, in order. */
export function expRequiredStages(total: number, hasViolation = false): ExpApprovalStage[] {
  const out: ExpApprovalStage[] = ["manager"];
  if (total > EXP_DEPT_HEAD_THRESHOLD || hasViolation) out.push("dept_head");
  if (total > EXP_FINANCE_THRESHOLD) out.push("finance");
  return out;
}

const ADVANCED = new Set(["EXP-2026-0055", "EXP-2026-0056"]);

function toApprovalItem(c: ExpenseClaim, index: number): ExpApprovalItem {
  const emp = employeeByCode(c.employeeCode)!;
  const deptHeadCode = deptById(emp.departmentId)?.headEmployeeCode ?? "STL-0001";
  /* A department head who is also the line manager (or the claimant) signs once. */
  const stages = expRequiredStages(c.total, c.hasViolation).filter(
    (s) => s !== "dept_head" || (deptHeadCode !== c.approverCode && deptHeadCode !== c.employeeCode),
  );
  /* Some multi-step claims are part-way through their chain: the last stage is current. */
  const advanced = ADVANCED.has(c.claimNo) || (c.employeeCode !== "STL-0031" && index % 3 === 0);
  const currentIdx = stages.length > 1 && advanced ? stages.length - 1 : 0;
  const approverFor = (s: ExpApprovalStage) =>
    s === "manager" ? c.approverName : s === "dept_head" ? employeeName(deptHeadCode) : employeeName("STL-0008");
  return {
    ...c,
    stage: stages[currentIdx],
    chain: stages.map((s, i) => ({
      stage: s,
      approver: approverFor(s),
      state: i < currentIdx ? "done" : i === currentIdx ? "current" : "pending",
    })),
    deptHeadCode,
    ageDays: c.submittedOn ? Math.max(0, differenceInCalendarDays(TODAY, parseISO(c.submittedOn))) : 0,
    lineCount: c.lines.length,
  };
}

export const EXP_APPROVAL_QUEUE: ExpApprovalItem[] = EXP_ALL_CLAIMS.filter((c) => c.status === "submitted").map(
  toApprovalItem,
);

/* -------------------------------------------------- finance review */

export type ExpFinanceStatus = "pending" | "verified" | "queried" | "on_hold" | "released_payroll" | "released_direct";

export interface ExpPayoutBatch {
  id: string;
  label: string;
  mode: "payroll" | "direct";
  payDate: string;
  reference: string;
}

/** Released claims land in one of these. Payroll releases ride the October run. */
export const EXP_PAYOUT_BATCHES: ExpPayoutBatch[] = [
  {
    id: "PB-2026-10-PAY",
    label: "October 2026 payroll",
    mode: "payroll",
    payDate: "2026-10-31",
    reference: "Non-taxable reimbursement earning on run PR-2026-10",
  },
  {
    id: "PB-2026-09-N2",
    label: "NEFT batch · 18 Sep 2026",
    mode: "direct",
    payDate: "2026-09-18",
    reference: "HDFC/EXP/2026/0918",
  },
];

export const EXP_BATCH_FOR_MODE = { payroll: "PB-2026-10-PAY", direct: "PB-2026-09-N2" } as const;

export interface ExpFinanceRow {
  id: string;
  claimNo: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  purpose: string;
  total: number;
  lineCount: number;
  violationCount: number;
  approvedOn: string;
  approvedBy: string;
  status: ExpFinanceStatus;
  batchId: string | null;
  note: string | null;
  claim: ExpenseClaim;
}

const QUERY_NOTES = [
  "Hotel folio does not show the company GSTIN — please upload the tax invoice so input credit can be claimed.",
  "Cab receipts are screenshots without trip IDs. Attach the e-receipts from the app.",
  "Training invoice is addressed to the employee, not to Stellar. Ask the vendor to reissue.",
  "Client entertainment line has no attendee list. Add names and companies.",
];

export const EXP_FINANCE_QUEUE: ExpFinanceRow[] = EXP_ALL_CLAIMS.filter((c) => c.status === "approved").map((c, i) => {
  const extra = Number(c.claimNo.slice(-4)) > 50;
  const slot = extra ? 4 : i % 6;
  const status: ExpFinanceStatus =
    slot === 0
      ? "verified"
      : slot === 1
        ? "released_payroll"
        : slot === 2
          ? "released_direct"
          : slot === 3
            ? "queried"
            : "pending";
  return {
    id: c.claimNo,
    claimNo: c.claimNo,
    employeeCode: c.employeeCode,
    employeeName: c.employeeName,
    department: c.department,
    purpose: c.purpose,
    total: c.total,
    lineCount: c.lines.length,
    violationCount: c.violationCount,
    approvedOn: (c.decidedOn ?? c.submittedOn ?? DEMO_TODAY).slice(0, 10),
    approvedBy: c.approverName,
    status,
    batchId:
      status === "released_payroll"
        ? EXP_BATCH_FOR_MODE.payroll
        : status === "released_direct"
          ? EXP_BATCH_FOR_MODE.direct
          : null,
    note: status === "queried" ? QUERY_NOTES[i % QUERY_NOTES.length] : null,
    claim: c,
  };
});

/* -------------------------------------------- AI duplicate detection */

export interface ExpDuplicateFlag {
  claimNo: string;
  lineId: string;
  duplicateOf: string;
  duplicateLineId: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  originalDate: string;
  originalStatus: string;
  confidence: number;
  signals: string[];
}

const DUP_PAIRS: [string, string, number][] = [
  ["EXP-2026-0058", "EXP-2026-0012", 94],
  ["EXP-2026-0059", "EXP-2026-0017", 91],
  ["EXP-2026-0060", "EXP-2026-0039", 87],
];

export const EXP_DUPLICATE_FLAGS: ExpDuplicateFlag[] = DUP_PAIRS.map(([claimNo, ofNo, confidence]) => {
  const claim = EXP_ALL_CLAIMS.find((c) => c.claimNo === claimNo)!;
  const original = EXP_ALL_CLAIMS.find((c) => c.claimNo === ofNo)!;
  const line = claim.lines[0];
  const src = original.lines.find((l) => l.category === line.category && l.amount === line.amount)!;
  const gap = Math.abs(differenceInCalendarDays(parseISO(line.date), parseISO(src.date)));
  return {
    claimNo,
    lineId: line.id,
    duplicateOf: ofNo,
    duplicateLineId: src.id,
    category: line.category,
    amount: line.amount,
    date: line.date,
    originalDate: src.date,
    originalStatus: original.status,
    confidence,
    signals: [
      "Same employee",
      "Same amount",
      `Same category (${line.category})`,
      `${gap} day${gap === 1 ? "" : "s"} apart`,
      "Identical merchant description",
    ],
  };
});

export const expDuplicateFor = (claimNo: string) => EXP_DUPLICATE_FLAGS.find((d) => d.claimNo === claimNo);

/* ---------------------------------------------------------- policies */

export type ExpGradeBand = "G1–G2" | "G3–G4" | "G5+";
export const EXP_GRADE_BANDS: ExpGradeBand[] = ["G1–G2", "G3–G4", "G5+"];

export interface ExpPolicyLimit {
  id: string;
  category: string;
  basis: string;
  /** City tier changes the cap only for stay, meals and local cabs. */
  tiered: boolean;
  limits: Record<ExpGradeBand, { metro: number; nonMetro: number }>;
  /** Receipt is mandatory above this amount; 0 = always. */
  receiptAbove: number;
  preApproval: boolean;
  updatedOn: string;
  updatedBy: string;
}

const TIERED = new Set<string>(["Accommodation", "Meals", "Travel – Cab"]);
const BAND_FACTOR: Record<ExpGradeBand, number> = { "G1–G2": 0.8, "G3–G4": 1, "G5+": 1.4 };
const RECEIPT_ABOVE: Record<string, number> = { Meals: 500, "Travel – Cab": 300 };
const round100 = (n: number) => Math.round(n / 100) * 100;

export const EXP_POLICY_LIMITS: ExpPolicyLimit[] = EXPENSE_POLICY.map((p, i) => {
  const tiered = TIERED.has(p.category);
  const limits = Object.fromEntries(
    EXP_GRADE_BANDS.map((b) => {
      const metro = round100(p.limit * BAND_FACTOR[b]);
      return [b, { metro, nonMetro: tiered ? round100(metro * 0.75) : metro }];
    }),
  ) as ExpPolicyLimit["limits"];
  return {
    id: `POL-${String(i + 1).padStart(2, "0")}`,
    category: p.category,
    basis: p.basis,
    tiered,
    limits,
    receiptAbove: RECEIPT_ABOVE[p.category] ?? 0,
    preApproval: p.category === "Training" || p.category === "Travel – Air",
    updatedOn: "2026-04-01",
    updatedBy: "Lakshmi Pillai",
  };
});

export interface ExpPerDiem {
  id: string;
  tier: "Metro" | "Non-metro" | "International";
  cities: string;
  currency: "INR" | "USD";
  rates: Record<ExpGradeBand, number>;
  incidentals: number;
}

export const EXP_PER_DIEM: ExpPerDiem[] = [
  {
    id: "PD-METRO",
    tier: "Metro",
    cities: "Mumbai, Delhi NCR, Bengaluru, Chennai, Kolkata, Hyderabad, Pune",
    currency: "INR",
    rates: { "G1–G2": 1200, "G3–G4": 1500, "G5+": 2200 },
    incidentals: 300,
  },
  {
    id: "PD-NONMETRO",
    tier: "Non-metro",
    cities: "All other Indian cities (Tier 2 and Tier 3)",
    currency: "INR",
    rates: { "G1–G2": 900, "G3–G4": 1100, "G5+": 1600 },
    incidentals: 200,
  },
  {
    id: "PD-INTL",
    tier: "International",
    cities: "Outside India — paid in USD at the RBI reference rate on the travel date",
    currency: "USD",
    rates: { "G1–G2": 60, "G3–G4": 75, "G5+": 100 },
    incidentals: 20,
  },
];

export interface ExpApprovalRule {
  id: string;
  order: number;
  condition: string;
  kind: "always" | "amount" | "violation" | "category";
  threshold: number | null;
  approver: string;
  slaHours: number;
  active: boolean;
}

export const EXP_APPROVAL_RULES: ExpApprovalRule[] = [
  { id: "R1", order: 1, condition: "Every claim", kind: "always", threshold: null, approver: "Reporting manager", slaHours: 48, active: true },
  { id: "R2", order: 2, condition: "Claim total above", kind: "amount", threshold: EXP_DEPT_HEAD_THRESHOLD, approver: "Department head", slaHours: 48, active: true },
  { id: "R3", order: 3, condition: "Any line above its policy limit", kind: "violation", threshold: null, approver: "Department head (exception)", slaHours: 48, active: true },
  { id: "R4", order: 4, condition: "Claim total above", kind: "amount", threshold: EXP_FINANCE_THRESHOLD, approver: "Finance controller", slaHours: 72, active: true },
  { id: "R5", order: 5, condition: "Training category", kind: "category", threshold: null, approver: "L&D pre-approval attached", slaHours: 24, active: true },
];
