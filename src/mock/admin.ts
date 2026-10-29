import { format, parseISO, subDays } from "date-fns";
import { mulberry32, pick, randInt } from "@/lib/utils";
import { inr } from "@/lib/format";
import { MENU_META, PERSONAS, personaById, type MenuKey, type RoleId } from "@/lib/rbac";
import { BRANCHES, DEMO_NOW, DEMO_TODAY, TENANT } from "./org";
import { EMPLOYEES, employeeByCode, employeeName, type Employee } from "./employees";
import { PAY_RUNS, runById } from "./payroll";

/* The August run as payroll computed it — audit entries quote it, never a typed copy. */
const AUG_RUN = runById("PR-2026-08") ?? PAY_RUNS[1];

/* ============================================================================
   Admin fixtures — platform users, the audit log and the statutory compliance
   calendar.

   Everything is generated from fixed seeds (or hand-authored) so the server
   render and the client render produce byte-identical output. "Today" is
   DEMO_TODAY (2026-09-16); there is deliberately no Date.now() at module
   scope.
   ========================================================================== */

const NOW = parseISO(DEMO_NOW);
const TODAY = parseISO(DEMO_TODAY);

/** Wall-clock stamp `daysBack` days before DEMO_NOW — timezone independent. */
function stamp(daysBack: number, hour: number, minute: number, second = 0) {
  const d = subDays(NOW, daysBack);
  d.setHours(hour, minute, second, 0);
  return format(d, "yyyy-MM-dd'T'HH:mm:ss");
}

const money = (v: number) => inr(v, { decimals: false });

/* ========================================================== platform users */

export type PlatformUserStatus = "active" | "invited" | "suspended";

export interface PlatformUser {
  id: string;
  employeeCode: string;
  name: string;
  /** Login email — the same identity used by SSO. */
  email: string;
  roles: RoleId[];
  status: PlatformUserStatus;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  createdAt: string;
  invitedByCode: string | null;
  departmentId: string;
  branchId: string;
  designation: string;
  /** Sign-ins in the trailing 30 days. */
  sessions30d: number;
  authMethod: "SSO · Google Workspace" | "Email + password";
}

const PERSONA_BY_CODE = new Map(PERSONAS.map((p) => [p.employeeId, p]));

/* 6 invited, 3 suspended — fixed slots so the KPI row is exactly reproducible. */
const INVITED_SLOTS = new Set([11, 23, 37, 46, 55, 61]);
const SUSPENDED_SLOTS = new Set([8, 29, 52]);

const OFFICE_IPS_IN = ["203.192.244.", "203.192.245.", "49.207.186.", "106.51.72."];
const VPN_IPS = ["10.14.7.", "10.14.22.", "10.28.3."];
const OFFICE_IPS_US = ["72.229.104.", "108.41.216."];

function ipFor(rng: () => number, branchId: string) {
  const pool = branchId === "EWR" ? OFFICE_IPS_US : rng() > 0.62 ? VPN_IPS : OFFICE_IPS_IN;
  return `${pick(rng, pool)}${randInt(rng, 2, 250)}`;
}

function rolesFor(rng: () => number, emp: Employee): RoleId[] {
  const persona = PERSONA_BY_CODE.get(emp.code);
  if (persona) return [persona.id];

  const out: RoleId[] = [];
  if (emp.departmentId === "HR") out.push(rng() > 0.45 ? "hr_admin" : "recruiter");
  if (emp.departmentId === "FIN" && emp.level <= 2) out.push("payroll_admin");
  if (emp.level <= 2) out.push("manager");
  if (out.length === 0) out.push("employee");
  return [...new Set(out)];
}

function buildUsers(): PlatformUser[] {
  const rng = mulberry32(90216);

  /* Personas first — they must always be on the list — then leadership and
     line managers, then the rest of the admin-adjacent functions. */
  const personaCodes = PERSONAS.map((p) => p.employeeId);
  const ranked = [
    ...personaCodes.map((c) => employeeByCode(c)!).filter(Boolean),
    ...EMPLOYEES.filter(
      (e) =>
        !personaCodes.includes(e.code) &&
        e.status !== "exited" &&
        (e.level <= 2 || ["HR", "FIN", "ITO"].includes(e.departmentId)),
    ).sort((a, b) => a.level - b.level || a.code.localeCompare(b.code)),
  ].slice(0, 64);

  return ranked.map((emp, i) => {
    const roles = rolesFor(rng, emp);
    const status: PlatformUserStatus = INVITED_SLOTS.has(i)
      ? "invited"
      : SUSPENDED_SLOTS.has(i)
        ? "suspended"
        : "active";

    const mfaEnabled = status === "invited" ? false : rng() > 0.19;
    const lastLoginDaysBack =
      status === "invited" ? null : status === "suspended" ? randInt(rng, 34, 71) : randInt(rng, 0, 9);

    const createdDaysBack =
      status === "invited" ? randInt(rng, 1, 12) : Math.min(2180, randInt(rng, 120, 2100));

    return {
      id: `USR-${String(i + 1).padStart(3, "0")}`,
      employeeCode: emp.code,
      name: emp.name,
      email: emp.email,
      roles,
      status,
      mfaEnabled,
      lastLoginAt:
        lastLoginDaysBack === null
          ? null
          : stamp(lastLoginDaysBack, randInt(rng, 8, 20), randInt(rng, 0, 59), randInt(rng, 0, 59)),
      lastLoginIp: lastLoginDaysBack === null ? null : ipFor(rng, emp.branchId),
      createdAt: stamp(createdDaysBack, randInt(rng, 9, 18), randInt(rng, 0, 59)),
      invitedByCode: status === "invited" ? "STL-0009" : i < 6 ? null : "STL-0009",
      departmentId: emp.departmentId,
      branchId: emp.branchId,
      designation: emp.designation,
      sessions30d: status === "active" ? randInt(rng, 9, 62) : 0,
      authMethod: rng() > 0.28 ? "SSO · Google Workspace" : "Email + password",
    } satisfies PlatformUser;
  });
}

export const PLATFORM_USERS: PlatformUser[] = buildUsers();

export const userById = (id: string) => PLATFORM_USERS.find((u) => u.id === id);

export const USER_STATS = {
  total: PLATFORM_USERS.length,
  active: PLATFORM_USERS.filter((u) => u.status === "active").length,
  invited: PLATFORM_USERS.filter((u) => u.status === "invited").length,
  suspended: PLATFORM_USERS.filter((u) => u.status === "suspended").length,
  withoutMfa: PLATFORM_USERS.filter((u) => !u.mfaEnabled).length,
  sso: PLATFORM_USERS.filter((u) => u.authMethod.startsWith("SSO")).length,
};

/** Sign-ins per role — drives the "who actually uses the product" read. */
export const USERS_BY_ROLE: { role: RoleId; label: string; count: number }[] = PERSONAS.map((p) => ({
  role: p.id,
  label: p.role,
  count: PLATFORM_USERS.filter((u) => u.roles.includes(p.id)).length,
}));

/* =============================================================== audit log */

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "approve"
  | "login"
  | "export"
  | "permission_change";

export const AUDIT_ACTIONS: AuditAction[] = [
  "create",
  "update",
  "delete",
  "approve",
  "login",
  "export",
  "permission_change",
];

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  create: "Create",
  update: "Update",
  delete: "Delete",
  approve: "Approve",
  login: "Sign-in",
  export: "Export",
  permission_change: "Permission change",
};

/** Status keys reused from STATUS_MAP so the audit chips match the rest of the app. */
export const AUDIT_ACTION_STATUS: Record<AuditAction, string> = {
  create: "submitted",
  update: "in_review",
  delete: "cancelled",
  approve: "approved",
  login: "active",
  export: "completed",
  permission_change: "locked",
};

export type AuditValue = string | number | boolean | null;
export type AuditFields = Record<string, AuditValue>;

export interface AuditEntry {
  id: string;
  at: string;
  actorCode: string;
  actorName: string;
  actorRole: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  entityLabel: string;
  summary: string;
  ip: string;
  userAgent: string;
  /** Short, human form of `userAgent` for the table cell. */
  device: string;
  outcome: "success" | "failed";
  before?: AuditFields;
  after?: AuditFields;
}

