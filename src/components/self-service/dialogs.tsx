"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarClock, Check, RotateCcw, UserRoundPlus, X } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import { Button } from "@/components/ui/button";
import { Field, Switch, Textarea, Input, Checkbox, Label } from "@/components/ui/primitives";
import {
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
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

/* ============================================================================
   Dialog helpers shared by the self-service screens. Each guards against
   losing a dirty form: closing with unsaved input asks first.
   ========================================================================== */

/** Wraps a Dialog's onOpenChange so a dirty form asks before it closes. */
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
      description="You have entered details that have not been submitted. Closing now will lose them."
      confirmLabel="Discard"
      cancelLabel="Keep editing"
      destructive
      onConfirm={close}
    />
  );
  return { onOpenChange, guard };
}

/* ------------------------------------------------------------ decision */

export type DecisionKind = "approve" | "reject" | "send_back";

const DECISION_META: Record<DecisionKind, { label: string; icon: React.ElementType; needsComment: boolean; blurb: string }> = {
  approve: { label: "Approve", icon: Check, needsComment: false, blurb: "Moves each request to its next step, or closes it if this was the last approver." },
  reject: { label: "Reject", icon: X, needsComment: true, blurb: "Closes the request. The requester sees your comment and is notified on every channel they enabled." },
  send_back: { label: "Send back", icon: RotateCcw, needsComment: true, blurb: "Returns the request to the requester for changes. The approval chain restarts when they resubmit." },
};

const decisionSchema = (needsComment: boolean) =>
  z.object({
    comment: needsComment
      ? z.string().trim().min(10, "A comment of at least 10 characters is required — the requester will see it.")
      : z.string(),
  });

export function DecisionDialog({
  open,
  kind,
  count,
  subject,
  onClose,
  onSubmit,
}: {
  open: boolean;
  kind: DecisionKind;
  count: number;
  subject: string;
  onClose: () => void;
  onSubmit: (comment: string) => void;
}) {
  const meta = DECISION_META[kind];
  const form = useForm<{ comment: string }>({
    resolver: zodResolver(decisionSchema(meta.needsComment)),
    defaultValues: { comment: "" },
  });
  React.useEffect(() => {
    if (open) form.reset({ comment: "" });
  }, [open, kind, form]);
  const { onOpenChange, guard } = useDirtyGuard(form.formState.isDirty, onClose);
  const value = form.watch("comment");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="sm">
          <form onSubmit={form.handleSubmit((v) => onSubmit(v.comment.trim()))} className="flex min-h-0 flex-col">
            <DialogHeader>
              <DialogTitle>
                {meta.label} {count === 1 ? subject : `${count} requests`}
              </DialogTitle>
              <DialogDescription>{meta.blurb}</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <Field
                label={`Comment${meta.needsComment ? "" : " (optional)"}`}
                htmlFor="decision-comment"
                required={meta.needsComment}
                error={form.formState.errors.comment?.message}
                hint={meta.needsComment ? `${value.trim().length}/10 characters minimum` : "Visible to the requester."}
              >
                <Textarea
                  id="decision-comment"
                  autoFocus
                  aria-invalid={!!form.formState.errors.comment}
                  placeholder={meta.needsComment ? "Explain what needs to change, or why this cannot be approved…" : "Anything the requester should know…"}
                  {...form.register("comment")}
                />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" variant={kind === "reject" ? "destructive" : "default"}>
                <meta.icon /> {meta.label}
                {count > 1 ? ` ${count}` : ""}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}

/* ------------------------------------------------------------ delegate */

const delegateSchema = z
  .object({
    delegateTo: z.string().min(1, "Choose who will act on your behalf"),
    from: z.string().min(1, "Pick a start date"),
    to: z.string().min(1, "Pick an end date"),
    scope: z.array(z.string()).min(1, "Delegate at least one request type"),
    note: z.string().max(240, "Keep the note under 240 characters"),
    autoReply: z.boolean(),
  })
  .refine((v) => v.from >= DEMO_TODAY, { path: ["from"], message: "The start date cannot be in the past" })
  .refine((v) => v.to >= v.from, { path: ["to"], message: "The end date must be on or after the start date" });

export type DelegateValues = z.infer<typeof delegateSchema>;

/**
 * Out-of-office delegation (date range) or a one-off reassignment of the
 * selected requests (`mode="reassign"`, no dates).
 */
