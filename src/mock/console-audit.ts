/* ============================================================================
   Platform Console — the operators' own audit log. Append-only: every console
   action that changes a tenant, a plan, a baseline, a flag or an operator is
   written here with the operator, the source IP, the reason and the exact
   before/after values. Distinct from a tenant's own trail (console-tenant-
   detail.ts), which is what the tenant's owner can read.

   Timestamps are local wall-clock ISO on the console's demo clock
   (CONSOLE_NOW = 16 Sep 2026, 14:35). All people are fictional.
   ========================================================================== */

export type AuditCategory = "tenant" | "support" | "plan" | "baseline" | "flag" | "operator" | "announcement" | "billing";

export const AUDIT_CATEGORY_LABEL: Record<AuditCategory, string> = {
  tenant: "Tenants",
  support: "Support access",
  plan: "Plans",
  baseline: "Baselines",
  flag: "Feature flags",
  operator: "Operators",
  announcement: "Announcements",
  billing: "Billing",
};

export type AuditResult = "success" | "denied" | "failed";

export type AuditTargetKind = "tenant" | "plan" | "flag" | "operator" | "baseline" | "announcement" | "session";

export type AuditValues = Record<string, string | number | boolean | null | string[]>;

export interface ConsoleAuditEntry {
  id: string;
  at: string;
  operator: string;
  /** e.g. tenant.suspend, plan.edit, flag.toggle — `<category>.<verb>`. */
  action: string;
  category: AuditCategory;
  target: { kind: AuditTargetKind; id: string; label: string };
  /** Set when the action touched one tenant, so the log can filter by tenant. */
  tenantId?: string;
  reason?: string;
  ip: string;
  result: AuditResult;
  before?: AuditValues;
  after?: AuditValues;
}

/* Source IPs per operator — the office egress for most, a home VPN for one. */
export const OPERATOR_IP: Record<string, string> = {
  "Devika Nair": "103.21.58.14",
  "Aditya Rao": "103.21.58.15",
  "Rohan Batra": "103.21.58.22",
  "Sneha Iyer": "103.21.58.23",
  "Meera Pillai": "103.21.58.31",
  "Farhan Qureshi": "49.207.44.190",
  "Ananya Ghosh": "182.74.12.6",
};

type Row = [
  id: number, at: string, operator: string, action: string, category: AuditCategory,
  target: ConsoleAuditEntry["target"], reason?: string, before?: AuditValues, after?: AuditValues, result?: AuditResult,
];

const T = (id: string, label: string): ConsoleAuditEntry["target"] => ({ kind: "tenant", id, label });

