/* ============================================================================
   Compliance fixtures — statutory registers, POSH, DPDP data-subject
   requests, retention policies and the consent register.
   ========================================================================== */

import { mulberry32, pick, randInt } from "@/lib/utils";
import { EMPLOYEES } from "@/mock/employees";

/* ---------------------------------------------------- statutory registers */

export interface StatutoryRegister {
  id: string;
  name: string;
  form: string;
  act: string;
  frequency: "Monthly" | "Annual" | "Event-based";
  scope: string;
  rows: number;
  lastGeneratedAt: string | null;
}

export const STATUTORY_REGISTERS: StatutoryRegister[] = [
  { id: "ka-form-a", name: "Register of employment", form: "Form A", act: "Karnataka Shops & Commercial Establishments Act, 1961", frequency: "Monthly", scope: "Bengaluru HQ", rows: 218, lastGeneratedAt: "2026-09-02T10:15:00" },
  { id: "ka-form-b", name: "Register of wages", form: "Form B", act: "Karnataka Shops & Commercial Establishments Act, 1961", frequency: "Monthly", scope: "Bengaluru HQ", rows: 218, lastGeneratedAt: "2026-09-02T10:16:00" },
  { id: "ka-form-c", name: "Register of leave", form: "Form C", act: "Karnataka Shops & Commercial Establishments Act, 1961", frequency: "Annual", scope: "Bengaluru HQ", rows: 218, lastGeneratedAt: "2026-04-05T09:40:00" },
  { id: "ka-form-d", name: "Register of fines & deductions", form: "Form D", act: "Karnataka Shops & Commercial Establishments Act, 1961", frequency: "Monthly", scope: "Bengaluru HQ", rows: 3, lastGeneratedAt: "2026-09-02T10:16:00" },
  { id: "mh-form-ii", name: "Muster roll", form: "Form II", act: "Maharashtra Shops & Establishments Act, 2017", frequency: "Monthly", scope: "Pune Delivery Centre", rows: 74, lastGeneratedAt: "2026-09-02T10:20:00" },
  { id: "wages", name: "Register of wages", form: "Form IV", act: "Code on Wages, 2019 (Payment of Wages rules)", frequency: "Monthly", scope: "All Indian branches", rows: 327, lastGeneratedAt: "2026-09-02T10:22:00" },
  { id: "pf", name: "PF contribution register (ECR)", form: "Form 3A / ECR", act: "EPF & MP Act, 1952", frequency: "Monthly", scope: "All Indian branches", rows: 327, lastGeneratedAt: "2026-09-12T17:05:00" },
  { id: "esi", name: "ESI contribution register", form: "Form 7", act: "ESI Act, 1948", frequency: "Monthly", scope: "Employees ≤ ₹21,000 gross", rows: 19, lastGeneratedAt: "2026-09-12T17:08:00" },
  { id: "maternity", name: "Maternity benefit register", form: "Form A", act: "Maternity Benefit Act, 1961", frequency: "Event-based", scope: "All Indian branches", rows: 4, lastGeneratedAt: null },
  { id: "bonus", name: "Bonus register", form: "Form C", act: "Payment of Bonus Act, 1965", frequency: "Annual", scope: "Eligible employees", rows: 21, lastGeneratedAt: "2025-11-20T12:00:00" },
];

/* ------------------------------------------------------------------ POSH */

export interface IcMember {
  name: string;
  role: "Presiding Officer" | "Member" | "External Member";
  detail: string;
  termEnds: string;
}

export const IC_MEMBERS: IcMember[] = [
  { name: "Aditi Krishnan", role: "Presiding Officer", detail: "Chief Product Officer · senior woman employee", termEnds: "2027-03-31" },
  { name: "Priya Menon", role: "Member", detail: "Head of People Operations", termEnds: "2027-03-31" },
  { name: "Sandeep Nair", role: "Member", detail: "Director of Customer Success", termEnds: "2027-03-31" },
  { name: "Tanvi Deshpande", role: "Member", detail: "Head of Design", termEnds: "2027-03-31" },
  { name: "Adv. Rekha Sharma", role: "External Member", detail: "Advocate, Karnataka High Court · NGO: Vimochana", termEnds: "2027-03-31" },
];

export type PoshStage = "received" | "preliminary" | "inquiry" | "report" | "closed";

export const POSH_STAGES: { id: PoshStage; label: string }[] = [
  { id: "received", label: "Complaint received" },
  { id: "preliminary", label: "Notice to respondent" },
  { id: "inquiry", label: "Inquiry" },
  { id: "report", label: "Report & recommendation" },
  { id: "closed", label: "Action taken / closed" },
];

export interface PoshCase {
  code: string;
  filedAt: string;
  branch: string;
  nature: string;
  stage: PoshStage;
  outcome?: "Upheld" | "Not upheld" | "Settled by conciliation" | "Withdrawn";
  closedAt?: string;
}

