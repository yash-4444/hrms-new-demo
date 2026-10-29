"use client";

/* Session detail sheet (with attendance marking) and the schedule-session dialog. */

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarDays, ClipboardCheck, MapPin, Video } from "lucide-react";
import { fmtDay } from "@/lib/format";
import { employeeName } from "@/mock/employees";
import { COURSES, courseById } from "@/mock/growth";
import { DEMO_TODAY } from "@/mock/org";
import type { TrainingSession } from "@/mock/engage";
import { mockAction } from "@/components/app-state";
import { useDirtyGuard, personLine } from "@/components/engage/kit";
import { Gated } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Badge, Checkbox, Field, Input } from "@/components/ui/primitives";
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

export function SessionSheet({
  session,
  onOpenChange,
  onSaveAttendance,
}: {
  session: TrainingSession | null;
  onOpenChange: (v: boolean) => void;
  onSaveAttendance: (id: string, present: string[]) => void;
}) {
  const [present, setPresent] = React.useState<Set<string>>(new Set());
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the local copy when another session opens
    setPresent(new Set(session?.present ?? []));
  }, [session]);
  if (!session) return null;
  const course = courseById(session.courseId);
  const canMark = session.date <= DEMO_TODAY;
  const toggle = (code: string, on: boolean) =>
    setPresent((p) => {
      const n = new Set(p);
      if (on) n.add(code);
      else n.delete(code);
      return n;
    });

  return (
    <Sheet open={!!session} onOpenChange={onOpenChange}>
      <SheetContent width="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{course?.title ?? session.courseId}</SheetTitle>
          <SheetDescription>
            {fmtDay(session.date)} · {session.start}–{session.end} · {session.trainer}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="flex flex-1 flex-col gap-3 overflow-y-auto">
          <div className="flex flex-wrap gap-1.5 text-xs">
            <Badge variant="outline">
              {session.mode === "Virtual" ? <Video className="size-3" aria-hidden /> : <MapPin className="size-3" aria-hidden />}
              {session.venue}
            </Badge>
            <Badge variant="outline" className="tnum">{session.attendees.length}/{session.capacity} seats</Badge>
            {session.waitlist.length > 0 && <Badge variant="muted" className="tnum">{session.waitlist.length} on waitlist</Badge>}
          </div>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {canMark ? `Attendance · ${present.size} of ${session.attendees.length} present` : "Confirmed attendees"}
            </h3>
            {canMark && (
              <Gated menuKey="growth.sessions" action="E">
                <Button size="sm" variant="ghost" onClick={() => setPresent(new Set(session.attendees))}>
                  Mark all present
                </Button>
              </Gated>
            )}
          </div>
          <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
            {session.attendees.map((code) => (
              <li key={code} className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs">
                {canMark && (
                  <Gated menuKey="growth.sessions" action="E">
                    <Checkbox
                      id={`att-${session.id}-${code}`}
                      checked={present.has(code)}
                      onCheckedChange={(v) => toggle(code, v === true)}
                      aria-label={`${employeeName(code)} present`}
                    />
                  </Gated>
                )}
                <label htmlFor={`att-${session.id}-${code}`} className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{employeeName(code)}</span>
                  <span className="block truncate text-muted-foreground">{personLine(code)}</span>
                </label>
              </li>
            ))}
          </ul>
          {session.waitlist.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Waitlist (FIFO): {session.waitlist.map((c, i) => `${i + 1}. ${employeeName(c)}`).join(" · ")}
            </p>
          )}
        </SheetBody>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {canMark && (
            <Gated menuKey="growth.sessions" action="E">
              <Button onClick={() => onSaveAttendance(session.id, [...present])}>
                <ClipboardCheck /> Save attendance
              </Button>
            </Gated>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

const schema = z
  .object({
    courseId: z.string().min(1, "Choose a course"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date").refine((d) => d >= DEMO_TODAY, "Sessions can only be scheduled from today onwards"),
    start: z.string().regex(/^\d{2}:\d{2}$/, "Start time is required"),
    end: z.string().regex(/^\d{2}:\d{2}$/, "End time is required"),
    mode: z.enum(["Virtual", "Classroom"]),
    venue: z.string().trim().min(3, "Add a room or meeting link"),
    trainer: z.string().trim().min(3, "Who is running it?"),
    capacity: z.coerce.number<string>().int().min(2, "At least 2 seats").max(200, "200 seats at most"),
  })
  .refine((v) => v.end > v.start, { path: ["end"], message: "End must be after the start" });

type Values = z.input<typeof schema>;
type Parsed = z.output<typeof schema>;

export function ScheduleSessionDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (v: Parsed) => void;
}) {
  const form = useForm<Values, unknown, Parsed>({
    resolver: zodResolver(schema),
    defaultValues: { courseId: "", date: "", start: "10:00", end: "12:00", mode: "Classroom", venue: "", trainer: "", capacity: "20" },
  });
  const close = () => {
    onOpenChange(false);
    form.reset();
  };
  const { onOpenChange: guarded, guard } = useDirtyGuard(form.formState.isDirty, close);
  const errors = form.formState.errors;
  const submit = form.handleSubmit((v) => {
    onCreate(v);
    close();
  });

  return (
    <>
      <Dialog open={open} onOpenChange={guarded}>
        <DialogContent size="md">
          <form onSubmit={submit} noValidate>
            <DialogHeader>
              <DialogTitle>Schedule a training session</DialogTitle>
              <DialogDescription>Enrolled learners and their managers are notified once you save.</DialogDescription>
            </DialogHeader>
            <DialogBody className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Course" required error={errors.courseId?.message} className="sm:col-span-2">
                <Controller
                  control={form.control}
                  name="courseId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-label="Course" aria-invalid={!!errors.courseId}>
                        <SelectValue placeholder="Choose a course" />
                      </SelectTrigger>
                      <SelectContent>
                        {COURSES.filter((c) => c.format !== "Self-paced").map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Date" htmlFor="ss-date" required error={errors.date?.message}>
                <Input id="ss-date" type="date" min={DEMO_TODAY} {...form.register("date")} aria-invalid={!!errors.date} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Start" htmlFor="ss-start" required error={errors.start?.message}>
                  <Input id="ss-start" type="time" {...form.register("start")} />
                </Field>
                <Field label="End" htmlFor="ss-end" required error={errors.end?.message}>
                  <Input id="ss-end" type="time" {...form.register("end")} aria-invalid={!!errors.end} />
                </Field>
              </div>
              <Field label="Mode" required>
                <Controller
                  control={form.control}
                  name="mode"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-label="Mode"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Classroom">Classroom</SelectItem>
                        <SelectItem value="Virtual">Virtual</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Capacity" htmlFor="ss-cap" required error={errors.capacity?.message}>
                <Input id="ss-cap" type="number" inputMode="numeric" {...form.register("capacity")} aria-invalid={!!errors.capacity} />
              </Field>
              <Field label="Venue or link" htmlFor="ss-venue" required error={errors.venue?.message} className="sm:col-span-2">
                <Input id="ss-venue" placeholder="Bengaluru HQ · Training Room 2" {...form.register("venue")} aria-invalid={!!errors.venue} />
              </Field>
              <Field label="Trainer" htmlFor="ss-trainer" required error={errors.trainer?.message} className="sm:col-span-2">
                <Input id="ss-trainer" placeholder="Name, or vendor and faculty" {...form.register("trainer")} aria-invalid={!!errors.trainer} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => guarded(false)}>Cancel</Button>
              <Button type="submit"><CalendarDays /> Schedule session</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}

export function announceAttendance(session: TrainingSession, present: number) {
  mockAction("Attendance saved", {
    description: `${present} of ${session.attendees.length} marked present for ${courseById(session.courseId)?.title ?? session.courseId}. Completion credit posts to each learner's record.`,
  });
}
