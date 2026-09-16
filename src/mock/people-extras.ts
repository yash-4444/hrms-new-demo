import { addDays, addMonths, differenceInMonths, format, parseISO, startOfMonth, subMonths } from "date-fns";
import { mulberry32, pick, randInt } from "@/lib/utils";
import { BRANCHES, DEMO_TODAY, DEPARTMENTS, deptName, gradeById } from "./org";
import { EMPLOYEES, employeeByCode, employeeName, type Employee } from "./employees";

/* ============================================================================
   People-module extras — everything the directory and the profile tabs need
   that is NOT core employee identity.

   Owned by the People module only. Attendance, leave, payroll, growth and
   workplace each own their own fixture file; the per-employee summaries below
   are deliberately small, self-contained roll-ups for the profile tabs and do
   not import from those modules.

   Every figure is generated from a fixed seed derived from the employee code,
   so SSR and the client agree and a number never moves between renders.
   ========================================================================== */

const TODAY = parseISO(DEMO_TODAY);

/** Stable per-employee seed: STL-0142 -> 142. */
function seedFor(code: string, salt: number) {
  const n = Number(code.replace(/\D/g, "")) || 1;
  return (n * 7919 + salt) >>> 0;
}

/** Lazily build + memoise a per-employee fixture so 340 people stay cheap. */
function memoPerEmployee<T>(build: (emp: Employee) => T) {
  const cache = new Map<string, T>();
  return (code: string): T | undefined => {
    const hit = cache.get(code);
    if (hit) return hit;
    const emp = employeeByCode(code);
    if (!emp) return undefined;
    const built = build(emp);
    cache.set(code, built);
    return built;
  };
}

const iso = (d: Date) => format(d, "yyyy-MM-dd");

/* ========================================================== directory stats */

/** The four KPI tiles above the directory, each one drillable. */
export const DIRECTORY_STATS = (() => {
  const active = EMPLOYEES.filter((e) => e.status !== "exited");
  const thisMonth = format(TODAY, "yyyy-MM");
  const lastMonth = format(subMonths(TODAY, 1), "yyyy-MM");
  const joinersThisMonth = active.filter((e) => e.joiningDate.startsWith(thisMonth)).length;
  const joinersLastMonth = active.filter((e) => e.joiningDate.startsWith(lastMonth)).length;
  const tenureYears =
    active.reduce((a, e) => a + differenceInMonths(TODAY, parseISO(e.joiningDate)) / 12, 0) /
    Math.max(1, active.length);
  return {
    headcount: active.length,
    joinersThisMonth,
    joinersLastMonth,
    joinerDeltaPct:
      joinersLastMonth === 0 ? 0 : ((joinersThisMonth - joinersLastMonth) / joinersLastMonth) * 100,
    onNotice: active.filter((e) => e.status === "notice").length,
    onProbation: active.filter((e) => e.status === "probation").length,
    avgTenureYears: tenureYears,
  };
})();

/** Headcount by department, in DEPARTMENTS order — used by the directory chart. */
export const HEADCOUNT_BY_DEPARTMENT = DEPARTMENTS.map((d) => ({
  id: d.id,
  name: d.name,
  headcount: EMPLOYEES.filter((e) => e.departmentId === d.id && e.status !== "exited").length,
}));

/** Every designation currently in use, de-duplicated and sorted. */
export const ALL_DESIGNATIONS = Array.from(new Set(EMPLOYEES.map((e) => e.designation))).sort();

/* ================================================================ documents */

export type DocumentStatus = "approved" | "pending" | "expired" | "rejected";
export type DocumentCategory = "Identity" | "Education" | "Employment" | "Compliance" | "Payroll";

export interface EmployeeDocument {
  id: string;
  employeeCode: string;
  name: string;
  category: DocumentCategory;
  fileName: string;
  sizeKb: number;
  uploadedOn: string;
  expiresOn: string | null;
  status: DocumentStatus;
  uploadedBy: string;
  verifiedBy: string | null;
}

interface DocSpec {
  name: string;
  category: DocumentCategory;
  ext: string;
  /** Probability the employee has this document at all. */
  chance: number;
  /** Validity in days; null = never expires. */
  validityDays: number | null;
}

const DOC_SPECS: DocSpec[] = [
  { name: "Aadhaar card", category: "Identity", ext: "pdf", chance: 1, validityDays: null },
  { name: "PAN card", category: "Identity", ext: "pdf", chance: 1, validityDays: null },
  { name: "Passport", category: "Identity", ext: "pdf", chance: 0.55, validityDays: 3650 },
  { name: "Signed offer letter", category: "Employment", ext: "pdf", chance: 1, validityDays: null },
  { name: "Appointment letter", category: "Employment", ext: "pdf", chance: 1, validityDays: null },
  { name: "Relieving letter — previous employer", category: "Employment", ext: "pdf", chance: 0.82, validityDays: null },
  { name: "Degree certificate", category: "Education", ext: "pdf", chance: 0.94, validityDays: null },
  { name: "Consolidated marks sheet", category: "Education", ext: "pdf", chance: 0.71, validityDays: null },
  { name: "POSH policy acknowledgement", category: "Compliance", ext: "pdf", chance: 0.96, validityDays: 365 },
  { name: "Code of conduct acknowledgement", category: "Compliance", ext: "pdf", chance: 0.93, validityDays: 365 },
  { name: "Background verification report", category: "Compliance", ext: "pdf", chance: 0.68, validityDays: null },
  { name: "Cancelled cheque", category: "Payroll", ext: "jpg", chance: 0.88, validityDays: null },
  { name: "Form 16 — FY 2025-26", category: "Payroll", ext: "pdf", chance: 0.61, validityDays: null },
  { name: "Investment declaration", category: "Payroll", ext: "pdf", chance: 0.74, validityDays: 365 },
];

