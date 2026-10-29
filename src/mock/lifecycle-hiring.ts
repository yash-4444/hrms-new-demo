import { addDays, differenceInDays, format, parseISO } from "date-fns";
import { EMPLOYEES, employeeByCode } from "./employees";
import { DEMO_TODAY } from "./org";
import {
  CANDIDATES,
  JOBS,
  OFFERS,
  REQUISITIONS,
  requisitionByCode,
  type PipelineStage,
} from "./hiring";

/* ============================================================================
   Hiring extensions — referrals, talent pool, agencies and the analytics that
   sit on top of the pipeline. Everything that can be derived from
   `mock/hiring.ts` is derived, so the counts here match the candidate board.
   ========================================================================== */

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const TODAY = parseISO(DEMO_TODAY);
const codeByName = (name: string) => EMPLOYEES.find((e) => e.name === name)?.code ?? "STL-0009";

/* --------------------------------------------------------------- referrals */

export type BonusStatus = "not_eligible" | "in_pipeline" | "pending_tenure" | "pending_approval" | "approved" | "paid";

export const BONUS_STATUS_LABEL: Record<BonusStatus, string> = {
  not_eligible: "Not eligible",
  in_pipeline: "In pipeline",
  pending_tenure: "Awaiting 90 days",
  pending_approval: "Awaiting HR approval",
  approved: "Approved — next payroll",
  paid: "Paid",
};

export interface ReferralBonusRule {
  id: string;
  band: string;
  grades: string[];
  amount: number;
  note: string;
}

/** Paid through payroll once the hire completes 90 days of service. */
export const REFERRAL_RULES: ReferralBonusRule[] = [
  { id: "RB-1", band: "Associate & Executive", grades: ["G1", "G2"], amount: 25000, note: "Most individual-contributor roles." },
  { id: "RB-2", band: "Senior", grades: ["G3"], amount: 50000, note: "Senior IC, PM and AE roles." },
  { id: "RB-3", band: "Lead & Manager", grades: ["G4", "G5"], amount: 75000, note: "Staff, lead and people-manager roles." },
  { id: "RB-4", band: "Critical requisitions", grades: ["Critical"], amount: 100000, note: "Any requisition flagged Critical — replaces the band amount." },
];
export const REFERRAL_TENURE_DAYS = 90;

export function bonusFor(gradeId: string, critical: boolean) {
  if (critical) return REFERRAL_RULES[3].amount;
  return REFERRAL_RULES.find((r) => r.grades.includes(gradeId))?.amount ?? 25000;
}

export interface Referral {
  id: string;
  candidateName: string;
  candidateEmail: string;
  role: string;
  reqCode: string | null;
  referrerCode: string;
  referrerName: string;
  relationship: string;
  submittedOn: string;
  stage: PipelineStage | "submitted";
  candidateId: string | null;
  hiredEmployeeCode: string | null;
  joiningDate: string | null;
  bonus: number;
  bonusStatus: BonusStatus;
  /** Payroll period the bonus lands in, once approved or paid. */
  payoutPeriod: string | null;
}

const RELATIONSHIPS = ["Former colleague", "College batchmate", "Former colleague", "Friend", "Ex-manager's team"];

/* Live referrals come straight from the pipeline. */
const LIVE: Referral[] = CANDIDATES.filter((c) => c.source === "Referral").map((c, i) => {
  const req = requisitionByCode(c.reqCode)!;
  const offer = OFFERS.find((o) => o.candidateId === c.id);
  const referrerCode = codeByName(c.referredBy ?? "");
  const bonus = bonusFor(req.gradeId, req.priority === "Critical");
  const joined = offer?.status === "hired" ? offer.joiningDate : null;
  return {
    id: `REF-2026-${String(i + 21).padStart(3, "0")}`,
    candidateName: c.name,
    candidateEmail: c.email,
    role: c.role,
    reqCode: c.reqCode,
    referrerCode,
    referrerName: employeeByCode(referrerCode)?.name ?? c.referredBy ?? "",
    relationship: RELATIONSHIPS[i % RELATIONSHIPS.length],
    submittedOn: c.appliedDate,
    stage: c.stage,
    candidateId: c.id,
    hiredEmployeeCode: null,
    joiningDate: joined,
    bonus,
    bonusStatus: c.stage === "rejected" ? "not_eligible" : joined ? "pending_tenure" : "in_pipeline",
    payoutPeriod: null,
  };
});

