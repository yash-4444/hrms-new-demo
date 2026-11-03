import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { DEMO_NOW, DEMO_TODAY } from "@/mock/org";

/* ============================================================================
   Platform Console — the vendor's view of every tenant on HRMS-NEW.

   Not to be confused with src/mock/platform-*.ts, which back the TENANT-level
   admin screens (/admin/*) inside one organisation. Everything here sits
   outside any tenant. All companies and people are fictional.

   Money is INR per month (non-INR tenants are invoiced in INR at the contract
   rate). The console shares the demo clock with the tenant app — CONSOLE_TODAY
   is DEMO_TODAY — so a support session never jumps between calendars.
   ========================================================================== */

export const CONSOLE_TODAY = DEMO_TODAY;
export const CONSOLE_NOW = DEMO_NOW;

export type TenantStatus = "active" | "trial" | "suspended" | "pending" | "churned" | "scheduled_deletion";
export type PlanId = "free" | "pro" | "enterprise";
export type TenantCountry = "IN" | "US" | "AE" | "SG";
export type PaymentStatus = "ok" | "failed" | "overdue" | "none";

export type ModuleId =
  | "core"
  | "time"
  | "leave"
  | "payroll"
  | "ats"
  | "lifecycle"
  | "performance"
  | "learning"
  | "assets"
  | "expenses"
  | "helpdesk"
  | "engagement"
  | "analytics"
  | "platform";

/** The fourteen product modules (docs/00-MASTER-PLAN.md D1). */
export const MODULES: { id: ModuleId; label: string; description: string; alwaysOn?: boolean }[] = [
  { id: "core", label: "Core HR", description: "Directory, profiles, org structure, documents and letters.", alwaysOn: true },
  { id: "time", label: "Time & Attendance", description: "Punches, shifts, rosters, regularisation and devices." },
  { id: "leave", label: "Leave & Absence", description: "Policies, accrual, applications and the leave ledger." },
  { id: "payroll", label: "Payroll & Statutory", description: "Pay runs, structures, PF/ESI/PT/TDS and returns." },
  { id: "ats", label: "Recruitment (ATS)", description: "Requisitions, postings, pipeline, interviews and offers." },
  { id: "lifecycle", label: "Onboarding & Exit", description: "Checklists, probation, separations and full & final." },
  { id: "performance", label: "Performance", description: "Goals, review cycles, calibration, 1:1s and PIPs." },
  { id: "learning", label: "Learning", description: "Courses, sessions, certifications and skill gaps." },
  { id: "assets", label: "Assets", description: "Register, requests, licences and verification." },
  { id: "expenses", label: "Expenses & Travel", description: "Claims, policies, travel desk and advances." },
  { id: "helpdesk", label: "Helpdesk", description: "Tickets, HR cases, SLA and knowledge base." },
  { id: "engagement", label: "Engagement", description: "Feed, surveys, recognition, celebrations and ideas." },
  { id: "analytics", label: "Workforce Analytics", description: "Dashboards, reports and scheduled exports." },
  { id: "platform", label: "Platform", description: "Users, roles, audit, settings and integrations.", alwaysOn: true },
];

export interface PlanMeta {
  id: PlanId;
  label: string;
  /** Per-tenant API rate limit, requests per minute (PerTenant policy). */
  rateLimit: number;
  /** INR per seat per month; 0 for Free. */
  seatPrice: number;
  /** Seat cap for Free; paid plans cap at purchased seats. */
  maxSeats: number | null;
  storageGb: number;
  modules: ModuleId[];
}

const FREE_MODULES: ModuleId[] = ["core", "time", "leave", "platform"];
const PRO_MODULES: ModuleId[] = [...FREE_MODULES, "payroll", "ats", "lifecycle", "performance", "assets", "expenses", "helpdesk", "engagement"];

export const PLAN_META: Record<PlanId, PlanMeta> = {
  free: { id: "free", label: "Free", rateLimit: 100, seatPrice: 0, maxSeats: 25, storageGb: 5, modules: FREE_MODULES },
  pro: { id: "pro", label: "Pro", rateLimit: 500, seatPrice: 149, maxSeats: null, storageGb: 100, modules: PRO_MODULES },
  enterprise: { id: "enterprise", label: "Enterprise", rateLimit: 2000, seatPrice: 199, maxSeats: null, storageGb: 1000, modules: MODULES.map((m) => m.id) },
};