const HR_VERIFIERS = ["Priya Menon", "Sana Iqbal", "Rashmi Sinha", "Harini Pillai"];

export const documentsFor = memoPerEmployee((emp): EmployeeDocument[] => {
  const rng = mulberry32(seedFor(emp.code, 11));
  const joined = parseISO(emp.joiningDate);
  const docs: EmployeeDocument[] = [];

  DOC_SPECS.forEach((spec, i) => {
    if (rng() > spec.chance) return;
    const uploaded = addDays(joined, randInt(rng, 0, 45));
    if (uploaded > TODAY) return;
    const expires = spec.validityDays ? addDays(uploaded, spec.validityDays) : null;

    let status: DocumentStatus = "approved";
    if (expires && expires < TODAY) status = "expired";
    else {
      const r = rng();
      if (r > 0.93) status = "pending";
      else if (r > 0.90) status = "rejected";
    }

    docs.push({
      id: `${emp.code}-DOC-${String(i + 1).padStart(2, "0")}`,
      employeeCode: emp.code,
      name: spec.name,
      category: spec.category,
      fileName: `${emp.code}_${spec.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}.${spec.ext}`,
      sizeKb: randInt(rng, 64, 4200),
      uploadedOn: iso(uploaded),
      expiresOn: expires ? iso(expires) : null,
      status,
      uploadedBy: rng() > 0.35 ? emp.name : pick(rng, HR_VERIFIERS),
      verifiedBy: status === "pending" ? null : pick(rng, HR_VERIFIERS),
    });
  });

  return docs.sort((a, b) => b.uploadedOn.localeCompare(a.uploadedOn));
});

/* ============================================================ compensation */

export interface CompensationBreakup {
  basic: number;
  hra: number;
  lta: number;
  specialAllowance: number;
  variablePay: number;
  employerPf: number;
  gratuity: number;
  /** basic + hra + lta + special + variable + pf + gratuity — equals ctcAnnual exactly. */
  ctcAnnual: number;
  grossMonthly: number;
}

/**
 * Indian CTC split that reconciles to the rupee: special allowance is the
 * balancing figure, so the column always adds up to the employee's CTC.
 */
export function compensationBreakup(ctc: number, gradeId: string): CompensationBreakup {
  const grade = gradeById(gradeId);
  const basic = Math.round(ctc * 0.4);
  const hra = Math.round(basic * 0.5);
  const lta = Math.round(basic * 0.0833);
  const employerPf = Math.min(Math.round(basic * 0.12), 21600); // ₹1,800/month statutory cap
  const gratuity = Math.round(basic * 0.0481);
  const variablePay = (grade?.level ?? 1) >= 4 ? Math.round(ctc * 0.1) : 0;
  const specialAllowance = ctc - (basic + hra + lta + employerPf + gratuity + variablePay);
  return {
    basic,
    hra,
    lta,
    specialAllowance,
    variablePay,
    employerPf,
    gratuity,
    ctcAnnual: ctc,
    grossMonthly: Math.round((basic + hra + lta + specialAllowance) / 12),
  };
}

export type RevisionReason =
  | "Annual appraisal"
  | "Promotion"
  | "Market correction"
  | "Retention adjustment"
  | "Joining offer";

export interface CompensationRevision {
  id: string;
  employeeCode: string;
  effectiveFrom: string;
  reason: RevisionReason;
  previousCtc: number;
  newCtc: number;
  hikePct: number;
  approvedBy: string;
  note: string;
}

/**
 * Revision history, built BACKWARDS from the employee's current CTC so the
 * latest row always equals what the header and payroll screens show.
 */
export const compensationHistoryFor = memoPerEmployee((emp): CompensationRevision[] => {
  const rng = mulberry32(seedFor(emp.code, 23));
  const joined = parseISO(emp.joiningDate);
  /* Appraisals land on 1 April — Stellar runs an Apr–Mar cycle. */
  const cycles: Date[] = [];
  let cursor = parseISO(`${joined.getFullYear() + (joined.getMonth() >= 3 ? 1 : 0)}-04-01`);
  while (cursor <= TODAY) {
    if (differenceInMonths(cursor, joined) >= 9) cycles.push(cursor);
    cursor = addMonths(cursor, 12);
  }

  const approver = emp.level <= 1 ? "Arjun Kapoor" : emp.level === 2 ? "Priya Menon" : employeeName(emp.managerCode);
  const rows: CompensationRevision[] = [];
  let ctc = emp.ctc;

  for (let i = cycles.length - 1; i >= 0; i--) {
    const promotion = rng() > 0.78;
    const hikePct = promotion ? randInt(rng, 18, 31) : randInt(rng, 6, 14);
    const previousCtc = Math.round(ctc / (1 + hikePct / 100) / 1000) * 1000;
    const reason: RevisionReason = promotion
      ? "Promotion"
      : rng() > 0.88
        ? "Market correction"
        : rng() > 0.94
          ? "Retention adjustment"
          : "Annual appraisal";
    rows.push({
      id: `${emp.code}-REV-${i + 1}`,
      employeeCode: emp.code,
      effectiveFrom: iso(cycles[i]),
      reason,
      previousCtc,
      newCtc: ctc,
      hikePct: Math.round(((ctc - previousCtc) / previousCtc) * 1000) / 10,
      approvedBy: approver,
      note:
        reason === "Promotion"
          ? `Moved to ${gradeById(emp.gradeId)?.label ?? emp.gradeId} on the ${format(cycles[i], "yyyy")} cycle.`
          : reason === "Market correction"
            ? "Band re-benchmarked against the Q4 compensation survey."
            : reason === "Retention adjustment"
              ? "Off-cycle correction approved by the compensation committee."
              : `${format(cycles[i], "MMM yyyy")} appraisal cycle, rating-linked increment.`,
    });
    ctc = previousCtc;
  }

  rows.push({
    id: `${emp.code}-REV-0`,
    employeeCode: emp.code,
    effectiveFrom: emp.joiningDate,
    reason: "Joining offer",
    previousCtc: 0,
    newCtc: ctc,
    hikePct: 0,
    approvedBy: "Priya Menon",
    note: `Offer accepted for ${emp.designation}, ${deptName(emp.departmentId)}.`,
  });

  return rows.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
});

