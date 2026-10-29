import { addMonths, format, getDaysInMonth, parseISO } from "date-fns";
import { mulberry32 } from "@/lib/utils";
import { DEMO_TODAY, TENANT } from "./org";
import { employeeByCode } from "./employees";
import {
  CESS_RATE,
  ESI_EMPLOYEE_RATE,
  ESI_EMPLOYER_RATE,
  ESI_GROSS_CEILING,
  PAY_PERIODS,
  PF_MONTHLY_CAP,
  PF_RATE,
  PF_WAGE_CEILING,
  REBATE_87A_CEILING,
  RUN_POPULATION,
  STANDARD_DEDUCTION,
  computeAmounts,
  computeTds,
  onRunRoll,
  payRunRows,
  periodById,
  runById,
  runPopulation,
  type Amounts,
  type PayPeriod,
} from "./payroll";

/* ============================================================================
   W5 · Statutory setup (/payroll/statutory) and Returns & Forms (/payroll/returns).

   The "current" version of every statutory section is read from the live
   constants in ./payroll — the same constants the salary engine uses — so the
   setup screen can never show a rate the run did not apply. Every return is the
   SUM of computeAmounts() over the run population for its period(s).
   ========================================================================== */

/* ------------------------------------------------------- statutory setup */

export type StatSectionId = "pf" | "esi" | "pt_ka" | "pt_mh" | "pt_ts" | "lwf_ka" | "lwf_mh" | "tds" | "codes";

export interface StatParam {
  key: string;
  label: string;
  /** "number" params are validated as non-negative numbers when edited. */
  kind: "number" | "text";
  unit?: string;
  hint?: string;
}

export interface StatVersion {
  version: number;
  effectiveFrom: string;
  values: Record<string, string>;
  changedBy: string;
  changedOn: string;
  note: string;
}

export interface StatSection {
  id: StatSectionId;
  group: "PF" | "ESI" | "PT" | "LWF" | "TDS" | "Codes";
  title: string;
  authority: string;
  blurb: string;
  params: StatParam[];
  /** Oldest first. The last version whose effectiveFrom ≤ DEMO_TODAY is current. */
  versions: StatVersion[];
}

const n = (v: number) => String(v);
const pctStr = (rate: number) => String(Math.round(rate * 10000) / 100);

const RAHUL = "Rahul Desai";
const PRIYA = "Priya Menon";

