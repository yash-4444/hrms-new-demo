import { addDays, addMonths, differenceInMonths, format, parseISO, startOfMonth } from "date-fns";
import { mulberry32, randInt } from "@/lib/utils";
import {
  EMPLOYEES,
  PEOPLE_STATS,
  employeeByCode,
  reporteesOf,
  type Employee,
} from "./employees";
import { ATTENDANCE_CODES, attendanceOn } from "./attendance";
import { LEAVE_APPLICATIONS, LEAVE_EMPLOYEE_CODES } from "./leave";
import { BRANCHES, DEMO_TODAY, DEPARTMENTS, GRADES, HOLIDAYS, deptName } from "./org";

/* ============================================================================
   Aggregates for the dashboard, /analytics and /reports.

   Everything here is DERIVED from the employee fixtures wherever possible, so
   the numbers on the analytics screens reconcile with the directory. Where a
   figure has no source (historical headcount before the current roster), it is
   back-computed from real joining dates rather than invented.
   ========================================================================== */

const TODAY = parseISO(DEMO_TODAY);

export type Period = "3m" | "6m" | "12m" | "24m";

export const PERIODS: { value: Period; label: string; months: number }[] = [
  { value: "3m", label: "Last 3 months", months: 3 },
  { value: "6m", label: "Last 6 months", months: 6 },
  { value: "12m", label: "Last 12 months", months: 12 },
  { value: "24m", label: "Last 24 months", months: 24 },
];

function monthsBack(n: number) {
  return Array.from({ length: n }, (_, i) => startOfMonth(addMonths(TODAY, -(n - 1 - i))));
}

/* ------------------------------------------------- headcount & attrition */

export interface HeadcountPoint {
  month: string;
  monthIso: string;
  /** Headcount on the first day of the month — the previous month's closing. */
  opening: number;
  /** Closing headcount: opening + joiners − leavers, always. */
  headcount: number;
  joiners: number;
  leavers: number;
  attritionPct: number;
}

/** Org slice a trend is computed for — the analytics branch/department filter. */
export type ScopeMatch = (x: { departmentId: string; branchId: string }) => boolean;

const EVERYONE: ScopeMatch = () => true;

export function scopeMatcher(branch: string, department: string): ScopeMatch {
  return (x) =>
    (branch === "all" || x.branchId === branch) &&
    (department === "all" || x.departmentId === department);
}

/** A past leaver. Leavers are not in the current roster by definition, so the
    last 24 months of exits are modelled here — each borrows the department and
    branch of a real roster member, so a filtered trend still reconciles. */
export interface PastLeaver {
  exitDate: string;
  departmentId: string;
  branchId: string;
  voluntary: boolean;
  regrettable: boolean;
}

const HISTORY_MONTHS = 24;

export const PAST_LEAVERS: PastLeaver[] = (() => {
  const seed = mulberry32(4242);
  const out: PastLeaver[] = [];
  monthsBack(HISTORY_MONTHS).forEach((d, i) => {
    /* A slightly leakier prior year, so the 12-month rate is improving. */
    const n = 2 + Math.floor(seed() * 4) + (i < 12 && seed() < 0.4 ? 1 : 0);
    const lastDay = addMonths(d, 1) > TODAY ? TODAY.getDate() : 28;
    for (let k = 0; k < n; k++) {
      const like = EMPLOYEES[randInt(seed, 0, EMPLOYEES.length - 1)];
      const voluntary = seed() < 0.72;
      out.push({
        exitDate: format(new Date(d.getFullYear(), d.getMonth(), randInt(seed, 1, lastDay)), "yyyy-MM-dd"),
        departmentId: like.departmentId,
        branchId: like.branchId,
        voluntary,
        regrettable: voluntary && seed() < 0.5,
      });
    }
  });
  return out;
})();

/** Roster members on the books on the day before `endIso`. */
function rosterOn(endIso: string, match: ScopeMatch) {
  return EMPLOYEES.filter(
    (e) => match(e) && e.joiningDate < endIso && !(e.exitDate && e.exitDate < endIso),
  ).length;
}

