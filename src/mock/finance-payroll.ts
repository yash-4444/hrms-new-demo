/* ============================================================================
   W5 fixtures — salary components, salary assignments & revisions, and the
   September 2026 payroll inputs.

   Nothing here invents a payroll figure: every amount is read back from the
   engine in `@/mock/payroll` (computeAmounts / ctcBreakup / computeTds), so the
   component tester, the LOP inputs and the run itself always agree.
   ========================================================================== */

import { addMonths, format, getDaysInMonth, parseISO } from "date-fns";
import { mulberry32, seededShuffle, sum } from "@/lib/utils";
import { branchById, deptName, gradeById, GRADES } from "@/mock/org";
import { employeeByCode, type Employee } from "@/mock/employees";
import { attendanceFor } from "@/mock/attendance";
import { isWorkingDay } from "@/mock/leave";
import { EXPENSE_CLAIMS } from "@/mock/workplace";
import {
  CURRENT_PERIOD,
  ESI_EMPLOYEE_RATE,
  ESI_EMPLOYER_RATE,
  ESI_GROSS_CEILING,
  GRATUITY_RATE,
  PF_MONTHLY_CAP,
  PF_RATE,
  RUN_POPULATION,
  STANDARD_DEDUCTION,
  computeAmounts,
  ctcBreakup,
  runPopulation,
  structureForGrade,
  type Amounts,
} from "@/mock/payroll";

/* ------------------------------------------------------------ catalog */

export type PayComponentType =
  | "Earning"
  | "Statutory deduction"
  | "Deduction"
  | "Employer contribution"
  | "Reimbursement";

export type PayComponentTaxability = "Fully taxable" | "Exempt" | "Partially exempt" | "Not applicable";

export interface PayComponentDef {
  code: string;
  name: string;
  type: PayComponentType;
  taxability: PayComponentTaxability;
  /** The rule, in the payroll formula language shown in the editor. */
  formula: string;
  /** Calculation order — a component may only reference lower orders. */
  order: number;
  prorated: boolean;
  onPayslip: boolean;
  active: boolean;
  /** Statute or policy the rule comes from. */
  reference: string;
  note: string;
}

export const PAY_COMPONENT_TYPES: PayComponentType[] = [
  "Earning",
  "Statutory deduction",
  "Deduction",
  "Employer contribution",
  "Reimbursement",
];

export const PAY_COMPONENT_TAXABILITY: PayComponentTaxability[] = [
  "Fully taxable",
  "Exempt",
  "Partially exempt",
  "Not applicable",
];

