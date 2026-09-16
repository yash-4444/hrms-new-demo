"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { fmtTime, hm } from "@/lib/format";
import { DAY_STATE_UI, dayStateLabel } from "./day-state";
import type { AttendanceDay } from "@/mock/attendance";

/** Last-7-days strip — one tile per day, each opens the day drawer. */
export function WeekStrip({
  days,
  onSelect,
  className,
}: {
  days: AttendanceDay[];
  onSelect: (day: AttendanceDay) => void;
  className?: string;
}) {
  return (
    <ol className={cn("grid grid-cols-4 gap-1.5 sm:grid-cols-7", className)}>
      {days.map((d) => {
        const ui = DAY_STATE_UI[d.state];
        return (
          <li key={d.date}>
            <button
              type="button"
              onClick={() => onSelect(d)}
              aria-label={`${format(parseISO(d.date), "EEEE dd MMM")} — ${dayStateLabel(d.state)}`}
              className={cn(
                "flex w-full flex-col gap-1 rounded-md border px-2 py-2 text-left transition-all",
                "hover:ring-2 hover:ring-ring focus-visible:ring-2 focus-visible:ring-ring",
                ui.cell,
              )}
            >
              <span className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                  {format(parseISO(d.date), "EEE")}
                </span>
                <span className="text-[9px] font-semibold uppercase opacity-80">{ui.letter}</span>
              </span>
              <span className="tnum text-sm font-semibold leading-none">
                {format(parseISO(d.date), "dd MMM")}
              </span>
              <span className="tnum text-[10px] leading-tight opacity-85">
                {d.workedMinutes ? hm(d.workedMinutes) : dayStateLabel(d.state)}
              </span>
              <span className="tnum text-[10px] leading-tight opacity-70">
                {d.firstIn ? `${fmtTime(d.firstIn)} – ${d.lastOut ? fmtTime(d.lastOut) : "…"}` : "No punch"}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
