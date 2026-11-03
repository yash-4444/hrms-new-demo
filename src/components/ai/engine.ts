/* ============================================================================
   Copilot intent engine — deterministic, scripted, permission-aware.

   A question is matched against an ordered list of intents (keyword / regex).
   Each handler reads ONLY the fixtures the asking persona is allowed to see,
   computes the answer from them, and returns text plus structured blocks
   (tables, charts, citations, proposed actions). Nothing here invents a
   number: when the data isn't there, the reply says so.
   ========================================================================== */

import { addDays, differenceInCalendarDays, format, getDay, parseISO } from "date-fns";
import { inr, num, pct } from "@/lib/format";
import { mulberry32, randInt, sum } from "@/lib/utils";
import type { Action, MenuKey, Persona, RoleId } from "@/lib/rbac";
import { BRANCHES, DEMO_TODAY, DEPARTMENTS, HOLIDAYS, deptName } from "@/mock/org";
import {
  EMPLOYEES,
  descendantsOf,
  employeeByCode,
  employeeName,
  managerChain,
  type Employee,
} from "@/mock/employees";
import {
  LEAVE_APPLICATIONS,
  LEAVE_TYPE_BY_CODE,
  applicationDays,
  applicationsFor,
  balanceFor,
  balancesFor,
  countryOf,
  excludedDays,
  type LeaveTypeCode,
} from "@/mock/leave";
import { EXCEPTIONS, EXCEPTION_META, PAY_RUNS, payslipFor, payslipsFor, type PayComponent } from "@/mock/payroll";
import { TEAM_DAY_BOARD, attendanceFor, monthSummary } from "@/mock/attendance";
import {
  SLA_HOURS,
  TICKETS,
  assetsFor,
  claimsFor,
  claimsToApprove,
  isTicketOpen,
  ticketsFor,
  type TicketCategory,
  type TicketPriority,
} from "@/mock/workplace";
import { CANDIDATES, OFFERS, REQUISITIONS, requisitionByCode, stageLabel } from "@/mock/hiring";
import { ATTRITION, HEADCOUNT_12M } from "@/mock/insights";
import { APPROVAL_TYPE_META, approvalsFor } from "@/mock/self-service";
import { ATTRITION_RISK, kbConfidence, searchKnowledge, type AttritionRiskRow } from "@/mock/ai";

const TODAY = parseISO(DEMO_TODAY);

/* ----------------------------------------------------------------- types */

export interface CopilotContext {
  role: RoleId;
  persona: Persona;
  can: (key: MenuKey, action?: Action) => boolean;
}

export type ValueFormat = "num" | "inr" | "pct";

export type ReplyBlock =
  | {
      kind: "table";
      title?: string;
      columns: string[];
      rows: (string | number)[][];
      /** Indexes of right-aligned numeric columns. */
      numeric?: number[];
    }
  | {
      kind: "chart";
      type: "line" | "bar";
      title: string;
      description?: string;
      data: Record<string, string | number>[];
      xKey: string;
      series: { key: string; label: string }[];
      format: ValueFormat;
    }
  | { kind: "citations"; confidence: number; items: { docId: string; docTitle: string; section: string; page: number; quote: string }[] }
  | { kind: "action"; action: ProposedAction }
  | { kind: "links"; items: { label: string; href: string; menuKey: MenuKey }[] }
  | { kind: "explain"; title: string; rows: AttritionRiskRow[] };

export interface ProposedAction {
  id: string;
  title: string;
  description?: string;
  fields: { label: string; value: string }[];
  warnings?: string[];
  confirmLabel: string;
  successMessage: string;
  successDescription?: string;
  /** When set, Confirm is disabled and this reason is shown. */
  blocked?: string;
}

export type IntentId =
  | "greeting"
  | "thanks"
  | "capabilities"
  | "salary_refusal"
  | "apply_leave"
  | "leave_balance"
  | "holidays"
  | "payslip_explain"
  | "regularise"
  | "attendance_summary"
  | "raise_ticket"
  | "ticket_status"
  | "expense_status"
  | "team_on_leave"
  | "pending_approvals"
  | "attrition_risk"
  | "headcount"
  | "payroll_exceptions"
  | "payroll_cost"
  | "draft"
  | "shortlist"
  | "onboarding"
  | "open_positions"
  | "my_assets"
  | "my_manager"
  | "policy"
  | "fallback";

export interface CopilotReply {
  intent: IntentId;
  text: string;
  blocks: ReplyBlock[];
  /** Tools / sources the answer used — shown as "Used: …". */
  tools: string[];
  /** Approved report the numbers come from, when any. */
  basedOn?: string;
  refusal?: boolean;
  fallback?: boolean;
  /** Follow-up prompts offered under the answer. */
  followUps?: string[];
}

/* ------------------------------------------------------------ catalog */

export interface IntentInfo {
  id: IntentId;
  label: string;
  example: string;
  module: string;
  /** Returns true when the persona can use this capability. */
  available: (ctx: CopilotContext) => boolean;
}

const always = () => true;

/** Every capability the copilot has, used by "what can you do?" and the docs panel. */
export const INTENT_CATALOG: IntentInfo[] = [
  { id: "leave_balance", label: "Check leave balances", example: "What's my leave balance?", module: "Leave", available: always },
  { id: "apply_leave", label: "Apply for leave (with confirmation)", example: "Apply casual leave next Friday", module: "Leave", available: (c) => c.can("my.leave", "C") },
  { id: "holidays", label: "Upcoming holidays", example: "When is the next holiday?", module: "Leave", available: always },
  { id: "payslip_explain", label: "Explain my payslip", example: "Why is my net pay lower this month?", module: "Payroll", available: (c) => c.can("my.payslips", "V") },
  { id: "attendance_summary", label: "Attendance summary", example: "How is my attendance this month?", module: "Time", available: (c) => c.can("my.attendance", "V") },
  { id: "regularise", label: "Regularise a missed punch", example: "Regularise my missed punch", module: "Time", available: (c) => c.can("my.attendance", "C") },
  { id: "policy", label: "Policy questions with citations", example: "How many WFH days am I allowed?", module: "Knowledge", available: (c) => c.can("ai.knowledge", "V") },
  { id: "raise_ticket", label: "Raise a helpdesk ticket", example: "Raise a ticket: VPN keeps disconnecting", module: "Helpdesk", available: always },
  { id: "ticket_status", label: "My ticket status", example: "Status of my tickets", module: "Helpdesk", available: always },
  { id: "expense_status", label: "Track an expense claim", example: "Where is my expense claim stuck?", module: "Expenses", available: (c) => c.can("my.expenses", "V") },
  { id: "my_assets", label: "Assets assigned to me", example: "Which assets are assigned to me?", module: "Assets", available: (c) => c.can("my.assets", "V") },
  { id: "my_manager", label: "Reporting line", example: "Who is my manager?", module: "People", available: always },
  { id: "team_on_leave", label: "Who is on leave today", example: "Who in my team is on leave today?", module: "Team", available: (c) => scopeOf(c) !== "self" },
  { id: "pending_approvals", label: "Approvals summary + bulk-approve low-risk", example: "Summarise my pending approvals", module: "Approvals", available: (c) => c.can("team.approvals", "A") },
  { id: "attrition_risk", label: "Attrition risk with drivers", example: "Who in my team is at risk of leaving?", module: "AI Insights", available: (c) => c.can("ai.insights", "V") && scopeOf(c) !== "self" },
  { id: "headcount", label: "Headcount & attrition", example: "What's our headcount and attrition?", module: "Analytics", available: (c) => c.can("analytics", "V") },
  { id: "payroll_exceptions", label: "Payroll exceptions summary", example: "Summarise payroll exceptions", module: "Payroll", available: (c) => c.can("payroll.runs", "V") },
  { id: "payroll_cost", label: "Pay run cost", example: "What's the September payroll cost?", module: "Payroll", available: (c) => c.can("payroll.runs", "V") },
  { id: "draft", label: "Draft letters, JDs and emails", example: "Draft an offer letter", module: "Drafting", available: (c) => c.can("ai.studio", "C") },
  { id: "shortlist", label: "Candidate shortlist summary", example: "Summarise the candidate shortlist", module: "Hiring", available: (c) => c.can("hiring.candidates", "V") },
  { id: "open_positions", label: "Open positions", example: "How many open positions do we have?", module: "Hiring", available: (c) => c.can("hiring.requisitions", "V") },
  { id: "onboarding", label: "New-joiner onboarding status", example: "Onboarding status of new joiners", module: "Onboarding", available: (c) => c.can("lifecycle.onboarding", "V") },
];

