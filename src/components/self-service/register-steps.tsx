"use client";

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";
import { CircleCheck, CircleX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Field, Input } from "@/components/ui/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { PasswordInput, PasswordStrength } from "@/components/self-service/password";
import { COUNTRIES, SIZES, TIMEZONES, toSubdomain, type RegisterValues } from "@/components/self-service/register-schema";

/* The first three /register steps. The page owns the form and the step; each
   step only renders its fields. */

type Form = UseFormReturn<RegisterValues>;

/** Live availability of the typed subdomain; null while the name is not yet valid. */
export type SubdomainCheck = { available: boolean; reason?: string; suggestion?: string } | null;

export function CompanyStep({ form, check }: { form: Form; check: SubdomainCheck }) {
  const v = form.watch();
  const errors = form.formState.errors;
  /* The "taken" error set on Continue goes stale as soon as the applicant types a free name. */
  const subError = errors.subdomain?.type === "manual" && check?.available ? undefined : errors.subdomain?.message;
  return (
    <>
      <Field label="Company name" htmlFor="rg-company" required error={errors.company?.message}>
        <Input
          id="rg-company"
          autoFocus
          aria-invalid={!!errors.company}
          {...form.register("company", {
            onChange: (e) => {
              if (!form.getFieldState("subdomain").isDirty) form.setValue("subdomain", toSubdomain(String(e.target.value)));
            },
          })}
        />
      </Field>
      <Field
        label="Workspace address"
        htmlFor="rg-sub"
        required
        error={subError}
        hint={
          check && (
            <span aria-live="polite" className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span className={cn("inline-flex items-center gap-1", check.available ? "text-success-fg" : "text-destructive-fg")}>
                {check.available ? <CircleCheck className="size-3" aria-hidden /> : <CircleX className="size-3" aria-hidden />}
                <span className="font-mono">{v.subdomain}.hrms-new.app</span> {check.available ? "is available" : check.reason}
              </span>
              {check.suggestion && (
                <button
                  type="button"
                  className="text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => form.setValue("subdomain", check.suggestion!, { shouldDirty: true, shouldValidate: true })}
                >
                  Use {check.suggestion}
                </button>
              )}
            </span>
          )
        }
      >
        <div className="flex items-center">
          <Input
            id="rg-sub"
            className="rounded-r-none"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={!!subError || check?.available === false}
            {...form.register("subdomain")}
          />
          <span className="flex h-8 items-center rounded-r-md border border-l-0 border-input bg-muted px-2 text-xs text-muted-foreground">.hrms-new.app</span>
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
  );
}

export function AdminStep({ form }: { form: Form }) {
  const errors = form.formState.errors;
  return (
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
      <PasswordStrength value={form.watch("password")} />
    </>
  );
}

export function DefaultsStep({ form }: { form: Form }) {
  const v = form.watch();
  const errors = form.formState.errors;
  return (
    <>
      <Field label="Primary country" required error={errors.country?.message} hint="Sets statutory rules, holidays and currency.">
        <Select
          value={v.country}
          onValueChange={(c) => {
            const meta = COUNTRIES.find((x) => x.value === c);
            if (!meta) return;
            form.setValue("country", meta.value, { shouldDirty: true, shouldValidate: true });
            form.setValue("timezone", meta.tz, { shouldDirty: true });
            form.setValue("fyStart", meta.fy, { shouldDirty: true });
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
        We&apos;ll pre-load the {COUNTRIES.find((c) => c.value === v.country)?.label} holiday calendar, a standard leave policy, a 9-hour general shift and{" "}
        {v.country === "IN" ? "PF, ESI, PT and TDS rules for FY 2026-27" : "a default payroll calendar"}.
      </p>
    </>
  );
}