/** Past leavers who were still employed on the day before `endIso`. */
function leaversStillHere(endIso: string, match: ScopeMatch) {
  return PAST_LEAVERS.filter((l) => match(l) && l.exitDate >= endIso).length;
}

/**
 * Month-by-month movement. Closing headcount is the roster on the books at
 * month end (real joining and exit dates) plus the modelled leavers who had
 * not yet left, so for every month opening + joiners − leavers = closing.
 */
export function headcountTrend(months = 12, match: ScopeMatch = EVERYONE): HeadcountPoint[] {
  const pts = monthsBack(months);
  const dayAfterToday = format(addDays(TODAY, 1), "yyyy-MM-dd");
  const closingAt = (endIso: string) => rosterOn(endIso, match) + leaversStillHere(endIso, match);

  return pts.map((d) => {
    const startIso = format(d, "yyyy-MM-dd");
    const nextIso = format(addMonths(d, 1), "yyyy-MM-dd");
    /* The current month closes "as on today". */
    const endIso = nextIso < dayAfterToday ? nextIso : dayAfterToday;
    const opening = closingAt(startIso);
    const headcount = closingAt(endIso);
    const joiners = EMPLOYEES.filter(
      (e) => match(e) && e.joiningDate >= startIso && e.joiningDate < endIso,
    ).length;
    const leavers =
      EMPLOYEES.filter((e) => match(e) && e.exitDate && e.exitDate >= startIso && e.exitDate < endIso).length +
      PAST_LEAVERS.filter((l) => match(l) && l.exitDate >= startIso && l.exitDate < endIso).length;
    const avg = (opening + headcount) / 2 || 1;
    return {
      month: format(d, "MMM yy"),
      monthIso: format(d, "yyyy-MM"),
      opening,
      headcount,
      joiners,
      leavers,
      attritionPct: Number(((leavers / avg) * 12 * 100).toFixed(1)),
    };
  });
}

export const HEADCOUNT_12M = headcountTrend(12);
export const HEADCOUNT_24M = headcountTrend(HISTORY_MONTHS);

/** Rolling 12-month attrition for an org slice, against the 12 months before. */
export function attritionFor(match: ScopeMatch = EVERYONE) {
  const trend = headcountTrend(HISTORY_MONTHS, match);
  const rateOf = (pts: HeadcountPoint[]) => {
    const leavers = pts.reduce((a, b) => a + b.leavers, 0);
    const avgHead = pts.reduce((a, b) => a + b.headcount, 0) / Math.max(1, pts.length);
    return { leavers, rate: avgHead ? (leavers / avgHead) * 100 : 0 };
  };
  const cur = rateOf(trend.slice(-12));
  const prev = rateOf(trend.slice(0, 12));
  const windowStart = `${trend[trend.length - 12].monthIso}-01`;
  const exits = PAST_LEAVERS.filter((l) => match(l) && l.exitDate >= windowStart);
  const share = (n: number) => Number(((n / Math.max(1, exits.length)) * 100).toFixed(1));
  return {
    leavers12m: cur.leavers,
    rate: Number(cur.rate.toFixed(1)),
    prevRate: Number(prev.rate.toFixed(1)),
    delta: Number((cur.rate - prev.rate).toFixed(1)),
    voluntaryPct: share(exits.filter((l) => l.voluntary).length),
    regrettablePct: share(exits.filter((l) => l.regrettable).length),
  };
}

export const ATTRITION = attritionFor();

/** Attrition rate per month, for the trend chart. */
export const ATTRITION_TREND = HEADCOUNT_12M.map((p) => ({
  month: p.month,
  attrition: p.attritionPct,
  joiners: p.joiners,
  leavers: p.leavers,
}));

export const JOINERS_LEAVERS_12M = HEADCOUNT_12M.map((p) => ({
  month: p.month,
  joiners: p.joiners,
  leavers: p.leavers,
}));

/* --------------------------------------------------------- distributions */

