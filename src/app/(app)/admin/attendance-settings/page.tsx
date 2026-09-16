"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2,
  CalendarClock,
  Clock,
  Copy,
  Pencil,
  RotateCcw,
  Settings2,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateTime, hm } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, Badge, Field, Input, Separator } from "@/components/ui/primitives";
import {
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { mockAction, useApp } from "@/components/app-state";
import {
  CardsSkeleton,
  Gated,
  PageBody,
  PageHeader,
  Section,
  useFakeLoad,
} from "@/components/shell/page";
import { ATTENDANCE_SETTINGS, type CountryAttendanceSettings } from "@/mock/attendance";
import { TENANT } from "@/mock/org";

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a 24-hour HH:MM time.");
const minutes = (min: number, max: number) =>
  z
    .number()
    .int("Whole minutes only.")
    .min(min, `Must be at least ${min} minutes.`)
    .max(max, `Must be at most ${max} minutes.`);

const schema = z
  .object({
    shiftStart: clock,
    shiftEnd: clock,
    lateThreshold: clock,
    breakMinutes: minutes(0, 120),
    graceMinutes: minutes(0, 60),
    halfDay: minutes(30, 600),
    fullDay: minutes(60, 720),
    overtime: minutes(60, 840),
  })
  .superRefine((v, ctx) => {
    if (v.shiftEnd <= v.shiftStart) {
      ctx.addIssue({ code: "custom", message: "The shift must end after it starts.", path: ["shiftEnd"] });
    }
    if (v.lateThreshold < v.shiftStart) {
      ctx.addIssue({
        code: "custom",
        message: "The late threshold cannot be before the shift start.",
        path: ["lateThreshold"],
      });
    }
    if (v.halfDay >= v.fullDay) {
      ctx.addIssue({ code: "custom", message: "The half-day band must be below the full-day band.", path: ["halfDay"] });
    }
    if (v.overtime < v.fullDay) {
      ctx.addIssue({ code: "custom", message: "Overtime cannot start before a full day is complete.", path: ["overtime"] });
    }
  });

type FormValues = z.infer<typeof schema>;

const BAND_MAX = 720;

function BandRuler({ settings }: { settings: CountryAttendanceSettings }) {
  const { halfDay, fullDay, overtime } = settings.bands;
  const seg = [
    { label: "Absent", to: halfDay, cls: "bg-destructive-soft text-destructive-fg" },
    { label: "Half day", to: fullDay, cls: "bg-warning-soft text-warning-fg" },
    { label: "Full day", to: overtime, cls: "bg-success-soft text-success-fg" },
    { label: "Overtime", to: BAND_MAX, cls: "bg-serious-soft text-serious-fg" },
  ];
  let from = 0;
  return (
    <div>
      <div className="flex h-7 w-full overflow-hidden rounded-md border border-border">
        {seg.map((s) => {
          const width = ((Math.max(s.to, from) - from) / BAND_MAX) * 100;
          from = Math.max(s.to, from);
          return (
            <span
              key={s.label}
              style={{ width: `${width}%` }}
              title={`${s.label} band`}
              className={cn(
                "flex items-center justify-center overflow-hidden whitespace-nowrap border-r border-border text-[10px] font-semibold last:border-r-0",
                s.cls,
              )}
            >
              {width > 12 ? s.label : ""}
            </span>
          );
        })}
      </div>
      <div className="tnum mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>0h</span>
        <span>{halfDay / 60}h half</span>
        <span>{fullDay / 60}h full</span>
        <span>{overtime / 60}h OT</span>
        <span>{BAND_MAX / 60}h</span>
      </div>
    </div>
  );
}

function Detail({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-md border border-border bg-subtle px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="tnum mt-0.5 text-sm font-semibold text-foreground">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function AttendanceSettingsPage() {
  const loading = useFakeLoad();
  const { persona } = useApp();
  const [countries, setCountries] = React.useState<CountryAttendanceSettings[]>(ATTENDANCE_SETTINGS);
  const [editing, setEditing] = React.useState<CountryAttendanceSettings | null>(null);
  const [resetting, setResetting] = React.useState<CountryAttendanceSettings | null>(null);

  const onDefaults = countries.filter((c) => !c.configured).length;
  const india = countries.find((c) => c.id === "IN")!;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    defaultValues: {
      shiftStart: "09:30",
      shiftEnd: "18:30",
      lateThreshold: "09:30",
      breakMinutes: 45,
      graceMinutes: 10,
      halfDay: 240,
      fullDay: 480,
      overtime: 540,
    },
  });

  const openEdit = (c: CountryAttendanceSettings) => {
    setEditing(c);
    form.reset({
      shiftStart: c.shiftStart,
      shiftEnd: c.shiftEnd,
      lateThreshold: c.lateThreshold,
      breakMinutes: c.breakMinutes,
      graceMinutes: c.graceMinutes,
      halfDay: c.bands.halfDay,
      fullDay: c.bands.fullDay,
      overtime: c.bands.overtime,
    });
  };

  const onSubmit = form.handleSubmit((v) => {
    if (!editing) return;
    setCountries((cs) =>
      cs.map((c) =>
        c.id === editing.id
          ? {
              ...c,
              configured: true,
              shiftName:
                c.id === "IN" ? c.shiftName : `${c.countryName} general shift (${c.id}-GEN-01)`,
              shiftStart: v.shiftStart,
              shiftEnd: v.shiftEnd,
              lateThreshold: v.lateThreshold,
              breakMinutes: v.breakMinutes,
              graceMinutes: v.graceMinutes,
              bands: { halfDay: v.halfDay, fullDay: v.fullDay, overtime: v.overtime },
              updatedBy: persona.name,
              updatedAt: "2026-09-16T14:35:00",
              note: "Saved in this session — the demo keeps it in memory only.",
            }
          : c,
      ),
    );
    mockAction(`${editing.countryName} attendance settings saved`, {
      description: `Shift ${v.shiftStart}–${v.shiftEnd} · late after ${v.lateThreshold} + ${v.graceMinutes} min · bands ${v.halfDay}/${v.fullDay}/${v.overtime} min.`,
    });
    setEditing(null);
  });

  const copyFromIndia = (c: CountryAttendanceSettings) => {
    setCountries((cs) =>
      cs.map((x) =>
        x.id === c.id
          ? {
              ...x,
              configured: true,
              shiftName: `${x.countryName} general shift (copied from India)`,
              shiftStart: india.shiftStart,
              shiftEnd: india.shiftEnd,
              lateThreshold: india.lateThreshold,
              breakMinutes: india.breakMinutes,
              graceMinutes: india.graceMinutes,
              bands: { ...india.bands },
              updatedBy: persona.name,
              updatedAt: "2026-09-16T14:35:00",
              note: "Copied from the India country pack in this session.",
            }
          : x,
      ),
    );
    mockAction(`India settings copied to ${c.countryName}`, {
      description: "The country now has its own override and no longer falls back to tenant defaults.",
    });
  };

  const resetToDefaults = (c: CountryAttendanceSettings) => {
    setCountries((cs) =>
      cs.map((x) =>
        x.id === c.id
          ? {
              ...x,
              configured: false,
              shiftName: "Tenant default shift",
              shiftStart: "09:00",
              shiftEnd: "17:30",
              lateThreshold: "09:00",
              breakMinutes: 30,
              graceMinutes: 10,
              bands: { halfDay: 240, fullDay: 480, overtime: 540 },
              updatedBy: "— inherited —",
              updatedAt: "2026-01-01T00:00:00",
              note: "Override removed — the country is back on tenant defaults.",
            }
          : x,
      ),
    );
    mockAction(`${c.countryName} reset to tenant defaults`, {
      tone: "warning",
      description: "The country override was removed. Attendance now resolves from the tenant pack.",
    });
  };

  return (
    <PageBody>
      <PageHeader
        title="Attendance Settings"
        description={`Per-country shift, punctuality and minute-band rules for ${TENANT.name}. A country without an override falls back to the tenant default pack.`}
        actions={
          <Gated menuKey="time.settings" action="E">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                mockAction("Rule simulation queued", {
                  tone: "info",
                  description:
                    "Replays the last 30 days against the current bands for all 106 employees with punch data.",
                })
              }
            >
              <Settings2 /> Simulate on last 30 days
            </Button>
          </Gated>
        }
      />

      {onDefaults > 0 ? (
        <Alert
          tone="warning"
          icon={TriangleAlert}
          title={`${onDefaults} of ${countries.length} countries are running on defaults.`}
          action={
            <Gated menuKey="time.settings" action="E">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const first = countries.find((c) => !c.configured);
                  if (first) openEdit(first);
                }}
              >
                Configure now
              </Button>
            </Gated>
          }
        >
          Attendance for those countries is being evaluated against the tenant pack (09:00–17:30,
          240/480/540 minute bands). Statutory overtime and half-day rules differ by country — save
          an explicit override before the next pay run is locked.
        </Alert>
      ) : (
        <Alert tone="success" icon={ShieldCheck} title="Every country has an explicit override.">
          No country is falling back to the tenant default pack.
        </Alert>
      )}

      {loading ? (
        <CardsSkeleton count={3} height={320} />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {countries.map((c) => (
            <Card key={c.id} className="flex flex-col">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-4 py-2.5">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
                    <Building2 className="size-3.5 text-muted-foreground" aria-hidden />
                    {c.countryName}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{c.shiftName}</p>
                </div>
                <StatusBadge
                  status={c.configured ? "active" : "draft"}
                  label={c.configured ? "Configured" : "On defaults"}
                />
              </div>

              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex flex-wrap gap-1">
                  {c.branches.map((b) => (
                    <Badge key={b} variant="muted">
                      {b}
                    </Badge>
                  ))}
                  <Badge variant="outline">{c.timezone}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Detail
                    label="Shift"
                    value={`${c.shiftStart} – ${c.shiftEnd}`}
                    hint={`${c.breakMinutes} min unpaid break`}
                  />
                  <Detail
                    label="Late threshold"
                    value={c.lateThreshold}
                    hint={`${c.graceMinutes} min grace → late after ${addGrace(c.lateThreshold, c.graceMinutes)}`}
                  />
                </div>

                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Minute bands
                  </p>
                  <BandRuler settings={c} />
                  <ul className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <li className="rounded-md border border-warning/30 bg-warning-soft px-2 py-1.5 text-warning-fg">
                      <p className="text-[10px] font-semibold uppercase">Half day</p>
                      <p className="tnum font-semibold">{c.bands.halfDay} min</p>
                      <p className="tnum text-[10px] opacity-80">{hm(c.bands.halfDay)}</p>
                    </li>
                    <li className="rounded-md border border-success/25 bg-success-soft px-2 py-1.5 text-success-fg">
                      <p className="text-[10px] font-semibold uppercase">Full day</p>
                      <p className="tnum font-semibold">{c.bands.fullDay} min</p>
                      <p className="tnum text-[10px] opacity-80">{hm(c.bands.fullDay)}</p>
                    </li>
                    <li className="rounded-md border border-serious/30 bg-serious-soft px-2 py-1.5 text-serious-fg">
                      <p className="text-[10px] font-semibold uppercase">Overtime</p>
                      <p className="tnum font-semibold">{c.bands.overtime} min</p>
                      <p className="tnum text-[10px] opacity-80">{hm(c.bands.overtime)}</p>
                    </li>
                  </ul>
                </div>

                <Separator />
                <div className="text-xs text-muted-foreground">
                  <p>
                    Weekly off: <span className="text-foreground">{c.weeklyOff}</span>
                  </p>
                  <p className="mt-0.5">
                    Last changed by <span className="text-foreground">{c.updatedBy}</span>
                    {c.configured && ` · ${fmtDateTime(c.updatedAt)}`}
                  </p>
                  <p className="mt-1">{c.note}</p>
                </div>

                <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                  <Gated menuKey="time.settings" action="E">
                    <Button size="sm" onClick={() => openEdit(c)}>
                      <Pencil /> Edit rules
                    </Button>
                  </Gated>
                  {!c.configured ? (
                    <Gated menuKey="time.settings" action="E">
                      <Button variant="outline" size="sm" onClick={() => copyFromIndia(c)}>
                        <Copy /> Copy from India
                      </Button>
                    </Gated>
                  ) : c.id !== "IN" ? (
                    <Gated menuKey="time.settings" action="E">
                      <Button variant="outline" size="sm" onClick={() => setResetting(c)}>
                        <RotateCcw /> Reset to defaults
                      </Button>
                    </Gated>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Section
        title="How a day is classified"
        description="The same bands drive the calendar colours, the day board and what payroll consumes."
      >
        <ol className="flex flex-col gap-2 text-xs">
          {[
            {
              icon: Clock,
              title: "1 · Resolve the shift",
              body: "Employee → branch → country → calendar → shift. A branch with no country fails closed with a 422 — see the diagnostic on Work Calendars.",
            },
            {
              icon: CalendarClock,
              title: "2 · Pair the punches",
              body: "Ins and outs are paired in order. An unmatched in stays open until the finalisation job closes it or the employee regularises it.",
            },
            {
              icon: Settings2,
              title: "3 · Apply the minute bands",
              body: `Worked minutes below ${india.bands.halfDay} are absent, below ${india.bands.fullDay} are a half day, at or above ${india.bands.fullDay} are a full day, and anything past ${india.bands.overtime} is overtime.`,
            },
            {
              icon: TriangleAlert,
              title: "4 · Flag punctuality",
              body: `A first punch after ${india.lateThreshold} plus the ${india.graceMinutes}-minute grace is marked late. Three late marks in a month escalate to the reporting manager.`,
            },
          ].map((s) => (
            <li key={s.title} className="flex items-start gap-2.5 rounded-md border border-border bg-subtle px-3 py-2">
              <s.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <p className="font-semibold text-foreground">{s.title}</p>
                <p className="mt-0.5 text-muted-foreground">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* ------------------------------------------------------- edit dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{editing?.countryName} attendance rules</DialogTitle>
            <DialogDescription>
              Saving creates an explicit country override. Bands are in minutes of worked time, not
              elapsed time — breaks are already deducted.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate>
            <DialogBody className="flex flex-col gap-3.5">
              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
                <Field label="Shift start" htmlFor="s-start" required error={form.formState.errors.shiftStart?.message}>
                  <Input id="s-start" type="time" {...form.register("shiftStart")} />
                </Field>
                <Field label="Shift end" htmlFor="s-end" required error={form.formState.errors.shiftEnd?.message}>
                  <Input id="s-end" type="time" {...form.register("shiftEnd")} />
                </Field>
                <Field
                  label="Unpaid break"
                  htmlFor="s-break"
                  required
                  error={form.formState.errors.breakMinutes?.message}
                  hint="minutes"
                >
                  <Input id="s-break" type="number" min={0} max={120} {...form.register("breakMinutes", { valueAsNumber: true })} />
                </Field>
                <Field
                  label="Late threshold"
                  htmlFor="s-late"
                  required
                  error={form.formState.errors.lateThreshold?.message}
                >
                  <Input id="s-late" type="time" {...form.register("lateThreshold")} />
                </Field>
                <Field
                  label="Grace"
                  htmlFor="s-grace"
                  required
                  error={form.formState.errors.graceMinutes?.message}
                  hint="minutes after the threshold"
                >
                  <Input id="s-grace" type="number" min={0} max={60} {...form.register("graceMinutes", { valueAsNumber: true })} />
                </Field>
              </div>

              <Separator />

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                <Field
                  label="Half-day band"
                  htmlFor="s-half"
                  required
                  error={form.formState.errors.halfDay?.message}
                  hint="minutes worked to earn a half day"
                >
                  <Input id="s-half" type="number" min={30} max={600} {...form.register("halfDay", { valueAsNumber: true })} />
                </Field>
                <Field
                  label="Full-day band"
                  htmlFor="s-full"
                  required
                  error={form.formState.errors.fullDay?.message}
                  hint="minutes worked to earn a full day"
                >
                  <Input id="s-full" type="number" min={60} max={720} {...form.register("fullDay", { valueAsNumber: true })} />
                </Field>
                <Field
                  label="Overtime band"
                  htmlFor="s-ot"
                  required
                  error={form.formState.errors.overtime?.message}
                  hint="minutes past which OT accrues"
                >
                  <Input id="s-ot" type="number" min={60} max={840} {...form.register("overtime", { valueAsNumber: true })} />
                </Field>
              </div>

              <Alert tone="info" icon={Clock} title="Bands must stay ordered">
                Half day &lt; full day ≤ overtime. The resolver rejects an unordered set rather than
                silently reordering it.
              </Alert>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit">Save override</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!resetting}
        onOpenChange={(v) => !v && setResetting(null)}
        title={`Reset ${resetting?.countryName ?? ""} to tenant defaults?`}
        description="The country override is removed and attendance falls back to the tenant pack (09:00–17:30, 240/480/540). Days already finalised are not recalculated."
        confirmLabel="Remove the override"
        destructive
        onConfirm={() => {
          if (resetting) resetToDefaults(resetting);
          setResetting(null);
        }}
      />
    </PageBody>
  );
}

function addGrace(clockValue: string, grace: number) {
  const [h, m] = clockValue.split(":").map(Number);
  const total = h * 60 + m + grace;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
