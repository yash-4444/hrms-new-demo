/* ============================================================================
   RBAC — menu keys × roles × action letters.
   V view · C create · E edit · D delete · X export (jobs / dry runs: run) · A approve
   This module is the single source of truth for nav visibility, disabled
   buttons (with a reason) and the /admin/roles matrix screen.
   ========================================================================== */

export type RoleId =
  | "employee"
  | "manager"
  | "hr_admin"
  | "payroll_admin"
  | "recruiter"
  | "tenant_owner"
  | "finance_controller"
  | "department_head"
  | "helpdesk_agent"
  | "it_admin"
  | "auditor";

export type Action = "V" | "C" | "E" | "D" | "X" | "A";
export const ACTIONS: Action[] = ["V", "C", "E", "D", "X", "A"];

export const ACTION_LABEL: Record<Action, string> = {
  V: "View",
  C: "Create",
  E: "Edit",
  D: "Delete",
  X: "Export",
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

/* Order matters: Alt+1…9 and Alt+0 jump to the first ten, in this order. */
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
    description: "Builds pay runs, salary structures and statutory returns. Finance approves the run.",
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
  {
    id: "finance_controller",
    name: "Lakshmi Pillai",
    shortName: "Lakshmi",
    title: "Chief Financial Officer",
    role: "Finance Controller",
    employeeId: "STL-0008",
    branch: "Bengaluru",
    department: "Finance",
    email: "lakshmi.pillai@stellartech.in",
    reportees: 5,
    description: "Approves pay runs, bank advice and loans; owns the expense finance queue and travel desk.",
  },
  {
    id: "department_head",
    name: "Neha Malhotra",
    shortName: "Neha",
    title: "Chief Revenue Officer",
    role: "Department Head",
    employeeId: "STL-0005",
    branch: "Bengaluru",
    department: "Sales",
    email: "neha.malhotra@stellartech.in",
    reportees: 6,
    description: "Heads Sales: department analytics, headcount, attrition risk, succession and approvals.",
  },
  {
    id: "helpdesk_agent",
    name: "Ishita Kulkarni",
    shortName: "Ishita",
    title: "Senior HR Business Partner",
    role: "HR Operations Agent",
    employeeId: "STL-0305",
    branch: "Bengaluru",
    department: "Human Resources",
    email: "ishita.kulkarni@stellartech.in",
    reportees: 0,
    description: "Works the helpdesk queue and HR cases, keeps the knowledge base current, runs onboarding tasks.",
  },
  {
    id: "it_admin",
    name: "Girish Gowda",
    shortName: "Girish",
    title: "Director of IT",
    role: "IT & Asset Admin",
    employeeId: "STL-0010",
    branch: "Bengaluru",
    department: "IT & Operations",
    email: "girish.gowda@stellartech.in",
    reportees: 6,
    description: "Asset register, licences, maintenance and verification; IT onboarding tasks and sessions.",
  },
  {
    id: "auditor",
    name: "Ravi Agarwal",
    shortName: "Ravi",
    title: "Senior Finance Analyst",
    role: "Internal Auditor",
    employeeId: "STL-0296",
    branch: "Pune",
    department: "Finance",
    email: "ravi.agarwal@stellartech.in",
    reportees: 0,
    description: "Read-only on everything, plus audited export. Can never create, edit or approve.",
  },
];

export const personaById = (id: RoleId) => PERSONAS.find((p) => p.id === id)!;

/** How the role switcher and the login page group the personas. */
export const PERSONA_GROUPS: { label: string; roles: RoleId[] }[] = [
  { label: "Employees & managers", roles: ["employee", "manager", "department_head"] },
  { label: "HR & admin", roles: ["hr_admin", "recruiter", "helpdesk_agent", "tenant_owner"] },
  { label: "Finance", roles: ["payroll_admin", "finance_controller"] },
  { label: "Specialists", roles: ["it_admin", "auditor"] },
];

/** The Alt+digit that jumps to a persona — "1"…"9", "0" — or null past the tenth. */
export function personaHotkey(id: RoleId) {
  const i = PERSONAS.findIndex((p) => p.id === id);
  return i < 0 || i > 9 ? null : String((i + 1) % 10);
}

/* --------------------------------------------------------------- menu keys */