export const DEPT_DISTRIBUTION = DEPARTMENTS.map((d) => ({
  name: d.name,
  id: d.id,
  value: EMPLOYEES.filter((e) => e.departmentId === d.id).length,
  costCentre: d.costCentre,
})).sort((a, b) => b.value - a.value);

export const BRANCH_DISTRIBUTION = BRANCHES.map((b) => ({
  name: b.city,
  id: b.id,
  value: EMPLOYEES.filter((e) => e.branchId === b.id).length,
})).sort((a, b) => b.value - a.value);

export const GENDER_DISTRIBUTION = [
  { name: "Female", value: PEOPLE_STATS.female },
  { name: "Male", value: PEOPLE_STATS.male },
  { name: "Not disclosed", value: PEOPLE_STATS.other },
];

/** Gender split per department — the diversity heatmap / stacked bar. */
export const GENDER_BY_DEPT = DEPARTMENTS.map((d) => {
  const inDept = EMPLOYEES.filter((e) => e.departmentId === d.id);
  const female = inDept.filter((e) => e.gender === "Female").length;
  return {
    dept: d.name,
    female,
    male: inDept.length - female,
    femalePct: Number(((female / Math.max(1, inDept.length)) * 100).toFixed(1)),
  };
}).sort((a, b) => b.femalePct - a.femalePct);

export const GRADE_DISTRIBUTION = GRADES.map((g) => ({
  name: g.label.split(" · ")[0],
  fullName: g.label,
  value: EMPLOYEES.filter((e) => e.gradeId === g.id).length,
}));

export const TENURE_BANDS = (() => {
  const bands = [
    { name: "< 1 yr", min: 0, max: 12 },
    { name: "1–2 yrs", min: 12, max: 24 },
    { name: "2–4 yrs", min: 24, max: 48 },
    { name: "4–6 yrs", min: 48, max: 72 },
    { name: "6+ yrs", min: 72, max: 1e6 },
  ];
  return bands.map((b) => ({
    name: b.name,
    value: EMPLOYEES.filter((e) => {
      const m = differenceInMonths(TODAY, parseISO(e.joiningDate));
      return m >= b.min && m < b.max;
    }).length,
  }));
})();

/* ------------------------------------------------------- span of control */

export const SPAN_OF_CONTROL = (() => {
  const managers = EMPLOYEES.filter((e) => reporteesOf(e.code).length > 0).map((m) => ({
    code: m.code,
    name: m.name,
    department: deptName(m.departmentId),
    span: reporteesOf(m.code).length,
    level: m.level,
  }));
  const bands = [
    { name: "1–2", min: 1, max: 2 },
    { name: "3–5", min: 3, max: 5 },
    { name: "6–8", min: 6, max: 8 },
    { name: "9–12", min: 9, max: 12 },
    { name: "13+", min: 13, max: 1e6 },
  ];
  return {
    managers: managers.sort((a, b) => b.span - a.span),
    average: Number(
      (managers.reduce((a, b) => a + b.span, 0) / Math.max(1, managers.length)).toFixed(1),
    ),
    bands: bands.map((b) => ({
      name: b.name,
      value: managers.filter((m) => m.span >= b.min && m.span <= b.max).length,
    })),
    byDepartment: DEPARTMENTS.map((d) => {
      const ms = managers.filter((m) => m.department === d.name);
      return {
        dept: d.name,
        span: Number(
          (ms.reduce((a, b) => a + b.span, 0) / Math.max(1, ms.length)).toFixed(1),
        ),
      };
    }).sort((a, b) => b.span - a.span),
  };
})();

/* ----------------------------------------------------- payroll cost view */

/** One payroll cost trend for the whole app — the pay-run-derived series, so
    the last two points ARE the August and September run totals. */
export { PAYROLL_COST_TREND } from "./payroll";

