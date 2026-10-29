/* ============================================================================
   Background-job run ledger and system health. Every scheduled run writes a
   run-ledger row keyed by (job, run key); a second run for the same key is
   recorded as Skipped — the idempotency guard, not a double credit.
   ========================================================================== */

import { mulberry32, randInt } from "@/lib/utils";

export type JobStatus = "succeeded" | "failed" | "running" | "skipped";

export interface JobDef {
  id: string;
  label: string;
  queue: string;
  schedule: string;
  runKeyFormat: string;
  description: string;
}

export const JOB_DEFS: JobDef[] = [
  { id: "leave-accrual", label: "Leave accrual (monthly)", queue: "leave", schedule: "1st of month · 00:30 IST", runKeyFormat: "YYYY-MM", description: "Credits monthly EL/SL accruals per policy version stamped on each employee." },
  { id: "leave-year-end", label: "Leave year-end carry-forward", queue: "leave", schedule: "1 Jan · 01:00 IST", runKeyFormat: "YYYY", description: "Carries forward, lapses or encashes balances per policy." },
  { id: "payroll-calc", label: "Payroll calculation", queue: "payroll", schedule: "On demand", runKeyFormat: "PAYRUN-YYYY-MM", description: "Computes gross-to-net for every employee in the pay run." },
  { id: "payslip-gen", label: "Payslip generation", queue: "payroll", schedule: "On pay-run approval", runKeyFormat: "PAYRUN-YYYY-MM", description: "Renders password-protected payslip PDFs and publishes them." },
  { id: "doc-ocr", label: "Document OCR", queue: "documents", schedule: "Continuous", runKeyFormat: "BATCH-YYYYMMDD-HH", description: "Extracts PAN, Aadhaar (masked) and bank details from uploaded documents." },
  { id: "ai-index", label: "AI knowledge indexing", queue: "ai", schedule: "Every 6 hours", runKeyFormat: "YYYYMMDD-HH", description: "Chunks and embeds policies and handbooks for Ask-HR." },
  { id: "attrition", label: "Attrition scoring (nightly)", queue: "ai", schedule: "Daily · 02:00 IST", runKeyFormat: "YYYY-MM-DD", description: "Scores flight risk for every active employee." },
  { id: "email-outbox", label: "Email outbox dispatcher", queue: "messaging", schedule: "Every minute", runKeyFormat: "YYYYMMDD-HHMM", description: "Sends queued transactional email with retry and back-off." },
  { id: "biometric", label: "Biometric punch ingestion", queue: "attendance", schedule: "Every 5 minutes", runKeyFormat: "DEVICE-YYYYMMDD-HHMM", description: "Pulls punches from eSSL and ZKTeco devices and de-duplicates them." },
];

export interface JobRun {
  id: string;
  jobId: string;
  runKey: string;
  status: JobStatus;
  trigger: "schedule" | "manual" | "event";
  startedAt: string;
  durationSec: number | null;
  records: number;
  message: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

function buildRuns(): JobRun[] {
  const rng = mulberry32(8812);
  const runs: JobRun[] = [];
  const add = (r: Omit<JobRun, "id">) => runs.push({ id: `RUN-${String(runs.length + 1).padStart(4, "0")}`, ...r });

  /* Leave accrual — monthly, with a duplicate prevented this month. */
  ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09"].forEach((m) =>
    add({ jobId: "leave-accrual", runKey: m, status: "succeeded", trigger: "schedule", startedAt: `${m}-01T00:30:00`, durationSec: randInt(rng, 38, 61), records: 334 + randInt(rng, 0, 6), message: "Accruals credited to the leave ledger." }),
  );
  add({ jobId: "leave-accrual", runKey: "2026-09", status: "skipped", trigger: "manual", startedAt: "2026-09-03T11:14:00", durationSec: 0, records: 0, message: "Duplicate run prevented — leave accrual already succeeded for 2026-09 (RUN-0005). No balances were changed." });
  add({ jobId: "leave-year-end", runKey: "2026", status: "succeeded", trigger: "schedule", startedAt: "2026-01-01T01:00:00", durationSec: 212, records: 318, message: "Carried forward 2,914.5 days; lapsed 406 days; encashed 118 days." });

