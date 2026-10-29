import {
  addDays,
  differenceInCalendarDays,
  differenceInMonths,
  eachDayOfInterval,
  format,
  isWeekend as dfIsWeekend,
  parseISO,
} from "date-fns";
import { mulberry32, pick, randInt, round2 } from "@/lib/utils";
import { PERSONAS } from "@/lib/rbac";
import {
  BRANCHES,
  DEMO_TODAY,
  DEPARTMENTS,
  GRADES,
  HOLIDAYS,
  branchById,
  deptName,
} from "./org";
import {
  ATTENDANCE_SUBSET,
  EMPLOYEE_BY_CODE,
  VIKRAM_TEAM_CODES,
  employeeByCode,
  employeeName,
  type Employee,
} from "./employees";

/* ============================================================================
   LEAVE fixtures.

   The whole module is derived from ONE source of truth: a per-employee,
   per-type transaction timeline. Balances are summed out of that timeline, so
   the balance card, the ledger tab and the running-balance column can never
   disagree — see verifyLedger(), which throws in dev if they ever do.

     Available = Opening + Accrued − Used + Adjusted + CarryForward
                 − Encashed − Lapsed

   Deterministic throughout: mulberry32 with fixed seeds, no Math.random(),
   no bare new Date() at module scope. "Today" is DEMO_TODAY.
   ========================================================================== */

export const LEAVE_FY = "FY 2026-27";
export const FY_START = "2026-04-01";
export const FY_END = "2027-03-31";

const TODAY = parseISO(DEMO_TODAY);

/* --------------------------------------------------------------- leave types */

export type LeaveTypeCode = "EL" | "CL" | "SL" | "ML" | "PL" | "LOP" | "CO";

export interface LeaveType {
  code: LeaveTypeCode;
  name: string;
  /** Single letter painted in the calendar grid, so a cell never reads by colour alone. */
  letter: string;
  unit: "days";
  paid: boolean;
  /** Days credited per completed month of service. 0 for annually granted types. */
  accrualPerMonth: number;
  annualQuota: number;
  maxCarryForward: number;
  encashable: boolean;
  /** Supporting document mandatory above this many days. null = never asked for. */
  requiresDocAboveDays: number | null;
  creditMode: "accrual" | "annual_grant" | "on_application" | "earned" | "none";
  /** Statutory types are counted in calendar days, not working days. */
  countsCalendarDays: boolean;
  tracksBalance: boolean;
  /** Rendered as a balance card on /leave even when the balance is zero. */
  showOnCards: boolean;
  active: boolean;
  description: string;
}

export const LEAVE_TYPES: LeaveType[] = [
  {
    code: "EL",
    name: "Earned Leave",
    letter: "E",
    unit: "days",
    paid: true,
    accrualPerMonth: 1.75,
    annualQuota: 21,
    maxCarryForward: 30,
    encashable: true,
    requiresDocAboveDays: 5,
    creditMode: "accrual",
    countsCalendarDays: false,
    tracksBalance: true,
    showOnCards: true,
    active: true,
    description: "Accrues 1.75 days for every completed month. Carries forward up to 30 days and is encashable at exit.",
  },
  {
    code: "CL",
    name: "Casual Leave",
    letter: "C",
    unit: "days",
    paid: true,
    accrualPerMonth: 0,
    annualQuota: 12,
    maxCarryForward: 0,
    encashable: false,
    requiresDocAboveDays: 3,
    creditMode: "annual_grant",
    countsCalendarDays: false,
    tracksBalance: true,
    showOnCards: true,
    active: true,
    description: "Granted in full on the first day of the financial year. Lapses at year end — no carry-forward, no encashment.",
  },
  {
    code: "SL",
    name: "Sick Leave",
    letter: "S",
    unit: "days",
    paid: true,
    accrualPerMonth: 0,
    annualQuota: 12,
    maxCarryForward: 0,
    encashable: false,
    requiresDocAboveDays: 2,
    creditMode: "annual_grant",
    countsCalendarDays: false,
    tracksBalance: true,
    showOnCards: true,
    active: true,
    description: "Granted in full on the first day of the financial year. A medical certificate is required beyond 2 days.",
  },
  {
    code: "CO",
    name: "Comp Off",
    letter: "O",
    unit: "days",
    paid: true,
    accrualPerMonth: 0,
    annualQuota: 0,
    maxCarryForward: 0,
    encashable: false,
    requiresDocAboveDays: null,
    creditMode: "earned",
    countsCalendarDays: false,
    tracksBalance: true,
    showOnCards: true,
    active: true,
    description: "Credited when an employee works a weekly off or a holiday. Expires 45 days after it is earned.",
  },
  {
    code: "ML",
    name: "Maternity Leave",
    letter: "M",
    unit: "days",
    paid: true,
    accrualPerMonth: 0,
    annualQuota: 182,
    maxCarryForward: 0,
    encashable: false,
    requiresDocAboveDays: 0,
    creditMode: "on_application",
    countsCalendarDays: true,
    tracksBalance: true,
    showOnCards: false,
    active: true,
    description: "26 weeks under the Maternity Benefit Act. Counted in calendar days and credited when the application is raised.",
  },
  {
    code: "PL",
    name: "Paternity Leave",
    letter: "P",
    unit: "days",
    paid: true,
    accrualPerMonth: 0,
    annualQuota: 10,
    maxCarryForward: 0,
    encashable: false,
    requiresDocAboveDays: 5,
    creditMode: "on_application",
    countsCalendarDays: true,
    tracksBalance: true,
    showOnCards: false,
    active: true,
    description: "10 calendar days, to be availed within six months of the birth. Company policy, not statutory.",
  },
  {
    code: "LOP",
    name: "Loss of Pay",
    letter: "L",
    unit: "days",
    paid: false,
    accrualPerMonth: 0,
    annualQuota: 0,
    maxCarryForward: 0,
    encashable: false,
    requiresDocAboveDays: 3,
    creditMode: "none",
    countsCalendarDays: false,
    tracksBalance: false,
    showOnCards: false,
    active: true,
    description: "Unpaid. Carries no balance — every approved day is deducted from the month's payable days in payroll.",
  },
];

export const LEAVE_TYPE_BY_CODE: Record<string, LeaveType> = Object.fromEntries(
  LEAVE_TYPES.map((t) => [t.code, t]),
);

export const leaveTypeName = (code: string) => LEAVE_TYPE_BY_CODE[code]?.name ?? code;

/* --------------------------------------------------- working-day arithmetic */

export type NonWorkingReason = { kind: "weekend" | "holiday"; label: string };

/** Weekend or a non-optional gazetted holiday for the country. */
export function nonWorkingReason(iso: string, country: "IN" | "US" = "IN"): NonWorkingReason | null {
  const d = parseISO(iso);
  if (dfIsWeekend(d)) return { kind: "weekend", label: format(d, "EEEE") };
  const h = HOLIDAYS.find((x) => x.date === iso && x.country === country && !x.optional);
  return h ? { kind: "holiday", label: h.name } : null;
}

export const isWorkingDay = (iso: string, country: "IN" | "US" = "IN") => !nonWorkingReason(iso, country);

/**
 * Days actually deducted from the balance for a range — weekends and gazetted
 * holidays are excluded, and each flagged half-day removes another 0.5.
 * This is what the apply dialog's live preview is built on.
 */