export const POSH_CASES: PoshCase[] = [
  { code: "IC/2026/007", filedAt: "2026-09-04", branch: "Bengaluru HQ", nature: "Verbal — inappropriate remarks", stage: "preliminary" },
  { code: "IC/2026/006", filedAt: "2026-07-22", branch: "Pune Delivery Centre", nature: "Digital — unwelcome messages", stage: "inquiry" },
  { code: "IC/2026/005", filedAt: "2026-06-18", branch: "Bengaluru HQ", nature: "Physical — unwelcome contact", stage: "report" },
  { code: "IC/2026/004", filedAt: "2026-04-09", branch: "Hyderabad Satellite", nature: "Verbal — inappropriate remarks", stage: "closed", outcome: "Settled by conciliation", closedAt: "2026-05-02" },
  { code: "IC/2025/003", filedAt: "2025-11-12", branch: "Bengaluru HQ", nature: "Quid pro quo", stage: "closed", outcome: "Upheld", closedAt: "2026-01-28" },
  { code: "IC/2025/002", filedAt: "2025-08-30", branch: "Pune Delivery Centre", nature: "Digital — unwelcome messages", stage: "closed", outcome: "Not upheld", closedAt: "2025-11-14" },
];

export const POSH_TRAINING = { assigned: 340, completed: 311, overdue: 17, icRefresher: "2026-07-10", nextAwareness: "2026-10-15" };

/* ------------------------------------------------------------------- DPDP */

export type DsrType = "access" | "correction" | "erasure" | "grievance" | "nomination";
export type DsrStatus = "new" | "verifying" | "in_progress" | "fulfilled" | "rejected" | "on_hold";

export const DSR_TYPE_LABEL: Record<DsrType, string> = {
  access: "Access (summary of data)",
  correction: "Correction",
  erasure: "Erasure",
  grievance: "Grievance",
  nomination: "Nomination",
};

export interface DataSubjectRequest {
  id: string;
  type: DsrType;
  principalCode: string;
  principalName: string;
  principalKind: "Employee" | "Ex-employee" | "Candidate";
  receivedAt: string;
  dueAt: string;
  status: DsrStatus;
  identityVerified: boolean;
  channel: "Self-service" | "Email to DPO" | "Grievance portal";
  detail: string;
  legalHold?: string;
}

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function buildDsr(): DataSubjectRequest[] {
  const rng = mulberry32(3303);
  const types: DsrType[] = ["access", "access", "correction", "erasure", "grievance", "nomination", "access", "correction", "erasure", "access", "grievance", "correction", "erasure", "access"];
  const statuses: DsrStatus[] = ["new", "verifying", "in_progress", "on_hold", "in_progress", "fulfilled", "fulfilled", "fulfilled", "rejected", "fulfilled", "in_progress", "new", "verifying", "fulfilled"];
  const details: Record<DsrType, string> = {
    access: "Requests a summary of personal data processed and the processing activities, plus the identities of processors it was shared with.",
    correction: "Bank IFSC and permanent address on file are outdated.",
    erasure: "Requests erasure of personal data no longer necessary for the stated purpose.",
    grievance: "Biometric attendance data was shared with the facility vendor without notice.",
    nomination: "Nominates a family member to exercise rights in the event of death or incapacity.",
  };
  return types.map((type, i) => {
    const e = EMPLOYEES[randInt(rng, 30, 330)];
    const kind: DataSubjectRequest["principalKind"] = e.status === "exited" ? "Ex-employee" : i === 8 ? "Candidate" : "Employee";
    const received = addDays("2026-09-16", -randInt(rng, 1, 40) - (i > 9 ? 30 : 0));
    const hold = type === "erasure" && i === 3 ? "Legal hold LH-2026-02 — pending labour court matter (Pune) covers this employee's payroll and attendance records." : undefined;
    return {
      id: `DSR-${String(1040 + i)}`,
      type,
      principalCode: i === 8 ? `CAN-${2200 + i}` : e.code,
      principalName: e.name,
      principalKind: kind,
      receivedAt: received,
      dueAt: addDays(received, type === "grievance" ? 7 : 30),
      status: hold ? "on_hold" : statuses[i],
      identityVerified: !["new", "verifying"].includes(statuses[i]),
      channel: pick(rng, ["Self-service", "Self-service", "Email to DPO", "Grievance portal"] as const),
      detail: details[type],
      legalHold: hold,
    };
  });
}

export const DSR_REQUESTS: DataSubjectRequest[] = buildDsr();

/* -------------------------------------------------------------- retention */

export interface RetentionPolicy {
  id: string;
  entity: string;
  module: string;
  period: string;
  basis: string;
  action: "Anonymise" | "Delete" | "Archive" | "Not stored";
  legalHold: boolean;
  eligible: number;
  lastPurgeRun: string | null;
}