  /* Payroll + payslips. */
  ["2026-06", "2026-07", "2026-08"].forEach((m, i) => {
    add({ jobId: "payroll-calc", runKey: `PAYRUN-${m}`, status: "succeeded", trigger: "manual", startedAt: `${m}-26T15:${pad(10 + i)}:00`, durationSec: randInt(rng, 140, 190), records: 336 + i, message: "Gross-to-net computed. 0 exceptions." });
    add({ jobId: "payslip-gen", runKey: `PAYRUN-${m}`, status: "succeeded", trigger: "event", startedAt: `${m}-28T18:${pad(2 + i)}:00`, durationSec: randInt(rng, 300, 420), records: 336 + i, message: "Payslips published and notifications queued." });
  });
  add({ jobId: "payroll-calc", runKey: "PAYRUN-2026-09", status: "running", trigger: "manual", startedAt: "2026-09-16T14:21:00", durationSec: null, records: 212, message: "Processing 212 of 340 employees…" });

  /* Document OCR — one failure to retry. */
  for (let h = 9; h <= 14; h++) {
    const fail = h === 12;
    add({ jobId: "doc-ocr", runKey: `BATCH-20260916-${pad(h)}`, status: fail ? "failed" : "succeeded", trigger: "schedule", startedAt: `2026-09-16T${pad(h)}:00:00`, durationSec: fail ? 34 : randInt(rng, 40, 120), records: fail ? 0 : randInt(rng, 4, 22), message: fail ? "OCR provider returned 503 Service Unavailable after 3 retries. 14 documents remain queued." : "Documents processed; masked identifiers stored." });
  }

  /* AI indexing + attrition. */
  ["00", "06", "12"].forEach((h) =>
    add({ jobId: "ai-index", runKey: `20260916-${h}`, status: "succeeded", trigger: "schedule", startedAt: `2026-09-16T${h}:00:00`, durationSec: randInt(rng, 60, 140), records: randInt(rng, 2, 9), message: "Changed documents re-embedded." }),
  );
  for (let d = 10; d <= 16; d++) {
    const fail = d === 14;
    add({ jobId: "attrition", runKey: `2026-09-${pad(d)}`, status: fail ? "failed" : "succeeded", trigger: "schedule", startedAt: `2026-09-${pad(d)}T02:00:00`, durationSec: fail ? 12 : randInt(rng, 90, 130), records: fail ? 0 : 334, message: fail ? "Feature store snapshot missing for 2026-09-13 — upstream attendance roll-up had not finished." : "Risk scores refreshed for all active employees." });
  }