const AGENTS: { ua: string; device: string }[] = [
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
    device: "Chrome 141 · Windows 11",
  },
  {
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15",
    device: "Safari 18 · macOS",
  },
  {
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    device: "Chrome 140 · macOS",
  },
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
    device: "Firefox 132 · Windows 11",
  },
  {
    ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
    device: "Chrome 141 · Linux",
  },
  {
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
    device: "Safari · iPhone",
  },
  {
    ua: "HRMS-NEW-Mobile/2.14.0 (Android 15; Pixel 8; okhttp/4.12.0)",
    device: "HRMS app · Android",
  },
];

interface TemplateResult {
  entityType: string;
  entityId: string;
  entityLabel: string;
  summary: string;
  before?: AuditFields;
  after?: AuditFields;
  outcome?: "success" | "failed";
}

interface AuditTemplate {
  action: AuditAction;
  /** Roles plausible as the actor for this event. */
  actorRoles: RoleId[];
  weight: number;
  build: (rng: () => number, target: Employee, actor: PlatformUser) => TemplateResult;
}

const LEAVE_TYPES = ["Earned Leave", "Casual Leave", "Sick Leave", "Comp Off", "Loss of Pay"];
const WORK_MODES = ["On-site", "Hybrid", "Remote"];
const EXPENSE_HEADS = ["Client travel", "Team offsite", "Internet reimbursement", "Client entertainment", "Relocation"];
const ASSET_MODELS = [
  "MacBook Pro 14″ M4",
  "Dell Latitude 7450",
  "ThinkPad X1 Carbon Gen 12",
  "Dell U2723QE monitor",
  "iPhone 16",
];
const REPORTS = [
  { name: "Payroll register", scope: "Aug 2026 · 340 employees", file: "payroll-register-2026-08.xlsx" },
  { name: "Attendance muster", scope: "01–31 Aug 2026 · Bengaluru HQ", file: "muster-blr-2026-08.csv" },
  { name: "PF ECR text file", scope: "Aug 2026 · KN/BNG/0049217", file: "ecr-202608.txt" },
  { name: "Form 24Q annexure", scope: "Q1 FY 2026-27", file: "24q-q1-2627.txt" },
  { name: "Employee master", scope: "All active employees", file: "employee-master.csv" },
  { name: "CTC revision workings", scope: "FY 2026-27 appraisal cycle", file: "ctc-revisions-fy2627.xlsx" },
  { name: "Leave liability provision", scope: "As on 31 Aug 2026", file: "leave-liability-aug26.xlsx" },
];

const GRANT_CHANGES: { role: RoleId; key: MenuKey; from: string; to: string; why: string }[] = [
  { role: "recruiter", key: "hiring.offers", from: "VCE", to: "VCEA", why: "Recruiters can now release approved offers without a second sign-off." },
  { role: "manager", key: "workplace.expenses", from: "VA", to: "VEA", why: "Managers may correct a mis-coded expense line before approving it." },
  { role: "hr_admin", key: "payroll.structures", from: "", to: "V", why: "Read-only visibility of salary structures for the HR business partners." },
  { role: "payroll_admin", key: "people.import", from: "", to: "VC", why: "Payroll can stage the mid-month joiner import." },
  { role: "employee", key: "workplace.announcements", from: "VE", to: "V", why: "Acknowledgement is recorded server-side; employees no longer edit the record." },
  { role: "recruiter", key: "people.directory", from: "V", to: "VC", why: "Recruiters create the employee shell record on offer acceptance." },
  { role: "manager", key: "growth.calibration", from: "V", to: "VE", why: "Managers may draft their own box placement before the calibration call." },
  { role: "hr_admin", key: "admin.audit", from: "V", to: "VX", why: "HR admins can export the audit log for the ISO 27001 evidence pack." },
];

