import { addDays, differenceInMinutes, format, parseISO } from "date-fns";
import { CONSOLE_NOW, CONSOLE_TODAY, PLAN_META, type ConsoleTenant, type PlanId, type TenantCountry } from "@/mock/console-tenants";

/* ============================================================================
   Platform Console — sign-up requests: every self-serve registration from
   /register lands here before a tenant is provisioned. Approved requests point
   at the tenant they became (the fixture tenants' created dates match), so
   the queue and the tenant list tell one story. All companies are fictional.

   Subdomain availability is never stored — it is checked against the live
   tenant list at render, because another approval can take the name first.
   The check itself lives in src/mock/signup-checks.ts, shared with /register.
   ========================================================================== */

export type SignupStatus = "pending" | "approved" | "rejected";
export type CompanySize = "1–25" | "26–100" | "101–500" | "501–2,000" | "2,000+";

export interface SignupChecks {
  emailVerified: boolean;
  /** The admin's email domain matches the company's website domain. */
  domainMatches: boolean;
  /** The email domain is on the disposable-mailbox blocklist. */
  disposableEmail: boolean;
  /** An existing tenant this looks like a duplicate of. */
  duplicateOf?: string;
}

export interface SignupRequest {
  /** SR-2051 … */
  id: string;
  company: string;
  subdomain: string;
  industry: string;
  plan: PlanId;
  country: TenantCountry;
  size: CompanySize;
  adminName: string;
  adminEmail: string;
  submittedAt: string;
  checks: SignupChecks;
  status: SignupStatus;
  decidedAt?: string;
  /** Operator name, or "Auto-approval". */
  decidedBy?: string;
  /** The tenant an approved request became. */
  tenantId?: string;
  rejectReason?: string;
  infoRequest?: { at: string; message: string };
  /** Submitted through /register this session (kept in the sign-up store), not a fixture. */
  selfServe?: boolean;
}

export const AUTO_APPROVER = "Auto-approval";

const ok: SignupChecks = { emailVerified: true, domainMatches: true, disposableEmail: false };

