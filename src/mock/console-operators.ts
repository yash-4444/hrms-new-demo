import { OPERATOR_IP } from "@/mock/console-audit";

/* ============================================================================
   Platform Console — operators: the vendor's own staff who can sign in to the
   console. Distinct from tenant users; no operator belongs to a tenant. MFA
   is enforced for every operator, so an active operator without an enrolled
   factor is a finding, not a preference. All people are fictional.
   ========================================================================== */

export type PlatformRole = "super_admin" | "support_engineer" | "billing_manager" | "auditor";
export type OperatorStatus = "active" | "invited" | "deactivated";

export const PLATFORM_ROLE_LABEL: Record<PlatformRole, string> = {
  super_admin: "Super Admin",
  support_engineer: "Support Engineer",
  billing_manager: "Billing Manager",
  auditor: "Read-only Auditor",
};

export const PLATFORM_ROLE_DESCRIPTION: Record<PlatformRole, string> = {
  super_admin: "Everything, including deleting tenants and managing operators.",
  support_engineer: "Tenant support: view and edit tenants, open support sessions, flags and announcements.",
  billing_manager: "Plans, seats, invoices and collections. No support sessions.",
  auditor: "Read-only across the console, including the audit log. Changes nothing.",
};

export interface Operator {
  id: string;
  name: string;
  email: string;
  role: PlatformRole;
  status: OperatorStatus;
  mfa: { enrolled: boolean; method?: "Authenticator app" | "Security key" };
  lastSignInAt?: string;
  lastSignInIp?: string;
  /** CIDR ranges the operator may sign in from; empty means the office VPN only. */
  ipAllowList: string[];
  invitedAt?: string;
  invitedBy?: string;
  deactivatedReason?: string;
}

const OFFICE = "103.21.58.0/24";

export const OPERATORS: Operator[] = [
  { id: "OP-001", name: "Devika Nair", email: "devika.nair@hrms-new.app", role: "super_admin", status: "active", mfa: { enrolled: true, method: "Security key" }, lastSignInAt: "2026-09-16T08:52:00", lastSignInIp: OPERATOR_IP["Devika Nair"], ipAllowList: [OFFICE] },
  { id: "OP-002", name: "Aditya Rao", email: "aditya.rao@hrms-new.app", role: "super_admin", status: "active", mfa: { enrolled: true, method: "Security key" }, lastSignInAt: "2026-09-16T09:10:00", lastSignInIp: OPERATOR_IP["Aditya Rao"], ipAllowList: [OFFICE] },
  { id: "OP-003", name: "Rohan Batra", email: "rohan.batra@hrms-new.app", role: "support_engineer", status: "active", mfa: { enrolled: true, method: "Authenticator app" }, lastSignInAt: "2026-09-16T09:02:00", lastSignInIp: OPERATOR_IP["Rohan Batra"], ipAllowList: [OFFICE] },
  { id: "OP-004", name: "Sneha Iyer", email: "sneha.iyer@hrms-new.app", role: "support_engineer", status: "active", mfa: { enrolled: true, method: "Authenticator app" }, lastSignInAt: "2026-09-16T10:30:00", lastSignInIp: OPERATOR_IP["Sneha Iyer"], ipAllowList: [OFFICE] },
  { id: "OP-005", name: "Meera Pillai", email: "meera.pillai@hrms-new.app", role: "billing_manager", status: "active", mfa: { enrolled: true, method: "Authenticator app" }, lastSignInAt: "2026-09-16T09:00:00", lastSignInIp: OPERATOR_IP["Meera Pillai"], ipAllowList: [OFFICE] },
  { id: "OP-006", name: "Farhan Qureshi", email: "farhan.qureshi@hrms-new.app", role: "support_engineer", status: "active", mfa: { enrolled: false }, lastSignInAt: "2026-09-16T12:01:00", lastSignInIp: OPERATOR_IP["Farhan Qureshi"], ipAllowList: [OFFICE, "49.207.44.0/24"] },
  { id: "OP-007", name: "Tushar Bhatt", email: "tushar.bhatt@hrms-new.app", role: "billing_manager", status: "active", mfa: { enrolled: true, method: "Authenticator app" }, lastSignInAt: "2026-09-11T17:45:00", lastSignInIp: "103.21.58.33", ipAllowList: [OFFICE] },
  { id: "OP-008", name: "Ananya Ghosh", email: "ananya.ghosh@assurance-partners.in", role: "auditor", status: "active", mfa: { enrolled: true, method: "Security key" }, lastSignInAt: "2026-09-08T09:05:00", lastSignInIp: OPERATOR_IP["Ananya Ghosh"], ipAllowList: ["182.74.12.0/28"] },
  { id: "OP-010", name: "Vikram Sethi", email: "vikram.sethi@hrms-new.app", role: "support_engineer", status: "invited", mfa: { enrolled: false }, ipAllowList: [OFFICE], invitedAt: "2026-09-14T10:00:00", invitedBy: "Devika Nair" },
  { id: "OP-009", name: "Neha Kapoor", email: "neha.kapoor@hrms-new.app", role: "support_engineer", status: "deactivated", mfa: { enrolled: true, method: "Authenticator app" }, lastSignInAt: "2026-07-31T18:20:00", lastSignInIp: "103.21.58.24", ipAllowList: [OFFICE], deactivatedReason: "Left the company on 31 Jul 2026." },
];