export const STAT_SECTIONS: StatSection[] = [
  {
    id: "pf",
    group: "PF",
    title: "Provident Fund (EPF & MP Act, 1952)",
    authority: "EPFO",
    blurb: "Employee and employer contribute 12% of PF wages, restricted to the ₹15,000 wage ceiling. Employees may opt into VPF above the statutory 12%.",
    params: [
      { key: "eeRate", label: "Employee contribution", kind: "number", unit: "% of PF wages" },
      { key: "erRate", label: "Employer contribution", kind: "number", unit: "% of PF wages" },
      { key: "wageCeiling", label: "PF wage ceiling", kind: "number", unit: "₹ / month" },
      { key: "monthlyCap", label: "Employee PF cap", kind: "number", unit: "₹ / month", hint: "12% × ceiling" },
      { key: "epsRate", label: "EPS share of employer", kind: "number", unit: "% of PF wages" },
      { key: "epsCap", label: "EPS cap", kind: "number", unit: "₹ / month" },
      { key: "edliRate", label: "EDLI", kind: "number", unit: "% of PF wages" },
      { key: "adminRate", label: "Admin charges", kind: "number", unit: "% of PF wages" },
      { key: "restrict", label: "Restrict PF to wage ceiling", kind: "text", hint: "Yes / No" },
      { key: "vpf", label: "Voluntary PF (VPF)", kind: "text", hint: "Allowed / Not allowed" },
      { key: "vpfMax", label: "VPF maximum", kind: "number", unit: "% of Basic" },
    ],
    versions: [
      {
        version: 1,
        effectiveFrom: "2016-04-01",
        values: { eeRate: "12", erRate: "12", wageCeiling: "15000", monthlyCap: "1800", epsRate: "8.33", epsCap: "1250", edliRate: "0.5", adminRate: "0.65", restrict: "Yes", vpf: "Not allowed", vpfMax: "0" },
        changedBy: "Arjun Kapoor",
        changedOn: "2016-03-28T11:20:00",
        note: "Establishment registered with EPFO Bengaluru (Peenya).",
      },
      {
        version: 2,
        effectiveFrom: "2018-06-01",
        values: { eeRate: "12", erRate: "12", wageCeiling: "15000", monthlyCap: "1800", epsRate: "8.33", epsCap: "1250", edliRate: "0.5", adminRate: "0.5", restrict: "Yes", vpf: "Not allowed", vpfMax: "0" },
        changedBy: PRIYA,
        changedOn: "2018-05-24T16:05:00",
        note: "EPFO notification — admin charges reduced from 0.65% to 0.50%.",
      },
      {
        version: 3,
        effectiveFrom: "2024-04-01",
        values: {
          eeRate: pctStr(PF_RATE),
          erRate: pctStr(PF_RATE),
          wageCeiling: n(PF_WAGE_CEILING),
          monthlyCap: n(PF_MONTHLY_CAP),
          epsRate: "8.33",
          epsCap: "1250",
          edliRate: "0.5",
          adminRate: "0.5",
          restrict: "Yes",
          vpf: "Allowed",
          vpfMax: "100",
        },
        changedBy: RAHUL,
        changedOn: "2024-03-18T10:40:00",
        note: "VPF enabled on employee request — up to 100% of Basic, no employer match.",
      },
    ],
  },
  {
    id: "esi",
    group: "ESI",
    title: "Employees' State Insurance (ESI Act, 1948)",
    authority: "ESIC",
    blurb: "Applies where monthly gross is at or below the threshold. Coverage is fixed for the contribution period once an employee enters it.",
    params: [
      { key: "eeRate", label: "Employee contribution", kind: "number", unit: "% of gross" },
      { key: "erRate", label: "Employer contribution", kind: "number", unit: "% of gross" },
      { key: "threshold", label: "Coverage threshold", kind: "number", unit: "₹ gross / month" },
      { key: "periods", label: "Contribution periods", kind: "text" },
    ],
    versions: [
      {
        version: 1,
        effectiveFrom: "2017-01-01",
        values: { eeRate: "1.75", erRate: "4.75", threshold: "21000", periods: "Apr–Sep · Oct–Mar" },
        changedBy: PRIYA,
        changedOn: "2016-12-22T12:10:00",
        note: "ESIC raised the coverage threshold from ₹15,000 to ₹21,000.",
      },
      {
        version: 2,
        effectiveFrom: "2019-07-01",
        values: {
          eeRate: pctStr(ESI_EMPLOYEE_RATE),
          erRate: pctStr(ESI_EMPLOYER_RATE),
          threshold: n(ESI_GROSS_CEILING),
          periods: "Apr–Sep · Oct–Mar",
        },
        changedBy: PRIYA,
        changedOn: "2019-06-20T15:30:00",
        note: "ESIC rate revision — employee 1.75% → 0.75%, employer 4.75% → 3.25%.",
      },
    ],
  },
  {
    id: "pt_ka",
    group: "PT",
    title: "Professional Tax — Karnataka",
    authority: "Karnataka Commercial Taxes",
    blurb: "Flat monthly levy above the gross threshold. Applies to Bengaluru HQ.",
    params: [
      { key: "threshold", label: "Gross threshold", kind: "number", unit: "₹ / month" },
      { key: "amount", label: "Monthly PT", kind: "number", unit: "₹" },
      { key: "annualCap", label: "Annual cap", kind: "number", unit: "₹" },
      { key: "due", label: "Remittance due", kind: "text" },
    ],
    versions: [
      {
        version: 1,
        effectiveFrom: "2016-04-01",
        values: { threshold: "15000", amount: "200", annualCap: "2400", due: "20th of next month" },
        changedBy: "Arjun Kapoor",
        changedOn: "2016-03-28T11:25:00",
        note: "Registered under the Karnataka Tax on Professions Act, 1976.",
      },
      {
        version: 2,
        effectiveFrom: "2023-04-01",
        values: { threshold: "25000", amount: "200", annualCap: "2500", due: "20th of next month" },
        changedBy: RAHUL,
        changedOn: "2023-03-27T09:50:00",
        note: "Karnataka Budget 2023 — exemption threshold raised from ₹15,000 to ₹25,000.",
      },
    ],
  },
  {
    id: "pt_mh",
    group: "PT",
    title: "Professional Tax — Maharashtra",
    authority: "Maharashtra GST Department",
    blurb: "Slab by monthly gross, with ₹300 in February so the year lands on the ₹2,500 cap. Applies to Pune.",
    params: [
      { key: "nilUpto", label: "Nil up to", kind: "number", unit: "₹ gross / month" },
      { key: "midUpto", label: "Middle slab up to", kind: "number", unit: "₹ gross / month" },
      { key: "midAmount", label: "Middle slab PT", kind: "number", unit: "₹" },
      { key: "amount", label: "Top slab PT", kind: "number", unit: "₹" },
      { key: "febAmount", label: "February PT", kind: "number", unit: "₹" },
      { key: "annualCap", label: "Annual cap", kind: "number", unit: "₹" },
      { key: "due", label: "Remittance due", kind: "text" },
    ],
    versions: [
      {
        version: 1,
        effectiveFrom: "2019-07-01",
        values: { nilUpto: "7500", midUpto: "10000", midAmount: "175", amount: "200", febAmount: "300", annualCap: "2500", due: "Last day of next month" },
        changedBy: PRIYA,
        changedOn: "2019-06-21T11:00:00",
        note: "Pune Delivery Centre opened — Maharashtra PTRC registered.",
      },
    ],
  },
  {
    id: "pt_ts",
    group: "PT",
    title: "Professional Tax — Telangana",
    authority: "Telangana Commercial Taxes",
    blurb: "Flat monthly levy above the gross threshold. Applies to the Hyderabad satellite.",
    params: [
      { key: "threshold", label: "Gross threshold", kind: "number", unit: "₹ / month" },
      { key: "amount", label: "Monthly PT", kind: "number", unit: "₹" },
      { key: "due", label: "Remittance due", kind: "text" },
    ],
    versions: [
      {
        version: 1,
        effectiveFrom: "2025-01-01",
        values: { threshold: "20000", amount: "200", due: "10th of next month" },
        changedBy: RAHUL,
        changedOn: "2024-12-19T14:15:00",
        note: "Hyderabad satellite registered for Telangana PT.",
      },
    ],
  },
  {
    id: "lwf_ka",
    group: "LWF",
    title: "Labour Welfare Fund — Karnataka",
    authority: "Karnataka Labour Welfare Board",
    blurb: "Annual contribution deducted in the December run, remitted by 15 January.",
    params: [
      { key: "ee", label: "Employee contribution", kind: "number", unit: "₹ / year" },
      { key: "er", label: "Employer contribution", kind: "number", unit: "₹ / year" },
      { key: "frequency", label: "Frequency", kind: "text" },
      { key: "deductIn", label: "Deducted in", kind: "text" },
    ],
    versions: [
      {
        version: 1,
        effectiveFrom: "2016-04-01",
        values: { ee: "20", er: "40", frequency: "Annual", deductIn: "December" },
        changedBy: "Arjun Kapoor",
        changedOn: "2016-03-28T11:30:00",
        note: "Registered with the Karnataka Labour Welfare Board.",
      },
      {
        version: 2,
        effectiveFrom: "2021-01-01",
        values: { ee: "50", er: "100", frequency: "Annual", deductIn: "December" },
        changedBy: PRIYA,
        changedOn: "2020-12-14T10:20:00",
        note: "Karnataka LWF (Amendment) — contributions raised to ₹50 / ₹100.",
      },
    ],
  },
  {
    id: "lwf_mh",
    group: "LWF",
    title: "Labour Welfare Fund — Maharashtra",
    authority: "Maharashtra Labour Welfare Board",
    blurb: "Half-yearly contribution deducted in the June and December runs.",
    params: [
      { key: "ee", label: "Employee contribution", kind: "number", unit: "₹ / half-year" },
      { key: "er", label: "Employer contribution", kind: "number", unit: "₹ / half-year" },
      { key: "frequency", label: "Frequency", kind: "text" },
      { key: "deductIn", label: "Deducted in", kind: "text" },
    ],
    versions: [
      {
        version: 1,
        effectiveFrom: "2019-07-01",
        values: { ee: "12", er: "36", frequency: "Half-yearly", deductIn: "June, December" },
        changedBy: PRIYA,
        changedOn: "2019-06-21T11:05:00",
        note: "Pune Delivery Centre registered with the Maharashtra board.",
      },
      {
        version: 2,
        effectiveFrom: "2023-07-01",
        values: { ee: "25", er: "75", frequency: "Half-yearly", deductIn: "June, December" },
        changedBy: RAHUL,
        changedOn: "2023-06-12T17:45:00",
        note: "Board notification — ₹25 / ₹75 for wages above ₹3,000.",
      },
    ],
  },
  {
    id: "tds",
    group: "TDS",
    title: "Income tax — TDS on salary (Section 192)",
    authority: "Income Tax Department",
    blurb: "Tax is projected on annual gross and spread evenly across the remaining months. New regime is the default unless the employee opts out.",
    params: [
      { key: "regime", label: "Default regime", kind: "text" },
      { key: "standardDeduction", label: "Standard deduction", kind: "number", unit: "₹ / year" },
      { key: "rebateCeiling", label: "Sec 87A rebate ceiling", kind: "number", unit: "₹ taxable" },
      { key: "cess", label: "Health & education cess", kind: "number", unit: "%" },
      { key: "method", label: "Projection method", kind: "text" },
      { key: "declarationWindow", label: "Investment declaration window", kind: "text" },
    ],
    versions: [
      {
        version: 1,
        effectiveFrom: "2024-04-01",
        values: { regime: "New regime", standardDeduction: "75000", rebateCeiling: "700000", cess: "4", method: "Projected annual gross, spread evenly", declarationWindow: "01–30 Apr; proofs 01–31 Jan" },
        changedBy: RAHUL,
        changedOn: "2024-07-29T12:00:00",
        note: "Union Budget 2024 — standard deduction under the new regime raised to ₹75,000.",
      },
      {
        version: 2,
        effectiveFrom: "2025-04-01",
        values: {
          regime: "New regime",
          standardDeduction: n(STANDARD_DEDUCTION),
          rebateCeiling: n(REBATE_87A_CEILING),
          cess: n(CESS_RATE * 100),
          method: "Projected annual gross, spread evenly",
          declarationWindow: "01–30 Apr; proofs 01–31 Jan",
        },
        changedBy: RAHUL,
        changedOn: "2025-03-24T10:15:00",
        note: "Union Budget 2025 — new slabs and the 87A rebate ceiling raised to ₹12,00,000.",
      },
    ],
  },
  {
    id: "codes",
    group: "Codes",
    title: "Establishment codes",
    authority: "Statutory registrations",
    blurb: "Printed on every challan, return and Form 16. A change here appears on the next generated file.",
    params: [
      { key: "pfCode", label: "EPFO establishment code", kind: "text" },
      { key: "esiCode", label: "ESIC employer code", kind: "text" },
      { key: "esiPune", label: "ESIC sub-code — Pune", kind: "text" },
      { key: "tan", label: "TAN", kind: "text" },
      { key: "pan", label: "PAN", kind: "text" },
      { key: "ptKa", label: "PT enrolment — Karnataka", kind: "text" },
      { key: "ptMh", label: "PTRC — Maharashtra", kind: "text" },
      { key: "ptTs", label: "PT registration — Telangana", kind: "text" },
    ],
    versions: [
      {
        version: 1,
        effectiveFrom: "2016-04-01",
        values: { pfCode: TENANT.pfCode, esiCode: TENANT.esiCode, esiPune: "—", tan: TENANT.tan, pan: TENANT.pan, ptKa: "PTEC 29371845620", ptMh: "—", ptTs: "—" },
        changedBy: "Arjun Kapoor",
        changedOn: "2016-03-28T11:35:00",
        note: "Initial registrations for Bengaluru HQ.",
      },
      {
        version: 2,
        effectiveFrom: "2019-07-01",
        values: { pfCode: TENANT.pfCode, esiCode: TENANT.esiCode, esiPune: "33000512340011001", tan: TENANT.tan, pan: TENANT.pan, ptKa: "PTEC 29371845620", ptMh: "PTRC 27551204887P", ptTs: "—" },
        changedBy: PRIYA,
        changedOn: "2019-06-21T11:10:00",
        note: "Pune Delivery Centre — ESIC sub-code and Maharashtra PTRC added.",
      },
      {
        version: 3,
        effectiveFrom: "2025-01-01",
        values: { pfCode: TENANT.pfCode, esiCode: TENANT.esiCode, esiPune: "33000512340011001", tan: TENANT.tan, pan: TENANT.pan, ptKa: "PTEC 29371845620", ptMh: "PTRC 27551204887P", ptTs: "PT 36190044127" },
        changedBy: RAHUL,
        changedOn: "2024-12-19T14:20:00",
        note: "Hyderabad satellite — Telangana PT registration added.",
      },
    ],
  },
];

