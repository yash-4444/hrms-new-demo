"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, parseISO } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowRight,
  CalendarClock,
  CalendarPlus,
  Check,
  Copy,
  Globe2,
  Loader2,
  MinusCircle,
  Play,
  ShieldAlert,
  Star,
  TriangleAlert,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, Avatar, Badge, Field, Hint, Input } from "@/components/ui/primitives";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { mockAction, useApp } from "@/components/app-state";
import {
  Gated,
  PageBody,
  PageHeader,
  Section,
  TableSkeleton,
  useFakeLoad,
} from "@/components/shell/page";
import {
  BRANCH_COUNTRY_COVERAGE,
  DIAGNOSTIC_EMPLOYEES,
  WEEKDAY_LABELS,
  WORK_CALENDARS,
  resolveWorkContext,
  type WeekDayPattern,
  type WorkCalendar,
} from "@/mock/attendance";
import { HOLIDAYS, TENANT } from "@/mock/org";

const NEXT_PATTERN: Record<WeekDayPattern, WeekDayPattern> = {
  working: "off",
  off: "half",
  half: "working",
};

const PATTERN_UI: Record<WeekDayPattern, { label: string; cls: string }> = {
  working: { label: "Working", cls: "bg-success-soft text-success-fg border-success/25" },
  off: { label: "Off", cls: "bg-muted text-muted-foreground border-border" },
  half: { label: "Half-day", cls: "bg-warning-soft text-warning-fg border-warning/30" },
};

const TIMEZONES = ["Asia/Kolkata", "America/New_York", "Asia/Dubai", "Europe/London"];
const FY_MONTHS = [
  { value: "4", label: "April (Apr–Mar)" },
  { value: "1", label: "January (Jan–Dec)" },
];

const newCalendarSchema = z.object({
  name: z.string().trim().min(4, "Give the calendar a name of at least 4 characters."),
  countryId: z.enum(["IN", "US", "none"]),
  fyStartMonth: z.enum(["1", "4"]),
  timezone: z.string().min(1, "Pick a timezone."),
});
type NewCalendarValues = z.infer<typeof newCalendarSchema>;

