"use client";

/* Three-step "Create improvement plan" wizard. */

import * as React from "react";
import { useFieldArray, useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import type { Pip } from "@/mock/engage";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input, Textarea } from "@/components/ui/primitives";
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/overlays";
import { nameOf, personLine, useDirtyGuard } from "./kit";

const schema = z
  .object({
    employeeCode: z.string().min(1, "Choose the employee"),
    startDate: z.string().min(1, "Pick a start date").refine((d) => d >= DEMO_TODAY, "Start can't be in the past"),
    endDate: z.string().min(1, "Pick an end date"),
    reason: z.string().trim().min(30, "Describe the gap with evidence — at least 30 characters"),
    milestones: z
      .array(z.object({ title: z.string().trim().min(3, "Name the milestone"), measure: z.string().trim().min(5, "How will it be measured?"), dueOn: z.string().min(1, "Due date") }))
      .min(2, "A plan needs at least 2 measurable milestones"),
  })
  .refine((v) => v.endDate > v.startDate, { path: ["endDate"], message: "End must be after start" })
  .refine((v) => !v.startDate || !v.endDate || (Date.parse(v.endDate) - Date.parse(v.startDate)) / 86400000 >= 30, { path: ["endDate"], message: "Plans run at least 30 days" });
type Values = z.infer<typeof schema>;

const STEPS = ["Employee & reason", "Milestones", "Review"];

