import { differenceInCalendarDays, parseISO } from "date-fns";
import { mulberry32, pick, randInt } from "@/lib/utils";
import { PERSONAS } from "@/lib/rbac";
import { DEMO_NOW, DEMO_TODAY, TENANT, deptName } from "@/mock/org";
import { EMPLOYEES, employeeByCode, employeeName, type Employee } from "@/mock/employees";
import { LEAVE_APPLICATIONS, balanceFor, type LeaveApplication } from "@/mock/leave";
import { AMENDMENTS, amendmentTypeLabel, type Amendment } from "@/mock/attendance";
import { TRAVEL_REQUESTS, type ExpenseClaim, type TravelRequest } from "@/mock/workplace";
import { OFFERS, REQUISITIONS, type Offer, type Requisition } from "@/mock/hiring";
import { EXP_ALL_CLAIMS } from "@/mock/finance-expense";
import {
  CESS_RATE,
  PAY_RUNS,
  computeTds,
  ctcBreakup,
  type PayRun,
} from "@/mock/payroll";

/* ============================================================================
   Self-service, inbox & auth fixtures.

   The approvals inbox does not invent its own requests: leave, regularisation,
   expenses, travel, requisitions, offers and the pay run all come from the
   existing module fixtures, so a count here reconciles with the module screen.
   Only asset requests and profile-change requests — which have no module
   fixture of their own yet — are seeded below.
   ========================================================================== */

