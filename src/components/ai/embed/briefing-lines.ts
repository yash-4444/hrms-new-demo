/* ============================================================================
   Dashboard AI briefing — the line builders.

   Every line is computed from the module fixtures at DEMO_TODAY, so a number
   in the briefing matches the screen it links to. Pure functions: no clock,
   no randomness. The card (dashboard-briefing.tsx) decides what is shown.
   ========================================================================== */

import { addDays, format, getDay, parseISO } from "date-fns";
import type { LucideIcon } from "lucide-react";
import {
  AlarmClock,
  BadgeIndianRupee,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  FileWarning,
  Inbox,
  KeySquare,
  Laptop,
  LifeBuoy,
  ReceiptText,
  ShieldAlert,
  TrendingUp,
  UserRoundSearch,
  Wrench,
} from "lucide-react";
import { inr } from "@/lib/format";
import type { RoleId } from "@/lib/rbac";
import { DEMO_TODAY, holidaysFor } from "@/mock/org";
import { EMPLOYEE_BY_CODE, descendantsOf, reporteesOf } from "@/mock/employees";
import { LEAVE_APPLICATIONS, balanceFor, countryOf, ledgerFor } from "@/mock/leave";
import { amendmentsFor } from "@/mock/attendance";
import { PAY_RUNS, RUN_STEP_META, payslipsFor } from "@/mock/payroll";
import { approvalsFor } from "@/mock/self-service";
import { ANOMALIES, ATTRITION_RISK, KB_UNANSWERED } from "@/mock/ai";
import { COMPLIANCE_ALERTS } from "@/mock/insights";
import { ONBOARDING } from "@/mock/lifecycle-onboarding";
import { CANDIDATES, OFFERS, REQUISITIONS, UPCOMING_INTERVIEWS, reqAgeingDays } from "@/mock/hiring";
import { LICENCES, LICENCE_TOTALS } from "@/mock/service-licences";
import { PM_SCHEDULE } from "@/mock/service-ops";
import { ASSETS, TICKETS, isTicketOpen } from "@/mock/workplace";
import type { ExplainDriver } from "../ai-ui";

export type BriefingTone = "info" | "warning" | "critical" | "good";

export interface BriefingLine {
  id: string;
  icon: LucideIcon;
  tone: BriefingTone;
  /** One sentence; "**bold**" spans are emphasised. */
  text: string;
  href: string;
  linkLabel: string;
  /** Handed to the Copilot when the persona presses "Ask Copilot". */
  ask: string;
  /** The signals behind the line, shown in the "Why?" popover. */
  why: ExplainDriver[];
}

export interface BriefingContext {
  role: RoleId;
  employeeId: string;
  name: string;
  /** Live pay-run exception count from the app state (resolving one lowers it). */
  exceptionCount: number;
}

const TODAY = parseISO(DEMO_TODAY);
const RUN = PAY_RUNS[0];
const iso = (d: Date) => format(d, "yyyy-MM-dd");
const short = (s: string) => format(parseISO(s), "dd MMM");
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/* ------------------------------------------------------------ self-service */

function compOffExpiry(code: string): BriefingLine | null {
  const co = balanceFor(code, "CO");
  if (!co || co.available <= 0) return null;
  const live = ledgerFor(code, "CO")
    .filter((r) => r.kind === "accrual" && r.credit > 0)
    .map((r) => iso(addDays(parseISO(r.date), 45)))
    .filter((d) => d >= DEMO_TODAY)
    .sort();
  if (!live.length) return null;
  return {
    id: "co-expiry",
    icon: CalendarDays,
    tone: "warning",
    text: `**${co.available} day${co.available === 1 ? "" : "s"} of Comp Off** expire${co.available === 1 ? "s" : ""} from **${short(live[0])}** — nothing is planned against ${co.available === 1 ? "it" : "them"} yet.`,
    href: "/leave?apply=1",
    linkLabel: "Plan leave",
    ask: "When does my comp off expire?",
    why: [
      { label: "Comp Off expires 45 days after it is earned", detail: "Leave Policy — the expiry sweep runs on the 10th." },
      { label: `Earliest live credit expires ${short(live[0])}`, detail: `${co.available} day(s) available, ${co.pending} in pending applications.` },
    ],
  };
}

