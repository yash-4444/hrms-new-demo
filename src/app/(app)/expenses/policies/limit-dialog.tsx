"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { EXP_GRADE_BANDS, type ExpGradeBand, type ExpPolicyLimit } from "@/mock/finance-expense";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { Field, Input, Label, Switch } from "@/components/ui/primitives";
import { GuardedDialog } from "@/components/finance/kit";

/* ============================================================================
   Create / edit one expense category: its cap per grade band and city tier,
   the receipt threshold and whether pre-approval is required.
   ========================================================================== */

const amount = z.number({ error: "Enter an amount" }).int("Whole rupees only").min(0, "Cannot be negative");
const cap = z.number({ error: "Enter a cap" }).int("Whole rupees only").positive("Must be above zero");

const schema = z
  .object({
    category: z.string().trim().min(3, "Name the category"),
    basis: z.string().trim().min(3, "Say what the cap applies to, e.g. per night"),
    receiptAbove: amount,
    preApproval: z.boolean(),
    tiered: z.boolean(),
    g12m: cap,
    g12n: cap,
    g34m: cap,
    g34n: cap,
    g5m: cap,
    g5n: cap,
  })
  .superRefine((v, ctx) => {
    for (const [m, n] of [["g12m", "g12n"], ["g34m", "g34n"], ["g5m", "g5n"]] as const) {
      if (v[n] > v[m]) ctx.addIssue({ code: "custom", path: [n], message: "Non-metro cap cannot exceed metro" });
    }
    if (v.g12m > v.g34m || v.g34m > v.g5m)
      ctx.addIssue({ code: "custom", path: ["g34m"], message: "Caps should rise with the grade band" });
  });

type Values = z.infer<typeof schema>;
const KEYS: Record<ExpGradeBand, ["g12m" | "g34m" | "g5m", "g12n" | "g34n" | "g5n"]> = {
  "G1–G2": ["g12m", "g12n"],
  "G3–G4": ["g34m", "g34n"],
  "G5+": ["g5m", "g5n"],
};

function toValues(p: ExpPolicyLimit | null): Values {
  const l = p?.limits;
  return {
    category: p?.category ?? "",
    basis: p?.basis ?? "",
    receiptAbove: p?.receiptAbove ?? 0,
    preApproval: p?.preApproval ?? false,
    tiered: p?.tiered ?? false,
    g12m: l?.["G1–G2"].metro ?? 0,
    g12n: l?.["G1–G2"].nonMetro ?? 0,
    g34m: l?.["G3–G4"].metro ?? 0,
    g34n: l?.["G3–G4"].nonMetro ?? 0,
    g5m: l?.["G5+"].metro ?? 0,
    g5n: l?.["G5+"].nonMetro ?? 0,
  };
}

export function LimitDialog({
  open,
  policy,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  /** null = create a new category. */
  policy: ExpPolicyLimit | null;
  onOpenChange: (v: boolean) => void;
  onSave: (next: Omit<ExpPolicyLimit, "id" | "updatedOn" | "updatedBy">) => void;
}) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(policy) });
  const { errors } = form.formState;

  React.useEffect(() => {
    if (open) form.reset(toValues(policy));
  }, [open, policy, form]);

  const submit = form.handleSubmit((v) => {
    onSave({
      category: v.category.trim(),
      basis: v.basis.trim(),
      receiptAbove: v.receiptAbove,
      preApproval: v.preApproval,
      tiered: v.tiered,
      limits: {
        "G1–G2": { metro: v.g12m, nonMetro: v.g12n },
        "G3–G4": { metro: v.g34m, nonMetro: v.g34n },
        "G5+": { metro: v.g5m, nonMetro: v.g5n },
      },
    });
    onOpenChange(false);
  });

  return (
    <GuardedDialog open={open} onOpenChange={onOpenChange} dirty={form.formState.isDirty} size="lg">
      <DialogHeader>
        <DialogTitle>{policy ? `Edit ${policy.category}` : "Add expense category"}</DialogTitle>
        <DialogDescription>
          Caps apply per claim line. A line above its cap is flagged to the approver and needs the department head.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit}>
        <DialogBody className="flex flex-col gap-3.5">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Category" htmlFor="pol-cat" required error={errors.category?.message}>
              <Input id="pol-cat" disabled={!!policy} aria-invalid={!!errors.category} {...form.register("category")} />
            </Field>
            <Field label="Cap applies" htmlFor="pol-basis" required error={errors.basis?.message}>
              <Input id="pol-basis" placeholder="per night, metro cities" aria-invalid={!!errors.basis} {...form.register("basis")} />
            </Field>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-xs font-semibold">Cap by grade band and city tier (₹)</legend>
            <div className="grid grid-cols-[80px_1fr_1fr] items-center gap-2 text-[11px] text-muted-foreground">
              <span />
              <span>Metro</span>
              <span>Non-metro</span>
            </div>
            {EXP_GRADE_BANDS.map((b) => {
              const [m, n] = KEYS[b];
              return (
                <div key={b} className="grid grid-cols-[80px_1fr_1fr] items-start gap-2">
                  <Label htmlFor={`pol-${m}`} className="pt-1.5">{b}</Label>
                  <div>
                    <Input id={`pol-${m}`} type="number" className="tnum" aria-label={`${b} metro cap`} aria-invalid={!!errors[m]} {...form.register(m, { valueAsNumber: true })} />
                    {errors[m] && <p role="alert" className="mt-1 text-xs text-destructive-fg">{errors[m]?.message}</p>}
                  </div>
                  <div>
                    <Input id={`pol-${n}`} type="number" className="tnum" aria-label={`${b} non-metro cap`} aria-invalid={!!errors[n]} {...form.register(n, { valueAsNumber: true })} />
                    {errors[n] && <p role="alert" className="mt-1 text-xs text-destructive-fg">{errors[n]?.message}</p>}
                  </div>
                </div>
              );
            })}
          </fieldset>

          <div className="grid gap-3.5 sm:grid-cols-3">
            <Field label="Receipt required above (₹)" htmlFor="pol-rcpt" hint="0 = always required" error={errors.receiptAbove?.message}>
              <Input id="pol-rcpt" type="number" className="tnum" {...form.register("receiptAbove", { valueAsNumber: true })} />
            </Field>
            <Controller
              control={form.control}
              name="tiered"
              render={({ field }) => (
                <label className="flex items-center gap-2 pt-5 text-xs">
                  <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Varies by city tier" />
                  Varies by city tier
                </label>
              )}
            />
            <Controller
              control={form.control}
              name="preApproval"
              render={({ field }) => (
                <label className="flex items-center gap-2 pt-5 text-xs">
                  <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Pre-approval required" />
                  Pre-approval required
                </label>
              )}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit">{policy ? "Save changes" : "Add category"}</Button>
        </DialogFooter>
      </form>
    </GuardedDialog>
  );
}
