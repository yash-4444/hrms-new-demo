"use client";

import * as React from "react";
import { Check, Minus } from "lucide-react";
import { inr, num } from "@/lib/format";
import { MODULES, PLAN_META, type ModuleId, type PlanId } from "@/mock/console-tenants";
import { ADD_ONS, PLAN_COMMERCIAL } from "@/mock/console-plans";
import { Section } from "@/components/shell/page";

/* Plans & Entitlements — the fourteen modules and the plan limits, one row
   each, read straight from PLAN_META / PLAN_COMMERCIAL so the matrix can never
   disagree with what provisioning grants. */

const PLANS: PlanId[] = ["free", "pro", "enterprise"];

const LIMITS: { label: string; value: (p: PlanId) => string }[] = [
  { label: "Seats", value: (p) => (PLAN_META[p].maxSeats ? `Up to ${num(PLAN_META[p].maxSeats ?? 0)}` : "As purchased") },
  { label: "Price per seat / month", value: (p) => (PLAN_META[p].seatPrice ? inr(PLAN_META[p].seatPrice, { decimals: false }) : "Free") },
  { label: "Storage", value: (p) => `${num(PLAN_META[p].storageGb)} GB` },
  { label: "API rate limit", value: (p) => `${num(PLAN_META[p].rateLimit)} / min` },
  { label: "Single sign-on", value: (p) => PLAN_COMMERCIAL[p].sso },
  { label: "Custom domain", value: (p) => PLAN_COMMERCIAL[p].customDomain },
  { label: "Data residency", value: (p) => PLAN_COMMERCIAL[p].dataResidency },
  { label: "Audit log retention", value: (p) => PLAN_COMMERCIAL[p].auditRetention },
  { label: "Support SLA", value: (p) => PLAN_COMMERCIAL[p].supportSla },
];

/* Modules the Learning & Analytics pack adds to a plan that lacks them. */
const PACK = ADD_ONS.find((a) => a.id === "learning");
const PACK_MODULES: ModuleId[] = ["learning", "analytics"];
const addOnFor = (plan: PlanId, module: ModuleId) => !!PACK?.availableOn.includes(plan) && PACK_MODULES.includes(module);

export function EntitlementMatrix() {
  return (
    <Section title="Entitlement matrix" description="What each plan includes. Always-on modules cannot be switched off by a tenant." bodyClassName="p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-xs">
          <caption className="sr-only">Modules and limits by plan</caption>
          <thead>
            <tr className="border-b border-border bg-subtle text-left">
              <th scope="col" className="px-4 py-2 font-medium text-muted-foreground">
                Module or limit
              </th>
              {PLANS.map((p) => (
                <th key={p} scope="col" className="w-[22%] px-3 py-2 text-center font-semibold text-foreground">
                  {PLAN_META[p].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <th colSpan={4} scope="colgroup" className="bg-muted/40 px-4 py-1.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Modules
              </th>
            </tr>
            {MODULES.map((m) => (
              <tr key={m.id} className="border-b border-border last:border-0">
                <th scope="row" className="px-4 py-1.5 text-left font-normal">
                  <span className="font-medium text-foreground">{m.label}</span>
                  {m.alwaysOn && <span className="ml-1.5 text-[11px] text-muted-foreground">always on</span>}
                </th>
                {PLANS.map((p) => {
                  const has = PLAN_META[p].modules.includes(m.id);
                  const addOn = !has && addOnFor(p, m.id);
                  return (
                    <td key={p} className="px-3 py-1.5 text-center">
                      {has ? (
                        <span className="inline-flex items-center text-success-fg">
                          <Check className="size-3.5" aria-hidden />
                          <span className="sr-only">Included</span>
                        </span>
                      ) : addOn ? (
                        <span className="text-[11px] text-info-fg">Add-on</span>
                      ) : (
                        <span className="inline-flex items-center text-muted-foreground">
                          <Minus className="size-3.5" aria-hidden />
                          <span className="sr-only">Not included</span>
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="border-y border-border">
              <th colSpan={4} scope="colgroup" className="bg-muted/40 px-4 py-1.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Limits
              </th>
            </tr>
            {LIMITS.map((l) => (
              <tr key={l.label} className="border-b border-border last:border-0">
                <th scope="row" className="px-4 py-1.5 text-left font-medium text-foreground">
                  {l.label}
                </th>
                {PLANS.map((p) => (
                  <td key={p} className="tnum px-3 py-1.5 text-center text-foreground">
                    {l.value(p)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