export const PAY_COMPONENT_CATALOG: PayComponentDef[] = [
  { code: "BASIC", name: "Basic Salary", type: "Earning", taxability: "Fully taxable", formula: "BASIC = round(MONTHLY_CTC * 40%) * PRORATION", order: 10, prorated: true, onPayslip: true, active: true, reference: "Salary structure · all grades", note: "Drives PF, gratuity, HRA and the LOP per-day rate." },
  { code: "HRA", name: "House Rent Allowance", type: "Earning", taxability: "Partially exempt", formula: "HRA = round(BASIC * 50%)", order: 20, prorated: true, onPayslip: true, active: true, reference: "Sec 10(13A) · Rule 2A", note: "Metro rate. Exemption is claimed against rent receipts at year end." },
  { code: "CONV", name: "Conveyance Allowance", type: "Earning", taxability: "Fully taxable", formula: "CONV = 1600 * PRORATION", order: 30, prorated: true, onPayslip: true, active: true, reference: "Salary structure · flat", note: "Flat monthly allowance; taxable under the new regime." },
  { code: "MED", name: "Medical Allowance", type: "Earning", taxability: "Fully taxable", formula: "MED = 1250 * PRORATION", order: 40, prorated: true, onPayslip: true, active: true, reference: "Salary structure · flat", note: "Flat monthly allowance." },
  { code: "LTA", name: "Leave Travel Allowance", type: "Earning", taxability: "Partially exempt", formula: "LTA = round(BASIC * 8.33%)", order: 50, prorated: true, onPayslip: true, active: true, reference: "Sec 10(5) · two journeys per block", note: "Exempt against travel proofs, twice in a four-year block." },
  { code: "PERF", name: "Performance Pay", type: "Earning", taxability: "Fully taxable", formula: "PERF = if(GRADE >= \"G5\", round(MONTHLY_CTC * PERF_PCT), 0)", order: 60, prorated: true, onPayslip: true, active: true, reference: "Grades G5–G7 · 6% / 8% / 10%", note: "Monthly provision settled against the annual bonus in March." },
  { code: "SPL", name: "Special Allowance", type: "Earning", taxability: "Fully taxable", formula: "SPL = GROSS_TARGET - (BASIC + HRA + CONV + MED + LTA + PERF)", order: 70, prorated: true, onPayslip: true, active: true, reference: "Balancing figure", note: "Absorbs rounding so earnings always add back to the target gross." },
  { code: "OT", name: "Overtime", type: "Earning", taxability: "Fully taxable", formula: "OT = round(OT_HOURS * BASIC / (DAYS_IN_MONTH * 8) * 2)", order: 80, prorated: false, onPayslip: true, active: true, reference: "Factories Act s.59 · double rate", note: "Approved overtime hours from attendance, at twice the hourly basic." },
  { code: "ARR", name: "Salary Arrears", type: "Earning", taxability: "Fully taxable", formula: "ARR = input(\"arrears\")", order: 85, prorated: false, onPayslip: true, active: true, reference: "Back-dated revisions", note: "Posted from an approved back-dated salary revision." },
  { code: "BONUS", name: "Bonus / One-time Earning", type: "Earning", taxability: "Fully taxable", formula: "BONUS = input(\"bonus\")", order: 90, prorated: false, onPayslip: true, active: true, reference: "Payroll inputs", note: "Spot awards, referral bonus and incentives keyed as period inputs." },
  { code: "PF_EE", name: "Provident Fund — employee", type: "Statutory deduction", taxability: "Not applicable", formula: "PF_EE = min(round(BASIC * 12%), 1800)", order: 110, prorated: false, onPayslip: true, active: true, reference: "EPF Act · wage ceiling ₹15,000", note: "12% of basic, capped at 12% of the ₹15,000 ceiling." },
  { code: "ESI_EE", name: "ESI — employee", type: "Statutory deduction", taxability: "Not applicable", formula: "ESI_EE = if(GROSS <= 21000, round(GROSS * 0.75%), 0)", order: 120, prorated: false, onPayslip: true, active: true, reference: "ESI Act · ₹21,000 threshold", note: "Applies only where monthly gross is ₹21,000 or less." },
  { code: "PT", name: "Professional Tax", type: "Statutory deduction", taxability: "Not applicable", formula: "PT = slab(STATE, GROSS, MONTH)", order: 130, prorated: false, onPayslip: true, active: true, reference: "State PT Acts · KA / MH / TS", note: "State levy, resolved from the employee's work location." },
  { code: "LWF", name: "Labour Welfare Fund", type: "Statutory deduction", taxability: "Not applicable", formula: "LWF = if(MONTH in lwf_months(STATE), lwf_rate(STATE), 0)", order: 135, prorated: false, onPayslip: true, active: true, reference: "KA: January · MH: June & December", note: "Not due in September — the run correctly deducts nil." },
  { code: "TDS", name: "Income Tax (TDS)", type: "Statutory deduction", taxability: "Not applicable", formula: "TDS = round(tax(GROSS_FIXED * 12 - 75000) * 104% / 12)", order: 140, prorated: false, onPayslip: true, active: true, reference: "Sec 192 · new regime · 87A rebate", note: "Projected annual tax after standard deduction and cess, spread monthly." },
  { code: "LOP", name: "Loss of Pay", type: "Deduction", taxability: "Not applicable", formula: "LOP = round(GROSS_FIXED / PAYABLE_DAYS * LOP_DAYS)", order: 150, prorated: false, onPayslip: true, active: true, reference: "Attendance + leave · cut-off 15th", note: "Per-day rate on the earned fixed gross, times unpaid days." },
  { code: "ADV", name: "Advance Recovery", type: "Deduction", taxability: "Not applicable", formula: "ADV = input(\"advance_emi\")", order: 160, prorated: false, onPayslip: true, active: true, reference: "Loans & Advances", note: "EMI from a sanctioned salary advance or personal loan." },
  { code: "PF_ER", name: "Provident Fund — employer", type: "Employer contribution", taxability: "Exempt", formula: "PF_ER = min(round(BASIC * 12%), 1800)", order: 210, prorated: false, onPayslip: false, active: true, reference: "EPF Act · EPS 8.33% + EPF 3.67%", note: "Part of CTC, not of gross." },
  { code: "ESI_ER", name: "ESI — employer", type: "Employer contribution", taxability: "Exempt", formula: "ESI_ER = if(GROSS <= 21000, round(GROSS * 3.25%), 0)", order: 220, prorated: false, onPayslip: false, active: true, reference: "ESI Act · 3.25%", note: "Employer share for ESI-covered employees." },
  { code: "GRAT", name: "Gratuity Provision", type: "Employer contribution", taxability: "Exempt", formula: "GRAT = round(BASIC * 4.81%)", order: 230, prorated: false, onPayslip: false, active: true, reference: "Payment of Gratuity Act · 15/26", note: "Monthly accrual of 15 days' basic per completed year." },
  { code: "EXP_REIMB", name: "Expense Reimbursement", type: "Reimbursement", taxability: "Exempt", formula: "EXP_REIMB = sum(approved_claims(PERIOD))", order: 300, prorated: false, onPayslip: true, active: true, reference: "Expense policy", note: "Paid in a separate reimbursement batch — never part of gross." },
];

export const payComponentByCode = (code: string) => PAY_COMPONENT_CATALOG.find((c) => c.code === code);

/* ---------------------------------------------------------- evaluator */

export interface PayComponentEvaluation {
  inputs: { name: string; value: string; source: string }[];
  /** The formula with every input substituted, e.g. "min(round(17,500 * 12%), 1800)". */
  resolved: string;
  output: number;
  /** The same component as it stands in the September run — null if not a run line. */
  runValue: number | null;
  note?: string;
}

