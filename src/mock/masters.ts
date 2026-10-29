import { addDays, differenceInDays, differenceInYears, format, parseISO } from "date-fns";
import { inr } from "@/lib/format";
import { mulberry32, pick, randInt } from "@/lib/utils";
import {
  BRANCHES,
  DEMO_TODAY,
  DEPARTMENTS,
  DESIGNATIONS,
  GRADES,
  HOLIDAYS,
  TENANT,
  branchById,
  deptName,
  gradeById,
} from "./org";
import { EMPLOYEES, employeeByCode, reporteesOf, type Employee } from "./employees";

/* ============================================================================
   Core HR & Organization masters (W3).

   Every count on these screens is DERIVED from EMPLOYEES — branch, department,
   designation, grade, team, cost-centre, employment-type and work-location
   headcounts all add back up to the same 340 people the directory shows.
   Deterministic randomness only (mulberry32), "today" is DEMO_TODAY.
   ========================================================================== */

const TODAY = parseISO(DEMO_TODAY);
const iso = (d: Date) => format(d, "yyyy-MM-dd");
const isoAt = (date: string, time: string) => `${date}T${time}:00`;

/** Columns every master carries: active flag + "last changed by" audit stamp. */
export interface MasterAudit {
  active: boolean;
  updatedBy: string;
  updatedAt: string;
}

const AUDITORS = ["Priya Menon", "Sana Iqbal", "Rahul Desai", "Girish Gowda", "Lakshmi Pillai"];
const auditRng = mulberry32(7301);
function audit(by?: string, daysAgo?: number): MasterAudit {
  const d = daysAgo ?? randInt(auditRng, 3, 240);
  const hh = String(randInt(auditRng, 9, 18)).padStart(2, "0");
  const mm = String(randInt(auditRng, 0, 59)).padStart(2, "0");
  return {
    active: true,
    updatedBy: by ?? pick(auditRng, AUDITORS),
    updatedAt: isoAt(iso(addDays(TODAY, -d)), `${hh}:${mm}`),
  };
}

const countBy = <K extends string>(key: (e: Employee) => K) => {
  const m = new Map<K, number>();
  for (const e of EMPLOYEES) m.set(key(e), (m.get(key(e)) ?? 0) + 1);
  return m;
};

export const HEADCOUNT_BY_BRANCH = countBy((e) => e.branchId);
export const HEADCOUNT_BY_DEPT = countBy((e) => e.departmentId);
export const HEADCOUNT_BY_GRADE = countBy((e) => e.gradeId);

/* ------------------------------------------------------------- companies */

export interface Company extends MasterAudit {
  id: string;
  name: string;
  legalName: string;
  country: string;
  countryName: string;
  registration: string;
  taxId: string;
  gstin: string | null;
  address: string;
  currency: string;
  fyStart: string;
  branchIds: string[];
  headcount: number;
  isPrimary: boolean;
}

const companyHeadcount = (branchIds: string[]) =>
  branchIds.reduce((a, b) => a + (HEADCOUNT_BY_BRANCH.get(b) ?? 0), 0);

export const COMPANIES: Company[] = [
  {
    id: "STL-IN",
    name: TENANT.name,
    legalName: TENANT.legalName,
    country: "IN",
    countryName: "India",
    registration: `CIN ${TENANT.cin}`,
    taxId: `PAN ${TENANT.pan} · TAN ${TENANT.tan}`,
    gstin: TENANT.gstin,
    address: BRANCHES[0].address,
    currency: "INR",
    fyStart: "April",
    branchIds: ["BLR", "PNQ", "HYD"],
    headcount: companyHeadcount(["BLR", "PNQ", "HYD"]),
    isPrimary: true,
    ...audit("Arjun Kapoor", 412),
  },
  {
    id: "STL-US",
    name: "Stellar Technologies Inc.",
    legalName: "Stellar Technologies Inc. (Delaware C-Corp)",
    country: "US",
    countryName: "United States",
    registration: "DE File No. 6829143",
    taxId: "EIN 87-2290417",
    gstin: null,
    address: BRANCHES[2].address,
    currency: "USD",
    fyStart: "January",
    branchIds: ["EWR"],
    headcount: companyHeadcount(["EWR"]),
    isPrimary: false,
    ...audit("Lakshmi Pillai", 188),
  },
];

/* -------------------------------------------------------------- branches */

export interface BranchRow extends MasterAudit {
  id: string;
  name: string;
  companyId: string;
  city: string;
  state: string;
  country: string;
  timezone: string;
  address: string;
  headCode: string;
  headcount: number;
  phone: string;
  opened: string;
  ptState: string;
}

const BRANCH_EXTRA: Record<string, { state: string; phone: string; opened: string; pt: string }> = {
  BLR: { state: "Karnataka", phone: "+91 80 4718 2200", opened: "2016-03-14", pt: "Karnataka PT" },
  PNQ: { state: "Maharashtra", phone: "+91 20 6713 4400", opened: "2018-01-08", pt: "Maharashtra PT" },
  EWR: { state: "New Jersey", phone: "+1 973 555 0142", opened: "2021-09-01", pt: "— (US payroll)" },
  HYD: { state: "Telangana", phone: "+91 40 4851 9000", opened: "2025-11-17", pt: "Telangana PT" },
};

const branchHead = (branchId: string) =>
  [...EMPLOYEES]
    .filter((e) => e.branchId === branchId)
    .sort((a, b) => a.level - b.level || a.code.localeCompare(b.code))[0]?.code ?? "STL-0001";

export const BRANCH_ROWS: BranchRow[] = BRANCHES.map((b) => ({
  id: b.id,
  name: b.name,
  companyId: b.country === "US" ? "STL-US" : "STL-IN",
  city: b.city,
  state: BRANCH_EXTRA[b.id].state,
  country: b.countryName,
  timezone: b.timezone,
  address: b.address,
  headCode: branchHead(b.id),
  headcount: HEADCOUNT_BY_BRANCH.get(b.id) ?? 0,
  phone: BRANCH_EXTRA[b.id].phone,
  opened: BRANCH_EXTRA[b.id].opened,
  ptState: BRANCH_EXTRA[b.id].pt,
  ...audit(b.id === "HYD" ? "Girish Gowda" : undefined, b.id === "HYD" ? 9 : undefined),
}));

/* ----------------------------------------------------------- departments */

export interface DepartmentRow extends MasterAudit {
  id: string;
  name: string;
  /** null = top-level division */
  parentId: string | null;
  headCode: string;
  headcount: number;
  costCentre: string;
  isDivision: boolean;
}

const DIVISIONS = [
  { id: "TECH", name: "Technology", headCode: "STL-0004", costCentre: "CC-1000", children: ["ENG", "PRD", "DES", "ITO"] },
  { id: "REV", name: "Revenue", headCode: "STL-0005", costCentre: "CC-2000", children: ["SAL", "MKT", "CSM"] },
  { id: "CORP", name: "Corporate Functions", headCode: "STL-0008", costCentre: "CC-3000", children: ["FIN", "HR"] },
];

export const DEPARTMENT_ROWS: DepartmentRow[] = [
  ...DIVISIONS.map((d) => ({
    id: d.id,
    name: d.name,
    parentId: null,
    headCode: d.headCode,
    headcount: d.children.reduce((a, c) => a + (HEADCOUNT_BY_DEPT.get(c) ?? 0), 0),
    costCentre: d.costCentre,
    isDivision: true,
    ...audit("Priya Menon", 300),
  })),
  ...DEPARTMENTS.map((d) => ({
    id: d.id,
    name: d.name,
    parentId: DIVISIONS.find((v) => v.children.includes(d.id))!.id,
    headCode: d.headEmployeeCode,
    headcount: HEADCOUNT_BY_DEPT.get(d.id) ?? 0,
    costCentre: d.costCentre,
    isDivision: false,
    ...audit(),
  })),
];

/* ---------------------------------------------------------- designations */

export interface DesignationRow extends MasterAudit {
  id: string;
  title: string;
  departmentId: string;
  gradeId: string;
  track: "Individual contributor" | "People manager" | "Leadership";
  headcount: number;
}

