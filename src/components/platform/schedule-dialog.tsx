"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarClock } from "lucide-react";
import { fmtDateTime } from "@/lib/format";
import {
  REPORT_CATALOGUE,
  WEEKDAYS,
  cronOf,
  describeSchedule,
  nextRunOf,
  type ReportFormat,
  type ReportSchedule,
  type ScheduledReport,
} from "@/mock/platform";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, RadioGroup, RadioGroupItem } from "@/components/ui/primitives";
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
import { useDirtyGuard } from "@/components/platform/kit";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const schema = z.object({
  reportId: z.string().min(1, "Pick a report"),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  weekday: z.string(),
  dayOfMonth: z.string(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a time"),
  format: z.enum(["XLSX", "PDF", "CSV"]),
  recipients: z
    .string()
    .trim()
    .min(1, "Add at least one recipient")
    .refine((v) => v.split(/[,\s]+/).filter(Boolean).every((e) => EMAIL.test(e)), "One of the addresses is not a valid email")
    .refine((v) => v.split(/[,\s]+/).filter(Boolean).every((e) => e.toLowerCase().endsWith("@stellartech.in")), "Reports can only be sent to @stellartech.in addresses (data-loss prevention policy)"),
});
type Values = z.infer<typeof schema>;

const toValues = (r: ScheduledReport | null): Values => ({
  reportId: r ? (REPORT_CATALOGUE.find((c) => c.label === r.report)?.id ?? "") : "",
  frequency: r?.schedule.frequency ?? "weekly",
  weekday: String(r?.schedule.weekday ?? 1),
  dayOfMonth: String(r?.schedule.dayOfMonth ?? 1),
  time: r?.schedule.time ?? "09:00",
  format: r?.format ?? "XLSX",
  recipients: r?.recipients.join(", ") ?? "",
});

export function ScheduleDialog({
  open,
  editing,
  owner,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  editing: ScheduledReport | null;
  owner: string;
  onOpenChange: (v: boolean) => void;
  onSave: (r: ScheduledReport, isNew: boolean) => void;
}) {
  const form = useForm<Values>({ resolver: zodResolver(schema), values: toValues(editing) });
  const errors = form.formState.errors;
  const close = () => {
    form.reset(toValues(editing));
    onOpenChange(false);
  };
  const guard = useDirtyGuard(form.formState.isDirty, close);

  const v = form.watch();
  const schedule: ReportSchedule = { frequency: v.frequency, weekday: Number(v.weekday), dayOfMonth: Number(v.dayOfMonth), time: /^\d\d:\d\d$/.test(v.time) ? v.time : "09:00" };

  const submit = form.handleSubmit((vals) => {
    const cat = REPORT_CATALOGUE.find((c) => c.id === vals.reportId)!;
    const sch: ReportSchedule = { frequency: vals.frequency, weekday: Number(vals.weekday), dayOfMonth: Number(vals.dayOfMonth), time: vals.time };
    onSave(
      {
        id: editing?.id ?? `SR-N-${vals.reportId}-${vals.time.replace(":", "")}`,
        report: cat.label,
        module: cat.module,
        schedule: sch,
        nextRunAt: nextRunOf(sch),
        recipients: vals.recipients.split(/[,\s]+/).filter(Boolean),
        format: vals.format as ReportFormat,
        lastStatus: editing?.lastStatus ?? "scheduled",
        lastRunAt: editing?.lastRunAt ?? null,
        paused: editing?.paused ?? false,
        owner: editing?.owner ?? owner,
      },
      !editing,
    );
    close();
  });

  return (
    <>
      <Dialog open={open} onOpenChange={guard.onOpenChange}>
        <DialogContent size="md">
          <form onSubmit={submit} noValidate>
            <DialogHeader>
              <DialogTitle>{editing ? `Edit schedule — ${editing.report}` : "Schedule a report"}</DialogTitle>
              <DialogDescription>Runs on the server in IST and emails a link that expires in 7 days. Recipients must sign in to download.</DialogDescription>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-3">
              <Field label="Report" required error={errors.reportId?.message}>
                <Controller
                  control={form.control}
                  name="reportId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-label="Report" aria-invalid={!!errors.reportId}>
                        <SelectValue placeholder="Choose a report…" />
                      </SelectTrigger>
                      <SelectContent>
                        {REPORT_CATALOGUE.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.module} › {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field label="Repeats" required>
                <Controller
                  control={form.control}
                  name="frequency"
                  render={({ field }) => (
                    <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-4">
                      {(["daily", "weekly", "monthly"] as const).map((f) => (
                        <div key={f} className="flex items-center gap-1.5">
                          <RadioGroupItem value={f} id={`sch-${f}`} />
                          <Label htmlFor={`sch-${f}`} className="capitalize">
                            {f === "daily" ? "Every working day" : f}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}
                />
              </Field>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {v.frequency === "weekly" && (
                  <Field label="On" required>
                    <Controller
                      control={form.control}
                      name="weekday"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger aria-label="Weekday">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {WEEKDAYS.map((d, i) => (
                              <SelectItem key={d} value={String(i)}>
                                {d}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </Field>
                )}
                {v.frequency === "monthly" && (
                  <Field label="Day of month" required>
                    <Controller
                      control={form.control}
                      name="dayOfMonth"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger aria-label="Day of month">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 28 }, (_, i) => (
                              <SelectItem key={i + 1} value={String(i + 1)}>
                                Day {i + 1}
                              </SelectItem>
                            ))}
                            <SelectItem value="0">Last working day</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </Field>
                )}
                <Field label="At (IST)" htmlFor="sch-time" required error={errors.time?.message}>
                  <Input id="sch-time" type="time" step={900} {...form.register("time")} aria-invalid={!!errors.time} />
                </Field>
                <Field label="Format" required>
                  <Controller
                    control={form.control}
                    name="format"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger aria-label="Format">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["XLSX", "PDF", "CSV"].map((f) => (
                            <SelectItem key={f} value={f}>
                              {f}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
              </div>

              <Field label="Recipients" htmlFor="sch-to" required error={errors.recipients?.message} hint="Comma-separated. Distribution lists are fine.">
                <Input id="sch-to" placeholder="leadership@stellartech.in, priya.menon@stellartech.in" {...form.register("recipients")} aria-invalid={!!errors.recipients} />
              </Field>

              <div className="flex items-start gap-2 rounded-md border border-border bg-subtle p-2.5 text-xs">
                <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div>
                  <p className="font-medium">{describeSchedule(schedule)}</p>
                  <p className="text-muted-foreground">
                    Next run {fmtDateTime(nextRunOf(schedule))} · cron <code className="font-mono">{cronOf(schedule)}</code>
                  </p>
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => guard.onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">{editing ? "Save changes" : "Create schedule"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard.guard}
    </>
  );
}
