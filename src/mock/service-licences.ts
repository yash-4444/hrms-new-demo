import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { mulberry32, randInt } from "@/lib/utils";
import { BRANCHES, DEMO_TODAY } from "./org";
import { EMPLOYEES } from "./employees";
import { ASSETS, type Asset } from "./workplace";

/* ============================================================================
   SERVICE · SOFTWARE LICENCES and PHYSICAL VERIFICATION.
   Licence seats are real employees; the 14 seats idle for 60+ days drive the
   AI reclaim suggestion, and its saving is computed — never typed in.
   ========================================================================== */

const TODAY = parseISO(DEMO_TODAY);
const isoDate = (d: Date) => format(d, "yyyy-MM-dd");
const ACTIVE = EMPLOYEES.filter((e) => e.status !== "exited");

export interface Licence {
  id: string;
  product: string;
  vendor: string;
  edition: string;
  seatsPurchased: number;
  seatsAssigned: number;
  /** Annual cost per seat, INR. */
  costPerSeat: number;
  renewal: string;
  daysToRenewal: number;
  owner: string;
  /** Departments the seats are issued to; empty = everyone. */
  departments: string[];
  /** Assigned seats with no sign-in for 60+ days. */
  idle60: number;
}

const lic = (
  id: string, product: string, vendor: string, edition: string, seatsPurchased: number, seatsAssigned: number,
  costPerSeat: number, renewal: string, owner: string, departments: string[], idle60: number,
): Licence => ({
  id, product, vendor, edition, seatsPurchased, seatsAssigned, costPerSeat, renewal,
  daysToRenewal: differenceInCalendarDays(parseISO(renewal), TODAY), owner, departments, idle60,
});

export const LICENCES: Licence[] = [
  lic("LIC-M365", "Microsoft 365", "Microsoft", "E3", 350, 331, 26400, "2027-03-31", "Girish Gowda", [], 3),
  lic("LIC-SLACK", "Slack", "Salesforce", "Business+", 320, 302, 12600, "2026-11-15", "Girish Gowda", [], 4),
  lic("LIC-FIGMA", "Figma", "Figma Inc.", "Organization", 30, 28, 54000, "2026-10-20", "Design Ops", ["DES", "PRD"], 3),
  lic("LIC-JB", "JetBrains", "JetBrains s.r.o.", "All Products Pack", 120, 112, 27900, "2027-01-31", "Engineering Ops", ["ENG"], 2),
  lic("LIC-ZOOM", "Zoom", "Zoom Video Communications", "Business", 60, 52, 15700, "2026-12-01", "Girish Gowda", ["SAL", "CSM"], 2),
  lic("LIC-JIRA", "Jira Software", "Atlassian", "Cloud Standard", 160, 148, 9800, "2027-02-28", "Engineering Ops", ["ENG", "PRD", "DES"], 0),
  lic("LIC-ADOBE", "Adobe Creative Cloud", "Adobe", "All Apps — Teams", 18, 16, 78000, "2027-05-31", "Design Ops", ["DES", "MKT"], 0),
];

export const LICENCE_TOTALS = (() => {
  const idle = LICENCES.reduce((s, l) => s + l.idle60, 0);
  return {
    annualSpend: LICENCES.reduce((s, l) => s + l.seatsPurchased * l.costPerSeat, 0),
    purchased: LICENCES.reduce((s, l) => s + l.seatsPurchased, 0),
    assigned: LICENCES.reduce((s, l) => s + l.seatsAssigned, 0),
    idle60: idle,
    reclaimSaving: LICENCES.reduce((s, l) => s + l.idle60 * l.costPerSeat, 0),
    unassignedCost: LICENCES.reduce((s, l) => s + (l.seatsPurchased - l.seatsAssigned) * l.costPerSeat, 0),
  };
})();

export interface Seat {
  id: string;
  employeeCode: string;
  assignedOn: string;
  lastActive: string;
  idleDays: number;
}

/** The assigned seats of one licence; the first `idle60` are the idle ones. */
export function seatsFor(l: Licence): Seat[] {
  const rng = mulberry32(l.id.length * 977 + l.seatsAssigned);
  const pool = ACTIVE.filter((e) => l.departments.length === 0 || l.departments.includes(e.departmentId));
  const start = randInt(rng, 0, Math.max(0, pool.length - l.seatsAssigned));
  return pool.slice(start, start + l.seatsAssigned).map((e, i) => {
    const idleDays = i < l.idle60 ? randInt(rng, 61, 140) : randInt(rng, 0, 12);
    return {
      id: `${l.id}-${e.code}`,
      employeeCode: e.code,
      assignedOn: isoDate(addDays(TODAY, -randInt(rng, 70, 700))),
      lastActive: isoDate(addDays(TODAY, -idleDays)),
      idleDays,
    };
  });
}