export const COST_BY_CENTRE = DEPARTMENTS.map((d) => {
  const inDept = EMPLOYEES.filter((e) => e.departmentId === d.id);
  const annual = inDept.reduce((a, e) => a + e.ctc, 0);
  return {
    name: d.costCentre,
    department: d.name,
    value: Math.round(annual / 12),
    annual,
    headcount: inDept.length,
    perHead: Math.round(annual / Math.max(1, inDept.length)),
  };
}).sort((a, b) => b.value - a.value);

export const COST_BY_BRANCH = BRANCHES.map((b) => {
  const inBranch = EMPLOYEES.filter((e) => e.branchId === b.id);
  return {
    name: b.city,
    value: Math.round(inBranch.reduce((a, e) => a + e.ctc, 0) / 12),
    headcount: inBranch.length,
  };
}).sort((a, b) => b.value - a.value);

/* -------------------------------------------------- recruitment funnel */

/** Funnel and source mix come from the candidate fixtures, so /analytics and
    the hiring screens count the same people. */
export { RECRUITMENT_FUNNEL, SOURCE_MIX } from "./hiring";

export const TIME_TO_FILL = DEPARTMENTS.slice(0, 6).map((d, i) => ({
  dept: d.name,
  days: [52, 44, 61, 38, 47, 35][i],
}));

/* ----------------------------------------------- attendance / leave roll-up */

export const ATTENDANCE_SUMMARY_30D = (() => {
  const pts = Array.from({ length: 30 }, (_, i) => addMonths(TODAY, 0) && i);
  const seed = mulberry32(9090);
  return pts.map((i) => {
    const d = new Date(TODAY);
    d.setDate(d.getDate() - (29 - i));
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const base = weekend ? 12 : 300 + randInt(seed, -14, 14);
    return {
      date: format(d, "dd MMM"),
      present: base,
      onLeave: weekend ? 0 : randInt(seed, 9, 28),
      absent: weekend ? 0 : randInt(seed, 2, 9),
    };
  });
})();

export const LEAVE_UTILISATION = [
  { name: "Earned Leave", value: 1842 },
  { name: "Casual Leave", value: 968 },
  { name: "Sick Leave", value: 731 },
  { name: "Comp Off", value: 214 },
  { name: "Loss of Pay", value: 96 },
];

/* ------------------------------ dashboard-only figures (self-contained) */

export interface Announcement {
  id: string;
  title: string;
  body: string;
  author: string;
  date: string;
  pinned: boolean;
}

export const DASH_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "a1",
    title: "Deepavali holiday calendar published",
    body: "08 and 09 November are company holidays across both Indian branches. The Newark office follows the US calendar. Acknowledge by 25 September.",
    author: "Priya Menon",
    date: "2026-09-14",
    pinned: true,
  },
  {
    id: "a2",
    title: "Health insurance renewal — add dependants by 30 Sep",
    body: "The group mediclaim policy renews on 01 October. Additions or removals of dependants must be submitted through the People desk before month end.",
    author: "Priya Menon",
    date: "2026-09-11",
    pinned: true,
  },
  {
    id: "a3",
    title: "Q3 all-hands moved to 24 September, 4:00 pm IST",
    body: "The quarterly business review shifts by one day to accommodate the board meeting. Newark colleagues, this is 6:30 am ET — a recording will follow.",
    author: "Arjun Kapoor",
    date: "2026-09-09",
    pinned: false,
  },
  {
    id: "a4",
    title: "New expense policy limits effective 01 October",
    body: "Domestic hotel cap rises to ₹6,500 per night for Bengaluru, Mumbai and Delhi NCR. Per-diem for international travel is now billed at actuals with receipts.",
    author: "Rahul Desai",
    date: "2026-09-05",
    pinned: false,
  },
];

export const UPCOMING_HOLIDAYS = HOLIDAYS.filter(
  (h) => h.country === "IN" && h.date >= DEMO_TODAY,
).slice(0, 5);

export interface TeamMemberOnLeave {
  code: string;
  name: string;
  designation: string;
  type: string;
  until: string;
}

/**
 * Who in `codes` is on leave on DEMO_TODAY — approved applications from the
 * leave ledger first, then any day the attendance fixtures mark as leave, so
 * the dashboard agrees with both /leave/calendar and /attendance/team.
 */