export interface StatChange {
  sectionId: StatSectionId;
  version: number;
  effectiveFrom: string;
  changedBy: string;
  changedOn: string;
  note: string;
  diffs: { label: string; from: string; to: string }[];
}

/** What changed between each version and the one before it. */
export function statHistory(section: StatSection): StatChange[] {
  return section.versions
    .map((v, i) => {
      const prev = section.versions[i - 1];
      const diffs = section.params
        .filter((p) => !prev || prev.values[p.key] !== v.values[p.key])
        .map((p) => ({ label: p.label, from: prev ? prev.values[p.key] ?? "—" : "—", to: v.values[p.key] ?? "—" }));
      return { sectionId: section.id, version: v.version, effectiveFrom: v.effectiveFrom, changedBy: v.changedBy, changedOn: v.changedOn, note: v.note, diffs };
    })
    .reverse();
}

/** The version in force on DEMO_TODAY. */
export function statCurrent(section: StatSection): StatVersion {
  const live = section.versions.filter((v) => v.effectiveFrom <= DEMO_TODAY);
  return live[live.length - 1] ?? section.versions[0];
}

export const statVersionStatus = (section: StatSection, v: StatVersion) =>
  v.effectiveFrom > DEMO_TODAY ? "scheduled" : v === statCurrent(section) ? "effective" : "superseded";

