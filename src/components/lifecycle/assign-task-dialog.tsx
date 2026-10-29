"use client";

import * as React from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
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
import { ASSIGNEE_OPTIONS, TASK_OWNERS, type OnboardingTask, type TaskOwner } from "@/mock/lifecycle";
import { DEMO_TODAY } from "@/mock/org";
import { useDirtyGuard } from "./kit";

const schema = z.object({
  title: z.string().trim().min(6, "Describe the task in a few words"),
  owner: z.enum(["HR", "IT", "Manager", "Finance", "Employee"]),
  assigneeCode: z.string().min(1, "Pick who owns it"),
  due: z.string().min(1, "Pick a due date").refine((d) => d >= DEMO_TODAY, "Due date cannot be in the past"),
  slaHours: z.number({ message: "Enter SLA hours" }).int().min(1, "At least 1 hour").max(240, "Keep SLAs under 10 days"),
});
type Values = z.infer<typeof schema>;

/**
 * Adds (or re-assigns) a task on one joiner's checklist. Passing `task`
 * opens it in re-assign mode with the title locked.
 */
export function AssignTaskDialog({
  open,
  onOpenChange,
  joinerName,
  joinerCode,
  managerCode,
  task,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  joinerName: string;
  joinerCode: string | null;
  managerCode: string;
  task?: OnboardingTask | null;
  onSave: (v: Values) => void;
}) {
  const defaults = React.useMemo<Values>(
    () => ({
      title: task?.title ?? "",
      owner: task?.owner ?? "HR",
      assigneeCode: task?.assigneeCode ?? "STL-0305",
      due: task?.due && task.due >= DEMO_TODAY ? task.due : DEMO_TODAY,
      slaHours: task?.slaHours ?? 24,
    }),
    [task],
  );
  const form = useForm<Values>({ resolver: zodResolver(schema), values: defaults });
  const { register, handleSubmit, control, reset, setValue, formState } = form;
  const owner = useWatch({ control, name: "owner" });

  const close = () => {
    reset(defaults);
    onOpenChange(false);
  };
  const { onOpenChange: guarded, guard } = useDirtyGuard(formState.isDirty, close);

  /* Manager / Employee tasks have exactly one possible owner. */
  const fixedAssignee = owner === "Manager" ? managerCode : owner === "Employee" ? joinerCode : null;
  const onOwner = (v: TaskOwner) => {
    setValue("owner", v, { shouldDirty: true });
    if (v === "Manager") setValue("assigneeCode", managerCode, { shouldDirty: true });
    else if (v === "Employee") setValue("assigneeCode", joinerCode ?? "joiner", { shouldDirty: true });
    else setValue("assigneeCode", v === "IT" ? "STL-0314" : v === "Finance" ? "STL-0017" : "STL-0305", { shouldDirty: true });
  };

  const submit = handleSubmit((v) => {
    onSave(v);
    reset(v);
    onOpenChange(false);
  });

  return (
    <>
      <Dialog open={open} onOpenChange={guarded}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>{task ? "Re-assign task" : "Assign a task"}</DialogTitle>
            <DialogDescription>
              {task ? `${task.title} — for ${joinerName}.` : `Adds a task to ${joinerName}'s onboarding checklist.`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} noValidate>
            <DialogBody className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Task" htmlFor="at-title" required error={formState.errors.title?.message} className="sm:col-span-2">
                <Input id="at-title" disabled={!!task} aria-invalid={!!formState.errors.title} placeholder="Book a meet-the-team lunch" {...register("title")} />
              </Field>
              <Field label="Owner group" htmlFor="at-owner" required>
                <Select value={owner} onValueChange={(v) => onOwner(v as TaskOwner)}>
                  <SelectTrigger id="at-owner">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_OWNERS.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Assignee" htmlFor="at-assignee" required error={formState.errors.assigneeCode?.message}>
                {fixedAssignee !== null ? (
                  <Input id="at-assignee" disabled value={owner === "Manager" ? "Reporting manager" : joinerName} />
                ) : (
                  <Controller
                    control={control}
                    name="assigneeCode"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="at-assignee" aria-invalid={!!formState.errors.assigneeCode}>
                          <SelectValue placeholder="Choose a person" />
                        </SelectTrigger>
                        <SelectContent>
                          {ASSIGNEE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                )}
              </Field>
              <Field label="Due date" htmlFor="at-due" required error={formState.errors.due?.message}>
                <Input id="at-due" type="date" min={DEMO_TODAY} className="tnum" aria-invalid={!!formState.errors.due} {...register("due")} />
              </Field>
              <Field label="SLA (hours)" htmlFor="at-sla" required error={formState.errors.slaHours?.message} hint="Escalates to the owner's lead one day after breach.">
                <Input id="at-sla" type="number" min={1} className="tnum" aria-invalid={!!formState.errors.slaHours} {...register("slaHours", { valueAsNumber: true })} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => guarded(false)}>
                Cancel
              </Button>
              <Button type="submit">{task ? "Re-assign" : "Assign task"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}

export type AssignTaskValues = Values;