/* Referrals that already turned into employees — these are what HR approves. */
const PAST_SEEDS: { hire: string; referrer: string; status: BonusStatus; period: string | null }[] = [
  { hire: "STL-0067", referrer: "STL-0019", status: "paid", period: "2026-07" },
  { hire: "STL-0055", referrer: "STL-0004", status: "paid", period: "2026-08" },
  { hire: "STL-0112", referrer: "STL-0142", status: "approved", period: "2026-09" },
  { hire: "STL-0141", referrer: "STL-0006", status: "pending_approval", period: null },
  { hire: "STL-0081", referrer: "STL-0031", status: "pending_approval", period: null },
  { hire: "STL-0110", referrer: "STL-0142", status: "pending_tenure", period: null },
];

const PAST: Referral[] = PAST_SEEDS.map((s, i) => {
  const e = employeeByCode(s.hire)!;
  const r = employeeByCode(s.referrer)!;
  return {
    id: `REF-2026-${String(i + 1).padStart(3, "0")}`,
    candidateName: e.name,
    candidateEmail: `${e.firstName.toLowerCase()}.${e.lastName.toLowerCase()}@gmail.com`,
    role: e.designation,
    reqCode: null,
    referrerCode: r.code,
    referrerName: r.name,
    relationship: RELATIONSHIPS[(i + 2) % RELATIONSHIPS.length],
    submittedOn: iso(addDays(parseISO(e.joiningDate), -52)),
    stage: "hired",
    candidateId: null,
    hiredEmployeeCode: e.code,
    joiningDate: e.joiningDate,
    bonus: bonusFor(e.gradeId, false),
    bonusStatus: s.status,
    payoutPeriod: s.period,
  };
});

/* Fresh submissions not yet screened into the pipeline. */
const SUBMITTED: Referral[] = [
  { name: "Meghna Iyer", email: "meghna.iyer@gmail.com", req: "REQ-2026-012", by: "STL-0142", on: "2026-09-12", rel: "College batchmate" },
  { name: "Rahul Kamath", email: "rahul.kamath@outlook.com", req: "REQ-2026-002", by: "STL-0142", on: "2026-09-15", rel: "Former colleague" },
  { name: "Joel D'Souza", email: "joel.dsouza@gmail.com", req: "REQ-2026-010", by: "STL-0031", on: "2026-09-14", rel: "Friend" },
].map((s, i) => {
  const req = requisitionByCode(s.req)!;
  return {
    id: `REF-2026-${String(i + 40).padStart(3, "0")}`,
    candidateName: s.name,
    candidateEmail: s.email,
    role: req.role,
    reqCode: req.code,
    referrerCode: s.by,
    referrerName: employeeByCode(s.by)!.name,
    relationship: s.rel,
    submittedOn: s.on,
    stage: "submitted" as const,
    candidateId: null,
    hiredEmployeeCode: null,
    joiningDate: null,
    bonus: bonusFor(req.gradeId, req.priority === "Critical"),
    bonusStatus: "in_pipeline" as const,
    payoutPeriod: null,
  };
});

export const REFERRALS: Referral[] = [...PAST, ...LIVE, ...SUBMITTED];

/** Day the hire completes 90 days and the bonus becomes payable. */
export const bonusEligibleOn = (r: Referral) =>
  r.joiningDate ? iso(addDays(parseISO(r.joiningDate), REFERRAL_TENURE_DAYS)) : null;

/* ------------------------------------------------------------ talent pool */

export interface PoolMatch {
  reqCode: string;
  role: string;
  score: number;
  reasons: string[];
}

export interface PoolCandidate {
  id: string;
  name: string;
  email: string;
  currentTitle: string;
  currentCompany: string;
  experienceYears: number;
  departmentId: string;
  skills: string[];
  tags: string[];
  lastRole: string;
  lastStageReached: string;
  lastContacted: string;
  source: string;
  rating: number;
  matches: PoolMatch[];
}

const SILVER = CANDIDATES.filter((c) => c.stage === "rejected" && (c.rejectedAtStage === "interview" || c.rejectedAtStage === "offer"));