/* ======================================================= returns & forms */

const EPS_RATE = 0.0833;
const EPS_CAP = 1250;
const EDLI_RATE = 0.005;
const ADMIN_RATE = 0.005;

export const epfWagesOf = (a: Amounts) => Math.min(a.basic, PF_WAGE_CEILING);
export const epsOf = (a: Amounts) => Math.min(Math.round(epfWagesOf(a) * EPS_RATE), EPS_CAP);

const amountsCache = new Map<string, Amounts[]>();

/** The run population's amounts for one processed period — exactly what payRunRows sums. */
function runAmounts(periodId: string): Amounts[] {
  const cached = amountsCache.get(periodId);
  if (cached) return cached;
  const p = periodById(periodId);
  const out = p ? runPopulation(p.id).map((e) => computeAmounts(p, e)) : [];
  amountsCache.set(periodId, out);
  return out;
}

export interface ReturnLine {
  code: string;
  name: string;
  /** UAN for ECR, IP number for ESI, PAN for PT / 24Q. */
  idNo: string;
  wages: number;
  ee: number;
  er: number;
  detail: string;
}

const ipNumber = (code: string) => `53${String(1000000 + Number(code.slice(4)) * 7919).slice(-8)}`;

export function ecrLines(periodId: string): ReturnLine[] {
  return runAmounts(periodId).map((a) => ({
    code: a.employee.code,
    name: a.employee.name,
    idNo: a.employee.uan,
    wages: epfWagesOf(a),
    ee: a.pf,
    er: a.employerPf,
    detail: `EPS ₹${epsOf(a)} · EPF ₹${a.employerPf - epsOf(a)}`,
  }));
}

