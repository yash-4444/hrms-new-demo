"use client";

import * as React from "react";
import { Building2, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConsoleTenant } from "@/mock/console-tenants";
import { PlanBadge } from "@/components/console/kit";
import { Checkbox } from "@/components/ui/primitives";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";

/* Pick any number of tenants — a searchable checklist in a popover, with the
   picks shown as removable chips. Used by the announcement composer and the
   feature-flag rollout dialog. */

export function TenantMultiSelect({
  id,
  tenants,
  value,
  onChange,
  invalid,
  placeholder = "Choose tenants…",
}: {
  id?: string;
  tenants: ConsoleTenant[];
  value: string[];
  onChange: (ids: string[]) => void;
  invalid?: boolean;
  placeholder?: string;
}) {
  const [q, setQ] = React.useState("");
  const shown = tenants.filter((t) => !q.trim() || `${t.name} ${t.id} ${t.subdomain}`.toLowerCase().includes(q.trim().toLowerCase()));
  const picked = value.map((v) => tenants.find((t) => t.id === v)).filter((t): t is ConsoleTenant => !!t);
  const toggle = (tid: string) => onChange(value.includes(tid) ? value.filter((v) => v !== tid) : [...value, tid]);

  return (
    <div className="flex flex-col gap-1.5">
      <Popover>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            data-invalid={invalid || undefined}
            className={cn(
              "flex h-8 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-2.5 text-left text-sm shadow-xs",
              "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 data-[invalid]:border-destructive",
            )}
          >
            <span className={cn("truncate", !value.length && "text-muted-foreground")}>
              {value.length ? `${value.length} tenant${value.length === 1 ? "" : "s"} selected` : placeholder}
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0">
          <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
            <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tenants…"
              aria-label="Search tenants"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul className="scrollbar-thin max-h-64 overflow-y-auto p-1" role="listbox" aria-multiselectable aria-label="Tenants">
            {shown.length === 0 && <li className="px-2 py-6 text-center text-xs text-muted-foreground">No tenant matches.</li>}
            {shown.map((t) => {
              const on = value.includes(t.id);
              return (
                <li key={t.id} role="option" aria-selected={on}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
                    <Checkbox checked={on} onCheckedChange={() => toggle(t.id)} aria-label={t.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{t.name}</span>
                      <span className="block font-mono text-[10px] text-muted-foreground">{t.id}</span>
                    </span>
                    <PlanBadge plan={t.plan} />
                  </label>
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>
      {picked.length > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label="Selected tenants">
          {picked.map((t) => (
            <li key={t.id} className="inline-flex items-center gap-1 rounded-md border border-border bg-subtle py-0.5 pl-1.5 pr-0.5 text-[11px]">
              <Building2 className="size-3 text-muted-foreground" aria-hidden />
              {t.name}
              <button
                type="button"
                onClick={() => toggle(t.id)}
                aria-label={`Remove ${t.name}`}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
