"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarClock, CalendarPlus, History, ListChecks } from "lucide-react";
import { fmtDate, fmtDay } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import { employeeByCode, reporteesOf } from "@/mock/employees";
import { ONE_ON_ONES, type OneOnOne } from "@/mock/engage";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { PersonCell } from "@/components/people/person-cell";
import { CardsSkeleton, Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { EmptyState, Field, Input, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { MeetingWorkspace } from "@/components/engage/perf-oneonone";
import { nameOf, personLine, useDirtyGuard } from "@/components/engage/kit";

const schema = z.object({
  withCode: z.string().min(1, "Choose who the 1:1 is with"),
  date: z.string().min(1, "Pick a date").refine((d) => d >= DEMO_TODAY, "The date can't be in the past"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Pick a start time"),
  duration: z.enum(["15", "30", "45", "60"]),
  cadence: z.enum(["once", "weekly", "fortnightly"]),
});
type Values = z.infer<typeof schema>;

export default function OneOnOnesPage() {
  const loading = useFakeLoad();
  const { persona } = useApp();
  const me = persona.employeeId;
  const [meetings, setMeetings] = React.useState<OneOnOne[]>(ONE_ON_ONES);
  const mine = meetings.filter((m) => m.managerCode === me || m.reporteeCode === me);
  const upcoming = mine.filter((m) => m.status === "scheduled").sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const history = mine.filter((m) => m.status === "completed").sort((a, b) => b.date.localeCompare(a.date));
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const selected = mine.find((m) => m.id === selectedId) ?? upcoming[0] ?? null;
  const openActions = mine.flatMap((m) => m.actions).filter((a) => !a.done);

  const partnerOptions = React.useMemo(() => {
    const reports = reporteesOf(me).filter((e) => e.status !== "exited").map((e) => e.code);
    const mgr = employeeByCode(me)?.managerCode;
    return [...new Set([...reports, ...(mgr ? [mgr] : [])])];
  }, [me]);

  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { withCode: "", date: "", time: "11:00", duration: "30", cadence: "weekly" } });
  const close = () => {
    setScheduleOpen(false);
    form.reset();
  };
  const { onOpenChange, guard } = useDirtyGuard(form.formState.isDirty, close);
  const errors = form.formState.errors;

  const onSchedule = form.handleSubmit((v) => {
    const iManage = reporteesOf(me).some((e) => e.code === v.withCode);
    const m: OneOnOne = {
      id: `OOO-NEW-${meetings.length + 1}`,
      managerCode: iManage ? me : v.withCode,
      reporteeCode: iManage ? v.withCode : me,
      date: v.date,
      time: v.time,
      durationMins: Number(v.duration),
      status: "scheduled",
      agenda: [],
      sharedNotes: "",
      privateNotes: "",
      actions: [],
    };
    setMeetings((prev) => [m, ...prev]);
    setSelectedId(m.id);
    mockAction(`1:1 scheduled with ${nameOf(v.withCode)}`, {
      description: `${fmtDay(v.date)} at ${v.time} · ${v.cadence === "once" ? "one-off" : v.cadence}. A calendar invite has been sent.`,
    });
    close();
  });

  const columns = React.useMemo<ColumnDef<OneOnOne, unknown>[]>(
    () => [
      {
        id: "with",
        accessorFn: (m) => nameOf(m.managerCode === me ? m.reporteeCode : m.managerCode),
        header: "With",
        cell: ({ row }) => {
          const c = row.original.managerCode === me ? row.original.reporteeCode : row.original.managerCode;
          return <PersonCell name={nameOf(c)} code={c} subtitle={personLine(c)} />;
        },
      },
      { accessorKey: "date", header: "Date", cell: ({ row }) => <span className="text-xs">{fmtDay(row.original.date)} · {row.original.time}</span> },
      { id: "agenda", accessorFn: (m) => m.agenda.length, header: "Agenda items", cell: ({ getValue }) => <NumCell>{String(getValue())}</NumCell> },
      { id: "actions", accessorFn: (m) => m.actions.filter((a) => !a.done).length, header: "Open actions", cell: ({ getValue }) => <NumCell>{String(getValue())}</NumCell> },
      { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    ],
    [me],
  );

  const historyColumns = React.useMemo<ColumnDef<OneOnOne, unknown>[]>(
    () => [
      columns[0],
      { accessorKey: "date", header: "Held on", cell: ({ row }) => <MutedCell>{fmtDate(row.original.date)}</MutedCell> },
      { accessorKey: "sharedNotes", header: "Shared notes", cell: ({ row }) => <span className="line-clamp-2 max-w-md text-xs">{row.original.sharedNotes || "—"}</span> },
      { id: "done", accessorFn: (m) => `${m.actions.filter((a) => a.done).length}/${m.actions.length}`, header: "Actions done", cell: ({ getValue }) => <NumCell>{String(getValue())}</NumCell> },
    ],
    [columns],
  );

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="One-on-Ones" description="Loading your meetings…" />
        <CardsSkeleton count={3} />
        <TableSkeleton rows={5} />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="One-on-Ones"
        description="Regular manager ↔ reportee conversations with a shared agenda, notes both sides can see, private notes for the manager, and action items with owners."
        actions={
          <Gated menuKey="growth.one_on_ones" action="C">
            <Button size="sm" onClick={() => setScheduleOpen(true)} disabled={partnerOptions.length === 0}>
              <CalendarPlus /> Schedule 1:1
            </Button>
          </Gated>
        }
      />

      <StatRow cols={3}>
        <StatTile label="Upcoming" value={upcoming.length} icon={CalendarClock} hint={upcoming[0] ? `Next: ${fmtDay(upcoming[0].date)} · ${upcoming[0].time}` : "Nothing scheduled"} />
        <StatTile label="Open action items" value={openActions.length} icon={ListChecks} tone={openActions.some((a) => a.dueOn < DEMO_TODAY) ? "warning" : "neutral"} hint={`${openActions.filter((a) => a.dueOn < DEMO_TODAY).length} past due`} />
        <StatTile label="Held in the last 30 days" value={history.filter((m) => m.date >= "2026-08-17").length} icon={History} hint="Target: one every week" />
      </StatRow>

      {mine.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No one-on-ones yet"
          description="Managers and reportees who meet weekly resolve blockers faster. Schedule the first one — it repeats automatically."
          action={
            <Gated menuKey="growth.one_on_ones" action="C">
              <Button size="sm" variant="outline" onClick={() => setScheduleOpen(true)} disabled={partnerOptions.length === 0}>
                Schedule 1:1
              </Button>
            </Gated>
          }
        />
      ) : (
        <Tabs defaultValue="upcoming">
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
            <TabsTrigger value="history">History ({history.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="upcoming" className="flex flex-col gap-3">
            <Section title="Scheduled" description="Select a meeting to open its agenda and notes." bodyClassName="p-3">
              <DataTable columns={columns} data={upcoming} getRowId={(m) => m.id} onRowClick={(m) => setSelectedId(m.id)} exportName="one-on-ones" dense emptyIcon={CalendarClock} emptyTitle="Nothing scheduled" emptyDescription="Schedule your next 1:1 from the button above." />
            </Section>
            {selected && (
              <MeetingWorkspace
                key={selected.id}
                meeting={selected}
                viewerCode={me}
                onChange={(m) => setMeetings((prev) => prev.map((x) => (x.id === m.id ? m : x)))}
              />
            )}
          </TabsContent>
          <TabsContent value="history">
            <Section title="Past one-on-ones" bodyClassName="p-3">
              <DataTable columns={historyColumns} data={history} getRowId={(m) => m.id} exportName="one-on-one-history" emptyIcon={History} emptyTitle="No past meetings" emptyDescription="Completed 1:1s and their notes appear here." />
            </Section>
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={scheduleOpen} onOpenChange={onOpenChange}>
        <DialogContent size="sm">
          <form onSubmit={onSchedule} noValidate>
            <DialogHeader>
              <DialogTitle>Schedule a one-on-one</DialogTitle>
              <DialogDescription>Both of you get a calendar invite and can add to the agenda straight away.</DialogDescription>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-3">
              <Field label="With" htmlFor="ooo-with" required error={errors.withCode?.message}>
                <Controller control={form.control} name="withCode" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="ooo-with" aria-invalid={!!errors.withCode}><SelectValue placeholder="Choose a person" /></SelectTrigger>
                    <SelectContent>
                      {partnerOptions.map((c) => <SelectItem key={c} value={c}>{nameOf(c)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date" htmlFor="ooo-date" required error={errors.date?.message}>
                  <Input id="ooo-date" type="date" min={DEMO_TODAY} aria-invalid={!!errors.date} {...form.register("date")} />
                </Field>
                <Field label="Start" htmlFor="ooo-time" required error={errors.time?.message}>
                  <Input id="ooo-time" type="time" aria-invalid={!!errors.time} {...form.register("time")} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(["duration", "cadence"] as const).map((name) => (
                  <Field key={name} label={name === "duration" ? "Duration" : "Repeats"} htmlFor={`ooo-${name}`}>
                    <Controller control={form.control} name={name} render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id={`ooo-${name}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(name === "duration" ? ["15", "30", "45", "60"] : ["once", "weekly", "fortnightly"]).map((o) => (
                            <SelectItem key={o} value={o}>{name === "duration" ? `${o} min` : o === "once" ? "Does not repeat" : o[0].toUpperCase() + o.slice(1)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )} />
                  </Field>
                ))}
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit">Schedule</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </PageBody>
  );
}