export type MenuKey =
  /* Home */
  | "dashboard"
  | "team.approvals"
  | "my.notifications"
  /* AI */
  | "ai.copilot"
  | "ai.knowledge"
  | "ai.insights"
  | "ai.ask"
  | "ai.studio"
  /* My Space */
  | "my.profile"
  | "my.attendance"
  | "my.leave"
  | "my.payslips"
  | "my.expenses"
  | "my.assets"
  | "my.goals"
  | "my.travel"
  | "my.documents"
  | "my.tax"
  | "my.onboarding"
  | "my.security"
  | "my.preferences"
  /* Team */
  | "my.team"
  | "team.attendance"
  | "team.leave_approvals"
  /* People */
  | "people.directory"
  | "people.profile"
  | "people.org_chart"
  | "people.import"
  | "people.lifecycle"
  | "people.documents"
  | "people.letters"
  | "people.letter_templates"
  /* Organization */
  | "org.companies"
  | "org.branches"
  | "org.departments"
  | "org.designations"
  | "org.grades"
  | "org.teams"
  | "org.cost_centres"
  | "org.employment_types"
  | "org.work_locations"
  | "org.holidays"
  | "org.shifts"
  | "org.shift_groups"
  | "org.rosters"
  | "org.roster_templates"
  /* Time */
  | "time.amendments"
  | "time.settings"
  | "time.calendars"
  | "time.reports"
  | "time.devices"
  | "leave.calendar"
  | "leave.admin"
  | "leave.reports"
  /* Payroll */
  | "payroll.runs"
  | "payroll.structures"
  | "payroll.components"
  | "payroll.salary"
  | "payroll.inputs"
  | "payroll.loans"
  | "payroll.benefits"
  | "payroll.payslips"
  | "payroll.registers"
  | "payroll.bank_advice"
  | "payroll.statutory"
  | "payroll.returns"
  /* Hiring */
  | "hiring.requisitions"
  | "hiring.jobs"
  | "hiring.candidates"
  | "hiring.interviews"
  | "hiring.offers"
  | "hiring.referrals"
  | "hiring.talent_pool"
  | "hiring.vendors"
  | "hiring.analytics"
  /* Onboarding & Exit */
  | "lifecycle.onboarding"
  | "lifecycle.templates"
  | "lifecycle.probation"
  | "lifecycle.separations"
  | "lifecycle.fnf"
  | "lifecycle.exit_interviews"
  | "lifecycle.alumni"
  /* Growth */
  | "growth.reviews"
  | "growth.calibration"
  | "growth.cycles"
  | "growth.feedback"
  | "growth.one_on_ones"
  | "growth.pip"
  | "growth.succession"
  | "growth.learning"
  | "growth.sessions"
  | "growth.enrollments"
  | "growth.certifications"
  | "growth.skill_gap"
  | "growth.budget"
  /* Workplace */
  | "workplace.assets"
  | "workplace.asset_categories"
  | "workplace.asset_maintenance"
  | "workplace.asset_requests"
  | "workplace.licences"
  | "workplace.asset_audit"
  | "workplace.expenses"
  | "workplace.expense_approvals"
  | "workplace.expense_finance"
  | "workplace.expense_policies"
  | "workplace.travel"
  | "workplace.travel_desk"
  | "workplace.travel_advances"
  | "workplace.announcements"
  /* Helpdesk */
  | "workplace.helpdesk"
  | "helpdesk.queue"
  | "helpdesk.cases"
  | "helpdesk.kb"
  | "helpdesk.categories"
  | "helpdesk.sla"
  | "helpdesk.analytics"
  /* Engagement */
  | "engage.feed"
  | "engage.policies"
  | "engage.surveys"
  | "engage.recognition"
  | "engage.celebrations"
  | "engage.ideas"
  /* Insights */
  | "analytics"
  | "reports"
  | "reports.scheduled"
  /* Compliance */
  | "admin.compliance"
  | "compliance.registers"
  | "compliance.posh"
  | "compliance.dpdp"
  | "compliance.retention"
  | "compliance.consent"
  /* Admin */
  | "admin.users"
  | "admin.roles"
  | "admin.overrides"
  | "admin.access_review"
  | "admin.settings"
  | "admin.subscription"
  | "admin.domains"
  | "admin.sessions"
  | "admin.login_history"
  | "admin.audit"
  | "admin.notification_templates"
  | "admin.jobs"
  | "admin.health"
  | "admin.lookups"
  | "admin.geo"
  | "admin.currencies"
  | "admin.ai";

