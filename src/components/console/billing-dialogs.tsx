"use client";

import * as React from "react";
import { inr } from "@/lib/format";
import { CONSOLE_TODAY } from "@/mock/console-tenants";
import { invoiceTotal, type PlatformInvoice } from "@/mock/console-billing";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input, Textarea } from "@/components/ui/primitives";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/overlays";

/* Billing — record an offline payment and issue a credit note. Both are
   rendered only while open, so each opening starts empty. A credit note never
   edits the invoice: it is a new document against it, like a ledger entry. */

export function MarkPaidDialog({
  invoice: i,
  onOpenChange,
  onConfirm,
}: {
  invoice: PlatformInvoice;
  onOpenChange: (v: boolean) => void;
  onConfirm: (reference: string, receivedOn: string) => void;
}) {
  const [reference, setReference] = React.useState("");
  const [receivedOn, setReceivedOn] = React.useState(CONSOLE_TODAY);
  const [touched, setTouched] = React.useState(false);
  const refError = reference.trim().length < 4 ? "Enter the UTR, cheque or wire reference" : undefined;
  const dateError = !receivedOn || receivedOn > CONSOLE_TODAY || receivedOn < i.issuedOn ? "Between the issue date and today" : undefined;
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Mark {i.id} paid offline</DialogTitle>
          <DialogDescription>
            {i.tenantName} · {inr(invoiceTotal(i), { decimals: false })}. Stops dunning for this invoice and emails the owner a receipt.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <Field label="Payment reference" htmlFor="mp-ref" required error={touched ? refError : undefined} hint="UTR for NEFT / RTGS, cheque number, or the wire's SWIFT reference.">
            <Input id="mp-ref" value={reference} onChange={(e) => setReference(e.target.value)} className="font-mono" autoComplete="off" aria-invalid={touched && !!refError} />
          </Field>
          <Field label="Received on" htmlFor="mp-date" required error={touched ? dateError : undefined}>
            <Input id="mp-date" type="date" min={i.issuedOn} max={CONSOLE_TODAY} value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} aria-invalid={touched && !!dateError} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setTouched(true);
              if (refError || dateError) return;
              onConfirm(reference.trim(), receivedOn);
            }}
          >
            Mark paid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CreditNoteDialog({
  invoice: i,
  onOpenChange,
  onConfirm,
}: {
  invoice: PlatformInvoice;
  onOpenChange: (v: boolean) => void;
  onConfirm: (amount: number, reason: string) => void;
}) {
  const total = invoiceTotal(i);
  const [amount, setAmount] = React.useState(String(total));
  const [reason, setReason] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const value = Number(amount);
  const amountError = !amount || !(value > 0) || value > total ? `Between ₹1 and ${inr(total, { decimals: false })}` : undefined;
  const reasonError = reason.trim().length < 5 ? "Add a short reason (at least 5 characters)" : undefined;
  const full = value === total;
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Issue a credit note against {i.id}</DialogTitle>
          <DialogDescription>
            {i.tenantName} · {i.period} · invoice total {inr(total, { decimals: false })}
            {i.tax ? " incl. 18% GST" : ""}.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <Field label="Credit amount (₹, incl. tax)" htmlFor="cn-amt" required error={touched ? amountError : undefined}>
            <Input id="cn-amt" type="number" min={1} max={total} value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={touched && !!amountError} />
          </Field>
          <Field label="Reason" htmlFor="cn-reason" required error={touched ? reasonError : undefined}>
            <Textarea id="cn-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Printed on the credit note and recorded in the audit log." aria-invalid={touched && !!reasonError} />
          </Field>
          <Alert tone="info">
            The invoice itself is never edited. {full ? "A full credit marks it Refunded" : "A partial credit is set against the next invoice"}
            {i.tax ? "; the GST portion is reversed in the next GSTR-1." : "."}
          </Alert>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              setTouched(true);
              if (amountError || reasonError) return;
              onConfirm(value, reason.trim());
            }}
          >
            Issue credit note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
