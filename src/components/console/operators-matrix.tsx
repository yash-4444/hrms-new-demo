"use client";

import * as React from "react";
import { Check, Eye, Minus, ShieldAlert, SquareSlash } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PLATFORM_PERMISSIONS,
  PLATFORM_ROLE_DESCRIPTION,
  PLATFORM_ROLE_LABEL,
  ROLE_GRANTS,
  type Grant,
  type PlatformRole,
} from "@/mock/console-operators";
import { Section } from "@/components/shell/page";
import { Alert } from "@/components/ui/primitives";

/* Platform roles × permissions — read-only. Roles are defined by the vendor,
   not configurable from the console, so the matrix documents rather than edits. */

const GRANT: Record<Exclude<Grant, null> | "none", { icon: React.ElementType; label: string; className: string }> = {
  full: { icon: Check, label: "View and change", className: "bg-success-soft text-success-fg" },
  partial: { icon: SquareSlash, label: "Suspend only — not delete", className: "bg-warning-soft text-warning-fg" },
  view: { icon: Eye, label: "View only", className: "bg-info-soft text-info-fg" },
  none: { icon: Minus, label: "No access", className: "text-muted-foreground" },
};

const ROLES = Object.keys(PLATFORM_ROLE_LABEL) as PlatformRole[];

export function OperatorsMatrix() {
  return (
    <Section title="Platform roles" description="What each console role can do. Roles are fixed by the platform and cannot be edited here." bodyClassName="flex flex-col gap-3 p-4">
      <Alert tone="warning" icon={ShieldAlert} title="Super Admin only">
        Deleting a tenant and managing operators (invite, change role, deactivate, reset MFA) require the Super Admin role.
        Every grant also requires an enrolled MFA factor — an operator without one is refused at step-up.
      </Alert>
      <div className="scrollbar-thin overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[640px] text-xs">
          <caption className="sr-only">Platform roles and the permissions each one grants</caption>
          <thead className="bg-subtle">
            <tr className="border-b border-border">
              <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground">
                Permission
              </th>
              {ROLES.map((r) => (
                <th key={r} scope="col" className="px-2 py-2 text-center font-medium" title={PLATFORM_ROLE_DESCRIPTION[r]}>
                  {PLATFORM_ROLE_LABEL[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PLATFORM_PERMISSIONS.map((p) => (
              <tr key={p.key} className="border-b border-border last:border-0">
                <th scope="row" className="px-3 py-2 text-left font-normal">
                  <span className="font-medium">{p.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{p.hint}</span>
                </th>
                {ROLES.map((r) => {
                  const g = GRANT[ROLE_GRANTS[r][p.key] ?? "none"];
                  return (
                    <td key={r} className="px-2 py-2 text-center">
                      <span className={cn("mx-auto inline-flex size-6 items-center justify-center rounded-md", g.className)} title={g.label}>
                        <g.icon className="size-3.5" aria-hidden />
                        <span className="sr-only">{g.label}</span>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground" aria-label="Legend">
        {Object.values(GRANT).map((g) => (
          <li key={g.label} className="flex items-center gap-1.5">
            <span className={cn("inline-flex size-4 items-center justify-center rounded", g.className)}>
              <g.icon className="size-3" aria-hidden />
            </span>
            {g.label}
          </li>
        ))}
      </ul>
    </Section>
  );
}