/* ----------------------------------------------- role × permission matrix */

export type PlatformPermission =
  | "view_tenants"
  | "edit_tenants"
  | "suspend_delete"
  | "impersonate"
  | "billing"
  | "plans"
  | "baselines"
  | "flags"
  | "operators"
  | "audit";

export const PLATFORM_PERMISSIONS: { key: PlatformPermission; label: string; hint: string }[] = [
  { key: "view_tenants", label: "View tenants", hint: "Tenant list, detail, usage and activity." },
  { key: "edit_tenants", label: "Edit tenants", hint: "Plan, seats, trial, modules and owner details." },
  { key: "suspend_delete", label: "Suspend / delete tenants", hint: "Suspend, reactivate and schedule deletion." },
  { key: "impersonate", label: "Support sessions", hint: "Open read-only support sessions into a tenant." },
  { key: "billing", label: "Billing", hint: "Invoices, credit notes, payment retries." },
  { key: "plans", label: "Plans & entitlements", hint: "Edit plan modules, seat prices and limits." },
  { key: "baselines", label: "Reference baselines", hint: "Publish holiday calendars and statutory tables." },
  { key: "flags", label: "Feature flags", hint: "Toggle flags and change roll-outs." },
  { key: "operators", label: "Operators", hint: "Invite, change role, deactivate, reset MFA." },
  { key: "audit", label: "Audit log", hint: "Read and export the console audit log." },
];

/** "full" = view and change · "view" = read-only · "partial" = suspend only, not delete · null = none. */
export type Grant = "full" | "view" | "partial" | null;

export const ROLE_GRANTS: Record<PlatformRole, Record<PlatformPermission, Grant>> = {
  super_admin: { view_tenants: "full", edit_tenants: "full", suspend_delete: "full", impersonate: "full", billing: "full", plans: "full", baselines: "full", flags: "full", operators: "full", audit: "full" },
  support_engineer: { view_tenants: "full", edit_tenants: "full", suspend_delete: "partial", impersonate: "full", billing: "view", plans: "view", baselines: "view", flags: "full", operators: null, audit: "view" },
  billing_manager: { view_tenants: "full", edit_tenants: "full", suspend_delete: "partial", impersonate: null, billing: "full", plans: "full", baselines: null, flags: null, operators: null, audit: "view" },
  auditor: { view_tenants: "view", edit_tenants: null, suspend_delete: null, impersonate: null, billing: "view", plans: "view", baselines: "view", flags: "view", operators: "view", audit: "full" },
};
