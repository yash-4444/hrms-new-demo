"use client";

/* Shared helpers for the Growth & Engagement screens (W7). */

import * as React from "react";
import { cn } from "@/lib/utils";
import { employeeByCode } from "@/mock/employees";
import { deptName } from "@/mock/org";
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

/** Confirm dialog for a recorded human decision — the comment is required. */
export function DecisionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = true,
  commentLabel = "Comment",
  placeholder = "Recorded with your name and the time.",
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
  const error = touched && comment.trim().length < 5 ? "Add a short reason (at least 5 characters)." : undefined;
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
          <Field label={commentLabel} htmlFor={id} required error={error}>
            <Textarea
              id={id}
              rows={3}
              value={comment}
              placeholder={placeholder}
              aria-invalid={!!error}
              onChange={(e) => setComment(e.target.value)}
              onBlur={() => setTouched(true)}
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
              if (comment.trim().length < 5) return;
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

/** "Name · Designation" line for a code — consistent everywhere in W7. */
export function personLine(code: string) {
  const e = employeeByCode(code);
  return e ? `${e.designation} · ${deptName(e.departmentId)}` : code;
}

export const nameOf = (code: string) => employeeByCode(code)?.name ?? code;

/** Image placeholder drawn with CSS only — no network, theme-aware. */
export function ImagePlaceholder({
  tone,
  caption,
  className,
}: {
  tone: "violet" | "teal" | "amber" | "rose";
  caption: string;
  className?: string;
}) {
  const grad = {
    violet: "from-violet-200 to-indigo-100 dark:from-violet-500/30 dark:to-indigo-500/10",
    teal: "from-teal-200 to-emerald-100 dark:from-teal-500/30 dark:to-emerald-500/10",
    amber: "from-amber-200 to-orange-100 dark:from-amber-500/30 dark:to-orange-500/10",
    rose: "from-rose-200 to-pink-100 dark:from-rose-500/30 dark:to-pink-500/10",
  }[tone];
  return (
    <div
      role="img"
      aria-label={caption}
      className={cn("flex h-40 items-end rounded-md bg-gradient-to-br p-3", grad, className)}
    >
      <span className="rounded bg-background/80 px-1.5 py-0.5 text-[11px] text-foreground">{caption}</span>
    </div>
  );
}

/** Small 1–5 star display with a text equivalent. */
export function Stars({ value, className }: { value: number; className?: string }) {
  const full = Math.round(value);
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value.toFixed(1)} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} aria-hidden className={i < full ? "text-[var(--warning)]" : "text-muted-foreground/40"}>
          ★
        </span>
      ))}
    </span>
  );
}

/** Labelled numeric meter used for proficiency, completion, etc. */
export function MiniBar({ value, max = 100, tone = "accent", label }: { value: number; max?: number; tone?: "accent" | "success" | "warning" | "danger"; label: string }) {
  const bar = { accent: "bg-primary", success: "bg-success", warning: "bg-warning", danger: "bg-destructive" }[tone];
  const pctW = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex items-center gap-2" aria-label={label}>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", bar)} style={{ width: `${pctW}%` }} />
      </div>
      <span className="tnum text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
