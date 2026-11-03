import { CONSOLE_NOW, PLAN_META, COUNTRY_META, type ConsoleTenant, type PlanId, type TenantCountry } from "@/mock/console-tenants";

/* ============================================================================
   Platform Console — announcements: what the vendor tells tenants. Each one
   reaches tenant admins as an in-app banner, an email to the tenant owner, or
   both. Status is derived from the demo clock (CONSOLE_NOW = 16 Sep 2026,
   14:35): before `publishAt` it is Scheduled, until `expiresAt` it is Live,
   then Past. Read / acknowledge rates are the share of recipient tenants
   whose admins opened (or acknowledged) it.
   ========================================================================== */

export type AnnouncementType = "maintenance" | "release" | "incident" | "policy";
export type AnnouncementSeverity = "info" | "warning" | "critical";
export type AnnouncementChannel = "banner" | "email" | "both";
export type AudienceKind = "all" | "plan" | "country" | "tenants";
export type AnnouncementStatus = "scheduled" | "live" | "past";

export const TYPE_LABEL: Record<AnnouncementType, string> = {
  maintenance: "Maintenance window",
  release: "Release notes",
  incident: "Incident",
  policy: "Policy change",
};

export const SEVERITY_LABEL: Record<AnnouncementSeverity, string> = { info: "Info", warning: "Warning", critical: "Critical" };

export const CHANNEL_LABEL: Record<AnnouncementChannel, string> = {
  banner: "In-app banner",
  email: "Email to owners",
  both: "Banner + email",
};

export interface Audience {
  kind: AudienceKind;
  plans: PlanId[];
  countries: TenantCountry[];
  tenantIds: string[];
}

export interface Announcement {
  id: string;
  type: AnnouncementType;
  title: string;
  body: string;
  severity: AnnouncementSeverity;
  audience: Audience;
  channel: AnnouncementChannel;
  publishAt: string;
  /** The banner comes down at this time; maintenance ends with its window. */
  expiresAt: string;
  /** Maintenance only — when the platform is actually affected. */
  window?: { start: string; end: string };
  requiresAck: boolean;
  createdBy: string;
  /** Set when an operator ended it before `expiresAt`. */
  endedAt?: string;
  /** % of recipient tenants that opened it (Live / Past only). */
  readPct?: number;
  /** % that acknowledged it, when acknowledgement is required. */
  ackPct?: number;
}

const ALL: Audience = { kind: "all", plans: [], countries: [], tenantIds: [] };
const plans = (...p: PlanId[]): Audience => ({ ...ALL, kind: "plan", plans: p });
const countries = (...c: TenantCountry[]): Audience => ({ ...ALL, kind: "country", countries: c });
const tenants = (...t: string[]): Audience => ({ ...ALL, kind: "tenants", tenantIds: t });

