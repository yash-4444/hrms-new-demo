import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { mulberry32, pick, randInt } from "@/lib/utils";
import { DEMO_TODAY, deptName } from "./org";
import { EMPLOYEES, employeeByCode, employeeName } from "./employees";
import { ASSETS, type AssetCategory } from "./workplace";

/* ============================================================================
   SERVICE · ASSET OPERATIONS — preventive schedule, breakdown log, AMC
   contracts and employee asset requests. Breakdowns are keyed to the real
   under-repair assets in the register.
   ========================================================================== */

const TODAY = parseISO(DEMO_TODAY);
const isoDate = (d: Date) => format(d, "yyyy-MM-dd");
const daysFromToday = (d: string) => differenceInCalendarDays(parseISO(d), TODAY);

/* ------------------------------------------------------ preventive schedule */

export interface PmSchedule {
  id: string;
  title: string;
  category: AssetCategory | "Facilities";
  branch: string;
  assets: number;
  frequency: "Monthly" | "Quarterly" | "Half-yearly" | "Yearly";
  lastDone: string;
  nextDue: string;
  vendor: string;
  status: "scheduled" | "due_soon" | "overdue";
}

const countIn = (c: AssetCategory, branch: string) =>
  ASSETS.filter((a) => a.category === c && a.branchId === branch && a.status !== "retired").length;

const pm = (
  id: string, title: string, category: PmSchedule["category"], branch: string, assets: number,
  frequency: PmSchedule["frequency"], lastDone: string, nextDue: string, vendor: string,
): PmSchedule => {
  const d = daysFromToday(nextDue);
  return { id, title, category, branch, assets, frequency, lastDone, nextDue, vendor, status: d < 0 ? "overdue" : d <= 14 ? "due_soon" : "scheduled" };
};

export const PM_SCHEDULE: PmSchedule[] = [
  pm("PM-101", "Laptop battery health and firmware sweep", "Laptop", "BLR", countIn("Laptop", "BLR"), "Quarterly", "2026-06-10", "2026-09-10", "Dell Direct Enterprise"),
  pm("PM-102", "Laptop battery health and firmware sweep", "Laptop", "PNQ", countIn("Laptop", "PNQ"), "Quarterly", "2026-06-24", "2026-09-24", "Ingram Micro"),
  pm("PM-103", "Monitor dead-pixel and cable inspection", "Monitor", "BLR", countIn("Monitor", "BLR"), "Half-yearly", "2026-04-02", "2026-10-02", "Supertron Distributors"),
  pm("PM-104", "Docking station firmware update", "Docking Station", "BLR", countIn("Docking Station", "BLR"), "Half-yearly", "2026-03-18", "2026-09-18", "Dell Direct Enterprise"),
  pm("PM-105", "Access card reader and card re-encode check", "Access Card", "BLR", countIn("Access Card", "BLR"), "Yearly", "2025-11-12", "2026-11-12", "Securens Facility Services"),
  pm("PM-106", "Phone MDM compliance and OS patch audit", "Phone", "BLR", countIn("Phone", "BLR"), "Monthly", "2026-08-30", "2026-09-30", "In-house · IT Service Desk"),
  pm("PM-107", "UPS battery and server-room AC servicing", "Facilities", "PNQ", 6, "Quarterly", "2026-05-28", "2026-08-28", "Blue Star Facility Care"),
  pm("PM-108", "Headset hygiene kit replacement", "Headset", "EWR", countIn("Headset", "EWR"), "Yearly", "2025-12-05", "2026-12-05", "Ingram Micro"),
];

/* --------------------------------------------------------- breakdown log */

export interface Breakdown {
  id: string;
  assetId: string;
  assetLabel: string;
  category: AssetCategory;
  reportedBy: string;
  reportedOn: string;
  issue: string;
  vendor: string;
  cost: number;
  downtimeDays: number;
  status: "open" | "in_review" | "completed";
  resolvedOn: string | null;
}

const ISSUES: Record<AssetCategory, string[]> = {
  Laptop: ["Display hinge cracked, panel flickers", "Battery swelling — lid does not close", "Keyboard keys unresponsive after spill", "Fan noise and thermal throttling"],
  Monitor: ["Vertical line across the panel", "USB-C input not detected"],
  Phone: ["Cracked screen", "Not charging"],
  "Access Card": ["Card not read at turnstile"],
  Headset: ["Left driver dead"],
  "Docking Station": ["External displays flicker"],
  Tablet: ["Boot loop after OS update"],
};