const n = (v: number) => v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const LWF_MONTHS: Record<string, number[]> = { Karnataka: [1], Maharashtra: [6, 12], Telangana: [12] };

/** Evaluates one catalog component for one employee against the September 2026 run. */
export function evaluatePayComponent(code: string, emp: Employee): PayComponentEvaluation {
  const a: Amounts = computeAmounts(CURRENT_PERIOD, emp);
  const b = a.breakup;
  const pr = a.prorated ? `${a.payableDays}/${a.daysInMonth}` : "1";
  const prIn = { name: "PRORATION", value: pr, source: a.prorated ? `Joined ${emp.joiningDate}` : "Full month on roll" };
  const mctc = { name: "MONTHLY_CTC", value: n(b.monthlyCtc), source: `CTC ${n(emp.ctc)} ÷ 12` };
  const basicIn = { name: "BASIC", value: n(a.basic), source: "Component BASIC" };
  const grossIn = { name: "GROSS", value: n(a.gross), source: "Σ earnings this period" };
  switch (code) {
    case "BASIC":
      return { inputs: [mctc, prIn], resolved: `round(${n(b.monthlyCtc)} * 40%) * ${pr}`, output: a.basic, runValue: a.basic };
    case "HRA":
      return { inputs: [basicIn], resolved: `round(${n(a.basic)} * 50%)`, output: a.hra, runValue: a.hra, note: a.prorated ? "Pro-rated from the full-month HRA, not recomputed from pro-rated basic." : undefined };
    case "CONV":
      return { inputs: [prIn], resolved: `1600 * ${pr}`, output: a.conveyance, runValue: a.conveyance };
    case "MED":
      return { inputs: [prIn], resolved: `1250 * ${pr}`, output: a.medical, runValue: a.medical };
    case "LTA":
      return { inputs: [basicIn], resolved: `round(${n(a.basic)} * 8.33%)`, output: a.lta, runValue: a.lta };
    case "PERF":
      return { inputs: [{ name: "GRADE", value: emp.gradeId, source: "Employee record" }, mctc, { name: "PERF_PCT", value: `${b.perfPct}%`, source: structureForGrade(emp.gradeId).name }], resolved: `if("${emp.gradeId}" >= "G5", round(${n(b.monthlyCtc)} * ${b.perfPct}%), 0)`, output: a.perf, runValue: a.perf };
    case "SPL": {
      const others = a.basic + a.hra + a.conveyance + a.medical + a.lta + a.perf;
      return { inputs: [{ name: "GROSS_TARGET", value: n(a.grossFixed), source: "Monthly CTC − employer PF − gratuity − employer ESI" }, { name: "OTHER_EARNINGS", value: n(others), source: "BASIC + HRA + CONV + MED + LTA + PERF" }], resolved: `${n(a.grossFixed)} - ${n(others)}`, output: a.special, runValue: a.special };
    }
    case "OT":
      return { inputs: [{ name: "OT_HOURS", value: n(a.overtimeHours), source: "Approved overtime · attendance" }, basicIn, { name: "DAYS_IN_MONTH", value: String(a.daysInMonth), source: CURRENT_PERIOD.label }], resolved: `round(${n(a.overtimeHours)} * ${n(b.basic)} / (${a.daysInMonth} * 8) * 2)`, output: a.overtime, runValue: a.overtime };
    case "ARR":
      return { inputs: [{ name: "arrears", value: n(a.arrears), source: "Payroll inputs · revision arrears" }], resolved: `input("arrears") → ${n(a.arrears)}`, output: a.arrears, runValue: a.arrears };
    case "BONUS":
      return { inputs: [{ name: "bonus", value: "0", source: "Payroll inputs · none keyed for this employee" }], resolved: `input("bonus") → 0`, output: 0, runValue: 0 };
    case "PF_EE":
    case "PF_ER": {
      const raw = Math.round(a.basic * PF_RATE);
      return { inputs: [basicIn], resolved: `min(round(${n(a.basic)} * 12%), 1800) = min(${n(raw)}, 1800)`, output: Math.min(raw, PF_MONTHLY_CAP), runValue: code === "PF_EE" ? a.pf : a.employerPf };
    }
    case "ESI_EE":
    case "ESI_ER": {
      const rate = code === "ESI_EE" ? ESI_EMPLOYEE_RATE : ESI_EMPLOYER_RATE;
      const out = a.gross <= ESI_GROSS_CEILING ? Math.round(a.gross * rate) : 0;
      return { inputs: [grossIn], resolved: `if(${n(a.gross)} <= 21000, round(${n(a.gross)} * ${rate * 100}%), 0)`, output: out, runValue: code === "ESI_EE" ? a.esi : a.employerEsi, note: a.gross > ESI_GROSS_CEILING ? "Gross is above the ₹21,000 threshold — not covered by ESI." : undefined };
    }
    case "PT":
      return { inputs: [{ name: "STATE", value: a.ptResult.state, source: branchById(emp.branchId)?.name ?? emp.branchId }, grossIn, { name: "MONTH", value: String(CURRENT_PERIOD.calendarMonth), source: CURRENT_PERIOD.label }], resolved: `slab("${a.ptResult.state}", ${n(a.gross)}, ${CURRENT_PERIOD.calendarMonth})`, output: a.pt, runValue: a.pt, note: a.ptResult.rule };
    case "LWF": {
      const months = LWF_MONTHS[a.ptResult.state] ?? [];
      return { inputs: [{ name: "STATE", value: a.ptResult.state, source: "Work location" }, { name: "MONTH", value: String(CURRENT_PERIOD.calendarMonth), source: CURRENT_PERIOD.label }], resolved: `if(9 in [${months.join(", ")}], lwf_rate("${a.ptResult.state}"), 0)`, output: 0, runValue: 0, note: "September is not a Labour Welfare Fund contribution month in this state." };
    }
    case "TDS": {
      const annual = b.gross * 12;
      return { inputs: [{ name: "GROSS_FIXED", value: n(b.gross), source: "Full-month fixed gross" }, { name: "STD_DEDUCTION", value: n(STANDARD_DEDUCTION), source: "New regime, FY 2026-27" }, { name: "ANNUAL_TAX", value: n(a.tax.annualTax), source: a.tax.rebateApplied ? "87A rebate applied" : a.tax.marginalReliefApplied ? "Marginal relief applied" : "Slab tax + 4% cess" }], resolved: `round(tax(${n(annual)} - 75000) * 104% / 12${a.prorated ? ` * ${pr}` : ""}) = round(${n(a.tax.annualTax)} / 12${a.prorated ? ` * ${pr}` : ""})`, output: a.tds, runValue: a.tds };
    }
    case "LOP":
      return { inputs: [{ name: "GROSS_FIXED", value: n(a.grossFixed), source: "Earned fixed gross" }, { name: "PAYABLE_DAYS", value: String(a.payableDays), source: "Days on roll" }, { name: "LOP_DAYS", value: n(a.lopDays), source: "Payroll inputs · attendance + leave" }], resolved: `round(${n(a.grossFixed)} / ${a.payableDays} * ${n(a.lopDays)})`, output: a.lop, runValue: a.lop };
    case "ADV":
      return { inputs: [{ name: "advance_emi", value: n(a.advance), source: "Loans & Advances · EMI schedule" }], resolved: `input("advance_emi") → ${n(a.advance)}`, output: a.advance, runValue: a.advance };
    case "GRAT":
      return { inputs: [basicIn], resolved: `round(${n(a.basic)} * ${GRATUITY_RATE * 100}%)`, output: a.gratuity, runValue: a.gratuity };
    default:
      return { inputs: [], resolved: "Evaluated outside the salary run", output: 0, runValue: null, note: "Reimbursements are paid in a separate batch and never enter gross or net salary." };
  }
}

