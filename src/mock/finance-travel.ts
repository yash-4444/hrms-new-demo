import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { mulberry32, sum } from "@/lib/utils";
import { DEMO_TODAY, deptName } from "./org";
import { EMPLOYEES } from "./employees";
import { TRAVEL_ADVANCE_SUMMARY, TRAVEL_REQUESTS, type TravelMode, type TravelRequest } from "./workplace";

/* ============================================================================
   W5 fixtures — travel desk and travel advances.

   Everything is derived from TRAVEL_REQUESTS in `./workplace`: the desk queue
   is one row per approved leg plus a hotel stay per trip, and the advances
   ledger is one row per request that asked for an advance. Its outstanding
   column therefore sums to TRAVEL_ADVANCE_SUMMARY.outstanding by construction.
   Advances carried over from trips closed before this quarter are kept in a
   separate, clearly labelled list so they never distort that reconciliation.
   ========================================================================== */

const TODAY = parseISO(DEMO_TODAY);
const isoDate = (d: Date) => format(d, "yyyy-MM-dd");
const daysUntil = (iso: string) => differenceInCalendarDays(parseISO(iso), TODAY);

/* ------------------------------------------------------------ travel desk */

export type TravelDeskKind = TravelMode | "Hotel";
export type TravelDeskStage = "booking_pending" | "booked" | "completed";

export interface TravelDeskItem {
  id: string;
  requestNo: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  purpose: string;
  kind: TravelDeskKind;
  /** "Bengaluru → Mumbai" or "Hotel · Mumbai, 2 nights". */
  description: string;
  travelDate: string;
  carrier: string;
  vendor: string | null;
  bookingRef: string | null;
  estimate: number;
  actual: number | null;
  voucher: string | null;
  stage: TravelDeskStage;
  /** Days from DEMO_TODAY to travel; negative once travelled. */
  daysToTravel: number;
}

export const TRAVEL_DESK_VENDORS: Record<"transport" | "Hotel", string[]> = {
  transport: [
    "MakeMyTrip Corporate",
    "Cleartrip for Business",
    "Yatra Corporate",
    "IRCTC Corporate",
    "Savaari Corporate Cabs",
  ],
  Hotel: ["Taj Hotels", "ITC Hotels", "Lemon Tree Hotels", "Marriott Bonvoy Business", "MakeMyTrip Corporate"],
};

const DEFAULT_VENDOR: Record<TravelMode, string> = {
  Flight: "MakeMyTrip Corporate",
  Train: "IRCTC Corporate",
  Cab: "Savaari Corporate Cabs",
  Bus: "Cleartrip for Business",
};

const METRO = new Set(["Mumbai", "Delhi", "Gurugram", "Chennai", "Hyderabad", "Bengaluru", "Pune", "Kolkata"]);

/** Nightly hotel cap by city tier — matches the Accommodation policy (₹6,500 metro). */
export const TRAVEL_DESK_HOTEL_RATE = { metro: 6500, nonMetro: 4500, international: 14500 } as const;

function hotelRate(city: string, tripType: TravelRequest["tripType"]) {
  if (tripType === "International") return TRAVEL_DESK_HOTEL_RATE.international;
  return METRO.has(city) ? TRAVEL_DESK_HOTEL_RATE.metro : TRAVEL_DESK_HOTEL_RATE.nonMetro;
}

const HOTEL_VENDOR = (city: string) =>
  city === "Newark NJ" ? "Marriott Bonvoy Business" : METRO.has(city) ? "Taj Hotels" : "Lemon Tree Hotels";