export const DESIGNATION_ROWS: DesignationRow[] = (() => {
  const byKey = new Map<string, { title: string; dept: string; grades: Map<string, number>; count: number }>();
  for (const e of EMPLOYEES) {
    const k = `${e.departmentId}|${e.designation}`;
    const cur = byKey.get(k) ?? { title: e.designation, dept: e.departmentId, grades: new Map(), count: 0 };
    cur.count += 1;
    cur.grades.set(e.gradeId, (cur.grades.get(e.gradeId) ?? 0) + 1);
    byKey.set(k, cur);
  }
  const order = (dept: string, title: string) => {
    const i = (DESIGNATIONS[dept] ?? []).indexOf(title);
    return i < 0 ? 99 : i;
  };
  const rows = [...byKey.values()]
    .sort(
      (a, b) =>
        DEPARTMENTS.findIndex((d) => d.id === a.dept) - DEPARTMENTS.findIndex((d) => d.id === b.dept) ||
        order(a.dept, a.title) - order(b.dept, b.title),
    )
    .map((r, i) => {
      const gradeId = [...r.grades.entries()].sort((x, y) => y[1] - x[1])[0][0];
      const lvl = gradeById(gradeId)?.level ?? 1;
      return {
        id: `DSG-${String(i + 1).padStart(3, "0")}`,
        title: r.title,
        departmentId: r.dept,
        gradeId,
        track: (lvl >= 6 ? "Leadership" : lvl === 5 ? "People manager" : "Individual contributor") as DesignationRow["track"],
        headcount: r.count,
        ...audit(),
      };
    });
  rows.push({
    id: `DSG-${String(rows.length + 1).padStart(3, "0")}`,
    title: "Graduate Engineer Trainee",
    departmentId: "ENG",
    gradeId: "G1",
    track: "Individual contributor",
    headcount: 0,
    ...audit("Priya Menon", 61),
    active: false,
  });
  return rows;
})();

/* ---------------------------------------------------------------- grades */

export const COMPA_BUCKETS = ["< 0.80", "0.80–0.90", "0.90–1.00", "1.00–1.10", "1.10–1.20", "> 1.20"] as const;

export interface GradeRow extends MasterAudit {
  id: string;
  label: string;
  level: number;
  min: number;
  mid: number;
  max: number;
  headcount: number;
  avgCtc: number;
  avgCompa: number;
  compa: { bucket: string; count: number }[];
}

const bucketOf = (r: number) =>
  r < 0.8 ? 0 : r < 0.9 ? 1 : r < 1 ? 2 : r < 1.1 ? 3 : r < 1.2 ? 4 : 5;

export const GRADE_ROWS: GradeRow[] = GRADES.map((g) => {
  const mid = Math.round((g.minCtc + g.maxCtc) / 2);
  const people = EMPLOYEES.filter((e) => e.gradeId === g.id);
  const counts = COMPA_BUCKETS.map(() => 0);
  let ratioSum = 0;
  for (const p of people) {
    const r = p.ctc / mid;
    ratioSum += r;
    counts[bucketOf(r)] += 1;
  }
  return {
    id: g.id,
    label: g.label.split(" · ")[1] ?? g.label,
    level: g.level,
    min: g.minCtc,
    mid,
    max: g.maxCtc,
    headcount: people.length,
    avgCtc: people.length ? Math.round(people.reduce((a, p) => a + p.ctc, 0) / people.length) : 0,
    avgCompa: people.length ? ratioSum / people.length : 0,
    compa: COMPA_BUCKETS.map((b, i) => ({ bucket: b, count: counts[i] })),
    ...audit("Rahul Desai", 168),
  };
});

/* ----------------------------------------------------------------- teams */

export interface TeamRow extends MasterAudit {
  id: string;
  name: string;
  departmentId: string;
  branchId: string;
  leadCode: string;
  members: number;
  channel: string;
}

const TEAM_NAMES: Record<string, string[]> = {
  ENG: ["Payments Platform", "Core API", "Mobile Apps", "Data Platform", "Developer Experience", "Search & Discovery", "Identity & Access", "Reliability", "Integrations", "Web Experience", "Billing Engine", "Notifications", "Analytics Pipeline", "QA Automation"],
  PRD: ["Product — Core", "Product — Growth", "Product — Platform"],
  DES: ["Product Design", "Design Systems"],
  SAL: ["Enterprise Sales — South", "Enterprise Sales — West", "Mid-Market", "Inside Sales", "North America Sales", "Partnerships"],
  MKT: ["Demand Generation", "Brand & Content"],
  CSM: ["Onboarding Pod", "Support — Tier 1", "Support — Tier 2", "Renewals", "Strategic Accounts"],
  FIN: ["Accounts & Treasury", "Payroll Operations"],
  HR: ["Talent Acquisition", "People Operations"],
  ITO: ["Workplace IT", "SRE & Infrastructure", "Security Operations"],
};

export const TEAM_ROWS: TeamRow[] = (() => {
  const used = new Map<string, number>();
  const leads = EMPLOYEES.filter((e) => e.level >= 1 && reporteesOf(e.code).length >= 3).sort(
    (a, b) => a.departmentId.localeCompare(b.departmentId) || a.code.localeCompare(b.code),
  );
  return leads.map((l, i) => {
    const n = used.get(l.departmentId) ?? 0;
    used.set(l.departmentId, n + 1);
    const names = TEAM_NAMES[l.departmentId] ?? [deptName(l.departmentId)];
    const name =
      l.code === "STL-0031"
        ? "Payments Platform"
        : `${names[n % names.length]}${n >= names.length ? ` ${Math.floor(n / names.length) + 1}` : ""}`;
    return {
      id: `TM-${String(i + 1).padStart(2, "0")}`,
      name,
      departmentId: l.departmentId,
      branchId: l.branchId,
      leadCode: l.code,
      members: reporteesOf(l.code).length,
      channel: `#team-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "")}`,
      ...audit(),
    };
  });
})();

/* ---------------------------------------------------------- cost centres */

export interface CostCentreRow extends MasterAudit {
  id: string;
  name: string;
  departmentId: string;
  ownerCode: string;
  glSalary: string;
  glEmployerPf: string;
  glBonus: string;
  glReimbursement: string;
  headcount: number;
  monthlyCost: number;
  annualBudget: number;
}

export const COST_CENTRE_ROWS: CostCentreRow[] = DEPARTMENTS.map((d, i) => {
  const monthly = Math.round(
    EMPLOYEES.filter((e) => e.departmentId === d.id).reduce((a, e) => a + e.ctc, 0) / 12,
  );
  const base = 5100 + i * 10;
  return {
    id: d.costCentre,
    name: `${d.name}`,
    departmentId: d.id,
    ownerCode: d.headEmployeeCode,
    glSalary: `${base}01`,
    glEmployerPf: `${base}02`,
    glBonus: `${base}03`,
    glReimbursement: `${base}04`,
    headcount: HEADCOUNT_BY_DEPT.get(d.id) ?? 0,
    monthlyCost: monthly,
    annualBudget: Math.round((monthly * 12 * (1.04 + (i % 3) * 0.03)) / 100000) * 100000,
    ...audit(i % 2 ? "Lakshmi Pillai" : "Rahul Desai"),
  };
});

/* ------------------------------------------------------ employment types */

export interface EmploymentTypeRow extends MasterAudit {
  id: string;
  name: string;
  probationMonths: number;
  noticeDays: number;
  pf: boolean;
  esi: boolean;
  gratuity: boolean;
  leavePolicy: string;
  headcount: number;
}

const ET_COUNTS = countBy((e) => e.employmentType);

export const EMPLOYMENT_TYPE_ROWS: EmploymentTypeRow[] = [
  { id: "FT", name: "Full-time", probationMonths: 6, noticeDays: 60, pf: true, esi: true, gratuity: true, leavePolicy: "Standard — India 2026", headcount: ET_COUNTS.get("Full-time") ?? 0, ...audit("Priya Menon", 210) },
  { id: "CT", name: "Contract", probationMonths: 0, noticeDays: 15, pf: true, esi: true, gratuity: false, leavePolicy: "Contract staff", headcount: ET_COUNTS.get("Contract") ?? 0, ...audit("Priya Menon", 140) },
  { id: "IN", name: "Intern", probationMonths: 0, noticeDays: 7, pf: false, esi: false, gratuity: false, leavePolicy: "Interns (2 days / month)", headcount: ET_COUNTS.get("Intern") ?? 0, ...audit("Sana Iqbal", 96) },
  { id: "CN", name: "Consultant (retainer)", probationMonths: 0, noticeDays: 30, pf: false, esi: false, gratuity: false, leavePolicy: "Not applicable", headcount: 0, ...audit("Lakshmi Pillai", 54) },
  { id: "AP", name: "Apprentice (NAPS)", probationMonths: 0, noticeDays: 7, pf: false, esi: true, gratuity: false, leavePolicy: "Apprentices", headcount: 0, ...audit("Priya Menon", 320), active: false },
];

