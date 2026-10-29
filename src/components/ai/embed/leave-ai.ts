/* ============================================================================
   Leave AI signals — pure, deterministic helpers over the leave fixtures.
   Used by the apply dialog (hints) and the approvals queue (risk chip).
   Nothing here decides anything: every output is a suggestion a person reads.
   ========================================================================== */

import { addDays, differenceInCalendarDays, format, getDay, parseISO } from "date-fns";
import { DEMO_TODAY, holidaysFor } from "@/mock/org";
import { EMPLOYEES, employeeByCode } from "@/mock/employees";
import {
  LEAVE_APPLICATIONS,
  LEAVE_TYPE_BY_CODE,
  balanceFor,
  balancesFor,
  isWorkingDay,
  type LeaveApplication,
} from "@/mock/leave";
import type { ExplainDriver } from "@/components/ai/ai-ui";

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const short = (s: string) => format(parseISO(s), "dd MMM");
const TODAY = parseISO(DEMO_TODAY);

/** Decision SLA for a leave request — §7.2 escalates unactioned requests after 48 hours. */
export const LEAVE_SLA_DAYS = 2;

/** Whole days a request has waited, measured against DEMO_TODAY (never negative). */
export function leaveAgeDays(appliedOn: string) {
  return Math.max(0, differenceInCalendarDays(TODAY, parseISO(appliedOn)));
}

export const isPastSla = (a: Pick<LeaveApplication, "status" | "appliedOn">) =>
  a.status === "pending" && leaveAgeDays(a.appliedOn) >= LEAVE_SLA_DAYS;

/* -------------------------------------------------------------- teammates */

/** Active people who share the applicant's reporting manager. */
export function teammatesOf(code: string) {
  const me = employeeByCode(code);
  if (!me?.managerCode) return [];
  return EMPLOYEES.filter((e) => e.managerCode === me.managerCode && e.code !== code && e.status !== "exited");
}

const blocking = (a: LeaveApplication) => a.status === "approved" || a.status === "pending";

export interface TeamClash {
  teamSize: number;
  /** Peak day inside the range and who is off on it. */
  peakDate: string | null;
  peakNames: string[];
  /** Distinct teammates off on any day of the range. */
  anyOff: string[];
}

/** Teammates with approved or pending leave overlapping [from, to]. */
export function teamClash(code: string, from: string, to: string, excludeId?: string): TeamClash {
  const team = teammatesOf(code);
  const teamCodes = new Set(team.map((t) => t.code));
  const apps = LEAVE_APPLICATIONS.filter(
    (a) => teamCodes.has(a.employeeCode) && a.id !== excludeId && blocking(a) && a.fromDate <= to && a.toDate >= from,
  );
  let peakDate: string | null = null;
  let peakNames: string[] = [];
  const end = parseISO(to);
  for (let d = parseISO(from); d <= end; d = addDays(d, 1)) {
    const day = iso(d);
    if (!isWorkingDay(day)) continue;
    const names = [...new Set(apps.filter((a) => a.fromDate <= day && a.toDate >= day).map((a) => a.employeeName))];
    if (names.length > peakNames.length) {
      peakNames = names;
      peakDate = day;
    }
  }
  return { teamSize: team.length, peakDate, peakNames, anyOff: [...new Set(apps.map((a) => a.employeeName))] };
}

/* --------------------------------------------------------- long weekends */

export interface LongWeekend {
  holiday: string;
  holidayDate: string;
  /** Leave dates to apply for. */
  from: string;
  to: string;
  leaveDays: number;
  offFrom: string;
  offTo: string;
  totalDays: number;
}

/**
 * Upcoming gazetted holidays where one or two days of leave join the holiday to a
 * weekend. Best ratio of days off to leave days first. Respects 3-day notice.
 */
export function longWeekends(country: "IN" | "US", limit = 2): LongWeekend[] {
  const earliest = iso(addDays(TODAY, 3));
  const horizon = iso(addDays(TODAY, 120));
  const off = (s: string) => !isWorkingDay(s, country);
  const out: LongWeekend[] = [];
  for (const h of holidaysFor(country)) {
    if (h.optional || h.date < earliest || h.date > horizon || !off(h.date)) continue;
    // The contiguous off-block the holiday sits in.
    let bs = parseISO(h.date);
    let be = parseISO(h.date);
    while (off(iso(addDays(bs, -1)))) bs = addDays(bs, -1);
    while (off(iso(addDays(be, 1)))) be = addDays(be, 1);
    let best: LongWeekend | null = null;
    for (const side of [-1, 1] as const) {
      for (const k of [1, 2]) {
        const leave: Date[] = [];
        let cur = side === 1 ? be : bs;
        while (leave.length < k) {
          cur = addDays(cur, side);
          if (off(iso(cur))) break;
          leave.push(cur);
        }
        if (leave.length !== k) continue;
        let edge = cur;
        while (off(iso(addDays(edge, side)))) edge = addDays(edge, side);
        const offFrom = side === 1 ? bs : edge;
        const offTo = side === 1 ? edge : be;
        const total = differenceInCalendarDays(offTo, offFrom) + 1;
        const sorted = leave.map(iso).sort();
        if (sorted[0] < earliest) continue;
        const cand: LongWeekend = {
          holiday: h.name,
          holidayDate: h.date,
          from: sorted[0],
          to: sorted[sorted.length - 1],
          leaveDays: k,
          offFrom: iso(offFrom),
          offTo: iso(offTo),
          totalDays: total,
        };
        if (!best || total / k > best.totalDays / best.leaveDays) best = cand;
      }
    }
    if (best) out.push(best);
  }
  return out
    .sort((a, b) => b.totalDays / b.leaveDays - a.totalDays / a.leaveDays || a.holidayDate.localeCompare(b.holidayDate))
    .slice(0, limit)
    .sort((a, b) => a.holidayDate.localeCompare(b.holidayDate));
}

