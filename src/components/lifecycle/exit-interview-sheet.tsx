"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field, Label, RadioGroup, RadioGroupItem, Textarea } from "@/components/ui/primitives";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/overlays";
import { EXIT_QUESTIONS, type ExitInterview, type RatingKey } from "@/mock/lifecycle";
import { useDirtyGuard } from "./kit";

/* ----------------------------------------------------------- read sheet */

export function ExitInterviewSheet({ item, onOpenChange }: { item: ExitInterview | null; onOpenChange: (v: boolean) => void }) {
  return (
    <Sheet open={!!item} onOpenChange={onOpenChange}>
      <SheetContent width="sm:max-w-lg">
        {item && (
          <>
            <SheetHeader>
              <SheetTitle>{item.name}</SheetTitle>
              <SheetDescription>
                {item.designation} · exit {fmtDate(item.exitDate)} · interviewed by {item.interviewer} on {fmtDate(item.scheduledOn)}
              </SheetDescription>
            </SheetHeader>
            <SheetBody className="flex flex-col gap-4 overflow-y-auto">
              <p className="text-xs">
                <span className="text-muted-foreground">Primary reason: </span>
                <span className="font-medium">{item.primaryReason}</span>
              </p>
              <ul className="flex flex-col gap-2">
                {EXIT_QUESTIONS.map((q) => {
                  const v = item.ratings?.[q.key] ?? 0;
                  return (
                    <li key={q.key} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-xs">
                      <span>{q.label}</span>
                      <span className="flex shrink-0 items-center gap-0.5" aria-label={`${v} of 5`}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span key={n} className={cn("size-2 rounded-full", n <= v ? (v <= 2 ? "bg-destructive" : v === 3 ? "bg-warning" : "bg-success") : "bg-muted")} aria-hidden />
                        ))}
                        <span className="tnum ml-1.5 font-medium">{v}/5</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div>
                <p className="text-xs font-semibold">What could we have done to keep you?</p>
                <blockquote className="mt-1 border-l-2 border-border pl-3 text-xs italic text-muted-foreground">“{item.keepUs}”</blockquote>
              </div>
              <p className="text-xs">
                <span className="text-muted-foreground">Would consider returning: </span>
                <span className="font-medium">{item.wouldReturn}</span>
              </p>
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* -------------------------------------------------------- record dialog */

const schema = z.object({
  recommend: z.number().int().min(1, "Rate 1–5").max(5),
  manager: z.number().int().min(1, "Rate 1–5").max(5),
  growth: z.number().int().min(1, "Rate 1–5").max(5),
  pay: z.number().int().min(1, "Rate 1–5").max(5),
  keepUs: z.string().trim().min(15, "Capture their words — fifteen characters or more"),
  wouldReturn: z.enum(["Yes", "Maybe", "No"], { message: "Choose one" }),
});
type Values = z.infer<typeof schema>;

export function RecordInterviewDialog({
  item,
  onClose,
  onSave,
}: {
  item: ExitInterview;
  onClose: () => void;
  onSave: (v: { ratings: Record<RatingKey, number>; keepUs: string; wouldReturn: "Yes" | "Maybe" | "No" }) => void;
}) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { recommend: 0, manager: 0, growth: 0, pay: 0, keepUs: "" } });
  const { errors, isDirty } = form.formState;
  const { onOpenChange, guard } = useDirtyGuard(isDirty, onClose);
  return (
    <>
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Record exit interview — {item.name}</DialogTitle>
            <DialogDescription>Responses are confidential to HR and feed the anonymised themes across all interviews.</DialogDescription>
          </DialogHeader>
          <form
            noValidate
            onSubmit={form.handleSubmit((v) => {
              onSave({ ratings: { recommend: v.recommend, manager: v.manager, growth: v.growth, pay: v.pay }, keepUs: v.keepUs, wouldReturn: v.wouldReturn });
              onClose();
            })}
          >
            <DialogBody className="flex flex-col gap-3.5">
              {EXIT_QUESTIONS.map((q) => (
                <Field key={q.key} label={q.label} required error={errors[q.key]?.message}>
                  <Controller
                    control={form.control}
                    name={q.key}
                    render={({ field }) => (
                      <RadioGroup value={field.value ? String(field.value) : ""} onValueChange={(v) => field.onChange(Number(v))} className="flex gap-3" aria-label={q.label}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span key={n} className="flex items-center gap-1">
                            <RadioGroupItem id={`${q.key}-${n}`} value={String(n)} />
                            <Label htmlFor={`${q.key}-${n}`} className="tnum">
                              {n}
                            </Label>
                          </span>
                        ))}
                      </RadioGroup>
                    )}
                  />
                </Field>
              ))}
              <Field label="What could we have done to keep you?" htmlFor="ri-keep" required error={errors.keepUs?.message}>
                <Textarea id="ri-keep" aria-invalid={!!errors.keepUs} {...form.register("keepUs")} />
              </Field>
              <Field label="Would you consider returning?" required error={errors.wouldReturn?.message}>
                <Controller
                  control={form.control}
                  name="wouldReturn"
                  render={({ field }) => (
                    <RadioGroup value={field.value ?? ""} onValueChange={field.onChange} className="flex gap-4">
                      {(["Yes", "Maybe", "No"] as const).map((r) => (
                        <span key={r} className="flex items-center gap-1.5">
                          <RadioGroupItem id={`ri-r-${r}`} value={r} />
                          <Label htmlFor={`ri-r-${r}`}>{r}</Label>
                        </span>
                      ))}
                    </RadioGroup>
                  )}
                />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Save responses</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}