const TEMPLATES: AuditTemplate[] = [
  /* ------------------------------------------------------------- employee */
  {
    action: "update",
    actorRoles: ["hr_admin", "tenant_owner"],
    weight: 9,
    build: (rng, t) => {
      const modes = WORK_MODES.filter((m) => m !== t.workMode);
      const newMode = pick(rng, modes);
      return {
        entityType: "Employee",
        entityId: t.code,
        entityLabel: t.name,
        summary: `Changed work mode for ${t.name} from ${t.workMode} to ${newMode}`,
        before: {
          "Work mode": t.workMode,
          "Base location": t.location,
          Designation: t.designation,
          "Employment type": t.employmentType,
          "Reporting manager": employeeName(t.managerCode),
        },
        after: {
          "Work mode": newMode,
          "Base location": t.location,
          Designation: t.designation,
          "Employment type": t.employmentType,
          "Reporting manager": employeeName(t.managerCode),
        },
      };
    },
  },
  {
    action: "update",
    actorRoles: ["hr_admin", "tenant_owner"],
    weight: 6,
    build: (rng, t) => {
      const next = employeeByCode(pick(rng, ["STL-0004", "STL-0031", "STL-0007", "STL-0011"]))!;
      return {
        entityType: "Employee",
        entityId: t.code,
        entityLabel: t.name,
        summary: `Re-assigned ${t.name} to report to ${next.name}`,
        before: {
          "Reporting manager": employeeName(t.managerCode),
          Department: t.departmentId,
          "Cost centre": `CC-${t.departmentId === "ENG" ? "1001" : "3003"}`,
          "Effective from": format(TODAY, "dd MMM yyyy"),
        },
        after: {
          "Reporting manager": next.name,
          Department: t.departmentId,
          "Cost centre": `CC-${t.departmentId === "ENG" ? "1001" : "3003"}`,
          "Effective from": format(TODAY, "dd MMM yyyy"),
        },
      };
    },
  },
  {
    action: "update",
    actorRoles: ["payroll_admin", "tenant_owner"],
    weight: 5,
    build: (rng, t) => {
      const hike = 1 + randInt(rng, 6, 18) / 100;
      const next = Math.round((t.ctc * hike) / 1000) * 1000;
      return {
        entityType: "Compensation",
        entityId: t.code,
        entityLabel: `${t.name} · annual CTC`,
        summary: `Revised annual CTC for ${t.name} by ${Math.round((hike - 1) * 100)}%`,
        before: {
          "Annual CTC": money(t.ctc),
          Grade: t.gradeId,
          "Revision reason": "—",
          "Effective from": "—",
          "Pay group": t.branchId === "EWR" ? "US semi-monthly" : "India monthly",
        },
        after: {
          "Annual CTC": money(next),
          Grade: t.gradeId,
          "Revision reason": "FY 2026-27 appraisal",
          "Effective from": "01 Oct 2026",
          "Pay group": t.branchId === "EWR" ? "US semi-monthly" : "India monthly",
        },
      };
    },
  },
  /* ---------------------------------------------------------------- leave */
  {
    action: "approve",
    actorRoles: ["manager", "hr_admin", "tenant_owner"],
    weight: 12,
    build: (rng, t, actor) => {
      const type = pick(rng, LEAVE_TYPES);
      const n = randInt(rng, 1, 5);
      return {
        entityType: "Leave Request",
        entityId: `LV-2026-${String(randInt(rng, 100, 899)).padStart(4, "0")}`,
        entityLabel: `${t.name} · ${type}`,
        summary: `Approved ${n} day${n === 1 ? "" : "s"} of ${type} for ${t.name}`,
        before: {
          Status: "Pending",
          "Approved by": "—",
          "Decision note": "—",
          Days: n,
          "Leave type": type,
          "Balance after": n + randInt(rng, 2, 11),
        },
        after: {
          Status: "Approved",
          "Approved by": actor.name,
          "Decision note": "Cover arranged within the team.",
          Days: n,
          "Leave type": type,
          "Balance after": randInt(rng, 2, 11),
        },
      };
    },
  },
  {
    action: "create",
    actorRoles: ["employee", "manager", "recruiter", "hr_admin"],
    weight: 7,
    build: (rng, t) => {
      const type = pick(rng, LEAVE_TYPES);
      const n = randInt(rng, 1, 4);
      return {
        entityType: "Leave Request",
        entityId: `LV-2026-${String(randInt(rng, 100, 899)).padStart(4, "0")}`,
        entityLabel: `${t.name} · ${type}`,
        summary: `Raised a ${n}-day ${type} request on behalf of ${t.name}`,
      };
    },
  },
  {
    action: "delete",
    actorRoles: ["hr_admin", "tenant_owner"],
    weight: 3,
    build: (rng, t) => ({
      entityType: "Leave Request",
      entityId: `LV-2026-${String(randInt(rng, 100, 899)).padStart(4, "0")}`,
      entityLabel: `${t.name} · duplicate entry`,
      summary: `Deleted a duplicate leave request raised twice for ${t.name}`,
      before: {
        Status: "Pending",
        "Leave type": pick(rng, LEAVE_TYPES),
        Days: randInt(rng, 1, 3),
        "Raised on": format(subDays(TODAY, randInt(rng, 2, 20)), "dd MMM yyyy"),
      },
    }),
  },
  /* ----------------------------------------------------------- attendance */
  {
    action: "approve",
    actorRoles: ["manager", "hr_admin"],
    weight: 8,
    build: (rng, t, actor) => ({
      entityType: "Attendance Amendment",
      entityId: `AMD-${String(randInt(rng, 1000, 4999))}`,
      entityLabel: `${t.name} · missed punch-out`,
      summary: `Approved a regularisation request for ${t.name}`,
      before: {
        Status: "Pending",
        "Punch out": "—",
        "Hours worked": "—",
        "Day status": "Not Marked",
        "Reviewed by": "—",
      },
      after: {
        Status: "Approved",
        "Punch out": `0${randInt(rng, 6, 9)}:${String(randInt(rng, 10, 55))} PM`,
        "Hours worked": `${randInt(rng, 7, 9)}h ${randInt(rng, 5, 55)}m`,
        "Day status": "Present",
        "Reviewed by": actor.name,
      },
    }),
  },
  /* -------------------------------------------------------------- payroll */
  {
    action: "update",
    actorRoles: ["payroll_admin", "tenant_owner"],
    weight: 5,
    build: (rng) => {
      // Two draws kept so the seeded sequence of later audit entries is unchanged.
      randInt(rng, 41, 46);
      randInt(rng, 0, 999);
      const net = AUG_RUN.totals.net;
      return {
        entityType: "Pay Run",
        entityId: "PR-2026-08",
        entityLabel: "August 2026 · India monthly",
        summary: "Locked the August 2026 pay run after clearing all exceptions",
        before: {
          Status: "Calculated",
          Exceptions: 3,
          "Locked by": "—",
          "Net payable": money(net),
          Headcount: AUG_RUN.employeeCount,
        },
        after: {
          Status: "Locked",
          Exceptions: 0,
          "Locked by": "Rahul Desai",
          "Net payable": money(net),
          Headcount: AUG_RUN.employeeCount,
        },
      };
    },
  },
  {
    action: "update",
    actorRoles: ["payroll_admin"],
    weight: 4,
    build: (rng, t) => ({
      entityType: "Pay Run Exception",
      entityId: `PRX-${String(randInt(rng, 100, 399))}`,
      entityLabel: `${t.name} · missing bank details`,
      summary: `Cleared a payroll exception for ${t.name} — bank account captured`,
      before: {
        "Exception type": "Missing bank details",
        Status: "Exception",
        "Account last 4": "—",
        "IFSC": "—",
        "Payment mode": "Hold",
      },
      after: {
        "Exception type": "Missing bank details",
        Status: "Approved",
        "Account last 4": t.bankAccountLast4,
        "IFSC": "HDFC0001284",
        "Payment mode": "NEFT",
      },
    }),
  },
  {
    action: "update",
    actorRoles: ["payroll_admin", "tenant_owner"],
    weight: 3,
    build: (rng) => ({
      entityType: "Salary Structure",
      entityId: `STR-000${randInt(rng, 1, 7)}`,
      entityLabel: "Grade G3 · India standard",
      summary: "Adjusted the HRA component on the Grade G3 India structure",
      before: {
        "Basic %": "40% of CTC",
        "HRA %": "40% of Basic",
        "Special allowance": "Balancing figure",
        "PF applicability": "Statutory ceiling ₹15,000",
        "NPS opt-in": false,
      },
      after: {
        "Basic %": "40% of CTC",
        "HRA %": "50% of Basic",
        "Special allowance": "Balancing figure",
        "PF applicability": "Statutory ceiling ₹15,000",
        "NPS opt-in": true,
      },
    }),
  },
  /* ---------------------------------------------------- roles and accounts */
  {
    action: "permission_change",
    actorRoles: ["tenant_owner", "hr_admin"],
    weight: 6,
    build: (rng) => {
      const g = pick(rng, GRANT_CHANGES);
      const meta = MENU_META.find((m) => m.key === g.key)!;
      const persona = personaById(g.role);
      return {
        entityType: "Role Permission",
        entityId: `${g.role}:${g.key}`,
        entityLabel: `${persona.role} · ${meta.label}`,
        summary: `Changed ${meta.label} grants for ${persona.role} from "${g.from || "none"}" to "${g.to}"`,
        before: {
          Role: persona.role,
          Capability: `${meta.module} › ${meta.label}`,
          "Menu key": g.key,
          "Granted actions": g.from || "—",
          Rationale: "—",
        },
        after: {
          Role: persona.role,
          Capability: `${meta.module} › ${meta.label}`,
          "Menu key": g.key,
          "Granted actions": g.to,
          Rationale: g.why,
        },
      };
    },
  },
  {
    action: "permission_change",
    actorRoles: ["tenant_owner", "hr_admin"],
    weight: 4,
    build: (rng, t) => {
      const added = pick(rng, ["Recruiter", "Payroll Admin", "HR Admin", "Reporting Manager"]);
      return {
        entityType: "User Account",
        entityId: t.code,
        entityLabel: `${t.name} · role assignment`,
        summary: `Assigned the ${added} role to ${t.name}`,
        before: {
          "Assigned roles": "Employee",
          Status: "Active",
          "MFA enrolled": true,
          "Auth method": "SSO · Google Workspace",
        },
        after: {
          "Assigned roles": `Employee, ${added}`,
          Status: "Active",
          "MFA enrolled": true,
          "Auth method": "SSO · Google Workspace",
        },
      };
    },
  },
  {
    action: "create",
    actorRoles: ["hr_admin", "tenant_owner"],
    weight: 4,
    build: (rng, t) => ({
      entityType: "User Account",
      entityId: `USR-${String(randInt(rng, 100, 399))}`,
      entityLabel: t.email,
      summary: `Invited ${t.name} to the platform as an Employee`,
      after: {
        "Login email": t.email,
        "Assigned roles": "Employee",
        Status: "Invited",
        "MFA enrolled": false,
        "Invite expires": format(subDays(TODAY, -7), "dd MMM yyyy"),
      },
    }),
  },
  {
    action: "update",
    actorRoles: ["tenant_owner", "hr_admin"],
    weight: 3,
    build: (rng, t) => ({
      entityType: "User Account",
      entityId: t.code,
      entityLabel: `${t.name} · security`,
      summary: `Enforced multi-factor authentication on ${t.name}'s account`,
      before: {
        "MFA enrolled": false,
        "MFA method": "—",
        "Session timeout": "12 hours",
        Status: "Active",
      },
      after: {
        "MFA enrolled": true,
        "MFA method": "Authenticator app (TOTP)",
        "Session timeout": "8 hours",
        Status: "Active",
      },
    }),
  },
  {
    action: "delete",
    actorRoles: ["tenant_owner", "hr_admin"],
    weight: 3,
    build: (_rng, t) => ({
      entityType: "User Account",
      entityId: t.code,
      entityLabel: t.email,
      summary: `Revoked platform access for ${t.name} following exit clearance`,
      before: {
        "Login email": t.email,
        "Assigned roles": "Employee",
        Status: "Active",
        "Active sessions": 2,
      },
    }),
  },
  /* -------------------------------------------------------------- sign-in */
  {
    action: "login",
    actorRoles: ["employee", "manager", "hr_admin", "payroll_admin", "recruiter", "tenant_owner"],
    weight: 22,
    build: (rng, _t, actor) => {
      const failed = rng() > 0.88;
      return {
        entityType: "Session",
        entityId: `SES-${String(randInt(rng, 1000, 9999))}`,
        entityLabel: actor.email,
        summary: failed
          ? `Failed sign-in attempt for ${actor.email} — incorrect one-time code`
          : `Signed in via ${actor.authMethod}`,
        outcome: failed ? ("failed" as const) : ("success" as const),
      };
    },
  },
  /* --------------------------------------------------------------- export */
  {
    action: "export",
    actorRoles: ["hr_admin", "payroll_admin", "tenant_owner"],
    weight: 10,
    build: (rng) => {
      const r = pick(rng, REPORTS);
      return {
        entityType: "Report Export",
        entityId: r.file,
        entityLabel: r.name,
        summary: `Exported ${r.name} (${r.scope})`,
        after: {
          Report: r.name,
          Scope: r.scope,
          File: r.file,
          Rows: randInt(rng, 24, 340),
          "Contains PII": true,
        },
      };
    },
  },
  /* -------------------------------------------------------------- hiring */
  {
    action: "create",
    actorRoles: ["recruiter", "hr_admin"],
    weight: 6,
    build: (rng) => {
      const role = pick(rng, [
        "Senior Backend Engineer",
        "Product Designer",
        "Account Executive — West",
        "Customer Success Manager",
        "Site Reliability Engineer",
      ]);
      return {
        entityType: "Candidate",
        entityId: `CND-${String(randInt(rng, 1000, 1499))}`,
        entityLabel: role,
        summary: `Added a candidate to the ${role} pipeline from an employee referral`,
        after: {
          Stage: "Applied",
          Source: "Employee referral",
          Role: role,
          Owner: "Sana Iqbal",
          "Resume attached": true,
        },
      };
    },
  },
  {
    action: "update",
    actorRoles: ["recruiter", "hr_admin"],
    weight: 6,
    build: (rng) => {
      const stages = ["Applied", "Screening", "Interview", "Offer"];
      const i = randInt(rng, 0, 2);
      return {
        entityType: "Candidate",
        entityId: `CND-${String(randInt(rng, 1000, 1499))}`,
        entityLabel: pick(rng, ["Meera Chowdhury", "Tarun Bansal", "Rachel O'Brien", "Abhishek Sinha"]),
        summary: `Moved a candidate from ${stages[i]} to ${stages[i + 1]}`,
        before: {
          Stage: stages[i],
          "Panel rating": i === 0 ? "—" : `${randInt(rng, 3, 4)}.0 / 5`,
          Owner: "Sana Iqbal",
          "Next step": stages[i + 1],
          "Days in stage": randInt(rng, 2, 9),
        },
        after: {
          Stage: stages[i + 1],
          "Panel rating": `${randInt(rng, 3, 5)}.0 / 5`,
          Owner: "Sana Iqbal",
          "Next step": stages[Math.min(i + 2, 3)],
          "Days in stage": 0,
        },
      };
    },
  },
  {
    action: "approve",
    actorRoles: ["hr_admin", "tenant_owner", "manager"],
    weight: 4,
    build: (rng) => ({
      entityType: "Requisition",
      entityId: `REQ-${String(randInt(rng, 10, 99)).padStart(4, "0")}`,
      entityLabel: pick(rng, ["Staff Engineer · Bengaluru", "Senior CSM · Pune", "Marketing Manager · Bengaluru"]),
      summary: "Approved a hiring requisition and released it to the recruiting team",
      before: {
        Status: "Pending",
        "Approved by": "—",
        Positions: randInt(rng, 1, 3),
        "Budgeted CTC": money(randInt(rng, 18, 32) * 100000),
        "Target close": "30 Nov 2026",
      },
      after: {
        Status: "Approved",
        "Approved by": "Priya Menon",
        Positions: randInt(rng, 1, 3),
        "Budgeted CTC": money(randInt(rng, 18, 32) * 100000),
        "Target close": "30 Nov 2026",
      },
    }),
  },
  {
    action: "update",
    actorRoles: ["recruiter", "hr_admin"],
    weight: 3,
    build: (rng) => {
      const base = randInt(rng, 16, 28) * 100000;
      return {
        entityType: "Offer",
        entityId: `OFR-${String(randInt(rng, 100, 399))}`,
        entityLabel: "Nikhil Bansal · Senior Backend Engineer",
        summary: "Revised the offer CTC after a counter-offer discussion",
        before: {
          "Offered CTC": money(base),
          "Joining bonus": money(100000),
          "Joining date": "06 Oct 2026",
          Status: "Sent",
          Grade: "G3",
        },
        after: {
          "Offered CTC": money(base + 150000),
          "Joining bonus": money(150000),
          "Joining date": "13 Oct 2026",
          Status: "Sent",
          Grade: "G3",
        },
      };
    },
  },
  /* ------------------------------------------------------------ workplace */
  {
    action: "update",
    actorRoles: ["hr_admin", "tenant_owner"],
    weight: 5,
    build: (rng, t) => ({
      entityType: "Asset",
      entityId: `AST-${String(randInt(rng, 1000, 1999))}`,
      entityLabel: pick(rng, ASSET_MODELS),
      summary: `Allocated an asset to ${t.name}`,
      before: {
        Status: "In Stock",
        "Assigned to": "—",
        Location: "Bengaluru HQ · IT store",
        "Warranty ends": "31 Mar 2028",
      },
      after: {
        Status: "Allocated",
        "Assigned to": t.name,
        Location: t.location,
        "Warranty ends": "31 Mar 2028",
      },
    }),
  },
  {
    action: "delete",
    actorRoles: ["hr_admin", "tenant_owner"],
    weight: 2,
    build: (rng) => ({
      entityType: "Asset",
      entityId: `AST-${String(randInt(rng, 1000, 1999))}`,
      entityLabel: pick(rng, ASSET_MODELS),
      summary: "Retired an end-of-life asset from the register",
      before: {
        Status: "Under Repair",
        "Assigned to": "—",
        "Purchase date": "12 Jun 2020",
        "Book value": money(0),
      },
    }),
  },
  {
    action: "approve",
    actorRoles: ["manager", "payroll_admin"],
    weight: 6,
    build: (rng, t, actor) => {
      const claimed = randInt(rng, 3, 48) * 1000;
      const approved = rng() > 0.7 ? claimed - randInt(rng, 1, 4) * 500 : claimed;
      return {
        entityType: "Expense Claim",
        entityId: `EXP-2026-${String(randInt(rng, 100, 899)).padStart(4, "0")}`,
        entityLabel: `${t.name} · ${pick(rng, EXPENSE_HEADS)}`,
        summary: `Approved an expense claim of ${money(approved)} for ${t.name}`,
        before: {
          Status: "Submitted",
          "Claimed amount": money(claimed),
          "Approved amount": money(0),
          "Approved by": "—",
          "Policy flags": approved < claimed ? 1 : 0,
        },
        after: {
          Status: "Approved",
          "Claimed amount": money(claimed),
          "Approved amount": money(approved),
          "Approved by": actor.name,
          "Policy flags": approved < claimed ? 1 : 0,
        },
      };
    },
  },
  {
    action: "create",
    actorRoles: ["hr_admin", "tenant_owner"],
    weight: 3,
    build: (rng) => ({
      entityType: "Announcement",
      entityId: `ANN-${String(randInt(rng, 10, 99)).padStart(4, "0")}`,
      entityLabel: pick(rng, [
        "Diwali holiday calendar 2026",
        "Revised travel policy — effective 01 Oct",
        "POSH refresher training — mandatory",
        "Quarterly all-hands: 26 Sep, 4 PM IST",
      ]),
      summary: "Published a company-wide announcement with acknowledgement tracking",
      after: {
        Audience: "All employees · 340",
        "Acknowledgement required": true,
        Pinned: true,
        "Publish on": format(TODAY, "dd MMM yyyy"),
      },
    }),
  },
  /* ----------------------------------------------------------- compliance */
  {
    action: "update",
    actorRoles: ["payroll_admin", "hr_admin"],
    weight: 4,
    build: (rng) => ({
      entityType: "Compliance Filing",
      entityId: `CMP-${String(randInt(rng, 1, 32)).padStart(2, "0")}`,
      entityLabel: pick(rng, ["PF ECR · Jul 2026", "ESI Contribution · Jul 2026", "TDS 24Q · Q1 FY 2026-27"]),
      summary: "Marked a statutory filing as filed and attached the acknowledgement",
      before: {
        Status: "Due Soon",
        "Filing reference": "—",
        "Filed on": "—",
        "Penalty risk": "High",
        Owner: "Rahul Desai",
      },
      after: {
        Status: "Filed",
        "Filing reference": `ECR/KN/BNG/0049217/0${randInt(rng, 7, 8)}2026`,
        "Filed on": format(subDays(TODAY, randInt(rng, 1, 40)), "dd MMM yyyy"),
        "Penalty risk": "Low",
        Owner: "Rahul Desai",
      },
    }),
  },
  /* ------------------------------------------------------- tenant settings */
  {
    action: "update",
    actorRoles: ["tenant_owner"],
    weight: 2,
    build: () => ({
      entityType: "Tenant Settings",
      entityId: TENANT.id,
      entityLabel: TENANT.name,
      summary: "Updated tenant localisation defaults",
      before: {
        "Financial year start": "April (Apr–Mar)",
        "Week starts on": "Sunday",
        "Date format": "MM/dd/yyyy",
        Locale: "en-IN",
        Timezone: "Asia/Kolkata",
      },
      after: {
        "Financial year start": "April (Apr–Mar)",
        "Week starts on": "Monday",
        "Date format": "dd MMM yyyy",
        Locale: "en-IN",
        Timezone: "Asia/Kolkata",
      },
    }),
  },
  {
    action: "update",
    actorRoles: ["hr_admin", "tenant_owner"],
    weight: 3,
    build: (rng) => ({
      entityType: "Work Calendar",
      entityId: `CAL-IN-2026`,
      entityLabel: "India holiday calendar 2026",
      summary: "Added an optional holiday to the India 2026 calendar",
      before: {
        "Holiday count": 13,
        "Optional holidays": 3,
        "Week off pattern": "Sat & Sun",
        Country: "India",
        "Published to": `${randInt(rng, 290, 310)} employees`,
      },
      after: {
        "Holiday count": 14,
        "Optional holidays": 4,
        "Week off pattern": "Sat & Sun",
        Country: "India",
        "Published to": `${randInt(rng, 290, 310)} employees`,
      },
    }),
  },
];

