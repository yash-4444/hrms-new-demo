import type { ConsoleTenant, ModuleId, PlanId } from "@/mock/console-tenants";

/* ============================================================================
   Platform Console — feature flags. Each flag has an independent config per
   environment (Production / Staging). A flag is Off, On for everyone, a
   percentage roll-out (tenants are bucketed by a stable hash of flag key +
   tenant id, so 25 % → 40 % only ever adds tenants) or Targeted (by plan
   and/or an explicit tenant list). The kill switch overrides everything and
   keeps the config so it can be restored. Demo clock: 16 Sep 2026.
   ========================================================================== */

export type FlagEnv = "production" | "staging";
export type FlagType = "boolean" | "percentage";
export type FlagState = "off" | "on" | "rollout" | "targeted";

export const FLAG_STATE_LABEL: Record<FlagState, string> = {
  off: "Off",
  on: "On for all",
  rollout: "% roll-out",
  targeted: "Targeted",
};

export interface FlagConfig {
  state: FlagState;
  /** Share of eligible tenants, 0–100 (roll-out only). */
  percent: number;
  /** Plans the flag is limited to; empty = every plan. */
  plans: PlanId[];
  /** Tenants always included, whatever the bucket or plan. */
  tenantIds: string[];
  killed: boolean;
  changedAt: string;
  changedBy: string;
}

export interface FeatureFlag {
  key: string;
  description: string;
  module: ModuleId;
  type: FlagType;
  owner: string;
  env: Record<FlagEnv, FlagConfig>;
}

const cfg = (state: FlagState, changedAt: string, changedBy: string, p: Partial<FlagConfig> = {}): FlagConfig => ({
  state,
  percent: state === "on" ? 100 : 0,
  plans: [],
  tenantIds: [],
  killed: false,
  changedAt,
  changedBy,
  ...p,
});

export const FEATURE_FLAGS: FeatureFlag[] = [
  {
    key: "ai.copilot", module: "platform", type: "percentage", owner: "AI squad · Kunal Desai",
    description: "HR Copilot side panel — natural-language answers over the tenant's own policies and data.",
    env: {
      production: cfg("rollout", "2026-09-16T10:40:00", "Devika Nair", { percent: 40, plans: ["enterprise", "pro"] }),
      staging: cfg("on", "2026-08-30T12:00:00", "Kunal Desai"),
    },
  },
  {
    key: "ai.resume_screening", module: "ats", type: "percentage", owner: "AI squad · Kunal Desai",
    description: "Ranks applicants against the requisition with an explanation per score. Human decision always required.",
    env: {
      production: cfg("targeted", "2026-09-10T15:00:00", "Aditya Rao", { plans: ["enterprise"], tenantIds: ["TN-1019"] }),
      staging: cfg("on", "2026-09-01T11:00:00", "Kunal Desai"),
    },
  },
  {
    key: "attendance.geo_fencing", module: "time", type: "boolean", owner: "Time squad · Pooja Menon",
    description: "Mobile punches outside a branch's geo-fence are flagged for regularisation.",
    env: {
      production: cfg("targeted", "2026-09-15T11:30:00", "Sneha Iyer", { plans: ["enterprise"] }),
      staging: cfg("on", "2026-09-12T10:00:00", "Pooja Menon"),
    },
  },
  {
    key: "payroll.new_formula_engine", module: "payroll", type: "percentage", owner: "Payroll squad · Sanjay Menon",
    description: "Pay-component formulas evaluated by the new engine (EN-07). Shadow-compares against the old one.",
    env: {
      production: cfg("rollout", "2026-09-14T19:10:00", "Devika Nair", { percent: 10, killed: true }),
      staging: cfg("rollout", "2026-09-14T09:00:00", "Sanjay Menon", { percent: 100 }),
    },
  },
  {
    key: "leave.comp_off_v2", module: "leave", type: "boolean", owner: "Leave squad · Ritika Sen",
    description: "Comp-off credits expire per policy and show on the leave ledger. Ships in 2026.10.1.",
    env: {
      production: cfg("off", "2026-09-02T10:00:00", "Ritika Sen"),
      staging: cfg("on", "2026-09-09T16:30:00", "Ritika Sen"),
    },
  },
  {
    key: "ess.mobile_punch", module: "time", type: "boolean", owner: "Time squad · Pooja Menon",
    description: "Punch in and out from the mobile web app, with selfie capture where the tenant enables it.",
    env: {
      production: cfg("on", "2026-07-01T09:00:00", "Aditya Rao"),
      staging: cfg("on", "2026-06-20T09:00:00", "Pooja Menon"),
    },
  },
  {
    key: "analytics.attrition_model", module: "analytics", type: "percentage", owner: "Analytics squad · Irfan Siddiqui",
    description: "Attrition-risk scores on the workforce dashboard. Model card linked from the tile.",
    env: {
      production: cfg("rollout", "2026-09-07T14:00:00", "Aditya Rao", { percent: 25, plans: ["enterprise"] }),
      staging: cfg("on", "2026-08-25T10:00:00", "Irfan Siddiqui"),
    },
  },
  {
    key: "beta.new_org_chart", module: "core", type: "boolean", owner: "Core squad · Leela Varghese",
    description: "Rebuilt org chart with search, dotted-line managers and export to PNG.",
    env: {
      production: cfg("targeted", "2026-09-04T17:40:00", "Devika Nair", { tenantIds: ["TN-1019", "TN-1030"] }),
      staging: cfg("on", "2026-09-01T10:00:00", "Leela Varghese"),
    },
  },
  {
    key: "helpdesk.sla_board", module: "helpdesk", type: "boolean", owner: "Service squad · Arjun Pillai",
    description: "SLA board with breach alerts for helpdesk agents. Generally available since 2026.09.1.",
    env: {
      production: cfg("on", "2026-09-01T09:00:00", "Aditya Rao"),
      staging: cfg("on", "2026-08-18T09:00:00", "Arjun Pillai"),
    },
  },
];

/* FNV-1a bucket in 0–99: stable per (flag, tenant), so raising the % only adds tenants. */
export function bucketOf(flagKey: string, tenantId: string) {
  let h = 0x811c9dc5;
  const s = `${flagKey}:${tenantId}`;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h % 100;
}

export type ExposureReason = "all" | "listed" | "plan" | "bucket";

/** Live tenants that see the flag under this config, and why. */
export function exposedTenants(key: string, c: Pick<FlagConfig, "state" | "percent" | "plans" | "tenantIds" | "killed">, tenants: ConsoleTenant[]) {
  const live = tenants.filter((t) => t.status === "active" || t.status === "trial");
  if (c.killed || c.state === "off") return [];
  const out: { tenant: ConsoleTenant; why: ExposureReason; bucket: number }[] = [];
  for (const t of live) {
    const bucket = bucketOf(key, t.id);
    const planOk = c.plans.length === 0 || c.plans.includes(t.plan);
    if (c.state === "on") out.push({ tenant: t, why: "all", bucket });
    else if (c.tenantIds.includes(t.id)) out.push({ tenant: t, why: "listed", bucket });
    else if (c.state === "targeted" && c.plans.includes(t.plan)) out.push({ tenant: t, why: "plan", bucket });
    else if (c.state === "rollout" && planOk && bucket < c.percent) out.push({ tenant: t, why: "bucket", bucket });
  }
  return out;
}