export function esiLines(periodId: string): ReturnLine[] {
  return runAmounts(periodId)
    .filter((a) => a.esi > 0)
    .map((a) => ({
      code: a.employee.code,
      name: a.employee.name,
      idNo: ipNumber(a.employee.code),
      wages: a.gross,
      ee: a.esi,
      er: a.employerEsi,
      detail: `${a.paidDays} paid days`,
    }));
}

export function ptLines(periodId: string, state: string): ReturnLine[] {
  return runAmounts(periodId)
    .filter((a) => a.ptResult.state === state && a.pt > 0)
    .map((a) => ({
      code: a.employee.code,
      name: a.employee.name,
      idNo: a.employee.pan,
      wages: a.gross,
      ee: a.pt,
      er: 0,
      detail: a.ptResult.rule,
    }));
}

export function tdsLines(periodIds: string[]): ReturnLine[] {
  const by = new Map<string, ReturnLine>();
  for (const id of periodIds) {
    for (const a of runAmounts(id)) {
      const cur = by.get(a.employee.code) ?? {
        code: a.employee.code,
        name: a.employee.name,
        idNo: a.employee.pan,
        wages: 0,
        ee: 0,
        er: 0,
        detail: "",
      };
      cur.wages += a.gross;
      cur.ee += a.tds;
      by.set(a.employee.code, cur);
    }
  }
  return [...by.values()]
    .filter((l) => l.ee > 0)
    .map((l) => ({ ...l, detail: `Section 192 · ${periodIds.length} months` }));
}

export const sumLines = (lines: ReturnLine[], k: "ee" | "er" | "wages") => lines.reduce((s, l) => s + l[k], 0);

/** PF challan split: EE 12%, ER = EPS + EPF difference, plus EDLI and admin on PF wages. */
export function ecrChallan(periodId: string) {
  const amounts = runAmounts(periodId);
  const wages = amounts.reduce((s, a) => s + epfWagesOf(a), 0);
  const ee = amounts.reduce((s, a) => s + a.pf, 0);
  const er = amounts.reduce((s, a) => s + a.employerPf, 0);
  const eps = amounts.reduce((s, a) => s + epsOf(a), 0);
  const edli = Math.round(wages * EDLI_RATE);
  const admin = Math.max(500, Math.round(wages * ADMIN_RATE));
  return { members: amounts.length, wages, ee, er, eps, erEpf: er - eps, edli, admin, total: ee + er + edli + admin };
}

/** Σ PF from the pay run's own rows — the other side of the ECR reconciliation. */
export function runPfTotal(periodId: string) {
  const p = periodById(periodId);
  if (!p) return 0;
  return payRunRows(periodId).reduce((s, r) => s + computeAmounts(p, employeeByCode(r.employeeCode)!).pf, 0);
}

