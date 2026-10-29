"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/primitives";
import {
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/overlays";

const QUICK = [
  "Scan is blurred — the document number is not legible.",
  "Name on the document does not match the employee record.",
  "Only the front side was uploaded.",
];

/**
 * Reject with a required reason, then a final confirm — a human decision is
 * recorded, so it never happens on a single click.
 */
export function RejectReasonDialog({
  open,
  onOpenChange,
  title,
  subject,
  onReject,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  subject: string;
  onReject: (reason: string) => void;
}) {
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState(false);
  const [discard, setDiscard] = React.useState(false);

  const finish = () => {
    setReason("");
    setError(null);
    onOpenChange(false);
  };

  const close = (v: boolean) => {
    if (v) return onOpenChange(true);
    if (reason.trim()) setDiscard(true);
    else finish();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{subject} The employee sees this reason and is asked to re-upload.</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-2">
            <Field label="Reason" htmlFor="rej-reason" required error={error ?? undefined}>
              <Textarea
                id="rej-reason"
                rows={3}
                value={reason}
                aria-invalid={!!error}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (error) setError(null);
                }}
              />
            </Field>
            <div className="flex flex-wrap gap-1">
              {QUICK.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setReason(q)}
                  className="rounded-md border border-border px-1.5 py-0.5 text-left text-[11px] text-muted-foreground hover:bg-muted"
                >
                  {q}
                </button>
              ))}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (reason.trim().length < 10) {
                  setError("Give a reason of at least 10 characters.");
                  return;
                }
                setConfirm(true);
              }}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Confirm rejection"
        description={`“${reason.trim()}” will be sent to the employee and recorded on the audit trail.`}
        confirmLabel="Reject"
        destructive
        onConfirm={() => {
          onReject(reason.trim());
          finish();
        }}
      />
      <ConfirmDialog
        open={discard}
        onOpenChange={setDiscard}
        title="Discard the reason you typed?"
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={finish}
      />
    </>
  );
}
