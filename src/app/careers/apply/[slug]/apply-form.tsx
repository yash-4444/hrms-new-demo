"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { TENANT } from "@/mock/org";
import type { JobPosting } from "@/mock/hiring";
import { parseResume } from "@/mock/lifecycle-public";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, Field, Input, Label, Textarea } from "@/components/ui/primitives";
import { ConfirmDialog, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { AI_TONE, AiDraftBanner } from "@/components/ai";
import { mockAction } from "@/components/app-state";
import { AI_FIELDS, NOTICE_OPTIONS, applySchema, emptyApply, type AiField, type ApplyValues } from "./schema";
import { ResumeField } from "./resume-field";

const AI_RING = "border-violet-400 ring-2 ring-violet-500/25 dark:border-violet-400/60";

function AiNote() {
  return (
    <span className={cn("inline-flex items-center gap-1", AI_TONE.text)}>
      <Sparkles className="size-3" aria-hidden />
      Filled by AI — please check
    </span>
  );
}

export function ApplyForm({ job, onSubmitted }: { job: JobPosting; onSubmitted: (v: ApplyValues) => void }) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<ApplyValues>({ resolver: zodResolver(applySchema), defaultValues: emptyApply() });

  const [aiFields, setAiFields] = React.useState<Set<AiField>>(() => new Set());
  const [parsing, setParsing] = React.useState(false);
  const [discardOpen, setDiscardOpen] = React.useState(false);

  const [resumeName, notice, consent] = useWatch({ control, name: ["resumeName", "noticePeriod", "consent"] });

  const clearAi = (f: AiField) =>
    setAiFields((prev) => {
      if (!prev.has(f)) return prev;
      const next = new Set(prev);
      next.delete(f);
      return next;
    });
  const isAi = (f: AiField) => aiFields.has(f);
  const hint = (f: AiField, fallback?: React.ReactNode) => (isAi(f) ? <AiNote /> : fallback);

  const autofill = () => {
    setParsing(true);
    window.setTimeout(() => {
      const p = parseResume(job, resumeName);
      const opts = { shouldDirty: true, shouldValidate: true } as const;
      setValue("fullName", p.fullName, opts);
      setValue("email", p.email, opts);
      setValue("phone", p.phone, opts);
      setValue("experienceYears", p.experienceYears, opts);
      setValue("currentCompany", p.currentCompany, opts);
      setValue("skills", p.skills, opts);
      setValue("education", p.education, opts);
      setAiFields(new Set(AI_FIELDS));
      setParsing(false);
      mockAction("Resume read — 7 fields filled", {
        tone: "info",
        description: "AI suggestions are highlighted in violet. Check each one before you submit.",
      });
    }, 900);
  };

  const onSubmit = handleSubmit((values) => onSubmitted(values));

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold">Start with your resume</h2>
        <ResumeField
          fileName={resumeName}
          error={errors.resumeName?.message}
          parsing={parsing}
          parsed={aiFields.size > 0}
          onChoose={(name) => setValue("resumeName", name, { shouldDirty: true, shouldValidate: true })}
          onClear={() => setValue("resumeName", "", { shouldDirty: true })}
          onAutofill={autofill}
        />
      </Card>

      {aiFields.size > 0 && (
        <AiDraftBanner>
          AI suggestion — we pre-filled {aiFields.size} field{aiFields.size === 1 ? "" : "s"} from your resume. Highlighted
          fields are unchecked; the highlight clears as soon as you edit one. Nothing is sent until you submit.
        </AiDraftBanner>
      )}

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold">About you</h2>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Full name" htmlFor="apply-name" required error={errors.fullName?.message} hint={hint("fullName")}>
            <Input
              id="apply-name"
              autoComplete="name"
              aria-invalid={!!errors.fullName}
              className={cn(isAi("fullName") && AI_RING)}
              {...register("fullName", { onChange: () => clearAi("fullName") })}
            />
          </Field>
          <Field label="Email" htmlFor="apply-email" required error={errors.email?.message} hint={hint("email")}>
            <Input
              id="apply-email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              className={cn(isAi("email") && AI_RING)}
              {...register("email", { onChange: () => clearAi("email") })}
            />
          </Field>
          <Field label="Phone" htmlFor="apply-phone" required error={errors.phone?.message} hint={hint("phone")}>
            <Input
              id="apply-phone"
              type="tel"
              autoComplete="tel"
              placeholder="+91 98450 00000"
              aria-invalid={!!errors.phone}
              className={cn(isAi("phone") && AI_RING)}
              {...register("phone", { onChange: () => clearAi("phone") })}
            />
          </Field>
          <Field label="Notice period" htmlFor="apply-notice" required error={errors.noticePeriod?.message}>
            <Select value={notice} onValueChange={(v) => setValue("noticePeriod", v, { shouldValidate: true, shouldDirty: true })}>
              <SelectTrigger id="apply-notice" aria-invalid={!!errors.noticePeriod}>
                <SelectValue placeholder="How soon can you start?" />
              </SelectTrigger>
              <SelectContent>
                {NOTICE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold">Experience and education</h2>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field
            label="Years of experience"
            htmlFor="apply-exp"
            required
            error={errors.experienceYears?.message}
            hint={hint("experienceYears")}
          >
            <Input
              id="apply-exp"
              type="number"
              step={0.5}
              min={0}
              aria-invalid={!!errors.experienceYears}
              className={cn("tnum", isAi("experienceYears") && AI_RING)}
              {...register("experienceYears", { valueAsNumber: true, onChange: () => clearAi("experienceYears") })}
            />
          </Field>
          <Field
            label="Current company"
            htmlFor="apply-company"
            hint={hint("currentCompany", "Optional — leave blank if you are between roles.")}
          >
            <Input
              id="apply-company"
              autoComplete="organization"
              className={cn(isAi("currentCompany") && AI_RING)}
              {...register("currentCompany", { onChange: () => clearAi("currentCompany") })}
            />
          </Field>
          <Field
            label="Key skills"
            htmlFor="apply-skills"
            required
            className="sm:col-span-2"
            error={errors.skills?.message}
            hint={hint("skills", "Comma-separated, most relevant first.")}
          >
            <Textarea
              id="apply-skills"
              rows={2}
              className={cn("min-h-[56px]", isAi("skills") && AI_RING)}
              aria-invalid={!!errors.skills}
              {...register("skills", { onChange: () => clearAi("skills") })}
            />
          </Field>
          <Field
            label="Highest education"
            htmlFor="apply-edu"
            required
            className="sm:col-span-2"
            error={errors.education?.message}
            hint={hint("education", "Degree, institution and year.")}
          >
            <Input
              id="apply-edu"
              aria-invalid={!!errors.education}
              className={cn(isAi("education") && AI_RING)}
              {...register("education", { onChange: () => clearAi("education") })}
            />
          </Field>
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-start gap-2.5">
            <Checkbox
              id="apply-consent"
              checked={consent}
              aria-invalid={!!errors.consent}
              onCheckedChange={(v) => setValue("consent", v === true, { shouldValidate: true, shouldDirty: true })}
              className="mt-0.5"
            />
            <Label htmlFor="apply-consent" className="font-normal leading-relaxed text-muted-foreground">
              I consent to {TENANT.legalName} storing my application for 12 months and contacting me about this and similar
              roles. I can ask for it to be deleted at any time by writing to {TENANT.supportEmail}.
            </Label>
          </div>
          {errors.consent && (
            <p role="alert" className="text-xs text-destructive-fg">
              {errors.consent.message}
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" disabled={!isDirty} onClick={() => setDiscardOpen(true)}>
            Discard
          </Button>
          <Button type="submit" disabled={parsing}>
            <Send />
            Submit application
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard this application?"
        description="Everything you have entered, including the attached resume, will be cleared."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => {
          reset(emptyApply());
          setAiFields(new Set());
          mockAction("Application cleared", { tone: "info" });
        }}
      />
    </form>
  );
}
