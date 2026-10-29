import { differenceInDays, parseISO } from "date-fns";
import { employeeByCode } from "./employees";
import { deptName } from "./org";
import {
  CANDIDATES,
  CANDIDATE_SOURCES,
  HIRING_KPIS,
  INTERVIEWS,
  OFFERS,
  RECRUITERS,
  RECRUITMENT_FUNNEL,
  requisitionByCode,
  type Candidate,
  type PipelineStage,
} from "./hiring";

/* ============================================================================
   Agencies and recruiter analytics. Every pipeline number is computed from
   CANDIDATES / OFFERS / INTERVIEWS, so the funnel here is the board's funnel.
   ========================================================================== */

/* ---------------------------------------------------------------- agencies */

export type InvoiceStatus = "pending" | "approved" | "paid" | "disputed";

export interface AgencyInvoice {
  id: string;
  hireName: string;
  role: string;
  ctc: number;
  feePct: number;
  fee: number;
  gst: number;
  total: number;
  raisedOn: string;
  status: InvoiceStatus;
}

export interface Agency {
  id: string;
  name: string;
  contact: string;
  email: string;
  focus: string;
  feePct: number;
  /** Days from brief to first shortlist. */
  slaDays: number;
  slaMetPct: number;
  replacementDays: number;
  contractEnd: string;
  status: "active" | "on_hold";
  /** Pipeline candidates this cycle (from mock/hiring.ts). */
  liveCandidateIds: string[];
  submissionsFy: number;
  interviewsFy: number;
  hiresFy: number;
  invoices: AgencyInvoice[];
}

const invoice = (id: string, hireName: string, role: string, ctc: number, feePct: number, raisedOn: string, status: InvoiceStatus): AgencyInvoice => {
  const fee = Math.round((ctc * feePct) / 100);
  const gst = Math.round(fee * 0.18);
  return { id, hireName, role, ctc, feePct, fee, gst, total: fee + gst, raisedOn, status };
};

const empInvoice = (id: string, code: string, feePct: number, status: InvoiceStatus) => {
  const e = employeeByCode(code)!;
  return invoice(id, e.name, e.designation, e.ctc, feePct, e.joiningDate, status);
};

const sandeep = OFFERS.find((o) => o.candidateName === "Sandeep Rathi")!;

export const AGENCIES: Agency[] = [
  {
    id: "AGY-01", name: "Kestrel Search Partners", contact: "Meera Raghavan", email: "meera@kestrelsearch.in",
    focus: "Engineering & SRE · Bengaluru", feePct: 8.33, slaDays: 7, slaMetPct: 86, replacementDays: 90,
    contractEnd: "2027-03-31", status: "active",
    liveCandidateIds: ["CAN-2026-009", "CAN-2026-012", "CAN-2026-060"],
    submissionsFy: 41, interviewsFy: 17, hiresFy: 4,
    invoices: [empInvoice("INV-KSP-0412", "STL-0044", 8.33, "approved"), empInvoice("INV-KSP-0398", "STL-0317", 8.33, "paid")],
  },
  {
    id: "AGY-02", name: "Northbridge Talent", contact: "Abhay Kulkarni", email: "abhay@northbridgetalent.in",
    focus: "Engineering & CS · Pune", feePct: 7.5, slaDays: 10, slaMetPct: 71, replacementDays: 60,
    contractEnd: "2026-12-31", status: "active",
    liveCandidateIds: ["CAN-2026-022", "CAN-2026-054"],
    submissionsFy: 28, interviewsFy: 9, hiresFy: 2,
    invoices: [empInvoice("INV-NBT-2207", "STL-0083", 7.5, "disputed")],
  },
  {
    id: "AGY-03", name: "Meridian Executive Search", contact: "Farah Siddiqui", email: "farah@meridianexec.in",
    focus: "Enterprise sales & leadership", feePct: 12, slaDays: 14, slaMetPct: 92, replacementDays: 120,
    contractEnd: "2027-06-30", status: "active",
    liveCandidateIds: ["CAN-2026-036"],
    submissionsFy: 19, interviewsFy: 11, hiresFy: 3,
    invoices: [
      invoice("INV-MES-1180", sandeep.candidateName, sandeep.role, sandeep.ctc, 12, (sandeep.respondedAt ?? sandeep.offerDate).slice(0, 10), "pending"),
      empInvoice("INV-MES-1164", "STL-0180", 12, "paid"),
    ],
  },
  {
    id: "AGY-04", name: "Atlantic Talent Group", contact: "Jordan Ellis", email: "jordan.ellis@atlantictalent.com",
    focus: "US East — Newark, NJ", feePct: 15, slaDays: 10, slaMetPct: 64, replacementDays: 90,
    contractEnd: "2027-01-31", status: "active",
    liveCandidateIds: ["CAN-2026-026", "CAN-2026-045"],
    submissionsFy: 14, interviewsFy: 5, hiresFy: 1,
    invoices: [],
  },
  {
    id: "AGY-05", name: "PeopleFirst Staffing", contact: "Rakesh Jain", email: "rakesh@peoplefirst.co.in",
    focus: "Volume hiring — support roles", feePct: 6, slaDays: 5, slaMetPct: 48, replacementDays: 30,
    contractEnd: "2026-10-31", status: "on_hold",
    liveCandidateIds: [],
    submissionsFy: 36, interviewsFy: 6, hiresFy: 0,
    invoices: [],
  },
];

