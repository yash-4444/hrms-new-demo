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
import { BUSINESS_CALENDARS, type SlaPolicy } from "@/mock/service";
import { useDirtyGuard } from "./kit";

const target = z
  .object({
    priority: z.string(),
    firstResponseHrs: z.number({ message: "Enter hours" }).min(0.5, "At least 30 minutes").max(240, "Too long"),
    resolutionHrs: z.number({ message: "Enter hours" }).min(1, "At least 1 hour").max(720, "Too long"),
  })
  .refine((t) => t.resolutionHrs > t.firstResponseHrs, { path: ["resolutionHrs"], message: "Must exceed first response" });

const schema = z.object({
  calendarId: z.string().min(1, "Pick a calendar"),
  targets: z.array(target).min(1),
});
export type SlaPolicyValues = z.infer<typeof schema>;

/** Edits one SLA policy's business-hours calendar and per-priority targets. */
export function SlaPolicyDialog({
  policy,
  onOpenChange,
  onSave,
}: {
  policy: SlaPolicy | null;
  onOpenChange: (v: boolean) => void;
  onSave: (id: string, v: SlaPolicyValues) => void;
}) {
  const defaults = React.useMemo<SlaPolicyValues>(
    () => ({ calendarId: policy?.calendarId ?? "cal-in", targets: policy?.targets.map((t) => ({ ...t })) ?? [] }),
    [policy],
  );
  const { register, handleSubmit, control, reset, formState } = useForm<SlaPolicyValues>({ resolver: zodResolver(schema), values: defaults });
  const close = () => {
    reset(defaults);
    onOpenChange(false);
  };
  const { onOpenChange: guarded, guard } = useDirtyGuard(formState.isDirty, close);
  const submit = handleSubmit((v) => {
    if (policy) onSave(policy.id, v);
    reset(v);
    onOpenChange(false);
  });
  const errs = formState.errors.targets;

  return (
    <>
      <Dialog open={!!policy} onOpenChange={guarded}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Edit {policy?.name}</DialogTitle>
            <DialogDescription>Changes apply to tickets raised after you save. Open tickets keep the target they were stamped with.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} noValidate>
            <DialogBody className="flex flex-col gap-3.5">
              <Field label="Business hours calendar" htmlFor="sla-cal" required>
                <Controller
                  control={control}
                  name="calendarId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="sla-cal"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {BUSINESS_CALENDARS.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} · {c.hours}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <div className="grid grid-cols-[6rem_1fr_1fr] items-start gap-x-3 gap-y-2">
                <span className="text-xs font-medium text-muted-foreground">Priority</span>
                <span className="text-xs font-medium text-muted-foreground">First response (h)</span>
                <span className="text-xs font-medium text-muted-foreground">Resolution (h)</span>
                {defaults.targets.map((t, i) => (
                  <React.Fragment key={t.priority}>
                    <span className="pt-1.5 text-xs font-medium">{t.priority}</span>
                    <Field label={`${t.priority} first response`} htmlFor={`sla-frt-${i}`} error={errs?.[i]?.firstResponseHrs?.message} className="[&>label]:sr-only">
                      <Input id={`sla-frt-${i}`} type="number" step="0.5" className="tnum" aria-invalid={!!errs?.[i]?.firstResponseHrs} {...register(`targets.${i}.firstResponseHrs`, { valueAsNumber: true })} />
                    </Field>
                    <Field label={`${t.priority} resolution`} htmlFor={`sla-res-${i}`} error={errs?.[i]?.resolutionHrs?.message} className="[&>label]:sr-only">
                      <Input id={`sla-res-${i}`} type="number" step="1" className="tnum" aria-invalid={!!errs?.[i]?.resolutionHrs} {...register(`targets.${i}.resolutionHrs`, { valueAsNumber: true })} />
                    </Field>
                  </React.Fragment>
                ))}
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => guarded(false)}>Cancel</Button>
              <Button type="submit">Save policy</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}
