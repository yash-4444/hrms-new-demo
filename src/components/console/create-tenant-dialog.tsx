"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { fmtIso, inr } from "@/lib/format";
import { COUNTRY_META, PLAN_META, type ConsoleTenant, type PlanId, type TenantCountry } from "@/mock/console-tenants";
import { demoNowMs, mockAction } from "@/components/app-state";
import { useConsole } from "@/components/console/console-state";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/primitives";
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
  useDiscardGuard,
} from "@/components/ui/overlays";

/* The operator-side twin of /register: the same company, workspace address,
   owner, plan and country — the owner then receives an invitation and
   finishes setup (password, defaults) themselves. */

const schema = z.object({
  company: z.string().trim().min(2, "Enter the company's name"),
  subdomain: z
    .string()
    .trim()
    .min(3, "At least 3 characters")
    .regex(/^[a-z0-9-]+$/, "Lower-case letters, numbers and hyphens only"),
  ownerName: z.string().trim().min(2, "Enter the owner's full name"),
  ownerEmail: z.string().trim().email("Enter a valid work email"),
  plan: z.enum(["free", "pro", "enterprise"]),
  country: z.enum(["IN", "US", "AE", "SG"]),
  seats: z.number({ error: "Enter a seat count" }).int().min(1, "At least 1 seat").max(50000, "Contact sales above 50,000"),
});
type Values = z.infer<typeof schema>;

const DEFAULTS: Values = { company: "", subdomain: "", ownerName: "", ownerEmail: "", plan: "pro", country: "IN", seats: 50 };

export function CreateTenantDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { tenants, addTenant } = useConsole();
  const form = useForm<Values>({ resolver: zodResolver(schema), mode: "onTouched", defaultValues: DEFAULTS });
  const v = form.watch();
  const errors = form.formState.errors;
  const close = () => {
    form.reset(DEFAULTS);
    onOpenChange(false);
  };
  const { requestClose, guard } = useDiscardGuard(form.formState.isDirty, close);
  const plan = PLAN_META[v.plan];
  const seats = v.plan === "free" ? 25 : v.seats || 0;

  const submit = form.handleSubmit((values) => {
    if (tenants.some((t) => t.subdomain === values.subdomain)) {
      form.setError("subdomain", { message: `${values.subdomain}.hrms-new.app is already taken` });
      return;
    }
    const next = Math.max(...tenants.map((t) => Number(t.id.replace(/\D/g, "")))) + 1;
    const tenant: ConsoleTenant = {
      id: `TN-${next}`,
      name: values.company,
      legalName: values.company,
      subdomain: values.subdomain,
      industry: "—",
      plan: values.plan,
      status: "pending",
      country: values.country,
      seatsUsed: 0,
      seatLimit: values.plan === "free" ? 25 : values.seats,
      mrr: 0,
      ownerName: values.ownerName,
      ownerEmail: values.ownerEmail.toLowerCase(),
      createdAt: fmtIso(new Date(demoNowMs())),
      lastActiveAt: "",
      legalEntities: 1,
      storageUsedGb: 0,
      apiPeakRpm: 0,
      errorRate: 0,
      payment: "none",
      modules: [...PLAN_META[values.plan].modules],
      statusNote: "Created by an operator — waiting for the owner to accept the invitation.",
    };
    addTenant(tenant);
    mockAction(`${values.company} is being provisioned`, {
      description: `${values.subdomain}.hrms-new.app · ${PLAN_META[values.plan].label} · ${COUNTRY_META[values.country].dataResidency}. Invitation sent to ${values.ownerEmail}.`,
    });
    close();
  });

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : requestClose())}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Create tenant</DialogTitle>
            <DialogDescription>
              Provisions an empty organisation and invites its owner. Data residency follows the country and cannot be
              changed after provisioning.
            </DialogDescription>
          </DialogHeader>
          <form
            id="create-tenant"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <DialogBody className="grid gap-3 sm:grid-cols-2">
              <Field label="Company name" htmlFor="ct-company" required error={errors.company?.message} className="sm:col-span-2">
                <Input
                  id="ct-company"
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
              <Field label="Workspace address" htmlFor="ct-sub" required error={errors.subdomain?.message} className="sm:col-span-2">
                <div className="flex items-center">
                  <Input id="ct-sub" className="rounded-r-none" aria-invalid={!!errors.subdomain} {...form.register("subdomain")} />
                  <span className="flex h-8 items-center rounded-r-md border border-l-0 border-input bg-muted px-2 text-xs text-muted-foreground">
                    .hrms-new.app
                  </span>
                </div>
              </Field>
              <Field label="Owner name" htmlFor="ct-owner" required error={errors.ownerName?.message}>
                <Input id="ct-owner" autoComplete="off" aria-invalid={!!errors.ownerName} {...form.register("ownerName")} />
              </Field>
              <Field label="Owner email" htmlFor="ct-email" required error={errors.ownerEmail?.message} hint="Becomes the tenant owner.">
                <Input id="ct-email" type="email" autoComplete="off" aria-invalid={!!errors.ownerEmail} {...form.register("ownerEmail")} />
              </Field>
              <Field label="Plan" required>
                <Select value={v.plan} onValueChange={(p) => form.setValue("plan", p as PlanId, { shouldDirty: true })}>
                  <SelectTrigger aria-label="Plan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(PLAN_META).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label} — {p.seatPrice ? `${inr(p.seatPrice, { decimals: false })} / seat / month` : "up to 25 employees"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Primary country" required hint={COUNTRY_META[v.country].dataResidency}>
                <Select value={v.country} onValueChange={(c) => form.setValue("country", c as TenantCountry, { shouldDirty: true })}>
                  <SelectTrigger aria-label="Primary country">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(COUNTRY_META) as TenantCountry[]).map((c) => (
                      <SelectItem key={c} value={c}>
                        {COUNTRY_META[c].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {v.plan !== "free" && (
                <Field label="Seats" htmlFor="ct-seats" required error={errors.seats?.message}>
                  <Input id="ct-seats" type="number" min={1} aria-invalid={!!errors.seats} {...form.register("seats", { valueAsNumber: true })} />
                </Field>
              )}
              <div className="rounded-md border border-border bg-subtle p-2.5 text-xs sm:col-span-2">
                <p className="font-medium text-foreground">
                  {plan.label} · {plan.modules.length} of 14 modules · {plan.rateLimit.toLocaleString("en-IN")} requests / min
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  {plan.seatPrice
                    ? `${inr(seats * plan.seatPrice, { decimals: false })} a month for ${seats.toLocaleString("en-IN")} seats, billed from activation.`
                    : "Free forever for up to 25 employees. No card required."}
                </p>
              </div>
            </DialogBody>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={requestClose}>
              Cancel
            </Button>
            <Button type="submit" form="create-tenant">
              Create &amp; invite owner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}
