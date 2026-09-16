"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { statusDef } from "@/components/ui/status-badge";
import type { CellState } from "@/mock/attendance";

/* ============================================================================
   Calendar day-cell vocabulary.

   Every entry reuses the semantic token pair that StatusBadge already uses for
   the same status key, so the legend, the badge and the cell can never drift
   apart. Colour is always paired with a letter — never colour alone.
   ========================================================================== */

export interface DayStateUi {
  letter: string;
  cell: string;
  dot: string;
}

export const DAY_STATE_UI: Record<CellState, DayStateUi> = {
  present: {
    letter: "P",
    cell: "bg-success-soft text-success-fg border-success/25",
    dot: "bg-success",
  },
  overtime: {
    letter: "OT",
    cell: "bg-serious-soft text-serious-fg border-serious/30",
    dot: "bg-serious",
  },
  half_day: {
    letter: "H",
    cell: "bg-warning-soft text-warning-fg border-warning/30",
    dot: "bg-warning",
  },
  absent: {
    letter: "A",
    cell: "bg-destructive-soft text-destructive-fg border-destructive/25",
    dot: "bg-destructive",
  },
  leave: {
    letter: "L",
    cell: "bg-info-soft text-info-fg border-info/25",
    dot: "bg-info",
  },
  holiday: {
    letter: "HO",
    cell: "bg-primary-soft text-primary-soft-foreground border-primary/25",
    dot: "bg-primary",
  },
  weekend: {
    letter: "WO",
    cell: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  },
  not_marked: {
    letter: "–",
    cell: "bg-card text-muted-foreground border-dashed border-border",
    dot: "bg-input",
  },
};

export const dayStateLabel = (s: CellState) =>
  s === "not_marked" ? "Not marked" : statusDef(s).label;

export const LEGEND_ORDER: CellState[] = [
  "present",
  "overtime",
  "half_day",
  "absent",
  "leave",
  "holiday",
  "weekend",
  "not_marked",
];

/** Legend for the month calendar — doubles as a click-to-filter control. */
export function DayStateLegend({
  counts,
  active,
  onToggle,
  className,
}: {
  counts?: Partial<Record<CellState, number>>;
  active?: CellState | null;
  onToggle?: (state: CellState) => void;
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5", className)}>
      {LEGEND_ORDER.map((s) => {
        const ui = DAY_STATE_UI[s];
        const n = counts?.[s];
        const on = active === s;
        const body = (
          <>
            <span
              aria-hidden
              className={cn(
                "flex size-4 items-center justify-center rounded-[3px] border text-[9px] font-semibold leading-none",
                ui.cell,
              )}
            >
              {ui.letter}
            </span>
            <span className="text-xs text-muted-foreground">{dayStateLabel(s)}</span>
            {n !== undefined && <span className="tnum text-xs font-medium text-foreground">{n}</span>}
          </>
        );
        return (
          <li key={s}>
            {onToggle ? (
              <button
                type="button"
                onClick={() => onToggle(s)}
                aria-pressed={on}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 transition-colors",
                  on ? "border-primary/40 bg-primary-soft/50" : "border-transparent hover:bg-muted",
                )}
              >
                {body}
              </button>
            ) : (
              <span className="flex items-center gap-1.5 px-1.5 py-0.5">{body}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
