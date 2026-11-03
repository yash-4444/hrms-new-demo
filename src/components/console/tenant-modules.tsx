"use client";

import * as React from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODULES, PLAN_META, type ConsoleTenant, type ModuleId, type PlanId } from "@/mock/console-tenants";
import { mockAction } from "@/components/app-state";
import { useConsole } from "@/components/console/console-state";
import { PlanBadge } from "@/components/console/kit";
import { Section } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Hint, Switch } from "@/components/ui/primitives";

/* Tenant detail — Modules tab. The fourteen modules, switchable per tenant
   inside the plan's entitlement. A module outside the plan is locked with
   the plan that unlocks it; Core HR and Platform can never be switched off. */

const LOWEST_PLAN = (m: ModuleId): PlanId =>
  (["free", "pro", "enterprise"] as PlanId[]).find((p) => PLAN_META[p].modules.includes(m)) ?? "enterprise";

export function TenantModulesTab({ tenant: t, onChangePlan }: { tenant: ConsoleTenant; onChangePlan: () => void }) {
  const { updateTenant, logActivity } = useConsole();
  const entitled = PLAN_META[t.plan].modules;
  const closed = t.status === "churned" || t.status === "scheduled_deletion";

  const toggle = (id: ModuleId, on: boolean) => {
    const label = MODULES.find((m) => m.id === id)!.label;
    const before = t.modules;
    const next = on ? [...t.modules, id] : t.modules.filter((m) => m !== id);
    updateTenant(t.id, { modules: next });
    logActivity(t.id, { category: "config", action: on ? "Module enabled by the platform" : "Module disabled by the platform", detail: label });
    mockAction(`${label} ${on ? "enabled" : "disabled"} for ${t.name}`, {
      description: on
        ? "Visible to the tenant's admins now; roles still decide who sees it."
        : "Hidden from every user. Data is kept and returns if the module is switched back on.",
      undo: () => updateTenant(t.id, { modules: before }),
    });
  };

  return (
    <Section
      title="Modules"
      description={`${t.modules.length} of ${MODULES.length} enabled. The ${PLAN_META[t.plan].label} plan entitles ${entitled.length}.`}
      actions={
        <Button size="sm" variant="outline" onClick={onChangePlan} disabled={closed}>
          Change plan
        </Button>
      }
      bodyClassName="p-0"
    >
      <ul className="grid divide-y divide-border md:grid-cols-2 md:divide-y-0">
        {MODULES.map((m, i) => {
          const inPlan = entitled.includes(m.id);
          const on = t.modules.includes(m.id);
          const locked = m.alwaysOn || !inPlan || closed;
          const why = m.alwaysOn
            ? `${m.label} is part of every tenant and cannot be switched off.`
            : !inPlan
              ? `Not in ${PLAN_META[t.plan].label}. Requires ${PLAN_META[LOWEST_PLAN(m.id)].label} or above.`
              : closed
                ? "The tenant is closed."
                : undefined;
          const control = (
            <Switch
              checked={on && inPlan}
              disabled={locked}
              onCheckedChange={(v) => toggle(m.id, v)}
              aria-label={`${m.label} ${on ? "enabled" : "disabled"}`}
            />
          );
          return (
            <li
              key={m.id}
              className={cn(
                "flex items-start gap-3 px-4 py-3 md:border-border",
                i % 2 === 0 && "md:border-r",
                i >= 2 && "md:border-t",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-foreground">
                  {m.label}
                  {!inPlan && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-normal text-muted-foreground">
                      <Lock className="size-3" aria-hidden /> <PlanBadge plan={LOWEST_PLAN(m.id)} />
                    </span>
                  )}
                  {m.alwaysOn && <span className="text-[11px] font-normal text-muted-foreground">Always on</span>}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{m.description}</p>
              </div>
              {why ? (
                <Hint text={why}>
                  <span className="inline-flex cursor-not-allowed">{control}</span>
                </Hint>
              ) : (
                control
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
