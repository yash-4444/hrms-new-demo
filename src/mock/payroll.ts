import { format, getDaysInMonth, parseISO } from "date-fns";
import { mulberry32 } from "@/lib/utils";
import { inr, num } from "@/lib/format";
import {
  BRANCHES,
  DEPARTMENTS,
  GRADES,
  TENANT,
  branchById,
  deptById,
  gradeById,
} from "./org";
import { EMPLOYEES, employeeByCode, type Employee } from "./employees";

/* ============================================================================
   PAYROLL — fixtures + the salary engine.

   Every figure on every payroll screen comes out of this file, and the whole
   thing is built so the arithmetic survives an auditor with a calculator:

     • every component amount is a whole rupee (integers, so no float drift)
     • Gross − Deductions = Net for EVERY employee, by construction
     • a run's totals are the SUM of its rows, never an independent estimate
     • Special Allowance is the balancing figure, so
       Basic + HRA + Conveyance + Medical + LTA + Perf + Special = target gross
     • verifyRun() re-checks all of the above and is exported so the claim can
       be run, not just asserted.

   Deterministic only — mulberry32 with fixed seeds, no Math.random, no
   new Date() at module scope. "Today" is DEMO_TODAY (2026-09-16).
   ========================================================================== */

/* -------------------------------------------------------- statutory rates */

export const PF_RATE = 0.12;
/** Employee PF is capped at ₹1,800/month (12% of the ₹15,000 wage ceiling). */
export const PF_MONTHLY_CAP = 1800;
export const PF_WAGE_CEILING = 15000;
export const ESI_EMPLOYEE_RATE = 0.0075;
export const ESI_EMPLOYER_RATE = 0.0325;
export const ESI_GROSS_CEILING = 21000;
export const GRATUITY_RATE = 0.0481;
export const STANDARD_DEDUCTION = 75000;
export const CESS_RATE = 0.04;
/** Section 87A — no tax where total taxable income is at or below this. */
export const REBATE_87A_CEILING = 1200000;

export interface TaxSlab {
  from: number;
  to: number | null;
  rate: number;
}

/** New regime, FY 2026-27. */
export const TAX_SLABS: TaxSlab[] = [
  { from: 0, to: 400000, rate: 0 },
  { from: 400000, to: 800000, rate: 0.05 },
  { from: 800000, to: 1200000, rate: 0.1 },
  { from: 1200000, to: 1600000, rate: 0.15 },
  { from: 1600000, to: 2000000, rate: 0.2 },
  { from: 2000000, to: 2400000, rate: 0.25 },
  { from: 2400000, to: null, rate: 0.3 },
];

export interface PtSlab {
  state: string;
  branchIds: string[];
  rule: string;
  bands: { label: string; amount: string }[];
}

/** Professional tax is a state levy — the demo runs three Indian states. */
export const PT_SLABS: PtSlab[] = [
  {
    state: "Karnataka",
    branchIds: ["BLR"],
    rule: "₹200 per month where monthly gross is ₹25,000 or more; nil below.",
    bands: [
      { label: "Gross below ₹25,000", amount: "Nil" },
      { label: "Gross ₹25,000 and above", amount: "₹200 / month" },
    ],
  },
  {
    state: "Maharashtra",
    branchIds: ["PNQ"],
    rule: "Slab by monthly gross, with ₹300 in February so the annual total lands on the ₹2,500 cap.",
    bands: [
      { label: "Gross up to ₹7,500", amount: "Nil" },
      { label: "Gross ₹7,501 – ₹10,000", amount: "₹175 / month" },
      { label: "Gross above ₹10,000", amount: "₹200 / month (₹300 in February)" },
    ],
  },
  {
    state: "Telangana",
    branchIds: ["HYD"],
    rule: "₹200 per month where monthly gross is ₹20,000 or more; nil below.",
    bands: [
      { label: "Gross below ₹20,000", amount: "Nil" },
      { label: "Gross ₹20,000 and above", amount: "₹200 / month" },
    ],
  },
  {
    state: "United States (New Jersey)",
    branchIds: ["EWR"],
    rule: "Not applicable — professional tax is an Indian state levy. Newark staff are withheld on the US payroll.",
    bands: [{ label: "All salaries", amount: "Not applicable" }],
  },
];

const PAYROLL_STATE: Record<string, { state: string; country: "IN" | "US" }> = {
  BLR: { state: "Karnataka", country: "IN" },
  PNQ: { state: "Maharashtra", country: "IN" },
  HYD: { state: "Telangana", country: "IN" },
  EWR: { state: "New Jersey", country: "US" },
};

/* ------------------------------------------------------- salary structures */

export type ComponentBasis = "pct_ctc" | "pct_basic" | "fixed" | "balance";
export type ComponentGroup = "earning" | "statutory" | "deduction" | "employer";

export interface StructureComponent {
  code: string;
  label: string;
  group: Extract<ComponentGroup, "earning" | "employer">;
  basis: ComponentBasis;
  /** Percentage points for pct_*, rupees per month for fixed. */
  value: number;
  formula: string;
  taxable: boolean;
  note?: string;
}

export interface SalaryStructure {
  id: string;
  gradeId: string;
  name: string;
  description: string;
  effectiveFrom: string;
  ctcBand: { min: number; max: number };
  employeeCount: number;
  components: StructureComponent[];
}

const EARNING_BASE: StructureComponent[] = [
  {
    code: "BASIC",
    label: "Basic Salary",
    group: "earning",
    basis: "pct_ctc",
    value: 40,
    formula: "40% of CTC ÷ 12",
    taxable: true,
    note: "Drives PF, gratuity and the LOP per-day rate.",
  },
  {
    code: "HRA",
    label: "House Rent Allowance",
    group: "earning",
    basis: "pct_basic",
    value: 50,
    formula: "50% of Basic",
    taxable: true,
    note: "Metro rate. Exemption is claimed at year end, not at source in this demo.",
  },
  {
    code: "CONV",
    label: "Conveyance Allowance",
    group: "earning",
    basis: "fixed",
    value: 1600,
    formula: "Flat ₹1,600 per month",
    taxable: true,
  },
  {
    code: "MED",
    label: "Medical Allowance",
    group: "earning",
    basis: "fixed",
    value: 1250,
    formula: "Flat ₹1,250 per month",
    taxable: true,
  },
  {
    code: "LTA",
    label: "Leave Travel Allowance",
    group: "earning",
    basis: "pct_basic",
    value: 8.33,
    formula: "8.33% of Basic",
    taxable: true,
  },
];

const PERF_COMPONENT = (pct: number): StructureComponent => ({
  code: "PERF",
  label: "Performance Pay",
  group: "earning",
  basis: "pct_ctc",
  value: pct,
  formula: `${pct}% of CTC ÷ 12`,
  taxable: true,
  note: "Monthly provision. Settled against the annual bonus payout in March.",
});

const SPECIAL_COMPONENT: StructureComponent = {
  code: "SPL",
  label: "Special Allowance",
  group: "earning",
  basis: "balance",
  value: 0,
  formula: "Target gross − all other earnings (balancing figure)",
  taxable: true,
  note: "Absorbs rounding so the components always add back to the target gross.",
};

const EMPLOYER_COMPONENTS: StructureComponent[] = [
  {
    code: "EPF",
    label: "Provident Fund — employer",
    group: "employer",
    basis: "pct_basic",
    value: 12,
    formula: "min(Basic × 12%, ₹1,800)",
    taxable: false,
  },
  {
    code: "EESI",
    label: "ESI — employer",
    group: "employer",
    basis: "pct_basic",
    value: 3.25,
    formula: "Gross × 3.25% where Gross ≤ ₹21,000, else nil",
    taxable: false,
  },
  {
    code: "GRAT",
    label: "Gratuity provision",
    group: "employer",
    basis: "pct_basic",
    value: 4.81,
    formula: "Basic × 4.81%",
    taxable: false,
  },
];

/** Performance pay is what separates the senior templates from the junior ones. */
const PERF_PCT_BY_GRADE: Record<string, number> = { G5: 6, G6: 8, G7: 10 };

const STRUCTURE_BLURB: Record<string, string> = {
  G1: "Entry template for associates. No variable pay — the whole CTC is fixed monthly cash.",
  G2: "Standard individual-contributor template used by the largest population in the tenant.",
  G3: "Senior IC template. Identical shape to G2; the band is what moves.",
  G4: "Lead template. Still fully fixed, sized for the ₹18L – ₹30L band.",
  G5: "Manager template — introduces a 6% monthly performance-pay provision.",
  G6: "Director template with an 8% performance-pay provision.",
  G7: "Executive leadership template with a 10% performance-pay provision.",
};

export const SALARY_STRUCTURES: SalaryStructure[] = GRADES.map((g) => {
  const perfPct = PERF_PCT_BY_GRADE[g.id];
  return {
    id: `STR-${g.id}`,
    gradeId: g.id,
    name: `${g.label} — India standard`,
    description: STRUCTURE_BLURB[g.id] ?? "Standard India salary template.",
    effectiveFrom: "2026-04-01",
    ctcBand: { min: g.minCtc, max: g.maxCtc },
    employeeCount: EMPLOYEES.filter((e) => e.gradeId === g.id).length,
    components: [
      ...EARNING_BASE,
      ...(perfPct ? [PERF_COMPONENT(perfPct)] : []),
      SPECIAL_COMPONENT,
      ...EMPLOYER_COMPONENTS,
    ],
  };
});