/* ------------------------------------------------------- balance expiry */

export interface ExpiryNudge {
  typeCode: "EL" | "CL";
  days: number;
  text: string;
}

/** Days that will lapse on 31 March if not used: CL (no carry-forward) and EL above the 30-day cap. */
export function expiryNudges(code: string): ExpiryNudge[] {
  const out: ExpiryNudge[] = [];
  const monthsLeft = 6; // Oct → Mar month-end accruals still to come after DEMO_TODAY's September
  const el = balancesFor(code).find((b) => b.typeCode === "EL");
  const elCap = LEAVE_TYPE_BY_CODE.EL?.maxCarryForward ?? 30;
  if (el) {
    const projected = Math.round((el.available - el.pending + 1.75 * (monthsLeft + 1)) * 100) / 100;
    const lapse = Math.round((projected - elCap) * 100) / 100;
    if (lapse > 0)
      out.push({
        typeCode: "EL",
        days: lapse,
        text: `At the current pace you will hold about ${projected} days of Earned Leave on 31 Mar — ${lapse} above the ${elCap}-day carry-forward cap will lapse.`,
      });
  }
  const cl = balanceFor(code, "CL");
  if (cl && cl.available - cl.pending > 0) {
    const d = Math.round((cl.available - cl.pending) * 100) / 100;
    out.push({
      typeCode: "CL",
      days: d,
      text: `${d} day${d === 1 ? "" : "s"} of Casual Leave lapse on 31 Mar — Casual Leave does not carry forward.`,
    });
  }
  return out;
}

/* ------------------------------------------------------ approval risk */

export interface LeaveRisk {
  level: "low" | "review";
  label: string;
  drivers: ExplainDriver[];
}

const quarterOf = (s: string) => `${s.slice(0, 4)}-Q${Math.floor((Number(s.slice(5, 7)) - 1) / 3) + 1}`;
const touchesWeekend = (a: LeaveApplication) => {
  const f = getDay(parseISO(a.fromDate));
  const t = getDay(parseISO(a.toDate));
  return f === 1 || t === 5;
};

/** Explainable recommendation for one request. Low risk only when every check passes. */
export function leaveRisk(a: LeaveApplication): LeaveRisk {
  const flags: { label: string; detail: string; weight: number }[] = [];
  const passes: ExplainDriver[] = [];
  const bal = balanceFor(a.employeeCode, a.typeCode);
  const type = LEAVE_TYPE_BY_CODE[a.typeCode];

  if (type?.tracksBalance && bal && bal.available < a.days) {
    flags.push({ label: `Exceeds balance by ${Math.round((a.days - bal.available) * 100) / 100} day(s)`, detail: `${bal.available} ${a.typeCode} available, ${a.days} requested — the excess becomes loss of pay.`, weight: 30 });
  } else {
    passes.push({ label: "Within balance", detail: bal ? `${bal.available} ${a.typeCode} available, ${a.days} requested.` : "Unpaid type — no balance to check.", weight: 4 });
  }

  const clash = teamClash(a.employeeCode, a.fromDate, a.toDate, a.id);
  if (clash.peakNames.length >= 2 && clash.peakDate) {
    flags.push({ label: `${clash.peakNames.length} teammates off`, detail: `${clash.peakNames.length} of ${clash.teamSize} teammates are off on ${short(clash.peakDate)}: ${clash.peakNames.join(", ")}.`, weight: 20 + clash.peakNames.length * 3 });
  } else {
    passes.push({ label: clash.peakNames.length === 1 ? "One teammate off — no clash" : "No team clash", detail: clash.peakNames.length === 1 ? `${clash.peakNames[0]} is also off on ${short(clash.peakDate!)}.` : `None of ${clash.teamSize} teammates is off in this range.`, weight: 3 });
  }

  if (touchesWeekend(a)) {
    const q = quarterOf(a.fromDate);
    const n = LEAVE_APPLICATIONS.filter(
      (x) => x.employeeCode === a.employeeCode && x.id !== a.id && blocking(x) && quarterOf(x.fromDate) === q && touchesWeekend(x),
    ).length + 1;
    if (n >= 3) {
      const ord = n === 3 ? "3rd" : `${n}th`;
      flags.push({ label: `${ord} Monday/Friday leave this quarter`, detail: `${n} requests in ${q.replace("-", " ")} start on a Monday or end on a Friday. A pattern worth a conversation — not evidence of misuse.`, weight: 14 + n });
    }
  }

  if (a.isBackdated) {
    flags.push({ label: "Backdated request", detail: "The dates are in the past; the attendance period may already be finalised.", weight: 12 });
  }

  const notice = differenceInCalendarDays(parseISO(a.fromDate), parseISO(a.appliedOn));
  if (a.typeCode !== "SL" && a.typeCode !== "LOP" && notice >= 0 && notice < 3) {
    flags.push({ label: "Short notice", detail: `Applied ${notice} day(s) before the first day; policy asks for 3.`, weight: 8 });
  }

  if (a.typeCode === "SL" && a.days > 2 && !a.documentName) {
    flags.push({ label: "Medical certificate missing", detail: "Sick Leave beyond 2 days needs a certificate (§3.3).", weight: 16 });
  }

  flags.sort((x, y) => y.weight - x.weight);
  if (!flags.length) {
    return { level: "low", label: "Low risk — within balance, no clash", drivers: passes };
  }
  return { level: "review", label: `Review — ${flags[0].label}`, drivers: [...flags, ...passes] };
}
