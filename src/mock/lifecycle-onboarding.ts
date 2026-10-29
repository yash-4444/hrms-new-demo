import { addDays, differenceInDays, format, parseISO } from "date-fns";
import { EMPLOYEES, employeeByCode } from "./employees";
import { DEMO_TODAY } from "./org";
import { OFFERS, requisitionByCode } from "./hiring";

/* ============================================================================
   Onboarding — checklist templates and the live instances generated from
   them. Task due dates are the joining date plus the template offset, and a
   task's status is derived from DEMO_TODAY, so "overdue" is never hand-typed.
   ========================================================================== */

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const TODAY = parseISO(DEMO_TODAY);

export type TaskOwner = "HR" | "IT" | "Manager" | "Finance" | "Employee";
export const TASK_OWNERS: TaskOwner[] = ["HR", "IT", "Manager", "Finance", "Employee"];
export type TaskPhase = "Pre-joining" | "Day 1" | "Week 1" | "Month 1";

export interface TemplateTask {
  key: string;
  title: string;
  owner: TaskOwner;
  /** Days relative to the joining date — negative is before Day 1. */
  offset: number;
  slaHours: number;
}

export const offsetLabel = (o: number) => (o === 0 ? "D0" : o > 0 ? `D+${o}` : `D${o}`);
export const phaseOf = (o: number): TaskPhase => (o < 0 ? "Pre-joining" : o === 0 ? "Day 1" : o <= 7 ? "Week 1" : "Month 1");

const t = (key: string, title: string, owner: TaskOwner, offset: number, slaHours = 24): TemplateTask => ({ key, title, owner, offset, slaHours });

const CORE: TemplateTask[] = [
  t("docs", "Collect signed offer, ID and address proofs", "HR", -10, 48),
  t("bgv", "Initiate background verification", "HR", -9, 48),
  t("prejoin", "Complete the pre-joining portal", "Employee", -5, 72),
  t("buddy", "Assign an onboarding buddy", "Manager", -4),
  t("laptop", "Allocate and image laptop", "IT", -3),
  t("email", "Create email, SSO and Slack accounts", "IT", -2, 8),
  t("idcard", "Print ID and access card", "HR", -1),
  t("welcome", "Day-1 welcome and induction session", "HR", 0, 4),
  t("policies", "Acknowledge POSH, IT and code-of-conduct policies", "Employee", 2),
  t("plan", "Share the 30-60-90 day plan", "Manager", 2),
  t("payroll", "Add to payroll and verify bank account", "Finance", 3),
  t("goals", "Set probation goals", "Manager", 14, 48),
];
const PF = t("pf", "Link UAN and file Form 11", "Finance", 5);

export interface ChecklistTemplate {
  id: string;
  name: string;
  appliesTo: string;
  departmentIds: string[];
  branchIds: string[];
  updatedOn: string;
  updatedBy: string;
  tasks: TemplateTask[];
}

