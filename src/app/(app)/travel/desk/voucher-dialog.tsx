"use client";

import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, inr } from "@/lib/format";
import { TRAVEL_DESK_VENDORS, type TravelDeskItem } from "@/mock/finance-travel";
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
import { Field, Input } from "@/components/ui/primitives";
import { GuardedDialog } from "@/components/finance/kit";

const schema = z.object({
  vendor: z.string().min(1, "Pick the agency or hotel that issued the booking"),
  bookingRef: z
    .string()
    .trim()
    .min(4, "Enter the PNR or confirmation number")
    .max(24, "A booking reference is at most 24 characters")
    .regex(/^[A-Za-z0-9-]+$/, "Letters, digits and hyphens only"),
  actual: z.number({ message: "Enter the invoiced amount" }).positive("The invoiced amount must be above zero"),
  fileName: z
    .string()
    .trim()
    .min(1, "Attach the e-ticket or hotel voucher")
    .regex(/\.(pdf|png|jpe?g)$/i, "Upload a PDF, PNG or JPG file"),
});

export type VoucherValues = z.infer<typeof schema>;

/**
 * Records the booking against a desk item: vendor, PNR, invoiced cost and the
 * voucher file. The variance against the request estimate updates live.
 */
export function VoucherDialog({
  item,
  onOpenChange,
  onSave,
}: {
  item: TravelDeskItem | null;
  onOpenChange: (v: boolean) => void;
  onSave: (item: TravelDeskItem, values: VoucherValues) => void;
}) {
  const form = useForm<VoucherValues>({
    resolver: zodResolver(schema),
    defaultValues: { vendor: "", bookingRef: "", actual: 0, fileName: "" },
  });

  React.useEffect(() => {
    if (!item) return;
    form.reset({
      vendor: item.vendor ?? "",
      bookingRef: item.bookingRef ?? "",
      actual: item.actual ?? item.estimate,
      fileName: item.voucher ?? "",
    });
  }, [item, form]);

  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) form.reset();
  };

  const submit = form.handleSubmit((values) => {
    if (!item) return;
    onSave(item, values);
    close(false);
  });

  const actual = useWatch({ control: form.control, name: "actual" });
  const variance = item && Number.isFinite(actual) ? actual - item.estimate : 0;
  const vendors = item?.kind === "Hotel" ? TRAVEL_DESK_VENDORS.Hotel : TRAVEL_DESK_VENDORS.transport;
  const errors = form.formState.errors;

  return (
    <GuardedDialog open={!!item} onOpenChange={close} dirty={form.formState.isDirty} size="md">
      <DialogHeader>
        <DialogTitle>{item?.stage === "booking_pending" ? "Book and attach voucher" : "Attach ticket"}</DialogTitle>
        <DialogDescription>
          {item ? (
            <>
              {item.requestNo} · {item.employeeName} · {item.description} on {fmtDate(item.travelDate)}
            </>
          ) : null}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit}>
        <DialogBody className="flex flex-col gap-3.5">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Vendor" required error={errors.vendor?.message}>
              <Controller
                control={form.control}
                name="vendor"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-label="Vendor" aria-invalid={!!errors.vendor}>
                      <SelectValue placeholder="Select a vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field
              label={item?.kind === "Hotel" ? "Confirmation no." : "PNR / booking ref"}
              htmlFor="desk-ref"
              required
              error={errors.bookingRef?.message}
            >
              <Input
                id="desk-ref"
                className="font-mono"
                placeholder={item?.kind === "Hotel" ? "HTL-482913" : "PNR-K7Q2ZD"}
                aria-invalid={!!errors.bookingRef}
                {...form.register("bookingRef")}
              />
            </Field>
          </div>
          <Field
            label="Invoiced cost (₹)"
            htmlFor="desk-actual"
            required
            error={errors.actual?.message}
            hint={item ? `Estimate on the request: ${inr(item.estimate, { decimals: false })}` : undefined}
          >
            <Input
              id="desk-actual"
              type="number"
              step={50}
              className="tnum"
              aria-invalid={!!errors.actual}
              {...form.register("actual", { valueAsNumber: true })}
            />
          </Field>
          {item && (
            <p
              className={cn(
                "tnum rounded-md border px-3 py-2 text-xs",
                variance > 0
                  ? "border-warning/30 bg-warning-soft text-warning-fg"
                  : "border-success/25 bg-success-soft text-success-fg",
              )}
            >
              Variance vs estimate: {variance > 0 ? "+" : ""}
              {inr(variance, { decimals: false })} (
              {item.estimate ? `${variance > 0 ? "+" : ""}${((variance / item.estimate) * 100).toFixed(1)}%` : "—"})
              {variance > item.estimate * 0.1 && " · above the 10% tolerance — the request owner is notified."}
            </p>
          )}
          <Field
            label="Ticket / voucher file"
            htmlFor="desk-file"
            required
            error={errors.fileName?.message}
            hint="PDF, PNG or JPG — stored against the travel request."
          >
            <div className="flex items-center gap-2">
              <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <Input
                id="desk-file"
                placeholder="PNR-K7Q2ZD-e-ticket.pdf"
                aria-invalid={!!errors.fileName}
                {...form.register("fileName")}
              />
            </div>
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button type="submit">Save booking</Button>
        </DialogFooter>
      </form>
    </GuardedDialog>
  );
}
