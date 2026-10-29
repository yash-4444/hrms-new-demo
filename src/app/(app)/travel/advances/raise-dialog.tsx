"use client";

import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { fmtDate, inr } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import { TRAVEL_REQUESTS, type TravelRequest } from "@/mock/workplace";
import { Button } from "@/components/ui/button";
import {
  DialogBody,
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
import { Field, Input, Textarea } from "@/components/ui/primitives";
import { GuardedDialog } from "@/components/finance/kit";

/** Approved trips that have not started — the only ones an advance can be raised for. */
const ELIGIBLE: TravelRequest[] = TRAVEL_REQUESTS.filter((t) => t.status === "approved" && t.startDate >= DEMO_TODAY);

export const ADVANCE_MODES = [
  "Bank transfer — salary account",
  "Forex card — Niyo Global",
  "Petty cash — Bengaluru HQ",
] as const;

const schema = z
  .object({
    requestNo: z.string().min(1, "Pick the approved trip this advance is for"),
    amount: z.number({ message: "Enter the advance amount" }).positive("The advance must be above zero"),
    mode: z.string().min(1, "Choose how the money is paid out"),
    note: z.string().trim().max(240, "Keep the note under 240 characters"),
  })
  .superRefine((v, ctx) => {
    const t = ELIGIBLE.find((x) => x.requestNo === v.requestNo);
    if (!t) return;
    const headroom = t.estimatedCost - t.advanceDisbursed;
    if (v.amount > headroom) {
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: `Advances on ${t.requestNo} cannot exceed the trip estimate — at most ${inr(headroom, { decimals: false })} more`,
      });
    }
  });

export type RaiseValues = z.infer<typeof schema>;

/** Raises a top-up advance against an approved trip; it then waits for approval. */
export function RaiseAdvanceDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (trip: TravelRequest, values: RaiseValues) => void;
}) {
  const form = useForm<RaiseValues>({
    resolver: zodResolver(schema),
    defaultValues: { requestNo: "", amount: 0, mode: ADVANCE_MODES[0], note: "" },
  });

  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) form.reset();
  };

  const submit = form.handleSubmit((values) => {
    const trip = ELIGIBLE.find((t) => t.requestNo === values.requestNo);
    if (!trip) return;
    onSave(trip, values);
    close(false);
  });

  const selected = useWatch({ control: form.control, name: "requestNo" });
  const trip = ELIGIBLE.find((t) => t.requestNo === selected);
  const errors = form.formState.errors;

  return (
    <GuardedDialog open={open} onOpenChange={close} dirty={form.formState.isDirty} size="md">
      <DialogHeader>
        <DialogTitle>Raise travel advance</DialogTitle>
        <DialogDescription>
          A top-up against an approved trip. It is disbursed once a finance approver signs it off.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit}>
        <DialogBody className="flex flex-col gap-3.5">
          <Field label="Approved trip" required error={errors.requestNo?.message}>
            <Controller
              control={form.control}
              name="requestNo"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-label="Approved trip" aria-invalid={!!errors.requestNo}>
                    <SelectValue placeholder="Select a trip" />
                  </SelectTrigger>
                  <SelectContent>
                    {ELIGIBLE.map((t) => (
                      <SelectItem key={t.requestNo} value={t.requestNo}>
                        {t.requestNo} · {t.employeeName} · {fmtDate(t.startDate)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          {trip && (
            <p className="tnum rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
              {trip.purpose}. Estimate {inr(trip.estimatedCost, { decimals: false })}, already advanced{" "}
              {inr(trip.advanceDisbursed, { decimals: false })}.
            </p>
          )}
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Amount (₹)" htmlFor="raise-amount" required error={errors.amount?.message}>
              <Input id="raise-amount" type="number" step={500} className="tnum" aria-invalid={!!errors.amount} {...form.register("amount", { valueAsNumber: true })} />
            </Field>
            <Field label="Payout mode" required error={errors.mode?.message}>
              <Controller
                control={form.control}
                name="mode"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-label="Payout mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ADVANCE_MODES.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>
          <Field label="Note for the approver" htmlFor="raise-note" error={errors.note?.message}>
            <Textarea id="raise-note" rows={2} placeholder="Client asked for an extra night in Mumbai…" {...form.register("note")} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button type="submit">Raise advance</Button>
        </DialogFooter>
      </form>
    </GuardedDialog>
  );
}