export function DelegateDialog({
  open,
  mode,
  candidates,
  types,
  count = 0,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "ooo" | "reassign";
  candidates: { code: string; name: string; role: string }[];
  types: { value: string; label: string }[];
  count?: number;
  onClose: () => void;
  onSubmit: (v: DelegateValues) => void;
}) {
  const form = useForm<DelegateValues>({
    resolver: zodResolver(delegateSchema),
    defaultValues: {
      delegateTo: "",
      from: DEMO_TODAY,
      to: mode === "ooo" ? "2026-09-25" : DEMO_TODAY,
      scope: types.map((t) => t.value),
      note: "",
      autoReply: true,
    },
  });
  React.useEffect(() => {
    if (open)
      form.reset({
        delegateTo: "",
        from: DEMO_TODAY,
        to: mode === "ooo" ? "2026-09-25" : DEMO_TODAY,
        scope: types.map((t) => t.value),
        note: "",
        autoReply: true,
      });
  }, [open, mode, types, form]);
  const { onOpenChange, guard } = useDirtyGuard(form.formState.isDirty, onClose);
  const errors = form.formState.errors;
  const scope = form.watch("scope");
  const from = form.watch("from");
  const to = form.watch("to");
  const delegateTo = form.watch("delegateTo");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="md">
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-col">
            <DialogHeader>
              <DialogTitle>{mode === "ooo" ? "Delegate while I'm away" : `Delegate ${count} request${count === 1 ? "" : "s"}`}</DialogTitle>
              <DialogDescription>
                {mode === "ooo"
                  ? "New and pending requests route to your delegate for the dates below. Every decision they take is recorded as “on behalf of” you."
                  : "The selected requests move to another approver's inbox. The requester is told who is now deciding."}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-3">
              <Field label="Delegate to" required error={errors.delegateTo?.message}>
                <Select value={delegateTo} onValueChange={(v) => form.setValue("delegateTo", v, { shouldDirty: true, shouldValidate: true })}>
                  <SelectTrigger aria-label="Delegate to" aria-invalid={!!errors.delegateTo}>
                    <SelectValue placeholder="Choose a colleague…" />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name} · {c.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {mode === "ooo" && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="From" htmlFor="dlg-from" required error={errors.from?.message}>
                    <Input id="dlg-from" type="date" min={DEMO_TODAY} aria-invalid={!!errors.from} {...form.register("from")} />
                  </Field>
                  <Field label="To" htmlFor="dlg-to" required error={errors.to?.message}>
                    <Input id="dlg-to" type="date" min={from} aria-invalid={!!errors.to} {...form.register("to")} />
                  </Field>
                </div>
              )}

              {mode === "ooo" && (
                <Field label="Request types" required error={errors.scope?.message}>
                  <div className="grid grid-cols-2 gap-1.5">
                    {types.map((t) => {
                      const checked = scope.includes(t.value);
                      return (
                        <label key={t.value} className="flex items-center gap-2 text-xs">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) =>
                              form.setValue(
                                "scope",
                                v ? [...scope, t.value] : scope.filter((s) => s !== t.value),
                                { shouldDirty: true, shouldValidate: true },
                              )
                            }
                          />
                          {t.label}
                        </label>
                      );
                    })}
                  </div>
                </Field>
              )}

              <Field label="Note for your delegate" htmlFor="dlg-note" error={errors.note?.message}>
                <Textarea id="dlg-note" placeholder="Context they will need — e.g. the Q3 budget cap is ₹4.2L." {...form.register("note")} />
              </Field>

              {mode === "ooo" && (
                <div className="flex items-center justify-between rounded-md border border-border bg-subtle px-3 py-2">
                  <div>
                    <Label htmlFor="dlg-auto">Out-of-office auto-reply</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Requesters see &ldquo;Away until {to ? fmtDate(to) : "—"} — routed to your delegate&rdquo;.
                    </p>
                  </div>
                  <Switch
                    id="dlg-auto"
                    checked={form.watch("autoReply")}
                    onCheckedChange={(v) => form.setValue("autoReply", v, { shouldDirty: true })}
                  />
                </div>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {mode === "ooo" ? <CalendarClock /> : <UserRoundPlus />}
                {mode === "ooo" ? "Turn on delegation" : "Delegate"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}
