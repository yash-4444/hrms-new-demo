import { CONSOLE_TENANTS, CONSOLE_TODAY, daysFromToday, type ConsoleTenant, type PlanId } from "@/mock/console-tenants";

/* ============================================================================
   Platform Console — overview figures: the twelve-month growth trend and the
   platform-wide event feed. KPI tiles and the plan mix are derived from the
   live tenant list (see consoleKpis), never typed in.
   ========================================================================== */

export interface GrowthPoint {
  month: string;
  signups: number;
  churned: number;
  /** Platform MRR at month end, INR. */
  mrr: number;
}

/* Month-end MRR (INR) and churn per month. Sign-ups are counted from the
   tenants' own created dates, so the trend and the tenant list agree. Churn
   matches the churned / scheduled-for-deletion tenants in the fixture. */
const MONTHS: [key: string, label: string, mrr: number, churned: number][] = [
  ["2025-10", "Oct 2025", 1684000, 0],
  ["2025-11", "Nov 2025", 1731000, 0],
  ["2025-12", "Dec 2025", 1748000, 1],
  ["2026-01", "Jan 2026", 1947000, 0],
  ["2026-02", "Feb 2026", 1958000, 1],
  ["2026-03", "Mar 2026", 1979000, 0],
  ["2026-04", "Apr 2026", 2012000, 0],
  ["2026-05", "May 2026", 2061000, 0],
  ["2026-06", "Jun 2026", 2089000, 0],
  ["2026-07", "Jul 2026", 2118000, 0],
  ["2026-08", "Aug 2026", 2226460, 1],
  ["2026-09", "Sep 2026", 2166860, 1],
];

/* The MRR curve above was drafted against a September MRR of ₹21,66,860.
   Scaling it by the tenants' live MRR keeps the last point equal to the
   overview tile whatever the seat prices are. */
const DRAFTED_SEP_MRR = 2166860;

/** Ratio of the fixture's live MRR to the drafted curve; billing scales by it too. */
export const MRR_SCALE =
  CONSOLE_TENANTS.filter((t) => t.status === "active").reduce((a, t) => a + t.mrr, 0) / DRAFTED_SEP_MRR;

/** Oct 2025 → Sep 2026. September is month-to-date (16 days). */
export const GROWTH_TREND: GrowthPoint[] = MONTHS.map(([key, month, mrr, churned]) => ({
  month,
  signups: CONSOLE_TENANTS.filter((t) => t.createdAt.startsWith(key)).length,
  churned,
  mrr: Math.round(mrr * MRR_SCALE),
}));

export type PlatformEventKind = "signup" | "upgrade" | "downgrade" | "payment" | "suspension" | "support" | "incident" | "deletion" | "release";

export interface PlatformEvent {
  id: string;
  at: string;
  kind: PlatformEventKind;
  title: string;
  detail: string;
  tenantId?: string;
  actor: string;
}

export const PLATFORM_EVENTS: PlatformEvent[] = [
  { id: "pe-01", at: "2026-09-16T13:58:00", kind: "incident", title: "Error rate above 3% — Godavari Health Clinics", detail: "Biometric sync worker retrying on /punches. Auto-ticket OPS-2291 opened.", tenantId: "TN-1011", actor: "Alerting" },
  { id: "pe-02", at: "2026-09-16T12:40:00", kind: "payment", title: "Card declined — Vindhya Steel Fabricators", detail: "Invoice INV-2609-1005 · ₹3,98,000 · retry 3 of 4 failed.", tenantId: "TN-1005", actor: "Billing" },
  { id: "pe-03", at: "2026-09-16T11:15:00", kind: "support", title: "Support session closed — Coromandel Fintech", detail: "Ticket SUP-4417 · 30 min · read-only · ended by the operator.", tenantId: "TN-1006", actor: "Rohan Batra" },
  { id: "pe-04", at: "2026-09-16T09:05:00", kind: "upgrade", title: "Seats added — Kaveri Textiles", detail: "400 → 450 seats on Pro. Prorated invoice raised.", tenantId: "TN-1001", actor: "Ramesh Subramanian" },
  { id: "pe-05", at: "2026-09-15T18:30:00", kind: "release", title: "Release 2026.09.2 rolled out", detail: "All tenants · leave accrual fix EN-11 · zero-downtime.", actor: "Release train" },
  { id: "pe-06", at: "2026-09-14T16:20:00", kind: "signup", title: "New sign-up — Pench Wildlife Resorts", detail: "Free plan · owner email not yet verified.", tenantId: "TN-1020", actor: "Self-serve" },
  { id: "pe-07", at: "2026-09-12T15:10:00", kind: "signup", title: "Enterprise contract signed — Narmada Infra Projects", detail: "3,000 seats · awaiting data-residency confirmation.", tenantId: "TN-1012", actor: "Kiran Joshi (Sales)" },
  { id: "pe-08", at: "2026-09-10T10:00:00", kind: "suspension", title: "Suspended — Konkan Marine Services", detail: "Two invoices past 60 days. Users see the read-only billing notice.", tenantId: "TN-1009", actor: "Devika Nair" },
  { id: "pe-09", at: "2026-09-04T11:45:00", kind: "signup", title: "Trial started — Cobalt Harbor Software", detail: "Pro trial · 14 days · United States data residency.", tenantId: "TN-1025", actor: "Self-serve" },
  { id: "pe-10", at: "2026-09-02T14:00:00", kind: "deletion", title: "Deletion scheduled — Ganga Retail Ventures", detail: "Owner erasure request · purge on 02 Oct 2026 after the 30-day window.", tenantId: "TN-1015", actor: "Devika Nair" },
  { id: "pe-11", at: "2026-09-01T09:30:00", kind: "deletion", title: "Deletion scheduled — Oasis Bay Hospitality", detail: "Contract ended · full export delivered on 29 Aug.", tenantId: "TN-1029", actor: "Aditya Rao" },
  { id: "pe-12", at: "2026-08-28T12:00:00", kind: "downgrade", title: "Plan change — Bluegill Analytics", detail: "Payroll module switched off; seats unchanged.", tenantId: "TN-1023", actor: "Megan Caldwell" },
];

/** Headline numbers for the overview, from the current tenant list. */
export function consoleKpis(tenants: ConsoleTenant[]) {
  const live = tenants.filter((t) => t.status !== "churned");
  const active = tenants.filter((t) => t.status === "active");
  const mrr = active.reduce((a, t) => a + t.mrr, 0);
  return {
    total: live.length,
    active: active.length,
    trialsEndingSoon: tenants.filter((t) => t.status === "trial" && t.trialEndsAt && daysFromToday(t.trialEndsAt) <= 7).length,
    trials: tenants.filter((t) => t.status === "trial").length,
    suspended: tenants.filter((t) => t.status === "suspended").length,
    employees: tenants.filter((t) => t.status === "active" || t.status === "trial").reduce((a, t) => a + t.seatsUsed, 0),
    mrr,
    arr: mrr * 12,
  };
}

/** Tenants per plan, counting everything not churned or being deleted. */
export function planMix(tenants: ConsoleTenant[]): { name: string; value: number; plan: PlanId }[] {
  const live = tenants.filter((t) => t.status !== "churned" && t.status !== "scheduled_deletion");
  return (["free", "pro", "enterprise"] as PlanId[]).map((p) => ({
    plan: p,
    name: p === "free" ? "Free" : p === "pro" ? "Pro" : "Enterprise",
    value: live.filter((t) => t.plan === p).length,
  }));
}

export { CONSOLE_TODAY };