function regularisationsDue(code: string): BriefingLine | null {
  const open = amendmentsFor(code).filter((a) => a.status === "draft" || a.status === "sent_back");
  if (!open.length) return null;
  const sentBack = open.filter((a) => a.status === "sent_back").length;
  return {
    id: "regularise",
    icon: ClipboardCheck,
    tone: sentBack ? "warning" : "info",
    text: `**${plural(open.length, "regularisation")}** need${open.length === 1 ? "s" : ""} your action${sentBack ? ` — ${sentBack} sent back by your manager` : ""}.`,
    href: "/attendance/amendments",
    linkLabel: "Open amendments",
    ask: "Which of my regularisations need action?",
    why: open.map((a) => ({ label: `${a.id} · ${a.status === "sent_back" ? "sent back" : "draft"}`, detail: `For ${short(a.date)} — not yet submitted for approval.` })),
  };
}

function payslipReady(code: string): BriefingLine | null {
  const slips = payslipsFor(code).filter((p) => p.status === "paid");
  const [last, prev] = slips;
  if (!last) return null;
  const delta = prev ? last.net - prev.net : 0;
  return {
    id: "payslip",
    icon: BadgeIndianRupee,
    tone: "good",
    text: `Your **${last.label} payslip** is ready — net **${inr(last.net)}**${prev ? (delta === 0 ? `, unchanged from ${prev.shortLabel}` : `, ${delta > 0 ? "up" : "down"} ${inr(Math.abs(delta))} on ${prev.shortLabel}`) : ""}.`,
    href: "/payslips",
    linkLabel: "View payslip",
    ask: `Explain my ${last.label} payslip`,
    why: [
      { label: `Paid on ${short(last.payDate)}`, detail: `Gross ${inr(last.gross)} − deductions ${inr(last.deductions)}.` },
      { label: last.lopDays ? `${last.lopDays} LOP day(s)` : "No loss-of-pay days", detail: "Read from the attendance finalised for the run." },
    ],
  };
}

function nextHoliday(code: string): BriefingLine | null {
  const h = holidaysFor(countryOf(code)).find((x) => x.date >= DEMO_TODAY && !x.optional);
  if (!h) return null;
  const dow = getDay(parseISO(h.date));
  const bridge = dow === 1 || dow === 5 ? "a long weekend" : dow === 2 || dow === 4 ? "a 4-day weekend if you take one day off" : "a midweek break";
  return {
    id: "holiday",
    icon: CalendarRange,
    tone: "info",
    text: `Next holiday: **${h.name}** on ${format(parseISO(h.date), "EEE dd MMM")} — ${bridge}.`,
    href: "/leave/calendar",
    linkLabel: "Leave calendar",
    ask: "What are the upcoming holidays?",
    why: [{ label: "From your work country's holiday calendar", detail: `${countryOf(code) === "US" ? "United States" : "India"} gazetted list; optional holidays excluded.` }],
  };
}

/* ------------------------------------------------------------- team lines */

function approvalsLine(ctx: BriefingContext): BriefingLine | null {
  const items = approvalsFor(ctx.role, ctx.employeeId, ctx.name);
  if (!items.length) return null;
  const low = items.filter((a) => a.lowRisk).length;
  const breached = items.filter((a) => a.slaState === "breached").length;
  return {
    id: "approvals",
    icon: Inbox,
    tone: breached ? "warning" : "info",
    text: `**${plural(items.length, "approval")}** waiting — **${low} look low-risk**${breached ? `, ${breached} past SLA` : ""}. You still decide each one.`,
    href: "/approvals",
    linkLabel: "Open inbox",
    ask: "What approvals are pending for me?",
    why: [
      { label: "Low-risk = within balance / policy, no clash, no flag", weight: low, detail: `${low} of ${items.length} meet every rule.` },
      { label: "Past SLA", weight: breached, detail: `${breached} older than their module's SLA.` },
    ],
  };
}