/* ================================================================ timeline */

export type LifecycleKind =
  | "hired"
  | "confirmed"
  | "promoted"
  | "transferred"
  | "appraisal"
  | "salary_revision"
  | "manager_change"
  | "exit_initiated";

export interface LifecycleEvent {
  id: string;
  employeeCode: string;
  date: string;
  kind: LifecycleKind;
  title: string;
  detail: string;
  actor: string;
}

export const LIFECYCLE_LABEL: Record<LifecycleKind, string> = {
  hired: "Hired",
  confirmed: "Confirmed",
  promoted: "Promoted",
  transferred: "Transferred",
  appraisal: "Appraisal",
  salary_revision: "Salary revision",
  manager_change: "Manager change",
  exit_initiated: "Exit initiated",
};

const RATING_BANDS = ["Outstanding", "Exceeds expectations", "Meets expectations", "Needs improvement"];

export const timelineFor = memoPerEmployee((emp): LifecycleEvent[] => {
  const rng = mulberry32(seedFor(emp.code, 37));
  const events: LifecycleEvent[] = [];
  const branch = BRANCHES.find((b) => b.id === emp.branchId);
  const push = (date: string, kind: LifecycleKind, title: string, detail: string, actor: string) =>
    events.push({ id: `${emp.code}-EVT-${events.length + 1}`, employeeCode: emp.code, date, kind, title, detail, actor });

  push(
    emp.joiningDate,
    "hired",
    `Joined as ${emp.designation}`,
    `${deptName(emp.departmentId)} · ${branch?.name ?? emp.branchId}. Reporting to ${employeeName(emp.managerCode)}.`,
    "Priya Menon",
  );

  if (emp.confirmationDate) {
    push(
      emp.confirmationDate,
      "confirmed",
      "Probation completed",
      "Confirmed in role after the 6-month review. Full leave accrual starts from this date.",
      employeeName(emp.managerCode),
    );
  }

  /* One appraisal + salary revision per completed April cycle; the revisions
     are the same rows the Compensation tab shows, so the two tabs agree. */
  for (const rev of compensationHistoryFor(emp.code) ?? []) {
    if (rev.reason === "Joining offer") continue;
    push(
      rev.effectiveFrom,
      "appraisal",
      `${format(parseISO(rev.effectiveFrom), "yyyy")} appraisal closed`,
      `Final rating: ${RATING_BANDS[randInt(rng, 0, rng() > 0.7 ? 3 : 2)]}. Calibrated across ${deptName(emp.departmentId)}.`,
      employeeName(emp.managerCode),
    );
    push(
      rev.effectiveFrom,
      rev.reason === "Promotion" ? "promoted" : "salary_revision",
      rev.reason === "Promotion" ? "Promoted" : `CTC revised — ${rev.reason.toLowerCase()}`,
      rev.note,
      rev.approvedBy,
    );
  }

  /* A branch transfer for roughly one in eight people with 3+ years in. */
  const monthsIn = differenceInMonths(TODAY, parseISO(emp.joiningDate));
  if (monthsIn > 36 && rng() > 0.86) {
    const from = BRANCHES.filter((b) => b.id !== emp.branchId && b.country)[0];
    push(
      iso(addDays(parseISO(emp.joiningDate), randInt(rng, 400, Math.max(401, monthsIn * 28)))),
      "transferred",
      `Transferred to ${branch?.name ?? emp.branchId}`,
      `Moved from ${from?.name ?? "Bengaluru HQ"}. Work calendar and shift re-resolved for ${branch?.countryName ?? "India"}.`,
      "Priya Menon",
    );
  }

  if (monthsIn > 30 && rng() > 0.8 && emp.managerCode) {
    push(
      iso(addDays(parseISO(emp.joiningDate), randInt(rng, 380, Math.max(381, monthsIn * 26)))),
      "manager_change",
      `Reporting line moved to ${employeeName(emp.managerCode)}`,
      "Team re-alignment following the departmental re-org. No change to grade or compensation.",
      "Priya Menon",
    );
  }

  if (emp.status === "notice" && emp.exitDate) {
    push(
      iso(addDays(TODAY, -randInt(rng, 3, 25))),
      "exit_initiated",
      "Resignation accepted",
      `Reason: ${emp.exitReason ?? "Personal reasons"}. Last working day ${format(parseISO(emp.exitDate), "dd MMM yyyy")}. Exit clearance in progress.`,
      employeeName(emp.managerCode),
    );
  }

  return events
    .filter((e) => e.date <= DEMO_TODAY)
    .sort((a, b) => b.date.localeCompare(a.date));
});