export interface MenuMeta {
  key: MenuKey;
  label: string;
  module: string;
}

/* Module order = nav group order; the /admin/roles matrix groups rows by it. */
export const MENU_META: MenuMeta[] = [
  { key: "dashboard", label: "Dashboard", module: "Home" },
  { key: "team.approvals", label: "Approvals Inbox", module: "Home" },
  { key: "my.notifications", label: "Notifications", module: "Home" },
  { key: "ai.copilot", label: "AI Copilot", module: "AI" },
  { key: "ai.knowledge", label: "Policy Knowledge Base", module: "AI" },
  { key: "ai.insights", label: "AI Insights", module: "AI" },
  { key: "ai.ask", label: "Ask Analytics", module: "AI" },
  { key: "ai.studio", label: "AI Drafting Studio", module: "AI" },
  { key: "my.profile", label: "My Profile", module: "My Space" },
  { key: "my.attendance", label: "My Attendance", module: "My Space" },
  { key: "my.leave", label: "My Leave", module: "My Space" },
  { key: "my.payslips", label: "My Payslips", module: "My Space" },
  { key: "my.expenses", label: "My Expenses", module: "My Space" },
  { key: "my.assets", label: "My Assets", module: "My Space" },
  { key: "my.goals", label: "My Goals", module: "My Space" },
  { key: "my.travel", label: "My Travel", module: "My Space" },
  { key: "my.documents", label: "My Documents", module: "My Space" },
  { key: "my.tax", label: "Tax Declaration", module: "My Space" },
  { key: "my.onboarding", label: "My Onboarding", module: "My Space" },
  { key: "my.security", label: "Security & Sessions", module: "My Space" },
  { key: "my.preferences", label: "Preferences", module: "My Space" },
  { key: "my.team", label: "My Team", module: "Team" },
  { key: "team.attendance", label: "Team Attendance", module: "Team" },
  { key: "team.leave_approvals", label: "Leave Approvals", module: "Team" },
  { key: "people.directory", label: "Employee Directory", module: "People" },
  { key: "people.profile", label: "Employee Profile", module: "People" },
  { key: "people.org_chart", label: "Org Chart", module: "People" },
  { key: "people.import", label: "Bulk Import", module: "People" },
  { key: "people.lifecycle", label: "Lifecycle Events", module: "People" },
  { key: "people.documents", label: "Document Register", module: "People" },
  { key: "people.letters", label: "Letters", module: "People" },
  { key: "people.letter_templates", label: "Letter Templates", module: "People" },
  { key: "org.companies", label: "Companies", module: "Organization" },
  { key: "org.branches", label: "Branches", module: "Organization" },
  { key: "org.departments", label: "Departments", module: "Organization" },
  { key: "org.designations", label: "Designations", module: "Organization" },
  { key: "org.grades", label: "Grades & Bands", module: "Organization" },
  { key: "org.teams", label: "Teams", module: "Organization" },
  { key: "org.cost_centres", label: "Cost Centres", module: "Organization" },
  { key: "org.employment_types", label: "Employment Types", module: "Organization" },
  { key: "org.work_locations", label: "Work Locations", module: "Organization" },
  { key: "org.holidays", label: "Holiday Master", module: "Organization" },
  { key: "org.shifts", label: "Shifts", module: "Organization" },
  { key: "org.shift_groups", label: "Shift Groups", module: "Organization" },
  { key: "org.rosters", label: "Roster Board", module: "Organization" },
  { key: "org.roster_templates", label: "Roster Templates", module: "Organization" },
  { key: "time.amendments", label: "Regularisation", module: "Time" },
  { key: "time.settings", label: "Attendance Settings", module: "Time" },
  { key: "time.calendars", label: "Work Calendars", module: "Time" },
  { key: "time.reports", label: "Attendance Reports", module: "Time" },
  { key: "time.devices", label: "Biometric Devices", module: "Time" },
  { key: "leave.calendar", label: "Leave Calendar", module: "Time" },
  { key: "leave.admin", label: "Leave Administration", module: "Time" },
  { key: "leave.reports", label: "Leave Reports", module: "Time" },
  { key: "payroll.runs", label: "Pay Runs", module: "Payroll" },
  { key: "payroll.structures", label: "Salary Structures", module: "Payroll" },
  { key: "payroll.components", label: "Salary Components", module: "Payroll" },
  { key: "payroll.salary", label: "Salary Assignments & Revisions", module: "Payroll" },
  { key: "payroll.inputs", label: "Payroll Inputs & LOP", module: "Payroll" },
  { key: "payroll.loans", label: "Loans & Advances", module: "Payroll" },
  { key: "payroll.benefits", label: "Flexible Benefits", module: "Payroll" },
  { key: "payroll.payslips", label: "Payslip Register", module: "Payroll" },
  { key: "payroll.registers", label: "Payroll Registers", module: "Payroll" },
  { key: "payroll.bank_advice", label: "Bank Advice", module: "Payroll" },
  { key: "payroll.statutory", label: "Statutory Setup", module: "Payroll" },
  { key: "payroll.returns", label: "Returns & Forms", module: "Payroll" },
  { key: "hiring.requisitions", label: "Requisitions", module: "Hiring" },
  { key: "hiring.jobs", label: "Job Postings", module: "Hiring" },
  { key: "hiring.candidates", label: "Candidate Pipeline", module: "Hiring" },
  { key: "hiring.interviews", label: "Interviews", module: "Hiring" },
  { key: "hiring.offers", label: "Offers", module: "Hiring" },
  { key: "hiring.referrals", label: "Referrals", module: "Hiring" },
  { key: "hiring.talent_pool", label: "Talent Pool", module: "Hiring" },
  { key: "hiring.vendors", label: "Agencies", module: "Hiring" },
  { key: "hiring.analytics", label: "Recruitment Analytics", module: "Hiring" },
  { key: "lifecycle.onboarding", label: "Onboarding", module: "Onboarding & Exit" },
  { key: "lifecycle.templates", label: "Checklist Templates", module: "Onboarding & Exit" },
  { key: "lifecycle.probation", label: "Probation & Confirmation", module: "Onboarding & Exit" },
  { key: "lifecycle.separations", label: "Separations", module: "Onboarding & Exit" },
  { key: "lifecycle.fnf", label: "Full & Final", module: "Onboarding & Exit" },
  { key: "lifecycle.exit_interviews", label: "Exit Interviews", module: "Onboarding & Exit" },
  { key: "lifecycle.alumni", label: "Alumni", module: "Onboarding & Exit" },
  { key: "growth.reviews", label: "Review Cycles", module: "Growth" },
  { key: "growth.calibration", label: "Calibration", module: "Growth" },
  { key: "growth.cycles", label: "Review Cycle Admin", module: "Growth" },
  { key: "growth.feedback", label: "Feedback & 360", module: "Growth" },
  { key: "growth.one_on_ones", label: "One-on-Ones", module: "Growth" },
  { key: "growth.pip", label: "Improvement Plans", module: "Growth" },
  { key: "growth.succession", label: "Succession", module: "Growth" },
  { key: "growth.learning", label: "Learning", module: "Growth" },
  { key: "growth.sessions", label: "Training Sessions", module: "Growth" },
  { key: "growth.enrollments", label: "Enrollments", module: "Growth" },
  { key: "growth.certifications", label: "Certifications", module: "Growth" },
  { key: "growth.skill_gap", label: "Skill Gap", module: "Growth" },
  { key: "growth.budget", label: "Training Budget", module: "Growth" },
  { key: "workplace.assets", label: "Asset Register", module: "Workplace" },
  { key: "workplace.asset_categories", label: "Asset Categories", module: "Workplace" },
  { key: "workplace.asset_maintenance", label: "Maintenance", module: "Workplace" },
  { key: "workplace.asset_requests", label: "Asset Requests", module: "Workplace" },
  { key: "workplace.licences", label: "Software Licences", module: "Workplace" },
  { key: "workplace.asset_audit", label: "Asset Verification", module: "Workplace" },
  { key: "workplace.expenses", label: "Expense Claims", module: "Workplace" },
  { key: "workplace.expense_approvals", label: "Expense Approvals", module: "Workplace" },
  { key: "workplace.expense_finance", label: "Finance Review", module: "Workplace" },
  { key: "workplace.expense_policies", label: "Expense Policies", module: "Workplace" },
  { key: "workplace.travel", label: "Travel Requests", module: "Workplace" },
  { key: "workplace.travel_desk", label: "Travel Desk", module: "Workplace" },
  { key: "workplace.travel_advances", label: "Travel Advances", module: "Workplace" },
  { key: "workplace.announcements", label: "Announcements", module: "Workplace" },
  { key: "workplace.helpdesk", label: "My Tickets", module: "Helpdesk" },
  { key: "helpdesk.queue", label: "Agent Queue", module: "Helpdesk" },
  { key: "helpdesk.cases", label: "HR Cases", module: "Helpdesk" },
  { key: "helpdesk.kb", label: "Knowledge Base", module: "Helpdesk" },
  { key: "helpdesk.categories", label: "Ticket Categories", module: "Helpdesk" },
  { key: "helpdesk.sla", label: "SLA Policies", module: "Helpdesk" },
  { key: "helpdesk.analytics", label: "Helpdesk Analytics", module: "Helpdesk" },
  { key: "engage.feed", label: "Company Feed", module: "Engagement" },
  { key: "engage.policies", label: "Policy Documents", module: "Engagement" },
  { key: "engage.surveys", label: "Surveys & Pulse", module: "Engagement" },
  { key: "engage.recognition", label: "Recognition & Rewards", module: "Engagement" },
  { key: "engage.celebrations", label: "Celebrations", module: "Engagement" },
  { key: "engage.ideas", label: "Idea Box", module: "Engagement" },
  { key: "analytics", label: "Analytics", module: "Insights" },
  { key: "reports", label: "Reports", module: "Insights" },
  { key: "reports.scheduled", label: "Scheduled Reports", module: "Insights" },
  { key: "admin.compliance", label: "Compliance Calendar", module: "Compliance" },
  { key: "compliance.registers", label: "Statutory Registers", module: "Compliance" },
  { key: "compliance.posh", label: "POSH Register", module: "Compliance" },
  { key: "compliance.dpdp", label: "Data-Subject Requests", module: "Compliance" },
  { key: "compliance.retention", label: "Retention Policies", module: "Compliance" },
  { key: "compliance.consent", label: "Consent Register", module: "Compliance" },
  { key: "admin.users", label: "Users", module: "Admin" },
  { key: "admin.roles", label: "Roles & Permissions", module: "Admin" },
  { key: "admin.overrides", label: "Permission Overrides", module: "Admin" },
  { key: "admin.access_review", label: "Access Review", module: "Admin" },
  { key: "admin.settings", label: "Tenant Settings", module: "Admin" },
  { key: "admin.subscription", label: "Plan & Seats", module: "Admin" },
  { key: "admin.domains", label: "Custom Domains", module: "Admin" },
  { key: "admin.sessions", label: "Active Sessions", module: "Admin" },
  { key: "admin.login_history", label: "Login History", module: "Admin" },
  { key: "admin.audit", label: "Audit Log", module: "Admin" },
  { key: "admin.notification_templates", label: "Notification Templates", module: "Admin" },
  { key: "admin.jobs", label: "Background Jobs", module: "Admin" },
  { key: "admin.health", label: "System Health", module: "Admin" },
  { key: "admin.lookups", label: "Lookups", module: "Admin" },
  { key: "admin.geo", label: "Geography", module: "Admin" },
  { key: "admin.currencies", label: "Currencies & FX", module: "Admin" },
  { key: "admin.ai", label: "AI Settings & Usage", module: "Admin" },
];

