/* ============================================================================
   Operations fixtures — access-review campaign, notification templates,
   the background-job run ledger and system health.
   ========================================================================== */

import { mulberry32, randInt } from "@/lib/utils";
import { EMPLOYEES } from "@/mock/employees";

/* ----------------------------------------------------------- access review */

export const ACCESS_CAMPAIGN = {
  id: "AR-2026-Q3",
  name: "Q3 FY26-27 privileged access re-certification",
  scope: "Every account holding an admin, payroll, finance or approver role — plus every active permission override.",
  reviewers: ["Priya Menon", "Lakshmi Pillai", "Girish Gowda"],
  startedAt: "2026-09-01",
  dueAt: "2026-09-30",
  owner: "Priya Menon",
  policy: "ISO 27001 A.5.18 · SOC 2 CC6.2 — quarterly review of privileged access",
};

export type ReviewDecision = "pending" | "certified" | "revoked";

export interface ReviewItem {
  id: string;
  userCode: string;
  userName: string;
  role: string;
  department: string;
  reviewer: string;
  grants: string[];
  risky: string[];
  lastLoginAt: string | null;
  decision: ReviewDecision;
  comment?: string;
}

const RISKY_COMBOS: { role: string; grants: string[]; risky: string[] }[] = [
  { role: "Payroll Admin", grants: ["Pay Runs · Edit", "Pay Runs · Approve", "Salary Structures · Edit", "Bank Advice · Export"], risky: ["Pay Runs · Edit + Approve (maker-checker conflict)"] },
  { role: "Finance Controller", grants: ["Pay Runs · Approve", "Expenses · Approve", "Currencies & FX · Edit"], risky: [] },
  { role: "HR Admin", grants: ["Employee Directory · Edit", "Permission Overrides · Create", "Roles · Edit"], risky: ["Can grant themselves permissions via overrides"] },
  { role: "IT Admin", grants: ["Users · Edit", "Active Sessions · Delete", "Custom Domains · View"], risky: [] },
  { role: "Manager", grants: ["Leave Approvals · Approve", "Team Attendance · Edit"], risky: [] },
  { role: "Recruiter", grants: ["Candidates · Edit", "Offers · Create", "Employee Directory · Edit (override)"], risky: ["Temporary override still active"] },
  { role: "Auditor", grants: ["All modules · View", "All modules · Export"], risky: ["Bulk export of salary data"] },
];

function buildReview(): ReviewItem[] {
  const rng = mulberry32(7702);
  const people = EMPLOYEES.filter((e) => e.status !== "exited" && e.level <= 2).slice(0, 34);
  return people.map((e, i) => {
    const combo = RISKY_COMBOS[i % RISKY_COMBOS.length];
    const decided = i < 21;
    const lastDays = i % 9 === 4 ? randInt(rng, 70, 140) : randInt(rng, 0, 12);
    const d = new Date(Date.UTC(2026, 8, 16 - lastDays));
    return {
      id: `ARI-${String(i + 1).padStart(3, "0")}`,
      userCode: e.code,
      userName: e.name,
      role: combo.role,
      department: e.departmentId,
      reviewer: ACCESS_CAMPAIGN.reviewers[i % 3],
      grants: combo.grants,
      risky: lastDays > 60 ? [...combo.risky, `Dormant — no sign-in for ${lastDays} days`] : combo.risky,
      lastLoginAt: i === 12 ? null : d.toISOString().slice(0, 10),
      decision: decided ? (i % 7 === 3 ? "revoked" : "certified") : "pending",
      comment: decided ? (i % 7 === 3 ? "Role no longer needed after team move." : "Access matches current responsibilities.") : undefined,
    };
  });
}

export const REVIEW_ITEMS: ReviewItem[] = buildReview();

/* ------------------------------------------------- notification templates */

export type NotifyChannel = "email" | "in_app" | "whatsapp" | "teams";

export const CHANNEL_LABEL: Record<NotifyChannel, string> = {
  email: "Email",
  in_app: "In-app",
  whatsapp: "WhatsApp",
  teams: "Microsoft Teams",
};

export interface NotifyEvent {
  id: string;
  label: string;
  module: string;
  tokens: string[];
  sample: Record<string, string>;
}

