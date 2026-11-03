"use client";

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLANS } from "@/mock/self-service";
import { Badge, Checkbox, Label } from "@/components/ui/primitives";
import type { RegisterValues } from "@/components/self-service/register-schema";

/* The last /register step: the plan, and the consent every applicant must give. */

export function PlanStep({ form }: { form: UseFormReturn<RegisterValues> }) {
  const v = form.watch();
  const termsError = form.formState.errors.terms?.message;
  return (
    <>
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
      <p className="text-[11px] text-muted-foreground">
        {v.plan === "free"
          ? "No card needed. Free sign-ups that pass every check can go live as soon as you verify your email."
          : v.plan === "pro"
            ? "14-day free trial from approval, no card needed."
            : "14-day trial from approval; our team will reach out within one working day."}
      </p>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-2">
          <Checkbox
            id="rg-terms"
            checked={v.terms}
            aria-invalid={!!termsError}
            aria-describedby={termsError ? "rg-terms-error" : undefined}
            onCheckedChange={(c) => form.setValue("terms", c === true, { shouldDirty: true, shouldValidate: true })}
          />
          <Label htmlFor="rg-terms" className="text-xs font-normal leading-snug">
            I accept the HRMS-NEW terms of service and privacy policy, and agree to the data-processing agreement on behalf of my organisation.
            <span className="ml-0.5 text-destructive-fg">*</span>
          </Label>
        </div>
        {termsError && (
          <p id="rg-terms-error" role="alert" className="text-xs text-destructive-fg">
            {termsError}
          </p>
        )}
      </div>
    </>
  );
}