/* -------------------------------------------------------- work locations */

export type WorkLocationType = "Office" | "Hybrid" | "Remote";

export interface WorkLocationRow extends MasterAudit {
  id: string;
  name: string;
  type: WorkLocationType;
  branchId: string | null;
  address: string;
  lat: number | null;
  lng: number | null;
  geofenceM: number | null;
  employees: number;
}

const GEO: Record<string, [number, number]> = {
  BLR: [12.9279, 77.6822],
  PNQ: [18.5679, 73.9143],
  EWR: [40.7357, -74.1724],
  HYD: [17.441, 78.3807],
};

export const WORK_LOCATION_ROWS: WorkLocationRow[] = [
  ...BRANCHES.map((b) => ({
    id: `WL-${b.id}-OFC`,
    name: `${b.name} — office`,
    type: "Office" as const,
    branchId: b.id,
    address: b.address,
    lat: GEO[b.id][0],
    lng: GEO[b.id][1],
    geofenceM: b.id === "EWR" ? 150 : b.id === "HYD" ? 100 : 200,
    employees: EMPLOYEES.filter((e) => e.branchId === b.id && e.workMode === "On-site").length,
    ...audit("Girish Gowda"),
  })),
  ...BRANCHES.map((b) => ({
    id: `WL-${b.id}-HYB`,
    name: `${b.city} hybrid — hot desks`,
    type: "Hybrid" as const,
    branchId: b.id,
    address: `${b.address} (3 office days a week)`,
    lat: GEO[b.id][0],
    lng: GEO[b.id][1],
    geofenceM: 300,
    employees: EMPLOYEES.filter((e) => e.branchId === b.id && e.workMode === "Hybrid").length,
    ...audit("Girish Gowda"),
  })),
  {
    id: "WL-REM-IN",
    name: "Remote — India",
    type: "Remote",
    branchId: null,
    address: "Employee home address on file (India)",
    lat: null,
    lng: null,
    geofenceM: null,
    employees: EMPLOYEES.filter((e) => e.branchId !== "EWR" && e.workMode === "Remote").length,
    ...audit("Priya Menon"),
  },
  {
    id: "WL-REM-US",
    name: "Remote — United States",
    type: "Remote",
    branchId: null,
    address: "Employee home address on file (US, state tax nexus tracked)",
    lat: null,
    lng: null,
    geofenceM: null,
    employees: EMPLOYEES.filter((e) => e.branchId === "EWR" && e.workMode === "Remote").length,
    ...audit("Priya Menon"),
  },
];

/* --------------------------------------------------------------- holidays */

export type HolidayScope = "National" | "State" | "Federal" | "Company";

export interface HolidayRow extends MasterAudit {
  id: string;
  date: string;
  name: string;
  country: "IN" | "US";
  scope: HolidayScope;
  branchIds: string[];
  optional: boolean;
  /** baseline = shared country library row; override = Stellar's own row or edit */
  source: "baseline" | "override";
  note?: string;
}

/** Optional-holiday rule — employees pick this many from the optional pool. */
export const OPTIONAL_HOLIDAY_RULE = { choose: 2, poolSize: 5, deadline: "2026-01-31" };

const IN_BRANCHES = ["BLR", "PNQ", "HYD"];

export const HOLIDAY_ROWS: HolidayRow[] = (() => {
  const rows: HolidayRow[] = [];
  let n = 0;
  const add = (h: Omit<HolidayRow, "id" | keyof MasterAudit>, a: MasterAudit = audit("Priya Menon", 260)) =>
    rows.push({ id: `HOL-${String(++n).padStart(3, "0")}`, ...h, ...a });

  /* India national baseline (from the shared country library) */
  const OPTIONAL_POOL = new Set(["Makar Sankranti / Pongal", "Deepavali (second day)"]);
  for (const h of HOLIDAYS.filter((x) => x.country === "IN")) {
    if (h.name === "Ugadi" || h.name === "Dr. Ambedkar Jayanti") continue; // re-scoped below as state holidays
    add({
      date: h.date,
      name: h.name,
      country: "IN",
      scope: "National",
      branchIds: IN_BRANCHES,
      optional: OPTIONAL_POOL.has(h.name),
      source: "baseline",
    });
  }
  /* India optional pool — five to choose two from */
  add({ date: "2026-03-20", name: "Eid-ul-Fitr", country: "IN", scope: "National", branchIds: IN_BRANCHES, optional: true, source: "baseline" });
  add({ date: "2026-04-03", name: "Good Friday", country: "IN", scope: "National", branchIds: IN_BRANCHES, optional: true, source: "baseline" });
  add({ date: "2026-08-26", name: "Onam (Thiruvonam)", country: "IN", scope: "National", branchIds: IN_BRANCHES, optional: true, source: "override", note: "Added by Stellar — not in the national baseline." });

  /* State holidays per branch */
  add({ date: "2026-03-19", name: "Ugadi", country: "IN", scope: "State", branchIds: ["BLR", "HYD"], optional: false, source: "override", note: "Baseline marks Ugadi optional; Stellar makes it mandatory in Karnataka and Telangana." });
  add({ date: "2026-11-01", name: "Kannada Rajyotsava", country: "IN", scope: "State", branchIds: ["BLR"], optional: false, source: "baseline" });
  add({ date: "2026-03-19", name: "Gudi Padwa", country: "IN", scope: "State", branchIds: ["PNQ"], optional: false, source: "baseline" });
  add({ date: "2026-04-14", name: "Dr. Ambedkar Jayanti", country: "IN", scope: "State", branchIds: ["PNQ"], optional: false, source: "override", note: "Baseline marks it optional; mandatory under the Maharashtra notification." });
  add({ date: "2026-05-01", name: "Maharashtra Day", country: "IN", scope: "State", branchIds: ["PNQ"], optional: false, source: "baseline" });
  add({ date: "2026-06-02", name: "Telangana Formation Day", country: "IN", scope: "State", branchIds: ["HYD"], optional: false, source: "baseline" });
  add({ date: "2026-07-20", name: "Bonalu", country: "IN", scope: "State", branchIds: ["HYD"], optional: false, source: "baseline" });

  /* US federal for Newark */
  for (const h of HOLIDAYS.filter((x) => x.country === "US")) {
    add({ date: h.date, name: h.name, country: "US", scope: "Federal", branchIds: ["EWR"], optional: false, source: "baseline" });
  }
  add({ date: "2026-11-27", name: "Day after Thanksgiving", country: "US", scope: "Company", branchIds: ["EWR"], optional: false, source: "override", note: "Stellar Inc. company holiday." });

  /* Company-wide */
  add(
    { date: "2026-03-14", name: "Stellar Foundation Day", country: "IN", scope: "Company", branchIds: IN_BRANCHES, optional: false, source: "override", note: "Tenant holiday — 10th anniversary." },
    audit("Arjun Kapoor", 330),
  );

  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
})();

/* ------------------------------------------------------------------ shifts */

export interface ShiftRow extends MasterAudit {
  id: string;
  name: string;
  start: string;
  end: string;
  breakMin: number;
  graceMin: number;
  overnight: boolean;
  weeklyOff: string;
  /** 1–8 → var(--series-N) */
  color: number;
  timezone: string;
  employees: number;
}

/** Deterministic shift for every employee — feeds shift counts and the roster board. */
export function shiftFor(e: Employee): string {
  const n = Number(e.code.slice(4));
  if (e.branchId === "EWR") return "USE";
  if (e.departmentId === "CSM" && e.level === 3) return ["SUP-E", "SUP-M", "SUP-N"][n % 3];
  if (e.departmentId === "ITO" && e.level === 3 && n % 3 === 0) return "SUP-N";
  if (e.departmentId === "ENG" && e.level === 3 && n % 5 === 0) return "LATE";
  return "GEN";
}

