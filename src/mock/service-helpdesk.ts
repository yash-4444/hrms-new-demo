import { KB_DOCUMENTS } from "./ai";
import {
  SLA_HOURS,
  TICKETS,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  isTicketOpen,
  type Ticket,
  type TicketCategory,
  type TicketPriority,
} from "./workplace";

/* ============================================================================
   SERVICE · HELPDESK — the agent's view of the existing TICKETS: channel,
   AI triage, KB-grounded suggested replies, macros, category tree and SLA
   policies. Ticket numbers and counts are the ones on /helpdesk.
   ========================================================================== */

export type Channel = "Portal" | "Email" | "WhatsApp" | "Copilot";
export const CHANNELS: Channel[] = ["Portal", "Email", "WhatsApp", "Copilot"];
const CHANNEL_PATTERN: Channel[] = ["Portal", "Email", "Portal", "WhatsApp", "Copilot", "Portal", "Email", "Portal", "Copilot", "WhatsApp"];

export type Sentiment = "Frustrated" | "Neutral" | "Positive";

export interface KbCite {
  docId: string;
  docTitle: string;
  section: string;
  page: number;
}

export interface TicketAi {
  category: TicketCategory;
  categoryConfidence: number;
  priority: TicketPriority;
  priorityConfidence: number;
  sentiment: Sentiment;
  reason: string;
  reply: string;
  citations: KbCite[];
  similar: string[];
}

export interface QueueTicket extends Ticket {
  channel: Channel;
  ai: TicketAi;
  csat: number | null;
}

const cite = (docId: string, passageId: string): KbCite => {
  const doc = KB_DOCUMENTS.find((d) => d.id === docId)!;
  const p = doc.passages.find((x) => x.id === passageId)!;
  return { docId, docTitle: doc.title, section: p.section, page: p.page };
};

const REPLY_BY_CATEGORY: Record<TicketCategory, { body: string; cites: KbCite[] }> = {
  IT: {
    body: "I have reproduced the issue and opened a fix with the network team. Company laptops must stay encrypted and on the managed profile while we work on it [1], so please do not install a third-party VPN client — anything outside the approved catalogue needs a software request [2]. I will update you before end of day.",
    cites: [cite("kb-it", "it-2.3"), cite("kb-it", "it-4.1")],
  },
  Access: {
    body: "Your access request is with the system owner for approval. Access is granted only through the approved catalogue [1] and is tied to your company device [2]; you will get an email as soon as it is provisioned — usually within 4 working hours.",
    cites: [cite("kb-it", "it-4.1"), cite("kb-it", "it-2.3")],
  },
  Facilities: {
    body: "Facilities has scheduled a technician for tomorrow morning. If you are working from home in the meantime, the home-office internet reimbursement still applies [1], and standard working hours are unaffected [2].",
    cites: [cite("kb-wfh", "wfh-3.2"), cite("kb-handbook", "hb-2.4")],
  },
  HR: {
    body: "I have checked your record. Leave must be applied through the HRMS at least 3 working days ahead [1], and Earned Leave accrues at 1.75 days per completed month of service [2]. I have corrected the balance and you should see it on your leave page now.",
    cites: [cite("kb-leave", "leave-7.2"), cite("kb-leave", "leave-3.1")],
  },
  Payroll: {
    body: "Payroll has reviewed this. Both you and Stellar contribute 12% of basic to PF [1], and reimbursements reach payroll only once the claim is approved within 30 days of the expense [2]. The difference will be paid as an arrear in the October run.",
    cites: [cite("kb-gratuity", "gpf-3"), cite("kb-travel", "travel-4.2")],
  },
};

const REASON_BY_CATEGORY: Record<TicketCategory, string> = {
  IT: "Mentions devices, network or software errors",
  Access: "Asks for a system, card or permission grant",
  Facilities: "About the office, seating, power or transport",
  HR: "About leave, policies, letters or records",
  Payroll: "About salary, deductions, PF or reimbursements",
};

const PRIORITY_BUMP: Record<TicketPriority, TicketPriority> = { Low: "Medium", Medium: "High", High: "Critical", Critical: "Critical" };

