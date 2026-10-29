/* ============================================================================
   W5 fixtures — time: attendance reports, biometric devices, leave reports.

   Everything here is derived from `@/mock/attendance`, `@/mock/leave` and
   `@/mock/payroll`, so the muster roll, the overtime cost and the LOP report
   agree with the screens those fixtures already drive.
   ========================================================================== */

import { addDays, format, getDaysInMonth, parseISO } from "date-fns";
import { mulberry32 } from "@/lib/utils";
import { BRANCHES, branchById, deptName, DEMO_TODAY } from "@/mock/org";
import { employeeByCode, type Employee } from "@/mock/employees";
import {
  ATTENDANCE_CODES,
  ATTENDANCE_WINDOW,
  attendanceFor,
  monthGrid,
  settingsForCountry,
  type CellState,
} from "@/mock/attendance";
import { CURRENT_PERIOD, ctcBreakup, computeAmounts, runPopulation } from "@/mock/payroll";
import {
  LEAVE_APPLICATIONS,
  LEAVE_BALANCES,
  LEAVE_EMPLOYEE_CODES,
  LEAVE_TYPE_BY_CODE,
} from "@/mock/leave";

/* ------------------------------------------------------------ population */

export interface TimeReportPerson {
  code: string;
  name: string;
  designation: string;
  departmentId: string;
  department: string;
  branchId: string;
  branch: string;
}

const personOf = (e: Employee): TimeReportPerson => ({
  code: e.code,
  name: e.name,
  designation: e.designation,
  departmentId: e.departmentId,
  department: deptName(e.departmentId),
  branchId: e.branchId,
  branch: branchById(e.branchId)?.name ?? e.branchId,
});

/** The employees with a 90-day punch history — the muster roll population. */
export const MUSTER_PEOPLE: TimeReportPerson[] = ATTENDANCE_CODES.map((c) => employeeByCode(c))
  .filter((e): e is Employee => !!e)
  .map(personOf)
  .sort((a, b) => a.name.localeCompare(b.name));

/** Months the 90-day window touches (window starts 19 Jun, ends DEMO_TODAY). */
export const MUSTER_MONTHS = [
  { value: "2026-07", label: "July 2026" },
  { value: "2026-08", label: "August 2026" },
  { value: "2026-09", label: "September 2026 (to date)" },
];
export const MUSTER_DEFAULT_MONTH = "2026-08";

/* ------------------------------------------------------------ muster roll */

export type MusterCode = "P" | "A" | "L" | "H" | "WO" | "HD" | "OT" | "—" | "";

export const MUSTER_LEGEND: { code: MusterCode; label: string }[] = [
  { code: "P", label: "Present" },
  { code: "OT", label: "Present + overtime" },
  { code: "HD", label: "Half day" },
  { code: "A", label: "Absent (LOP)" },
  { code: "L", label: "On leave" },
  { code: "H", label: "Holiday" },
  { code: "WO", label: "Weekly off" },
  { code: "—", label: "Not marked" },
];

const CODE_OF: Record<CellState, MusterCode> = {
  present: "P",
  overtime: "OT",
  half_day: "HD",
  absent: "A",
  leave: "L",
  holiday: "H",
  weekend: "WO",
  not_marked: "—",
};

export interface MusterRow extends TimeReportPerson {
  /** One entry per calendar day; "" = a future day. */
  days: MusterCode[];
  present: number;
  halfDays: number;
  absent: number;
  leave: number;
  holidays: number;
  weeklyOffs: number;
  /** Present + OT + ½ × half days + leave + holidays + weekly offs. */
  payableDays: number;
}

const ymOf = (month: string) => month.split("-").map(Number) as [number, number];

export function musterRoll(month: string): MusterRow[] {
  const [y, m] = ymOf(month);
  return MUSTER_PEOPLE.map((p) => {
    const days: MusterCode[] = monthGrid(p.code, y, m).map((c) => (c.isFuture ? "" : CODE_OF[c.state]));
    const count = (...codes: MusterCode[]) => days.filter((d) => codes.includes(d)).length;
    const present = count("P", "OT");
    const halfDays = count("HD");
    const leave = count("L");
    const holidays = count("H");
    const weeklyOffs = count("WO");
    return {
      ...p,
      days,
      present,
      halfDays,
      absent: count("A"),
      leave,
      holidays,
      weeklyOffs,
      payableDays: present + halfDays * 0.5 + leave + holidays + weeklyOffs,
    };
  });
}