/** Employees picked so the tester shows every interesting path through the engine. */
export const PAY_COMPONENT_TEST_EMPLOYEES: { code: string; why: string }[] = (() => {
  const out: { code: string; why: string }[] = [];
  const push = (e: Employee | undefined, why: string) => {
    if (e && !out.some((o) => o.code === e.code)) out.push({ code: e.code, why });
  };
  const all = runPopulation(CURRENT_PERIOD.id).map((e) => ({ e, a: computeAmounts(CURRENT_PERIOD, e) }));
  push(employeeByCode("STL-0142"), "Bengaluru IC · Karnataka PT");
  push(all.find((x) => x.e.branchId === "PNQ")?.e, "Pune · Maharashtra PT");
  push(all.find((x) => x.a.prorated)?.e, "Joined mid-September · pro-rated");
  push(all.find((x) => x.a.overtimeHours > 0)?.e, "Approved overtime");
  push(all.find((x) => x.a.lopDays > 0 && !x.a.exceptionType)?.e, "Loss-of-pay days");
  push(all.find((x) => x.a.arrears > 0)?.e, "Revision arrears");
  push(all.find((x) => x.a.advance > 0 && !x.a.exceptionType)?.e, "Advance recovery");
  push(all.find((x) => x.e.gradeId === "G6")?.e, "Director · performance pay");
  push(all.find((x) => x.a.tax.rebateApplied)?.e, "87A rebate · nil TDS");
  return out;
})();

/* ------------------------------------------------- salary assignments */

export interface SalaryAssignment {
  employeeCode: string;
  name: string;
  designation: string;
  departmentId: string;
  department: string;
  branchId: string;
  branch: string;
  gradeId: string;
  structureId: string;
  structureName: string;
  annualCtc: number;
  monthlyCtc: number;
  monthlyGross: number;
  effectiveFrom: string;
  /** April 2026 appraisal increment, null for joiners after the cycle. */
  lastIncrementPct: number | null;
}

export const SALARY_ASSIGNMENTS: SalaryAssignment[] = RUN_POPULATION.map((e, i) => {
  const b = ctcBreakup(e.gradeId, e.ctc);
  const s = structureForGrade(e.gradeId);
  const joinedAfterCycle = e.joiningDate > "2026-04-01";
  const rng = mulberry32(9100 + i * 31);
  return {
    employeeCode: e.code,
    name: e.name,
    designation: e.designation,
    departmentId: e.departmentId,
    department: deptName(e.departmentId),
    branchId: e.branchId,
    branch: branchById(e.branchId)?.name ?? e.branchId,
    gradeId: e.gradeId,
    structureId: s.id,
    structureName: s.name,
    annualCtc: e.ctc,
    monthlyCtc: b.monthlyCtc,
    monthlyGross: b.gross,
    effectiveFrom: joinedAfterCycle ? e.joiningDate : "2026-04-01",
    lastIncrementPct: joinedAfterCycle ? null : Math.round((5 + rng() * 9) * 10) / 10,
  };
});