const ROWS: Row[] = [
  [48, "2026-09-16T14:22:00", "Rohan Batra", "support.session_start", "support", T("TN-1024", "Redwood Ridge Clinics"), "Owner reports shift roster export missing night shifts. SUP-4461", undefined, { ticket: "SUP-4461", minutes: 30, mode: "read-only" }],
  [47, "2026-09-16T14:10:00", "Aditya Rao", "support.session_start", "support", T("TN-1030", "Merlion Robotics"), "CPF contribution preview differs from the payslip. SUP-4458", undefined, { ticket: "SUP-4458", minutes: 60, mode: "read-only" }],
  [46, "2026-09-16T13:50:00", "Rohan Batra", "support.access_request", "support", T("TN-1027", "Falcon Crest Facilities"), "WPS file rejected by the bank. SUP-4455", undefined, { approval: "pending", approver: "Omar Al Mansoori" }],
  [45, "2026-09-16T12:05:00", "Farhan Qureshi", "tenant.suspend", "tenant", T("TN-1005", "Vindhya Steel Fabricators"), "Step-up MFA required for suspension; no factor enrolled", undefined, undefined, "denied"],
  [44, "2026-09-16T11:15:00", "Rohan Batra", "support.session_end", "support", T("TN-1006", "Coromandel Fintech"), "Issue reproduced; fix tracked in EN-212. SUP-4417", { status: "live" }, { status: "ended", endedBy: "operator", minutes: 30 }],
  [43, "2026-09-16T10:40:00", "Devika Nair", "flag.rollout_change", "flag", { kind: "flag", id: "ai.copilot", label: "ai.copilot" }, "Widening after a clean week at 25%", { state: "rollout", percent: 25, plans: ["enterprise"] }, { state: "rollout", percent: 40, plans: ["enterprise", "pro"] }],
  [42, "2026-09-16T09:05:00", "Meera Pillai", "billing.seat_change", "billing", T("TN-1001", "Kaveri Textiles"), "Owner request by email, prorated", { seatLimit: 400, mrr: 59600 }, { seatLimit: 450, mrr: 67050 }],
  [41, "2026-09-15T18:30:00", "Aditya Rao", "announcement.publish", "announcement", { kind: "announcement", id: "ANN-041", label: "Release 2026.09.2 notes" }, undefined, undefined, { audience: "all", channel: "banner", severity: "info" }],
  [40, "2026-09-15T17:45:00", "Devika Nair", "baseline.publish", "baseline", { kind: "baseline", id: "HOL-IN-2027", label: "India holiday baseline 2027" }, "Gazette notification of 11 Sep 2026", { version: 3, holidays: 17, status: "draft" }, { version: 4, holidays: 18, status: "published" }],
  [39, "2026-09-15T16:20:00", "Devika Nair", "plan.edit", "plan", { kind: "plan", id: "pro", label: "Pro plan" }, "Storage allowance raised with the Oct price list", { storageGb: 50, rateLimit: 500 }, { storageGb: 100, rateLimit: 500 }],
  [38, "2026-09-15T11:30:00", "Sneha Iyer", "flag.toggle", "flag", { kind: "flag", id: "attendance.geo_fencing", label: "attendance.geo_fencing" }, "Staging verification complete", { state: "off" }, { state: "targeted", plans: ["enterprise"] }],
  [37, "2026-09-14T19:10:00", "Devika Nair", "flag.kill_switch", "flag", { kind: "flag", id: "payroll.new_formula_engine", label: "payroll.new_formula_engine" }, "Rounding mismatch on LOP days, INC-118", { state: "rollout", percent: 10, killed: false }, { state: "rollout", percent: 10, killed: true }],
  [36, "2026-09-14T10:00:00", "Devika Nair", "operator.invite", "operator", { kind: "operator", id: "OP-010", label: "Vikram Sethi" }, "Joining the support rota from 21 Sep", undefined, { role: "support_engineer", email: "vikram.sethi@hrms-new.app" }],
  [35, "2026-09-12T15:20:00", "Meera Pillai", "tenant.create", "tenant", T("TN-1012", "Narmada Infra Projects"), "Enterprise MSA countersigned", undefined, { plan: "enterprise", seatLimit: 3000, status: "pending" }],
  [34, "2026-09-12T12:40:00", "Aditya Rao", "support.access_request", "support", T("TN-1031", "Straits Fintech"), "SSO metadata check during PoC. SUP-4398", undefined, { approval: "declined", approver: "Marcus Lim" }],
  [33, "2026-09-11T16:05:00", "Devika Nair", "operator.mfa_reset", "operator", { kind: "operator", id: "OP-006", label: "Farhan Qureshi" }, "Lost phone, identity verified on a video call", { mfa: "enrolled" }, { mfa: "not_enrolled" }],
  [32, "2026-09-10T10:00:00", "Devika Nair", "tenant.suspend", "tenant", T("TN-1009", "Konkan Marine Services"), "Two invoices unpaid past 60 days; suspended under the billing policy.", { status: "active" }, { status: "suspended" }],
  [31, "2026-09-09T14:30:00", "Aditya Rao", "tenant.plan_change", "tenant", T("TN-1036", "Mahanadi Grid Systems"), "Upgrade signed off by the customer's CFO", { plan: "pro", seatLimit: 1200, mrr: 178800 }, { plan: "enterprise", seatLimit: 1500, mrr: 178500 }],
  [30, "2026-09-08T09:15:00", "Ananya Ghosh", "audit.export", "operator", { kind: "operator", id: "audit-log", label: "Console audit log" }, "Quarterly SOC 2 evidence pull", undefined, { range: "2026-06-01 → 2026-08-31", rows: 1284 }],
  [29, "2026-09-06T02:00:00", "Aditya Rao", "announcement.end", "announcement", { kind: "announcement", id: "ANN-036", label: "Payroll engine patch window" }, "Maintenance finished early", { status: "live" }, { status: "ended" }],
  [28, "2026-09-05T13:00:00", "Meera Pillai", "billing.credit_note", "billing", T("TN-1028", "Dune & Dhow Trading"), "Downtime credit for 02 Sep email incident", undefined, { creditNote: "CN-2609-04", amount: 1490 }],
  [27, "2026-09-04T17:40:00", "Devika Nair", "flag.create", "flag", { kind: "flag", id: "beta.new_org_chart", label: "beta.new_org_chart" }, "Design partner programme", undefined, { state: "targeted", tenants: ["TN-1019", "TN-1030"] }],
  [26, "2026-09-03T11:25:00", "Rohan Batra", "tenant.trial_extend", "tenant", T("TN-1010", "Aravalli Solar Power"), "Sales asked for one more payroll cycle", { trialEndsAt: "2026-09-12" }, { trialEndsAt: "2026-09-19" }],
  [25, "2026-09-02T14:00:00", "Devika Nair", "tenant.delete_scheduled", "tenant", T("TN-1015", "Ganga Retail Ventures"), "Owner requested closure and erasure on 02 Sep 2026 (DPDP s.12).", { status: "suspended", deletionScheduledAt: null }, { status: "scheduled_deletion", deletionScheduledAt: "2026-09-02" }],
  [24, "2026-09-01T09:30:00", "Aditya Rao", "tenant.delete_scheduled", "tenant", T("TN-1029", "Oasis Bay Hospitality"), "Contract ended 31 Aug 2026; export delivered on 29 Aug.", { status: "active", deletionScheduledAt: null }, { status: "scheduled_deletion", deletionScheduledAt: "2026-09-01" }],
  [23, "2026-08-29T15:10:00", "Aditya Rao", "tenant.export", "tenant", T("TN-1029", "Oasis Bay Hospitality"), "Exit export before erasure", undefined, { recipient: "layla.haddad@oasis.ae", expiresInDays: 7 }],
  [22, "2026-08-28T16:45:00", "Farhan Qureshi", "operator.role_change", "operator", { kind: "operator", id: "OP-006", label: "Farhan Qureshi" }, "Self-service role change attempt", { role: "support_engineer" }, { role: "super_admin" }, "denied"],
  [21, "2026-08-27T10:20:00", "Devika Nair", "baseline.publish", "baseline", { kind: "baseline", id: "PT-MH-2026", label: "Maharashtra professional tax slabs" }, "State notification effective 01 Oct 2026", { version: 2, slabs: 3 }, { version: 3, slabs: 3 }],
  [20, "2026-08-24T12:00:00", "Rohan Batra", "support.session_start", "support", T("TN-1004", "Brahmaputra Agro Foods"), "Trial onboarding: leave policy import failed. SUP-4321", undefined, { ticket: "SUP-4321", minutes: 15, mode: "read-only" }],
  [19, "2026-08-21T09:00:00", "Devika Nair", "plan.edit", "plan", { kind: "plan", id: "free", label: "Free plan" }, "Engagement module removed from Free", { modules: ["core", "time", "leave", "platform", "engagement"] }, { modules: ["core", "time", "leave", "platform"] }],
  [18, "2026-08-19T16:05:00", "Rohan Batra", "support.session_start", "support", T("TN-1017", "Lotus Pharma Distributors"), "Payslip PDF rendering. SUP-4302", undefined, { ticket: "SUP-4302", minutes: 30, mode: "read-only" }],
  [17, "2026-08-18T13:30:00", "Meera Pillai", "billing.retry_payment", "billing", T("TN-1026", "Prairie Lantern Foods"), "Customer updated the card", { payment: "failed" }, { payment: "failed" }, "failed"],
];

export const CONSOLE_AUDIT: ConsoleAuditEntry[] = ROWS.map(([n, at, operator, action, category, target, reason, before, after, result]) => ({
  id: `AUD-${String(n).padStart(5, "0")}`,
  at,
  operator,
  action,
  category,
  target,
  tenantId: target.kind === "tenant" ? target.id : undefined,
  reason,
  ip: OPERATOR_IP[operator] ?? "103.21.58.14",
  result: result ?? "success",
  before,
  after,
}));

/** Retention for the console audit log, in years (contractual + SOC 2). */
export const AUDIT_RETENTION_YEARS = 7;
