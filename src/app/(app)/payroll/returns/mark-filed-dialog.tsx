"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { fmtDate, inr } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import { RETURN_FORM_META, type ReturnFiling } from "@/mock/finance-statutory";
import { GuardedDialog } from "@/components/finance/kit";
import { Button } from "@/components/ui/button";
import {
  ConfirmDialog,
  DialogBody,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/overlays";
import { Field, Input, Textarea } from "@/components/ui/primitives";

/* ============================================================================
   Mark filed — capture the portal's acknowledgement, then confirm. Filing is
   irreversible on the portal, so the record is locked once confirmed.
   ========================================================================== */

const ACK_HINT: Record<ReturnFiling["form"], string> = {
  ECR: "TRRN from the EPFO unified portal (13 digits)",
  ESI: "Challan number from the ESIC portal",
  PT: "Payment receipt / acknowledgement from the state portal",
  "24Q": "Provisional receipt token number (15 digits)",
  FORM16: "TRACES request number for the Part A download",
  "12BA": "Internal issue reference",
};

const schema = z.object({
  ackNo: z
    .string()
    .trim()
    .min(8, "Enter the acknowledgement number exactly as the portal shows it")
    .regex(/^[A-Za-z0-9 /-]+$/, "Letters, digits, spaces, slashes and hyphens only"),
  filedOn: z
    .string()
    .min(1, "Pick the filing date")
    .refine((v) => v <= DEMO_TODAY, "The filing date cannot be in the future"),
  remarks: z.string().max(240, "Keep remarks under 240 characters"),
});

type Values = z.infer<typeof schema>;

export interface FiledDetails {
  ackNo: string;
  filedOn: string;
}

export function MarkFiledDialog({
  filing,
  open,
  onOpenChange,
  onFiled,
}: {
  filing: ReturnFiling | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onFiled: (f: ReturnFiling, d: FiledDetails) => void;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { ackNo: "", filedOn: DEMO_TODAY, remarks: "" },
  });
  const [pending, setPending] = React.useState<FiledDetails | null>(null);

  React.useEffect(() => {
    if (open) form.reset({ ackNo: "", filedOn: DEMO_TODAY, remarks: "" });
  }, [open, form]);

  if (!filing) return null;
  const errors = form.formState.errors;
  const submit = form.handleSubmit((v) => setPending({ ackNo: v.ackNo.trim(), filedOn: v.filedOn }));

  return (
    <>
      <GuardedDialog open={open} onOpenChange={onOpenChange} dirty={form.formState.isDirty} size="md">
        <DialogHeader>
          <DialogTitle>
            Mark {RETURN_FORM_META[filing.form].label} {filing.periodLabel} as filed
          </DialogTitle>
          <DialogDescription>
            {filing.title} · {filing.records} records · {inr(filing.total, { decimals: false })} · due {fmtDate(filing.dueDate)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate>
          <DialogBody className="flex flex-col gap-3.5">
            <Field label="Acknowledgement number" htmlFor="mf-ack" required error={errors.ackNo?.message} hint={ACK_HINT[filing.form]}>
              <Input id="mf-ack" className="font-mono" aria-invalid={!!errors.ackNo} {...form.register("ackNo")} />
            </Field>
            <Field label="Filed on" htmlFor="mf-date" required error={errors.filedOn?.message}>
              <Input id="mf-date" type="date" max={DEMO_TODAY} aria-invalid={!!errors.filedOn} {...form.register("filedOn")} />
            </Field>
            <Field label="Remarks" htmlFor="mf-remarks" error={errors.remarks?.message}>
              <Textarea id="mf-remarks" rows={2} placeholder="Optional — e.g. paid via HDFC net banking" {...form.register("remarks")} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit">Continue</Button>
          </DialogFooter>
        </form>
      </GuardedDialog>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(v) => !v && setPending(null)}
        title={`Lock ${filing.title} ${filing.periodLabel} as filed?`}
        description={
          pending
            ? `Acknowledgement ${pending.ackNo}, filed ${fmtDate(pending.filedOn)}. The file can no longer be regenerated — a correction has to be filed as a revised return.`
            : undefined
        }
        confirmLabel="Mark filed"
        onConfirm={() => {
          if (!pending) return;
          onFiled(filing, pending);
          setPending(null);
          form.reset();
          onOpenChange(false);
        }}
      />
    </>
  );
}
