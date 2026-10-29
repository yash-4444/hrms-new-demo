"use client";

import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  PAY_COMPONENT_TAXABILITY,
  PAY_COMPONENT_TYPES,
  type PayComponentDef,
} from "@/mock/finance-payroll";
import { GuardedDialog } from "@/components/finance/kit";
import { Button } from "@/components/ui/button";
import {
  DialogBody,
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
import { Field, Input, Label, Switch, Textarea } from "@/components/ui/primitives";
import { FormulaCode } from "./formula";

const schema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Z][A-Z0-9_]{1,11}$/, "2–12 characters: capitals, digits and underscores, starting with a letter"),
  name: z.string().trim().min(3, "Give the component a payslip name"),
  type: z.enum(PAY_COMPONENT_TYPES as [string, ...string[]]),
  taxability: z.enum(PAY_COMPONENT_TAXABILITY as [string, ...string[]]),
  formula: z
    .string()
    .trim()
    .min(5, "Enter the rule")
    .refine((f) => /^[A-Z][A-Z0-9_]* = .+/.test(f), "Start with the component code, then ' = ', then the expression")
    .refine((f) => f.split("(").length === f.split(")").length, "Brackets are not balanced"),
  order: z.number({ message: "Enter a number" }).int().min(1, "1 or more").max(999, "999 at most"),
  prorated: z.boolean(),
  onPayslip: z.boolean(),
  note: z.string().max(200, "Keep the note under 200 characters"),
});

export type ComponentFormValues = z.infer<typeof schema>;

export function ComponentFormDialog({
  open,
  onOpenChange,
  editing,
  existingCodes,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: PayComponentDef | null;
  existingCodes: string[];
  onSave: (values: ComponentFormValues) => void;
}) {
  const form = useForm<ComponentFormValues>({
    resolver: zodResolver(
      schema.refine((v) => editing?.code === v.code || !existingCodes.includes(v.code), {
        path: ["code"],
        message: "A component with this code already exists",
      }),
    ),
    values: editing
      ? {
          code: editing.code,
          name: editing.name,
          type: editing.type,
          taxability: editing.taxability,
          formula: editing.formula,
          order: editing.order,
          prorated: editing.prorated,
          onPayslip: editing.onPayslip,
          note: editing.note,
        }
      : {
          code: "",
          name: "",
          type: "Earning",
          taxability: "Fully taxable",
          formula: "",
          order: 95,
          prorated: true,
          onPayslip: true,
          note: "",
        },
  });
  const errors = form.formState.errors;
  const formula = useWatch({ control: form.control, name: "formula" }) ?? "";

  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) form.reset();
  };

  const submit = form.handleSubmit((values) => {
    onSave(values);
    close(false);
  });

  return (
    <GuardedDialog open={open} onOpenChange={close} dirty={form.formState.isDirty} size="lg">
      <DialogHeader>
        <DialogTitle>{editing ? `Edit ${editing.name}` : "New salary component"}</DialogTitle>
        <DialogDescription>
          Changes apply from the next calculation of an open run. Closed runs keep the rule they were calculated with.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit}>
        <DialogBody className="flex flex-col gap-3.5">
          <div className="grid gap-3.5 sm:grid-cols-[140px_1fr_100px]">
            <Field label="Code" htmlFor="cmp-code" required error={errors.code?.message}>
              <Input
                id="cmp-code"
                className="font-mono uppercase"
                disabled={!!editing}
                aria-invalid={!!errors.code}
                {...form.register("code", { setValueAs: (v: string) => v.toUpperCase() })}
              />
            </Field>
            <Field label="Name on payslip" htmlFor="cmp-name" required error={errors.name?.message}>
              <Input id="cmp-name" aria-invalid={!!errors.name} {...form.register("name")} />
            </Field>
            <Field label="Order" htmlFor="cmp-order" required error={errors.order?.message}>
              <Input id="cmp-order" type="number" className="tnum" {...form.register("order", { valueAsNumber: true })} />
            </Field>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Type" required>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-label="Type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAY_COMPONENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Taxability" required>
              <Controller
                control={form.control}
                name="taxability"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-label="Taxability">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAY_COMPONENT_TAXABILITY.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>
          <Field
            label="Formula"
            htmlFor="cmp-formula"
            required
            error={errors.formula?.message}
            hint="Variables in capitals (BASIC, GROSS, MONTHLY_CTC); functions min, max, round, if, slab, input."
          >
            <Textarea
              id="cmp-formula"
              rows={2}
              className="font-mono text-xs"
              placeholder="NIGHT = input(&quot;night_shifts&quot;) * 400"
              aria-invalid={!!errors.formula}
              {...form.register("formula")}
            />
          </Field>
          {formula.trim().length > 4 && <FormulaCode formula={formula.trim()} />}
          <div className="flex flex-wrap gap-6">
            <Controller
              control={form.control}
              name="prorated"
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  <Switch id="cmp-prorated" checked={field.value} onCheckedChange={field.onChange} />
                  <Label htmlFor="cmp-prorated">Pro-rate for joiners and leavers</Label>
                </div>
              )}
            />
            <Controller
              control={form.control}
              name="onPayslip"
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  <Switch id="cmp-payslip" checked={field.value} onCheckedChange={field.onChange} />
                  <Label htmlFor="cmp-payslip">Show on payslip</Label>
                </div>
              )}
            />
          </div>
          <Field label="Note" htmlFor="cmp-note" error={errors.note?.message}>
            <Input id="cmp-note" {...form.register("note")} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button type="submit">{editing ? "Save changes" : "Create component"}</Button>
        </DialogFooter>
      </form>
    </GuardedDialog>
  );
}
