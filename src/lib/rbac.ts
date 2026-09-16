/* ============================================================================
   RBAC — menu keys × roles × action letters.
   V view · C create · E edit · D delete · X execute · A approve
   This module is the single source of truth for nav visibility, disabled
   buttons (with a reason) and the /admin/roles matrix screen.
   ========================================================================== */

export type RoleId =
  | "employee"
  | "manager"
  | "hr_admin"
  | "payroll_admin"
  | "recruiter"
  | "tenant_owner";

export type Action = "V" | "C" | "E" | "D" | "X" | "A";
export const ACTIONS: Action[] = ["V", "C", "E", "D", "X", "A"];

export const ACTION_LABEL: Record<Action, string> = {
  V: "View",
  C: "Create",
  E: "Edit",
  D: "Delete",
  X: "Execute",
  A: "Approve",
};

export interface Persona {
  id: RoleId;
  name: string;
  shortName: string;
  title: string;
  role: string;
  employeeId: string;
  branch: string;
  department: string;
  email: string;
  reportees: number;
  description: string;
}

export const PERSONAS: Persona[] = [
  {
    id: "employee",
    name: "Ananya Rao",
    shortName: "Ananya",
    title: "Software Engineer",
    role: "Employee",
    employeeId: "STL-0142",
    branch: "Bengaluru",
    department: "Engineering",
    email: "ananya.rao@stellartech.in",
    reportees: 0,
    description: "Self-service only — own attendance, leave, payslips and requests.",
  },
  {
    id: "manager",
    name: "Vikram Shah",
    shortName: "Vikram",
    title: "Engineering Manager",
    role: "Reporting Manager",
    employeeId: "STL-0031",
    branch: "Bengaluru",
    department: "Engineering",
    email: "vikram.shah@stellartech.in",
    reportees: 8,
    description: "Everything an employee sees, plus approvals and team visibility for 8 reportees.",
  },
  {
    id: "hr_admin",
    name: "Priya Menon",
    shortName: "Priya",
    title: "Head of People Operations",
    role: "HR Admin",
    employeeId: "STL-0009",
    branch: "Bengaluru",
    department: "Human Resources",
    email: "priya.menon@stellartech.in",
    reportees: 5,
    description: "Full people, time, leave and growth administration. No payroll money screens.",
  },
  {
    id: "payroll_admin",
    name: "Rahul Desai",
    shortName: "Rahul",
    title: "Payroll Manager",
    role: "Payroll Admin",
    employeeId: "STL-0017",
    branch: "Pune",
    department: "Finance",
    email: "rahul.desai@stellartech.in",
    reportees: 3,
    description: "Pay runs, salary structures and compensation. No hiring or performance.",
  },
  {
    id: "recruiter",
    name: "Sana Iqbal",
    shortName: "Sana",
    title: "Talent Acquisition Lead",
    role: "Recruiter",
    employeeId: "STL-0058",
    branch: "Bengaluru",
    department: "Human Resources",
    email: "sana.iqbal@stellartech.in",
    reportees: 2,
    description: "Hiring pipeline end to end. Read-only on the employee directory.",
  },
  {
    id: "tenant_owner",
    name: "Arjun Kapoor",
    shortName: "Arjun",
    title: "Founder & CEO",
    role: "Tenant Owner",
    employeeId: "STL-0001",
    branch: "Bengaluru",
    department: "Executive",
    email: "arjun.kapoor@stellartech.in",
    reportees: 6,
    description: "Unrestricted. Every module, every action, including tenant administration.",
  },
];

export const personaById = (id: RoleId) => PERSONAS.find((p) => p.id === id)!;

/* --------------------------------------------------------------- menu keys */

