"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2 } from "lucide-react";

import { DEMO_TODAY } from "@/mock/org";
import type { Agency } from "@/mock/lifecycle";
import { useDirtyGuard } from "@/components/lifecycle/kit";
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
} from "@/components/ui/overlays";

/* ============================================================================
   Add agency — empanels a new search partner on standard commercial terms.
   ========================================================================== */

const REPLACEMENT = ["30", "60", "90", "120"];

const schema = z.object({
  name: z.string().trim().min(3, "Enter the agency's registered name"),
  contact: z.string().trim().min(3, "Who is the account contact?"),
  email: z.string().trim().email("Enter a valid email address"),
  focus: z.string().trim().min(5, "Describe the roles or region they cover"),
  feePct: z
    .number({ message: "Enter the fee as a percentage" })
    .min(3, "Fees below 3% are not commercially credible — check the contract")
    .max(25, "Fees above 25% need CFO sign-off outside this form"),
  slaDays: z.number({ message: "Enter the shortlist SLA in days" }).int("Whole days only").min(1, "At least 1 day").max(30, "30 days at most"),
  replacementDays: z.string().min(1, "Pick the replacement guarantee"),
  contractEnd: z
    .string()
    .min(1, "Pick the contract end date")
    .refine((v) => v > DEMO_TODAY, { message: "The contract must end after today" }),
});
type Values = z.infer<typeof schema>;

const EMPTY = { name: "", contact: "", email: "", focus: "", replacementDays: "90", contractEnd: "" };

export function AddAgencyDialog({
  open,
  onOpenChange,
  nextId,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  nextId: string;
  onAdded: (a: Agency) => void;
}) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const { errors, isDirty } = form.formState;
  const close = () => {
    onOpenChange(false);
    form.reset(EMPTY);
  };
  const { onOpenChange: guardedChange, guard } = useDirtyGuard(isDirty, close);

  const submit = form.handleSubmit((v) => {
    onAdded({
      id: nextId,
      name: v.name,
      contact: v.contact,
      email: v.email.toLowerCase(),
      focus: v.focus,
      feePct: v.feePct,
      slaDays: v.slaDays,
      slaMetPct: 0,
      replacementDays: Number(v.replacementDays),
      contractEnd: v.contractEnd,
      status: "active",
      liveCandidateIds: [],
      submissionsFy: 0,
      interviewsFy: 0,
      hiresFy: 0,
      invoices: [],
    });
    close();
  });

  const num = (n: "feePct" | "slaDays") => form.register(n, { valueAsNumber: true });

  return (
    <>
      <Dialog open={open} onOpenChange={guardedChange}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="size-4 text-primary" aria-hidden /> Add agency
            </DialogTitle>
            <DialogDescription>
              The agency gets a vendor-portal login and can submit against requisitions you share with them.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} noValidate>
            <DialogBody className="grid gap-3 sm:grid-cols-2">
              <Field label="Agency name" htmlFor="agy-name" required error={errors.name?.message} className="sm:col-span-2">
                <Input id="agy-name" {...form.register("name")} aria-invalid={!!errors.name} />
              </Field>
              <Field label="Account contact" htmlFor="agy-contact" required error={errors.contact?.message}>
                <Input id="agy-contact" {...form.register("contact")} aria-invalid={!!errors.contact} />
              </Field>
              <Field label="Contact email" htmlFor="agy-email" required error={errors.email?.message}>
                <Input id="agy-email" type="email" {...form.register("email")} aria-invalid={!!errors.email} />
              </Field>
              <Field label="Focus" htmlFor="agy-focus" required error={errors.focus?.message} className="sm:col-span-2">
                <Input id="agy-focus" placeholder="Data engineering · Hyderabad" {...form.register("focus")} aria-invalid={!!errors.focus} />
              </Field>
              <Field label="Fee (% of annual CTC)" htmlFor="agy-fee" required error={errors.feePct?.message}>
                <Input id="agy-fee" type="number" step="0.01" inputMode="decimal" {...num("feePct")} aria-invalid={!!errors.feePct} />
              </Field>
              <Field label="Shortlist SLA (days)" htmlFor="agy-sla" required error={errors.slaDays?.message}>
                <Input id="agy-sla" type="number" step="1" inputMode="numeric" {...num("slaDays")} aria-invalid={!!errors.slaDays} />
              </Field>
              <Field label="Replacement guarantee" htmlFor="agy-repl" required error={errors.replacementDays?.message}>
                <Controller
                  control={form.control}
                  name="replacementDays"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="agy-repl" aria-invalid={!!errors.replacementDays}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REPLACEMENT.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d} days
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Contract ends" htmlFor="agy-end" required error={errors.contractEnd?.message}>
                <Input id="agy-end" type="date" min={DEMO_TODAY} {...form.register("contractEnd")} aria-invalid={!!errors.contractEnd} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => guardedChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Add agency</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}