export const structureForGrade = (gradeId: string) =>
  SALARY_STRUCTURES.find((s) => s.gradeId === gradeId) ?? SALARY_STRUCTURES[1];

/* ------------------------------------------------------------- the breakup */

export interface Breakup {
  annualCtc: number;
  monthlyCtc: number;
  basic: number;
  hra: number;
  conveyance: number;
  medical: number;
  lta: number;
  perf: number;
  perfPct: number;
  special: number;
  /** Basic + HRA + Conveyance + Medical + LTA + Perf + Special. */
  gross: number;
  employerPf: number;
  employerEsi: number;
  gratuity: number;
  employerTotal: number;
}

/**
 * The single place the CTC is split. Everything else — the pay runs, the
 * payslips, the structures preview — calls this, so the three screens can
 * never disagree with each other.
 */
/** The knobs the component builder on /payroll/structures can turn. */
export interface ComponentRates {
  basicPct: number;
  hraPct: number;
  conveyance: number;
  medical: number;
  ltaPct: number;
  perfPct: number;
}

export function ratesForGrade(gradeId: string): ComponentRates {
  return {
    basicPct: 40,
    hraPct: 50,
    conveyance: 1600,
    medical: 1250,
    ltaPct: 8.33,
    perfPct: PERF_PCT_BY_GRADE[gradeId] ?? 0,
  };
}

const breakupCache = new Map<string, Breakup>();

export function ctcBreakup(gradeId: string, annualCtc: number): Breakup {
  const key = `${gradeId}|${annualCtc}`;
  const cached = breakupCache.get(key);
  if (cached) return cached;
  const out = computeBreakup(ratesForGrade(gradeId), annualCtc);
  breakupCache.set(key, out);
  return out;
}

export function computeBreakup(rates: ComponentRates, annualCtc: number): Breakup {
  const monthlyCtc = Math.round(annualCtc / 12);
  const basic = Math.round(monthlyCtc * (rates.basicPct / 100));
  const hra = Math.round(basic * (rates.hraPct / 100));
  const conveyance = Math.round(rates.conveyance);
  const medical = Math.round(rates.medical);
  const lta = Math.round(basic * (rates.ltaPct / 100));
  const perfPct = rates.perfPct;
  const perf = perfPct ? Math.round(monthlyCtc * (perfPct / 100)) : 0;

  const employerPf = Math.min(Math.round(basic * PF_RATE), PF_MONTHLY_CAP);
  const gratuity = Math.round(basic * GRATUITY_RATE);

  /* Target gross is what is left of the monthly CTC once the employer-side
     costs that live inside it are carved out. Employer ESI is itself a
     percentage of gross, so it is solved in closed form rather than layered
     on top — otherwise the breakup would not add back to the CTC. */
  const beforeEsi = monthlyCtc - employerPf - gratuity;
  const employerEsi =
    beforeEsi <= ESI_GROSS_CEILING
      ? beforeEsi - Math.round(beforeEsi / (1 + ESI_EMPLOYER_RATE))
      : 0;
  const targetGross = beforeEsi - employerEsi;
  const special = targetGross - (basic + hra + conveyance + medical + lta + perf);
  const gross = basic + hra + conveyance + medical + lta + perf + special;

  return {
    annualCtc,
    monthlyCtc,
    basic,
    hra,
    conveyance,
    medical,
    lta,
    perf,
    perfPct,
    special,
    gross,
    employerPf,
    employerEsi,
    gratuity,
    employerTotal: employerPf + employerEsi + gratuity,
  };
}

/* ------------------------------------------------------------ tax + PT */

export interface SlabHit {
  from: number;
  to: number | null;
  rate: number;
  slice: number;
  tax: number;
}

export interface TaxResult {
  annualGross: number;
  annualTaxable: number;
  hits: SlabHit[];
  slabTax: number;
  rebateApplied: boolean;
  marginalReliefApplied: boolean;
  taxAfterRebate: number;
  cess: number;
  annualTax: number;
  monthly: number;
}

const tdsCache = new Map<number, TaxResult>();

export function computeTds(annualGross: number): TaxResult {
  const cached = tdsCache.get(annualGross);
  if (cached) return cached;
  const out = runTds(annualGross);
  tdsCache.set(annualGross, out);
  return out;
}

function runTds(annualGross: number): TaxResult {
  const annualTaxable = Math.max(0, annualGross - STANDARD_DEDUCTION);
  const hits: SlabHit[] = [];
  let slabTax = 0;
  for (const s of TAX_SLABS) {
    const upper = s.to ?? Number.MAX_SAFE_INTEGER;
    const slice = Math.max(0, Math.min(annualTaxable, upper) - s.from);
    if (slice <= 0) continue;
    const tax = slice * s.rate;
    slabTax += tax;
    hits.push({ from: s.from, to: s.to, rate: s.rate, slice, tax });
  }

  let taxAfterRebate = slabTax;
  let rebateApplied = false;
  let marginalReliefApplied = false;
  if (annualTaxable <= REBATE_87A_CEILING) {
    taxAfterRebate = 0;
    rebateApplied = annualTaxable > 0;
  } else if (slabTax > annualTaxable - REBATE_87A_CEILING) {
    /* Marginal relief — tax can never exceed the income above the rebate line. */
    taxAfterRebate = annualTaxable - REBATE_87A_CEILING;
    marginalReliefApplied = true;
  }

  const cess = taxAfterRebate * CESS_RATE;
  const annualTax = Math.round(taxAfterRebate + cess);
  return {
    annualGross,
    annualTaxable,
    hits,
    slabTax: Math.round(slabTax),
    rebateApplied,
    marginalReliefApplied,
    taxAfterRebate: Math.round(taxAfterRebate),
    cess: Math.round(cess),
    annualTax,
    monthly: Math.round(annualTax / 12),
  };
}

export interface PtResult {
  amount: number;
  state: string;
  country: "IN" | "US";
  rule: string;
}

export function computeProfessionalTax(
  branchId: string,
  gross: number,
  calendarMonth: number,
): PtResult {
  const s = PAYROLL_STATE[branchId] ?? PAYROLL_STATE.BLR;
  if (s.country === "US") {
    return {
      amount: 0,
      state: s.state,
      country: "US",
      rule: "United States — professional tax is an Indian state levy and does not apply.",
    };
  }
  if (s.state === "Maharashtra") {
    if (gross <= 7500)
      return { amount: 0, state: s.state, country: "IN", rule: "Gross up to ₹7,500 — nil." };
    if (gross <= 10000)
      return { amount: 175, state: s.state, country: "IN", rule: "Gross ₹7,501 – ₹10,000 — ₹175." };
    return {
      amount: calendarMonth === 2 ? 300 : 200,
      state: s.state,
      country: "IN",
      rule:
        calendarMonth === 2
          ? "Gross above ₹10,000 — ₹300 in February, which tops the year up to the ₹2,500 cap."
          : "Gross above ₹10,000 — ₹200 per month (₹300 in February).",
    };
  }
  const telangana = s.state === "Telangana";
  const floor = telangana ? 20000 : 25000;
  return {
    amount: gross >= floor ? 200 : 0,
    state: s.state,
    country: "IN",
    rule: `${s.state} — ₹200 per month where monthly gross is ₹${telangana ? "20,000" : "25,000"} or more.`,
  };
}

/* ------------------------------------------------------------- pay periods */

export type PayRunStatus = "draft" | "calculated" | "locked" | "approved" | "paid";

export const RUN_STEPS: PayRunStatus[] = [
  "draft",
  "calculated",
  "locked",
  "approved",
  "paid",
];

export const RUN_STEP_META: Record<PayRunStatus, { label: string; blurb: string }> = {
  draft: { label: "Draft", blurb: "Inputs collected — attendance, LOP, arrears and one-time payments." },
  calculated: { label: "Calculated", blurb: "Engine run. Every component resolved; exceptions raised." },
  locked: { label: "Locked", blurb: "Inputs frozen. No further changes without a re-open." },
  approved: { label: "Approved", blurb: "Signed off by Finance. Bank advice file generated." },
  paid: { label: "Paid", blurb: "Disbursed to employee accounts; payslips published." },
};

export interface PayPeriod {
  /** "2026-09" */
  id: string;
  /** "PR-2026-09" — the pay run this period was processed under. */
  runId: string;
  label: string;
  shortLabel: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  daysInMonth: number;
  calendarMonth: number;
  /** 1 = April, the tenant's FY start month. */
  monthIndexInFy: number;
  fy: string;
  status: PayRunStatus;
  seed: number;
}

function monthLabel(y: number, m: number) {
  return format(parseISO(`${y}-${String(m).padStart(2, "0")}-01`), "MMMM yyyy");
}