const WEIGHTED: AuditTemplate[] = TEMPLATES.flatMap((t) => Array.from({ length: t.weight }, () => t));

function buildAuditLog(): AuditEntry[] {
  const rng = mulberry32(19770425);
  const actorPool = PLATFORM_USERS.filter((u) => u.status !== "invited");
  const entries: AuditEntry[] = [];

  for (let i = 0; i < 220; i++) {
    const tpl = pick(rng, WEIGHTED);
    const candidates = actorPool.filter((u) => u.roles.some((r) => tpl.actorRoles.includes(r)));
    const actor = candidates.length ? pick(rng, candidates) : pick(rng, actorPool);
    const target = pick(rng, EMPLOYEES);
    const agent = pick(rng, AGENTS);
    const res = tpl.build(rng, target, actor);

    /* Recent activity is denser than old activity — the curve the chart shows. */
    let daysBack = Math.floor(Math.pow(rng(), 1.6) * 45);
    const probe = subDays(NOW, daysBack);
    const dow = probe.getDay();
    if (dow === 0 && rng() > 0.12) daysBack += 2;
    else if (dow === 6 && rng() > 0.16) daysBack += 1;

    entries.push({
      id: "",
      at: stamp(daysBack, randInt(rng, 8, 21), randInt(rng, 0, 59), randInt(rng, 0, 59)),
      actorCode: actor.employeeCode,
      actorName: actor.name,
      actorRole: personaById(actor.roles[0]).role,
      action: tpl.action,
      entityType: res.entityType,
      entityId: res.entityId,
      entityLabel: res.entityLabel,
      summary: res.summary,
      ip: ipFor(rng, actor.branchId),
      userAgent: agent.ua,
      device: agent.device,
      outcome: res.outcome ?? "success",
      before: res.before,
      after: res.after,
    });
  }

  entries.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return entries.map((e, i) => ({ ...e, id: `AUD-${String(entries.length - i).padStart(5, "0")}` }));
}