  /* Email outbox + biometric. */
  for (let m = 25; m <= 34; m++) {
    add({ jobId: "email-outbox", runKey: `20260916-14${pad(m)}`, status: "succeeded", trigger: "schedule", startedAt: `2026-09-16T14:${pad(m)}:00`, durationSec: randInt(rng, 1, 4), records: randInt(rng, 0, 18), message: "Outbox drained." });
  }
  for (let m = 0; m <= 30; m += 5) {
    add({ jobId: "biometric", runKey: `DEVICE-20260916-14${pad(m)}`, status: "succeeded", trigger: "schedule", startedAt: `2026-09-16T14:${pad(m)}:00`, durationSec: randInt(rng, 3, 9), records: randInt(rng, 0, 26), message: "Punches ingested from 6 devices; duplicates discarded." });
  }
  return runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export const JOB_RUNS: JobRun[] = buildRuns();

/* --------------------------------------------------------------- health */

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface ServiceHealth {
  id: string;
  name: string;
  kind: string;
  status: HealthStatus;
  latencyMs: number;
  uptime30d: number;
  detail: string;
  spark: { value: number }[];
}

function spark(seed: number, base: number, jitter: number, spikeAt?: number) {
  const rng = mulberry32(seed);
  return Array.from({ length: 24 }, (_, i) => ({
    value: Math.round(base + (rng() - 0.5) * jitter + (spikeAt !== undefined && i >= spikeAt ? base * 2.5 : 0)),
  }));
}

export const SERVICE_HEALTH: ServiceHealth[] = [
  { id: "api", name: "HRMS API", kind: "ASP.NET Core · 3 pods", status: "healthy", latencyMs: 84, uptime30d: 99.98, detail: "p95 84 ms · 412 req/s · error rate 0.03%", spark: spark(11, 80, 18) },
  { id: "sql", name: "SQL Server", kind: "Azure SQL · Business Critical", status: "healthy", latencyMs: 6, uptime30d: 99.99, detail: "DTU 38% · 0 blocked sessions · geo-replica lag 2 s", spark: spark(12, 6, 3) },
  { id: "redis", name: "Redis cache", kind: "Azure Cache for Redis · C2", status: "degraded", latencyMs: 41, uptime30d: 99.71, detail: "Memory 91% — evictions since 13:40. Reads falling back to SQL; no data loss.", spark: spark(13, 4, 2, 18) },
  { id: "rabbit", name: "RabbitMQ", kind: "3-node quorum cluster", status: "healthy", latencyMs: 3, uptime30d: 99.97, detail: "9 queues · 0 dead-lettered in 24 h · consumer lag < 1 s", spark: spark(14, 3, 2) },
  { id: "storage", name: "File storage", kind: "Azure Blob · LRS, India Central", status: "healthy", latencyMs: 22, uptime30d: 99.99, detail: "1.82 TB used · versioning and soft delete on", spark: spark(15, 22, 8) },
  { id: "email", name: "Email provider", kind: "SMTP relay · SES ap-south-1", status: "healthy", latencyMs: 140, uptime30d: 99.94, detail: "Bounce rate 0.4% · complaint rate 0.01% · DKIM aligned", spark: spark(16, 140, 40) },
  { id: "ai", name: "AI provider", kind: "LLM gateway · India region", status: "healthy", latencyMs: 920, uptime30d: 99.86, detail: "p95 1.4 s · 61,840 / 1,00,000 credits used this month", spark: spark(17, 900, 260) },
];

export interface Incident {
  id: string;
  title: string;
  service: string;
  severity: "SEV-1" | "SEV-2" | "SEV-3";
  startedAt: string;
  resolvedAt: string | null;
  impact: string;
}

export const INCIDENTS: Incident[] = [
  { id: "INC-0412", title: "Redis memory pressure causing cache evictions", service: "Redis cache", severity: "SEV-3", startedAt: "2026-09-16T13:40:00", resolvedAt: null, impact: "Slightly slower dashboards; all reads served from SQL. Scaling to C3 is scheduled for 18:00 IST." },
  { id: "INC-0409", title: "OCR provider outage", service: "Document OCR", severity: "SEV-3", startedAt: "2026-09-16T12:00:00", resolvedAt: "2026-09-16T12:48:00", impact: "14 uploaded documents queued; no documents lost." },
  { id: "INC-0398", title: "Elevated API latency during payroll lock", service: "HRMS API", severity: "SEV-2", startedAt: "2026-08-28T17:55:00", resolvedAt: "2026-08-28T18:21:00", impact: "p95 rose to 2.1 s for 26 minutes. Root cause: missing index on PayRunLines; fixed in release 4.18.2." },
  { id: "INC-0371", title: "Email delivery delay", service: "Email provider", severity: "SEV-3", startedAt: "2026-08-11T09:10:00", resolvedAt: "2026-08-11T09:52:00", impact: "Leave notifications delayed up to 40 minutes. Outbox retried automatically; nothing dropped." },
];
