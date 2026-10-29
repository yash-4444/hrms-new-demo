"use client";

import { Controller, useFieldArray, useForm, useWatch, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { StepFooter } from "./stepper";
import { RELATIONSHIPS, nomineesSchema, type NomineeValues, type Scheme } from "./types";

const MAX_NOMINEES = 3;

const SCHEME_COPY: Record<Scheme, { title: string; body: string }> = {
  pf: { title: "Provident Fund (Form 2)", body: "Who receives your EPF and EPS balance. Family members only, under the EPF Scheme." },
  gratuity: { title: "Gratuity (Form F)", body: "Who receives your gratuity under the Payment of Gratuity Act." },
};

const blank = (share: number) => ({ name: "", relationship: "", share });

export function StepNominees({
  initial,
  onSave,
  onBack,
}: {
  initial?: NomineeValues;
  onSave: (v: NomineeValues) => void;
  onBack: () => void;
}) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitted },
  } = useForm<NomineeValues>({
    resolver: zodResolver(nomineesSchema),
    defaultValues: initial ?? { pf: [blank(100)], gratuity: [blank(100)] },
  });
  const values = useWatch({ control });

  return (
    <form onSubmit={handleSubmit(onSave)} noValidate className="flex flex-col gap-5">
      {(["pf", "gratuity"] as const).map((scheme) => (
        <SchemeBlock
          key={scheme}
          scheme={scheme}
          control={control}
          register={register}
          errors={errors}
          rows={values[scheme] ?? []}
          showTotalError={isSubmitted}
        />
      ))}
      <StepFooter onBack={onBack} />
    </form>
  );
}

function SchemeBlock({
  scheme,
  control,
  register,
  errors,
  rows,
  showTotalError,
}: {
  scheme: Scheme;
  control: Control<NomineeValues>;
  register: UseFormRegister<NomineeValues>;
  errors: FieldErrors<NomineeValues>;
  rows: { share?: number }[];
  showTotalError: boolean;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: scheme });
  const total = rows.reduce((a, r) => a + (Number.isFinite(r.share) ? Number(r.share) : 0), 0);
  const ok = total === 100;
  const headingId = `pj-${scheme}-h`;
  const totalId = `pj-${scheme}-total`;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 rounded-md border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id={headingId} className="text-sm font-semibold">
            {SCHEME_COPY[scheme].title}
          </h3>
          <p className="text-xs text-muted-foreground">{SCHEME_COPY[scheme].body}</p>
        </div>
        <p
          id={totalId}
          aria-live="polite"
          className={cn(
            "tnum rounded-md border px-2 py-0.5 text-xs font-semibold",
            ok ? "border-success/25 bg-success-soft text-success-fg" : "border-warning/30 bg-warning-soft text-warning-fg",
          )}
        >
          Total {total}% {ok ? "· complete" : `· ${total > 100 ? `${total - 100}% over` : `${100 - total}% to allocate`}`}
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {fields.map((f, i) => {
          const rowErr = errors[scheme]?.[i];
          const base = `pj-${scheme}-${i}`;
          return (
            <li key={f.id} className="grid gap-2.5 sm:grid-cols-[1fr_160px_96px_auto] sm:items-start">
              <Field label="Nominee name" htmlFor={`${base}-name`} required error={rowErr?.name?.message}>
                <Input id={`${base}-name`} aria-invalid={!!rowErr?.name} {...register(`${scheme}.${i}.name`)} />
              </Field>
              <Field label="Relationship" htmlFor={`${base}-rel`} required error={rowErr?.relationship?.message}>
                <Controller
                  control={control}
                  name={`${scheme}.${i}.relationship`}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id={`${base}-rel`} aria-invalid={!!rowErr?.relationship} onBlur={field.onBlur}>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {RELATIONSHIPS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Share %" htmlFor={`${base}-share`} required error={rowErr?.share?.message}>
                <Input
                  id={`${base}-share`}
                  type="number"
                  min={1}
                  max={100}
                  className="tnum"
                  aria-invalid={!!rowErr?.share || (showTotalError && !ok)}
                  aria-describedby={totalId}
                  {...register(`${scheme}.${i}.share`, { valueAsNumber: true })}
                />
              </Field>
              <div className="sm:pt-[22px]">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove nominee ${i + 1}`}
                  disabled={fields.length === 1}
                  onClick={() => remove(i)}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {showTotalError && !ok && (
        <p role="alert" className="text-xs text-destructive-fg">
          {SCHEME_COPY[scheme].title.split(" (")[0]} shares must add up to exactly 100% — they add up to {total}% now.
        </p>
      )}

      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={fields.length >= MAX_NOMINEES}
          onClick={() => append(blank(Math.max(0, 100 - total)))}
        >
          <Plus />
          Add nominee
        </Button>
        {fields.length >= MAX_NOMINEES && (
          <span className="ml-2 text-[11px] text-muted-foreground">Up to {MAX_NOMINEES} nominees per scheme.</span>
        )}
      </div>
    </section>
  );
}
