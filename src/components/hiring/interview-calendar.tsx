"use client";

import * as React from "react";
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { MapPin, Phone, Video, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, fmtTime } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import { employeeByCode } from "@/mock/employees";
import type { Interview, InterviewMode } from "@/mock/hiring";
import { AvatarStack, Badge } from "@/components/ui/primitives";

/* ============================================================================
   The interview calendar — a month grid and a week grid over the same data.

   Purely presentational: the page owns the interview list, the cursor, the
   view and the selection, so drag-free navigation, filtering and the day
   drawer all read from one source of truth.
   ========================================================================== */

export type CalendarView = "week" | "month";

const WEEK_OPTS = { weekStartsOn: 1 as const };

export const MODE_ICON: Record<InterviewMode, LucideIcon> = {
  "Video call": Video,
  "In person": MapPin,
  Telephonic: Phone,
};

export function ModeChip({ mode, className }: { mode: InterviewMode; className?: string }) {
  const Icon = MODE_ICON[mode];
  return (
    <Badge variant="muted" className={cn("gap-1", className)}>
      <Icon className="size-3" aria-hidden />
      {mode}
    </Badge>
  );
}

/** Panel employee codes -> real names from the directory. */
export function panelNames(codes: string[]) {
  return codes.map((c) => employeeByCode(c)?.name ?? c);
}

/* --------------------------------------------------------------- nav maths */

export function stepCursor(view: CalendarView, cursor: Date, direction: 1 | -1) {
  return view === "week" ? addWeeks(cursor, direction) : addMonths(cursor, direction);
}

export function periodLabel(view: CalendarView, cursor: Date) {
  if (view === "month") return format(cursor, "MMMM yyyy");
  const s = startOfWeek(cursor, WEEK_OPTS);
  const e = endOfWeek(cursor, WEEK_OPTS);
  const sameMonth = s.getMonth() === e.getMonth();
  return sameMonth
    ? `${format(s, "d")}–${format(e, "d MMM yyyy")}`
    : `${format(s, "d MMM")} – ${format(e, "d MMM yyyy")}`;
}

/** Every day rendered by the current view, in order. */
export function daysInView(view: CalendarView, cursor: Date) {
  if (view === "week") {
    return eachDayOfInterval({
      start: startOfWeek(cursor, WEEK_OPTS),
      end: endOfWeek(cursor, WEEK_OPTS),
    });
  }
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursor), WEEK_OPTS),
    end: endOfWeek(endOfMonth(cursor), WEEK_OPTS),
  });
}

const isoOf = (d: Date) => format(d, "yyyy-MM-dd");

function byTime(a: Interview, b: Interview) {
  return a.time.localeCompare(b.time);
}

/* ------------------------------------------------------------------ chips */

