import { PLAN_META, type ConsoleTenant } from "@/mock/console-tenants";

/* ============================================================================
   Platform Console — system health: the dependency checks behind
   /api/v1/health/detailed, background jobs with their run-ledger keys, queue
   depths, per-tenant load and incidents. Snapshot at the demo clock
   (16 Sep 2026, 14:35).

   Health semantics (CLAUDE.md § Health Checks): SQL Server is the only
   check that can report Unhealthy. Every other dependency degrades the
   platform at worst — the type below makes "Unhealthy Redis" unrepresentable.
   ========================================================================== */

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

interface ServiceBase {
  id: string;
  name: string;
  provider: string;
  /** Median check latency, ms. */
  latencyMs: number;
  /** Availability over the last 30 days, %. */
  uptime30d: number;
  lastChecked: string;
  detail: string;
}

export type ServiceHealth = ServiceBase &
  ({ critical: true; status: HealthStatus } | { critical: false; status: Exclude<HealthStatus, "unhealthy"> });

export const SERVICES: ServiceHealth[] = [
  { id: "api", name: "API", provider: "Hrms.Api · 4 instances", critical: false, status: "healthy", latencyMs: 41, uptime30d: 99.98, lastChecked: "2026-09-16T14:34:50", detail: "p95 186 ms · 0.31% 5xx over 24 h" },
  { id: "sql", name: "SQL Server", provider: "SQL Server 2022 · primary + 1 replica", critical: true, status: "healthy", latencyMs: 6, uptime30d: 99.99, lastChecked: "2026-09-16T14:34:50", detail: "CPU 38% · replica lag 0.4 s · 2 slow queries / min" },
  { id: "redis", name: "Redis", provider: "Redis 7 · cache", critical: false, status: "degraded", latencyMs: 14, uptime30d: 99.95, lastChecked: "2026-09-16T14:34:50", detail: "Memory at 91% of maxmemory; 1.2k evictions / min, hit rate down to 78%" },
  { id: "rabbitmq", name: "RabbitMQ", provider: "RabbitMQ 4 · 3-node cluster", critical: false, status: "healthy", latencyMs: 3, uptime30d: 100, lastChecked: "2026-09-16T14:34:50", detail: "6 queues · 16 consumers · no unacked backlog" },
  { id: "storage", name: "Object storage", provider: "S3-compatible · ap-south-1", critical: false, status: "healthy", latencyMs: 38, uptime30d: 99.99, lastChecked: "2026-09-16T14:34:50", detail: "2.4 TB stored · PUT p95 120 ms" },
  { id: "email", name: "Email", provider: "Transactional provider", critical: false, status: "degraded", latencyMs: 220, uptime30d: 99.9, lastChecked: "2026-09-16T14:34:45", detail: "Provider reports deferred delivery to Microsoft 365 mailboxes" },
  { id: "workers", name: "Workers", provider: "Hrms.Workers · 3 instances", critical: false, status: "healthy", latencyMs: 9, uptime30d: 99.97, lastChecked: "2026-09-16T14:34:50", detail: "6 consumers running · last heartbeat 4 s ago" },
];

/** Platform status as /api/v1/health reports it. */
export function overallStatus(services: ServiceHealth[]): HealthStatus {
  if (services.some((s) => s.critical && s.status === "unhealthy")) return "unhealthy";
  return services.some((s) => s.status !== "healthy") ? "degraded" : "healthy";
}

/* ------------------------------------------------------------------ jobs */

export type JobStatus = "succeeded" | "failed" | "running";

export interface BackgroundJob {
  id: string;
  name: string;
  schedule: string;
  lastRunAt: string;
  durationSec: number;
  status: JobStatus;
  nextRunAt: string | null;
  /** The run-ledger key a run writes; a filtered unique index makes a duplicate a no-op. */
  ledgerKey: string;
  /** True when the current period's ledger row already exists, so "Run now" is a no-op. */
  periodDone: boolean;
  note: string;
}

