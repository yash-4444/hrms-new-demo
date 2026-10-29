/* ============================================================================
   AI pay-run anomaly scan — pure, deterministic. Compares every employee in a
   run with the same employee in the previous period and explains movements the
   three hard exceptions (missing bank, LOP over window, negative net) do not
   catch. Nothing here changes the run; it only proposes items to review.
   ========================================================================== */

import { inr } from "@/lib/format";
import { employeeByCode } from "@/mock/employees";
import { ANOMALIES } from "@/mock/ai";
import {
  PAY_PERIODS,
  computeAmounts,
  payslipFor,
  payRunRows,
  periodById,
  type Amounts,
  type PayComponent,
  type PayPeriod,
} from "@/mock/payroll";
import type { ExplainDriver } from "@/components/ai";

export type PayFlagKind =
  | "Net movement"
  | "LOP swing"
  | "Arrears / one-time"
  | "Overtime change"
  | "Tax change"
  | "Advance recovery"
  | "First pay — pro-rated"
  | "Rebound after joining month";

export type PayFlagSeverity = "High" | "Medium" | "Low";

export interface PayFlag {
  id: string;
  code: string;
  name: string;
  department: string;
  branch: string;
  kind: PayFlagKind;
  severity: PayFlagSeverity;
  title: string;
  reason: string;
  before: number | null;
  after: number;
  pct: number | null;
  drivers: ExplainDriver[];
  confidence: number;
  /** Also raised on /ai/insights — same signal, one source. */
  inInsights: boolean;
}

export interface PayScan {
  period: PayPeriod;
  previous: PayPeriod | null;
  scanned: number;
  flags: PayFlag[];
}

/** The period immediately before `period` in the fixture calendar, if any. */
export function previousPeriod(period: PayPeriod): PayPeriod | null {
  const i = PAY_PERIODS.findIndex((p) => p.id === period.id);
  return i > 0 ? PAY_PERIODS[i - 1] : null;
}

const INSIGHT_CODES = new Set(
  ANOMALIES.filter((a) => a.kind === "Payroll variance" && a.subjectCode).map((a) => a.subjectCode!),
);

const money = (n: number) => inr(n, { decimals: false });
const sev: Record<PayFlagSeverity, number> = { High: 0, Medium: 1, Low: 2 };

function componentDrivers(cur: Amounts, prev: Amounts): ExplainDriver[] {
  const rows: [string, number, number, boolean][] = [
    ["Loss of pay", cur.lop, prev.lop, true],
    ["Arrears", cur.arrears, prev.arrears, false],
    ["Overtime", cur.overtime, prev.overtime, false],
    ["Performance pay", cur.perf, prev.perf, false],
    ["Special allowance", cur.special, prev.special, false],
    ["Basic", cur.basic, prev.basic, false],
    ["TDS", cur.tds, prev.tds, true],
    ["Salary advance recovery", cur.advance, prev.advance, true],
  ];
  return rows
    .map(([label, now, before, deduction]) => ({ label, now, before, deduction, delta: now - before }))
    .filter((r) => Math.round(Math.abs(r.delta)) >= 1)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 4)
    .map((r) => ({
      label: `${r.label} ${r.delta > 0 ? "up" : "down"} ${money(Math.abs(r.delta))}`,
      detail: `${money(r.before)} → ${money(r.now)}${r.deduction ? " (deduction — moves net the other way)" : ""}`,
      weight: Math.abs(r.delta),
    }));
}

/** Run the scan for one pay run (or period id). Memoised per run. */
const cache = new Map<string, PayScan | null>();
export function scanPayRun(runId: string): PayScan | null {
  if (cache.has(runId)) return cache.get(runId)!;
  const period = periodById(runId);
  const result = period ? build(period) : null;
  cache.set(runId, result);
  return result;
}