export function CreatePipWizard({
  open,
  onOpenChange,
  candidates,
  managerCode,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  candidates: string[];
  managerCode: (employeeCode: string) => string;
  onCreate: (p: Omit<Pip, "id">) => void;
}) {
  const [step, setStep] = React.useState(0);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeCode: "",
      startDate: "2026-09-21",
      endDate: "2026-12-19",
      reason: "",
      milestones: [
        { title: "", measure: "", dueOn: "2026-10-31" },
        { title: "", measure: "", dueOn: "2026-11-30" },
      ],
    },
  });
  const ms = useFieldArray({ control: form.control, name: "milestones" });
  const errors = form.formState.errors;
  const close = () => {
    onOpenChange(false);
    setStep(0);
    form.reset();
  };
  const { onOpenChange: guarded, guard } = useDirtyGuard(form.formState.isDirty, close);

  const next = async () => {
    const ok = await form.trigger(step === 0 ? ["employeeCode", "startDate", "endDate", "reason"] : ["milestones"]);
    if (ok) setStep((s) => s + 1);
  };

  const submit = form.handleSubmit((v) => {
    onCreate({
      employeeCode: v.employeeCode,
      managerCode: managerCode(v.employeeCode),
      hrCode: "STL-0009",
      startDate: v.startDate,
      endDate: v.endDate,
      reason: v.reason,
      status: "active",
      milestones: v.milestones.map((m, i) => ({ id: `M${i + 1}`, ...m, status: "not_started" as const })),
      checkIns: [],
      outcome: null,
    });
    close();
  });

  const v = useWatch({ control: form.control }) as Values;

  return (
    <>
      <Dialog open={open} onOpenChange={guarded}>
        <DialogContent size="lg">
          <form onSubmit={submit} noValidate>
            <DialogHeader>
              <DialogTitle>Create improvement plan</DialogTitle>
              <DialogDescription>
                Step {step + 1} of 3 — {STEPS[step]}. The employee sees the plan only after it is shared in a meeting with HR present.
              </DialogDescription>
              <ol className="mt-2 flex gap-1.5" aria-label="Progress">
                {STEPS.map((s, i) => (
                  <li key={s} aria-current={i === step ? "step" : undefined} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")}>
                    <span className="sr-only">{s}</span>
                  </li>
                ))}
              </ol>
            </DialogHeader>
            <DialogBody className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
              {step === 0 && (
                <>
                  <Field label="Employee" htmlFor="pip-emp" required error={errors.employeeCode?.message}>
                    <Controller control={form.control} name="employeeCode" render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="pip-emp" aria-invalid={!!errors.employeeCode}><SelectValue placeholder="Choose an employee" /></SelectTrigger>
                        <SelectContent>
                          {candidates.map((c) => <SelectItem key={c} value={c}>{nameOf(c)} — {personLine(c)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Start" htmlFor="pip-start" required error={errors.startDate?.message}>
                      <Input id="pip-start" type="date" min={DEMO_TODAY} {...form.register("startDate")} />
                    </Field>
                    <Field label="End" htmlFor="pip-end" required error={errors.endDate?.message} hint="Typically 60–90 days">
                      <Input id="pip-end" type="date" {...form.register("endDate")} />
                    </Field>
                  </div>
                  <Field label="Performance gap and evidence" htmlFor="pip-reason" required error={errors.reason?.message} hint="Facts, dates and measures — not adjectives.">
                    <Textarea id="pip-reason" rows={4} {...form.register("reason")} />
                  </Field>
                </>
              )}
              {step === 1 && (
                <>
                  {ms.fields.map((f, i) => (
                    <div key={f.id} className="grid grid-cols-1 gap-2 rounded-md border border-border p-2.5 sm:grid-cols-[1fr_1fr_140px_auto]">
                      <Field label={`Milestone ${i + 1}`} htmlFor={`ms-t-${i}`} error={errors.milestones?.[i]?.title?.message}>
                        <Input id={`ms-t-${i}`} {...form.register(`milestones.${i}.title`)} />
                      </Field>
                      <Field label="Measure" htmlFor={`ms-m-${i}`} error={errors.milestones?.[i]?.measure?.message}>
                        <Input id={`ms-m-${i}`} {...form.register(`milestones.${i}.measure`)} />
                      </Field>
                      <Field label="Due" htmlFor={`ms-d-${i}`} error={errors.milestones?.[i]?.dueOn?.message}>
                        <Input id={`ms-d-${i}`} type="date" {...form.register(`milestones.${i}.dueOn`)} />
                      </Field>
                      <Button type="button" variant="ghost" size="icon-sm" className="self-end" aria-label={`Remove milestone ${i + 1}`} onClick={() => ms.remove(i)} disabled={ms.fields.length <= 1}>
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                  {errors.milestones?.root?.message && <p role="alert" className="text-xs text-destructive-fg">{errors.milestones.root.message}</p>}
                  {errors.milestones?.message && <p role="alert" className="text-xs text-destructive-fg">{errors.milestones.message}</p>}
                  <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => ms.append({ title: "", measure: "", dueOn: v.endDate })} disabled={ms.fields.length >= 5}>
                    <Plus /> Add milestone
                  </Button>
                </>
              )}
              {step === 2 && (
                <>
                  <Alert tone="warning" title="Check before you create">
                    A plan is a formal step. Make sure the gap was raised in at least two prior 1:1s and that support (training, pairing) is offered alongside it.
                  </Alert>
                  <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1.5 text-xs">
                    <dt className="text-muted-foreground">Employee</dt><dd>{nameOf(v.employeeCode)}</dd>
                    <dt className="text-muted-foreground">Window</dt><dd>{v.startDate && fmtDate(v.startDate)} → {v.endDate && fmtDate(v.endDate)}</dd>
                    <dt className="text-muted-foreground">Gap</dt><dd>{v.reason}</dd>
                    <dt className="text-muted-foreground">Milestones</dt>
                    <dd><ul className="list-disc pl-4">{v.milestones.map((m, i) => <li key={i}>{m.title} — {m.measure} (due {m.dueOn && fmtDate(m.dueOn)})</li>)}</ul></dd>
                  </dl>
                </>
              )}
            </DialogBody>
            <DialogFooter>
              {step > 0 ? <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>Back</Button> : <Button type="button" variant="outline" onClick={() => guarded(false)}>Cancel</Button>}
              {step < 2 ? <Button type="button" onClick={next}>Continue</Button> : <Button type="submit">Create plan</Button>}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}
