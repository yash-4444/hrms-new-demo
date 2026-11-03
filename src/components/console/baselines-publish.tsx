"use client";

import * as React from "react";
import Link from "next/link";
import { Building2, Send } from "lucide-react";
import { fmtDate, num } from "@/lib/format";
import type { ConsoleTenant } from "@/mock/console-tenants";
import type { BaselineOverride } from "@/mock/console-baselines";
import { PlanBadge } from "@/components/console/kit";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/primitives";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/overlays";

/* Reference Baselines — who overrides a baseline row, and the publish step
   that pushes drafts to every tenant still inheriting the baseline. */

export function OverridesSheet({
  title,
  baseline,
  overrides,
  tenants,
  onOpenChange,
}: {
  title: string | null;
  baseline: string;
  overrides: BaselineOverride[];
  tenants: ConsoleTenant[];
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Sheet open={!!title} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            Baseline: {baseline}. These tenants keep their own row (TenantId set); a change to the baseline does not reach them.
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="overflow-y-auto">
          {overrides.length === 0 ? (
            <EmptyState icon={Building2} title="No overrides" description="Every tenant inherits the baseline as published." />
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {overrides.map((o) => {
                const t = tenants.find((x) => x.id === o.tenantId);
                return (
                  <li key={o.tenantId} className="flex flex-col gap-0.5 px-3 py-2.5">
                    <p className="flex items-center gap-1.5">
                      <Link href={`/console/tenants/${o.tenantId}`} className="text-xs font-medium text-foreground hover:underline">
                        {t?.name ?? o.tenantId}
                      </Link>
                      {t && <PlanBadge plan={t.plan} />}
                    </p>
                    <p className="text-xs text-foreground">{o.value}</p>
                    <p className="tnum text-[11px] text-muted-foreground">Overriding since {fmtDate(o.since)}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

export interface PublishItem {
  key: string;
  label: string;
  detail: string;
  audience: number;
  overriders: number;
}

export function PublishDialog({
  open,
  items,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  items: PublishItem[];
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
}) {
  const inherit = items.reduce((a, i) => Math.max(a, i.audience - i.overriders), 0);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Publish {items.length} baseline change{items.length === 1 ? "" : "s"}?</DialogTitle>
          <DialogDescription>Every tenant without its own override inherits these on its next calendar or payroll read. Overriding tenants are untouched.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <Alert tone="warning" title={`Up to ${num(inherit)} tenant${inherit === 1 ? "" : "s"} inherit these changes`}>
            Past periods are not recalculated: attendance and payslips already processed keep the values stamped on them.
          </Alert>
          <ul className="divide-y divide-border rounded-md border border-border">
            {items.map((i) => (
              <li key={i.key} className="flex items-start justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground">{i.label}</p>
                  <p className="text-[11px] text-muted-foreground">{i.detail}</p>
                </div>
                <p className="tnum shrink-0 text-right text-[11px] text-muted-foreground">
                  <span className="block font-medium text-foreground">{num(i.audience - i.overriders)} inherit</span>
                  {i.overriders > 0 && `${num(i.overriders)} override`}
                </p>
              </li>
            ))}
          </ul>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            <Send /> Publish to tenants
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
