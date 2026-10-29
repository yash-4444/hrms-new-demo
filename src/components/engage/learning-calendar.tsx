"use client";

/* Month grid for training sessions. Pure presentation — the page owns state. */

import * as React from "react";
import { ChevronLeft, ChevronRight, Video, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { courseById } from "@/mock/growth";
import { DEMO_TODAY } from "@/mock/org";
import type { TrainingSession } from "@/mock/engage";
import { Button } from "@/components/ui/button";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function SessionCalendar({
  year,
  month,
  onMonthChange,
  sessions,
  onSelect,
  minMonth,
  maxMonth,
}: {
  year: number;
  /** 0-based month. */
  month: number;
  onMonthChange: (year: number, month: number) => void;
  sessions: TrainingSession[];
  onSelect: (s: TrainingSession) => void;
  /** Inclusive bounds as `yyyy-mm`. */
  minMonth: string;
  maxMonth: string;
}) {
  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday-first
  const daysIn = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells = Math.ceil((lead + daysIn) / 7) * 7;
  const key = `${year}-${String(month + 1).padStart(2, "0")}`;
  const step = (delta: number) => {
    const d = new Date(Date.UTC(year, month + delta, 1));
    onMonthChange(d.getUTCFullYear(), d.getUTCMonth());
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" aria-live="polite">
          {MONTH_NAMES[month]} {year}
        </h3>
        <div className="flex gap-1">
          <Button variant="outline" size="icon-sm" aria-label="Previous month" disabled={key <= minMonth} onClick={() => step(-1)}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="Next month" disabled={key >= maxMonth} onClick={() => step(1)}>
            <ChevronRight />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 overflow-hidden rounded-md border border-border text-xs" role="grid" aria-label={`${MONTH_NAMES[month]} ${year} training calendar`}>
        {WEEKDAYS.map((w) => (
          <div key={w} role="columnheader" className="border-b border-border bg-subtle px-2 py-1.5 font-medium text-muted-foreground">
            {w}
          </div>
        ))}
        {Array.from({ length: cells }).map((_, i) => {
          const day = i - lead + 1;
          const inMonth = day >= 1 && day <= daysIn;
          const date = inMonth ? iso(year, month, day) : "";
          const today = date === DEMO_TODAY;
          const items = inMonth ? sessions.filter((s) => s.date === date) : [];
          return (
            <div
              key={i}
              role="gridcell"
              className={cn(
                "min-h-[84px] border-b border-r border-border p-1.5 [&:nth-child(7n)]:border-r-0",
                !inMonth && "bg-muted/40",
              )}
            >
              {inMonth && (
                <span
                  className={cn(
                    "tnum inline-flex size-5 items-center justify-center rounded-full text-[11px]",
                    today ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground",
                  )}
                  aria-current={today ? "date" : undefined}
                >
                  {day}
                </span>
              )}
              <div className="mt-1 flex flex-col gap-1">
                {items.map((s) => {
                  const full = s.attendees.length >= s.capacity;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onSelect(s)}
                      className={cn(
                        "flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                        s.date < DEMO_TODAY ? "bg-muted text-muted-foreground hover:bg-muted/70" : "bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft/70",
                      )}
                      aria-label={`${s.start} ${courseById(s.courseId)?.title ?? s.courseId}${full ? ", full" : ""}`}
                    >
                      {s.mode === "Virtual" ? <Video className="size-3 shrink-0" aria-hidden /> : <MapPin className="size-3 shrink-0" aria-hidden />}
                      <span className="tnum shrink-0">{s.start}</span>
                      <span className="truncate">{courseById(s.courseId)?.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
