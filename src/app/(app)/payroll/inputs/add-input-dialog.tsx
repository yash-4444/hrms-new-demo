"use client";

import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { employeeByCode } from "@/mock/employees";
import { deptName } from "@/mock/org";
import { RUN_POPULATION } from "@/mock/payroll";
import type { PayrollOneTimeInput } from "@/mock/finance-payroll";
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
import { Field, Input } from "@/components/ui/primitives";

const ON_PAYROLL = new Set(RUN_POPULATION.map((e) => e.code));

/** One-time components that accept a keyed amount. */
const INPUT_TYPES = [
  { value: "BONUS|Spot Award", label: "Spot award (BONUS)", kind: "earning" },
  { value: "BONUS|Referral Bonus", label: "Referral bonus (BONUS)", kind: "earning" },
  { value: "BONUS|Sales Incentive", label: "Sales incentive (BONUS)", kind: "earning" },
  { value: "DED_OTHER|Notice-pay Recovery", label: "Notice-pay recovery", kind: "deduction" },
  { value: "DED_OTHER|Asset Damage Recovery", label: "Asset damage recovery", kind: "deduction" },
  { value: "DED_OTHER|Excess Reimbursement Recovery", label: "Excess reimbursement recovery", kind: "deduction" },
] as const;

const schema = z.object({
  employeeCode: z
    .string()
    .trim()
    .toUpperCase()
    .refine((c) => ON_PAYROLL.has(c), "Enter the code of an employee in the September 2026 run"),
  type: z.string().min(1, "Pick a component"),
  amount: z.number({ message: "Enter an amount" }).int("Whole rupees only").min(1, "Must be above ₹0").max(500000, "₹5,00,000 at most per line"),
  source: z.string().trim().min(5, "Say where this comes from, e.g. the approval reference"),
});

type In = z.input<typeof schema>;
type Out = z.output<typeof schema>;

export function AddInputDialog({
  open,
  onOpenChange,
  nextIndex,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  nextIndex: number;
  onAdd: (r: PayrollOneTimeInput) => void;
}) {
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(schema),
    defaultValues: { employeeCode: "", type: "", amount: 0, source: "" },
  });
  const errors = form.formState.errors;
  const code = (useWatch({ control: form.control, name: "employeeCode" }) ?? "").trim().toUpperCase();
  const emp = ON_PAYROLL.has(code) ? employeeByCode(code) : undefined;

  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) form.reset();
  };

  const submit = form.handleSubmit((v) => {
    const e = employeeByCode(v.employeeCode)!;
    const t = INPUT_TYPES.find((x) => x.value === v.type)!;
    const [component, componentName] = t.value.split("|");
    onAdd({
      id: `PIN-M-${String(nextIndex).padStart(3, "0")}`,
      employeeCode: e.code,
      name: e.name,
      department: deptName(e.departmentId),
      component,
      componentName,
      kind: t.kind,
      amount: v.amount,
      source: v.source.trim(),
      status: "pending",
      enteredBy: "Rahul Desai",
      enteredOn: "2026-09-16",
    });
    close(false);
  });

  return (
    <GuardedDialog open={open} onOpenChange={close} dirty={form.formState.isDirty}>
      <DialogHeader>
        <DialogTitle>Add a one-time input</DialogTitle>
        <DialogDescription>Applies to September 2026 only, when the run is next recalculated.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit}>
        <DialogBody className="flex flex-col gap-3.5">
          <Field label="Employee code" htmlFor="pin-emp" required error={errors.employeeCode?.message} hint={emp ? `${emp.name} · ${emp.designation}` : undefined}>
            <Input id="pin-emp" placeholder="STL-0142" className="font-mono uppercase" aria-invalid={!!errors.employeeCode} {...form.register("employeeCode")} />
          </Field>
          <Field label="Component" required error={errors.type?.message}>
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-label="Component" aria-invalid={!!errors.type}>
                    <SelectValue placeholder="Pick a component" />
                  </SelectTrigger>
                  <SelectContent>
                    {INPUT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Amount (₹)" htmlFor="pin-amt" required error={errors.amount?.message}>
            <Input id="pin-amt" type="number" className="tnum" aria-invalid={!!errors.amount} {...form.register("amount", { valueAsNumber: true })} />
          </Field>
          <Field label="Source / approval reference" htmlFor="pin-src" required error={errors.source?.message}>
            <Input id="pin-src" placeholder="Recognition · Q2 spot award" aria-invalid={!!errors.source} {...form.register("source")} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button type="submit">Add input</Button>
        </DialogFooter>
      </form>
    </GuardedDialog>
  );
}