function build(period: PayPeriod): PayScan {
  const previous = previousPeriod(period);
  const rows = payRunRows(period.runId);
  const prevRows = new Map((previous ? payRunRows(previous.runId) : []).map((r) => [r.employeeCode, r]));
  const flags: PayFlag[] = [];

  for (const r of rows) {
    // The three hard exceptions are already handled in the Exceptions section.
    if (r.exceptionType) continue;
    const emp = employeeByCode(r.employeeCode);
    if (!emp) continue;
    const p = prevRows.get(r.employeeCode);
    const base = { code: r.employeeCode, name: r.name, department: r.department, branch: r.branch, inInsights: INSIGHT_CODES.has(r.employeeCode) };

    if (!p && previous) {
      const a = computeAmounts(period, emp);
      if (!a.prorated) continue;
      flags.push({
        ...base,
        id: `pf-${r.employeeCode}-join`,
        kind: "First pay — pro-rated",
        severity: "Low",
        title: `First salary, pro-rated to ${a.payableDays}/${a.daysInMonth} days`,
        reason: `Joined ${emp.joiningDate}. Net ${money(r.net)} is ${Math.round(a.factor * 100)}% of a full month — check the joining date matches the offer.`,
        before: null,
        after: r.net,
        pct: null,
        drivers: [
          { label: `Payable days ${a.payableDays} of ${a.daysInMonth}`, detail: `Joining date ${emp.joiningDate}`, weight: a.daysInMonth - a.payableDays },
          { label: "No previous payslip to compare", detail: `Not on the ${previous.shortLabel} roll`, weight: 1 },
        ],
        confidence: 96,
      });
      continue;
    }
    if (!p || p.net <= 0 || r.net <= 0 || p.exceptionType || !previous) continue;

    const pct = ((r.net - p.net) / p.net) * 100;
    if (Math.abs(pct) < 5) continue;

    const cur = computeAmounts(period, emp);
    const prv = computeAmounts(previous, emp);
    const drivers = componentDrivers(cur, prv);
    const lopSwing = cur.lopDays - prv.lopDays;
    const dir = pct < 0 ? "down" : "up";

    let kind: PayFlagKind = "Net movement";
    let reason = `No single component explains it — review the traced breakdown.`;
    if (prv.prorated && !cur.prorated) {
      kind = "Rebound after joining month";
      reason = `${previous.shortLabel} was pro-rated to ${prv.payableDays}/${prv.daysInMonth} days from the joining date; this is the first full month. Expected — no action unless the joining date is wrong.`;
    } else if (lopSwing !== 0) {
      kind = "LOP swing";
      reason =
        lopSwing > 0
          ? `${cur.lopDays} LOP day(s) this month vs ${prv.lopDays} in ${previous.shortLabel}. Confirm the days with attendance before locking.`
          : `LOP fell from ${prv.lopDays} to ${cur.lopDays} day(s) — an expected rebound. Make sure no LOP reversal is also paid as arrears.`;
    } else if (cur.arrears !== prv.arrears && Math.abs(cur.arrears - prv.arrears) >= Math.abs(r.net - p.net) * 0.4) {
      kind = "Arrears / one-time";
      reason = `Arrears of ${money(cur.arrears)} this month (${money(prv.arrears)} last month). Check the arrear period and approval note.`;
    } else if (Math.abs(cur.overtime - prv.overtime) >= Math.abs(r.net - p.net) * 0.4) {
      kind = "Overtime change";
      reason =
        cur.overtime > prv.overtime
          ? `${cur.overtimeHours} overtime hours paid (${money(cur.overtime)}). Confirm the manager sign-off on the time sheet.`
          : `Overtime fell ${money(prv.overtime)} → ${money(cur.overtime)} — normal after a peak month; no action unless hours were missed.`;
    } else if (Math.abs(cur.advance - prv.advance) >= Math.abs(r.net - p.net) * 0.4) {
      kind = "Advance recovery";
      reason =
        cur.advance > prv.advance
          ? `Salary-advance recovery of ${money(cur.advance)} starts this month (was ${money(prv.advance)}). Check it matches the loan schedule.`
          : `Advance recovery ended or reduced (${money(prv.advance)} → ${money(cur.advance)}). Confirm the loan is closed and no instalment is missed.`;
    } else if (Math.abs(cur.tds - prv.tds) >= Math.abs(r.net - p.net) * 0.4) {
      kind = "Tax change";
      reason = `TDS moved ${money(prv.tds)} → ${money(cur.tds)} — usually a revised declaration or a regime switch.`;
    }

    const abs = Math.abs(pct);
    flags.push({
      ...base,
      id: `pf-${r.employeeCode}`,
      kind,
      severity: kind === "Rebound after joining month" ? "Low" : abs >= 20 ? "High" : abs >= 10 ? "Medium" : "Low",
      title: `Net pay ${dir} ${abs.toFixed(1)}% vs ${previous.shortLabel}`,
      reason,
      before: p.net,
      after: r.net,
      pct,
      drivers: drivers.length ? drivers : [{ label: "Rounding and statutory recalculation", detail: "No component moved by more than ₹1", weight: 1 }],
      confidence: kind === "Net movement" ? 71 : kind === "LOP swing" || kind === "Rebound after joining month" ? 94 : 86,
    });
  }

  flags.sort((a, b) => sev[a.severity] - sev[b.severity] || Math.abs(b.pct ?? 0) - Math.abs(a.pct ?? 0));
  return { period, previous, scanned: rows.length, flags };
}

