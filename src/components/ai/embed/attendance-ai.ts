/* ============================================================================
   Attendance AI signals — deterministic pattern checks over the punch history,
   plus the model-detected anomalies from src/mock/ai.ts. Advisory only: a flag
   is a prompt to look, never a finding.
   ========================================================================== */

import { addDays, format, parseISO } from "date-fns";
import { DEMO_TODAY } from "@/mock/org";
import { employeeByCode } from "@/mock/employees";
import { attendanceFor, type AttendanceDay } from "@/mock/attendance";
import { ANOMALIES, type AnomalySeverity } from "@/mock/ai";
import type { ExplainDriver } from "@/components/ai/ai-ui";

const WINDOW_START = format(addDays(parseISO(DEMO_TODAY), -30), "yyyy-MM-dd");
const worked = (d: AttendanceDay) => d.state === "present" || d.state === "overtime" || d.state === "half_day";
const workingDay = (d: AttendanceDay) => d.state !== "weekend" && d.state !== "holiday";

export interface AttendanceFlag {
  id: string;
  title: string;
  subject: string;
  subjectCode: string | null;
  severity: AnomalySeverity;
  evidence: string[];
  suggestedAction: string;
  confidence: number;
  href?: string;
  /** "model" = detected by the anomaly model; "pattern" = rule over the punch history. */
  source: "model" | "pattern";
  drivers: ExplainDriver[];
}

/** Model anomalies of the attendance kinds, mapped to the flag shape. */
export function modelAttendanceFlags(inScope: (code: string) => boolean): AttendanceFlag[] {
  return ANOMALIES.filter((a) => (a.kind === "Attendance" || a.kind === "Overtime") && a.subjectCode && inScope(a.subjectCode)).map(
    (a) => ({
      id: a.id,
      title: a.title,
      subject: a.subject,
      subjectCode: a.subjectCode,
      severity: a.severity,
      evidence: a.evidence,
      suggestedAction: a.suggestedAction,
      confidence: a.confidence,
      href: a.href,
      source: "model",
      drivers: a.evidence.map((e, i) => ({ label: e, weight: a.evidence.length - i })),
    }),
  );
}

interface Stats {
  last30: AttendanceDay[];
  weekDays: AttendanceDay[];
  late30: number;
  absent30: number;
  ot30: number;
  gps30: number;
  lateWeek: number;
  otWeek: number;
}

function stats(code: string): Stats {
  const all = attendanceFor(code);
  const last30 = all.filter((d) => d.date > WINDOW_START && d.date <= DEMO_TODAY);
  const weekDays = all.filter((d) => d.date <= DEMO_TODAY && workingDay(d)).slice(-5);
  return {
    last30,
    weekDays,
    late30: last30.filter((d) => d.late).length,
    absent30: last30.filter((d) => d.state === "absent").length,
    ot30: last30.filter((d) => d.state === "overtime").length,
    gps30: last30.filter((d) => d.punches.some((p) => p.source === "Mobile GPS")).length,
    lateWeek: weekDays.filter((d) => d.late).length,
    otWeek: weekDays.filter((d) => d.state === "overtime").length,
  };
}

const dd = (s: string) => format(parseISO(s), "dd MMM");

/** Rule-based flags from one person's last 30 days. */
export function patternFlags(code: string): AttendanceFlag[] {
  const s = stats(code);
  const name = employeeByCode(code)?.name ?? code;
  const out: AttendanceFlag[] = [];
  if (s.absent30 >= 2) {
    const days = s.last30.filter((d) => d.state === "absent").map((d) => dd(d.date));
    out.push({
      id: `pat-abs-${code}`,
      title: `${s.absent30} unaccounted absences in 30 days`,
      subject: name,
      subjectCode: code,
      severity: s.absent30 >= 4 ? "High" : "Medium",
      evidence: [`No punch and no approved leave on ${days.join(", ")}`, "These will be treated as loss of pay at month-end finalisation"],
      suggestedAction: "Raise a regularisation or apply for leave before the month is finalised.",
      confidence: 95,
      href: "/attendance/amendments",
      source: "pattern",
      drivers: [{ label: "Absent days without leave", detail: days.join(", "), weight: s.absent30 * 10 }],
    });
  }
  if (s.late30 >= 4) {
    out.push({
      id: `pat-late-${code}`,
      title: `Late on ${s.late30} days in the last 30`,
      subject: name,
      subjectCode: code,
      severity: s.late30 >= 8 ? "Medium" : "Low",
      evidence: [`${s.late30} arrivals past the threshold plus grace`, `${s.lateWeek} of the last 5 working days`],
      suggestedAction: "Check whether the shift assignment or commute has changed before raising it.",
      confidence: 90,
      source: "pattern",
      drivers: [{ label: "Late arrivals (30 days)", detail: `${s.late30} days`, weight: s.late30 }],
    });
  }
  if (s.gps30 >= 4) {
    out.push({
      id: `pat-gps-${code}`,
      title: `${s.gps30} Mobile GPS punches in 30 days`,
      subject: name,
      subjectCode: code,
      severity: "Low",
      evidence: [`${s.gps30} days punched from the mobile app rather than the office reader`, "Each GPS punch is checked against the branch geofence"],
      suggestedAction: "If you were on site, nothing to do; if travelling, tag the punch with the client location.",
      confidence: 68,
      source: "pattern",
      drivers: [{ label: "Mobile GPS punches", detail: `${s.gps30} of ${s.last30.filter(worked).length} worked days`, weight: s.gps30 }],
    });
  }
  return out;
}

export interface DayVerdict {
  level: "normal" | "review";
  label: string;
  drivers: ExplainDriver[];
}

/** Per-row AI check on the team day board. */
export function dayVerdict(code: string): DayVerdict {
  const s = stats(code);
  const checks = [
    { hit: s.lateWeek >= 2, label: `Review — late ${s.lateWeek} times this week`, driver: { label: "Late this week", detail: `${s.lateWeek} of the last ${s.weekDays.length} working days`, weight: s.lateWeek * 6 } },
    { hit: s.otWeek >= 3, label: `Review — overtime ${s.otWeek} of ${s.weekDays.length} days`, driver: { label: "Overtime this week", detail: `${s.otWeek} of the last ${s.weekDays.length} working days past 9 h`, weight: s.otWeek * 5 } },
    { hit: s.absent30 >= 2, label: `Review — ${s.absent30} unexplained absences`, driver: { label: "Absences without leave (30 days)", detail: `${s.absent30} days`, weight: s.absent30 * 7 } },
    { hit: s.late30 >= 8, label: `Review — late ${s.late30} of 30 days`, driver: { label: "Late arrivals (30 days)", detail: `${s.late30} days`, weight: s.late30 } },
  ];
  const hits = checks.filter((c) => c.hit).sort((a, b) => b.driver.weight - a.driver.weight);
  const drivers = checks.map((c) => ({ ...c.driver, label: `${c.hit ? "Flag" : "OK"} · ${c.driver.label}` }));
  if (!hits.length) return { level: "normal", label: "Normal pattern", drivers };
  return { level: "review", label: hits[0].label, drivers: [...hits.map((h) => ({ ...h.driver, label: `Flag · ${h.driver.label}` })), ...drivers.filter((d) => d.label.startsWith("OK"))] };
}