function buildDesk(): TravelDeskItem[] {
  const rng = mulberry32(2611);
  const varied = (estimate: number) => Math.round((estimate * (0.9 + rng() * 0.22)) / 50) * 50;
  const out: TravelDeskItem[] = [];

  for (const t of TRAVEL_REQUESTS) {
    if (t.status !== "approved" && t.status !== "completed") continue;
    const travelled = t.status === "completed";
    const base = {
      requestNo: t.requestNo,
      employeeCode: t.employeeCode,
      employeeName: t.employeeName,
      department: t.department,
      purpose: t.purpose,
    };

    for (const leg of t.legs) {
      const days = daysUntil(leg.departDate);
      /* Tickets are issued by the agency at booking; the voucher PDF lands on
         the desk later. Far-out trips are still waiting for it. */
      const voucherIn = travelled || days < 6;
      out.push({
        ...base,
        id: leg.id,
        kind: leg.mode,
        description: `${leg.from} → ${leg.to}`,
        travelDate: leg.departDate,
        carrier: leg.carrier,
        vendor: DEFAULT_VENDOR[leg.mode],
        bookingRef: leg.bookingRef,
        estimate: leg.estimatedCost,
        actual: varied(leg.estimatedCost),
        voucher: voucherIn ? `${leg.bookingRef ?? leg.id}-e-ticket.pdf` : null,
        stage: travelled ? "completed" : "booked",
        daysToTravel: days,
      });
    }

    if (t.nights > 0) {
      const city = t.legs[0].to;
      const estimate = hotelRate(city, t.tripType) * t.nights;
      const days = daysUntil(t.startDate);
      const booked = travelled || days <= 3;
      const ref = booked ? `HTL-${String(Math.floor(rng() * 900000) + 100000)}` : null;
      out.push({
        ...base,
        id: `${t.requestNo}-H1`,
        kind: "Hotel",
        description: `Hotel · ${city}, ${t.nights} night${t.nights === 1 ? "" : "s"}`,
        travelDate: t.startDate,
        carrier: `Check-in ${t.startDate}, check-out ${t.endDate}`,
        vendor: booked ? HOTEL_VENDOR(city) : null,
        bookingRef: ref,
        estimate,
        actual: booked ? varied(estimate) : null,
        voucher: booked ? `${ref}-voucher.pdf` : null,
        stage: travelled ? "completed" : booked ? "booked" : "booking_pending",
        daysToTravel: days,
      });
    }
  }
  return out.sort((a, b) => a.travelDate.localeCompare(b.travelDate));
}

export const TRAVEL_DESK_ITEMS: TravelDeskItem[] = buildDesk();

/** Σ of the transport legs on approved/completed requests, straight from the requests. */
export const TRAVEL_DESK_LEG_ESTIMATE = sum(
  TRAVEL_REQUESTS.filter((t) => t.status === "approved" || t.status === "completed").flatMap((t) =>
    t.legs.map((l) => l.estimatedCost),
  ),
);

/* --------------------------------------------------------- travel advances */

export type TravelAdvStatus =
  | "pending_approval"
  | "outstanding"
  | "recovering"
  | "settled"
  | "rejected"
  | "written_off";

export interface TravelAdvInstalment {
  runId: string;
  label: string;
  amount: number;
}

export interface TravelAdvRow {
  id: string;
  requestNo: string | null;
  employeeCode: string;
  employeeName: string;
  department: string;
  purpose: string;
  tripStart: string;
  tripEnd: string;
  requested: number;
  issued: number;
  settled: number;
  outstanding: number;
  issuedOn: string | null;
  /** Ten days after the trip ends — the settlement deadline in the travel policy. */
  settleBy: string;
  status: TravelAdvStatus;
  /** True when the row comes from a trip closed before this quarter. */
  carried: boolean;
  recovery: TravelAdvInstalment[];
  note: string | null;
}

export const TRAVEL_ADV_SETTLE_DAYS = 10;

/** The next three monthly runs a recovery can be scheduled against. */
export const TRAVEL_ADV_RECOVERY_RUNS = [
  { runId: "PR-2026-10", label: "October 2026" },
  { runId: "PR-2026-11", label: "November 2026" },
  { runId: "PR-2026-12", label: "December 2026" },
] as const;

/** Splits an amount into n equal instalments, rounding to ₹100 with the remainder in the last. */
export function travelAdvRecoveryPlan(amount: number, instalments: number): TravelAdvInstalment[] {
  const n = Math.max(1, Math.min(instalments, TRAVEL_ADV_RECOVERY_RUNS.length));
  const each = Math.floor(amount / n / 100) * 100;
  return TRAVEL_ADV_RECOVERY_RUNS.slice(0, n).map((r, i) => ({
    runId: r.runId,
    label: r.label,
    amount: i === n - 1 ? amount - each * (n - 1) : each,
  }));
}

const settleBy = (end: string) => isoDate(addDays(parseISO(end), TRAVEL_ADV_SETTLE_DAYS));

