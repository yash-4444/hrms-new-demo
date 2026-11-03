import { addMinutes, differenceInMinutes, format, parseISO } from "date-fns";
import { mulberry32 } from "@/lib/utils";
import { CONSOLE_NOW } from "@/mock/console-tenants";

/* ============================================================================
   Platform Console — support access. Every impersonation ("support session")
   an operator has opened into a tenant: who, where, why, under which ticket,
   for how long, how it ended, and every page they looked at. Sessions are
   read-only, so the only actions a session can record are page views; a write
   attempt is blocked and counted.

   Some tenants require their owner to approve support access first; for those
   the operator files an access request and waits. Demo clock: 16 Sep 2026,
   14:35. All people are fictional.
   ========================================================================== */

export type SessionEndedBy = "operator" | "timeout" | "owner_revoked" | "terminated";

export const ENDED_BY_LABEL: Record<SessionEndedBy, string> = {
  operator: "Operator",
  timeout: "Timeout",
  owner_revoked: "Tenant owner revoked",
  terminated: "Terminated by an admin",
};

export interface PageView {
  at: string;
  path: string;
  label: string;
}

export interface SupportSessionLog {
  id: string;
  operator: string;
  tenantId: string;
  reason: string;
  /** Required by policy — sessions without one are refused; the stat tracks it. */
  ticket: string | null;
  startedAt: string;
  grantedMinutes: number;
  /** Absent while the session is live. */
  endedAt?: string;
  endedBy?: SessionEndedBy;
  /** Who ended it, when not the operator themselves. */
  endedByName?: string;
  views: PageView[];
  /** Write attempts the read-only lens refused. */
  blockedWrites: number;
}

const TENANT_PAGES: [string, string][] = [
  ["/employees", "Employee directory"],
  ["/attendance/roster", "Shift roster"],
  ["/attendance/devices", "Biometric devices"],
  ["/payroll/runs", "Pay runs"],
  ["/payroll/payslips", "Payslips"],
  ["/leave/balances", "Leave balances"],
  ["/leave/policies", "Leave policies"],
  ["/admin/settings", "Organisation settings"],
  ["/admin/audit", "Audit log"],
  ["/admin/integrations", "Integrations"],
  ["/reports", "Reports"],
];

const iso = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm:ss");

/** A deterministic trail of pages viewed between start and end, starting on the dashboard. */
export function pageTrail(seed: number, startedAt: string, minutes: number): PageView[] {
  const rng = mulberry32(seed);
  const start = parseISO(startedAt);
  const count = Math.max(2, Math.min(12, Math.round(minutes / 4 + rng() * 3)));
  const out: PageView[] = [{ at: iso(start), path: "/dashboard", label: "Dashboard" }];
  let t = 0;
  for (let i = 1; i < count; i++) {
    t += Math.max(1, Math.round((minutes / count) * (0.5 + rng())));
    if (t >= minutes) break;
    const [path, label] = TENANT_PAGES[Math.floor(rng() * TENANT_PAGES.length)];
    out.push({ at: iso(addMinutes(start, t)), path, label });
  }
  return out;
}

/* id · operator · tenant · ticket · reason · start · granted · actual minutes (null = live) · ended by · blocked */
type Row = [number, string, string, string, string, string, number, number | null, SessionEndedBy?, number?, string?];

