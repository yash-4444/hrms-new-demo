"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import {
  CalendarDays,
  Clock,
  Download,
  FileClock,
  TimerOff,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import { days as daysLabel, hm } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { mockAction, useApp } from "@/components/app-state";
import {
  CardsSkeleton,
  ChartSkeleton,
  Gated,
  PageBody,
  PageHeader,
  Section,
  useFakeLoad,
} from "@/components/shell/page";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { ProgressRing, TrendAreaChart } from "@/components/charts";
import { DayStateLegend } from "@/components/attendance/day-state";
import { DayDetailSheet, type DayDetail } from "@/components/attendance/day-detail-sheet";
import { MonthCalendar, type CalendarFilter } from "@/components/attendance/month-calendar";
import { PunchCard } from "@/components/attendance/punch-card";
import { WeekStrip } from "@/components/attendance/week-strip";
import {
  amendmentsFor,
  attendanceOn,
  hoursSeries,
  last7Days,
  monthGrid,
  monthSummary,
  resolveAttendanceCode,
  settingsForCountry,
  todayFor,
  type CellState,
} from "@/mock/attendance";
import { DEMO_TODAY } from "@/mock/org";

const FIRST_MONTH = { y: 2026, m: 6 };
const LAST_MONTH = { y: 2026, m: 9 };
const asNum = (v: { y: number; m: number }) => v.y * 12 + v.m;

