"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/primitives";
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
import type { Asset, AssetCondition } from "@/mock/workplace";
import { useDirtyGuard } from "./kit";

const CONDITIONS: AssetCondition[] = ["New", "Excellent", "Good", "Fair", "Needs repair"];
const ACTIVE = EMPLOYEES.filter((e) => e.status !== "exited");

const schema = z.object({
  toCode: z
    .string()
    .trim()
    .min(1, "Pick the employee receiving the asset")
    .refine((c) => !!employeeByCode(c.toUpperCase()), "No active employee with that code"),
  effective: z.string().min(1, "Pick a date").refine((d) => d >= DEMO_TODAY, "Transfer date cannot be in the past"),
  condition: z.enum(["New", "Excellent", "Good", "Fair", "Needs repair"]),
  note: z.string().trim().min(5, "Add a short handover note"),
});
export type TransferValues = z.infer<typeof schema>;

/** Moves an asset to another employee with a recorded handover condition. */
export function AssetTransferDialog({
  open,
  onOpenChange,
  asset,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  asset: Asset;
  onSave: (v: TransferValues) => void;
}) {
  const defaults = React.useMemo<TransferValues>(
    () => ({ toCode: "", effective: DEMO_TODAY, condition: asset.condition, note: "" }),
    [asset.condition],
  );
  const { register, handleSubmit, control, reset, formState } = useForm<TransferValues>({
    resolver: zodResolver(schema),
    values: defaults,
  });

  const close = () => {
    reset(defaults);
    onOpenChange(false);
  };
  const { onOpenChange: guarded, guard } = useDirtyGuard(formState.isDirty, close);

  const submit = handleSubmit((v) => {
    onSave({ ...v, toCode: v.toCode.toUpperCase() });
    reset(defaults);
    onOpenChange(false);
  });

  const listId = React.useId();

  return (
    <>
      <Dialog open={open} onOpenChange={guarded}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Transfer {asset.tag}</DialogTitle>
            <DialogDescription>
              {asset.make} {asset.model}
              {asset.allocatedTo ? ` — currently with ${asset.allocatedToName}.` : " — currently in stock."} The
              receiver acknowledges the handover on their HRMS.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} noValidate>
            <DialogBody className="grid gap-3.5 sm:grid-cols-2">
              <Field
                label="Transfer to (employee code)"
                htmlFor="tr-to"
                required
                error={formState.errors.toCode?.message}
                hint="Type a name or code — e.g. STL-0143"
                className="sm:col-span-2"
              >
                <Input id="tr-to" list={listId} placeholder="STL-0143" aria-invalid={!!formState.errors.toCode} {...register("toCode")} />
              </Field>
              <datalist id={listId}>
                {ACTIVE.filter((e) => e.code !== asset.allocatedTo).map((e) => (
                  <option key={e.code} value={e.code}>
                    {e.name} · {e.designation}
                  </option>
                ))}
              </datalist>
              <Field label="Effective date" htmlFor="tr-date" required error={formState.errors.effective?.message}>
                <Input id="tr-date" type="date" min={DEMO_TODAY} className="tnum" aria-invalid={!!formState.errors.effective} {...register("effective")} />
              </Field>
              <Field label="Condition at handover" htmlFor="tr-cond" required>
                <Controller
                  control={control}
                  name="condition"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="tr-cond">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITIONS.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Handover note" htmlFor="tr-note" required error={formState.errors.note?.message} className="sm:col-span-2">
                <Textarea id="tr-note" placeholder="Charger and sleeve included; data wiped" aria-invalid={!!formState.errors.note} {...register("note")} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => guarded(false)}>
                Cancel
              </Button>
              <Button type="submit">Transfer asset</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}
