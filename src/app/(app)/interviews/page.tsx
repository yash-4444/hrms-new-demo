"use client";

import * as React from "react";
import Link from "next/link";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import {
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarX2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  FilterX,
  MapPin,
  Plus,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDay, fmtTime } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import { employeeByCode } from "@/mock/employees";
import {
  INTERVIEWS,
  INTERVIEW_MODES,
  INTERVIEW_ROUNDS,
  REQ_OPTIONS,
  candidateById,
  reqLabel,
  type Interview,
} from "@/mock/hiring";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Alert,
  Avatar,
  AvatarStack,
  Badge,
  EmptyState,
  Separator,
  Switch,
} from "@/components/ui/primitives";
import {
  ConfirmDialog,
  FilterSelect,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/overlays";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import {
  CardsSkeleton,
  ChartSkeleton,
  Gated,
  PageBody,
  PageHeader,
  useFakeLoad,
} from "@/components/shell/page";
import {
  CalendarLegend,
  InterviewCalendar,
  ModeChip,
  panelNames,
  periodLabel,
  stepCursor,
  type CalendarView,
} from "@/components/hiring/interview-calendar";
import {
  ScheduleInterviewDialog,
  type SchedulePayload,
} from "@/components/hiring/schedule-interview-dialog";

/* ============================================================================
   /interviews — the recruiting calendar.

   "Today" is DEMO_TODAY, not the wall clock, so the grid, the fixtures and
   every relative label agree on the same Wednesday in September 2026.
   ========================================================================== */

const TODAY_DATE = parseISO(DEMO_TODAY);

function relativeDayLabel(date: string) {
  const delta = differenceInCalendarDays(parseISO(date), TODAY_DATE);
  if (delta === 0) return "Today";
  if (delta === 1) return "Tomorrow";
  if (delta === -1) return "Yesterday";
  return format(parseISO(date), "EEE, d MMM");
}

function venueIcon(mode: Interview["mode"]) {
  return mode === "Video call" ? Video : mode === "In person" ? MapPin : ClipboardList;
}

