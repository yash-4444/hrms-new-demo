import { CANDIDATES, JOBS, OFFERS, candidateById, offerById, type Candidate, type JobPosting, type PipelineStage } from "./hiring";

/* ============================================================================
   Fixtures behind the public candidate journey: job slugs, tracking tokens,
   the resume parser's output, the offer a candidate sees, and the pre-joining
   checklist. All of it reads from the same hiring fixtures as the app.
   ========================================================================== */

const slugify = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const PUBLIC_JOBS = JOBS.filter((j) => j.published);
export const jobSlug = (j: JobPosting) => `${slugify(j.title)}-${slugify(j.location.split(",")[0])}`;
export const jobBySlug = (slug: string) => PUBLIC_JOBS.find((j) => jobSlug(j) === slug);

/* ---------------------------------------------------------- tracking token */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Deterministic 6-character token per candidate, e.g. STL-7QK2MD. */
export function trackingToken(candidateId: string) {
  let h = 2166136261;
  for (let i = 0; i < candidateId.length; i++) h = Math.imul(h ^ candidateId.charCodeAt(i), 16777619);
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += ALPHABET[(h >>> 0) % ALPHABET.length];
    h = Math.imul(h ^ (h >>> 13), 2654435761);
  }
  return `STL-${out}`;
}

export function findApplication(query: string): Candidate | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  return CANDIDATES.find((c) => c.email.toLowerCase() === q || trackingToken(c.id).toLowerCase() === q);
}

/** Three applications a demo presenter can paste straight into the tracker. */
export const SAMPLE_TRACKING = ["CAN-2026-010", "CAN-2026-004", "CAN-2026-024"].map((id) => {
  const c = candidateById(id)!;
  return { token: trackingToken(id), name: c.name, email: c.email, stage: c.stage };
});

export const PUBLIC_STAGES: { id: PipelineStage; label: string; blurb: string }[] = [
  { id: "applied", label: "Application received", blurb: "A recruiter reads every application within five working days." },
  { id: "screening", label: "Recruiter screen", blurb: "A 30-minute call about the role, your experience and expectations." },
  { id: "interview", label: "Interviews", blurb: "Technical and hiring-manager conversations with the team." },
  { id: "offer", label: "Offer", blurb: "Your offer letter, CTC breakup and joining date." },
  { id: "hired", label: "Welcome aboard", blurb: "Pre-joining formalities and your Day-1 plan." },
];

export const DOCS_BY_STAGE: Partial<Record<PipelineStage, string[]>> = {
  screening: ["Updated resume (PDF)"],
  interview: ["Last three payslips", "Government ID (PAN or passport)"],
  offer: ["Last three payslips", "Relieving letter or resignation acceptance", "Highest degree certificate"],
};

/* ------------------------------------------------------------ resume parser */

const SKILLS: Record<string, string[]> = {
  ENG: ["TypeScript", "Go", "PostgreSQL", "Kubernetes", "AWS", "React"],
  SAL: ["Enterprise Sales", "MEDDIC", "Salesforce", "Negotiation", "Forecasting"],
  MKT: ["Demand Gen", "HubSpot", "Attribution", "Paid Media"],
  CSM: ["Onboarding", "Renewals", "QBRs", "Escalation Management"],
  ITO: ["Kubernetes", "Terraform", "AWS", "Observability", "Incident Response"],
};
const EDUCATION: Record<string, string> = {
  ENG: "B.Tech, Computer Science — NIT Surathkal (2018)",
  SAL: "MBA, Marketing — Symbiosis Institute of Business Management (2016)",
  MKT: "MBA, Marketing — NMIMS Mumbai (2015)",
  CSM: "BBA — Christ University, Bengaluru (2019)",
  ITO: "B.E., Information Science — RV College of Engineering (2017)",
};

export interface ParsedResume {
  fullName: string;
  email: string;
  phone: string;
  experienceYears: number;
  currentCompany: string;
  skills: string;
  education: string;
}

/** What the parser "reads" from the uploaded file — a name in the filename wins. */
export function parseResume(job: JobPosting, fileName: string): ParsedResume {
  const stem = fileName.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]?(resume|cv)[-_]?/gi, " ");
  const words = stem.split(/[^a-zA-Z]+/).filter((w) => w.length > 1).slice(0, 2);
  const name = words.length === 2 ? words.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ") : "Ritika Deshmukh";
  const low = Number(job.experience.match(/\d+/)?.[0] ?? 3);
  return {
    fullName: name,
    email: `${name.toLowerCase().replace(" ", ".")}@gmail.com`,
    phone: "+91 98450 31277",
    experienceYears: low + 1,
    currentCompany: job.departmentId === "SAL" ? "Freshworks" : "Swiggy",
    skills: (SKILLS[job.departmentId] ?? SKILLS.ENG).slice(0, 5).join(", "),
    education: EDUCATION[job.departmentId] ?? EDUCATION.ENG,
  };
}

/* ------------------------------------------------------- candidate's offer */

/** Released and awaiting the candidate's response. */
export const PUBLIC_OFFER = offerById("OFF-2026-008")!;
export const PUBLIC_OFFER_CANDIDATE = candidateById(PUBLIC_OFFER.candidateId)!;

/* ------------------------------------------------------------- pre-joining */

export const PREJOIN_OFFER = OFFERS.find((o) => o.candidateName === "Nikhil Bansal")!;
export const PREJOIN_CANDIDATE = candidateById(PREJOIN_OFFER.candidateId)!;

export const PREJOIN_DOCS = [
  { key: "pan", label: "PAN card", required: true },
  { key: "aadhaar", label: "Aadhaar (masked)", required: true },
  { key: "photo", label: "Passport-size photograph", required: true },
  { key: "degree", label: "Highest degree certificate", required: true },
  { key: "relieving", label: "Relieving letter from Razorpay", required: true },
  { key: "payslips", label: "Last three payslips", required: true },
  { key: "passport", label: "Passport", required: false },
] as const;

export const PREJOIN_POLICIES = [
  { key: "coc", label: "Code of conduct", pages: 14 },
  { key: "posh", label: "Prevention of sexual harassment (POSH) policy", pages: 9 },
  { key: "it", label: "IT acceptable-use and information-security policy", pages: 11 },
  { key: "nda", label: "Confidentiality and IP assignment agreement", pages: 6 },
] as const;