function enrich(t: Ticket, i: number): QueueTicket {
  const disagreeCategory = i % 9 === 4;
  const disagreePriority = i % 7 === 3;
  const altCategory = TICKET_CATEGORIES[(TICKET_CATEGORIES.indexOf(t.category) + 1) % TICKET_CATEGORIES.length];
  const first = t.requesterName.split(" ")[0];
  const tpl = REPLY_BY_CATEGORY[t.category];
  return {
    ...t,
    channel: CHANNEL_PATTERN[i % CHANNEL_PATTERN.length],
    csat: t.status === "resolved" ? [5, 4, 5, 3, 5, 4, 4, 5][i % 8] : null,
    ai: {
      category: disagreeCategory ? altCategory : t.category,
      categoryConfidence: disagreeCategory ? 64 + (i % 6) : 86 + (i % 12),
      priority: disagreePriority ? PRIORITY_BUMP[t.priority] : t.priority,
      priorityConfidence: disagreePriority ? 71 : 88 + (i % 9),
      sentiment:
        t.slaState === "sla_breached" || t.status === "reopened" ? "Frustrated" : i % 4 === 1 ? "Positive" : "Neutral",
      reason: disagreePriority
        ? `${REASON_BY_CATEGORY[t.category]}; the requester says work is blocked, which usually warrants ${PRIORITY_BUMP[t.priority]}.`
        : REASON_BY_CATEGORY[disagreeCategory ? altCategory : t.category],
      reply: `Hi ${first}, thanks for the detail on "${t.subject}". ${tpl.body}`,
      citations: tpl.cites,
      similar: TICKETS.filter((x) => x.id !== t.id && x.category === t.category && x.status === "resolved")
        .slice(0, 3)
        .map((x) => x.id),
    },
  };
}

export const QUEUE_TICKETS: QueueTicket[] = TICKETS.map(enrich);
export const queueTicket = (id: string) => QUEUE_TICKETS.find((t) => t.id === id);

/* ----------------------------------------------------------------- macros */

export interface Macro {
  id: string;
  name: string;
  category: TicketCategory | "Any";
  body: string;
}

export const MACROS: Macro[] = [
  { id: "mac-ack", name: "Acknowledge and set expectation", category: "Any", body: "Thanks for reaching out — I have picked this up and will update you within the SLA for this request." },
  { id: "mac-info", name: "Ask for more information", category: "Any", body: "To look into this, could you share a screenshot of the error and the time it happened? I will keep the ticket open for 3 working days." },
  { id: "mac-vpn", name: "VPN — reinstall profile", category: "IT", body: "Please open the Company Portal, remove the 'Stellar VPN' profile, restart, and install it again. This resolves most tunnel drops." },
  { id: "mac-leave", name: "Leave balance corrected", category: "HR", body: "I have corrected your leave balance. The ledger now shows the adjustment with today's date; no action is needed from you." },
  { id: "mac-payslip", name: "Payslip reissued", category: "Payroll", body: "Your corrected payslip has been reissued and is available under My Payslips. The arrear will be paid in the next run." },
  { id: "mac-close", name: "Resolve — confirm with requester", category: "Any", body: "I am marking this resolved. If anything is still not right, reply to this ticket within 7 days and it will reopen automatically." },
];

/* --------------------------------------------------------- category tree */

export interface HdCategoryNode {
  id: string;
  name: string;
  parent: TicketCategory | null;
  team: string;
  defaultPriority: TicketPriority;
  slaPolicyId: string;
  autoAssign: string;
}

const sub = (id: string, name: string, parent: TicketCategory, team: string, p: TicketPriority, sla: string, auto: string): HdCategoryNode => ({
  id, name, parent, team, defaultPriority: p, slaPolicyId: sla, autoAssign: auto,
});
const top = (c: TicketCategory, team: string, p: TicketPriority, auto: string): HdCategoryNode => ({
  id: `hc-${c.toLowerCase()}`, name: c, parent: null, team, defaultPriority: p, slaPolicyId: "sla-std", autoAssign: auto,
});

