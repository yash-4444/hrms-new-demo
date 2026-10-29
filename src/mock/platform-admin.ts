/* ============================================================================
   Platform admin fixtures — plan & seats, custom domains, permission
   overrides, sessions, login history and the access-review campaign.
   Everything is deterministic (mulberry32) and anchored on DEMO_TODAY.
   ========================================================================== */

import type { Action, MenuKey, RoleId } from "@/lib/rbac";

/* ------------------------------------------------------------ plan & seats */

export const SUBSCRIPTION = {
  plan: "Enterprise" as const,
  seatsPurchased: 400,
  seatsUsed: 340,
  billingCycle: "Annual",
  startedAt: "2026-04-01",
  renewsAt: "2027-03-31",
  pricePerSeatMonthly: 349,
  rateLimitPerMin: 2000,
  dataResidency: "India (Mumbai region)",
  supportTier: "Premium · 4-hour response, named CSM",
};

export interface AddOn {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  enabled: boolean;
  quota?: { label: string; used: number; limit: number; unit: string };
}

export const ADD_ONS: AddOn[] = [
  {
    id: "ai",
    name: "AI Copilot",
    description: "Ask-HR assistant, policy Q&A, attrition scoring and document OCR for every employee.",
    monthlyPrice: 24000,
    enabled: true,
    quota: { label: "AI credits this month", used: 61840, limit: 100000, unit: "credits" },
  },
  {
    id: "whatsapp",
    name: "WhatsApp channel",
    description: "Payslip, leave and approval notifications over the WhatsApp Business API (Meta-verified sender).",
    monthlyPrice: 6500,
    enabled: true,
    quota: { label: "Template messages this month", used: 8412, limit: 15000, unit: "messages" },
  },
  {
    id: "biometric",
    name: "Biometric integration",
    description: "Pull punches from eSSL / ZKTeco / Matrix devices every 5 minutes, with device health alerts.",
    monthlyPrice: 4000,
    enabled: false,
  },
];

export interface Invoice {
  id: string;
  number: string;
  period: string;
  issuedAt: string;
  dueAt: string;
  taxable: number;
  gst: number;
  total: number;
  status: "paid" | "due_soon" | "overdue";
}

/* GST 18% (IGST — billed from Karnataka to a Karnataka GSTIN, so CGST 9% + SGST 9%). */
export const INVOICES: Invoice[] = [
  ["2026-09", "2026-09-01", "2026-09-30", "due_soon"],
  ["2026-08", "2026-08-01", "2026-08-31", "paid"],
  ["2026-07", "2026-07-01", "2026-07-31", "paid"],
  ["2026-06", "2026-06-01", "2026-06-30", "paid"],
  ["2026-05", "2026-05-01", "2026-05-31", "paid"],
  ["2026-04", "2026-04-01", "2026-04-30", "paid"],
].map(([period, issued, due, status], i) => {
  const seats = i === 0 ? 400 : i < 3 ? 380 : 360;
  const taxable = seats * 349 + 24000 + 6500;
  const gst = Math.round(taxable * 0.18);
  return {
    id: `INV-${i}`,
    number: `STLR/26-27/${String(118 - i * 17).padStart(4, "0")}`,
    period,
    issuedAt: issued,
    dueAt: due,
    taxable,
    gst,
    total: taxable + gst,
    status: status as Invoice["status"],
  };
});

export interface PlanTier {
  id: "free" | "pro" | "enterprise";
  name: string;
  price: string;
  rateLimit: number;
  seats: string;
  features: Record<string, boolean | string>;
}

export const PLAN_FEATURES = [
  "Core HR & self-service",
  "Attendance & leave",
  "Payroll & statutory (PF/ESI/PT/LWF)",
  "Recruitment & onboarding",
  "Performance & learning",
  "SSO (SAML / OIDC) & SCIM",
  "Custom domains",
  "Audit log retention",
  "API rate limit",
  "Data residency choice",
  "Support",
] as const;

export const PLAN_TIERS: PlanTier[] = [
  {
    id: "free",
    name: "Free",
    price: "₹0",
    rateLimit: 100,
    seats: "Up to 25",
    features: {
      "Core HR & self-service": true,
      "Attendance & leave": true,
      "Payroll & statutory (PF/ESI/PT/LWF)": false,
      "Recruitment & onboarding": false,
      "Performance & learning": false,
      "SSO (SAML / OIDC) & SCIM": false,
      "Custom domains": false,
      "Audit log retention": "30 days",
      "API rate limit": "100 / min",
      "Data residency choice": false,
      Support: "Community",
    },
  },
  {
    id: "pro",
    name: "Pro",
    price: "₹199 / seat / mo",
    rateLimit: 500,
    seats: "Up to 250",
    features: {
      "Core HR & self-service": true,
      "Attendance & leave": true,
      "Payroll & statutory (PF/ESI/PT/LWF)": true,
      "Recruitment & onboarding": true,
      "Performance & learning": true,
      "SSO (SAML / OIDC) & SCIM": "SSO only",
      "Custom domains": "1 domain",
      "Audit log retention": "1 year",
      "API rate limit": "500 / min",
      "Data residency choice": false,
      Support: "Business hours",
    },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "₹349 / seat / mo",
    rateLimit: 2000,
    seats: "Unlimited",
    features: {
      "Core HR & self-service": true,
      "Attendance & leave": true,
      "Payroll & statutory (PF/ESI/PT/LWF)": true,
      "Recruitment & onboarding": true,
      "Performance & learning": true,
      "SSO (SAML / OIDC) & SCIM": true,
      "Custom domains": "Unlimited",
      "Audit log retention": "8 years",
      "API rate limit": "2,000 / min",
      "Data residency choice": true,
      Support: "Premium · named CSM",
    },
  },
];

