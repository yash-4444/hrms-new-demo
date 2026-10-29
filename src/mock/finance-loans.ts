import { addMonths, format, parseISO } from "date-fns";
import { mulberry32, sum } from "@/lib/utils";
import { inr } from "@/lib/format";
import { DEMO_TODAY, deptName } from "./org";
import { employeeByCode, type Employee } from "./employees";
import {
  CURRENT_PERIOD,
  PREVIOUS_PERIOD,
  RUN_POPULATION,
  computeAmounts,
  runPopulation,
  ctcBreakup,
} from "./payroll";

/* ============================================================================
   W5 · Loans & advances and Flexible Benefits (FBP).

   Loans reconcile with the September run: every employee whose September
   `computeAmounts().advance` is non-zero carries an active loan whose
   September instalment IS that figure. August advances become one-instalment
   salary advances that closed in the August run.
   ========================================================================== */

export type LoanKind = "salary_advance" | "personal_loan";
export type LoanStatus = "pending_approval" | "sanctioned" | "active" | "closed" | "foreclosed" | "rejected";

export const LOAN_KIND_LABEL: Record<LoanKind, string> = {
  salary_advance: "Salary advance",
  personal_loan: "Personal loan",
};

/** SBI lending rate for personal loans as at 1 April 2026 — the Rule 3(7)(i) benchmark. */
export const LOAN_SBI_RATE = 11.15;
/** Rule 3(7)(i): aggregate loans up to ₹20,000 carry no perquisite. */
export const LOAN_PERQ_THRESHOLD = 20000;

export interface LoanScheduleRow {
  no: number;
  periodId: string;
  label: string;
  opening: number;
  interest: number;
  principal: number;
  emi: number;
  closing: number;
  /** "recovered" — taken in a paid run; "current" — the open September run. */
  state: "recovered" | "current" | "upcoming";
}

export interface Loan {
  id: string;
  employeeCode: string;
  name: string;
  department: string;
  designation: string;
  kind: LoanKind;
  purpose: string;
  principal: number;
  ratePct: number;
  tenureMonths: number;
  /** Scheduled monthly instalment. */
  emi: number;
  requestedOn: string;
  sanctionedOn: string | null;
  sanctionedBy: string | null;
  disbursedOn: string | null;
  /** First period the instalment is recovered in, e.g. "2026-09". */
  firstEmiPeriod: string;
  status: LoanStatus;
  /** Amount the September run actually deducts — 0 when not recovering. */
  septDeduction: number;
  /** Set on the mis-keyed instalment behind the negative-net exception. */
  flag: string | null;
  schedule: LoanScheduleRow[];
  outstanding: number;
  emisRecovered: number;
  medicalExempt: boolean;
}

const periodLabel = (id: string) => format(parseISO(`${id}-01`), "MMM yyyy");
const shiftPeriod = (id: string, n: number) => format(addMonths(parseISO(`${id}-01`), n), "yyyy-MM");
const dayOf = (periodId: string, day: number) => `${periodId}-${String(day).padStart(2, "0")}`;

/** Reducing-balance schedule with a fixed EMI; the last line clears the balance. */
export function buildSchedule(principal: number, ratePct: number, emi: number, firstPeriod: string): LoanScheduleRow[] {
  const r = ratePct / 1200;
  const rows: LoanScheduleRow[] = [];
  let bal = principal;
  for (let i = 0; bal > 0 && i < 120; i++) {
    const periodId = shiftPeriod(firstPeriod, i);
    const interest = Math.round(bal * r);
    const last = emi - interest >= bal;
    const principalPart = last ? bal : emi - interest;
    const closing = bal - principalPart;
    rows.push({
      no: i + 1,
      periodId,
      label: periodLabel(periodId),
      opening: bal,
      interest,
      principal: principalPart,
      emi: principalPart + interest,
      closing,
      state: periodId < CURRENT_PERIOD.id ? "recovered" : periodId === CURRENT_PERIOD.id ? "current" : "upcoming",
    });
    bal = closing;
  }
  return rows;
}

/** EMI for a reducing-balance loan, rounded up to the next ₹10. */
export function emiFor(principal: number, ratePct: number, months: number) {
  if (months <= 0) return principal;
  if (ratePct === 0) return Math.ceil(principal / months / 10) * 10;
  const r = ratePct / 1200;
  return Math.ceil((principal * r) / (1 - Math.pow(1 + r, -months)) / 10) * 10;
}