export function teamOnLeaveToday(codes: readonly string[]): TeamMemberOnLeave[] {
  const set = new Set(codes);
  const out: TeamMemberOnLeave[] = [];
  for (const a of LEAVE_APPLICATIONS) {
    if (!set.has(a.employeeCode) || a.status !== "approved") continue;
    if (a.fromDate > DEMO_TODAY || a.toDate < DEMO_TODAY) continue;
    if (out.some((m) => m.code === a.employeeCode)) continue;
    out.push({
      code: a.employeeCode,
      name: a.employeeName,
      designation: employeeByCode(a.employeeCode)?.designation ?? "",
      type: a.typeName,
      until: a.toDate,
    });
  }
  /* Attendance-marked leave (comp off, short leave) with no application in the ledger window. */
  const tracked = new Set(ATTENDANCE_CODES);
  for (const code of codes) {
    if (!tracked.has(code) || out.some((m) => m.code === code)) continue;
    const rec = attendanceOn(code, DEMO_TODAY);
    if (rec?.state !== "leave") continue;
    const e = employeeByCode(code);
    out.push({
      code,
      name: e?.name ?? code,
      designation: e?.designation ?? "",
      type: rec.leaveType ?? "Leave",
      until: DEMO_TODAY,
    });
  }
  return out.sort((a, b) => a.until.localeCompare(b.until) || a.name.localeCompare(b.name));
}

/** Org-wide view of who is on leave today (HR / owner scope). */
export const TEAM_ON_LEAVE_TODAY: TeamMemberOnLeave[] = teamOnLeaveToday(LEAVE_EMPLOYEE_CODES);

export interface ApprovalItem {
  id: string;
  kind: "Leave" | "Expense" | "Regularisation" | "Travel" | "Requisition" | "Offer";
  requester: string;
  requesterCode: string;
  summary: string;
  raised: string;
  ageDays: number;
  href: string;
  amount?: number;
}

export const PENDING_APPROVALS: ApprovalItem[] = [
  { id: "ap1", kind: "Leave", requester: "Kavya Iyer", requesterCode: "STL-0144", summary: "Earned Leave · 12–14 Oct · 3 days", raised: "2026-09-16", ageDays: 0, href: "/leave/approvals" },
  { id: "ap2", kind: "Regularisation", requester: "Imran Chauhan", requesterCode: "STL-0147", summary: "Missed punch-out · 11 Sep", raised: "2026-09-15", ageDays: 1, href: "/attendance/amendments" },
  { id: "ap3", kind: "Expense", requester: "Karthik Reddy", requesterCode: "STL-0143", summary: "Client visit — Mumbai · 3 lines", raised: "2026-09-14", ageDays: 2, href: "/expenses", amount: 18450 },
  { id: "ap4", kind: "Leave", requester: "Shreya Bhat", requesterCode: "STL-0146", summary: "Sick Leave · 17 Sep · 1 day", raised: "2026-09-14", ageDays: 2, href: "/leave/approvals" },
  { id: "ap5", kind: "Travel", requester: "Daniel Whitaker", requesterCode: "STL-0149", summary: "Newark → Bengaluru · 28 Sep–06 Oct", raised: "2026-09-12", ageDays: 4, href: "/travel", amount: 214000 },
  { id: "ap6", kind: "Expense", requester: "Nandini Hegde", requesterCode: "STL-0148", summary: "Internet reimbursement · Aug", raised: "2026-09-11", ageDays: 5, href: "/expenses", amount: 1800 },
  { id: "ap7", kind: "Requisition", requester: "Pranav Joshi", requesterCode: "STL-0145", summary: "REQ-2026-011 · Senior SRE · Pune", raised: "2026-09-08", ageDays: 8, href: "/requisitions" },
];

