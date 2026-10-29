import { addDays, eachDayOfInterval, format, getDaysInMonth, parseISO } from "date-fns";
import { mulberry32, pick, randInt } from "@/lib/utils";
import {
  BRANCHES,
  DEMO_NOW,
  DEMO_TODAY,
  DEPARTMENTS,
  branchById,
  deptName,
  holidayOn,
} from "./org";
import { ATTENDANCE_SUBSET, EMPLOYEES, VIKRAM_TEAM_CODES, employeeByCode, type Employee } from "./employees";
import { PERSONAS } from "@/lib/rbac";

/* ============================================================================
   Time & Attendance fixtures.

   90 calendar days ending at DEMO_TODAY, generated deterministically from a
   fixed seed — no Math.random(), no new Date() at module scope — so the server
   render and the first client render are byte-identical.

   The invariant the demo is judged on:
     present + half_day + absent + leave + holiday + weekend + not_marked
       === the number of days in the month
   "overtime" is a *flavour of present* (worked past the overtime band), so it
   is counted inside `present` in the summary and reported separately as
   `overtimeDays`. "not_marked" is only ever non-zero for a month that extends
   past DEMO_TODAY or before the start of the 90-day window.
   ========================================================================== */

export type DayState =
  | "present"
  | "half_day"
  | "absent"
  | "leave"
  | "holiday"
  | "weekend"
  | "overtime";

export type PunchSource = "Biometric" | "Web" | "Mobile GPS" | "Regularised";

export interface PunchPair {
  /** ISO datetime, e.g. 2026-09-16T09:22:00 */
  in: string;
  /** null while the pair is still open (today, before punch-out). */
  out: string | null;
  minutes: number;
  source: PunchSource;
  device: string;
}

export interface AttendanceDay {
  code: string;
  date: string;
  state: DayState;
  punches: PunchPair[];
  firstIn: string | null;
  lastOut: string | null;
  workedMinutes: number;
  breakMinutes: number;
  overtimeMinutes: number;
  /** Minutes past the late threshold; 0 when the punch was on time. */
  lateByMinutes: number;
  late: boolean;
  withinGrace: boolean;
  shiftLabel: string;
  /** Still running — today's open pair. */
  inProgress: boolean;
  holidayName?: string;
  leaveType?: string;
  note?: string;
}

/* ------------------------------------------------------------- shift config */

export type CountryId = "IN" | "US" | "__unset";

export interface MinuteBands {
  /** worked >= halfDay -> at least a half day */
  halfDay: number;
  /** worked >= fullDay -> a full present day */
  fullDay: number;
  /** worked > overtime -> the day is flagged as overtime */
  overtime: number;
}

export interface CountryAttendanceSettings {
  id: CountryId;
  countryName: string;
  /** false -> the country is running on tenant defaults (the amber banner). */
  configured: boolean;
  branches: string[];
  shiftName: string;
  shiftStart: string;
  shiftEnd: string;
  breakMinutes: number;
  lateThreshold: string;
  graceMinutes: number;
  bands: MinuteBands;
  weeklyOff: string;
  timezone: string;
  updatedBy: string;
  updatedAt: string;
  note: string;
}

const DEFAULT_BANDS: MinuteBands = { halfDay: 240, fullDay: 480, overtime: 540 };

export const ATTENDANCE_SETTINGS: CountryAttendanceSettings[] = [
  {
    id: "IN",
    countryName: "India",
    configured: true,
    branches: ["Bengaluru HQ", "Pune Delivery Centre"],
    shiftName: "General shift (IND-GEN-01)",
    shiftStart: "09:30",
    shiftEnd: "18:30",
    breakMinutes: 45,
    lateThreshold: "09:30",
    graceMinutes: 10,
    bands: { halfDay: 240, fullDay: 480, overtime: 540 },
    weeklyOff: "Saturday, Sunday",
    timezone: "Asia/Kolkata",
    updatedBy: "Priya Menon",
    updatedAt: "2026-04-02T11:24:00",
    note: "Reviewed with the works committee at the start of FY 2026-27.",
  },
  {
    id: "US",
    countryName: "United States",
    configured: false,
    branches: ["Newark NJ"],
    shiftName: "Tenant default shift",
    shiftStart: "09:00",
    shiftEnd: "17:30",
    breakMinutes: 30,
    lateThreshold: "09:00",
    graceMinutes: 10,
    bands: DEFAULT_BANDS,
    weeklyOff: "Saturday, Sunday",
    timezone: "America/New_York",
    updatedBy: "— inherited —",
    updatedAt: "2026-01-01T00:00:00",
    note: "No country override saved. Newark is being evaluated against the India bands.",
  },
  {
    id: "__unset",
    countryName: "— not set — (Hyderabad Satellite)",
    configured: false,
    branches: ["Hyderabad Satellite"],
    shiftName: "Tenant default shift",
    shiftStart: "09:00",
    shiftEnd: "17:30",
    breakMinutes: 30,
    lateThreshold: "09:00",
    graceMinutes: 10,
    bands: DEFAULT_BANDS,
    weeklyOff: "Saturday, Sunday",
    timezone: "Asia/Kolkata",
    updatedBy: "— inherited —",
    updatedAt: "2026-01-01T00:00:00",
    note: "The Hyderabad branch has no country mapped, so work context resolution fails closed.",
  },
];

export const settingsForCountry = (id: CountryId) =>
  ATTENDANCE_SETTINGS.find((s) => s.id === id) ?? ATTENDANCE_SETTINGS[0];

export const UNCONFIGURED_COUNTRIES = ATTENDANCE_SETTINGS.filter((s) => !s.configured).length;
export const DEFAULTS_BANNER = `${UNCONFIGURED_COUNTRIES} of ${ATTENDANCE_SETTINGS.length} countries are running on defaults.`;

/* ---------------------------------------------------------- work calendars */