/* =============================================== per-tab summary roll-ups */

export interface AttendanceMonthRow {
  month: string;
  label: string;
  workingDays: number;
  present: number;
  leave: number;
  absent: number;
  lateMarks: number;
  overtimeHours: number;
  avgHours: number;
}

export interface AttendanceSummary {
  employeeCode: string;
  months: AttendanceMonthRow[];
  presentPct: number;
  punctualityPct: number;
  totalLateMarks: number;
  totalOvertimeHours: number;
  lopDays: number;
}

/** Six-month attendance roll-up. Present + leave + absent = working days, always. */
export const attendanceSummaryFor = memoPerEmployee((emp): AttendanceSummary => {
  const rng = mulberry32(seedFor(emp.code, 53));
  const months: AttendanceMonthRow[] = [];

  for (let i = 5; i >= 0; i--) {
    const m = startOfMonth(subMonths(TODAY, i));
    const workingDays = randInt(rng, 20, 23);
    const absent = rng() > 0.82 ? randInt(rng, 1, 2) : 0;
    const leave = randInt(rng, 0, 3);
    const present = workingDays - absent - leave;
    months.push({
      month: format(m, "yyyy-MM"),
      label: format(m, "MMM yy"),
      workingDays,
      present,
      leave,
      absent,
      lateMarks: randInt(rng, 0, 4),
      overtimeHours: rng() > 0.55 ? randInt(rng, 2, 14) : 0,
      avgHours: Math.round((8 + rng() * 1.4) * 10) / 10,
    });
  }

  const workingDays = months.reduce((a, m) => a + m.workingDays, 0);
  const present = months.reduce((a, m) => a + m.present, 0);
  const totalLateMarks = months.reduce((a, m) => a + m.lateMarks, 0);
  return {
    employeeCode: emp.code,
    months,
    presentPct: (present / workingDays) * 100,
    punctualityPct: ((present - totalLateMarks) / present) * 100,
    totalLateMarks,
    totalOvertimeHours: months.reduce((a, m) => a + m.overtimeHours, 0),
    lopDays: months.reduce((a, m) => a + m.absent, 0),
  };
});

export interface LeaveTypeRow {
  type: string;
  opening: number;
  accrued: number;
  used: number;
  /** opening + accrued − used */
  available: number;
}

export interface LeaveSummary {
  employeeCode: string;
  rows: LeaveTypeRow[];
  monthly: { month: string; label: string; days: number }[];
  totalAvailable: number;
  totalUsed: number;
}

const LEAVE_TYPES: { type: string; annual: number }[] = [
  { type: "Earned Leave", annual: 18 },
  { type: "Casual Leave", annual: 12 },
  { type: "Sick Leave", annual: 12 },
  { type: "Comp Off", annual: 4 },
];

export const leaveSummaryFor = memoPerEmployee((emp): LeaveSummary => {
  const rng = mulberry32(seedFor(emp.code, 71));
  /* Accrual is pro-rated to the elapsed months of the Apr–Mar leave year. */
  const elapsed = Math.min(12, TODAY.getMonth() + 1 - 3 + (TODAY.getMonth() >= 3 ? 0 : 12));

  const rows: LeaveTypeRow[] = LEAVE_TYPES.map((t) => {
    const accrued = Math.round(((t.annual * elapsed) / 12) * 2) / 2;
    const opening = t.type === "Earned Leave" ? randInt(rng, 0, 9) : 0;
    const used = Math.min(opening + accrued, Math.round(rng() * accrued * 2) / 2);
    return { type: t.type, opening, accrued, used, available: opening + accrued - used };
  });

  const monthly = Array.from({ length: 6 }, (_, i) => {
    const m = startOfMonth(subMonths(TODAY, 5 - i));
    return { month: format(m, "yyyy-MM"), label: format(m, "MMM yy"), days: Math.round(rng() * 6) / 2 };
  });

  return {
    employeeCode: emp.code,
    rows,
    monthly,
    totalAvailable: rows.reduce((a, r) => a + r.available, 0),
    totalUsed: rows.reduce((a, r) => a + r.used, 0),
  };
});

export interface PerformanceCycleRow {
  cycle: string;
  selfRating: number;
  managerRating: number;
  finalRating: number;
  band: string;
  status: string;
}

export interface PerformanceGoalRow {
  title: string;
  weightage: number;
  progress: number;
  status: string;
}

export interface PerformanceSummary {
  employeeCode: string;
  cycles: PerformanceCycleRow[];
  goals: PerformanceGoalRow[];
  latestRating: number | null;
  goalCompletion: number;
}

