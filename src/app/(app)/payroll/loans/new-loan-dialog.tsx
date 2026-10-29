"use client";

import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { inr, pct } from "@/lib/format";
import { employeeByCode } from "@/mock/employees";
import { RUN_POPULATION } from "@/mock/payroll";
import { emiFor, loanAdvanceCeiling, LOAN_KIND_LABEL, type LoanKind } from "@/mock/finance-loans";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input, Textarea } from "@/components/ui/primitives";
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
import { GuardedDialog } from "@/components/finance/kit";

const IN_RUN = new Set(RUN_POPULATION.map((e) => e.code));

const schema = z
  .object({
    employeeCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^STL-\d{4}$/, "Use the employee code format STL-0000")
      .refine((c) => IN_RUN.has(c), "Not on the India payroll — loans are recovered through the India run only"),
    kind: z.enum(["salary_advance", "personal_loan"]),
    principal: z.number({ message: "Enter an amount" }).int("Whole rupees only").min(5000, "Minimum is ₹5,000"),
    tenureMonths: z.number({ message: "Enter a tenure" }).int().min(1, "At least 1 month"),
    ratePct: z.number({ message: "Enter a rate" }).min(0).max(15, "Cannot exceed 15% p.a."),
    purpose: z.string().trim().min(8, "Describe the purpose in a few words"),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "salary_advance") {
      const ceiling = loanAdvanceCeiling(v.employeeCode);
      if (ceiling && v.principal > ceiling)
        ctx.addIssue({
          code: "custom",
          path: ["principal"],
          message: `A salary advance is capped at one month's gross — ${inr(ceiling, { decimals: false })}`,
        });
      if (v.tenureMonths > 6)
        ctx.addIssue({ code: "custom", path: ["tenureMonths"], message: "Salary advances are recovered within 6 months" });
      if (v.ratePct !== 0)
        ctx.addIssue({ code: "custom", path: ["ratePct"], message: "Salary advances are interest-free" });
    } else {
      if (v.principal > 500000)
        ctx.addIssue({ code: "custom", path: ["principal"], message: "Personal loans are capped at ₹5,00,000" });
      if (v.tenureMonths > 36)
        ctx.addIssue({ code: "custom", path: ["tenureMonths"], message: "Maximum tenure is 36 months" });
    }
  });

export type NewLoanValues = z.infer<typeof schema>;

const DEFAULTS: NewLoanValues = {
  employeeCode: "",
  kind: "salary_advance",
  principal: 25000,
  tenureMonths: 3,
  ratePct: 0,
  purpose: "",
};

export function NewLoanDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (v: NewLoanValues) => void;
}) {
  const form = useForm<NewLoanValues>({ resolver: zodResolver(schema), defaultValues: DEFAULTS });
  const { errors } = form.formState;
  const [kind, principal, tenure, rate, code] = useWatch({
    control: form.control,
    name: ["kind", "principal", "tenureMonths", "ratePct", "employeeCode"],
  });
  const emp = employeeByCode((code ?? "").trim().toUpperCase());
  const emi = principal > 0 && tenure > 0 ? emiFor(principal, rate || 0, tenure) : 0;

  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) form.reset(DEFAULTS);
  };
  const submit = form.handleSubmit((v) => {
    onSubmit(v);
    close(false);
  });

  return (
    <GuardedDialog open={open} onOpenChange={close} dirty={form.formState.isDirty} size="lg">
      <DialogHeader>
        <DialogTitle>New loan or advance</DialogTitle>
        <DialogDescription>
          Raised by payroll on the employee&apos;s behalf. It goes to the approval queue; recovery starts from the
          first run after disbursement.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} noValidate>
        <DialogBody className="grid gap-3.5 sm:grid-cols-2">
          <Field
            label="Employee code"
            htmlFor="ln-code"
            required
            error={errors.employeeCode?.message}
            hint={emp ? `${emp.name} · ${emp.designation}` : "e.g. STL-0142"}
          >
            <Input id="ln-code" placeholder="STL-0142" aria-invalid={!!errors.employeeCode} {...form.register("employeeCode")} />
          </Field>
          <Field label="Type" required>
            <Controller
              control={form.control}
              name="kind"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v as LoanKind);
                    if (v === "salary_advance") form.setValue("ratePct", 0, { shouldDirty: true });
                    else form.setValue("ratePct", 7.5, { shouldDirty: true });
                  }}
                >
                  <SelectTrigger aria-label="Loan type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(LOAN_KIND_LABEL) as LoanKind[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {LOAN_KIND_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Amount (₹)" htmlFor="ln-amt" required error={errors.principal?.message}>
            <Input
              id="ln-amt"
              type="number"
              step={1000}
              className="tnum"
              aria-invalid={!!errors.principal}
              {...form.register("principal", { valueAsNumber: true })}
            />
          </Field>
          <Field label="Tenure (months)" htmlFor="ln-ten" required error={errors.tenureMonths?.message}>
            <Input
              id="ln-ten"
              type="number"
              className="tnum"
              aria-invalid={!!errors.tenureMonths}
              {...form.register("tenureMonths", { valueAsNumber: true })}
            />
          </Field>
          <Field
            label="Interest rate (% p.a.)"
            htmlFor="ln-rate"
            required
            error={errors.ratePct?.message}
            hint={kind === "salary_advance" ? "Salary advances are interest-free" : "Company rate is 7.50% p.a."}
          >
            <Input
              id="ln-rate"
              type="number"
              step={0.25}
              className="tnum"
              readOnly={kind === "salary_advance"}
              aria-invalid={!!errors.ratePct}
              {...form.register("ratePct", { valueAsNumber: true })}
            />
          </Field>
          <Field label="Purpose" htmlFor="ln-purpose" required error={errors.purpose?.message} className="sm:col-span-2">
            <Textarea id="ln-purpose" rows={2} aria-invalid={!!errors.purpose} {...form.register("purpose")} />
          </Field>
          <Alert tone="neutral" className="sm:col-span-2">
            EMI preview:{" "}
            <strong className="tnum">{emi > 0 ? inr(emi, { decimals: false }) : "—"}</strong> a month for{" "}
            {tenure || "—"} months
            {kind === "personal_loan" && rate > 0 ? ` at ${pct(rate, 2)} p.a. on a reducing balance` : ", interest-free"}.
          </Alert>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button type="submit">Send for approval</Button>
        </DialogFooter>
      </form>
    </GuardedDialog>
  );
}