export default function MyAttendancePage() {
  const loading = useFakeLoad();
  const router = useRouter();
  const { persona } = useApp();
  const code = resolveAttendanceCode(persona.employeeId);

  const [ym, setYm] = React.useState(LAST_MONTH);
  const [filter, setFilter] = React.useState<CalendarFilter>(null);
  const [detail, setDetail] = React.useState<DayDetail | null>(null);

  const cells = React.useMemo(() => monthGrid(code, ym.y, ym.m), [code, ym]);
  const summary = React.useMemo(() => monthSummary(code, ym.y, ym.m), [code, ym]);
  const week = React.useMemo(() => last7Days(code), [code]);
  const today = React.useMemo(() => todayFor(code), [code]);
  const hours = React.useMemo(() => hoursSeries(code, 30), [code]);
  const openRequests = React.useMemo(
    () =>
      amendmentsFor(code).filter(
        (a) => a.status === "pending" || a.status === "sent_back" || a.status === "draft",
      ).length,
    [code],
  );

  const counts = React.useMemo(() => {
    const c: Partial<Record<CellState, number>> = {};
    for (const cell of cells) c[cell.state] = (c[cell.state] ?? 0) + 1;
    return c;
  }, [cells]);

  const monthName = format(
    parseISO(`${ym.y}-${String(ym.m).padStart(2, "0")}-01`),
    "MMMM yyyy",
  );
  const shift = settingsForCountry("IN");
  const shiftLabel = `${shift.shiftStart} – ${shift.shiftEnd}`;
  const workingDays = summary.daysInMonth - summary.weekend - summary.holiday;
  const markedDays = summary.present + summary.half_day + summary.absent + summary.leave;
  const avgMinutes = summary.present + summary.half_day > 0
    ? summary.workedMinutes / (summary.present + summary.half_day)
    : 0;
  const attendancePct = workingDays > 0
    ? ((summary.present + summary.half_day * 0.5 + summary.leave) / workingDays) * 100
    : 0;

  const openDay = (date: string) => {
    const cell = cells.find((c) => c.date === date);
    const record = attendanceOn(code, date);
    setDetail({
      date,
      state: cell?.state ?? record?.state ?? "not_marked",
      record,
      holidayName: cell?.holidayName,
    });
  };

  const toggleFilter = (f: CalendarFilter) => setFilter((cur) => (cur === f ? null : f));

  return (
    <PageBody>
      <PageHeader
        title="My Attendance"
        description={`${persona.name} · ${persona.employeeId} · general shift ${shiftLabel}. 90 days of punch history loaded, ending ${DEMO_TODAY}.`}
        actions={
          <>
            <Gated menuKey="team.attendance" action="V" hide>
              <Button variant="outline" size="sm" onClick={() => router.push("/attendance/team")}>
                <Users /> Team board
              </Button>
            </Gated>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                mockAction("Timesheet exported", {
                  description: `${persona.employeeId} · ${summary.daysInMonth} days · timesheet-${ym.y}-${String(ym.m).padStart(2, "0")}.xlsx`,
                })
              }
            >
              <Download /> Download timesheet
            </Button>
            <Gated menuKey="time.amendments" action="C">
              <Button size="sm" onClick={() => router.push("/attendance/amendments")}>
                <FileClock /> Regularise a punch
              </Button>
            </Gated>
          </>
        }
      />

      {loading ? (
        <CardsSkeleton count={5} />
      ) : (
        <StatRow cols={5}>
          <StatTile
            label="Present days"
            value={`${summary.present} / ${workingDays}`}
            icon={CalendarDays}
            tone={filter === "present" ? "accent" : "good"}
            hint={`${summary.overtimeDays} of them crossed the 9h overtime band`}
            onClick={() => toggleFilter("present")}
          />
          <StatTile
            label="Late arrivals"
            value={summary.lateDays}
            icon={Clock}
            tone={summary.lateDays > 3 ? "warning" : "neutral"}
            hint={`Past ${shift.lateThreshold} + ${shift.graceMinutes} min grace`}
            onClick={() => toggleFilter("late")}
          />
          <StatTile
            label="Overtime"
            value={hm(summary.overtimeMinutes)}
            icon={TimerOff}
            tone={summary.overtimeMinutes > 0 ? "serious" : "neutral"}
            hint={`${daysLabel(summary.overtimeDays)} past ${shift.bands.overtime / 60}h`}
            onClick={() => toggleFilter("overtime")}
          />
          <StatTile
            label="Absent / LOP"
            value={summary.absent}
            icon={TriangleAlert}
            tone={summary.absent > 0 ? "critical" : "good"}
            hint={summary.absent > 0 ? "Regularise before month-end finalisation" : "Nothing unaccounted for"}
            onClick={() => toggleFilter("absent")}
          />
          <StatTile
            label="Open regularisations"
            value={openRequests}
            icon={FileClock}
            tone={openRequests > 0 ? "warning" : "neutral"}
            hint="Drafts, pending and sent-back requests"
            href="/attendance/amendments"
          />
        </StatRow>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <PunchCard
          className="lg:col-span-2"
          today={today}
          shiftLabel={shiftLabel}
          onOpenDetail={() => openDay(DEMO_TODAY)}
        />

        <Section
          title={`${monthName} at a glance`}
          description="Every day of the month lands in exactly one bucket."
        >
          <div className="flex items-center gap-4">
            <ProgressRing
              value={attendancePct}
              size={72}
              thickness={8}
              tone={attendancePct >= 90 ? "good" : attendancePct >= 75 ? "warning" : "critical"}
              sublabel="attended"
            />
            <dl className="min-w-0 flex-1 text-xs">
              <div className="flex justify-between border-b border-border py-1">
                <dt className="text-muted-foreground">Working days</dt>
                <dd className="tnum font-medium">{workingDays}</dd>
              </div>
              <div className="flex justify-between border-b border-border py-1">
                <dt className="text-muted-foreground">Marked so far</dt>
                <dd className="tnum font-medium">{markedDays}</dd>
              </div>
              <div className="flex justify-between border-b border-border py-1">
                <dt className="text-muted-foreground">Payable days</dt>
                <dd className="tnum font-medium">{summary.payableDays}</dd>
              </div>
              <div className="flex justify-between py-1">
                <dt className="text-muted-foreground">Average day</dt>
                <dd className="tnum font-medium">{hm(avgMinutes)}</dd>
              </div>
            </dl>
          </div>

          <div className="mt-3 rounded-md border border-border bg-subtle p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Reconciliation
            </p>
            <p className="tnum mt-1 text-xs text-foreground">
              {summary.present} present + {summary.half_day} half + {summary.absent} absent +{" "}
              {summary.leave} leave + {summary.holiday} holiday + {summary.weekend} weekly off +{" "}
              {summary.not_marked} not marked ={" "}
              <span className="font-semibold">{summary.reconciles} days</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Matches the {summary.daysInMonth} calendar days in the month. Overtime days are counted
              inside “present”.
            </p>
          </div>
        </Section>
      </div>

      <Section
        title="Last 7 days"
        description="Click any day to open its punch detail."
        actions={<StatusBadge status="present" label={`${week.filter((d) => d.state === "present" || d.state === "overtime").length} of 7 present`} />}
      >
        <WeekStrip days={week} onSelect={(d) => openDay(d.date)} />
      </Section>

      <Section
        title="Month calendar"
        description="Colour plus a letter on every cell — the legend doubles as a filter."
        actions={
          filter ? (
            <Button variant="outline" size="sm" onClick={() => setFilter(null)}>
              <X /> Clear “{filter === "late" ? "Late" : filter.replace("_", " ")}” filter
            </Button>
          ) : null
        }
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
          <MonthCalendar
            cells={cells}
            year={ym.y}
            month={ym.m}
            filter={filter}
            canPrev={asNum(ym) > asNum(FIRST_MONTH)}
            canNext={asNum(ym) < asNum(LAST_MONTH)}
            onPrev={() => setYm((v) => (v.m === 1 ? { y: v.y - 1, m: 12 } : { ...v, m: v.m - 1 }))}
            onNext={() => setYm((v) => (v.m === 12 ? { y: v.y + 1, m: 1 } : { ...v, m: v.m + 1 }))}
            onSelect={(c) => openDay(c.date)}
          />
          <div className="flex flex-col gap-3">
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Legend — click to filter
              </p>
              <DayStateLegend
                counts={counts}
                active={filter === "late" ? null : filter}
                onToggle={(s) => toggleFilter(s)}
                className="flex-col items-start gap-1"
              />
            </div>
            <Button
              variant={filter === "late" ? "soft" : "outline"}
              size="sm"
              onClick={() => toggleFilter("late")}
            >
              <Clock /> Late arrivals only ({summary.lateDays})
            </Button>
            {summary.absent > 0 && (
              <Alert tone="warning" icon={TriangleAlert} title="Unaccounted days">
                {daysLabel(summary.absent)} in this month have no punch and no leave. Raise a
                regularisation before the month is finalised.
              </Alert>
            )}
          </div>
        </div>
      </Section>

      {loading ? (
        <ChartSkeleton />
      ) : (
        <TrendAreaChart
          title="Hours worked per day"
          description="Last 30 days of the punch window, in hours. Weekends, holidays and leave sit at zero."
          data={hours}
          xKey="label"
          series={[{ key: "hours", label: "Hours worked" }]}
          height={230}
          valueFormat={(v) => `${v.toFixed(1)} h`}
          tickFormat={(v) => `${v}h`}
          footnote={`Full day lands at ${shift.bands.fullDay / 60}h and the overtime band starts past ${shift.bands.overtime / 60}h on the India general shift. Switch to the table view for the exact figures.`}
        />
      )}

      <DayDetailSheet detail={detail} onOpenChange={(o) => !o && setDetail(null)} />
    </PageBody>
  );
}