export const SIGNUP_REQUESTS: SignupRequest[] = [
  /* ---------------------------------------------------------------- pending */
  { id: "SR-2051", company: "Kosi River Organics", subdomain: "kosi-river-organics", industry: "Agri produce", plan: "free", country: "IN", size: "1–25", adminName: "Nandini Jha", adminEmail: "nandini@kosiriverorganics.in", submittedAt: "2026-09-16T11:48:00", checks: ok, status: "pending" },
  { id: "SR-2050", company: "Vellore Precision Tools", subdomain: "vellore-precision", industry: "Manufacturing", plan: "pro", country: "IN", size: "101–500", adminName: "Karthik Srinivasan", adminEmail: "karthik.s@vellore-precision.in", submittedAt: "2026-09-16T09:05:00", checks: ok, status: "pending" },
  { id: "SR-2049", company: "Kaveri Textile Mills", subdomain: "kaveri-mills", industry: "Textiles & apparel", plan: "pro", country: "IN", size: "501–2,000", adminName: "Deepa Raghunathan", adminEmail: "deepa.r@kaveritextiles.in", submittedAt: "2026-09-15T17:22:00", checks: { ...ok, duplicateOf: "TN-1001" }, status: "pending" },
  { id: "SR-2048", company: "QuickHire Staffing", subdomain: "quickhire", industry: "Staffing", plan: "free", country: "IN", size: "26–100", adminName: "R. Kumar", adminEmail: "ops.quickhire@tempinbox.example", submittedAt: "2026-09-15T23:41:00", checks: { emailVerified: false, domainMatches: false, disposableEmail: true }, status: "pending" },
  { id: "SR-2047", company: "Saltmarsh Analytics", subdomain: "saltmarsh", industry: "Software", plan: "pro", country: "US", size: "26–100", adminName: "Ethan Pryce", adminEmail: "ethan@saltmarshanalytics.com", submittedAt: "2026-09-15T21:10:00", checks: ok, status: "pending" },
  {
    id: "SR-2046", company: "Desert Rose Clinics", subdomain: "desert-rose", industry: "Healthcare", plan: "enterprise", country: "AE", size: "501–2,000", adminName: "Mariam Al Suwaidi", adminEmail: "mariam@desertroseclinics.ae", submittedAt: "2026-09-14T10:30:00", checks: ok, status: "pending",
    infoRequest: { at: "2026-09-15T09:20:00", message: "Please share the trade licence number — Enterprise invoices in the UAE need it on the tax invoice." },
  },
  { id: "SR-2045", company: "Peranakan Kitchens", subdomain: "peranakan-kitchens", industry: "Food & beverage", plan: "free", country: "SG", size: "1–25", adminName: "Grace Ong", adminEmail: "grace.ong.pk@gmail.com", submittedAt: "2026-09-14T15:02:00", checks: { ...ok, domainMatches: false }, status: "pending" },
  { id: "SR-2044", company: "Nilgiri Logistics Co", subdomain: "nilgiri-logistics", industry: "Logistics", plan: "pro", country: "IN", size: "26–100", adminName: "Joseph Mathew", adminEmail: "joseph@nilgiricargo.co.in", submittedAt: "2026-09-13T12:15:00", checks: { ...ok, domainMatches: false }, status: "pending" },

  /* --------------------------------------------------------------- approved */
  { id: "SR-2043", company: "Cobalt Harbor Software", subdomain: "cobalt-harbor-software", industry: "Software", plan: "pro", country: "US", size: "26–100", adminName: "Priya Natarajan", adminEmail: "priya.natarajan@cobalt.com", submittedAt: "2026-09-03T22:40:00", checks: ok, status: "approved", decidedAt: "2026-09-04T09:55:00", decidedBy: "Devika Nair", tenantId: "TN-1025" },
  { id: "SR-2042", company: "Thar Desert Tours", subdomain: "thar-desert-tours", industry: "Travel", plan: "pro", country: "IN", size: "26–100", adminName: "Rajveer Rathore", adminEmail: "rajveer.rathore@thar.in", submittedAt: "2026-09-02T07:30:00", checks: ok, status: "approved", decidedAt: "2026-09-02T10:05:00", decidedBy: "Rohan Batra", tenantId: "TN-1016" },
  { id: "SR-2041", company: "Indus Data Labs", subdomain: "indus-data-labs", industry: "Software", plan: "pro", country: "IN", size: "26–100", adminName: "Arvind Menon", adminEmail: "arvind.menon@indus.in", submittedAt: "2026-08-29T18:12:00", checks: ok, status: "approved", decidedAt: "2026-08-30T10:40:00", decidedBy: "Devika Nair", tenantId: "TN-1019" },
  { id: "SR-2040", company: "Straits Fintech", subdomain: "straits-fintech", industry: "Financial services", plan: "enterprise", country: "SG", size: "101–500", adminName: "Marcus Lim", adminEmail: "marcus.lim@straits.sg", submittedAt: "2026-08-26T14:00:00", checks: ok, status: "approved", decidedAt: "2026-08-28T11:30:00", decidedBy: "Devika Nair", tenantId: "TN-1031" },
  { id: "SR-2039", company: "Brahmaputra Agro Foods", subdomain: "brahmaputra-agro-foods", industry: "Food processing", plan: "pro", country: "IN", size: "26–100", adminName: "Pallavi Baruah", adminEmail: "pallavi.baruah@brahmaputra.in", submittedAt: "2026-08-24T08:10:00", checks: ok, status: "approved", decidedAt: "2026-08-24T12:25:00", decidedBy: "Rohan Batra", tenantId: "TN-1004" },
  { id: "SR-2038", company: "Aravalli Solar Power", subdomain: "aravalli-solar-power", industry: "Renewable energy", plan: "pro", country: "IN", size: "101–500", adminName: "Mohit Sharma", adminEmail: "mohit.sharma@aravalli.in", submittedAt: "2026-08-20T19:45:00", checks: ok, status: "approved", decidedAt: "2026-08-21T09:15:00", decidedBy: "Devika Nair", tenantId: "TN-1010" },
  { id: "SR-2037", company: "Bhimtal Boutique Hotels", subdomain: "bhimtal-boutique-hotels", industry: "Hospitality", plan: "free", country: "IN", size: "1–25", adminName: "Kavya Bisht", adminEmail: "kavya.bisht@bhimtal.in", submittedAt: "2026-07-09T10:02:00", checks: ok, status: "approved", decidedAt: "2026-07-09T10:03:00", decidedBy: AUTO_APPROVER, tenantId: "TN-1040" },
  { id: "SR-2036", company: "Sabarmati Ceramics", subdomain: "sabarmati-ceramics", industry: "Manufacturing", plan: "pro", country: "IN", size: "101–500", adminName: "Hetal Shah", adminEmail: "hetal.shah@sabarmati.in", submittedAt: "2026-06-17T16:20:00", checks: ok, status: "approved", decidedAt: "2026-06-18T10:10:00", decidedBy: "Rohan Batra", tenantId: "TN-1039" },
  { id: "SR-2035", company: "Lakeview Home Health", subdomain: "lakeview-home-health", industry: "Healthcare", plan: "pro", country: "US", size: "101–500", adminName: "Jasmine Ortega", adminEmail: "jasmine.ortega@lakeview.com", submittedAt: "2026-05-24T20:30:00", checks: ok, status: "approved", decidedAt: "2026-05-25T09:40:00", decidedBy: "Devika Nair", tenantId: "TN-1038" },
  { id: "SR-2034", company: "Orchid Lane Clinics", subdomain: "orchid-lane-clinics", industry: "Healthcare", plan: "free", country: "SG", size: "1–25", adminName: "Nur Aisyah", adminEmail: "nur.aisyah@orchid.sg", submittedAt: "2026-03-19T11:15:00", checks: ok, status: "approved", decidedAt: "2026-03-19T11:16:00", decidedBy: AUTO_APPROVER, tenantId: "TN-1032" },

  /* --------------------------------------------------------------- rejected */
  { id: "SR-2033", company: "Gulf Star Manpower", subdomain: "gulfstar", industry: "Staffing", plan: "pro", country: "AE", size: "101–500", adminName: "S. Iqbal", adminEmail: "gulfstar.hr@quickmail.example", submittedAt: "2026-09-06T13:00:00", checks: { emailVerified: true, domainMatches: false, disposableEmail: false }, status: "rejected", decidedAt: "2026-09-14T10:00:00", decidedBy: "Devika Nair", rejectReason: "Company could not be verified; no reply to our information request within 7 days." },
  { id: "SR-2032", company: "FastCash Payroll Hub", subdomain: "fastcash", industry: "Payroll services", plan: "free", country: "IN", size: "26–100", adminName: "Admin", adminEmail: "fc2026@tempinbox.example", submittedAt: "2026-09-10T02:14:00", checks: { emailVerified: false, domainMatches: false, disposableEmail: true }, status: "rejected", decidedAt: "2026-09-11T09:30:00", decidedBy: "Rohan Batra", rejectReason: "Disposable email address and no verifiable company." },
  { id: "SR-2031", company: "Test Company 123", subdomain: "test123", industry: "—", plan: "free", country: "IN", size: "1–25", adminName: "Test User", adminEmail: "test@test123.in", submittedAt: "2026-09-08T18:00:00", checks: { emailVerified: true, domainMatches: true, disposableEmail: false }, status: "rejected", decidedAt: "2026-09-09T09:05:00", decidedBy: "Rohan Batra", rejectReason: "Test sign-up — not a real organisation." },
  { id: "SR-2030", company: "Sahyadri Auto Parts", subdomain: "sahyadri-auto", industry: "Automotive", plan: "pro", country: "IN", size: "501–2,000", adminName: "Nikhil Joshi", adminEmail: "nikhil.joshi@sahyadri.in", submittedAt: "2026-09-02T11:00:00", checks: { ...ok, duplicateOf: "TN-1014" }, status: "rejected", decidedAt: "2026-09-03T10:20:00", decidedBy: "Devika Nair", rejectReason: "Duplicate of an existing tenant — the applicant was introduced to their company's tenant owner." },
  { id: "SR-2029", company: "Zenith Crypto Rewards", subdomain: "zenith-rewards", industry: "Crypto", plan: "pro", country: "SG", size: "26–100", adminName: "Leon Tay", adminEmail: "leon@zenithrewards.sg", submittedAt: "2026-08-18T09:30:00", checks: ok, status: "rejected", decidedAt: "2026-08-20T15:45:00", decidedBy: "Devika Nair", rejectReason: "Outside the acceptable-use policy (unlicensed rewards scheme)." },
];