/* ---------------------------------------------------------- revisions */

export type RevisionStatus = "draft" | "pending_approval" | "approved" | "rejected";
export const REVISION_REASONS = ["Promotion", "Market correction", "Retention", "Role change", "Annual increment"] as const;
export type RevisionReason = (typeof REVISION_REASONS)[number];

export interface SalaryRevision {
  id: string;
  employeeCode: string;
  name: string;
  department: string;
  gradeId: string;
  newGradeId: string;
  reason: RevisionReason;
  oldCtc: number;
  newCtc: number;
  effectiveFrom: string;
  raisedBy: string;
  raisedOn: string;
  status: RevisionStatus;
  decidedBy: string | null;
  decidedOn: string | null;
  note: string;
}

export interface ArrearsMonth {
  periodId: string;
  label: string;
  /** 1 for a full month; less when the revision starts mid-month. */
  factor: number;
  oldGross: number;
  newGross: number;
  diff: number;
}

/**
 * Month-by-month arrears for a back-dated revision: the fixed-gross difference
 * for every closed period from the effective month to August 2026. They are
 * paid as the ARR component in the next open run (September 2026).
 */
export function revisionArrears(
  gradeId: string,
  oldCtc: number,
  newGradeId: string,
  newCtc: number,
  effectiveFrom: string,
): ArrearsMonth[] {
  const out: ArrearsMonth[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom) || effectiveFrom >= CURRENT_PERIOD.periodStart) return out;
  const oldGross = ctcBreakup(gradeId, oldCtc).gross;
  const newGross = ctcBreakup(newGradeId, newCtc).gross;
  const day = Number(effectiveFrom.slice(8, 10)) || 1;
  let cursor = parseISO(`${effectiveFrom.slice(0, 7)}-01`);
  while (format(cursor, "yyyy-MM") < CURRENT_PERIOD.id) {
    const dim = getDaysInMonth(cursor);
    const factor = out.length === 0 && day > 1 ? (dim - day + 1) / dim : 1;
    const o = Math.round(oldGross * factor);
    const nw = Math.round(newGross * factor);
    out.push({ periodId: format(cursor, "yyyy-MM"), label: format(cursor, "MMM yyyy"), factor, oldGross: o, newGross: nw, diff: nw - o });
    cursor = addMonths(cursor, 1);
  }
  return out;
}

export const revisionArrearsTotal = (
  r: Pick<SalaryRevision, "gradeId" | "oldCtc" | "newGradeId" | "newCtc" | "effectiveFrom">,
) => sum(revisionArrears(r.gradeId, r.oldCtc, r.newGradeId, r.newCtc, r.effectiveFrom).map((m) => m.diff));

const REVISION_SEED: {
  idx: number;
  pct: number;
  reason: RevisionReason;
  eff: string;
  status: RevisionStatus;
  promote?: boolean;
  note: string;
}[] = [
  { idx: 12, pct: 18, reason: "Promotion", eff: "2026-07-01", status: "pending_approval", promote: true, note: "Promoted to the next grade in the July calibration; letter issued 4 Sep." },
  { idx: 37, pct: 12, reason: "Market correction", eff: "2026-06-01", status: "pending_approval", note: "Benchmarked 14% below the P50 for the role in the Q1 market survey." },
  { idx: 58, pct: 10, reason: "Retention", eff: "2026-08-16", status: "pending_approval", note: "Counter to an external offer; effective from the date of the retention conversation." },
  { idx: 91, pct: 8, reason: "Role change", eff: "2026-10-01", status: "pending_approval", note: "Moves from support to the platform team from October." },
  { idx: 120, pct: 15, reason: "Promotion", eff: "2026-10-01", status: "approved", promote: true, note: "Approved in the September promotion committee." },
  { idx: 143, pct: 7, reason: "Market correction", eff: "2026-10-01", status: "approved", note: "Pune band realignment." },
  { idx: 176, pct: 30, reason: "Retention", eff: "2026-05-01", status: "rejected", note: "Above the 25% retention ceiling without CHRO sign-off." },
  { idx: 205, pct: 9, reason: "Annual increment", eff: "2026-09-01", status: "draft", note: "Deferred appraisal after long leave; to be submitted after the September run." },
];

