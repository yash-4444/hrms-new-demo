"use client";

import * as React from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import {
  AlarmClock,
  CalendarDays,
  ChevronDown,
  CircleCheck,
  Eye,
  Laptop,
  PartyPopper,
  Upload,
  UserRound,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDay } from "@/lib/format";
import { DEMO_TODAY, deptName } from "@/mock/org";
import { EMPLOYEES, employeeByCode, employeeName, type Employee } from "@/mock/employees";
import {
  LATEST_JOINER,
  firstWeekSchedule,
  isRecentJoiner,
  onboardingTasks,
  type OnboardingTask,
  type TaskOwner,
} from "@/mock/self-service";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, Avatar, Badge, Checkbox, EmptyState } from "@/components/ui/primitives";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/overlays";
import { CardsSkeleton, PageBody, PageHeader, Section, useFakeLoad } from "@/components/shell/page";
import { ProgressRing } from "@/components/self-service/bits";

const OWNERS: { id: TaskOwner; label: string; icon: React.ElementType }[] = [
  { id: "You", label: "You", icon: UserRound },
  { id: "HR", label: "HR", icon: UsersRound },
  { id: "IT", label: "IT", icon: Laptop },
  { id: "Manager", label: "Manager", icon: UserRoundCheck },
];

export default function MyOnboardingPage() {
  const { persona } = useApp();
  return <MyOnboarding key={persona.employeeId} />;
}

function MyOnboarding() {
  const loading = useFakeLoad();
  const { persona, can } = useApp();
  const self = employeeByCode(persona.employeeId);
  const [preview, setPreview] = React.useState(false);
  const emp: Employee | undefined = preview ? LATEST_JOINER : self;

  if (loading || !emp) {
    return (
      <PageBody>
        <PageHeader title="My onboarding" description="Loading…" />
        <CardsSkeleton count={4} height={140} />
      </PageBody>
    );
  }

  const live = isRecentJoiner(emp);
  const canPreview = !preview && !live && can("people.profile");

  return (
    <PageBody>
      <PageHeader
        title={preview ? `Onboarding · ${emp.name}` : "My onboarding"}
        description={
          live
            ? "Everything between your offer and your first month, in one checklist. Tasks owned by HR, IT and your manager update here as they finish."
            : "Your joining checklist, kept for reference."
        }
        actions={
          preview ? (
            <Button size="sm" variant="outline" onClick={() => setPreview(false)}>
              Back to my record
            </Button>
          ) : canPreview ? (
            <Button size="sm" variant="outline" onClick={() => setPreview(true)}>
              <Eye /> Preview a new joiner&apos;s view
            </Button>
          ) : null
        }
      />
      {preview && (
        <Alert tone="info" icon={Eye} title={`Previewing as ${emp.name} — joined ${fmtDate(emp.joiningDate)}`}>
          This is exactly what a new joiner sees on day {differenceInCalendarDays(parseISO(DEMO_TODAY), parseISO(emp.joiningDate)) + 1}. Ticking tasks
          here is disabled — it is their checklist, not yours.
        </Alert>
      )}
      {live ? <LiveChecklist emp={emp} readOnly={preview} /> : <CompletedState emp={emp} />}
    </PageBody>
  );
}

/* ------------------------------------------------------------ live joiner */