export type WeekDayPattern = "working" | "off" | "half";

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export interface WorkCalendar {
  id: string;
  name: string;
  countryId: CountryId | null;
  countryName: string;
  /** Index 0 = Sunday, 6 = Saturday. */
  week: WeekDayPattern[];
  fyStartMonth: number;
  timezone: string;
  holidayCount: number;
  branches: string[];
  employees: number;
  status: "active" | "draft";
  isDefault: boolean;
}

export const WORK_CALENDARS: WorkCalendar[] = [
  {
    id: "CAL-IN-STD",
    name: "India — Standard 5-day",
    countryId: "IN",
    countryName: "India",
    week: ["off", "working", "working", "working", "working", "working", "off"],
    fyStartMonth: 4,
    timezone: "Asia/Kolkata",
    holidayCount: 14,
    branches: ["Bengaluru HQ", "Pune Delivery Centre"],
    employees: 306,
    status: "active",
    isDefault: true,
  },
  {
    id: "CAL-IN-SUP",
    name: "India — Support roster (alternate Saturdays)",
    countryId: "IN",
    countryName: "India",
    week: ["off", "working", "working", "working", "working", "working", "half"],
    fyStartMonth: 4,
    timezone: "Asia/Kolkata",
    holidayCount: 14,
    branches: [],
    employees: 0,
    status: "draft",
    isDefault: false,
  },
  {
    id: "CAL-US-STD",
    name: "United States — Standard 5-day",
    countryId: "US",
    countryName: "United States",
    week: ["off", "working", "working", "working", "working", "working", "off"],
    fyStartMonth: 1,
    timezone: "America/New_York",
    holidayCount: 7,
    branches: ["Newark NJ"],
    employees: 31,
    status: "active",
    isDefault: true,
  },
  {
    id: "CAL-UNMAPPED",
    name: "Hyderabad Satellite — unmapped",
    countryId: null,
    countryName: "— not set —",
    week: ["off", "working", "working", "working", "working", "working", "off"],
    fyStartMonth: 4,
    timezone: "Asia/Kolkata",
    holidayCount: 0,
    branches: ["Hyderabad Satellite"],
    employees: 3,
    status: "draft",
    isDefault: false,
  },
];

/* ------------------------------------------------------------- generation */

const WINDOW_DAYS = 90;
const END_DATE = parseISO(DEMO_TODAY);
const START_DATE = addDays(END_DATE, -(WINDOW_DAYS - 1));

export const ATTENDANCE_WINDOW = {
  start: format(START_DATE, "yyyy-MM-dd"),
  end: DEMO_TODAY,
  days: WINDOW_DAYS,
};

const WINDOW_DATES: string[] = eachDayOfInterval({ start: START_DATE, end: END_DATE }).map((d) =>
  format(d, "yyyy-MM-dd"),
);

/** Minutes past midnight at DEMO_NOW — used for today's still-running pair. */
const NOW_MINUTES = (() => {
  const [h, m] = DEMO_NOW.slice(11, 16).split(":").map(Number);
  return h * 60 + m;
})();