export const SALARY_REVISIONS: SalaryRevision[] = REVISION_SEED.map((s, i) => {
  const e = RUN_POPULATION[s.idx % RUN_POPULATION.length];
  const gIdx = GRADES.findIndex((g) => g.id === e.gradeId);
  const newGradeId = s.promote && gIdx < GRADES.length - 1 ? GRADES[gIdx + 1].id : e.gradeId;
  const decided = s.status === "approved" || s.status === "rejected";
  return {
    id: `REV-2026-${String(41 + i).padStart(4, "0")}`,
    employeeCode: e.code,
    name: e.name,
    department: deptName(e.departmentId),
    gradeId: e.gradeId,
    newGradeId,
    reason: s.reason,
    oldCtc: e.ctc,
    newCtc: Math.round((e.ctc * (1 + s.pct / 100)) / 1000) * 1000,
    effectiveFrom: s.eff,
    raisedBy: "Rahul Desai",
    raisedOn: `2026-09-${String(3 + i).padStart(2, "0")}`,
    status: s.status,
    decidedBy: decided ? "Lakshmi Pillai" : null,
    decidedOn: decided ? `2026-09-${String(10 + i).padStart(2, "0")}` : null,
    note: s.note,
  };
});

/* ---------------------------------------------- bulk increment upload */

export interface BulkIncrementRow {
  row: number;
  employeeCode: string;
  incrementPct: number;
  effectiveFrom: string;
  reason: string;
}

export interface BulkIncrementResult extends BulkIncrementRow {
  name: string;
  oldCtc: number | null;
  newCtc: number | null;
  arrears: number;
  status: "valid" | "warning" | "invalid";
  message: string;
}

/** The file the "Use sample file" button loads — it deliberately carries bad rows. */
export const BULK_INCREMENT_SAMPLE: BulkIncrementRow[] = [
  ...[3, 9, 22, 48, 66, 101, 133, 158].map((idx, i) => ({
    row: i + 2,
    employeeCode: RUN_POPULATION[idx % RUN_POPULATION.length].code,
    incrementPct: [6, 8.5, 7, 10, 12, 5.5, 9, 28][i],
    effectiveFrom: i === 3 ? "2026-07-01" : "2026-10-01",
    reason: i === 7 ? "Retention" : "Mid-year correction",
  })),
  { row: 10, employeeCode: "STL-0999", incrementPct: 8, effectiveFrom: "2026-10-01", reason: "Mid-year correction" },
  { row: 11, employeeCode: RUN_POPULATION[9].code, incrementPct: 4, effectiveFrom: "2026-10-01", reason: "Duplicate line" },
  { row: 12, employeeCode: RUN_POPULATION[70].code, incrementPct: 45, effectiveFrom: "2026-10-01", reason: "Market correction" },
  { row: 13, employeeCode: RUN_POPULATION[88].code, incrementPct: 6, effectiveFrom: "2026-02-01", reason: "Mid-year correction" },
];

/** Dry-run validation — nothing is written until the file is committed. */
export function validateBulkIncrements(rows: BulkIncrementRow[]): BulkIncrementResult[] {
  const seen = new Set<string>();
  return rows.map((r): BulkIncrementResult => {
    const e = employeeByCode(r.employeeCode);
    const onPayroll = !!e && RUN_POPULATION.includes(e);
    const dup = seen.has(r.employeeCode);
    seen.add(r.employeeCode);
    const base = { ...r, name: e?.name ?? "—", oldCtc: e?.ctc ?? null, newCtc: null, arrears: 0 };
    if (!e) return { ...base, status: "invalid", message: "Employee code not found in the tenant." };
    if (!onPayroll) return { ...base, status: "invalid", message: "Not on the India payroll — revise on the US payroll instead." };
    if (dup) return { ...base, status: "invalid", message: `Duplicate of an earlier row for ${r.employeeCode}.` };
    if (r.incrementPct <= 0 || r.incrementPct > 40) return { ...base, status: "invalid", message: "Increment must be above 0% and at most 40%." };
    if (r.effectiveFrom < "2026-04-01") return { ...base, status: "invalid", message: "Effective date falls in FY 2025-26, which is closed." };
    const newCtc = Math.round((e.ctc * (1 + r.incrementPct / 100)) / 1000) * 1000;
    const arrears = revisionArrearsTotal({ gradeId: e.gradeId, oldCtc: e.ctc, newGradeId: e.gradeId, newCtc, effectiveFrom: r.effectiveFrom });
    const band = gradeById(e.gradeId);
    const out = { ...base, newCtc, arrears };
    if (band && newCtc > band.maxCtc) return { ...out, status: "warning", message: `Above the ${e.gradeId} band maximum — needs finance controller sign-off.` };
    if (r.incrementPct > 25) return { ...out, status: "warning", message: "Above 25% — justification is required at approval." };
    if (arrears > 0) return { ...out, status: "warning", message: "Back-dated — arrears are paid in the September 2026 run." };
    return { ...out, status: "valid", message: "Ready to submit for approval." };
  });
}

/* ------------------------------------------- September 2026 inputs */

/** Attendance cut-off for the September run — days after it are assumed present and trued up in October. */
export const PAYROLL_INPUT_CUTOFF = "2026-09-15";

const SEPT_AMOUNTS = runPopulation(CURRENT_PERIOD.id).map((e) => computeAmounts(CURRENT_PERIOD, e));