export const COUNTRY_META: Record<TenantCountry, { label: string; region: string; dataResidency: string }> = {
  IN: { label: "India", region: "India", dataResidency: "India — Mumbai (ap-south-1)" },
  US: { label: "United States", region: "North America", dataResidency: "United States — N. Virginia (us-east-1)" },
  AE: { label: "United Arab Emirates", region: "Middle East", dataResidency: "UAE — Dubai (me-central-1)" },
  SG: { label: "Singapore", region: "South-East Asia", dataResidency: "Singapore (ap-southeast-1)" },
};

export const STATUS_LABEL: Record<TenantStatus, string> = {
  active: "Active",
  trial: "Trial",
  suspended: "Suspended",
  pending: "Pending",
  churned: "Churned",
  scheduled_deletion: "Scheduled for deletion",
};

export interface ConsoleTenant {
  /** TN-1001 … — the platform's tenant id, never shown inside the tenant. */
  id: string;
  name: string;
  legalName: string;
  subdomain: string;
  industry: string;
  plan: PlanId;
  status: TenantStatus;
  country: TenantCountry;
  seatsUsed: number;
  /** Purchased seats (paid) or the plan cap (Free). */
  seatLimit: number;
  /** Contracted monthly recurring revenue in INR; 0 for Free, trials, pending and churned. */
  mrr: number;
  ownerName: string;
  ownerEmail: string;
  createdAt: string;
  lastActiveAt: string;
  trialEndsAt?: string;
  legalEntities: number;
  storageUsedGb: number;
  /** Peak requests per minute over the last 24 h. */
  apiPeakRpm: number;
  /** Share of requests answered 5xx over the last 24 h, in %. */
  errorRate: number;
  payment: PaymentStatus;
  modules: ModuleId[];
  statusNote?: string;
  /** Set when deletion is scheduled; data is purged 30 days later. */
  deletionScheduledAt?: string;
}

/* id · name · legal suffix · industry · plan · status · country · seats used/limit ·
   owner · created · hours since last active · peak rpm · error % · payment · note */
type Row = [
  number, string, string, string, PlanId, TenantStatus, TenantCountry, number, number,
  string, string, number, number, number, PaymentStatus, string?,
];