export type MenuKey =
  | "dashboard"
  | "my.attendance"
  | "my.leave"
  | "my.payslips"
  | "my.expenses"
  | "my.assets"
  | "my.goals"
  | "my.travel"
  | "team.attendance"
  | "team.leave_approvals"
  | "team.approvals"
  | "people.directory"
  | "people.profile"
  | "people.org_chart"
  | "people.import"
  | "time.amendments"
  | "time.settings"
  | "time.calendars"
  | "leave.calendar"
  | "leave.admin"
  | "payroll.runs"
  | "payroll.structures"
  | "hiring.requisitions"
  | "hiring.jobs"
  | "hiring.candidates"
  | "hiring.interviews"
  | "hiring.offers"
  | "growth.reviews"
  | "growth.calibration"
  | "growth.learning"
  | "workplace.assets"
  | "workplace.expenses"
  | "workplace.travel"
  | "workplace.helpdesk"
  | "workplace.announcements"
  | "admin.users"
  | "admin.roles"
  | "admin.settings"
  | "admin.audit"
  | "admin.compliance"
  | "analytics"
  | "reports";

export interface MenuMeta {
  key: MenuKey;
  label: string;
  module: string;
}

export const MENU_META: MenuMeta[] = [
  { key: "dashboard", label: "Dashboard", module: "Home" },
  { key: "my.attendance", label: "My Attendance", module: "My Space" },
  { key: "my.leave", label: "My Leave", module: "My Space" },
  { key: "my.payslips", label: "My Payslips", module: "My Space" },
  { key: "my.expenses", label: "My Expenses", module: "My Space" },
  { key: "my.assets", label: "My Assets", module: "My Space" },
  { key: "my.goals", label: "My Goals", module: "My Space" },
  { key: "my.travel", label: "My Travel", module: "My Space" },
  { key: "team.attendance", label: "Team Attendance", module: "Team" },
  { key: "team.leave_approvals", label: "Leave Approvals", module: "Team" },
  { key: "team.approvals", label: "Approvals Inbox", module: "Team" },
  { key: "people.directory", label: "Employee Directory", module: "People" },
  { key: "people.profile", label: "Employee Profile", module: "People" },
  { key: "people.org_chart", label: "Org Chart", module: "People" },
  { key: "people.import", label: "Bulk Import", module: "People" },
  { key: "time.amendments", label: "Regularisation", module: "Time" },
  { key: "time.settings", label: "Attendance Settings", module: "Time" },
  { key: "time.calendars", label: "Work Calendars", module: "Time" },
  { key: "leave.calendar", label: "Leave Calendar", module: "Time" },
  { key: "leave.admin", label: "Leave Administration", module: "Time" },
  { key: "payroll.runs", label: "Pay Runs", module: "Payroll" },
  { key: "payroll.structures", label: "Salary Structures", module: "Payroll" },
  { key: "hiring.requisitions", label: "Requisitions", module: "Hiring" },
  { key: "hiring.jobs", label: "Job Postings", module: "Hiring" },
  { key: "hiring.candidates", label: "Candidate Pipeline", module: "Hiring" },
  { key: "hiring.interviews", label: "Interviews", module: "Hiring" },
  { key: "hiring.offers", label: "Offers", module: "Hiring" },
  { key: "growth.reviews", label: "Review Cycles", module: "Growth" },
  { key: "growth.calibration", label: "Calibration", module: "Growth" },
  { key: "growth.learning", label: "Learning", module: "Growth" },
  { key: "workplace.assets", label: "Asset Register", module: "Workplace" },
  { key: "workplace.expenses", label: "Expense Claims", module: "Workplace" },
  { key: "workplace.travel", label: "Travel Requests", module: "Workplace" },
  { key: "workplace.helpdesk", label: "Helpdesk", module: "Workplace" },
  { key: "workplace.announcements", label: "Announcements", module: "Workplace" },
  { key: "admin.users", label: "Users", module: "Admin" },
  { key: "admin.roles", label: "Roles & Permissions", module: "Admin" },
  { key: "admin.settings", label: "Tenant Settings", module: "Admin" },
  { key: "admin.audit", label: "Audit Log", module: "Admin" },
  { key: "admin.compliance", label: "Compliance Calendar", module: "Admin" },
  { key: "analytics", label: "Analytics", module: "Insights" },
  { key: "reports", label: "Reports", module: "Insights" },
];

/* ------------------------------------------------------------ the matrix */

type Grants = Partial<Record<MenuKey, string>>;