export const AUDIT_LOG: AuditEntry[] = buildAuditLog();

export const AUDIT_ENTITY_TYPES: string[] = [...new Set(AUDIT_LOG.map((e) => e.entityType))].sort();

export const AUDIT_ACTORS: { code: string; name: string }[] = [
  ...new Map(AUDIT_LOG.map((e) => [e.actorCode, { code: e.actorCode, name: e.actorName }])).values(),
].sort((a, b) => a.name.localeCompare(b.name));

/** Events per day for the last 30 days — the activity trend on /admin/audit. */
export const AUDIT_DAILY: { day: string; events: number; sensitive: number }[] = (() => {
  const out: { day: string; events: number; sensitive: number }[] = [];
  for (let d = 29; d >= 0; d--) {
    const iso = format(subDays(TODAY, d), "yyyy-MM-dd");
    const onDay = AUDIT_LOG.filter((e) => e.at.slice(0, 10) === iso);
    out.push({
      day: iso,
      events: onDay.length,
      sensitive: onDay.filter(
        (e) => e.action === "permission_change" || e.action === "delete" || e.action === "export",
      ).length,
    });
  }
  return out;
})();

export const AUDIT_BY_ACTION: { name: string; value: number }[] = AUDIT_ACTIONS.map((a) => ({
  name: AUDIT_ACTION_LABEL[a],
  value: AUDIT_LOG.filter((e) => e.action === a).length,
})).filter((r) => r.value > 0);

export const AUDIT_STATS = {
  total: AUDIT_LOG.length,
  last7: AUDIT_LOG.filter((e) => e.at >= format(subDays(TODAY, 7), "yyyy-MM-dd")).length,
  permissionChanges: AUDIT_LOG.filter((e) => e.action === "permission_change").length,
  failedSignIns: AUDIT_LOG.filter((e) => e.outcome === "failed").length,
  exports: AUDIT_LOG.filter((e) => e.action === "export").length,
};

/* ==================================================== compliance calendar */

export type ComplianceStatus = "filed" | "due_soon" | "overdue" | "not_started" | "pending";
export type PenaltyRisk = "low" | "medium" | "high";

export interface ComplianceFiling {
  id: string;
  /** Statutory name as it appears on the portal. */
  name: string;
  shortName: string;
  authority: string;
  country: "IN" | "US";
  category: "Provident Fund" | "Insurance" | "State Tax" | "Income Tax" | "Labour" | "Retirement" | "Federal Tax";
  period: string;
  dueDate: string;
  ownerCode: string;
  status: ComplianceStatus;
  penaltyRisk: PenaltyRisk;
  penaltyNote: string;
  filingRef: string | null;
  filedOn: string | null;
  /** INR only — US filings carry no rupee amount and render as "—". */
  amount: number | null;
  notes: string;
}

export const PENALTY_RISK_LABEL: Record<PenaltyRisk, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const COMPLIANCE_STATUS_ORDER: ComplianceStatus[] = [
  "overdue",
  "due_soon",
  "pending",
  "not_started",
  "filed",
];

const F = (f: ComplianceFiling) => f;

