"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Download, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { inr } from "@/lib/format";
import { descendantsOf, EMPLOYEES } from "@/mock/employees";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
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
import { Field, Textarea } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { NumCell } from "@/components/data-table";

/* ============================================================================
   Shared helpers for the W5 time, payroll & finance screens.
   ========================================================================== */

/* ------------------------------------------------------------ statuses */

/**
 * Statuses the shared StatusBadge map does not know. Each borrows the tone and
 * icon of an existing status and overrides only the label.
 */
const LOCAL_STATUS: Record<string, { as: string; label: string }> = {
  online: { as: "active", label: "Online" },
  offline: { as: "not_marked", label: "Offline" },
  error: { as: "failed", label: "Error" },
  due: { as: "due_soon", label: "Due" },
  generated: { as: "calculated", label: "Generated" },
  published: { as: "completed", label: "Published" },
  unpublished: { as: "draft", label: "Not published" },
  emailed: { as: "completed", label: "Emailed" },
  not_emailed: { as: "pending", label: "Not emailed" },
  verified: { as: "approved", label: "Verified" },
  queried: { as: "sent_back", label: "Queried" },
  released_payroll: { as: "scheduled", label: "Released to payroll" },
  released_direct: { as: "paid", label: "Paid directly" },
  booking_pending: { as: "pending", label: "Booking pending" },
  booked: { as: "completed", label: "Booked" },
  settled: { as: "completed", label: "Settled" },
  outstanding: { as: "due_soon", label: "Outstanding" },
  recovering: { as: "running", label: "Recovering via payroll" },
  sanctioned: { as: "approved", label: "Sanctioned" },
  closed: { as: "closed", label: "Closed" },
  foreclosed: { as: "closed", label: "Foreclosed" },
  pending_approval: { as: "pending", label: "Pending approval" },
  maker_done: { as: "in_review", label: "Awaiting checker" },
  received: { as: "submitted", label: "Received" },
  processed: { as: "completed", label: "Processed" },
  effective: { as: "active", label: "Effective" },
  superseded: { as: "withdrawn", label: "Superseded" },
};

export function FinStatus({ status, className }: { status: string; className?: string }) {
  const local = LOCAL_STATUS[status];
  return <StatusBadge status={local?.as ?? status} label={local?.label} className={className} />;
}

/* --------------------------------------------------------------- money */

/** Right-aligned tabular INR, whole rupees unless asked otherwise. */
export function MoneyCell({
  value,
  decimals = false,
  className,
}: {
  value: number;
  decimals?: boolean;
  className?: string;
}) {
  return (
    <NumCell className={cn(value < 0 && "text-destructive-fg", className)}>
      {inr(value, { decimals })}
    </NumCell>
  );
}

/**
 * A visible reconciliation assertion: "Σ bank files = run net pay ✓". Renders a
 * warning instead of a tick if the two figures ever drift apart.
 */
export function ReconcileCheck({
  label,
  left,
  right,
  leftLabel,
  rightLabel,
  format = (v: number) => inr(v, { decimals: false }),
  className,
}: {
  label: string;
  left: number;
  right: number;
  leftLabel: string;
  rightLabel: string;
  format?: (v: number) => string;
  className?: string;
}) {
  const ok = Math.round(left) === Math.round(right);
  const Icon = ok ? CheckCircle2 : TriangleAlert;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border px-3 py-2 text-xs",
        ok ? "border-success/25 bg-success-soft text-success-fg" : "border-warning/30 bg-warning-soft text-warning-fg",
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="font-semibold">{label}</span>
      <span className="tnum opacity-90">
        {leftLabel} {format(left)} {ok ? "=" : "≠"} {rightLabel} {format(right)}
      </span>
    </div>
  );
}

/** Simulated file download — the toast names the file and its contents. */
export function downloadFile(fileName: string, description?: string) {
  mockAction(`Downloaded ${fileName}`, { description, tone: "info" });
}

export function DownloadButton({
  fileName,
  description,
  label = "Download",
  size = "sm",
  variant = "outline",
  disabled,
}: {
  fileName: string;
  description?: string;
  label?: string;
  size?: "sm" | "default" | "icon-sm";
  variant?: "outline" | "ghost" | "default";
  disabled?: boolean;
}) {
  return (
    <Button
      size={size}
      variant={variant}
      disabled={disabled}
      aria-label={size === "icon-sm" ? `${label} ${fileName}` : undefined}
      onClick={(e) => {
        e.stopPropagation();
        downloadFile(fileName, description);
      }}
    >
      <Download />
      {size !== "icon-sm" && label}
    </Button>
  );
}

/* ------------------------------------------------------- team scoping */

/**
 * Managers and department heads see their own people only. Returns the set of
 * visible employee codes, or null when the persona sees the whole tenant.
 */
export function useTeamScope() {
  const { role, persona } = useApp();
  return React.useMemo(() => {
    if (role === "manager") {
      const codes = new Set(descendantsOf(persona.employeeId).map((e) => e.code));
      return { codes, label: `${persona.name}'s team (${codes.size})` };
    }
    if (role === "department_head") {
      const self = EMPLOYEES.find((e) => e.code === persona.employeeId);
      const codes = new Set(
        EMPLOYEES.filter((e) => e.departmentId === self?.departmentId && e.code !== persona.employeeId).map(
          (e) => e.code,
        ),
      );
      return { codes, label: `${persona.department} department (${codes.size})` };
    }
    return { codes: null as Set<string> | null, label: "All employees" };
  }, [role, persona]);
}

/* ------------------------------------------------- dirty-guarded dialog */

/**
 * A Dialog that asks before throwing away a dirty form. Pass the form's
 * isDirty; closing (Esc, overlay, Cancel) while dirty raises a confirm.
 */
export function GuardedDialog({
  open,
  onOpenChange,
  dirty,
  size = "md",
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dirty: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  children: React.ReactNode;
}) {
  const [ask, setAsk] = React.useState(false);
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v && dirty) setAsk(true);
          else onOpenChange(v);
        }}
      >
        <DialogContent size={size}>{children}</DialogContent>
      </Dialog>
      <ConfirmDialog
        open={ask}
        onOpenChange={setAsk}
        destructive
        title="Discard unsaved changes?"
        description="The values you entered in this form will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => onOpenChange(false)}
      />
    </>
  );
}

/* --------------------------------------------- decision with a comment */

const commentSchema = z.object({
  comment: z.string().trim().min(10, "Record a reason of at least 10 characters — it is kept in the audit trail."),
});

/**
 * Reject / query back / foreclose — any human decision that must carry a
 * written reason. The reason is validated before the confirm button works.
 */
export function DecisionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = true,
  placeholder = "Explain the decision for the requester and the audit log…",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  placeholder?: string;
  onConfirm: (comment: string) => void;
}) {
  const form = useForm<{ comment: string }>({
    resolver: zodResolver(commentSchema),
    defaultValues: { comment: "" },
  });
  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) form.reset();
  };
  const submit = form.handleSubmit((v) => {
    onConfirm(v.comment.trim());
    close(false);
  });
  return (
    <GuardedDialog open={open} onOpenChange={close} dirty={form.formState.isDirty} size="sm">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <form onSubmit={submit}>
        <DialogBody>
          <Field label="Reason" htmlFor="decision-comment" required error={form.formState.errors.comment?.message}>
            <Textarea
              id="decision-comment"
              rows={3}
              placeholder={placeholder}
              aria-invalid={!!form.formState.errors.comment}
              {...form.register("comment")}
            />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button type="submit" variant={destructive ? "destructive" : "default"}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </form>
    </GuardedDialog>
  );
}