const GOAL_TEMPLATES: Record<string, string[]> = {
  ENG: [
    "Cut p95 API latency on the payroll service to under 400 ms",
    "Ship the multi-country work-calendar resolver to GA",
    "Raise unit-test coverage on the leave engine to 80%",
    "Close all P1 security findings from the Q2 pen test",
  ],
  PRD: [
    "Launch the attendance regularisation flow to all tenants",
    "Run 20 discovery interviews across the mid-market segment",
    "Define the FY27 payroll roadmap with pricing input",
    "Reduce onboarding time-to-first-payrun to 14 days",
  ],
  DES: [
    "Ship v2 of the HRMS design system with dark theme parity",
    "Complete the accessibility audit on the top 15 screens",
    "Run usability tests on the pay-run exception panel",
    "Standardise the empty and error states across modules",
  ],
  SAL: [
    "Close ₹4.2 Cr of new ARR in the enterprise segment",
    "Build a qualified pipeline of 3× quota by Q3",
    "Win two lighthouse logos in BFSI",
    "Lift average deal size by 15% through multi-module bundles",
  ],
  MKT: [
    "Generate 1,200 marketing-qualified leads this half",
    "Grow organic traffic on the payroll cluster by 40%",
    "Run the HR Tech Summit field programme end to end",
    "Cut blended cost per MQL to under ₹1,800",
  ],
  CSM: [
    "Hold gross revenue retention above 94%",
    "Bring first-response time under 2 hours for P1 tickets",
    "Complete QBRs for all 40 strategic accounts",
    "Drive 25 reference-able customers for the FY27 campaign",
  ],
  FIN: [
    "Close the books within 5 working days every month",
    "Complete the statutory audit with zero qualifications",
    "Automate the PF and ESI filing reconciliation",
    "Bring payroll processing cost per employee down 12%",
  ],
  HR: [
    "Bring time-to-hire under 32 days across engineering",
    "Lift eNPS from 34 to 45 in the annual survey",
    "Complete POSH training for 100% of employees",
    "Roll out the revised grade and band structure",
  ],
  ITO: [
    "Reach 99.95% uptime on internal platforms",
    "Complete the Okta SSO rollout for all SaaS tools",
    "Close the asset reconciliation gap to under 2%",
    "Cut mean time to resolve IT incidents to 4 hours",
  ],
};

export const performanceFor = memoPerEmployee((emp): PerformanceSummary => {
  const rng = mulberry32(seedFor(emp.code, 97));
  const joinYear = parseISO(emp.joiningDate).getFullYear();
  const cycles: PerformanceCycleRow[] = [];

  for (let y = Math.max(joinYear, 2022); y <= 2025; y++) {
    if (differenceInMonths(parseISO(`${y + 1}-04-01`), parseISO(emp.joiningDate)) < 9) continue;
    const managerRating = Math.round((2.8 + rng() * 2) * 10) / 10;
    const selfRating = Math.min(5, Math.round((managerRating + (rng() - 0.3) * 0.8) * 10) / 10);
    const finalRating = Math.round(((managerRating * 0.7 + selfRating * 0.3) + (rng() - 0.5) * 0.2) * 10) / 10;
    cycles.push({
      cycle: `FY ${y}-${String((y + 1) % 100).padStart(2, "0")}`,
      selfRating,
      managerRating,
      finalRating,
      band:
        finalRating >= 4.5
          ? "Outstanding"
          : finalRating >= 3.8
            ? "Exceeds expectations"
            : finalRating >= 3
              ? "Meets expectations"
              : "Needs improvement",
      status: "completed",
    });
  }

  const templates = GOAL_TEMPLATES[emp.departmentId] ?? GOAL_TEMPLATES.ENG;
  const weights = [40, 25, 20, 15];
  const goals: PerformanceGoalRow[] = templates.map((title, i) => {
    const progress = randInt(rng, 25, 100);
    return {
      title,
      weightage: weights[i],
      progress,
      status: progress >= 100 ? "achieved" : progress >= 65 ? "on_track" : progress >= 40 ? "at_risk" : "off_track",
    };
  });

  return {
    employeeCode: emp.code,
    cycles,
    goals,
    latestRating: cycles.length ? cycles[cycles.length - 1].finalRating : null,
    goalCompletion: Math.round(goals.reduce((a, g) => a + (g.progress * g.weightage) / 100, 0)),
  };
});

export interface AllocatedAsset {
  id: string;
  employeeCode: string;
  tag: string;
  category: string;
  model: string;
  serial: string;
  allocatedOn: string;
  status: string;
  condition: "Excellent" | "Good" | "Fair";
  valueInr: number;
}

const ASSET_MODELS: { category: string; models: string[]; value: [number, number] }[] = [
  { category: "Laptop", models: ["MacBook Pro 14\" M4", "Dell Latitude 7450", "ThinkPad X1 Carbon G12"], value: [95000, 240000] },
  { category: "Monitor", models: ["Dell U2723QE 27\"", "LG 27UP850 4K"], value: [24000, 48000] },
  { category: "Mobile", models: ["iPhone 15", "Samsung Galaxy S24"], value: [58000, 92000] },
  { category: "Accessory", models: ["Logitech MX Master 3S", "Keychron K3 Pro", "Jabra Evolve2 65"], value: [6500, 19000] },
  { category: "Access card", models: ["HID Prox II badge"], value: [900, 1400] },
];

export const assetsFor = memoPerEmployee((emp): AllocatedAsset[] => {
  const rng = mulberry32(seedFor(emp.code, 131));
  const joined = parseISO(emp.joiningDate);
  const out: AllocatedAsset[] = [];

  ASSET_MODELS.forEach((spec, i) => {
    /* Everyone gets a laptop and a badge; the rest depend on the role. */
    const guaranteed = spec.category === "Laptop" || spec.category === "Access card";
    if (!guaranteed && rng() > 0.55) return;
    const allocated = addDays(joined, randInt(rng, 0, 20));
    if (allocated > TODAY) return;
    const r = rng();
    out.push({
      id: `${emp.code}-AST-${i + 1}`,
      employeeCode: emp.code,
      tag: `STL-AST-${String(seedFor(emp.code, i * 13) % 9000 + 1000)}`,
      category: spec.category,
      model: pick(rng, spec.models),
      serial: `SN${String(seedFor(emp.code, i * 29) % 900000 + 100000)}`,
      allocatedOn: iso(allocated),
      status: r > 0.95 ? "under_repair" : "allocated",
      condition: r > 0.7 ? "Excellent" : r > 0.25 ? "Good" : "Fair",
      valueInr: randInt(rng, spec.value[0], spec.value[1]),
    });
  });

  return out;
});

