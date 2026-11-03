"use client";

import * as React from "react";
import { OctagonX, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { num } from "@/lib/format";
import { PLAN_META, type PlanId } from "@/mock/console-tenants";
import { FLAG_STATE_LABEL, exposedTenants, type FeatureFlag, type FlagConfig, type FlagEnv, type FlagState } from "@/mock/console-flags";
import { useConsole } from "@/components/console/console-state";
import { TenantMultiSelect } from "@/components/console/tenant-multi-select";
import { Button } from "@/components/ui/button";
import { Alert, Checkbox, Field, Switch, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";

/* Edit a flag's roll-out in one environment: state, percentage, plans,
   always-on tenants and the kill switch — with the exposure it will produce
   shown live before anything is saved. A reason is required. */

export type RolloutPatch = Pick<FlagConfig, "state" | "percent" | "plans" | "tenantIds" | "killed">;

const STATES: FlagState[] = ["off", "on", "rollout", "targeted"];

export function FlagRolloutDialog({
  flag,
  env,
  onOpenChange,
  onSave,
}: {
  flag: FeatureFlag;
  env: FlagEnv;
  onOpenChange: (v: boolean) => void;
  onSave: (patch: RolloutPatch, reason: string) => void;
}) {
  const { tenants } = useConsole();
  const c = flag.env[env];
  const [state, setState] = React.useState<FlagState>(c.state);
  const [percent, setPercent] = React.useState(c.percent);
  const [plans, setPlans] = React.useState<PlanId[]>(c.plans);
  const [tenantIds, setTenantIds] = React.useState<string[]>(c.tenantIds);
  const [killed, setKilled] = React.useState(c.killed);
  const [reason, setReason] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  const next: RolloutPatch = { state, percent: state === "on" ? 100 : state === "rollout" ? percent : 0, plans: state === "on" || state === "off" ? [] : plans, tenantIds: state === "on" || state === "off" ? [] : tenantIds, killed };
  const live = tenants.filter((t) => t.status === "active" || t.status === "trial").length;
  const before = exposedTenants(flag.key, c, tenants).length;
  const after = exposedTenants(flag.key, next, tenants).length;
  const targetEmpty = state === "targeted" && plans.length === 0 && tenantIds.length === 0;
  const reasonOk = reason.trim().length >= 5;
  const valid = reasonOk && !targetEmpty;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontal className="size-4" aria-hidden /> <span className="font-mono text-sm">{flag.key}</span>
          </DialogTitle>
          <DialogDescription>
            Roll-out in <span className="font-medium capitalize">{env}</span>. Changes apply within a minute — tenants pick them up on their next request.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <Field label="State" required>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="radiogroup" aria-label="State">
              {STATES.map((s) => {
                const disabled = s === "rollout" && flag.type === "boolean";
                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={state === s}
                    disabled={disabled}
                    title={disabled ? "Boolean flags cannot roll out by percentage — use Targeted." : undefined}
                    onClick={() => setState(s)}
                    className={cn(
                      "rounded-md border px-2 py-1.5 text-xs focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                      state === s ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border hover:bg-muted",
                    )}
                  >
                    {FLAG_STATE_LABEL[s]}
                  </button>
                );
              })}
            </div>
          </Field>

          {state === "rollout" && (
            <Field label={`Roll-out — ${percent}% of eligible tenants`} htmlFor="flag-pct" hint="Tenants are bucketed by a stable hash, so raising the percentage only ever adds tenants.">
              <input
                id="flag-pct"
                type="range"
                min={0}
                max={100}
                step={5}
                value={percent}
                onChange={(e) => setPercent(Number(e.target.value))}
                className="w-full accent-[var(--primary)]"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground" aria-hidden>
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </Field>
          )}

          {(state === "rollout" || state === "targeted") && (
            <>
              <Field label={state === "rollout" ? "Limit to plans" : "Target plans"} hint={state === "rollout" ? "None ticked = every plan is eligible." : "Every live tenant on a ticked plan sees the flag."}>
                <div className="flex flex-wrap gap-4">
                  {(Object.keys(PLAN_META) as PlanId[]).map((p) => (
                    <label key={p} className="flex items-center gap-1.5 text-xs">
                      <Checkbox checked={plans.includes(p)} onCheckedChange={() => setPlans(plans.includes(p) ? plans.filter((x) => x !== p) : [...plans, p])} />
                      {PLAN_META[p].label}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Always include these tenants" error={touched && targetEmpty ? "Target at least one plan or tenant." : undefined}>
                <TenantMultiSelect tenants={tenants.filter((t) => t.status === "active" || t.status === "trial")} value={tenantIds} onChange={setTenantIds} invalid={touched && targetEmpty} />
              </Field>
            </>
          )}

          <label className={cn("flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-xs", killed ? "border-destructive/40 bg-destructive-soft" : "border-border")}>
            <span className="flex items-start gap-2">
              <OctagonX className={cn("mt-0.5 size-4 shrink-0", killed ? "text-destructive-fg" : "text-muted-foreground")} aria-hidden />
              <span>
                <span className="font-medium">Kill switch</span>
                <span className="block text-muted-foreground">Turns the flag off for every tenant immediately, keeping the roll-out above so it can be restored.</span>
              </span>
            </span>
            <Switch checked={killed} onCheckedChange={setKilled} aria-label="Kill switch" />
          </label>

          <Alert tone={after > before ? "warning" : "info"} title={`${num(after)} of ${num(live)} live tenants will see this flag`}>
            {after === before ? "No change in exposure." : after > before ? `${num(after - before)} more than today.` : `${num(before - after)} fewer than today.`}
          </Alert>

          <Field label="Reason" htmlFor="flag-reason" required error={touched && !reasonOk ? "Add a short reason (at least 5 characters)." : undefined}>
            <Textarea id="flag-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Recorded in the console audit log." aria-invalid={touched && !reasonOk} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={killed && !c.killed ? "destructive" : "default"}
            disabled={touched && !valid}
            onClick={() => {
              setTouched(true);
              if (valid) onSave(next, reason.trim());
            }}
          >
            {killed && !c.killed ? "Kill flag" : "Save roll-out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