/** PF + ESI + PT + TDS remitted for a month must equal the run's statutory total. */
export function monthStatutoryRecon(periodId: string) {
  const amounts = runAmounts(periodId);
  const pf = amounts.reduce((s, a) => s + a.pf, 0);
  const esi = amounts.reduce((s, a) => s + a.esi, 0);
  const pt = amounts.reduce((s, a) => s + a.pt, 0);
  const tds = amounts.reduce((s, a) => s + a.tds, 0);
  return { pf, esi, pt, tds, sum: pf + esi + pt + tds, runStatutory: runById(periodId)?.totals.statutory ?? 0 };
}

/** Σ monthly TDS across a set of run periods. */
export const runTdsTotal = (periodIds: string[]) =>
  periodIds.reduce((s, id) => s + runAmounts(id).reduce((t, a) => t + a.tds, 0), 0);

/* ---------------------------------------------------- Form 16 / 12BA */

export const FY2526_MONTHS: string[] = Array.from({ length: 12 }, (_, i) =>
  format(addMonths(parseISO("2025-04-01"), i), "yyyy-MM"),
);

/** FY 2025-26 months before the pay-run history window are rebuilt with the same engine. */
function fyPeriod(id: string): PayPeriod {
  const known = PAY_PERIODS.find((p) => p.id === id);
  if (known) return known;
  const start = `${id}-01`;
  const y = Number(id.slice(0, 4));
  const m = Number(id.slice(5, 7));
  const dim = getDaysInMonth(parseISO(start));
  return {
    id,
    runId: `PR-${id}`,
    label: format(parseISO(start), "MMMM yyyy"),
    shortLabel: format(parseISO(start), "MMM yy"),
    periodStart: start,
    periodEnd: `${id}-${dim}`,
    payDate: `${id}-${dim}`,
    daysInMonth: dim,
    calendarMonth: m,
    monthIndexInFy: ((m - 4 + 12) % 12) + 1,
    fy: "FY 2025-26",
    status: "paid",
    seed: y * 100 + m,
  };
}

/** Rule 3 motor-car perquisite (above 1.6 L, with chauffeur), FY 2025-26 values. */
const CAR_PERQ_MONTHLY = 8000 + 3000;

export interface Form16Row {
  code: string;
  name: string;
  pan: string;
  designation: string;
  gradeId: string;
  months: number;
  salary17_1: number;
  perquisites: number;
  perquisiteNote: string;
  grossSalary: number;
  standardDeduction: number;
  taxable: number;
  taxOnIncome: number;
  tdsByQuarter: [number, number, number, number];
  tds: number;
  /** Positive = payable by the employee on self-assessment; negative = refund due. */
  balance: number;
  issuedOn: string;
}

let form16Cache: Form16Row[] | null = null;

/** One row per employee on roll before 1 Apr 2026, built from all twelve FY 2025-26 months. */
export function form16Rows(): Form16Row[] {
  if (form16Cache) return form16Cache;
  const periods = FY2526_MONTHS.map(fyPeriod);
  const rows: Form16Row[] = [];
  for (const emp of RUN_POPULATION) {
    if (emp.joiningDate.slice(0, 7) > "2026-03") continue;
    const worked = periods.filter((p) => onRunRoll(p, emp));
    const q: [number, number, number, number] = [0, 0, 0, 0];
    let salary = 0;
    for (const p of worked) {
      const a = computeAmounts(p, emp);
      salary += a.gross;
      q[Math.floor(FY2526_MONTHS.indexOf(p.id) / 3)] += a.tds;
    }
    const leadership = emp.gradeId === "G6" || emp.gradeId === "G7";
    const perquisites = leadership ? CAR_PERQ_MONTHLY * worked.length : 0;
    const grossSalary = salary + perquisites;
    const tax = computeTds(grossSalary);
    const tds = q[0] + q[1] + q[2] + q[3];
    rows.push({
      code: emp.code,
      name: emp.name,
      pan: emp.pan,
      designation: emp.designation,
      gradeId: emp.gradeId,
      months: worked.length,
      salary17_1: salary,
      perquisites,
      perquisiteNote: leadership ? "Motor car above 1.6 L with chauffeur — Rule 3(2)" : "Nil",
      grossSalary,
      standardDeduction: Math.min(STANDARD_DEDUCTION, grossSalary),
      taxable: tax.annualTaxable,
      taxOnIncome: tax.annualTax,
      tdsByQuarter: q,
      tds,
      balance: tax.annualTax - tds,
      issuedOn: "2026-06-10",
    });
  }
  form16Cache = rows;
  return rows;
}

/* -------------------------------------------------------------- filings */

export type ReturnForm = "ECR" | "ESI" | "PT" | "24Q" | "FORM16" | "12BA";
export type ReturnStatus = "due" | "generated" | "filed";

