"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
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

/* ============================================================================
   Shared building blocks for the hire → onboard → exit screens.
   ========================================================================== */

/* ------------------------------------------------------------ status badge */

/** Lifecycle statuses mapped onto the shared StatusBadge palette, with our own labels. */
const LC_STATUS: Record<string, { base: string; label: string }> = {
  // separations
  pending_manager: { base: "pending", label: "Manager approval" },
  pending_hr: { base: "pending", label: "HR approval" },
  serving_notice: { base: "notice", label: "Serving notice" },
  clearance: { base: "in_review", label: "In clearance" },
  // F&F
  draft: { base: "draft", label: "Draft — projected" },
  pending_approval: { base: "pending", label: "Awaiting Finance" },
  // referrals
  in_pipeline: { base: "processing", label: "In pipeline" },
  pending_tenure: { base: "scheduled", label: "Awaiting 90 days" },
  not_eligible: { base: "cancelled", label: "Not eligible" },
  // onboarding tasks / clearance items
  done: { base: "completed", label: "Done" },
  cleared: { base: "approved", label: "Cleared" },
  recovery: { base: "exception", label: "Recovery raised" },
  // probation
  upcoming: { base: "on_track", label: "Upcoming" },
  due_soon: { base: "due_soon", label: "Due in 30 days" },
  // rehire
  eligible: { base: "approved", label: "Eligible" },
  // agencies / invoices
  disputed: { base: "exception", label: "Disputed" },
};

export function LcBadge({ status, label, className }: { status: string; label?: string; className?: string }) {
  const m = LC_STATUS[status];
  return <StatusBadge status={m?.base ?? status} label={label ?? m?.label} className={className} />;
}

/* ------------------------------------------------------------- dirty guard */

/** Close-request handler that asks before discarding a dirty form. */
export function useDirtyGuard(isDirty: boolean, close: () => void) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const onOpenChange = (open: boolean) => {
    if (open) return;
    if (isDirty) setConfirmOpen(true);
    else close();
  };
  const guard = (
    <ConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      title="Discard your changes?"
      description="You have unsaved changes in this form. Closing now will lose them."
      confirmLabel="Discard"
      cancelLabel="Keep editing"
      destructive
      onConfirm={close}
    />
  );
  return { onOpenChange, guard };
}

/* ----------------------------------------------------------- reason dialog */

/** Confirm dialog that records a human decision with a required comment. */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = true,
  commentLabel = "Reason",
  placeholder = "Recorded in the audit trail with your name and the time.",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  commentLabel?: string;
  placeholder?: string;
  onConfirm: (comment: string) => void;
}) {
  const [comment, setComment] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const id = React.useId();
  const tooShort = comment.trim().length < 5;

  const close = (v: boolean) => {
    if (!v) {
      setComment("");
      setTouched(false);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogBody>
          <Field label={commentLabel} htmlFor={id} required error={touched && tooShort ? "Add a short reason (5+ characters)." : undefined}>
            <Textarea
              id={id}
              value={comment}
              placeholder={placeholder}
              aria-invalid={touched && tooShort}
              onChange={(e) => setComment(e.target.value)}
            />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={() => {
              setTouched(true);
              if (tooShort) return;
              onConfirm(comment.trim());
              close(false);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- timeline */

export interface TimelineItem {
  at: string;
  title: string;
  detail?: React.ReactNode;
  tone?: "done" | "current" | "upcoming" | "danger";
}

const DOT: Record<NonNullable<TimelineItem["tone"]>, string> = {
  done: "bg-success",
  current: "bg-primary ring-4 ring-primary/20",
  upcoming: "bg-muted-foreground/40",
  danger: "bg-destructive",
};

export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn("relative flex flex-col gap-4 pl-5", className)}>
      <span className="absolute bottom-1 left-[5px] top-1 w-px bg-border" aria-hidden />
      {items.map((it, i) => (
        <li key={`${it.at}-${i}`} className="relative">
          <span className={cn("absolute -left-5 top-1 size-2.5 rounded-full", DOT[it.tone ?? "done"])} aria-hidden />
          <p className="text-xs font-medium text-foreground">{it.title}</p>
          <p className="tnum text-[11px] text-muted-foreground">{it.at.length > 10 ? it.at : fmtDate(it.at)}</p>
          {it.detail && <div className="mt-0.5 text-xs text-muted-foreground">{it.detail}</div>}
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------- owner chip */

const OWNER_TONE: Record<string, string> = {
  HR: "bg-info-soft text-info-fg border-info/25",
  IT: "bg-primary-soft text-primary-soft-foreground border-primary/25",
  Manager: "bg-warning-soft text-warning-fg border-warning/30",
  Finance: "bg-success-soft text-success-fg border-success/25",
  Payroll: "bg-success-soft text-success-fg border-success/25",
  Employee: "bg-neutral-soft text-neutral-fg border-border",
  "Admin & Assets": "bg-serious-soft text-serious-fg border-serious/30",
};

export function OwnerChip({ owner, className }: { owner: string; className?: string }) {
  return (
    <span className={cn("inline-flex w-fit items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap", OWNER_TONE[owner] ?? OWNER_TONE.Employee, className)}>
      {owner}
    </span>
  );
}

/* --------------------------------------------------------------- key/value */

export function KV({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm text-foreground">{children}</div>
    </div>
  );
}
