"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTheme } from "next-themes";
import { BellRing, Languages, Lock, Monitor, Moon, MoonStar, RotateCcw, Save, Sun } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { DEMO_NOW } from "@/mock/org";
import {
  DEFAULT_PREFERENCES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TYPES,
  type NotificationChannel,
} from "@/mock/self-service";
import { mockAction } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Field, Hint, Input, Label, RadioGroup, RadioGroupItem, Switch } from "@/components/ui/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { CardsSkeleton, Gated, PageBody, PageHeader, Section, useFakeLoad } from "@/components/shell/page";

const DATE_FORMATS = [
  { value: "dd MMM yyyy", label: "16 Sep 2026" },
  { value: "dd/MM/yyyy", label: "16/09/2026" },
  { value: "yyyy-MM-dd", label: "2026-09-16 (ISO)" },
  { value: "MMM d, yyyy", label: "Sep 16, 2026" },
];

const schema = z
  .object({
    matrix: z.record(z.string(), z.record(z.string(), z.boolean())),
    digest: z.enum(["off", "daily", "weekly"]),
    /* Disabled inputs submit as undefined in React Hook Form, hence optional. */
    digestTime: z.string().optional(),
    quietOn: z.boolean(),
    quietFrom: z.string().optional(),
    quietTo: z.string().optional(),
    language: z.enum(["en", "hi"]),
    dateFormat: z.string(),
  })
  .refine((v) => v.digest === "off" || !!v.digestTime, { path: ["digestTime"], message: "Pick a time" })
  .refine((v) => !v.quietOn || v.quietFrom !== v.quietTo, { path: ["quietTo"], message: "Quiet hours must start and end at different times" });
type Prefs = z.infer<typeof schema>;

const DEFAULTS: Prefs = {
  matrix: DEFAULT_PREFERENCES,
  digest: "daily",
  digestTime: "09:00",
  quietOn: true,
  quietFrom: "21:00",
  quietTo: "08:00",
  language: "en",
  dateFormat: "dd MMM yyyy",
};