/** Principal a fixed EMI services over n months — used to back out run-derived loans. */
function principalFor(emi: number, ratePct: number, months: number) {
  if (ratePct === 0) return emi * months;
  const r = ratePct / 1200;
  return Math.floor((emi * (1 - Math.pow(1 + r, -months))) / r / 100) * 100;
}

/**
 * Rule 3(7)(i) perquisite for the FY: (SBI rate − rate charged) × balance
 * outstanding at each month end ÷ 12. Nil at or below ₹20,000, or for a loan
 * for the specified medical treatments.
 */
export function loanPerquisite(loan: Pick<Loan, "principal" | "ratePct" | "schedule" | "medicalExempt">) {
  if (loan.principal <= LOAN_PERQ_THRESHOLD || loan.medicalExempt || loan.ratePct >= LOAN_SBI_RATE) {
    return { taxable: false, monthly: [] as { label: string; balance: number; value: number }[], fyTotal: 0 };
  }
  const gap = (LOAN_SBI_RATE - loan.ratePct) / 1200;
  const monthly = loan.schedule
    .filter((s) => s.periodId >= "2026-04" && s.periodId <= "2027-03")
    .map((s) => ({ label: s.label, balance: s.opening, value: Math.round(s.opening * gap) }));
  return { taxable: true, monthly, fyTotal: sum(monthly.map((m) => m.value)) };
}

const PURPOSES: Record<LoanKind, string[]> = {
  salary_advance: [
    "Rental deposit for a new flat",
    "Family wedding expenses",
    "Relocation to Bengaluru",
    "Two-wheeler down payment",
    "Child's school admission fee",
  ],
  personal_loan: [
    "Home renovation",
    "Medical treatment for a parent",
    "Higher-education fees",
    "Consolidating a credit-card balance",
  ],
};

function finish(base: Omit<Loan, "schedule" | "outstanding" | "emisRecovered">): Loan {
  const schedule =
    base.status === "rejected" ? [] : buildSchedule(base.principal, base.ratePct, base.emi, base.firstEmiPeriod);
  const recovered = schedule.filter((s) => s.state === "recovered");
  const live = base.status === "active";
  /* Nothing is outstanding until the money has been disbursed. */
  const outstanding = live ? (recovered.at(-1)?.closing ?? base.principal) : 0;
  return { ...base, schedule, outstanding, emisRecovered: recovered.length };
}

function person(emp: Employee) {
  return {
    employeeCode: emp.code,
    name: emp.name,
    department: deptName(emp.departmentId),
    designation: emp.designation,
  };
}

/** The mis-keyed case: the full ₹52,000 outstanding entered as one instalment. */
export const LOAN_MISKEYED_CODE = "STL-0052";
const MISKEYED_EMI = 5200;