/* ------------------------------------------------------------ the matrix */

type Grants = Partial<Record<MenuKey, string>>;

/** Every persona inherits this set. */
const SELF_SERVICE: Grants = {
  dashboard: "V",
  "my.notifications": "VE",
  "ai.copilot": "VC",
  "ai.knowledge": "V",
  "my.profile": "VE",
  "my.attendance": "VCEX",
  "my.leave": "VCED",
  "my.payslips": "VX",
  "my.expenses": "VCED",
  "my.assets": "V",
  "my.goals": "VCE",
  "my.travel": "VCE",
  "my.documents": "VC",
  "my.tax": "VCE",
  "my.onboarding": "V",
  "my.security": "VE",
  "my.preferences": "VE",
  "time.amendments": "VCED",
  "people.directory": "V",
  "people.profile": "V",
  "people.org_chart": "V",
  "org.holidays": "V",
  "leave.calendar": "V",
  "hiring.referrals": "VC",
  "workplace.helpdesk": "VCE",
  "workplace.announcements": "VE",
  "workplace.asset_requests": "VC",
  "helpdesk.kb": "V",
  "growth.reviews": "VE",
  "growth.feedback": "VC",
  "growth.one_on_ones": "VC",
  "growth.learning": "VCE",
  "growth.sessions": "V",
  "growth.certifications": "V",
  "engage.feed": "VC",
  "engage.policies": "V",
  "engage.surveys": "V",
  "engage.recognition": "VC",
  "engage.celebrations": "V",
  "engage.ideas": "VC",
};