const NOW = parseISO(DEMO_NOW);
const hoursSince = (iso: string) => Math.max(0, (NOW.getTime() - parseISO(iso).getTime()) / 3_600_000);
const addHours = (iso: string, h: number) => {
  const d = new Date(parseISO(iso).getTime() + h * 3_600_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:00`;
};
const personaName = (id: string, fallback: string) => PERSONAS.find((p) => p.id === id)?.name ?? fallback;

/** Stable seed from an employee code, so per-person fixtures never shuffle. */
const seedOf = (code: string) => Number(code.replace(/\D/g, "")) * 7919 + 17;

/* ==========================================================================
   1 · UNIFIED APPROVALS
   ========================================================================== */

export type ApprovalType =
  | "leave"
  | "regularisation"
  | "expense"
  | "travel"
  | "requisition"
  | "offer"
  | "asset"
  | "profile_change"
  | "pay_run";

export const APPROVAL_TYPE_META: Record<ApprovalType, { label: string; plural: string; slaHours: number; href: string }> = {
  leave: { label: "Leave", plural: "Leave", slaHours: 96, href: "/leave/approvals" },
  regularisation: { label: "Regularisation", plural: "Regularisations", slaHours: 72, href: "/attendance/amendments" },
  expense: { label: "Expense", plural: "Expenses", slaHours: 120, href: "/expenses" },
  travel: { label: "Travel", plural: "Travel", slaHours: 48, href: "/travel" },
  requisition: { label: "Requisition", plural: "Requisitions", slaHours: 120, href: "/requisitions" },
  offer: { label: "Offer", plural: "Offers", slaHours: 48, href: "/offers" },
  asset: { label: "Asset request", plural: "Asset requests", slaHours: 72, href: "/assets" },
  profile_change: { label: "Profile change", plural: "Profile changes", slaHours: 72, href: "/employees" },
  pay_run: { label: "Pay run", plural: "Pay run", slaHours: 24, href: "/payroll/runs" },
};

export type SlaState = "ok" | "at_risk" | "breached";
export type ChainStepStatus = "approved" | "pending" | "waiting" | "rejected" | "sent_back";

export interface ApprovalChainStep {
  step: string;
  approver: string;
  role: string;
  status: ChainStepStatus;
  at: string | null;
  /** When the step became actionable. */
  enteredAt: string | null;
  slaHours: number | null;
  comment?: string;
}

export interface ApprovalItem {
  id: string;
  type: ApprovalType;
  ref: string;
  title: string;
  summary: string;
  requesterCode: string;
  requesterName: string;
  department: string;
  submittedAt: string;
  /** INR, when the request carries money. */
  amount: number | null;
  ageHours: number;
  slaHours: number;
  slaState: SlaState;
  escalated: boolean;
  escalationNote: string | null;
  lowRisk: boolean;
  /** Why the AI triage considers it low-risk — or why not. */
  riskReasons: string[];
  details: [string, string][];
  chain: ApprovalChainStep[];
  /** Module screen holding the full record. */
  href: string;
}

const slaStateFor = (ageHours: number, slaHours: number): SlaState =>
  ageHours >= slaHours ? "breached" : ageHours >= slaHours * 0.75 ? "at_risk" : "ok";

interface ChainTemplate {
  step: string;
  role: string;
  approver: string;
}

/**
 * Turns a template into a timeline: steps before the persona's step are
 * approved, the persona's step is pending, steps after it are waiting.
 */
function buildChain(
  template: ChainTemplate[],
  currentIdx: number,
  submittedAt: string,
  slaHours: number,
): ApprovalChainStep[] {
  const ageHours = hoursSince(submittedAt);
  const spacing = currentIdx > 0 ? Math.min(20, ageHours / (currentIdx + 1)) : 0;
  return template.map((t, i) => {
    const at = i < currentIdx ? addHours(submittedAt, Math.round(spacing * i)) : null;
    const enteredAt =
      i === 0 ? submittedAt : i <= currentIdx ? addHours(submittedAt, Math.round(spacing * i)) : null;
    return {
      step: t.step,
      approver: t.approver,
      role: t.role,
      status: i < currentIdx ? "approved" : i === currentIdx ? "pending" : "waiting",
      at: i === 0 ? submittedAt : at,
      enteredAt,
      slaHours: i === 0 ? null : slaHours,
    };
  });
}

function finalise(
  base: Omit<ApprovalItem, "ageHours" | "slaHours" | "slaState" | "escalated" | "escalationNote">,
  escalateTo: string,
): ApprovalItem {
  const slaHours = APPROVAL_TYPE_META[base.type].slaHours;
  const current = base.chain.find((c) => c.status === "pending");
  const ageHours = Math.round(hoursSince(current?.enteredAt ?? base.submittedAt));
  const slaState = slaStateFor(ageHours, slaHours);
  const escalated = ageHours >= slaHours + 24;
  return {
    ...base,
    ageHours,
    slaHours,
    slaState,
    escalated,
    escalationNote: escalated
      ? `Auto-escalated to ${escalateTo} after ${Math.round((ageHours - slaHours) / 24)} day(s) past SLA`
      : null,
  };
}

/* ------------------------------------------------------------- leave */

function teamConflicts(a: LeaveApplication) {
  return LEAVE_APPLICATIONS.filter(
    (o) =>
      o.id !== a.id &&
      o.departmentId === a.departmentId &&
      o.status === "approved" &&
      o.fromDate <= a.toDate &&
      o.toDate >= a.fromDate,
  ).length;
}

/**
 * Some leave fixtures carry an applied-on date after the demo's "today"; the
 * inbox anchors those to a deterministic recent day so an age is never negative.
 */
function leaveSubmittedAt(a: LeaveApplication) {
  if (a.appliedOn <= DEMO_TODAY) return `${a.appliedOn}T10:15:00`;
  const back = (Number(a.id.replace(/\D/g, "")) % 6) + 1;
  const d = parseISO(DEMO_TODAY);
  d.setDate(d.getDate() - back);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T10:15:00`;
}

function fromLeave(a: LeaveApplication, approver: string, approverRole: string, viaEscalation = false): ApprovalItem {
  const submittedAt = leaveSubmittedAt(a);
  const bal = balanceFor(a.employeeCode, a.typeCode);
  const available = bal?.available ?? 0;
  const conflicts = teamConflicts(a);
  const lead = differenceInCalendarDays(parseISO(a.fromDate), parseISO(submittedAt.slice(0, 10)));
  const withinBalance = available >= a.days || a.typeCode === "LOP";
  const lowRisk = withinBalance && !a.isBackdated && a.days <= 3 && conflicts < 2;
  const reasons = [
    withinBalance
      ? `Within ${a.typeCode} balance — ${available} day(s) left after approval`
      : `Exceeds ${a.typeCode} balance by ${(a.days - available).toFixed(1)} day(s)`,
    conflicts === 0 ? "No one else in the team is off on these dates" : `${conflicts} teammate(s) already off on overlapping dates`,
    a.isBackdated ? "Backdated — touches an attendance period" : `Applied ${lead} day(s) in advance`,
  ];
  if (a.days > 3) reasons.push(`${a.days} days is above the 3-day auto-approve limit`);
  const manager = a.approverName;
  const template: ChainTemplate[] = [
    { step: "Submitted", role: "Requester", approver: a.employeeName },
    { step: "Reporting manager", role: "L1 approver", approver: viaEscalation ? manager : approver },
  ];
  if (viaEscalation) template.push({ step: "Escalation review", role: approverRole, approver });
  return finalise(
    {
      id: `leave:${a.id}`,
      type: "leave",
      ref: a.id.toUpperCase(),
      title: `${a.typeName} · ${a.days} day${a.days === 1 ? "" : "s"}`,
      summary: a.reason,
      requesterCode: a.employeeCode,
      requesterName: a.employeeName,
      department: a.department,
      submittedAt,
      amount: null,
      lowRisk,
      riskReasons: reasons,
      details: [
        ["Dates", `${a.fromDate} → ${a.toDate}`],
        ["Days deducted", String(a.days)],
        ["Balance available", String(available)],
        ["Supporting document", a.documentName ?? "None"],
      ],
      chain: buildChain(template, template.length - 1, submittedAt, APPROVAL_TYPE_META.leave.slaHours),
      href: "/leave/approvals",
    },
    "HR Admin",
  );
}

/* ---------------------------------------------------- regularisation */

function fromAmendment(a: Amendment, approver: string): ApprovalItem {
  const submittedAt = a.raisedAt.length > 10 ? a.raisedAt : `${a.raisedAt}T09:30:00`;
  const repeat = AMENDMENTS.filter((o) => o.code === a.code && o.date.slice(0, 7) === a.date.slice(0, 7)).length;
  const lowRisk = (a.type === "missed_punch_out" || a.type === "missed_punch_in") && repeat <= 2;
  const template: ChainTemplate[] = [
    { step: "Submitted", role: "Requester", approver: a.employeeName },
    { step: "Reporting manager", role: "L1 approver", approver },
  ];
  return finalise(
    {
      id: `regularisation:${a.id}`,
      type: "regularisation",
      ref: a.id.toUpperCase(),
      title: `${amendmentTypeLabel(a.type)} · ${a.date}`,
      summary: a.reason,
      requesterCode: a.code,
      requesterName: a.employeeName,
      department: a.department,
      submittedAt,
      amount: null,
      lowRisk,
      riskReasons: [
        lowRisk ? "Single missing punch — the other punch is on record" : "Changes both punch times",
        repeat <= 2 ? `${repeat} regularisation(s) this month — under the limit of 3` : `${repeat} regularisations this month — pattern flagged`,
        a.attachments.length > 0 ? "Evidence attached" : "No evidence attached",
      ],
      details: [
        ["Attendance date", a.date],
        ["Proposed in", a.proposedIn ? a.proposedIn.slice(11, 16) : "—"],
        ["Proposed out", a.proposedOut ? a.proposedOut.slice(11, 16) : "—"],
        ["Attachments", a.attachments.length ? a.attachments.map((x) => x.name).join(", ") : "None"],
      ],
      chain: buildChain(template, 1, submittedAt, APPROVAL_TYPE_META.regularisation.slaHours),
      href: "/attendance/amendments",
    },
    "HR Admin",
  );
}

/* ------------------------------------------------------------ expense */

function fromExpense(c: ExpenseClaim, approver: string, approverRole: string, financeStep: boolean): ApprovalItem {
  /* Claims carry a full timestamp now; a bare date gets a believable time. */
  const submittedAt = c.submittedOn?.includes("T") ? c.submittedOn : `${c.submittedOn ?? DEMO_TODAY}T11:20:00`;
  const lowRisk = !c.hasViolation && c.total <= 15000;
  const template: ChainTemplate[] = [
    { step: "Submitted", role: "Requester", approver: c.employeeName },
    { step: "Reporting manager", role: "L1 approver", approver: financeStep ? c.approverName : approver },
    { step: "Finance review", role: "Finance Controller", approver: financeStep ? approver : personaName("finance_controller", "Finance Controller") },
    { step: "Reimbursement", role: "Payroll", approver: personaName("payroll_admin", "Rahul Desai") },
  ];
  return finalise(
    {
      id: `expense:${c.id}${financeStep ? ":fin" : ""}`,
      type: "expense",
      ref: c.claimNo,
      title: c.purpose,
      summary: `${c.lines.length} line(s) · ${c.periodFrom} → ${c.periodTo}`,
      requesterCode: c.employeeCode,
      requesterName: c.employeeName,
      department: c.department,
      submittedAt,
      amount: c.total,
      lowRisk,
      riskReasons: [
        c.hasViolation ? `${c.violationCount} line(s) breach the expense policy` : "Every line is within policy limits",
        c.total <= 15000 ? "Under the ₹15,000 single-approver limit" : "Above the ₹15,000 single-approver limit",
        "Receipts matched to card statement",
      ],
      details: [
        ["Claim", c.claimNo],
        ["Period", `${c.periodFrom} → ${c.periodTo}`],
        ["Lines", String(c.lines.length)],
        ["Policy violations", String(c.violationCount)],
      ],
      chain: buildChain(template, financeStep ? 2 : 1, submittedAt, APPROVAL_TYPE_META.expense.slaHours),
      href: "/expenses",
    },
    approverRole === "Finance Controller" ? "CFO" : "Finance Controller",
  );
}

/* ------------------------------------------------------------- travel */

function fromTravel(t: TravelRequest, approver: string, financeStep: boolean): ApprovalItem {
  const submittedAt = t.submittedOn?.includes("T") ? t.submittedOn : `${t.submittedOn ?? DEMO_TODAY}T15:05:00`;
  const lowRisk = t.tripType === "Domestic" && t.estimatedCost <= 30000;
  const template: ChainTemplate[] = [
    { step: "Submitted", role: "Requester", approver: t.employeeName },
    { step: "Reporting manager", role: "L1 approver", approver: financeStep ? t.approverName : approver },
    { step: "Advance & budget", role: "Finance Controller", approver: financeStep ? approver : personaName("finance_controller", "Finance Controller") },
    { step: "Travel desk booking", role: "Travel desk", approver: "Travel desk" },
  ];
  return finalise(
    {
      id: `travel:${t.id}${financeStep ? ":fin" : ""}`,
      type: "travel",
      ref: t.requestNo,
      title: t.purpose,
      summary: `${t.tripType} · ${t.nights} night(s) · ${t.legs.length} leg(s)`,
      requesterCode: t.employeeCode,
      requesterName: t.employeeName,
      department: t.department,
      submittedAt,
      amount: t.estimatedCost,
      lowRisk,
      riskReasons: [
        t.tripType === "Domestic" ? "Domestic trip — no visa or forex" : "International — needs visa and forex review",
        t.estimatedCost <= 30000 ? "Estimated cost under the ₹30,000 band" : "Estimated cost above the ₹30,000 band",
        t.advanceRequested > 0 ? `Advance of ₹${t.advanceRequested.toLocaleString("en-IN")} requested` : "No cash advance requested",
      ],
      details: [
        ["Trip", `${t.startDate} → ${t.endDate}`],
        ["Type", t.tripType],
        ["Advance requested", t.advanceRequested ? `₹${t.advanceRequested.toLocaleString("en-IN")}` : "None"],
        ["Legs", t.legs.map((l) => `${l.from}→${l.to}`).join(", ") || "—"],
      ],
      chain: buildChain(template, financeStep ? 2 : 1, submittedAt, APPROVAL_TYPE_META.travel.slaHours),
      href: "/travel",
    },
    "Finance Controller",
  );
}

/* ------------------------------------------------- requisition / offer */

function fromRequisition(r: Requisition, approver: string, approverRole: string): ApprovalItem {
  const submittedAt = `${r.raisedDate}T10:00:00`;
  const template: ChainTemplate[] = [
    { step: "Raised", role: "Hiring manager", approver: employeeName(r.hiringManagerCode) },
    { step: "Department head", role: "Department Head", approver: personaName("department_head", "Department Head") },
    { step: approverRole === "Finance Controller" ? "Budget sign-off" : "HR business partner", role: approverRole, approver },
  ];
  return finalise(
    {
      id: `requisition:${r.id}`,
      type: "requisition",
      ref: r.code,
      title: `${r.role} × ${r.headcount}`,
      summary: r.justification,
      requesterCode: r.hiringManagerCode,
      requesterName: employeeName(r.hiringManagerCode),
      department: deptName(r.departmentId),
      submittedAt,
      amount: r.budgetMaxCtc * r.headcount,
      lowRisk: false,
      riskReasons: ["Headcount decisions always need a human sign-off", `${r.priority} priority`, r.replacementFor ? "Backfill for an exit" : "Net-new headcount"],
      details: [
        ["Headcount", String(r.headcount)],
        ["CTC band", `₹${(r.budgetMinCtc / 100000).toFixed(1)}L – ₹${(r.budgetMaxCtc / 100000).toFixed(1)}L`],
        ["Target close", r.targetCloseDate],
        ["Priority", r.priority],
      ],
      chain: buildChain(template, 2, submittedAt, APPROVAL_TYPE_META.requisition.slaHours),
      href: "/requisitions",
    },
    "Tenant Owner",
  );
}

function fromOffer(o: Offer, approver: string, approverRole: string): ApprovalItem {
  const submittedAt = `${o.offerDate}T12:00:00`;
  const chain: ApprovalChainStep[] = o.approvals.map((s, i) => ({
    step: i === 0 ? "Drafted" : s.role,
    approver: s.action === "Awaiting" ? approver : employeeName(s.actorCode),
    role: s.action === "Awaiting" ? approverRole : s.role,
    status: s.action === "Awaiting" ? "pending" : s.action === "Declined" ? "rejected" : "approved",
    at: s.at,
    enteredAt: s.at ?? submittedAt,
    slaHours: i === 0 ? null : APPROVAL_TYPE_META.offer.slaHours,
    comment: s.comment ?? undefined,
  }));
  if (!chain.some((c) => c.status === "pending")) {
    chain.push({ step: "Compensation sign-off", approver, role: approverRole, status: "pending", at: null, enteredAt: submittedAt, slaHours: 48 });
  }
  return finalise(
    {
      id: `offer:${o.id}`,
      type: "offer",
      ref: o.id.toUpperCase(),
      title: `${o.role} — ${o.candidateName}`,
      summary: o.notes,
      requesterCode: o.candidateId,
      requesterName: o.candidateName,
      department: deptName(o.departmentId),
      submittedAt,
      amount: o.ctc,
      lowRisk: false,
      riskReasons: ["Offers commit compensation — always reviewed by a person", `Joining ${o.joiningDate}`, o.joiningBonus ? "Includes a joining bonus" : "No joining bonus"],
      details: [
        ["Requisition", o.reqCode],
        ["Joining date", o.joiningDate],
        ["Valid till", o.validTill],
        ["Joining bonus", o.joiningBonus ? `₹${o.joiningBonus.toLocaleString("en-IN")}` : "None"],
      ],
      chain,
      href: "/offers",
    },
    "HR Admin",
  );
}

/* ------------------------------------------------------------- pay run */

function fromPayRun(r: PayRun, approver: string): ApprovalItem {
  const submittedAt = "2026-09-15T18:40:00";
  const template: ChainTemplate[] = [
    { step: "Calculated", role: "Payroll Admin", approver: personaName("payroll_admin", "Rahul Desai") },
    { step: "Exceptions cleared & locked", role: "Payroll Admin", approver: personaName("payroll_admin", "Rahul Desai") },
    { step: "Finance approval", role: "Finance Controller", approver },
    { step: "Bank advice release", role: "Treasury", approver: "Treasury" },
  ];
  return finalise(
    {
      id: `pay_run:${r.id}`,
      type: "pay_run",
      ref: r.code,
      title: `${r.label} payroll · ${r.employeeCount} employees`,
      summary: "Segregation of duties: the Payroll Admin built and locked this run; Finance approves the release.",
      requesterCode: "STL-0017",
      requesterName: personaName("payroll_admin", "Rahul Desai"),
      department: "Finance",
      submittedAt,
      amount: r.totals.net,
      lowRisk: false,
      riskReasons: ["Payroll release is never auto-approved", `${r.exceptionCount} exception(s) were cleared before lock`, `Pay date ${r.payDate}`],
      details: [
        ["Gross", `₹${r.totals.gross.toLocaleString("en-IN")}`],
        ["Deductions", `₹${r.totals.deductions.toLocaleString("en-IN")}`],
        ["Net payable", `₹${r.totals.net.toLocaleString("en-IN")}`],
        ["Employer cost", `₹${r.totals.employerCost.toLocaleString("en-IN")}`],
      ],
      chain: buildChain(template, 2, submittedAt, APPROVAL_TYPE_META.pay_run.slaHours),
      href: "/payroll/runs",
    },
    "Tenant Owner",
  );
}

/* --------------------------------------------- seeded asset requests */

export interface AssetRequest {
  id: string;
  employeeCode: string;
  item: string;
  category: "Laptop" | "Monitor" | "Accessory" | "Mobile" | "Software";
  cost: number;
  reason: string;
  requestedAt: string;
}

export const ASSET_REQUESTS: AssetRequest[] = [
  { id: "ar-2041", employeeCode: "STL-0144", item: "Dell P2723DE 27\" monitor", category: "Monitor", cost: 28400, reason: "Second screen for the payments dashboard rebuild.", requestedAt: "2026-09-15T10:20:00" },
  { id: "ar-2042", employeeCode: "STL-0147", item: "Logitech MX Keys keyboard", category: "Accessory", cost: 4200, reason: "Current keyboard has two dead keys.", requestedAt: "2026-09-14T16:05:00" },
  { id: "ar-2043", employeeCode: "STL-0148", item: "USB-C docking station", category: "Accessory", cost: 3900, reason: "Hot-desk in the L3 bay has no dock.", requestedAt: "2026-09-16T09:10:00" },
  { id: "ar-2044", employeeCode: "STL-0145", item: "MacBook Pro 14\" M4 (replacement)", category: "Laptop", cost: 189900, reason: "Current device is 4 years old and out of warranty; battery swelling.", requestedAt: "2026-09-11T11:40:00" },
  { id: "ar-2045", employeeCode: "STL-0143", item: "JetBrains All Products licence", category: "Software", cost: 24900, reason: "Needed for the Kotlin service migration.", requestedAt: "2026-09-13T14:30:00" },
  { id: "ar-2046", employeeCode: "STL-0146", item: "Jabra Evolve2 55 headset", category: "Accessory", cost: 4800, reason: "Client calls from the open floor.", requestedAt: "2026-09-15T17:55:00" },
  { id: "ar-2047", employeeCode: "STL-0149", item: "iPhone 16 (on-call device)", category: "Mobile", cost: 69900, reason: "Joining the US on-call rotation from October.", requestedAt: "2026-09-10T08:15:00" },
];

function fromAsset(a: AssetRequest, approver: string, approverRole: string, itStep: boolean): ApprovalItem {
  const emp = employeeByCode(a.employeeCode);
  const name = emp?.name ?? a.employeeCode;
  const lowRisk = (a.category === "Accessory" || a.category === "Monitor") && a.cost <= 30000;
  const template: ChainTemplate[] = [
    { step: "Requested", role: "Requester", approver: name },
    { step: "Reporting manager", role: "L1 approver", approver: itStep ? employeeName(emp?.managerCode) : approver },
    { step: "IT & Asset desk", role: "IT & Asset Admin", approver: itStep ? approver : personaName("it_admin", "IT & Asset Admin") },
    { step: "Issue & acknowledge", role: "Requester", approver: name },
  ];
  return finalise(
    {
      id: `asset:${a.id}${itStep ? ":it" : ""}`,
      type: "asset",
      ref: a.id.toUpperCase(),
      title: a.item,
      summary: a.reason,
      requesterCode: a.employeeCode,
      requesterName: name,
      department: emp ? deptName(emp.departmentId) : "—",
      submittedAt: a.requestedAt,
      amount: a.cost,
      lowRisk,
      riskReasons: [
        lowRisk ? `${a.category} under the ₹30,000 peripheral limit` : `${a.category} — capital item, needs review`,
        "Stock available at the Bengaluru store",
        "No duplicate request in the last 12 months",
      ],
      details: [
        ["Category", a.category],
        ["Estimated cost", `₹${a.cost.toLocaleString("en-IN")}`],
        ["Requested", a.requestedAt.slice(0, 10)],
        ["Deliver to", emp?.location ?? "—"],
      ],
      chain: buildChain(template, itStep ? 2 : 1, a.requestedAt, APPROVAL_TYPE_META.asset.slaHours),
      href: "/assets",
    },
    approverRole === "IT & Asset Admin" ? "Head of IT" : "IT & Asset Admin",
  );
}

/* ----------------------------------------- seeded profile-change requests */

export type ProfileField =
  | "Current address"
  | "Emergency contact"
  | "Personal email"
  | "Mobile number"
  | "Bank account"
  | "Marital status"
  | "Legal name";

export const SENSITIVE_FIELDS: ProfileField[] = ["Bank account", "Legal name", "Marital status"];

export interface ProfileChangeRequest {
  id: string;
  employeeCode: string;
  field: ProfileField;
  oldValue: string;
  newValue: string;
  document: string | null;
  requestedAt: string;
}

export const PROFILE_CHANGES: ProfileChangeRequest[] = [
  { id: "pc-3101", employeeCode: "STL-0143", field: "Current address", oldValue: "14, 3rd Cross, HSR Layout, Bengaluru 560102", newValue: "B-702, Prestige Lakeside, Varthur, Bengaluru 560087", document: "rental-agreement-2026.pdf", requestedAt: "2026-09-15T12:10:00" },
  { id: "pc-3102", employeeCode: "STL-0146", field: "Emergency contact", oldValue: "Ramesh Bhat · +91 98450 11223", newValue: "Akshay Rao · +91 99000 44871", document: null, requestedAt: "2026-09-16T08:45:00" },
  { id: "pc-3103", employeeCode: "STL-0144", field: "Bank account", oldValue: "HDFC Bank ···· 4471", newValue: "ICICI Bank ···· 9082", document: "cancelled-cheque-icici.jpg", requestedAt: "2026-09-12T17:30:00" },
  { id: "pc-3104", employeeCode: "STL-0212", field: "Marital status", oldValue: "Single", newValue: "Married", document: "marriage-certificate.pdf", requestedAt: "2026-09-11T10:05:00" },
  { id: "pc-3105", employeeCode: "STL-0088", field: "Personal email", oldValue: "s.kulkarni@gmail.com", newValue: "sameer.kulkarni@outlook.com", document: null, requestedAt: "2026-09-16T11:25:00" },
  { id: "pc-3106", employeeCode: "STL-0175", field: "Legal name", oldValue: "Pooja Sharma", newValue: "Pooja Sharma Verma", document: "gazette-notification.pdf", requestedAt: "2026-09-09T15:40:00" },
  { id: "pc-3107", employeeCode: "STL-0121", field: "Mobile number", oldValue: "+91 98860 33410", newValue: "+91 90080 72215", document: null, requestedAt: "2026-09-15T19:00:00" },
  { id: "pc-3108", employeeCode: "STL-0233", field: "Bank account", oldValue: "SBI ···· 1180", newValue: "Axis Bank ···· 6634", document: "axis-passbook.pdf", requestedAt: "2026-09-14T09:50:00" },
];

function fromProfileChange(p: ProfileChangeRequest, approver: string, approverRole: string): ApprovalItem {
  const emp = employeeByCode(p.employeeCode);
  const name = emp?.name ?? p.employeeCode;
  const sensitive = SENSITIVE_FIELDS.includes(p.field);
  const template: ChainTemplate[] = [
    { step: "Requested", role: "Employee", approver: name },
    { step: p.field === "Bank account" ? "Penny-drop verification" : "Document check", role: approverRole, approver },
    { step: "Record updated", role: "System", approver: "HRMS" },
  ];
  return finalise(
    {
      id: `profile_change:${p.id}`,
      type: "profile_change",
      ref: p.id.toUpperCase(),
      title: `${p.field} update`,
      summary: `${p.oldValue} → ${p.newValue}`,
      requesterCode: p.employeeCode,
      requesterName: name,
      department: emp ? deptName(emp.departmentId) : "—",
      submittedAt: p.requestedAt,
      amount: null,
      lowRisk: !sensitive,
      riskReasons: sensitive
        ? [`${p.field} is a sensitive field — needs a human check`, p.document ? `Proof attached: ${p.document}` : "No proof attached", "Payroll-impacting change"]
        : ["Non-sensitive contact field", "No payroll or statutory impact", "Employee verified with OTP at submission"],
      details: [
        ["Field", p.field],
        ["Current value", p.oldValue],
        ["Requested value", p.newValue],
        ["Proof", p.document ?? "Not required"],
      ],
      chain: buildChain(template, 1, p.requestedAt, APPROVAL_TYPE_META.profile_change.slaHours),
      href: emp ? `/employees/${emp.code}` : "/employees",
    },
    "HR Admin",
  );
}

/* --------------------------------------------------- persona routing */

const pendingLeave = LEAVE_APPLICATIONS.filter((a) => a.status === "pending");
const pendingAmendments = AMENDMENTS.filter((a) => a.status === "pending");
/* EXP_ALL_CLAIMS = the workplace claims + the finance fixtures — the same list /expenses shows. */
const submittedClaims = EXP_ALL_CLAIMS.filter((c) => c.status === "submitted");
const submittedTravel = TRAVEL_REQUESTS.filter((t) => t.status === "submitted");
const pendingReqs = REQUISITIONS.filter((r) => r.approvalStatus === "pending");
const pendingOffers = OFFERS.filter((o) => o.status === "pending");
const calculatedRun = PAY_RUNS.find((r) => r.status === "calculated" || r.status === "locked") ?? PAY_RUNS[0];

const byAgeDesc = (a: ApprovalItem, b: ApprovalItem) => b.ageHours - a.ageHours;

/**
 * Everything waiting on one persona. Routing mirrors the workflow engine's
 * rules: managers own L1, finance owns money above limits, HR owns
 * escalations and profile data, IT owns asset issue.
 */
export function approvalsFor(role: string, employeeCode: string, name: string): ApprovalItem[] {
  const items: ApprovalItem[] = [];
  const me = employeeByCode(employeeCode);
  const myDept = me?.departmentId;
  switch (role) {
    case "manager": {
      pendingLeave.filter((a) => a.approverCode === employeeCode).forEach((a) => items.push(fromLeave(a, name, "Reporting manager")));
      pendingAmendments.filter((a) => a.approverCode === employeeCode).forEach((a) => items.push(fromAmendment(a, name)));
      submittedClaims.filter((c) => c.approverCode === employeeCode).forEach((c) => items.push(fromExpense(c, name, "Reporting manager", false)));
      submittedTravel.filter((t) => t.approverCode === employeeCode).forEach((t) => items.push(fromTravel(t, name, false)));
      ASSET_REQUESTS.filter((a) => employeeByCode(a.employeeCode)?.managerCode === employeeCode).forEach((a) => items.push(fromAsset(a, name, "Reporting manager", false)));
      break;
    }
    case "department_head": {
      pendingLeave.filter((a) => a.approverCode === employeeCode).forEach((a) => items.push(fromLeave(a, name, "Reporting manager")));
      pendingAmendments.filter((a) => a.approverCode === employeeCode).forEach((a) => items.push(fromAmendment(a, name)));
      submittedClaims.filter((c) => c.approverCode === employeeCode).forEach((c) => items.push(fromExpense(c, name, "Reporting manager", false)));
      submittedTravel.filter((t) => t.approverCode === employeeCode).forEach((t) => items.push(fromTravel(t, name, false)));
      pendingLeave.filter((a) => a.departmentId === myDept && a.approverCode !== employeeCode && hoursSince(leaveSubmittedAt(a)) >= 96).slice(0, 4).forEach((a) => items.push(fromLeave(a, name, "Department Head", true)));
      pendingReqs.filter((r) => r.departmentId === myDept).forEach((r) => items.push(fromRequisition(r, name, "Department Head")));
      break;
    }
    case "hr_admin": {
      pendingLeave.filter((a) => hoursSince(leaveSubmittedAt(a)) >= 96).slice(0, 6).forEach((a) => items.push(fromLeave(a, name, "HR Admin", true)));
      PROFILE_CHANGES.filter((p) => p.field !== "Bank account").forEach((p) => items.push(fromProfileChange(p, name, "HR Admin")));
      pendingReqs.slice(0, 4).forEach((r) => items.push(fromRequisition(r, name, "HR business partner")));
      pendingOffers.slice(0, 3).forEach((o) => items.push(fromOffer(o, name, "HR Admin")));
      break;
    }
    case "payroll_admin": {
      PROFILE_CHANGES.filter((p) => p.field === "Bank account").forEach((p) => items.push(fromProfileChange(p, name, "Payroll Admin")));
      submittedClaims.filter((c) => !c.hasViolation).slice(0, 3).forEach((c) => items.push(fromExpense(c, name, "Payroll Admin", true)));
      break;
    }
    case "recruiter": {
      pendingReqs.filter((r) => r.recruiterCode === employeeCode).forEach((r) => items.push(fromRequisition(r, name, "Recruiter")));
      pendingOffers.slice(0, 3).forEach((o) => items.push(fromOffer(o, name, "Recruiter")));
      break;
    }
    case "finance_controller": {
      if (calculatedRun) items.push(fromPayRun(calculatedRun, name));
      submittedClaims.filter((c) => c.total > 15000).slice(0, 5).forEach((c) => items.push(fromExpense(c, name, "Finance Controller", true)));
      submittedTravel.filter((t) => t.advanceRequested > 0 || t.tripType === "International").slice(0, 4).forEach((t) => items.push(fromTravel(t, name, true)));
      pendingReqs.slice(0, 2).forEach((r) => items.push(fromRequisition(r, name, "Finance Controller")));
      break;
    }
    case "helpdesk_agent": {
      PROFILE_CHANGES.filter((p) => !SENSITIVE_FIELDS.includes(p.field)).forEach((p) => items.push(fromProfileChange(p, name, "HR Operations")));
      break;
    }
    case "it_admin": {
      ASSET_REQUESTS.forEach((a) => items.push(fromAsset(a, name, "IT & Asset Admin", true)));
      break;
    }
    case "tenant_owner":
    case "auditor": {
      if (calculatedRun) items.push(fromPayRun(calculatedRun, personaName("finance_controller", "Finance Controller")));
      pendingLeave.filter((a) => hoursSince(leaveSubmittedAt(a)) >= 120).slice(0, 4).forEach((a) => items.push(fromLeave(a, name, "Escalation", true)));
      pendingReqs.slice(0, 4).forEach((r) => items.push(fromRequisition(r, name, "Tenant Owner")));
      pendingOffers.slice(0, 2).forEach((o) => items.push(fromOffer(o, name, "Tenant Owner")));
      PROFILE_CHANGES.slice(0, 3).forEach((p) => items.push(fromProfileChange(p, name, "HR Admin")));
      ASSET_REQUESTS.slice(0, 2).forEach((a) => items.push(fromAsset(a, name, "IT & Asset Admin", true)));
      break;
    }
    default:
      break;
  }
  return items.sort(byAgeDesc);
}

/* ==========================================================================
   2 · NOTIFICATIONS (beyond the app-state seeds)
   ========================================================================== */

export type NotificationCategory = "approvals" | "mentions" | "system";

export interface FeedNotification {
  id: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
  href?: string;
  tone?: "info" | "warning" | "success" | "danger";
  category: NotificationCategory;
  actor?: string;
}

/** Categorises the app-state seeds, which carry no category of their own. */
export const SEED_CATEGORY: Record<string, NotificationCategory> = {
  n1: "approvals",
  n2: "system",
  n3: "system",
  n4: "approvals",
  n5: "approvals",
  n6: "system",
};

export const EXTRA_NOTIFICATIONS: FeedNotification[] = [
  { id: "x1", title: "Vikram Shah mentioned you", body: "“@Ananya can you add the load-test numbers to the Q3 goal before Friday?”", at: "2026-09-16T12:48:00", read: false, href: "/goals", tone: "info", category: "mentions", actor: "Vikram Shah" },
  { id: "x2", title: "AI triage ready", body: "Low-risk requests in your approvals inbox match policy and can be cleared in one step.", at: "2026-09-16T08:02:00", read: false, href: "/approvals", tone: "info", category: "approvals" },
  { id: "x3", title: "Priya Menon mentioned you in a helpdesk ticket", body: "“Looping in @you for the relocation allowance question on HD-1182.”", at: "2026-09-15T15:30:00", read: false, href: "/helpdesk", tone: "info", category: "mentions", actor: "Priya Menon" },
  { id: "x4", title: "New sign-in from Chrome on Windows", body: "Bengaluru, IN · 49.207.xx.xx. If this wasn't you, revoke the session.", at: "2026-09-15T09:14:00", read: true, href: "/me/security", tone: "warning", category: "system" },
  { id: "x5", title: "Tax declaration window closes 30 Sep", body: "Declare investments for FY 2026-27 to avoid higher TDS from October.", at: "2026-09-13T10:00:00", read: false, href: "/me/tax", tone: "warning", category: "system" },
  { id: "x6", title: "Passport expires in 74 days", body: "Upload a renewed copy to keep your travel profile valid.", at: "2026-09-12T09:00:00", read: true, href: "/me/documents", tone: "warning", category: "system" },
  { id: "x7", title: "Payslip for August 2026 is ready", body: "Net pay credited on 31 Aug 2026.", at: "2026-08-31T18:00:00", read: true, href: "/payslips", tone: "success", category: "system" },
  { id: "x8", title: "Karthik Reddy replied to your comment", body: "“Done — the review doc is updated with the latency charts.”", at: "2026-09-11T17:42:00", read: true, href: "/reviews", tone: "info", category: "mentions", actor: "Karthik Reddy" },
];

/* ==========================================================================
   3 · PROFILE EXTRAS (family, education, experience, contact)
   ========================================================================== */

export interface FamilyMember {
  name: string;
  relation: "Spouse" | "Father" | "Mother" | "Son" | "Daughter";
  dob: string;
  nominee: boolean;
  nomineeShare: number;
}

export interface EducationRow {
  degree: string;
  institution: string;
  year: number;
  grade: string;
}

export interface ExperienceRow {
  company: string;
  title: string;
  from: string;
  to: string;
}

export interface ProfileExtras {
  personalEmail: string;
  bloodGroup: string;
  maritalStatus: "Single" | "Married";
  nationality: string;
  currentAddress: string;
  permanentAddress: string;
  emergencyName: string;
  emergencyRelation: string;
  emergencyPhone: string;
  bankName: string;
  ifsc: string;
  family: FamilyMember[];
  education: EducationRow[];
  experience: ExperienceRow[];
  skillLevels: { skill: string; level: 1 | 2 | 3 | 4 | 5; endorsedBy: number }[];
}

const BANKS = [
  ["HDFC Bank", "HDFC0001234"],
  ["ICICI Bank", "ICIC0000456"],
  ["State Bank of India", "SBIN0040123"],
  ["Axis Bank", "UTIB0000789"],
  ["Kotak Mahindra Bank", "KKBK0008011"],
] as const;
const COLLEGES = ["RV College of Engineering", "PES University", "NIT Surathkal", "BITS Pilani", "VIT Vellore", "Christ University", "IIM Bangalore", "Symbiosis Institute of Business Management"];
const PREV = ["Infosys", "Wipro", "Flipkart", "Razorpay", "Freshworks", "Swiggy", "Accenture", "TCS", "Zoho", "Mindtree"];
const AREAS = ["HSR Layout", "Koramangala", "Indiranagar", "Whitefield", "Jayanagar", "Baner", "Kharadi", "Powai", "Andheri East"];

export function profileExtras(emp: Employee): ProfileExtras {
  const rng = mulberry32(seedOf(emp.code));
  const married = rng() < 0.6;
  const last = emp.lastName;
  const fatherFirst = pick(rng, ["Ramesh", "Suresh", "Mahesh", "Prakash", "Venkatesh", "Ashok"]);
  const motherFirst = pick(rng, ["Lakshmi", "Sunita", "Geetha", "Meena", "Radha", "Usha"]);
  const birthYear = Number(emp.dob.slice(0, 4));
  const family: FamilyMember[] = [
    { name: `${fatherFirst} ${last}`, relation: "Father", dob: `${birthYear - 29}-03-12`, nominee: !married, nomineeShare: married ? 0 : 50 },
    { name: `${motherFirst} ${last}`, relation: "Mother", dob: `${birthYear - 26}-11-02`, nominee: !married, nomineeShare: married ? 0 : 50 },
  ];
  if (married) {
    family.push({ name: `${pick(rng, emp.gender === "Female" ? ["Rohan", "Karan", "Aditya", "Varun"] : ["Sneha", "Divya", "Meera", "Pooja"])} ${last}`, relation: "Spouse", dob: `${birthYear + 1}-06-19`, nominee: true, nomineeShare: 100 });
    if (rng() < 0.6) family.push({ name: `${pick(rng, ["Aarav", "Anika", "Vihaan", "Diya"])} ${last}`, relation: rng() < 0.5 ? "Son" : "Daughter", dob: `${Math.min(2024, birthYear + 30)}-01-08`, nominee: false, nomineeShare: 0 });
  }
  const gradYear = birthYear + 22;
  const education: EducationRow[] = [
    { degree: pick(rng, ["B.E. Computer Science", "B.Tech Information Technology", "B.Com", "B.Sc Mathematics", "BBA"]), institution: pick(rng, COLLEGES), year: gradYear, grade: `${(7 + rng() * 2.6).toFixed(2)} CGPA` },
    { degree: "Class XII — CBSE", institution: pick(rng, ["Kendriya Vidyalaya", "Delhi Public School", "National Public School"]), year: gradYear - 4, grade: `${Math.round(82 + rng() * 15)}%` },
  ];
  if (emp.level <= 2 || rng() < 0.3) {
    education.unshift({ degree: pick(rng, ["MBA", "M.Tech", "PGDM"]), institution: pick(rng, COLLEGES.slice(5)), year: gradYear + 3, grade: `${(7.5 + rng() * 2).toFixed(2)} CGPA` });
  }
  const joinYear = Number(emp.joiningDate.slice(0, 4));
  const experience: ExperienceRow[] = [];
  let end = joinYear;
  const stints = Math.min(3, Math.max(0, Math.floor((joinYear - gradYear) / 3)));
  for (let i = 0; i < stints; i++) {
    const from = end - randInt(rng, 2, 3);
    experience.push({ company: pick(rng, PREV), title: i === 0 ? emp.designation.replace(/^(Senior |Lead |Principal )/, "") : "Associate", from: `${from}-07`, to: `${end}-05` });
    end = from;
  }
  const bank = pick(rng, BANKS);
  const area = pick(rng, AREAS);
  return {
    personalEmail: `${emp.firstName.toLowerCase()}.${emp.lastName.toLowerCase()}${randInt(rng, 7, 98)}@gmail.com`,
    bloodGroup: pick(rng, ["O+", "B+", "A+", "AB+", "O-", "B-"]),
    maritalStatus: married ? "Married" : "Single",
    nationality: emp.branchId === "EWR" ? "United States" : "Indian",
    currentAddress: `${randInt(rng, 2, 48)}, ${randInt(rng, 1, 9)}th Main, ${area}, ${emp.location}`,
    permanentAddress: `${randInt(rng, 10, 220)}, ${pick(rng, ["Gandhi Nagar", "Shastri Road", "MG Road", "Temple Street"])}, ${pick(rng, ["Mysuru", "Hubballi", "Nashik", "Coimbatore", "Udupi"])}`,
    emergencyName: family[married ? 2 : 0].name,
    emergencyRelation: family[married ? 2 : 0].relation,
    emergencyPhone: `+91 9${randInt(rng, 100000000, 999999999)}`.replace(/(\+91 \d{5})(\d{5})/, "$1 $2"),
    bankName: bank[0],
    ifsc: bank[1],
    family,
    education,
    experience,
    skillLevels: emp.skills.map((s, i) => ({ skill: s, level: (Math.max(2, 5 - i) as 1 | 2 | 3 | 4 | 5), endorsedBy: randInt(rng, 1, 14) })),
  };
}

/** Change requests the persona has raised themselves — feeds the /me timeline. */
export const myChangeRequests = (code: string) => PROFILE_CHANGES.filter((p) => p.employeeCode === code);

/* ==========================================================================
   4 · SECURITY — sessions and login history
   ========================================================================== */

export interface ActiveSession {
  id: string;
  device: string;
  browser: string;
  os: string;
  ip: string;
  location: string;
  lastActive: string;
  current: boolean;
  kind: "desktop" | "mobile" | "tablet";
}

export function sessionsFor(code: string): ActiveSession[] {
  const rng = mulberry32(seedOf(code) + 3);
  const ip = () => `${pick(rng, ["49.207", "106.51", "122.171", "183.82"])}.${randInt(rng, 10, 250)}.${randInt(rng, 10, 250)}`;
  return [
    { id: "s1", device: "ThinkPad T14 Gen 5", browser: "Chrome 141", os: "Windows 11", ip: ip(), location: "Bengaluru, IN", lastActive: DEMO_NOW, current: true, kind: "desktop" },
    { id: "s2", device: "iPhone 15", browser: "HRMS-NEW app 4.2", os: "iOS 19", ip: ip(), location: "Bengaluru, IN", lastActive: "2026-09-16T08:12:00", current: false, kind: "mobile" },
    { id: "s3", device: "MacBook Air", browser: "Safari 19", os: "macOS 16", ip: ip(), location: "Pune, IN", lastActive: "2026-09-14T21:40:00", current: false, kind: "desktop" },
    { id: "s4", device: "iPad Air", browser: "Safari 19", os: "iPadOS 19", ip: ip(), location: "Mysuru, IN", lastActive: "2026-09-08T19:05:00", current: false, kind: "tablet" },
  ];
}

export interface LoginEvent {
  id: string;
  at: string;
  outcome: "success" | "failed" | "mfa_challenge" | "locked";
  method: "Password + TOTP" | "SSO (Microsoft)" | "Password" | "Recovery code";
  ip: string;
  location: string;
  device: string;
}

export function loginHistoryFor(code: string): LoginEvent[] {
  const rng = mulberry32(seedOf(code) + 11);
  const out: LoginEvent[] = [];
  let t = NOW.getTime() - 25 * 60_000;
  for (let i = 0; i < 20; i++) {
    const r = rng();
    const outcome: LoginEvent["outcome"] = i === 6 ? "failed" : i === 7 ? "failed" : r < 0.08 ? "mfa_challenge" : "success";
    const d = new Date(t);
    out.push({
      id: `lh-${i + 1}`,
      at: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:00`,
      outcome,
      method: outcome === "failed" ? "Password" : r < 0.35 ? "SSO (Microsoft)" : "Password + TOTP",
      ip: `${pick(rng, ["49.207", "106.51", "122.171"])}.${randInt(rng, 10, 250)}.${randInt(rng, 10, 250)}`,
      location: i === 6 || i === 7 ? "Hyderabad, IN" : pick(rng, ["Bengaluru, IN", "Bengaluru, IN", "Pune, IN"]),
      device: pick(rng, ["Chrome · Windows", "HRMS-NEW app · iOS", "Safari · macOS"]),
    });
    t -= randInt(rng, 9, 30) * 3_600_000;
  }
  return out;
}

export const RECOVERY_CODES = [
  "K7QF-2MXP", "9BDR-T4WZ", "H3NV-8CJL", "P6YS-1KQE", "W2LA-7GHU",
  "D8ZT-5RBM", "M4CX-3PFN", "R1JE-6VWD", "T9UB-2SKY", "F5GH-4NLQ",
];

/* ==========================================================================
   5 · PREFERENCES
   ========================================================================== */

export const NOTIFICATION_CHANNELS = ["In-app", "Email", "WhatsApp", "Teams"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_TYPES: { id: string; label: string; help: string; mandatory?: NotificationChannel[] }[] = [
  { id: "approvals", label: "Approval requests", help: "A request is waiting for your decision." },
  { id: "decisions", label: "Decisions on my requests", help: "Your leave, expense or change request was approved or returned." },
  { id: "payslip", label: "Payslips & tax", help: "Payslip published, Form 16 ready, declaration reminders.", mandatory: ["Email"] },
  { id: "attendance", label: "Attendance alerts", help: "Missed punch, late mark, shortfall." },
  { id: "mentions", label: "Mentions & comments", help: "Someone @-mentioned you or replied." },
  { id: "announcements", label: "Announcements", help: "Company-wide and branch announcements." },
  { id: "security", label: "Security alerts", help: "New sign-in, password or MFA change.", mandatory: ["In-app", "Email"] },
  { id: "ai", label: "AI insights & nudges", help: "Copilot summaries, triage suggestions, reminders." },
];

export const DEFAULT_PREFERENCES: Record<string, Record<NotificationChannel, boolean>> = Object.fromEntries(
  NOTIFICATION_TYPES.map((t) => [
    t.id,
    {
      "In-app": true,
      Email: ["approvals", "decisions", "payslip", "security"].includes(t.id),
      WhatsApp: ["approvals", "payslip"].includes(t.id),
      Teams: ["approvals", "mentions"].includes(t.id),
    },
  ]),
);

/* ==========================================================================
   6 · DOCUMENTS
   ========================================================================== */

/** "XXXX XXXX 4821" style masking for identity numbers. */
export function maskId(value: string, visible = 4) {
  const clean = value.replace(/\s/g, "");
  return `${"•".repeat(Math.max(0, clean.length - visible))}${clean.slice(-visible)}`;
}

export function aadhaarFor(code: string) {
  const rng = mulberry32(seedOf(code) + 29);
  return `${randInt(rng, 2000, 9999)} ${randInt(rng, 1000, 9999)} ${randInt(rng, 1000, 9999)}`;
}

/* ==========================================================================
   7 · TAX — old vs new regime, FY 2026-27
   ========================================================================== */

export const TAX_FY = "FY 2026-27";
export const DECLARATION_WINDOW = { opens: "2026-09-01", closes: "2026-09-30" };

/** Old regime slabs — assumed unchanged from FY 2025-26 for individuals below 60. */
export const OLD_REGIME_SLABS = [
  { from: 0, to: 250000, rate: 0 },
  { from: 250000, to: 500000, rate: 0.05 },
  { from: 500000, to: 1000000, rate: 0.2 },
  { from: 1000000, to: null as number | null, rate: 0.3 },
];
export const OLD_STANDARD_DEDUCTION = 50000;
export const OLD_REBATE_CEILING = 500000;

export type DeclarationSection = "80C" | "80D" | "HRA" | "24B" | "80CCD1B";

export interface DeclarationItem {
  id: string;
  section: DeclarationSection;
  label: string;
  help: string;
  limit: number;
  declared: number;
  proof: "pending" | "verified" | "rejected" | "not_uploaded";
  proofFile: string | null;
  rejectReason?: string;
}

export function seedDeclarations(code: string): DeclarationItem[] {
  const rng = mulberry32(seedOf(code) + 41);
  return [
    { id: "d1", section: "80C", label: "EPF (employee share, auto)", help: "Deducted through payroll — counted automatically.", limit: 150000, declared: 21600, proof: "verified", proofFile: "payroll-epf-statement.pdf" },
    { id: "d2", section: "80C", label: "PPF / ELSS / life insurance", help: "Public Provident Fund, ELSS mutual funds, LIC premiums, children's tuition.", limit: 150000, declared: 90000 + randInt(rng, 0, 3) * 10000, proof: "pending", proofFile: "elss-statement-2026.pdf" },
    { id: "d3", section: "80D", label: "Health insurance — self & family", help: "Premium for self, spouse and children. Limit ₹25,000.", limit: 25000, declared: 18400, proof: "verified", proofFile: "star-health-premium.pdf" },
    { id: "d4", section: "80D", label: "Health insurance — senior-citizen parents", help: "Premium for parents aged 60+. Limit ₹50,000.", limit: 50000, declared: 32000, proof: "rejected", proofFile: "parents-policy.jpg", rejectReason: "Policy schedule page missing — upload the page with insured names." },
    { id: "d5", section: "HRA", label: "House rent paid", help: "Annual rent. Landlord PAN mandatory above ₹1,00,000 a year.", limit: 0, declared: 12 * (18000 + randInt(rng, 0, 6) * 2000), proof: "not_uploaded", proofFile: null },
    { id: "d6", section: "24B", label: "Home-loan interest (self-occupied)", help: "Interest on a loan for a self-occupied house. Limit ₹2,00,000.", limit: 200000, declared: 0, proof: "not_uploaded", proofFile: null },
    { id: "d7", section: "80CCD1B", label: "NPS — additional contribution", help: "Voluntary NPS Tier-I contribution, over and above 80C. Limit ₹50,000.", limit: 50000, declared: 50000, proof: "pending", proofFile: "nps-tier1-receipt.pdf" },
  ];
}

export interface RegimeResult {
  regime: "old" | "new";
  gross: number;
  exemptions: number;
  standardDeduction: number;
  deductions: number;
  taxable: number;
  slabTax: number;
  rebate: number;
  cess: number;
  total: number;
  monthly: number;
  lines: { label: string; amount: number }[];
}

function oldSlabTax(taxable: number) {
  let tax = 0;
  for (const s of OLD_REGIME_SLABS) {
    const upper = s.to ?? Number.MAX_SAFE_INTEGER;
    const slice = Math.max(0, Math.min(taxable, upper) - s.from);
    tax += slice * s.rate;
  }
  return tax;
}

/**
 * Computes both regimes for one employee. Uses the payroll CTC breakup so the
 * gross matches the payslip. HRA exemption assumes a metro city (50 % of basic).
 */
export function compareRegimes(emp: Employee, decl: DeclarationItem[]) {
  /* The payroll breakup is monthly; tax is computed on the annual figures. */
  const b = ctcBreakup(emp.gradeId, emp.ctc);
  const gross = b.gross * 12;
  const basic = b.basic * 12;
  const hra = b.hra * 12;
  const sum = (s: DeclarationSection) => decl.filter((d) => d.section === s && d.proof !== "rejected").reduce((a, d) => a + d.declared, 0);
  const rent = sum("HRA");
  const hraExempt = Math.max(0, Math.round(Math.min(hra, rent - 0.1 * basic, 0.5 * basic)));
  const c80 = Math.min(150000, sum("80C"));
  const d80 = Math.min(75000, sum("80D"));
  const h24 = Math.min(200000, sum("24B"));
  const nps = Math.min(50000, sum("80CCD1B"));
  const pt = 2400;
  const oldDeductions = c80 + d80 + h24 + nps + pt;
  const oldTaxable = Math.max(0, gross - hraExempt - OLD_STANDARD_DEDUCTION - oldDeductions);
  const oldSlab = Math.round(oldSlabTax(oldTaxable));
  const oldRebate = oldTaxable <= OLD_REBATE_CEILING ? Math.min(oldSlab, 12500) : 0;
  const oldCess = Math.round((oldSlab - oldRebate) * CESS_RATE);
  const oldTotal = oldSlab - oldRebate + oldCess;
  const oldR: RegimeResult = {
    regime: "old",
    gross,
    exemptions: hraExempt,
    standardDeduction: OLD_STANDARD_DEDUCTION,
    deductions: oldDeductions,
    taxable: oldTaxable,
    slabTax: oldSlab,
    rebate: oldRebate,
    cess: oldCess,
    total: oldTotal,
    monthly: Math.round(oldTotal / 12),
    lines: [
      { label: "HRA exemption (Sec 10(13A))", amount: hraExempt },
      { label: "Standard deduction", amount: OLD_STANDARD_DEDUCTION },
      { label: "Professional tax (Sec 16(iii))", amount: pt },
      { label: "Sec 80C (cap ₹1,50,000)", amount: c80 },
      { label: "Sec 80D (cap ₹75,000)", amount: d80 },
      { label: "Sec 24(b) (cap ₹2,00,000)", amount: h24 },
      { label: "Sec 80CCD(1B) (cap ₹50,000)", amount: nps },
    ],
  };
  const t = computeTds(gross);
  const newR: RegimeResult = {
    regime: "new",
    gross,
    exemptions: 0,
    standardDeduction: gross - t.annualTaxable,
    deductions: 0,
    taxable: t.annualTaxable,
    slabTax: t.slabTax,
    rebate: t.slabTax - t.taxAfterRebate,
    cess: t.cess,
    total: t.annualTax,
    monthly: t.monthly,
    lines: [{ label: "Standard deduction", amount: gross - t.annualTaxable }],
  };
  return { annual: { gross, basic, hra }, old: oldR, new: newR, better: newR.total <= oldR.total ? ("new" as const) : ("old" as const), saving: Math.abs(oldR.total - newR.total) };
}

/* ==========================================================================
   8 · ONBOARDING
   ========================================================================== */

export type TaskOwner = "You" | "HR" | "IT" | "Manager";

export interface OnboardingTask {
  id: string;
  owner: TaskOwner;
  title: string;
  due: string;
  done: boolean;
  doneOn: string | null;
  needsUpload?: boolean;
}

const addDays = (iso: string, n: number) => {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const TASK_SPECS: { owner: TaskOwner; title: string; offset: number; needsUpload?: boolean }[] = [
  { owner: "You", title: "Upload Aadhaar and PAN", offset: -5, needsUpload: true },
  { owner: "You", title: "Upload relieving letter from previous employer", offset: -3, needsUpload: true },
  { owner: "You", title: "Add bank account and cancelled cheque", offset: 0, needsUpload: true },
  { owner: "You", title: "Submit Form 11 (EPF declaration) and nominations", offset: 2 },
  { owner: "You", title: "Complete POSH and code-of-conduct e-learning", offset: 7 },
  { owner: "You", title: "Declare investments for TDS", offset: 14 },
  { owner: "HR", title: "Issue appointment letter", offset: -7 },
  { owner: "HR", title: "Create employee record and UAN link", offset: 0 },
  { owner: "HR", title: "Day-1 induction: policies, benefits, holidays", offset: 0 },
  { owner: "HR", title: "Enrol in group health insurance", offset: 5 },
  { owner: "IT", title: "Provision laptop and accessories", offset: -1 },
  { owner: "IT", title: "Create email, SSO and MFA", offset: -1 },
  { owner: "IT", title: "Grant access to Jira, GitHub and Slack", offset: 1 },
  { owner: "Manager", title: "Assign onboarding buddy", offset: -2 },
  { owner: "Manager", title: "Share 30-60-90 day plan", offset: 3 },
  { owner: "Manager", title: "First 1:1 and goal setting", offset: 10 },
];

export function onboardingTasks(emp: Employee): OnboardingTask[] {
  const joined = emp.joiningDate;
  const recent = isRecentJoiner(emp);
  return TASK_SPECS.map((t, i) => {
    const due = addDays(joined, t.offset);
    /* For a live joiner, the EPF form is deliberately overdue so the checklist has something to chase. */
    const done = due < DEMO_TODAY && !(recent && i === 3);
    return { id: `ob-${i + 1}`, owner: t.owner, title: t.title, due, done, doneOn: done ? addDays(due, -1) : null, needsUpload: t.needsUpload };
  });
}

/** A joiner within the last 45 days still has a live checklist. */
export const isRecentJoiner = (emp: Employee) =>
  differenceInCalendarDays(parseISO(DEMO_TODAY), parseISO(emp.joiningDate)) <= 45 &&
  emp.joiningDate <= DEMO_TODAY;

/** The most recent joiner in the company — used for the "preview a new joiner" toggle. */
export const LATEST_JOINER: Employee =
  EMPLOYEES.filter((e) => e.joiningDate <= DEMO_TODAY && e.status !== "exited")
    .slice()
    .sort((a, b) => (a.joiningDate < b.joiningDate ? 1 : -1))[0];

export function firstWeekSchedule(emp: Employee) {
  const j = emp.joiningDate;
  return [
    { day: addDays(j, 0), items: ["09:30 Welcome & ID card", "11:00 HR induction", "14:00 Laptop handover with IT", "16:00 Lunch with your buddy"] },
    { day: addDays(j, 1), items: ["10:00 Meet your manager", "11:30 Team introductions", "15:00 Product walkthrough"] },
    { day: addDays(j, 2), items: ["10:00 Security & compliance training", "14:00 Shadow a team stand-up"] },
    { day: addDays(j, 3), items: ["10:00 Tooling setup clinic", "16:00 Q&A with the department head"] },
    { day: addDays(j, 4), items: ["11:00 First-week retro with your buddy", "15:00 30-60-90 plan review"] },
  ];
}

/* ==========================================================================
   9 · TENANTS (select-tenant / register)
   ========================================================================== */

export const MY_TENANTS = [
  { id: TENANT.id, name: TENANT.name, role: "HR Admin", region: "India · Asia/Kolkata", plan: "Enterprise", employees: TENANT.headcount, lastUsed: "2026-09-16T14:20:00" },
  { id: "stellar-us", name: "Stellar Technologies Inc.", role: "HR Admin", region: "United States · America/New_York", plan: "Pro", employees: 38, lastUsed: "2026-09-12T19:05:00" },
  { id: "stellar-sandbox", name: "Stellar — Sandbox", role: "Tenant Owner", region: "India · Asia/Kolkata", plan: "Free", employees: 25, lastUsed: "2026-08-29T11:40:00" },
];

export const PLANS = [
  { id: "free", name: "Free", price: "₹0", unit: "up to 25 employees", features: ["Core HR & directory", "Attendance & leave", "Email support"] },
  { id: "pro", name: "Pro", price: "₹149", unit: "per employee / month", features: ["Everything in Free", "Payroll & statutory compliance", "Hiring & onboarding", "AI Copilot (500 queries/mo)"] },
  { id: "enterprise", name: "Enterprise", price: "Custom", unit: "annual contract", features: ["Everything in Pro", "SSO, SCIM & audit export", "Unlimited AI & policy knowledge base", "Dedicated success manager"] },
] as const;

export { DEMO_TODAY, DEMO_NOW };
