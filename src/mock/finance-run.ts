/* ============================================================================
   W5 fixtures — run outputs: payslip register, statutory/salary registers and
   bank advice. Nothing here holds a number of its own: every rupee is read
   from computeAmounts() / payRunRows() in @/mock/payroll, so each output
   reconciles to the run it was produced from.
   ========================================================================== */

import { mulberry32 } from "@/lib/utils";
import { employeeByCode } from "@/mock/employees";
import {
  PAY_PERIODS,
  PAY_RUNS,
  RUN_POPULATION,
  computeAmounts,
  payRunRows,
  periodById,
  runById,
  runPopulation,
  type PayRun,
} from "@/mock/payroll";
import { branchById, deptById } from "@/mock/org";

/* ------------------------------------------------------------ the runs */

/** The two runs the output screens offer: September (open) and August (paid). */
export const OUTPUT_RUNS: PayRun[] = PAY_RUNS;

export const outputRunLabel = (r: PayRun) =>
  `${r.label} · ${r.status === "paid" ? "Paid" : r.status === "approved" ? "Approved" : "Calculated"}`;

/** Payslips can be released and bank files cut only once Finance has approved. */
export const runIsApproved = (r: PayRun) => r.status === "approved" || r.status === "paid";

const codeSeed = (code: string) => Number(code.replace(/\D/g, "")) || 1;

/* ------------------------------------------------------- register lines */

/** EPS takes 8.33% of the PF wage, capped at ₹1,250; the rest of the employer 12% goes to EPF. */
export const EPS_RATE = 0.0833;
export const EPS_MONTHLY_CAP = 1250;

export interface RegisterLine {
  code: string;
  name: string;
  departmentId: string;
  department: string;
  costCentre: string;
  branchId: string;
  branch: string;
  state: string;
  uan: string;
  pan: string;
  joiningDate: string;
  daysInMonth: number;
  payableDays: number;
  lopDays: number;
  paidDays: number;
  basic: number;
  hra: number;
  conveyance: number;
  medical: number;
  lta: number;
  perf: number;
  special: number;
  overtime: number;
  arrears: number;
  gross: number;
  pf: number;
  esi: number;
  pt: number;
  ptRule: string;
  tds: number;
  lop: number;
  advance: number;
  deductions: number;
  net: number;
  pfWage: number;
  employerPf: number;
  eps: number;
  epfEmployer: number;
  esiCovered: boolean;
  employerEsi: number;
  gratuity: number;
  employerCost: number;
}

const lineCache = new Map<string, RegisterLine[]>();

export function registerLines(runId: string): RegisterLine[] {
  const period = periodById(runId);
  if (!period) return [];
  const hit = lineCache.get(period.id);
  if (hit) return hit;
  const out = runPopulation(period.id).map((emp): RegisterLine => {
    const a = computeAmounts(period, emp);
    const dept = deptById(emp.departmentId);
    const pfWage = Math.min(a.basic, 15000);
    const eps = Math.min(Math.round(pfWage * EPS_RATE), EPS_MONTHLY_CAP, a.employerPf);
    return {
      code: emp.code,
      name: emp.name,
      departmentId: emp.departmentId,
      department: dept?.name ?? emp.departmentId,
      costCentre: dept?.costCentre ?? "—",
      branchId: emp.branchId,
      branch: branchById(emp.branchId)?.name ?? emp.branchId,
      state: a.ptResult.state,
      uan: emp.uan,
      pan: emp.pan,
      joiningDate: emp.joiningDate,
      daysInMonth: a.daysInMonth,
      payableDays: a.payableDays,
      lopDays: a.lopDays,
      paidDays: a.paidDays,
      basic: a.basic,
      hra: a.hra,
      conveyance: a.conveyance,
      medical: a.medical,
      lta: a.lta,
      perf: a.perf,
      special: a.special,
      overtime: a.overtime,
      arrears: a.arrears,
      gross: a.gross,
      pf: a.pf,
      esi: a.esi,
      pt: a.pt,
      ptRule: a.ptResult.rule,
      tds: a.tds,
      lop: a.lop,
      advance: a.advance,
      deductions: a.deductions,
      net: a.net,
      pfWage,
      employerPf: a.employerPf,
      eps,
      epfEmployer: a.employerPf - eps,
      esiCovered: a.esi > 0 || a.employerEsi > 0,
      employerEsi: a.employerEsi,
      gratuity: a.gratuity,
      employerCost: a.employerTotal,
    };
  });
  lineCache.set(period.id, out);
  return out;
}

export function sumBy<T>(rows: T[], pick: (r: T) => number) {
  let t = 0;
  for (const r of rows) t += pick(r);
  return t;
}

/* -------------------------------------------------------------- LWF */