const SHIFT_COUNTS = countBy((e) => shiftFor(e));

export const SHIFT_ROWS: ShiftRow[] = [
  { id: "GEN", name: "General", start: "09:30", end: "18:30", breakMin: 60, graceMin: 15, overnight: false, weeklyOff: "Sat, Sun", color: 1, timezone: "Asia/Kolkata", employees: SHIFT_COUNTS.get("GEN") ?? 0, ...audit("Priya Menon", 190) },
  { id: "LATE", name: "Late core (US overlap)", start: "11:30", end: "20:30", breakMin: 60, graceMin: 15, overnight: false, weeklyOff: "Sat, Sun", color: 6, timezone: "Asia/Kolkata", employees: SHIFT_COUNTS.get("LATE") ?? 0, ...audit("Priya Menon", 120) },
  { id: "SUP-E", name: "Support — early", start: "06:00", end: "15:00", breakMin: 45, graceMin: 10, overnight: false, weeklyOff: "Rotational (2 days)", color: 2, timezone: "Asia/Kolkata", employees: SHIFT_COUNTS.get("SUP-E") ?? 0, ...audit("Sandeep Nair", 44) },
  { id: "SUP-M", name: "Support — mid", start: "14:00", end: "23:00", breakMin: 45, graceMin: 10, overnight: false, weeklyOff: "Rotational (2 days)", color: 3, timezone: "Asia/Kolkata", employees: SHIFT_COUNTS.get("SUP-M") ?? 0, ...audit("Sandeep Nair", 44) },
  { id: "SUP-N", name: "Support — night", start: "22:00", end: "07:00", breakMin: 45, graceMin: 10, overnight: true, weeklyOff: "Rotational (2 days)", color: 7, timezone: "Asia/Kolkata", employees: SHIFT_COUNTS.get("SUP-N") ?? 0, ...audit("Sandeep Nair", 44) },
  { id: "USE", name: "US East general", start: "09:00", end: "17:30", breakMin: 30, graceMin: 10, overnight: false, weeklyOff: "Sat, Sun", color: 4, timezone: "America/New_York", employees: SHIFT_COUNTS.get("USE") ?? 0, ...audit("Priya Menon", 230) },
  { id: "WKND", name: "Weekend cover", start: "09:00", end: "18:00", breakMin: 60, graceMin: 15, overnight: false, weeklyOff: "Mon, Tue", color: 5, timezone: "Asia/Kolkata", employees: 0, ...audit("Sandeep Nair", 30) },
  { id: "RMZ", name: "Ramadan reduced hours", start: "09:30", end: "16:30", breakMin: 30, graceMin: 15, overnight: false, weeklyOff: "Sat, Sun", color: 8, timezone: "Asia/Kolkata", employees: 0, ...audit("Priya Menon", 180), active: false },
];

export const shiftById = (id: string) => SHIFT_ROWS.find((s) => s.id === id);

export const shiftHours = (s: Pick<ShiftRow, "start" | "end" | "breakMin">) => {
  const [sh, sm] = s.start.split(":").map(Number);
  const [eh, em] = s.end.split(":").map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  return (mins - s.breakMin) / 60;
};

/* ------------------------------------------------------------ shift groups */

export interface ShiftGroupRow extends MasterAudit {
  id: string;
  name: string;
  shiftIds: string[];
  rotation: "Fixed" | "Weekly" | "Fortnightly";
  branchId: string;
  members: number;
  description: string;
}

const membersOn = (ids: string[], branch?: string) =>
  EMPLOYEES.filter((e) => ids.includes(shiftFor(e)) && (!branch || e.branchId === branch)).length;

export const SHIFT_GROUP_ROWS: ShiftGroupRow[] = [
  { id: "SG-01", name: "Corporate — Bengaluru", shiftIds: ["GEN"], rotation: "Fixed", branchId: "BLR", members: membersOn(["GEN"], "BLR"), description: "Default day shift for every BLR employee without a specific assignment.", ...audit("Priya Menon", 200) },
  { id: "SG-02", name: "Corporate — Pune", shiftIds: ["GEN"], rotation: "Fixed", branchId: "PNQ", members: membersOn(["GEN"], "PNQ"), description: "Default day shift for Pune.", ...audit("Priya Menon", 200) },
  { id: "SG-03", name: "Corporate — Hyderabad", shiftIds: ["GEN"], rotation: "Fixed", branchId: "HYD", members: membersOn(["GEN"], "HYD"), description: "Satellite office, general shift only.", ...audit("Girish Gowda", 9) },
  { id: "SG-04", name: "Engineering US overlap", shiftIds: ["LATE"], rotation: "Fixed", branchId: "BLR", members: membersOn(["LATE"]), description: "Engineers paired with Newark customers — 3 hours of overlap with US East.", ...audit("Vikram Shah", 75) },
  { id: "SG-05", name: "Customer support 24×5", shiftIds: ["SUP-E", "SUP-M", "SUP-N"], rotation: "Weekly", branchId: "PNQ", members: membersOn(["SUP-E", "SUP-M", "SUP-N"]), description: "Three-shift rotation; nights rotate weekly, no one works nights two weeks running.", ...audit("Sandeep Nair", 44) },
  { id: "SG-06", name: "Newark office", shiftIds: ["USE"], rotation: "Fixed", branchId: "EWR", members: membersOn(["USE"]), description: "US East general hours, America/New_York.", ...audit("Priya Menon", 230) },
  { id: "SG-07", name: "Weekend cover pool", shiftIds: ["WKND"], rotation: "Fortnightly", branchId: "PNQ", members: 0, description: "Volunteers rostered alternate weekends; comp-off credited automatically.", ...audit("Sandeep Nair", 30), active: false },
];

/* -------------------------------------------------------- roster templates */

export const OFF = "OFF";

export interface RosterTemplateRow extends MasterAudit {
  id: string;
  name: string;
  cycleDays: 7 | 14;
  /** Mon..Sun shift codes or OFF */
  pattern: string[];
  shiftGroupId: string;
  usedBy: number;
}

export const ROSTER_TEMPLATE_ROWS: RosterTemplateRow[] = [
  { id: "RT-01", name: "5 on, 2 off — Mon to Fri", cycleDays: 7, pattern: ["GEN", "GEN", "GEN", "GEN", "GEN", OFF, OFF], shiftGroupId: "SG-01", usedBy: membersOn(["GEN"]), ...audit("Priya Menon", 210) },
  { id: "RT-02", name: "Support early — staggered off", cycleDays: 7, pattern: ["SUP-E", "SUP-E", OFF, OFF, "SUP-E", "SUP-E", "SUP-E"], shiftGroupId: "SG-05", usedBy: SHIFT_COUNTS.get("SUP-E") ?? 0, ...audit("Sandeep Nair", 44) },
  { id: "RT-03", name: "Support mid — staggered off", cycleDays: 7, pattern: ["SUP-M", "SUP-M", "SUP-M", OFF, OFF, "SUP-M", "SUP-M"], shiftGroupId: "SG-05", usedBy: SHIFT_COUNTS.get("SUP-M") ?? 0, ...audit("Sandeep Nair", 44) },
  { id: "RT-04", name: "Support night — weekend off", cycleDays: 7, pattern: ["SUP-N", "SUP-N", "SUP-N", "SUP-N", "SUP-N", OFF, OFF], shiftGroupId: "SG-05", usedBy: SHIFT_COUNTS.get("SUP-N") ?? 0, ...audit("Sandeep Nair", 44) },
  { id: "RT-05", name: "US East — Mon to Fri", cycleDays: 7, pattern: ["USE", "USE", "USE", "USE", "USE", OFF, OFF], shiftGroupId: "SG-06", usedBy: SHIFT_COUNTS.get("USE") ?? 0, ...audit("Priya Menon", 230) },
  { id: "RT-06", name: "Weekend cover — alternate", cycleDays: 7, pattern: [OFF, OFF, "GEN", "GEN", "GEN", "WKND", "WKND"], shiftGroupId: "SG-07", usedBy: 0, ...audit("Sandeep Nair", 30), active: false },
];

/* ------------------------------------------------------------ roster board */