function buildBreakdowns(): Breakdown[] {
  const rng = mulberry32(31337);
  const open = ASSETS.filter((a) => a.status === "under_repair");
  const closedPool = ASSETS.filter((a) => a.status === "allocated" && !a.inWarranty).slice(0, 40);
  const rows: Breakdown[] = open.map((a, i) => {
    const reportedOn = isoDate(addDays(TODAY, -randInt(rng, 2, 14)));
    return {
      id: `BRK-${String(2201 + i)}`,
      assetId: a.id,
      assetLabel: `${a.make} ${a.model}`,
      category: a.category,
      reportedBy: pick(rng, EMPLOYEES.filter((e) => e.branchId === a.branchId)).code,
      reportedOn,
      issue: pick(rng, ISSUES[a.category]),
      vendor: a.location,
      cost: a.inWarranty ? 0 : Math.round(a.purchaseCost * 0.08),
      downtimeDays: -daysFromToday(reportedOn),
      status: i % 3 === 0 ? "open" : "in_review",
      resolvedOn: null,
    };
  });
  for (let i = 0; i < 9; i++) {
    const a = closedPool[(i * 4) % closedPool.length];
    const reportedOn = addDays(TODAY, -randInt(rng, 20, 150));
    const downtime = randInt(rng, 1, 9);
    rows.push({
      id: `BRK-${String(2101 + i * 7)}`,
      assetId: a.id,
      assetLabel: `${a.make} ${a.model}`,
      category: a.category,
      reportedBy: a.allocatedTo ?? "STL-0010",
      reportedOn: isoDate(reportedOn),
      issue: pick(rng, ISSUES[a.category]),
      vendor: `${a.make} Authorised Service Centre`,
      cost: Math.round(a.purchaseCost * (0.03 + rng() * 0.06)),
      downtimeDays: downtime,
      status: "completed",
      resolvedOn: isoDate(addDays(reportedOn, downtime)),
    });
  }
  return rows.sort((x, y) => y.reportedOn.localeCompare(x.reportedOn));
}

export const BREAKDOWNS: Breakdown[] = buildBreakdowns();

/* ------------------------------------------------------------ AMC contracts */

export interface AmcContract {
  id: string;
  vendor: string;
  scope: string;
  annualValue: number;
  start: string;
  end: string;
  daysLeft: number;
  coverage: string;
}

const amc = (id: string, vendor: string, scope: string, annualValue: number, start: string, end: string, coverage: string): AmcContract => ({
  id, vendor, scope, annualValue, start, end, daysLeft: daysFromToday(end), coverage,
});

export const AMC_CONTRACTS: AmcContract[] = [
  amc("AMC-0012", "Dell Direct Enterprise", "Latitude laptops and WD22 docks — ProSupport Plus", 486000, "2025-10-01", "2026-09-30", "Next-business-day onsite, accidental damage"),
  amc("AMC-0015", "Blue Star Facility Care", "Server-room precision AC and UPS (Pune)", 312000, "2025-10-15", "2026-10-14", "Quarterly PM, 4-hour breakdown response"),
  amc("AMC-0018", "Securens Facility Services", "Access-control readers and turnstiles (all branches)", 228000, "2025-12-01", "2026-11-30", "Yearly PM, 8-hour response"),
  amc("AMC-0021", "Ingram Micro", "Lenovo ThinkPad fleet — Premier Support", 394000, "2026-04-01", "2027-03-31", "Next-business-day onsite"),
  amc("AMC-0009", "Redington India", "AppleCare for Enterprise — MacBook Pro and iPad", 618000, "2026-01-01", "2026-12-31", "Express replacement, 2 incidents per device"),
  amc("AMC-0024", "Kone Elevator India", "Bengaluru HQ passenger lifts", 540000, "2026-07-01", "2027-06-30", "Monthly PM, 2-hour response"),
];

/* --------------------------------------------------------- asset requests */

export type RequestApproval = "pending" | "approved" | "rejected";
export type RequestFulfilment = "not_started" | "in_review" | "scheduled" | "completed" | "cancelled";