/* ------------------------------------------------------------- derived */

/** Hard blocks — a request cannot be approved while any of these hold. */
export function signupBlockers(s: SignupRequest, subdomainTaken: boolean): string[] {
  const out: string[] = [];
  if (!s.checks.emailVerified) out.push("The admin has not verified their email address.");
  if (subdomainTaken) out.push(`${s.subdomain}.hrms-new.app is already taken by another tenant.`);
  return out;
}

/** Risk flags — approvable, but an operator must acknowledge each one. */
export function signupRisks(s: SignupRequest): string[] {
  const out: string[] = [];
  if (s.checks.disposableEmail) out.push("Email is on the disposable-mailbox blocklist.");
  if (!s.checks.domainMatches) out.push("Email domain does not match the company.");
  if (s.checks.duplicateOf) out.push(`Looks like a duplicate of ${s.checks.duplicateOf}.`);
  return out;
}

/** Free + every check passes — what the auto-approve rule would provision. */
export const autoApprovable = (s: SignupRequest, subdomainTaken: boolean) =>
  s.status === "pending" && s.plan === "free" && !signupBlockers(s, subdomainTaken).length && !signupRisks(s).length;

const SIZE_SEATS: Record<CompanySize, number> = { "1–25": 25, "26–100": 100, "101–500": 500, "501–2,000": 2000, "2,000+": 3000 };