/** Week containing DEMO_TODAY (Mon 14 Sep – Sun 20 Sep 2026) and the next one. */
export const ROSTER_WEEKS = [
  { id: "2026-09-14", label: "14 – 20 Sep 2026", published: true },
  { id: "2026-09-21", label: "21 – 27 Sep 2026", published: false },
];

export const weekDates = (weekStart: string) =>
  Array.from({ length: 7 }, (_, i) => iso(addDays(parseISO(weekStart), i)));

/** The support pod rostered on the board — real CSM employees on rotating shifts. */
export const ROSTER_EMPLOYEES: string[] = EMPLOYEES.filter((e) => ["SUP-E", "SUP-M", "SUP-N"].includes(shiftFor(e)))
  .slice(0, 14)
  .map((e) => e.code);

/** Minimum heads per shift per day; the board warns below this. */
export const ROSTER_MIN_COVER: Record<string, number> = { "SUP-E": 2, "SUP-M": 2, "SUP-N": 1 };

export type RosterGrid = Record<string, Record<string, string>>;

export function buildRoster(weekStart: string): RosterGrid {
  const dates = weekDates(weekStart);
  const nextWeek = weekStart !== ROSTER_WEEKS[0].id;
  const grid: RosterGrid = {};
  ROSTER_EMPLOYEES.forEach((code, i) => {
    const e = employeeByCode(code)!;
    let base = shiftFor(e);
    /* nights rotate weekly — next week's night crew moves to early */
    if (nextWeek) base = base === "SUP-N" ? "SUP-E" : base === "SUP-E" ? "SUP-M" : "SUP-N";
    const offA = (i * 2) % 7;
    const offB = (offA + 1) % 7;
    grid[code] = Object.fromEntries(dates.map((d, di) => [d, di === offA || di === offB ? OFF : base]));
  });
  if (!nextWeek) {
    const first = ROSTER_EMPLOYEES[3];
    if (first) grid[first][dates[4]] = "LEAVE";
  }
  return grid;
}

export interface SwapRequest {
  id: string;
  requesterCode: string;
  counterpartCode: string;
  date: string;
  fromShift: string;
  toShift: string;
  reason: string;
  raisedAt: string;
  status: "pending" | "approved" | "rejected";
}

export const SWAP_REQUESTS: SwapRequest[] = (() => {
  const g = buildRoster(ROSTER_WEEKS[0].id);
  const d = weekDates(ROSTER_WEEKS[0].id);
  const c = ROSTER_EMPLOYEES;
  const mk = (
    id: string,
    a: string,
    b: string,
    date: string,
    reason: string,
    status: SwapRequest["status"],
    raised: string,
  ): SwapRequest => ({
    id,
    requesterCode: a,
    counterpartCode: b,
    date,
    fromShift: g[a]?.[date] ?? "GEN",
    toShift: g[b]?.[date] ?? "GEN",
    reason,
    raisedAt: raised,
    status,
  });
  return [
    mk("SWP-0412", c[0], c[1], d[3], "Sister's engagement on Thursday evening — need the early shift.", "pending", "2026-09-15T18:12:00"),
    mk("SWP-0413", c[5], c[2], d[5], "Exam for the AWS certification on Saturday morning.", "pending", "2026-09-16T09:40:00"),
    mk("SWP-0414", c[7], c[8], d[6], "Visiting parents in Nashik over the weekend.", "pending", "2026-09-16T11:05:00"),
    mk("SWP-0409", c[4], c[6], d[1], "Doctor's appointment.", "approved", "2026-09-12T16:20:00"),
    mk("SWP-0407", c[9], c[10], d[0], "Personal work — no counterpart confirmation attached.", "rejected", "2026-09-11T10:02:00"),
  ];
})();

/* ======================================================= lifecycle events */

export type LifecycleType =
  | "join"
  | "confirm"
  | "transfer"
  | "promote"
  | "redesignate"
  | "deputation"
  | "suspend"
  | "reinstate"
  | "resign"
  | "terminate"
  | "retire"
  | "rehire";

export const LIFECYCLE_LABEL: Record<LifecycleType, string> = {
  join: "Join",
  confirm: "Confirmation",
  transfer: "Transfer",
  promote: "Promotion",
  redesignate: "Re-designation",
  deputation: "Deputation",
  suspend: "Suspension",
  reinstate: "Reinstatement",
  resign: "Resignation",
  terminate: "Termination",
  retire: "Retirement",
  rehire: "Rehire",
};

export type LifecycleStatus = "draft" | "pending" | "approved" | "rejected";

export interface LifecycleChange {
  field: string;
  from: string;
  to: string;
}

export interface ApprovalStep {
  step: string;
  approverCode: string;
  status: "approved" | "pending" | "rejected" | "waiting";
  at?: string;
  comment?: string;
}

export interface LifecycleEvent {
  id: string;
  employeeCode: string;
  type: LifecycleType;
  effectiveDate: string;
  changes: LifecycleChange[];
  status: LifecycleStatus;
  initiatedBy: string;
  initiatedOn: string;
  chain: ApprovalStep[];
  remarks?: string;
}

const HRBP = "STL-0009";
const deptHead = (deptId: string) => DEPARTMENTS.find((d) => d.id === deptId)?.headEmployeeCode ?? "STL-0001";
const otherBranch = (b: string) => (b === "BLR" ? "PNQ" : "BLR");
const gradeLabel = (id: string) => gradeById(id)?.label ?? id;
const prevGrade = (id: string) => `G${Math.max(1, Number(id.slice(1)) - 1)}`;
const nextGrade = (id: string) => `G${Math.min(7, Number(id.slice(1)) + 1)}`;
const desigStep = (e: Employee, delta: number) => {
  const list = DESIGNATIONS[e.departmentId] ?? [];
  const i = list.indexOf(e.designation);
  if (i < 0) return e.designation;
  return list[Math.max(0, Math.min(list.length - 1, i + delta))];
};