function buildLoans(): Loan[] {
  const out: Loan[] = [];
  let seq = 1;
  const id = () => `LN-2026-${String(seq++).padStart(3, "0")}`;

  /* 1 · active loans behind every September advance deduction */
  for (const emp of runPopulation(CURRENT_PERIOD.id)) {
    const advance = computeAmounts(CURRENT_PERIOD, emp).advance;
    if (advance <= 0) continue;
    const rng = mulberry32(emp.code.charCodeAt(6) * 131 + Number(emp.code.slice(4)));
    if (emp.code === LOAN_MISKEYED_CODE) {
      const principal = 52000;
      out.push(
        finish({
          id: id(),
          ...person(emp),
          kind: "personal_loan",
          purpose: "Medical treatment for a parent",
          principal,
          ratePct: 0,
          tenureMonths: 10,
          emi: MISKEYED_EMI,
          requestedOn: "2026-08-15",
          sanctionedOn: "2026-08-19",
          sanctionedBy: "Lakshmi Pillai",
          disbursedOn: "2026-08-22",
          firstEmiPeriod: CURRENT_PERIOD.id,
          status: "active",
          septDeduction: advance,
          flag: `September instalment keyed as ${inr(advance, { decimals: false })} — the full sanctioned amount — instead of the scheduled ${inr(MISKEYED_EMI, { decimals: false })}. This is the negative-net exception on the run.`,
          medicalExempt: false,
        }),
      );
      continue;
    }
    const personal = rng() > 0.6;
    const ratePct = personal ? 7.5 : 0;
    const tenure = personal ? 12 + Math.floor(rng() * 3) * 6 : 3 + Math.floor(rng() * 4);
    const principal = personal ? principalFor(advance, ratePct, tenure) : advance * tenure;
    const kind: LoanKind = personal ? "personal_loan" : "salary_advance";
    const purposes = PURPOSES[kind];
    out.push(
      finish({
        id: id(),
        ...person(emp),
        kind,
        purpose: purposes[Math.floor(rng() * purposes.length)],
        principal,
        ratePct,
        tenureMonths: tenure,
        emi: advance,
        requestedOn: "2026-08-06",
        sanctionedOn: "2026-08-11",
        sanctionedBy: "Lakshmi Pillai",
        disbursedOn: "2026-08-14",
        firstEmiPeriod: CURRENT_PERIOD.id,
        status: "active",
        septDeduction: advance,
        flag: null,
        medicalExempt: false,
      }),
    );
  }

  /* 2 · August advances — one instalment, recovered in full in the paid August run */
  for (const emp of runPopulation(PREVIOUS_PERIOD.id)) {
    const advance = computeAmounts(PREVIOUS_PERIOD, emp).advance;
    if (advance <= 0) continue;
    out.push(
      finish({
        id: id(),
        ...person(emp),
        kind: "salary_advance",
        purpose: PURPOSES.salary_advance[Number(emp.code.slice(4)) % 5],
        principal: advance,
        ratePct: 0,
        tenureMonths: 1,
        emi: advance,
        requestedOn: "2026-07-20",
        sanctionedOn: "2026-07-22",
        sanctionedBy: "Lakshmi Pillai",
        disbursedOn: "2026-07-24",
        firstEmiPeriod: PREVIOUS_PERIOD.id,
        status: "closed",
        septDeduction: 0,
        flag: null,
        medicalExempt: false,
      }),
    );
  }

  /* 3 · new requests: awaiting approval, or sanctioned and not yet disbursed */
  const recovering = new Set(out.map((l) => l.employeeCode));
  const pool = RUN_POPULATION.filter((e) => !recovering.has(e.code) && e.status === "active");
  const NEW: { kind: LoanKind; principal: number; rate: number; tenure: number; status: LoanStatus; purpose: string }[] = [
    { kind: "personal_loan", principal: 150000, rate: 7.5, tenure: 24, status: "pending_approval", purpose: "Home renovation" },
    { kind: "salary_advance", principal: 40000, rate: 0, tenure: 4, status: "pending_approval", purpose: "Rental deposit for a new flat" },
    { kind: "personal_loan", principal: 250000, rate: 7.5, tenure: 36, status: "pending_approval", purpose: "Higher-education fees" },
    { kind: "salary_advance", principal: 18000, rate: 0, tenure: 3, status: "pending_approval", purpose: "Child's school admission fee" },
    { kind: "personal_loan", principal: 120000, rate: 0, tenure: 12, status: "sanctioned", purpose: "Medical treatment for a parent" },
    { kind: "salary_advance", principal: 30000, rate: 0, tenure: 3, status: "sanctioned", purpose: "Family wedding expenses" },
    { kind: "personal_loan", principal: 90000, rate: 7.5, tenure: 18, status: "sanctioned", purpose: "Consolidating a credit-card balance" },
  ];
  NEW.forEach((n, i) => {
    const emp = pool[Math.floor(((i + 0.5) * pool.length) / NEW.length)];
    const sanctioned = n.status === "sanctioned";
    out.push(
      finish({
        id: id(),
        ...person(emp),
        kind: n.kind,
        purpose: n.purpose,
        principal: n.principal,
        ratePct: n.rate,
        tenureMonths: n.tenure,
        emi: emiFor(n.principal, n.rate, n.tenure),
        requestedOn: dayOf("2026-09", 8 + i),
        sanctionedOn: sanctioned ? dayOf("2026-09", 12 + i) : null,
        sanctionedBy: sanctioned ? "Lakshmi Pillai" : null,
        disbursedOn: null,
        firstEmiPeriod: shiftPeriod(CURRENT_PERIOD.id, 1),
        status: n.status,
        septDeduction: 0,
        flag: null,
        medicalExempt: n.purpose.startsWith("Medical") && n.principal > 100000,
      }),
    );
  });

  return out;
}