/* ------------------------------------------------ plain-words explanation */

export interface PlainLine {
  label: string;
  before: number;
  now: number;
  /** True for a deduction: an increase lowers take-home. */
  deduction: boolean;
}

export interface PlainExplanation {
  periodLabel: string;
  prevLabel: string;
  net: number;
  prevNet: number;
  sentences: string[];
  lines: PlainLine[];
}

function lineDeltas(a: PayComponent[], b: PayComponent[], deduction: boolean): PlainLine[] {
  const labels = [...new Set([...a, ...b].map((c) => c.label))];
  return labels
    .map((label) => ({
      label,
      now: a.find((c) => c.label === label)?.amount ?? 0,
      before: b.find((c) => c.label === label)?.amount ?? 0,
      deduction,
    }))
    .filter((l) => Math.round(Math.abs(l.now - l.before)) >= 1);
}

/** Month-over-month explanation of one employee's payslip, in plain sentences. */
export function explainPayslip(runId: string, code: string): PlainExplanation | null {
  const period = periodById(runId);
  const prevPeriod = period ? previousPeriod(period) : null;
  const cur = payslipFor(runId, code);
  if (!period || !cur) return null;
  const prev = prevPeriod ? payslipFor(prevPeriod.runId, code) : null;
  const first = cur.employee.name.split(" ")[0];

  if (!prev) {
    return {
      periodLabel: cur.periodLabel,
      prevLabel: "—",
      net: cur.net,
      prevNet: 0,
      lines: [],
      sentences: [
        `This is ${first}'s first payslip on this payroll, so there is no earlier month to compare with.`,
        `${first} was paid for ${cur.paidDays} of ${cur.daysInMonth} days${cur.prorated ? " because the month was pro-rated from the joining date" : ""}. Take-home is ${money(cur.net)} after ${money(cur.totalDeductions)} of deductions.`,
      ],
    };
  }

  const lines = [
    ...lineDeltas(cur.earnings, prev.earnings, false),
    ...lineDeltas([...cur.statutory, ...cur.deductions], [...prev.statutory, ...prev.deductions], true),
  ].sort((x, y) => Math.abs(y.now - y.before) - Math.abs(x.now - x.before));

  const diff = cur.net - prev.net;
  const sentences: string[] = [];
  sentences.push(
    Math.round(diff) === 0
      ? `${first}'s take-home for ${cur.periodLabel} is ${money(cur.net)} — the same as ${prev.periodLabel}.`
      : `${first}'s take-home for ${cur.periodLabel} is ${money(cur.net)}, ${money(Math.abs(diff))} ${diff < 0 ? "less" : "more"} than ${prev.periodLabel} (${money(prev.net)}).`,
  );
  if (cur.lopDays !== prev.lopDays) {
    sentences.push(
      cur.lopDays > prev.lopDays
        ? `There were ${cur.lopDays} unpaid (loss-of-pay) day(s) this month against ${prev.lopDays} last month, so salary was paid for ${cur.paidDays} of ${cur.daysInMonth} days.`
        : `Unpaid days dropped from ${prev.lopDays} to ${cur.lopDays}, so more of the month was paid.`,
    );
  }
  for (const l of lines.slice(0, 3)) {
    const up = l.now > l.before;
    const effect = l.deduction ? (up ? "which lowers take-home" : "which raises take-home") : up ? "adding to take-home" : "reducing take-home";
    sentences.push(`${l.label} ${up ? "went up" : "went down"} by ${money(Math.abs(l.now - l.before))} (${money(l.before)} → ${money(l.now)}), ${effect}.`);
  }
  if (lines.length === 0 && cur.lopDays === prev.lopDays) {
    sentences.push("No component changed between the two months; the payslip is a straight repeat.");
  }
  return { periodLabel: cur.periodLabel, prevLabel: prev.periodLabel, net: cur.net, prevNet: prev.net, sentences, lines };
}