export const musterDaysIn = (month: string) => getDaysInMonth(parseISO(`${month}-01`));

/* ------------------------------------------------- late / early / overtime */

const minutesOf = (iso: string) => Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
const countryOfBranch = (branchId: string): "IN" | "US" =>
  branchById(branchId)?.country === "US" ? "US" : "IN";

export interface PunctualityRow extends TimeReportPerson {
  days: number;
  totalMinutes: number;
  avgMinutes: number;
  worstMinutes: number;
  worstDate: string;
  withinGraceDays: number;
}

/** Late arrivals past the threshold, per employee, for one month. */
export function lateComers(month: string): PunctualityRow[] {
  return MUSTER_PEOPLE.flatMap((p) => {
    const recs = attendanceFor(p.code).filter((d) => d.date.startsWith(month) && d.late);
    if (!recs.length) return [];
    const total = recs.reduce((s, d) => s + d.lateByMinutes, 0);
    const worst = recs.reduce((w, d) => (d.lateByMinutes > w.lateByMinutes ? d : w), recs[0]);
    return [
      {
        ...p,
        days: recs.length,
        totalMinutes: total,
        avgMinutes: Math.round(total / recs.length),
        worstMinutes: worst.lateByMinutes,
        worstDate: worst.date,
        withinGraceDays: attendanceFor(p.code).filter((d) => d.date.startsWith(month) && d.withinGrace).length,
      },
    ];
  });
}

/** Punch-outs before shift end on worked days (half days excluded — they are expected to leave early). */
export function earlyGoers(month: string): PunctualityRow[] {
  return MUSTER_PEOPLE.flatMap((p) => {
    const [h, mi] = (settingsForCountry(countryOfBranch(p.branchId))?.shiftEnd ?? "18:30").split(":").map(Number);
    const shiftEnd = h * 60 + mi;
    const hits = attendanceFor(p.code)
      .filter((d) => d.date.startsWith(month) && d.state === "present" && d.lastOut && !d.inProgress)
      .map((d) => ({ date: d.date, early: shiftEnd - minutesOf(d.lastOut!) }))
      .filter((h) => h.early >= 15);
    if (!hits.length) return [];
    const total = hits.reduce((s, h) => s + h.early, 0);
    const worst = hits.reduce((w, h) => (h.early > w.early ? h : w), hits[0]);
    return [
      {
        ...p,
        days: hits.length,
        totalMinutes: total,
        avgMinutes: Math.round(total / hits.length),
        worstMinutes: worst.early,
        worstDate: worst.date,
        withinGraceDays: 0,
      },
    ];
  });
}

export interface OvertimeCostRow extends TimeReportPerson {
  otDays: number;
  otHours: number;
  /** basic ÷ (days in month × 8). */
  hourlyBasic: number;
  /** OT hours × hourly basic × 2 (Factories Act double rate). */
  cost: number;
}

export function overtimeCost(month: string): OvertimeCostRow[] {
  const dim = musterDaysIn(month);
  return MUSTER_PEOPLE.flatMap((p) => {
    const emp = employeeByCode(p.code)!;
    const recs = attendanceFor(p.code).filter((d) => d.date.startsWith(month) && d.overtimeMinutes > 0);
    if (!recs.length) return [];
    const otHours = Math.round((recs.reduce((s, d) => s + d.overtimeMinutes, 0) / 60) * 10) / 10;
    /* Priced at the rate the row shows, so Σ cost re-derives from the visible columns. */
    const hourlyBasic = Math.round((ctcBreakup(emp.gradeId, emp.ctc).basic / (dim * 8)) * 100) / 100;
    return [
      {
        ...p,
        otDays: recs.length,
        otHours,
        hourlyBasic,
        cost: Math.round(otHours * hourlyBasic * 2),
      },
    ];
  });
}

/* --------------------------------------------------- absenteeism trend */

export interface AbsenteeismPoint extends Record<string, string | number> {
  week: string;
  absentPct: number;
  leavePct: number;
}