const SELF_SERVICE: Grants = {
  dashboard: "V",
  "my.attendance": "VCEX",
  "my.leave": "VCED",
  "my.payslips": "VX",
  "my.expenses": "VCED",
  "my.assets": "V",
  "my.goals": "VCE",
  "my.travel": "VCE",
  "time.amendments": "VCED",
  "people.directory": "V",
  "people.profile": "V",
  "people.org_chart": "V",
  "leave.calendar": "V",
  "workplace.helpdesk": "VCE",
  "workplace.announcements": "VE",
  "growth.reviews": "VE",
  "growth.learning": "VCE",
};

const MANAGER: Grants = {
  ...SELF_SERVICE,
  "team.attendance": "VEXA",
  "team.leave_approvals": "VA",
  "team.approvals": "VA",
  "workplace.expenses": "VA",
  "workplace.travel": "VA",
  "growth.reviews": "VCEA",
  "growth.calibration": "V",
  "hiring.requisitions": "VC",
  "hiring.interviews": "VCE",
  "hiring.candidates": "V",
  reports: "VX",
};

const HR_ADMIN: Grants = {
  ...MANAGER,
  "people.directory": "VCED",
  "people.profile": "VCE",
  "people.import": "VCX",
  "time.settings": "VE",
  "time.calendars": "VCE",
  "leave.admin": "VCEDX",
  "leave.calendar": "VE",
  "team.attendance": "VCEDXA",
  "workplace.assets": "VCED",
  "workplace.announcements": "VCED",
  "workplace.helpdesk": "VCEA",
  "growth.calibration": "VCEA",
  "growth.learning": "VCED",
  "admin.users": "VCE",
  "admin.audit": "V",
  "admin.compliance": "VCE",
  "hiring.requisitions": "VCEA",
  "hiring.candidates": "VCE",
  "hiring.offers": "VA",
  analytics: "VX",
  reports: "VCX",
};

const PAYROLL_ADMIN: Grants = {
  ...SELF_SERVICE,
  "people.directory": "V",
  "people.profile": "VE",
  "payroll.runs": "VCEDXA",
  "payroll.structures": "VCED",
  "workplace.expenses": "VEA",
  "workplace.travel": "VA",
  "team.approvals": "VA",
  "admin.compliance": "VCE",
  "admin.audit": "V",
  analytics: "VX",
  reports: "VCX",
};

const RECRUITER: Grants = {
  ...SELF_SERVICE,
  "hiring.requisitions": "VCE",
  "hiring.jobs": "VCED",
  "hiring.candidates": "VCEDX",
  "hiring.interviews": "VCED",
  "hiring.offers": "VCE",
  "people.directory": "V",
  reports: "VX",
};

const OWNER: Grants = Object.fromEntries(
  MENU_META.map((m) => [m.key, "VCEDXA"]),
) as Grants;

export const RBAC: Record<RoleId, Grants> = {
  employee: SELF_SERVICE,
  manager: MANAGER,
  hr_admin: HR_ADMIN,
  payroll_admin: PAYROLL_ADMIN,
  recruiter: RECRUITER,
  tenant_owner: OWNER,
};

export function grantsFor(role: RoleId, key: MenuKey): Action[] {
  return (RBAC[role][key] ?? "").split("") as Action[];
}

export function can(role: RoleId, key: MenuKey, action: Action = "V") {
  return (RBAC[role][key] ?? "").includes(action);
}

/** Human-readable reason for a disabled control — shown in a tooltip. */
export function denyReason(role: RoleId, key: MenuKey, action: Action = "V") {
  const persona = personaById(role);
  const meta = MENU_META.find((m) => m.key === key);
  if (!meta) return "This capability is not part of your role.";
  if (!can(role, key, "V"))
    return `${persona.role} has no access to ${meta.label}. Required: ${meta.label} · View.`;
  return `${persona.role} can view ${meta.label} but cannot ${ACTION_LABEL[
    action
  ].toLowerCase()}. Required grant: ${meta.label} · ${ACTION_LABEL[action]}.`;
}
