"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { employeeByCode } from "@/mock/employees";
import { OFF, shiftById } from "@/mock/masters";
import { PersonCell } from "@/components/people/person-cell";

/* Small presentation pieces shared by the W3 screens. */

/** Real employee from a code, linked to their profile. */
export function EmployeeLink({ code, subtitle, size = 24 }: { code: string; subtitle?: string; size?: number }) {
  const e = employeeByCode(code);
  if (!e) return <span className="text-muted-foreground">{code}</span>;
  return <PersonCell name={e.name} code={e.code} subtitle={subtitle ?? `${e.code} · ${e.designation}`} size={size} href={`/employees/${e.code}`} />;
}

/** Series colour for a shift (1–8), readable in light and dark. */
export const shiftSwatch = (color: number) => `var(--series-${color})`;

export function shiftChipStyle(color: number): React.CSSProperties {
  const c = shiftSwatch(color);
  return {
    background: `color-mix(in oklab, ${c} 16%, transparent)`,
    borderColor: `color-mix(in oklab, ${c} 45%, transparent)`,
  };
}

/** A shift as it appears on the roster board and in lists. */
export function ShiftChip({ id, className, compact }: { id: string; className?: string; compact?: boolean }) {
  if (id === OFF)
    return (
      <span className={cn("inline-flex items-center justify-center rounded-md border border-dashed border-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground", className)}>
        Off
      </span>
    );
  if (id === "LEAVE")
    return (
      <span className={cn("inline-flex items-center justify-center rounded-md border border-info/25 bg-info-soft px-1.5 py-0.5 text-[11px] font-medium text-info-fg", className)}>
        Leave
      </span>
    );
  const s = shiftById(id);
  if (!s) return <span className={className}>{id}</span>;
  return (
    <span
      className={cn("inline-flex min-w-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium text-foreground", className)}
      style={shiftChipStyle(s.color)}
      title={`${s.name} · ${s.start}–${s.end}`}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: shiftSwatch(s.color) }} aria-hidden />
      <span className="truncate">{compact ? s.id : s.name}</span>
      {!compact && <span className="tnum text-muted-foreground">{s.start}–{s.end}</span>}
    </span>
  );
}