export interface AssetRequest {
  id: string;
  requesterCode: string;
  requesterName: string;
  department: string;
  managerCode: string;
  managerName: string;
  category: AssetCategory;
  item: string;
  justification: string;
  raisedOn: string;
  neededBy: string;
  approval: RequestApproval;
  approvedOn: string | null;
  fulfilment: RequestFulfilment;
  fulfilledAssetId: string | null;
  estCost: number;
}

const REQUEST_SEEDS: [string, AssetCategory, string, string, number, RequestApproval, RequestFulfilment][] = [
  ["STL-0142", "Monitor", 'Dell UltraSharp 27" 4K', "Second screen for reviewing design specs side by side with code during the payments re-platform.", 4, "pending", "not_started"],
  ["STL-0143", "Laptop", 'MacBook Pro 14" M4', "Current Latitude is 4 years old and takes 9 minutes to build the Android app; blocks the mobile release train.", 9, "pending", "not_started"],
  ["STL-0145", "Headset", "Jabra Evolve2 65", "Moved to the on-call rotation; needs a noise-cancelling headset for incident bridges.", 2, "approved", "scheduled"],
  ["STL-0147", "Docking Station", "Dell WD22TB4 dock", "Hot-desking on 7F — a dock lets me use the shared monitors.", 12, "approved", "completed"],
  ["STL-0148", "Phone", "Galaxy A55 5G (test device)", "QA needs a mid-range Android device to reproduce a crash reported by 3% of users.", 6, "pending", "not_started"],
  ["STL-0031", "Tablet", 'iPad Air 11"', "Whiteboarding in architecture reviews; replaces printed diagrams.", 20, "rejected", "cancelled"],
  ["STL-0058", "Laptop", "Dell Latitude 5450", "Replacement — screen damaged, interim loaner returned on 10 Sep.", 7, "approved", "in_review"],
  ["STL-0017", "Monitor", 'LG 27UP850N 27"', "Payroll reconciliation across two 30-column sheets during the September run.", 15, "approved", "completed"],
];

function buildRequests(): AssetRequest[] {
  const rng = mulberry32(8080);
  const extra = EMPLOYEES.filter((e) => e.status === "active" && e.managerCode).slice(60, 70).map((e) => e.code);
  const extraItems: [AssetCategory, string, string][] = [
    ["Headset", "Logitech Zone Vibe 100", "Customer calls from home on hybrid days."],
    ["Monitor", 'Dell UltraSharp 27" 4K', "Dashboards and CRM side by side during pipeline reviews."],
    ["Laptop", "Lenovo ThinkPad T14 Gen 5", "Joining the data team; needs 32 GB RAM for notebooks."],
    ["Access Card", "HID iCLASS proximity card", "Card stopped working after the reader upgrade."],
  ];
  const seeds = [
    ...REQUEST_SEEDS,
    ...extra.map((code, i) => {
      const [c, item, why] = extraItems[i % extraItems.length];
      const approval: RequestApproval = i % 4 === 0 ? "pending" : i % 7 === 3 ? "rejected" : "approved";
      const fulfil: RequestFulfilment = approval === "pending" ? "not_started" : approval === "rejected" ? "cancelled" : i % 3 === 0 ? "completed" : "scheduled";
      return [code, c, item, why, randInt(rng, 3, 25), approval, fulfil] as (typeof REQUEST_SEEDS)[number];
    }),
  ];
  return seeds.map(([code, category, item, justification, ago, approval, fulfilment], i) => {
    const e = employeeByCode(code)!;
    const raised = addDays(TODAY, -ago);
    const stock = ASSETS.find((a) => a.category === category && a.status === "in_stock");
    return {
      id: `AR-2026-${String(181 + i * 2).padStart(4, "0")}`,
      requesterCode: code,
      requesterName: e.name,
      department: deptName(e.departmentId),
      managerCode: e.managerCode ?? "STL-0001",
      managerName: employeeName(e.managerCode ?? "STL-0001"),
      category,
      item,
      justification,
      raisedOn: isoDate(raised),
      neededBy: isoDate(addDays(raised, 14)),
      approval,
      approvedOn: approval === "pending" ? null : isoDate(addDays(raised, 1)),
      fulfilment,
      fulfilledAssetId: fulfilment === "completed" || fulfilment === "scheduled" ? (stock?.id ?? null) : null,
      estCost: ASSETS.find((a) => a.category === category)?.purchaseCost ?? 0,
    };
  });
}

export const ASSET_REQUESTS: AssetRequest[] = buildRequests();
