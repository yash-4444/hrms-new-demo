"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  addMonths,
  differenceInCalendarMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from "date-fns";
import { CalendarRange, ChevronLeft, ChevronRight, Download, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, num } from "@/lib/format";
import { DEMO_TODAY, DEPARTMENTS, deptName, holidayOn } from "@/mock/org";
import { employeeByCode } from "@/mock/employees";
import {
  LEAVE_EMPLOYEE_CODES,
  LEAVE_TYPES,
  countryOf,
  leaveMarkOn,
  nonWorkingReason,
} from "@/mock/leave";
import { mockAction } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, Badge, EmptyState, Hint, Skeleton } from "@/components/ui/primitives";
import { FilterSelect } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { PageBody, PageHeader, Section, useFakeLoad } from "@/components/shell/page";

/* ============================================================================
   /leave/calendar — one row per employee, one cell per day.

   Colour never carries meaning alone: every marked cell also shows the leave
   type's letter (E, C, S, …), weekends and holidays are hatched with a dot,
   and the legend spells out every combination.
   ========================================================================== */

/** `?month=YYYY-MM` → offset from the demo month; anything malformed is month 0. */
function offsetFromParam(value: string | null) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return 0;
  return differenceInCalendarMonths(parseISO(`${value}-01`), parseISO(DEMO_TODAY));
}

/** `?dept=<id>` — only a department that exists, otherwise "all". */
function deptFromParam(value: string | null) {
  return value && DEPARTMENTS.some((d) => d.id === value) ? value : "all";
}

export default function LeaveCalendarPage() {
  return (
    <React.Suspense fallback={<Skeleton className="h-[480px]" />}>
      <LeaveCalendar />
    </React.Suspense>
  );
}

