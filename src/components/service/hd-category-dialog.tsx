"use client";

import * as React from "react";
import { Controller, useForm, type Control } from "react-hook-form";
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
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from "@/mock/workplace";
import { SLA_POLICIES, type HdCategoryNode } from "@/mock/service";
import { useDirtyGuard } from "./kit";

export const HD_TEAMS = ["IT Service Desk", "People Operations", "Payroll Operations", "Facilities & Admin"];
const RULES = ["Round-robin", "Least-loaded", "Skills-based"];

const schema = z.object({
  name: z.string().trim().min(3, "Name the category"),
  parent: z.string().min(1, "Pick a parent"),
  team: z.string().min(1, "Pick the owning team"),
  defaultPriority: z.enum(["Critical", "High", "Medium", "Low"]),
  slaPolicyId: z.string().min(1, "Map an SLA policy"),
  autoAssign: z.string().min(1, "Pick an assignment rule"),
});
export type HdCategoryValues = z.infer<typeof schema>;

function Pick({ control, name, id, options }: { control: Control<HdCategoryValues>; name: keyof HdCategoryValues; id: string; options: { value: string; label: string }[] }) {
  return (
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
}

/** Create or edit a ticket sub-category: owner, default priority, SLA mapping, routing. */
export function HdCategoryDialog({
  open,
  onOpenChange,
  node,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  node: HdCategoryNode | null;
  onSave: (v: HdCategoryValues) => void;
}) {
  const defaults = React.useMemo<HdCategoryValues>(
    () => ({
      name: node?.name ?? "",
      parent: node?.parent ?? "IT",
      team: node?.team ?? HD_TEAMS[0],
      defaultPriority: node?.defaultPriority ?? "Medium",
      slaPolicyId: node?.slaPolicyId ?? "sla-std",
      autoAssign: node?.autoAssign ?? RULES[0],
    }),
    [node],
  );
  const { register, handleSubmit, control, reset, formState } = useForm<HdCategoryValues>({ resolver: zodResolver(schema), values: defaults });
  const close = () => {
    reset(defaults);
    onOpenChange(false);
  };
  const { onOpenChange: guarded, guard } = useDirtyGuard(formState.isDirty, close);
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
            <DialogTitle>{node ? `Edit ${node.name}` : "Add ticket category"}</DialogTitle>
            <DialogDescription>New tickets in this category are routed and timed by these settings.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} noValidate>
            <DialogBody className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Name" htmlFor="hc-name" required error={formState.errors.name?.message}>
                <Input id="hc-name" placeholder="Laptop & hardware" aria-invalid={!!formState.errors.name} {...register("name")} />
              </Field>
              <Field label="Parent" htmlFor="hc-parent" required>
                <Pick control={control} name="parent" id="hc-parent" options={TICKET_CATEGORIES.map((c) => ({ value: c, label: c }))} />
              </Field>
              <Field label="Owning team" htmlFor="hc-team" required>
                <Pick control={control} name="team" id="hc-team" options={HD_TEAMS.map((t) => ({ value: t, label: t }))} />
              </Field>
              <Field label="Default priority" htmlFor="hc-prio" required>
                <Pick control={control} name="defaultPriority" id="hc-prio" options={TICKET_PRIORITIES.map((p) => ({ value: p, label: p }))} />
              </Field>
              <Field label="SLA policy" htmlFor="hc-sla" required>
                <Pick control={control} name="slaPolicyId" id="hc-sla" options={SLA_POLICIES.map((p) => ({ value: p.id, label: p.name }))} />
              </Field>
              <Field label="Assignment rule" htmlFor="hc-rule" required>
                <Pick control={control} name="autoAssign" id="hc-rule" options={RULES.map((r) => ({ value: r, label: r }))} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => guarded(false)}>Cancel</Button>
              <Button type="submit">{node ? "Save category" : "Add category"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}