const ROWS: Row[] = [
  [471, "Rohan Batra", "TN-1024", "SUP-4461", "Shift roster export is missing night shifts for two clinics.", "2026-09-16T14:22:00", 30, null],
  [470, "Aditya Rao", "TN-1030", "SUP-4458", "CPF contribution preview differs from the generated payslip.", "2026-09-16T14:10:00", 60, null],
  [469, "Rohan Batra", "TN-1006", "SUP-4417", "Owner cannot see the HRA exemption on September payslips.", "2026-09-16T10:45:00", 30, 30, "operator"],
  [468, "Sneha Iyer", "TN-1011", "SUP-4449", "Biometric devices stopped syncing punches after a firmware update.", "2026-09-15T16:00:00", 60, 60, "timeout", 1],
  [467, "Devika Nair", "TN-1009", "SUP-4440", "Confirm what the suspension notice shows to users before reactivation.", "2026-09-14T11:00:00", 15, 12, "operator"],
  [466, "Sneha Iyer", "TN-1001", "SUP-4431", "Leave encashment amount looks wrong for a resigned employee.", "2026-09-12T15:30:00", 30, 9, "owner_revoked"],
  [465, "Farhan Qureshi", "TN-1021", "SUP-4426", "API rate-limit errors from the shift-change integration.", "2026-09-11T06:40:00", 30, 30, "timeout", 2],
  [464, "Rohan Batra", "TN-1014", "SUP-4420", "Org chart shows a manager loop after a bulk import.", "2026-09-09T12:10:00", 15, 11, "operator"],
  [463, "Aditya Rao", "TN-1003", "SUP-4412", "Multi-entity payroll consolidation report totals do not tie out.", "2026-09-08T10:00:00", 60, 42, "operator"],
  [462, "Sneha Iyer", "TN-1017", "SUP-4409", "Expense claim approval stuck at the second level.", "2026-09-05T14:20:00", 30, 18, "operator"],
  [461, "Rohan Batra", "TN-1023", "SUP-4401", "Payroll module disabled but still listed in the owner's menu.", "2026-09-03T19:30:00", 30, 30, "timeout"],
  [460, "Devika Nair", "TN-1005", "SUP-4395", "Check billing contact details before the dunning retry.", "2026-09-02T09:15:00", 15, 9, "operator"],
  [459, "Farhan Qureshi", "TN-1028", "SUP-4388", "WPS salary file format question from the owner.", "2026-09-01T13:05:00", 30, 21, "terminated", 0, "Devika Nair"],
  [455, "Rohan Batra", "TN-1004", "SUP-4321", "Trial onboarding: leave policy import failed.", "2026-08-24T12:00:00", 15, 15, "timeout"],
  [452, "Rohan Batra", "TN-1017", "SUP-4302", "Payslip PDF rendering cuts off the deductions table.", "2026-08-19T16:05:00", 30, 30, "timeout"],
];

export const SUPPORT_SESSIONS: SupportSessionLog[] = ROWS.map(([n, operator, tenantId, ticket, reason, startedAt, granted, actual, endedBy, blocked, endedByName]) => ({
  id: `SS-0${n}`,
  operator,
  tenantId,
  ticket,
  reason,
  startedAt,
  grantedMinutes: granted,
  endedAt: actual === null ? undefined : iso(addMinutes(parseISO(startedAt), actual)),
  endedBy,
  endedByName,
  views: pageTrail(n, startedAt, actual ?? differenceInMinutes(parseISO(CONSOLE_NOW), parseISO(startedAt))),
  blockedWrites: blocked ?? 0,
}));

/* ------------------------------------------------- per-tenant access policy */

/** Tenants whose owner must approve each support session in advance. */
export const APPROVAL_REQUIRED = new Set(["TN-1003", "TN-1008", "TN-1027", "TN-1031", "TN-1036"]);

export type AccessRequestStatus = "pending" | "approved" | "declined" | "used";

export interface AccessRequest {
  id: string;
  tenantId: string;
  operator: string;
  ticket: string;
  reason: string;
  minutes: number;
  requestedAt: string;
  status: AccessRequestStatus;
  decidedAt?: string;
  decidedBy?: string;
  note?: string;
}

export const ACCESS_REQUESTS: AccessRequest[] = [
  { id: "REQ-118", tenantId: "TN-1027", operator: "Rohan Batra", ticket: "SUP-4455", reason: "WPS file rejected by the bank — need to see the bank profile setup.", minutes: 30, requestedAt: "2026-09-16T13:50:00", status: "pending" },
  { id: "REQ-117", tenantId: "TN-1008", operator: "Sneha Iyer", ticket: "SUP-4452", reason: "Shift allowance not flowing into the September pay run.", minutes: 60, requestedAt: "2026-09-16T11:30:00", status: "approved", decidedAt: "2026-09-16T11:42:00", decidedBy: "Dr. Kavitha Reddy", note: "Approved for today only." },
  { id: "REQ-116", tenantId: "TN-1031", operator: "Aditya Rao", ticket: "SUP-4398", reason: "SSO metadata check during the proof of concept.", minutes: 30, requestedAt: "2026-09-12T12:40:00", status: "declined", decidedAt: "2026-09-12T14:05:00", decidedBy: "Marcus Lim", note: "Security review in progress — please use a screen-share instead." },
  { id: "REQ-115", tenantId: "TN-1003", operator: "Aditya Rao", ticket: "SUP-4412", reason: "Multi-entity payroll consolidation totals.", minutes: 60, requestedAt: "2026-09-08T09:20:00", status: "used", decidedAt: "2026-09-08T09:48:00", decidedBy: "Harish Venkataraman" },
];