export const JOBS: BackgroundJob[] = [
  { id: "payroll", name: "Payroll run", schedule: "On pay-run approval", lastRunAt: "2026-09-16T11:20:00", durationSec: 222, status: "succeeded", nextRunAt: null, ledgerKey: "payroll-run:{tenant}:2026-09", periodDone: true, note: "Last: Saffron Hospitality Group, 2,140 payslips" },
  { id: "accrual", name: "Leave accrual", schedule: "Monthly, 1st 00:30 tenant time", lastRunAt: "2026-09-01T00:30:00", durationSec: 370, status: "succeeded", nextRunAt: "2026-10-01T00:30:00", ledgerKey: "leave-accrual:{tenant}:2026-09", periodDone: true, note: "34 tenants · 14,820 ledger credits" },
  { id: "rollup", name: "Attendance roll-up", schedule: "Daily 01:00 tenant time", lastRunAt: "2026-09-16T01:00:00", durationSec: 242, status: "succeeded", nextRunAt: "2026-09-17T01:00:00", ledgerKey: "attendance-rollup:{tenant}:2026-09-15", periodDone: true, note: "1 tenant rolled up with late punches pending" },
  { id: "reports", name: "Report generation", schedule: "Every 15 minutes", lastRunAt: "2026-09-16T14:30:00", durationSec: 48, status: "running", nextRunAt: "2026-09-16T14:45:00", ledgerKey: "report:{schedule}:2026-09-16T14:30", periodDone: false, note: "37 scheduled exports queued" },
  { id: "fanout", name: "Notification fan-out", schedule: "Continuous (hub-notifications)", lastRunAt: "2026-09-16T14:34:58", durationSec: 1, status: "succeeded", nextRunAt: null, ledgerKey: "hub:{messageId}", periodDone: false, note: "SignalR groups tenant-{id} / employee-{id}" },
  { id: "biometric", name: "Biometric device sync", schedule: "Every 5 minutes", lastRunAt: "2026-09-16T14:30:00", durationSec: 61, status: "failed", nextRunAt: "2026-09-16T14:35:00", ledgerKey: "biometric-sync:{device}:{batch}", periodDone: false, note: "Godavari Health Clinics: device batch rejected (5xx) — retrying" },
];

/* ---------------------------------------------------------------- queues */

export interface QueueDepth {
  name: string;
  depth: number;
  consumers: number;
  /** Age of the oldest message, seconds. */
  oldestSec: number;
  deadLettered: number;
  /** Depth above which the queue is considered backed up. */
  warnAt: number;
}

export const QUEUES: QueueDepth[] = [
  { name: "hub-notifications", depth: 12, consumers: 2, oldestSec: 1, deadLettered: 0, warnAt: 500 },
  { name: "payroll-runs", depth: 0, consumers: 2, oldestSec: 0, deadLettered: 0, warnAt: 20 },
  { name: "leave-accrual", depth: 0, consumers: 1, oldestSec: 0, deadLettered: 0, warnAt: 50 },
  { name: "report-generation", depth: 37, consumers: 3, oldestSec: 95, deadLettered: 0, warnAt: 200 },
  { name: "email-outbox", depth: 1240, consumers: 2, oldestSec: 840, deadLettered: 18, warnAt: 1000 },
  { name: "biometric-sync", depth: 4860, consumers: 4, oldestSec: 187200, deadLettered: 312, warnAt: 1000 },
];

/* ------------------------------------------------------- noisy neighbours */

/* 429s and slow queries (> 500 ms) over the last 24 h, where notable. */
const LOAD_EXTRA: Record<string, { throttled: number; slow: number }> = {
  "TN-1021": { throttled: 1240, slow: 38 },
  "TN-1006": { throttled: 310, slow: 12 },
  "TN-1011": { throttled: 96, slow: 54 },
  "TN-1001": { throttled: 0, slow: 17 },
  "TN-1003": { throttled: 0, slow: 21 },
  "TN-1027": { throttled: 0, slow: 9 },
};

export interface TenantLoad {
  tenant: ConsoleTenant;
  peakRpm: number;
  limit: number;
  /** Peak as a share of the plan limit, 0–1+. */
  utilisation: number;
  throttled: number;
  errorRate: number;
  slowQueries: number;
}

