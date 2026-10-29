"use client";

import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { employeeByCode } from "@/mock/employees";
import { deptName, GRADES } from "@/mock/org";
import { RUN_POPULATION } from "@/mock/payroll";
import { REVISION_REASONS, type RevisionReason, type SalaryRevision } from "@/mock/finance-payroll";
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
import { Field, Input, Textarea } from "@/components/ui/primitives";
import { ArrearsPreview, BreakupCompare } from "./breakup-compare";

const ON_PAYROLL = new Set(RUN_POPULATION.map((e) => e.code));

const schema = z
  .object({
    employeeCode: z
      .string()
      .trim()
      .toUpperCase()
      .refine((c) => ON_PAYROLL.has(c), "Enter the code of an employee on the India payroll, e.g. STL-0142"),
    newGradeId: z.string().min(1, "Pick a grade"),
    newCtc: z.number({ message: "Enter the revised annual CTC" }).int("Whole rupees only").min(300000, "Below the statutory floor for any grade"),
    effectiveFrom: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
      .refine((d) => d >= "2026-04-01", "Cannot go back before the FY 2026-27 start (1 Apr 2026)")
      .refine((d) => d <= "2027-03-01", "Revisions more than six months out are raised in the next cycle"),
    reason: z.enum(REVISION_REASONS),
    note: z.string().trim().min(10, "Give approvers at least a sentence of context"),
  })
  .refine((v) => (employeeByCode(v.employeeCode)?.ctc ?? 0) < v.newCtc, {
    path: ["newCtc"],
    message: "The revised CTC must be higher than the current CTC",
  });

type Values = z.input<typeof schema>;

export function RevisionFormDialog({
  open,
  onOpenChange,
  nextId,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  nextId: string;
  onCreate: (r: SalaryRevision) => void;
}) {
  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { employeeCode: "", newGradeId: "", newCtc: 0, effectiveFrom: "2026-10-01", reason: "Market correction", note: "" },
  });
  const errors = form.formState.errors;
  const [code, newGradeId, newCtc, effectiveFrom] = useWatch({ control: form.control, name: ["employeeCode", "newGradeId", "newCtc", "effectiveFrom"] });
  const emp = employeeByCode(code.trim().toUpperCase());
  const valid = emp && ON_PAYROLL.has(emp.code);

  // Pre-fill the grade and a 10% CTC the first time a valid employee is entered.
  React.useEffect(() => {
    if (valid && !form.getValues("newGradeId")) {
      form.setValue("newGradeId", emp.gradeId);
      form.setValue("newCtc", Math.round((emp.ctc * 1.1) / 1000) * 1000);
    }
  }, [valid, emp, form]);

  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) form.reset();
  };

  const submit = form.handleSubmit((v) => {
    const e = employeeByCode(v.employeeCode)!;
    onCreate({
      id: nextId,
      employeeCode: e.code,
      name: e.name,
      department: deptName(e.departmentId),
      gradeId: e.gradeId,
      newGradeId: v.newGradeId,
      reason: v.reason as RevisionReason,
      oldCtc: e.ctc,
      newCtc: v.newCtc,
      effectiveFrom: v.effectiveFrom,
      raisedBy: "Rahul Desai",
      raisedOn: "2026-09-16",
      status: "pending_approval",
      decidedBy: null,
      decidedOn: null,
      note: v.note.trim(),
    });
    close(false);
  });

  return (
    <GuardedDialog open={open} onOpenChange={close} dirty={form.formState.isDirty} size="xl">
      <DialogHeader>
        <DialogTitle>New salary revision</DialogTitle>
        <DialogDescription>
          Raised by Payroll, approved by the Finance Controller. A back-dated effective date generates arrears for every
          closed month, paid in the next open run.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit}>
        <DialogBody className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <div className="flex flex-col gap-3.5">
            <Field label="Employee code" htmlFor="rev-emp" required error={errors.employeeCode?.message} hint={valid ? `${emp.name} · ${emp.designation} · ${emp.gradeId}` : undefined}>
              <Input id="rev-emp" placeholder="STL-0142" className="font-mono uppercase" aria-invalid={!!errors.employeeCode} {...form.register("employeeCode")} />
            </Field>
            <Field label="Revised grade" required error={errors.newGradeId?.message}>
              <Controller
                control={form.control}
                name="newGradeId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-label="Revised grade">
                      <SelectValue placeholder="Pick a grade" />
                    </SelectTrigger>
                    <SelectContent>
                      {GRADES.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Revised annual CTC (₹)" htmlFor="rev-ctc" required error={errors.newCtc?.message}>
              <Input id="rev-ctc" type="number" step={1000} className="tnum" aria-invalid={!!errors.newCtc} {...form.register("newCtc", { valueAsNumber: true })} />
            </Field>
            <Field label="Effective from" htmlFor="rev-eff" required error={errors.effectiveFrom?.message}>
              <Input id="rev-eff" type="date" aria-invalid={!!errors.effectiveFrom} {...form.register("effectiveFrom")} />
            </Field>
            <Field label="Reason" required>
              <Controller
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-label="Reason">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REVISION_REASONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Justification" htmlFor="rev-note" required error={errors.note?.message}>
              <Textarea id="rev-note" rows={3} aria-invalid={!!errors.note} {...form.register("note")} />
            </Field>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            {valid && newGradeId && newCtc > 0 ? (
              <>
                <BreakupCompare gradeId={emp.gradeId} oldCtc={emp.ctc} newGradeId={newGradeId} newCtc={newCtc} />
                <h3 className="text-xs font-semibold">Arrears preview</h3>
                <ArrearsPreview gradeId={emp.gradeId} oldCtc={emp.ctc} newGradeId={newGradeId} newCtc={newCtc} effectiveFrom={effectiveFrom} />
              </>
            ) : (
              <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-xs text-muted-foreground">
                Enter an employee code to see the before/after breakup and any arrears.
              </p>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button type="submit">Submit for approval</Button>
        </DialogFooter>
      </form>
    </GuardedDialog>
  );
}