export default function PreferencesPage() {
  const loading = useFakeLoad();
  const { theme, setTheme } = useTheme();
  const form = useForm<Prefs>({ resolver: zodResolver(schema), defaultValues: DEFAULTS });
  const v = form.watch();
  const dirty = form.formState.isDirty;

  const toggle = (type: string, ch: NotificationChannel, on: boolean) =>
    form.setValue(`matrix.${type}.${ch}` as `matrix.${string}`, on as never, { shouldDirty: true });

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Preferences" description="Loading…" />
        <CardsSkeleton count={3} height={160} />
      </PageBody>
    );
  }

  return (
    <form
      onSubmit={form.handleSubmit((values) => {
        form.reset(values);
        const on = Object.values(values.matrix).reduce((a, r) => a + Object.values(r).filter(Boolean).length, 0);
        mockAction("Preferences saved", { description: `${on} channel subscriptions · ${values.language === "hi" ? "हिन्दी" : "English"} · digest ${values.digest}.` });
      })}
    >
      <PageBody>
        <PageHeader
          title="Preferences"
          description="Choose how the system reaches you, when it stays quiet, and how dates and language appear."
          actions={
            <>
              <Button type="button" size="sm" variant="ghost" disabled={!dirty} onClick={() => form.reset()}>
                <RotateCcw /> Discard
              </Button>
              <Gated menuKey="my.preferences" action="E">
                <Button type="submit" size="sm" disabled={!dirty}>
                  <Save /> Save changes
                </Button>
              </Gated>
            </>
          }
        />

        <Section title="Notifications" description="Security alerts and payslips have channels your tenant makes mandatory.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 pr-3 text-left font-medium">Notification</th>
                  {NOTIFICATION_CHANNELS.map((c) => (
                    <th key={c} className="w-20 py-2 text-center font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {NOTIFICATION_TYPES.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-3">
                      <p className="font-medium">{t.label}</p>
                      <p className="text-[11px] text-muted-foreground">{t.help}</p>
                    </td>
                    {NOTIFICATION_CHANNELS.map((c) => {
                      const locked = t.mandatory?.includes(c);
                      const checked = locked ? true : !!v.matrix[t.id]?.[c];
                      const sw = (
                        <Switch
                          checked={checked}
                          disabled={locked}
                          aria-label={`${t.label} via ${c}`}
                          onCheckedChange={(on) => toggle(t.id, c, on)}
                        />
                      );
                      return (
                        <td key={c} className="py-2.5 text-center">
                          <span className="inline-flex items-center gap-1">
                            {locked ? (
                              <Hint text="Required by your tenant's security policy">
                                <span className="inline-flex items-center gap-1">
                                  {sw}
                                  <Lock className="size-3 text-muted-foreground" aria-hidden />
                                </span>
                              </Hint>
                            ) : (
                              sw
                            )}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Digest & quiet hours" description="Bundle the non-urgent ones; approvals past SLA still break through.">
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email digest">
                  <Select value={v.digest} onValueChange={(x) => form.setValue("digest", x as Prefs["digest"], { shouldDirty: true })}>
                    <SelectTrigger aria-label="Email digest">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="off">Off — send each one</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly (Monday)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Send at" htmlFor="digest-time" error={form.formState.errors.digestTime?.message}>
                  <Input id="digest-time" type="time" disabled={v.digest === "off"} {...form.register("digestTime")} />
                </Field>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border bg-subtle px-3 py-2">
                <div className="flex items-center gap-2">
                  <MoonStar className="size-4 text-muted-foreground" aria-hidden />
                  <div>
                    <Label htmlFor="quiet-on">Quiet hours</Label>
                    <p className="text-[11px] text-muted-foreground">No WhatsApp or Teams pings in this window.</p>
                  </div>
                </div>
                <Switch id="quiet-on" checked={v.quietOn} onCheckedChange={(x) => form.setValue("quietOn", x, { shouldDirty: true })} />
              </div>
              <div className={cn("grid grid-cols-2 gap-3", !v.quietOn && "opacity-50")}>
                <Field label="From" htmlFor="quiet-from">
                  <Input id="quiet-from" type="time" disabled={!v.quietOn} {...form.register("quietFrom")} />
                </Field>
                <Field label="To" htmlFor="quiet-to" error={form.formState.errors.quietTo?.message}>
                  <Input id="quiet-to" type="time" disabled={!v.quietOn} aria-invalid={!!form.formState.errors.quietTo} {...form.register("quietTo")} />
                </Field>
              </div>
            </div>
          </Section>

          <Section title="Language, theme & dates">
            <div className="flex flex-col gap-4">
              <Field label="Language">
                <RadioGroup
                  value={v.language}
                  onValueChange={(x) => form.setValue("language", x as Prefs["language"], { shouldDirty: true })}
                  className="flex gap-4"
                  aria-label="Language"
                >
                  {[
                    { value: "en", label: "English" },
                    { value: "hi", label: "हिन्दी (Hindi)" },
                  ].map((o) => (
                    <label key={o.value} className="flex items-center gap-2 text-xs">
                      <RadioGroupItem value={o.value} /> {o.label}
                    </label>
                  ))}
                </RadioGroup>
              </Field>

              <Field label="Theme" hint="Applies immediately on this device.">
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme">
                  {[
                    { value: "light", label: "Light", icon: Sun },
                    { value: "dark", label: "Dark", icon: Moon },
                    { value: "system", label: "System", icon: Monitor },
                  ].map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={theme === o.value}
                      onClick={() => setTheme(o.value)}
                      className={cn(
                        "flex items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                        theme === o.value ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border hover:bg-muted",
                      )}
                    >
                      <o.icon className="size-3.5" aria-hidden /> {o.label}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Date format" hint={`Preview: ${format(parseISO(DEMO_NOW), v.dateFormat)}`}>
                <Select value={v.dateFormat} onValueChange={(x) => form.setValue("dateFormat", x, { shouldDirty: true })}>
                  <SelectTrigger aria-label="Date format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_FORMATS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Languages className="size-3" aria-hidden /> Hindi covers navigation, notifications and payslips; policy documents stay in the language they were published in.
              </p>
            </div>
          </Section>
        </div>

        {dirty && (
          <div className="sticky bottom-0 z-10 flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 shadow-lg">
            <p className="flex items-center gap-1.5 text-xs">
              <BellRing className="size-3.5 text-muted-foreground" aria-hidden /> You have unsaved changes.
            </p>
            <div className="flex gap-1.5">
              <Button type="button" size="sm" variant="ghost" onClick={() => form.reset()}>
                Discard
              </Button>
              <Gated menuKey="my.preferences" action="E">
                <Button type="submit" size="sm">
                  Save changes
                </Button>
              </Gated>
            </div>
          </div>
        )}
      </PageBody>
    </form>
  );
}
