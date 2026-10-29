import { addDays, differenceInDays, format, parseISO } from "date-fns";
import { employeeByCode } from "./employees";
import { DEMO_TODAY } from "./org";
import { LOOKUP_CATEGORIES } from "./platform-masters";

/* ============================================================================
   Separations. The fourteen employees on notice in mock/employees.ts each get
   a separation whose computed last working day equals their `exitDate`; two
   fresh resignations sit in the approval queue; three completed exits carry
   the history that F&F, exit interviews and alumni all read from.
   ========================================================================== */

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const TODAY = parseISO(DEMO_TODAY);

export type SeparationType = "voluntary" | "involuntary" | "retirement";
export type SeparationStatus = "pending_manager" | "pending_hr" | "serving_notice" | "clearance" | "completed";

export const SEPARATION_STATUS_LABEL: Record<SeparationStatus, string> = {
  pending_manager: "Manager approval",
  pending_hr: "HR approval",
  serving_notice: "Serving notice",
  clearance: "In clearance",
  completed: "Exited",
};

/** Separation reasons come from the tenant lookup, with its regretted classification. */
export const SEPARATION_REASONS = (LOOKUP_CATEGORIES.find((c) => c.id === "separation_reason")?.values ?? []).map((v) => ({
  code: v.code,
  label: v.label,
  tag: v.tag ?? "",
  regretted: v.tag === "Voluntary · regretted",
}));
export const reasonByCode = (code: string) => SEPARATION_REASONS.find((r) => r.code === code);
export const reasonLabel = (s: { type: SeparationType; reasonCode: string }) =>
  s.type === "retirement" ? "Superannuation" : (reasonByCode(s.reasonCode)?.label ?? s.reasonCode);

/** Contractual notice: G1 30 days, G2–G4 60 days, G5+ 90 days. Company-initiated: 60 days. */
export const noticeDaysFor = (gradeId: string, type: SeparationType) =>
  type === "involuntary" ? 60 : gradeId === "G1" ? 30 : ["G5", "G6", "G7"].includes(gradeId) ? 90 : 60;

export const computeLwd = (initiatedOn: string, noticeDays: number, waivedDays: number, buyoutDays: number) =>
  iso(addDays(parseISO(initiatedOn), noticeDays - waivedDays - buyoutDays));

export interface Separation {
  id: string;
  code: string;
  name: string;
  designation: string;
  departmentId: string;
  branchId: string;
  gradeId: string;
  ctc: number;
  joiningDate: string;
  managerCode: string;
  type: SeparationType;
  reasonCode: string;
  reasonDetail: string;
  regretted: boolean;
  initiatedOn: string;
  noticeDays: number;
  waivedDays: number;
  /** Days of notice the employee pays for — recovered in F&F. */
  buyoutDays: number;
  lwd: string;
  status: SeparationStatus;
  managerApprovedOn: string | null;
  hrApprovedOn: string | null;
  /** Former employee (no longer in the active directory). */
  former: boolean;
  /** Recoveries raised during clearance — feed the F&F. */
  recoveries: { label: string; amount: number }[];
}

const REASON_FROM_TEXT: Record<string, string> = {
  Relocation: "RELOCATION",
  "Personal reasons": "PERSONAL",
  "Better opportunity": "BETTER_OPP",
  Compensation: "BETTER_OPP",
  Performance: "PERFORMANCE",
};

interface NoticeSeed {
  code: string;
  waived?: number;
  buyout?: number;
  recoveries?: { label: string; amount: number }[];
}

const NOTICE: NoticeSeed[] = [
  { code: "STL-0161", buyout: 15, recoveries: [{ label: "Laptop charger not returned (Dell 65W USB-C)", amount: 2950 }] },
  { code: "STL-0073", recoveries: [{ label: "Access card not returned — replacement", amount: 480 }] },
  { code: "STL-0182" },
  { code: "STL-0192" },
  { code: "STL-0280" },
  { code: "STL-0016", waived: 20 },
  { code: "STL-0060", waived: 20 },
  { code: "STL-0014" },
  { code: "STL-0193" },
  { code: "STL-0230" },
  { code: "STL-0271" },
  { code: "STL-0159" },
  { code: "STL-0082" },
  { code: "STL-0286" },
];

const fromNotice = (s: NoticeSeed, i: number): Separation => {
  const e = employeeByCode(s.code)!;
  const reasonCode = REASON_FROM_TEXT[e.exitReason ?? ""] ?? "PERSONAL";
  const type: SeparationType = reasonCode === "PERFORMANCE" ? "involuntary" : "voluntary";
  const noticeDays = noticeDaysFor(e.gradeId, type);
  const waived = s.waived ?? 0;
  const buyout = s.buyout ?? 0;
  const initiatedOn = iso(addDays(parseISO(e.exitDate!), -(noticeDays - waived - buyout)));
  const lwd = computeLwd(initiatedOn, noticeDays, waived, buyout);
  const inClearance = differenceInDays(parseISO(lwd), TODAY) <= 15;
  return {
    id: `SEP-2026-${String(i + 11).padStart(3, "0")}`,
    code: e.code,
    name: e.name,
    designation: e.designation,
    departmentId: e.departmentId,
    branchId: e.branchId,
    gradeId: e.gradeId,
    ctc: e.ctc,
    joiningDate: e.joiningDate,
    managerCode: e.managerCode ?? "STL-0009",
    type,
    reasonCode,
    reasonDetail: e.exitReason === "Compensation" ? "Compensation — accepted a higher fixed-pay offer" : (e.exitReason ?? ""),
    regretted: type === "voluntary" && (reasonByCode(reasonCode)?.regretted ?? false),
    initiatedOn,
    noticeDays,
    waivedDays: waived,
    buyoutDays: buyout,
    lwd,
    status: inClearance ? "clearance" : "serving_notice",
    managerApprovedOn: iso(addDays(parseISO(initiatedOn), 1)),
    hrApprovedOn: iso(addDays(parseISO(initiatedOn), 2)),
    former: false,
    recoveries: s.recoveries ?? [],
  };
};