const MANAGER: Grants = {
  ...SELF_SERVICE,
  "team.approvals": "VA",
  "ai.insights": "V",
  "ai.ask": "V",
  "ai.studio": "VC",
  "my.team": "V",
  "team.attendance": "VEXA",
  "team.leave_approvals": "VA",
  "org.teams": "V",
  "org.shifts": "V",
  "org.rosters": "VEA",
  "time.reports": "VX",
  "leave.reports": "V",
  "workplace.expenses": "VA",
  "workplace.expense_approvals": "VA",
  "workplace.travel": "VA",
  "workplace.asset_requests": "VCA",
  "lifecycle.onboarding": "V",
  "lifecycle.probation": "VEA",
  "lifecycle.separations": "VA",
  "growth.reviews": "VCEA",
  "growth.calibration": "V",
  "growth.one_on_ones": "VCE",
  "growth.pip": "VCE",
  "growth.enrollments": "VA",
  "growth.skill_gap": "V",
  "hiring.requisitions": "VC",
  "hiring.interviews": "VCE",
  "hiring.candidates": "V",
  reports: "VX",
};

const HR_ADMIN: Grants = {
  ...MANAGER,
  "ai.knowledge": "VCED",
  "admin.ai": "V",
  "people.directory": "VCED",
  "people.profile": "VCE",
  "people.import": "VCX",
  "people.lifecycle": "VCEA",
  "people.documents": "VCEA",
  "people.letters": "VCX",
  "people.letter_templates": "VCED",
  "org.companies": "V",
  "org.branches": "VCE",
  "org.departments": "VCE",
  "org.designations": "VCE",
  "org.grades": "VCE",
  "org.teams": "VCE",
  "org.cost_centres": "VCE",
  "org.employment_types": "VCE",
  "org.work_locations": "VCE",
  "org.holidays": "VCED",
  "org.shifts": "VCE",
  "org.shift_groups": "VCE",
  "org.rosters": "VCEA",
  "org.roster_templates": "VCE",
  "time.settings": "VE",
  "time.calendars": "VCE",
  "time.devices": "VCE",
  "leave.admin": "VCEDX",
  "leave.calendar": "VE",
  "leave.reports": "VX",
  "team.attendance": "VCEDXA",
  "workplace.assets": "VCED",
  "workplace.asset_categories": "VCE",
  "workplace.announcements": "VCED",
  "workplace.expense_policies": "VCE",
  "workplace.travel_desk": "V",
  "workplace.helpdesk": "VCEA",
  "helpdesk.queue": "VCEA",
  "helpdesk.cases": "VCEA",
  "helpdesk.kb": "VCE",
  "helpdesk.categories": "VCE",
  "helpdesk.sla": "VCE",
  "helpdesk.analytics": "V",
  "lifecycle.onboarding": "VCEA",
  "lifecycle.templates": "VCED",
  "lifecycle.separations": "VCEA",
  "lifecycle.fnf": "V",
  "lifecycle.exit_interviews": "VCE",
  "lifecycle.alumni": "V",
  "growth.calibration": "VCEA",
  "growth.cycles": "VCE",
  "growth.feedback": "VCE",
  "growth.succession": "VCE",
  "growth.learning": "VCED",
  "growth.sessions": "VCE",
  "growth.enrollments": "VCEA",
  "growth.certifications": "VCE",
  "growth.budget": "VE",
  "engage.policies": "VCE",
  "engage.surveys": "VCE",
  "engage.recognition": "VCEA",
  "engage.ideas": "VCEA",
  /* HR moderates the feed and runs the automatic birthday / anniversary wishes. */
  "engage.feed": "VCE",
  "engage.celebrations": "VE",
  "admin.users": "VCE",
  "admin.overrides": "VCE",
  /* X: export the access-review evidence pack for the auditors. */
  "admin.access_review": "VCEXA",
  "admin.sessions": "VD",
  /* E: unlock a locked-out account from the login history. */
  "admin.login_history": "VEX",
  "admin.audit": "V",
  "admin.notification_templates": "VCE",
  "admin.jobs": "VX",
  "admin.lookups": "VCED",
  "admin.geo": "VCE",
  "admin.compliance": "VCE",
  "compliance.registers": "VX",
  "compliance.posh": "VCE",
  "compliance.dpdp": "VCEX",
  "compliance.retention": "VE",
  "compliance.consent": "VX",
  "hiring.requisitions": "VCEA",
  "hiring.candidates": "VCE",
  "hiring.offers": "VA",
  "hiring.referrals": "VCEA",
  "hiring.analytics": "V",
  analytics: "VX",
  reports: "VCX",
  "reports.scheduled": "VCE",
};