/* Partial: the platform operator has no tenant copilot of its own. */
const SUGGESTED: Partial<Record<RoleId, string[]>> = {
  employee: ["What's my leave balance?", "Apply casual leave next Friday", "Why is my net pay lower this month?", "When is the next holiday?", "Regularise my missed punch", "Where is my expense claim stuck?", "How many WFH days am I allowed?", "Which assets are assigned to me?"],
  manager: ["Summarise my pending approvals", "Approve all low-risk requests", "Who in my team is on leave today?", "Who in my team is at risk of leaving?", "Apply earned leave from 12 Oct to 14 Oct", "What is the notice period after confirmation?"],
  hr_admin: ["What's our headcount and attrition?", "Onboarding status of new joiners", "Who is at risk of leaving?", "What is the notice period after confirmation?", "Draft a welcome email", "Summarise my pending approvals"],
  payroll_admin: ["Summarise payroll exceptions", "What's the September payroll cost?", "Why is my net pay lower this month?", "When is gratuity payable?", "What's Karthik Reddy's salary?"],
  recruiter: ["Summarise the candidate shortlist", "Draft an offer letter", "Write a JD for Senior SRE", "How many open positions do we have?", "What's my leave balance?"],
  tenant_owner: ["What's our headcount and attrition?", "What's the September payroll cost?", "Summarise payroll exceptions", "Who is at risk of leaving?", "How many open positions do we have?"],
  finance_controller: ["Summarise payroll exceptions", "What's the September payroll cost?", "Where is my expense claim stuck?", "What is the hotel limit in Mumbai?", "Summarise my pending approvals"],
  department_head: ["What's my department headcount?", "Who in my department is at risk of leaving?", "Who in my team is on leave today?", "Summarise my pending approvals", "Approve all low-risk requests"],
  helpdesk_agent: ["Is there a sabbatical policy?", "What is the hotel limit in Mumbai?", "Draft an announcement", "Onboarding status of new joiners", "Raise a ticket: VPN keeps disconnecting"],
  it_admin: ["Which assets are assigned to me?", "Raise a ticket: laptop battery swelling", "What does the IT policy say about lost laptops?", "Status of my tickets"],
  auditor: ["What's our headcount and attrition?", "Summarise payroll exceptions", "What is the gifts policy?", "Approve all low-risk requests"],
};

/** Starter prompts for the persona — shown on an empty conversation. */
export function suggestedPrompts(role: RoleId): string[] {
  return SUGGESTED[role] ?? SUGGESTED.employee!;
}

/* --------------------------------------------------------------- scope */

export type Scope = "self" | "team" | "department" | "org";

/** The widest slice of people data this persona may see through the copilot. */
export function scopeOf(ctx: CopilotContext): Scope {
  switch (ctx.role) {
    case "hr_admin":
    case "tenant_owner":
    case "auditor":
      return "org";
    case "department_head":
      return "department";
    case "manager":
      return "team";
    default:
      return "self";
  }
}

function me(ctx: CopilotContext) {
  return ctx.persona.employeeId;
}

/** Employees inside the persona's scope (active only). */
export function scopedEmployees(ctx: CopilotContext): Employee[] {
  const s = scopeOf(ctx);
  const active = EMPLOYEES.filter((e) => e.status !== "exited");
  if (s === "org") return active;
  if (s === "department") {
    const dept = DEPARTMENTS.find((d) => d.name === ctx.persona.department)?.id ?? employeeByCode(me(ctx))?.departmentId;
    return active.filter((e) => e.departmentId === dept && e.code !== me(ctx));
  }
  if (s === "team") return descendantsOf(me(ctx)).filter((e) => e.status !== "exited");
  return active.filter((e) => e.code === me(ctx));
}

const SCOPE_LABEL: Record<Scope, string> = {
  self: "your own records",
  team: "your reporting line",
  department: "your department",
  org: "the whole organisation",
};

/* ------------------------------------------------------------ helpers */

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const iso = (d: Date) => format(d, "yyyy-MM-dd");
const nice = (s: string) => format(parseISO(s), "EEE, dd MMM yyyy");
const short = (s: string) => format(parseISO(s), "dd MMM");

function nextWorkingDay(from: Date, country: "IN" | "US") {
  let d = addDays(from, 1);
  for (let i = 0; i < 14; i++) {
    const s = iso(d);
    if (applicationDays("CL", s, s, false, false, country) > 0) return d;
    d = addDays(d, 1);
  }
  return d;
}