export const LIFECYCLE_EVENTS: LifecycleEvent[] = (() => {
  const rng = mulberry32(5150);
  const out: Omit<LifecycleEvent, "id">[] = [];

  const chainFor = (e: Employee, type: LifecycleType, status: LifecycleStatus, eff: string): ApprovalStep[] => {
    const mgr = e.managerCode ?? "STL-0001";
    const steps: ApprovalStep[] = [{ step: "Reporting manager", approverCode: mgr, status: "approved" }];
    if (["promote", "terminate", "transfer", "deputation", "retire"].includes(type))
      steps.push({ step: "Department head", approverCode: deptHead(e.departmentId) === e.code ? "STL-0001" : deptHead(e.departmentId), status: "approved" });
    steps.push({ step: "HR business partner", approverCode: HRBP, status: "approved" });
    const at = isoAt(iso(addDays(parseISO(eff), -randInt(rng, 3, 12))), "11:20");
    steps.forEach((s) => (s.at = at));
    if (status === "pending") {
      const k = Math.min(steps.length - 1, randInt(rng, 0, steps.length - 1));
      steps.forEach((s, i) => {
        if (i === k) {
          s.status = "pending";
          s.at = undefined;
        } else if (i > k) {
          s.status = "waiting";
          s.at = undefined;
        }
      });
    }
    if (status === "draft") steps.forEach((s) => ((s.status = "waiting"), (s.at = undefined)));
    if (status === "rejected") {
      const last = steps[steps.length - 1];
      last.status = "rejected";
      last.comment = "Budget for the role is frozen until the H2 plan is signed off — resubmit in October.";
    }
    return steps;
  };

  const push = (e: Employee, type: LifecycleType, eff: string, changes: LifecycleChange[], status: LifecycleStatus, by = "STL-0058", remarks?: string) =>
    out.push({
      employeeCode: e.code,
      type,
      effectiveDate: eff,
      changes,
      status,
      initiatedBy: by,
      initiatedOn: iso(addDays(parseISO(eff) < TODAY ? parseISO(eff) : TODAY, -randInt(rng, 4, 20))),
      chain: chainFor(e, type, status, eff),
      remarks,
    });

  const active = EMPLOYEES.filter((e) => e.status !== "exited");

  /* joins (and one rehire) this calendar year */
  const joiners = active.filter((e) => e.joiningDate >= "2026-01-01" && e.joiningDate <= DEMO_TODAY);
  joiners.forEach((e, i) =>
    push(
      e,
      i === 2 ? "rehire" : "join",
      e.joiningDate,
      [
        { field: "Status", from: i === 2 ? "Alumni (exited 2022-08-31)" : "Candidate", to: "Probation" },
        { field: "Designation", from: "—", to: e.designation },
        { field: "Grade", from: "—", to: gradeLabel(e.gradeId) },
        { field: "Annual CTC", from: "—", to: inr(e.ctc) },
      ],
      "approved",
      "STL-0058",
      i === 2 ? "Boomerang hire — previous tenure 2019-04-01 to 2022-08-31, gratuity continuity not carried." : undefined,
    ),
  );

  /* confirmations: done this year, and coming up in the next 45 days */
  active
    .filter((e) => e.confirmationDate && e.confirmationDate >= "2026-01-01" && e.confirmationDate <= DEMO_TODAY)
    .slice(0, 16)
    .forEach((e) =>
      push(e, "confirm", e.confirmationDate!, [{ field: "Status", from: "Probation", to: "Confirmed" }, { field: "Notice period", from: "15 days", to: "60 days" }], "approved", HRBP),
    );
  active
    .filter((e) => e.status === "probation")
    .map((e) => ({ e, due: iso(addDays(parseISO(e.joiningDate), 180)) }))
    .filter(({ due }) => due > DEMO_TODAY && differenceInDays(parseISO(due), TODAY) <= 45)
    .slice(0, 6)
    .forEach(({ e, due }) =>
      push(e, "confirm", due, [{ field: "Status", from: "Probation", to: "Confirmed" }, { field: "Notice period", from: "15 days", to: "60 days" }], "pending", e.managerCode ?? HRBP),
    );

  /* promotions — April appraisal cycle (approved) and October off-cycle (pending) */
  const promotable = active.filter((e) => e.level >= 2 && e.gradeId !== "G1" && e.gradeId !== "G7" && e.joiningDate < "2024-01-01");
  for (let i = 0; i < 14; i++) {
    const e = promotable[(i * 17 + 5) % promotable.length];
    if (out.some((o) => o.employeeCode === e.code)) continue;
    push(e, "promote", "2026-04-01", [
      { field: "Designation", from: desigStep(e, -1), to: e.designation },
      { field: "Grade", from: gradeLabel(prevGrade(e.gradeId)), to: gradeLabel(e.gradeId) },
      { field: "Annual CTC", from: inr(Math.round(e.ctc / 1.14 / 1000) * 1000), to: inr(e.ctc) },
    ], "approved", e.managerCode ?? HRBP);
  }
  const offCycle = active.filter((e) => e.level === 3 && e.gradeId !== "G7" && e.status === "active");
  for (let i = 0; i < 5; i++) {
    const e = offCycle[(i * 29 + 11) % offCycle.length];
    if (out.some((o) => o.employeeCode === e.code)) continue;
    push(e, "promote", "2026-10-01", [
      { field: "Designation", from: e.designation, to: desigStep(e, 1) },
      { field: "Grade", from: gradeLabel(e.gradeId), to: gradeLabel(nextGrade(e.gradeId)) },
      { field: "Annual CTC", from: inr(e.ctc), to: inr(Math.round((e.ctc * 1.15) / 1000) * 1000) },
    ], i === 4 ? "rejected" : "pending", e.managerCode ?? HRBP);
  }

  /* transfers */
  const movable = active.filter((e) => e.level === 3 && (e.branchId === "BLR" || e.branchId === "PNQ"));
  for (let i = 0; i < 9; i++) {
    const e = movable[(i * 37 + 3) % movable.length];
    if (out.some((o) => o.employeeCode === e.code)) continue;
    const past = i < 6;
    const from = past ? otherBranch(e.branchId) : e.branchId;
    const to = past ? e.branchId : otherBranch(e.branchId);
    const eff = past ? iso(addDays(TODAY, -randInt(rng, 20, 220))) : iso(addDays(TODAY, randInt(rng, 10, 40)));
    push(e, "transfer", eff, [
      { field: "Branch", from: branchById(from)!.name, to: branchById(to)!.name },
      { field: "Work calendar", from: from === "BLR" ? "Karnataka 2026" : "Maharashtra 2026", to: to === "BLR" ? "Karnataka 2026" : "Maharashtra 2026" },
      { field: "Professional tax state", from: BRANCH_EXTRA[from].pt, to: BRANCH_EXTRA[to].pt },
    ], past ? "approved" : i === 8 ? "draft" : "pending", HRBP);
  }

  /* re-designations */
  const redes = active.filter((e) => e.level === 3 && e.departmentId !== "ENG");
  for (let i = 0; i < 4; i++) {
    const e = redes[(i * 13 + 7) % redes.length];
    if (out.some((o) => o.employeeCode === e.code)) continue;
    push(e, "redesignate", iso(addDays(TODAY, i < 3 ? -randInt(rng, 15, 150) : 14)), [
      { field: "Designation", from: desigStep(e, -1) === e.designation ? `${e.designation} (old title)` : desigStep(e, -1), to: e.designation },
    ], i < 3 ? "approved" : "pending", HRBP, "Title harmonisation — no change to grade or pay.");
  }

  /* deputation — BLR engineers to the Newark client site */
  const dep = active.filter((e) => e.departmentId === "ENG" && e.branchId === "BLR" && e.level === 3);
  [dep[4], dep[19]].filter(Boolean).forEach((e, i) => {
    if (out.some((o) => o.employeeCode === e.code)) return;
    push(e, "deputation", i === 0 ? "2026-08-03" : "2026-10-05", [
      { field: "Deputed to", from: "—", to: "Newark NJ (client site — Meridian Health)" },
      { field: "Duration", from: "—", to: i === 0 ? "3 months (till 2026-11-02)" : "6 months (till 2027-04-04)" },
      { field: "Allowance", from: "—", to: "USD 85 / day per diem" },
    ], i === 0 ? "approved" : "pending", "STL-0031");
  });

  /* suspension + reinstatement pair */
  const sal = active.filter((e) => e.departmentId === "SAL" && e.level === 3 && e.status === "active");
  const s = sal[6];
  if (s) {
    push(s, "suspend", "2026-06-10", [{ field: "Status", from: "Active", to: "Suspended (pending inquiry)" }, { field: "Payroll", from: "Full pay", to: "Subsistence allowance — 50%" }], "approved", HRBP, "Expense-claim irregularity under internal inquiry (case IC-2026-004).");
    push(s, "reinstate", "2026-07-02", [{ field: "Status", from: "Suspended", to: "Active" }, { field: "Payroll", from: "Subsistence allowance — 50%", to: "Full pay, arrears released" }], "approved", HRBP, "Inquiry closed — no misconduct established.");
  }

  /* resignations / termination from the notice-period employees */
  active
    .filter((e) => e.status === "notice")
    .forEach((e) => {
      const terminate = e.exitReason === "Performance";
      push(e, terminate ? "terminate" : "resign", e.exitDate ?? DEMO_TODAY, [
        { field: "Status", from: "Active", to: terminate ? "Separated (terminated)" : "Notice period" },
        { field: "Last working day", from: "—", to: e.exitDate ?? "—" },
        { field: "Reason", from: "—", to: e.exitReason ?? "Personal reasons" },
      ], terminate ? "pending" : "approved", terminate ? HRBP : e.managerCode ?? HRBP);
    });

  /* retirement — the oldest employee reaches 58 */
  const oldest = [...active].sort((a, b) => a.dob.localeCompare(b.dob))[0];
  if (oldest) {
    const age = differenceInYears(TODAY, parseISO(oldest.dob));
    push(oldest, "retire", "2026-12-31", [
      { field: "Status", from: "Active", to: "Retired" },
      { field: "Age at retirement", from: `${age}`, to: `${age + 1} (superannuation)` },
      { field: "Gratuity", from: "—", to: "Eligible — Payment of Gratuity Act" },
    ], "pending", HRBP);
  }

  return out
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate) || a.employeeCode.localeCompare(b.employeeCode))
    .map((e, i, arr) => ({ ...e, id: `LCE-26-${String(arr.length - i).padStart(4, "0")}` }));
})();