function fromRequest(t: TravelRequest): TravelAdvRow {
  const status: TravelAdvStatus =
    t.status === "rejected"
      ? "rejected"
      : t.advanceDisbursed === 0
        ? "pending_approval"
        : t.advanceOutstanding === 0
          ? "settled"
          : "outstanding";
  return {
    id: `ADV-${t.requestNo.slice(4)}`,
    requestNo: t.requestNo,
    employeeCode: t.employeeCode,
    employeeName: t.employeeName,
    department: t.department,
    purpose: t.purpose,
    tripStart: t.startDate,
    tripEnd: t.endDate,
    requested: t.advanceRequested,
    issued: t.advanceDisbursed,
    settled: t.advanceSettled,
    outstanding: t.advanceOutstanding,
    issuedOn: t.advanceDisbursed > 0 && t.decidedOn ? t.decidedOn.slice(0, 10) : null,
    settleBy: settleBy(t.endDate),
    status,
    carried: false,
    recovery: [],
    note: t.status === "rejected" ? "Trip rejected — advance never issued." : null,
  };
}

/** Trip-linked advances. Σ outstanding === TRAVEL_ADVANCE_SUMMARY.outstanding. */
export const TRAVEL_ADV_TRIP_ROWS: TravelAdvRow[] = TRAVEL_REQUESTS.filter((t) => t.advanceRequested > 0).map(
  fromRequest,
);

interface CarriedSeed {
  purpose: string;
  tripStart: string;
  nights: number;
  issued: number;
  settled: number;
  scheduled: number;
}

const CARRIED_SEEDS: CarriedSeed[] = [
  { purpose: "Dealer meet — Ahmedabad and Vadodara", tripStart: "2026-07-06", nights: 3, issued: 18000, settled: 6500, scheduled: 3 },
  { purpose: "Customer onboarding workshop — Kochi", tripStart: "2026-07-20", nights: 2, issued: 12000, settled: 4800, scheduled: 2 },
  { purpose: "Trade show stand — Pragati Maidan, Delhi", tripStart: "2026-08-03", nights: 4, issued: 25000, settled: 13500, scheduled: 0 },
  { purpose: "Renewal negotiations — Coimbatore textile cluster", tripStart: "2026-08-17", nights: 2, issued: 10000, settled: 2600, scheduled: 0 },
];

/* Field-sales and customer-success staff carry most travel — pick from them. */
const CARRIED_POOL = EMPLOYEES.filter(
  (e) => (e.departmentId === "SAL" || e.departmentId === "CSM") && e.status === "active" && e.branchId !== "EWR",
);

/** Advances from trips closed before this quarter whose settlement deadline has lapsed. */
export const TRAVEL_ADV_CARRIED_ROWS: TravelAdvRow[] = CARRIED_SEEDS.map((s, i) => {
  const emp = CARRIED_POOL[Math.floor(((i + 0.5) * CARRIED_POOL.length) / CARRIED_SEEDS.length)];
  const tripEnd = isoDate(addDays(parseISO(s.tripStart), s.nights));
  const outstanding = s.issued - s.settled;
  return {
    id: `ADV-C-${String(i + 1).padStart(3, "0")}`,
    requestNo: null,
    employeeCode: emp.code,
    employeeName: emp.name,
    department: deptName(emp.departmentId),
    purpose: s.purpose,
    tripStart: s.tripStart,
    tripEnd,
    requested: s.issued,
    issued: s.issued,
    settled: s.settled,
    outstanding,
    issuedOn: isoDate(addDays(parseISO(s.tripStart), -4)),
    settleBy: settleBy(tripEnd),
    status: s.scheduled ? "recovering" : "outstanding",
    carried: true,
    recovery: s.scheduled ? travelAdvRecoveryPlan(outstanding, s.scheduled) : [],
    note: s.scheduled
      ? "Settlement deadline lapsed — employee consented to recovery through payroll."
      : "Settlement deadline lapsed — reminder sent twice, no claim filed.",
  };
});

export const TRAVEL_ADV_ROWS: TravelAdvRow[] = [...TRAVEL_ADV_TRIP_ROWS, ...TRAVEL_ADV_CARRIED_ROWS];

/** True once the settlement deadline has passed with money still out. */
export const travelAdvOverdue = (r: TravelAdvRow) => r.outstanding > 0 && daysUntil(r.settleBy) < 0;

/** The ledger totals the advances screen asserts against TRAVEL_ADVANCE_SUMMARY. */
export const TRAVEL_ADV_TRIP_TOTALS = {
  issued: sum(TRAVEL_ADV_TRIP_ROWS.map((r) => r.issued)),
  settled: sum(TRAVEL_ADV_TRIP_ROWS.map((r) => r.settled)),
  outstanding: sum(TRAVEL_ADV_TRIP_ROWS.map((r) => r.outstanding)),
  summary: TRAVEL_ADVANCE_SUMMARY,
};