export const LOANS: Loan[] = buildLoans();

/** Σ advance deductions the September run takes, straight from the run engine. */
export const LOAN_RUN_ADVANCE_TOTAL = sum(runPopulation(CURRENT_PERIOD.id).map((e) => computeAmounts(CURRENT_PERIOD, e).advance));

export const LOAN_STATS = (() => {
  const active = LOANS.filter((l) => l.status === "active");
  return {
    active: active.length,
    outstanding: sum(active.map((l) => l.outstanding)),
    septDeductions: sum(LOANS.map((l) => l.septDeduction)),
    pending: LOANS.filter((l) => l.status === "pending_approval").length,
    sanctioned: LOANS.filter((l) => l.status === "sanctioned").length,
    toDisburse: sum(LOANS.filter((l) => l.status === "sanctioned").map((l) => l.principal)),
  };
})();

/** Monthly gross ceiling for a salary advance: one month's fixed gross. */
export const loanAdvanceCeiling = (code: string) => {
  const emp = employeeByCode(code);
  return emp ? ctcBreakup(emp.gradeId, emp.ctc).gross : 0;
};

export const LOAN_MISKEYED_EMI = MISKEYED_EMI;

/* ==========================================================================
   Flexible benefit plan (FBP) — FY 2026-27 declaration window.
   The basket is carved out of Special Allowance; whatever an employee does
   not declare stays taxable as Special Allowance.
   ========================================================================== */

export type FbpComponentId = "fuel" | "telephone" | "meal" | "lta" | "books";

export interface FbpComponent {
  id: FbpComponentId;
  name: string;
  monthlyLimit: number | null;
  annualLimit: number;
  rule: string;
  proof: string;
}

export const FBP_COMPONENTS: FbpComponent[] = [
  {
    id: "fuel",
    name: "Car fuel & maintenance",
    monthlyLimit: 2400,
    annualLimit: 28800,
    rule: "Rule 3(2): ₹1,800 a month up to 1.6 L engine, ₹2,400 above, for a car used for official and personal purposes.",
    proof: "Fuel and service bills with the car's registration number",
  },
  {
    id: "telephone",
    name: "Telephone & internet",
    monthlyLimit: 1500,
    annualLimit: 18000,
    rule: "Rule 3(7)(ix): reimbursement of actual bills for a connection used for work is not a perquisite.",
    proof: "Post-paid or broadband bill in the employee's name",
  },
  {
    id: "meal",
    name: "Meal vouchers",
    monthlyLimit: 2200,
    annualLimit: 26400,
    rule: "Rule 3(7)(iii): ₹50 a meal × 2 meals × 22 working days, issued as non-transferable e-vouchers.",
    proof: "None — loaded on the Pluxee card each month",
  },
  {
    id: "lta",
    name: "Leave travel allowance",
    monthlyLimit: null,
    annualLimit: 30000,
    rule: "Section 10(5): two journeys in the 2026–29 block, economy airfare by the shortest route.",
    proof: "Tickets and boarding passes for the employee and dependants",
  },
  {
    id: "books",
    name: "Books & periodicals",
    monthlyLimit: 1000,
    annualLimit: 12000,
    rule: "Reimbursed against invoices for books, journals and newspapers used for work.",
    proof: "Itemised invoices",
  },
];

export const fbpComponent = (id: FbpComponentId) => FBP_COMPONENTS.find((c) => c.id === id)!;

export const FBP_WINDOW = {
  fy: "FY 2026-27",
  opensOn: "2026-09-01",
  closesOn: "2026-09-30",
  proofsDueOn: "2027-01-31",
  today: DEMO_TODAY,
};

export type FbpDeclarationStatus = "not_started" | "draft" | "submitted" | "approved";

export interface FbpDeclaration {
  employeeCode: string;
  name: string;
  department: string;
  gradeId: string;
  /** Annual FBP basket — half of annual Special Allowance, capped at the sum of limits. */
  basket: number;
  lines: Record<FbpComponentId, number>;
  total: number;
  status: FbpDeclarationStatus;
  submittedOn: string | null;
  overLimit: FbpComponentId[];
  overBasket: boolean;
}

const FBP_LIMIT_TOTAL = sum(FBP_COMPONENTS.map((c) => c.annualLimit));