const ROWS: Row[] = [
  [1001, "Kaveri Textiles", "Private Limited", "Textiles & apparel", "pro", "active", "IN", 412, 450, "Ramesh Subramanian", "2024-02-12", 1, 210, 0.2, "ok"],
  [1002, "Nilgiri Logistics", "Private Limited", "Logistics", "pro", "active", "IN", 186, 200, "Anita Fernandes", "2024-04-03", 3, 120, 0.3, "ok"],
  [1003, "Saffron Hospitality Group", "Limited", "Hospitality", "enterprise", "active", "IN", 2140, 2500, "Harish Venkataraman", "2024-01-18", 0.2, 1260, 0.4, "ok"],
  [1004, "Brahmaputra Agro Foods", "Private Limited", "Food processing", "pro", "trial", "IN", 64, 100, "Pallavi Baruah", "2026-08-24", 5, 48, 0.1, "none"],
  [1005, "Vindhya Steel Fabricators", "Limited", "Manufacturing", "enterprise", "active", "IN", 1830, 2000, "Suresh Agnihotri", "2024-06-27", 0.5, 940, 0.6, "failed", "Card declined on the 01 Sep invoice; retry 3 of 4 failed."],
  [1006, "Coromandel Fintech", "Private Limited", "Financial services", "pro", "active", "IN", 300, 300, "Lavanya Krishnan", "2025-01-09", 0.3, 455, 0.5, "ok"],
  [1007, "Malabar Spice Exports", "LLP", "Agri exports", "free", "active", "IN", 25, 25, "Faisal Rahman", "2025-05-14", 26, 30, 0.1, "none"],
  [1008, "Deccan Biologics", "Private Limited", "Life sciences", "enterprise", "active", "IN", 960, 1100, "Dr. Kavitha Reddy", "2024-09-02", 0.4, 620, 0.3, "ok"],
  [1009, "Konkan Marine Services", "Private Limited", "Marine engineering", "pro", "suspended", "IN", 142, 160, "Prakash Naik", "2024-11-20", 520, 0, 0, "overdue", "Two invoices unpaid past 60 days; suspended under the billing policy."],
  [1010, "Aravalli Solar Power", "Private Limited", "Renewable energy", "pro", "trial", "IN", 88, 150, "Mohit Sharma", "2026-08-21", 2, 64, 0.2, "none"],
  [1011, "Godavari Health Clinics", "Private Limited", "Healthcare", "pro", "active", "IN", 534, 600, "Dr. Sravani Rao", "2024-07-15", 0.6, 470, 3.8, "ok", "Biometric sync worker retrying since 14 Sep — 5xx spike on /punches."],
  [1012, "Narmada Infra Projects", "Limited", "Construction", "enterprise", "pending", "IN", 0, 3000, "Jayesh Patel", "2026-09-12", 72, 0, 0, "none", "MSA signed; awaiting data-residency confirmation before provisioning."],
  [1013, "Chilika Craft Breweries", "Private Limited", "Food & beverage", "free", "churned", "IN", 0, 25, "Sunil Mohapatra", "2024-10-05", 2900, 0, 0, "none", "Left after 14 months — moved to a payroll bureau."],
  [1014, "Sahyadri Auto Components", "Private Limited", "Automotive", "pro", "active", "IN", 728, 800, "Vivek Kulkarni", "2024-03-22", 0.8, 380, 0.4, "ok"],
  [1015, "Ganga Retail Ventures", "Private Limited", "Retail", "pro", "scheduled_deletion", "IN", 0, 350, "Neelam Srivastava", "2024-05-30", 650, 0, 0, "none", "Owner requested closure and erasure on 02 Sep 2026 (DPDP s.12)."],
  [1016, "Thar Desert Tours", "Private Limited", "Travel", "pro", "trial", "IN", 31, 50, "Rajveer Rathore", "2026-09-02", 9, 22, 0.1, "none"],
  [1017, "Lotus Pharma Distributors", "Private Limited", "Pharma distribution", "pro", "active", "IN", 248, 260, "Meenakshi Sundaram", "2025-02-17", 1.5, 160, 0.2, "ok"],
  [1018, "Meghalaya Tea Estates", "Private Limited", "Plantations", "free", "active", "IN", 19, 25, "Iban Lyngdoh", "2025-08-08", 30, 18, 0.1, "none"],
  [1019, "Indus Data Labs", "Private Limited", "Software", "pro", "trial", "IN", 47, 75, "Arvind Menon", "2026-08-30", 0.7, 90, 0.3, "none"],
  [1020, "Pench Wildlife Resorts", "Private Limited", "Hospitality", "free", "pending", "IN", 1, 25, "Tanvi Deshmukh", "2026-09-14", 48, 0, 0, "none", "Owner email not verified — link sent twice."],
  [1021, "Kalinga Mining Services", "Limited", "Mining", "enterprise", "active", "IN", 1520, 1600, "Bikash Panda", "2024-08-11", 0.9, 1880, 0.7, "ok", "Peaks near the Enterprise rate limit during shift change."],
  [1022, "Hampi Interiors", "LLP", "Interior design", "free", "churned", "IN", 0, 25, "Shruti Hegde", "2025-03-03", 3400, 0, 0, "none", "Inactive 5 months; closed by the owner."],
  [1023, "Bluegill Analytics", "Inc.", "Software", "pro", "active", "US", 132, 150, "Megan Caldwell", "2025-04-21", 4, 96, 0.2, "ok"],
  [1024, "Redwood Ridge Clinics", "LLC", "Healthcare", "enterprise", "active", "US", 1150, 1200, "Daniel Okafor", "2024-12-02", 1, 720, 0.5, "ok"],
  [1025, "Cobalt Harbor Software", "Inc.", "Software", "pro", "trial", "US", 58, 80, "Priya Natarajan", "2026-09-04", 6, 44, 0.2, "none"],
  [1026, "Prairie Lantern Foods", "LLC", "Food processing", "pro", "suspended", "US", 210, 220, "Hannah Whitfield", "2025-06-10", 300, 0, 0, "failed", "Chargeback on the July invoice; suspended pending dispute."],
  [1027, "Falcon Crest Facilities", "LLC", "Facility management", "enterprise", "active", "AE", 2620, 3000, "Omar Al Mansoori", "2024-10-28", 0.3, 1320, 0.4, "ok"],
  [1028, "Dune & Dhow Trading", "LLC", "Trading", "pro", "active", "AE", 96, 100, "Rashid Khan", "2025-07-01", 12, 70, 0.3, "overdue", "September invoice 9 days overdue."],
  [1029, "Oasis Bay Hospitality", "LLC", "Hospitality", "pro", "scheduled_deletion", "AE", 0, 400, "Layla Haddad", "2025-01-26", 900, 0, 0, "none", "Contract ended 31 Aug 2026; export delivered, erasure scheduled."],
  [1030, "Merlion Robotics", "Pte. Ltd.", "Robotics", "pro", "active", "SG", 174, 200, "Wei Ling Tan", "2025-09-15", 2, 140, 0.2, "ok"],
  [1031, "Straits Fintech", "Pte. Ltd.", "Financial services", "enterprise", "trial", "SG", 210, 500, "Marcus Lim", "2026-08-28", 0.5, 260, 0.3, "none", "Enterprise proof of concept — security review in progress."],
  [1032, "Orchid Lane Clinics", "Pte. Ltd.", "Healthcare", "free", "active", "SG", 14, 25, "Nur Aisyah", "2026-03-19", 50, 12, 0.1, "none"],
  [1033, "Tungabhadra Cement Works", "Private Limited", "Building materials", "pro", "active", "IN", 362, 400, "Basavaraj Patil", "2025-10-14", 2, 230, 0.3, "ok"],
  [1034, "Pinecrest Dental Partners", "LLC", "Healthcare", "pro", "active", "US", 88, 100, "Rachel Brennan", "2025-11-06", 7, 52, 0.2, "ok"],
  [1035, "Al Noor Logistics Hub", "LLC", "Logistics", "pro", "active", "AE", 154, 180, "Yusuf Rahimi", "2025-12-09", 3, 110, 0.4, "ok"],
  [1036, "Mahanadi Grid Systems", "Limited", "Utilities", "enterprise", "active", "IN", 1240, 1500, "Sambit Mishra", "2026-01-20", 0.4, 830, 0.5, "ok"],
  [1037, "Betwa Agritech", "Private Limited", "Agritech", "pro", "active", "IN", 76, 100, "Ritu Chauhan", "2026-04-07", 5, 58, 0.2, "ok"],
  [1038, "Lakeview Home Health", "LLC", "Healthcare", "pro", "active", "US", 205, 250, "Jasmine Ortega", "2026-05-25", 1, 150, 0.3, "ok"],
  [1039, "Sabarmati Ceramics", "Private Limited", "Manufacturing", "pro", "active", "IN", 118, 150, "Hetal Shah", "2026-06-18", 4, 80, 0.2, "ok"],
  [1040, "Bhimtal Boutique Hotels", "LLP", "Hospitality", "free", "active", "IN", 12, 25, "Kavya Bisht", "2026-07-09", 20, 10, 0.1, "none"],
];

