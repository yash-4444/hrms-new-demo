"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { SurveyKind } from "@/mock/engage";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch } from "@/components/ui/primitives";
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
import { useDirtyGuard } from "./kit";

const KINDS: SurveyKind[] = ["Engagement", "eNPS pulse", "Onboarding", "Exit"];

const schema = z
  .object({
    title: z.string().trim().min(5, "Give the survey a title (5+ characters)"),
    kind: z.enum(["Engagement", "eNPS pulse", "Onboarding", "Exit"]),
    audience: z.string().trim().min(3, "Who is it for?"),
    opensOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick an opening date"),
    closesOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a closing date"),
    anonymous: z.boolean(),
  })
  .refine((v) => v.closesOn > v.opensOn, { path: ["closesOn"], message: "Must close after it opens" })
  .refine((v) => v.opensOn >= "2026-09-16", { path: ["opensOn"], message: "Cannot open in the past" });

export type SurveyDraft = z.infer<typeof schema>;

const DEFAULTS: SurveyDraft = { title: "", kind: "eNPS pulse", audience: "All employees", opensOn: "", closesOn: "", anonymous: true };

export function CreateSurveyDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (v: SurveyDraft) => void;
}) {
  const form = useForm<SurveyDraft>({ resolver: zodResolver(schema), defaultValues: DEFAULTS });
  const close = () => {
    onOpenChange(false);
    form.reset(DEFAULTS);
  };
  const { onOpenChange: guarded, guard } = useDirtyGuard(form.formState.isDirty, close);
  const errors = form.formState.errors;

  return (
    <>
      <Dialog open={open} onOpenChange={guarded}>
        <DialogContent size="md">
          <form
            noValidate
            onSubmit={form.handleSubmit((v) => {
              onCreate(v);
              close();
            })}
          >
            <DialogHeader>
              <DialogTitle>New survey</DialogTitle>
              <DialogDescription>Starts from the standard question set for its type. It is saved as scheduled until the opening date.</DialogDescription>
            </DialogHeader>
            <DialogBody className="grid gap-3 sm:grid-cols-2">
              <Field label="Title" htmlFor="sv-title" required error={errors.title?.message} className="sm:col-span-2">
                <Input id="sv-title" placeholder="eNPS Pulse — Q4" aria-invalid={!!errors.title} {...form.register("title")} />
              </Field>
              <Field label="Type" htmlFor="sv-kind" required>
                <Select value={form.watch("kind")} onValueChange={(v) => form.setValue("kind", v as SurveyKind, { shouldDirty: true })}>
                  <SelectTrigger id="sv-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {k}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Audience" htmlFor="sv-aud" required error={errors.audience?.message}>
                <Input id="sv-aud" aria-invalid={!!errors.audience} {...form.register("audience")} />
              </Field>
              <Field label="Opens" htmlFor="sv-open" required error={errors.opensOn?.message}>
                <Input id="sv-open" type="date" aria-invalid={!!errors.opensOn} {...form.register("opensOn")} />
              </Field>
              <Field label="Closes" htmlFor="sv-close" required error={errors.closesOn?.message}>
                <Input id="sv-close" type="date" aria-invalid={!!errors.closesOn} {...form.register("closesOn")} />
              </Field>
              <label className="flex items-center gap-2 text-xs font-medium sm:col-span-2">
                <Switch
                  checked={form.watch("anonymous")}
                  onCheckedChange={(v) => form.setValue("anonymous", v, { shouldDirty: true })}
                  aria-label="Anonymous responses"
                />
                Anonymous — results shown only for groups of 5 or more
              </label>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => guarded(false)}>
                Cancel
              </Button>
              <Button type="submit">Create survey</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}
