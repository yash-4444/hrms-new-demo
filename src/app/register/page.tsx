"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Building2, Check, Globe2, Rocket, UserRound, WalletCards } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLANS } from "@/mock/self-service";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Badge, Field, Input } from "@/components/ui/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { AuthShell } from "@/components/self-service/auth-shell";
import { PasswordInput, PasswordStrength, passwordField } from "@/components/self-service/password";

const COUNTRIES = [
  { value: "IN", label: "India", tz: "Asia/Kolkata", fy: "4", currency: "INR" },
  { value: "US", label: "United States", tz: "America/New_York", fy: "1", currency: "USD" },
  { value: "AE", label: "United Arab Emirates", tz: "Asia/Dubai", fy: "1", currency: "AED" },
  { value: "SG", label: "Singapore", tz: "Asia/Singapore", fy: "4", currency: "SGD" },
];
const TIMEZONES = ["Asia/Kolkata", "America/New_York", "Asia/Dubai", "Asia/Singapore", "Europe/London"];
const SIZES = ["1–25", "26–100", "101–500", "501–2,000", "2,000+"];

const schema = z.object({
  company: z.string().trim().min(2, "Enter your company's name"),
  subdomain: z
    .string()
    .trim()
    .min(3, "At least 3 characters")
    .regex(/^[a-z0-9-]+$/, "Lower-case letters, numbers and hyphens only"),
  size: z.string().min(1, "Choose a company size"),
  adminName: z.string().trim().min(2, "Enter your full name"),
  adminEmail: z.string().trim().email("Enter a valid work email"),
  password: passwordField,
  country: z.string().min(1, "Choose a country"),
  fyStart: z.enum(["1", "4"]),
  timezone: z.string().min(1, "Choose a time zone"),
  plan: z.enum(["free", "pro", "enterprise"]),
});
type Values = z.infer<typeof schema>;

const STEPS: { id: string; label: string; icon: React.ElementType; fields: (keyof Values)[] }[] = [
  { id: "company", label: "Company", icon: Building2, fields: ["company", "subdomain", "size"] },
  { id: "admin", label: "Admin", icon: UserRound, fields: ["adminName", "adminEmail", "password"] },
  { id: "defaults", label: "Defaults", icon: Globe2, fields: ["country", "fyStart", "timezone"] },
  { id: "plan", label: "Plan", icon: WalletCards, fields: ["plan"] },
];

