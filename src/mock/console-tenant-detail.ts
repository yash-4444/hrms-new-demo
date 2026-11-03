import { fmtDateShort } from "@/lib/format";
import { mulberry32 } from "@/lib/utils";
import { CONSOLE_NOW, PLAN_META, type ConsoleTenant } from "@/mock/console-tenants";

/* ============================================================================
   Platform Console — per-tenant detail: usage series, invoices and the
   tenant-level activity trail. Generated deterministically from the tenant's
   own numbers (seeded by its id), so a reload always shows the same story.
   ========================================================================== */

const seedOf = (t: ConsoleTenant) => Number(t.id.replace(/\D/g, "")) || 1;
const DAY = 86_400_000;
const MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"];

const live = (t: ConsoleTenant) => t.status === "active" || t.status === "trial";

export interface UsageDay {
  day: string;
  /** Total API requests that day, in thousands. */
  requestsK: number;
  /** Busiest minute that day, requests per minute. */
  peakRpm: number;
}

/** The last 30 days of API traffic, ending today. */
export function tenantApiUsage(t: ConsoleTenant): UsageDay[] {
  const rng = mulberry32(seedOf(t));
  const end = new Date(CONSOLE_NOW).getTime();
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(end - (29 - i) * DAY);
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    /* A suspended tenant flat-lines from its suspension; others breathe with the week. */
    const activeDay = live(t) || (t.status === "suspended" && i < 22);
    const base = activeDay ? t.apiPeakRpm || PLAN_META[t.plan].rateLimit * 0.08 : 0;
    const peak = Math.round(base * (weekend ? 0.35 : 0.72 + rng() * 0.28));
    return {
      day: fmtDateShort(d),
      requestsK: Math.round(peak * (weekend ? 90 : 210) * (0.8 + rng() * 0.4)) / 1000,
      peakRpm: i === 29 && live(t) ? t.apiPeakRpm : peak,
    };
  });
}

export interface SeatPoint {
  month: string;
  seats: number;
  limit: number;
}

/** Seats in use at each month end, Apr → Sep 2026. */
export function tenantSeatTrend(t: ConsoleTenant): SeatPoint[] {
  const rng = mulberry32(seedOf(t) * 7);
  const start = t.seatsUsed * (0.78 + rng() * 0.12);
  return MONTHS.map((month, i) => ({
    month,
    seats: i === MONTHS.length - 1 ? t.seatsUsed : Math.round(start + ((t.seatsUsed - start) * i) / (MONTHS.length - 1)),
    limit: t.seatLimit,
  }));
}

export type InvoiceStatus = "paid" | "failed" | "overdue" | "open" | "void";

export interface TenantInvoice {
  id: string;
  period: string;
  issuedOn: string;
  dueOn: string;
  /** INR, before tax. */
  amount: number;
  tax: number;
  status: InvoiceStatus;
}

/** Six months of invoices for a paying tenant; none for Free or an unbilled trial. */
export function tenantInvoices(t: ConsoleTenant): TenantInvoice[] {
  const monthly = t.seatLimit * PLAN_META[t.plan].seatPrice;
  if (!monthly || t.status === "trial" || t.status === "pending") return [];
  const n = seedOf(t);
  const taxRate = t.country === "IN" ? 0.18 : 0;
  const months = [
    ["2026-04", "Apr 2026"],
    ["2026-05", "May 2026"],
    ["2026-06", "Jun 2026"],
    ["2026-07", "Jul 2026"],
    ["2026-08", "Aug 2026"],
    ["2026-09", "Sep 2026"],
  ];
  return months.map(([key, period], i) => {
    const last = i === months.length - 1;
    const prev = i === months.length - 2;
    let status: InvoiceStatus = "paid";
    if (t.payment === "failed" && last) status = "failed";
    if (t.payment === "failed" && t.status === "suspended" && prev) status = "failed";
    if (t.payment === "overdue" && last) status = "overdue";
    if (t.payment === "overdue" && t.status === "suspended" && prev) status = "overdue";
    if (t.status === "churned" || t.status === "scheduled_deletion") status = last ? "void" : "paid";
    const amount = Math.round(monthly * (i < 2 ? 0.94 : 1));
    return {
      id: `INV-${key.slice(2).replace("-", "")}-${n}`,
      period,
      issuedOn: `${key}-01`,
      dueOn: `${key}-15`,
      amount,
      tax: Math.round(amount * taxRate),
      status,
    };
  });
}