/** Weekly absent and leave rate (share of scheduled working days) across the 90-day window. */
export function absenteeismTrend(codes: string[]): AbsenteeismPoint[] {
  const out: AbsenteeismPoint[] = [];
  const set = new Set(codes);
  let start = parseISO(ATTENDANCE_WINDOW.start);
  const end = parseISO(ATTENDANCE_WINDOW.end);
  while (start <= end) {
    const from = format(start, "yyyy-MM-dd");
    const to = format(addDays(start, 6), "yyyy-MM-dd");
    let scheduled = 0;
    let absent = 0;
    let leave = 0;
    for (const c of set) {
      for (const d of attendanceFor(c)) {
        if (d.date < from || d.date > to || d.state === "weekend" || d.state === "holiday") continue;
        scheduled++;
        if (d.state === "absent") absent++;
        if (d.state === "leave") leave++;
      }
    }
    out.push({
      week: format(start, "dd MMM"),
      absentPct: scheduled ? Math.round((absent / scheduled) * 1000) / 10 : 0,
      leavePct: scheduled ? Math.round((leave / scheduled) * 1000) / 10 : 0,
    });
    start = addDays(start, 7);
  }
  return out;
}

export const TIME_REPORT_BRANCH_OPTIONS = BRANCHES.map((b) => ({ value: b.id, label: b.name }));

/* --------------------------------------------- LOP report (September run) */

export interface LopReportRow extends TimeReportPerson {
  payableDays: number;
  lopDays: number;
  perDayRate: number;
  lopAmount: number;
  overrun: boolean;
}

/** Exactly what the September pay run deducts — computeAmounts is the single source. */
export const LEAVE_REPORT_LOP: LopReportRow[] = runPopulation(CURRENT_PERIOD.id).flatMap((emp) => {
  const a = computeAmounts(CURRENT_PERIOD, emp);
  if (a.lopDays <= 0) return [];
  return [
    {
      ...personOf(emp),
      payableDays: a.payableDays,
      lopDays: a.lopDays,
      perDayRate: Math.round(a.perDayRate),
      lopAmount: a.lop,
      overrun: a.lopDays > a.payableDays,
    },
  ];
});

export const LEAVE_REPORT_LOP_TOTALS = {
  employees: LEAVE_REPORT_LOP.length,
  days: LEAVE_REPORT_LOP.reduce((s, r) => s + r.lopDays, 0),
  amount: LEAVE_REPORT_LOP.reduce((s, r) => s + r.lopAmount, 0),
};

/* ======================================================= biometric devices */

export type DeviceStatus = "online" | "offline" | "error";

export interface BiometricDevice {
  id: string;
  name: string;
  vendor: "ZKTeco" | "eSSL" | "Matrix";
  model: string;
  branchId: string;
  branch: string;
  location: string;
  ip: string;
  serial: string;
  firmware: string;
  lastSync: string;
  status: DeviceStatus;
  enrolled: number;
  punchesToday: number;
  note: string;
}

type DeviceSeed = [string, BiometricDevice["vendor"], string, string, string, string, DeviceStatus, string, number, string];

/* Names match the device ids stamped on punches in @/mock/attendance. */
const DEVICE_SEEDS: DeviceSeed[] = [
  ["BLR-GATE-01", "ZKTeco", "SpeedFace-V5L", "BLR", "Main gate, ground floor", "10.20.4.21", "online", "14:34", 214, ""],
  ["BLR-GATE-02", "ZKTeco", "SpeedFace-V5L", "BLR", "Basement parking entry", "10.20.4.22", "online", "14:33", 214, ""],
  ["BLR-L4-TURNSTILE", "eSSL", "X990 Turnstile", "BLR", "Level 4 turnstile", "10.20.4.40", "error", "11:02", 186, "Template store full — 3,000 of 3,000 slots used. Purge exited employees."],
  ["BLR-CAFE-01", "eSSL", "AiFace Mars", "BLR", "Cafeteria wing", "10.20.4.55", "online", "14:30", 214, ""],
  ["PNQ-RECEPTION", "ZKTeco", "ProFace X", "PNQ", "Reception", "10.30.2.11", "online", "14:31", 92, ""],
  ["PNQ-L2-01", "Matrix", "COSEC ARGO FOE", "PNQ", "Level 2 delivery floor", "10.30.2.18", "offline", "08:47", 92, "No heartbeat since 08:47 — switch port flapping reported to IT."],
  ["HYD-MAIN-01", "eSSL", "X990", "HYD", "Satellite office door", "10.40.1.10", "online", "14:20", 3, ""],
  ["EWR-LOBBY-01", "ZKTeco", "SpeedFace-V5L", "EWR", "Lobby, Suite 2600", "10.50.1.12", "online", "14:32", 31, "Syncs on Eastern time; stamped UTC at ingestion."],
  ["EWR-BADGE-02", "Matrix", "COSEC Door FMX", "EWR", "Badge reader, pantry", "10.50.1.13", "online", "14:29", 31, ""],
];

