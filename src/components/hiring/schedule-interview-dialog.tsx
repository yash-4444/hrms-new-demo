"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarClock, Info, Search, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import { EMPLOYEES, employeeByCode, type Employee } from "@/mock/employees";
import {
  CANDIDATES,
  INTERVIEW_MODES,
  INTERVIEW_ROUNDS,
  candidateById,
  requisitionByCode,
  type Interview,
  type InterviewMode,
  type InterviewRound,
} from "@/mock/hiring";
import { Button } from "@/components/ui/button";
import {
  Alert,
  Avatar,
  Badge,
  Checkbox,
  Field,
  Input,
  Textarea,
} from "@/components/ui/primitives";
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
} from "@/components/ui/overlays";

/* ============================================================================
   Schedule (or reschedule) an interview.

   The same form does both: pass an `interview` and it opens pre-filled and
   submits as a move. The panel picker is scoped to the requisition's
   department so a recruiter cannot accidentally invite Finance to a system
   design round.
   ========================================================================== */

const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00",
];

export interface SchedulePayload {
  candidateId: string;
  round: InterviewRound;
  date: string;
  time: string;
  durationMins: number;
  mode: InterviewMode;
  panelCodes: string[];
  note: string;
}

const schema = z
  .object({
    candidateId: z.string().min(1, "Choose the candidate you are scheduling"),
    round: z.enum(INTERVIEW_ROUNDS),
    date: z.string().min(1, "Pick a date for the interview"),
    time: z.string().min(1, "Pick a start time"),
    durationMins: z
      .number({ error: "Enter the duration in minutes" })
      .int("Use whole minutes")
      .min(15, "An interview needs at least 15 minutes")
      .max(120, "Keep a single round to 2 hours or less"),
    mode: z.enum(INTERVIEW_MODES),
    panelCodes: z.array(z.string()).min(1, "Add at least one panellist"),
    note: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.date && v.date < DEMO_TODAY) {
      ctx.addIssue({
        code: "custom",
        path: ["date"],
        message: `Cannot schedule in the past — today is ${fmtDate(DEMO_TODAY)}`,
      });
    }
  });

type FormValues = z.infer<typeof schema>;

/** Candidates you can still book a round for. */
const SCHEDULABLE = CANDIDATES.filter(
  (c) => c.stage !== "hired" && c.stage !== "rejected",
);

function panelOptionsFor(candidateId: string): Employee[] {
  const cand = candidateById(candidateId);
  const req = cand ? requisitionByCode(cand.reqCode) : undefined;
  if (!req) return [];

  const out: Employee[] = [];
  const seen = new Set<string>();
  const push = (e: Employee | undefined) => {
    if (!e || seen.has(e.code)) return;
    seen.add(e.code);
    out.push(e);
  };

  push(employeeByCode(req.hiringManagerCode));
  push(employeeByCode(req.recruiterCode));

  EMPLOYEES.filter((e) => e.departmentId === req.departmentId && e.status !== "exited")
    .sort((a, b) => a.level - b.level || a.code.localeCompare(b.code))
    .slice(0, 14)
    .forEach(push);

  return out;
}