function riskLine(codes: Set<string>, scope: string, me: string): BriefingLine | null {
  const rows = ATTRITION_RISK.filter((r) => codes.has(r.code) && r.code !== me && r.band !== "Low" && r.trend > 0);
  const top = rows[0];
  if (!top) return null;
  return {
    id: "attrition",
    icon: TrendingUp,
    tone: top.band === "High" ? "critical" : "warning",
    text: `**${top.name}** moved to **${top.band} attrition risk** (${top.score}, ↑${top.trend})${rows.length > 1 ? ` — ${rows.length - 1} more rising in ${scope}` : ""}. Worth a 1:1.`,
    href: `/employees/${top.code}`,
    linkLabel: "Open profile",
    ask: `Why is ${top.name} at attrition risk?`,
    why: top.drivers.map((d) => ({ label: d.label, detail: d.detail, weight: d.weight })),
  };
}

function clashLine(codes: string[], scope: string): BriefingLine | null {
  /* Working days over the next four weeks, from tomorrow. */
  const days = Array.from({ length: 28 }, (_, i) => addDays(TODAY, i + 1))
    .filter((d) => getDay(d) !== 0 && getDay(d) !== 6)
    .map(iso);
  const set = new Set(codes);
  const apps = LEAVE_APPLICATIONS.filter(
    (a) => set.has(a.employeeCode) && (a.status === "approved" || a.status === "pending"),
  );
  const perDay = days
    .map((d) => ({ d, who: [...new Set(apps.filter((a) => a.fromDate <= d && a.toDate >= d).map((a) => a.employeeName))] }))
    .filter((p) => p.who.length > 0);
  if (!perDay.length) return null;
  const most = Math.max(...perDay.map((p) => p.who.length));
  const peak = perDay.find((p) => p.who.length === most)!;
  const first = (n: string) => n.split(" ")[0];
  const label = (d: string) => format(parseISO(d), "EEE dd MMM");
  return {
    id: "clash",
    icon: CalendarRange,
    tone: most >= 2 ? "warning" : "info",
    text:
      most >= 2
        ? `Leave clash ahead: **${most} of ${codes.length}** in ${scope} are off on **${label(peak.d)}** (${peak.who.map(first).join(", ")}) — check cover before approving.`
        : `No leave clashes in the next four weeks — next off: **${first(peak.who[0])}** on ${label(peak.d)}.`,
    href: `/leave/calendar?month=${peak.d.slice(0, 7)}`,
    linkLabel: "Leave calendar",
    ask: `Who is on leave on ${label(peak.d)}?`,
    why: [...perDay]
      .sort((a, b) => b.who.length - a.who.length || a.d.localeCompare(b.d))
      .slice(0, 5)
      .map((p) => ({ label: label(p.d), detail: `${p.who.join(", ")} (approved + pending)`, weight: p.who.length })),
  };
}

/* ------------------------------------------------------------ admin lines */

function onboardingLine(assignee?: string): BriefingLine | null {
  const rows = ONBOARDING.flatMap((i) =>
    i.tasks.filter((t) => t.status === "overdue" && (!assignee || t.assigneeCode === assignee)).map((t) => ({ i, t })),
  );
  if (!rows.length) return null;
  const joiners = new Set(rows.map((r) => r.i.id)).size;
  return {
    id: "onboarding",
    icon: AlarmClock,
    tone: "warning",
    text: `**${plural(rows.length, "onboarding task")}** overdue${assignee ? " on your plate" : ""} across ${plural(joiners, "joiner")} — oldest: “${rows[0].t.title}” for ${rows[0].i.joinerName}.`,
    href: "/onboarding",
    linkLabel: "Onboarding",
    ask: "Which onboarding tasks are overdue?",
    why: rows.slice(0, 4).map((r) => ({ label: `${r.i.joinerName} · ${r.t.title}`, detail: `Due ${short(r.t.due)}${r.t.escalatedTo ? " · escalated" : ""}` })),
  };
}

/** Org-wide movers; the viewer's own score is never shown to them. */
function moversLine(me: string): BriefingLine | null {
  const movers = ATTRITION_RISK.filter((r) => r.code !== me && r.band === "High" && r.trend >= 5).sort((a, b) => b.trend - a.trend);
  if (!movers.length) return null;
  return {
    id: "movers",
    icon: TrendingUp,
    tone: "critical",
    text: `**${plural(movers.length, "employee")}** jumped into **High attrition risk** this month — biggest move: ${movers[0].name}, ${movers[0].department} (↑${movers[0].trend}).`,
    href: "/ai/insights",
    linkLabel: "Attrition insights",
    ask: "Who is at high attrition risk?",
    why: movers.slice(0, 5).map((m) => ({ label: `${m.name} · ${m.score}`, detail: m.drivers[0]?.label, weight: m.trend })),
  };
}