export const DEVICE_LIST: BiometricDevice[] = DEVICE_SEEDS.map(
  ([id, vendor, model, branchId, location, ip, status, sync, enrolled, note], i) => {
    const rng = mulberry32(4400 + i * 31);
    return {
      id,
      name: id,
      vendor,
      model,
      branchId,
      branch: branchById(branchId)?.name ?? branchId,
      location,
      ip,
      serial: `${vendor.slice(0, 3).toUpperCase()}${String(Math.floor(rng() * 9_000_000) + 1_000_000)}`,
      firmware: vendor === "ZKTeco" ? "Ver 6.60.1.12" : vendor === "eSSL" ? "Ver 8.0.4.2" : "V3R4",
      lastSync: `${DEMO_TODAY}T${sync}:00`,
      status,
      enrolled,
      punchesToday: status === "offline" ? Math.round(enrolled * 0.4) : Math.round(enrolled * (1.6 + rng() * 0.5)),
      note,
    };
  },
);

export type IngestState = "received" | "processed" | "failed";

export interface IngestBatch {
  id: string;
  deviceId: string;
  receivedAt: string;
  received: number;
  processed: number;
  failed: number;
}

export interface FailedPunch {
  id: string;
  deviceId: string;
  badgeId: string;
  employeeCode: string | null;
  employeeName: string;
  punchAt: string;
  reason: string;
}

const FAIL_REASONS = [
  "Enrolment id not mapped to an employee",
  "Device clock skew > 5 min — punch held for review",
  "Employee inactive on the punch date",
  "Template mismatch below match threshold",
];

/** Batches pushed by each device today, newest first. */
export const DEVICE_BATCHES: IngestBatch[] = DEVICE_LIST.flatMap((d, di) =>
  [0, 1, 2].map((k) => {
    const rng = mulberry32(900 + di * 17 + k);
    const received = Math.max(4, Math.round((d.punchesToday / 3) * (0.8 + rng() * 0.4)));
    const failed = d.status === "error" && k === 0 ? 9 : rng() > 0.7 ? 1 + Math.floor(rng() * 3) : 0;
    const pending = d.status !== "offline" && k === 0 && di % 3 === 0 ? 3 : 0;
    const hh = 14 - k * 2 - (d.status === "offline" ? 6 : 0);
    return {
      id: `ING-${d.id}-${k}`,
      deviceId: d.id,
      receivedAt: `${DEMO_TODAY}T${String(Math.max(6, hh)).padStart(2, "0")}:${String((di * 7) % 60).padStart(2, "0")}:00`,
      received,
      processed: received - failed - pending,
      failed,
    };
  }),
).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

export const DEVICE_FAILED_PUNCHES: FailedPunch[] = DEVICE_BATCHES.flatMap((b, bi) =>
  Array.from({ length: b.failed }, (_, k) => {
    const rng = mulberry32(5100 + bi * 13 + k);
    const reason = FAIL_REASONS[Math.floor(rng() * FAIL_REASONS.length)];
    const emp = reason.startsWith("Enrolment") ? null : MUSTER_PEOPLE[Math.floor(rng() * MUSTER_PEOPLE.length)];
    return {
      id: `${b.id}-F${k + 1}`,
      deviceId: b.deviceId,
      badgeId: String(10000 + Math.floor(rng() * 89999)),
      employeeCode: emp?.code ?? null,
      employeeName: emp?.name ?? "Unmapped badge",
      punchAt: `${b.receivedAt.slice(0, 11)}${b.receivedAt.slice(11, 13)}:${String(Math.floor(rng() * 59)).padStart(2, "0")}:00`,
      reason,
    };
  }),
);

export interface GeoFence {
  branchId: string;
  branch: string;
  lat: number;
  lng: number;
  radius: number;
  selfieRequired: boolean;
  mobileEnabled: boolean;
  mobilePunches30d: number;
}

export const DEVICE_GEOFENCES: GeoFence[] = [
  { branchId: "BLR", branch: "Bengaluru HQ", lat: 12.9279, lng: 77.6806, radius: 200, selfieRequired: true, mobileEnabled: true, mobilePunches30d: 1184 },
  { branchId: "PNQ", branch: "Pune Delivery Centre", lat: 18.5679, lng: 73.9143, radius: 150, selfieRequired: true, mobileEnabled: true, mobilePunches30d: 562 },
  { branchId: "HYD", branch: "Hyderabad Satellite", lat: 17.4416, lng: 78.3804, radius: 300, selfieRequired: false, mobileEnabled: true, mobilePunches30d: 58 },
];

/* =========================================================== leave reports */

