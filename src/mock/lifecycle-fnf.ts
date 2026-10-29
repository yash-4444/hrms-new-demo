import { differenceInDays, getDaysInMonth, parseISO } from "date-fns";
import { balanceFor } from "./leave";
import { computeTds, ctcBreakup, PF_MONTHLY_CAP, PF_RATE, type Breakup } from "./payroll";
import { SEPARATIONS, type Separation } from "./lifecycle-exit";
import { loanOutstanding } from "./lifecycle-clearance";

/* ============================================================================
   Full & final settlement. Every line is computed from the payroll engine
   (ctcBreakup / computeTds), the leave ledger and the clearance recoveries —
   nothing here is a typed-in amount except the incentive figures, which come
   from the sales-incentive statement. Totals are sums of the lines, always.
   ========================================================================== */

export type FnfStatus = "draft" | "pending_approval" | "approved" | "paid";

export const FNF_STATUS_LABEL: Record<FnfStatus, string> = {
  draft: "Draft — projected",
  pending_approval: "Awaiting Finance",
  approved: "Approved",
  paid: "Paid",
};

export interface FnfLine {
  key: string;
  label: string;
  amount: number;
  /** One-line formula, shown inline. */
  formula: string;
  /** Longer "explain this number" text. */
  explanation: string;
}

export interface FnfRecord {
  id: string;
  separation: Separation;
  breakup: Breakup;
  daysWorked: number;
  daysInMonth: number;
  serviceYears: number;
  gratuityYears: number;
  elBalance: number;
  elSource: string;
  earnings: FnfLine[];
  deductions: FnfLine[];
  totalEarnings: number;
  totalDeductions: number;
  /** Positive = payable to the employee; negative = recoverable from them. */
  net: number;
  status: FnfStatus;
  preparedBy: string;
  preparedOn: string;
  approvedBy: string | null;
  approvedOn: string | null;
  paidOn: string | null;
}

const INR = (n: number) => `₹${new Intl.NumberFormat("en-IN").format(Math.round(n))}`;
export const GRATUITY_CAP = 2000000;
export const ENCASH_CAP_DAYS = 30;

/** EL balances as at LWD for employees outside the 40-person leave-ledger subset. */
const EL_AT_LWD: Record<string, number> = {
  "STL-0161": 11, "STL-0073": 7.5, "STL-0182": 18, "STL-X0412": 42, "STL-X0418": 14.5, "STL-X0421": 9, "STL-0193": 6,
};

const INCENTIVE: Record<string, { label: string; amount: number; note: string }> = {
  "STL-0182": { label: "Sales incentive — Q1–Q2 FY 2026-27", amount: 64500, note: "Per the sales-incentive statement: 104% attainment on a ₹62,019 half-year target incentive, paid pro rata." },
  "STL-X0412": { label: "Long-service award (22 years)", amount: 50000, note: "Board-approved long-service award for superannuating employees with 20+ years of service." },
};

interface Seed { code: string; status: FnfStatus; preparedOn: string; approvedOn?: string; paidOn?: string }

const SEEDS: Seed[] = [
  { code: "STL-X0412", status: "paid", preparedOn: "2026-09-02", approvedOn: "2026-09-04", paidOn: "2026-09-07" },
  { code: "STL-X0418", status: "approved", preparedOn: "2026-08-22", approvedOn: "2026-09-09" },
  { code: "STL-X0421", status: "pending_approval", preparedOn: "2026-09-11" },
  { code: "STL-0161", status: "draft", preparedOn: "2026-09-15" },
  { code: "STL-0073", status: "draft", preparedOn: "2026-09-15" },
  { code: "STL-0182", status: "draft", preparedOn: "2026-09-16" },
  { code: "STL-0014", status: "draft", preparedOn: "2026-09-16" },
  { code: "STL-0193", status: "draft", preparedOn: "2026-09-16" },
];