/* Segregation of duties: Payroll builds the run, Finance approves it. */
const PAYROLL_ADMIN: Grants = {
  ...SELF_SERVICE,
  "team.approvals": "VA",
  "ai.insights": "V",
  "ai.ask": "V",
  "people.directory": "V",
  "people.profile": "VE",
  "org.grades": "V",
  "org.cost_centres": "V",
  "payroll.runs": "VCEDX",
  "payroll.structures": "VCED",
  "payroll.components": "VCED",
  "payroll.salary": "VCE",
  "payroll.inputs": "VCE",
  "payroll.loans": "VCEA",
  "payroll.benefits": "VCEA",
  "payroll.payslips": "VX",
  "payroll.registers": "VX",
  "payroll.bank_advice": "VX",
  "payroll.statutory": "VE",
  "payroll.returns": "VX",
  "workplace.expenses": "VEA",
  "workplace.expense_finance": "V",
  "workplace.travel": "VA",
  "lifecycle.separations": "VE",
  "lifecycle.fnf": "VCE",
  "admin.compliance": "VCE",
  "compliance.registers": "VX",
  "admin.audit": "V",
  "admin.jobs": "VX",
  "admin.currencies": "VCE",
  analytics: "VX",
  reports: "VCX",
  "reports.scheduled": "VCE",
};