export const BILLING_CONTACT = {
  name: "Lakshmi Pillai",
  title: "Chief Financial Officer",
  email: "accounts.payable@stellartech.in",
  phone: "+91 80 4718 2290",
  gstin: "29AAFCS4821K1ZP",
  address: "4th Floor, Prestige Tech Park, Outer Ring Road, Bengaluru 560103, Karnataka",
  poNumber: "PO/STL/2026/0419",
};

/* --------------------------------------------------------- custom domains */

export interface DnsRecord {
  type: "CNAME" | "TXT";
  host: string;
  value: string;
  status: "verified" | "pending" | "failed";
}

export interface CustomDomain {
  id: string;
  host: string;
  purpose: string;
  status: "verified" | "pending_dns" | "failed";
  ssl: "active" | "pending" | "not_issued";
  sslExpiresAt: string | null;
  addedAt: string;
  addedBy: string;
  lastCheckedAt: string;
  records: DnsRecord[];
}

export const CUSTOM_DOMAINS: CustomDomain[] = [
  {
    id: "DOM-1",
    host: "hr.stellartech.in",
    purpose: "Employee & admin app",
    status: "verified",
    ssl: "active",
    sslExpiresAt: "2026-12-04",
    addedAt: "2024-05-10",
    addedBy: "Girish Gowda",
    lastCheckedAt: "2026-09-16T13:00:00",
    records: [
      { type: "CNAME", host: "hr", value: "stellar.edge.hrms-cloud.in", status: "verified" },
      { type: "TXT", host: "_hrms-verify.hr", value: "hrms-site-verification=7f3c91e2a4b8", status: "verified" },
    ],
  },
  {
    id: "DOM-2",
    host: "careers.stellartech.in",
    purpose: "Public careers site",
    status: "pending_dns",
    ssl: "pending",
    sslExpiresAt: null,
    addedAt: "2026-09-12",
    addedBy: "Sana Iqbal",
    lastCheckedAt: "2026-09-16T12:30:00",
    records: [
      { type: "CNAME", host: "careers", value: "stellar-careers.edge.hrms-cloud.in", status: "pending" },
      { type: "TXT", host: "_hrms-verify.careers", value: "hrms-site-verification=c02d55e81f6a", status: "verified" },
    ],
  },
];

/* --------------------------------------------------- permission overrides */

export interface PermissionOverride {
  id: string;
  employeeCode: string;
  role: RoleId;
  menuKey: MenuKey;
  grant: Action[];
  revoke: Action[];
  reason: string;
  expiresAt: string | null;
  grantedBy: string;
  grantedAt: string;
}

export const PERMISSION_OVERRIDES: PermissionOverride[] = [
  { id: "OVR-1", employeeCode: "STL-0031", role: "manager", menuKey: "payroll.runs", grant: ["V"], revoke: [], reason: "Shadowing September payroll as part of the finance rotation programme.", expiresAt: "2026-09-30", grantedBy: "Priya Menon", grantedAt: "2026-09-01T10:12:00" },
  { id: "OVR-2", employeeCode: "STL-0058", role: "recruiter", menuKey: "people.directory", grant: ["E"], revoke: [], reason: "Correcting joiner records for the Q3 campus batch.", expiresAt: "2026-10-15", grantedBy: "Priya Menon", grantedAt: "2026-08-20T16:40:00" },
  { id: "OVR-3", employeeCode: "STL-0017", role: "payroll_admin", menuKey: "payroll.runs", grant: [], revoke: ["A"], reason: "Segregation of duties — approver must differ from preparer (internal audit finding IA-2026-07).", expiresAt: null, grantedBy: "Lakshmi Pillai", grantedAt: "2026-07-14T11:05:00" },
  { id: "OVR-4", employeeCode: "STL-0305", role: "helpdesk_agent", menuKey: "reports", grant: ["V", "X"], revoke: [], reason: "Monthly SLA pack for the operations review.", expiresAt: "2026-12-31", grantedBy: "Priya Menon", grantedAt: "2026-06-03T09:30:00" },
  { id: "OVR-5", employeeCode: "STL-0010", role: "it_admin", menuKey: "admin.users", grant: ["E"], revoke: [], reason: "Owns SCIM provisioning fixes during the Okta migration.", expiresAt: "2026-09-10", grantedBy: "Arjun Kapoor", grantedAt: "2026-08-01T12:00:00" },
  { id: "OVR-6", employeeCode: "STL-0005", role: "department_head", menuKey: "people.directory", grant: [], revoke: ["X"], reason: "Bulk export restricted pending DPDP data-minimisation review.", expiresAt: null, grantedBy: "Priya Menon", grantedAt: "2026-05-22T14:18:00" },
];

/** Employees eligible for an override — the persona holders, with their base role. */
export const OVERRIDE_SUBJECTS: { code: string; role: RoleId }[] = [
  { code: "STL-0142", role: "employee" },
  { code: "STL-0031", role: "manager" },
  { code: "STL-0009", role: "hr_admin" },
  { code: "STL-0017", role: "payroll_admin" },
  { code: "STL-0058", role: "recruiter" },
  { code: "STL-0008", role: "finance_controller" },
  { code: "STL-0005", role: "department_head" },
  { code: "STL-0305", role: "helpdesk_agent" },
  { code: "STL-0010", role: "it_admin" },
  { code: "STL-0296", role: "auditor" },
];
