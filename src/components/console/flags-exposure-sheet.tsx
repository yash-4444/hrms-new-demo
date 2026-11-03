"use client";

import * as React from "react";
import { Flag, OctagonX, SlidersHorizontal } from "lucide-react";
import { fmtDateTime, num } from "@/lib/format";
import { MODULES, PLAN_META } from "@/mock/console-tenants";
import { exposedTenants, type ExposureReason, type FeatureFlag, type FlagEnv } from "@/mock/console-flags";
import { useConsole } from "@/components/console/console-state";
import { PlanBadge } from "@/components/console/kit";
import { Facts } from "@/components/platform/kit";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/primitives";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/overlays";
import { FlagStatePill, targetingSummary } from "@/components/console/flags-kit";

/* Which tenants a flag reaches right now in one environment, and why each
   one is in: everyone, its plan, an explicit pick, or its roll-out bucket. */

const WHY: Record<ExposureReason, string> = {
  all: "On for all",
  listed: "Explicitly included",
  plan: "Plan targeted",
  bucket: "Roll-out bucket",
};

export function FlagExposureSheet({
  flag,
  env,
  onOpenChange,
  onEdit,
}: {
  flag: FeatureFlag | null;
  env: FlagEnv;
  onOpenChange: (v: boolean) => void;
  onEdit: (f: FeatureFlag) => void;
}) {
  const { tenants } = useConsole();
  const c = flag?.env[env];
  const exposed = flag && c ? exposedTenants(flag.key, c, tenants) : [];
  const live = tenants.filter((t) => t.status === "active" || t.status === "trial").length;

  return (
    <Sheet open={!!flag} onOpenChange={onOpenChange}>
      <SheetContent side="right" width="sm:max-w-lg">
        {flag && c && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2 font-mono text-sm">
                <Flag className="size-4" aria-hidden /> {flag.key}
              </SheetTitle>
              <SheetDescription>{flag.description}</SheetDescription>
            </SheetHeader>
            <SheetBody className="flex flex-col gap-4">
              <Facts
                items={[
                  { label: "Environment", value: <span className="capitalize">{env}</span> },
                  { label: "State", value: <FlagStatePill config={c} /> },
                  { label: "Targeting", value: targetingSummary(c) },
                  { label: "Module", value: MODULES.find((m) => m.id === flag.module)?.label ?? flag.module },
                  { label: "Owner", value: flag.owner },
                  { label: "Last changed", value: `${fmtDateTime(c.changedAt)} · ${c.changedBy}` },
                ]}
              />
              {c.killed && (
                <Alert tone="danger" icon={OctagonX} title="Kill switch is on">
                  No tenant sees this flag. Releasing the kill switch restores the roll-out shown above.
                </Alert>
              )}
              <div>
                <p className="mb-2 flex items-baseline justify-between text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Tenants exposed</span>
                  <span className="tnum normal-case tracking-normal">
                    {num(exposed.length)} of {num(live)} live tenants
                  </span>
                </p>
                {exposed.length === 0 ? (
                  <EmptyState icon={Flag} title="No tenant sees this flag" description="Turn it on or widen the roll-out to expose it." />
                ) : (
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {exposed.map(({ tenant: t, why, bucket }) => (
                      <li key={t.id} className="flex items-center gap-3 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">{t.name}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">{t.id}</p>
                        </div>
                        <PlanBadge plan={t.plan} />
                        <span className="w-[120px] text-right text-[11px] text-muted-foreground">
                          {WHY[why]}
                          {why === "bucket" && <span className="tnum"> · {bucket}</span>}
                          {why === "plan" && <span> · {PLAN_META[t.plan].label}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </SheetBody>
            <SheetFooter>
              <Button variant="outline" onClick={() => onEdit(flag)}>
                <SlidersHorizontal /> Edit roll-out
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