/** The run's own variable-input totals — every input screen reconciles to these. */
export const PAYROLL_INPUT_RUN_TOTALS = {
  lopDays: sum(SEPT_AMOUNTS.map((a) => a.lopDays)),
  lop: sum(SEPT_AMOUNTS.map((a) => a.lop)),
  overtime: sum(SEPT_AMOUNTS.map((a) => a.overtime)),
  arrears: sum(SEPT_AMOUNTS.map((a) => a.arrears)),
  advance: sum(SEPT_AMOUNTS.map((a) => a.advance)),
};

export interface PayrollInputLopRow {
  employeeCode: string;
  name: string;
  departmentId: string;
  department: string;
  branchId: string;
  branch: string;
  payableDays: number;
  lopDays: number;
  perDayRate: number;
  lopAmount: number;
  /** True where the LOP keyed is larger than the days payable — a run exception. */
  exceeds: boolean;
}

export const PAYROLL_INPUT_LOP: PayrollInputLopRow[] = SEPT_AMOUNTS.filter((a) => a.lopDays > 0).map((a) => ({
  employeeCode: a.employee.code,
  name: a.employee.name,
  departmentId: a.employee.departmentId,
  department: deptName(a.employee.departmentId),
  branchId: a.employee.branchId,
  branch: branchById(a.employee.branchId)?.name ?? a.employee.branchId,
  payableDays: a.payableDays,
  lopDays: a.lopDays,
  perDayRate: Math.round(a.perDayRate * 100) / 100,
  lopAmount: a.lop,
  exceeds: a.lopDays > a.payableDays,
}));

export interface LopDayDetail {
  date: string;
  days: number;
  source: "Absent — no punch, no leave" | "Leave without pay (approved)" | "Half-day absent";
  reference: string;
}