const PAST_POOL: Omit<PoolCandidate, "id" | "matches">[] = [
  { name: "Harini Venkatesh", email: "harini.v@gmail.com", currentTitle: "Senior Software Engineer", currentCompany: "Freshworks", experienceYears: 6, departmentId: "ENG", skills: ["Go", "PostgreSQL", "Kafka", "AWS"], tags: ["Silver medallist", "2025 cycle"], lastRole: "Senior Backend Engineer", lastStageReached: "Final interview", lastContacted: "2026-03-18", source: "LinkedIn", rating: 4.1 },
  { name: "Abhishek Rawat", email: "abhishek.rawat@outlook.com", currentTitle: "SRE II", currentCompany: "PhonePe", experienceYears: 5, departmentId: "ITO", skills: ["Kubernetes", "Terraform", "Observability", "Linux"], tags: ["Silver medallist"], lastRole: "Site Reliability Engineer", lastStageReached: "Final interview", lastContacted: "2026-05-02", source: "Referral", rating: 3.9 },
  { name: "Neeraja Pillai", email: "neeraja.pillai@gmail.com", currentTitle: "Customer Success Lead", currentCompany: "Chargebee", experienceYears: 7, departmentId: "CSM", skills: ["Renewals", "QBRs", "Onboarding", "Escalation Management"], tags: ["Declined offer", "Keep warm"], lastRole: "Customer Success Manager", lastStageReached: "Offer declined", lastContacted: "2026-06-11", source: "Naukri", rating: 4.3 },
  { name: "Gaurav Sood", email: "gaurav.sood@gmail.com", currentTitle: "Enterprise AE", currentCompany: "Zoho", experienceYears: 8, departmentId: "SAL", skills: ["MEDDIC", "Enterprise Sales", "Negotiation", "Forecasting"], tags: ["Silver medallist"], lastRole: "Enterprise Account Executive", lastStageReached: "Panel interview", lastContacted: "2026-02-24", source: "Agency", rating: 3.8 },
  { name: "Lavanya Krishnan", email: "lavanya.k@protonmail.com", currentTitle: "Frontend Engineer", currentCompany: "Swiggy", experienceYears: 3, departmentId: "ENG", skills: ["React", "TypeScript", "Accessibility"], tags: ["Campus 2023", "Boomerang interest"], lastRole: "Software Engineer, Frontend", lastStageReached: "Technical interview", lastContacted: "2026-07-29", source: "Careers site", rating: 3.6 },
  { name: "Rohan Mehta", email: "rohan.mehta@gmail.com", currentTitle: "Platform Engineer", currentCompany: "Atlassian", experienceYears: 10, departmentId: "ENG", skills: ["Kubernetes", "Go", "gRPC", "System Design"], tags: ["Silver medallist", "Relocation open"], lastRole: "Staff Engineer, Platform", lastStageReached: "Hiring manager round", lastContacted: "2026-04-09", source: "LinkedIn", rating: 4.0 },
];

const expRange = (s: string) => {
  const m = s.match(/(\d+)\D+(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : [0, 99];
};

function matchesFor(p: Omit<PoolCandidate, "id" | "matches">): PoolMatch[] {
  return REQUISITIONS.filter((r) => r.status === "open" && r.approvalStatus === "approved" && r.departmentId === p.departmentId)
    .map((r) => {
      const job = JOBS.find((j) => j.reqCode === r.code);
      const [lo, hi] = expRange(job?.experience ?? "");
      const peers = CANDIDATES.filter((c) => c.reqCode === r.code).flatMap((c) => c.skills);
      const overlap = p.skills.filter((s) => peers.includes(s));
      const fitsExp = p.experienceYears >= lo && p.experienceYears <= hi;
      const sameRole = p.lastRole === r.role;
      const score = Math.min(96, 40 + overlap.length * 7 + (fitsExp ? 12 : 0) + (sameRole ? 10 : 0) + Math.round(p.rating * 2));
      const reasons = [
        overlap.length ? `${overlap.slice(0, 3).join(", ")} match the shortlisted profiles` : "Adjacent skill set — screen for depth",
        fitsExp ? `${p.experienceYears} yrs sits inside the ${job?.experience ?? "role"} band` : `${p.experienceYears} yrs is outside the ${job?.experience ?? "role"} band`,
        sameRole ? `Reached "${p.lastStageReached}" for this exact role` : `Last assessed for ${p.lastRole}`,
      ];
      return { reqCode: r.code, role: r.role, score, reasons };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
}

export const TALENT_POOL: PoolCandidate[] = [
  ...SILVER.map((c) => ({
    name: c.name,
    email: c.email,
    currentTitle: c.currentTitle,
    currentCompany: c.currentCompany,
    experienceYears: c.experienceYears,
    departmentId: c.departmentId,
    skills: c.skills,
    tags: [c.rejectedAtStage === "offer" ? "Declined offer" : "Silver medallist", "2026 cycle"],
    lastRole: c.role,
    lastStageReached: c.rejectedAtStage === "offer" ? "Offer declined" : "Interview loop",
    lastContacted: c.stageSince,
    source: c.source,
    rating: c.rating,
  })),
  ...PAST_POOL,
].map((p, i) => ({ ...p, id: `TP-${String(i + 1).padStart(3, "0")}`, matches: matchesFor(p) }));

export const daysSince = (d: string) => differenceInDays(TODAY, parseISO(d));