export const COMPLIANCE_FILINGS: ComplianceFiling[] = [
  /* ------------------------------------------------------------- India PF */
  F({
    id: "CMP-01",
    name: "Provident Fund — Electronic Challan cum Return (ECR)",
    shortName: "PF ECR",
    authority: "EPFO · Unified Portal",
    country: "IN",
    category: "Provident Fund",
    period: "Jun 2026",
    dueDate: "2026-07-15",
    ownerCode: "STL-0017",
    status: "filed",
    penaltyRisk: "low",
    penaltyNote: "Filed within the statutory window — no damages under Section 14B.",
    filingRef: "ECR/KN/BNG/0049217/062026",
    filedOn: "2026-07-13",
    amount: 4218400,
    notes: "306 India members. Challan cleared by HDFC on the same day.",
  }),
  F({
    id: "CMP-02",
    name: "Provident Fund — Electronic Challan cum Return (ECR)",
    shortName: "PF ECR",
    authority: "EPFO · Unified Portal",
    country: "IN",
    category: "Provident Fund",
    period: "Jul 2026",
    dueDate: "2026-08-15",
    ownerCode: "STL-0017",
    status: "filed",
    penaltyRisk: "low",
    penaltyNote: "Filed two days ahead of the due date.",
    filingRef: "ECR/KN/BNG/0049217/072026",
    filedOn: "2026-08-13",
    amount: 4262150,
    notes: "Includes arrears for four July joiners.",
  }),
  F({
    id: "CMP-03",
    name: "Provident Fund — Electronic Challan cum Return (ECR)",
    shortName: "PF ECR",
    authority: "EPFO · Unified Portal",
    country: "IN",
    category: "Provident Fund",
    period: "Aug 2026",
    dueDate: "2026-09-20",
    ownerCode: "STL-0017",
    status: "due_soon",
    penaltyRisk: "high",
    penaltyNote: "Damages of 5–25% p.a. under Section 14B plus 12% interest under Section 7Q.",
    filingRef: null,
    filedOn: null,
    amount: 4238650,
    notes: "ECR text file generated from the locked August run; awaiting challan payment.",
  }),
  /* ------------------------------------------------------------ India ESI */
  F({
    id: "CMP-04",
    name: "Employees' State Insurance — monthly contribution",
    shortName: "ESI Contribution",
    authority: "ESIC · Portal",
    country: "IN",
    category: "Insurance",
    period: "Jul 2026",
    dueDate: "2026-08-15",
    ownerCode: "STL-0017",
    status: "filed",
    penaltyRisk: "low",
    penaltyNote: "Contribution paid in full; no simple interest applicable.",
    filingRef: "ESIC/53000512340001099/072026",
    filedOn: "2026-08-12",
    amount: 312480,
    notes: "84 covered employees below the ₹21,000 wage ceiling.",
  }),
  F({
    id: "CMP-05",
    name: "Employees' State Insurance — monthly contribution",
    shortName: "ESI Contribution",
    authority: "ESIC · Portal",
    country: "IN",
    category: "Insurance",
    period: "Aug 2026",
    dueDate: "2026-09-15",
    ownerCode: "STL-0017",
    status: "overdue",
    penaltyRisk: "high",
    penaltyNote: "12% p.a. simple interest per day of delay, plus damages up to 25%.",
    filingRef: null,
    filedOn: null,
    amount: 318970,
    notes: "Challan generated but the payment gateway mandate expired. Re-initiate today.",
  }),
  /* -------------------------------------------------- India Professional Tax */
  F({
    id: "CMP-06",
    name: "Professional Tax — Karnataka monthly remittance",
    shortName: "Professional Tax (KA)",
    authority: "Commercial Taxes Dept., Karnataka",
    country: "IN",
    category: "State Tax",
    period: "Jul 2026",
    dueDate: "2026-08-20",
    ownerCode: "STL-0008",
    status: "overdue",
    penaltyRisk: "high",
    penaltyNote: "1.25% interest per month plus a penalty up to 50% of the tax due.",
    filingRef: null,
    filedOn: null,
    amount: 42800,
    notes: "Missed during the finance team handover. Escalated to the CFO on 09 Sep.",
  }),
  F({
    id: "CMP-07",
    name: "Professional Tax — Karnataka monthly remittance",
    shortName: "Professional Tax (KA)",
    authority: "Commercial Taxes Dept., Karnataka",
    country: "IN",
    category: "State Tax",
    period: "Aug 2026",
    dueDate: "2026-09-20",
    ownerCode: "STL-0008",
    status: "pending",
    penaltyRisk: "medium",
    penaltyNote: "1.25% interest per month on late remittance.",
    filingRef: null,
    filedOn: null,
    amount: 42800,
    notes: "Challan prepared; awaiting CFO digital signature.",
  }),
  F({
    id: "CMP-08",
    name: "Professional Tax — Maharashtra monthly remittance",
    shortName: "Professional Tax (MH)",
    authority: "Maharashtra GST Dept.",
    country: "IN",
    category: "State Tax",
    period: "Aug 2026",
    dueDate: "2026-09-30",
    ownerCode: "STL-0017",
    status: "not_started",
    penaltyRisk: "medium",
    penaltyNote: "₹1,000 late-filing fee plus 1.25% monthly interest.",
    filingRef: null,
    filedOn: null,
    amount: 18400,
    notes: "Pune Delivery Centre — 92 employees on the MTR-6 return.",
  }),
  /* -------------------------------------------------------- India TDS / IT */
  F({
    id: "CMP-09",
    name: "TDS on salaries — monthly challan ITNS 281",
    shortName: "TDS Challan 281",
    authority: "Income Tax Dept. · TIN-NSDL",
    country: "IN",
    category: "Income Tax",
    period: "Aug 2026",
    dueDate: "2026-09-07",
    ownerCode: "STL-0017",
    status: "filed",
    penaltyRisk: "low",
    penaltyNote: "Remitted on time; no interest under Section 201(1A).",
    filingRef: "CIN/HDFC/0281/20260905/00418",
    filedOn: "2026-09-05",
    amount: 9648300,
    notes: `Section 192 deduction for ${AUG_RUN.employeeCount} India employees.`,
  }),
  F({
    id: "CMP-10",
    name: "TDS quarterly return — Form 24Q",
    shortName: "TDS 24Q",
    authority: "Income Tax Dept. · TRACES",
    country: "IN",
    category: "Income Tax",
    period: "Q1 FY 2026-27 (Apr–Jun)",
    dueDate: "2026-07-31",
    ownerCode: "STL-0017",
    status: "filed",
    penaltyRisk: "low",
    penaltyNote: "Accepted without defaults; no ₹200/day fee under Section 234E.",
    filingRef: "24Q/BLRS29471C/Q1/2627",
    filedOn: "2026-07-28",
    amount: 28674500,
    notes: "Annexure I validated with zero PAN errors.",
  }),
  F({
    id: "CMP-11",
    name: "TDS quarterly return — Form 24Q",
    shortName: "TDS 24Q",
    authority: "Income Tax Dept. · TRACES",
    country: "IN",
    category: "Income Tax",
    period: "Q2 FY 2026-27 (Jul–Sep)",
    dueDate: "2026-10-31",
    ownerCode: "STL-0017",
    status: "not_started",
    penaltyRisk: "medium",
    penaltyNote: "₹200 per day of delay under Section 234E, capped at the TDS amount.",
    filingRef: null,
    filedOn: null,
    amount: 29140000,
    notes: "Opens once the September pay run is locked.",
  }),
  F({
    id: "CMP-12",
    name: "Form 16 issuance to employees",
    shortName: "Form 16",
    authority: "Income Tax Dept. · TRACES",
    country: "IN",
    category: "Income Tax",
    period: "FY 2025-26",
    dueDate: "2026-06-15",
    ownerCode: "STL-0017",
    status: "filed",
    penaltyRisk: "low",
    penaltyNote: "₹100 per day per certificate under Section 272A(2)(g) if delayed.",
    filingRef: "FORM16/FY2526/BATCH-0331",
    filedOn: "2026-06-11",
    amount: null,
    notes: "331 Part A/B certificates generated and emailed; 4 bounced and were re-sent.",
  }),
  F({
    id: "CMP-13",
    name: "Form 16 issuance to employees",
    shortName: "Form 16",
    authority: "Income Tax Dept. · TRACES",
    country: "IN",
    category: "Income Tax",
    period: "FY 2026-27",
    dueDate: "2027-06-15",
    ownerCode: "STL-0017",
    status: "not_started",
    penaltyRisk: "low",
    penaltyNote: "₹100 per day per certificate under Section 272A(2)(g) if delayed.",
    filingRef: null,
    filedOn: null,
    amount: null,
    notes: "Blocked until all four quarterly 24Q returns are accepted.",
  }),
  /* ------------------------------------------------------- India gratuity */
  F({
    id: "CMP-14",
    name: "Gratuity fund contribution — LIC group gratuity scheme",
    shortName: "Gratuity Contribution",
    authority: "LIC of India · Group Schemes",
    country: "IN",
    category: "Retirement",
    period: "Q2 FY 2026-27",
    dueDate: "2026-09-30",
    ownerCode: "STL-0008",
    status: "pending",
    penaltyRisk: "medium",
    penaltyNote: "Shortfall attracts 10% simple interest under Section 7(3A) on delayed payouts.",
    filingRef: null,
    filedOn: null,
    amount: 1862000,
    notes: "Actuarial certificate received from the valuer on 08 Sep; awaiting board note.",
  }),
  F({
    id: "CMP-15",
    name: "Gratuity — actuarial valuation and Form F nomination audit",
    shortName: "Gratuity Valuation",
    authority: "Payment of Gratuity Act, 1972",
    country: "IN",
    category: "Retirement",
    period: "H1 FY 2026-27",
    dueDate: "2026-10-15",
    ownerCode: "STL-0009",
    status: "not_started",
    penaltyRisk: "low",
    penaltyNote: "Non-maintenance of Form F nominations is a compoundable offence.",
    filingRef: null,
    filedOn: null,
    amount: null,
    notes: "62 employees still have no Form F nomination on record.",
  }),
  /* --------------------------------------------------------- India labour */
  F({
    id: "CMP-16",
    name: "Shops & Establishments registration renewal — Bengaluru HQ",
    shortName: "S&E Renewal (KA)",
    authority: "Labour Dept., Karnataka",
    country: "IN",
    category: "Labour",
    period: "2026-27",
    dueDate: "2026-09-24",
    ownerCode: "STL-0009",
    status: "due_soon",
    penaltyRisk: "high",
    penaltyNote: "Operating on a lapsed registration attracts a fine up to ₹10,000 per day.",
    filingRef: null,
    filedOn: null,
    amount: 12500,
    notes: "Registration 29/BNG/SE/2021/09482 expires 30 Sep. Renewal form drafted.",
  }),
  F({
    id: "CMP-17",
    name: "Shops & Establishments registration renewal — Pune Delivery Centre",
    shortName: "S&E Renewal (MH)",
    authority: "Labour Dept., Maharashtra",
    country: "IN",
    category: "Labour",
    period: "2026-27",
    dueDate: "2026-11-30",
    ownerCode: "STL-0009",
    status: "not_started",
    penaltyRisk: "medium",
    penaltyNote: "Late renewal fee of ₹2,000 plus per-day penalty after expiry.",
    filingRef: null,
    filedOn: null,
    amount: 8000,
    notes: "Pune registration is valid until 31 Dec 2026.",
  }),
  F({
    id: "CMP-18",
    name: "POSH annual report to the District Officer",
    shortName: "POSH Annual Report",
    authority: "District Officer, Bengaluru Urban",
    country: "IN",
    category: "Labour",
    period: "CY 2025",
    dueDate: "2026-01-31",
    ownerCode: "STL-0009",
    status: "filed",
    penaltyRisk: "low",
    penaltyNote: "Non-filing attracts a fine up to ₹50,000 under Section 26.",
    filingRef: "POSH/DO-BLRU/2025/0488",
    filedOn: "2026-01-23",
    amount: null,
    notes: "Two complaints received, both closed within 90 days by the Internal Committee.",
  }),
  F({
    id: "CMP-19",
    name: "POSH Internal Committee — half-yearly awareness report",
    shortName: "POSH Half-Yearly",
    authority: "Internal Committee · Stellar Technologies",
    country: "IN",
    category: "Labour",
    period: "H1 2026",
    dueDate: "2026-07-31",
    ownerCode: "STL-0009",
    status: "filed",
    penaltyRisk: "low",
    penaltyNote: "Internal governance requirement; no statutory penalty.",
    filingRef: "POSH/IC/H1-2026/REP-11",
    filedOn: "2026-07-24",
    amount: null,
    notes: "94% training completion across India entities.",
  }),
  F({
    id: "CMP-20",
    name: "POSH annual report to the District Officer",
    shortName: "POSH Annual Report",
    authority: "District Officer, Bengaluru Urban",
    country: "IN",
    category: "Labour",
    period: "CY 2026",
    dueDate: "2027-01-31",
    ownerCode: "STL-0009",
    status: "not_started",
    penaltyRisk: "low",
    penaltyNote: "Non-filing attracts a fine up to ₹50,000 under Section 26.",
    filingRef: null,
    filedOn: null,
    amount: null,
    notes: "Compiles automatically from the Internal Committee case register.",
  }),
  F({
    id: "CMP-21",
    name: "Labour Welfare Fund — Karnataka annual contribution",
    shortName: "Labour Welfare Fund",
    authority: "Karnataka Labour Welfare Board",
    country: "IN",
    category: "Labour",
    period: "CY 2026",
    dueDate: "2027-01-15",
    ownerCode: "STL-0017",
    status: "not_started",
    penaltyRisk: "low",
    penaltyNote: "₹40 per employee per year; interest on delayed remittance.",
    filingRef: null,
    filedOn: null,
    amount: 8560,
    notes: "Deducted in the December pay run, remitted in January.",
  }),
  F({
    id: "CMP-22",
    name: "Payment of Bonus Act — annual return in Form D",
    shortName: "Bonus Form D",
    authority: "Labour Dept., Karnataka",
    country: "IN",
    category: "Labour",
    period: "FY 2025-26",
    dueDate: "2026-12-31",
    ownerCode: "STL-0008",
    status: "not_started",
    penaltyRisk: "medium",
    penaltyNote: "Imprisonment up to 6 months or fine up to ₹1,000 under Section 28.",
    filingRef: null,
    filedOn: null,
    amount: 2140000,
    notes: "118 employees below the ₹21,000 eligibility ceiling.",
  }),
  /* ------------------------------------------------------------- US 401(k) */
  F({
    id: "CMP-23",
    name: "401(k) employee deferral deposit",
    shortName: "401(k) Deposit",
    authority: "US DOL · Fidelity plan custodian",
    country: "US",
    category: "Retirement",
    period: "Payroll ending 31 Aug 2026",
    dueDate: "2026-09-04",
    ownerCode: "STL-0017",
    status: "filed",
    penaltyRisk: "low",
    penaltyNote: "Deposited within the 7-business-day safe harbour for small plans.",
    filingRef: "FID-401K-20260904-0117",
    filedOn: "2026-09-03",
    amount: null,
    notes: "31 participants · employer match 4% of eligible compensation.",
  }),
  F({
    id: "CMP-24",
    name: "401(k) employee deferral deposit",
    shortName: "401(k) Deposit",
    authority: "US DOL · Fidelity plan custodian",
    country: "US",
    category: "Retirement",
    period: "Payroll ending 15 Sep 2026",
    dueDate: "2026-09-18",
    ownerCode: "STL-0017",
    status: "due_soon",
    penaltyRisk: "high",
    penaltyNote: "Late deferrals are a prohibited transaction — excise tax plus lost-earnings restoration.",
    filingRef: null,
    filedOn: null,
    amount: null,
    notes: "Deferral file exported; awaiting ACH release from the Newark account.",
  }),
  F({
    id: "CMP-25",
    name: "Form 5500 — annual return for the 401(k) plan",
    shortName: "Form 5500",
    authority: "US DOL · EFAST2",
    country: "US",
    category: "Retirement",
    period: "Plan Year 2025",
    dueDate: "2026-07-31",
    ownerCode: "STL-0008",
    status: "overdue",
    penaltyRisk: "high",
    penaltyNote: "Up to $2,739 per day under ERISA Section 502(c)(2); DFVCP relief available.",
    filingRef: null,
    filedOn: null,
    amount: null,
    notes: "Form 5558 extension was not filed in time. Counsel engaged on DFVCP relief.",
  }),
  /* ----------------------------------------------------------- US federal */
  F({
    id: "CMP-26",
    name: "Form 941 — Employer's Quarterly Federal Tax Return",
    shortName: "Form 941",
    authority: "IRS · e-file",
    country: "US",
    category: "Federal Tax",
    period: "Q2 2026 (Apr–Jun)",
    dueDate: "2026-07-31",
    ownerCode: "STL-0017",
    status: "filed",
    penaltyRisk: "low",
    penaltyNote: "Accepted by the IRS; no failure-to-file penalty.",
    filingRef: "941/EIN-38-4192077/Q2-2026",
    filedOn: "2026-07-27",
    amount: null,
    notes: "Schedule B semi-weekly depositor schedule attached.",
  }),
  F({
    id: "CMP-27",
    name: "Form 941 — Employer's Quarterly Federal Tax Return",
    shortName: "Form 941",
    authority: "IRS · e-file",
    country: "US",
    category: "Federal Tax",
    period: "Q3 2026 (Jul–Sep)",
    dueDate: "2026-11-02",
    ownerCode: "STL-0017",
    status: "not_started",
    penaltyRisk: "medium",
    penaltyNote: "5% of unpaid tax per month, capped at 25%, for late filing.",
    filingRef: null,
    filedOn: null,
    amount: null,
    notes: "Opens after the 30 Sep semi-monthly run is finalised.",
  }),
  F({
    id: "CMP-28",
    name: "Form 940 — Employer's Annual Federal Unemployment (FUTA) Return",
    shortName: "Form 940",
    authority: "IRS · e-file",
    country: "US",
    category: "Federal Tax",
    period: "CY 2026",
    dueDate: "2027-02-01",
    ownerCode: "STL-0017",
    status: "not_started",
    penaltyRisk: "low",
    penaltyNote: "Late filing attracts 5% of the tax due per month, capped at 25%.",
    filingRef: null,
    filedOn: null,
    amount: null,
    notes: "New Jersey is not a credit-reduction state for 2026.",
  }),
  F({
    id: "CMP-29",
    name: "Form W-2 — employee copies distribution",
    shortName: "W-2 Distribution",
    authority: "IRS / SSA",
    country: "US",
    category: "Federal Tax",
    period: "Tax Year 2025",
    dueDate: "2026-01-31",
    ownerCode: "STL-0017",
    status: "filed",
    penaltyRisk: "low",
    penaltyNote: "$60–$340 per form for late furnishing under Section 6722.",
    filingRef: "W2/TY2025/EFW2-0029",
    filedOn: "2026-01-27",
    amount: null,
    notes: "29 W-2s furnished electronically with recorded consent.",
  }),
  F({
    id: "CMP-30",
    name: "Form W-2 / W-3 — filing with the Social Security Administration",
    shortName: "W-2 SSA Filing",
    authority: "SSA · Business Services Online",
    country: "US",
    category: "Federal Tax",
    period: "Tax Year 2026",
    dueDate: "2027-02-01",
    ownerCode: "STL-0017",
    status: "not_started",
    penaltyRisk: "low",
    penaltyNote: "$60–$340 per form for late filing under Section 6721.",
    filingRef: null,
    filedOn: null,
    amount: null,
    notes: "EFW2 file is produced by the year-end close job.",
  }),
  F({
    id: "CMP-31",
    name: "NJ-927 — New Jersey Employer's Quarterly Report",
    shortName: "NJ-927",
    authority: "State of New Jersey · Division of Taxation",
    country: "US",
    category: "State Tax",
    period: "Q2 2026",
    dueDate: "2026-07-30",
    ownerCode: "STL-0017",
    status: "filed",
    penaltyRisk: "low",
    penaltyNote: "$10 per day late-filing penalty, minimum $100.",
    filingRef: "NJ927/0384192077/Q2-2026",
    filedOn: "2026-07-24",
    amount: null,
    notes: "Filed together with the WR-30 wage report.",
  }),
  F({
    id: "CMP-32",
    name: "WR-30 — New Jersey Employer Report of Wages Paid",
    shortName: "WR-30",
    authority: "State of New Jersey · Dept. of Labor",
    country: "US",
    category: "State Tax",
    period: "Q3 2026",
    dueDate: "2026-10-30",
    ownerCode: "STL-0017",
    status: "not_started",
    penaltyRisk: "low",
    penaltyNote: "$5 per employee per quarter for a late or incomplete report.",
    filingRef: null,
    filedOn: null,
    amount: null,
    notes: "31 Newark employees on the Q3 wage report.",
  }),
];