function complianceLine(owner?: string): BriefingLine | null {
  const horizon = iso(addDays(TODAY, 7));
  const rows = COMPLIANCE_ALERTS.filter(
    (c) => (c.status === "overdue" || c.due <= horizon) && (!owner || c.owner === owner),
  ).sort((a, b) => a.due.localeCompare(b.due));
  if (!rows.length) return null;
  const overdue = rows.filter((c) => c.status === "overdue").length;
  return {
    id: "compliance",
    icon: FileWarning,
    tone: overdue ? "critical" : "warning",
    text: `**${plural(rows.length, "filing")}** due within 7 days${overdue ? ` — **${overdue} already overdue** (${rows[0].title})` : ` — next: ${rows[0].title} on ${short(rows[0].due)}`}.`,
    href: "/admin/compliance",
    linkLabel: "Compliance calendar",
    ask: "What compliance filings are due this week?",
    why: rows.map((c) => ({ label: c.title, detail: `Due ${short(c.due)} · ${c.owner}` })),
  };
}

function exceptionsLine(n: number): BriefingLine {
  return {
    id: "exceptions",
    icon: ShieldAlert,
    tone: n ? "critical" : "good",
    text: n
      ? `**${plural(n, "pay-run exception")}** block the ${RUN.label} lock (status: ${RUN_STEP_META[RUN.status].label}).`
      : `${RUN.label} has no blocking exceptions — ready for the lock step.`,
    href: `/payroll/runs/${RUN.id}`,
    linkLabel: "Open pay run",
    ask: "What are the payroll exceptions this month?",
    why: [{ label: "Hard checks: missing bank, LOP beyond days, negative net", detail: "These block the lock; AI flags below do not." }],
  };
}

function varianceLine(): BriefingLine | null {
  const flags = ANOMALIES.filter((a) => a.audience === "payroll");
  if (!flags.length) return null;
  return {
    id: "variance",
    icon: BadgeIndianRupee,
    tone: "warning",
    text: `AI scan found **${plural(flags.length, "net-pay variance")}** beyond ±5 % — largest: ${flags[0].subject} (${flags[0].title}).`,
    href: `/payroll/runs/${RUN.id}`,
    linkLabel: "Review variances",
    ask: "Explain this month's payroll variances",
    why: flags.map((f) => ({ label: `${f.subject} — ${f.title}`, detail: f.evidence[1], weight: f.confidence })),
  };
}

function anomaliesLine(kind?: "expense"): BriefingLine | null {
  const rows = ANOMALIES.filter((a) => !kind || a.audience === kind);
  if (!rows.length) return null;
  const high = rows.filter((a) => a.severity === "High").length;
  return {
    id: kind ? "dup-expense" : "anomalies",
    icon: kind ? ReceiptText : ShieldAlert,
    tone: high ? "warning" : "info",
    text: kind
      ? `**Duplicate receipt** suspected on ${rows[0].subject}'s claim (${rows[0].confidence}% match) — held for review, nothing auto-rejected.`
      : `**${plural(rows.length, "anomaly", "anomalies")}** to review (${high} high) across payroll, attendance and expenses.`,
    href: kind ? "/expenses/finance" : "/ai/insights",
    linkLabel: kind ? "Finance queue" : "Anomalies",
    ask: kind ? "Show duplicate expense receipts" : "What anomalies need review?",
    why: rows.slice(0, 5).map((a) => ({ label: `${a.kind}: ${a.title}`, detail: a.subject, weight: a.confidence })),
  };
}

/* ---------------------------------------------------- recruiting / IT / desk */