function compute(s: Separation, seed: Seed, idx: number): FnfRecord {
  const b = ctcBreakup(s.gradeId, s.ctc);
  const lwd = parseISO(s.lwd);
  const daysInMonth = getDaysInMonth(lwd);
  const daysWorked = lwd.getDate();
  const serviceDays = differenceInDays(lwd, parseISO(s.joiningDate)) + 1;
  const serviceYears = Math.round((serviceDays / 365.25) * 100) / 100;
  const fullYears = Math.floor(serviceDays / 365.25);
  const remainder = serviceDays - Math.floor(fullYears * 365.25);
  const gratuityYears = fullYears >= 5 ? fullYears + (remainder > 182 ? 1 : 0) : 0;

  const ledger = balanceFor(s.code, "EL");
  const elBalance = ledger ? ledger.available : (EL_AT_LWD[s.code] ?? 0);
  const elSource = ledger ? "Leave ledger, FY 2026-27 — available balance" : "EL balance as at LWD (opening + accrual to LWD − availed)";
  const encashDays = Math.min(elBalance, ENCASH_CAP_DAYS);

  const salary = Math.round((b.gross * daysWorked) / daysInMonth);
  const encash = Math.round((b.basic / 30) * encashDays);
  const gratuity = Math.min(GRATUITY_CAP, Math.round((15 / 26) * b.basic * gratuityYears));
  const inc = INCENTIVE[s.code];

  const earnings: FnfLine[] = [
    { key: "salary", label: `Salary for ${daysWorked} days of ${lwd.toLocaleString("en-IN", { month: "short" })}`, amount: salary, formula: `${INR(b.gross)} × ${daysWorked} ÷ ${daysInMonth}`, explanation: `Monthly gross ${INR(b.gross)} (Basic ${INR(b.basic)}, HRA ${INR(b.hra)}, Special ${INR(b.special)} and fixed allowances) pro-rated for ${daysWorked} of ${daysInMonth} calendar days up to the last working day. Earlier months were paid in the regular runs.` },
    { key: "encash", label: `Leave encashment — ${encashDays} days EL`, amount: encash, formula: `${INR(b.basic)} ÷ 30 × ${encashDays}`, explanation: `${elSource}: ${elBalance} days. Policy encashes up to ${ENCASH_CAP_DAYS} days at Basic ÷ 30 per day${elBalance > ENCASH_CAP_DAYS ? `; ${elBalance - ENCASH_CAP_DAYS} days above the cap lapse` : ""}. Exempt up to ₹25,00,000 under s.10(10AA)(ii).` },
    gratuityYears
      ? { key: "gratuity", label: `Gratuity — ${gratuityYears} years`, amount: gratuity, formula: `15 ÷ 26 × ${INR(b.basic)} × ${gratuityYears}`, explanation: `Service ${serviceYears.toFixed(2)} years (${fullYears} completed years${remainder > 182 ? ", plus the final part-year over six months counts as a full year" : ""}). Payment of Gratuity Act: 15 days' last-drawn Basic per year of service, on a 26-day month. Capped at ₹20,00,000; exempt under s.10(10)(iii).` }
      : { key: "gratuity", label: "Gratuity — not eligible", amount: 0, formula: `${serviceYears.toFixed(2)} yrs < 5 yrs`, explanation: `Gratuity needs five years of continuous service. ${s.name.split(" ")[0]} completed ${serviceYears.toFixed(2)} years, so nothing is payable.` },
    ...(inc ? [{ key: "bonus", label: inc.label, amount: inc.amount, formula: "Per incentive statement", explanation: inc.note }] : []),
  ];

  const pfBasic = Math.round((b.basic * daysWorked) / daysInMonth);
  const pf = Math.min(Math.round(pfBasic * PF_RATE), PF_MONTHLY_CAP);
  const buyout = s.buyoutDays ? Math.round((b.basic / 30) * s.buyoutDays) : 0;
  const assets = s.recoveries.reduce((a, r) => a + r.amount, 0);
  const loan = loanOutstanding(s);
  const tax = computeTds(b.gross * 12);
  const effRate = tax.annualGross ? tax.annualTax / tax.annualGross : 0;
  const taxable = salary + (inc?.amount ?? 0);
  const tds = Math.round(taxable * effRate);

  const deductions: FnfLine[] = [
    { key: "pf", label: "Employee PF on final salary", amount: pf, formula: `12% × ${INR(pfBasic)}, capped ${INR(PF_MONTHLY_CAP)}`, explanation: `Provident fund on the pro-rated Basic for the final month, same rule as the monthly run (12%, capped at ${INR(PF_MONTHLY_CAP)}).` },
    ...(buyout ? [{ key: "notice", label: `Notice shortfall — ${s.buyoutDays} days`, amount: buyout, formula: `${INR(b.basic)} ÷ 30 × ${s.buyoutDays}`, explanation: `Notice period ${s.noticeDays} days; the employee chose an early release and bought out ${s.buyoutDays} days. Recovered at Basic ÷ 30 per day as per the appointment letter.` }] : []),
    ...(assets ? [{ key: "assets", label: "Asset recovery", amount: assets, formula: s.recoveries.map((r) => INR(r.amount)).join(" + "), explanation: `Raised during clearance: ${s.recoveries.map((r) => `${r.label} (${INR(r.amount)})`).join("; ")}.` }] : []),
    ...(loan ? [{ key: "loan", label: "Loan outstanding", amount: loan, formula: "Balance per loan book", explanation: `Outstanding principal on the active employee loan as at LWD. Recovered in full from F&F; any shortfall is billed separately.` }] : []),
    { key: "tds", label: "TDS on taxable F&F earnings", amount: tds, formula: `${(effRate * 100).toFixed(2)}% × ${INR(taxable)}`, explanation: `Taxable portion is the final salary${inc ? " plus the incentive" : ""} (${INR(taxable)}); leave encashment and gratuity are exempt within their limits. Rate is the employee's average rate for FY 2026-27 under the new regime (${INR(tax.annualTax)} on ${INR(tax.annualGross)}).` },
  ];

  const totalEarnings = earnings.reduce((a, l) => a + l.amount, 0);
  const totalDeductions = deductions.reduce((a, l) => a + l.amount, 0);

  return {
    id: `FNF-2026-${String(idx + 1).padStart(3, "0")}`,
    separation: s,
    breakup: b,
    daysWorked,
    daysInMonth,
    serviceYears,
    gratuityYears,
    elBalance,
    elSource,
    earnings,
    deductions,
    totalEarnings,
    totalDeductions,
    net: totalEarnings - totalDeductions,
    status: seed.status,
    preparedBy: "Rahul Desai",
    preparedOn: seed.preparedOn,
    approvedBy: seed.approvedOn ? "Lakshmi Pillai" : null,
    approvedOn: seed.approvedOn ?? null,
    paidOn: seed.paidOn ?? null,
  };
}

export const FNF_RECORDS: FnfRecord[] = SEEDS.map((seed, i) => compute(SEPARATIONS.find((s) => s.code === seed.code)!, seed, i));

export const fnfById = (id: string) => FNF_RECORDS.find((f) => f.id === id);
export const fnfForSeparation = (sepId: string) => FNF_RECORDS.find((f) => f.separation.id === sepId);