export const complianceById = (id: string) => COMPLIANCE_FILINGS.find((f) => f.id === id);

export const COMPLIANCE_STATS = {
  total: COMPLIANCE_FILINGS.length,
  filed: COMPLIANCE_FILINGS.filter((f) => f.status === "filed").length,
  overdue: COMPLIANCE_FILINGS.filter((f) => f.status === "overdue").length,
  dueSoon: COMPLIANCE_FILINGS.filter((f) => f.status === "due_soon").length,
  pending: COMPLIANCE_FILINGS.filter((f) => f.status === "pending").length,
  notStarted: COMPLIANCE_FILINGS.filter((f) => f.status === "not_started").length,
  highRiskOpen: COMPLIANCE_FILINGS.filter((f) => f.status !== "filed" && f.penaltyRisk === "high").length,
  next30: COMPLIANCE_FILINGS.filter(
    (f) =>
      f.status !== "filed" &&
      f.dueDate >= DEMO_TODAY &&
      f.dueDate <= format(subDays(TODAY, -30), "yyyy-MM-dd"),
  ).length,
  exposure: COMPLIANCE_FILINGS.filter((f) => f.status !== "filed" && f.amount).reduce(
    (a, f) => a + (f.amount ?? 0),
    0,
  ),
};

export const COMPLIANCE_BY_STATUS: { name: string; value: number }[] = [
  { name: "Filed", value: COMPLIANCE_STATS.filed },
  { name: "Due soon", value: COMPLIANCE_STATS.dueSoon },
  { name: "Pending", value: COMPLIANCE_STATS.pending },
  { name: "Not started", value: COMPLIANCE_STATS.notStarted },
  { name: "Overdue", value: COMPLIANCE_STATS.overdue },
].filter((r) => r.value > 0);