export const RETURN_FORM_META: Record<ReturnForm, { label: string; authority: string; frequency: string }> = {
  ECR: { label: "PF ECR", authority: "EPFO unified portal", frequency: "Monthly · 15th" },
  ESI: { label: "ESI contribution", authority: "ESIC portal", frequency: "Monthly · 15th" },
  PT: { label: "Professional tax", authority: "State tax portal", frequency: "Monthly · per state" },
  "24Q": { label: "Form 24Q (TDS)", authority: "TRACES / Protean", frequency: "Quarterly" },
  FORM16: { label: "Form 16 (Part A & B)", authority: "TRACES · issued to employees", frequency: "Annual · 15 Jun" },
  "12BA": { label: "Form 12BA", authority: "Issued with Form 16", frequency: "Annual · 15 Jun" },
};

export interface ReturnFiling {
  id: string;
  form: ReturnForm;
  title: string;
  periodLabel: string;
  periodIds: string[];
  fy: string;
  state: string | null;
  dueDate: string;
  status: ReturnStatus;
  generatedOn: string | null;
  filedOn: string | null;
  ackNo: string | null;
  records: number;
  employeeShare: number;
  employerShare: number;
  total: number;
  fileName: string;
}

export const RETURN_PT_STATES: { state: string; short: string; dueDay: number | "eom" }[] = [
  { state: "Karnataka", short: "KA", dueDay: 20 },
  { state: "Maharashtra", short: "MH", dueDay: "eom" },
  { state: "Telangana", short: "TS", dueDay: 10 },
];

const FY2627_MONTHS = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];

const dueOn = (periodId: string, day: number | "eom") => {
  const nm = format(addMonths(parseISO(`${periodId}-01`), 1), "yyyy-MM");
  const d = day === "eom" ? getDaysInMonth(parseISO(`${nm}-01`)) : day;
  return `${nm}-${String(d).padStart(2, "0")}`;
};
const minusDays = (iso: string, d: number) =>
  `${iso.slice(0, 8)}${String(Math.max(1, Number(iso.slice(8)) - d)).padStart(2, "0")}`;
const monLabel = (periodId: string) => format(parseISO(`${periodId}-01`), "MMM yyyy");

/** Deterministic acknowledgement / TRRN / token numbers. */
export function returnAck(seed: string, prefix: string, digits = 12) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rng = mulberry32(h);
  let s = "";
  while (s.length < digits) s += String(Math.floor(rng() * 10));
  return `${prefix}${s}`;
}

/** Explicit states for the filings around DEMO_TODAY; anything past its due date is filed. */
const LIVE_STATE: Record<string, { status: ReturnStatus; generatedOn?: string; filedOn?: string }> = {
  "ECR-2026-08": { status: "filed", generatedOn: "2026-09-10", filedOn: "2026-09-12" },
  "ESI-2026-08": { status: "filed", generatedOn: "2026-09-11", filedOn: "2026-09-14" },
  "PT-KA-2026-08": { status: "generated", generatedOn: "2026-09-14" },
  "PT-MH-2026-08": { status: "due" },
  "PT-TS-2026-08": { status: "filed", generatedOn: "2026-09-07", filedOn: "2026-09-08" },
  "FORM16-2025-26": { status: "filed", generatedOn: "2026-06-08", filedOn: "2026-06-10" },
  "12BA-2025-26": { status: "filed", generatedOn: "2026-06-08", filedOn: "2026-06-10" },
};

const ACK_PREFIX: Record<ReturnForm, string> = { ECR: "TRRN ", ESI: "CHLN ", PT: "RCPT ", "24Q": "TKN ", FORM16: "F16 ", "12BA": "12BA " };

function filing(
  base: Omit<ReturnFiling, "status" | "generatedOn" | "filedOn" | "ackNo" | "total"> & { total?: number },
): ReturnFiling {
  const live = LIVE_STATE[base.id];
  const settled = !live && base.dueDate < DEMO_TODAY;
  const status: ReturnStatus = live?.status ?? (settled ? "filed" : "due");
  const filedOn = live?.filedOn ?? (settled ? minusDays(base.dueDate, 2 + (base.id.length % 4)) : null);
  const generatedOn = live?.generatedOn ?? (filedOn ? minusDays(filedOn, 1) : null);
  return {
    ...base,
    total: base.total ?? base.employeeShare + base.employerShare,
    status,
    generatedOn,
    filedOn,
    ackNo: status === "filed" ? returnAck(base.id, ACK_PREFIX[base.form]) : null,
  };
}