function LeaveCalendar() {
  const loading = useFakeLoad();
  const searchParams = useSearchParams();
  const spKey = searchParams.toString();
  const [monthOffset, setMonthOffset] = React.useState(() => offsetFromParam(searchParams.get("month")));
  const [department, setDepartment] = React.useState(() => deptFromParam(searchParams.get("dept")));
  const [typeCode, setTypeCode] = React.useState("all");
  const [selected, setSelected] = React.useState<{ code: string; iso: string } | null>(null);

  /* A deep link (leave detail sheet, dashboard) re-seeds the month and department. */
  const [seenKey, setSeenKey] = React.useState(spKey);
  if (seenKey !== spKey) {
    const p = new URLSearchParams(spKey);
    setSeenKey(spKey);
    setMonthOffset(offsetFromParam(p.get("month")));
    setDepartment(deptFromParam(p.get("dept")));
  }

  const month = React.useMemo(
    () => startOfMonth(addMonths(parseISO(DEMO_TODAY), monthOffset)),
    [monthOffset],
  );

  const days = React.useMemo(
    () => eachDayOfInterval({ start: month, end: endOfMonth(month) }),
    [month],
  );

  const employees = React.useMemo(
    () =>
      LEAVE_EMPLOYEE_CODES.map((code) => employeeByCode(code))
        .filter((e): e is NonNullable<typeof e> => Boolean(e))
        .filter((e) => department === "all" || e.departmentId === department)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [department],
  );

  /** Marks for the visible grid, respecting the type filter. */
  const marks = React.useMemo(() => {
    const map = new Map<string, ReturnType<typeof leaveMarkOn>>();
    for (const e of employees) {
      for (const d of days) {
        const iso = format(d, "yyyy-MM-dd");
        const m = leaveMarkOn(e.code, iso);
        if (m && (typeCode === "all" || m.typeCode === typeCode)) map.set(`${e.code}|${iso}`, m);
      }
    }
    return map;
  }, [employees, days, typeCode]);

  const onLeaveToday = React.useMemo(() => {
    const today = DEMO_TODAY;
    return employees.filter((e) => marks.get(`${e.code}|${today}`)).length;
  }, [employees, marks]);

  const totalMarkedDays = marks.size;

  const peakDay = React.useMemo(() => {
    let best = { iso: "", count: 0 };
    for (const d of days) {
      const iso = format(d, "yyyy-MM-dd");
      const count = employees.filter((e) => marks.get(`${e.code}|${iso}`)).length;
      if (count > best.count) best = { iso, count };
    }
    return best;
  }, [days, employees, marks]);

  const selectedMark = selected ? leaveMarkOn(selected.code, selected.iso) : null;
  const selectedEmployee = selected ? employeeByCode(selected.code) : null;

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Leave calendar" description="Loading the month…" />
        <Skeleton className="h-[480px]" />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="Leave calendar"
        description="Who is away, when. One row per employee, one cell per day — every marked cell carries the leave type's letter so it never reads by colour alone."
        actions={
          <>
            <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Previous month"
                onClick={() => setMonthOffset((m) => m - 1)}
              >
                <ChevronLeft />
              </Button>
              <span className="tnum min-w-[104px] px-1 text-center text-xs font-medium">
                {format(month, "MMMM yyyy")}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Next month"
                onClick={() => setMonthOffset((m) => m + 1)}
              >
                <ChevronRight />
              </Button>
            </div>
            {monthOffset !== 0 && (
              <Button variant="outline" size="sm" onClick={() => setMonthOffset(0)}>
                Today
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                mockAction("Calendar exported", {
                  description: `${format(month, "MMMM yyyy")} · ${num(employees.length)} employees. Not written to disk in the demo.`,
                })
              }
            >
              <Download /> Export
            </Button>
          </>
        }
      />

      <StatRow cols={4}>
        <StatTile label="Employees shown" value={num(employees.length)} icon={Users} hint={department === "all" ? "All departments" : deptName(department)} />
        <StatTile label="Away today" value={num(onLeaveToday)} icon={CalendarRange} tone={onLeaveToday > 5 ? "warning" : "neutral"} />
        <StatTile label="Leave days this month" value={num(totalMarkedDays)} icon={CalendarRange} />
        <StatTile
          label="Peak absence day"
          value={peakDay.iso ? format(parseISO(peakDay.iso), "dd MMM") : "—"}
          icon={CalendarRange}
          hint={peakDay.count ? `${peakDay.count} people away` : "Nobody away this month"}
          tone={peakDay.count >= 5 ? "warning" : "neutral"}
        />
      </StatRow>

      <Section
        title={format(month, "MMMM yyyy")}
        description="Click any marked cell for the request behind it."
        actions={
          <>
            <FilterSelect
              label="Dept"
              value={department}
              onValueChange={setDepartment}
              allLabel="All departments"
              width="w-[180px]"
              options={DEPARTMENTS.map((d) => ({ value: d.id, label: d.name }))}
            />
            <FilterSelect
              label="Type"
              value={typeCode}
              onValueChange={setTypeCode}
              allLabel="All types"
              width="w-[170px]"
              options={LEAVE_TYPES.map((t) => ({ value: t.code, label: t.name }))}
            />
          </>
        }
        bodyClassName="p-0"
      >
        {employees.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No employees in this department"
            description="Pick a different department, or clear the filter."
            className="border-0"
          />
        ) : (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="border-separate border-spacing-0 text-xs">
              <caption className="sr-only">
                Leave calendar for {format(month, "MMMM yyyy")}
              </caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 z-10 min-w-[190px] border-b border-r border-border bg-subtle px-3 py-1.5 text-left font-medium text-muted-foreground"
                  >
                    Employee
                  </th>
                  {days.map((d) => {
                    const iso = format(d, "yyyy-MM-dd");
                    const today = iso === DEMO_TODAY;
                    const off = nonWorkingReason(iso, "IN");
                    return (
                      <th
                        key={iso}
                        scope="col"
                        className={cn(
                          "w-7 border-b border-border px-0 py-1 text-center font-medium",
                          off ? "bg-muted text-muted-foreground" : "bg-subtle text-muted-foreground",
                          today && "bg-primary-soft text-primary-soft-foreground",
                        )}
                      >
                        <span className="tnum block text-[10px] leading-tight">{format(d, "d")}</span>
                        <span className="block text-[8px] uppercase leading-tight opacity-70">
                          {format(d, "EEEEE")}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.code} className="group">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-b border-r border-border bg-card px-3 py-1 text-left font-normal group-hover:bg-muted/60"
                    >
                      <Link
                        href={`/employees/${e.code}`}
                        className="flex items-center gap-2 hover:underline"
                      >
                        <Avatar name={e.name} size={20} />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium">{e.name}</span>
                          <span className="block truncate text-[10px] text-muted-foreground">
                            {deptName(e.departmentId)}
                          </span>
                        </span>
                      </Link>
                    </th>
                    {days.map((d) => {
                      const iso = format(d, "yyyy-MM-dd");
                      const country = countryOf(e.code);
                      const off = nonWorkingReason(iso, country);
                      const hol = holidayOn(iso, country);
                      const mark = marks.get(`${e.code}|${iso}`);
                      const today = iso === DEMO_TODAY;

                      const title = mark
                        ? `${e.name} · ${fmtDate(iso)} · ${
                            LEAVE_TYPES.find((t) => t.code === mark.typeCode)?.name
                          }${mark.half ? " (half day)" : ""} — ${mark.status}`
                        : hol
                          ? `${fmtDate(iso)} · ${hol.name}`
                          : off
                            ? `${fmtDate(iso)} · ${off.label}`
                            : `${e.name} · ${fmtDate(iso)} · working day`;

                      return (
                        <td key={iso} className="border-b border-border p-0">
                          {mark ? (
                            <button
                              type="button"
                              title={title}
                              aria-label={title}
                              onClick={() => setSelected({ code: e.code, iso })}
                              className={cn(
                                "flex h-6 w-7 items-center justify-center text-[10px] font-semibold focus-visible:ring-2 focus-visible:ring-ring",
                                mark.status === "approved"
                                  ? "bg-info-soft text-info-fg"
                                  : "bg-warning-soft text-warning-fg",
                                mark.half && "italic opacity-90",
                                today && "ring-1 ring-inset ring-primary",
                              )}
                            >
                              {mark.letter}
                              {mark.half ? "½" : ""}
                            </button>
                          ) : (
                            <span
                              title={title}
                              className={cn(
                                "flex h-6 w-7 items-center justify-center text-[10px]",
                                hol
                                  ? "bg-primary-soft text-primary-soft-foreground"
                                  : off
                                    ? "bg-muted text-muted-foreground"
                                    : "bg-card",
                                today && "ring-1 ring-inset ring-primary",
                              )}
                            >
                              {hol ? "H" : off ? "·" : ""}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ------------------------------------------------------ legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-4 py-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Legend
          </span>
          <LegendItem className="bg-info-soft text-info-fg" letter="E" label="Approved leave (letter = type)" />
          <LegendItem className="bg-warning-soft text-warning-fg" letter="E" label="Pending approval" />
          <LegendItem className="bg-info-soft italic text-info-fg" letter="½" label="Half day" />
          <LegendItem className="bg-primary-soft text-primary-soft-foreground" letter="H" label="Public holiday" />
          <LegendItem className="bg-muted text-muted-foreground" letter="·" label="Weekend / non-working" />
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="flex size-4 items-center justify-center ring-1 ring-inset ring-primary" aria-hidden />
            Today
          </span>
          <span className="ml-auto flex flex-wrap gap-1">
            {LEAVE_TYPES.map((t) => (
              <Hint key={t.code} text={t.name}>
                <Badge variant="muted">
                  {t.letter} = {t.code}
                </Badge>
              </Hint>
            ))}
          </span>
        </div>
      </Section>

      {/* ----------------------------------------------- selected detail */}
      {selected && selectedMark && selectedEmployee && (
        <Card className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Avatar name={selectedEmployee.name} size={36} />
              <div>
                <p className="text-sm font-semibold">{selectedEmployee.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedEmployee.designation} · {deptName(selectedEmployee.departmentId)}
                </p>
                <p className="mt-1.5 text-xs">
                  <span className="font-medium">
                    {LEAVE_TYPES.find((t) => t.code === selectedMark.typeCode)?.name}
                  </span>{" "}
                  on {fmtDate(selected.iso)}
                  {selectedMark.half ? " (half day)" : ""}
                </p>
                <p className="mt-1 max-w-xl text-xs text-muted-foreground">{selectedMark.reason}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StatusBadge status={selectedMark.status} size="md" />
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/employees/${selected.code}`}>Open profile</Link>
                </Button>
                {selectedMark.status === "pending" && (
                  <Button size="sm" asChild>
                    <Link href="/leave/approvals">Go to approvals</Link>
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}
    </PageBody>
  );
}

function LegendItem({
  className,
  letter,
  label,
}: {
  className: string;
  letter: string;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span
        aria-hidden
        className={cn("flex size-4 items-center justify-center text-[9px] font-semibold", className)}
      >
        {letter}
      </span>
      {label}
    </span>
  );
}
