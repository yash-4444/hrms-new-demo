"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarDays, CalendarPlus, List, MapPin, UserCheck, Users, Video } from "lucide-react";
import { fmtDay, num, pct } from "@/lib/format";
import { courseById } from "@/mock/growth";
import { DEMO_TODAY } from "@/mock/org";
import { TRAINING_SESSIONS, type TrainingSession } from "@/mock/engage";
import { mockAction } from "@/components/app-state";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { SessionCalendar } from "@/components/engage/learning-calendar";
import { ScheduleSessionDialog, SessionSheet, announceAttendance } from "@/components/engage/learning-session-dialogs";
import { CardsSkeleton, Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { FilterSelect } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";

export default function TrainingSessionsPage() {
  const loading = useFakeLoad();
  const [sessions, setSessions] = React.useState<TrainingSession[]>(TRAINING_SESSIONS);
  const [ym, setYm] = React.useState({ year: 2026, month: 8 });
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [mode, setMode] = React.useState("all");
  const [when, setWhen] = React.useState("all");

  const open = sessions.find((s) => s.id === openId) ?? null;
  const visible = sessions.filter(
    (s) =>
      (mode === "all" || s.mode === mode) &&
      (when === "all" || (when === "upcoming" ? s.date >= DEMO_TODAY : s.date < DEMO_TODAY)),
  );

  const upcoming = sessions.filter((s) => s.date >= DEMO_TODAY);
  const past = sessions.filter((s) => s.date < DEMO_TODAY);
  const seats = upcoming.reduce((a, s) => a + s.capacity, 0);
  const booked = upcoming.reduce((a, s) => a + s.attendees.length, 0);
  const waitlisted = upcoming.reduce((a, s) => a + s.waitlist.length, 0);
  const attended = past.reduce((a, s) => a + s.present.length, 0);
  const expected = past.reduce((a, s) => a + s.attendees.length, 0);

  const saveAttendance = (id: string, present: string[]) => {
    const s = sessions.find((x) => x.id === id);
    setSessions((prev) => prev.map((x) => (x.id === id ? { ...x, present } : x)));
    if (s) announceAttendance(s, present.length);
    setOpenId(null);
  };

  const columns = React.useMemo<ColumnDef<TrainingSession, unknown>[]>(
    () => [
      { accessorKey: "date", header: "Date", cell: ({ row }) => <span className="text-xs">{fmtDay(row.original.date)} · {row.original.start}–{row.original.end}</span> },
      {
        id: "course",
        accessorFn: (r) => courseById(r.courseId)?.title ?? r.courseId,
        header: "Course",
        cell: ({ row }) => (
          <Link href={`/learning/courses/${row.original.courseId}`} className="font-medium text-foreground hover:underline" onClick={(e) => e.stopPropagation()}>
            {courseById(row.original.courseId)?.title}
          </Link>
        ),
      },
      { accessorKey: "trainer", header: "Trainer", cell: ({ row }) => <MutedCell>{row.original.trainer}</MutedCell> },
      {
        accessorKey: "venue",
        header: "Mode / venue",
        cell: ({ row }) => (
          <span className="flex items-center gap-1.5 text-xs">
            {row.original.mode === "Virtual" ? <Video className="size-3.5" aria-hidden /> : <MapPin className="size-3.5" aria-hidden />}
            {row.original.venue}
          </span>
        ),
      },
      { accessorKey: "capacity", header: "Capacity", cell: ({ row }) => <NumCell>{row.original.capacity}</NumCell> },
      { id: "seats", accessorFn: (r) => r.attendees.length, header: "Booked", cell: ({ row }) => <NumCell>{row.original.attendees.length}</NumCell> },
      { id: "waitlist", accessorFn: (r) => r.waitlist.length, header: "Waitlist", cell: ({ row }) => <NumCell>{row.original.waitlist.length || "—"}</NumCell> },
      {
        id: "status",
        accessorFn: (r) => (r.date < DEMO_TODAY ? "completed" : r.attendees.length >= r.capacity ? "Full" : "Open"),
        header: "Status",
        cell: ({ row }) => {
          const s = row.original;
          if (s.date < DEMO_TODAY) return <StatusBadge status="completed" label={`${s.present.length}/${s.attendees.length} attended`} />;
          return s.attendees.length >= s.capacity ? <StatusBadge status="on_hold" label="Full — waitlist" /> : <StatusBadge status="open" label="Seats open" />;
        },
      },
    ],
    [],
  );

  return (
    <PageBody>
      <PageHeader
        title="Training Sessions"
        description="Instructor-led, workshop and cohort sessions across Bengaluru, Pune, Newark and online. Open a session to see attendees or mark attendance."
        actions={
          <Gated menuKey="growth.sessions" action="C">
            <Button size="sm" onClick={() => setScheduleOpen(true)}>
              <CalendarPlus /> Schedule session
            </Button>
          </Gated>
        }
      />

      {loading ? (
        <>
          <CardsSkeleton />
          <TableSkeleton />
        </>
      ) : (
        <>
          <StatRow>
            <StatTile label="Upcoming sessions" value={num(upcoming.length)} icon={CalendarDays} hint="From today to 20 Oct" />
            <StatTile label="Seats booked" value={`${num(booked)} / ${num(seats)}`} icon={Users} hint={`${pct((booked / Math.max(1, seats)) * 100, 0)} fill rate`} />
            <StatTile label="On waitlists" value={num(waitlisted)} icon={List} tone={waitlisted ? "warning" : "neutral"} hint="Promoted first-in, first-out" />
            <StatTile label="Attendance (past)" value={pct((attended / Math.max(1, expected)) * 100, 0)} icon={UserCheck} hint={`${num(attended)} of ${num(expected)} confirmed learners`} />
          </StatRow>

          <Tabs defaultValue="calendar">
            <TabsList>
              <TabsTrigger value="calendar"><CalendarDays /> Calendar</TabsTrigger>
              <TabsTrigger value="list"><List /> List</TabsTrigger>
            </TabsList>
            <TabsContent value="calendar">
              <Section>
                <SessionCalendar
                  year={ym.year}
                  month={ym.month}
                  onMonthChange={(year, month) => setYm({ year, month })}
                  sessions={sessions}
                  onSelect={(s) => setOpenId(s.id)}
                  minMonth="2026-09"
                  maxMonth="2026-12"
                />
              </Section>
            </TabsContent>
            <TabsContent value="list">
              <DataTable
                columns={columns}
                data={visible}
                searchKeys={["trainer", "venue"]}
                searchPlaceholder="Search trainer or venue…"
                filters={
                  <>
                    <FilterSelect label="Mode" value={mode} onValueChange={setMode} options={[{ value: "Classroom", label: "Classroom" }, { value: "Virtual", label: "Virtual" }]} />
                    <FilterSelect label="When" value={when} onValueChange={setWhen} options={[{ value: "upcoming", label: "Upcoming" }, { value: "past", label: "Past" }]} />
                  </>
                }
                onRowClick={(s) => setOpenId(s.id)}
                getRowId={(s) => s.id}
                rowTone={(s) => (s.date >= DEMO_TODAY && s.attendees.length >= s.capacity ? "warning" : undefined)}
                exportName="training-sessions"
                emptyIcon={CalendarDays}
                emptyTitle="No sessions match"
                emptyDescription="Clear the filters, or schedule a new session."
              />
            </TabsContent>
          </Tabs>
        </>
      )}

      <SessionSheet session={open} onOpenChange={(v) => !v && setOpenId(null)} onSaveAttendance={saveAttendance} />
      <ScheduleSessionDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        onCreate={(v) => {
          const session: TrainingSession = {
            id: `TS-${200 + sessions.length}`,
            courseId: v.courseId,
            trainer: v.trainer,
            trainerCode: null,
            date: v.date,
            start: v.start,
            end: v.end,
            mode: v.mode,
            venue: v.venue,
            capacity: v.capacity,
            attendees: [],
            waitlist: [],
            present: [],
          };
          setSessions((prev) => [...prev, session].sort((a, b) => a.date.localeCompare(b.date)));
          const [y, m] = v.date.split("-").map(Number);
          setYm({ year: y, month: m - 1 });
          mockAction("Session scheduled", {
            description: `${courseById(v.courseId)?.title} on ${fmtDay(v.date)}, ${v.capacity} seats. Nominations are open.`,
          });
        }}
      />
    </PageBody>
  );
}