function recruiterLines(me: string): BriefingLine[] {
  const live = CANDIDATES.filter((c) => !["rejected", "hired"].includes(c.stage));
  const stale = live.filter((c) => c.stageAgeDays > 14).sort((a, b) => b.stageAgeDays - a.stageAgeDays);
  const mine = stale.filter((c) => c.ownerCode === me).length;
  const pending = OFFERS.filter((o) => o.status === "pending");
  const released = OFFERS.filter((o) => o.status === "approved");
  const soon = iso(addDays(TODAY, 1));
  const interviews = UPCOMING_INTERVIEWS.filter((i) => i.date <= soon).length;
  const ageing = REQUISITIONS.filter((r) => r.status === "open" && reqAgeingDays(r) > 45).length;
  const out: BriefingLine[] = [];
  if (stale.length)
    out.push({ id: "stale", icon: UserRoundSearch, tone: "warning", text: `**${plural(stale.length, "candidate")}** idle over 14 days in one stage (${mine} yours) — longest: ${stale[0].name}, ${stale[0].stageAgeDays} days.`, href: "/candidates", linkLabel: "Pipeline", ask: "Which candidates are stuck in the pipeline?", why: stale.slice(0, 4).map((c) => ({ label: c.name, detail: `${c.role} · ${c.stage} for ${c.stageAgeDays} days`, weight: c.stageAgeDays })) });
  if (pending.length || released.length)
    out.push({ id: "offers", icon: ClipboardCheck, tone: "info", text: `**${plural(pending.length, "offer")}** awaiting approval and **${released.length} released** without a reply yet.`, href: "/offers", linkLabel: "Offers", ask: "Which offers are pending?", why: [...pending, ...released].slice(0, 5).map((o) => ({ label: o.candidateName, detail: `${o.role} · ${o.status === "pending" ? "pending approval" : "released"}` })) });
  if (interviews)
    out.push({ id: "interviews", icon: CalendarDays, tone: "info", text: `**${plural(interviews, "interview")}** today and tomorrow — scorecards open once each round ends.`, href: "/interviews", linkLabel: "Interviews", ask: "What interviews are scheduled this week?", why: [{ label: "From the interview schedule", detail: `${UPCOMING_INTERVIEWS.length} upcoming in total.` }] });
  if (ageing)
    out.push({ id: "ageing", icon: AlarmClock, tone: "warning", text: `**${plural(ageing, "requisition")}** open more than 45 days — consider widening sourcing.`, href: "/requisitions?status=open", linkLabel: "Requisitions", ask: "Show open positions", why: [{ label: "Ageing threshold 45 days", detail: "Measured from approval date." }] });
  return out;
}

function itLines(): BriefingLine[] {
  const out: BriefingLine[] = [];
  if (LICENCE_TOTALS.idle60)
    out.push({ id: "licences", icon: KeySquare, tone: "warning", text: `**${LICENCE_TOTALS.idle60} licence seats** idle 60+ days — reclaiming saves **${inr(LICENCE_TOTALS.reclaimSaving, { decimals: false })}/yr**.`, href: "/assets/licences", linkLabel: "Licences", ask: "Which licences can I reclaim?", why: LICENCES.filter((l) => l.idle60).map((l) => ({ label: l.product, detail: `${l.idle60} idle seats`, weight: l.idle60 * l.costPerSeat })) });
  const lwdBy = iso(addDays(TODAY, 15));
  const due = ASSETS.filter((a) => {
    const e = a.allocatedTo ? EMPLOYEE_BY_CODE.get(a.allocatedTo) : undefined;
    return a.status === "allocated" && e?.exitDate && (e.status === "notice" || e.status === "exited") && e.exitDate <= lwdBy;
  });
  if (due.length)
    out.push({ id: "returns", icon: Laptop, tone: "warning", text: `**${plural(due.length, "asset")}** must be returned by leavers within 15 days — first: ${due[0].tag} (${due[0].allocatedToName}).`, href: "/assets", linkLabel: "Asset register", ask: "Which assets are due back from leavers?", why: due.map((a) => ({ label: `${a.tag} · ${a.allocatedToName}`, detail: `Last working day ${short(EMPLOYEE_BY_CODE.get(a.allocatedTo!)!.exitDate!)}` })) });
  const renew = LICENCES.filter((l) => l.daysToRenewal >= 0 && l.daysToRenewal <= 45);
  if (renew.length)
    out.push({ id: "renewal", icon: CalendarDays, tone: "info", text: `**${renew[0].product}** renews in ${renew[0].daysToRenewal} days with ${renew[0].idle60} idle seats — right-size before ${short(renew[0].renewal)}.`, href: "/assets/licences", linkLabel: "Licences", ask: `Should we right-size ${renew[0].product} before renewal?`, why: renew.map((l) => ({ label: l.product, detail: `${l.seatsAssigned}/${l.seatsPurchased} seats assigned` })) });
  const pm = PM_SCHEDULE.filter((p) => p.status === "overdue");
  if (pm.length)
    out.push({ id: "pm", icon: Wrench, tone: "warning", text: `**${plural(pm.length, "maintenance job")}** overdue — ${pm[0].title}.`, href: "/assets/maintenance", linkLabel: "Maintenance", ask: "What maintenance is overdue?", why: pm.map((p) => ({ label: p.title, detail: `Next due ${short(p.nextDue)}` })) });
  return out;
}