export const HD_CATEGORY_TREE: HdCategoryNode[] = [
  top("IT", "IT Service Desk", "Medium", "Round-robin"),
  sub("hc-it-net", "Network & VPN", "IT", "IT Service Desk", "High", "sla-std", "Round-robin"),
  sub("hc-it-hw", "Laptop & hardware", "IT", "IT Service Desk", "Medium", "sla-std", "Round-robin"),
  sub("hc-it-sw", "Software & licences", "IT", "IT Service Desk", "Low", "sla-std", "Least-loaded"),
  top("Access", "IT Service Desk", "High", "Least-loaded"),
  sub("hc-ac-app", "Application access", "Access", "IT Service Desk", "High", "sla-std", "Least-loaded"),
  sub("hc-ac-card", "Access card & building", "Access", "Facilities & Admin", "Medium", "sla-std", "Round-robin"),
  top("Facilities", "Facilities & Admin", "Medium", "Round-robin"),
  sub("hc-fa-seat", "Seating & workspace", "Facilities", "Facilities & Admin", "Low", "sla-std", "Round-robin"),
  sub("hc-fa-trans", "Transport & cab", "Facilities", "Facilities & Admin", "High", "sla-std", "Round-robin"),
  top("HR", "People Operations", "Medium", "Skills-based"),
  sub("hc-hr-leave", "Leave & attendance", "HR", "People Operations", "Medium", "sla-std", "Skills-based"),
  sub("hc-hr-letters", "Letters & documents", "HR", "People Operations", "Low", "sla-std", "Skills-based"),
  sub("hc-hr-benefits", "Benefits & insurance", "HR", "People Operations", "Medium", "sla-std", "Skills-based"),
  top("Payroll", "Payroll Operations", "High", "Least-loaded"),
  sub("hc-pay-salary", "Salary & payslip", "Payroll", "Payroll Operations", "High", "sla-payroll", "Least-loaded"),
  sub("hc-pay-tax", "Tax & declarations", "Payroll", "Payroll Operations", "Medium", "sla-payroll", "Least-loaded"),
  sub("hc-pay-reimb", "Reimbursements", "Payroll", "Payroll Operations", "Medium", "sla-std", "Least-loaded"),
];

export const openTicketsIn = (c: TicketCategory) => TICKETS.filter((t) => t.category === c && isTicketOpen(t)).length;

/* ----------------------------------------------------------- SLA policies */

export interface SlaTarget {
  priority: TicketPriority;
  firstResponseHrs: number;
  resolutionHrs: number;
}

export interface SlaPolicy {
  id: string;
  name: string;
  appliesTo: string;
  calendarId: string;
  targets: SlaTarget[];
  escalations: { level: string; after: string; notify: string }[];
}

const RESOLUTION_HRS: Record<TicketPriority, number> = { Critical: 24, High: 48, Medium: 72, Low: 120 };

export const BUSINESS_CALENDARS = [
  { id: "cal-in", name: "India business hours", hours: "Mon–Fri · 09:00–18:00 IST", holidays: "India holiday calendar 2026 (10 + 2 optional)" },
  { id: "cal-us", name: "US East business hours", hours: "Mon–Fri · 09:00–17:00 ET", holidays: "Newark holiday calendar 2026" },
  { id: "cal-247", name: "24 × 7 critical", hours: "All hours, every day", holidays: "None — clock never pauses" },
];

export const SLA_POLICIES: SlaPolicy[] = [
  {
    id: "sla-std",
    name: "Standard employee service",
    appliesTo: "All categories unless overridden",
    calendarId: "cal-in",
    targets: TICKET_PRIORITIES.map((p) => ({ priority: p, firstResponseHrs: SLA_HOURS[p], resolutionHrs: RESOLUTION_HRS[p] })),
    escalations: [
      { level: "L1 · Assignee", after: "75% of target", notify: "In-app + email to assignee" },
      { level: "L2 · Team lead", after: "On breach", notify: "Team lead, ticket flagged red" },
      { level: "L3 · Function head", after: "Breach + 8 business hours", notify: "Head of People Ops / Director of IT" },
    ],
  },
  {
    id: "sla-payroll",
    name: "Payroll window",
    appliesTo: "Salary & payslip, Tax & declarations — 25th to 5th of each month",
    calendarId: "cal-in",
    targets: TICKET_PRIORITIES.map((p) => ({ priority: p, firstResponseHrs: Math.max(2, SLA_HOURS[p] / 2), resolutionHrs: RESOLUTION_HRS[p] / 2 })),
    escalations: [
      { level: "L1 · Payroll analyst", after: "50% of target", notify: "In-app" },
      { level: "L2 · Payroll manager", after: "On breach", notify: "Rahul Desai" },
      { level: "L3 · Finance controller", after: "Breach + 4 business hours", notify: "Finance controller" },
    ],
  },
  {
    id: "sla-crit",
    name: "Critical infrastructure",
    appliesTo: "Any Critical ticket in Network & VPN or Access card & building",
    calendarId: "cal-247",
    targets: [{ priority: "Critical", firstResponseHrs: 1, resolutionHrs: 8 }],
    escalations: [
      { level: "L1 · On-call engineer", after: "Immediately", notify: "Pager + WhatsApp" },
      { level: "L2 · Infrastructure lead", after: "30 minutes", notify: "Jessica Miller" },
      { level: "L3 · Director of IT", after: "2 hours", notify: "Girish Gowda" },
    ],
  },
];
