"use client";

import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
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
import type { AssetCategoryNode } from "@/mock/service";
import { useDirtyGuard } from "./kit";

const schema = z
  .object({
    name: z.string().trim().min(3, "Name the category"),
    parentId: z.string().min(1, "Pick a parent group"),
    method: z.enum(["SLM", "WDV"]),
    rate: z.number({ message: "Enter a rate" }).min(1, "At least 1%").max(100, "At most 100%"),
    usefulLifeYears: z.number({ message: "Enter useful life" }).int().min(1, "At least 1 year").max(30, "At most 30 years"),
    salvagePct: z.number({ message: "Enter salvage" }).min(0, "Cannot be negative").max(20, "Keep salvage at or under 20%"),
  })
  .refine((v) => v.method === "WDV" || Math.abs(v.rate - (100 - v.salvagePct) / v.usefulLifeYears) < 0.5, {
    path: ["rate"],
    message: "For straight-line, rate must equal (100 − salvage) ÷ life",
  });
export type CategoryPolicyValues = z.infer<typeof schema>;

/** Create or edit an asset category and its depreciation policy. */
export function CategoryPolicyDialog({
  open,
  onOpenChange,
  node,
  groups,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  node: AssetCategoryNode | null;
  groups: AssetCategoryNode[];
  onSave: (v: CategoryPolicyValues) => void;
}) {
  const defaults = React.useMemo<CategoryPolicyValues>(
    () => ({
      name: node?.name ?? "",
      parentId: node?.parentId ?? groups[0]?.id ?? "",
      method: node?.method ?? "SLM",
      rate: node?.rate ?? 19,
      usefulLifeYears: node?.usefulLifeYears ?? 5,
      salvagePct: node?.salvagePct ?? 5,
    }),
    [node, groups],
  );
  const { register, handleSubmit, control, reset, formState } = useForm<CategoryPolicyValues>({
    resolver: zodResolver(schema),
    values: defaults,
  });
  const method = useWatch({ control, name: "method" });
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
  const e = formState.errors;

  return (
    <>
      <Dialog open={open} onOpenChange={guarded}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>{node ? `Edit ${node.name}` : "Add asset category"}</DialogTitle>
            <DialogDescription>
              The policy applies to assets capitalised after you save; existing schedules are not restated.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} noValidate>
            <DialogBody className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Category name" htmlFor="cp-name" required error={e.name?.message}>
                <Input id="cp-name" aria-invalid={!!e.name} placeholder="Projectors" {...register("name")} />
              </Field>
              <Field label="Parent group" htmlFor="cp-parent" required error={e.parentId?.message}>
                <Controller
                  control={control}
                  name="parentId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="cp-parent"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Depreciation method" htmlFor="cp-method" required>
                <Controller
                  control={control}
                  name="method"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="cp-method"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SLM">Straight-line (SLM)</SelectItem>
                        <SelectItem value="WDV">Written-down value (WDV)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Annual rate (%)" htmlFor="cp-rate" required error={e.rate?.message} hint={method === "SLM" ? "Derived from life and salvage" : "Applied to opening book value"}>
                <Input id="cp-rate" type="number" step="0.01" className="tnum" aria-invalid={!!e.rate} {...register("rate", { valueAsNumber: true })} />
              </Field>
              <Field label="Useful life (years)" htmlFor="cp-life" required error={e.usefulLifeYears?.message}>
                <Input id="cp-life" type="number" className="tnum" aria-invalid={!!e.usefulLifeYears} {...register("usefulLifeYears", { valueAsNumber: true })} />
              </Field>
              <Field label="Salvage value (%)" htmlFor="cp-salvage" required error={e.salvagePct?.message}>
                <Input id="cp-salvage" type="number" className="tnum" aria-invalid={!!e.salvagePct} {...register("salvagePct", { valueAsNumber: true })} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => guarded(false)}>Cancel</Button>
              <Button type="submit">{node ? "Save policy" : "Add category"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}
