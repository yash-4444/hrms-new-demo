import type { PlanId } from "@/mock/console-tenants";

/* ============================================================================
   Platform Console — the commercial side of each plan that PLAN_META (price,
   seats, storage, rate limit, modules) does not carry: support terms, SSO,
   custom domains, residency and audit retention, plus the add-on catalogue.

   Plans are versioned. A tenant's subscription is stamped with the plan
   version it bought; an edit here creates the next version, which a tenant
   picks up at its own next renewal — never retroactively.
   ========================================================================== */

export interface PlanCommercial {
  tagline: string;
  supportSla: string;
  sso: string;
  customDomain: string;
  dataResidency: string;
  auditRetention: string;
  /** Current published plan version and when it took effect. */
  version: number;
  versionSince: string;
}

export const PLAN_COMMERCIAL: Record<PlanId, PlanCommercial> = {
  free: {
    tagline: "Core HR, attendance and leave for small teams.",
    supportSla: "Email, best effort (2 business days)",
    sso: "—",
    customDomain: "—",
    dataResidency: "Country default region",
    auditRetention: "90 days",
    version: 2,
    versionSince: "2025-04-01",
  },
  pro: {
    tagline: "Payroll, hiring and the employee lifecycle for growing companies.",
    supportSla: "Email & chat — first response in 8 business hours",
    sso: "Google / Microsoft sign-in",
    customDomain: "—",
    dataResidency: "Country default region",
    auditRetention: "1 year",
    version: 3,
    versionSince: "2026-04-01",
  },
  enterprise: {
    tagline: "Every module, multi-entity payroll and dedicated support.",
    supportSla: "24×7 phone — P1 response in 1 hour, named CSM",
    sso: "SAML 2.0 / OIDC with SCIM",
    customDomain: "Included",
    dataResidency: "Choice of region, dedicated database option",
    auditRetention: "7 years",
    version: 3,
    versionSince: "2026-04-01",
  },
};

export interface AddOn {
  id: string;
  name: string;
  description: string;
  /** INR per unit per month. */
  price: number;
  unit: string;
  availableOn: PlanId[];
  /** Plans that get it at no extra cost. */
  includedIn: PlanId[];
  /** Tenants paying for it today. */
  tenantIds: string[];
}

export const ADD_ONS: AddOn[] = [
  {
    id: "storage",
    name: "Extra storage",
    description: "Documents, payslips and attachments beyond the plan's allowance.",
    price: 1500,
    unit: "100 GB",
    availableOn: ["pro", "enterprise"],
    includedIn: [],
    tenantIds: ["TN-1003", "TN-1011", "TN-1027"],
  },
  {
    id: "ai",
    name: "AI suite",
    description: "Copilot, résumé screening, attrition signals and policy Q&A.",
    price: 39,
    unit: "seat",
    availableOn: ["pro", "enterprise"],
    includedIn: [],
    tenantIds: ["TN-1006", "TN-1008", "TN-1023", "TN-1030", "TN-1036"],
  },
  {
    id: "learning",
    name: "Learning & Analytics pack",
    description: "Adds the Learning and Workforce Analytics modules to Pro.",
    price: 35,
    unit: "seat",
    availableOn: ["pro"],
    includedIn: ["enterprise"],
    tenantIds: ["TN-1001", "TN-1014"],
  },
  {
    id: "support",
    name: "Premium support",
    description: "24×7 phone line, 1-hour P1 response and a named success manager.",
    price: 25000,
    unit: "tenant",
    availableOn: ["pro"],
    includedIn: ["enterprise"],
    tenantIds: ["TN-1011"],
  },
];

/** Every subscription renews on the 1st; the earliest a plan edit can land. */
export const NEXT_RENEWAL = "2026-10-01";