function deskLines(me: string): BriefingLine[] {
  const open = TICKETS.filter(isTicketOpen);
  const risk = open.filter((t) => t.slaState === "sla_at_risk");
  const breached = open.filter((t) => t.slaState === "sla_breached");
  const out: BriefingLine[] = [];
  if (risk.length || breached.length)
    out.push({ id: "sla", icon: LifeBuoy, tone: breached.length ? "critical" : "warning", text: `**${plural(risk.length, "ticket")}** near SLA breach and **${breached.length} breached** in the queue — AI-suggested replies are ready to review.`, href: "/helpdesk/queue", linkLabel: "Queue", ask: "Which tickets are close to breaching SLA?", why: [...breached, ...risk].slice(0, 5).map((t) => ({ label: `${t.ticketNo} · ${t.subject}`, detail: `${t.priority} · ${t.slaState === "sla_breached" ? "breached" : "at risk"}` })) });
  out.push({ id: "kb-gaps", icon: FileWarning, tone: "info", text: `**${plural(KB_UNANSWERED.length, "question")}** the knowledge base could not answer — top: “${KB_UNANSWERED[0].question}” (${KB_UNANSWERED[0].count} asks).`, href: "/ai/knowledge", linkLabel: "Knowledge base", ask: "What questions does the knowledge base miss?", why: KB_UNANSWERED.map((k) => ({ label: k.question, detail: k.suggestion, weight: k.count })) });
  const onb = onboardingLine(me);
  if (onb) out.push(onb);
  return out;
}

/* ------------------------------------------------------------------ entry */

/** The briefing for one persona — at most five lines, most urgent first. */
export function briefingFor(ctx: BriefingContext): BriefingLine[] {
  const me = ctx.employeeId;
  const self = () => [compOffExpiry(me), regularisationsDue(me), payslipReady(me), nextHoliday(me)];
  const team = (codes: string[], scope: string) => [approvalsLine(ctx), riskLine(new Set(codes), scope, me), clashLine(codes, scope)];
  let lines: (BriefingLine | null)[];
  switch (ctx.role) {
    case "employee":
      lines = self();
      break;
    case "manager":
      lines = [...team(reporteesOf(me).map((e) => e.code), "your team"), regularisationsDue(me)];
      break;
    case "department_head":
      lines = team(descendantsOf(me).map((e) => e.code), "your department");
      break;
    case "hr_admin":
      lines = [onboardingLine(), moversLine(me), complianceLine(), approvalsLine(ctx)];
      break;
    case "tenant_owner":
      lines = [moversLine(me), exceptionsLine(ctx.exceptionCount), complianceLine(), onboardingLine()];
      break;
    case "payroll_admin":
      lines = [exceptionsLine(ctx.exceptionCount), varianceLine(), complianceLine(ctx.name)];
      break;
    case "finance_controller":
      lines = [exceptionsLine(ctx.exceptionCount), varianceLine(), anomaliesLine("expense"), approvalsLine(ctx)];
      break;
    case "recruiter":
      lines = recruiterLines(me);
      break;
    case "it_admin":
      lines = itLines();
      break;
    case "helpdesk_agent":
      lines = deskLines(me);
      break;
    case "auditor":
      lines = [anomaliesLine(), exceptionsLine(ctx.exceptionCount), anomaliesLine("expense"), varianceLine()];
      break;
    default:
      lines = self();
  }
  return lines.filter((l): l is BriefingLine => l !== null).slice(0, 5);
}