function buildDeclarations(): FbpDeclaration[] {
  const pool = RUN_POPULATION.filter((e) => e.gradeId !== "G1").filter((_, i) => i % 4 === 0);
  return pool.map((emp, i) => {
    const rng = mulberry32(9100 + i * 37);
    const basket = Math.min(FBP_LIMIT_TOTAL, Math.round((ctcBreakup(emp.gradeId, emp.ctc).special * 12) / 2 / 100) * 100);
    const roll = rng();
    const status: FbpDeclarationStatus =
      roll < 0.12 ? "not_started" : roll < 0.25 ? "draft" : roll < 0.62 ? "submitted" : "approved";
    const lines = {} as Record<FbpComponentId, number>;
    for (const c of FBP_COMPONENTS) {
      if (status === "not_started") {
        lines[c.id] = 0;
        continue;
      }
      const take = rng();
      lines[c.id] = take < 0.2 ? 0 : take > 0.9 ? Math.round((c.annualLimit * 1.35) / 100) * 100 : c.annualLimit;
    }
    const overLimit = FBP_COMPONENTS.filter((c) => lines[c.id] > c.annualLimit).map((c) => c.id);
    const total = sum(Object.values(lines));
    return {
      employeeCode: emp.code,
      name: emp.name,
      department: deptName(emp.departmentId),
      gradeId: emp.gradeId,
      basket,
      lines,
      total,
      status,
      submittedOn: status === "submitted" || status === "approved" ? `2026-09-${String(2 + (i % 13)).padStart(2, "0")}` : null,
      overLimit,
      overBasket: total > basket,
    };
  });
}

export const FBP_DECLARATIONS: FbpDeclaration[] = buildDeclarations();

export type FbpProofStatus = "pending" | "verified" | "rejected";

export interface FbpProof {
  id: string;
  employeeCode: string;
  name: string;
  department: string;
  componentId: FbpComponentId;
  component: string;
  billNo: string;
  billDate: string;
  amount: number;
  file: string;
  submittedOn: string;
  status: FbpProofStatus;
  note: string | null;
  /** Bill is above the monthly limit — only the limit is reimbursable. */
  exceedsMonthly: boolean;
}

const VENDORS: Record<FbpComponentId, string> = {
  fuel: "indian-oil",
  telephone: "airtel-postpaid",
  meal: "pluxee",
  lta: "indigo-boarding-pass",
  books: "sapna-book-house",
};

function buildProofs(): FbpProof[] {
  const out: FbpProof[] = [];
  const eligible = FBP_DECLARATIONS.filter((d) => d.status === "submitted" || d.status === "approved");
  eligible.forEach((d, i) => {
    const rng = mulberry32(7700 + i * 53);
    const claimable = FBP_COMPONENTS.filter((c) => c.id !== "meal" && d.lines[c.id] > 0);
    const n = Math.min(claimable.length, 1 + Math.floor(rng() * 2));
    for (let k = 0; k < n; k++) {
      const c = claimable[(i + k) % claimable.length];
      const monthly = c.monthlyLimit ?? c.annualLimit;
      const over = rng() > 0.85;
      const amount = c.id === "lta" ? Math.round((14000 + rng() * 16000) / 10) * 10 : Math.round(monthly * (over ? 1.2 + rng() * 0.3 : 0.6 + rng() * 0.4));
      const day = 1 + Math.floor(rng() * 14);
      const month = rng() > 0.4 ? "09" : "08";
      const status: FbpProofStatus = month === "08" && rng() > 0.3 ? "verified" : "pending";
      out.push({
        id: `FBP-PRF-${String(out.length + 1).padStart(4, "0")}`,
        employeeCode: d.employeeCode,
        name: d.name,
        department: d.department,
        componentId: c.id,
        component: c.name,
        billNo: `${c.id.slice(0, 3).toUpperCase()}/${month}/${String(1000 + Math.floor(rng() * 9000))}`,
        billDate: `2026-${month}-${String(day).padStart(2, "0")}`,
        amount,
        file: `${VENDORS[c.id]}-${month}-2026.pdf`,
        submittedOn: `2026-09-${String(Math.min(16, 2 + day)).padStart(2, "0")}`,
        status,
        note: status === "verified" ? "Bill matches the declared component and limit." : null,
        exceedsMonthly: c.monthlyLimit !== null && amount > c.monthlyLimit,
      });
    }
  });
  return out;
}

export const FBP_PROOFS: FbpProof[] = buildProofs();