export function ScheduleInterviewDialog({
  open,
  onOpenChange,
  interview,
  defaultCandidateId,
  defaultDate,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** When set the dialog reschedules this round instead of creating one. */
  interview?: Interview | null;
  defaultCandidateId?: string;
  defaultDate?: string;
  onSubmitted: (payload: SchedulePayload) => void;
}) {
  const rescheduling = Boolean(interview);
  const [panelQuery, setPanelQuery] = React.useState("");

  const defaults = React.useCallback((): FormValues => {
    if (interview) {
      return {
        candidateId: interview.candidateId,
        round: interview.round,
        date: interview.date < DEMO_TODAY ? DEMO_TODAY : interview.date,
        time: interview.time,
        durationMins: interview.durationMins,
        mode: interview.mode,
        panelCodes: [...interview.panelCodes],
        note: "",
      };
    }
    const first = defaultCandidateId ?? SCHEDULABLE[0]?.id ?? "";
    const cand = candidateById(first);
    const req = cand ? requisitionByCode(cand.reqCode) : undefined;
    return {
      candidateId: first,
      round: "Technical 1",
      date: defaultDate && defaultDate >= DEMO_TODAY ? defaultDate : DEMO_TODAY,
      time: "11:00",
      durationMins: 60,
      mode: "Video call",
      panelCodes: req ? [req.hiringManagerCode] : [],
      note: "",
    };
  }, [interview, defaultCandidateId, defaultDate]);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults(),
    mode: "onSubmit",
  });

  /* A fresh form every time the dialog opens. */
  React.useEffect(() => {
    if (!open) return;
    reset(defaults());
    setPanelQuery("");
  }, [open, reset, defaults]);

  const candidateId = watch("candidateId");
  const panelCodes = watch("panelCodes");
  const mode = watch("mode");

  const candidate = candidateById(candidateId);
  const req = candidate ? requisitionByCode(candidate.reqCode) : undefined;

  /* Changing the candidate re-scopes the panel to their requisition. */
  const lastCandidate = React.useRef(candidateId);
  React.useEffect(() => {
    if (!open || rescheduling) return;
    if (lastCandidate.current === candidateId) return;
    lastCandidate.current = candidateId;
    const c = candidateById(candidateId);
    const r = c ? requisitionByCode(c.reqCode) : undefined;
    setValue("panelCodes", r ? [r.hiringManagerCode] : [], { shouldValidate: false });
  }, [candidateId, open, rescheduling, setValue]);

  const options = React.useMemo(() => panelOptionsFor(candidateId), [candidateId]);
  const visibleOptions = React.useMemo(() => {
    const q = panelQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.designation.toLowerCase().includes(q) ||
        e.code.toLowerCase().includes(q),
    );
  }, [options, panelQuery]);

  const togglePanellist = (code: string) => {
    const next = panelCodes.includes(code)
      ? panelCodes.filter((c) => c !== code)
      : [...panelCodes, code];
    setValue("panelCodes", next, { shouldValidate: true });
  };

  const submit = handleSubmit((values) => {
    onSubmitted({ ...values, note: values.note.trim() });
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {rescheduling ? "Reschedule interview" : "Schedule interview"}
          </DialogTitle>
          <DialogDescription>
            {rescheduling
              ? `Moving ${interview?.round} for ${interview?.candidateName}. The panel is notified with the new slot.`
              : "Book a round with the panel. Invites are sent to the panel and the candidate."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="contents">
          <DialogBody className="flex flex-col gap-3.5">
            {rescheduling && interview && (
              <Alert tone="info" icon={CalendarClock} title="Current slot">
                {fmtDate(interview.date)} at {interview.time} · {interview.mode} ·{" "}
                {interview.durationMins} min
              </Alert>
            )}

            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field
                label="Candidate"
                htmlFor="iv-candidate"
                required
                error={errors.candidateId?.message}
              >
                <Controller
                  control={control}
                  name="candidateId"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={rescheduling}
                    >
                      <SelectTrigger id="iv-candidate" aria-label="Candidate">
                        <SelectValue placeholder="Choose a candidate" />
                      </SelectTrigger>
                      <SelectContent>
                        {SCHEDULABLE.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} · {c.role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field label="Round" htmlFor="iv-round" required error={errors.round?.message}>
                <Controller
                  control={control}
                  name="round"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="iv-round" aria-label="Interview round">
                        <SelectValue placeholder="Choose a round" />
                      </SelectTrigger>
                      <SelectContent>
                        {INTERVIEW_ROUNDS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>

            {req && (
              <p className="-mt-1 text-xs text-muted-foreground">
                Requisition{" "}
                <span className="font-medium text-foreground">{req.code}</span> ·{" "}
                {req.role} · hiring manager{" "}
                <span className="font-medium text-foreground">
                  {employeeByCode(req.hiringManagerCode)?.name ?? req.hiringManagerCode}
                </span>
              </p>
            )}

            <div className="grid gap-3.5 sm:grid-cols-3">
              <Field label="Date" htmlFor="iv-date" required error={errors.date?.message}>
                <Input id="iv-date" type="date" min={DEMO_TODAY} {...register("date")} />
              </Field>

              <Field label="Start time" htmlFor="iv-time" required error={errors.time?.message}>
                <Controller
                  control={control}
                  name="time"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="iv-time" aria-label="Start time">
                        <SelectValue placeholder="Pick a slot" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_SLOTS.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field
                label="Duration (min)"
                htmlFor="iv-duration"
                required
                error={errors.durationMins?.message}
              >
                <Input
                  id="iv-duration"
                  type="number"
                  min={15}
                  max={120}
                  step={15}
                  className="tnum"
                  {...register("durationMins", { valueAsNumber: true })}
                />
              </Field>
            </div>

            <Field label="Mode" error={errors.mode?.message}>
              <Controller
                control={control}
                name="mode"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-1.5">
                    {INTERVIEW_MODES.map((m) => (
                      <Button
                        key={m}
                        type="button"
                        size="sm"
                        variant={field.value === m ? "default" : "outline"}
                        aria-pressed={field.value === m}
                        onClick={() => field.onChange(m)}
                      >
                        {m}
                      </Button>
                    ))}
                  </div>
                )}
              />
            </Field>

            <Field
              label="Panel"
              required
              error={errors.panelCodes?.message}
              hint={
                <span className="flex items-center gap-1">
                  <Users className="size-3" aria-hidden />
                  {panelCodes.length} selected from{" "}
                  {req ? (req.departmentId === "ENG" ? "Engineering" : req.departmentId) : "the"}{" "}
                  department and Talent Acquisition
                </span>
              }
            >
              <div className="rounded-md border border-input">
                <div className="relative border-b border-border">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <input
                    value={panelQuery}
                    onChange={(e) => setPanelQuery(e.target.value)}
                    placeholder="Filter panellists by name or designation…"
                    aria-label="Filter panellists"
                    className="h-8 w-full rounded-t-md bg-card pl-8 pr-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/25"
                  />
                </div>
                <ul className="scrollbar-thin max-h-44 overflow-y-auto p-1">
                  {visibleOptions.length === 0 ? (
                    <li className="px-2 py-3 text-center text-xs text-muted-foreground">
                      No one in this department matches “{panelQuery}”.
                    </li>
                  ) : (
                    visibleOptions.map((e) => {
                      const checked = panelCodes.includes(e.code);
                      return (
                        <li key={e.code}>
                          <label
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1.5 transition-colors hover:bg-muted",
                              checked && "bg-primary-soft/40",
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => togglePanellist(e.code)}
                              aria-label={`Add ${e.name} to the panel`}
                            />
                            <Avatar name={e.name} size={22} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-medium">{e.name}</span>
                              <span className="block truncate text-[10px] text-muted-foreground">
                                {e.designation} · {e.code}
                              </span>
                            </span>
                            {req && e.code === req.hiringManagerCode && (
                              <Badge variant="soft">Hiring manager</Badge>
                            )}
                          </label>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            </Field>

            <Field
              label="Note for the panel"
              htmlFor="iv-note"
              hint="Optional — focus areas, or what the previous round left open."
            >
              <Textarea
                id="iv-note"
                rows={2}
                placeholder="e.g. Probe the ledger migration on the CV — the last round ran out of time."
                {...register("note")}
              />
            </Field>

            {mode === "Video call" && (
              <Alert tone="neutral" icon={Info}>
                A meeting link on meet.stellartech.in is generated automatically and attached to
                the invite.
              </Alert>
            )}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              <CalendarClock />
              {rescheduling ? "Move interview" : "Schedule interview"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