export const NOTIFY_EVENTS: NotifyEvent[] = [
  { id: "leave.applied", label: "Leave applied", module: "Leave", tokens: ["employee.name", "leave.type", "leave.from", "leave.to", "leave.days", "approver.name", "link"], sample: { "employee.name": "Ananya Rao", "leave.type": "Earned Leave", "leave.from": "22 Sep 2026", "leave.to": "24 Sep 2026", "leave.days": "3", "approver.name": "Vikram Shah", link: "https://hr.stellartech.in/approvals" } },
  { id: "leave.approved", label: "Leave approved", module: "Leave", tokens: ["employee.name", "leave.type", "leave.from", "leave.to", "leave.days", "approver.name", "balance.after"], sample: { "employee.name": "Ananya Rao", "leave.type": "Earned Leave", "leave.from": "22 Sep 2026", "leave.to": "24 Sep 2026", "leave.days": "3", "approver.name": "Vikram Shah", "balance.after": "9.5" } },
  { id: "payslip.published", label: "Payslip published", module: "Payroll", tokens: ["employee.name", "pay.month", "net.pay", "link"], sample: { "employee.name": "Ananya Rao", "pay.month": "August 2026", "net.pay": "₹78,412", link: "https://hr.stellartech.in/me/payslips" } },
  { id: "offer.released", label: "Offer released", module: "Recruitment", tokens: ["candidate.name", "job.title", "offer.expires", "recruiter.name", "link"], sample: { "candidate.name": "Karan Mehta", "job.title": "Senior Backend Engineer", "offer.expires": "23 Sep 2026", "recruiter.name": "Sana Iqbal", link: "https://careers.stellartech.in/offer/8f21" } },
  { id: "ticket.updated", label: "Helpdesk ticket updated", module: "Helpdesk", tokens: ["employee.name", "ticket.id", "ticket.subject", "ticket.status", "agent.name", "link"], sample: { "employee.name": "Ananya Rao", "ticket.id": "HD-2291", "ticket.subject": "Form 16 not visible", "ticket.status": "Resolved", "agent.name": "Ishita Kulkarni", link: "https://hr.stellartech.in/helpdesk" } },
  { id: "expense.approved", label: "Expense claim approved", module: "Expenses", tokens: ["employee.name", "claim.id", "claim.amount", "approver.name"], sample: { "employee.name": "Ananya Rao", "claim.id": "EXP-1182", "claim.amount": "₹4,860", "approver.name": "Vikram Shah" } },
  { id: "review.due", label: "Performance review due", module: "Performance", tokens: ["employee.name", "cycle.name", "due.date", "link"], sample: { "employee.name": "Ananya Rao", "cycle.name": "H1 FY26-27", "due.date": "30 Sep 2026", link: "https://hr.stellartech.in/reviews" } },
];

export interface NotifyTemplate {
  id: string;
  eventId: string;
  channel: NotifyChannel;
  subject: string;
  body: string;
  enabled: boolean;
  updatedAt: string;
  updatedBy: string;
}

const BODIES: Record<string, { subject: string; body: string }> = {
  "leave.applied": { subject: "{{employee.name}} applied for {{leave.type}}", body: "Hi {{approver.name}},\n\n{{employee.name}} has applied for {{leave.days}} day(s) of {{leave.type}} from {{leave.from}} to {{leave.to}}.\n\nReview it here: {{link}}" },
  "leave.approved": { subject: "Your {{leave.type}} is approved", body: "Hi {{employee.name}},\n\n{{approver.name}} approved your {{leave.type}} from {{leave.from}} to {{leave.to}} ({{leave.days}} day(s)). Remaining balance: {{balance.after}} days." },
  "payslip.published": { subject: "Your payslip for {{pay.month}} is ready", body: "Hi {{employee.name}},\n\nYour payslip for {{pay.month}} has been published. Net pay: {{net.pay}}.\n\nView and download: {{link}}" },
  "offer.released": { subject: "Your offer from Stellar Technologies — {{job.title}}", body: "Dear {{candidate.name}},\n\nWe are delighted to offer you the role of {{job.title}}. Please review and accept before {{offer.expires}}.\n\n{{link}}\n\nWarm regards,\n{{recruiter.name}}" },
  "ticket.updated": { subject: "[{{ticket.id}}] {{ticket.subject}} — {{ticket.status}}", body: "Hi {{employee.name}},\n\n{{agent.name}} updated your ticket {{ticket.id}} to {{ticket.status}}.\n\n{{link}}" },
  "expense.approved": { subject: "Claim {{claim.id}} approved", body: "Hi {{employee.name}}, your claim {{claim.id}} for {{claim.amount}} was approved by {{approver.name}} and will be paid with the next payroll." },
  "review.due": { subject: "Your {{cycle.name}} self-review is due {{due.date}}", body: "Hi {{employee.name}},\n\nYour self-review for {{cycle.name}} is due on {{due.date}}. It takes about 20 minutes.\n\n{{link}}" },
};

export const NOTIFY_TEMPLATES: NotifyTemplate[] = NOTIFY_EVENTS.flatMap((ev, i) =>
  (["email", "in_app", "whatsapp", "teams"] as NotifyChannel[]).map((ch, j) => {
    const base = BODIES[ev.id];
    const short = base.body.split("\n\n").slice(0, 2).join(" ").replace(/\n/g, " ");
    return {
      id: `TPL-${ev.id}-${ch}`,
      eventId: ev.id,
      channel: ch,
      subject: ch === "email" ? base.subject : base.subject,
      body: ch === "email" ? base.body : short,
      enabled: !(ch === "teams" && (i % 2 === 1)) && !(ch === "whatsapp" && ev.id === "review.due"),
      updatedAt: `2026-0${(i + j) % 2 === 0 ? 8 : 9}-${String(4 + i + j).padStart(2, "0")}T11:20:00`,
      updatedBy: j % 2 === 0 ? "Priya Menon" : "Sana Iqbal",
    };
  }),
);
