"use client";

/* Nominate one or more employees for a training session (RHF + Zod, dirty guard). */

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserPlus } from "lucide-react";
import { fmtDay } from "@/lib/format";
import { EMPLOYEES, employeeName } from "@/mock/employees";
import { courseById } from "@/mock/growth";
import { DEMO_TODAY } from "@/mock/org";
import type { TrainingSession } from "@/mock/engage";
import { useDirtyGuard } from "@/components/engage/kit";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Textarea } from "@/components/ui/primitives";
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

const schema = z.object({
  sessionId: z.string().min(1, "Choose a session"),
  employees: z.array(z.string()).min(1, "Pick at least one person"),
  reason: z.string().trim().min(10, "Say why in a sentence — managers see this when approving"),
});
export type NominateValues = z.infer<typeof schema>;

export function NominateDialog({
  open,
  onOpenChange,
  sessions,
  candidates,
  onNominate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sessions: TrainingSession[];
  /** Employee codes the persona may nominate (own team for managers, anyone for HR). */
  candidates: string[];
  onNominate: (v: NominateValues) => void;
}) {
  const form = useForm<NominateValues>({
    resolver: zodResolver(schema),
    defaultValues: { sessionId: "", employees: [], reason: "" },
  });
  const close = () => {
    onOpenChange(false);
    form.reset();
  };
  const { onOpenChange: guarded, guard } = useDirtyGuard(form.formState.isDirty, close);
  const errors = form.formState.errors;
  const upcoming = sessions.filter((s) => s.date >= DEMO_TODAY);
  const people = candidates
    .map((c) => EMPLOYEES.find((e) => e.code === c))
    .filter((e) => e !== undefined)
    .slice(0, 40);

  return (
    <>
      <Dialog open={open} onOpenChange={guarded}>
        <DialogContent size="md">
          <form
            noValidate
            onSubmit={form.handleSubmit((v) => {
              onNominate(v);
              close();
            })}
          >
            <DialogHeader>
              <DialogTitle>Nominate for training</DialogTitle>
              <DialogDescription>Nominees go to their manager for approval. Full sessions put them on the waitlist in order.</DialogDescription>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-3">
              <Field label="Session" required error={errors.sessionId?.message}>
                <Controller
                  control={form.control}
                  name="sessionId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-label="Session" aria-invalid={!!errors.sessionId}>
                        <SelectValue placeholder="Choose an upcoming session" />
                      </SelectTrigger>
                      <SelectContent>
                        {upcoming.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {fmtDay(s.date)} · {courseById(s.courseId)?.title} ({s.attendees.length}/{s.capacity})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="People" required error={errors.employees?.message}>
                <Controller
                  control={form.control}
                  name="employees"
                  render={({ field }) => (
                    <ul className="max-h-48 overflow-y-auto rounded-md border border-border" aria-label="People to nominate">
                      {people.map((e) => {
                        const checked = field.value.includes(e.code);
                        return (
                          <li key={e.code} className="flex items-center gap-2 border-b border-border px-2.5 py-1.5 text-xs last:border-0">
                            <Checkbox
                              id={`nom-${e.code}`}
                              checked={checked}
                              onCheckedChange={(v) =>
                                field.onChange(v === true ? [...field.value, e.code] : field.value.filter((c) => c !== e.code))
                              }
                            />
                            <label htmlFor={`nom-${e.code}`} className="flex-1 truncate">
                              {employeeName(e.code)} <span className="text-muted-foreground">· {e.designation}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                />
              </Field>
              <Field label="Why this training?" htmlFor="nom-reason" required error={errors.reason?.message}>
                <Textarea id="nom-reason" rows={3} placeholder="Closes the Kubernetes gap flagged in the skill matrix." {...form.register("reason")} aria-invalid={!!errors.reason} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => guarded(false)}>Cancel</Button>
              <Button type="submit"><UserPlus /> Nominate</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}