/* ============================================================ bulk import */

export const IMPORT_SOURCE_COLUMNS = [
  "Emp Code",
  "Full Name",
  "Work Email",
  "Mobile",
  "Department",
  "Branch",
  "Designation",
  "Grade",
  "Date of Joining",
  "Annual CTC",
  "PAN",
  "Manager Code",
  "Cost Centre",
] as const;

export interface HrmsField {
  key: string;
  label: string;
  required: boolean;
  type: "text" | "email" | "date" | "money" | "enum";
  hint: string;
}

export const HRMS_FIELDS: HrmsField[] = [
  { key: "code", label: "Employee code", required: true, type: "text", hint: "Unique, format STL-0000" },
  { key: "name", label: "Full name", required: true, type: "text", hint: "First and last name" },
  { key: "email", label: "Work email", required: true, type: "email", hint: "Must be unique on the tenant" },
  { key: "phone", label: "Mobile", required: false, type: "text", hint: "E.164, +91 prefix for India" },
  { key: "departmentId", label: "Department", required: true, type: "enum", hint: "Must match an existing department" },
  { key: "branchId", label: "Branch", required: true, type: "enum", hint: "Must match an existing branch" },
  { key: "designation", label: "Designation", required: true, type: "text", hint: "Free text" },
  { key: "gradeId", label: "Grade", required: true, type: "enum", hint: "G1 – G7" },
  { key: "joiningDate", label: "Joining date", required: true, type: "date", hint: "dd-MM-yyyy" },
  { key: "ctc", label: "Annual CTC", required: false, type: "money", hint: "Numeric, INR" },
  { key: "pan", label: "PAN", required: false, type: "text", hint: "10 characters, checksum validated" },
  { key: "managerCode", label: "Manager code", required: false, type: "text", hint: "Must resolve to an active employee" },
  { key: "costCentre", label: "Cost centre", required: false, type: "text", hint: "Optional, defaults from department" },
  { key: "__ignore", label: "— Do not import —", required: false, type: "text", hint: "Column is skipped" },
];

/** What the auto-detector resolves each source column to on upload. */
export const AUTO_MAPPING: Record<string, { field: string; confidence: number }> = {
  "Emp Code": { field: "code", confidence: 98 },
  "Full Name": { field: "name", confidence: 96 },
  "Work Email": { field: "email", confidence: 99 },
  Mobile: { field: "phone", confidence: 91 },
  Department: { field: "departmentId", confidence: 94 },
  Branch: { field: "branchId", confidence: 93 },
  Designation: { field: "designation", confidence: 97 },
  Grade: { field: "gradeId", confidence: 88 },
  "Date of Joining": { field: "joiningDate", confidence: 95 },
  "Annual CTC": { field: "ctc", confidence: 90 },
  PAN: { field: "pan", confidence: 86 },
  "Manager Code": { field: "managerCode", confidence: 74 },
  "Cost Centre": { field: "__ignore", confidence: 41 },
};

export type ImportOutcome = "create" | "update" | "reject";

export interface ImportRow {
  rowNumber: number;
  code: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  branch: string;
  designation: string;
  grade: string;
  joiningDate: string;
  ctc: string;
  pan: string;
  managerCode: string;
  costCentre: string;
  outcome: ImportOutcome;
  /** Populated only when outcome is "reject". */
  reason: string | null;
  /** Populated only when outcome is "update" — the fields that would change. */
  changes: string[];
}

/**
 * The fixed 24-row sample file. Hand-authored rather than generated: the
 * rejections have to be specific and quotable during the walkthrough.
 */