/* ----------------------------------------------------------- stage reached */

const ORDER: PipelineStage[] = ["applied", "screening", "interview", "offer", "hired"];
const rank = (s: PipelineStage) => ORDER.indexOf(s);

/** Furthest stage a candidate reached — a rejected candidate counts where they dropped out. */
export const reached = (c: Candidate) => (c.stage === "rejected" ? (c.rejectedAtStage ?? "applied") : c.stage);
const reachedAtLeast = (c: Candidate, s: PipelineStage) => rank(reached(c)) >= rank(s);

export const FUNNEL = RECRUITMENT_FUNNEL;

/* ---------------------------------------------------------- time to hire */

const hired = CANDIDATES.filter((c) => c.stage === "hired");

export const TIME_TO_HIRE_BY_DEPT = Array.from(new Set(CANDIDATES.map((c) => c.departmentId))).map((dept) => {
  const h = hired.filter((c) => c.departmentId === dept);
  const active = CANDIDATES.filter((c) => c.departmentId === dept && c.stage !== "hired" && c.stage !== "rejected");
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  return {
    dept: deptName(dept),
    applyToHire: avg(h.map((c) => differenceInDays(parseISO(c.stageSince), parseISO(c.appliedDate)))),
    reqToHire: avg(
      h.map((c) => differenceInDays(parseISO(c.stageSince), parseISO(requisitionByCode(c.reqCode)!.raisedDate))),
    ),
    activeAge: avg(active.map((c) => differenceInDays(parseISO(c.stageSince), parseISO(c.appliedDate)) + c.stageAgeDays)),
    hires: h.length,
  };
});

/* ------------------------------------------------------ source effectiveness */

export const SOURCE_EFFECTIVENESS = CANDIDATE_SOURCES.map((source) => {
  const cs = CANDIDATES.filter((c) => c.source === source);
  const interviewed = cs.filter((c) => reachedAtLeast(c, "interview")).length;
  const offered = cs.filter((c) => reachedAtLeast(c, "offer")).length;
  const hires = cs.filter((c) => c.stage === "hired").length;
  return {
    source,
    candidates: cs.length,
    interviewed,
    offered,
    hires,
    interviewRate: cs.length ? Math.round((interviewed / cs.length) * 1000) / 10 : 0,
    hireRate: cs.length ? Math.round((hires / cs.length) * 1000) / 10 : 0,
  };
});

/* -------------------------------------------------------- offer acceptance */

export const OFFER_ACCEPTANCE = {
  rate: HIRING_KPIS.offerAcceptanceRate,
  accepted: OFFERS.filter((o) => o.status === "hired").length,
  declined: OFFERS.filter((o) => o.status === "rejected").length,
  open: OFFERS.filter((o) => o.status === "approved" || o.status === "pending").length,
};

/* ------------------------------------------------------ recruiter leaderboard */

export const RECRUITER_LEADERBOARD = RECRUITERS.map((r) => {
  const owned = CANDIDATES.filter((c) => c.ownerCode === r.code);
  const ids = new Set(owned.map((c) => c.id));
  const h = owned.filter((c) => c.stage === "hired");
  return {
    code: r.code,
    name: r.name,
    candidates: owned.length,
    active: owned.filter((c) => c.stage !== "hired" && c.stage !== "rejected").length,
    interviews: INTERVIEWS.filter((i) => ids.has(i.candidateId)).length,
    offers: owned.filter((c) => reachedAtLeast(c, "offer")).length,
    hires: h.length,
    avgDaysToHire: h.length
      ? Math.round(h.reduce((a, c) => a + differenceInDays(parseISO(c.stageSince), parseISO(c.appliedDate)), 0) / h.length)
      : null,
  };
}).sort((a, b) => b.hires - a.hires || b.offers - a.offers);

/* -------------------------------------------------- diversity of pipeline */

/** Voluntary EEO self-declaration captured on the application form. */
const WOMEN = new Set([
  "Sneha", "Harini", "Ritika", "Gayatri", "Madhuri", "Ishita", "Deepika", "Bhavana", "Swati", "Emily", "Rachel",
  "Aishwarya", "Namrata", "Pooja", "Tanvi", "Anjali", "Rashmi", "Divya", "Lakshmi", "Vaishnavi", "Sarah", "Jessica",
  "Meera", "Nandini", "Shreya", "Neha", "Sanjana", "Priyanka", "Zoya", "Aditi",
]);
const UNDISCLOSED = new Set(["Kiran", "Ravi"]);

export const declaredGender = (c: Candidate) => {
  const first = c.name.split(" ")[0];
  return UNDISCLOSED.has(first) ? "Not disclosed" : WOMEN.has(first) ? "Women" : "Men";
};

export const DIVERSITY_BY_STAGE = ORDER.map((stage) => {
  const at = CANDIDATES.filter((c) => reachedAtLeast(c, stage));
  return {
    stage: stage[0].toUpperCase() + stage.slice(1),
    women: at.filter((c) => declaredGender(c) === "Women").length,
    men: at.filter((c) => declaredGender(c) === "Men").length,
    undisclosed: at.filter((c) => declaredGender(c) === "Not disclosed").length,
  };
});
