"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, EyeOff, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import type { Survey } from "@/mock/engage";
import { mockAction } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, EmptyState, RadioGroup, RadioGroupItem, Textarea } from "@/components/ui/primitives";

const LIKERT = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];

export function SurveyTake({ survey }: { survey: Survey }) {
  const [submitted, setSubmitted] = React.useState(survey.respondedByMe);

  const schema = React.useMemo(
    () =>
      z.object(
        Object.fromEntries(
          survey.questions.map((q) => [
            q.id,
            q.kind === "text" ? z.string().trim().max(1000, "Keep it under 1,000 characters") : z.string().min(1, "Please answer this question"),
          ]),
        ),
      ),
    [survey.questions],
  );
  const form = useForm<Record<string, string>>({
    resolver: zodResolver(schema),
    defaultValues: Object.fromEntries(survey.questions.map((q) => [q.id, ""])),
  });
  const errors = form.formState.errors;

  if (submitted)
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Thank you — your response is in"
        description={survey.anonymous ? "Your answers are anonymous and only reported in groups of five or more." : "HR will read every answer. Thank you for being candid."}
      />
    );
  if (survey.status !== "active")
    return (
      <EmptyState
        icon={Lock}
        title={survey.status === "scheduled" ? `Opens ${fmtDate(survey.opensOn)}` : "This survey is closed"}
        description={survey.status === "scheduled" ? "You will get an in-app notification when it opens." : `Responses closed on ${fmtDate(survey.closesOn)}.`}
      />
    );

  return (
    <form
      noValidate
      className="mx-auto flex w-full max-w-2xl flex-col gap-3"
      onSubmit={form.handleSubmit(() => {
        setSubmitted(true);
        mockAction("Response submitted", { description: survey.anonymous ? "Recorded anonymously." : "Recorded against your profile." });
      })}
    >
      {survey.anonymous ? (
        <Alert tone="info" icon={EyeOff} title="This survey is anonymous">
          Your name is never attached to your answers. Results are only shown for groups of five or more, and open-text comments are reviewed for identifying details before HR sees them.
        </Alert>
      ) : (
        <Alert tone="neutral" title="This survey is not anonymous">
          HR can see your name next to your answers so they can follow up with you.
        </Alert>
      )}

      {survey.questions.map((q, i) => {
        const err = errors[q.id]?.message;
        const value = form.watch(q.id);
        const set = (v: string) => form.setValue(q.id, v, { shouldDirty: true, shouldValidate: true });
        return (
          <Card key={q.id} className="p-4">
            <fieldset aria-describedby={err ? `${q.id}-err` : undefined}>
              <legend className="text-sm font-medium">
                <span className="tnum mr-1.5 text-muted-foreground">{i + 1}.</span>
                {q.text}
              </legend>

              {q.kind === "likert" && (
                <RadioGroup value={value} onValueChange={set} className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-5" aria-label={q.text}>
                  {LIKERT.map((label, li) => (
                    <label
                      key={label}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs sm:flex-col sm:text-center",
                        value === String(li + 1) && "border-primary bg-primary-soft",
                      )}
                    >
                      <RadioGroupItem value={String(li + 1)} />
                      {label}
                    </label>
                  ))}
                </RadioGroup>
              )}

              {q.kind === "enps" && (
                <div className="mt-3">
                  <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={q.text}>
                    {Array.from({ length: 11 }, (_, n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={value === String(n)}
                        onClick={() => set(String(n))}
                        className={cn(
                          "tnum size-9 rounded-md border text-sm transition-colors",
                          value === String(n) ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] text-muted-foreground" style={{ maxWidth: 11 * 40 }}>
                    <span>Not at all likely</span>
                    <span>Extremely likely</span>
                  </div>
                </div>
              )}

              {q.kind === "text" && (
                <Textarea className="mt-3" rows={4} aria-label={q.text} placeholder="Optional" {...form.register(q.id)} />
              )}

              {err && (
                <p id={`${q.id}-err`} role="alert" className="mt-2 text-xs text-destructive-fg">
                  {err}
                </p>
              )}
            </fieldset>
          </Card>
        );
      })}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={!form.formState.isDirty} onClick={() => form.reset()}>
          Clear answers
        </Button>
        <Button type="submit">Submit response</Button>
      </div>
    </form>
  );
}
