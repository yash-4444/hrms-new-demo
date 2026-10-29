"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ACTIONS, ACTION_LABEL, MENU_META, personaById, type Action, type MenuKey } from "@/lib/rbac";
import { DEMO_TODAY } from "@/mock/org";
import { employeeName } from "@/mock/employees";
import { OVERRIDE_SUBJECTS, type PermissionOverride } from "@/mock/platform";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Label, RadioGroup, RadioGroupItem, Textarea } from "@/components/ui/primitives";
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
import { useDirtyGuard } from "@/components/platform/kit";

const schema = z
  .object({
    employeeCode: z.string().min(1, "Pick an employee"),
    menuKey: z.string().min(1, "Pick a menu"),
    mode: z.enum(["grant", "revoke"]),
    actions: z.array(z.string()).min(1, "Pick at least one action"),
    reason: z.string().trim().min(15, "Explain why in at least 15 characters — this goes to the access review"),
    expiresAt: z.string(),
    permanent: z.boolean(),
  })
  .refine((v) => v.permanent || (v.expiresAt !== "" && v.expiresAt > DEMO_TODAY), {
    path: ["expiresAt"],
    message: "Pick an expiry date after today, or mark the override permanent",
  });
type Values = z.infer<typeof schema>;

const DEFAULTS: Values = { employeeCode: "", menuKey: "", mode: "grant", actions: [], reason: "", expiresAt: "", permanent: false };

export function OverrideDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (o: PermissionOverride) => void;
}) {
  const { persona } = useApp();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: DEFAULTS });
  const errors = form.formState.errors;
  const close = () => {
    form.reset(DEFAULTS);
    onOpenChange(false);
  };
  const guard = useDirtyGuard(form.formState.isDirty, close);
  const permanent = form.watch("permanent");

  const submit = form.handleSubmit((v) => {
    const subject = OVERRIDE_SUBJECTS.find((s) => s.code === v.employeeCode)!;
    onCreate({
      id: `OVR-N${Math.round(v.reason.length * 7 + v.actions.length)}-${v.employeeCode}`,
      employeeCode: v.employeeCode,
      role: subject.role,
      menuKey: v.menuKey as MenuKey,
      grant: v.mode === "grant" ? (v.actions as Action[]) : [],
      revoke: v.mode === "revoke" ? (v.actions as Action[]) : [],
      reason: v.reason,
      expiresAt: v.permanent ? null : v.expiresAt,
      grantedBy: persona.name,
      grantedAt: "2026-09-16T14:35:00",
    });
    mockAction(`Override ${v.mode === "grant" ? "granted" : "applied"} for ${employeeName(v.employeeCode)}`, {
      description: v.permanent ? "Permanent — it will be flagged in every quarterly access review." : `Expires automatically at the end of the selected date.`,
    });
    close();
  });

  return (
    <>
      <Dialog open={open} onOpenChange={guard.onOpenChange}>
        <DialogContent size="md">
          <form onSubmit={submit} noValidate>
            <DialogHeader>
              <DialogTitle>Add permission override</DialogTitle>
              <DialogDescription>Overrides win over the role baseline for this one employee. Prefer a role change when the need is permanent.</DialogDescription>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Employee" required error={errors.employeeCode?.message}>
                  <Controller
                    control={form.control}
                    name="employeeCode"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger aria-label="Employee" aria-invalid={!!errors.employeeCode}>
                          <SelectValue placeholder="Choose…" />
                        </SelectTrigger>
                        <SelectContent>
                          {OVERRIDE_SUBJECTS.map((s) => (
                            <SelectItem key={s.code} value={s.code}>
                              {employeeName(s.code)} · {personaById(s.role).role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <Field label="Menu" required error={errors.menuKey?.message}>
                  <Controller
                    control={form.control}
                    name="menuKey"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger aria-label="Menu" aria-invalid={!!errors.menuKey}>
                          <SelectValue placeholder="Choose…" />
                        </SelectTrigger>
                        <SelectContent>
                          {MENU_META.map((m) => (
                            <SelectItem key={m.key} value={m.key}>
                              {m.module} › {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
              </div>
              <Field label="Change" required>
                <Controller
                  control={form.control}
                  name="mode"
                  render={({ field }) => (
                    <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-4">
                      <div className="flex items-center gap-1.5">
                        <RadioGroupItem value="grant" id="ovr-grant" />
                        <Label htmlFor="ovr-grant">Grant extra actions</Label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <RadioGroupItem value="revoke" id="ovr-revoke" />
                        <Label htmlFor="ovr-revoke">Revoke baseline actions</Label>
                      </div>
                    </RadioGroup>
                  )}
                />
              </Field>
              <Field label="Actions" required error={errors.actions?.message}>
                <Controller
                  control={form.control}
                  name="actions"
                  render={({ field }) => (
                    <div className="flex flex-wrap gap-3">
                      {ACTIONS.map((a) => (
                        <div key={a} className="flex items-center gap-1.5">
                          <Checkbox
                            id={`ovr-a-${a}`}
                            checked={field.value.includes(a)}
                            onCheckedChange={(c) => field.onChange(c ? [...field.value, a] : field.value.filter((x) => x !== a))}
                          />
                          <Label htmlFor={`ovr-a-${a}`}>{ACTION_LABEL[a]}</Label>
                        </div>
                      ))}
                    </div>
                  )}
                />
              </Field>
              <Field label="Reason" htmlFor="ovr-reason" required error={errors.reason?.message}>
                <Textarea id="ovr-reason" {...form.register("reason")} aria-invalid={!!errors.reason} placeholder="e.g. Covering payroll approvals while Rahul is on leave, 18–30 Sep." />
              </Field>
              <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
                <Field label="Expires on" htmlFor="ovr-exp" error={errors.expiresAt?.message}>
                  <Input id="ovr-exp" type="date" min="2026-09-17" disabled={permanent} {...form.register("expiresAt")} aria-invalid={!!errors.expiresAt} />
                </Field>
                <Controller
                  control={form.control}
                  name="permanent"
                  render={({ field }) => (
                    <div className="flex items-center gap-1.5 pb-2">
                      <Checkbox id="ovr-perm" checked={field.value} onCheckedChange={(c) => field.onChange(!!c)} />
                      <Label htmlFor="ovr-perm">Permanent (not recommended)</Label>
                    </div>
                  )}
                />
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => guard.onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Save override</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard.guard}
    </>
  );
}
