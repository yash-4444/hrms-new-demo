/* ==========================================================================
   Growth · certifications, skill gap and training budget.
   Compliance completion reuses growth.ts COMPLIANCE_RECORDS so it reconciles
   with /learning; Fire safety is a site-level certificate seeded here.
   ========================================================================== */

import { EMPLOYEES } from "./employees";
import { DEPARTMENTS } from "./org";
import { COMPLIANCE_RECORDS, expiryBand, type ExpiryBand } from "./growth";
import { mulberry32, randInt } from "@/lib/utils";

/* -------------------------------------------------------- certifications */

export type CertKind = "Compliance" | "Professional";

export interface Certificate {
  id: string;
  employeeCode: string;
  departmentId: string;
  name: string;
  kind: CertKind;
  issuer: string;
  issuedOn: string | null;
  expiresOn: string | null;
  daysToExpiry: number | null;
  band: ExpiryBand;
}

const ACTIVE = EMPLOYEES.filter((e) => e.status !== "exited");
const DEPT_OF = new Map(EMPLOYEES.map((e) => [e.code, e.departmentId]));

function shiftIso(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function band(days: number | null): ExpiryBand {
  if (days === null) return "pending";
  if (days < 0) return "expired";
  if (days <= 30) return "expiring";
  return "valid";
}

const FROM_COMPLIANCE: Certificate[] = COMPLIANCE_RECORDS.filter(
  (r) => (r.trainingId === "CT-POSH" || r.trainingId === "CT-INFOSEC") && ACTIVE.some((e) => e.code === r.employeeCode),
).map((r) => ({
  id: `CERT-${r.trainingId.slice(3)}-${r.employeeCode.slice(4)}`,
  employeeCode: r.employeeCode,
  departmentId: DEPT_OF.get(r.employeeCode) ?? "ENG",
  name: r.trainingId === "CT-POSH" ? "POSH awareness" : "Information Security",
  kind: "Compliance",
  issuer: "Stellar Academy",
  issuedOn: r.completedOn,
  expiresOn: r.expiresOn,
  daysToExpiry: r.daysToExpiry,
  band: expiryBand(r),
}));

const FIRE: Certificate[] = (() => {
  const rng = mulberry32(31337);
  return ACTIVE.map((e) => {
    const r = rng();
    const days = r < 0.06 ? null : randInt(rng, -40, 360);
    return {
      id: `CERT-FIRE-${e.code.slice(4)}`,
      employeeCode: e.code,
      departmentId: e.departmentId,
      name: "Fire safety & evacuation",
      kind: "Compliance" as const,
      issuer: "Facilities · site warden",
      issuedOn: days === null ? null : shiftIso("2026-09-16", days - 365),
      expiresOn: days === null ? null : shiftIso("2026-09-16", days),
      daysToExpiry: days,
      band: band(days),
    };
  });
})();

const PRO_SEEDS: [string, string, string, number][] = [
  ["STL-0145", "Certified Kubernetes Administrator (CKA)", "CNCF", 212],
  ["STL-0143", "AWS Solutions Architect – Associate", "Amazon Web Services", 24],
  ["STL-0149", "AWS Solutions Architect – Professional", "Amazon Web Services", 410],
  ["STL-0142", "HashiCorp Terraform Associate", "HashiCorp", -12],
  ["STL-0017", "Certified Payroll Professional (India)", "NIPM", 133],
  ["STL-0008", "Chartered Accountant — CPE hours", "ICAI", 74],
  ["STL-0058", "SHRM Certified Professional", "SHRM", 19],
  ["STL-0010", "ISO 27001 Lead Auditor", "BSI", 288],
  ["STL-0011", "Certified Usability Analyst", "Human Factors Intl.", 505],
  ["STL-0013", "HubSpot Inbound Marketing", "HubSpot Academy", 9],
  ["STL-0007", "Certified Customer Success Manager", "SuccessHACKER", 167],
  ["STL-0006", "Pragmatic Institute — Product Management", "Pragmatic Institute", 640],
];

const PRO: Certificate[] = PRO_SEEDS.map(([code, name, issuer, days], i) => ({
  id: `CERT-PRO-${String(i + 1).padStart(2, "0")}`,
  employeeCode: code,
  departmentId: DEPT_OF.get(code) ?? "ENG",
  name,
  kind: "Professional",
  issuer,
  issuedOn: shiftIso("2026-09-16", days - 730),
  expiresOn: shiftIso("2026-09-16", days),
  daysToExpiry: days,
  band: band(days),
}));

export const CERTIFICATES: Certificate[] = [...PRO, ...FROM_COMPLIANCE, ...FIRE];

export const CRITICAL_CERTS = ["POSH awareness", "Information Security", "Fire safety & evacuation"] as const;

/** % of active headcount holding a valid (or expiring-but-valid) certificate, by department. */
export const CERT_COMPLETION_BY_DEPT = DEPARTMENTS.map((d) => {
  const row: Record<string, string | number> = { department: d.name };
  for (const name of CRITICAL_CERTS) {
    const certs = CERTIFICATES.filter((c) => c.departmentId === d.id && c.name === name);
    const ok = certs.filter((c) => c.band === "valid" || c.band === "expiring").length;
    row[name] = Math.round((ok / Math.max(1, certs.length)) * 100);
  }
  return row;
});

/* ------------------------------------------------------------- skill gap */

export interface RoleSkillProfile {
  role: string;
  departmentId: string;
  headcount: number;
  skills: { skill: string; required: number; actual: number }[];
}

/** Required vs average actual proficiency, 1–5. Hand-set so the gaps tell a story. */
export const SKILL_MATRIX: RoleSkillProfile[] = [
  { role: "Software Engineer", departmentId: "ENG", headcount: 46, skills: [
    { skill: "TypeScript", required: 4, actual: 3.8 }, { skill: "Kubernetes", required: 3, actual: 2.1 },
    { skill: "PostgreSQL", required: 3, actual: 3.2 }, { skill: "System design", required: 3, actual: 2.4 },
    { skill: "Secure coding", required: 3, actual: 2.2 } ] },
  { role: "Senior Software Engineer", departmentId: "ENG", headcount: 34, skills: [
    { skill: "TypeScript", required: 4, actual: 4.2 }, { skill: "Kubernetes", required: 4, actual: 2.9 },
    { skill: "PostgreSQL", required: 4, actual: 3.6 }, { skill: "System design", required: 4, actual: 3.1 },
    { skill: "Secure coding", required: 4, actual: 3.0 } ] },
  { role: "Account Executive", departmentId: "SAL", headcount: 22, skills: [
    { skill: "MEDDIC", required: 4, actual: 2.6 }, { skill: "Negotiation", required: 4, actual: 3.1 },
    { skill: "Salesforce", required: 3, actual: 3.4 }, { skill: "Product demo", required: 4, actual: 3.5 } ] },
  { role: "Customer Success Manager", departmentId: "CSM", headcount: 18, skills: [
    { skill: "QBRs", required: 4, actual: 3.3 }, { skill: "Escalation Mgmt", required: 4, actual: 3.7 },
    { skill: "Data storytelling", required: 3, actual: 2.0 }, { skill: "Renewals", required: 4, actual: 3.2 } ] },
  { role: "Product Manager", departmentId: "PRD", headcount: 12, skills: [
    { skill: "Discovery", required: 4, actual: 3.2 }, { skill: "SQL", required: 3, actual: 2.3 },
    { skill: "Pricing", required: 3, actual: 2.1 }, { skill: "Spec writing", required: 4, actual: 3.6 } ] },
  { role: "Payroll Specialist", departmentId: "FIN", headcount: 6, skills: [
    { skill: "Statutory compliance", required: 5, actual: 4.1 }, { skill: "Ind AS", required: 3, actual: 2.7 },
    { skill: "Data storytelling", required: 2, actual: 1.9 }, { skill: "Excel modelling", required: 4, actual: 3.9 } ] },
];

/** Course that closes each skill gap — the AI recommender ranks by this map plus gap size. */
export const SKILL_COURSE: Record<string, { courseId: string; confidence: number }> = {
  Kubernetes: { courseId: "CRS-006", confidence: 91 },
  "System design": { courseId: "CRS-004", confidence: 86 },
  "Secure coding": { courseId: "CRS-008", confidence: 89 },
  TypeScript: { courseId: "CRS-007", confidence: 64 },
  PostgreSQL: { courseId: "CRS-009", confidence: 78 },
  MEDDIC: { courseId: "CRS-017", confidence: 93 },
  Negotiation: { courseId: "CRS-018", confidence: 88 },
  "Product demo": { courseId: "CRS-017", confidence: 66 },
  QBRs: { courseId: "CRS-011", confidence: 61 },
  "Data storytelling": { courseId: "CRS-011", confidence: 87 },
  Renewals: { courseId: "CRS-018", confidence: 72 },
  Discovery: { courseId: "CRS-012", confidence: 90 },
  SQL: { courseId: "CRS-009", confidence: 84 },
  Pricing: { courseId: "CRS-014", confidence: 92 },
  "Spec writing": { courseId: "CRS-013", confidence: 70 },
  "Statutory compliance": { courseId: "CRS-020", confidence: 90 },
  "Ind AS": { courseId: "CRS-019", confidence: 88 },
  "Excel modelling": { courseId: "CRS-019", confidence: 55 },
  Salesforce: { courseId: "CRS-017", confidence: 52 },
  "Escalation Mgmt": { courseId: "CRS-024", confidence: 58 },
};

/* ---------------------------------------------------------- training budget */

export interface DeptBudget {
  departmentId: string;
  department: string;
  headcount: number;
  allocated: number;
  spent: number;
  committed: number;
}

/** FY 2026-27 L&D budget — ₹12,000 per head, adjusted for strategic priorities. */
const BUDGET_SEEDS: Record<string, [allocated: number, spent: number, committed: number]> = {
  ENG: [1800000, 912000, 486000],
  PRD: [320000, 141500, 96000],
  DES: [210000, 88000, 54000],
  SAL: [780000, 702500, 141000],
  MKT: [230000, 96500, 38000],
  CSM: [420000, 188000, 120500],
  FIN: [240000, 172000, 61000],
  HR: [260000, 118000, 45500],
  ITO: [380000, 151000, 98000],
};

export const TRAINING_BUDGET: DeptBudget[] = DEPARTMENTS.map((d) => {
  const [allocated, spent, committed] = BUDGET_SEEDS[d.id];
  return { departmentId: d.id, department: d.name, headcount: d.headcount, allocated, spent, committed };
});

export interface BudgetRequest {
  id: string;
  employeeCode: string;
  departmentId: string;
  item: string;
  amount: number;
  requestedOn: string;
  justification: string;
  status: "pending" | "approved" | "rejected";
}

export const BUDGET_REQUESTS: BudgetRequest[] = [
  { id: "LBR-031", employeeCode: "STL-0005", departmentId: "SAL", item: "MEDDICC certification — 6 Account Executives", amount: 186000, requestedOn: "2026-09-12", justification: "Win rate on deals above ₹50 L fell to 18%. MEDDIC is the top skill gap for AEs.", status: "pending" },
  { id: "LBR-032", employeeCode: "STL-0145", departmentId: "ENG", item: "KubeCon India 2026 — conference pass and travel", amount: 64500, requestedOn: "2026-09-10", justification: "Speaking slot accepted on our payroll idempotency work.", status: "pending" },
  { id: "LBR-033", employeeCode: "STL-0017", departmentId: "FIN", item: "Labour Codes transition workshop — 3 seats", amount: 42000, requestedOn: "2026-09-08", justification: "New wage-code definitions change the PF base from April.", status: "pending" },
  { id: "LBR-029", employeeCode: "STL-0013", departmentId: "MKT", item: "Reforge Growth Series", amount: 98000, requestedOn: "2026-08-27", justification: "Lifecycle programme redesign in H2.", status: "approved" },
  { id: "LBR-027", employeeCode: "STL-0007", departmentId: "CSM", item: "Gainsight Admin certification", amount: 52000, requestedOn: "2026-08-19", justification: "Tooling consolidation was cancelled; no longer needed.", status: "rejected" },
];