function LiveChecklist({ emp, readOnly }: { emp: Employee; readOnly: boolean }) {
  const [tasks, setTasks] = React.useState<OnboardingTask[]>(() => onboardingTasks(emp));
  const done = tasks.filter((t) => t.done).length;
  const pct = (done / tasks.length) * 100;
  const day = differenceInCalendarDays(parseISO(DEMO_TODAY), parseISO(emp.joiningDate)) + 1;
  const buddy = EMPLOYEES.find(
    (e) => e.departmentId === emp.departmentId && e.code !== emp.code && e.level === 3 && e.joiningDate < "2024-01-01" && e.status === "active",
  );
  const schedule = firstWeekSchedule(emp);
  const uploads = tasks.filter((t) => t.needsUpload);
  const overdue = tasks.filter((t) => !t.done && t.due < DEMO_TODAY);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [uploadFor, setUploadFor] = React.useState<string | null>(null);

  const complete = (id: string, value: boolean) => {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: value, doneOn: value ? DEMO_TODAY : null } : t)));
    const t = tasks.find((x) => x.id === id);
    if (t) mockAction(value ? `Done — ${t.title}` : `Reopened — ${t.title}`, { description: value ? "HR can see your progress." : undefined });
  };

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex items-center gap-4 p-4">
          <ProgressRing value={pct} size={84} />
          <div>
            <p className="text-sm font-semibold">
              {done} of {tasks.length} tasks done
            </p>
            <p className="text-xs text-muted-foreground">Day {day} at Stellar · joined {fmtDate(emp.joiningDate)}</p>
            {overdue.length > 0 && (
              <Badge variant="outline" className="mt-1.5 border-warning/30 text-warning-fg">
                <AlarmClock className="size-3" aria-hidden /> {overdue.length} overdue
              </Badge>
            )}
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          {buddy ? (
            <>
              <Avatar name={buddy.name} size={44} />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Your onboarding buddy</p>
                <p className="truncate text-sm font-semibold">{buddy.name}</p>
                <p className="truncate text-xs text-muted-foreground">{buddy.designation} · {deptName(buddy.departmentId)}</p>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Your manager is assigning a buddy.</p>
          )}
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <Avatar name={employeeName(emp.managerCode) || "Manager"} size={44} />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Reporting manager</p>
            <p className="truncate text-sm font-semibold">{employeeName(emp.managerCode) || "—"}</p>
            <p className="truncate text-xs text-muted-foreground">First 1:1 by {fmtDate(tasks[15].due)}</p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="grid gap-4 md:grid-cols-2">
          {OWNERS.map((o) => {
            const list = tasks.filter((t) => t.owner === o.id);
            const d = list.filter((t) => t.done).length;
            return (
              <Section key={o.id} title={`${o.label}`} description={`${d} of ${list.length} done`}>
                <ul className="flex flex-col gap-2">
                  {list.map((t) => {
                    const late = !t.done && t.due < DEMO_TODAY;
                    return (
                      <li key={t.id} className="flex items-start gap-2.5">
                        {o.id === "You" && !readOnly ? (
                          <Checkbox
                            className="mt-0.5"
                            checked={t.done}
                            onCheckedChange={(v) => complete(t.id, v === true)}
                            aria-label={t.title}
                          />
                        ) : (
                          <CircleCheck className={cn("mt-0.5 size-4 shrink-0", t.done ? "text-success-fg" : "text-muted-foreground/40")} aria-label={t.done ? "Done" : "Not done"} />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-xs", t.done && "text-muted-foreground line-through")}>{t.title}</p>
                          <p className={cn("tnum text-[11px]", late ? "text-warning-fg" : "text-muted-foreground")}>
                            {t.done ? `Done ${fmtDate(t.doneOn!)}` : `${late ? "Overdue · was due" : "Due"} ${fmtDate(t.due)}`}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Section>
            );
          })}
        </div>

        <div className="flex flex-col gap-4">
          <Section title="Documents to upload">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="sr-only"
              aria-label="Choose a document"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && uploadFor) {
                  setTasks((ts) => ts.map((t) => (t.id === uploadFor ? { ...t, done: true, doneOn: DEMO_TODAY } : t)));
                  mockAction(`Uploaded ${f.name}`, { description: "HR Operations will verify it within 2 working days." });
                }
                e.target.value = "";
              }}
            />
            <ul className="flex flex-col gap-2">
              {uploads.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-xs">{t.title.replace(/^Upload |^Add /, "")}</span>
                  {t.done ? (
                    <Badge className="border-success/25 bg-success-soft text-success-fg">Uploaded</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={readOnly}
                      onClick={() => {
                        setUploadFor(t.id);
                        fileRef.current?.click();
                      }}
                    >
                      <Upload /> Upload
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Your first week">
            <ol className="flex flex-col gap-3">
              {schedule.map((d, i) => (
                <li key={d.day} className="flex gap-3">
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                      d.day < DEMO_TODAY ? "bg-success-soft text-success-fg" : d.day === DEMO_TODAY ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-xs font-semibold">{fmtDay(d.day)}</p>
                    <ul className="mt-0.5 flex flex-col">
                      {d.items.map((x) => (
                        <li key={x} className="text-[11px] text-muted-foreground">
                          {x}
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------- long-tenured */

function CompletedState({ emp }: { emp: Employee }) {
  const tasks = React.useMemo(() => onboardingTasks(emp), [emp]);
  const completedOn = tasks.reduce((a, t) => (t.doneOn && t.doneOn > a ? t.doneOn : a), emp.joiningDate);
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Card className="flex flex-col items-center gap-3 p-8 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success-fg">
          <PartyPopper className="size-6" aria-hidden />
        </span>
        <div>
          <p className="text-base font-semibold">Onboarding completed {fmtDate(completedOn)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            All {tasks.length} tasks across you, HR, IT and your manager were closed. You joined on {fmtDate(emp.joiningDate)} as{" "}
            {emp.designation}.
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="muted">
            <CalendarDays className="size-3" aria-hidden /> {differenceInCalendarDays(parseISO(completedOn), parseISO(emp.joiningDate))} days to complete
          </Badge>
        </div>
      </Card>

      <Collapsible open={open} onOpenChange={setOpen}>
        <Section
          title="Historical checklist"
          actions={
            <CollapsibleTrigger asChild>
              <Button size="sm" variant="ghost" aria-expanded={open}>
                <ChevronDown className={cn("transition-transform", open && "rotate-180")} /> {open ? "Hide" : "Show"} {tasks.length} tasks
              </Button>
            </CollapsibleTrigger>
          }
          bodyClassName={open ? "p-4" : "p-0"}
        >
          <CollapsibleContent>
            {tasks.length === 0 ? (
              <EmptyState title="No checklist on record" />
            ) : (
              <ul className="grid gap-x-6 gap-y-2 md:grid-cols-2">
                {tasks.map((t) => (
                  <li key={t.id} className="flex items-start gap-2">
                    <CircleCheck className="mt-0.5 size-4 shrink-0 text-success-fg" aria-hidden />
                    <div>
                      <p className="text-xs">{t.title}</p>
                      <p className="tnum text-[11px] text-muted-foreground">
                        {t.owner} · done {t.doneOn ? fmtDate(t.doneOn) : "—"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CollapsibleContent>
        </Section>
      </Collapsible>
    </>
  );
}
