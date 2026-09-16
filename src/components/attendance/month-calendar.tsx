"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtMonth } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/primitives";
import { DAY_STATE_UI, dayStateLabel } from "./day-state";
import type { CellState, MonthCell } from "@/mock/attendance";

export type CalendarFilter = CellState | "late" | null;

const WEEK_HEADS = ["S", "M", "T", "W", "T", "F", "S"];

export function MonthCalendar({
  cells,
  year,
  month,
  onPrev,
  onNext,
  canPrev,
  canNext,
  filter,
  onSelect,
  className,
}: {
  cells: MonthCell[];
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  filter: CalendarFilter;
  onSelect: (cell: MonthCell) => void;
  className?: string;
}) {
  const lead = cells[0]?.weekday ?? 0;
  const monthLabel = fmtMonth(`${year}-${String(month).padStart(2, "0")}-01`);

  const matches = (c: MonthCell) => {
    if (!filter) return true;
    if (filter === "late") return Boolean(c.record?.late);
    return c.state === filter;
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <Hint text={canPrev ? "Previous month" : "Attendance history for this demo starts in June 2026"}>
          <span className="inline-flex">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Previous month"
              onClick={onPrev}
              disabled={!canPrev}
            >
              <ChevronLeft />
            </Button>
          </span>
        </Hint>
        <p className="text-sm font-semibold tracking-tight">{monthLabel}</p>
        <Hint text={canNext ? "Next month" : "Nothing is recorded past today (16 Sep 2026)"}>
          <span className="inline-flex">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Next month"
              onClick={onNext}
              disabled={!canNext}
            >
              <ChevronRight />
            </Button>
          </span>
        </Hint>
      </div>

      <div className="grid grid-cols-7 gap-1" role="grid" aria-label={`Attendance for ${monthLabel}`}>
        {WEEK_HEADS.map((d, i) => (
          <div
            key={i}
            className="pb-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {d}
          </div>
        ))}
        {Array.from({ length: lead }).map((_, i) => (
          <div key={`lead-${i}`} aria-hidden />
        ))}
        {cells.map((c) => {
          const ui = DAY_STATE_UI[c.state];
          const dim = !matches(c);
          const hours = c.record?.workedMinutes
            ? (c.record.workedMinutes / 60).toFixed(1)
            : null;
          return (
            <button
              key={c.date}
              type="button"
              onClick={() => onSelect(c)}
              aria-label={`${c.day} ${monthLabel} — ${dayStateLabel(c.state)}${hours ? `, ${hours} hours` : ""}`}
              className={cn(
                "flex h-14 flex-col items-start justify-between rounded-md border px-1.5 py-1 text-left transition-all",
                "hover:ring-2 hover:ring-ring focus-visible:ring-2 focus-visible:ring-ring",
                ui.cell,
                dim && "opacity-25",
                c.isToday && "ring-2 ring-primary",
              )}
            >
              <span className="flex w-full items-center justify-between">
                <span className="tnum text-xs font-semibold leading-none">{c.day}</span>
                <span className="text-[9px] font-semibold uppercase leading-none opacity-80">
                  {ui.letter}
                </span>
              </span>
              <span className="flex w-full items-center justify-between gap-1">
                <span className="tnum text-[10px] leading-none opacity-80">{hours ? `${hours}h` : ""}</span>
                {c.record?.late && (
                  <span
                    className="size-1.5 shrink-0 rounded-full bg-warning"
                    aria-hidden
                    title="Late arrival"
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