/* Trial end dates, relative to the demo's today (16 Sep 2026). */
const TRIAL_ENDS: Record<number, string> = {
  1004: "2026-09-22",
  1010: "2026-09-19",
  1016: "2026-10-02",
  1019: "2026-09-29",
  1025: "2026-09-18",
  1031: "2026-10-12",
};

/* Modules a tenant switched off inside its plan entitlement. */
const MODULES_OFF: Record<number, ModuleId[]> = {
  1002: ["performance", "engagement"],
  1006: ["assets"],
  1014: ["ats"],
  1017: ["engagement", "helpdesk"],
  1023: ["payroll"],
  1028: ["performance"],
  1024: ["learning"],
};

const DELETION_SCHEDULED: Record<number, string> = {
  1015: "2026-09-02",
  1029: "2026-09-01",
};

const slug = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const emailFor = (owner: string, sub: string, country: TenantCountry) => {
  const local = owner.replace(/^Dr\. /, "").toLowerCase().split(" ").join(".");
  const tld = { IN: "in", US: "com", AE: "ae", SG: "sg" }[country];
  return `${local}@${sub.split("-")[0]}.${tld}`;
};

/* Local wall-clock ISO, like every other fixture timestamp (no UTC shift). */
const lastActive = (hoursAgo: number) =>
  format(new Date(new Date(CONSOLE_NOW).getTime() - hoursAgo * 3_600_000), "yyyy-MM-dd'T'HH:mm:ss");

