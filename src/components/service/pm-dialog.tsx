"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { BRANCHES, DEMO_TODAY } from "@/mock/org";
import { ASSET_CATEGORIES } from "@/mock/workplace";
import { useDirtyGuard } from "./kit";

const FREQUENCIES = ["Monthly", "Quarterly", "Half-yearly", "Yearly"] as const;

const schema = z.object({
  title: z.string().trim().min(6, "Describe the maintenance in a few words"),
  category: z.string().min(1, "Pick a category"),
  branch: z.string().min(1, "Pick a branch"),
  frequency: z.enum(FREQUENCIES),
  nextDue: z.string().min(1, "Pick the first due date").refine((d) => d >= DEMO_TODAY, "First visit cannot be in the past"),
  vendor: z.string().trim().min(3, "Name the vendor or in-house team"),
});
export type PmValues = z.infer<typeof schema>;

const DEFAULTS: PmValues = {
  title: "",
  category: "Laptop",
  branch: "BLR",
  frequency: "Quarterly",
  nextDue: DEMO_TODAY,
  vendor: "",
};

/** Schedules a recurring preventive maintenance plan for a category at a branch. */
export function PmDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (v: PmValues) => void;
}) {
  const { register, handleSubmit, control, reset, formState } = useForm<PmValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });
  const close = () => {
    reset(DEFAULTS);
    onOpenChange(false);
  };
  const { onOpenChange: guarded, guard } = useDirtyGuard(formState.isDirty, close);
  const submit = handleSubmit((v) => {
    onSave(v);
    reset(DEFAULTS);
    onOpenChange(false);
  });
  const e = formState.errors;

  const selectField = (name: "category" | "branch" | "frequency", id: string, options: { value: string; label: string }[]) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Select value={field.value} onValueChange={field.onChange}>
          <SelectTrigger id={id}><SelectValue /></SelectTrigger>
          <SelectContent>
            {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    />
  );

  return (
    <>
      <Dialog open={open} onOpenChange={guarded}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Schedule preventive maintenance</DialogTitle>
            <DialogDescription>Creates a recurring plan; each visit raises a work order 7 days before it is due.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} noValidate>
            <DialogBody className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Plan" htmlFor="pm-title" required error={e.title?.message} className="sm:col-span-2">
                <Input id="pm-title" placeholder="Laptop battery health and firmware sweep" aria-invalid={!!e.title} {...register("title")} />
              </Field>
              <Field label="Category" htmlFor="pm-cat" required>
                {selectField("category", "pm-cat", [...ASSET_CATEGORIES.map((c) => ({ value: c, label: c })), { value: "Facilities", label: "Facilities" }])}
              </Field>
              <Field label="Branch" htmlFor="pm-branch" required>
                {selectField("branch", "pm-branch", BRANCHES.map((b) => ({ value: b.id, label: b.city })))}
              </Field>
              <Field label="Frequency" htmlFor="pm-freq" required>
                {selectField("frequency", "pm-freq", FREQUENCIES.map((f) => ({ value: f, label: f })))}
              </Field>
              <Field label="First visit" htmlFor="pm-due" required error={e.nextDue?.message}>
                <Input id="pm-due" type="date" min={DEMO_TODAY} className="tnum" aria-invalid={!!e.nextDue} {...register("nextDue")} />
              </Field>
              <Field label="Vendor" htmlFor="pm-vendor" required error={e.vendor?.message} className="sm:col-span-2">
                <Input id="pm-vendor" placeholder="Dell Direct Enterprise" aria-invalid={!!e.vendor} {...register("vendor")} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => guarded(false)}>Cancel</Button>
              <Button type="submit">Schedule</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}