const QUARTERS = [
  { q: "Q3", fy: "FY 2025-26", months: ["2025-10", "2025-11", "2025-12"], due: "2026-01-31" },
  { q: "Q4", fy: "FY 2025-26", months: ["2026-01", "2026-02", "2026-03"], due: "2026-05-31" },
  { q: "Q1", fy: "FY 2026-27", months: ["2026-04", "2026-05", "2026-06"], due: "2026-07-31" },
  { q: "Q2", fy: "FY 2026-27", months: ["2026-07", "2026-08", "2026-09"], due: "2026-10-31" },
];

let filingsCache: ReturnFiling[] | null = null;

/** Every return in the calendar — built lazily, since it walks the whole run population. */
export function returnFilings(): ReturnFiling[] {
  if (filingsCache) return filingsCache;
  const out: ReturnFiling[] = [];
  for (const m of FY2627_MONTHS) {
    const tag = m.replace("-", "");
    const c = ecrChallan(m);
    out.push(filing({ id: `ECR-${m}`, form: "ECR", title: "PF ECR", periodLabel: monLabel(m), periodIds: [m], fy: "FY 2026-27", state: null, dueDate: dueOn(m, 15), records: c.members, employeeShare: c.ee, employerShare: c.er, total: c.total, fileName: `ECR_${TENANT.pfCode.replace(/\//g, "")}_${tag}.txt` }));
    const e = esiLines(m);
    out.push(filing({ id: `ESI-${m}`, form: "ESI", title: "ESI contribution", periodLabel: monLabel(m), periodIds: [m], fy: "FY 2026-27", state: null, dueDate: dueOn(m, 15), records: e.length, employeeShare: sumLines(e, "ee"), employerShare: sumLines(e, "er"), fileName: `ESI_MC_${TENANT.esiCode}_${tag}.xlsx` }));
    for (const s of RETURN_PT_STATES) {
      const l = ptLines(m, s.state);
      out.push(filing({ id: `PT-${s.short}-${m}`, form: "PT", title: `PT return — ${s.state}`, periodLabel: monLabel(m), periodIds: [m], fy: "FY 2026-27", state: s.state, dueDate: dueOn(m, s.dueDay), records: l.length, employeeShare: sumLines(l, "ee"), employerShare: 0, fileName: `PT_${s.short}_${tag}.csv` }));
    }
  }
  for (const q of QUARTERS) {
    const l = tdsLines(q.months);
    out.push(filing({ id: `24Q-${q.fy.slice(3)}-${q.q}`, form: "24Q", title: `Form 24Q ${q.q}`, periodLabel: `${q.q} · ${monLabel(q.months[0]).slice(0, 3)}–${monLabel(q.months[2])}`, periodIds: q.months, fy: q.fy, state: null, dueDate: q.due, records: l.length, employeeShare: sumLines(l, "ee"), employerShare: 0, fileName: `24Q_${TENANT.tan}_${q.q}_${q.fy.slice(3)}.fvu` }));
  }
  const f16 = form16Rows();
  out.push(filing({ id: "FORM16-2025-26", form: "FORM16", title: "Form 16 — Part A & B", periodLabel: "FY 2025-26", periodIds: FY2526_MONTHS, fy: "FY 2025-26", state: null, dueDate: "2026-06-15", records: f16.length, employeeShare: f16.reduce((s, r) => s + r.tds, 0), employerShare: 0, fileName: "Form16_FY2025-26_PartA_PartB.zip" }));
  out.push(filing({ id: "12BA-2025-26", form: "12BA", title: "Form 12BA — perquisites", periodLabel: "FY 2025-26", periodIds: FY2526_MONTHS, fy: "FY 2025-26", state: null, dueDate: "2026-06-15", records: f16.length, employeeShare: f16.reduce((s, r) => s + r.perquisites, 0), employerShare: 0, fileName: "Form12BA_FY2025-26.zip" }));
  filingsCache = out.sort((a, b) => (a.dueDate < b.dueDate ? 1 : a.dueDate > b.dueDate ? -1 : a.id.localeCompare(b.id)));
  return filingsCache;
}

/** Statutory lines behind a filing, for the detail drawer and its export. */
export function returnLinesFor(f: ReturnFiling): ReturnLine[] {
  if (f.form === "ECR") return ecrLines(f.periodIds[0]);
  if (f.form === "ESI") return esiLines(f.periodIds[0]);
  if (f.form === "PT") return ptLines(f.periodIds[0], f.state ?? "Karnataka");
  if (f.form === "24Q") return tdsLines(f.periodIds);
  return form16Rows()
    .filter((r) => f.form === "FORM16" || r.perquisites > 0)
    .map((r) => ({
      code: r.code,
      name: r.name,
      idNo: r.pan,
      wages: r.grossSalary,
      ee: f.form === "FORM16" ? r.tds : r.perquisites,
      er: 0,
      detail: f.form === "FORM16" ? `${r.months} months` : r.perquisiteNote,
    }));
}