const toClock = (minutes: number) => {
  const m = Math.max(0, Math.round(minutes));
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
const at = (iso: string, minutes: number) => `${iso}T${toClock(minutes)}:00`;
const clockToMinutes = (clock: string) => {
  const [h, m] = clock.split(":").map(Number);
  return h * 60 + m;
};

const DEVICES_IN = ["BLR-GATE-01", "BLR-GATE-02", "BLR-L4-TURNSTILE", "PNQ-RECEPTION"];
const DEVICES_US = ["EWR-LOBBY-01", "EWR-BADGE-02"];
const LEAVE_TYPES = [
  "Earned Leave",
  "Casual Leave",
  "Sick Leave",
  "Comp Off",
  "Work From Home",
];
const ABSENCE_NOTES = [
  "No punch recorded and no leave applied — flagged as loss of pay.",
  "Marked absent by the finalisation job; regularisation window is still open.",
  "Swipe missing at both gates; employee was not on the visitor register either.",
];

/** The spec's 40, plus the six personas and a cross-department sample so the
    manager day board's department filter and chart have something to compare. */
const PERSONA_CODES = ["STL-0001", "STL-0009", "STL-0017", "STL-0031", "STL-0058", "STL-0142"];

const CROSS_DEPT_SAMPLE: string[] = (() => {
  const out: string[] = [];
  for (const d of DEPARTMENTS) {
    if (d.id === "ENG") continue;
    const pool = EMPLOYEES.filter((e) => e.departmentId === d.id && e.status !== "exited");
    const take = Math.min(8, pool.length);
    for (let i = 0; i < take; i++) {
      out.push(pool[Math.floor(((i + 0.5) * pool.length) / take)].code);
    }
  }
  return out;
})();

/** Every switchable persona's own employee record — each one sees their own punches. */
const PERSONA_EMPLOYEE_CODES = PERSONAS.map((p) => p.employeeId);

export const ATTENDANCE_CODES: string[] = Array.from(
  /* Vikram's reportees go last so earlier codes keep their seeded draws; the
     manager persona's "Team today" card then reads real records for all 8. */
  new Set([...ATTENDANCE_SUBSET, ...PERSONA_CODES, ...CROSS_DEPT_SAMPLE, ...PERSONA_EMPLOYEE_CODES, ...VIKRAM_TEAM_CODES]),
);

/**
 * Today's punch-in for whoever is signed in — the same 09:36 anchor every punch
 * timer uses (DEMO_PUNCH_IN in components/app-state.tsx). One open pair from it,
 * so the punch card, the dashboard and this record agree to the minute.
 */
const PERSONA_PUNCH_IN = "09:36";

/**
 * Lateness is a habit, not a coin toss. About one in ten people is a chronic
 * late-comer (late on half their days), three in ten are late now and then,
 * and the rest almost never — so roughly 10% of the people at work on a given
 * day are late, and a month's late list is dominated by the same few names.
 * Personas are never chronic: the demo's own record should not lead with it.
 */
function lateRateFor(code: string) {
  const r = mulberry32(seedFor(code) + 4243)();
  if (r < 0.1 && !PERSONA_EMPLOYEE_CODES.includes(code)) return 0.5;
  if (r < 0.4) return 0.15;
  return 0.015;
}

const countryOf = (emp: Employee): "IN" | "US" =>
  (branchById(emp.branchId)?.country as "IN" | "US" | null) ?? "IN";

const seedFor = (code: string) => 7_000_000 + Number(code.slice(4)) * 131;

function buildDaysFor(emp: Employee): AttendanceDay[] {
  const rng = mulberry32(seedFor(emp.code));
  const lateRate = lateRateFor(emp.code);
  const country = countryOf(emp);
  const cfg = settingsForCountry(country);
  const shiftEnd = clockToMinutes(cfg.shiftEnd);
  const threshold = clockToMinutes(cfg.lateThreshold);
  const devices = country === "US" ? DEVICES_US : DEVICES_IN;
  const shiftLabel = `${cfg.shiftStart} – ${cfg.shiftEnd}`;

  const out: AttendanceDay[] = [];

  for (const date of WINDOW_DATES) {
    const dow = parseISO(date).getDay();
    const base: AttendanceDay = {
      code: emp.code,
      date,
      state: "present",
      punches: [],
      firstIn: null,
      lastOut: null,
      workedMinutes: 0,
      breakMinutes: 0,
      overtimeMinutes: 0,
      lateByMinutes: 0,
      late: false,
      withinGrace: false,
      shiftLabel,
      inProgress: false,
    };

    if (dow === 0 || dow === 6) {
      out.push({ ...base, state: "weekend" });
      continue;
    }

    const hol = holidayOn(date, country);
    if (hol && !hol.optional) {
      out.push({ ...base, state: "holiday", holidayName: hol.name });
      continue;
    }

    const isToday = date === DEMO_TODAY;

    /* --- today, for a persona: one open pair from the shared anchor --- */
    if (isToday && PERSONA_EMPLOYEE_CODES.includes(emp.code)) {
      const openStart = clockToMinutes(PERSONA_PUNCH_IN);
      const pair: PunchPair = {
        in: at(date, openStart),
        out: null,
        minutes: Math.max(0, NOW_MINUTES - openStart),
        source: "Biometric",
        device: devices[0],
      };
      out.push({
        ...base,
        state: "present",
        punches: [pair],
        firstIn: pair.in,
        workedMinutes: pair.minutes,
        lateByMinutes: Math.max(0, openStart - threshold),
        late: openStart - threshold > cfg.graceMinutes,
        withinGrace: openStart - threshold > 0 && openStart - threshold <= cfg.graceMinutes,
        inProgress: true,
      });
      continue;
    }

    const roll = rng();

    /* --- leave ------------------------------------------------------- */
    if (roll < 0.058) {
      out.push({ ...base, state: "leave", leaveType: pick(rng, LEAVE_TYPES) });
      continue;
    }
    /* --- absent ------------------------------------------------------ */
    if (roll < 0.09) {
      out.push({ ...base, state: "absent", note: pick(rng, ABSENCE_NOTES) });
      continue;
    }

    /* --- arrival ----------------------------------------------------- */
    const arrivalRoll = rng();
    let startMin: number;
    if (arrivalRoll < lateRate) startMin = threshold + randInt(rng, 12, 78); // properly late
    else if (arrivalRoll < lateRate + 0.1) startMin = threshold + randInt(rng, 1, 9); // inside grace
    else startMin = threshold - 18 + randInt(rng, 0, 16); // on time

    const lateByMinutes = Math.max(0, startMin - threshold);
    const withinGrace = lateByMinutes > 0 && lateByMinutes <= cfg.graceMinutes;
    const late = lateByMinutes > cfg.graceMinutes;

    /* --- half day ---------------------------------------------------- */
    if (roll < 0.135) {
      const worked = randInt(rng, 245, 330);
      const device = pick(rng, devices);
      const pair: PunchPair = {
        in: at(date, startMin),
        out: at(date, startMin + worked),
        minutes: worked,
        source: "Biometric",
        device,
      };
      out.push({
        ...base,
        state: "half_day",
        punches: [pair],
        firstIn: pair.in,
        lastOut: pair.out,
        workedMinutes: worked,
        lateByMinutes,
        late,
        withinGrace,
        note: "Worked a partial day — second half applied against Casual Leave.",
      });
      continue;
    }

    /* --- today: one open pair, timer still running ------------------- */
    if (isToday) {
      const openStart = Math.min(startMin, NOW_MINUTES - 45);
      const lunchOut = openStart + randInt(rng, 200, 235);
      const lunchIn = lunchOut + randInt(rng, 34, 52);
      const punches: PunchPair[] = [
        {
          in: at(date, openStart),
          out: at(date, lunchOut),
          minutes: lunchOut - openStart,
          source: "Biometric",
          device: pick(rng, devices),
        },
        {
          in: at(date, lunchIn),
          out: null,
          minutes: Math.max(0, NOW_MINUTES - lunchIn),
          source: "Biometric",
          device: pick(rng, devices),
        },
      ];
      const worked = punches.reduce((a, p) => a + p.minutes, 0);
      out.push({
        ...base,
        state: "present",
        punches,
        firstIn: punches[0].in,
        lastOut: null,
        workedMinutes: worked,
        breakMinutes: lunchIn - lunchOut,
        lateByMinutes: Math.max(0, openStart - threshold),
        late: openStart - threshold > cfg.graceMinutes,
        withinGrace: openStart - threshold > 0 && openStart - threshold <= cfg.graceMinutes,
        inProgress: true,
      });
      continue;
    }

    /* --- a normal full day, split by a lunch punch -------------------- */
    const otRoll = rng();
    const worked =
      otRoll < 0.21
        ? randInt(rng, 545, 675) // overtime band
        : randInt(rng, 468, 536);
    const morning = Math.round(worked * (0.42 + rng() * 0.1));
    const afternoon = worked - morning;
    const lunch = randInt(rng, 34, 54);

    const lunchOut = startMin + morning;
    const lunchIn = lunchOut + lunch;
    const punches: PunchPair[] = [
      {
        in: at(date, startMin),
        out: at(date, lunchOut),
        minutes: morning,
        source: rng() > 0.92 ? "Mobile GPS" : "Biometric",
        device: pick(rng, devices),
      },
      {
        in: at(date, lunchIn),
        out: at(date, lunchIn + afternoon),
        minutes: afternoon,
        source: rng() > 0.95 ? "Web" : "Biometric",
        device: pick(rng, devices),
      },
    ];

    const overtimeMinutes = Math.max(0, worked - cfg.bands.overtime);
    out.push({
      ...base,
      state: overtimeMinutes > 0 ? "overtime" : "present",
      punches,
      firstIn: punches[0].in,
      lastOut: punches[1].out,
      workedMinutes: worked,
      breakMinutes: lunch,
      overtimeMinutes,
      lateByMinutes,
      late,
      withinGrace,
      note:
        overtimeMinutes > 0
          ? `Stayed ${Math.round(overtimeMinutes / 6) / 10}h past the ${cfg.bands.overtime / 60}h overtime band.`
          : undefined,
    });
  }

  /* Shift end is referenced so the label and the bands cannot drift apart. */
  void shiftEnd;
  return out;
}

const BY_CODE = new Map<string, AttendanceDay[]>();
for (const code of ATTENDANCE_CODES) {
  const emp = employeeByCode(code);
  if (emp) BY_CODE.set(code, buildDaysFor(emp));
}

export const ATTENDANCE: AttendanceDay[] = ATTENDANCE_CODES.flatMap(
  (c) => BY_CODE.get(c) ?? [],
);

/* ------------------------------------------------------------------ lookup */

/** Every persona has data; anyone else falls back to the demo employee. */
export function resolveAttendanceCode(code: string | null | undefined) {
  return code && BY_CODE.has(code) ? code : "STL-0142";
}

export function attendanceFor(code: string): AttendanceDay[] {
  return BY_CODE.get(resolveAttendanceCode(code)) ?? [];
}

export function attendanceOn(code: string, iso: string): AttendanceDay | undefined {
  return attendanceFor(code).find((d) => d.date === iso);
}

export function last7Days(code: string): AttendanceDay[] {
  return attendanceFor(code).slice(-7);
}

export function todayFor(code: string) {
  return attendanceOn(code, DEMO_TODAY);
}

/* -------------------------------------------------------------- month grid */

export type CellState = DayState | "not_marked";

export interface MonthCell {
  date: string;
  day: number;
  /** 0 = Sunday. */
  weekday: number;
  state: CellState;
  record?: AttendanceDay;
  inWindow: boolean;
  isToday: boolean;
  isFuture: boolean;
  holidayName?: string;
}

/** `month` is 1-based. Always returns every day of the month. */
export function monthGrid(code: string, year: number, month: number): MonthCell[] {
  const resolved = resolveAttendanceCode(code);
  const emp = employeeByCode(resolved);
  const country = emp ? countryOf(emp) : "IN";
  const first = parseISO(`${year}-${String(month).padStart(2, "0")}-01`);
  const total = getDaysInMonth(first);

  const cells: MonthCell[] = [];
  for (let day = 1; day <= total; day++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const record = attendanceOn(resolved, date);
    const weekday = parseISO(date).getDay();
    const hol = holidayOn(date, country);

    if (record) {
      cells.push({
        date,
        day,
        weekday,
        state: record.state,
        record,
        inWindow: true,
        isToday: date === DEMO_TODAY,
        isFuture: false,
        holidayName: record.holidayName,
      });
      continue;
    }

    /* Outside the 90-day window: the calendar still knows what kind of day it
       is, but there is nothing to mark. */
    const state: CellState =
      weekday === 0 || weekday === 6
        ? "weekend"
        : hol && !hol.optional
          ? "holiday"
          : "not_marked";
    cells.push({
      date,
      day,
      weekday,
      state,
      inWindow: false,
      isToday: false,
      isFuture: date > DEMO_TODAY,
      holidayName: hol && !hol.optional ? hol.name : undefined,
    });
  }
  return cells;
}

export interface MonthSummary {
  year: number;
  month: number;
  daysInMonth: number;
  present: number;
  half_day: number;
  absent: number;
  leave: number;
  holiday: number;
  weekend: number;
  not_marked: number;
  /** A subset of `present` — days that crossed the overtime band. */
  overtimeDays: number;
  lateDays: number;
  workedMinutes: number;
  overtimeMinutes: number;
  payableDays: number;
  /** present + half_day + absent + leave + holiday + weekend + not_marked */
  reconciles: number;
}

export function monthSummary(code: string, year: number, month: number): MonthSummary {
  const cells = monthGrid(code, year, month);
  const s: MonthSummary = {
    year,
    month,
    daysInMonth: cells.length,
    present: 0,
    half_day: 0,
    absent: 0,
    leave: 0,
    holiday: 0,
    weekend: 0,
    not_marked: 0,
    overtimeDays: 0,
    lateDays: 0,
    workedMinutes: 0,
    overtimeMinutes: 0,
    payableDays: 0,
    reconciles: 0,
  };

  for (const c of cells) {
    if (c.state === "overtime") {
      s.present += 1;
      s.overtimeDays += 1;
    } else {
      s[c.state] += 1;
    }
    if (c.record) {
      s.workedMinutes += c.record.workedMinutes;
      s.overtimeMinutes += c.record.overtimeMinutes;
      if (c.record.late) s.lateDays += 1;
    }
  }

  s.payableDays = s.present + s.half_day * 0.5 + s.holiday + s.weekend + s.leave;
  s.reconciles =
    s.present + s.half_day + s.absent + s.leave + s.holiday + s.weekend + s.not_marked;
  return s;
}

/* -------------------------------------------------------------- series */

export interface HoursPoint extends Record<string, string | number> {
  date: string;
  label: string;
  hours: number;
  overtime: number;
}

/** Hours worked per day over the last `days` days — the /attendance trend. */
export function hoursSeries(code: string, days = 30): HoursPoint[] {
  return attendanceFor(code)
    .slice(-days)
    .map((d) => ({
      date: d.date,
      label: format(parseISO(d.date), "dd MMM"),
      hours: Math.round((d.workedMinutes / 60) * 10) / 10,
      overtime: Math.round((d.overtimeMinutes / 60) * 10) / 10,
    }));
}

/* ------------------------------------------------------------ team board */

export type FinalisationStatus = "pending" | "approved" | "locked";

export interface TeamDayRow {
  code: string;
  name: string;
  designation: string;
  departmentId: string;
  department: string;
  branchId: string;
  branch: string;
  managerCode: string | null;
  manager: string;
  state: DayState;
  firstIn: string | null;
  lastOut: string | null;
  workedMinutes: number;
  overtimeMinutes: number;
  lateByMinutes: number;
  late: boolean;
  inProgress: boolean;
  shiftLabel: string;
  approval: FinalisationStatus;
  exception: string | null;
}

function buildTeamDayBoard(): TeamDayRow[] {
  const rng = mulberry32(556677);
  const rows: TeamDayRow[] = [];
  for (const code of ATTENDANCE_CODES) {
    const emp = employeeByCode(code);
    const rec = attendanceOn(code, DEMO_TODAY);
    if (!emp || !rec) continue;
    const branch = branchById(emp.branchId);
    const exception =
      rec.state === "absent"
        ? "No punch recorded against an open working day"
        : rec.late
          ? `Arrived ${rec.lateByMinutes} min past the ${rec.shiftLabel.slice(0, 5)} threshold`
          : rec.overtimeMinutes > 0
            ? "Overtime hours need manager sign-off"
            : null;
    rows.push({
      code,
      name: emp.name,
      designation: emp.designation,
      departmentId: emp.departmentId,
      department: deptName(emp.departmentId),
      branchId: emp.branchId,
      branch: branch?.city ?? emp.location,
      managerCode: emp.managerCode,
      manager: employeeByCode(emp.managerCode ?? "")?.name ?? "—",
      state: rec.state,
      firstIn: rec.firstIn,
      lastOut: rec.lastOut,
      workedMinutes: rec.workedMinutes,
      overtimeMinutes: rec.overtimeMinutes,
      lateByMinutes: rec.lateByMinutes,
      late: rec.late,
      inProgress: rec.inProgress,
      shiftLabel: rec.shiftLabel,
      approval: exception ? "pending" : rng() > 0.22 ? "approved" : "pending",
      exception,
    });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export const TEAM_DAY_BOARD: TeamDayRow[] = buildTeamDayBoard();

export const TEAM_DAY_TOTALS = (() => {
  const t = {
    total: TEAM_DAY_BOARD.length,
    present: 0,
    late: 0,
    absent: 0,
    leave: 0,
    half_day: 0,
    overtime: 0,
    pending: 0,
  };
  for (const r of TEAM_DAY_BOARD) {
    if (r.state === "present" || r.state === "overtime") t.present += 1;
    if (r.state === "overtime") t.overtime += 1;
    if (r.state === "absent") t.absent += 1;
    if (r.state === "leave") t.leave += 1;
    if (r.state === "half_day") t.half_day += 1;
    if (r.late) t.late += 1;
    if (r.approval === "pending") t.pending += 1;
  }
  return t;
})();

/* On-time vs late vs absent by department over the last 30 days. */
export interface DeptPunctualityRow extends Record<string, string | number> {
  department: string;
  onTime: number;
  late: number;
  absent: number;
}

export const DEPT_PUNCTUALITY_30D: DeptPunctualityRow[] = (() => {
  const window = new Set(WINDOW_DATES.slice(-30));
  const acc = new Map<string, DeptPunctualityRow>();
  for (const code of ATTENDANCE_CODES) {
    const emp = employeeByCode(code);
    if (!emp) continue;
    const key = deptName(emp.departmentId);
    if (!acc.has(key)) acc.set(key, { department: key, onTime: 0, late: 0, absent: 0 });
    const row = acc.get(key)!;
    for (const d of attendanceFor(code)) {
      if (!window.has(d.date)) continue;
      if (d.state === "absent") row.absent += 1;
      else if (d.state === "present" || d.state === "overtime" || d.state === "half_day") {
        if (d.late) row.late += 1;
        else row.onTime += 1;
      }
    }
  }
  return [...acc.values()].sort((a, b) => b.onTime + b.late - (a.onTime + a.late));
})();

/* ------------------------------------------------- admin finalisation tab */

export interface FinalisationRow extends Record<string, string | number> {
  date: string;
  label: string;
  headcount: number;
  marked: number;
  exceptions: number;
  overtimeHours: number;
  status: string;
  finalisedBy: string;
}

export const FINALISATION_ROWS: FinalisationRow[] = (() => {
  const rng = mulberry32(881122);
  const codes = ATTENDANCE_CODES;
  return WINDOW_DATES.slice(-14)
    .filter((d) => {
      const dow = parseISO(d).getDay();
      return dow !== 0 && dow !== 6;
    })
    .reverse()
    .map((date, i) => {
      let marked = 0;
      let exceptions = 0;
      let otMinutes = 0;
      for (const c of codes) {
        const rec = attendanceOn(c, date);
        if (!rec) continue;
        if (rec.state !== "absent") marked += 1;
        if (rec.state === "absent" || rec.late) exceptions += 1;
        otMinutes += rec.overtimeMinutes;
      }
      const status = i === 0 ? "pending" : i <= 2 ? "approved" : "locked";
      return {
        date,
        label: format(parseISO(date), "EEE, dd MMM yyyy"),
        headcount: codes.length,
        marked,
        exceptions,
        overtimeHours: Math.round(otMinutes / 6) / 10,
        status,
        finalisedBy: status === "pending" ? "—" : pick(rng, ["Priya Menon", "Vikram Shah", "Girish Gowda"]),
      };
    });
})();

/* ----------------------------------------------------- overtime report tab */

export interface OvertimeRow extends Record<string, string | number> {
  code: string;
  name: string;
  department: string;
  branch: string;
  otDays: number;
  otHours: number;
  avgDailyHours: number;
  lateDays: number;
  status: string;
}

export const OVERTIME_REPORT_30D: OvertimeRow[] = (() => {
  const window = new Set(WINDOW_DATES.slice(-30));
  const rng = mulberry32(445566);
  const rows: OvertimeRow[] = [];
  for (const code of ATTENDANCE_CODES) {
    const emp = employeeByCode(code);
    if (!emp) continue;
    let otMinutes = 0;
    let otDays = 0;
    let lateDays = 0;
    let worked = 0;
    let workedDays = 0;
    for (const d of attendanceFor(code)) {
      if (!window.has(d.date)) continue;
      if (d.overtimeMinutes > 0) {
        otMinutes += d.overtimeMinutes;
        otDays += 1;
      }
      if (d.late) lateDays += 1;
      if (d.workedMinutes > 0) {
        worked += d.workedMinutes;
        workedDays += 1;
      }
    }
    if (otDays === 0) continue;
    rows.push({
      code,
      name: emp.name,
      department: deptName(emp.departmentId),
      branch: branchById(emp.branchId)?.city ?? emp.location,
      otDays,
      otHours: Math.round(otMinutes / 6) / 10,
      avgDailyHours: workedDays ? Math.round((worked / workedDays / 6)) / 10 : 0,
      lateDays,
      status: otMinutes / 60 > 18 ? "pending" : rng() > 0.5 ? "approved" : "pending",
    });
  }
  return rows.sort((a, b) => b.otHours - a.otHours);
})();

/* ------------------------------------------------------------- amendments */

export type AmendmentType = "missed_punch_in" | "missed_punch_out" | "correction" | "manual_entry";

export const AMENDMENT_TYPES: { value: AmendmentType; label: string; help: string }[] = [
  {
    value: "missed_punch_in",
    label: "Missed punch-in",
    help: "The morning swipe is missing but the out-punch exists.",
  },
  {
    value: "missed_punch_out",
    label: "Missed punch-out",
    help: "The in-punch exists but the day was never closed.",
  },
  {
    value: "correction",
    label: "Correction",
    help: "Both punches exist but one of the times is wrong.",
  },
  {
    value: "manual_entry",
    label: "Manual entry",
    help: "No punch at all — client site, offsite or a device outage.",
  },
];

export const amendmentTypeLabel = (t: AmendmentType) =>
  AMENDMENT_TYPES.find((x) => x.value === t)?.label ?? t;

export type AmendmentStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "sent_back"
  | "cancelled";

export interface AmendmentEvent {
  at: string;
  actor: string;
  action: string;
  status: AmendmentStatus | "submitted";
  note?: string;
}

export interface AmendmentAttachment {
  name: string;
  sizeKb: number;
}

export interface Amendment {
  id: string;
  code: string;
  employeeName: string;
  department: string;
  type: AmendmentType;
  date: string;
  originalIn: string | null;
  originalOut: string | null;
  proposedIn: string | null;
  proposedOut: string | null;
  reason: string;
  status: AmendmentStatus;
  raisedAt: string;
  approverCode: string | null;
  approver: string;
  attachments: AmendmentAttachment[];
  timeline: AmendmentEvent[];
}

const AMENDMENT_REASONS = [
  "Client escalation call with the Mumbai team ran past midnight; the reader at Gate 2 was already shut down.",
  "Biometric reader at Gate 2 was offline during the morning rush — security logged me in the visitor register instead.",
  "Travelled straight to the customer site in Whitefield for the UAT sign-off, so there is no office punch.",
  "Worked out of the Pune Delivery Centre for the sprint review; my badge is not mapped to that reader.",
  "Power outage at Prestige Tech Park — the turnstile was on manual release the whole morning.",
  "Forgot to punch out after the Friday release window; the deployment finished at 21:40.",
  "On-call incident PD-4471 at 02:10, worked remotely from home until the service recovered.",
  "Attended the campus hiring drive at RV College on behalf of the team, per Priya's request.",
  "Left early for a scheduled appointment at Manipal Hospital; informed my manager the previous day.",
  "Network switch replacement in the L4 wing — the door controller never synced my punch.",
  "Company offsite at Nandi Hills; attendance was captured on the printed sign-in sheet.",
  "Half day taken for the Deepavali advance travel to Mangaluru, second half applied as Casual Leave.",
];

const DECISION_NOTES: Record<string, string[]> = {
  approved: [
    "Verified against the deployment log — approving.",
    "Security register confirms the entry. Approved.",
    "Confirmed with the client call recording. Approved.",
  ],
  rejected: [
    "Raised 11 days after the event; the regularisation window is 7 days.",
    "No supporting evidence and the swipe log shows no activity that day.",
  ],
  sent_back: [
    "Please attach the on-call rota page and resubmit.",
    "The proposed out-time is before the in-time — correct it and send it back.",
  ],
};

function buildAmendments(): Amendment[] {
  const out: Amendment[] = [];
  const owners = Array.from(new Set([...PERSONA_CODES, ...ATTENDANCE_SUBSET.slice(0, 12)]));

  owners.forEach((code, ownerIdx) => {
    const emp = employeeByCode(code);
    if (!emp) return;
    const rng = mulberry32(31_000 + ownerIdx * 977);
    const approverCode = emp.managerCode;
    const approver = employeeByCode(approverCode ?? "")?.name ?? "Priya Menon";
    const count = randInt(rng, 5, 9);
    const used = new Set<string>();

    for (let i = 0; i < count; i++) {
      /* Pick a working day out of the window that actually has a record. */
      let date = WINDOW_DATES[randInt(rng, 5, WINDOW_DATES.length - 2)];
      let guard = 0;
      while (guard++ < 30) {
        const rec = attendanceOn(code, date);
        if (rec && rec.state !== "weekend" && rec.state !== "holiday" && !used.has(date)) break;
        date = WINDOW_DATES[randInt(rng, 5, WINDOW_DATES.length - 2)];
      }
      used.add(date);

      const rec = attendanceOn(code, date);
      const type = pick(rng, AMENDMENT_TYPES).value;
      const statusRoll = rng();
      const status: AmendmentStatus =
        i === 0
          ? "pending"
          : statusRoll < 0.34
            ? "approved"
            : statusRoll < 0.54
              ? "pending"
              : statusRoll < 0.68
                ? "sent_back"
                : statusRoll < 0.8
                  ? "rejected"
                  : statusRoll < 0.9
                    ? "draft"
                    : "cancelled";

      const proposedIn =
        type === "missed_punch_out"
          ? (rec?.firstIn ?? at(date, 570))
          : at(date, 555 + randInt(rng, 0, 25));
      const proposedOut =
        type === "missed_punch_in"
          ? (rec?.lastOut ?? at(date, 1110))
          : at(date, 1105 + randInt(rng, 0, 120));

      const raisedAt = at(WINDOW_DATES[Math.min(WINDOW_DATES.length - 1, WINDOW_DATES.indexOf(date) + randInt(rng, 1, 3))], 540 + randInt(rng, 0, 300));

      const timeline: AmendmentEvent[] = [];
      if (status === "draft") {
        timeline.push({
          at: raisedAt,
          actor: emp.name,
          action: "Saved as draft",
          status: "draft",
        });
      } else {
        timeline.push({
          at: raisedAt,
          actor: emp.name,
          action: "Raised regularisation request",
          status: "submitted",
        });
        timeline.push({
          at: at(date, 0).replace("T00:00:00", "T10:05:00"),
          actor: "Workflow engine",
          action: `Routed to ${approver} for approval`,
          status: "pending",
        });
        if (status === "approved" || status === "rejected" || status === "sent_back") {
          timeline.push({
            at: at(
              WINDOW_DATES[
                Math.min(WINDOW_DATES.length - 1, WINDOW_DATES.indexOf(date) + randInt(rng, 2, 5))
              ],
              600 + randInt(rng, 0, 360),
            ),
            actor: approver,
            action:
              status === "approved"
                ? "Approved the regularisation"
                : status === "rejected"
                  ? "Rejected the regularisation"
                  : "Sent the request back for more detail",
            status,
            note: pick(rng, DECISION_NOTES[status]),
          });
        }
        if (status === "cancelled") {
          timeline.push({
            at: at(
              WINDOW_DATES[
                Math.min(WINDOW_DATES.length - 1, WINDOW_DATES.indexOf(date) + 2)
              ],
              660,
            ),
            actor: emp.name,
            action: "Withdrew the request",
            status: "cancelled",
            note: "Raised on the wrong date — a fresh request has been filed.",
          });
        }
      }

      const attach = rng();
      out.push({
        id: `REG-${String(1400 + out.length).padStart(4, "0")}`,
        code,
        employeeName: emp.name,
        department: deptName(emp.departmentId),
        type,
        date,
        originalIn: type === "missed_punch_in" || type === "manual_entry" ? null : (rec?.firstIn ?? null),
        originalOut: type === "missed_punch_out" || type === "manual_entry" ? null : (rec?.lastOut ?? null),
        proposedIn,
        proposedOut,
        reason: pick(rng, AMENDMENT_REASONS),
        status,
        raisedAt,
        approverCode,
        approver,
        attachments:
          attach > 0.62
            ? [
                {
                  name: pick(rng, [
                    "gate-register-scan.pdf",
                    "oncall-rota-sep.png",
                    "client-call-invite.eml",
                    "site-visit-approval.pdf",
                  ]),
                  sizeKb: randInt(rng, 84, 1840),
                },
              ]
            : [],
        timeline,
      });
    }
  });

  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export const AMENDMENTS: Amendment[] = buildAmendments();

export const amendmentsFor = (code: string) => {
  const resolved = AMENDMENTS.some((a) => a.code === code) ? code : "STL-0142";
  return AMENDMENTS.filter((a) => a.code === resolved);
};

export const amendmentsForApprover = (code: string) =>
  AMENDMENTS.filter((a) => a.approverCode === code && a.status === "pending");

export const canEditAmendment = (s: AmendmentStatus) => s === "draft" || s === "sent_back";
export const canCancelAmendment = (s: AmendmentStatus) =>
  s === "draft" || s === "pending" || s === "sent_back";

/* ------------------------------------------------- work context resolution */

export interface ResolutionStep {
  key: string;
  label: string;
  source: string;
  value: string;
  detail: string;
  status: "ok" | "failed" | "skipped";
}

export interface WorkContextResolution {
  code: string;
  name: string;
  ok: boolean;
  httpStatus: 200 | 422;
  errorCode?: string;
  errorMessage?: string;
  remediation?: string;
  steps: ResolutionStep[];
}

/** employee -> branch -> country -> calendar -> shift -> bands, fail-closed. */
export function resolveWorkContext(code: string): WorkContextResolution {
  const emp = employeeByCode(code);
  if (!emp) {
    return {
      code,
      name: code,
      ok: false,
      httpStatus: 422,
      errorCode: "EMPLOYEE_NOT_FOUND",
      errorMessage: `No employee record for ${code}.`,
      remediation: "Pick an employee from the directory.",
      steps: [],
    };
  }

  const branch = branchById(emp.branchId);
  const country = branch?.country ?? null;
  const steps: ResolutionStep[] = [
    {
      key: "employee",
      label: "Employee",
      source: "Employee master",
      value: `${emp.name} · ${emp.code}`,
      detail: `${emp.designation}, ${deptName(emp.departmentId)} · joined ${format(parseISO(emp.joiningDate), "dd MMM yyyy")}`,
      status: "ok",
    },
    {
      key: "branch",
      label: "Branch",
      source: "Branch master",
      value: branch ? `${branch.name} (${branch.id})` : "— none —",
      detail: branch ? branch.address : "The employee is not assigned to a branch.",
      status: branch ? "ok" : "failed",
    },
  ];

  if (!branch) {
    return failClosed(emp, steps, [
      "country",
      "calendar",
      "shift",
      "bands",
    ], "BRANCH_NOT_ASSIGNED", `${emp.name} has no branch on the employee record.`, "Assign a branch on the employee's Job & Org tab.");
  }

  steps.push({
    key: "country",
    label: "Country",
    source: "Branch › country mapping",
    value: country ? `${country} · ${branch.countryName}` : "— not set —",
    detail: country
      ? `Statutory and calendar rules resolve from the ${branch.countryName} country pack.`
      : `Branch ${branch.id} has no country mapped, so no country pack can be selected.`,
    status: country ? "ok" : "failed",
  });

  if (!country) {
    return failClosed(
      emp,
      steps,
      ["calendar", "shift", "bands"],
      "WORK_CONTEXT_UNRESOLVED",
      `Branch ${branch.id} (${branch.name}) has no country mapped.`,
      `Set a country on ${branch.name} in Admin › Tenant Settings, then re-run the resolver. Attendance for the ${branch.headcount} employees on this branch stays unprocessed until then.`,
    );
  }

  const cal =
    WORK_CALENDARS.find((c) => c.countryId === country && c.isDefault) ??
    WORK_CALENDARS.find((c) => c.countryId === country)!;
  const cfg = settingsForCountry(country as CountryId);

  steps.push({
    key: "calendar",
    label: "Work calendar",
    source: "Work calendars",
    value: `${cal.name} (${cal.id})`,
    detail: `${cal.week.filter((d) => d === "working").length} working days/week · ${cal.holidayCount} holidays · FY starts ${format(parseISO(`2026-${String(cal.fyStartMonth).padStart(2, "0")}-01`), "MMMM")} · ${cal.timezone}`,
    status: "ok",
  });
  steps.push({
    key: "shift",
    label: "Shift",
    source: cfg.configured ? "Country attendance settings" : "Tenant defaults (no country override)",
    value: `${cfg.shiftName} · ${cfg.shiftStart} – ${cfg.shiftEnd}`,
    detail: `Late threshold ${cfg.lateThreshold} with a ${cfg.graceMinutes}-minute grace · ${cfg.breakMinutes}-minute unpaid break`,
    status: "ok",
  });
  steps.push({
    key: "bands",
    label: "Minute bands",
    source: cfg.configured ? "Country attendance settings" : "Tenant defaults (no country override)",
    value: `${cfg.bands.halfDay} / ${cfg.bands.fullDay} / ${cfg.bands.overtime} min`,
    detail: `Half day at ${cfg.bands.halfDay / 60}h, full day at ${cfg.bands.fullDay / 60}h, overtime past ${cfg.bands.overtime / 60}h.`,
    status: "ok",
  });

  return { code: emp.code, name: emp.name, ok: true, httpStatus: 200, steps };
}

function failClosed(
  emp: Employee,
  steps: ResolutionStep[],
  skip: string[],
  errorCode: string,
  errorMessage: string,
  remediation: string,
): WorkContextResolution {
  const labels: Record<string, string> = {
    country: "Country",
    calendar: "Work calendar",
    shift: "Shift",
    bands: "Minute bands",
  };
  for (const key of skip) {
    steps.push({
      key,
      label: labels[key] ?? key,
      source: "—",
      value: "— not evaluated —",
      detail: "Skipped: the resolver stops at the first failure and never guesses a default.",
      status: "skipped",
    });
  }
  return {
    code: emp.code,
    name: emp.name,
    ok: false,
    httpStatus: 422,
    errorCode,
    errorMessage,
    remediation,
    steps,
  };
}

/** Employees on the deliberately mis-configured Hyderabad branch. */
export const UNMAPPED_BRANCH_EMPLOYEES = EMPLOYEES.filter((e) => e.branchId === "HYD");

/** A short, sensible picker list for the diagnostic panel. */
export const DIAGNOSTIC_EMPLOYEES = (() => {
  const picks = [
    ...PERSONA_CODES.map((c) => employeeByCode(c)).filter(Boolean),
    ...EMPLOYEES.filter((e) => e.branchId === "EWR").slice(0, 3),
    ...UNMAPPED_BRANCH_EMPLOYEES,
  ] as Employee[];
  const seen = new Set<string>();
  return picks.filter((e) => (seen.has(e.code) ? false : (seen.add(e.code), true)));
})();

export const BRANCH_COUNTRY_COVERAGE = BRANCHES.map((b) => ({
  id: b.id,
  name: b.name,
  city: b.city,
  country: b.country,
  countryName: b.countryName,
  timezone: b.timezone,
  headcount: b.headcount,
  resolves: Boolean(b.country),
}));