/* ------------------------------------------------- physical verification */

export type DiscrepancyKind = "Missing" | "Wrong location" | "Condition mismatch";

export interface Discrepancy {
  id: string;
  assetId: string;
  assetLabel: string;
  branchId: string;
  kind: DiscrepancyKind;
  expected: string;
  found: string;
  scannedBy: string;
  scannedOn: string;
}

export interface BranchVerification {
  branchId: string;
  city: string;
  expected: number;
  scanned: number;
  verifier: string;
  dueOn: string;
}

export interface AuditCycle {
  id: string;
  name: string;
  start: string;
  end: string;
  status: "running" | "completed";
  expected: number;
  scanned: number;
  discrepancies: number;
}

const inScope = (a: Asset) => a.status !== "retired";
const VERIFIERS: Record<string, string> = { BLR: "STL-0311", PNQ: "STL-0313", EWR: "STL-0316", HYD: "STL-0314" };
const SCANNED_SHARE: Record<string, number> = { BLR: 0.85, PNQ: 1, EWR: 0.62, HYD: 0 };

export const AUDIT_BRANCHES: BranchVerification[] = BRANCHES.map((b) => {
  const expected = ASSETS.filter((a) => a.branchId === b.id && inScope(a)).length;
  return {
    branchId: b.id,
    city: b.city,
    expected,
    scanned: Math.round(expected * (SCANNED_SHARE[b.id] ?? 0)),
    verifier: VERIFIERS[b.id] ?? "STL-0311",
    dueOn: "2026-09-30",
  };
}).filter((b) => b.expected > 0);

function buildDiscrepancies(): Discrepancy[] {
  const pickFrom = (branch: string, status: Asset["status"], skip: number) =>
    ASSETS.filter((a) => a.branchId === branch && a.status === status)[skip];
  const spec: [string, Asset["status"], number, DiscrepancyKind, (a: Asset) => [string, string]][] = [
    ["BLR", "allocated", 7, "Missing", (a) => [`With ${a.allocatedToName}`, "Not presented — holder on leave"]],
    ["EWR", "in_stock", 2, "Missing", (a) => [a.location, "Not on the shelf"]],
    ["BLR", "in_stock", 3, "Wrong location", () => ["Bengaluru · IT Store Room 7F", "Bengaluru · 4F meeting room Orion"]],
    ["PNQ", "allocated", 5, "Wrong location", (a) => [a.location, "Bengaluru HQ — holder relocated"]],
    ["BLR", "allocated", 22, "Wrong location", (a) => [a.location, "Pune · IT Store Room 2F"]],
    ["BLR", "allocated", 31, "Condition mismatch", (a) => [a.condition, "Fair — cracked bezel"]],
    ["PNQ", "allocated", 12, "Condition mismatch", (a) => [a.condition, "Needs repair — sticky keys"]],
    ["EWR", "allocated", 1, "Condition mismatch", (a) => [a.condition, "Fair — scratched lid"]],
  ];
  return spec.flatMap(([branch, status, skip, kind, fn], i) => {
    const a = pickFrom(branch, status, skip);
    if (!a) return [];
    const [expected, found] = fn(a);
    return [{
      id: `DSC-${String(41 + i)}`,
      assetId: a.id,
      assetLabel: `${a.make} ${a.model}`,
      branchId: branch,
      kind,
      expected,
      found,
      scannedBy: VERIFIERS[branch],
      scannedOn: isoDate(addDays(TODAY, -(i % 5) - 1)),
    }];
  });
}

export const DISCREPANCIES: Discrepancy[] = buildDiscrepancies();

export const AUDIT_CYCLES: AuditCycle[] = [
  {
    id: "PV-FY27-H1",
    name: "FY27 H1 physical verification",
    start: "2026-09-01",
    end: "2026-09-30",
    status: "running",
    expected: AUDIT_BRANCHES.reduce((s, b) => s + b.expected, 0),
    scanned: AUDIT_BRANCHES.reduce((s, b) => s + b.scanned, 0),
    discrepancies: DISCREPANCIES.length,
  },
  { id: "PV-FY26-H2", name: "FY26 H2 physical verification", start: "2026-03-02", end: "2026-03-27", status: "completed", expected: 171, scanned: 171, discrepancies: 6 },
  { id: "PV-FY26-H1", name: "FY26 H1 physical verification", start: "2025-09-01", end: "2025-09-26", status: "completed", expected: 158, scanned: 158, discrepancies: 9 },
];