function InterviewChip({
  interview,
  onSelect,
  dense,
}: {
  interview: Interview;
  onSelect: (iv: Interview) => void;
  dense?: boolean;
}) {
  const cancelled = interview.status === "cancelled";
  const Icon = MODE_ICON[interview.mode];
  const names = panelNames(interview.panelCodes);

  return (
    <button
      type="button"
      onClick={() => onSelect(interview)}
      title={`${interview.time} · ${interview.candidateName} · ${interview.round} · ${interview.mode}`}
      className={cn(
        "w-full rounded-sm border px-1.5 py-1 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        cancelled
          ? "border-border bg-muted/60 text-muted-foreground hover:bg-muted"
          : interview.status === "completed"
            ? "border-border bg-subtle hover:bg-muted"
            : "border-primary/25 bg-primary-soft/60 hover:bg-primary-soft",
      )}
    >
      <span className="flex items-center gap-1">
        <span className="tnum shrink-0 text-[10px] font-semibold">
          {fmtTime(interview.startsAt)}
        </span>
        <Icon className="size-2.5 shrink-0 opacity-70" aria-hidden />
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[11px] font-medium",
            cancelled && "line-through",
          )}
        >
          {interview.candidateName}
        </span>
      </span>
      <span className="mt-0.5 flex items-center justify-between gap-1">
        <span className="min-w-0 truncate text-[10px] text-muted-foreground">
          {interview.round}
          {cancelled && " · Cancelled"}
        </span>
        {!dense && names.length > 0 && <AvatarStack names={names} max={3} size={14} />}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------- month grid */

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function MonthGrid({
  cursor,
  byDay,
  selectedDate,
  onSelectDay,
  onSelectInterview,
}: {
  cursor: Date;
  byDay: Map<string, Interview[]>;
  selectedDate: string | null;
  onSelectDay: (date: string) => void;
  onSelectInterview: (iv: Interview) => void;
}) {
  const days = daysInView("month", cursor);

  return (
    <div className="min-w-[760px]">
      <div className="grid grid-cols-7 border-b border-border bg-subtle">
        {DOW.map((d) => (
          <div
            key={d}
            className="px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = isoOf(day);
          const items = (byDay.get(key) ?? []).slice().sort(byTime);
          const outside = !isSameMonth(day, cursor);
          const isToday = key === DEMO_TODAY;
          const selected = key === selectedDate;
          const shown = items.slice(0, 3);
          const rest = items.length - shown.length;

          return (
            <div
              key={key}
              className={cn(
                "flex min-h-[104px] flex-col gap-1 border-b border-r border-border p-1 last:border-r-0",
                outside && "bg-subtle/60",
                selected && "bg-primary-soft/30",
              )}
            >
              <button
                type="button"
                onClick={() => onSelectDay(key)}
                aria-label={`Open ${fmtDate(day)} — ${items.length} interview${items.length === 1 ? "" : "s"}`}
                className="flex items-center justify-between rounded-sm px-1 py-0.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={cn(
                    "tnum inline-flex size-5 items-center justify-center rounded-full text-xs font-medium",
                    outside ? "text-muted-foreground/70" : "text-foreground",
                    isToday && "bg-primary text-primary-foreground",
                  )}
                >
                  {format(day, "d")}
                </span>
                {items.length > 0 && (
                  <span className="tnum text-[10px] font-medium text-muted-foreground">
                    {items.length}
                  </span>
                )}
              </button>

              {shown.map((iv) => (
                <InterviewChip key={iv.id} interview={iv} onSelect={onSelectInterview} dense />
              ))}

              {rest > 0 ? (
                <button
                  type="button"
                  onClick={() => onSelectDay(key)}
                  className="rounded-sm px-1 text-left text-[10px] font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  +{rest} more
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelectDay(key)}
                  aria-label={`Open ${fmtDate(day)}`}
                  className="min-h-[10px] flex-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- week grid */

function WeekGrid({
  cursor,
  byDay,
  selectedDate,
  onSelectDay,
  onSelectInterview,
}: {
  cursor: Date;
  byDay: Map<string, Interview[]>;
  selectedDate: string | null;
  onSelectDay: (date: string) => void;
  onSelectInterview: (iv: Interview) => void;
}) {
  const days = daysInView("week", cursor);

  return (
    <div className="grid min-w-[880px] grid-cols-7">
      {days.map((day) => {
        const key = isoOf(day);
        const items = (byDay.get(key) ?? []).slice().sort(byTime);
        const isToday = key === DEMO_TODAY;
        const selected = key === selectedDate;
        const weekend = day.getDay() === 0 || day.getDay() === 6;

        return (
          <div
            key={key}
            className={cn(
              "flex min-h-[320px] flex-col border-r border-border last:border-r-0",
              weekend && "bg-subtle/60",
              selected && "bg-primary-soft/25",
            )}
          >
            <button
              type="button"
              onClick={() => onSelectDay(key)}
              aria-label={`Open ${fmtDate(day)} — ${items.length} interview${items.length === 1 ? "" : "s"}`}
              className={cn(
                "flex items-baseline justify-between gap-1 border-b border-border px-2 py-1.5 text-left transition-colors hover:bg-muted",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                isToday && "bg-primary-soft/60",
              )}
            >
              <span className="flex items-baseline gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {format(day, "EEE")}
                </span>
                <span
                  className={cn(
                    "tnum text-sm font-semibold",
                    isToday ? "text-primary" : "text-foreground",
                  )}
                >
                  {format(day, "d")}
                </span>
              </span>
              <span className="tnum text-[10px] text-muted-foreground">
                {items.length > 0 ? `${items.length}` : ""}
              </span>
            </button>

            <div className="flex flex-1 flex-col gap-1 p-1">
              {items.length === 0 ? (
                <button
                  type="button"
                  onClick={() => onSelectDay(key)}
                  aria-label={`Open ${fmtDate(day)} — no interviews`}
                  className="flex-1 rounded-sm text-center text-[10px] text-muted-foreground/70 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="sr-only">No interviews</span>
                </button>
              ) : (
                items.map((iv) => (
                  <InterviewChip key={iv.id} interview={iv} onSelect={onSelectInterview} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------- shell */

export function InterviewCalendar({
  interviews,
  view,
  cursor,
  selectedDate,
  onSelectDay,
  onSelectInterview,
}: {
  interviews: Interview[];
  view: CalendarView;
  cursor: Date;
  selectedDate: string | null;
  onSelectDay: (date: string) => void;
  onSelectInterview: (iv: Interview) => void;
}) {
  const byDay = React.useMemo(() => {
    const map = new Map<string, Interview[]>();
    for (const iv of interviews) {
      const list = map.get(iv.date) ?? [];
      list.push(iv);
      map.set(iv.date, list);
    }
    return map;
  }, [interviews]);

  return (
    <div className="scrollbar-thin overflow-x-auto">
      {view === "month" ? (
        <MonthGrid
          cursor={cursor}
          byDay={byDay}
          selectedDate={selectedDate}
          onSelectDay={onSelectDay}
          onSelectInterview={onSelectInterview}
        />
      ) : (
        <WeekGrid
          cursor={cursor}
          byDay={byDay}
          selectedDate={selectedDate}
          onSelectDay={onSelectDay}
          onSelectInterview={onSelectInterview}
        />
      )}
    </div>
  );
}

/** Legend for the three chip treatments — colour is never the only signal. */
export function CalendarLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {[
        { label: "Scheduled", cls: "border-primary/25 bg-primary-soft/60" },
        { label: "Completed", cls: "border-border bg-subtle" },
        { label: "Cancelled", cls: "border-border bg-muted/60" },
      ].map((l) => (
        <li key={l.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn("size-2.5 rounded-[3px] border", l.cls)} aria-hidden />
          {l.label}
        </li>
      ))}
    </ul>
  );
}

export { parseISO as parseIsoDate };