function dateFrom(day: number, monthToken: string): Date | null {
  const m = MONTHS.findIndex((x) => monthToken.startsWith(x));
  if (m < 0 || day < 1 || day > 31) return null;
  const year = m < TODAY.getMonth() ? TODAY.getFullYear() + 1 : TODAY.getFullYear();
  const d = new Date(year, m, day);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Parses the date phrases people actually type. Returns null when no date is present. */
export function parseDateRange(q: string, country: "IN" | "US"): { from: string; to: string } | null {
  const s = q.toLowerCase();
  const mon = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*";
  let m = s.match(new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s*${mon}\\s*(?:to|till|until|-|–)\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s*${mon}`));
  if (m) {
    const a = dateFrom(Number(m[1]), m[2]);
    const b = dateFrom(Number(m[3]), m[4]);
    if (a && b) return { from: iso(a), to: iso(b) };
  }
  m = s.match(new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:to|till|until|-|–)\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s*${mon}`));
  if (m) {
    const a = dateFrom(Number(m[1]), m[3]);
    const b = dateFrom(Number(m[2]), m[3]);
    if (a && b) return { from: iso(a), to: iso(b) };
  }
  let start: Date | null = null;
  m = s.match(new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s*${mon}`));
  if (m) start = dateFrom(Number(m[1]), m[2]);
  if (!start && /day after tomorrow/.test(s)) start = addDays(TODAY, 2);
  if (!start && /\btomorrow\b/.test(s)) start = addDays(TODAY, 1);
  if (!start && /\bnext week\b/.test(s)) {
    const toMon = (8 - getDay(TODAY)) % 7 || 7;
    const from = addDays(TODAY, toMon);
    return { from: iso(from), to: iso(addDays(from, 4)) };
  }
  if (!start) {
    const wd = WEEKDAYS.findIndex((w) => new RegExp(`\\b(next|this|on|coming)?\\s*${w}\\b`).test(s));
    if (wd >= 0) {
      let diff = (wd - getDay(TODAY) + 7) % 7;
      if (diff === 0) diff = 7;
      start = addDays(TODAY, diff);
    }
  }
  const n = s.match(/\bfor\s+(\d{1,2}|one|two|three|four|five)\s+(working\s+)?days?\b/);
  const count = n ? (["one", "two", "three", "four", "five"].indexOf(n[1]) + 1 || Number(n[1])) : 0;
  if (!start && !count) return null;
  const from = start ?? nextWorkingDay(TODAY, country);
  if (count > 1) {
    let to = from;
    let got = applicationDays("CL", iso(from), iso(from), false, false, country) > 0 ? 1 : 0;
    while (got < count) {
      to = addDays(to, 1);
      if (applicationDays("CL", iso(to), iso(to), false, false, country) > 0) got++;
    }
    return { from: iso(from), to: iso(to) };
  }
  return { from: iso(from), to: iso(from) };
}

function leaveTypeFrom(q: string): LeaveTypeCode {
  if (/\bsick|unwell|fever|\bill\b|doctor|medical/.test(q)) return "SL";
  if (/\bcasual|\bcl\b|personal/.test(q)) return "CL";
  if (/\bcomp|compensatory/.test(q)) return "CO";
  if (/\bpaternity/.test(q)) return "PL";
  if (/\bmaternity/.test(q)) return "ML";
  return "EL";
}

const FIRST_NAME_INDEX = (() => {
  const counts = new Map<string, number>();
  for (const e of EMPLOYEES) counts.set(e.firstName.toLowerCase(), (counts.get(e.firstName.toLowerCase()) ?? 0) + 1);
  return counts;
})();

/** Another employee named in the question — full name, or an unambiguous first name. */
export function mentionedEmployee(q: string, selfCode: string): Employee | null {
  const s = ` ${q.toLowerCase().replace(/[^a-z\s]/g, " ")} `;
  const full = EMPLOYEES.find((e) => e.code !== selfCode && s.includes(` ${e.name.toLowerCase()} `));
  if (full) return full;
  const first = EMPLOYEES.find((e) => {
    const f = e.firstName.toLowerCase();
    return e.code !== selfCode && f.length > 3 && FIRST_NAME_INDEX.get(f) === 1 && s.includes(` ${f} `);
  });
  return first ?? null;
}

const has = (q: string, re: RegExp) => re.test(q);

function link(label: string, href: string, menuKey: MenuKey) {
  return { label, href, menuKey };
}

function refusal(intent: IntentId, text: string, tools: string[] = ["Permission check"]): CopilotReply {
  return { intent, text, blocks: [], tools, refusal: true };
}

/* ======================================================== intent handlers */

type Handler = (q: string, ctx: CopilotContext, raw: string) => CopilotReply | null;

const hGreeting: Handler = (q, ctx) =>
  /^(hi|hello|hey|hii+|namaste|good (morning|afternoon|evening))\b/.test(q) && q.split(" ").length <= 4
    ? {
        intent: "greeting",
        text: `Hi ${ctx.persona.shortName} — I'm the Stellar HR Copilot. I can answer from ${SCOPE_LABEL[scopeOf(ctx)]} and take actions for you once you confirm them. What do you need?`,
        blocks: [],
        tools: [],
        followUps: suggestedPrompts(ctx.role).slice(0, 3),
      }
    : null;

const hThanks: Handler = (q) =>
  /^(thanks|thank you|thx|great|perfect|ok thanks|cool)\b/.test(q) && q.split(" ").length <= 4
    ? { intent: "thanks", text: "Happy to help. Anything else?", blocks: [], tools: [] }
    : null;

const hCapabilities: Handler = (q, ctx) => {
  if (!has(q, /what can you do|what do you do|how can you help|capabilit|help me with|what can i ask|^help$/)) return null;
  const mine = INTENT_CATALOG.filter((i) => i.available(ctx));
  const groups = new Map<string, IntentInfo[]>();
  for (const i of mine) groups.set(i.module, [...(groups.get(i.module) ?? []), i]);
  const lines = [...groups.entries()].map(([m, list]) => `- **${m}** — ${list.map((i) => i.label.toLowerCase()).join("; ")}`);
  return {
    intent: "capabilities",
    text: `As **${ctx.persona.role}** I can help you with ${mine.length} things, all limited to ${SCOPE_LABEL[scopeOf(ctx)]}:\n${lines.join("\n")}\nAnything that changes data is shown to you as a proposal first — nothing is created until you press Confirm.`,
    blocks: [],
    tools: ["Role permissions"],
    followUps: mine.slice(0, 4).map((i) => i.example),
  };
};

const hSalaryRefusal: Handler = (q, ctx) => {
  if (!has(q, /\b(salary|ctc|earn|earns|earning|package|compensation|paid|pay)\b/)) return null;
  const other = mentionedEmployee(q, me(ctx));
  const generic = has(q, /\b(colleague|colleagues|teammate|team mate|my manager'?s|everyone'?s|others'?)\b/);
  if (!other && !generic) return null;
  if (other && ctx.can("payroll.structures", "V")) {
    return {
      intent: "salary_refusal",
      text: `**${other.name}** (${other.code}) is on an annual CTC of **${inr(other.ctc)}** in grade ${other.gradeId}. You can see this because your role holds the Salary Structures grant; this lookup has been written to the AI audit log.`,
      blocks: [],
      tools: ["Employee master", "Permission check", "Audit log"],
    };
  }
  return refusal(
    "salary_refusal",
    `I can't share ${other ? `${other.name}'s` : "a colleague's"} salary. As **${ctx.persona.role}** your access covers ${SCOPE_LABEL[scopeOf(ctx)]}, and compensation for other employees is restricted to Payroll and the Tenant Owner. This question has been logged without the answer.\nIf you have a pay-equity concern, I can raise a confidential HR ticket for you.`,
  );
};

const hApplyLeave: Handler = (q, ctx) => {
  if (!has(q, /\b(apply|book|take|request|need|want|put in)\b.*\b(leave|day off|off|vacation|holiday)\b|\bleave\b.*\b(tomorrow|next|on \d|from \d)/)) return null;
  if (has(q, /\bwfh|work from home\b/)) return null;
  const code = me(ctx);
  if (!ctx.can("my.leave", "C")) return refusal("apply_leave", `Your role doesn't hold the Create grant on My Leave, so I can't prepare a leave application.`);
  const type = leaveTypeFrom(q);
  const country = countryOf(code);
  const range = parseDateRange(q, country) ?? (() => {
    const d = iso(nextWorkingDay(TODAY, country));
    return { from: d, to: d };
  })();
  const t = LEAVE_TYPE_BY_CODE[type];
  const days = applicationDays(type, range.from, range.to, false, false, country);
  const excluded = excludedDays(range.from, range.to, country);
  const bal = balanceFor(code, type);
  const approverCode = employeeByCode(code)?.managerCode ?? null;
  const approver = employeeName(approverCode) || "your reporting manager";
  const overlap = applicationsFor(code).filter(
    (a) => (a.status === "pending" || a.status === "approved") && a.fromDate <= range.to && a.toDate >= range.from,
  );
  const warnings: string[] = [];
  let blocked: string | undefined;
  if (days === 0) blocked = "Every day in this range is a weekend or holiday — nothing to deduct.";
  if (t.tracksBalance && bal && days > bal.available) blocked = `Only ${num(bal.available, 1)} day(s) of ${t.name} available — reduce the range or choose Loss of Pay.`;
  if (t.tracksBalance && !bal) blocked = `No ${t.name} balance is on record for you this financial year.`;
  if (overlap.length) blocked = `Overlaps ${overlap[0].typeName} ${short(overlap[0].fromDate)}–${short(overlap[0].toDate)} (${overlap[0].status}).`;
  if (t.requiresDocAboveDays !== null && days > t.requiresDocAboveDays)
    warnings.push(`A supporting document is required above ${t.requiresDocAboveDays} day(s) — attach it on the Leave screen after submitting.`);
  const lead = differenceInCalendarDays(parseISO(range.from), TODAY);
  if (type !== "SL" && lead < 3) warnings.push("Policy asks for 3 working days' notice (Leave Policy §7.2) — your manager may ask why.");
  if (range.from < DEMO_TODAY) warnings.push("This is a back-dated application.");

  const after = bal ? bal.available - days : null;
  return {
    intent: "apply_leave",
    text: `Here's the application I'll create. **${num(days, 1)} ${days === 1 ? "day" : "days"}** of ${t.name} will be deducted${excluded.length ? ` — ${excluded.map((x) => `${short(x.date)} (${x.reason.label})`).join(", ")} ${excluded.length === 1 ? "is" : "are"} excluded` : ""}. It goes to **${approver}** for approval.`,
    blocks: [
      {
        kind: "action",
        action: {
          id: `leave-${type}-${range.from}-${range.to}`,
          title: `Apply ${t.name}`,
          description: "Nothing is submitted until you confirm.",
          fields: [
            { label: "Leave type", value: `${t.name} (${type})` },
            { label: "Dates", value: range.from === range.to ? nice(range.from) : `${nice(range.from)} → ${nice(range.to)}` },
            { label: "Days deducted", value: `${num(days, 1)}${excluded.length ? ` (excludes ${excluded.length} non-working day${excluded.length > 1 ? "s" : ""})` : ""}` },
            ...(bal ? [{ label: "Balance", value: `${num(bal.available, 1)} → ${num(Math.max(0, after ?? 0), 1)} days` }] : []),
            { label: "Approver", value: approver },
          ],
          warnings,
          confirmLabel: "Submit application",
          successMessage: "Leave application submitted",
          successDescription: `${t.name} · ${short(range.from)}${range.to !== range.from ? `–${short(range.to)}` : ""} · ${num(days, 1)} day(s) · sent to ${approver}`,
          blocked,
        },
      },
      { kind: "links", items: [link("Open My Leave", "/leave", "my.leave")] },
    ],
    tools: ["Leave balance", "Holiday calendar", "Leave policy", "Leave application"],
  };
};

const hLeaveBalance: Handler = (q, ctx) => {
  if (!has(q, /\b(leave|leaves|el|cl|sl)\b.*\b(balance|left|remaining|available|how many|have)\b|\bleave balance\b|\bbalance\b.*\bleave/)) return null;
  const other = mentionedEmployee(q, me(ctx));
  let code = me(ctx);
  let whose = "Your";
  if (other) {
    const inScope = scopedEmployees(ctx).some((e) => e.code === other.code);
    if (!inScope)
      return refusal("leave_balance", `${other.name} is outside ${SCOPE_LABEL[scopeOf(ctx)]}, so I can't show their leave balance. Managers see their reporting line; HR sees everyone.`);
    code = other.code;
    whose = `${other.name}'s`;
  }
  const rows = balancesFor(code).filter((b) => LEAVE_TYPE_BY_CODE[b.typeCode]?.showOnCards);
  if (!rows.length)
    return { intent: "leave_balance", text: `I couldn't find a leave balance on record for ${whose === "Your" ? "you" : whose.replace("'s", "")} in FY 2026-27. HR may not have run the opening credit yet.`, blocks: [], tools: ["Leave balance"] };
  const el = rows.find((r) => r.typeCode === "EL");
  const total = sum(rows.filter((r) => r.typeCode !== "CO").map((r) => r.available));
  return {
    intent: "leave_balance",
    text: `${whose} leave balance as of ${nice(DEMO_TODAY)}: **${num(total, 1)} days** across ${rows.length} types.${el ? ` Earned Leave stands at **${num(el.available, 1)}**${el.pending ? `, with ${num(el.pending, 1)} more locked in a pending request` : ""}.` : ""}`,
    blocks: [
      {
        kind: "table",
        columns: ["Leave type", "Available", "Used", "Pending", "Annual quota"],
        rows: rows.map((r) => [LEAVE_TYPE_BY_CODE[r.typeCode].name, num(r.available, 1), num(r.used, 1), num(r.pending, 1), r.annualQuota ? num(r.annualQuota) : "—"]),
        numeric: [1, 2, 3, 4],
      },
      { kind: "links", items: [link("Open leave ledger", "/leave", "my.leave")] },
    ],
    tools: ["Leave balance", "Leave ledger"],
    followUps: ["Apply casual leave next Friday", "How many earned leaves carry forward?"],
  };
};

const hHolidays: Handler = (q, ctx) => {
  if (!has(q, /\bholidays?\b|\bday off for\b|\bdiwali|deepavali|dussehra|christmas\b/)) return null;
  const country = countryOf(me(ctx));
  const upcoming = HOLIDAYS.filter((h) => h.country === country && h.date >= DEMO_TODAY).slice(0, 6);
  if (!upcoming.length) return { intent: "holidays", text: "There are no more holidays on your calendar this year.", blocks: [], tools: ["Holiday calendar"] };
  const next = upcoming.find((h) => !h.optional) ?? upcoming[0];
  const inDays = differenceInCalendarDays(parseISO(next.date), TODAY);
  return {
    intent: "holidays",
    text: `The next holiday is **${next.name}** on **${nice(next.date)}** — ${inDays} days from today. ${upcoming.length} holidays remain on your ${country === "IN" ? "India" : "US"} calendar this year; optional ones count against your restricted-holiday allowance of 2.`,
    blocks: [
      {
        kind: "table",
        columns: ["Date", "Holiday", "Type"],
        rows: upcoming.map((h) => [nice(h.date), h.name, h.optional ? "Optional" : "Gazetted"]),
      },
      {
        kind: "citations",
        confidence: 97,
        items: [{ docId: "kb-holidays", docTitle: "Holiday Calendar 2026", section: "India calendar", page: 1, quote: "India branches observe 10 gazetted holidays in 2026 plus up to 2 optional holidays…" }],
      },
    ],
    tools: ["Holiday calendar"],
    followUps: ["Apply earned leave for 3 days from 9 Nov"],
  };
};

function componentDeltas(a: PayComponent[], b: PayComponent[]) {
  const map = new Map(b.map((c) => [c.code, c]));
  const codes = new Set([...a.map((c) => c.code), ...b.map((c) => c.code)]);
  return [...codes]
    .map((code) => {
      const cur = a.find((c) => c.code === code);
      const prev = map.get(code);
      return { label: cur?.label ?? prev?.label ?? code, now: cur?.amount ?? 0, before: prev?.amount ?? 0 };
    })
    .filter((d) => Math.round(d.now) !== Math.round(d.before));
}

const hPayslip: Handler = (q, ctx) => {
  if (
    !has(q, /(net pay|take.?home|in.?hand|salary|payslip|pay slip|my pay)\b.*\b(lower|less|reduced|drop|decrease|why|differ|change|explain|breakdown|higher|more)|why.*\b(pay|salary)\b|explain my (payslip|pay slip|salary)|show my payslip/)
  )
    return null;
  if (!ctx.can("my.payslips", "V")) return refusal("payslip_explain", "Your role has no access to payslips.");
  const code = me(ctx);
  const list = payslipsFor(code);
  if (list.length < 2)
    return {
      intent: "payslip_explain",
      text: list.length === 0
        ? "Your payslips aren't issued from the India payroll in this system (US employees are paid through the US payroll provider), so I can't compare them."
        : "There's only one payslip on record for you, so there's nothing to compare yet.",
      blocks: [],
      tools: ["Payslip"],
    };
  // Compare the latest slip with the previous one; if they match, explain the
  // most recent month that did change, so "why was it lower" still gets an answer.
  // Respect the direction the question asks about ("lower" → the last drop).
  const wantLower = /lower|less|reduc|drop|decreas|cut/.test(q);
  const wantHigher = /higher|more|increas|rise/.test(q);
  const changeAt = list.findIndex((p, i) => {
    if (i >= list.length - 1) return false;
    const d = Math.round(p.net) - Math.round(list[i + 1].net);
    return wantLower ? d < 0 : wantHigher ? d > 0 : d !== 0;
  });
  // A question that names a month ("…for August 2026…") explains that month
  // against the one before it, instead of the latest pair.
  const named = list.findIndex(
    (p, i) => i < list.length - 1 && (q.includes(p.label.toLowerCase()) || q.includes(p.shortLabel.toLowerCase())),
  );
  const unchanged = named < 0 && Math.round(list[0].net) === Math.round(list[1].net);
  const idx = named >= 0 ? named : unchanged && changeAt >= 0 ? changeAt : 0;
  const cur = payslipFor(list[idx].runId, code);
  const prev = payslipFor(list[idx + 1].runId, code);
  if (!cur || !prev) return { intent: "payslip_explain", text: "I couldn't load both payslips to compare.", blocks: [], tools: ["Payslip"] };
  const diff = cur.net - prev.net;
  const earn = componentDeltas(cur.earnings, prev.earnings);
  const ded = componentDeltas([...cur.statutory, ...cur.deductions], [...prev.statutory, ...prev.deductions]);
  const rows = [
    ...earn.map((d) => [d.label, "Earning", inr(d.before), inr(d.now), `${d.now - d.before >= 0 ? "+" : "−"}${inr(Math.abs(d.now - d.before))}`]),
    ...ded.map((d) => [d.label, "Deduction", inr(d.before), inr(d.now), `${d.now - d.before >= 0 ? "+" : "−"}${inr(Math.abs(d.now - d.before))}`]),
  ];
  const reasons: string[] = [];
  if (cur.lopDays > prev.lopDays) reasons.push(`**${num(cur.lopDays, 1)} Loss-of-Pay day(s)** in ${cur.periodLabel} (vs ${num(prev.lopDays, 1)} in ${prev.periodLabel}) pro-rated your earnings to ${num(cur.paidDays, 1)}/${cur.daysInMonth} days`);
  if (cur.lopDays < prev.lopDays) reasons.push(`fewer Loss-of-Pay days than ${prev.periodLabel} (${num(cur.lopDays, 1)} vs ${num(prev.lopDays, 1)})`);
  const earnDrop = [...earn].sort((x, y) => x.now - x.before - (y.now - y.before))[0];
  if (earnDrop && earnDrop.now < earnDrop.before) reasons.push(`**${earnDrop.label}** was ${inr(earnDrop.before - earnDrop.now)} lower`);
  const earnRise = [...earn].sort((x, y) => y.now - y.before - (x.now - x.before))[0];
  if (earnRise && earnRise.now > earnRise.before) reasons.push(`**${earnRise.label}** was ${inr(earnRise.now - earnRise.before)} higher`);
  const biggestDed = [...ded].sort((x, y) => y.now - y.before - (x.now - x.before))[0];
  if (biggestDed && biggestDed.now > biggestDed.before) reasons.push(`**${biggestDed.label}** went up by ${inr(biggestDed.now - biggestDed.before)}`);
  const why = reasons.length ? `\nWhat changed:\n${reasons.map((r) => `- ${r}`).join("\n")}` : "";
  const latest = list[0];
  const verdict = unchanged
    ? changeAt >= 0
      ? `Your net pay for **${latest.label}** is **${inr(latest.net)}** — the same as ${list[1].label}, so it isn't lower this month. The last time it ${wantLower ? "dropped" : wantHigher ? "rose" : "moved"} was **${cur.periodLabel}**, when it was ${inr(Math.abs(diff))} ${diff < 0 ? "lower" : "higher"} than ${prev.periodLabel} (${inr(cur.net)} vs ${inr(prev.net)}).${why}`
      : `Your net pay for **${latest.label}** is **${inr(latest.net)}** — unchanged across all ${list.length} payslips on record.`
    : Math.round(diff) === 0
      ? `Your net pay for **${cur.periodLabel}** is **${inr(cur.net)}** — the same as ${prev.periodLabel}.${why}`
      : `Your net pay for **${cur.periodLabel}** is **${inr(cur.net)}**, ${inr(Math.abs(diff))} ${diff < 0 ? "lower" : "higher"} than ${prev.periodLabel} (${inr(prev.net)}).${why}`;
  return {
    intent: "payslip_explain",
    text: verdict,
    blocks: rows.length
      ? [
          { kind: "table", title: `Component changes · ${prev.periodLabel} → ${cur.periodLabel}`, columns: ["Component", "Type", prev.periodLabel, cur.periodLabel, "Change"], rows, numeric: [2, 3, 4] },
          { kind: "links", items: [link("Open payslip with formula trace", "/payslips", "my.payslips")] },
        ]
      : [{ kind: "links", items: [link("Open payslips", "/payslips", "my.payslips")] }],
    tools: ["Payslip", "Pay run", "Attendance (LOP)"],
    followUps: cur.lopDays > 0 ? ["Regularise my missed punch", "How is my attendance this month?"] : ["When is gratuity payable?"],
  };
};

function missedPunchDay(code: string) {
  const days = attendanceFor(code).filter((d) => d.date < DEMO_TODAY).slice(-20).reverse();
  return (
    days.find((d) => d.punches.length > 0 && d.punches.some((p) => p.out === null) && !d.inProgress) ??
    days.find((d) => d.state === "absent") ??
    null
  );
}

const hRegularise: Handler = (q, ctx) => {
  if (!has(q, /regulari[sz]|missed (punch|swipe)|forgot to (punch|swipe|mark)|missing punch|punch.*(missed|forgot)/)) return null;
  const code = me(ctx);
  if (!ctx.can("my.attendance", "C")) return refusal("regularise", "Your role can't raise attendance regularisations.");
  const country = countryOf(code);
  const asked = parseDateRange(q, country);
  const day = asked ? attendanceFor(code).find((d) => d.date === asked.from) : missedPunchDay(code);
  if (!day)
    return {
      intent: "regularise",
      text: asked ? `I don't have an attendance record for ${nice(asked.from)} — it may be outside the 90-day attendance window.` : "Good news — I couldn't find a missed punch or unexplained absence in your last 20 working days.",
      blocks: [{ kind: "links", items: [link("Open My Attendance", "/attendance", "my.attendance")] }],
      tools: ["Attendance"],
    };
  const missingOut = day.punches.some((p) => p.out === null);
  const type = missingOut ? "Missed punch-out" : day.punches.length === 0 ? "Missed punch-in and punch-out" : "Correction";
  const approver = employeeName(employeeByCode(code)?.managerCode) || "your reporting manager";
  return {
    intent: "regularise",
    text: `On **${nice(day.date)}** your record shows ${missingOut ? `a punch-in at ${day.firstIn ? format(parseISO(day.firstIn), "hh:mm a") : "—"} with **no punch-out**` : `**${day.state === "absent" ? "absent" : day.state}** with no punches`}. I've prepared a regularisation — check the times before confirming.`,
    blocks: [
      {
        kind: "action",
        action: {
          id: `reg-${day.date}`,
          title: "Raise attendance regularisation",
          fields: [
            { label: "Date", value: nice(day.date) },
            { label: "Type", value: type },
            { label: "Punch-in", value: day.firstIn ? format(parseISO(day.firstIn), "hh:mm a") : "09:30 AM (proposed)" },
            { label: "Punch-out", value: "06:30 PM (proposed)" },
            { label: "Reason", value: "Forgot to punch — worked from office" },
            { label: "Approver", value: approver },
          ],
          warnings: day.state === "absent" ? ["Until approved, this day counts as Loss of Pay in the September run."] : undefined,
          confirmLabel: "Submit regularisation",
          successMessage: "Regularisation submitted",
          successDescription: `${short(day.date)} · ${type} · sent to ${approver}`,
        },
      },
    ],
    tools: ["Attendance", "Shift policy", "Amendments"],
  };
};

const hAttendance: Handler = (q, ctx) => {
  if (!has(q, /\battendance\b|\blate (marks|days|coming)\b|how many days.*(present|worked|late)|\bwork(ed)? hours\b|\bovertime\b.*\b(my|i)\b/)) return null;
  const code = me(ctx);
  if (!ctx.can("my.attendance", "V")) return refusal("attendance_summary", "Your role has no access to attendance.");
  const y = TODAY.getFullYear();
  const mth = TODAY.getMonth() + 1;
  const s = monthSummary(code, y, mth);
  const miss = missedPunchDay(code);
  return {
    intent: "attendance_summary",
    text: `For **${format(TODAY, "MMMM yyyy")}** so far: **${s.present} present**, ${s.half_day} half-day, ${s.absent} absent, ${s.leave} on leave, ${s.holiday} holiday. You were late on **${s.lateDays}** day(s) and logged **${num(Math.round(s.workedMinutes / 60))} hours** (${num(Math.round(s.overtimeMinutes / 60))} h overtime).${miss ? `\nOne thing to fix: **${nice(miss.date)}** has ${miss.punches.some((p) => p.out === null) ? "a missing punch-out" : "no punches"}.` : ""}`,
    blocks: [
      {
        kind: "table",
        columns: ["Present", "Half-day", "Absent", "Leave", "Late", "Worked hrs", "Payable days"],
        rows: [[s.present, s.half_day, s.absent, s.leave, s.lateDays, num(Math.round(s.workedMinutes / 60)), num(s.payableDays, 1)]],
        numeric: [0, 1, 2, 3, 4, 5, 6],
      },
      { kind: "links", items: [link("Open My Attendance", "/attendance", "my.attendance")] },
    ],
    tools: ["Attendance", "Shift policy"],
    followUps: miss ? ["Regularise my missed punch"] : [],
  };
};

const TICKET_RULES: [RegExp, TicketCategory][] = [
  [/laptop|vpn|wifi|wi-fi|email|outlook|software|password|printer|monitor|keyboard|mouse|battery|install|login/, "IT"],
  [/access|badge|id card|door|swipe card|permission/, "Access"],
  [/salary|payslip|tax|form 16|tds|reimburse|pf|uan/, "Payroll"],
  [/\bac\b|air condition|chair|desk|parking|cafeteria|canteen|washroom|cab|transport/, "Facilities"],
];

const hRaiseTicket: Handler = (q, ctx, raw) => {
  const explicit = has(q, /\b(raise|create|open|log|file|submit)\b.*\b(ticket|request|complaint|issue)\b|^ticket:/);
  const implicit = has(q, /\b(laptop|vpn|wifi|access|mouse|monitor|keyboard|printer|battery|badge|ac)\b.*\b(not working|broken|issue|problem|slow|swelling|disconnect|keeps|failing|stopped)/);
  if (!explicit && !implicit) return null;
  const category = TICKET_RULES.find(([re]) => re.test(q))?.[1] ?? "HR";
  const priority: TicketPriority = /urgent|asap|critical|immediately|swelling|data loss/.test(q) ? "High" : "Medium";
  const subject = raw.replace(/^(please\s+)?(raise|create|open|log|file|submit)\s+(a\s+)?(ticket|request|complaint|issue)\s*(:|for|about|that)?\s*/i, "").replace(/^ticket:\s*/i, "").trim() || raw;
  const deflect = searchKnowledge(q, 1)[0];
  const nextNo = `HD-2026-${String(400 + TICKETS.length * 3).padStart(4, "0")}`;
  const assigneeTeam = { IT: "IT Service Desk", Access: "IT Service Desk", Payroll: "Payroll Operations", Facilities: "Facilities", HR: "HR Operations" }[category];
  return {
    intent: "raise_ticket",
    text: `I'll raise this with **${assigneeTeam}** as a **${priority}** priority ${category} ticket — the SLA is ${SLA_HOURS[priority]} hours.${deflect && deflect.score >= 2 ? `\nBefore you do: **${deflect.doc.title} ${deflect.passage.section}** may already answer this — "${deflect.passage.text.slice(0, 140)}…"` : ""}`,
    blocks: [
      {
        kind: "action",
        action: {
          id: `ticket-${nextNo}`,
          title: "Raise helpdesk ticket",
          fields: [
            { label: "Ticket no.", value: `${nextNo} (on submit)` },
            { label: "Subject", value: subject.charAt(0).toUpperCase() + subject.slice(1) },
            { label: "Category", value: category },
            { label: "Priority", value: `${priority} · SLA ${SLA_HOURS[priority]} h` },
            { label: "Routed to", value: assigneeTeam },
            { label: "Requester", value: `${ctx.persona.name} · ${ctx.persona.branch}` },
          ],
          confirmLabel: "Raise ticket",
          successMessage: `Ticket ${nextNo} raised`,
          successDescription: `${category} · ${priority} · routed to ${assigneeTeam}`,
        },
      },
      ...(deflect && deflect.score >= 2
        ? [{ kind: "citations" as const, confidence: kbConfidence([deflect]), items: [{ docId: deflect.doc.id, docTitle: deflect.doc.title, section: deflect.passage.section, page: deflect.passage.page, quote: deflect.passage.text }] }]
        : []),
    ],
    tools: ["Helpdesk", "Knowledge base (deflection check)", "SLA policy"],
  };
};

const hTicketStatus: Handler = (q, ctx) => {
  if (!has(q, /\b(my|status of|track)\b.*\btickets?\b|\bticket status\b/)) return null;
  const mine = ticketsFor(me(ctx));
  const open = mine.filter(isTicketOpen);
  if (!mine.length) return { intent: "ticket_status", text: "You haven't raised any helpdesk tickets yet.", blocks: [], tools: ["Helpdesk"] };
  return {
    intent: "ticket_status",
    text: `You have **${open.length} open** ticket${open.length === 1 ? "" : "s"} out of ${mine.length} raised.${open[0] ? ` The oldest open one is **${open[open.length - 1].ticketNo}** — "${open[open.length - 1].subject}", with ${open[open.length - 1].assigneeName}.` : ""}`,
    blocks: [
      {
        kind: "table",
        columns: ["Ticket", "Subject", "Status", "Assignee", "SLA"],
        rows: mine.slice(0, 6).map((t) => [t.ticketNo, t.subject, t.status, t.assigneeName, t.slaState.replace("sla_", "").replace("_", " ")]),
      },
      { kind: "links", items: [link("Open Helpdesk", "/helpdesk", "workplace.helpdesk")] },
    ],
    tools: ["Helpdesk"],
  };
};

const hExpense: Handler = (q, ctx) => {
  if (!has(q, /\b(expense|expenses|claim|claims|reimburse|reimbursement)\b/) || !has(q, /\b(status|where|stuck|pending|when|track|update|approved|paid)\b/)) return null;
  if (!ctx.can("my.expenses", "V")) return refusal("expense_status", "Your role has no access to expenses.");
  const all = claimsFor(me(ctx));
  const claims = all.filter((c) => c.status !== "draft" && c.status !== "cancelled");
  const drafts = all.filter((c) => c.status === "draft");
  if (!claims.length && drafts.length)
    return {
      intent: "expense_status",
      text: `It isn't stuck in approval — claim **${drafts[0].claimNo}** (${drafts[0].purpose}, **${inr(drafts[0].total)}**) is still a **draft** and hasn't been submitted, so no approver can see it yet. Submit it from My Expenses to start the approval chain: your manager, then Finance, then reimbursement in the next payroll.`,
      blocks: [{ kind: "links", items: [link("Open My Expenses", "/expenses", "my.expenses")] }],
      tools: ["Expense claims", "Approval workflow"],
    };
  if (!claims.length) return { intent: "expense_status", text: "You don't have any submitted expense claims.", blocks: [{ kind: "links", items: [link("Open My Expenses", "/expenses", "my.expenses")] }], tools: ["Expense claims"] };
  const live = claims.find((c) => c.status === "submitted" || c.status === "approved") ?? claims[0];
  const waited = live.submittedOn ? differenceInCalendarDays(TODAY, parseISO(live.submittedOn)) : 0;
  const steps = [
    { step: "Submitted", who: live.employeeName, state: "Done", when: live.submittedOn ? short(live.submittedOn) : "—" },
    { step: "Manager approval", who: live.approverName, state: live.status === "submitted" ? `Waiting · ${waited} day(s)` : live.status === "rejected" ? "Rejected" : "Done", when: live.decidedOn ? short(live.decidedOn) : "—" },
    { step: "Finance verification", who: "Lakshmi Pillai (Finance)", state: live.status === "approved" ? "In progress" : live.status === "completed" ? "Done" : "Not started", when: "—" },
    { step: "Reimbursement", who: "Payroll", state: live.status === "completed" ? "Paid" : "Next payroll cycle", when: live.reimbursedOn ? short(live.reimbursedOn) : "30 Sep (pay date)" },
  ];
  const stuckAt = steps.find((s) => !["Done", "Paid"].includes(s.state));
  return {
    intent: "expense_status",
    text:
      live.status === "rejected"
        ? `Claim **${live.claimNo}** (${inr(live.total)}) was **rejected** by ${live.approverName}${live.decisionNote ? `: "${live.decisionNote}"` : ""}.`
        : `Claim **${live.claimNo}** — ${live.purpose}, **${inr(live.total)}** — is at **${stuckAt?.step ?? "Reimbursement"}**${stuckAt?.step === "Manager approval" ? ` with **${live.approverName}** for ${waited} day(s)` : ""}.${live.hasViolation ? ` ${live.violationCount} line(s) exceed policy limits, which usually adds a day to approval.` : ""}`,
    blocks: [
      { kind: "table", title: "Approval chain", columns: ["Step", "Owner", "Status", "Date"], rows: steps.map((s) => [s.step, s.who, s.state, s.when]) },
      { kind: "links", items: [link("Open My Expenses", "/expenses", "my.expenses")] },
    ],
    tools: ["Expense claims", "Approval workflow"],
    followUps: stuckAt?.step === "Manager approval" && waited > 3 ? [`Raise a ticket: expense claim ${live.claimNo} pending ${waited} days`] : [],
  };
};

const hTeamOnLeave: Handler = (q, ctx) => {
  if (!has(q, /\b(who|anyone|team|department)\b.*\b(on leave|out of office|ooo|off today|absent|away)\b/)) return null;
  const scope = scopeOf(ctx);
  if (scope === "self")
    return refusal("team_on_leave", "Team leave is visible to managers and HR. As an employee you can see your own leave, and the shared Leave Calendar shows team absences without leave types.", ["Permission check"]);
  const people = new Set(scopedEmployees(ctx).map((e) => e.code));
  const weekEnd = iso(addDays(TODAY, 7));
  const apps = LEAVE_APPLICATIONS.filter((a) => people.has(a.employeeCode) && a.status === "approved");
  // Today = the team attendance board (what /attendance/team shows) plus approved leave covering today.
  const board = TEAM_DAY_BOARD.filter((r) => people.has(r.code) && r.state === "leave");
  const todayApps = apps.filter((a) => a.fromDate <= DEMO_TODAY && a.toDate >= DEMO_TODAY);
  const todayRows = [
    ...todayApps.map((a) => [a.employeeName, a.typeName, short(a.fromDate), short(a.toDate), num(a.days, 1)]),
    ...board
      .filter((r) => !todayApps.some((a) => a.employeeCode === r.code))
      .map((r) => [r.name, attendanceFor(r.code).find((d) => d.date === DEMO_TODAY)?.leaveType ?? "On leave", short(DEMO_TODAY), short(DEMO_TODAY), "1.0"]),
  ];
  const soon = apps.filter((a) => a.fromDate > DEMO_TODAY && a.fromDate <= weekEnd);
  const rows = [...todayRows, ...soon.map((a) => [a.employeeName, a.typeName, short(a.fromDate), short(a.toDate), num(a.days, 1)])].slice(0, 10);
  const n = todayRows.length;
  return {
    intent: "team_on_leave",
    text: `${n ? `**${n}** ${n === 1 ? "person is" : "people are"} on leave today` : `Nobody in ${SCOPE_LABEL[scope]} is on leave today`}${soon.length ? `, and **${soon.length}** more ${soon.length === 1 ? "starts" : "start"} leave in the next 7 days` : ""}.${n ? ` ${todayRows.map((r) => r[0]).join(", ")}.` : ""}`,
    blocks: rows.length
      ? [
          { kind: "table", columns: ["Employee", "Leave", "From", "To", "Days"], rows, numeric: [4] },
          { kind: "links", items: [link("Open Leave Calendar", "/leave/calendar", "leave.calendar"), link("Open Team Attendance", "/attendance/team", "team.attendance")] },
        ]
      : [],
    tools: ["Team attendance", "Leave applications", "Org hierarchy"],
  };
};

interface ApprovalRow {
  id: string;
  kind: string;
  requester: string;
  summary: string;
  age: number;
  amount?: number;
  lowRisk: boolean;
  why: string;
}

/* The Copilot triages exactly what the persona's Approvals Inbox holds, so
   "approve the low-risk ones" agrees with /approvals and the top-bar badge. */
function approvalQueue(ctx: CopilotContext): ApprovalRow[] {
  return approvalsFor(ctx.role, ctx.persona.employeeId, ctx.persona.name)
    .map((a) => ({
      id: a.id,
      kind: APPROVAL_TYPE_META[a.type].label,
      requester: a.requesterName,
      summary: a.summary,
      age: Math.floor(a.ageHours / 24),
      amount: a.amount ?? undefined,
      lowRisk: a.lowRisk,
      why: a.riskReasons[0] ?? (a.lowRisk ? "Within policy" : "Needs your judgement"),
    }))
    .sort((a, b) => b.age - a.age);
}

const hApprovals: Handler = (q, ctx) => {
  if (!has(q, /\bapprovals?\b|\bapprove all\b|\blow.?risk\b|\bpending (requests|items)\b|awaiting my/)) return null;
  if (!ctx.can("team.approvals", "A"))
    return refusal(
      "pending_approvals",
      ctx.can("team.approvals", "V")
        ? `As **${ctx.persona.role}** you can view approval queues but not act on them — I can't approve anything for you.`
        : "You don't have any approval responsibilities, so there's nothing for me to summarise.",
    );
  const queue = approvalQueue(ctx);
  if (!queue.length) return { intent: "pending_approvals", text: "Your approval queue is empty — nothing is waiting on you.", blocks: [], tools: ["Approvals inbox"] };
  const low = queue.filter((r) => r.lowRisk);
  const byKind = new Map<string, number>();
  for (const r of queue) byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1);
  const oldest = [...queue].sort((a, b) => b.age - a.age)[0];
  return {
    intent: "pending_approvals",
    text: `${has(q, /approve all|low.?risk/) ? (low.length ? `I found **${low.length} low-risk** request${low.length === 1 ? "" : "s"} I can approve for you once you confirm. ` : "None of your pending requests qualify as low-risk, so I won't bulk-approve anything. ") : ""}You have **${queue.length} pending approvals** — ${[...byKind.entries()].map(([k, n]) => `${n} ${k.toLowerCase()}`).join(", ")}. The oldest is ${oldest.requester}'s ${oldest.kind.toLowerCase()} (${oldest.age} day${oldest.age === 1 ? "" : "s"}).${low.length && !has(q, /approve all|low.?risk/) ? `\n**${low.length}** look low-risk under your delegation rules; the rest need your judgement.` : ""}`,
    blocks: [
      { kind: "table", columns: ["Type", "Requester", "Request", "Age", "Assessment"], rows: queue.map((r) => [r.kind, r.requester, r.summary, `${r.age}d`, `${r.lowRisk ? "Low risk" : "Review"} — ${r.why}`]) },
      ...(low.length
        ? [
            {
              kind: "action" as const,
              action: {
                id: `approve-low-${low.map((l) => l.id).join("-")}`,
                title: `Approve ${low.length} low-risk request${low.length === 1 ? "" : "s"}`,
                description: "Each approval is recorded under your name with the note \"Approved via Copilot bulk action\".",
                fields: low.map((l) => ({ label: l.kind, value: `${l.requester} — ${l.summary}` })),
                warnings: queue.length > low.length ? [`${queue.length - low.length} other request(s) are left for you to review individually.`] : undefined,
                confirmLabel: `Approve ${low.length}`,
                successMessage: `${low.length} request${low.length === 1 ? "" : "s"} approved`,
                successDescription: low.map((l) => l.requester).join(", "),
              },
            },
          ]
        : []),
      { kind: "links", items: [link("Open Approvals Inbox", "/approvals", "team.approvals")] },
    ],
    tools: ["Approvals inbox", "Leave balance", "Expense policy", "Delegation rules"],
  };
};

const hAttrition: Handler = (q, ctx) => {
  if (!has(q, /\b(attrition|flight|retention)\b.*\brisk\b|\bat risk\b|who (might|may|could|is likely to) (leave|quit|resign)|risk of (leaving|attrition|quitting)/)) return null;
  const scope = scopeOf(ctx);
  if (scope === "self" || !ctx.can("ai.insights", "V"))
    return refusal("attrition_risk", "Attrition-risk scores are visible only to managers (for their own team), department heads and HR — and never used for automated decisions.", ["Permission check"]);
  const people = new Set(scopedEmployees(ctx).map((e) => e.code));
  const rows = ATTRITION_RISK.filter((r) => people.has(r.code));
  const high = rows.filter((r) => r.band === "High");
  const med = rows.filter((r) => r.band === "Medium");
  const top = rows.slice(0, scope === "team" ? 8 : 6);
  const driverCount = new Map<string, number>();
  for (const r of rows.filter((x) => x.band !== "Low")) for (const d of r.drivers) {
    const k = d.label.replace(/\d+/g, "N");
    driverCount.set(k, (driverCount.get(k) ?? 0) + 1);
  }
  const topDriver = [...driverCount.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    intent: "attrition_risk",
    text: `Across ${SCOPE_LABEL[scope]} (${rows.length} people): **${high.length} high** and **${med.length} medium** risk.${top[0] ? ` Highest is **${top[0].name}** at ${top[0].score} — ${top[0].drivers.map((d) => d.label.toLowerCase()).join(", ")}.` : ""}${topDriver ? `\nThe most common driver is "${topDriver[0].replace("N", "N")}" (${topDriver[1]} people).` : ""}\nThese are signals for a conversation, not decisions — every score is explainable.`,
    blocks: [{ kind: "explain", title: "Highest risk", rows: top }, { kind: "links", items: [link("Open AI Insights", "/ai/insights", "ai.insights")] }],
    tools: ["Attrition model", "Compensation history", "Leave patterns", "Performance ratings"],
  };
};

const hHeadcount: Handler = (q, ctx) => {
  if (!has(q, /\b(headcount|head count|attrition|turnover|how many (employees|people)|joiners|leavers|strength)\b/)) return null;
  if (!ctx.can("analytics", "V")) return refusal("headcount", "Organisation headcount and attrition come from the Analytics reports, which your role can't open.");
  const scope = scopeOf(ctx);
  if (scope === "department" || has(q, /my department/)) {
    const people = scopedEmployees(ctx);
    const dept = ctx.persona.department;
    const byBranch = new Map<string, number>();
    for (const e of people) {
      const city = BRANCHES.find((b) => b.id === e.branchId)?.city ?? e.branchId;
      byBranch.set(city, (byBranch.get(city) ?? 0) + 1);
    }
    const exited = EMPLOYEES.filter((e) => e.status === "exited" && e.departmentId === people[0]?.departmentId);
    return {
      intent: "headcount",
      text: `**${dept}** has **${people.length + 1}** people including you — ${[...byBranch.entries()].map(([b, n]) => `${n} in ${b}`).join(", ")}. ${exited.length} have exited in the last 12 months.`,
      blocks: [{ kind: "chart", type: "bar", title: `${dept} headcount by branch`, data: [...byBranch.entries()].map(([b, n]) => ({ branch: b, headcount: n })), xKey: "branch", series: [{ key: "headcount", label: "Headcount" }], format: "num" }],
      tools: ["Employee master"],
      basedOn: `Headcount & Movement · Department = ${dept} · as of ${short(DEMO_TODAY)}`,
    };
  }
  const last = HEADCOUNT_12M[HEADCOUNT_12M.length - 1];
  const first = HEADCOUNT_12M[0];
  const joiners = sum(HEADCOUNT_12M.map((p) => p.joiners));
  return {
    intent: "headcount",
    text: `Headcount is **${num(last.headcount)}** at the end of ${last.month}, up ${num(last.headcount - first.headcount)} over 12 months (${num(joiners)} joiners, ${num(ATTRITION.leavers12m)} leavers). Rolling 12-month attrition is **${pct(ATTRITION.rate)}**, ${ATTRITION.delta >= 0 ? "up" : "down"} ${pct(Math.abs(ATTRITION.delta))} on last year; ${pct(ATTRITION.voluntaryPct)} of exits were voluntary.`,
    blocks: [
      { kind: "chart", type: "line", title: "Headcount — last 12 months", data: HEADCOUNT_12M.map((p) => ({ month: p.month, headcount: p.headcount })), xKey: "month", series: [{ key: "headcount", label: "Headcount" }], format: "num" },
      { kind: "links", items: [link("Open full report", "/analytics", "analytics")] },
    ],
    tools: ["Headcount & Movement report", "Attrition Analysis report"],
    basedOn: "Headcount & Movement · Attrition Analysis · last 12 months · all branches",
    followUps: ["Who is at risk of leaving?"],
  };
};

const hPayrollExceptions: Handler = (q, ctx) => {
  if (!has(q, /\b(payroll|pay run|payrun)\b.*\b(exception|exceptions|issue|issues|error|errors|problem|blocker)|\bexceptions\b/)) return null;
  if (!ctx.can("payroll.runs", "V")) return refusal("payroll_exceptions", "Pay-run exceptions are visible to Payroll, Finance and the Tenant Owner only.");
  const run = PAY_RUNS[0];
  const byType = new Map<string, number>();
  for (const e of EXCEPTIONS) byType.set(e.type, (byType.get(e.type) ?? 0) + 1);
  const critical = EXCEPTIONS.filter((e) => e.severity === "critical");
  return {
    intent: "payroll_exceptions",
    text: `**${run.label}** (${run.status}) has **${EXCEPTIONS.length} exception${EXCEPTIONS.length === 1 ? "" : "s"}**${critical.length ? `, ${critical.length} critical` : ""}: ${[...byType.entries()].map(([t, n]) => `${n} × ${EXCEPTION_META[t as keyof typeof EXCEPTION_META]?.label ?? t}`).join(", ")}. The run can't be locked until they're cleared.`,
    blocks: [
      { kind: "table", columns: ["Employee", "Issue", "Amount", "Suggested resolution"], rows: EXCEPTIONS.map((e) => [e.employeeName, e.title, inr(e.amount), e.resolution]), numeric: [2] },
      { kind: "links", items: [link("Open pay run", "/payroll/runs", "payroll.runs")] },
    ],
    tools: ["Pay run", "Exceptions", "Bank verification"],
    basedOn: `Pay run ${run.code} · exception check`,
  };
};

const hPayrollCost: Handler = (q, ctx) => {
  if (!has(q, /\b(payroll cost|total payroll|salary bill|pay ?run (total|summary|status)|payroll (total|summary|status)|cost of payroll)\b|\b(september|this month'?s?) payroll\b/)) return null;
  if (!ctx.can("payroll.runs", "V")) return refusal("payroll_cost", "Payroll totals are visible to Payroll, Finance and the Tenant Owner only.");
  const [cur, prev] = PAY_RUNS;
  const d = prev ? cur.totals.costToCompany - prev.totals.costToCompany : 0;
  return {
    intent: "payroll_cost",
    text: `**${cur.label}** covers ${num(cur.employeeCount)} employees: gross **${inr(cur.totals.gross)}**, deductions ${inr(cur.totals.deductions)}, net payout **${inr(cur.totals.net)}**. Total cost to company is ${inr(cur.totals.costToCompany)}${prev ? ` — ${d >= 0 ? "up" : "down"} ${inr(Math.abs(d))} on ${prev.label}` : ""}. Status: **${cur.status}**.`,
    blocks: [
      {
        kind: "table",
        columns: ["", cur.label, ...(prev ? [prev.label] : [])],
        rows: [
          ["Employees", num(cur.employeeCount), ...(prev ? [num(prev.employeeCount)] : [])],
          ["Gross", inr(cur.totals.gross), ...(prev ? [inr(prev.totals.gross)] : [])],
          ["Deductions", inr(cur.totals.deductions), ...(prev ? [inr(prev.totals.deductions)] : [])],
          ["Net pay", inr(cur.totals.net), ...(prev ? [inr(prev.totals.net)] : [])],
          ["Employer cost", inr(cur.totals.employerCost), ...(prev ? [inr(prev.totals.employerCost)] : [])],
        ],
        numeric: [1, 2],
      },
      { kind: "links", items: [link("Open pay run", "/payroll/runs", "payroll.runs")] },
    ],
    tools: ["Pay run"],
    basedOn: `Payroll Register · ${cur.code}${prev ? ` vs ${prev.code}` : ""}`,
  };
};

const hDraft: Handler = (q, ctx) => {
  if (!has(q, /\b(draft|write|create|prepare|generate|compose)\b.*\b(offer letter|offer|jd|job description|letter|announcement|email|mail|review comment)\b/)) return null;
  if (!ctx.can("ai.studio", "C")) return refusal("draft", "The Drafting Studio is available to HR, recruiters, managers and HR operations. I can still answer questions about policies.");
  const map: [RegExp, string, string][] = [
    [/offer/, "offer", "Offer letter"],
    [/\bjd\b|job description/, "jd", "Job description"],
    [/appointment/, "appointment", "Appointment letter"],
    [/experience/, "experience", "Experience letter"],
    [/warning/, "warning", "Warning letter"],
    [/announcement/, "announcement", "Announcement"],
    [/review comment|review/, "review_comment", "Performance review comment"],
    [/reject/, "rejection", "Rejection email"],
    [/welcome/, "welcome", "Welcome email"],
  ];
  const hit = map.find(([re]) => re.test(q)) ?? [/./, "offer", "Offer letter"];
  return {
    intent: "draft",
    text: `I'll draft a **${hit[2]}** in the Drafting Studio — it pulls names, CTC and dates from the records you can see, highlights every placeholder, and keeps a version history. Drafts are never sent until you choose "Send for approval".`,
    blocks: [{ kind: "links", items: [link(`Open ${hit[2]} in Drafting Studio`, `/ai/studio?template=${hit[1]}`, "ai.studio")] }],
    tools: ["Drafting Studio", "Template library"],
  };
};

const hShortlist: Handler = (q, ctx) => {
  if (!has(q, /\b(shortlist|candidates?|pipeline)\b/) || !has(q, /\b(summar|top|best|status|shortlist|who)/)) return null;
  if (!ctx.can("hiring.candidates", "V")) return refusal("shortlist", "Candidate data is restricted to the hiring team.");
  const reqMatch = q.match(/req-?\s?(\d{4})-?(\d{3})/i);
  const counts = new Map<string, number>();
  for (const c of CANDIDATES) if (c.stage === "interview" || c.stage === "screening") counts.set(c.reqCode, (counts.get(c.reqCode) ?? 0) + 1);
  const reqCode = reqMatch ? `REQ-${reqMatch[1]}-${reqMatch[2]}` : [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const req = reqCode ? requisitionByCode(reqCode) : undefined;
  if (!req) return { intent: "shortlist", text: `I couldn't find requisition ${reqCode ?? ""}.`, blocks: [], tools: ["Candidates"] };
  const pool = CANDIDATES.filter((c) => c.reqCode === req.code && c.stage !== "rejected").sort((a, b) => b.rating - a.rating);
  const top = pool.slice(0, 5);
  const showCtc = ctx.can("hiring.offers", "V");
  return {
    intent: "shortlist",
    text: `**${req.code} · ${req.role}** (${deptName(req.departmentId)}) has ${pool.length} active candidates. Top ${top.length} by panel rating are below${top[0] ? `; **${top[0].name}** leads at ${top[0].rating.toFixed(1)}/5 with ${top[0].experienceYears} yrs from ${top[0].currentCompany}` : ""}. Budget is ${inr(req.budgetMinCtc)}–${inr(req.budgetMaxCtc)}.\nThis is a summary only — stage moves stay with the hiring panel.`,
    blocks: [
      {
        kind: "table",
        columns: ["Candidate", "Stage", "Rating", "Exp (yrs)", showCtc ? "Expected CTC" : "Expected CTC (redacted)", "Notice"],
        rows: top.map((c) => [c.name, stageLabel(c.stage), c.rating.toFixed(1), c.experienceYears, showCtc ? inr(c.expectedCtc) : "••••", `${c.noticePeriodDays}d`]),
        numeric: [2, 3, 4],
      },
      { kind: "links", items: [link("Open candidates", "/candidates", "hiring.candidates")] },
    ],
    tools: ["Candidates", "Interview scorecards", "Requisition"],
  };
};

const hOpenPositions: Handler = (q, ctx) => {
  if (!has(q, /\bopen (positions|roles|requisitions|reqs|jobs)\b|\bhiring status\b|\bhow many (positions|roles)\b/)) return null;
  if (!ctx.can("hiring.requisitions", "V")) return refusal("open_positions", "Requisitions are visible to the hiring team, HR and leadership.");
  const open = REQUISITIONS.filter((r) => r.status === "open");
  const positions = sum(open.map((r) => r.headcount - r.filled));
  const byDept = new Map<string, number>();
  for (const r of open) byDept.set(deptName(r.departmentId), (byDept.get(deptName(r.departmentId)) ?? 0) + r.headcount - r.filled);
  return {
    intent: "open_positions",
    text: `There are **${positions} open positions** across **${open.length} requisitions**. ${open.filter((r) => r.priority === "Critical").length} are marked Critical.`,
    blocks: [
      { kind: "chart", type: "bar", title: "Open positions by department", data: [...byDept.entries()].map(([d, n]) => ({ department: d, positions: n })), xKey: "department", series: [{ key: "positions", label: "Open positions" }], format: "num" },
      { kind: "links", items: [link("Open requisitions", "/requisitions", "hiring.requisitions")] },
    ],
    tools: ["Requisitions"],
    basedOn: "Requisition register · status = Open",
  };
};

const hOnboarding: Handler = (q, ctx) => {
  if (!has(q, /\bonboarding\b|\bnew (joiners?|hires?)\b|\bwho is joining\b|\bjoining (this|next) (week|month)\b/)) return null;
  if (!ctx.can("lifecycle.onboarding", "V")) return refusal("onboarding", "Onboarding status is visible to HR, HR operations and IT.");
  const recent = EMPLOYEES.filter((e) => e.joiningDate <= DEMO_TODAY && differenceInCalendarDays(TODAY, parseISO(e.joiningDate)) <= 45);
  const upcoming = OFFERS.filter((o) => (o.status === "hired" || o.status === "approved") && o.joiningDate > DEMO_TODAY).slice(0, 6);
  const rows = [
    ...upcoming.map((o) => {
      const r = mulberry32(o.id.length * 97 + o.candidateName.length);
      const done = randInt(r, 3, 8);
      return [o.candidateName, o.role, `Joins ${short(o.joiningDate)}`, `${done}/12 pre-joining`, done < 6 ? "Documents pending" : "On track"];
    }),
    ...recent.slice(0, 6).map((e) => {
      const r = mulberry32(Number(e.code.replace(/\D/g, "")));
      const done = randInt(r, 7, 12);
      return [e.name, e.designation, `Joined ${short(e.joiningDate)}`, `${done}/12 day-one`, done < 10 ? (done < 9 ? "IT asset pending" : "Induction pending") : "Complete"];
    }),
  ];
  const atRisk = rows.filter((r) => r[4] !== "On track" && r[4] !== "Complete").length;
  return {
    intent: "onboarding",
    text: `**${upcoming.length}** candidates are due to join and **${recent.length}** joined in the last 45 days. **${atRisk}** have an open blocker — mostly pending documents and IT asset handover.`,
    blocks: [
      { kind: "table", columns: ["Name", "Role", "Joining", "Checklist", "Status"], rows },
      { kind: "links", items: [link("Open Onboarding", "/onboarding", "lifecycle.onboarding")] },
    ],
    tools: ["Onboarding checklists", "Offers", "Asset register"],
  };
};

const hAssets: Handler = (q, ctx) => {
  if (!has(q, /\b(assets?|laptop|devices?|equipment|hardware)\b/) || !has(q, /\b(my|me|mine|assigned|allocated|have i|do i)\b/)) return null;
  if (!ctx.can("my.assets", "V")) return refusal("my_assets", "Your role has no access to the asset register.");
  const list = assetsFor(me(ctx));
  if (!list.length) return { intent: "my_assets", text: "No company assets are allocated to you in the register.", blocks: [], tools: ["Asset register"] };
  return {
    intent: "my_assets",
    text: `You have **${list.length} asset${list.length === 1 ? "" : "s"}** allocated: ${list.map((a) => `${a.make} ${a.model}`).join(", ")}.${list.some((a) => !a.inWarranty) ? " One or more is out of warranty — raise an IT ticket if it needs repair." : ""}`,
    blocks: [
      { kind: "table", columns: ["Tag", "Asset", "Category", "Allocated", "Warranty"], rows: list.map((a) => [a.tag, `${a.make} ${a.model}`, a.category, a.allocatedOn ? short(a.allocatedOn) : "—", a.inWarranty ? `Until ${short(a.warrantyExpiry)}` : "Expired"]) },
      { kind: "links", items: [link("Open My Assets", "/assets", "my.assets")] },
    ],
    tools: ["Asset register"],
  };
};

const hManager: Handler = (q, ctx) => {
  if (!has(q, /who is my (manager|reporting manager|boss|skip|lead)|reporting line|who do i report to/)) return null;
  const chain = managerChain(me(ctx)).map((c) => employeeByCode(c)).filter((e): e is Employee => !!e);
  if (!chain.length) return { intent: "my_manager", text: "You're at the top of the reporting line — you don't report to anyone in the system.", blocks: [], tools: ["Org hierarchy"] };
  return {
    intent: "my_manager",
    text: `You report to **${chain[0].name}** (${chain[0].designation}).${chain[1] ? ` Your skip-level is **${chain[1].name}** (${chain[1].designation}).` : ""}`,
    blocks: [{ kind: "links", items: [link("Open org chart", "/org-chart", "people.org_chart")] }],
    tools: ["Org hierarchy"],
  };
};

const hPolicy: Handler = (q, ctx) => {
  const hits = searchKnowledge(q, 3);
  if (!hits.length || hits[0].score < 1) return null;
  if (!ctx.can("ai.knowledge", "V")) return null;
  const top = hits[0];
  const conf = kbConfidence(hits);
  const extra = hits.slice(1).filter((h) => h.score >= top.score - 1 && h.doc.id === top.doc.id);
  return {
    intent: "policy",
    text: `According to the **${top.doc.title} (${top.doc.version}) ${top.passage.section}**:\n${top.passage.text}${extra.length ? `\nRelated: ${extra.map((h) => `${h.passage.section} — ${h.passage.text.split(". ")[0]}.`).join(" ")}` : ""}`,
    blocks: [
      {
        kind: "citations",
        confidence: conf,
        items: hits.map((h) => ({ docId: h.doc.id, docTitle: h.doc.title, section: h.passage.section, page: h.passage.page, quote: h.passage.text })),
      },
    ],
    tools: ["Knowledge base"],
  };
};

/** Ordered — the first handler that returns a reply wins. */
const HANDLERS: Handler[] = [
  hGreeting,
  hThanks,
  hCapabilities,
  hSalaryRefusal,
  hRaiseTicket,
  hRegularise,
  hApplyLeave,
  hLeaveBalance,
  hPayslip,
  hPayrollExceptions,
  hPayrollCost,
  hApprovals,
  hAttrition,
  hTeamOnLeave,
  hExpense,
  hTicketStatus,
  hDraft,
  hShortlist,
  hOpenPositions,
  hOnboarding,
  hHeadcount,
  hAssets,
  hManager,
  hHolidays,
  hAttendance,
  hPolicy,
];

/** Answers a question for the given persona. Pure and deterministic. */
export function respond(question: string, ctx: CopilotContext): CopilotReply {
  const raw = question.trim();
  const q = raw.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ");
  for (const h of HANDLERS) {
    const r = h(q, ctx, raw);
    if (r) return r;
  }
  const mine = INTENT_CATALOG.filter((i) => i.available(ctx));
  if (/\b(policy|policies|allowed|entitled|eligible|rule|rules|can i)\b/.test(q))
    return {
      intent: "fallback",
      text: "I don't know — none of the indexed policy documents cover that, and I won't guess. I've logged it as a knowledge gap for HR. If you need an answer now, I can raise an HR ticket for you.",
      blocks: [{ kind: "links", items: [link("Browse the Knowledge Base", "/ai/knowledge", "ai.knowledge")] }],
      tools: ["Knowledge base"],
      fallback: true,
      followUps: [`Raise a ticket: ${raw.replace(/[?]+$/, "")}`],
    };
  return {
    intent: "fallback",
    text: "I can't answer that yet — I only answer from your HR data and indexed policies, and I won't guess. Here's what I can do:",
    blocks: [],
    tools: [],
    fallback: true,
    followUps: mine.slice(0, 5).map((i) => i.example),
  };
}

/** Short title for a conversation, from its first question. */
export function titleFor(question: string) {
  const t = question.replace(/[?.!]+$/, "").trim();
  return t.length > 38 ? `${t.slice(0, 36)}…` : t;
}