/** Live tenants by how hard they push their plan's rate limit. */
export function tenantLoad(tenants: ConsoleTenant[], top = 8): TenantLoad[] {
  return tenants
    .filter((t) => (t.status === "active" || t.status === "trial") && t.apiPeakRpm > 0)
    .map((t) => {
      const limit = PLAN_META[t.plan].rateLimit;
      const extra = LOAD_EXTRA[t.id] ?? { throttled: 0, slow: Math.round(t.apiPeakRpm / 250) };
      return { tenant: t, peakRpm: t.apiPeakRpm, limit, utilisation: t.apiPeakRpm / limit, throttled: extra.throttled, errorRate: t.errorRate, slowQueries: extra.slow };
    })
    .sort((a, b) => b.utilisation - a.utilisation)
    .slice(0, top);
}

/* ------------------------------------------------------------- incidents */

export type IncidentStatus = "investigating" | "identified" | "monitoring" | "resolved";
export type Severity = "SEV1" | "SEV2" | "SEV3";

export interface IncidentUpdate {
  at: string;
  status: IncidentStatus;
  message: string;
  author: string;
}

export interface Incident {
  id: string;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  startedAt: string;
  resolvedAt?: string;
  services: string[];
  tenantIds: string[];
  /** Newest first. */
  updates: IncidentUpdate[];
}

export const INCIDENTS: Incident[] = [
  {
    id: "INC-2026-031", title: "Email delivery delayed to Microsoft 365 mailboxes", severity: "SEV2", status: "investigating", startedAt: "2026-09-16T12:40:00", services: ["email"], tenantIds: [],
    updates: [{ at: "2026-09-16T12:52:00", status: "investigating", message: "Payslip and approval emails to Microsoft 365 recipients are deferred by up to 20 minutes. In-app notifications are unaffected.", author: "Rohan Batra" }],
  },
  {
    id: "INC-2026-030", title: "Redis memory pressure — slower dashboards", severity: "SEV3", status: "monitoring", startedAt: "2026-09-16T10:05:00", services: ["redis"], tenantIds: [],
    updates: [
      { at: "2026-09-16T11:30:00", status: "monitoring", message: "Report cache TTL reduced from 60 to 15 minutes; evictions falling. Watching through the evening peak.", author: "Devika Nair" },
      { at: "2026-09-16T10:12:00", status: "investigating", message: "Cache hit rate dropped below 80%; dashboards load 1–2 s slower. No data is affected.", author: "Devika Nair" },
    ],
  },
  {
    id: "INC-2026-029", title: "Biometric punches delayed for one tenant", severity: "SEV3", status: "identified", startedAt: "2026-09-14T06:10:00", services: ["workers"], tenantIds: ["TN-1011"],
    updates: [
      { at: "2026-09-15T09:00:00", status: "identified", message: "A firmware update on 3 devices sends malformed batches; the sync worker retries safely (idempotent batch keys). Vendor patch expected 18 Sep.", author: "Rohan Batra" },
      { at: "2026-09-14T07:05:00", status: "investigating", message: "Punches from Godavari Health Clinics' devices are arriving late or not at all.", author: "Rohan Batra" },
    ],
  },
  {
    id: "INC-2026-027", title: "Payslip PDF generation backlog", severity: "SEV2", status: "resolved", startedAt: "2026-09-01T06:00:00", resolvedAt: "2026-09-01T09:30:00", services: ["workers", "storage"], tenantIds: [],
    updates: [{ at: "2026-09-01T09:30:00", status: "resolved", message: "Backlog cleared after scaling report workers from 2 to 4. No payslip was generated twice.", author: "Devika Nair" }],
  },
  {
    id: "INC-2026-025", title: "API errors after release 2026.08.3", severity: "SEV1", status: "resolved", startedAt: "2026-08-19T15:20:00", resolvedAt: "2026-08-19T15:58:00", services: ["api", "sql"], tenantIds: [],
    updates: [{ at: "2026-08-19T15:58:00", status: "resolved", message: "Rolled back; a missing index on hr.AttendanceRecords caused timeouts. Fixed forward in 2026.08.4.", author: "Devika Nair" }],
  },
];