const RECRUITER: Grants = {
  ...SELF_SERVICE,
  "team.approvals": "VA",
  "ai.studio": "VC",
  "hiring.requisitions": "VCE",
  "hiring.jobs": "VCED",
  "hiring.candidates": "VCEDX",
  "hiring.interviews": "VCED",
  "hiring.offers": "VCE",
  "hiring.referrals": "VCEA",
  "hiring.talent_pool": "VCE",
  "hiring.vendors": "VCE",
  "hiring.analytics": "V",
  "lifecycle.alumni": "V",
  "people.directory": "V",
  reports: "VX",
};

const FINANCE_CONTROLLER: Grants = {
  ...SELF_SERVICE,
  "team.approvals": "VA",
  "ai.insights": "V",
  "ai.ask": "V",
  "org.grades": "V",
  "org.cost_centres": "V",
  "leave.reports": "V",
  "payroll.runs": "VA",
  "payroll.structures": "V",
  "payroll.components": "V",
  "payroll.salary": "VA",
  "payroll.loans": "VCEA",
  "payroll.payslips": "V",
  "payroll.registers": "VX",
  "payroll.bank_advice": "VXA",
  "hiring.vendors": "V",
  "lifecycle.separations": "VE",
  "lifecycle.fnf": "VA",
  "growth.budget": "V",
  "workplace.licences": "V",
  "workplace.asset_audit": "V",
  "workplace.expenses": "VA",
  "workplace.expense_approvals": "VA",
  "workplace.expense_finance": "VEA",
  "workplace.expense_policies": "VCE",
  "workplace.travel": "VA",
  "workplace.travel_desk": "VCE",
  "workplace.travel_advances": "VCEA",
  "admin.currencies": "VCE",
  analytics: "VX",
  reports: "VCX",
  "reports.scheduled": "VCE",
};