export const RETENTION_POLICIES: RetentionPolicy[] = [
  { id: "RP-01", entity: "Attendance records", module: "Time", period: "8 years after FY end", basis: "Code on Wages / Factories & S&E Acts", action: "Archive", legalHold: true, eligible: 41208, lastPurgeRun: "2026-04-05" },
  { id: "RP-02", entity: "Payroll & payslips", module: "Payroll", period: "8 years after FY end", basis: "Income-tax Act s.44AA · Companies Act s.128", action: "Archive", legalHold: true, eligible: 9311, lastPurgeRun: "2026-04-05" },
  { id: "RP-03", entity: "Candidate data (not hired)", module: "Recruitment", period: "1 year after last activity", basis: "DPDP Act 2023 s.8(7) — purpose served", action: "Delete", legalHold: false, eligible: 1284, lastPurgeRun: "2026-08-31" },
  { id: "RP-04", entity: "Ex-employee personal data", module: "Core HR", period: "8 years after exit", basis: "Limitation + statutory registers", action: "Anonymise", legalHold: false, eligible: 37, lastPurgeRun: "2026-06-30" },
  { id: "RP-05", entity: "Biometric templates", module: "Time", period: "Until exit + 30 days", basis: "DPDP Act 2023 — consent withdrawn / purpose served", action: "Delete", legalHold: false, eligible: 6, lastPurgeRun: "2026-09-01" },
  { id: "RP-06", entity: "POSH case files", module: "Compliance", period: "Permanent (restricted)", basis: "POSH Act 2013 s.21 annual reports", action: "Archive", legalHold: false, eligible: 0, lastPurgeRun: null },
  { id: "RP-07", entity: "Audit log", module: "Platform", period: "8 years", basis: "ISO 27001 · SOC 2 evidence", action: "Archive", legalHold: false, eligible: 0, lastPurgeRun: null },
  { id: "RP-08", entity: "Helpdesk tickets", module: "Helpdesk", period: "3 years after closure", basis: "Internal policy HR-POL-014", action: "Anonymise", legalHold: false, eligible: 412, lastPurgeRun: "2026-07-01" },
  { id: "RP-09", entity: "CCTV footage", module: "Facilities", period: "n/a — not stored in HRMS", basis: "Managed by facility vendor under DPA", action: "Not stored", legalHold: false, eligible: 0, lastPurgeRun: null },
];

/* ---------------------------------------------------------------- consent */

export type ConsentPurpose = "bgv" | "biometric" | "marketing" | "ai";
export type ConsentStatus = "granted" | "withdrawn" | "pending";

export const CONSENT_PURPOSE_LABEL: Record<ConsentPurpose, string> = {
  bgv: "Background verification",
  biometric: "Biometric attendance",
  marketing: "Marketing communications",
  ai: "AI processing",
};

export interface ConsentRecord {
  id: string;
  employeeCode: string;
  employeeName: string;
  branchId: string;
  purpose: ConsentPurpose;
  status: ConsentStatus;
  noticeVersion: string;
  capturedAt: string | null;
  withdrawnAt: string | null;
  channel: "Onboarding portal" | "Self-service" | "Kiosk";
}

/** A withdrawal can never predate the consent it withdraws. */
function laterOf(withdrawn: string, captured: string | null) {
  return captured && withdrawn <= captured ? addDays(captured, 14) : withdrawn;
}

function buildConsents(): ConsentRecord[] {
  const rng = mulberry32(6606);
  const out: ConsentRecord[] = [];
  EMPLOYEES.filter((e) => e.status !== "exited").slice(0, 120).forEach((e) => {
    (Object.keys(CONSENT_PURPOSE_LABEL) as ConsentPurpose[]).forEach((p) => {
      if (p === "biometric" && e.branchId === "EWR") return;
      const r = rng();
      const status: ConsentStatus =
        p === "marketing" ? (r < 0.42 ? "granted" : r < 0.8 ? "withdrawn" : "pending") : p === "ai" ? (r < 0.78 ? "granted" : r < 0.88 ? "withdrawn" : "pending") : r < 0.95 ? "granted" : r < 0.98 ? "withdrawn" : "pending";
      const captured = status === "pending" ? null : e.joiningDate > "2026-01-01" ? e.joiningDate : addDays("2025-11-01", randInt(rng, 0, 60));
      out.push({
        id: `CON-${out.length + 1}`,
        employeeCode: e.code,
        employeeName: e.name,
        branchId: e.branchId,
        purpose: p,
        status,
        noticeVersion: p === "ai" ? "v2.1 (Aug 2026)" : "v1.4 (Nov 2025)",
        capturedAt: captured,
        withdrawnAt: status === "withdrawn" ? laterOf(addDays("2026-09-16", -randInt(rng, 3, 200)), captured) : null,
        channel: e.joiningDate > "2026-01-01" ? "Onboarding portal" : pick(rng, ["Self-service", "Self-service", "Kiosk"] as const),
      });
    });
  });
  return out;
}

export const CONSENTS: ConsentRecord[] = buildConsents();