export function deductibleDays(
  from: string,
  to: string,
  halfDayFirst = false,
  halfDaySecond = false,
  country: "IN" | "US" = "IN",
): number {
  if (!from || !to) return 0;
  const a = parseISO(from);
  const b = parseISO(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return 0;
  const working = eachDayOfInterval({ start: a, end: b }).filter(
    (d) => !nonWorkingReason(format(d, "yyyy-MM-dd"), country),
  );
  let total = working.length;
  if (total === 0) return 0;
  if (total === 1) {
    if (halfDayFirst || halfDaySecond) total -= 0.5;
  } else {
    if (halfDayFirst) total -= 0.5;
    if (halfDaySecond) total -= 0.5;
  }
  return round2(Math.max(0, total));
}

/** The dates inside a range that will NOT be deducted — drives the preview breakdown. */
export function excludedDays(from: string, to: string, country: "IN" | "US" = "IN") {
  if (!from || !to) return [] as { date: string; reason: NonWorkingReason }[];
  const a = parseISO(from);
  const b = parseISO(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return [];
  return eachDayOfInterval({ start: a, end: b })
    .map((d) => format(d, "yyyy-MM-dd"))
    .map((iso) => ({ date: iso, reason: nonWorkingReason(iso, country) }))
    .filter((x): x is { date: string; reason: NonWorkingReason } => x.reason !== null);
}

/** Days debited for a given leave type — statutory types count calendar days. */
export function applicationDays(
  typeCode: string,
  from: string,
  to: string,
  halfDayFirst = false,
  halfDaySecond = false,
  country: "IN" | "US" = "IN",
): number {
  if (!from || !to) return 0;
  const type = LEAVE_TYPE_BY_CODE[typeCode];
  if (type?.countsCalendarDays) {
    const n = differenceInCalendarDays(parseISO(to), parseISO(from)) + 1;
    return n > 0 ? n : 0;
  }
  return deductibleDays(from, to, halfDayFirst, halfDaySecond, country);
}

export const countryOf = (employeeCode: string): "IN" | "US" => {
  const e = employeeByCode(employeeCode);
  return branchById(e?.branchId ?? "BLR")?.country === "US" ? "US" : "IN";
};

/* --------------------------------------------------------------- the cast */

/** Everyone with a full leave history: the 40-employee demo subset + all six personas. */
export const LEAVE_EMPLOYEE_CODES: string[] = (() => {
  const set = new Set<string>([
    ...ATTENDANCE_SUBSET,
    ...VIKRAM_TEAM_CODES,
    ...PERSONAS.map((p) => p.employeeId),
  ]);
  return [...set].filter((c) => EMPLOYEE_BY_CODE.has(c)).sort();
})();

const HERO = "STL-0142"; // Ananya Rao — the employee persona
const KAVYA = "STL-0144"; // named in the seeded notification feed

function seedOf(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/* ------------------------------------------------------------ public shapes */

export type LeaveStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "sent_back"
  | "cancelled"
  | "withdrawn";

export interface LeaveApplication {
  id: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  departmentId: string;
  branchId: string;
  typeCode: LeaveTypeCode;
  typeName: string;
  fromDate: string;
  toDate: string;
  halfDayFirst: boolean;
  halfDaySecond: boolean;
  halfDaySession: "first_half" | "second_half" | null;
  /** Days actually deducted. */
  days: number;
  calendarDays: number;
  /** Weekend / holiday days the range spans but does not deduct. */
  sandwichDays: number;
  reason: string;
  status: LeaveStatus;
  appliedOn: string;
  approverCode: string | null;
  approverName: string;
  decidedOn: string | null;
  decisionComment: string | null;
  documentName: string | null;
  contactNumber: string;
  isBackdated: boolean;
}

export type LedgerKind =
  | "opening"
  | "carry_forward"
  | "accrual"
  | "adjustment"
  | "application"
  | "encashment"
  | "lapse";

export const LEDGER_KIND_LABEL: Record<LedgerKind, string> = {
  opening: "Opening",
  carry_forward: "Carry forward",
  accrual: "Accrual",
  adjustment: "Adjustment",
  application: "Application",
  encashment: "Encashment",
  lapse: "Lapse",
};

export interface LeaveLedgerRow {
  id: string;
  employeeCode: string;
  typeCode: LeaveTypeCode;
  date: string;
  kind: LedgerKind;
  narrative: string;
  credit: number;
  debit: number;
  /** Running balance after this transaction — reconciles to the balance card. */
  balance: number;
  reference: string;
}

export interface LeaveBalance {
  employeeCode: string;
  typeCode: LeaveTypeCode;
  fy: string;
  opening: number;
  accrued: number;
  used: number;
  adjusted: number;
  carryForward: number;
  encashed: number;
  lapsed: number;
  available: number;
  /** Days locked up in applications still awaiting a decision. */
  pending: number;
  annualQuota: number;
}

/* ------------------------------------------------------------- content banks */

const REASONS: Record<LeaveTypeCode, string[]> = {
  EL: [
    "Sister's wedding in Mysuru",
    "Family trip to Coorg planned since March",
    "Annual home visit to Bhubaneswar",
    "House shifting to a new flat in Whitefield",
    "Cousin's engagement in Hyderabad",
    "Gruhapravesham at our new place in Sarjapur",
    "Pre-booked Kerala backwaters holiday",
    "Extended weekend in Gokarna with family",
    "Ooty trip with in-laws, tickets already booked",
    "Elder daughter's school admission formalities",
    "Attending a family function in Chennai",
    "Annual leave — visiting parents in Nagpur",
  ],
  CL: [
    "Passport renewal appointment at PSK Lalbagh",
    "Aadhaar address update at the Seva Kendra",
    "Plumbing emergency at home",
    "Vehicle RC transfer at the RTO",
    "Parent-teacher meeting at school",
    "Home loan documentation at the bank",
    "Car service and insurance renewal",
    "Society AGM — I am on the managing committee",
    "Accompanying my father for a hospital check-up",
    "Property registration at the sub-registrar's office",
  ],
  SL: [
    "Recovering from viral fever",
    "Dengue — doctor has advised five days of bed rest",
    "Food poisoning, on medication since last night",
    "Root canal procedure and recovery",
    "Migraine, doctor advised complete rest",
    "Seasonal flu with high temperature",
    "Post-surgery recovery — appendicitis",
    "Back spasm, physiotherapy advised for two days",
    "Conjunctivitis — advised to stay away from screens",
    "Chikungunya, joint pain has not settled",
  ],
  CO: [
    "Comp off for the Saturday release window",
    "Comp off for the Ganesh Chaturthi on-call shift",
    "Comp off for the weekend data-centre migration",
    "Comp off earned during the Pune office move",
  ],
  ML: ["Maternity leave — 26 weeks under the Maternity Benefit Act"],
  PL: ["Paternity leave — our son was born on the 4th"],
  LOP: [
    "Personal emergency at home, leave balance exhausted",
    "Extending my trip by two days — happy to take this as LOP",
    "Family medical situation in Kolkata, no balance left",
  ],
};

const REJECT_COMMENTS = [
  "Two people from the same pod are already out that week — please reschedule.",
  "Client UAT is running on these dates and I cannot release you.",
  "Sprint demo falls inside this range. Reapply for the following week.",
  "Insufficient balance on the applied dates. Please re-check your ledger.",
];

const SEND_BACK_COMMENTS = [
  "Please attach the medical certificate — SL beyond 2 days needs one.",
  "Handover notes are missing. Add them to the request and resubmit.",
  "Split this into two requests so the month-end close is covered.",
  "Confirm who is covering the on-call rota and resubmit.",
];

const APPROVE_COMMENTS = [
  "Approved. Enjoy the break.",
  "Approved — Karthik will cover the standups.",
  "Approved. Please complete the handover before you leave.",
  null,
  null,
  null,
];

const ADJUSTMENT_NARRATIVES = [
  "HR correction — sandwich-leave days reversed after review",
  "Goodwill credit for the quarter-end weekend support",
  "Correction of a duplicate debit raised in the June run",
  "Recovery of excess credit applied by the April accrual run",
];

/* ---------------------------------------------------------------- the build */

interface TimelineEvent {
  date: string;
  kind: LedgerKind;
  amount: number;
  narrative: string;
  reference: string;
  /** Defaults to Earned Leave when omitted — every other type sets it. */
  typeCode?: LeaveTypeCode;
  app?: LeaveApplication;
  order: number;
}

const KIND_ORDER: Record<LedgerKind, number> = {
  opening: 0,
  carry_forward: 1,
  accrual: 2,
  adjustment: 3,
  application: 4,
  encashment: 5,
  lapse: 6,
};

const CREDIT_KINDS: LedgerKind[] = ["opening", "carry_forward", "accrual"];

/** Accrual rate actually applied, by country — mirrors ACCRUAL_CONFIGS below. */
const EL_RATE: Record<"IN" | "US", number> = { IN: 1.75, US: 1.25 };

/** Months of the FY already credited as on DEMO_TODAY: Apr → Sep 2026. */
const ACCRUAL_MONTHS = ["2026-04-01", "2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01"];

interface Draft {
  typeCode: LeaveTypeCode;
  fromDate: string;
  toDate: string;
  halfDayFirst: boolean;
  halfDaySecond: boolean;
  halfDaySession: "first_half" | "second_half" | null;
  reason: string;
  status: LeaveStatus;
  appliedOn?: string;
  decisionComment?: string | null;
  documentName?: string | null;
}

/* Ananya Rao's history is hand-authored: the employee persona's own screen is
   the one a presenter opens first, so every status must be represented. */
const HERO_DRAFTS: Draft[] = [
  { typeCode: "SL", fromDate: "2026-04-20", toDate: "2026-04-21", halfDayFirst: false, halfDaySecond: false, halfDaySession: null, reason: "Recovering from viral fever", status: "approved" },
  { typeCode: "CL", fromDate: "2026-05-15", toDate: "2026-05-15", halfDayFirst: false, halfDaySecond: false, halfDaySession: null, reason: "Passport renewal appointment at PSK Lalbagh", status: "approved" },
  { typeCode: "EL", fromDate: "2026-06-15", toDate: "2026-06-19", halfDayFirst: false, halfDaySecond: false, halfDaySession: null, reason: "Sister's wedding in Mysuru", status: "approved", documentName: "wedding-invite-mysuru.pdf" },
  { typeCode: "CL", fromDate: "2026-07-06", toDate: "2026-07-06", halfDayFirst: false, halfDaySecond: false, halfDaySession: null, reason: "Car service and insurance renewal", status: "withdrawn" },
  { typeCode: "CL", fromDate: "2026-07-24", toDate: "2026-07-24", halfDayFirst: true, halfDaySecond: false, halfDaySession: "second_half", reason: "Parent-teacher meeting at Greenwood High", status: "approved" },
  { typeCode: "EL", fromDate: "2026-08-03", toDate: "2026-08-04", halfDayFirst: false, halfDaySecond: false, halfDaySession: null, reason: "Extended weekend in Gokarna with family", status: "rejected" },
  { typeCode: "SL", fromDate: "2026-08-11", toDate: "2026-08-12", halfDayFirst: false, halfDaySecond: false, halfDaySession: null, reason: "Dengue — doctor has advised five days of bed rest", status: "approved", documentName: "medical-certificate-11aug.pdf" },
  { typeCode: "EL", fromDate: "2026-09-28", toDate: "2026-10-02", halfDayFirst: false, halfDaySecond: false, halfDaySession: null, reason: "Family trip to Coorg planned since March", status: "pending", documentName: "coorg-booking-confirmation.pdf" },
  { typeCode: "CL", fromDate: "2026-10-12", toDate: "2026-10-13", halfDayFirst: false, halfDaySecond: false, halfDaySession: null, reason: "Cousin's engagement in Hyderabad", status: "sent_back" },
  { typeCode: "EL", fromDate: "2026-11-09", toDate: "2026-11-13", halfDayFirst: false, halfDaySecond: false, halfDaySession: null, reason: "Annual home visit to Bhubaneswar", status: "pending", documentName: "flight-itinerary-nov.pdf" },
];

/* The notification feed already promises this exact request — honour it. */
const KAVYA_DRAFTS: Draft[] = [
  { typeCode: "EL", fromDate: "2026-10-12", toDate: "2026-10-14", halfDayFirst: false, halfDaySecond: false, halfDaySession: null, reason: "Family trip to Coorg planned since March", status: "pending" },
  { typeCode: "SL", fromDate: "2026-06-08", toDate: "2026-06-09", halfDayFirst: false, halfDaySecond: false, halfDaySession: null, reason: "Migraine, doctor advised complete rest", status: "approved" },
  { typeCode: "CL", fromDate: "2026-08-19", toDate: "2026-08-19", halfDayFirst: false, halfDaySecond: false, halfDaySession: null, reason: "Home loan documentation at the bank", status: "approved" },
];

const FORCED_CARRY_FORWARD: Record<string, number> = { [HERO]: 7.5, [KAVYA]: 4 };

function statusForDraft(rng: () => number, fromDate: string): LeaveStatus {
  const future = fromDate > DEMO_TODAY;
  const r = rng();
  if (future) {
    if (r < 0.46) return "pending";
    if (r < 0.84) return "approved";
    if (r < 0.9) return "sent_back";
    if (r < 0.96) return "rejected";
    return "cancelled";
  }
  if (r < 0.79) return "approved";
  if (r < 0.86) return "rejected";
  if (r < 0.92) return "cancelled";
  if (r < 0.97) return "withdrawn";
  return "sent_back";
}

function pickType(rng: () => number): LeaveTypeCode {
  const r = rng();
  if (r < 0.44) return "EL";
  if (r < 0.66) return "CL";
  if (r < 0.88) return "SL";
  if (r < 0.95) return "CO";
  return "LOP";
}

function makeDrafts(emp: Employee, rng: () => number, forcePending: boolean): Draft[] {
  const drafts: Draft[] = [];
  const n = randInt(rng, 1, 4) + (forcePending ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const typeCode = pickType(rng);
    const span = typeCode === "EL" ? randInt(rng, 1, 7) : typeCode === "SL" ? randInt(rng, 0, 3) : randInt(rng, 0, 1);
    // Spread starts across the FY; the last slot is pushed into the future so
    // every manager has something live in the queue.
    const forceFuture = forcePending && i === n - 1;
    const offset = forceFuture ? randInt(rng, 12, 92) : randInt(rng, -160, 60);
    let from = addDays(TODAY, offset);
    if (from < parseISO("2026-04-06")) from = parseISO("2026-04-06");
    if (from > parseISO("2027-02-20")) from = parseISO("2027-02-20");
    let fromDate = format(from, "yyyy-MM-dd");
    let toDate = format(addDays(from, span), "yyyy-MM-dd");
    // Never open a request on a day nobody works.
    let guard = 0;
    while (applicationDays(typeCode, fromDate, toDate) === 0 && guard++ < 6) {
      from = addDays(from, 1);
      fromDate = format(from, "yyyy-MM-dd");
      toDate = format(addDays(from, span), "yyyy-MM-dd");
    }
    const half = typeCode !== "EL" && span === 0 && rng() < 0.22;
    drafts.push({
      typeCode,
      fromDate,
      toDate,
      halfDayFirst: half,
      halfDaySecond: false,
      halfDaySession: half ? (rng() < 0.5 ? "first_half" : "second_half") : null,
      reason: pick(rng, REASONS[typeCode]),
      status: forceFuture ? "pending" : statusForDraft(rng, fromDate),
    });
  }
  return drafts;
}

interface BuildResult {
  applications: LeaveApplication[];
  ledger: LeaveLedgerRow[];
  balances: LeaveBalance[];
}

function build(): BuildResult {
  const applications: LeaveApplication[] = [];
  const events: (TimelineEvent & { employeeCode: string; typeCode: LeaveTypeCode })[] = [];

  /* One female and one male employee outside the hero cast get the statutory
     long-leave cases, so Maternity and Paternity are visible somewhere. */
  const reserved = new Set([HERO, KAVYA, ...PERSONAS.map((p) => p.employeeId)]);
  const mlCode = LEAVE_EMPLOYEE_CODES.find(
    (c) => !reserved.has(c) && employeeByCode(c)?.gender === "Female",
  );
  const plCode = LEAVE_EMPLOYEE_CODES.find(
    (c) => !reserved.has(c) && c !== mlCode && employeeByCode(c)?.gender === "Male",
  );

  for (const code of LEAVE_EMPLOYEE_CODES) {
    const emp = employeeByCode(code)!;
    const country = countryOf(code);
    const rng = mulberry32(seedOf(code));
    const joined = parseISO(emp.joiningDate);
    const joinedBeforeFy = emp.joiningDate < FY_START;

    /* ---------------------------------------------------- credit events */
    const own: TimelineEvent[] = [];

    // Carry-forward from FY 2025-26, capped by the EL policy.
    const cf = joinedBeforeFy
      ? (FORCED_CARRY_FORWARD[code] ?? Math.min(30, randInt(rng, 0, 24) * 1.25))
      : 0;
    if (cf > 0) {
      own.push({
        date: FY_START,
        kind: "carry_forward",
        amount: round2(cf),
        narrative: "Earned Leave carried forward from FY 2025-26 (cap 30 days)",
        reference: "YE-IN-2025-26",
        order: KIND_ORDER.carry_forward,
      });
    }

    // Annual grants: CL and SL, prorated for mid-year joiners.
    const monthsLeft = joinedBeforeFy
      ? 12
      : Math.max(1, 12 - Math.max(0, differenceInMonths(joined, parseISO(FY_START))));
    for (const t of ["CL", "SL"] as const) {
      const quota = LEAVE_TYPE_BY_CODE[t].annualQuota;
      const grant = joinedBeforeFy ? quota : Math.round((quota * monthsLeft) / 12 / 0.5) * 0.5;
      own.push({
        date: joinedBeforeFy ? FY_START : emp.joiningDate,
        kind: "opening",
        amount: round2(grant),
        typeCode: t,
        narrative: `${LEAVE_TYPE_BY_CODE[t].name} entitlement credited for ${LEAVE_FY}${joinedBeforeFy ? "" : " (prorated from date of joining)"}`,
        reference: `GRANT-${country}-2026-27`,
        order: KIND_ORDER.opening,
      });
    }

    // Monthly Earned Leave accrual.
    for (const m of ACCRUAL_MONTHS) {
      if (m < emp.joiningDate) continue;
      own.push({
        date: m,
        kind: "accrual",
        amount: EL_RATE[country],
        narrative: `Monthly accrual for ${format(parseISO(m), "MMMM yyyy")} — ${EL_RATE[country]} days`,
        reference: `ACR-${country}-${format(parseISO(m), "yyyy-MM")}`,
        order: KIND_ORDER.accrual,
      });
    }

    // Comp off earned on weekend releases.
    const coCount = randInt(rng, 0, 3);
    for (let i = 0; i < coCount; i++) {
      const d = format(addDays(parseISO("2026-05-04"), randInt(rng, 0, 112) * 1), "yyyy-MM-dd");
      own.push({
        date: d,
        kind: "accrual",
        amount: rng() < 0.25 ? 0.5 : 1,
        typeCode: "CO",
        narrative: pick(rng, REASONS.CO),
        reference: `CO-${format(parseISO(d), "yyyyMMdd")}`,
        order: KIND_ORDER.accrual,
      });
    }

    // HR adjustment.
    if (rng() < 0.2) {
      const negative = rng() < 0.35;
      own.push({
        date: format(addDays(parseISO("2026-05-20"), randInt(rng, 0, 90)), "yyyy-MM-dd"),
        kind: "adjustment",
        amount: (negative ? -1 : 1) * pick(rng, [0.5, 1, 1.5, 2]),
        narrative: pick(rng, ADJUSTMENT_NARRATIVES),
        reference: `ADJ-${code.replace("STL-", "")}`,
        order: KIND_ORDER.adjustment,
      });
    }

    // Earned Leave encashment window, processed with the July payroll.
    if (joinedBeforeFy && rng() < 0.22) {
      own.push({
        date: "2026-07-31",
        kind: "encashment",
        amount: 5,
        narrative: "Encashment of 5 Earned Leave days, paid with the July 2026 pay run",
        reference: "ENC-2026-07",
        order: KIND_ORDER.encashment,
      });
    }

    // Comp off expiry sweep.
    if (coCount > 0 && rng() < 0.4) {
      own.push({
        date: "2026-09-10",
        kind: "lapse",
        amount: 1,
        typeCode: "CO",
        narrative: "Comp off lapsed — not availed within 45 days of being earned",
        reference: "LAPSE-CO-2026-09",
        order: KIND_ORDER.lapse,
      });
    }

    /* --------------------------------------------------- application drafts */
    let drafts: Draft[];
    if (code === HERO) drafts = HERO_DRAFTS;
    else if (code === KAVYA) drafts = KAVYA_DRAFTS;
    else drafts = makeDrafts(emp, rng, VIKRAM_TEAM_CODES.includes(code) || rng() < 0.35);

    if (code === mlCode) {
      drafts = [
        ...drafts.filter((d) => d.fromDate < "2026-07-06"),
        {
          typeCode: "ML",
          fromDate: "2026-07-06",
          toDate: format(addDays(parseISO("2026-07-06"), 181), "yyyy-MM-dd"),
          halfDayFirst: false,
          halfDaySecond: false,
          halfDaySession: null,
          reason: REASONS.ML[0],
          status: "approved",
          documentName: "form-b-maternity-declaration.pdf",
        },
      ];
    }
    if (code === plCode) {
      drafts = [
        ...drafts,
        {
          typeCode: "PL",
          fromDate: "2026-08-05",
          toDate: "2026-08-14",
          halfDayFirst: false,
          halfDaySecond: false,
          halfDaySession: null,
          reason: REASONS.PL[0],
          status: "approved",
          documentName: "birth-certificate.pdf",
        },
      ];
    }

    /* ------------------------------------------- materialise the timeline */
    const typeOf = (e: TimelineEvent): LeaveTypeCode => e.typeCode ?? "EL";

    const byType = new Map<LeaveTypeCode, TimelineEvent[]>();
    const push = (t: LeaveTypeCode, e: TimelineEvent) => {
      if (!byType.has(t)) byType.set(t, []);
      byType.get(t)!.push(e);
    };
    for (const e of own) push(typeOf(e), e);

    const appObjects: LeaveApplication[] = [];
    for (const d of drafts) {
      const type = LEAVE_TYPE_BY_CODE[d.typeCode];
      const app = finaliseApplication(emp, d, rng, country);
      appObjects.push(app);
      if (!type.tracksBalance) continue;
      if (type.creditMode === "on_application") {
        push(d.typeCode, {
          date: format(addDays(parseISO(d.fromDate), -1), "yyyy-MM-dd"),
          kind: "opening",
          amount: type.annualQuota,
          narrative: `${type.name} entitlement of ${type.annualQuota} calendar days credited on application`,
          reference: `ENT-${d.typeCode}-2026`,
          order: KIND_ORDER.opening,
        });
      }
      if (d.status !== "approved") continue;
      push(d.typeCode, {
        date: d.fromDate,
        kind: "application",
        amount: app.days,
        narrative: `${type.name} — ${format(parseISO(app.fromDate), "dd MMM")} to ${format(parseISO(app.toDate), "dd MMM yyyy")}`,
        reference: "",
        app,
        order: KIND_ORDER.application,
      });
    }

    /* Walk each type's timeline in date order and keep the running balance
       non-negative: an application that does not fit is shrunk, and if even
       half a day will not fit it is refused outright. */
    for (const [typeCode, list] of byType) {
      list.sort((a, b) => (a.date === b.date ? a.order - b.order : a.date < b.date ? -1 : 1));
      let bal = 0;
      for (const e of list) {
        if (CREDIT_KINDS.includes(e.kind)) {
          bal = round2(bal + e.amount);
          events.push({ ...e, employeeCode: code, typeCode });
          continue;
        }
        if (e.kind === "adjustment") {
          if (e.amount < 0 && bal + e.amount < 0) continue;
          bal = round2(bal + e.amount);
          events.push({ ...e, employeeCode: code, typeCode });
          continue;
        }
        if (e.kind === "encashment" || e.kind === "lapse") {
          const cap = e.kind === "encashment" ? e.amount + 3 : e.amount;
          if (bal < cap) continue;
          bal = round2(bal - e.amount);
          events.push({ ...e, employeeCode: code, typeCode });
          continue;
        }
        // application
        const app = e.app!;
        if (bal < 0.5) {
          app.status = app.fromDate > DEMO_TODAY ? "pending" : "rejected";
          app.decisionComment =
            app.status === "rejected"
              ? "Insufficient balance on the applied dates. Please re-check your ledger."
              : null;
          app.decidedOn = app.status === "rejected" ? app.appliedOn : null;
          continue;
        }
        if (app.days > bal) shrinkApplication(app, bal, country);
        bal = round2(bal - app.days);
        events.push({
          ...e,
          amount: app.days,
          narrative: `${LEAVE_TYPE_BY_CODE[typeCode].name} — ${format(parseISO(app.fromDate), "dd MMM")} to ${format(parseISO(app.toDate), "dd MMM yyyy")}`,
          employeeCode: code,
          typeCode,
        });
      }
    }

    applications.push(...appObjects);
  }

  /* ----------------------------------------------- ids, ledger, balances */
  applications.sort((a, b) =>
    a.appliedOn === b.appliedOn
      ? a.employeeCode.localeCompare(b.employeeCode)
      : a.appliedOn < b.appliedOn
        ? -1
        : 1,
  );
  applications.forEach((a, i) => {
    a.id = `LV-2026-${String(i + 1).padStart(4, "0")}`;
  });

  events.sort((a, b) =>
    a.employeeCode !== b.employeeCode
      ? a.employeeCode.localeCompare(b.employeeCode)
      : a.typeCode !== b.typeCode
        ? a.typeCode.localeCompare(b.typeCode)
        : a.date === b.date
          ? a.order - b.order
          : a.date < b.date
            ? -1
            : 1,
  );

  const ledger: LeaveLedgerRow[] = [];
  const running = new Map<string, number>();
  let seq = 0;
  for (const e of events) {
    const key = `${e.employeeCode}|${e.typeCode}`;
    const credit = e.kind === "adjustment" ? Math.max(0, e.amount) : CREDIT_KINDS.includes(e.kind) ? e.amount : 0;
    const debit = e.kind === "adjustment" ? Math.max(0, -e.amount) : CREDIT_KINDS.includes(e.kind) ? 0 : e.amount;
    const bal = round2((running.get(key) ?? 0) + credit - debit);
    running.set(key, bal);
    ledger.push({
      id: `LGR-${String(++seq).padStart(5, "0")}`,
      employeeCode: e.employeeCode,
      typeCode: e.typeCode,
      date: e.date,
      kind: e.kind,
      narrative: e.narrative,
      credit: round2(credit),
      debit: round2(debit),
      balance: bal,
      reference: e.app ? e.app.id : e.reference,
    });
  }

  const pendingDays = new Map<string, number>();
  for (const a of applications) {
    if (a.status !== "pending") continue;
    const key = `${a.employeeCode}|${a.typeCode}`;
    pendingDays.set(key, round2((pendingDays.get(key) ?? 0) + a.days));
  }

  const balances: LeaveBalance[] = [];
  const grouped = new Map<string, LeaveLedgerRow[]>();
  for (const r of ledger) {
    const key = `${r.employeeCode}|${r.typeCode}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }
  for (const [key, rows] of grouped) {
    const [employeeCode, typeCode] = key.split("|") as [string, LeaveTypeCode];
    const totalOf = (kind: LedgerKind, field: "credit" | "debit") =>
      round2(rows.filter((r) => r.kind === kind).reduce((a, r) => a + r[field], 0));
    const opening = totalOf("opening", "credit");
    const carryForward = totalOf("carry_forward", "credit");
    const accrued = totalOf("accrual", "credit");
    const adjusted = round2(totalOf("adjustment", "credit") - totalOf("adjustment", "debit"));
    const used = totalOf("application", "debit");
    const encashed = totalOf("encashment", "debit");
    const lapsed = totalOf("lapse", "debit");
    balances.push({
      employeeCode,
      typeCode,
      fy: LEAVE_FY,
      opening,
      accrued,
      used,
      adjusted,
      carryForward,
      encashed,
      lapsed,
      available: round2(opening + accrued - used + adjusted + carryForward - encashed - lapsed),
      pending: pendingDays.get(key) ?? 0,
      annualQuota: LEAVE_TYPE_BY_CODE[typeCode].annualQuota,
    });
  }
  balances.sort((a, b) =>
    a.employeeCode === b.employeeCode
      ? LEAVE_TYPES.findIndex((t) => t.code === a.typeCode) - LEAVE_TYPES.findIndex((t) => t.code === b.typeCode)
      : a.employeeCode.localeCompare(b.employeeCode),
  );

  return { applications, ledger, balances };
}

function shrinkApplication(app: LeaveApplication, cap: number, country: "IN" | "US") {
  let to = parseISO(app.toDate);
  const from = parseISO(app.fromDate);
  while (app.days > cap && to > from) {
    to = addDays(to, -1);
    app.toDate = format(to, "yyyy-MM-dd");
    app.days = applicationDays(app.typeCode, app.fromDate, app.toDate, app.halfDayFirst, app.halfDaySecond, country);
  }
  if (app.days > cap) {
    app.halfDayFirst = true;
    app.halfDaySession = "second_half";
    app.days = applicationDays(app.typeCode, app.fromDate, app.toDate, true, false, country);
  }
  app.calendarDays = differenceInCalendarDays(parseISO(app.toDate), parseISO(app.fromDate)) + 1;
  app.sandwichDays = round2(Math.max(0, app.calendarDays - app.days));
}

function finaliseApplication(
  emp: Employee,
  d: Draft,
  rng: () => number,
  country: "IN" | "US",
): LeaveApplication {
  const type = LEAVE_TYPE_BY_CODE[d.typeCode];
  const days = applicationDays(d.typeCode, d.fromDate, d.toDate, d.halfDayFirst, d.halfDaySecond, country);
  const calendarDays = differenceInCalendarDays(parseISO(d.toDate), parseISO(d.fromDate)) + 1;
  const notice = d.typeCode === "SL" || d.typeCode === "LOP" ? randInt(rng, -1, 0) : randInt(rng, 2, 21);
  /* Nobody applies in the future: a far-ahead leave was applied 0–3 days before
     DEMO_TODAY (a stable per-record offset, so the rng stream is untouched). */
  const proposed = d.appliedOn ?? format(addDays(parseISO(d.fromDate), -notice), "yyyy-MM-dd");
  const offset = [0, 0, 1, 1, 1, 2, 3][(Number(emp.code.replace(/\D/g, "")) + Number(d.fromDate.slice(8, 10))) % 7];
  const appliedOn =
    proposed > DEMO_TODAY ? format(addDays(TODAY, -offset), "yyyy-MM-dd") : proposed;
  const decidedRaw =
    d.status === "pending"
      ? null
      : format(addDays(parseISO(appliedOn), randInt(rng, 0, 3)), "yyyy-MM-dd");
  const decided = decidedRaw && decidedRaw > DEMO_TODAY ? DEMO_TODAY : decidedRaw;
  const comment =
    d.decisionComment !== undefined
      ? d.decisionComment
      : d.status === "rejected"
        ? pick(rng, REJECT_COMMENTS)
        : d.status === "sent_back"
          ? pick(rng, SEND_BACK_COMMENTS)
          : d.status === "approved"
            ? pick(rng, APPROVE_COMMENTS)
            : d.status === "withdrawn"
              ? "Withdrawn by the applicant before a decision was taken."
              : d.status === "cancelled"
                ? "Cancelled — the plan changed."
                : null;
  const needsDoc = type.requiresDocAboveDays !== null && days > type.requiresDocAboveDays;
  const approverCode = emp.managerCode ?? "STL-0001";

  return {
    id: "",
    employeeCode: emp.code,
    employeeName: emp.name,
    department: deptName(emp.departmentId),
    departmentId: emp.departmentId,
    branchId: emp.branchId,
    typeCode: d.typeCode,
    typeName: type.name,
    fromDate: d.fromDate,
    toDate: d.toDate,
    halfDayFirst: d.halfDayFirst,
    halfDaySecond: d.halfDaySecond,
    halfDaySession: d.halfDaySession,
    days,
    calendarDays,
    sandwichDays: round2(Math.max(0, calendarDays - days)),
    reason: d.reason,
    status: d.status,
    appliedOn,
    approverCode,
    approverName: employeeName(approverCode),
    decidedOn: decided,
    decisionComment: comment,
    documentName:
      d.documentName !== undefined
        ? d.documentName
        : needsDoc
          ? `${d.typeCode.toLowerCase()}-supporting-document.pdf`
          : null,
    contactNumber: emp.phone,
    isBackdated: appliedOn > d.fromDate,
  };
}

const BUILT = build();

export const LEAVE_APPLICATIONS: LeaveApplication[] = BUILT.applications;
export const LEAVE_LEDGER: LeaveLedgerRow[] = BUILT.ledger;
export const LEAVE_BALANCES: LeaveBalance[] = BUILT.balances;

/* -------------------------------------------------------------- the auditor */

/**
 * The demo dies the moment someone adds up a column and it is wrong, so every
 * balance row is re-derived from its own ledger and checked. Throws in dev.
 */
export function verifyLedger(): { ok: true; balances: number; transactions: number } {
  const lastByKey = new Map<string, LeaveLedgerRow>();
  for (const r of LEAVE_LEDGER) lastByKey.set(`${r.employeeCode}|${r.typeCode}`, r);

  for (const b of LEAVE_BALANCES) {
    const expected = round2(
      b.opening + b.accrued - b.used + b.adjusted + b.carryForward - b.encashed - b.lapsed,
    );
    if (expected !== b.available) {
      throw new Error(
        `[mock/leave] ${b.employeeCode}/${b.typeCode}: Available ${b.available} ≠ ` +
          `Opening ${b.opening} + Accrued ${b.accrued} − Used ${b.used} + Adjusted ${b.adjusted} ` +
          `+ CarryForward ${b.carryForward} − Encashed ${b.encashed} − Lapsed ${b.lapsed} = ${expected}`,
      );
    }
    if (b.available < 0) {
      throw new Error(`[mock/leave] ${b.employeeCode}/${b.typeCode}: negative balance ${b.available}`);
    }
    const last = lastByKey.get(`${b.employeeCode}|${b.typeCode}`);
    if (!last || last.balance !== b.available) {
      throw new Error(
        `[mock/leave] ${b.employeeCode}/${b.typeCode}: ledger closes at ${last?.balance ?? "—"} ` +
          `but the balance card says ${b.available}`,
      );
    }
  }

  // The running-balance column must be a true cumulative of credit − debit.
  const walk = new Map<string, number>();
  for (const r of LEAVE_LEDGER) {
    const key = `${r.employeeCode}|${r.typeCode}`;
    const bal = round2((walk.get(key) ?? 0) + r.credit - r.debit);
    walk.set(key, bal);
    if (bal !== r.balance) {
      throw new Error(
        `[mock/leave] ${r.id} (${r.employeeCode}/${r.typeCode}): running balance ${r.balance} ≠ ${bal}`,
      );
    }
  }

  return { ok: true, balances: LEAVE_BALANCES.length, transactions: LEAVE_LEDGER.length };
}

if (process.env.NODE_ENV !== "production") verifyLedger();

/* ------------------------------------------------------------- selectors */

export const balancesFor = (employeeCode: string) =>
  LEAVE_BALANCES.filter((b) => b.employeeCode === employeeCode);

export const balanceFor = (employeeCode: string, typeCode: string) =>
  LEAVE_BALANCES.find((b) => b.employeeCode === employeeCode && b.typeCode === typeCode);

export const ledgerFor = (employeeCode: string, typeCode?: string) =>
  LEAVE_LEDGER.filter(
    (r) => r.employeeCode === employeeCode && (!typeCode || typeCode === "all" || r.typeCode === typeCode),
  );

export const applicationsFor = (employeeCode: string) =>
  LEAVE_APPLICATIONS.filter((a) => a.employeeCode === employeeCode).sort((a, b) =>
    a.fromDate < b.fromDate ? 1 : -1,
  );

export const applicationsForApprover = (approverCode: string) =>
  LEAVE_APPLICATIONS.filter((a) => a.approverCode === approverCode);

/** Leave taken by type this FY, ready for the donut. */
export function takenByType(employeeCode: string) {
  const out = new Map<string, number>();
  for (const a of LEAVE_APPLICATIONS) {
    if (a.employeeCode !== employeeCode || a.status !== "approved") continue;
    out.set(a.typeName, round2((out.get(a.typeName) ?? 0) + a.days));
  }
  return [...out.entries()].map(([name, value]) => ({ name, value }));
}

/* ------------------------------------------------------- calendar day map */

export interface CalendarMark {
  typeCode: LeaveTypeCode;
  letter: string;
  status: LeaveStatus;
  half: boolean;
  applicationId: string;
  reason: string;
}

const DAY_MARKS: Map<string, CalendarMark> = (() => {
  const map = new Map<string, CalendarMark>();
  for (const a of LEAVE_APPLICATIONS) {
    if (a.status !== "approved" && a.status !== "pending") continue;
    const type = LEAVE_TYPE_BY_CODE[a.typeCode];
    const country = countryOf(a.employeeCode);
    for (const d of eachDayOfInterval({ start: parseISO(a.fromDate), end: parseISO(a.toDate) })) {
      const iso = format(d, "yyyy-MM-dd");
      if (!type.countsCalendarDays && nonWorkingReason(iso, country)) continue;
      const half =
        (a.halfDayFirst && iso === a.fromDate) || (a.halfDaySecond && iso === a.toDate);
      // An approved day always wins over a pending one.
      const existing = map.get(`${a.employeeCode}|${iso}`);
      if (existing && existing.status === "approved" && a.status !== "approved") continue;
      map.set(`${a.employeeCode}|${iso}`, {
        typeCode: a.typeCode,
        letter: type.letter,
        status: a.status,
        half,
        applicationId: a.id,
        reason: a.reason,
      });
    }
  }
  return map;
})();

export const leaveMarkOn = (employeeCode: string, iso: string) =>
  DAY_MARKS.get(`${employeeCode}|${iso}`) ?? null;

/* ------------------------------------------------------------ run ledger */

export type LeaveRunType = "accrual" | "year_end";

export interface LeaveRun {
  id: string;
  runType: LeaveRunType;
  country: "IN" | "US";
  periodLabel: string;
  runDate: string;
  status: "completed" | "failed" | "running" | "scheduled";
  employeesProcessed: number;
  daysCredited: number;
  daysLapsed: number;
  daysCarriedForward: number;
  daysEncashed: number;
  triggeredBy: string;
  durationSeconds: number;
  note: string;
}

const IN_HEADCOUNT = BRANCHES.filter((b) => b.country === "IN").reduce((a, b) => a + b.headcount, 0);
const US_HEADCOUNT = BRANCHES.filter((b) => b.country === "US").reduce((a, b) => a + b.headcount, 0);

export const LEAVE_RUNS: LeaveRun[] = (() => {
  const rng = mulberry32(90126);
  const runs: LeaveRun[] = [];

  // Year-end close for FY 2025-26.
  runs.push({
    id: "YE-IN-2025-26",
    runType: "year_end",
    country: "IN",
    periodLabel: "FY 2025-26",
    runDate: "2026-03-31",
    status: "completed",
    employeesProcessed: IN_HEADCOUNT,
    daysCredited: 0,
    daysLapsed: 1204,
    daysCarriedForward: 4186.5,
    daysEncashed: 892.5,
    triggeredBy: "Priya Menon",
    durationSeconds: 184,
    note: "Earned Leave carried forward up to the 30-day cap; Casual and Sick Leave lapsed as per policy.",
  });
  runs.push({
    id: "YE-US-2025-26",
    runType: "year_end",
    country: "US",
    periodLabel: "CY 2025",
    runDate: "2025-12-31",
    status: "completed",
    employeesProcessed: US_HEADCOUNT,
    daysCredited: 0,
    daysLapsed: 46,
    daysCarriedForward: 158,
    daysEncashed: 0,
    triggeredBy: "Priya Menon",
    durationSeconds: 41,
    note: "Newark runs a Jan–Dec year. PTO carry-forward capped at 5 days; no encashment in the US policy.",
  });

  const months = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
  for (const m of months) {
    const label = format(parseISO(`${m}-01`), "MMMM yyyy");
    const inSkipped = randInt(rng, 2, 9);
    runs.push({
      id: `ACR-IN-${m}`,
      runType: "accrual",
      country: "IN",
      periodLabel: label,
      runDate: `${m}-01`,
      status: "completed",
      employeesProcessed: IN_HEADCOUNT - inSkipped,
      daysCredited: round2((IN_HEADCOUNT - inSkipped) * EL_RATE.IN),
      daysLapsed: 0,
      daysCarriedForward: 0,
      daysEncashed: 0,
      triggeredBy: "Scheduler (03:00 IST)",
      durationSeconds: randInt(rng, 38, 96),
      note: `${inSkipped} employees skipped — still inside the 3-month waiting period.`,
    });
    const failed = m === "2026-07";
    runs.push({
      id: `ACR-US-${m}`,
      runType: "accrual",
      country: "US",
      periodLabel: label,
      runDate: `${m}-01`,
      status: failed ? "failed" : "completed",
      employeesProcessed: failed ? 0 : US_HEADCOUNT - randInt(rng, 0, 2),
      daysCredited: failed ? 0 : round2(US_HEADCOUNT * EL_RATE.US),
      daysLapsed: 0,
      daysCarriedForward: 0,
      daysEncashed: 0,
      triggeredBy: "Scheduler (03:00 ET)",
      durationSeconds: failed ? 3 : randInt(rng, 6, 18),
      note: failed
        ? "Aborted — 3 Newark employees have no work calendar mapped. Fix the calendar and re-run."
        : "No exceptions.",
    });
  }

  runs.push({
    id: "ACR-IN-2026-10",
    runType: "accrual",
    country: "IN",
    periodLabel: "October 2026",
    runDate: "2026-10-01",
    status: "scheduled",
    employeesProcessed: 0,
    daysCredited: 0,
    daysLapsed: 0,
    daysCarriedForward: 0,
    daysEncashed: 0,
    triggeredBy: "Scheduler (03:00 IST)",
    durationSeconds: 0,
    note: "Next scheduled accrual. Run it early from this screen if payroll needs the balances sooner.",
  });

  return runs.sort((a, b) => (a.runDate === b.runDate ? a.id.localeCompare(b.id) : a.runDate < b.runDate ? 1 : -1));
})();

/* -------------------------------------------------------- accrual configs */

export interface AccrualConfig {
  id: string;
  name: string;
  typeCode: LeaveTypeCode;
  country: "IN" | "US" | null;
  branchId: string | null;
  departmentId: string | null;
  gradeId: string | null;
  employmentType: "Full-time" | "Contract" | "Intern" | null;
  ratePerPeriod: number;
  frequency: "Monthly" | "Quarterly" | "Annual";
  creditOn: "First day of period" | "Last day of period";
  prorateOnJoining: boolean;
  roundTo: 0.25 | 0.5 | 1;
  waitingPeriodMonths: number;
  priority: number;
  active: boolean;
}

export const ACCRUAL_CONFIGS: AccrualConfig[] = [
  { id: "AC-001", name: "India · Earned Leave · default", typeCode: "EL", country: "IN", branchId: null, departmentId: null, gradeId: null, employmentType: null, ratePerPeriod: 1.75, frequency: "Monthly", creditOn: "First day of period", prorateOnJoining: true, roundTo: 0.5, waitingPeriodMonths: 3, priority: 10, active: true },
  { id: "AC-002", name: "India · Earned Leave · G5 and above", typeCode: "EL", country: "IN", branchId: null, departmentId: null, gradeId: "G5", employmentType: null, ratePerPeriod: 2.25, frequency: "Monthly", creditOn: "First day of period", prorateOnJoining: true, roundTo: 0.5, waitingPeriodMonths: 0, priority: 40, active: true },
  { id: "AC-003", name: "India · Earned Leave · contractors", typeCode: "EL", country: "IN", branchId: null, departmentId: null, gradeId: null, employmentType: "Contract", ratePerPeriod: 1, frequency: "Monthly", creditOn: "Last day of period", prorateOnJoining: false, roundTo: 1, waitingPeriodMonths: 6, priority: 60, active: true },
  { id: "AC-004", name: "US · PTO · Newark", typeCode: "EL", country: "US", branchId: "EWR", departmentId: null, gradeId: null, employmentType: null, ratePerPeriod: 1.25, frequency: "Monthly", creditOn: "First day of period", prorateOnJoining: true, roundTo: 0.25, waitingPeriodMonths: 1, priority: 50, active: true },
  { id: "AC-005", name: "India · Casual Leave · annual grant", typeCode: "CL", country: "IN", branchId: null, departmentId: null, gradeId: null, employmentType: null, ratePerPeriod: 12, frequency: "Annual", creditOn: "First day of period", prorateOnJoining: true, roundTo: 0.5, waitingPeriodMonths: 0, priority: 10, active: true },
  { id: "AC-006", name: "India · Sick Leave · annual grant", typeCode: "SL", country: "IN", branchId: null, departmentId: null, gradeId: null, employmentType: null, ratePerPeriod: 12, frequency: "Annual", creditOn: "First day of period", prorateOnJoining: true, roundTo: 0.5, waitingPeriodMonths: 0, priority: 10, active: true },
  { id: "AC-007", name: "US · Sick Leave · Newark statutory", typeCode: "SL", country: "US", branchId: "EWR", departmentId: null, gradeId: null, employmentType: null, ratePerPeriod: 40, frequency: "Annual", creditOn: "First day of period", prorateOnJoining: true, roundTo: 1, waitingPeriodMonths: 0, priority: 50, active: true },
  { id: "AC-008", name: "India · Engineering on-call · extra EL", typeCode: "EL", country: "IN", branchId: null, departmentId: "ENG", gradeId: null, employmentType: null, ratePerPeriod: 0.25, frequency: "Monthly", creditOn: "Last day of period", prorateOnJoining: false, roundTo: 0.25, waitingPeriodMonths: 12, priority: 30, active: false },
];

export interface ResolutionStep {
  label: string;
  detail: string;
  outcome: "pass" | "narrow" | "fail";
}

export interface AccrualResolution {
  steps: ResolutionStep[];
  config: AccrualConfig | null;
  employee: Employee | null;
}

/** "Which config resolves for this employee, and why" — step by step. */
export function resolveAccrualConfig(employeeCode: string, typeCode: LeaveTypeCode): AccrualResolution {
  const steps: ResolutionStep[] = [];
  const emp = employeeByCode(employeeCode);
  if (!emp) {
    steps.push({ label: "Employee", detail: `No employee found for ${employeeCode}.`, outcome: "fail" });
    return { steps, config: null, employee: null };
  }
  steps.push({
    label: "1 · Employee",
    detail: `${emp.name} (${emp.code}) · ${deptName(emp.departmentId)} · ${emp.employmentType} · ${GRADES.find((g) => g.id === emp.gradeId)?.label ?? emp.gradeId}`,
    outcome: "pass",
  });

  const branch = branchById(emp.branchId);
  if (!branch?.country) {
    steps.push({
      label: "2 · Branch → country",
      detail: `${branch?.name ?? emp.branchId} has no country mapped. Resolution fails closed — no accrual is credited.`,
      outcome: "fail",
    });
    return { steps, config: null, employee: emp };
  }
  const country = branch.country as "IN" | "US";
  steps.push({
    label: "2 · Branch → country",
    detail: `${branch.name} (${branch.id}) → ${country} · ${branch.timezone}`,
    outcome: "pass",
  });

  let pool = ACCRUAL_CONFIGS.filter((c) => c.typeCode === typeCode);
  steps.push({
    label: "3 · Configs for this leave type",
    detail: `${pool.length} config${pool.length === 1 ? "" : "s"} defined for ${leaveTypeName(typeCode)}.`,
    outcome: "pass",
  });

  pool = pool.filter((c) => c.active);
  steps.push({
    label: "4 · Drop inactive configs",
    detail: `${pool.length} remain${pool.length === 1 ? "s" : ""} after removing configs switched off by HR.`,
    outcome: "narrow",
  });

  pool = pool.filter((c) => c.country === null || c.country === country);
  steps.push({
    label: `5 · Match country = ${country}`,
    detail: pool.length ? `${pool.length} remain: ${pool.map((c) => c.id).join(", ")}` : "Nothing matches.",
    outcome: pool.length ? "narrow" : "fail",
  });

  pool = pool.filter((c) => c.branchId === null || c.branchId === emp.branchId);
  pool = pool.filter((c) => c.departmentId === null || c.departmentId === emp.departmentId);
  pool = pool.filter((c) => c.gradeId === null || c.gradeId === emp.gradeId);
  pool = pool.filter((c) => c.employmentType === null || c.employmentType === emp.employmentType);
  steps.push({
    label: "6 · Match branch, department, grade and employment type",
    detail: pool.length
      ? `${pool.length} candidate${pool.length === 1 ? "" : "s"}: ${pool.map((c) => `${c.id} (priority ${c.priority})`).join(", ")}`
      : "No config matches this employee's scope.",
    outcome: pool.length ? "narrow" : "fail",
  });

  if (!pool.length) {
    steps.push({
      label: "7 · Result",
      detail: "Fail-closed: no accrual is credited until a matching config exists.",
      outcome: "fail",
    });
    return { steps, config: null, employee: emp };
  }

  const winner = [...pool].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))[0];
  steps.push({
    label: "7 · Highest priority wins",
    detail: `${winner.id} — ${winner.name} (priority ${winner.priority}) beats ${pool.length - 1} other candidate${pool.length - 1 === 1 ? "" : "s"}.`,
    outcome: "pass",
  });

  const months = differenceInMonths(TODAY, parseISO(emp.joiningDate));
  const served = months >= winner.waitingPeriodMonths;
  steps.push({
    label: "8 · Waiting period",
    detail: `Joined ${format(parseISO(emp.joiningDate), "dd MMM yyyy")} — ${months} months of service vs a ${winner.waitingPeriodMonths}-month waiting period. Accrual is ${served ? "active" : "on hold"}.`,
    outcome: served ? "pass" : "fail",
  });
  steps.push({
    label: "9 · Resolved rate",
    detail: `${winner.ratePerPeriod} days ${winner.frequency.toLowerCase()}, credited on the ${winner.creditOn.toLowerCase()}, rounded to ${winner.roundTo}, ${winner.prorateOnJoining ? "prorated" : "not prorated"} in the joining month.`,
    outcome: "pass",
  });

  return { steps, config: winner, employee: emp };
}

/* ------------------------------------------------------------- dry runs */

export interface AccrualPreviewRow {
  employeeCode: string;
  employeeName: string;
  department: string;
  typeCode: LeaveTypeCode;
  currentBalance: number;
  change: number;
  newBalance: number;
  note: string;
}

/** What the next monthly accrual would do — the DRY RUN preview. */
export function dryRunAccrual(country: "IN" | "US", periodLabel: string): AccrualPreviewRow[] {
  const rows: AccrualPreviewRow[] = [];
  for (const code of LEAVE_EMPLOYEE_CODES) {
    if (countryOf(code) !== country) continue;
    const emp = employeeByCode(code)!;
    const res = resolveAccrualConfig(code, "EL");
    const bal = balanceFor(code, "EL");
    if (!bal) continue;
    const blocked = res.steps.some((s) => s.outcome === "fail");
    const change = blocked ? 0 : (res.config?.ratePerPeriod ?? 0);
    rows.push({
      employeeCode: code,
      employeeName: emp.name,
      department: deptName(emp.departmentId),
      typeCode: "EL",
      currentBalance: bal.available,
      change,
      newBalance: round2(bal.available + change),
      note: blocked
        ? "Skipped — still inside the waiting period"
        : `${res.config?.id} · ${periodLabel}`,
    });
  }
  return rows.sort((a, b) => a.employeeCode.localeCompare(b.employeeCode));
}

export interface YearEndPreviewRow {
  employeeCode: string;
  employeeName: string;
  department: string;
  closing: number;
  carryForward: number;
  encashed: number;
  lapsed: number;
  note: string;
}

/** What closing FY 2026-27 would do to every Earned Leave balance. */
export function dryRunYearEnd(country: "IN" | "US"): YearEndPreviewRow[] {
  const cap = LEAVE_TYPE_BY_CODE.EL.maxCarryForward;
  const encashCap = 15;
  const rows: YearEndPreviewRow[] = [];
  for (const code of LEAVE_EMPLOYEE_CODES) {
    if (countryOf(code) !== country) continue;
    const bal = balanceFor(code, "EL");
    if (!bal) continue;
    const emp = employeeByCode(code)!;
    const carryForward = Math.min(bal.available, cap);
    const excess = round2(bal.available - carryForward);
    const encashed = country === "US" ? 0 : Math.min(excess, encashCap);
    const lapsed = round2(excess - encashed);
    rows.push({
      employeeCode: code,
      employeeName: emp.name,
      department: deptName(emp.departmentId),
      closing: bal.available,
      carryForward: round2(carryForward),
      encashed: round2(encashed),
      lapsed,
      note:
        lapsed > 0
          ? `${lapsed} days above the ${cap}-day cap and the ${encashCap}-day encashment limit will lapse`
          : encashed > 0
            ? `${encashed} days above the ${cap}-day cap will be encashed with the March pay run`
            : "Within the carry-forward cap — nothing lapses",
    });
  }
  return rows.sort((a, b) => b.lapsed - a.lapsed || a.employeeCode.localeCompare(b.employeeCode));
}

/* -------------------------------------------------------- policy rule set */

export type PolicyValue = number | boolean | string;

export interface LeavePolicyRule {
  id: string;
  label: string;
  group: "Eligibility" | "Application" | "Balance" | "Approval";
  kind: "number" | "toggle" | "select" | "text";
  value: PolicyValue;
  unit?: string;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  explanation: string;
}

/** The 13 rules that govern every leave decision in the tenant. */
export const LEAVE_POLICY_RULES: LeavePolicyRule[] = [
  {
    id: "min_notice_days",
    label: "Minimum notice",
    group: "Application",
    kind: "number",
    value: 3,
    unit: "days",
    min: 0,
    max: 30,
    step: 1,
    explanation:
      "Earned Leave must be applied for at least 3 calendar days before the first day of leave. Sick Leave is exempt and can be applied for on the day itself.",
  },
  {
    id: "max_consecutive_days",
    label: "Maximum consecutive days",
    group: "Application",
    kind: "number",
    value: 15,
    unit: "days",
    min: 1,
    max: 180,
    step: 1,
    explanation:
      "A single request cannot exceed 15 working days. Anything longer has to be split, which forces a second approval and a fresh handover note.",
  },
  {
    id: "negative_balance_allowed",
    label: "Allow negative balance",
    group: "Balance",
    kind: "toggle",
    value: false,
    explanation:
      "When off, an employee cannot apply for more days than they hold. When on, the shortfall is booked against next month's accrual instead of Loss of Pay.",
  },
  {
    id: "sandwich_counting",
    label: "Sandwich-leave counting",
    group: "Balance",
    kind: "select",
    value: "Exclude weekends and holidays",
    options: [
      "Exclude weekends and holidays",
      "Count weekends that fall between leave days",
      "Count only when both sides are leave",
    ],
    explanation:
      "Decides whether a Friday-and-Monday absence also costs the Saturday and Sunday in between. Stellar excludes them, so a Fri–Mon request deducts 2 days, not 4.",
  },
  {
    id: "encashment_cap_days",
    label: "Encashment cap",
    group: "Balance",
    kind: "number",
    value: 15,
    unit: "days",
    min: 0,
    max: 60,
    step: 1,
    explanation:
      "The most Earned Leave an employee can encash in one financial year. Anything above the carry-forward cap and this limit lapses at year end.",
  },
  {
    id: "carry_forward_cap_days",
    label: "Carry-forward cap",
    group: "Balance",
    kind: "number",
    value: 30,
    unit: "days",
    min: 0,
    max: 90,
    step: 1,
    explanation:
      "Earned Leave above 30 days does not survive the year-end run. Casual and Sick Leave never carry forward, whatever this is set to.",
  },
  {
    id: "probation_eligibility",
    label: "Eligibility during probation",
    group: "Eligibility",
    kind: "select",
    value: "Sick and Casual Leave only",
    options: ["Not eligible for any leave", "Sick and Casual Leave only", "Fully eligible"],
    explanation:
      "Employees inside the 6-month probation window can apply for Sick and Casual Leave. Earned Leave still accrues but cannot be availed until confirmation.",
  },
  {
    id: "backdated_window_days",
    label: "Backdated application window",
    group: "Application",
    kind: "number",
    value: 7,
    unit: "days",
    min: 0,
    max: 60,
    step: 1,
    explanation:
      "A leave day can be applied for up to 7 days after the fact. Beyond that only HR can regularise it, and the action is written to the audit log.",
  },
  {
    id: "half_day_allowed",
    label: "Allow half-day leave",
    group: "Application",
    kind: "toggle",
    value: true,
    explanation:
      "Lets an employee mark the first or the second half of a day. Half days are deducted as 0.5 and are not available on Maternity or Paternity leave.",
  },
  {
    id: "document_threshold_days",
    label: "Document threshold",
    group: "Application",
    kind: "number",
    value: 3,
    unit: "days",
    min: 0,
    max: 30,
    step: 1,
    explanation:
      "Above 3 days the apply form demands a supporting document before it will submit. Sick Leave overrides this with its own 2-day medical-certificate rule.",
  },
  {
    id: "approval_levels",
    label: "Approval levels",
    group: "Approval",
    kind: "select",
    value: "2 — reporting manager, then HR",
    options: [
      "1 — reporting manager only",
      "2 — reporting manager, then HR",
      "3 — manager, skip-level, then HR",
    ],
    explanation:
      "How many people must say yes. Level 2 means HR sees the request only after the reporting manager has approved it.",
  },
  {
    id: "auto_approve_below_days",
    label: "Auto-approve below",
    group: "Approval",
    kind: "number",
    value: 0.5,
    unit: "days",
    min: 0,
    max: 3,
    step: 0.5,
    explanation:
      "Requests at or below this size skip the queue and are approved on submission. Set to 0 to send every request to a human.",
  },
  {
    id: "blackout_periods",
    label: "Blackout periods",
    group: "Eligibility",
    kind: "text",
    value: "26 Mar – 07 Apr, 24 Dec – 31 Dec",
    explanation:
      "Date windows where leave is refused outright — year-end close and the December freeze. HR can still override with a written reason.",
  },
];

/* ---------------------------------------------------------------- headline */

export const LEAVE_STATS = (() => {
  const pending = LEAVE_APPLICATIONS.filter((a) => a.status === "pending");
  const approved = LEAVE_APPLICATIONS.filter((a) => a.status === "approved");
  const onLeaveToday = LEAVE_EMPLOYEE_CODES.filter((c) => leaveMarkOn(c, DEMO_TODAY)?.status === "approved");
  return {
    employees: LEAVE_EMPLOYEE_CODES.length,
    applications: LEAVE_APPLICATIONS.length,
    pending: pending.length,
    pendingDays: round2(pending.reduce((a, b) => a + b.days, 0)),
    approved: approved.length,
    daysTakenFy: round2(approved.reduce((a, b) => a + b.days, 0)),
    onLeaveToday: onLeaveToday.length,
    transactions: LEAVE_LEDGER.length,
  };
})();

/** Department options for the filter rows on the calendar and approvals queues. */
export const LEAVE_DEPARTMENT_OPTIONS = DEPARTMENTS.filter((d) =>
  LEAVE_EMPLOYEE_CODES.some((c) => employeeByCode(c)?.departmentId === d.id),
).map((d) => ({ value: d.id, label: d.name }));