function fyFor(y: number, m: number) {
  const start = m >= TENANT.fyStartMonth ? y : y - 1;
  return `FY ${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

function buildPeriods(): PayPeriod[] {
  const out: PayPeriod[] = [];
  /* 12 months ending September 2026, the month DEMO_TODAY sits in. */
  for (let back = 11; back >= 0; back--) {
    const total = 2026 * 12 + (9 - 1) - back;
    const y = Math.floor(total / 12);
    const m = (total % 12) + 1;
    const id = `${y}-${String(m).padStart(2, "0")}`;
    const start = `${id}-01`;
    const dim = getDaysInMonth(parseISO(start));
    const end = `${id}-${String(dim).padStart(2, "0")}`;
    out.push({
      id,
      runId: `PR-${id}`,
      label: monthLabel(y, m),
      shortLabel: format(parseISO(start), "MMM yy"),
      periodStart: start,
      periodEnd: end,
      payDate: end,
      daysInMonth: dim,
      calendarMonth: m,
      monthIndexInFy: ((m - TENANT.fyStartMonth + 12) % 12) + 1,
      fy: fyFor(y, m),
      /* September 2026 is still open — everything before it has been paid. */
      status: id === "2026-09" ? "calculated" : "paid",
      seed: y * 100 + m,
    });
  }
  return out;
}

export const PAY_PERIODS: PayPeriod[] = buildPeriods();
export const periodById = (id: string) =>
  PAY_PERIODS.find((p) => p.id === id || p.runId === id);

/** The two runs the Payroll module puts on screen. */
export const CURRENT_PERIOD = periodById("2026-09")!;
export const PREVIOUS_PERIOD = periodById("2026-08")!;

/* ------------------------------------------------------------- exceptions */

export type ExceptionType = "missing_bank" | "lop_exceeds" | "negative_net";

export const EXCEPTION_META: Record<
  ExceptionType,
  { label: string; severity: "critical" | "warning"; blurb: string }
> = {
  missing_bank: {
    label: "Missing bank details",
    severity: "critical",
    blurb: "No verified account on file — the bank advice file cannot be generated.",
  },
  lop_exceeds: {
    label: "LOP exceeds payable days",
    severity: "critical",
    blurb: "Loss-of-pay days are greater than the days payable in the period.",
  },
  negative_net: {
    label: "Negative net pay",
    severity: "critical",
    blurb: "Recoveries are larger than the earnings for the period.",
  },
};

/** Hand-picked so the three exception stories are stable across reloads. */
const EXCEPTION_CASES = {
  /* One of the three employees carrying hasBankDetails === false. */
  missing_bank: "STL-0094",
  /* Advance instalment mis-keyed as the full outstanding balance. */
  negative_net: "STL-0052",
  /* 31 LOP days recorded against a 30-day September. */
  lop_exceeds: "STL-0113",
} as const;

/**
 * Penny-drop bank verification register. Three employees carry
 * hasBankDetails === false on their profile; two of them were verified during
 * the pre-run check, so only one still blocks the September run.
 */
export const BANK_VERIFICATION: Record<string, { verifiedOn: string; method: string } | null> = {
  "STL-0094": null,
  "STL-0095": { verifiedOn: "2026-09-09", method: "Penny drop — HDFC, ₹1.00 credited and matched" },
  "STL-0326": { verifiedOn: "2026-09-12", method: "Penny drop — ICICI, ₹1.00 credited and matched" },
};

export const bankVerified = (code: string) =>
  employeeByCode(code)?.hasBankDetails === true || Boolean(BANK_VERIFICATION[code]);

const FORCED_ADVANCE = 52000;
const FORCED_LOP_DAYS = 31;

/* --------------------------------------------------- population of a run */

/** The India payroll. Newark staff are paid on the US payroll, out of scope. */
export const RUN_POPULATION: Employee[] = EMPLOYEES.filter(
  (e) => e.status !== "exited" && (branchById(e.branchId)?.country ?? "IN") === "IN",
);

export const OUT_OF_SCOPE_COUNT = EMPLOYEES.length - RUN_POPULATION.length;

/**
 * Whether a period's regular run pays this employee: on roll by the period end
 * (a joining month is pro-rated in computeAmounts), and not leaving inside or
 * before it — a leaver's final month is settled through full & final
 * (mock/lifecycle-fnf.ts), so the regular run must not pay it a second time.
 */
export function onRunRoll(period: PayPeriod, emp: Employee) {
  if (emp.joiningDate > period.periodEnd) return false;
  return !emp.exitDate || emp.exitDate > period.periodEnd;
}

const populationCache = new Map<string, Employee[]>();

/** The employees one period's run actually pays — the population every run output sums over. */
export function runPopulation(periodId: string): Employee[] {
  const period = periodById(periodId);
  if (!period) return [];
  const hit = populationCache.get(period.id);
  if (hit) return hit;
  const out = RUN_POPULATION.filter((e) => onRunRoll(period, e));
  populationCache.set(period.id, out);
  return out;
}

/** India employees whose last working day falls inside the period — paid through F&F instead. */
export const leaversIn = (period: PayPeriod) =>
  RUN_POPULATION.filter(
    (e) => e.exitDate && e.exitDate >= period.periodStart && e.exitDate <= period.periodEnd,
  );

const EMP_INDEX = new Map(EMPLOYEES.map((e, i) => [e.code, i]));

interface Variables {
  lopDays: number;
  overtimeHours: number;
  overtime: number;
  arrears: number;
  advance: number;
}

/** Per-employee, per-period inputs. Seeded, so August and September differ. */
function variablesFor(period: PayPeriod, emp: Employee, breakup: Breakup): Variables {
  const rng = mulberry32(period.seed * 100003 + (EMP_INDEX.get(emp.code) ?? 0) * 7919 + 17);
  const a = rng();
  const b = rng();
  const c = rng();
  const d = rng();

  let lopDays = 0;
  if (a > 0.92) lopDays = Math.round((0.5 + rng() * 2.5) * 2) / 2;

  let overtimeHours = 0;
  if (emp.level === 3 && b > 0.86) overtimeHours = Math.round(4 + rng() * 14);
  const hourly = breakup.basic / (period.daysInMonth * 8);
  const overtime = overtimeHours ? Math.round(overtimeHours * hourly * 2) : 0;

  const arrears = c > 0.965 ? Math.round((breakup.gross * (0.04 + rng() * 0.09)) / 100) * 100 : 0;
  const advance = d > 0.955 ? Math.round((5000 + rng() * 15000) / 500) * 500 : 0;

  /* A joiner is only on roll from the joining day: the joining month carries
     no LOP, overtime, arrears or advance. The draws above still run, so every
     other month keeps the same seeded sequence. */
  if (emp.joiningDate.slice(0, 7) === period.id)
    return { lopDays: 0, overtimeHours: 0, overtime: 0, arrears: 0, advance: 0 };

  const forced = period.id === "2026-09";
  return {
    lopDays: forced && emp.code === EXCEPTION_CASES.lop_exceeds ? FORCED_LOP_DAYS : lopDays,
    overtimeHours,
    overtime,
    arrears,
    advance: forced && emp.code === EXCEPTION_CASES.negative_net ? FORCED_ADVANCE : advance,
  };
}

/* ------------------------------------------------------- numeric engine */

export interface Amounts {
  period: PayPeriod;
  employee: Employee;
  breakup: Breakup;

  daysInMonth: number;
  /** Days the employee is on roll in this period (pro-rated for a mid-month join). */
  payableDays: number;
  lopDays: number;
  paidDays: number;
  prorated: boolean;
  factor: number;
  perDayRate: number;

  basic: number;
  hra: number;
  conveyance: number;
  medical: number;
  lta: number;
  perf: number;
  special: number;
  overtime: number;
  overtimeHours: number;
  arrears: number;

  /** Earned fixed gross, before overtime and arrears. */
  grossFixed: number;
  gross: number;

  pf: number;
  esi: number;
  pt: number;
  ptResult: PtResult;
  tds: number;
  tax: TaxResult;
  lop: number;
  advance: number;

  statutoryTotal: number;
  otherTotal: number;
  deductions: number;
  net: number;

  employerPf: number;
  employerEsi: number;
  gratuity: number;
  employerTotal: number;
  costToCompany: number;

  monthsWorkedInFy: number;
  exceptionType: ExceptionType | null;
}

function monthsWorkedInFy(period: PayPeriod, joiningDate: string) {
  const joinKey = joiningDate.slice(0, 7);
  const fyStartYear =
    period.calendarMonth >= TENANT.fyStartMonth
      ? Number(period.id.slice(0, 4))
      : Number(period.id.slice(0, 4)) - 1;
  const fyStartKey = `${fyStartYear}-${String(TENANT.fyStartMonth).padStart(2, "0")}`;
  const from = joinKey > fyStartKey ? joinKey : fyStartKey;
  const months =
    (Number(period.id.slice(0, 4)) * 12 + period.calendarMonth) -
    (Number(from.slice(0, 4)) * 12 + Number(from.slice(5, 7))) +
    1;
  return Math.max(1, months);
}

/**
 * Numbers only — no trace strings. Run rows, run totals and the cost trend all
 * go through here, so they are cheap enough to compute for every employee in
 * every one of the twelve periods.
 */
export function computeAmounts(period: PayPeriod, emp: Employee): Amounts {
  const breakup = ctcBreakup(emp.gradeId, emp.ctc);
  const daysInMonth = period.daysInMonth;

  /* Mid-month joiner → only the days from joining are payable. */
  const joinedThisPeriod = emp.joiningDate.slice(0, 7) === period.id;
  const joinDay = joinedThisPeriod ? Number(emp.joiningDate.slice(8, 10)) : 1;
  const payableDays = daysInMonth - (joinDay - 1);
  const factor = payableDays / daysInMonth;
  const prorated = payableDays < daysInMonth;

  const v = variablesFor(period, emp, breakup);

  const scale = (n: number) => (prorated ? Math.round(n * factor) : n);
  const basic = scale(breakup.basic);
  const hra = scale(breakup.hra);
  const conveyance = scale(breakup.conveyance);
  const medical = scale(breakup.medical);
  const lta = scale(breakup.lta);
  const perf = scale(breakup.perf);
  /* Special allowance stays the balancing figure after pro-ration too, so
     the earned gross is exactly round(target gross × factor). */
  const grossFixed = prorated ? Math.round(breakup.gross * factor) : breakup.gross;
  const special = grossFixed - (basic + hra + conveyance + medical + lta + perf);

  const gross = grossFixed + v.overtime + v.arrears;

  const pf = Math.min(Math.round(basic * PF_RATE), PF_MONTHLY_CAP);
  const esi = gross <= ESI_GROSS_CEILING ? Math.round(gross * ESI_EMPLOYEE_RATE) : 0;
  const ptResult = computeProfessionalTax(emp.branchId, gross, period.calendarMonth);
  const tax = computeTds(breakup.gross * 12);
  /* A joining month withholds only its share of the monthly tax — a joiner on
     the 31st must not have a month's TDS taken from one day's salary. */
  const tds = ptResult.country === "US" ? 0 : prorated ? Math.round(tax.monthly * factor) : tax.monthly;

  const perDayRate = grossFixed / payableDays;
  const lop = v.lopDays > 0 ? Math.round(perDayRate * v.lopDays) : 0;

  const statutoryTotal = pf + esi + ptResult.amount + tds;
  const otherTotal = lop + v.advance;
  const deductions = statutoryTotal + otherTotal;
  const net = gross - deductions;

  const employerPf = Math.min(Math.round(basic * PF_RATE), PF_MONTHLY_CAP);
  const employerEsi = gross <= ESI_GROSS_CEILING ? Math.round(gross * ESI_EMPLOYER_RATE) : 0;
  const gratuity = Math.round(basic * GRATUITY_RATE);
  const employerTotal = employerPf + employerEsi + gratuity;

  /* One exception per employee, highest severity first — so an employee whose
     LOP overruns the month is reported as an LOP failure, not twice. */
  let exceptionType: ExceptionType | null = null;
  if (period.id === "2026-09") {
    if (!bankVerified(emp.code)) exceptionType = "missing_bank";
    else if (v.lopDays > payableDays) exceptionType = "lop_exceeds";
    else if (net < 0) exceptionType = "negative_net";
  }

  return {
    period,
    employee: emp,
    breakup,
    daysInMonth,
    payableDays,
    lopDays: v.lopDays,
    paidDays: Math.max(0, payableDays - v.lopDays),
    prorated,
    factor,
    perDayRate,
    basic,
    hra,
    conveyance,
    medical,
    lta,
    perf,
    special,
    overtime: v.overtime,
    overtimeHours: v.overtimeHours,
    arrears: v.arrears,
    grossFixed,
    gross,
    pf,
    esi,
    pt: ptResult.amount,
    ptResult,
    tds,
    tax,
    lop,
    advance: v.advance,
    statutoryTotal,
    otherTotal,
    deductions,
    net,
    employerPf,
    employerEsi,
    gratuity,
    employerTotal,
    costToCompany: gross + employerTotal,
    monthsWorkedInFy: monthsWorkedInFy(period, emp.joiningDate),
    exceptionType,
  };
}

/* ------------------------------------------------------- traced components */

export interface ComponentTrace {
  /** Line 1 — the rule, in symbols. */
  formula: string;
  /** Line 2 — the same rule with every input resolved. */
  substituted: string;
  /** Line 3 — the output. */
  result: string;
  inputs: { label: string; value: string }[];
  note?: string;
}

export interface PayComponent {
  code: string;
  label: string;
  group: ComponentGroup;
  amount: number;
  ytd: number;
  taxable: boolean;
  trace: ComponentTrace;
}

const pctText = (p: number) => `${Number(p.toFixed(2))}%`;

function proTail(a: Amounts) {
  return a.prorated
    ? ` × ${a.payableDays}/${a.daysInMonth} pro-rata`
    : "";
}

function proSub(a: Amounts, base: number) {
  return a.prorated ? ` × ${a.payableDays}/${a.daysInMonth} (${inr(base)} full month)` : "";
}

function ytdOf(a: Amounts, fullMonthAmount: number, thisMonth: number) {
  return fullMonthAmount * (a.monthsWorkedInFy - 1) + thisMonth;
}

function earning(
  a: Amounts,
  code: string,
  label: string,
  amount: number,
  fullMonth: number,
  trace: ComponentTrace,
): PayComponent {
  return {
    code,
    label,
    group: "earning",
    amount,
    ytd: ytdOf(a, fullMonth, amount),
    taxable: true,
    trace,
  };
}

function buildEarnings(a: Amounts): PayComponent[] {
  const b = a.breakup;
  const out: PayComponent[] = [
    earning(a, "BASIC", "Basic Salary", a.basic, b.basic, {
      formula: `Basic = 40% × (Annual CTC ÷ 12)${proTail(a)}`,
      substituted: `40% × (${inr(b.annualCtc)} ÷ 12) = 40% × ${inr(b.monthlyCtc)}${proSub(a, b.basic)}`,
      result: inr(a.basic),
      inputs: [
        { label: "Annual CTC", value: inr(b.annualCtc) },
        { label: "Monthly CTC", value: inr(b.monthlyCtc) },
        { label: "Basic %", value: "40%" },
      ],
      note: "Basic drives PF, gratuity and the loss-of-pay per-day rate.",
    }),
    earning(a, "HRA", "House Rent Allowance", a.hra, b.hra, {
      formula: `HRA = Basic × 50%${proTail(a)}`,
      substituted: `${inr(b.basic)} × 50%${proSub(a, b.hra)}`,
      result: inr(a.hra),
      inputs: [
        { label: "Basic (full month)", value: inr(b.basic) },
        { label: "HRA rate", value: "50% (metro)" },
      ],
      note: "Exemption under section 10(13A) is settled at year-end proof submission, not at source.",
    }),
    earning(a, "CONV", "Conveyance Allowance", a.conveyance, b.conveyance, {
      formula: `Conveyance = ₹1,600 flat per month${proTail(a)}`,
      substituted: `${inr(1600)}${proSub(a, b.conveyance)}`,
      result: inr(a.conveyance),
      inputs: [{ label: "Policy rate", value: `${inr(1600)} / month` }],
    }),
    earning(a, "MED", "Medical Allowance", a.medical, b.medical, {
      formula: `Medical = ₹1,250 flat per month${proTail(a)}`,
      substituted: `${inr(1250)}${proSub(a, b.medical)}`,
      result: inr(a.medical),
      inputs: [{ label: "Policy rate", value: `${inr(1250)} / month` }],
    }),
    earning(a, "LTA", "Leave Travel Allowance", a.lta, b.lta, {
      formula: `LTA = Basic × 8.33%${proTail(a)}`,
      substituted: `${inr(b.basic)} × 8.33%${proSub(a, b.lta)}`,
      result: inr(a.lta),
      inputs: [
        { label: "Basic (full month)", value: inr(b.basic) },
        { label: "LTA rate", value: "8.33%" },
      ],
      note: "One month of Basic spread across the year.",
    }),
  ];

  if (b.perf > 0) {
    out.push(
      earning(a, "PERF", "Performance Pay", a.perf, b.perf, {
        formula: `Performance Pay = ${pctText(b.perfPct)} × (Annual CTC ÷ 12)${proTail(a)}`,
        substituted: `${pctText(b.perfPct)} × ${inr(b.monthlyCtc)}${proSub(a, b.perf)}`,
        result: inr(a.perf),
        inputs: [
          { label: "Grade", value: gradeById(a.employee.gradeId)?.label ?? a.employee.gradeId },
          { label: "Provision rate", value: pctText(b.perfPct) },
        ],
        note: "Monthly provision, trued up against the annual bonus payout in March.",
      }),
    );
  }

  out.push(
    earning(a, "SPL", "Special Allowance", a.special, b.special, {
      formula: "Special = Target gross − (Basic + HRA + Conveyance + Medical + LTA + Performance Pay)",
      substituted: `${inr(a.grossFixed)} − (${[a.basic, a.hra, a.conveyance, a.medical, a.lta]
        .concat(a.perf > 0 ? [a.perf] : [])
        .map((n) => num(n))
        .join(" + ")}) = ${inr(a.grossFixed)} − ${inr(a.grossFixed - a.special)}`,
      result: inr(a.special),
      inputs: [
        { label: "Target gross", value: inr(a.grossFixed) },
        { label: "Named earnings", value: inr(a.grossFixed - a.special) },
      ],
      note: "The balancing figure — it absorbs rounding so the earnings always add back to the target gross exactly.",
    }),
  );

  if (a.overtime > 0) {
    const hourly = b.basic / (a.daysInMonth * 8);
    out.push({
      code: "OT",
      label: "Overtime",
      group: "earning",
      amount: a.overtime,
      ytd: a.overtime,
      taxable: true,
      trace: {
        formula: "Overtime = Approved hours × (Basic ÷ (days in month × 8)) × 2",
        substituted: `${a.overtimeHours} × (${inr(b.basic)} ÷ ${a.daysInMonth * 8}) × 2 = ${a.overtimeHours} × ${inr(
          Math.round(hourly),
        )} × 2`,
        result: inr(a.overtime),
        inputs: [
          { label: "Approved hours", value: `${a.overtimeHours} h` },
          { label: "Hourly rate on Basic", value: inr(Math.round(hourly)) },
          { label: "Multiplier", value: "2.0× (statutory)" },
        ],
        note: "Hours come from the approved overtime report on team attendance.",
      },
    });
  }

  if (a.arrears > 0) {
    out.push({
      code: "ARR",
      label: "Arrears",
      group: "earning",
      amount: a.arrears,
      ytd: a.arrears,
      taxable: true,
      trace: {
        formula: "Arrears = Revision differential carried forward from the prior period",
        substituted: `Approved revision differential = ${inr(a.arrears)}`,
        result: inr(a.arrears),
        inputs: [
          { label: "Source", value: "Mid-cycle salary revision" },
          { label: "Periods covered", value: "1 month" },
        ],
        note: "Taxed in the month of payment; no section 89 relief has been claimed.",
      },
    });
  }

  return out;
}

function buildStatutory(a: Amounts): PayComponent[] {
  const b = a.breakup;
  const rawPf = Math.round(a.basic * PF_RATE);
  const pfFull = Math.min(Math.round(b.basic * PF_RATE), PF_MONTHLY_CAP);

  const pf: PayComponent = {
    code: "PF",
    label: "Provident Fund (employee)",
    group: "statutory",
    amount: a.pf,
    ytd: ytdOf(a, pfFull, a.pf),
    taxable: false,
    trace: {
      formula: "PF = min(Basic × 12%, ₹1,800)",
      substituted: `min(${inr(a.basic)} × 12%, ${inr(PF_MONTHLY_CAP)}) = min(${inr(rawPf)}, ${inr(
        PF_MONTHLY_CAP,
      )})`,
      result: inr(a.pf),
      inputs: [
        { label: "Basic (earned)", value: inr(a.basic) },
        { label: "Employee rate", value: "12%" },
        { label: "Statutory cap", value: `${inr(PF_MONTHLY_CAP)} — 12% of the ${inr(PF_WAGE_CEILING)} wage ceiling` },
      ],
      note:
        rawPf > PF_MONTHLY_CAP
          ? `Capped: 12% of Basic is ${inr(rawPf)}, the statutory maximum is ${inr(PF_MONTHLY_CAP)}.`
          : "Below the wage ceiling, so the full 12% applies.",
    },
  };

  const esiRaw = Math.round(a.gross * ESI_EMPLOYEE_RATE);
  const esi: PayComponent = {
    code: "ESI",
    label: "Employee State Insurance",
    group: "statutory",
    amount: a.esi,
    ytd: ytdOf(a, 0, a.esi),
    taxable: false,
    trace: {
      formula: `ESI = Gross × 0.75% where Gross ≤ ${inr(ESI_GROSS_CEILING)}, else nil`,
      substituted:
        a.gross <= ESI_GROSS_CEILING
          ? `${inr(a.gross)} ≤ ${inr(ESI_GROSS_CEILING)} → ${inr(a.gross)} × 0.75% = ${inr(esiRaw)}`
          : `${inr(a.gross)} > ${inr(ESI_GROSS_CEILING)} → not covered`,
      result: inr(a.esi),
      inputs: [
        { label: "Gross", value: inr(a.gross) },
        { label: "Wage ceiling", value: inr(ESI_GROSS_CEILING) },
        { label: "Employee rate", value: "0.75%" },
      ],
      note:
        a.gross <= ESI_GROSS_CEILING
          ? "Covered under the ESI Act; the employer adds 3.25% on top."
          : "Above the ESI wage ceiling — the employee is covered by the group medical policy instead.",
    },
  };

  const pt: PayComponent = {
    code: "PT",
    label: "Professional Tax",
    group: "statutory",
    amount: a.pt,
    ytd: ytdOf(a, a.pt, a.pt),
    taxable: false,
    trace: {
      formula: `Professional Tax = ${a.ptResult.state} slab applied to monthly gross`,
      substituted: `${a.ptResult.state}: gross ${inr(a.gross)} → ${a.ptResult.rule}`,
      result: inr(a.pt),
      inputs: [
        { label: "Work state", value: a.ptResult.state },
        { label: "Branch", value: branchById(a.employee.branchId)?.name ?? a.employee.branchId },
        { label: "Month", value: a.period.label },
      ],
      note: "Professional tax is levied by the state of the work location, not the state of residence.",
    },
  };

  const t = a.tax;
  const slabLine = t.hits.length
    ? t.hits
        .map((h) => `${num(h.slice)} @ ${pctText(h.rate * 100)}`)
        .join(" + ")
    : "no slab above the nil band";
  const tds: PayComponent = {
    code: "TDS",
    label: "Income Tax (TDS)",
    group: "statutory",
    amount: a.tds,
    ytd: ytdOf(a, a.tax.monthly, a.tds),
    taxable: false,
    trace: {
      formula: `TDS = [slab tax on (Annual gross − ₹75,000 standard deduction), after 87A rebate, + 4% cess] ÷ 12${
        a.prorated ? " × payable days ÷ days in month" : ""
      }`,
      substituted: `(${inr(t.annualGross)} − ${inr(STANDARD_DEDUCTION)}) = ${inr(
        t.annualTaxable,
      )} → ${slabLine} = ${inr(t.slabTax)} → ${
        t.rebateApplied
          ? `87A rebate (taxable ≤ ${inr(REBATE_87A_CEILING)}) → ${inr(0)}`
          : t.marginalReliefApplied
            ? `marginal relief → ${inr(t.taxAfterRebate)}`
            : `+ 4% cess ${inr(t.cess)} = ${inr(t.annualTax)}`
      } → ÷ 12${a.prorated ? ` × ${a.payableDays}/${a.daysInMonth}` : ""}`,
      result: inr(a.tds),
      inputs: [
        { label: "Annual gross", value: inr(t.annualGross) },
        { label: "Standard deduction", value: inr(STANDARD_DEDUCTION) },
        { label: "Annual taxable", value: inr(t.annualTaxable) },
        { label: "Slab tax", value: inr(t.slabTax) },
        { label: "Health & education cess", value: `4% — ${inr(t.cess)}` },
        { label: "Annual tax", value: inr(t.annualTax) },
      ],
      note: t.rebateApplied
        ? `Nil. Taxable income of ${inr(t.annualTaxable)} is at or below the ${inr(
            REBATE_87A_CEILING,
          )} section 87A rebate ceiling under the new regime.`
        : t.marginalReliefApplied
          ? "Marginal relief applied — tax is capped at the income above the 87A ceiling."
          : "New regime, no declared investments. Spread evenly across 12 months.",
    },
  };

  return [pf, esi, pt, tds];
}

function buildOtherDeductions(a: Amounts): PayComponent[] {
  const out: PayComponent[] = [];
  if (a.lop > 0) {
    out.push({
      code: "LOP",
      label: "Loss of Pay",
      group: "deduction",
      amount: a.lop,
      ytd: a.lop,
      taxable: false,
      trace: {
        formula: "LOP = (Earned gross ÷ payable days) × LOP days",
        substituted: `(${inr(a.grossFixed)} ÷ ${a.payableDays}) × ${a.lopDays} = ${inr(
          Math.round(a.perDayRate),
        )} × ${a.lopDays}`,
        result: inr(a.lop),
        inputs: [
          { label: "Earned gross", value: inr(a.grossFixed) },
          { label: "Payable days", value: String(a.payableDays) },
          { label: "LOP days", value: String(a.lopDays) },
          { label: "Per-day rate", value: inr(Math.round(a.perDayRate)) },
        ],
        note:
          a.lopDays > a.payableDays
            ? `Invalid — ${a.lopDays} LOP days exceeds the ${a.payableDays} payable days in ${a.period.label}. The run is blocked until attendance is corrected.`
            : "LOP days come from finalised attendance for the period.",
      },
    });
  }
  if (a.advance > 0) {
    out.push({
      code: "ADV",
      label: "Salary Advance Recovery",
      group: "deduction",
      amount: a.advance,
      ytd: a.advance,
      taxable: false,
      trace: {
        formula: "Advance recovery = instalment scheduled against the outstanding advance",
        substituted: `Scheduled instalment for ${a.period.label} = ${inr(a.advance)}`,
        result: inr(a.advance),
        inputs: [
          { label: "Instalment", value: inr(a.advance) },
          { label: "Schedule", value: "Monthly, until the advance is cleared" },
        ],
        note:
          a.advance > a.gross - a.statutoryTotal
            ? "The instalment is larger than the pay available after statutory deductions, which drives net pay negative."
            : "Recovered before net pay is computed.",
      },
    });
  }
  return out;
}

function buildEmployer(a: Amounts): PayComponent[] {
  const b = a.breakup;
  const rawPf = Math.round(a.basic * PF_RATE);
  return [
    {
      code: "EPF",
      label: "Provident Fund (employer)",
      group: "employer",
      amount: a.employerPf,
      ytd: ytdOf(a, Math.min(Math.round(b.basic * PF_RATE), PF_MONTHLY_CAP), a.employerPf),
      taxable: false,
      trace: {
        formula: "Employer PF = min(Basic × 12%, ₹1,800)",
        substituted: `min(${inr(a.basic)} × 12%, ${inr(PF_MONTHLY_CAP)}) = min(${inr(rawPf)}, ${inr(
          PF_MONTHLY_CAP,
        )})`,
        result: inr(a.employerPf),
        inputs: [
          { label: "Basic (earned)", value: inr(a.basic) },
          { label: "Employer rate", value: "12%" },
          { label: "EPF establishment code", value: TENANT.pfCode },
        ],
        note: "Split 8.33% to EPS and 3.67% to EPF in the ECR return.",
      },
    },
    {
      code: "EESI",
      label: "ESI (employer)",
      group: "employer",
      amount: a.employerEsi,
      ytd: ytdOf(a, 0, a.employerEsi),
      taxable: false,
      trace: {
        formula: `Employer ESI = Gross × 3.25% where Gross ≤ ${inr(ESI_GROSS_CEILING)}, else nil`,
        substituted:
          a.gross <= ESI_GROSS_CEILING
            ? `${inr(a.gross)} × 3.25%`
            : `${inr(a.gross)} > ${inr(ESI_GROSS_CEILING)} → not covered`,
        result: inr(a.employerEsi),
        inputs: [
          { label: "Gross", value: inr(a.gross) },
          { label: "Employer rate", value: "3.25%" },
          { label: "ESI code", value: TENANT.esiCode },
        ],
      },
    },
    {
      code: "GRAT",
      label: "Gratuity provision",
      group: "employer",
      amount: a.gratuity,
      ytd: ytdOf(a, Math.round(b.basic * GRATUITY_RATE), a.gratuity),
      taxable: false,
      trace: {
        formula: "Gratuity provision = Basic × 4.81%",
        substituted: `${inr(a.basic)} × 4.81%`,
        result: inr(a.gratuity),
        inputs: [
          { label: "Basic (earned)", value: inr(a.basic) },
          { label: "Provision rate", value: "4.81% (15/26 days ÷ 12)" },
        ],
        note: "A provision, not a payout — it is released on exit once 5 years of service are complete.",
      },
    },
  ];
}

/* ------------------------------------------------------------- the payslip */

export interface PayslipEmployee {
  code: string;
  name: string;
  designation: string;
  departmentId: string;
  department: string;
  costCentre: string;
  branchId: string;
  branch: string;
  location: string;
  gradeId: string;
  gradeLabel: string;
  joiningDate: string;
  employmentType: string;
  pan: string;
  uan: string;
  bankAccountLast4: string;
  hasBankDetails: boolean;
}

export interface Payslip {
  periodId: string;
  runId: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  fy: string;
  status: PayRunStatus;

  employee: PayslipEmployee;
  annualCtc: number;
  monthlyCtc: number;
  structureId: string;

  daysInMonth: number;
  payableDays: number;
  lopDays: number;
  paidDays: number;
  prorated: boolean;

  earnings: PayComponent[];
  statutory: PayComponent[];
  deductions: PayComponent[];
  employer: PayComponent[];

  gross: number;
  statutoryTotal: number;
  otherDeductionsTotal: number;
  totalDeductions: number;
  net: number;
  employerTotal: number;
  costToCompany: number;

  ytd: { gross: number; deductions: number; net: number; tds: number; pf: number };
  exceptionType: ExceptionType | null;
}

function buildPayslip(a: Amounts): Payslip {
  const e = a.employee;
  const dept = deptById(e.departmentId);
  const branch = branchById(e.branchId);
  const earnings = buildEarnings(a);
  const statutory = buildStatutory(a);
  const deductions = buildOtherDeductions(a);
  const employer = buildEmployer(a);

  const ytdGross = earnings.reduce((s, c) => s + c.ytd, 0);
  const ytdDeductions =
    statutory.reduce((s, c) => s + c.ytd, 0) + deductions.reduce((s, c) => s + c.ytd, 0);

  return {
    periodId: a.period.id,
    runId: a.period.runId,
    periodLabel: a.period.label,
    periodStart: a.period.periodStart,
    periodEnd: a.period.periodEnd,
    payDate: a.period.payDate,
    fy: a.period.fy,
    status: a.period.status,
    employee: {
      code: e.code,
      name: e.name,
      designation: e.designation,
      departmentId: e.departmentId,
      department: dept?.name ?? e.departmentId,
      costCentre: dept?.costCentre ?? "—",
      branchId: e.branchId,
      branch: branch?.name ?? e.branchId,
      location: e.location,
      gradeId: e.gradeId,
      gradeLabel: gradeById(e.gradeId)?.label ?? e.gradeId,
      joiningDate: e.joiningDate,
      employmentType: e.employmentType,
      pan: e.pan,
      uan: e.uan,
      bankAccountLast4: e.bankAccountLast4,
      hasBankDetails: bankVerified(e.code),
    },
    annualCtc: e.ctc,
    monthlyCtc: a.breakup.monthlyCtc,
    structureId: structureForGrade(e.gradeId).id,
    daysInMonth: a.daysInMonth,
    payableDays: a.payableDays,
    lopDays: a.lopDays,
    paidDays: a.paidDays,
    prorated: a.prorated,
    earnings,
    statutory,
    deductions,
    employer,
    gross: a.gross,
    statutoryTotal: a.statutoryTotal,
    otherDeductionsTotal: a.otherTotal,
    totalDeductions: a.deductions,
    net: a.net,
    employerTotal: a.employerTotal,
    costToCompany: a.costToCompany,
    ytd: {
      gross: ytdGross,
      deductions: ytdDeductions,
      net: ytdGross - ytdDeductions,
      tds: statutory.find((c) => c.code === "TDS")?.ytd ?? 0,
      pf: statutory.find((c) => c.code === "PF")?.ytd ?? 0,
    },
    exceptionType: a.exceptionType,
  };
}

const payslipCache = new Map<string, Payslip | null>();

/**
 * The full traced breakdown for one employee in one period. Accepts either a
 * period id ("2026-09") or a run id ("PR-2026-09"). Memoised, because the
 * money-shot screen re-reads it on every expand.
 */
export function payslipFor(runId: string, employeeCode: string): Payslip | null {
  const key = `${runId}|${employeeCode}`;
  const hit = payslipCache.get(key);
  if (hit !== undefined) return hit;

  const period = periodById(runId);
  const emp = employeeByCode(employeeCode);
  const ok =
    period && emp && (branchById(emp.branchId)?.country ?? "IN") === "IN" && onRunRoll(period, emp);
  const slip = ok ? buildPayslip(computeAmounts(period, emp)) : null;
  payslipCache.set(key, slip);
  return slip;
}

/* ------------------------------------------------------------- pay runs */

export interface PayRunRow {
  employeeCode: string;
  name: string;
  designation: string;
  departmentId: string;
  department: string;
  costCentre: string;
  branchId: string;
  branch: string;
  gradeId: string;
  payableDays: number;
  lopDays: number;
  gross: number;
  statutory: number;
  otherDeductions: number;
  deductions: number;
  net: number;
  employerCost: number;
  hasBankDetails: boolean;
  exceptionType: ExceptionType | null;
}

export interface PayRunTotals {
  gross: number;
  statutory: number;
  otherDeductions: number;
  deductions: number;
  net: number;
  employerCost: number;
  costToCompany: number;
}

export interface RunTimelineEntry {
  status: PayRunStatus;
  at: string | null;
  actor: string;
}

export interface PayRun {
  id: string;
  code: string;
  periodId: string;
  label: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  fy: string;
  status: PayRunStatus;
  country: string;
  currency: string;
  employeeCount: number;
  daysInMonth: number;
  totals: PayRunTotals;
  exceptionCount: number;
  esiCoveredCount: number;
  lopEmployeeCount: number;
  timeline: RunTimelineEntry[];
  notes: string;
}

function rowsForPeriod(period: PayPeriod): PayRunRow[] {
  return runPopulation(period.id).map((emp) => {
    const a = computeAmounts(period, emp);
    const dept = deptById(emp.departmentId);
    return {
      employeeCode: emp.code,
      name: emp.name,
      designation: emp.designation,
      departmentId: emp.departmentId,
      department: dept?.name ?? emp.departmentId,
      costCentre: dept?.costCentre ?? "—",
      branchId: emp.branchId,
      branch: branchById(emp.branchId)?.name ?? emp.branchId,
      gradeId: emp.gradeId,
      payableDays: a.payableDays,
      lopDays: a.lopDays,
      gross: a.gross,
      statutory: a.statutoryTotal,
      otherDeductions: a.otherTotal,
      deductions: a.deductions,
      net: a.net,
      employerCost: a.employerTotal,
      hasBankDetails: bankVerified(emp.code),
      exceptionType: a.exceptionType,
    };
  });
}

const rowCache = new Map<string, PayRunRow[]>();

export function payRunRows(runId: string): PayRunRow[] {
  const period = periodById(runId);
  if (!period) return [];
  const cached = rowCache.get(period.id);
  if (cached) return cached;
  const rows = rowsForPeriod(period);
  rowCache.set(period.id, rows);
  return rows;
}

function totalsOf(rows: PayRunRow[]): PayRunTotals {
  const t: PayRunTotals = {
    gross: 0,
    statutory: 0,
    otherDeductions: 0,
    deductions: 0,
    net: 0,
    employerCost: 0,
    costToCompany: 0,
  };
  for (const r of rows) {
    t.gross += r.gross;
    t.statutory += r.statutory;
    t.otherDeductions += r.otherDeductions;
    t.deductions += r.deductions;
    t.net += r.net;
    t.employerCost += r.employerCost;
  }
  t.costToCompany = t.gross + t.employerCost;
  return t;
}

const AUG_TIMELINE: RunTimelineEntry[] = [
  { status: "draft", at: "2026-08-21T10:12:00", actor: "Rahul Desai" },
  { status: "calculated", at: "2026-08-24T11:40:00", actor: "Rahul Desai" },
  { status: "locked", at: "2026-08-25T09:05:00", actor: "Rahul Desai" },
  { status: "approved", at: "2026-08-27T16:20:00", actor: "Lakshmi Pillai" },
  { status: "paid", at: "2026-08-31T10:02:00", actor: "HDFC Corporate Banking" },
];

const SEP_TIMELINE: RunTimelineEntry[] = [
  { status: "draft", at: "2026-09-11T09:30:00", actor: "Rahul Desai" },
  { status: "calculated", at: "2026-09-16T08:40:00", actor: "Rahul Desai" },
  { status: "locked", at: null, actor: "Rahul Desai" },
  { status: "approved", at: null, actor: "Lakshmi Pillai" },
  { status: "paid", at: null, actor: "HDFC Corporate Banking" },
];

function buildRun(period: PayPeriod, timeline: RunTimelineEntry[], notes: string): PayRun {
  const rows = payRunRows(period.id);
  return {
    id: period.runId,
    code: period.runId,
    periodId: period.id,
    label: period.label,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    payDate: period.payDate,
    fy: period.fy,
    status: period.status,
    country: "India",
    currency: "INR",
    employeeCount: rows.length,
    daysInMonth: period.daysInMonth,
    totals: totalsOf(rows),
    exceptionCount: rows.filter((r) => r.exceptionType).length,
    esiCoveredCount: rows.filter((r) => r.gross <= ESI_GROSS_CEILING).length,
    lopEmployeeCount: rows.filter((r) => r.lopDays > 0).length,
    timeline,
    notes,
  };
}

/** A settled run's timeline, derived from its own period dates. */
function settledTimeline(p: PayPeriod): RunTimelineEntry[] {
  const day = (d: number, t: string) => `${p.id}-${String(d).padStart(2, "0")}T${t}`;
  return [
    { status: "draft", at: day(p.daysInMonth - 10, "10:12:00"), actor: "Rahul Desai" },
    { status: "calculated", at: day(p.daysInMonth - 7, "11:40:00"), actor: "Rahul Desai" },
    { status: "locked", at: day(p.daysInMonth - 6, "09:05:00"), actor: "Rahul Desai" },
    { status: "approved", at: day(p.daysInMonth - 4, "16:20:00"), actor: "Lakshmi Pillai" },
    { status: "paid", at: day(p.daysInMonth, "10:02:00"), actor: "HDFC Corporate Banking" },
  ];
}

/** Leavers in the open run are settled through F&F, so the run note names them. */
function sepLeaverNote() {
  const leavers = leaversIn(CURRENT_PERIOD);
  if (!leavers.length) return "";
  const names = leavers.map((e) => `${e.name} (last day ${format(parseISO(e.exitDate!), "d MMM")})`);
  return ` ${names.join(", ")} ${leavers.length === 1 ? "leaves" : "leave"} this month and ${
    leavers.length === 1 ? "is" : "are"
  } paid through full & final settlement, not this run.`;
}

/** Every period the tenant has processed, newest first. */
export const PAY_RUN_HISTORY: PayRun[] = PAY_PERIODS.slice()
  .reverse()
  .map((p) => {
    if (p.id === CURRENT_PERIOD.id)
      return buildRun(
        p,
        SEP_TIMELINE,
        `Calculated on 16 Sep 2026. ${OUT_OF_SCOPE_COUNT} Newark NJ employees are processed on the US payroll and are out of scope for this run.${sepLeaverNote()}`,
      );
    if (p.id === PREVIOUS_PERIOD.id)
      return buildRun(
        p,
        AUG_TIMELINE,
        "Disbursed 31 Aug 2026 via HDFC corporate banking. Bank advice reference HDFC/SAL/2026/0831.",
      );
    return buildRun(
      p,
      settledTimeline(p),
      `Disbursed ${format(parseISO(p.payDate), "dd MMM yyyy")} via HDFC corporate banking.`,
    );
  });

/**
 * The two runs the walkthrough is built around: the open September run and the
 * completed August one. Both are the same objects that sit in PAY_RUN_HISTORY.
 */
export const PAY_RUNS: PayRun[] = [
  PAY_RUN_HISTORY.find((r) => r.periodId === CURRENT_PERIOD.id)!,
  PAY_RUN_HISTORY.find((r) => r.periodId === PREVIOUS_PERIOD.id)!,
];

export const runById = (id: string) =>
  PAY_RUN_HISTORY.find((r) => r.id === id || r.periodId === id);

/* ------------------------------------------------------------ exceptions */

export interface PayrollException {
  id: string;
  runId: string;
  type: ExceptionType;
  severity: "critical" | "warning";
  employeeCode: string;
  employeeName: string;
  department: string;
  title: string;
  detail: string;
  resolution: string;
  amount: number;
}

function buildExceptions(): PayrollException[] {
  const run = PAY_RUNS[0];
  const rows = payRunRows(run.id).filter((r) => r.exceptionType);
  const order: ExceptionType[] = ["missing_bank", "lop_exceeds", "negative_net"];
  return rows
    .slice()
    .sort((a, b) => order.indexOf(a.exceptionType!) - order.indexOf(b.exceptionType!))
    .map((r, i) => {
      const type = r.exceptionType!;
      const meta = EXCEPTION_META[type];
      const detail =
        type === "missing_bank"
          ? `No verified bank account on file for ${r.name}. Net pay of ${inr(
              r.net,
            )} cannot be included in the NEFT advice file.`
          : type === "lop_exceeds"
            ? `${r.lopDays} loss-of-pay days were imported against ${r.payableDays} payable days in ${run.label}. The engine has still priced all ${r.lopDays} days, which drives net pay to ${inr(
                r.net,
              )}.`
            : `Recoveries of ${inr(r.otherDeductions)} exceed earnings of ${inr(
                r.gross,
              )} less statutory deductions of ${inr(r.statutory)}. Net pay resolves to ${inr(r.net)}.`;
      const resolution =
        type === "missing_bank"
          ? "Collect a cancelled cheque and add the account on the employee profile, then re-calculate the run."
          : type === "lop_exceeds"
            ? "Re-open finalised attendance for the period, correct the LOP days and re-calculate."
            : "Re-schedule the salary advance over the remaining instalments so the deduction fits inside net pay.";
      return {
        id: `EXC-${run.periodId}-${String(i + 1).padStart(2, "0")}`,
        runId: run.id,
        type,
        severity: meta.severity,
        employeeCode: r.employeeCode,
        employeeName: r.name,
        department: r.department,
        title: `${meta.label} — ${r.name}`,
        detail,
        resolution,
        amount: r.net,
      };
    });
}

export const EXCEPTIONS: PayrollException[] = buildExceptions();

/* ---------------------------------------------------------- cost analytics */

export interface CostTrendPoint {
  month: string;
  periodId: string;
  gross: number;
  net: number;
  employer: number;
  ctc: number;
}

/**
 * 12 months of payroll cost, ending with the period DEMO_TODAY sits in. Each
 * point IS that period's run total — the population grows month by month as
 * joiners come on roll, so the trend and the run list can never disagree.
 */
export const PAYROLL_COST_TREND: CostTrendPoint[] = PAY_PERIODS.map((p) => {
  const t = totalsOf(payRunRows(p.id));
  return {
    month: p.shortLabel,
    periodId: p.id,
    gross: t.gross,
    net: t.net,
    employer: t.employerCost,
    ctc: t.costToCompany,
  };
});

export interface CostCentrePoint {
  costCentre: string;
  department: string;
  departmentId: string;
  headcount: number;
  gross: number;
  net: number;
  employer: number;
  ctc: number;
}

export function costByDepartment(runId: string): CostCentrePoint[] {
  const rows = payRunRows(runId);
  return DEPARTMENTS.map((d) => {
    const mine = rows.filter((r) => r.departmentId === d.id);
    const gross = mine.reduce((s, r) => s + r.gross, 0);
    const employer = mine.reduce((s, r) => s + r.employerCost, 0);
    return {
      costCentre: d.costCentre,
      department: d.name,
      departmentId: d.id,
      headcount: mine.length,
      gross,
      net: mine.reduce((s, r) => s + r.net, 0),
      employer,
      ctc: gross + employer,
    };
  })
    .filter((d) => d.headcount > 0)
    .sort((a, b) => b.gross - a.gross);
}

/** Cost by cost centre for the open run — the figure Finance reconciles against. */
export const COST_BY_COST_CENTRE: CostCentrePoint[] = costByDepartment(PAY_RUNS[0].id);

export interface BranchCostPoint {
  branchId: string;
  branch: string;
  headcount: number;
  gross: number;
  net: number;
}

export function costByBranch(runId: string): BranchCostPoint[] {
  const rows = payRunRows(runId);
  return BRANCHES.map((b) => {
    const mine = rows.filter((r) => r.branchId === b.id);
    return {
      branchId: b.id,
      branch: b.name,
      headcount: mine.length,
      gross: mine.reduce((s, r) => s + r.gross, 0),
      net: mine.reduce((s, r) => s + r.net, 0),
    };
  }).filter((b) => b.headcount > 0);
}

/* ----------------------------------------------------------- my payslips */

export interface PayslipListItem {
  periodId: string;
  runId: string;
  label: string;
  shortLabel: string;
  payDate: string;
  fy: string;
  status: PayRunStatus;
  gross: number;
  deductions: number;
  net: number;
  lopDays: number;
}

/** The twelve most recent payslips for one employee, newest first. */
export function payslipsFor(employeeCode: string): PayslipListItem[] {
  const emp = employeeByCode(employeeCode);
  if (!emp || (branchById(emp.branchId)?.country ?? "IN") !== "IN") return [];
  return PAY_PERIODS.filter((p) => onRunRoll(p, emp))
    .map((p) => {
      const a = computeAmounts(p, emp);
      return {
        periodId: p.id,
        runId: p.runId,
        label: p.label,
        shortLabel: p.shortLabel,
        payDate: p.payDate,
        fy: p.fy,
        status: p.status,
        gross: a.gross,
        deductions: a.deductions,
        net: a.net,
        lopDays: a.lopDays,
      };
    })
    .reverse();
}

/* --------------------------------------------------- structures preview */

export interface PreviewRow {
  code: string;
  label: string;
  group: "earning" | "employer";
  formula: string;
  monthly: number;
  annual: number;
  note?: string;
}

export interface StructurePreview {
  gradeId: string;
  annualCtc: number;
  monthlyCtc: number;
  earnings: PreviewRow[];
  employer: PreviewRow[];
  monthlyGross: number;
  annualGross: number;
  monthlyEmployer: number;
  annualEmployer: number;
  /** monthlyGross + monthlyEmployer — must equal monthlyCtc. */
  monthlyTotal: number;
  balances: boolean;
  /** Take-home on the standard statutory assumptions, for the preview footer. */
  estimatedNet: number;
  estimatedDeductions: { pf: number; pt: number; tds: number };
}

/**
 * Live CTC breakup for the component builder on /payroll/structures. Pass
 * `rates` to preview an edited template; omit it for the saved one.
 */
export function previewStructure(
  gradeId: string,
  annualCtc: number,
  rates?: ComponentRates,
): StructurePreview {
  const r = rates ?? ratesForGrade(gradeId);
  const b = rates ? computeBreakup(r, annualCtc) : ctcBreakup(gradeId, annualCtc);
  const s = structureForGrade(gradeId);
  const byCode = new Map(s.components.map((c) => [c.code, c]));
  /* Formulas are re-rendered from the live rates so the builder never shows a
     formula that disagrees with the number beside it. */
  const liveFormula: Record<string, string> = {
    BASIC: `${pctText(r.basicPct)} of CTC ÷ 12`,
    HRA: `${pctText(r.hraPct)} of Basic`,
    CONV: `Flat ${inr(r.conveyance, { decimals: false })} per month`,
    MED: `Flat ${inr(r.medical, { decimals: false })} per month`,
    LTA: `${pctText(r.ltaPct)} of Basic`,
    PERF: `${pctText(r.perfPct)} of CTC ÷ 12`,
  };
  const row = (code: string, monthly: number): PreviewRow => {
    /* A grade template without performance pay can still be given some in the
       builder, so fall back to the shared definition rather than assuming. */
    const c = byCode.get(code) ?? PERF_COMPONENT(r.perfPct);
    return {
      code,
      label: c.label,
      group: c.group,
      formula: liveFormula[code] ?? c.formula,
      monthly,
      annual: monthly * 12,
      note: c.note,
    };
  };

  const earnings: PreviewRow[] = [
    row("BASIC", b.basic),
    row("HRA", b.hra),
    row("CONV", b.conveyance),
    row("MED", b.medical),
    row("LTA", b.lta),
    ...(b.perf > 0 ? [row("PERF", b.perf)] : []),
    row("SPL", b.special),
  ];
  const employer: PreviewRow[] = [
    row("EPF", b.employerPf),
    row("EESI", b.employerEsi),
    row("GRAT", b.gratuity),
  ];

  const monthlyGross = earnings.reduce((t, r) => t + r.monthly, 0);
  const monthlyEmployer = employer.reduce((t, r) => t + r.monthly, 0);
  const pf = Math.min(Math.round(b.basic * PF_RATE), PF_MONTHLY_CAP);
  const pt = computeProfessionalTax("BLR", monthlyGross, 9).amount;
  const tds = computeTds(monthlyGross * 12).monthly;

  return {
    gradeId,
    annualCtc,
    monthlyCtc: b.monthlyCtc,
    earnings,
    employer,
    monthlyGross,
    annualGross: monthlyGross * 12,
    monthlyEmployer,
    annualEmployer: monthlyEmployer * 12,
    monthlyTotal: monthlyGross + monthlyEmployer,
    balances: monthlyGross + monthlyEmployer === b.monthlyCtc,
    estimatedNet: monthlyGross - pf - pt - tds,
    estimatedDeductions: { pf, pt, tds },
  };
}

/* ------------------------------------------------------- reconciliation */

export interface VerifyCheck {
  label: string;
  expected: number;
  actual: number;
  ok: boolean;
}

export interface VerifyResult {
  runId: string;
  label: string;
  rowCount: number;
  ok: boolean;
  checks: VerifyCheck[];
  /** Employee codes where Gross − Deductions ≠ Net, or the payslip disagrees. */
  mismatches: string[];
}

/**
 * The reconciliation guarantee, executable. Checks that every row balances,
 * that the run totals are the sum of the rows, and that the traced payslip
 * agrees with the row for a sampled slice of the population.
 */
export function verifyRun(runId: string): VerifyResult {
  const run = runById(runId);
  const rows = payRunRows(runId);
  const mismatches: string[] = [];

  let gross = 0;
  let statutory = 0;
  let other = 0;
  let deductions = 0;
  let net = 0;
  let employer = 0;

  for (const r of rows) {
    if (r.gross - r.deductions !== r.net) mismatches.push(`${r.employeeCode}: gross − deductions ≠ net`);
    if (r.statutory + r.otherDeductions !== r.deductions)
      mismatches.push(`${r.employeeCode}: statutory + other ≠ deductions`);
    gross += r.gross;
    statutory += r.statutory;
    other += r.otherDeductions;
    deductions += r.deductions;
    net += r.net;
    employer += r.employerCost;
  }

  /* Every 17th employee gets the full traced payslip re-derived and compared
     against the run row — enough to catch a drift between the two paths. */
  for (let i = 0; i < rows.length; i += 17) {
    const r = rows[i];
    const slip = payslipFor(runId, r.employeeCode);
    if (!slip) {
      mismatches.push(`${r.employeeCode}: no payslip`);
      continue;
    }
    const slipEarnings = slip.earnings.reduce((s, c) => s + c.amount, 0);
    if (slipEarnings !== slip.gross) mismatches.push(`${r.employeeCode}: earnings ≠ gross`);
    if (slip.gross !== r.gross) mismatches.push(`${r.employeeCode}: payslip gross ≠ row gross`);
    if (slip.net !== r.net) mismatches.push(`${r.employeeCode}: payslip net ≠ row net`);
    if (slip.gross - slip.totalDeductions !== slip.net)
      mismatches.push(`${r.employeeCode}: payslip does not balance`);
  }

  const t = run?.totals;
  const checks: VerifyCheck[] = [
    { label: "Σ row gross = run gross", expected: gross, actual: t?.gross ?? gross, ok: (t?.gross ?? gross) === gross },
    {
      label: "Σ row deductions = run deductions",
      expected: deductions,
      actual: t?.deductions ?? deductions,
      ok: (t?.deductions ?? deductions) === deductions,
    },
    { label: "Σ row net = run net", expected: net, actual: t?.net ?? net, ok: (t?.net ?? net) === net },
    { label: "Gross − Deductions = Net", expected: gross - deductions, actual: net, ok: gross - deductions === net },
    {
      label: "Statutory + other = deductions",
      expected: statutory + other,
      actual: deductions,
      ok: statutory + other === deductions,
    },
    {
      label: "Σ row employer cost = run employer cost",
      expected: employer,
      actual: t?.employerCost ?? employer,
      ok: (t?.employerCost ?? employer) === employer,
    },
  ];

  return {
    runId,
    label: run?.label ?? runId,
    rowCount: rows.length,
    ok: checks.every((c) => c.ok) && mismatches.length === 0,
    checks,
    mismatches,
  };
}

/* --------------------------------------------------------- amount in words */

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
}

/** Indian numbering — crore, lakh, thousand, hundred. Used on the payslip. */
export function amountInWords(value: number): string {
  const negative = value < 0;
  const whole = Math.floor(Math.abs(Math.round(value * 100) / 100));
  const paise = Math.round((Math.abs(value) - whole) * 100);
  if (whole === 0 && paise === 0) return "Rupees Zero Only";

  const parts: string[] = [];
  const units: [number, string][] = [
    [10000000, "Crore"],
    [100000, "Lakh"],
    [1000, "Thousand"],
    [100, "Hundred"],
  ];
  let rest = whole;
  for (const [size, name] of units) {
    const count = Math.floor(rest / size);
    if (count > 0) {
      parts.push(`${twoDigits(count)} ${name}`);
      rest -= count * size;
    }
  }
  if (rest > 0) parts.push(twoDigits(rest));

  const rupees = parts.join(" ");
  return `${negative ? "Minus " : ""}Rupees ${rupees}${
    paise > 0 ? ` and ${twoDigits(paise)} Paise` : ""
  } Only`;
}

/* ------------------------------------------------------------ headline KPIs */

export const PAYROLL_STATS = (() => {
  const current = PAY_RUNS[0];
  const previous = PAY_RUNS[1];
  const delta =
    previous.totals.gross === 0
      ? 0
      : ((current.totals.gross - previous.totals.gross) / previous.totals.gross) * 100;
  return {
    currentRunId: current.id,
    employees: current.employeeCount,
    gross: current.totals.gross,
    net: current.totals.net,
    deductions: current.totals.deductions,
    employerCost: current.totals.employerCost,
    costToCompany: current.totals.costToCompany,
    grossDeltaPct: delta,
    exceptions: current.exceptionCount,
    lopEmployees: current.lopEmployeeCount,
    averageNet: Math.round(current.totals.net / Math.max(1, current.employeeCount)),
    outOfScope: OUT_OF_SCOPE_COUNT,
  };
})();
