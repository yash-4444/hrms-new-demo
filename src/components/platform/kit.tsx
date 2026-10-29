"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/primitives";
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
   Shared bits for the platform-admin and compliance screens: tone pills for
   statuses the global map does not know, a dirty-form guard, a confirm
   dialog that records a reason (and optionally a typed phrase), a simulated
   long-running task, and a compact facts grid.
   ========================================================================== */

export type PTone = "success" | "warning" | "danger" | "info" | "neutral" | "accent" | "serious";

const PTONE_CLASS: Record<PTone, string> = {
  success: "bg-success-soft text-success-fg border-success/25",
  warning: "bg-warning-soft text-warning-fg border-warning/30",
  serious: "bg-serious-soft text-serious-fg border-serious/30",
  danger: "bg-destructive-soft text-destructive-fg border-destructive/25",
  info: "bg-info-soft text-info-fg border-info/25",
  neutral: "bg-neutral-soft text-neutral-fg border-border",
  accent: "bg-primary-soft text-primary-soft-foreground border-primary/25",
};

/** A status pill for platform-only states (Degraded, Pending DNS, Skipped…). */
export function TonePill({
  tone,
  icon: Icon,
  children,
  className,
}: {
  tone: PTone;
  icon?: React.ElementType;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-xs font-medium",
        PTONE_CLASS[tone],
        className,
      )}
    >
      {Icon && <Icon className="size-3" aria-hidden />}
      {children}
    </span>
  );
}

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

/**
 * Confirm dialog that records a human decision: a required comment, and —
 * for irreversible actions — a phrase the user must type exactly.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = true,
  commentLabel = "Reason",
  commentPlaceholder = "Recorded in the audit log with your name and the time.",
  requireComment = true,
  typePhrase,
  children,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  commentLabel?: string;
  commentPlaceholder?: string;
  requireComment?: boolean;
  typePhrase?: string;
  children?: React.ReactNode;
  onConfirm: (comment: string) => void;
}) {
  const [comment, setComment] = React.useState("");
  const [typed, setTyped] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const id = React.useId();

  const commentOk = !requireComment || comment.trim().length >= 5;
  const phraseOk = !typePhrase || typed.trim() === typePhrase;

  const reset = () => {
    setComment("");
    setTyped("");
    setTouched(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          {children}
          <Field
            label={commentLabel}
            htmlFor={`${id}-c`}
            required={requireComment}
            error={touched && !commentOk ? "Add a short reason (at least 5 characters)." : undefined}
          >
            <Textarea
              id={`${id}-c`}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={commentPlaceholder}
              aria-invalid={touched && !commentOk}
            />
          </Field>
          {typePhrase && (
            <Field
              label={`Type ${typePhrase} to confirm`}
              htmlFor={`${id}-p`}
              required
              error={touched && !phraseOk ? `Type ${typePhrase} exactly.` : undefined}
            >
              <Input
                id={`${id}-p`}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                className="font-mono"
                aria-invalid={touched && !phraseOk}
              />
            </Field>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={touched && (!commentOk || !phraseOk)}
            onClick={() => {
              setTouched(true);
              if (!commentOk || !phraseOk) return;
              onConfirm(comment.trim());
              reset();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Simulated long-running task: 0 → 100 over ~`ms`, then calls `onDone`. */
export function useSimulatedTask(ms = 1800) {
  const [state, setState] = React.useState<{ key: string | null; progress: number }>({ key: null, progress: 0 });
  const timer = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  const start = React.useCallback(
    (key: string, onDone: () => void) => {
      if (timer.current) clearInterval(timer.current);
      const steps = 12;
      let i = 0;
      setState({ key, progress: 0 });
      timer.current = setInterval(() => {
        i += 1;
        setState({ key, progress: Math.round((i / steps) * 100) });
        if (i >= steps) {
          if (timer.current) clearInterval(timer.current);
          timer.current = null;
          setState({ key: null, progress: 0 });
          onDone();
        }
      }, ms / steps);
    },
    [ms],
  );

  return { runningKey: state.key, progress: state.progress, start };
}

/** Compact label/value grid used in summary cards. */
export function Facts({
  items,
  cols = 2,
  className,
}: {
  items: { label: string; value: React.ReactNode }[];
  cols?: 2 | 3 | 4;
  className?: string;
}) {
  const grid = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[cols];
  return (
    <dl className={cn("grid grid-cols-1 gap-x-4 gap-y-2.5", grid, className)}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{it.label}</dt>
          <dd className="mt-0.5 text-xs text-foreground">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Thin labelled meter with a figure on the right. */
export function Meter({
  label,
  used,
  limit,
  format = (n: number) => n.toLocaleString("en-IN"),
  warnAt = 0.85,
}: {
  label: string;
  used: number;
  limit: number;
  format?: (n: number) => string;
  warnAt?: number;
}) {
  const ratio = limit ? used / limit : 0;
  const tone = ratio >= 1 ? "bg-destructive" : ratio >= warnAt ? "bg-warning" : "bg-primary";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tnum font-medium text-foreground">
          {format(used)} / {format(limit)}
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
      >
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </div>
    </div>
  );
}
