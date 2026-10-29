import { addDays, addMonths, differenceInCalendarDays, format, parseISO } from "date-fns";
import { mulberry32, pick, randInt } from "@/lib/utils";
import { DEMO_TODAY } from "./org";
import { EMPLOYEES, employeeName } from "./employees";
import { ASSETS, type Asset, type AssetCategory, type AssetCondition } from "./workplace";

/* ============================================================================
   SERVICE · ASSETS — category policy, specs and the per-asset detail story
   (assignment history, condition log, maintenance, depreciation). Everything
   is derived from the existing ASSETS register so tags and counts match the
   /assets screen exactly.
   ========================================================================== */

const TODAY = parseISO(DEMO_TODAY);
const isoDate = (d: Date) => format(d, "yyyy-MM-dd");
const ACTIVE = EMPLOYEES.filter((e) => e.status !== "exited");

export type DepMethod = "SLM" | "WDV";

export interface CustomField {
  name: string;
  type: "Text" | "Number" | "Date" | "Yes/No" | "List";
  required: boolean;
}

export interface AssetCategoryNode {
  id: string;
  name: string;
  parentId: string | null;
  /** The register category this leaf maps to; null for a group or an untagged class. */
  registerCategory: AssetCategory | null;
  method: DepMethod;
  /** Annual rate in percent — SLM derives it from life and salvage. */
  rate: number;
  usefulLifeYears: number;
  salvagePct: number;
  owner: string;
  customFields: CustomField[];
}

const slmRate = (life: number, salvage: number) => Math.round(((100 - salvage) / life) * 100) / 100;

const leaf = (
  id: string,
  name: string,
  parentId: string,
  registerCategory: AssetCategory | null,
  method: DepMethod,
  life: number,
  wdvRate: number | null,
  owner: string,
  customFields: CustomField[],
): AssetCategoryNode => ({
  id,
  name,
  parentId,
  registerCategory,
  method,
  rate: method === "WDV" ? (wdvRate ?? 40) : slmRate(life, 5),
  usefulLifeYears: life,
  salvagePct: 5,
  owner,
  customFields,
});

const group = (id: string, name: string, owner: string): AssetCategoryNode => ({
  id,
  name,
  parentId: null,
  registerCategory: null,
  method: "SLM",
  rate: 0,
  usefulLifeYears: 0,
  salvagePct: 0,
  owner,
  customFields: [],
});

const f = (name: string, type: CustomField["type"], required = false): CustomField => ({ name, type, required });

export const ASSET_CATEGORY_TREE: AssetCategoryNode[] = [
  group("grp-it", "IT equipment", "IT Service Desk"),
  leaf("cat-laptop", "Laptops", "grp-it", "Laptop", "WDV", 3, 40, "IT Service Desk", [
    f("Processor", "Text", true), f("RAM (GB)", "Number", true), f("Storage (GB)", "Number", true),
    f("Disk encryption", "Yes/No", true), f("OS build", "Text"),
  ]),
  leaf("cat-monitor", "Monitors", "grp-it", "Monitor", "SLM", 5, null, "IT Service Desk", [
    f("Screen size (in)", "Number", true), f("Resolution", "List", true), f("Ports", "Text"),
  ]),
  leaf("cat-headset", "Headsets", "grp-it", "Headset", "SLM", 3, null, "IT Service Desk", [
    f("Connection", "List", true), f("Noise cancelling", "Yes/No"),
  ]),
  leaf("cat-dock", "Docking stations", "grp-it", "Docking Station", "SLM", 5, null, "IT Service Desk", [
    f("Interface", "List", true), f("Power delivery (W)", "Number"),
  ]),
  group("grp-mobile", "Mobile devices", "IT Service Desk"),
  leaf("cat-phone", "Phones", "grp-mobile", "Phone", "WDV", 3, 40, "IT Service Desk", [
    f("IMEI", "Text", true), f("SIM number", "Text"), f("MDM enrolled", "Yes/No", true),
  ]),
  leaf("cat-tablet", "Tablets", "grp-mobile", "Tablet", "WDV", 3, 40, "IT Service Desk", [
    f("IMEI", "Text"), f("MDM enrolled", "Yes/No", true),
  ]),
  group("grp-facilities", "Facilities", "Facilities & Admin"),
  leaf("cat-access", "Access cards", "grp-facilities", "Access Card", "SLM", 5, null, "Facilities & Admin", [
    f("Card number", "Text", true), f("Access zones", "List", true), f("Valid till", "Date"),
  ]),
  leaf("cat-furniture", "Furniture", "grp-facilities", null, "SLM", 10, null, "Facilities & Admin", [
    f("Material", "List"), f("Floor / bay", "Text", true),
  ]),
  group("grp-fleet", "Fleet", "Facilities & Admin"),
  leaf("cat-vehicle", "Vehicles", "grp-fleet", null, "WDV", 8, 15, "Facilities & Admin", [
    f("Registration no.", "Text", true), f("Insurance expiry", "Date", true), f("Fuel type", "List", true),
  ]),
];