export default function RegisterPage() {
  const router = useRouter();
  const { setRole } = useApp();
  const [step, setStep] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      company: "",
      subdomain: "",
      size: "",
      adminName: "",
      adminEmail: "",
      password: "",
      country: "IN",
      fyStart: "4",
      timezone: "Asia/Kolkata",
      plan: "pro",
    },
  });
  const v = form.watch();
  const errors = form.formState.errors;

  const next = async () => {
    const ok = await form.trigger(STEPS[step].fields);
    if (ok) setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const submit = form.handleSubmit((values) => {
    setBusy(true);
    setTimeout(() => {
      setRole("tenant_owner");
      mockAction(`${values.company} is ready`, {
        description: `${PLANS.find((p) => p.id === values.plan)?.name} plan · ${values.subdomain}.hrms-new.app · FY starts ${values.fyStart === "4" ? "April" : "January"}.`,
      });
      router.push("/dashboard");
    }, 600);
  });

  return (
    <AuthShell
      wide
      title="Create your organisation"
      description="Four steps, about two minutes. You can change every default later in Admin › Settings."
      pitchTitle="Run HR on autopilot, from day one."
      pitch="AI-assisted approvals, a policy-aware copilot and statutory payroll for India out of the box — set up in minutes, not months."
      points={["Free for up to 25 employees", "Indian payroll, PF, ESI, PT and TDS built in", "Import employees from a spreadsheet"]}
    >
      <ol className="mb-5 grid grid-cols-4 gap-2" aria-label="Sign-up progress">
        {STEPS.map((s, i) => (
          <li key={s.id} className="flex flex-col gap-1.5">
            <span className={cn("h-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")} aria-hidden />
            <span className={cn("flex items-center gap-1 text-[11px]", i === step ? "font-semibold text-foreground" : "text-muted-foreground")} aria-current={i === step ? "step" : undefined}>
              {i < step ? <Check className="size-3 text-success-fg" aria-hidden /> : <s.icon className="size-3" aria-hidden />}
              {s.label}
            </span>
          </li>
        ))}
      </ol>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (step < STEPS.length - 1) void next();
          else void submit();
        }}
      >
        {step === 0 && (
          <>
            <Field label="Company name" htmlFor="rg-company" required error={errors.company?.message}>
              <Input
                id="rg-company"
                autoFocus
                aria-invalid={!!errors.company}
                {...form.register("company", {
                  onChange: (e) => {
                    if (!form.getFieldState("subdomain").isDirty)
                      form.setValue("subdomain", String(e.target.value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30));
                  },
                })}
              />
            </Field>
            <Field label="Workspace address" htmlFor="rg-sub" required error={errors.subdomain?.message}>
              <div className="flex items-center">
                <Input id="rg-sub" className="rounded-r-none" aria-invalid={!!errors.subdomain} {...form.register("subdomain")} />
                <span className="flex h-8 items-center rounded-r-md border border-l-0 border-input bg-muted px-2 text-xs text-muted-foreground">
                  .hrms-new.app
                </span>
              </div>
            </Field>
            <Field label="Company size" required error={errors.size?.message}>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5" role="radiogroup" aria-label="Company size">
                {SIZES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={v.size === s}
                    onClick={() => form.setValue("size", s, { shouldValidate: true, shouldDirty: true })}
                    className={cn(
                      "rounded-md border px-2 py-1.5 text-xs focus-visible:ring-2 focus-visible:ring-ring",
                      v.size === s ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border hover:bg-muted",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <Field label="Your full name" htmlFor="rg-name" required error={errors.adminName?.message}>
              <Input id="rg-name" autoComplete="name" autoFocus aria-invalid={!!errors.adminName} {...form.register("adminName")} />
            </Field>
            <Field label="Work email" htmlFor="rg-email" required error={errors.adminEmail?.message} hint="You become the tenant owner. We send a verification link here.">
              <Input id="rg-email" type="email" autoComplete="email" aria-invalid={!!errors.adminEmail} {...form.register("adminEmail")} />
            </Field>
            <Field label="Password" htmlFor="rg-pw" required error={errors.password?.message}>
              <PasswordInput id="rg-pw" autoComplete="new-password" aria-invalid={!!errors.password} {...form.register("password")} />
            </Field>
            <PasswordStrength value={v.password} />
          </>
        )}

        {step === 2 && (
          <>
            <Field label="Primary country" required error={errors.country?.message} hint="Sets statutory rules, holidays and currency.">
              <Select
                value={v.country}
                onValueChange={(c) => {
                  const meta = COUNTRIES.find((x) => x.value === c);
                  form.setValue("country", c, { shouldDirty: true, shouldValidate: true });
                  if (meta) {
                    form.setValue("timezone", meta.tz, { shouldDirty: true });
                    form.setValue("fyStart", meta.fy as "1" | "4", { shouldDirty: true });
                  }
                }}
              >
                <SelectTrigger aria-label="Primary country">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label} · {c.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Financial year starts" required>
                <Select value={v.fyStart} onValueChange={(x) => form.setValue("fyStart", x as "1" | "4", { shouldDirty: true })}>
                  <SelectTrigger aria-label="Financial year start">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">April (Apr–Mar)</SelectItem>
                    <SelectItem value="1">January (Jan–Dec)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Time zone" required error={errors.timezone?.message}>
                <Select value={v.timezone} onValueChange={(x) => form.setValue("timezone", x, { shouldDirty: true, shouldValidate: true })}>
                  <SelectTrigger aria-label="Time zone">
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
            </div>
            <p className="rounded-md border border-border bg-subtle p-2.5 text-[11px] text-muted-foreground">
              We&apos;ll pre-load the {COUNTRIES.find((c) => c.value === v.country)?.label} holiday calendar, a standard leave policy, a
              9-hour general shift and {v.country === "IN" ? "PF, ESI, PT and TDS rules for FY 2026-27" : "a default payroll calendar"}.
            </p>
          </>
        )}

        {step === 3 && (
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Plan">
            {PLANS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={v.plan === p.id}
                onClick={() => form.setValue("plan", p.id, { shouldDirty: true })}
                className={cn(
                  "flex flex-col rounded-md border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  v.plan === p.id ? "border-primary bg-primary-soft/40 ring-2 ring-primary/20" : "border-border hover:bg-muted",
                )}
              >
                <span className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{p.name}</span>
                  {p.id === "pro" && <Badge variant="soft">Popular</Badge>}
                </span>
                <span className="tnum mt-1 text-lg font-semibold">{p.price}</span>
                <span className="text-[10px] text-muted-foreground">{p.unit}</span>
                <ul className="mt-2 flex flex-col gap-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-1 text-[11px]">
                      <Check className="mt-0.5 size-3 shrink-0 text-success-fg" aria-hidden /> {f}
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>
        )}

        <div className="mt-2 flex items-center justify-between gap-2">
          {step > 0 ? (
            <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft /> Back
            </Button>
          ) : (
            <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground">
              Already have an account? Sign in
            </Link>
          )}
          {step < STEPS.length - 1 ? (
            <Button type="submit">
              Continue <ArrowRight />
            </Button>
          ) : (
            <Button type="submit" loading={busy}>
              <Rocket /> Create organisation
            </Button>
          )}
        </div>
        {step === STEPS.length - 1 && (
          <p className="text-[11px] text-muted-foreground">
            {v.plan === "free" ? "No card needed." : v.plan === "pro" ? "14-day free trial, no card needed." : "Our team will reach out within one working day."} By
            creating an organisation you accept the terms of service and data-processing agreement.
          </p>
        )}
      </form>
    </AuthShell>
  );
}