export interface LwfRule {
  state: string;
  branchIds: string[];
  frequency: "Annual" | "Half-yearly";
  /** Calendar months the contribution is deducted in. */
  months: number[];
  employee: number;
  employer: number;
  dueBy: string;
  authority: string;
}

export const REGISTER_LWF_RULES: LwfRule[] = [
  {
    state: "Karnataka",
    branchIds: ["BLR"],
    frequency: "Annual",
    months: [12],
    employee: 20,
    employer: 40,
    dueBy: "15 January",
    authority: "Karnataka Labour Welfare Board",
  },
  {
    state: "Maharashtra",
    branchIds: ["PNQ"],
    frequency: "Half-yearly",
    months: [6, 12],
    employee: 12,
    employer: 36,
    dueBy: "15 July and 15 January",
    authority: "Maharashtra Labour Welfare Board",
  },
  {
    state: "Telangana",
    branchIds: ["HYD"],
    frequency: "Annual",
    months: [12],
    employee: 2,
    employer: 5,
    dueBy: "31 January",
    authority: "Telangana Labour Welfare Board",
  },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface LwfLine extends LwfRule {
  employees: number;
  dueThisPeriod: boolean;
  employeeThisPeriod: number;
  employerThisPeriod: number;
  nextMonthLabel: string;
  nextEmployee: number;
  nextEmployer: number;
}

export function lwfLines(runId: string): LwfLine[] {
  const period = periodById(runId);
  if (!period) return [];
  const lines = registerLines(runId);
  return REGISTER_LWF_RULES.map((rule) => {
    const employees = lines.filter((l) => rule.branchIds.includes(l.branchId)).length;
    const due = rule.months.includes(period.calendarMonth);
    const next = rule.months.find((m) => m > period.calendarMonth) ?? rule.months[0];
    const nextYear = Number(period.id.slice(0, 4)) + (next > period.calendarMonth ? 0 : 1);
    const monthName = MONTHS[next - 1];
    return {
      ...rule,
      employees,
      dueThisPeriod: due,
      employeeThisPeriod: due ? employees * rule.employee : 0,
      employerThisPeriod: due ? employees * rule.employer : 0,
      nextMonthLabel: `${monthName} ${nextYear}`,
      nextEmployee: employees * rule.employee,
      nextEmployer: employees * rule.employer,
    };
  });
}

/* ------------------------------------------------- variance register */

export type VarianceReason = "joiner" | "leaver" | "lop" | "arrears" | "overtime" | "advance" | "statutory";

export const VARIANCE_REASON_LABEL: Record<VarianceReason, string> = {
  joiner: "Joiner / pro-ration",
  leaver: "Leaver",
  lop: "Loss of pay",
  arrears: "Arrears",
  overtime: "Overtime",
  advance: "Advance recovery",
  statutory: "Statutory (PF/ESI/PT/TDS)",
};

export interface VarianceDriver {
  reason: VarianceReason;
  /** Signed effect on net pay; the drivers of a line sum to its delta. */
  amount: number;
}

export interface VarianceLine {
  code: string;
  name: string;
  department: string;
  prevNet: number;
  curNet: number;
  delta: number;
  drivers: VarianceDriver[];
  primary: VarianceReason;
}

export function previousRunId(runId: string) {
  const i = PAY_PERIODS.findIndex((p) => p.id === periodById(runId)?.id);
  return i > 0 ? PAY_PERIODS[i - 1].runId : null;
}

/** Only employees whose net moved. Σ delta = this run's net − last run's net. */
export function varianceLines(runId: string): VarianceLine[] {
  const period = periodById(runId);
  const prevId = previousRunId(runId);
  const prev = prevId ? periodById(prevId) : undefined;
  if (!period || !prev) return [];
  const out: VarianceLine[] = [];
  const onCur = new Set(runPopulation(period.id).map((e) => e.code));
  const onPrev = new Set(runPopulation(prev.id).map((e) => e.code));
  for (const emp of RUN_POPULATION) {
    if (!onCur.has(emp.code) && !onPrev.has(emp.code)) continue;
    const dept = deptById(emp.departmentId)?.name ?? emp.departmentId;
    /* A joiner's whole net is new money; a leaver's whole net drops out (their
       final month is paid through F&F, outside the run). */
    if (!onCur.has(emp.code) || !onPrev.has(emp.code)) {
      const joiner = onCur.has(emp.code);
      const net = computeAmounts(joiner ? period : prev, emp).net;
      const delta = joiner ? net : -net;
      out.push({
        code: emp.code,
        name: emp.name,
        department: dept,
        prevNet: joiner ? 0 : net,
        curNet: joiner ? net : 0,
        delta,
        drivers: [{ reason: joiner ? "joiner" : "leaver", amount: delta }],
        primary: joiner ? "joiner" : "leaver",
      });
      continue;
    }
    const c = computeAmounts(period, emp);
    const p = computeAmounts(prev, emp);
    const delta = c.net - p.net;
    if (delta === 0) continue;
    const drivers: VarianceDriver[] = [
      { reason: "joiner", amount: c.grossFixed - p.grossFixed },
      { reason: "overtime", amount: c.overtime - p.overtime },
      { reason: "arrears", amount: c.arrears - p.arrears },
      { reason: "lop", amount: -(c.lop - p.lop) },
      { reason: "advance", amount: -(c.advance - p.advance) },
      { reason: "statutory", amount: -(c.statutoryTotal - p.statutoryTotal) },
    ].filter((d): d is VarianceDriver => d.amount !== 0);
    const primary = drivers.reduce((a, b) => (Math.abs(b.amount) > Math.abs(a.amount) ? b : a)).reason;
    out.push({
      code: emp.code,
      name: emp.name,
      department: dept,
      prevNet: p.net,
      curNet: c.net,
      delta,
      drivers,
      primary,
    });
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/* --------------------------------------------------- payslip register */

export type EmailState = "emailed" | "not_emailed" | "bounced";

export interface PayslipRegRow {
  code: string;
  name: string;
  email: string;
  department: string;
  branch: string;
  paidDays: number;
  gross: number;
  deductions: number;
  net: number;
  published: boolean;
  publishedAt: string | null;
  holdNote: string | null;
  emailState: EmailState;
  emailedAt: string | null;
  bounceNote: string | null;
}

const HOLD_NOTES = [
  "Held for a revised TDS figure after the investment-proof correction.",
  "Held at the employee's request — name change on PAN being updated.",
];

export function payslipRegister(runId: string): PayslipRegRow[] {
  const run = runById(runId);
  if (!run) return [];
  const settled = runIsApproved(run);
  return payRunRows(run.id).map((r) => {
    const emp = employeeByCode(r.employeeCode);
    const rng = mulberry32(codeSeed(r.employeeCode) * 31 + run.daysInMonth);
    const roll = rng();
    const held = settled && roll > 0.985;
    const published = settled && !held;
    const bounced = published && rng() > 0.99;
    return {
      code: r.employeeCode,
      name: r.name,
      email: emp?.email ?? "",
      department: r.department,
      branch: r.branch,
      paidDays: Math.max(0, r.payableDays - r.lopDays),
      gross: r.gross,
      deductions: r.deductions,
      net: r.net,
      published,
      publishedAt: published ? `${run.payDate}T18:00:00` : null,
      holdNote: held ? HOLD_NOTES[Math.floor(rng() * HOLD_NOTES.length)] : null,
      emailState: published ? (bounced ? "bounced" : "emailed") : "not_emailed",
      emailedAt: published && !bounced ? `${run.payDate}T18:05:00` : null,
      bounceNote: bounced ? "Mailbox full — delivery failed after 3 retries." : null,
    };
  });
}

/* -------------------------------------------------------- bank advice */

export type BankCode = "HDFC" | "ICICI" | "SBI" | "CITI";
export type PayMode = "NEFT" | "RTGS";

/** RTGS is used for a single credit of ₹2,00,000 or more. */
export const RTGS_THRESHOLD = 200000;

export const BANK_ADVICE_BANKS: Record<
  BankCode,
  { name: string; format: string; ext: string; ifsc: string; debitAccount: string }
> = {
  HDFC: {
    name: "HDFC Bank",
    format: "HDFC ENet bulk upload · pipe-delimited",
    ext: "txt",
    ifsc: "HDFC0",
    debitAccount: "HDFC CA ••4417 (salary master)",
  },
  ICICI: {
    name: "ICICI Bank",
    format: "ICICI CIB bulk payment · CSV",
    ext: "csv",
    ifsc: "ICIC0",
    debitAccount: "ICICI CA ••2280",
  },
  SBI: {
    name: "State Bank of India",
    format: "SBI CINB bulk upload · fixed-width",
    ext: "txt",
    ifsc: "SBIN0",
    debitAccount: "SBI CA ••9013",
  },
  CITI: {
    name: "Citibank",
    format: "CitiDirect PayLink · CSV",
    ext: "csv",
    ifsc: "CITI0",
    debitAccount: "Citi CA ••6652",
  },
};

export const BANK_ORDER: BankCode[] = ["HDFC", "ICICI", "SBI", "CITI"];

/** Deterministic salary-account bank per employee: ~45 / 25 / 18 / 12. */
export function salaryBankOf(code: string): BankCode {
  const r = mulberry32(codeSeed(code) * 7 + 101)();
  return r < 0.45 ? "HDFC" : r < 0.7 ? "ICICI" : r < 0.88 ? "SBI" : "CITI";
}

export interface BankAdviceRecord {
  code: string;
  name: string;
  bank: BankCode;
  ifsc: string;
  account: string;
  mode: PayMode;
  amount: number;
}

export type HoldReason = "missing_bank" | "negative_net";

export interface HeldRecord {
  code: string;
  name: string;
  net: number;
  reason: HoldReason;
  detail: string;
}

export interface BankAdviceFile {
  id: string;
  bank: BankCode;
  mode: PayMode;
  fileName: string;
  format: string;
  debitAccount: string;
  count: number;
  total: number;
  records: BankAdviceRecord[];
}

export interface BankAdvice {
  runId: string;
  files: BankAdviceFile[];
  held: HeldRecord[];
  filesTotal: number;
  heldTotal: number;
  /** Stamps for a run whose files were already cut and paid. */
  history: { generatedBy: string; generatedAt: string; approvedBy: string; approvedAt: string; reference: string } | null;
}

export function bankAdviceFor(runId: string): BankAdvice {
  const run = runById(runId)!;
  const records: BankAdviceRecord[] = [];
  const held: HeldRecord[] = [];
  for (const r of payRunRows(run.id)) {
    if (!r.hasBankDetails) {
      held.push({
        code: r.employeeCode,
        name: r.name,
        net: r.net,
        reason: "missing_bank",
        detail: "No verified salary account — penny-drop check not passed.",
      });
      continue;
    }
    if (r.net <= 0) {
      held.push({
        code: r.employeeCode,
        name: r.name,
        net: r.net,
        reason: "negative_net",
        detail: "Recoveries exceed earnings — nothing to credit; balance carried to the next run.",
      });
      continue;
    }
    const bank = salaryBankOf(r.employeeCode);
    const emp = employeeByCode(r.employeeCode);
    records.push({
      code: r.employeeCode,
      name: r.name,
      bank,
      ifsc: `${BANK_ADVICE_BANKS[bank].ifsc}00${String(codeSeed(r.employeeCode) * 37 % 9000 + 1000)}`,
      account: `••••${emp?.bankAccountLast4 ?? "0000"}`,
      mode: r.net >= RTGS_THRESHOLD ? "RTGS" : "NEFT",
      amount: r.net,
    });
  }
  const files: BankAdviceFile[] = [];
  for (const bank of BANK_ORDER) {
    for (const mode of ["NEFT", "RTGS"] as PayMode[]) {
      const recs = records.filter((x) => x.bank === bank && x.mode === mode);
      if (!recs.length) continue;
      const meta = BANK_ADVICE_BANKS[bank];
      files.push({
        id: `${run.periodId}-${bank}-${mode}`,
        bank,
        mode,
        fileName: `${bank}_SAL_${run.periodId.replace("-", "")}_${mode}.${meta.ext}`,
        format: meta.format,
        debitAccount: meta.debitAccount,
        count: recs.length,
        total: sumBy(recs, (x) => x.amount),
        records: recs,
      });
    }
  }
  const paid = run.status === "paid";
  return {
    runId: run.id,
    files,
    held,
    filesTotal: sumBy(files, (f) => f.total),
    heldTotal: sumBy(held, (h) => h.net),
    history: paid
      ? {
          generatedBy: "Rahul Desai",
          generatedAt: `${run.periodId}-${String(run.daysInMonth - 3).padStart(2, "0")}T10:15:00`,
          approvedBy: "Lakshmi Pillai",
          approvedAt: `${run.periodId}-${String(run.daysInMonth - 3).padStart(2, "0")}T15:40:00`,
          reference: `HDFC/SAL/${run.periodId.slice(0, 4)}/${run.periodId.slice(5)}${String(run.daysInMonth)}`,
        }
      : null,
  };
}

/** Two August NEFT credits the beneficiary banks returned; re-credited by a supplementary file. */
export function returnedCredits(runId: string): (BankAdviceRecord & { returnCode: string; returnNote: string })[] {
  const run = runById(runId);
  if (!run || run.status !== "paid") return [];
  const neft = bankAdviceFor(runId).files.filter((f) => f.mode === "NEFT" && f.bank !== "HDFC");
  const picks = [neft[0]?.records[3], neft[1]?.records[5]].filter(Boolean) as BankAdviceRecord[];
  const notes = [
    { returnCode: "R03", returnNote: "Account closed — employee has since updated the account and it is verified." },
    { returnCode: "R17", returnNote: "Beneficiary name mismatch — corrected to match the bank's records." },
  ];
  return picks.map((p, i) => ({ ...p, ...notes[i] }));
}