export const categoryForAsset = (c: AssetCategory) =>
  ASSET_CATEGORY_TREE.find((n) => n.registerCategory === c)!;

export const assetCountFor = (node: AssetCategoryNode): number =>
  node.registerCategory
    ? ASSETS.filter((a) => a.category === node.registerCategory).length
    : node.parentId === null
      ? ASSET_CATEGORY_TREE.filter((n) => n.parentId === node.id).reduce((s, n) => s + assetCountFor(n), 0)
      : 0;

/* ------------------------------------------------------------ specs by model */

export const MODEL_SPECS: Record<string, [string, string][]> = {
  'MacBook Pro 14" M4': [["Processor", "Apple M4 Pro, 12-core CPU"], ["RAM (GB)", "24"], ["Storage (GB)", "512"], ["Disk encryption", "FileVault on"], ["OS build", "macOS 15.6"]],
  "Latitude 5450": [["Processor", "Intel Core Ultra 7 165U"], ["RAM (GB)", "32"], ["Storage (GB)", "512"], ["Disk encryption", "BitLocker on"], ["OS build", "Windows 11 23H2"]],
  "ThinkPad T14 Gen 5": [["Processor", "AMD Ryzen 7 PRO 8840U"], ["RAM (GB)", "32"], ["Storage (GB)", "1024"], ["Disk encryption", "BitLocker on"], ["OS build", "Windows 11 23H2"]],
  'UltraSharp U2723QE 27" 4K': [["Screen size (in)", "27"], ["Resolution", "3840 × 2160"], ["Ports", "USB-C 90W, HDMI, DP"]],
  '27UP850N-W 27" UHD': [["Screen size (in)", "27"], ["Resolution", "3840 × 2160"], ["Ports", "USB-C 96W, HDMI ×2, DP"]],
  "iPhone 15 128 GB": [["IMEI", "35 829 115 •••• 41"], ["SIM number", "eSIM · Jio"], ["MDM enrolled", "Yes · Intune"]],
  "Galaxy A55 5G": [["IMEI", "35 471 902 •••• 87"], ["SIM number", "Airtel postpaid"], ["MDM enrolled", "Yes · Knox"]],
  "iCLASS SE Proximity Card": [["Card number", "HID 26-bit"], ["Access zones", "Lobby, floor, cafeteria"], ["Valid till", "31 Mar 2027"]],
  "Evolve2 65 UC Stereo": [["Connection", "Bluetooth + USB-A dongle"], ["Noise cancelling", "Passive"]],
  "Zone Vibe 100": [["Connection", "Bluetooth"], ["Noise cancelling", "No"]],
  "WD22TB4 Thunderbolt Dock": [["Interface", "Thunderbolt 4"], ["Power delivery (W)", "130"]],
  'iPad Air 11" M2': [["IMEI", "35 220 418 •••• 05"], ["MDM enrolled", "Yes · Intune"]],
};