export interface AbsenceRow extends TimeReportPerson {
  el: number;
  cl: number;
  sl: number;
  lop: number;
  other: number;
  total: number;
  /** Unplanned spells (CL, SL, LOP applications). */
  spells: number;
  /** Bradford factor = spells² × unplanned days. */
  bradford: number;
}

const taken = LEAVE_APPLICATIONS.filter((a) => a.status === "approved" && a.fromDate <= DEMO_TODAY);

export const LEAVE_REPORT_ABSENCE: AbsenceRow[] = LEAVE_EMPLOYEE_CODES.flatMap((code) => {
  const emp = employeeByCode(code);
  if (!emp) return [];
  const apps = taken.filter((a) => a.employeeCode === code);
  const by = (t: string) => apps.filter((a) => a.typeCode === t).reduce((s, a) => s + a.days, 0);
  const el = by("EL");
  const cl = by("CL");
  const sl = by("SL");
  const lop = by("LOP");
  const total = apps.reduce((s, a) => s + a.days, 0);
  const unplanned = apps.filter((a) => a.typeCode === "CL" || a.typeCode === "SL" || a.typeCode === "LOP");
  const spells = unplanned.length;
  const unplannedDays = unplanned.reduce((s, a) => s + a.days, 0);
  return [
    {
      ...personOf(emp),
      el,
      cl,
      sl,
      lop,
      other: Math.round((total - el - cl - sl - lop) * 10) / 10,
      total,
      spells,
      bradford: spells * spells * unplannedDays,
    },
  ];
});

export interface LiabilityRow extends TimeReportPerson {
  gradeId: string;
  elBalance: number;
  monthlyBasic: number;
  /** Monthly basic ÷ 30 — the encashment day rate the policy uses. */
  perDayBasic: number;
  liability: number;
}

/** Encashable EL closing balance × per-day basic. India payroll only (INR). */
export const LEAVE_REPORT_LIABILITY: LiabilityRow[] = LEAVE_BALANCES.filter(
  (b) => b.typeCode === "EL" && LEAVE_TYPE_BY_CODE.EL?.encashable && b.available > 0,
).flatMap((b) => {
  const emp = employeeByCode(b.employeeCode);
  if (!emp || countryOfBranch(emp.branchId) !== "IN" || emp.status === "exited") return [];
  const monthlyBasic = ctcBreakup(emp.gradeId, emp.ctc).basic;
  const perDayBasic = Math.round((monthlyBasic / 30) * 100) / 100;
  return [
    {
      ...personOf(emp),
      gradeId: emp.gradeId,
      elBalance: b.available,
      monthlyBasic,
      perDayBasic,
      liability: Math.round(b.available * perDayBasic),
    },
  ];
});

export interface LiabilityByDept extends Record<string, string | number> {
  departmentId: string;
  department: string;
  employees: number;
  days: number;
  liability: number;
}

export function liabilityByDepartment(rows: LiabilityRow[]): LiabilityByDept[] {
  const map = new Map<string, LiabilityByDept>();
  for (const r of rows) {
    const cur = map.get(r.departmentId) ?? {
      departmentId: r.departmentId,
      department: r.department,
      employees: 0,
      days: 0,
      liability: 0,
    };
    cur.employees += 1;
    cur.days = Math.round((cur.days + r.elBalance) * 100) / 100;
    cur.liability += r.liability;
    map.set(r.departmentId, cur);
  }
  return [...map.values()].sort((a, b) => b.liability - a.liability);
}

export interface LeaveTrendPoint extends Record<string, string | number> {
  month: string;
  EL: number;
  CL: number;
  SL: number;
  LOP: number;
  Other: number;
}

/** Approved leave days by start month, April to September of the current FY. */
export function leaveTrend(codes: Set<string> | null): LeaveTrendPoint[] {
  return ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"].map((m) => {
    const apps = taken.filter((a) => a.fromDate.startsWith(m) && (!codes || codes.has(a.employeeCode)));
    const by = (t: string) => Math.round(apps.filter((a) => a.typeCode === t).reduce((s, a) => s + a.days, 0) * 10) / 10;
    const all = apps.reduce((s, a) => s + a.days, 0);
    const point = { month: format(parseISO(`${m}-01`), "MMM yy"), EL: by("EL"), CL: by("CL"), SL: by("SL"), LOP: by("LOP"), Other: 0 };
    point.Other = Math.round((all - point.EL - point.CL - point.SL - point.LOP) * 10) / 10;
    return point;
  });
}