/* ========================================================= tenant settings */

export interface NotificationPrefs {
  leaveApprovals: boolean;
  payrollAlerts: boolean;
  complianceReminders: boolean;
  weeklyDigest: boolean;
  securityAlerts: boolean;
  productUpdates: boolean;
}

export interface TenantSettingsValues {
  name: string;
  legalName: string;
  shortName: string;
  supportEmail: string;
  website: string;
  accentId: string;
  defaultCountry: string;
  defaultTimezone: string;
  fyStartMonth: 1 | 4;
  locale: string;
  dateFormat: string;
  currency: string;
  weekStart: "sunday" | "monday";
  notifications: NotificationPrefs;
}

/** Seeded from TENANT in src/mock/org.ts — the settings screen edits a copy. */
export const TENANT_SETTINGS: TenantSettingsValues = {
  name: TENANT.name,
  legalName: TENANT.legalName,
  shortName: TENANT.shortName,
  supportEmail: TENANT.supportEmail,
  website: TENANT.website,
  accentId: "indigo",
  defaultCountry: TENANT.defaultCountry,
  defaultTimezone: TENANT.defaultTimezone,
  fyStartMonth: TENANT.fyStartMonth,
  locale: TENANT.locale,
  dateFormat: "dd MMM yyyy",
  currency: TENANT.currency,
  weekStart: "monday",
  notifications: {
    leaveApprovals: true,
    payrollAlerts: true,
    complianceReminders: true,
    weeklyDigest: true,
    securityAlerts: true,
    productUpdates: false,
  },
};

/** Tenant brand accents — product branding, not the chart palette. */
export const BRAND_ACCENTS = [
  { id: "indigo", label: "Indigo", hex: "#4f46e5" },
  { id: "slate", label: "Graphite", hex: "#3f3f52" },
  { id: "teal", label: "Teal", hex: "#0f766e" },
  { id: "plum", label: "Plum", hex: "#7c3a68" },
  { id: "ember", label: "Ember", hex: "#b4451f" },
] as const;

export const COUNTRY_OPTIONS = [
  { value: "IN", label: "India" },
  { value: "US", label: "United States" },
  { value: "AE", label: "United Arab Emirates" },
  { value: "GB", label: "United Kingdom" },
  { value: "SG", label: "Singapore" },
];

export const TIMEZONE_OPTIONS = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata · IST (UTC+05:30)" },
  { value: "America/New_York", label: "America/New_York · ET (UTC−04:00)" },
  { value: "Asia/Dubai", label: "Asia/Dubai · GST (UTC+04:00)" },
  { value: "Europe/London", label: "Europe/London · BST (UTC+01:00)" },
  { value: "Asia/Singapore", label: "Asia/Singapore · SGT (UTC+08:00)" },
];

export const LOCALE_OPTIONS = [
  { value: "en-IN", label: "English (India)" },
  { value: "en-US", label: "English (United States)" },
  { value: "en-GB", label: "English (United Kingdom)" },
  { value: "hi-IN", label: "हिन्दी (भारत)" },
];

export const DATE_FORMAT_OPTIONS = [
  { value: "dd MMM yyyy", label: "dd MMM yyyy · 16 Sep 2026" },
  { value: "dd/MM/yyyy", label: "dd/MM/yyyy · 16/09/2026" },
  { value: "MM/dd/yyyy", label: "MM/dd/yyyy · 09/16/2026" },
  { value: "yyyy-MM-dd", label: "yyyy-MM-dd · 2026-09-16" },
];

export const CURRENCY_OPTIONS = [
  { value: "INR", label: "INR · Indian Rupee (₹)" },
  { value: "USD", label: "USD · US Dollar ($)" },
  { value: "AED", label: "AED · UAE Dirham" },
  { value: "GBP", label: "GBP · Pound Sterling (£)" },
];

export const BRANCH_OPTIONS = BRANCHES.map((b) => ({ value: b.id, label: `${b.name} · ${b.countryName}` }));

/* ------------------------------------------------- audit for a given user */

export function auditForActor(code: string, limit = 8) {
  return AUDIT_LOG.filter((e) => e.actorCode === code).slice(0, limit);
}