/* A department head is a manager of managers: the manager set, widened to
   the whole department. */
const DEPARTMENT_HEAD: Grants = {
  ...MANAGER,
  "people.lifecycle": "V",
  "org.departments": "V",
  "growth.succession": "VCE",
  "hiring.analytics": "V",
  analytics: "V",
  "reports.scheduled": "VCE",
};

const HELPDESK_AGENT: Grants = {
  ...SELF_SERVICE,
  "team.approvals": "VA",
  "ai.knowledge": "VCED",
  "ai.studio": "VC",
  "people.documents": "VE",
  "people.letters": "VC",
  "lifecycle.onboarding": "VCEA",
  "lifecycle.separations": "VE",
  "helpdesk.queue": "VCEA",
  "helpdesk.cases": "VCE",
  "helpdesk.kb": "VCE",
  "helpdesk.categories": "VCE",
  "helpdesk.analytics": "V",
};

const IT_ADMIN: Grants = {
  ...SELF_SERVICE,
  "team.approvals": "VA",
  "time.devices": "VCE",
  "lifecycle.onboarding": "VE",
  "lifecycle.separations": "VE",
  "workplace.assets": "VCED",
  "workplace.asset_categories": "VCE",
  "workplace.asset_maintenance": "VCE",
  "workplace.asset_requests": "VCEA",
  "workplace.licences": "VCE",
  "workplace.asset_audit": "VCEA",
  "admin.domains": "V",
  "admin.sessions": "VD",
  "admin.login_history": "VEX",
  "admin.jobs": "VX",
  "admin.health": "V",
};

/* Read-only + Export on everything; own self-service like everyone else.
   Listed exceptions: the inbox and AI read-outs are view-only, Plan & Seats
   is owner-only. */
const AUDITOR_EXCEPTIONS: Grants = {
  "ai.copilot": "VC",
  "team.approvals": "V",
  "ai.insights": "V",
  "ai.ask": "V",
  "workplace.asset_audit": "V",
  "admin.subscription": "",
};

const AUDITOR: Grants = Object.fromEntries(
  MENU_META.map((m) => [
    m.key,
    AUDITOR_EXCEPTIONS[m.key] ?? (m.key.startsWith("my.") ? (SELF_SERVICE[m.key] ?? "") : "VX"),
  ]),
) as Grants;

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
  finance_controller: FINANCE_CONTROLLER,
  department_head: DEPARTMENT_HEAD,
  helpdesk_agent: HELPDESK_AGENT,
  it_admin: IT_ADMIN,
  auditor: AUDITOR,
};

export function grantsFor(role: RoleId, key: MenuKey): Action[] {
  return (RBAC[role][key] ?? "").split("") as Action[];
}

export function can(role: RoleId, key: MenuKey, action: Action = "V") {
  return (RBAC[role][key] ?? "").includes(action);
}

/* On job and run screens X also triggers a run / dry run. */
const RUN_KEYS: MenuKey[] = ["admin.jobs", "payroll.runs", "people.import", "leave.admin"];

/** Action label for a key — X reads "Export / Run" where X also runs a job. */
export function actionLabel(key: MenuKey, action: Action) {
  return action === "X" && RUN_KEYS.includes(key) ? "Export / Run" : ACTION_LABEL[action];
}

/** Human-readable reason for a disabled control — shown in a tooltip. */
export function denyReason(role: RoleId, key: MenuKey, action: Action = "V") {
  const persona = personaById(role);
  const meta = MENU_META.find((m) => m.key === key);
  if (!meta) return "This capability is not part of your role.";
  if (!can(role, key, "V"))
    return `${persona.role} has no access to ${meta.label}. Required: ${meta.label} · View.`;
  const label = actionLabel(key, action);
  return `${persona.role} can view ${meta.label} but cannot ${label.toLowerCase()}. Required grant: ${meta.label} · ${label}.`;
}
