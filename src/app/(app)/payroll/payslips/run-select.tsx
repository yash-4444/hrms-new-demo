"use client";

import * as React from "react";
import type { Action, MenuKey } from "@/lib/rbac";
import { useApp } from "@/components/app-state";
import { Hint } from "@/components/ui/primitives";
import { Gated } from "@/components/shell/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { OUTPUT_RUNS, outputRunLabel } from "@/mock/finance-run";

/**
 * Pay-run picker shared by the payslip register, the payroll registers and
 * the bank advice screen. Offers the open September run and the paid August
 * run — the two runs whose traced payslips are pre-rendered.
 */
export function RunSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" aria-label="Pay run" className="w-[230px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OUTPUT_RUNS.map((r) => (
          <SelectItem key={r.id} value={r.id}>
            {r.code} · {outputRunLabel(r)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** A button that is disabled for a business reason (not a permission), with the reason on hover. */
export function BlockedHint({ reason, children }: { reason: string | null; children: React.ReactElement }) {
  if (!reason) return children;
  return (
    <Hint text={reason}>
      <span className="inline-flex cursor-not-allowed">{children}</span>
    </Hint>
  );
}

/**
 * Permission first, then business state: a persona without the grant sees the
 * standard Gated reason; one with it sees why the step is not available yet.
 */
export function GatedBlocked({
  menuKey,
  action,
  reason,
  children,
}: {
  menuKey: MenuKey;
  action: Action;
  reason: string | null;
  children: React.ReactElement<{ disabled?: boolean }>;
}) {
  const { can } = useApp();
  if (!can(menuKey, action))
    return (
      <Gated menuKey={menuKey} action={action}>
        {children}
      </Gated>
    );
  return <BlockedHint reason={reason}>{children}</BlockedHint>;
}