/** Downstream impact preview for the Record-event wizard. */
export function lifecycleImpact(e: Employee, type: LifecycleType) {
  const mgr = e.managerCode ? employeeByCode(e.managerCode) : undefined;
  const n = Number(e.code.slice(4));
  const pendingLeave = (n % 4) + 1;
  const pendingExpense = n % 3;
  const items: { area: string; detail: string; tone: "info" | "warning" | "success" }[] = [];
  if (["promote", "redesignate", "rehire", "join"].includes(type))
    items.push({ area: "Payroll structure", detail: "New salary structure takes effect from the effective date; arrears auto-computed in the next pay run.", tone: "info" });
  if (["transfer", "deputation"].includes(type)) {
    items.push({ area: "Reporting line", detail: `Manager changes from ${mgr?.name ?? "—"} to the receiving branch's lead.`, tone: "warning" });
    items.push({ area: "Re-approval sweep", detail: `${pendingLeave} pending leave request${pendingLeave === 1 ? "" : "s"} and ${pendingExpense} expense claim${pendingExpense === 1 ? "" : "s"} will move to the new manager.`, tone: "warning" });
    items.push({ area: "Work calendar & PT", detail: "Holiday calendar and professional-tax state re-resolved and stamped on the event.", tone: "info" });
  }
  if (["resign", "terminate", "retire"].includes(type)) {
    items.push({ area: "Exit workflow", detail: "Clearance checklist opened for IT, Finance, Admin and the reporting manager.", tone: "info" });
    items.push({ area: "Re-approval sweep", detail: `${pendingLeave} pending leave request${pendingLeave === 1 ? "" : "s"} will be routed to ${mgr?.name ?? "HR"} for final decision.`, tone: "warning" });
    items.push({ area: "Full & final", detail: "F&F settlement scheduled for the payroll cycle after the last working day.", tone: "info" });
  }
  if (type === "suspend") items.push({ area: "Access", detail: "SSO, VPN and building access suspended at 00:00 on the effective date.", tone: "warning" });
  if (type === "confirm") items.push({ area: "Leave policy", detail: "Full annual leave entitlement unlocked; notice period moves to 60 days.", tone: "success" });
  if (type === "promote") items.push({ area: "Reporting line", detail: "No change — stays with the current manager.", tone: "success" });
  if (type === "reinstate") items.push({ area: "Payroll", detail: "Subsistence-allowance difference released as arrears.", tone: "success" });
  items.push({ area: "Letters", detail: "Matching letter drafted from the template library for HR to issue.", tone: "info" });
  return items;
}

/* ============================================================== documents */

export type DocType =
  | "PAN card"
  | "Aadhaar"
  | "Passport"
  | "Degree certificate"
  | "Previous employer relieving letter"
  | "Cancelled cheque"
  | "US work authorization (I-9)"
  | "Driving licence";

export type DocStatus = "pending" | "verified" | "rejected" | "expired";

export interface EmployeeDocument {
  id: string;
  employeeCode: string;
  type: DocType;
  number: string;
  expiry: string | null;
  status: DocStatus;
  uploadedOn: string;
  verifiedBy?: string;
  rejectReason?: string;
  fileName: string;
  sizeKb: number;
}

const REJECT_REASONS = [
  "Scan is blurred — the document number is not legible.",
  "Name on the document does not match the employee record.",
  "Only the front side was uploaded.",
];

export const DOCUMENTS: EmployeeDocument[] = (() => {
  const rng = mulberry32(9009);
  const out: EmployeeDocument[] = [];
  let n = 0;
  EMPLOYEES.filter((_, i) => i % 3 === 0).forEach((e, ei) => {
    const us = e.branchId === "EWR";
    const recent = differenceInDays(TODAY, parseISO(e.joiningDate)) <= 75;
    const types: DocType[] = us
      ? ["US work authorization (I-9)", "Passport", "Degree certificate"]
      : ["PAN card", "Aadhaar", "Degree certificate", "Cancelled cheque"];
    if (!us && ei % 3 === 0) types.push("Passport");
    if (!us && ei % 7 === 0) types.push("Driving licence");
    if (e.joiningDate >= "2023-01-01") types.push("Previous employer relieving letter");
    types.forEach((t, ti) => {
      n += 1;
      const last4 = String(randInt(rng, 1000, 9999));
      const number =
        t === "PAN card"
          ? `•••••${e.pan.slice(5)}`
          : t === "Aadhaar"
            ? `XXXX XXXX ${last4}`
            : t === "Passport"
              ? `${String.fromCharCode(65 + (n % 26))}•••${last4}`
              : t === "Cancelled cheque"
                ? `A/c ••••${e.bankAccountLast4}`
                : t === "US work authorization (I-9)"
                  ? `USCIS ••••${last4}`
                  : t === "Driving licence"
                    ? `KA01 •••• ${last4}`
                    : `Ref ${last4}`;
      let expiry: string | null = null;
      if (t === "Passport" || t === "US work authorization (I-9)" || t === "Driving licence") {
        const soon = (ei + ti) % 6 === 0;
        expiry = soon ? iso(addDays(TODAY, ((ei * 7) % 29) + 1)) : iso(addDays(TODAY, randInt(rng, -40, 2400)));
      }
      const uploadedOn = iso(addDays(parseISO(e.joiningDate), -randInt(rng, 2, 10)));
      let status: DocStatus = recent && rng() < 0.75 ? "pending" : "verified";
      if (status === "verified" && rng() < 0.025) status = "rejected";
      if (status === "verified" && ei % 23 === 5 && ti === 1) status = "pending";
      if (expiry && expiry < DEMO_TODAY) status = "expired";
      out.push({
        id: `DOC-${String(n).padStart(5, "0")}`,
        employeeCode: e.code,
        type: t,
        number,
        expiry,
        status,
        uploadedOn: uploadedOn > DEMO_TODAY ? DEMO_TODAY : uploadedOn,
        verifiedBy: status === "verified" || status === "expired" ? pick(rng, ["Priya Menon", "Sana Iqbal"]) : status === "rejected" ? "Priya Menon" : undefined,
        rejectReason: status === "rejected" ? pick(rng, REJECT_REASONS) : undefined,
        fileName: `${e.code}_${t.split(" ")[0].toLowerCase()}.pdf`,
        sizeKb: randInt(rng, 140, 2200),
      });
    });
  });
  return out;
})();

/* ================================================================ letters */

export type LetterType =
  | "offer"
  | "appointment"
  | "confirmation"
  | "increment"
  | "transfer"
  | "warning"
  | "relieving"
  | "experience";

export const LETTER_LABEL: Record<LetterType, string> = {
  offer: "Offer letter",
  appointment: "Appointment letter",
  confirmation: "Confirmation letter",
  increment: "Increment letter",
  transfer: "Transfer letter",
  warning: "Warning letter",
  relieving: "Relieving letter",
  experience: "Experience certificate",
};

export const MERGE_TOKENS: { token: string; label: string }[] = [
  { token: "{{employee.name}}", label: "Full name" },
  { token: "{{employee.first_name}}", label: "First name" },
  { token: "{{employee.code}}", label: "Employee code" },
  { token: "{{designation}}", label: "Current designation" },
  { token: "{{department}}", label: "Department" },
  { token: "{{branch}}", label: "Branch" },
  { token: "{{grade}}", label: "Grade" },
  { token: "{{ctc}}", label: "Annual CTC (INR)" },
  { token: "{{joining_date}}", label: "Date of joining" },
  { token: "{{effective_date}}", label: "Effective date" },
  { token: "{{manager.name}}", label: "Reporting manager" },
  { token: "{{new.designation}}", label: "New designation" },
  { token: "{{new.ctc}}", label: "New annual CTC" },
  { token: "{{new.branch}}", label: "New branch" },
  { token: "{{last_working_day}}", label: "Last working day" },
  { token: "{{company.name}}", label: "Company name" },
  { token: "{{today}}", label: "Letter date" },
];

export interface LetterTemplate extends MasterAudit {
  id: string;
  type: LetterType;
  name: string;
  version: number;
  subject: string;
  body: string;
  versions: { version: number; at: string; by: string; note: string }[];
}