/** Self-serve trial length for paid plans. */
export const SIGNUP_TRIAL_DAYS = 14;

/** The tenant an approval provisions: Free goes live, paid plans start a trial. */
export function tenantFromSignup(s: SignupRequest, id: string): ConsoleTenant {
  const paid = s.plan !== "free";
  return {
    id,
    name: s.company,
    legalName: s.company,
    subdomain: s.subdomain,
    industry: s.industry,
    plan: s.plan,
    status: paid ? "trial" : "active",
    country: s.country,
    seatsUsed: 1,
    seatLimit: paid ? SIZE_SEATS[s.size] : PLAN_META.free.maxSeats ?? 25,
    mrr: 0,
    ownerName: s.adminName,
    ownerEmail: s.adminEmail,
    createdAt: CONSOLE_TODAY,
    lastActiveAt: CONSOLE_NOW,
    trialEndsAt: paid ? format(addDays(parseISO(CONSOLE_TODAY), SIGNUP_TRIAL_DAYS), "yyyy-MM-dd") : undefined,
    legalEntities: 1,
    storageUsedGb: 0,
    apiPeakRpm: 0,
    errorRate: 0,
    payment: "none",
    modules: [...PLAN_META[s.plan].modules],
    statusNote: `Provisioned from sign-up ${s.id}.`,
  };
}

/** Minutes from submission to decision. */
export const minutesToDecide = (s: SignupRequest) => (s.decidedAt ? differenceInMinutes(parseISO(s.decidedAt), parseISO(s.submittedAt)) : 0);
