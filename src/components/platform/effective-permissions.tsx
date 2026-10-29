"use client";

import * as React from "react";
import { Check, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACTIONS, ACTION_LABEL, MENU_META, RBAC, type Action, type RoleId } from "@/lib/rbac";
import { DEMO_TODAY } from "@/mock/org";
import type { PermissionOverride } from "@/mock/platform";
import { Label, Switch } from "@/components/ui/primitives";

export const isOverrideExpired = (o: PermissionOverride) => !!o.expiresAt && o.expiresAt < DEMO_TODAY;

type Cell = "base" | "granted" | "revoked" | "none";

/**
 * Role baseline (read from RBAC) merged with an employee's active overrides.
 * A grant adds an action, a revoke removes one; revokes win over grants.
 */
export function EffectivePermissions({ role, overrides }: { role: RoleId; overrides: PermissionOverride[] }) {
  const [diffOnly, setDiffOnly] = React.useState(false);
  const id = React.useId();

  const rows = React.useMemo(() => {
    const grants = RBAC[role];
    return MENU_META.map((m) => {
      const base = (grants[m.key] ?? "").split("").filter(Boolean) as Action[];
      const ov = overrides.filter((o) => o.menuKey === m.key);
      const plus = new Set(ov.flatMap((o) => o.grant));
      const minus = new Set(ov.flatMap((o) => o.revoke));
      const cells = Object.fromEntries(
        ACTIONS.map((a) => {
          let c: Cell = base.includes(a) ? "base" : "none";
          if (plus.has(a) && c === "none") c = "granted";
          if (minus.has(a) && c === "base") c = "revoked";
          return [a, c];
        }),
      ) as Record<Action, Cell>;
      const changed = ACTIONS.some((a) => cells[a] === "granted" || cells[a] === "revoked");
      return { meta: m, cells, changed, any: base.length > 0 || changed };
    }).filter((r) => r.any && (!diffOnly || r.changed));
  }, [role, overrides, diffOnly]);

  const changedCount = rows.filter((r) => r.changed).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Check className="size-3.5" aria-hidden /> Role baseline
          </span>
          <span className="inline-flex items-center gap-1 text-success-fg">
            <Plus className="size-3.5" aria-hidden /> Granted by override
          </span>
          <span className="inline-flex items-center gap-1 text-destructive-fg">
            <Minus className="size-3.5" aria-hidden /> Revoked by override
          </span>
          <span>{changedCount} menu{changedCount === 1 ? "" : "s"} differ from baseline</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch id={id} checked={diffOnly} onCheckedChange={setDiffOnly} />
          <Label htmlFor={id}>Only show differences</Label>
        </div>
      </div>
      <div className="max-h-[420px] overflow-auto rounded-md border border-border">
        <table className="w-full min-w-[560px] text-xs">
          <thead className="sticky top-0 bg-subtle">
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Menu</th>
              {ACTIONS.map((a) => (
                <th key={a} className="px-2 py-2 text-center font-medium text-muted-foreground">
                  {ACTION_LABEL[a]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  No differences — this employee has exactly the role baseline.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.meta.key} className={cn("border-b border-border last:border-0", r.changed && "bg-warning-soft/40")}>
                  <td className="px-3 py-1.5">
                    <span className="text-muted-foreground">{r.meta.module} › </span>
                    {r.meta.label}
                  </td>
                  {ACTIONS.map((a) => {
                    const c = r.cells[a];
                    return (
                      <td key={a} className="px-2 py-1.5 text-center">
                        {c === "base" ? (
                          <Check className="mx-auto size-3.5 text-foreground" aria-label={`${ACTION_LABEL[a]}: baseline`} />
                        ) : c === "granted" ? (
                          <span className="mx-auto inline-flex rounded bg-success-soft px-1 text-success-fg" aria-label={`${ACTION_LABEL[a]}: granted by override`}>
                            <Plus className="size-3.5" aria-hidden />
                          </span>
                        ) : c === "revoked" ? (
                          <span className="mx-auto inline-flex rounded bg-destructive-soft px-1 text-destructive-fg" aria-label={`${ACTION_LABEL[a]}: revoked by override`}>
                            <Minus className="size-3.5" aria-hidden />
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40" aria-label={`${ACTION_LABEL[a]}: none`}>
                            ·
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