export type ActivityCategory = "billing" | "access" | "config" | "lifecycle" | "support";

export interface TenantActivity {
  id: string;
  at: string;
  actor: string;
  /** Who acted: someone in the tenant, a platform operator, or the system. */
  actorKind: "tenant" | "operator" | "system";
  category: ActivityCategory;
  action: string;
  detail: string;
}

/** The tenant-level audit trail as the platform sees it, newest first. */
export function tenantActivity(t: ConsoleTenant): TenantActivity[] {
  const id = (k: string) => `${t.id}-${k}`;
  const owner = t.ownerName;
  const plan = PLAN_META[t.plan].label;
  const out: TenantActivity[] = [
    { id: id("created"), at: `${t.createdAt}T10:12:00`, actor: owner, actorKind: "tenant", category: "lifecycle", action: "Tenant created", detail: `${t.subdomain}.hrms-new.app · ${plan} plan · self-serve sign-up` },
    { id: id("verified"), at: `${t.createdAt}T10:19:00`, actor: owner, actorKind: "tenant", category: "access", action: "Owner email verified", detail: t.ownerEmail },
  ];
  if (t.status === "pending") return out.slice(0, 1).reverse();
  out.push(
    { id: id("import"), at: `${t.createdAt}T15:40:00`, actor: owner, actorKind: "tenant", category: "config", action: "Employees imported", detail: `${Math.max(1, Math.round(t.seatsUsed * 0.8)).toLocaleString("en-IN")} rows from a spreadsheet` },
    { id: id("sso"), at: "2026-06-03T11:00:00", actor: owner, actorKind: "tenant", category: "access", action: t.plan === "enterprise" ? "SAML SSO enabled" : "MFA enforced for admins", detail: t.plan === "enterprise" ? "Identity provider metadata uploaded" : "Applies to Tenant Owner and HR Admin roles" },
    { id: id("release"), at: "2026-09-15T18:30:00", actor: "Release train", actorKind: "system", category: "config", action: "Platform release applied", detail: "2026.09.2 — no tenant action required" },
  );
  if (t.mrr || t.status === "suspended") {
    out.push({ id: id("seats"), at: "2026-07-02T09:15:00", actor: owner, actorKind: "tenant", category: "billing", action: "Seats changed", detail: `${Math.round(t.seatLimit * 0.9).toLocaleString("en-IN")} → ${t.seatLimit.toLocaleString("en-IN")} seats` });
  }
  if (t.payment === "failed" || t.payment === "overdue") {
    out.push({ id: id("dunning"), at: "2026-09-05T08:00:00", actor: "Billing", actorKind: "system", category: "billing", action: t.payment === "failed" ? "Payment retry failed" : "Dunning reminder sent", detail: t.statusNote ?? "Owner notified by email" });
  }
  if (t.status === "suspended") {
    out.push({ id: id("suspend"), at: "2026-09-10T10:00:00", actor: "Devika Nair", actorKind: "operator", category: "lifecycle", action: "Tenant suspended", detail: t.statusNote ?? "Suspended by the platform" });
  }
  if (t.status === "scheduled_deletion" && t.deletionScheduledAt) {
    out.push({ id: id("delete"), at: `${t.deletionScheduledAt}T14:00:00`, actor: "Devika Nair", actorKind: "operator", category: "lifecycle", action: "Deletion scheduled", detail: t.statusNote ?? "30-day retention window started" });
  }
  if (live(t) && t.plan !== "free") {
    out.push({ id: id("support"), at: "2026-08-19T16:05:00", actor: "Rohan Batra", actorKind: "operator", category: "support", action: "Support session (read-only)", detail: "Ticket SUP-4302 · 30 min · reason: payslip PDF rendering · visible to the owner" });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}