export const TEMPLATES: ChecklistTemplate[] = [
  {
    id: "TPL-ENG-BLR", name: "Engineering – Bengaluru", appliesTo: "Engineering, Product and Design joiners at Bengaluru HQ",
    departmentIds: ["ENG", "PRD", "DES"], branchIds: ["BLR"], updatedOn: "2026-08-21", updatedBy: "Priya Menon",
    tasks: [...CORE, PF, t("repo", "Grant GitHub and cloud console access", "IT", -1), t("starter", "Assign a starter ticket", "Manager", 3), t("secure", "Secure-coding training", "Employee", 7, 72)],
  },
  {
    id: "TPL-ENG-PNQ", name: "Engineering – Pune", appliesTo: "Engineering and Product joiners at the Pune Delivery Centre",
    departmentIds: ["ENG", "PRD"], branchIds: ["PNQ"], updatedOn: "2026-07-30", updatedBy: "Priya Menon",
    tasks: [...CORE, PF, t("repo", "Grant GitHub and cloud console access", "IT", -1), t("starter", "Assign a starter ticket", "Manager", 3)],
  },
  {
    id: "TPL-SAL-PNQ", name: "Sales – Pune", appliesTo: "Sales and Customer Success joiners in Pune",
    departmentIds: ["SAL", "CSM"], branchIds: ["PNQ"], updatedOn: "2026-06-12", updatedBy: "Ishita Kulkarni",
    tasks: [...CORE, PF, t("crm", "Salesforce licence and territory mapping", "IT", 1), t("shadow", "Shadow five customer calls", "Manager", 10, 72), t("cert", "Complete product certification", "Employee", 14, 72)],
  },
  {
    id: "TPL-GTM-BLR", name: "Sales & GTM – Bengaluru", appliesTo: "Sales, Marketing and Customer Success at Bengaluru HQ",
    departmentIds: ["SAL", "MKT", "CSM"], branchIds: ["BLR"], updatedOn: "2026-08-02", updatedBy: "Ishita Kulkarni",
    tasks: [...CORE, PF, t("crm", "Salesforce licence and territory mapping", "IT", 1), t("cert", "Complete product certification", "Employee", 14, 72)],
  },
  {
    id: "TPL-US-EWR", name: "US – Newark", appliesTo: "Every joiner at the Newark, NJ office",
    departmentIds: ["ENG", "PRD", "DES", "SAL", "MKT", "CSM"], branchIds: ["EWR"], updatedOn: "2026-05-19", updatedBy: "Priya Menon",
    tasks: [
      ...CORE.filter((x) => x.key !== "bgv"),
      t("bgv", "Run background check (FCRA consent)", "HR", -9, 48),
      t("w4", "Submit W-4 and NJ-W4 withholding", "Employee", 0, 8),
      t("i9", "Complete I-9 Section 2 and E-Verify", "HR", 3, 24),
      t("benefits", "Enrol in medical, dental and 401(k)", "HR", 30, 72),
    ],
  },
  {
    id: "TPL-CORP-IN", name: "Corporate functions – India", appliesTo: "Finance, HR and IT & Operations joiners in India",
    departmentIds: ["FIN", "HR", "ITO"], branchIds: ["BLR", "PNQ"], updatedOn: "2026-04-08", updatedBy: "Priya Menon",
    tasks: [...CORE, PF, t("erp", "Provision ERP / HRIS role", "IT", 1)],
  },
];

export const templateFor = (dept: string, branch: string) =>
  TEMPLATES.find((x) => x.departmentIds.includes(dept) && x.branchIds.includes(branch)) ?? TEMPLATES[5];

/* --------------------------------------------------------------- instances */

export type TaskStatus = "done" | "pending" | "overdue";

export interface OnboardingTask extends TemplateTask {
  due: string;
  status: TaskStatus;
  assigneeCode: string;
  completedOn: string | null;
  /** Set once the task has breached its SLA by more than a day. */
  escalatedTo: string | null;
}

export interface OnboardingInstance {
  id: string;
  joinerName: string;
  candidateId: string | null;
  employeeCode: string | null;
  role: string;
  departmentId: string;
  branchId: string;
  gradeId: string;
  joiningDate: string;
  managerCode: string;
  buddyCode: string | null;
  templateId: string;
  tasks: OnboardingTask[];
}

const OWNER_ASSIGNEE: Record<Exclude<TaskOwner, "Manager" | "Employee">, string> = {
  HR: "STL-0305", // Ishita Kulkarni — HR operations
  IT: "STL-0314", // Divya Verma — IT support
  Finance: "STL-0017", // Rahul Desai — payroll
};

/** First escalation level once a task is more than a day past its SLA. */
const ESCALATE_TO: Record<TaskOwner, string | null> = {
  HR: "STL-0009", // Priya Menon — HR head
  IT: "STL-0010", // Girish Gowda — IT & asset admin
  Finance: "STL-0008", // Lakshmi Pillai — finance controller
  Manager: null, // the manager's own manager
  Employee: "STL-0009",
};

interface Seed {
  name: string;
  candidateId?: string;
  employeeCode?: string;
  role: string;
  dept: string;
  branch: string;
  grade: string;
  joining: string;
  manager: string;
  buddy: string | null;
  /** Tasks still open past their due date — the demo's escalations. */
  stuck?: string[];
  /** Tasks already finished ahead of their due date. */
  early?: string[];
}

const fromOffer = (name: string, extra: Partial<Seed>): Seed => {
  const o = OFFERS.find((x) => x.candidateName === name)!;
  const req = requisitionByCode(o.reqCode)!;
  return { name, candidateId: o.candidateId, role: o.role, dept: o.departmentId, branch: o.branchId, grade: o.gradeId, joining: o.joiningDate, manager: req.hiringManagerCode, buddy: null, ...extra };
};

