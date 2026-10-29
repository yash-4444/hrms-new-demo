"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { inr } from "@/lib/format";
import { TRAVEL_ADV_RECOVERY_RUNS, travelAdvRecoveryPlan, type TravelAdvRow } from "@/mock/finance-travel";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { Field, Input } from "@/components/ui/primitives";
import { GuardedDialog } from "@/components/finance/kit";

const schema = z
  .object({
    claimRef: z.string().trim(),
    claimAmount: z.number({ message: "Enter 0 if no claim is offset" }).min(0, "Cannot be negative"),
    cashReturned: z.number({ message: "Enter 0 if no cash was returned" }).min(0, "Cannot be negative"),
    instalments: z.number().int().min(1).max(TRAVEL_ADV_RECOVERY_RUNS.length),
  })
  .refine((v) => v.claimAmount + v.cashReturned > 0, {
    path: ["claimAmount"],
    message: "Enter the expense claim offset, the cash returned, or both",
  })
  .refine((v) => v.claimAmount === 0 || /^EXP-\d{4}-\d{3,5}$/.test(v.claimRef), {
    path: ["claimRef"],
    message: "Quote the approved claim, e.g. EXP-2026-0142",
  });

export type SettleValues = z.infer<typeof schema>;

/**
 * Settles an advance: the approved expense claim is offset first, then any
 * cash handed back. A shortfall is recovered through payroll; an excess is
 * reimbursed to the employee with the next expense payout batch.
 */
export function SettleDialog<R extends TravelAdvRow>({
  row,
  onOpenChange,
  onSave,
}: {
  row: R | null;
  onOpenChange: (v: boolean) => void;
  onSave: (row: R, values: SettleValues) => void;
}) {
  const form = useForm<SettleValues>({
    resolver: zodResolver(schema),
    defaultValues: { claimRef: "", claimAmount: 0, cashReturned: 0, instalments: 1 },
  });

  React.useEffect(() => {
    if (row) form.reset({ claimRef: "", claimAmount: 0, cashReturned: 0, instalments: row.outstanding > 10000 ? 2 : 1 });
  }, [row, form]);

  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) form.reset();
  };

  const submit = form.handleSubmit((values) => {
    if (!row) return;
    onSave(row, values);
    close(false);
  });

  const [claim, cash, n] = useWatch({ control: form.control, name: ["claimAmount", "cashReturned", "instalments"] });
  const offset = (Number.isFinite(claim) ? claim : 0) + (Number.isFinite(cash) ? cash : 0);
  const balance = (row?.outstanding ?? 0) - offset;
  const plan = balance > 0 ? travelAdvRecoveryPlan(balance, Number.isFinite(n) ? n : 1) : [];
  const errors = form.formState.errors;

  return (
    <GuardedDialog open={!!row} onOpenChange={close} dirty={form.formState.isDirty} size="md">
      <DialogHeader>
        <DialogTitle>Settle advance {row?.id}</DialogTitle>
        <DialogDescription>
          {row
            ? `${row.employeeName} · ${row.purpose}. Outstanding ${inr(row.outstanding, { decimals: false })} of ${inr(row.issued, { decimals: false })} issued.`
            : null}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit}>
        <DialogBody className="flex flex-col gap-3.5">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Expense claim no." htmlFor="settle-ref" error={errors.claimRef?.message} hint="Required when a claim is offset">
              <Input id="settle-ref" className="font-mono" placeholder="EXP-2026-0142" aria-invalid={!!errors.claimRef} {...form.register("claimRef")} />
            </Field>
            <Field label="Claim amount offset (₹)" htmlFor="settle-claim" error={errors.claimAmount?.message}>
              <Input id="settle-claim" type="number" step={100} className="tnum" aria-invalid={!!errors.claimAmount} {...form.register("claimAmount", { valueAsNumber: true })} />
            </Field>
            <Field label="Cash returned (₹)" htmlFor="settle-cash" error={errors.cashReturned?.message}>
              <Input id="settle-cash" type="number" step={100} className="tnum" aria-invalid={!!errors.cashReturned} {...form.register("cashReturned", { valueAsNumber: true })} />
            </Field>
            <Field
              label="Recover balance over"
              htmlFor="settle-n"
              hint={`1 to ${TRAVEL_ADV_RECOVERY_RUNS.length} monthly pay runs`}
              error={errors.instalments?.message}
            >
              <Input
                id="settle-n"
                type="number"
                min={1}
                max={TRAVEL_ADV_RECOVERY_RUNS.length}
                className="tnum"
                readOnly={balance <= 0}
                aria-disabled={balance <= 0}
                {...form.register("instalments", { valueAsNumber: true })}
              />
            </Field>
          </div>

          <div
            className={cn(
              "rounded-md border px-3 py-2.5 text-xs",
              balance > 0
                ? "border-warning/30 bg-warning-soft text-warning-fg"
                : balance < 0
                  ? "border-info/25 bg-info-soft text-info-fg"
                  : "border-success/25 bg-success-soft text-success-fg",
            )}
            aria-live="polite"
          >
            <p className="tnum font-semibold">
              {inr(row?.outstanding ?? 0, { decimals: false })} outstanding − {inr(offset, { decimals: false })} offset ={" "}
              {inr(balance, { decimals: false })}
            </p>
            {balance > 0 && (
              <ul className="mt-1.5 flex flex-col gap-0.5">
                {plan.map((p) => (
                  <li key={p.runId} className="tnum flex justify-between gap-3">
                    <span>Recovery in the {p.label} pay run</span>
                    <span>{inr(p.amount, { decimals: false })}</span>
                  </li>
                ))}
              </ul>
            )}
            {balance < 0 && (
              <p className="mt-1">
                The claim exceeds the advance — {inr(-balance, { decimals: false })} is reimbursed to the employee with
                the next expense payout batch.
              </p>
            )}
            {balance === 0 && <p className="mt-1">Fully settled — the advance closes with nothing to recover.</p>}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button type="submit">Record settlement</Button>
        </DialogFooter>
      </form>
    </GuardedDialog>
  );
}