export const COMPLIANCE_ALERTS = [
  { id: "c1", title: "PF ECR filing", due: "2026-09-20", owner: "Rahul Desai", status: "due_soon" as const, country: "India" },
  { id: "c2", title: "ESI contribution", due: "2026-09-21", owner: "Rahul Desai", status: "due_soon" as const, country: "India" },
  { id: "c3", title: "Professional Tax — Karnataka", due: "2026-09-20", owner: "Lakshmi Pillai", status: "due_soon" as const, country: "India" },
  { id: "c4", title: "TDS 24Q — Q2 return", due: "2026-10-31", owner: "Rahul Desai", status: "not_started" as const, country: "India" },
  { id: "c5", title: "POSH annual report", due: "2026-09-10", owner: "Priya Menon", status: "overdue" as const, country: "India" },
];

export interface TeamAttendanceCount {
  present: number;
  late: number;
  onLeave: number;
  absent: number;
  total: number;
}

/**
 * Today's attendance split for a set of employees, from the attendance
 * fixtures. "Present" excludes late arrivals (they are counted in `late`);
 * an approved leave covering today counts as on leave even without a record.
 * Weekend / holiday / not-yet-marked members are in `total` only.
 */
export function teamAttendanceToday(codes: readonly string[]): TeamAttendanceCount {
  const tracked = new Set(ATTENDANCE_CODES);
  const onLeave = new Set(teamOnLeaveToday(codes).map((m) => m.code));
  const t: TeamAttendanceCount = { present: 0, late: 0, onLeave: 0, absent: 0, total: codes.length };
  for (const code of codes) {
    const rec = tracked.has(code) ? attendanceOn(code, DEMO_TODAY) : undefined;
    if (onLeave.has(code) || rec?.state === "leave") t.onLeave += 1;
    else if (!rec) continue;
    else if (rec.state === "absent") t.absent += 1;
    else if (rec.state === "present" || rec.state === "overtime" || rec.state === "half_day") {
      if (rec.late) t.late += 1;
      else t.present += 1;
    }
  }
  return t;
}

/** Vikram Shah's team — the manager persona's default board. */
export const TEAM_ATTENDANCE_TODAY: TeamAttendanceCount = teamAttendanceToday(
  reporteesOf("STL-0031").map((e) => e.code),
);

/** Joiners and leavers in the current calendar month. */
export const THIS_MONTH = (() => {
  const monthStart = startOfMonth(TODAY);
  const joiners = EMPLOYEES.filter(
    (e) => parseISO(e.joiningDate) >= monthStart && parseISO(e.joiningDate) <= TODAY,
  );
  const leavers = EMPLOYEES.filter(
    (e) => e.exitDate && parseISO(e.exitDate) >= monthStart && parseISO(e.exitDate) <= addMonths(monthStart, 1),
  );
  return { joiners, leavers };
})();

/* ------------------------------------------------------------- reports */

export interface ReportDef {
  id: string;
  name: string;
  module: string;
  description: string;
  format: ("CSV" | "XLSX" | "PDF")[];
  lastRun: string | null;
  owner: string;
  scheduled: string | null;
  rows: number;
  favourite: boolean;
  statutory?: boolean;
}