const fromEmployee = (code: string, extra: Partial<Seed>): Seed => {
  const e = employeeByCode(code)!;
  return { name: e.name, employeeCode: code, role: e.designation, dept: e.departmentId, branch: e.branchId, grade: e.gradeId, joining: e.joiningDate, manager: e.managerCode ?? "STL-0009", buddy: null, ...extra };
};

const SEEDS: Seed[] = [
  fromOffer("Ishita Joshi", { buddy: "STL-0067", stuck: ["laptop", "bgv"], early: ["buddy"] }),
  fromOffer("Tarun Bhat", { buddy: "STL-0142", stuck: ["prejoin"], early: ["buddy"] }),
  fromOffer("Sandeep Rathi", { buddy: null, stuck: ["docs"] }),
  fromOffer("Nikhil Bansal", { buddy: "STL-0142", early: ["buddy", "docs"] }),
  fromOffer("Karthik Menon", { buddy: null }),
  fromOffer("Aishwarya Menon", { buddy: "STL-0152", stuck: ["payroll"] }),
  fromEmployee("STL-0044", { buddy: "STL-0028", stuck: ["pf"] }),
  fromEmployee("STL-0172", { buddy: "STL-0165", stuck: ["i9"] }),
  fromEmployee("STL-0180", { buddy: "STL-0182" }),
];

function buildTasks(s: Seed, tpl: ChecklistTemplate): OnboardingTask[] {
  return tpl.tasks.map((task) => {
    const dueDate = addDays(parseISO(s.joining), task.offset);
    const due = iso(dueDate);
    const past = differenceInDays(TODAY, dueDate) > 0;
    const stuck = s.stuck?.includes(task.key) ?? false;
    const early = s.early?.includes(task.key) ?? false;
    const done = (past && !stuck) || early;
    const status: TaskStatus = done ? "done" : past ? "overdue" : "pending";
    const assigneeCode =
      task.owner === "Manager" ? s.manager : task.owner === "Employee" ? (s.employeeCode ?? "") : OWNER_ASSIGNEE[task.owner];
    const daysLate = differenceInDays(TODAY, dueDate);
    const escalatedTo =
      status === "overdue" && daysLate > 1
        ? (employeeByCode(ESCALATE_TO[task.owner] ?? employeeByCode(assigneeCode)?.managerCode ?? "STL-0009")?.name ?? "Priya Menon")
        : null;
    return {
      ...task,
      due,
      status,
      assigneeCode,
      completedOn: done ? (early && dueDate > TODAY ? iso(addDays(TODAY, -1)) : due) : null,
      escalatedTo,
    };
  });
}

export const ONBOARDING: OnboardingInstance[] = [...SEEDS]
  .sort((a, b) => a.joining.localeCompare(b.joining))
  .map((s, i) => {
  const tpl = templateFor(s.dept, s.branch);
  return {
    id: `ONB-2026-${String(i + 31).padStart(3, "0")}`,
    joinerName: s.name,
    candidateId: s.candidateId ?? null,
    employeeCode: s.employeeCode ?? null,
    role: s.role,
    departmentId: s.dept,
    branchId: s.branch,
    gradeId: s.grade,
    joiningDate: s.joining,
    managerCode: s.manager,
    buddyCode: s.buddy,
    templateId: tpl.id,
    tasks: buildTasks(s, tpl),
  };
});

export const READINESS_KEYS = [
  { key: "laptop", label: "Laptop allocated" },
  { key: "email", label: "Email created" },
  { key: "idcard", label: "ID card" },
  { key: "buddy", label: "Buddy assigned" },
] as const;

export const instanceProgress = (i: OnboardingInstance) =>
  Math.round((i.tasks.filter((x) => x.status === "done").length / i.tasks.length) * 100);

export const assigneeName = (code: string, fallback: string) => employeeByCode(code)?.name ?? fallback;

/** Everyone who could plausibly own a task, for the Assign dialog. */
export const ASSIGNEE_OPTIONS = ["STL-0305", "STL-0009", "STL-0306", "STL-0010", "STL-0314", "STL-0017", "STL-0008"].map((c) => ({
  value: c,
  label: `${employeeByCode(c)!.name} · ${employeeByCode(c)!.designation}`,
}));

export const BUDDY_POOL = EMPLOYEES.filter((e) => e.status === "active" && e.level >= 2).slice(0, 60);
