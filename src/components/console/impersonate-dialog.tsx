"use client";

import * as React from "react";
import { Eye, Headset } from "lucide-react";
import { cn } from "@/lib/utils";
import { personaById } from "@/lib/rbac";
import type { ConsoleTenant } from "@/mock/console-tenants";
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

/* "Impersonate for support": a time-boxed, read-only window into one tenant.
   Reason, ticket and duration are mandatory because each is written into the
   tenant's OWN audit trail, where its owner can read it. */

const DURATIONS = [15, 30, 60];
const TICKET = /^SUP-\d{3,6}$/i;

export interface SupportRequest {
  reason: string;
  ticket: string;
  minutes: number;
}

export function ImpersonateDialog({
  tenant,
  onOpenChange,
  onConfirm,
}: {
  tenant: ConsoleTenant;
  onOpenChange: (v: boolean) => void;
  onConfirm: (r: SupportRequest) => void;
}) {
  const [reason, setReason] = React.useState("");
  const [ticket, setTicket] = React.useState("");
  const [minutes, setMinutes] = React.useState(30);
  const [touched, setTouched] = React.useState(false);
  const reasonOk = reason.trim().length >= 10;
  const ticketOk = TICKET.test(ticket.trim());
  const lens = personaById("tenant_owner");

  const submit = () => {
    setTouched(true);
    if (!reasonOk || !ticketOk) return;
    onConfirm({ reason: reason.trim(), ticket: ticket.trim().toUpperCase(), minutes });
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Headset className="size-4" aria-hidden /> Impersonate for support — {tenant.name}
          </DialogTitle>
          <DialogDescription>
            Opens {tenant.subdomain}.hrms-new.app as its owner, read-only, for a fixed time. You cannot create, edit,
            approve or export anything while inside.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <Alert tone="warning" icon={Eye} title="Recorded and visible to the tenant">
            The start, end, reason and ticket go into <span className="font-medium">{tenant.name}&apos;s own audit trail</span>,
            and {tenant.ownerName} (tenant owner) is notified by email the moment the session opens.
          </Alert>
          <Field
            label="Reason"
            htmlFor="imp-reason"
            required
            error={touched && !reasonOk ? "Describe what you need to look at (at least 10 characters)." : undefined}
          >
            <Textarea
              id="imp-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Owner reports the September payslip PDF shows the wrong HRA exemption."
              aria-invalid={touched && !reasonOk}
            />
          </Field>
          <Field
            label="Support ticket"
            htmlFor="imp-ticket"
            required
            error={touched && !ticketOk ? "Use the ticket reference, e.g. SUP-4417." : undefined}
            hint="Sessions without an open ticket are refused."
          >
            <Input
              id="imp-ticket"
              value={ticket}
              onChange={(e) => setTicket(e.target.value)}
              placeholder="SUP-4417"
              className="font-mono"
              autoComplete="off"
              aria-invalid={touched && !ticketOk}
            />
          </Field>
          <Field label="Duration" required hint="The session ends itself; you can end it earlier from the banner.">
            <div className="flex gap-1.5" role="radiogroup" aria-label="Duration">
              {DURATIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={minutes === m}
                  onClick={() => setMinutes(m)}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-1.5 text-xs focus-visible:ring-2 focus-visible:ring-ring",
                    minutes === m ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border hover:bg-muted",
                  )}
                >
                  {m} min
                </button>
              ))}
            </div>
          </Field>
          <p className="text-[11px] text-muted-foreground">
            In this demo the session opens the sample organisation as {lens.name} ({lens.role}) with View-only access.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={touched && (!reasonOk || !ticketOk)} onClick={submit}>
            <Headset /> Start {minutes}-minute session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