export default function WorkCalendarsPage() {
  const loading = useFakeLoad();
  const router = useRouter();
  const { persona, can, why } = useApp();
  const canEdit = can("time.calendars", "E");

  const [calendars, setCalendars] = React.useState<WorkCalendar[]>(WORK_CALENDARS);
  const [detail, setDetail] = React.useState<WorkCalendar | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  /* ------------------------------------------------------ diagnostic panel */
  const [subject, setSubject] = React.useState(
    DIAGNOSTIC_EMPLOYEES.find((e) => e.branchId === "HYD")?.code ?? DIAGNOSTIC_EMPLOYEES[0].code,
  );
  const [revealed, setRevealed] = React.useState(0);
  const [running, setRunning] = React.useState(false);
  const timers = React.useRef<number[]>([]);

  const resolution = React.useMemo(() => resolveWorkContext(subject), [subject]);

  const clearTimers = React.useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  const runResolver = React.useCallback(() => {
    clearTimers();
    setRevealed(0);
    setRunning(true);
    const steps = resolveWorkContext(subject).steps;
    steps.forEach((_, i) => {
      timers.current.push(
        window.setTimeout(() => {
          setRevealed(i + 1);
          if (i === steps.length - 1) setRunning(false);
        }, 300 * (i + 1)),
      );
    });
  }, [subject, clearTimers]);

  React.useEffect(() => {
    runResolver();
    return clearTimers;
  }, [runResolver, clearTimers]);

  /* ------------------------------------------------------------ mutations */
  const cyclePattern = (id: string, dayIdx: number) => {
    setCalendars((cs) =>
      cs.map((c) => {
        if (c.id !== id) return c;
        const week = [...c.week];
        week[dayIdx] = NEXT_PATTERN[week[dayIdx]];
        mockAction(`${WEEKDAY_LABELS[dayIdx]} set to ${PATTERN_UI[week[dayIdx]].label}`, {
          description: `${c.name} · ${week.filter((d) => d === "working").length} working days, ${week.filter((d) => d === "half").length} half-days a week.`,
        });
        return { ...c, week };
      }),
    );
  };

  const setField = <K extends keyof WorkCalendar>(id: string, key: K, value: WorkCalendar[K], msg: string) => {
    setCalendars((cs) => cs.map((c) => (c.id === id ? { ...c, [key]: value } : c)));
    mockAction(msg, { description: "Saved in memory for this demo session." });
  };

  const makeDefault = (cal: WorkCalendar) => {
    setCalendars((cs) =>
      cs.map((c) =>
        c.countryId === cal.countryId ? { ...c, isDefault: c.id === cal.id, status: c.id === cal.id ? "active" : c.status } : c,
      ),
    );
    mockAction(`${cal.name} is now the default`, {
      description: `Every employee in ${cal.countryName} without an explicit calendar resolves here.`,
    });
  };

  const duplicate = (cal: WorkCalendar) => {
    const copy: WorkCalendar = {
      ...cal,
      id: `${cal.id}-C${calendars.length}`,
      name: `${cal.name} (copy)`,
      isDefault: false,
      status: "draft",
      branches: [],
      employees: 0,
    };
    setCalendars((cs) => [...cs, copy]);
    mockAction(`${copy.name} created`, { description: "Draft calendar — no branch is mapped to it yet." });
  };

  const createForm = useForm<NewCalendarValues>({
    resolver: zodResolver(newCalendarSchema),
    mode: "onSubmit",
    defaultValues: { name: "", countryId: "IN", fyStartMonth: "4", timezone: "Asia/Kolkata" },
  });

  const onCreate = createForm.handleSubmit((v) => {
    const cal: WorkCalendar = {
      id: `CAL-${v.countryId === "none" ? "NEW" : v.countryId}-${String(calendars.length + 1).padStart(2, "0")}`,
      name: v.name.trim(),
      countryId: v.countryId === "none" ? null : v.countryId,
      countryName:
        v.countryId === "IN" ? "India" : v.countryId === "US" ? "United States" : "— not set —",
      week: ["off", "working", "working", "working", "working", "working", "off"],
      fyStartMonth: Number(v.fyStartMonth),
      timezone: v.timezone,
      holidayCount: v.countryId === "IN" ? 14 : v.countryId === "US" ? 7 : 0,
      branches: [],
      employees: 0,
      status: "draft",
      isDefault: false,
    };
    setCalendars((cs) => [...cs, cal]);
    mockAction(`${cal.name} created`, {
      description: `${cal.id} · ${cal.countryName} · FY starts ${format(parseISO(`2026-${String(cal.fyStartMonth).padStart(2, "0")}-01`), "MMMM")}.`,
    });
    setCreateOpen(false);
    createForm.reset();
  });

  /* --------------------------------------------------------------- table */
  const columns = React.useMemo<ColumnDef<WorkCalendar, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Calendar",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              {row.original.name}
              {row.original.isDefault && (
                <Hint text="Default calendar for this country">
                  <Star className="size-3 fill-warning text-warning" aria-label="Default" />
                </Hint>
              )}
            </p>
            <p className="tnum text-[11px] text-muted-foreground">
              {row.original.id} · {row.original.countryName}
            </p>
          </div>
        ),
      },
      {
        id: "week",
        header: "Week pattern",
        enableSorting: false,
        accessorFn: (c) => c.week.join(","),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.week.map((p, i) => {
              const ui = PATTERN_UI[p];
              const pill = (
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => cyclePattern(row.original.id, i)}
                  aria-label={`${WEEKDAY_LABELS[i]} is ${ui.label} — click to change`}
                  className={cn(
                    "flex h-6 w-9 flex-col items-center justify-center rounded-md border text-[9px] font-semibold leading-none transition-colors",
                    ui.cls,
                    canEdit
                      ? "hover:ring-2 hover:ring-ring focus-visible:ring-2 focus-visible:ring-ring"
                      : "cursor-not-allowed opacity-70",
                  )}
                >
                  <span>{WEEKDAY_LABELS[i]}</span>
                  <span className="opacity-80">
                    {p === "working" ? "W" : p === "off" ? "Off" : "½"}
                  </span>
                </button>
              );
              return (
                <Hint
                  key={i}
                  text={
                    canEdit
                      ? `${WEEKDAY_LABELS[i]}: ${ui.label}. Click to cycle Working → Off → Half-day.`
                      : why("time.calendars", "E")
                  }
                >
                  <span className="inline-flex">{pill}</span>
                </Hint>
              );
            })}
          </div>
        ),
      },
      {
        accessorKey: "fyStartMonth",
        header: "FY start",
        cell: ({ row }) => (
          <Select
            value={String(row.original.fyStartMonth)}
            disabled={!canEdit}
            onValueChange={(v) =>
              setField(
                row.original.id,
                "fyStartMonth",
                Number(v),
                `${row.original.name} now starts its financial year in ${v === "4" ? "April" : "January"}`,
              )
            }
          >
            <SelectTrigger size="sm" className="w-[150px]" aria-label="Financial year start month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FY_MONTHS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ),
      },
      {
        accessorKey: "timezone",
        header: "Timezone",
        cell: ({ row }) => (
          <Select
            value={row.original.timezone}
            disabled={!canEdit}
            onValueChange={(v) =>
              setField(row.original.id, "timezone", v, `${row.original.name} moved to ${v}`)
            }
          >
            <SelectTrigger size="sm" className="w-[160px]" aria-label="Timezone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ),
      },
      {
        accessorKey: "holidayCount",
        header: "Holidays",
        cell: ({ row }) => <NumCell>{row.original.holidayCount}</NumCell>,
      },
      {
        accessorKey: "employees",
        header: "Employees",
        cell: ({ row }) => <NumCell>{row.original.employees}</NumCell>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setDetail(row.original)}>
              Details
            </Button>
            <Gated menuKey="time.calendars" action="C">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Duplicate ${row.original.name}`}
                onClick={() => duplicate(row.original)}
              >
                <Copy />
              </Button>
            </Gated>
            <Gated menuKey="time.calendars" action="E">
              <Button
                variant="outline"
                size="sm"
                disabled={row.original.isDefault || !row.original.countryId}
                onClick={() => makeDefault(row.original)}
              >
                Set default
              </Button>
            </Gated>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEdit, calendars.length],
  );

  const unmappedBranches = BRANCH_COUNTRY_COVERAGE.filter((b) => !b.resolves);
  const subjectEmployee = DIAGNOSTIC_EMPLOYEES.find((e) => e.code === subject);

  return (
    <PageBody>
      <PageHeader
        title="Work Calendars"
        description={`Week patterns, financial-year start and timezone per country for ${TENANT.name}. A calendar is what turns a date into a working day, a weekly off or a holiday.`}
        actions={
          <Gated menuKey="time.calendars" action="C">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <CalendarPlus /> New calendar
            </Button>
          </Gated>
        }
      />

      {unmappedBranches.length > 0 && (
        <Alert
          tone="warning"
          icon={TriangleAlert}
          title={`${unmappedBranches.length} branch has no country mapped`}
          action={
            <Button variant="outline" size="sm" onClick={() => router.push("/admin/settings")}>
              Open branch settings
            </Button>
          }
        >
          {unmappedBranches.map((b) => `${b.name} (${b.id}, ${b.headcount} employees)`).join(", ")} —
          work context cannot resolve for anyone on that branch, so their attendance stays
          unprocessed. Try it in the diagnostic below.
        </Alert>
      )}

      <Section
        title="Calendars"
        description="Click a day pill to cycle Working → Off → Half-day. Every change applies immediately."
      >
        {loading ? (
          <TableSkeleton rows={4} />
        ) : (
          <DataTable
            columns={columns}
            data={calendars}
            getRowId={(c) => c.id}
            searchKeys={["name", "id", "countryName"]}
            searchPlaceholder="Search calendar or country…"
            exportName="work-calendars"
            emptyIcon={CalendarClock}
            emptyTitle="No work calendars"
            emptyDescription="Create one per country before running attendance."
            pageSize={10}
          />
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Pattern legend
          </span>
          {(Object.keys(PATTERN_UI) as WeekDayPattern[]).map((p) => (
            <span key={p} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn("flex size-4 items-center justify-center rounded-[3px] border text-[9px] font-semibold", PATTERN_UI[p].cls)}
              >
                {p === "working" ? "W" : p === "off" ? "O" : "½"}
              </span>
              <span className="text-xs text-muted-foreground">{PATTERN_UI[p].label}</span>
            </span>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------- diagnostic */}
      <Section
        title="Resolve work context"
        description="Walk the resolution chain for one employee, one step at a time. The resolver fails closed — it never invents a default."
        actions={
          <div className="flex items-center gap-1.5">
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger size="sm" className="w-[300px]" aria-label="Employee to diagnose">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIAGNOSTIC_EMPLOYEES.map((e) => (
                  <SelectItem key={e.code} value={e.code}>
                    {e.name} · {e.code} · {e.branchId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={runResolver} disabled={running}>
              {running ? <Loader2 className="animate-spin" /> : <Play />} Resolve
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-border bg-subtle px-3 py-2">
              {subjectEmployee && <Avatar name={subjectEmployee.name} size={26} />}
              <div className="min-w-0">
                <p className="text-sm font-semibold">{resolution.name}</p>
                <p className="tnum text-xs text-muted-foreground">
                  GET /api/v1/time/work-context?employee={resolution.code}
                </p>
              </div>
              <span className="ml-auto">
                {running ? (
                  <Badge variant="muted">
                    <Loader2 className="size-3 animate-spin" /> resolving…
                  </Badge>
                ) : resolution.ok ? (
                  <StatusBadge status="approved" label="200 OK" />
                ) : (
                  <StatusBadge status="failed" label={`${resolution.httpStatus} Unprocessable`} />
                )}
              </span>
            </div>

            <ol className="flex flex-col gap-1.5">
              {resolution.steps.map((s, i) => {
                const shown = i < revealed;
                const Icon =
                  s.status === "ok" ? Check : s.status === "failed" ? X : MinusCircle;
                return (
                  <li
                    key={s.key}
                    className={cn(
                      "flex items-start gap-2.5 rounded-md border px-3 py-2 transition-all duration-200",
                      !shown && "translate-y-1 opacity-0",
                      shown && s.status === "ok" && "border-success/25 bg-success-soft/40",
                      shown && s.status === "failed" && "border-destructive/30 bg-destructive-soft/50",
                      shown && s.status === "skipped" && "border-dashed border-border bg-muted/40",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                        s.status === "ok" && "bg-success text-white",
                        s.status === "failed" && "bg-destructive text-white",
                        s.status === "skipped" && "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="size-3" strokeWidth={3} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <p className="text-xs font-semibold text-foreground">
                          {i + 1}. {s.label}
                        </p>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {s.source}
                        </span>
                      </div>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-foreground">
                        <ArrowRight className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                        {s.value}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{s.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ol>

            {!running && revealed >= resolution.steps.length && !resolution.ok && (
              <Alert
                tone="danger"
                icon={ShieldAlert}
                className="mt-3"
                title={`422 ${resolution.errorCode} — ${resolution.errorMessage}`}
                action={
                  <Button variant="outline" size="sm" onClick={() => router.push("/admin/settings")}>
                    Fix the branch
                  </Button>
                }
              >
                {resolution.remediation}
              </Alert>
            )}
            {!running && revealed >= resolution.steps.length && resolution.ok && (
              <Alert tone="success" icon={Check} className="mt-3" title="Work context resolved">
                Attendance for {resolution.name} will be evaluated against this calendar, shift and
                band set until the branch or country mapping changes.
              </Alert>
            )}
          </div>

          <Card className="p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Branch → country coverage
            </p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {BRANCH_COUNTRY_COVERAGE.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5"
                >
                  <Globe2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{b.name}</p>
                    <p className="tnum text-[10px] text-muted-foreground">
                      {b.id} · {b.headcount} employees · {b.timezone}
                    </p>
                  </div>
                  <StatusBadge
                    status={b.resolves ? "active" : "failed"}
                    label={b.resolves ? (b.country ?? "") : "No country"}
                    showIcon={false}
                  />
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-muted-foreground">
              A branch without a country cannot pick a country pack, so the resolver returns 422
              instead of silently applying India&rsquo;s rules.
            </p>
          </Card>
        </div>
      </Section>

      {/* ------------------------------------------------------ detail sheet */}
      <Sheet open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        {detail && (
          <SheetContent width="sm:max-w-md" aria-describedby={undefined}>
            <SheetHeader>
              <SheetTitle>{detail.name}</SheetTitle>
              <SheetDescription>
                {detail.id} · {detail.countryName} · {detail.timezone}
              </SheetDescription>
            </SheetHeader>
            <SheetBody className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-1">
                <StatusBadge status={detail.status} />
                {detail.isDefault && <Badge variant="soft">Country default</Badge>}
                <Badge variant="muted">
                  FY from {format(parseISO(`2026-${String(detail.fyStartMonth).padStart(2, "0")}-01`), "MMMM")}
                </Badge>
              </div>

              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Week pattern
                </p>
                <div className="flex gap-1">
                  {detail.week.map((p, i) => (
                    <span
                      key={i}
                      className={cn(
                        "flex h-9 flex-1 flex-col items-center justify-center rounded-md border text-[10px] font-semibold",
                        PATTERN_UI[p].cls,
                      )}
                    >
                      <span>{WEEKDAY_LABELS[i]}</span>
                      <span className="opacity-80">
                        {p === "working" ? "W" : p === "off" ? "Off" : "½"}
                      </span>
                    </span>
                  ))}
                </div>
                <p className="tnum mt-1 text-[11px] text-muted-foreground">
                  {detail.week.filter((d) => d === "working").length} working ·{" "}
                  {detail.week.filter((d) => d === "half").length} half ·{" "}
                  {detail.week.filter((d) => d === "off").length} off
                </p>
              </div>

              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Branches on this calendar
                </p>
                {detail.branches.length ? (
                  <ul className="flex flex-wrap gap-1">
                    {detail.branches.map((b) => (
                      <li key={b}>
                        <Badge variant="muted">{b}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No branch is mapped yet — this calendar affects nobody.
                  </p>
                )}
              </div>

              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Holidays on the {detail.countryName} pack
                </p>
                {detail.countryId ? (
                  <ul className="flex flex-col">
                    {HOLIDAYS.filter((h) => h.country === detail.countryId).map((h) => (
                      <li
                        key={`${h.date}-${h.name}`}
                        className="flex items-center justify-between gap-3 border-b border-border py-1 text-xs last:border-0"
                      >
                        <span className="truncate">{h.name}</span>
                        {h.optional && <Badge variant="outline">Optional</Badge>}
                        <span className="tnum shrink-0 text-muted-foreground">{fmtDate(h.date)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No country pack, so no holiday list resolves.
                  </p>
                )}
              </div>
            </SheetBody>
            <SheetFooter>
              <Button variant="outline" onClick={() => setDetail(null)}>
                Close
              </Button>
              <Gated menuKey="time.calendars" action="C">
                <Button
                  onClick={() => {
                    duplicate(detail);
                    setDetail(null);
                  }}
                >
                  <Copy /> Duplicate
                </Button>
              </Gated>
            </SheetFooter>
          </SheetContent>
        )}
      </Sheet>

      {/* ------------------------------------------------------ new calendar */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New work calendar</DialogTitle>
            <DialogDescription>
              Starts as a draft on a Monday–Friday pattern. Map branches to it, then set it as the
              country default.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreate} noValidate>
            <DialogBody className="flex flex-col gap-3.5">
              <Field
                label="Calendar name"
                htmlFor="cal-name"
                required
                error={createForm.formState.errors.name?.message}
              >
                <Input
                  id="cal-name"
                  placeholder="e.g. India — Manufacturing 6-day"
                  aria-invalid={!!createForm.formState.errors.name}
                  {...createForm.register("name")}
                />
              </Field>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                <Controller
                  control={createForm.control}
                  name="countryId"
                  render={({ field }) => (
                    <Field label="Country" required>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger aria-label="Country">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="IN">India</SelectItem>
                          <SelectItem value="US">United States</SelectItem>
                          <SelectItem value="none">— not set —</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />
                <Controller
                  control={createForm.control}
                  name="fyStartMonth"
                  render={({ field }) => (
                    <Field label="FY start" required>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger aria-label="Financial year start">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FY_MONTHS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />
                <Controller
                  control={createForm.control}
                  name="timezone"
                  render={({ field }) => (
                    <Field label="Timezone" required error={createForm.formState.errors.timezone?.message}>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger aria-label="Timezone">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIMEZONES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />
              </div>
              <Alert tone="info" icon={CalendarClock} title="Created by">
                {persona.name} · the calendar lands as a draft and affects nobody until a branch is
                mapped to it.
              </Alert>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create calendar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageBody>
  );
}
