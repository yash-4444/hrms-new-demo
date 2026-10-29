/* ============================================================================
   Scheduled reports — what runs, when, for whom, and how the last run went.
   Schedules are stored as a friendly spec and rendered as a cron expression.
   ========================================================================== */

export type ReportFrequency = "daily" | "weekly" | "monthly";
export type ReportFormat = "XLSX" | "PDF" | "CSV";

export interface ReportSchedule {
  frequency: ReportFrequency;
  /** 0 = Sunday … 6 = Saturday; used when weekly. */
  weekday: number;
  /** 1–28, or 0 for the last working day; used when monthly. */
  dayOfMonth: number;
  time: string;
}

export interface ScheduledReport {
  id: string;
  report: string;
  module: string;
  schedule: ReportSchedule;
  nextRunAt: string;
  recipients: string[];
  format: ReportFormat;
  lastStatus: "completed" | "failed" | "scheduled";
  lastRunAt: string | null;
  paused: boolean;
  owner: string;
}

export const REPORT_CATALOGUE: { id: string; label: string; module: string }[] = [
  { id: "headcount", label: "Headcount & movement", module: "People" },
  { id: "attrition", label: "Attrition by department", module: "People" },
  { id: "attendance-muster", label: "Attendance muster", module: "Time" },
  { id: "leave-balance", label: "Leave balance & liability", module: "Time" },
  { id: "payroll-register", label: "Payroll register", module: "Payroll" },
  { id: "statutory-summary", label: "PF / ESI / PT summary", module: "Payroll" },
  { id: "expense-ageing", label: "Expense claims ageing", module: "Finance" },
  { id: "hiring-funnel", label: "Hiring funnel", module: "Recruitment" },
  { id: "helpdesk-sla", label: "Helpdesk SLA", module: "Helpdesk" },
];

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function cronOf(s: ReportSchedule) {
  const [h, m] = s.time.split(":").map(Number);
  if (s.frequency === "daily") return `${m} ${h} * * 1-5`;
  if (s.frequency === "weekly") return `${m} ${h} * * ${s.weekday}`;
  return `${m} ${h} ${s.dayOfMonth === 0 ? "L" : s.dayOfMonth} * *`;
}

export function describeSchedule(s: ReportSchedule) {
  if (s.frequency === "daily") return `Every working day at ${s.time} IST`;
  if (s.frequency === "weekly") return `Every ${WEEKDAYS[s.weekday]} at ${s.time} IST`;
  return s.dayOfMonth === 0
    ? `Last working day of the month at ${s.time} IST`
    : `Day ${s.dayOfMonth} of every month at ${s.time} IST`;
}

/** Next run strictly after DEMO_NOW (2026-09-16 14:35, a Wednesday). */
export function nextRunOf(s: ReportSchedule): string {
  const today = "2026-09-16";
  const nowTime = "14:35";
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const d = new Date(`${today}T00:00:00Z`);
  if (s.frequency === "daily") {
    if (s.time <= nowTime) d.setUTCDate(d.getUTCDate() + 1);
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
    return `${iso(d)}T${s.time}:00`;
  }
  if (s.frequency === "weekly") {
    let add = (s.weekday - d.getUTCDay() + 7) % 7;
    if (add === 0 && s.time <= nowTime) add = 7;
    d.setUTCDate(d.getUTCDate() + add);
    return `${iso(d)}T${s.time}:00`;
  }
  if (s.dayOfMonth === 0) return `2026-09-30T${s.time}:00`;
  const thisMonth = `2026-09-${String(s.dayOfMonth).padStart(2, "0")}`;
  if (thisMonth > today || (thisMonth === today && s.time > nowTime)) return `${thisMonth}T${s.time}:00`;
  return `2026-10-${String(s.dayOfMonth).padStart(2, "0")}T${s.time}:00`;
}

const mk = (
  id: string,
  report: string,
  module: string,
  schedule: ReportSchedule,
  recipients: string[],
  format: ReportFormat,
  lastStatus: ScheduledReport["lastStatus"],
  lastRunAt: string | null,
  owner: string,
  paused = false,
): ScheduledReport => ({ id, report, module, schedule, nextRunAt: nextRunOf(schedule), recipients, format, lastStatus, lastRunAt, paused, owner });

export const SCHEDULED_REPORTS: ScheduledReport[] = [
  mk("SR-01", "Headcount & movement", "People", { frequency: "monthly", weekday: 1, dayOfMonth: 1, time: "08:00" }, ["arjun.kapoor@stellartech.in", "leadership@stellartech.in"], "PDF", "completed", "2026-09-01T08:00:00", "Priya Menon"),
  mk("SR-02", "Attendance muster", "Time", { frequency: "daily", weekday: 1, dayOfMonth: 1, time: "09:30" }, ["branch-admins@stellartech.in"], "XLSX", "completed", "2026-09-16T09:30:00", "Priya Menon"),
  mk("SR-03", "Payroll register", "Payroll", { frequency: "monthly", weekday: 1, dayOfMonth: 0, time: "19:00" }, ["lakshmi.pillai@stellartech.in", "rahul.desai@stellartech.in"], "XLSX", "completed", "2026-08-31T19:00:00", "Rahul Desai"),
  mk("SR-04", "PF / ESI / PT summary", "Payroll", { frequency: "monthly", weekday: 1, dayOfMonth: 14, time: "10:00" }, ["rahul.desai@stellartech.in", "compliance@stellartech.in"], "PDF", "failed", "2026-09-14T10:00:00", "Rahul Desai"),
  mk("SR-05", "Expense claims ageing", "Finance", { frequency: "weekly", weekday: 1, dayOfMonth: 1, time: "09:00" }, ["finance-ops@stellartech.in"], "XLSX", "completed", "2026-09-14T09:00:00", "Lakshmi Pillai"),
  mk("SR-06", "Attrition by department", "People", { frequency: "monthly", weekday: 1, dayOfMonth: 5, time: "08:30" }, ["neha.malhotra@stellartech.in", "priya.menon@stellartech.in"], "PDF", "completed", "2026-09-05T08:30:00", "Neha Malhotra"),
  mk("SR-07", "Hiring funnel", "Recruitment", { frequency: "weekly", weekday: 5, dayOfMonth: 1, time: "17:00" }, ["sana.iqbal@stellartech.in", "hiring-managers@stellartech.in"], "PDF", "completed", "2026-09-11T17:00:00", "Sana Iqbal", true),
  mk("SR-08", "Leave balance & liability", "Time", { frequency: "monthly", weekday: 1, dayOfMonth: 0, time: "18:00" }, ["lakshmi.pillai@stellartech.in"], "XLSX", "completed", "2026-08-31T18:00:00", "Lakshmi Pillai"),
];