function contractedMrr(plan: PlanId, status: TenantStatus, seatLimit: number) {
  if (status === "trial" || status === "pending" || status === "churned" || status === "scheduled_deletion") return 0;
  return seatLimit * PLAN_META[plan].seatPrice;
}

export const CONSOLE_TENANTS: ConsoleTenant[] = ROWS.map(
  ([n, name, suffix, industry, plan, status, country, used, limit, owner, created, hours, rpm, err, payment, note]) => {
    const subdomain = slug(name);
    return {
      id: `TN-${n}`,
      name,
      legalName: `${name} ${suffix}`,
      subdomain,
      industry,
      plan,
      status,
      country,
      seatsUsed: used,
      seatLimit: limit,
      mrr: contractedMrr(plan, status, limit),
      ownerName: owner,
      ownerEmail: emailFor(owner, subdomain, country),
      createdAt: created,
      lastActiveAt: lastActive(hours),
      trialEndsAt: TRIAL_ENDS[n],
      legalEntities: plan === "enterprise" ? 2 + (n % 4) : plan === "pro" ? 1 + (n % 2) : 1,
      storageUsedGb: Math.round(used * (plan === "enterprise" ? 0.31 : 0.14) * 10) / 10,
      apiPeakRpm: rpm,
      errorRate: err,
      payment,
      modules: PLAN_META[plan].modules.filter((m) => !(MODULES_OFF[n] ?? []).includes(m)),
      statusNote: note,
      deletionScheduledAt: DELETION_SCHEDULED[n],
    };
  },
);

export const consoleTenantById = (id: string) => CONSOLE_TENANTS.find((t) => t.id === id);

/* ------------------------------------------------------------- derived */

/** Whole days from the console's today to `iso` (negative when past). */
export function daysFromToday(iso: string) {
  return differenceInCalendarDays(parseISO(iso.slice(0, 10)), parseISO(CONSOLE_TODAY));
}

/** Retention window between scheduling deletion and the irreversible purge. */
export const DELETION_RETENTION_DAYS = 30;

/** The purge date for a tenant scheduled for deletion. */
export function purgeDate(t: Pick<ConsoleTenant, "deletionScheduledAt">) {
  if (!t.deletionScheduledAt) return null;
  return format(addDays(parseISO(t.deletionScheduledAt), DELETION_RETENTION_DAYS), "yyyy-MM-dd");
}

export type RiskKind = "seats" | "payment" | "trial" | "errors";

export interface TenantRisk {
  kind: RiskKind;
  label: string;
  detail: string;
  severity: "warning" | "danger";
}

/** Why a live tenant needs an operator's attention — empty when it does not. */
export function tenantRisks(t: ConsoleTenant): TenantRisk[] {
  if (t.status === "churned" || t.status === "scheduled_deletion" || t.status === "pending") return [];
  const out: TenantRisk[] = [];
  if (t.seatLimit && t.seatsUsed / t.seatLimit >= 0.95) {
    out.push({
      kind: "seats",
      label: t.seatsUsed >= t.seatLimit ? "Seat limit reached" : "Seats nearly full",
      detail: `${t.seatsUsed.toLocaleString("en-IN")} of ${t.seatLimit.toLocaleString("en-IN")} seats — new hires will be blocked.`,
      severity: t.seatsUsed >= t.seatLimit ? "danger" : "warning",
    });
  }
  if (t.payment === "failed" || t.payment === "overdue") {
    out.push({
      kind: "payment",
      label: t.payment === "failed" ? "Payment failed" : "Invoice overdue",
      detail: t.statusNote ?? "Collections are in progress.",
      severity: "danger",
    });
  }
  if (t.status === "trial" && t.trialEndsAt && daysFromToday(t.trialEndsAt) <= 7) {
    const d = daysFromToday(t.trialEndsAt);
    out.push({
      kind: "trial",
      label: d <= 0 ? "Trial ends today" : `Trial ends in ${d} day${d === 1 ? "" : "s"}`,
      detail: `${t.seatsUsed} seats in use — no payment method on file yet.`,
      severity: d <= 3 ? "danger" : "warning",
    });
  }
  if (t.errorRate >= 2) {
    out.push({
      kind: "errors",
      label: "High error rate",
      detail: `${t.errorRate.toFixed(1)}% of requests failed in the last 24 h.`,
      severity: "danger",
    });
  }
  return out;
}