export const SAMPLE_IMPORT_ROWS: ImportRow[] = [
  { rowNumber: 2, code: "STL-0341", name: "Meghana Rao", email: "meghana.rao@stellartech.in", phone: "+91 9845012233", department: "Engineering", branch: "Bengaluru", designation: "Software Engineer", grade: "G2", joiningDate: "05-10-2026", ctc: "1240000", pan: "AKXPS4821D", managerCode: "STL-0031", costCentre: "CC-1001", outcome: "create", reason: null, changes: [] },
  { rowNumber: 3, code: "STL-0342", name: "Aditya Bhandari", email: "aditya.bhandari@stellartech.in", phone: "+91 9900112244", department: "Engineering", branch: "Bengaluru", designation: "Senior Software Engineer", grade: "G3", joiningDate: "05-10-2026", ctc: "1780000", pan: "BKXPS1129K", managerCode: "STL-0031", costCentre: "CC-1001", outcome: "create", reason: null, changes: [] },
  { rowNumber: 4, code: "STL-0343", name: "Ritika Sen", email: "ritika.sen@stellartech.in", phone: "+91 9663301188", department: "Product", branch: "Bengaluru", designation: "Product Manager", grade: "G3", joiningDate: "12-10-2026", ctc: "1920000", pan: "CAXPS7741A", managerCode: "STL-0006", costCentre: "CC-1002", outcome: "create", reason: null, changes: [] },
  { rowNumber: 5, code: "STL-0142", name: "Ananya Rao", email: "ananya.rao@stellartech.in", phone: "+91 9611220033", department: "Engineering", branch: "Bengaluru", designation: "Senior Software Engineer", grade: "G3", joiningDate: "19-06-2023", ctc: "1480000", pan: "AAXPS1420K", managerCode: "STL-0031", costCentre: "CC-1001", outcome: "reject", reason: "Duplicate employee code STL-0142 — an active employee already holds this code. Use the update template to change an existing record.", changes: [] },
  { rowNumber: 6, code: "STL-0344", name: "Nikhil Bansal", email: "nikhil.bansal@stellartech.in", phone: "+91 9740088211", department: "Engineering", branch: "Pune", designation: "Staff Engineer", grade: "G4", joiningDate: "06-10-2026", ctc: "2850000", pan: "DMXPS9012G", managerCode: "STL-0004", costCentre: "CC-1001", outcome: "create", reason: null, changes: [] },
  { rowNumber: 7, code: "STL-0345", name: "Farah Siddiqui", email: "farah.siddiqui@stellartech.in", phone: "+91 9535501177", department: "Customer Success", branch: "Chennai", designation: "Senior CSM", grade: "G3", joiningDate: "12-10-2026", ctc: "1360000", pan: "EPXPS3388N", managerCode: "STL-0007", costCentre: "CC-2003", outcome: "reject", reason: "Branch 'Chennai' does not exist on this tenant. Known branches: Bengaluru, Pune, Newark NJ, Hyderabad.", changes: [] },
  { rowNumber: 8, code: "STL-0346", name: "Rohan Kulkarni", email: "rohan.kulkarni@stellartech.in", phone: "+91 9822011456", department: "Finance", branch: "Pune", designation: "Senior Finance Analyst", grade: "G3", joiningDate: "01-11-2026", ctc: "1540000", pan: "AKXPS6620A", managerCode: "STL-0017", costCentre: "CC-3001", outcome: "create", reason: null, changes: [] },
  { rowNumber: 9, code: "STL-0031", name: "Vikram Shah", email: "vikram.shah@stellartech.in", phone: "+91 9880033114", department: "Engineering", branch: "Bengaluru", designation: "Senior Engineering Manager", grade: "G5", joiningDate: "13-01-2020", ctc: "4250000", pan: "BAXPS0031P", managerCode: "STL-0004", costCentre: "CC-1001", outcome: "update", reason: null, changes: ["designation: Engineering Manager → Senior Engineering Manager", "ctc: ₹39,00,000 → ₹42,50,000"] },
  { rowNumber: 10, code: "STL-0347", name: "Sneha Prabhu", email: "sneha.prabhu@stellartech.in", phone: "+91 9448822006", department: "Design", branch: "Bengaluru", designation: "Product Designer", grade: "G2", joiningDate: "31-02-2026", ctc: "1180000", pan: "CKXPS5514D", managerCode: "STL-0011", costCentre: "CC-1003", outcome: "reject", reason: "Joining date 31-02-2026 is not a valid date. Expected dd-MM-yyyy with a real calendar day.", changes: [] },
  { rowNumber: 11, code: "STL-0348", name: "Varun Menon", email: "varun.menon@stellartech.in", phone: "+91 9611445577", department: "Sales", branch: "Bengaluru", designation: "Account Executive", grade: "G2", joiningDate: "06-10-2026", ctc: "1090000", pan: "DAXPS2277K", managerCode: "STL-0005", costCentre: "CC-2001", outcome: "create", reason: null, changes: [] },
  { rowNumber: 12, code: "STL-0349", name: "Pooja Deshmukh", email: "pooja.deshmukh@stellartech.in", phone: "+91 9767700334", department: "Marketing", branch: "Pune", designation: "Marketing Executive", grade: "G2", joiningDate: "13-10-2026", ctc: "980000", pan: "EMXPS8843G", managerCode: "STL-0013", costCentre: "CC-2002", outcome: "create", reason: null, changes: [] },
  { rowNumber: 13, code: "STL-0350", name: "Brian Okafor", email: "brian.okafor@stellartech.in", phone: "+1 973 555 0142", department: "Engineering", branch: "Newark NJ", designation: "Senior Software Engineer", grade: "G3", joiningDate: "19-10-2026", ctc: "2140000", pan: "AAXPS0000Z", managerCode: "STL-0004", costCentre: "CC-1001", outcome: "reject", reason: "PAN checksum invalid — AAXPS0000Z fails the 10th-character check digit. Leave the column blank for non-resident hires.", changes: [] },
  { rowNumber: 14, code: "STL-0009", name: "Priya Menon", email: "priya.menon@stellartech.in", phone: "+91 9845110099", department: "Human Resources", branch: "Bengaluru", designation: "Head of People Operations", grade: "G6", joiningDate: "02-04-2018", ctc: "5600000", pan: "BKXPS0009M", managerCode: "STL-0001", costCentre: "CC-3002", outcome: "update", reason: null, changes: ["ctc: ₹52,00,000 → ₹56,00,000", "phone: +91 98450 11000 → +91 9845110099"] },
  { rowNumber: 15, code: "STL-0351", name: "Harsha Bhat", email: "harsha.bhat@stellartech.in", phone: "+91 9900556677", department: "IT & Operations", branch: "Bengaluru", designation: "Senior SRE", grade: "G3", joiningDate: "20-10-2026", ctc: "1660000", pan: "CPXPS4419A", managerCode: "STL-0010", costCentre: "CC-3003", outcome: "create", reason: null, changes: [] },
  { rowNumber: 16, code: "STL-0352", name: "Ishita Bose", email: "ishita.bose@stellartech.in", phone: "+91 9830012344", department: "Growth", branch: "Bengaluru", designation: "Growth Analyst", grade: "G2", joiningDate: "26-10-2026", ctc: "1050000", pan: "DAXPS7732N", managerCode: "STL-0013", costCentre: "CC-2002", outcome: "reject", reason: "Department 'Growth' does not exist on this tenant. Create the department first, or map the column to Marketing.", changes: [] },
  { rowNumber: 17, code: "STL-0353", name: "Ganesh Naidu", email: "ganesh.naidu@stellartech.in", phone: "+91 9448833221", department: "Customer Success", branch: "Pune", designation: "Customer Success Executive", grade: "G2", joiningDate: "26-10-2026", ctc: "940000", pan: "EKXPS1108D", managerCode: "STL-0007", costCentre: "CC-2003", outcome: "create", reason: null, changes: [] },
  { rowNumber: 18, code: "STL-0354", name: "Anjali Verma", email: "anjali.verma@stellartech.in", phone: "+91 9611009988", department: "Human Resources", branch: "Bengaluru", designation: "HR Executive", grade: "G2", joiningDate: "02-11-2026", ctc: "880000", pan: "AMXPS6655K", managerCode: "STL-0009", costCentre: "CC-3002", outcome: "create", reason: null, changes: [] },
  { rowNumber: 19, code: "STL-0355", name: "Sameer Qureshi", email: "ananya.rao@stellartech.in", phone: "+91 9535667788", department: "Engineering", branch: "Bengaluru", designation: "Software Engineer", grade: "G2", joiningDate: "02-11-2026", ctc: "1160000", pan: "BPXPS9921G", managerCode: "STL-0031", costCentre: "CC-1001", outcome: "reject", reason: "Work email ananya.rao@stellartech.in is already assigned to STL-0142. Email must be unique across the tenant.", changes: [] },
  { rowNumber: 20, code: "STL-0356", name: "Deepika Nair", email: "deepika.nair@stellartech.in", phone: "+91 9846677001", department: "Product", branch: "Bengaluru", designation: "Associate Product Manager", grade: "G1", joiningDate: "09-11-2026", ctc: "740000", pan: "CAXPS3340A", managerCode: "STL-0006", costCentre: "CC-1002", outcome: "create", reason: null, changes: [] },
  { rowNumber: 21, code: "STL-0357", name: "Kiran Joshi", email: "kiran.joshi@stellartech.in", phone: "+91 9822114466", department: "Engineering", branch: "Pune", designation: "Software Engineer", grade: "G9", joiningDate: "09-11-2026", ctc: "1210000", pan: "DKXPS8877N", managerCode: "STL-0004", costCentre: "CC-1001", outcome: "reject", reason: "Grade 'G9' is outside the configured band range G1–G7. Update the grade master before importing.", changes: [] },
  { rowNumber: 22, code: "STL-0358", name: "Laura Thompson", email: "laura.thompson@stellartech.in", phone: "+1 201 555 0188", department: "Sales", branch: "Newark NJ", designation: "Senior Account Executive", grade: "G3", joiningDate: "16-11-2026", ctc: "2460000", pan: "", managerCode: "STL-0005", costCentre: "CC-2001", outcome: "create", reason: null, changes: [] },
  { rowNumber: 23, code: "STL-0359", name: "Yashwanth Gowda", email: "yashwanth.gowda@stellartech.in", phone: "+91 9900778855", department: "Engineering", branch: "Bengaluru", designation: "Associate Software Engineer", grade: "G1", joiningDate: "16-11-2026", ctc: "690000", pan: "EAXPS5566K", managerCode: "STL-0999", costCentre: "CC-1001", outcome: "reject", reason: "Manager code STL-0999 does not resolve to an active employee. Leave blank to attach the hire to the department head.", changes: [] },
  { rowNumber: 24, code: "STL-0017", name: "Rahul Desai", email: "rahul.desai@stellartech.in", phone: "+91 9767001122", department: "Finance", branch: "Pune", designation: "Payroll Manager", grade: "G5", joiningDate: "04-11-2019", ctc: "3450000", pan: "AKXPS0017D", managerCode: "STL-0008", costCentre: "CC-3001", outcome: "update", reason: null, changes: ["ctc: ₹32,00,000 → ₹34,50,000"] },
  { rowNumber: 25, code: "STL-0360", name: "Swati Agarwal", email: "swati.agarwal@stellartech.in", phone: "+91 9611334422", department: "Design", branch: "Bengaluru", designation: "Senior Product Designer", grade: "G3", joiningDate: "23-11-2026", ctc: "1720000", pan: "BMXPS2244A", managerCode: "STL-0011", costCentre: "CC-1003", outcome: "create", reason: null, changes: [] },
];

export const IMPORT_SUMMARY = {
  fileName: "stellar_new_joiners_oct_nov_2026.xlsx",
  sizeKb: 47,
  sheetName: "New Joiners",
  uploadedAt: "2026-09-16T11:24:00",
  totalRows: SAMPLE_IMPORT_ROWS.length,
  create: SAMPLE_IMPORT_ROWS.filter((r) => r.outcome === "create").length,
  update: SAMPLE_IMPORT_ROWS.filter((r) => r.outcome === "update").length,
  reject: SAMPLE_IMPORT_ROWS.filter((r) => r.outcome === "reject").length,
} as const;