/* ------------------------------------------------------------ depreciation */

export interface DepRow {
  fy: string;
  opening: number;
  depreciation: number;
  closing: number;
}

const fyOf = (d: Date) => {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `FY${String(y + 1).slice(2)}`;
};

/** Month-by-month depreciation, rolled up by Indian financial year (Apr–Mar). */
export function depreciationSchedule(asset: Asset, method: DepMethod, rate: number, life: number, salvagePct: number) {
  const cost = asset.purchaseCost;
  const floor = (cost * salvagePct) / 100;
  const months = life * 12;
  const rows: DepRow[] = [];
  let book = cost;
  let fyOpening = cost;
  let bookToday = cost;
  let cursor = parseISO(asset.purchaseDate);
  for (let m = 0; m < months; m++) {
    const fy = fyOf(cursor);
    if (cursor.getMonth() === 3 && m > 0) fyOpening = book;
    const charge = method === "SLM" ? (cost - floor) / months : (fyOpening * rate) / 100 / 12;
    const dep = Math.min(charge, book - floor);
    const last = rows[rows.length - 1];
    if (!last || last.fy !== fy) rows.push({ fy, opening: book, depreciation: 0, closing: book });
    const row = rows[rows.length - 1];
    book -= dep;
    row.depreciation += dep;
    row.closing = book;
    if (cursor <= TODAY) bookToday = book;
    cursor = addMonths(cursor, 1);
  }
  const round = (n: number) => Math.round(n);
  return {
    rows: rows.map((r) => ({ fy: r.fy, opening: round(r.opening), depreciation: round(r.depreciation), closing: round(r.closing) })),
    bookToday: round(bookToday),
    accumulated: round(cost - bookToday),
  };
}

/* ------------------------------------------------------- per-asset story */

export interface AssetEvent {
  date: string;
  kind: "purchase" | "stock" | "allocated" | "returned" | "repair" | "retired";
  title: string;
  by: string;
  note: string;
}

export interface ConditionEntry {
  date: string;
  condition: AssetCondition;
  recordedBy: string;
  note: string;
  photos: number;
}

export interface AssetMaintenance {
  id: string;
  date: string;
  type: "Preventive" | "Breakdown";
  description: string;
  vendor: string;
  cost: number;
  downtimeDays: number;
  status: "completed" | "in_review";
}

export interface AssetStory {
  invoiceNo: string;
  events: AssetEvent[];
  conditions: ConditionEntry[];
  maintenance: AssetMaintenance[];
}

const IT_ADMIN = "Girish Gowda";
const SERVICE_JOBS: Partial<Record<AssetCategory, string[]>> = {
  Laptop: ["Battery health check and firmware update", "Keyboard replaced under warranty", "Thermal paste and fan clean", "SSD health scan"],
  Monitor: ["Dead-pixel inspection", "USB-C hub firmware update"],
  Phone: ["Screen guard and MDM re-enrolment", "Battery replaced"],
  Headset: ["Ear cushions replaced"],
  "Docking Station": ["Firmware update for display flicker"],
  Tablet: ["iPadOS update and MDM profile refresh"],
  "Access Card": ["Card re-encoded after reader upgrade"],
};

