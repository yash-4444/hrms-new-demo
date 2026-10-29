"use client";

import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input, Label, RadioGroup, RadioGroupItem, Textarea } from "@/components/ui/primitives";
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
import { EMPLOYEES, employeeByCode } from "@/mock/employees";
import { DEMO_TODAY } from "@/mock/org";
import { SEPARATION_REASONS, computeLwd, noticeDaysFor, type Separation, type SeparationType } from "@/mock/lifecycle";
import { useDirtyGuard } from "./kit";

const schema = z
  .object({
    code: z.string().min(1, "Choose the employee"),
    type: z.enum(["voluntary", "involuntary", "retirement"]),
    reasonCode: z.string().min(1, "Choose a reason"),
    initiatedOn: z.string().min(1, "Pick the date").refine((d) => d <= DEMO_TODAY, "Cannot be in the future"),
    requestedLwd: z.string().optional(),
    comment: z.string().trim().min(10, "Add a short note for the record"),
  })
  .refine((v) => !v.requestedLwd || v.requestedLwd > v.initiatedOn, { path: ["requestedLwd"], message: "Must be after the initiation date" });
type Values = z.infer<typeof schema>;

const ELIGIBLE = EMPLOYEES.filter((e) => e.status === "active" || e.status === "probation").sort((a, b) => a.name.localeCompare(b.name));

const reasonsFor = (type: SeparationType) =>
  SEPARATION_REASONS.filter((r) => (type === "involuntary" ? r.tag === "Involuntary" : type === "voluntary" ? r.tag !== "Involuntary" : r.code === "PERSONAL"));

export function InitiateSeparationDialog({
  open,
  onOpenChange,
  existingCodes,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingCodes: Set<string>;
  onCreate: (s: Separation) => void;
}) {
  const defaults: Values = { code: "", type: "voluntary", reasonCode: "", initiatedOn: DEMO_TODAY, requestedLwd: "", comment: "" };
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });
  const { errors, isDirty } = form.formState;
  const close = () => {
    form.reset(defaults);
    onOpenChange(false);
  };
  const { onOpenChange: guarded, guard } = useDirtyGuard(isDirty, close);
  const [code, type, initiatedOn, requestedLwd] = useWatch({ control: form.control, name: ["code", "type", "initiatedOn", "requestedLwd"] });

  const emp = employeeByCode(code);
  const notice = emp ? (type === "retirement" ? 90 : noticeDaysFor(emp.gradeId, type)) : 0;
  const fullLwd = emp ? computeLwd(initiatedOn, notice, 0, 0) : null;
  const shortfall = fullLwd && requestedLwd && requestedLwd < fullLwd ? differenceInCalendarDays(parseISO(fullLwd), parseISO(requestedLwd)) : 0;
  const lwd = emp ? computeLwd(initiatedOn, notice, 0, shortfall) : null;

  const submit = form.handleSubmit((v) => {
    const e = employeeByCode(v.code)!;
    onCreate({
      id: `SEP-2026-${String(41 + existingCodes.size).padStart(3, "0")}`,
      code: e.code, name: e.name, designation: e.designation, departmentId: e.departmentId, branchId: e.branchId, gradeId: e.gradeId,
      ctc: e.ctc, joiningDate: e.joiningDate, managerCode: e.managerCode ?? "STL-0009", type: v.type, reasonCode: v.reasonCode,
      reasonDetail: v.comment, regretted: v.type === "voluntary" && (SEPARATION_REASONS.find((r) => r.code === v.reasonCode)?.regretted ?? false),
      initiatedOn: v.initiatedOn, noticeDays: notice, waivedDays: 0, buyoutDays: shortfall, lwd: lwd!,
      status: v.type === "voluntary" ? "pending_manager" : "serving_notice",
      managerApprovedOn: v.type === "voluntary" ? null : DEMO_TODAY, hrApprovedOn: v.type === "voluntary" ? null : DEMO_TODAY,
      former: false, recoveries: [],
    });
    form.reset(defaults);
    onOpenChange(false);
  });

  return (
    <>
      <Dialog open={open} onOpenChange={guarded}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Initiate separation</DialogTitle>
            <DialogDescription>Records a resignation, termination or retirement. The last working day is computed from the contractual notice period.</DialogDescription>
          </DialogHeader>
          <form noValidate onSubmit={submit}>
            <DialogBody className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Employee" htmlFor="is-emp" required error={errors.code?.message} className="sm:col-span-2">
                <Controller
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="is-emp" aria-invalid={!!errors.code}>
                        <SelectValue placeholder="Choose an active employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {ELIGIBLE.filter((e) => !existingCodes.has(e.code)).map((e) => (
                          <SelectItem key={e.code} value={e.code}>
                            {e.name} · {e.code} · {e.designation}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Type" required className="sm:col-span-2">
                <Controller
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <RadioGroup
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        form.setValue("reasonCode", v === "retirement" ? "PERSONAL" : "", { shouldDirty: true });
                      }}
                      className="flex flex-wrap gap-4"
                    >
                      {(["voluntary", "involuntary", "retirement"] as const).map((t) => (
                        <span key={t} className="flex items-center gap-1.5">
                          <RadioGroupItem id={`is-t-${t}`} value={t} />
                          <Label htmlFor={`is-t-${t}`} className="capitalize">
                            {t === "voluntary" ? "Voluntary (resignation)" : t === "involuntary" ? "Involuntary (termination)" : "Retirement"}
                          </Label>
                        </span>
                      ))}
                    </RadioGroup>
                  )}
                />
              </Field>
              <Field label="Reason" htmlFor="is-reason" required error={errors.reasonCode?.message}>
                <Controller
                  control={form.control}
                  name="reasonCode"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={type === "retirement"}>
                      <SelectTrigger id="is-reason" aria-invalid={!!errors.reasonCode}>
                        <SelectValue placeholder="Separation reason" />
                      </SelectTrigger>
                      <SelectContent>
                        {reasonsFor(type).map((r) => (
                          <SelectItem key={r.code} value={r.code}>
                            {type === "retirement" ? "Superannuation" : `${r.label} · ${r.tag}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label={type === "voluntary" ? "Resignation date" : "Notice served on"} htmlFor="is-date" required error={errors.initiatedOn?.message}>
                <Input id="is-date" type="date" max={DEMO_TODAY} className="tnum" aria-invalid={!!errors.initiatedOn} {...form.register("initiatedOn")} />
              </Field>
              <Field label="Requested last working day" htmlFor="is-lwd" error={errors.requestedLwd?.message} hint="Optional. Earlier than the notice end creates a buyout, recovered in F&F.">
                <Input id="is-lwd" type="date" className="tnum" aria-invalid={!!errors.requestedLwd} {...form.register("requestedLwd")} />
              </Field>
              <div className="flex items-end">
                {emp && lwd ? (
                  <Alert tone={shortfall ? "warning" : "info"} title={`Last working day ${fmtDate(lwd)}`} className="w-full">
                    {emp.gradeId} · {notice} days&apos; notice{shortfall ? ` · ${shortfall} days buyout` : ""}
                  </Alert>
                ) : (
                  <p className="text-xs text-muted-foreground">Pick an employee to compute the notice period.</p>
                )}
              </div>
              <Field label="Comments" htmlFor="is-comment" required error={errors.comment?.message} className="sm:col-span-2">
                <Textarea id="is-comment" aria-invalid={!!errors.comment} placeholder="Context for the approvers — recorded in the audit trail." {...form.register("comment")} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => guarded(false)}>
                Cancel
              </Button>
              <Button type="submit">Initiate separation</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}
