"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Paperclip, Send, ShieldAlert } from "lucide-react";
import { SENSITIVE_FIELDS, type ProfileField } from "@/mock/self-service";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/overlays";
import { useDirtyGuard } from "@/components/self-service/dialogs";

/* ============================================================================
   Approval-gated profile edit: the employee proposes a value, attaches proof
   where the field is sensitive, and the change waits in HR's inbox.
   ========================================================================== */

const schema = z
  .object({
    field: z.string().min(1, "Choose the field to change"),
    newValue: z.string().trim().min(3, "Enter the new value"),
    reason: z.string().trim().min(5, "Tell HR why — at least 5 characters"),
    document: z.string(),
  })
  .superRefine((v, ctx) => {
    if (SENSITIVE_FIELDS.includes(v.field as ProfileField) && !v.document)
      ctx.addIssue({ code: "custom", path: ["document"], message: `${v.field} needs a supporting document` });
  });

export type ChangeRequestValues = z.infer<typeof schema>;

export function RequestChangeDialog({
  open,
  initialField,
  currentValues,
  onClose,
  onSubmit,
}: {
  open: boolean;
  initialField: ProfileField | null;
  currentValues: Record<ProfileField, string>;
  onClose: () => void;
  onSubmit: (v: ChangeRequestValues & { oldValue: string }) => void;
}) {
  const form = useForm<ChangeRequestValues>({
    resolver: zodResolver(schema),
    defaultValues: { field: initialField ?? "", newValue: "", reason: "", document: "" },
  });
  React.useEffect(() => {
    if (open) form.reset({ field: initialField ?? "", newValue: "", reason: "", document: "" });
  }, [open, initialField, form]);
  const { onOpenChange, guard } = useDirtyGuard(form.formState.isDirty, onClose);
  const field = form.watch("field") as ProfileField | "";
  const newValue = form.watch("newValue");
  const doc = form.watch("document");
  const errors = form.formState.errors;
  const sensitive = field ? SENSITIVE_FIELDS.includes(field) : false;
  const fileRef = React.useRef<HTMLInputElement>(null);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="md">
          <form
            className="flex min-h-0 flex-col"
            onSubmit={form.handleSubmit((v) => onSubmit({ ...v, oldValue: currentValues[v.field as ProfileField] ?? "—" }))}
          >
            <DialogHeader>
              <DialogTitle>Request a change</DialogTitle>
              <DialogDescription>
                Your record is not edited directly. HR verifies the change first, and you are notified when it is applied.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-3">
              <Field label="Field" required error={errors.field?.message}>
                <Select value={field} onValueChange={(v) => form.setValue("field", v, { shouldDirty: true, shouldValidate: true })}>
                  <SelectTrigger aria-label="Field to change" aria-invalid={!!errors.field}>
                    <SelectValue placeholder="Choose a field…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(currentValues) as ProfileField[]).map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                        {SENSITIVE_FIELDS.includes(f) ? " · proof required" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {field && (
                <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
                  <div className="rounded-md border border-border bg-subtle p-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Current</p>
                    <p className="mt-1 break-words text-xs">{currentValues[field]}</p>
                  </div>
                  <ArrowRight className="size-4 self-center text-muted-foreground" aria-hidden />
                  <div className="rounded-md border border-primary/30 bg-primary-soft/40 p-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Proposed</p>
                    <p className="mt-1 break-words text-xs">{newValue || <span className="text-muted-foreground">Type below…</span>}</p>
                  </div>
                </div>
              )}

              <Field label="New value" htmlFor="rc-new" required error={errors.newValue?.message}>
                <Input id="rc-new" aria-invalid={!!errors.newValue} {...form.register("newValue")} />
              </Field>
              <Field label="Reason" htmlFor="rc-reason" required error={errors.reason?.message}>
                <Textarea id="rc-reason" aria-invalid={!!errors.reason} placeholder="e.g. Moved house on 1 Sep" {...form.register("reason")} />
              </Field>

              <Field
                label={`Supporting document${sensitive ? "" : " (optional)"}`}
                required={sensitive}
                error={errors.document?.message}
                hint="PDF, JPG or PNG up to 5 MB. Stored encrypted; visible to HR only."
              >
                <div className="flex items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="sr-only"
                    aria-label="Choose a supporting document"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) form.setValue("document", f.name, { shouldDirty: true, shouldValidate: true });
                    }}
                  />
                  <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                    <Paperclip /> {doc ? "Replace file" : "Attach file"}
                  </Button>
                  <span className="truncate text-xs text-muted-foreground">{doc || "No file chosen"}</span>
                </div>
              </Field>

              {sensitive && (
                <Alert tone="warning" icon={ShieldAlert} title="Sensitive field">
                  {field === "Bank account"
                    ? "Payroll runs a penny-drop check before the account is used. Your next salary goes to the old account until the check passes."
                    : "This change affects statutory records. HR will verify the document against the original."}
                </Alert>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">
                <Send /> Submit for approval
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}