/** The dated days behind an employee's LOP — attendance absences first, then approved leave without pay. */
export function lopDaysDetail(code: string): LopDayDetail[] {
  const row = PAYROLL_INPUT_LOP.find((r) => r.employeeCode === code);
  if (!row) return [];
  const working = Array.from({ length: 15 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`).filter((d) =>
    isWorkingDay(d, "IN"),
  );
  const absent = new Set(
    attendanceFor(code)
      .filter((d) => d.date.startsWith("2026-09") && d.state === "absent")
      .map((d) => d.date),
  );
  const rng = mulberry32(Number(code.slice(4)) * 131 + 7);
  const ordered = [...working.filter((d) => absent.has(d)), ...seededShuffle(rng, working.filter((d) => !absent.has(d)))];
  const out: LopDayDetail[] = [];
  let left = Math.min(row.lopDays, working.length);
  for (const d of ordered) {
    if (left <= 0) break;
    const days = left >= 1 ? 1 : 0.5;
    const fromAttendance = absent.has(d);
    out.push({
      date: d,
      days,
      source: days === 0.5 ? "Half-day absent" : fromAttendance ? "Absent — no punch, no leave" : "Leave without pay (approved)",
      reference: fromAttendance || days === 0.5 ? "Attendance finalisation · 16 Sep" : `LV-LOP-${code.slice(4)}-${d.slice(8)}`,
    });
    left -= days;
  }
  return out.sort((x, y) => x.date.localeCompare(y.date));
}

export type PayrollInputStatus = "included" | "pending";

export interface PayrollOneTimeInput {
  id: string;
  employeeCode: string;
  name: string;
  department: string;
  component: string;
  componentName: string;
  kind: "earning" | "deduction";
  amount: number;
  source: string;
  status: PayrollInputStatus;
  enteredBy: string;
  enteredOn: string;
}

const FROM_RUN: PayrollOneTimeInput[] = SEPT_AMOUNTS.flatMap((a) => {
  const base = { employeeCode: a.employee.code, name: a.employee.name, department: deptName(a.employee.departmentId), status: "included" as const };
  const rows: PayrollOneTimeInput[] = [];
  if (a.overtime > 0)
    rows.push({ ...base, id: `PIN-OT-${a.employee.code}`, component: "OT", componentName: "Overtime", kind: "earning", amount: a.overtime, source: `Attendance · ${a.overtimeHours} h approved overtime`, enteredBy: "Attendance sync", enteredOn: "2026-09-16" });
  if (a.arrears > 0)
    rows.push({ ...base, id: `PIN-ARR-${a.employee.code}`, component: "ARR", componentName: "Salary Arrears", kind: "earning", amount: a.arrears, source: "Approved back-dated revision", enteredBy: "Rahul Desai", enteredOn: "2026-09-12" });
  if (a.advance > 0)
    rows.push({ ...base, id: `PIN-ADV-${a.employee.code}`, component: "ADV", componentName: "Advance Recovery", kind: "deduction", amount: a.advance, source: "Loans & Advances · EMI schedule", enteredBy: "Loan schedule", enteredOn: "2026-09-10" });
  return rows;
});

const MANUAL_SEED: { idx: number; component: string; componentName: string; kind: "earning" | "deduction"; amount: number; source: string }[] = [
  { idx: 15, component: "BONUS", componentName: "Spot Award", kind: "earning", amount: 15000, source: "Recognition · Q2 spot award" },
  { idx: 44, component: "BONUS", componentName: "Referral Bonus", kind: "earning", amount: 40000, source: "Hiring · referral STL-0331 completed 90 days" },
  { idx: 63, component: "BONUS", componentName: "Sales Incentive", kind: "earning", amount: 62500, source: "Sales · Q2 quota attainment 118%" },
  { idx: 110, component: "BONUS", componentName: "Night-shift Allowance", kind: "earning", amount: 4800, source: "Roster · 12 night shifts" },
  { idx: 151, component: "DED_OTHER", componentName: "Notice-pay Recovery", kind: "deduction", amount: 21300, source: "Separation · 9 days short of notice" },
  { idx: 187, component: "DED_OTHER", componentName: "Asset Damage Recovery", kind: "deduction", amount: 6500, source: "Assets · laptop screen, AST-0214" },
];

const MANUAL: PayrollOneTimeInput[] = MANUAL_SEED.map((s, i) => {
  const e = RUN_POPULATION[s.idx % RUN_POPULATION.length];
  return {
    id: `PIN-M-${String(i + 1).padStart(3, "0")}`,
    employeeCode: e.code,
    name: e.name,
    department: deptName(e.departmentId),
    component: s.component,
    componentName: s.componentName,
    kind: s.kind,
    amount: s.amount,
    source: s.source,
    status: "pending",
    enteredBy: "Rahul Desai",
    enteredOn: "2026-09-16",
  };
});

/** Run-sourced inputs (already in the calculated run) plus manual entries awaiting recalculation. */
export const PAYROLL_ONE_TIME_INPUTS: PayrollOneTimeInput[] = [...MANUAL, ...FROM_RUN];

export interface PayrollReimbursementRow {
  claimNo: string;
  employeeCode: string;
  name: string;
  department: string;
  purpose: string;
  approvedOn: string | null;
  amount: number;
}

/** Approved expense claims not yet reimbursed — paid in the reimbursement batch on pay date. */
export const PAYROLL_REIMBURSEMENTS: PayrollReimbursementRow[] = EXPENSE_CLAIMS.filter(
  (c) => c.status === "approved" && !c.reimbursedOn,
).map((c) => ({
  claimNo: c.claimNo,
  employeeCode: c.employeeCode,
  name: c.employeeName,
  department: c.department,
  purpose: c.purpose,
  approvedOn: c.decidedOn,
  amount: c.total,
}));

/* -------------------------------------------------- CSV import dry run */

export interface PayrollInputCsvRow {
  row: number;
  employeeCode: string;
  component: string;
  amount: number;
  note: string;
}

export interface PayrollInputCsvResult extends PayrollInputCsvRow {
  name: string;
  status: "valid" | "warning" | "invalid";
  message: string;
}

export const PAYROLL_INPUT_CSV_SAMPLE: PayrollInputCsvRow[] = [
  { row: 2, employeeCode: RUN_POPULATION[21].code, component: "BONUS", amount: 10000, note: "Hackathon winner" },
  { row: 3, employeeCode: RUN_POPULATION[57].code, component: "BONUS", amount: 7500, note: "Hackathon runner-up" },
  { row: 4, employeeCode: RUN_POPULATION[83].code, component: "ADV", amount: 5000, note: "Festival advance EMI" },
  { row: 5, employeeCode: "STL-0052", component: "ADV", amount: 4000, note: "Corrected EMI" },
  { row: 6, employeeCode: RUN_POPULATION[129].code, component: "HRA", amount: 3000, note: "Manual HRA top-up" },
  { row: 7, employeeCode: "STL-1204", component: "BONUS", amount: 5000, note: "Spot award" },
  { row: 8, employeeCode: RUN_POPULATION[57].code, component: "BONUS", amount: 7500, note: "Hackathon runner-up" },
  { row: 9, employeeCode: RUN_POPULATION[160].code, component: "BONUS", amount: 750000, note: "Sales incentive" },
];

const INPUT_COMPONENTS = new Set(["BONUS", "ARR", "ADV", "DED_OTHER"]);
const EXCEPTION_CODES = new Set(SEPT_AMOUNTS.filter((a) => a.exceptionType).map((a) => a.employee.code));

export function validatePayrollInputCsv(rows: PayrollInputCsvRow[]): PayrollInputCsvResult[] {
  const seen = new Set<string>();
  return rows.map((r): PayrollInputCsvResult => {
    const e = employeeByCode(r.employeeCode);
    const key = `${r.employeeCode}|${r.component}|${r.amount}`;
    const dup = seen.has(key);
    seen.add(key);
    const base = { ...r, name: e?.name ?? "—" };
    if (!e || !RUN_POPULATION.includes(e)) return { ...base, status: "invalid", message: "Employee is not in the September 2026 India run." };
    if (!INPUT_COMPONENTS.has(r.component)) return { ...base, status: "invalid", message: `${r.component} is formula-driven — only one-time components accept inputs.` };
    if (dup) return { ...base, status: "invalid", message: `Duplicate of an earlier row (same employee, component and amount).` };
    if (r.amount <= 0 || r.amount > 500000) return { ...base, status: "invalid", message: "Amount must be above ₹0 and at most ₹5,00,000 per line." };
    if (EXCEPTION_CODES.has(r.employeeCode)) return { ...base, status: "warning", message: "Employee has an open run exception — resolve it before recalculating." };
    return { ...base, status: "valid", message: "Ready to import." };
  });
}