export const ANNOUNCEMENTS: Announcement[] = [
  /* ---- scheduled */
  {
    id: "ANN-044", type: "maintenance", severity: "warning", channel: "both", audience: ALL, requiresAck: true, createdBy: "Aditya Rao",
    title: "Planned maintenance — Sunday 20 Sep, 02:00–04:00 IST",
    body: "We are upgrading the primary database cluster. HRMS-NEW will be read-only for up to two hours. Punches made on devices are queued and synced afterwards; pay runs cannot be approved during the window.",
    publishAt: "2026-09-17T09:00:00", expiresAt: "2026-09-20T04:00:00", window: { start: "2026-09-20T02:00:00", end: "2026-09-20T04:00:00" },
  },
  {
    id: "ANN-045", type: "policy", severity: "info", channel: "email", audience: plans("pro", "enterprise"), requiresAck: true, createdBy: "Devika Nair",
    title: "Updated Data Processing Addendum (DPDP Rules 2026)",
    body: "Our Data Processing Addendum is updated to reflect the Digital Personal Data Protection Rules. No action is needed to continue; the new terms apply from 1 October 2026. Please acknowledge on behalf of your organisation.",
    publishAt: "2026-09-21T10:00:00", expiresAt: "2026-10-05T23:59:00",
  },
  {
    id: "ANN-046", type: "maintenance", severity: "warning", channel: "both", audience: countries("AE"), requiresAck: false, createdBy: "Aditya Rao",
    title: "UAE region storage migration — Saturday 26 Sep, 23:00–01:00 GST",
    body: "Documents and payslips stored in the Dubai region move to new storage. Uploads and downloads are paused during the window; everything else works normally.",
    publishAt: "2026-09-23T09:00:00", expiresAt: "2026-09-27T01:00:00", window: { start: "2026-09-26T23:00:00", end: "2026-09-27T01:00:00" },
  },
  {
    id: "ANN-047", type: "release", severity: "info", channel: "banner", audience: ALL, requiresAck: false, createdBy: "Sneha Iyer",
    title: "What's new in 2026.10.1 — comp-off v2 and faster payroll previews",
    body: "Comp-off requests now expire automatically per policy, payroll previews open three times faster, and the org chart gains search. Full notes are in the Help centre.",
    publishAt: "2026-10-01T09:00:00", expiresAt: "2026-10-08T09:00:00",
  },
  /* ---- live */
  {
    id: "ANN-043", type: "incident", severity: "critical", channel: "banner", audience: tenants("TN-1011", "TN-1003", "TN-1021"), requiresAck: false, createdBy: "Rohan Batra",
    title: "Biometric punch sync delayed",
    body: "Punches from some biometric devices are arriving late. No punches are lost — they are queued and will appear on attendance once sync recovers. We will update this banner within the hour.",
    publishAt: "2026-09-16T13:20:00", expiresAt: "2026-09-16T20:00:00", readPct: 67,
  },
  {
    id: "ANN-041", type: "release", severity: "info", channel: "banner", audience: ALL, requiresAck: false, createdBy: "Aditya Rao",
    title: "Release 2026.09.2 is live",
    body: "Fixes a leave-accrual rounding issue for mid-month joiners (EN-11) and improves the attendance regularisation inbox. No action needed.",
    publishAt: "2026-09-15T18:30:00", expiresAt: "2026-09-22T18:30:00", readPct: 41,
  },
  {
    id: "ANN-042", type: "policy", severity: "info", channel: "both", audience: plans("free"), requiresAck: true, createdBy: "Devika Nair",
    title: "Free plan: storage allowance and fair-use update",
    body: "From 1 October, Free workspaces include 5 GB of document storage and up to 25 employees. Workspaces above the limit can export or upgrade; nothing is deleted.",
    publishAt: "2026-09-14T10:00:00", expiresAt: "2026-09-30T23:59:00", readPct: 38, ackPct: 22,
  },
  /* ---- past */
  {
    id: "ANN-036", type: "maintenance", severity: "warning", channel: "both", audience: ALL, requiresAck: true, createdBy: "Aditya Rao",
    title: "Payroll engine patch — Sunday 6 Sep, 01:00–03:00 IST",
    body: "Payroll processing paused for a security patch. Pay runs in draft are unaffected.",
    publishAt: "2026-09-03T09:00:00", expiresAt: "2026-09-06T03:00:00", window: { start: "2026-09-06T01:00:00", end: "2026-09-06T03:00:00" },
    endedAt: "2026-09-06T02:00:00", readPct: 88, ackPct: 71,
  },
  {
    id: "ANN-035", type: "incident", severity: "critical", channel: "banner", audience: ALL, requiresAck: false, createdBy: "Rohan Batra",
    title: "Email notifications delayed (resolved)",
    body: "Leave and approval emails were delayed by up to 40 minutes because of a provider issue. All queued emails have been delivered.",
    publishAt: "2026-09-02T10:10:00", expiresAt: "2026-09-02T16:00:00", readPct: 57,
  },
  {
    id: "ANN-034", type: "release", severity: "info", channel: "banner", audience: ALL, requiresAck: false, createdBy: "Sneha Iyer",
    title: "Release 2026.09.1 — new helpdesk SLA board",
    body: "Helpdesk agents get an SLA board with breach alerts. Tenant admins can tune targets under Helpdesk settings.",
    publishAt: "2026-09-01T09:00:00", expiresAt: "2026-09-08T09:00:00", readPct: 46,
  },
  {
    id: "ANN-031", type: "policy", severity: "info", channel: "email", audience: plans("pro"), requiresAck: true, createdBy: "Meera Pillai",
    title: "Pro plan price revision from 1 October 2026",
    body: "The Pro seat price moves to ₹149 per employee per month from your first invoice after 1 October. Annual contracts keep their rate until renewal.",
    publishAt: "2026-08-20T10:00:00", expiresAt: "2026-09-10T23:59:00", readPct: 92, ackPct: 85,
  },
  {
    id: "ANN-029", type: "maintenance", severity: "warning", channel: "both", audience: countries("US"), requiresAck: false, createdBy: "Aditya Rao",
    title: "US region network maintenance (cancelled)",
    body: "The planned network change in N. Virginia was cancelled. No downtime will occur.",
    publishAt: "2026-08-12T09:00:00", expiresAt: "2026-08-16T05:00:00", window: { start: "2026-08-16T03:00:00", end: "2026-08-16T05:00:00" },
    endedAt: "2026-08-14T11:00:00", readPct: 63,
  },
];

export function announcementStatus(a: Announcement, now = CONSOLE_NOW): AnnouncementStatus {
  if (a.endedAt && a.endedAt <= now) return "past";
  if (a.publishAt > now) return "scheduled";
  return a.expiresAt > now ? "live" : "past";
}

/** Tenants that would receive it — live tenants matching the audience. */
export function audienceTenants(a: Audience, all: ConsoleTenant[]) {
  const live = all.filter((t) => t.status === "active" || t.status === "trial" || t.status === "suspended");
  switch (a.kind) {
    case "all":
      return live;
    case "plan":
      return live.filter((t) => a.plans.includes(t.plan));
    case "country":
      return live.filter((t) => a.countries.includes(t.country));
    case "tenants":
      return all.filter((t) => a.tenantIds.includes(t.id));
  }
}

export function audienceLabel(a: Audience, all: ConsoleTenant[]) {
  switch (a.kind) {
    case "all":
      return "All tenants";
    case "plan":
      return `${a.plans.map((p) => PLAN_META[p].label).join(" + ")} plan`;
    case "country":
      return a.countries.map((c) => COUNTRY_META[c].label).join(", ");
    case "tenants":
      return a.tenantIds.length === 1
        ? (all.find((t) => t.id === a.tenantIds[0])?.name ?? a.tenantIds[0])
        : `${a.tenantIds.length} specific tenants`;
  }
}