export default function InterviewsPage() {
  const loading = useFakeLoad();
  const { persona } = useApp();

  /* ------------------------------------------------------------- state */
  const [interviews, setInterviews] = React.useState<Interview[]>(() =>
    INTERVIEWS.map((i) => ({ ...i })),
  );
  const [view, setView] = React.useState<CalendarView>("month");
  const [cursor, setCursor] = React.useState<Date>(() => parseISO(DEMO_TODAY));
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);

  const [reqFilter, setReqFilter] = React.useState("all");
  const [roundFilter, setRoundFilter] = React.useState("all");
  const [modeFilter, setModeFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [mineOnly, setMineOnly] = React.useState(false);

  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [rescheduleTarget, setRescheduleTarget] = React.useState<Interview | null>(null);
  const [cancelTarget, setCancelTarget] = React.useState<Interview | null>(null);
  const [prefillDate, setPrefillDate] = React.useState<string | undefined>(undefined);

  const seq = React.useRef(0);

  /* ----------------------------------------------------------- filtering */
  const filtered = React.useMemo(
    () =>
      interviews.filter((i) => {
        if (reqFilter !== "all" && i.reqCode !== reqFilter) return false;
        if (roundFilter !== "all" && i.round !== roundFilter) return false;
        if (modeFilter !== "all" && i.mode !== modeFilter) return false;
        if (statusFilter !== "all" && i.status !== statusFilter) return false;
        if (mineOnly && !i.panelCodes.includes(persona.employeeId)) return false;
        return true;
      }),
    [interviews, reqFilter, roundFilter, modeFilter, statusFilter, mineOnly, persona.employeeId],
  );

  const filtersActive =
    reqFilter !== "all" ||
    roundFilter !== "all" ||
    modeFilter !== "all" ||
    statusFilter !== "all" ||
    mineOnly;

  const clearFilters = () => {
    setReqFilter("all");
    setRoundFilter("all");
    setModeFilter("all");
    setStatusFilter("all");
    setMineOnly(false);
  };

  /* --------------------------------------------------------------- stats */
  const stats = React.useMemo(() => {
    const scheduled = interviews.filter((i) => i.status === "scheduled" && i.date >= DEMO_TODAY);
    const thisWeek = scheduled.filter(
      (i) => differenceInCalendarDays(parseISO(i.date), TODAY_DATE) <= 6,
    );
    return {
      scheduled: scheduled.length,
      thisWeek: thisWeek.length,
      completed: interviews.filter((i) => i.status === "completed").length,
      cancelled: interviews.filter((i) => i.status === "cancelled").length,
      scorecards: interviews.reduce((a, i) => a + i.scorecards.length, 0),
    };
  }, [interviews]);

  const upcoming = React.useMemo(
    () =>
      interviews
        .filter((i) => i.status === "scheduled" && i.date >= DEMO_TODAY)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        .slice(0, 7),
    [interviews],
  );

  const dayInterviews = React.useMemo(
    () =>
      selectedDate
        ? filtered
            .filter((i) => i.date === selectedDate)
            .slice()
            .sort((a, b) => a.time.localeCompare(b.time))
        : [],
    [filtered, selectedDate],
  );

  /* ------------------------------------------------------------ mutations */
  const openDay = (date: string) => {
    setCursor(parseISO(date));
    setSelectedDate(date);
  };

  const handleSubmitted = (p: SchedulePayload) => {
    const cand = candidateById(p.candidateId);
    if (!cand) return;

    if (rescheduleTarget) {
      const target = rescheduleTarget;
      setInterviews((prev) =>
        prev.map((i) =>
          i.id === target.id
            ? {
                ...i,
                round: p.round,
                date: p.date,
                time: p.time,
                startsAt: `${p.date}T${p.time}:00`,
                durationMins: p.durationMins,
                mode: p.mode,
                panelCodes: p.panelCodes,
                status: "scheduled" as const,
                venue:
                  p.mode === "Video call"
                    ? `meet.stellartech.in/${cand.id.toLowerCase()}-r${seq.current + 1}`
                    : p.mode === "In person"
                      ? "Meeting Room 3B — Tycho"
                      : `Call to ${cand.phone}`,
              }
            : i,
        ),
      );
      setRescheduleTarget(null);
      openDay(p.date);
      mockAction("Interview moved", {
        description: `${p.round} for ${cand.name} is now ${fmtDate(p.date)} at ${p.time}. The panel and the candidate have been re-invited.`,
      });
      return;
    }

    seq.current += 1;
    const id = `INT-NEW-${String(seq.current).padStart(3, "0")}`;
    const created: Interview = {
      id,
      candidateId: cand.id,
      candidateName: cand.name,
      reqCode: cand.reqCode,
      role: cand.role,
      round: p.round,
      panelCodes: p.panelCodes,
      date: p.date,
      time: p.time,
      startsAt: `${p.date}T${p.time}:00`,
      durationMins: p.durationMins,
      mode: p.mode,
      venue:
        p.mode === "Video call"
          ? `meet.stellartech.in/${cand.id.toLowerCase()}-${seq.current}`
          : p.mode === "In person"
            ? "Meeting Room 2A — Kepler"
            : `Call to ${cand.phone}`,
      status: "scheduled",
      scorecards: [],
    };
    setInterviews((prev) => [...prev, created]);
    openDay(p.date);
    mockAction("Interview scheduled", {
      description: `${p.round} for ${cand.name} on ${fmtDate(p.date)} at ${p.time} · ${p.panelCodes.length} panellist${p.panelCodes.length === 1 ? "" : "s"} invited.`,
    });
  };

  const confirmCancel = () => {
    const target = cancelTarget;
    if (!target) return;
    setInterviews((prev) =>
      prev.map((i) => (i.id === target.id ? { ...i, status: "cancelled" as const } : i)),
    );
    mockAction("Interview cancelled", {
      description: `${target.round} for ${target.candidateName} on ${fmtDate(target.date)} was cancelled. The panel has been told.`,
      tone: "warning",
    });
    setCancelTarget(null);
  };

  /* ------------------------------------------------------------- toolbar */
  const toolbar = (
    <div className="flex flex-col gap-2.5 border-b border-border px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex items-center rounded-md border border-border p-0.5">
          <Button
            variant={view === "week" ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={view === "week"}
            onClick={() => setView("week")}
          >
            Week
          </Button>
          <Button
            variant={view === "month" ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={view === "month"}
            onClick={() => setView("month")}
          >
            Month
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={view === "week" ? "Previous week" : "Previous month"}
            onClick={() => setCursor((c) => stepCursor(view, c, -1))}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={view === "week" ? "Next week" : "Next month"}
            onClick={() => setCursor((c) => stepCursor(view, c, 1))}
          >
            <ChevronRight />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(parseISO(DEMO_TODAY))}>
            Today
          </Button>
        </div>

        <h2 className="ml-1 text-sm font-semibold tracking-tight">
          {periodLabel(view, cursor)}
        </h2>

        <span className="tnum ml-auto text-xs text-muted-foreground">
          {filtered.length} of {interviews.length} interviews
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <FilterSelect
          label="Requisition"
          value={reqFilter}
          onValueChange={setReqFilter}
          options={REQ_OPTIONS}
          allLabel="All requisitions"
          width="w-[220px]"
        />
        <FilterSelect
          label="Round"
          value={roundFilter}
          onValueChange={setRoundFilter}
          options={INTERVIEW_ROUNDS.map((r) => ({ value: r, label: r }))}
          allLabel="All rounds"
          width="w-[170px]"
        />
        <FilterSelect
          label="Mode"
          value={modeFilter}
          onValueChange={setModeFilter}
          options={INTERVIEW_MODES.map((m) => ({ value: m, label: m }))}
          allLabel="All modes"
          width="w-[160px]"
        />
        <FilterSelect
          label="Status"
          value={statusFilter}
          onValueChange={setStatusFilter}
          options={[
            { value: "scheduled", label: "Scheduled" },
            { value: "completed", label: "Completed" },
            { value: "cancelled", label: "Cancelled" },
          ]}
          allLabel="All statuses"
          width="w-[160px]"
        />
        <label className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs">
          <Switch
            checked={mineOnly}
            onCheckedChange={(v) => setMineOnly(Boolean(v))}
            aria-label="Only interviews I am on the panel for"
          />
          <span className="text-muted-foreground">On my panel</span>
        </label>
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <FilterX /> Clear
          </Button>
        )}
        <div className="ml-auto">
          <CalendarLegend />
        </div>
      </div>
    </div>
  );

  /* ---------------------------------------------------------------- view */
  return (
    <PageBody>
      <PageHeader
        title="Interviews"
        description={`Every scheduled round across the hiring pipeline. Week and month views over the same schedule — today is ${fmtDate(DEMO_TODAY)}.`}
        actions={
          <Gated menuKey="hiring.interviews" action="C">
            <Button
              size="sm"
              onClick={() => {
                setRescheduleTarget(null);
                setPrefillDate(selectedDate ?? undefined);
                setScheduleOpen(true);
              }}
            >
              <Plus /> Schedule interview
            </Button>
          </Gated>
        }
      />

      {loading ? (
        <>
          <CardsSkeleton count={4} />
          <ChartSkeleton height={420} />
        </>
      ) : (
        <>
          <StatRow cols={4}>
            <StatTile
              label="Scheduled ahead"
              value={stats.scheduled}
              icon={CalendarClock}
              tone="accent"
              hint="Rounds booked from today onward"
              onClick={() => {
                setStatusFilter("scheduled");
                setView("month");
                setCursor(parseISO(DEMO_TODAY));
              }}
            />
            <StatTile
              label="This week"
              value={stats.thisWeek}
              icon={CalendarDays}
              hint="Next 7 days, including today"
              onClick={() => {
                setStatusFilter("scheduled");
                setView("week");
                setCursor(parseISO(DEMO_TODAY));
              }}
            />
            <StatTile
              label="Completed rounds"
              value={stats.completed}
              icon={CalendarCheck2}
              tone="good"
              hint={`${stats.scorecards} scorecards submitted`}
              onClick={() => {
                setStatusFilter("completed");
                setView("month");
              }}
            />
            <StatTile
              label="Cancelled"
              value={stats.cancelled}
              icon={CalendarX2}
              tone={stats.cancelled > 0 ? "warning" : "neutral"}
              hint="Dropped or withdrawn after booking"
              onClick={() => {
                setStatusFilter("cancelled");
                setView("month");
              }}
            />
          </StatRow>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_296px]">
            <Card className="flex min-w-0 flex-col overflow-hidden">
              {toolbar}
              {filtered.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="No interviews match these filters"
                  description="Nothing is scheduled under the current requisition, round, mode and status combination."
                  action={
                    filtersActive ? (
                      <Button size="sm" variant="outline" onClick={clearFilters}>
                        <FilterX /> Clear filters
                      </Button>
                    ) : undefined
                  }
                  className="m-4 border-dashed"
                />
              ) : (
                <InterviewCalendar
                  interviews={filtered}
                  view={view}
                  cursor={cursor}
                  selectedDate={selectedDate}
                  onSelectDay={openDay}
                  onSelectInterview={(iv) => openDay(iv.date)}
                />
              )}
            </Card>

            {/* Upcoming rail — every row jumps the calendar to that day. */}
            <Card className="flex h-fit flex-col">
              <div className="border-b border-border px-3 py-2.5">
                <h2 className="text-sm font-semibold tracking-tight">Up next</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  The next {upcoming.length} scheduled rounds. Click one to open its day.
                </p>
              </div>
              <ul className="flex flex-col">
                {upcoming.length === 0 ? (
                  <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                    Nothing scheduled from today onward.
                  </li>
                ) : (
                  upcoming.map((iv) => (
                    <li key={iv.id} className="border-b border-border last:border-0">
                      <button
                        type="button"
                        onClick={() => openDay(iv.date)}
                        className="flex w-full flex-col gap-1 px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-foreground">
                            {relativeDayLabel(iv.date)}
                          </span>
                          <span className="tnum text-xs text-muted-foreground">
                            {fmtTime(iv.startsAt)}
                          </span>
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {iv.candidateName} · {iv.round}
                        </span>
                        <span className="flex items-center justify-between gap-2">
                          <ModeChip mode={iv.mode} />
                          <AvatarStack names={panelNames(iv.panelCodes)} max={3} size={18} />
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </Card>
          </div>
        </>
      )}

      {/* ------------------------------------------------------ day drawer */}
      <Sheet
        open={selectedDate !== null}
        onOpenChange={(v) => {
          if (!v) setSelectedDate(null);
        }}
      >
        <SheetContent side="right" width="sm:max-w-xl" className="sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{selectedDate ? fmtDay(selectedDate) : "Day"}</SheetTitle>
            <SheetDescription>
              {dayInterviews.length === 0
                ? "No interviews on this day under the current filters."
                : `${dayInterviews.length} interview${dayInterviews.length === 1 ? "" : "s"} · ${
                    dayInterviews.filter((i) => i.status === "scheduled").length
                  } still to run`}
            </SheetDescription>
          </SheetHeader>

          <SheetBody className="flex flex-col gap-3">
            {dayInterviews.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="Nothing booked"
                description={
                  selectedDate
                    ? `${fmtDate(selectedDate)} is clear. Use the panel's open slots before they go.`
                    : ""
                }
                action={
                  <Gated menuKey="hiring.interviews" action="C">
                    <Button
                      size="sm"
                      onClick={() => {
                        setRescheduleTarget(null);
                        setPrefillDate(selectedDate ?? undefined);
                        setScheduleOpen(true);
                      }}
                    >
                      <Plus /> Schedule interview
                    </Button>
                  </Gated>
                }
              />
            ) : (
              dayInterviews.map((iv) => {
                const VenueIcon = venueIcon(iv.mode);
                const names = panelNames(iv.panelCodes);
                const avg = iv.scorecards.length
                  ? iv.scorecards.reduce((a, s) => a + s.overall, 0) / iv.scorecards.length
                  : null;

                return (
                  <Card key={iv.id} className="p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-sm font-semibold">
                          <span className="tnum">{fmtTime(iv.startsAt)}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className={cn(iv.status === "cancelled" && "line-through")}>
                            {iv.round}
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          <Link
                            href={`/candidates/${iv.candidateId}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {iv.candidateName}
                          </Link>{" "}
                          · {reqLabel(iv.reqCode)}
                        </p>
                      </div>
                      <StatusBadge status={iv.status} />
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <ModeChip mode={iv.mode} />
                      <Badge variant="outline" className="tnum">
                        {iv.durationMins} min
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <VenueIcon className="size-3" aria-hidden />
                        <span className="max-w-[190px] truncate">{iv.venue}</span>
                      </Badge>
                    </div>

                    <div className="mt-2.5 flex items-center gap-2">
                      <AvatarStack names={names} max={4} size={22} />
                      <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                        {names.join(", ")}
                      </p>
                    </div>

                    {avg !== null && (
                      <div className="mt-2.5 rounded-md border border-border bg-subtle p-2.5">
                        <p className="flex items-center justify-between text-xs font-semibold">
                          Panel feedback
                          <span className="tnum text-muted-foreground">
                            {avg.toFixed(1)} / 5 average
                          </span>
                        </p>
                        <ul className="mt-1.5 flex flex-col gap-2">
                          {iv.scorecards.map((sc, i) => (
                            <li key={`${sc.panelCode}-${i}`} className="flex gap-2">
                              <Avatar
                                name={employeeByCode(sc.panelCode)?.name ?? sc.panelCode}
                                size={22}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
                                  {employeeByCode(sc.panelCode)?.name ?? sc.panelCode}
                                  <Badge
                                    variant={
                                      sc.recommendation.includes("No Hire") ? "muted" : "soft"
                                    }
                                  >
                                    {sc.recommendation}
                                  </Badge>
                                  <span className="tnum text-muted-foreground">
                                    {sc.overall.toFixed(1)} / 5
                                  </span>
                                </p>
                                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                                  {sc.feedback}
                                </p>
                                <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                                  {sc.competencies.map((c) => (
                                    <li
                                      key={c.competency}
                                      className="text-[10px] text-muted-foreground"
                                    >
                                      {c.competency}{" "}
                                      <span className="tnum font-medium text-foreground">
                                        {c.rating.toFixed(1)}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <Separator className="my-2.5" />

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/candidates/${iv.candidateId}`}>
                          <ExternalLink /> Open candidate
                        </Link>
                      </Button>
                      {iv.mode === "Video call" && iv.status === "scheduled" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            mockAction("Opening the meeting room", {
                              description: `${iv.venue} — the link is stubbed in this demo build.`,
                              tone: "info",
                            })
                          }
                        >
                          <Video /> Join call
                        </Button>
                      )}
                      {iv.status !== "cancelled" && (
                        <>
                          <Gated menuKey="hiring.interviews" action="E">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setRescheduleTarget(iv);
                                setPrefillDate(undefined);
                                setScheduleOpen(true);
                              }}
                            >
                              <CalendarClock /> Reschedule
                            </Button>
                          </Gated>
                          <Gated menuKey="hiring.interviews" action="D">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive-fg hover:bg-destructive-soft"
                              onClick={() => setCancelTarget(iv)}
                            >
                              <CalendarX2 /> Cancel interview
                            </Button>
                          </Gated>
                        </>
                      )}
                    </div>
                  </Card>
                );
              })
            )}

            {selectedDate && selectedDate < DEMO_TODAY && (
              <Alert tone="neutral" icon={CalendarDays}>
                This day is in the past. Rescheduling moves the round to a future slot.
              </Alert>
            )}
          </SheetBody>

          <SheetFooter>
            <Button variant="outline" onClick={() => setSelectedDate(null)}>
              Close
            </Button>
            <Gated menuKey="hiring.interviews" action="C">
              <Button
                onClick={() => {
                  setRescheduleTarget(null);
                  setPrefillDate(selectedDate ?? undefined);
                  setScheduleOpen(true);
                }}
              >
                <Plus /> Schedule on this day
              </Button>
            </Gated>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ------------------------------------------------------- overlays */}
      <ScheduleInterviewDialog
        open={scheduleOpen}
        onOpenChange={(v) => {
          setScheduleOpen(v);
          if (!v) setRescheduleTarget(null);
        }}
        interview={rescheduleTarget}
        defaultDate={prefillDate}
        onSubmitted={handleSubmitted}
      />

      <ConfirmDialog
        open={cancelTarget !== null}
        onOpenChange={(v) => {
          if (!v) setCancelTarget(null);
        }}
        title="Cancel this interview?"
        description={
          cancelTarget
            ? `${cancelTarget.round} with ${cancelTarget.candidateName} on ${fmtDate(cancelTarget.date)} at ${cancelTarget.time}. The panel and the candidate are notified, and the slot is released.`
            : undefined
        }
        confirmLabel="Cancel interview"
        cancelLabel="Keep it"
        destructive
        onConfirm={confirmCancel}
      />
    </PageBody>
  );
}
