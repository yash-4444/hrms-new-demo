"use client";

import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/primitives";
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
import { employeeByCode } from "@/mock/employees";
import { CASE_TYPES, type CaseType } from "@/mock/service";
import { useDirtyGuard } from "./kit";

const schema = z.object({
  type: z.enum(CASE_TYPES as [CaseType, ...CaseType[]]),
  title: z.string().trim().min(10, "Summarise the matter in a line (10+ characters)"),
  subjectCode: z
    .string()
    .trim()
    .refine((c) => c === "" || !!employeeByCode(c.toUpperCase()), "No employee with that code — leave blank if not applicable"),
  complainant: z.string().trim().min(3, "Who raised it? Use 'Anonymous' if withheld"),
  description: z.string().trim().min(20, "Describe what was reported (20+ characters)"),
});
export type NewCaseValues = z.infer<typeof schema>;

const DEFAULTS: NewCaseValues = { type: "Grievance", title: "", subjectCode: "", complainant: "", description: "" };

/** Opens a confidential HR case. POSH referrals are restricted to the Internal Committee on save. */
export function NewCaseDialog({ open, onOpenChange, onSave }: { open: boolean; onOpenChange: (v: boolean) => void; onSave: (v: NewCaseValues) => void }) {
  const { register, handleSubmit, control, reset, formState } = useForm<NewCaseValues>({ resolver: zodResolver(schema), defaultValues: DEFAULTS });
  const type = useWatch({ control, name: "type" });
  const close = () => {
    reset(DEFAULTS);
    onOpenChange(false);
  };
  const { onOpenChange: guarded, guard } = useDirtyGuard(formState.isDirty, close);
  const submit = handleSubmit((v) => {
    onSave(v);
    reset(DEFAULTS);
    onOpenChange(false);
  });
  const e = formState.errors;

  return (
    <>
      <Dialog open={open} onOpenChange={guarded}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Open an HR case</DialogTitle>
            <DialogDescription>
              {type === "POSH referral"
                ? "POSH referrals go straight to the Internal Committee; you will not be able to see the case after saving."
                : "Visible to the case owner and HR Admin only. Every view is written to the access log."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} noValidate>
            <DialogBody className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Case type" htmlFor="nc-type" required>
                <Controller
                  control={control}
                  name="type"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="nc-type"><SelectValue /></SelectTrigger>
                      <SelectContent>{CASE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Raised by" htmlFor="nc-by" required error={e.complainant?.message}>
                <Input id="nc-by" placeholder="Employee name or 'Anonymous'" aria-invalid={!!e.complainant} {...register("complainant")} />
              </Field>
              <Field label="Summary" htmlFor="nc-title" required error={e.title?.message} className="sm:col-span-2">
                <Input id="nc-title" aria-invalid={!!e.title} {...register("title")} />
              </Field>
              <Field label="Concerning (employee code)" htmlFor="nc-subject" error={e.subjectCode?.message} hint="Optional">
                <Input id="nc-subject" placeholder="STL-0187" aria-invalid={!!e.subjectCode} {...register("subjectCode")} />
              </Field>
              <Field label="What was reported" htmlFor="nc-desc" required error={e.description?.message} className="sm:col-span-2">
                <Textarea id="nc-desc" className="min-h-28" aria-invalid={!!e.description} {...register("description")} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => guarded(false)}>Cancel</Button>
              <Button type="submit">Open case</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}