const T_BODY: Record<LetterType, { subject: string; body: string }> = {
  offer: {
    subject: "Offer of employment — {{designation}}",
    body: "Dear {{employee.first_name}},\n\nWe are delighted to offer you the position of {{designation}} in our {{department}} team at {{branch}}, at grade {{grade}}. Your annual cost to company will be {{ctc}}, as detailed in Annexure A.\n\nWe would like you to join us on {{effective_date}}. You will report to {{manager.name}}. This offer is subject to satisfactory background verification and submission of the documents listed in Annexure B.\n\nPlease sign and return a copy of this letter within seven days to confirm your acceptance.",
  },
  appointment: {
    subject: "Letter of appointment",
    body: "Dear {{employee.name}},\n\nFurther to your acceptance of our offer, we are pleased to appoint you as {{designation}} ({{grade}}) with effect from {{effective_date}}, employee code {{employee.code}}.\n\nYou will be on probation for six months, during which either party may end the employment with fifteen days' notice. On confirmation, the notice period becomes sixty days. Your annual cost to company is {{ctc}}.\n\nYour terms of employment are governed by the Employee Handbook and the policies published on the HRMS, as amended from time to time.",
  },
  confirmation: {
    subject: "Confirmation of employment",
    body: "Dear {{employee.first_name}},\n\nWe are pleased to inform you that, on successful completion of your probation, your employment as {{designation}} is confirmed with effect from {{effective_date}}.\n\nYour notice period now stands at sixty days, and you are entitled to the full benefits applicable to confirmed employees. {{manager.name}} has shared feedback on your first six months, and we look forward to your continued contribution.",
  },
  increment: {
    subject: "Revision in compensation",
    body: "Dear {{employee.first_name}},\n\nIn recognition of your performance in the 2025-26 review cycle, we are pleased to revise your designation to {{new.designation}} and your annual cost to company from {{ctc}} to {{new.ctc}}, with effect from {{effective_date}}.\n\nThe revised salary structure is enclosed. All other terms of your employment remain unchanged. Thank you for your contribution to {{department}}.",
  },
  transfer: {
    subject: "Transfer of location",
    body: "Dear {{employee.first_name}},\n\nConsequent to business requirements, you are transferred from {{branch}} to {{new.branch}} with effect from {{effective_date}}, in your current capacity as {{designation}}.\n\nThe holiday calendar and statutory deductions applicable to {{new.branch}} will apply from the effective date. Relocation support is available as per the Relocation Policy; please contact the People team to plan your move.",
  },
  warning: {
    subject: "Letter of warning",
    body: "Dear {{employee.name}},\n\nThis letter records our concern about repeated unapproved absences in the last quarter, discussed with you by {{manager.name}}.\n\nYou are advised to adhere to the attendance policy. Any further instance may result in disciplinary action as per the Code of Conduct. You may submit a written response within seven days of this letter.",
  },
  relieving: {
    subject: "Relieving letter",
    body: "Dear {{employee.name}},\n\nThis is to confirm that your resignation has been accepted and you are relieved from the services of {{company.name}} at the close of business on {{last_working_day}}.\n\nYour full and final settlement will be processed in the following payroll cycle. We thank you for your contribution and wish you the very best.",
  },
  experience: {
    subject: "Experience certificate",
    body: "To whom it may concern,\n\nThis is to certify that {{employee.name}} (employee code {{employee.code}}) was employed with {{company.name}} from {{joining_date}} to {{last_working_day}}. At the time of leaving, {{employee.first_name}} held the position of {{designation}} in the {{department}} department.\n\nDuring this tenure we found {{employee.first_name}} sincere and diligent. We wish {{employee.first_name}} success in all future endeavours.",
  },
};

export const LETTER_TEMPLATES: LetterTemplate[] = (Object.keys(T_BODY) as LetterType[]).map((t, i) => {
  const version = [4, 3, 2, 5, 2, 1, 3, 2][i];
  return {
    id: `TPL-${String(i + 1).padStart(2, "0")}`,
    type: t,
    name: `${LETTER_LABEL[t]} — standard`,
    version,
    subject: T_BODY[t].subject,
    body: T_BODY[t].body,
    versions: Array.from({ length: version }, (_, v) => ({
      version: version - v,
      at: isoAt(iso(addDays(TODAY, -(v * 97 + 12 + i * 3))), "15:10"),
      by: v % 2 ? "Sana Iqbal" : "Priya Menon",
      note:
        v === version - 1
          ? "Initial version"
          : ["Legal review — updated notice clause", "Added Annexure references", "Tone pass and new letterhead", "Statutory wording for PoSH added"][v % 4],
    })),
    ...audit(i % 2 ? "Sana Iqbal" : "Priya Menon", 12 + i * 3),
  };
});

/** Fills every merge token for a real employee. */
export function renderLetter(body: string, e: Employee, effectiveDate: string) {
  const mgr = e.managerCode ? employeeByCode(e.managerCode) : undefined;
  const fmt = (d: string) => format(parseISO(d), "dd MMM yyyy");
  const map: Record<string, string> = {
    "employee.name": e.name,
    "employee.first_name": e.firstName,
    "employee.code": e.code,
    designation: e.designation,
    department: deptName(e.departmentId),
    branch: branchById(e.branchId)?.name ?? e.branchId,
    grade: gradeById(e.gradeId)?.label ?? e.gradeId,
    ctc: inr(e.ctc),
    joining_date: fmt(e.joiningDate),
    effective_date: fmt(effectiveDate),
    "manager.name": mgr?.name ?? "the People team",
    "new.designation": desigStep(e, 1),
    "new.ctc": inr(Math.round((e.ctc * 1.12) / 1000) * 1000),
    "new.branch": branchById(otherBranch(e.branchId))?.name ?? "—",
    last_working_day: fmt(e.exitDate ?? effectiveDate),
    "company.name": e.branchId === "EWR" ? "Stellar Technologies Inc." : TENANT.name,
    today: fmt(DEMO_TODAY),
  };
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, k: string) => map[k] ?? m);
}

export type LetterStatus = "draft" | "issued" | "acknowledged";

export interface GeneratedLetter {
  id: string;
  type: LetterType;
  templateId: string;
  employeeCode: string;
  effectiveDate: string;
  generatedOn: string;
  status: LetterStatus;
  issuedBy: string;
  version: number;
}

const LIFECYCLE_TO_LETTER: Partial<Record<LifecycleType, LetterType[]>> = {
  join: ["offer", "appointment"],
  rehire: ["offer", "appointment"],
  confirm: ["confirmation"],
  promote: ["increment"],
  transfer: ["transfer"],
  resign: ["relieving", "experience"],
};

export const LETTERS: GeneratedLetter[] = (() => {
  const out: Omit<GeneratedLetter, "id">[] = [];
  for (const ev of LIFECYCLE_EVENTS) {
    if (ev.status === "rejected" || ev.status === "draft") continue;
    const types = LIFECYCLE_TO_LETTER[ev.type] ?? [];
    types.forEach((t, k) => {
      const tpl = LETTER_TEMPLATES.find((x) => x.type === t)!;
      const future = ev.effectiveDate > DEMO_TODAY;
      const genDate = t === "offer" ? iso(addDays(parseISO(ev.effectiveDate), -30)) : iso(addDays(parseISO(ev.effectiveDate), future ? -12 : -2));
      const status: LetterStatus =
        ev.status === "pending" || (future && k > 0) ? "draft" : future ? "issued" : Number(ev.employeeCode.slice(4)) % 5 === 0 ? "issued" : "acknowledged";
      out.push({
        type: t,
        templateId: tpl.id,
        employeeCode: ev.employeeCode,
        effectiveDate: ev.effectiveDate,
        generatedOn: genDate > DEMO_TODAY ? DEMO_TODAY : genDate,
        status,
        issuedBy: t === "offer" ? "Sana Iqbal" : "Priya Menon",
        version: tpl.version,
      });
    });
  }
  const warned = EMPLOYEES.filter((e) => e.departmentId === "CSM" && e.level === 3)[5];
  if (warned)
    out.push({ type: "warning", templateId: "TPL-06", employeeCode: warned.code, effectiveDate: "2026-08-21", generatedOn: "2026-08-21", status: "acknowledged", issuedBy: "Priya Menon", version: 1 });
  return out
    .sort((a, b) => b.generatedOn.localeCompare(a.generatedOn))
    .map((l, i, arr) => ({ ...l, id: `LTR-26-${String(arr.length - i).padStart(4, "0")}` }));
})();