export function assetStory(asset: Asset): AssetStory {
  const n = Number(asset.id.slice(-4));
  const rng = mulberry32(5000 + n);
  const bought = parseISO(asset.purchaseDate);
  const events: AssetEvent[] = [
    { date: asset.purchaseDate, kind: "purchase", title: `Purchased from ${asset.vendor}`, by: "Procurement", note: `Invoice INV/${bought.getFullYear()}/${String(1200 + n)}` },
    { date: isoDate(addDays(bought, 2)), kind: "stock", title: "Received into IT store", by: IT_ADMIN, note: "Tagged, imaged and photographed" },
  ];
  const conditions: ConditionEntry[] = [
    { date: isoDate(addDays(bought, 2)), condition: "New", recordedBy: IT_ADMIN, note: "Sealed box, accessories complete", photos: 3 },
  ];

  const handOverStart = addDays(bought, 5);
  const end = asset.allocatedOn ? parseISO(asset.allocatedOn) : addDays(bought, randInt(rng, 200, 600));
  if (differenceInCalendarDays(end, handOverStart) > 60 || asset.status !== "allocated") {
    const prior = pick(rng, ACTIVE).code;
    const returned = asset.status === "allocated" ? addDays(end, -randInt(rng, 3, 20)) : end;
    if (returned < TODAY) {
      events.push({ date: isoDate(handOverStart), kind: "allocated", title: `Allocated to ${employeeName(prior)}`, by: IT_ADMIN, note: "Handover acknowledged" });
      events.push({ date: isoDate(returned), kind: "returned", title: `Returned by ${employeeName(prior)}`, by: IT_ADMIN, note: "Wiped and re-imaged" });
      conditions.push({ date: isoDate(returned), condition: n % 3 === 0 ? "Good" : "Excellent", recordedBy: IT_ADMIN, note: "Minor wear on edges", photos: 2 });
    }
  }
  if (asset.status === "allocated" && asset.allocatedTo && asset.allocatedOn) {
    events.push({ date: asset.allocatedOn, kind: "allocated", title: `Allocated to ${asset.allocatedToName}`, by: IT_ADMIN, note: "Handover acknowledged on the HRMS" });
  }
  if (asset.status === "under_repair") {
    events.push({ date: isoDate(addDays(TODAY, -randInt(rng, 3, 12))), kind: "repair", title: `Sent to ${asset.location}`, by: IT_ADMIN, note: "Breakdown logged — awaiting part" });
  }
  if (asset.status === "retired") {
    events.push({ date: isoDate(addDays(TODAY, -randInt(rng, 30, 160))), kind: "retired", title: "Retired and written off", by: IT_ADMIN, note: "E-waste certificate filed" });
  }
  conditions.push({ date: "2026-03-24", condition: asset.condition, recordedBy: "FY26 verification", note: "Physical verification scan", photos: 1 });

  const jobs = SERVICE_JOBS[asset.category] ?? [];
  const maintenance: AssetMaintenance[] = jobs.slice(0, 1 + (n % Math.max(1, jobs.length))).map((d, i) => {
    const date = addDays(bought, 120 + i * 210 + randInt(rng, 0, 40));
    const inWarranty = date < parseISO(asset.warrantyExpiry);
    return {
      id: `MNT-${n}-${i + 1}`,
      date: isoDate(date > TODAY ? addDays(TODAY, -20 - i) : date),
      type: d.includes("replaced") || d.includes("flicker") ? "Breakdown" : "Preventive",
      description: d,
      vendor: `${asset.make} Authorised Service Centre`,
      cost: inWarranty ? 0 : Math.round(asset.purchaseCost * 0.04),
      downtimeDays: d.includes("replaced") ? 3 : 0,
      status: "completed",
    };
  });
  if (asset.status === "under_repair") {
    maintenance.push({
      id: `MNT-${n}-open`,
      date: events[events.length - 1].date,
      type: "Breakdown",
      description: asset.category === "Laptop" ? "Display hinge cracked, panel flickers" : "Device not powering on",
      vendor: asset.location,
      cost: asset.inWarranty ? 0 : Math.round(asset.purchaseCost * 0.08),
      downtimeDays: differenceInCalendarDays(TODAY, parseISO(events[events.length - 1].date)),
      status: "in_review",
    });
  }

  return {
    invoiceNo: `INV/${bought.getFullYear()}/${String(1200 + n)}`,
    events: events.sort((a, b) => a.date.localeCompare(b.date)),
    conditions: conditions.sort((a, b) => a.date.localeCompare(b.date)),
    maintenance: maintenance.sort((a, b) => b.date.localeCompare(a.date)),
  };
}