export const REPORTS: ReportDef[] = [
  { id: "r-hc-01", name: "Headcount & Movement", module: "People", description: "Opening headcount, joiners, leavers, closing headcount by department and branch for a chosen period.", format: ["CSV", "XLSX"], lastRun: "2026-09-15", owner: "Priya Menon", scheduled: "1st of every month", rows: 340, favourite: true },
  { id: "r-hc-02", name: "Employee Master", module: "People", description: "Full directory export with job, org, contact and statutory identifiers. Compensation columns respect the viewer's grants.", format: ["CSV", "XLSX"], lastRun: "2026-09-12", owner: "Priya Menon", scheduled: null, rows: 340, favourite: false },
  { id: "r-hc-03", name: "Attrition Analysis", module: "People", description: "Voluntary vs involuntary exits, regrettable flag, tenure at exit, exit reasons, rolling 12-month rate.", format: ["XLSX", "PDF"], lastRun: "2026-09-01", owner: "Priya Menon", scheduled: "Quarterly", rows: 61, favourite: true },
  { id: "r-hc-04", name: "Diversity & Inclusion", module: "People", description: "Gender split by department, grade and management level, with year-on-year movement.", format: ["XLSX", "PDF"], lastRun: "2026-07-04", owner: "Priya Menon", scheduled: null, rows: 9, favourite: false },
  { id: "r-at-01", name: "Monthly Attendance Register", module: "Time", description: "Per-employee day-by-day attendance with present, half-day, absent, leave and holiday counts.", format: ["CSV", "XLSX", "PDF"], lastRun: "2026-09-01", owner: "Priya Menon", scheduled: "1st of every month", rows: 340, favourite: true },
  { id: "r-at-02", name: "Late Arrivals & Overtime", module: "Time", description: "Employees past the late threshold and overtime minutes above the daily band, by branch.", format: ["CSV", "XLSX"], lastRun: "2026-09-14", owner: "Vikram Shah", scheduled: "Every Monday", rows: 88, favourite: false },
  { id: "r-lv-01", name: "Leave Balance & Liability", module: "Time", description: "Closing balance per leave type with the encashment liability valued at current basic pay.", format: ["XLSX"], lastRun: "2026-09-10", owner: "Lakshmi Pillai", scheduled: "Quarterly", rows: 340, favourite: true },
  { id: "r-lv-02", name: "Leave Ledger", module: "Time", description: "Every accrual, application, adjustment, encashment and lapse with a running balance.", format: ["CSV", "XLSX"], lastRun: "2026-09-10", owner: "Priya Menon", scheduled: null, rows: 4128, favourite: false },
  { id: "r-py-01", name: "Payroll Register", module: "Payroll", description: "Component-wise gross, deductions and net for every employee in a pay run.", format: ["XLSX", "PDF"], lastRun: "2026-08-31", owner: "Rahul Desai", scheduled: "Monthly on lock", rows: 340, favourite: true, statutory: true },
  { id: "r-py-02", name: "Bank Transfer Advice", module: "Payroll", description: "Net pay by beneficiary in the bank's upload format. Excludes employees with incomplete bank details.", format: ["CSV"], lastRun: "2026-08-31", owner: "Rahul Desai", scheduled: "Monthly on approval", rows: 337, favourite: false, statutory: true },
  { id: "r-py-03", name: "PF ECR", module: "Payroll", description: "Electronic Challan-cum-Return in the EPFO upload layout, with UAN, wages and contributions.", format: ["CSV"], lastRun: "2026-08-20", owner: "Rahul Desai", scheduled: "Monthly by the 15th", rows: 306, favourite: true, statutory: true },
  { id: "r-py-04", name: "ESI Contribution Statement", module: "Payroll", description: "Insurable wages and employee/employer contribution for members below the wage ceiling.", format: ["CSV", "XLSX"], lastRun: "2026-08-20", owner: "Rahul Desai", scheduled: "Monthly by the 15th", rows: 41, favourite: false, statutory: true },
  { id: "r-py-05", name: "TDS 24Q Annexure", module: "Payroll", description: "Quarterly salary TDS return annexure with PAN-wise deduction and challan mapping.", format: ["CSV"], lastRun: "2026-07-31", owner: "Rahul Desai", scheduled: "Quarterly", rows: 340, favourite: false, statutory: true },
  { id: "r-py-06", name: "Cost to Company by Cost Centre", module: "Payroll", description: "Monthly and annualised cost by cost centre with headcount and cost per head.", format: ["XLSX", "PDF"], lastRun: "2026-09-02", owner: "Lakshmi Pillai", scheduled: "Monthly", rows: 9, favourite: true },
  { id: "r-hi-01", name: "Recruitment Funnel", module: "Hiring", description: "Stage-wise conversion, time in stage and source effectiveness for the selected period.", format: ["XLSX", "PDF"], lastRun: "2026-09-13", owner: "Sana Iqbal", scheduled: "Every Monday", rows: 5, favourite: false },
  { id: "r-hi-02", name: "Open Requisition Ageing", module: "Hiring", description: "Days open, candidates in play and the oldest stage for every unfilled requisition.", format: ["CSV", "XLSX"], lastRun: "2026-09-16", owner: "Sana Iqbal", scheduled: null, rows: 12, favourite: false },
  { id: "r-gr-01", name: "Review Cycle Completion", module: "Growth", description: "Self, manager and peer completion by department, with overdue reviewers named.", format: ["XLSX"], lastRun: "2026-09-08", owner: "Priya Menon", scheduled: "Weekly during a cycle", rows: 340, favourite: false },
  { id: "r-gr-02", name: "Compliance Training Status", module: "Growth", description: "POSH, InfoSec, Code of Conduct and Data Privacy completion with expiry dates.", format: ["CSV", "XLSX", "PDF"], lastRun: "2026-09-06", owner: "Priya Menon", scheduled: "Monthly", rows: 340, favourite: true, statutory: true },
  { id: "r-wp-01", name: "Asset Allocation Register", module: "Workplace", description: "Every asset with its holder, allocation date, condition and warranty expiry.", format: ["CSV", "XLSX"], lastRun: "2026-09-04", owner: "Girish Gowda", scheduled: null, rows: 180, favourite: false },
  { id: "r-wp-02", name: "Expense Claim Summary", module: "Workplace", description: "Claims by category and cost centre with policy breaches flagged.", format: ["XLSX", "PDF"], lastRun: "2026-09-15", owner: "Rahul Desai", scheduled: "Monthly", rows: 50, favourite: false },
  { id: "r-wp-03", name: "Helpdesk SLA Performance", module: "Workplace", description: "First-response and resolution SLA attainment by category and assignee.", format: ["XLSX"], lastRun: "2026-09-16", owner: "Girish Gowda", scheduled: "Weekly", rows: 40, favourite: false },
  { id: "r-ad-01", name: "Audit Trail Export", module: "Admin", description: "Actor, action, entity, timestamp, IP and the old/new value pair for every change.", format: ["CSV"], lastRun: "2026-09-16", owner: "Arjun Kapoor", scheduled: null, rows: 220, favourite: false, statutory: true },
  { id: "r-ad-02", name: "User Access Review", module: "Admin", description: "Every user, their roles, last login and MFA state — the quarterly access certification pack.", format: ["XLSX", "PDF"], lastRun: "2026-07-01", owner: "Arjun Kapoor", scheduled: "Quarterly", rows: 64, favourite: true, statutory: true },
  { id: "r-ad-03", name: "Statutory Filing Calendar", module: "Admin", description: "Due dates, owners and filing status for every Indian and US obligation in the year.", format: ["XLSX", "PDF"], lastRun: "2026-09-01", owner: "Rahul Desai", scheduled: "Monthly", rows: 30, favourite: false, statutory: true },
];

export const REPORT_MODULES = [...new Set(REPORTS.map((r) => r.module))];

/** Report runs over the last 8 weeks, for the Reports page activity chart. */
export const REPORT_RUN_ACTIVITY = (() => {
  const seed = mulberry32(2211);
  return Array.from({ length: 8 }, (_, i) => {
    const d = new Date(TODAY);
    d.setDate(d.getDate() - (7 - i) * 7);
    return {
      week: format(d, "dd MMM"),
      scheduled: randInt(seed, 14, 26),
      manual: randInt(seed, 5, 19),
    };
  });
})();

/* --------------------------------------------------------------- helpers */

export function employeesMatching(filter: {
  department?: string;
  branch?: string;
  status?: string;
  gender?: string;
}): Employee[] {
  return EMPLOYEES.filter(
    (e) =>
      (!filter.department || e.departmentId === filter.department) &&
      (!filter.branch || e.branchId === filter.branch) &&
      (!filter.status || e.status === filter.status) &&
      (!filter.gender || e.gender === filter.gender),
  );
}

export function trimTo<T>(arr: T[], period: Period) {
  const months = PERIODS.find((p) => p.value === period)?.months ?? 12;
  return arr.slice(-months);
}