const pending = (code: string, reasonCode: string, detail: string, initiatedOn: string, managerApprovedOn: string | null): Separation => {
  const e = employeeByCode(code)!;
  const noticeDays = noticeDaysFor(e.gradeId, "voluntary");
  return {
    id: "", code, name: e.name, designation: e.designation, departmentId: e.departmentId, branchId: e.branchId,
    gradeId: e.gradeId, ctc: e.ctc, joiningDate: e.joiningDate, managerCode: e.managerCode ?? "STL-0009",
    type: "voluntary", reasonCode, reasonDetail: detail, regretted: reasonByCode(reasonCode)?.regretted ?? false,
    initiatedOn, noticeDays, waivedDays: 0, buyoutDays: 0, lwd: computeLwd(initiatedOn, noticeDays, 0, 0),
    status: managerApprovedOn ? "pending_hr" : "pending_manager", managerApprovedOn, hrApprovedOn: null,
    former: false, recoveries: [],
  };
};

/** Completed exits — the same people appear in F&F, exit interviews and alumni. */
export const FORMER = [
  { code: "STL-X0412", name: "Suresh Pillai", designation: "Finance Manager", departmentId: "FIN", branchId: "BLR", gradeId: "G5", ctc: 3600000, joiningDate: "2004-06-01", managerCode: "STL-0008", type: "retirement" as const, reasonCode: "PERSONAL", reasonDetail: "Superannuation at 60", initiatedOn: "2026-06-02", lwd: "2026-08-31" },
  { code: "STL-X0418", name: "Ritu Sharma", designation: "Senior Software Engineer", departmentId: "ENG", branchId: "BLR", gradeId: "G3", ctc: 1650000, joiningDate: "2021-07-12", managerCode: "STL-0031", type: "voluntary" as const, reasonCode: "BETTER_OPP", reasonDetail: "Joined a product unicorn as a tech lead", initiatedOn: "2026-06-15", lwd: "2026-08-14" },
  { code: "STL-X0421", name: "Aman Khurana", designation: "Software Engineer", departmentId: "ENG", branchId: "PNQ", gradeId: "G2", ctc: 980000, joiningDate: "2023-06-19", managerCode: "STL-0019", type: "voluntary" as const, reasonCode: "HIGHER_STUDIES", reasonDetail: "MS in Computer Science, Georgia Tech (Fall 2026)", initiatedOn: "2026-07-06", lwd: "2026-09-04" },
];

const completed: Separation[] = FORMER.map((f) => {
  const noticeDays = f.type === "retirement" ? 90 : noticeDaysFor(f.gradeId, f.type);
  const gap = differenceInDays(parseISO(f.lwd), parseISO(f.initiatedOn));
  return {
    id: "", code: f.code, name: f.name, designation: f.designation, departmentId: f.departmentId, branchId: f.branchId,
    gradeId: f.gradeId, ctc: f.ctc, joiningDate: f.joiningDate, managerCode: f.managerCode, type: f.type,
    reasonCode: f.type === "retirement" ? "PERSONAL" : f.reasonCode, reasonDetail: f.reasonDetail,
    regretted: f.type === "voluntary" && (reasonByCode(f.reasonCode)?.regretted ?? false),
    initiatedOn: f.initiatedOn, noticeDays, waivedDays: Math.max(0, noticeDays - gap), buyoutDays: 0, lwd: f.lwd,
    status: "completed", managerApprovedOn: iso(addDays(parseISO(f.initiatedOn), 1)), hrApprovedOn: iso(addDays(parseISO(f.initiatedOn), 2)),
    former: true, recoveries: [],
  };
});

export const SEPARATIONS: Separation[] = [
  ...completed.map((s, i) => ({ ...s, id: `SEP-2026-${String(i + 1).padStart(3, "0")}` })),
  /* A seed whose employee is no longer on notice is skipped, not crashed on. */
  ...NOTICE.flatMap((s, i) => (employeeByCode(s.code)?.exitDate ? [fromNotice(s, i)] : [])),
  ...[
    pending("STL-0146", "BETTER_OPP", "Offer from a fintech scale-up — staff engineer track", "2026-09-14", null),
    pending("STL-0147", "HIGHER_STUDIES", "MBA, IIM Ahmedabad (PGPX 2027)", "2026-09-10", "2026-09-12"),
  ].map((s, i) => ({ ...s, id: `SEP-2026-${String(i + 31).padStart(3, "0")}` })),
];

export const separationById = (id: string) => SEPARATIONS.find((s) => s.id === id);
export const separationForCode = (code: string) => SEPARATIONS.find((s) => s.code === code);
export const daysToLwd = (s: Separation) => differenceInDays(parseISO(s.lwd), TODAY);

/** Completed service years (calendar). */
export const tenureYears = (joining: string, until: string) =>
  Math.round((differenceInDays(parseISO(until), parseISO(joining)) / 365.25) * 100) / 100;
