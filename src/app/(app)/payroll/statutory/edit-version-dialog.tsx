"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { fmtDate } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import { statCurrent, type StatSection, type StatVersion } from "@/mock/finance-statutory";
import { GuardedDialog } from "@/components/finance/kit";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { Alert, Field, Input, Textarea } from "@/components/ui/primitives";

/* ============================================================================
   Edit = a new, future-dated version. The version in force is never mutated,
   so a later run (or an auditor) can always see which rate applied when.
   ========================================================================== */

function schemaFor(section: StatSection) {
  const values = z.object(
    Object.fromEntries(
      section.params.map((p) => [
        p.key,
        p.kind === "number"
          ? z
              .string()
              .trim()
              .min(1, `${p.label} is required`)
              .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, `${p.label} must be a number of zero or more`)
          : z.string().trim().min(1, `${p.label} is required`),
      ]),
    ),
  );
  return z.object({
    effectiveFrom: z
      .string()
      .min(1, "Pick the date the new version takes effect")
      .refine((v) => v > DEMO_TODAY, "A new version must start after today — the current version is never edited in place")
      .refine((v) => v.endsWith("-01"), "Statutory versions start on the 1st of a month, aligned to a pay period"),
    note: z.string().trim().min(10, "Cite the notification or reason (at least 10 characters)"),
    values,
  });
}

type FormValues = { effectiveFrom: string; note: string; values: Record<string, string> };

export function EditVersionDialog({
  section,
  open,
  onOpenChange,
  onSave,
}: {
  section: StatSection;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (v: StatVersion) => void;
}) {
  const current = statCurrent(section);
  const schema = React.useMemo(() => schemaFor(section), [section]);
  const defaults = React.useMemo<FormValues>(
    () => ({ effectiveFrom: "2026-10-01", note: "", values: { ...current.values } }),
    [current],
  );
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults });

  React.useEffect(() => {
    if (open) form.reset(defaults);
  }, [open, defaults, form]);

  const errors = form.formState.errors;
  const submit = form.handleSubmit((v) => {
    onSave({
      version: section.versions[section.versions.length - 1].version + 1,
      effectiveFrom: v.effectiveFrom,
      values: v.values,
      changedBy: "",
      changedOn: "",
      note: v.note.trim(),
    });
    onOpenChange(false);
  });

  return (
    <GuardedDialog open={open} onOpenChange={onOpenChange} dirty={form.formState.isDirty} size="lg">
      <DialogHeader>
        <DialogTitle>New version — {section.title}</DialogTitle>
        <DialogDescription>
          Version {current.version} stays in force until the new effective date. Runs for periods before that date keep
          using version {current.version}.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} noValidate>
        <DialogBody className="flex flex-col gap-3.5">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Effective from" htmlFor="sv-from" required error={errors.effectiveFrom?.message}>
              <Input id="sv-from" type="date" min="2026-10-01" aria-invalid={!!errors.effectiveFrom} {...form.register("effectiveFrom")} />
            </Field>
            <Field label="Current version" hint={`Effective ${fmtDate(current.effectiveFrom)}`}>
              <Input value={`v${current.version}`} readOnly disabled />
            </Field>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            {section.params.map((p) => {
              const err = errors.values?.[p.key]?.message;
              const id = `sv-${p.key}`;
              return (
                <Field key={p.key} label={p.label} htmlFor={id} required error={err} hint={[p.unit, p.hint].filter(Boolean).join(" · ") || undefined}>
                  <Input
                    id={id}
                    inputMode={p.kind === "number" ? "decimal" : undefined}
                    className={p.kind === "number" ? "tnum" : undefined}
                    aria-invalid={!!err}
                    {...form.register(`values.${p.key}`)}
                  />
                </Field>
              );
            })}
          </div>
          <Field label="Reason / notification reference" htmlFor="sv-note" required error={errors.note?.message}>
            <Textarea
              id="sv-note"
              rows={2}
              placeholder="e.g. EPFO circular WSU/2026/1234 — wage ceiling revised"
              aria-invalid={!!errors.note}
              {...form.register("note")}
            />
          </Field>
          <Alert tone="info">
            The change is recorded in the history with your name and the previous values. Payslips already published are
            not recalculated.
          </Alert>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit">Schedule version {section.versions[section.versions.length - 1].version + 1}</Button>
        </DialogFooter>
      </form>
    </GuardedDialog>
  );
}
