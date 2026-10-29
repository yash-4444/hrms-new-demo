"use client";

import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Printer, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { mockAction } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, RadioGroup, RadioGroupItem, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { DEMO_TODAY, TENANT, deptName } from "@/mock/org";
import { employeeByCode } from "@/mock/employees";
import type { ProbationRecord, ProbationReview } from "@/mock/lifecycle";
import { useDirtyGuard } from "./kit";

/* ------------------------------------------------------------ review form */

const reviewSchema = z
  .object({
    rating: z.number().int().min(1, "Rate the probation period").max(5),
    recommendation: z.enum(["Confirm", "Extend", "Terminate"], { message: "Choose a recommendation" }),
    extendMonths: z.number().int().min(1).max(3).optional(),
    comment: z.string().trim().min(20, "Twenty characters or more — what evidence backs this?"),
  })
  .refine((v) => v.recommendation !== "Extend" || !!v.extendMonths, { path: ["extendMonths"], message: "How many months?" });
type ReviewValues = z.infer<typeof reviewSchema>;

export function ReviewDialog({
  record,
  onClose,
  onSubmit,
}: {
  record: ProbationRecord;
  onClose: () => void;
  onSubmit: (r: ProbationReview) => void;
}) {
  const form = useForm<ReviewValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: record.review?.rating ?? 0, recommendation: record.review?.recommendation, extendMonths: record.review?.extendMonths, comment: record.review?.comment ?? "" },
  });
  const { errors, isDirty } = form.formState;
  const { onOpenChange, guard } = useDirtyGuard(isDirty, onClose);
  const rec = useWatch({ control: form.control, name: "recommendation" });
  const e = record.employee;

  return (
    <>
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Probation review — {e.name}</DialogTitle>
            <DialogDescription>
              {e.designation} · joined {fmtDate(e.joiningDate)} · probation ends {fmtDate(record.endDate)}
            </DialogDescription>
          </DialogHeader>
          <form
            noValidate
            onSubmit={form.handleSubmit((v) => {
              onSubmit({ rating: v.rating, recommendation: v.recommendation, extendMonths: v.extendMonths, comment: v.comment, submittedOn: DEMO_TODAY });
              onClose();
            })}
          >
            <DialogBody className="flex flex-col gap-4">
              <Field label="Overall rating" required error={errors.rating?.message}>
                <Controller
                  control={form.control}
                  name="rating"
                  render={({ field }) => (
                    <div role="radiogroup" aria-label="Overall rating" className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          role="radio"
                          aria-checked={field.value === n}
                          aria-label={`${n} of 5`}
                          onClick={() => field.onChange(n)}
                          className="rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Star className={cn("size-5", n <= field.value ? "fill-warning text-warning" : "text-muted-foreground")} aria-hidden />
                        </button>
                      ))}
                    </div>
                  )}
                />
              </Field>
              <Field label="Recommendation" required error={errors.recommendation?.message}>
                <Controller
                  control={form.control}
                  name="recommendation"
                  render={({ field }) => (
                    <RadioGroup value={field.value ?? ""} onValueChange={field.onChange} className="flex flex-wrap gap-4">
                      {(["Confirm", "Extend", "Terminate"] as const).map((r) => (
                        <span key={r} className="flex items-center gap-1.5">
                          <RadioGroupItem id={`rec-${r}`} value={r} />
                          <Label htmlFor={`rec-${r}`}>{r}</Label>
                        </span>
                      ))}
                    </RadioGroup>
                  )}
                />
              </Field>
              {rec === "Extend" && (
                <Field label="Extend by (months)" htmlFor="rv-ext" required error={errors.extendMonths?.message}>
                  <Input id="rv-ext" type="number" min={1} max={3} className="tnum w-24" aria-invalid={!!errors.extendMonths} {...form.register("extendMonths", { valueAsNumber: true })} />
                </Field>
              )}
              <Field label="Evidence and comments" htmlFor="rv-comment" required error={errors.comment?.message}>
                <Textarea id="rv-comment" rows={4} aria-invalid={!!errors.comment} {...form.register("comment")} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Submit review</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}

/* --------------------------------------------------------- extend dialog */

export function ExtendDialog({ record, onClose, onExtend }: { record: ProbationRecord; onClose: () => void; onExtend: (months: number, reason: string) => void }) {
  const [months, setMonths] = React.useState(record.review?.extendMonths ?? 2);
  const [reason, setReason] = React.useState(record.review?.recommendation === "Extend" ? record.review.comment : "");
  const [tried, setTried] = React.useState(false);
  const bad = reason.trim().length < 10;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Extend probation — {record.employee.name}</DialogTitle>
          <DialogDescription>Current end date {fmtDate(record.endDate)}. The employee and manager are notified, and a letter is generated.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3.5">
          <Field label="Extend by" htmlFor="ex-m" required>
            <RadioGroup id="ex-m" value={String(months)} onValueChange={(v) => setMonths(Number(v))} className="flex gap-4">
              {[1, 2, 3].map((m) => (
                <span key={m} className="flex items-center gap-1.5">
                  <RadioGroupItem id={`ex-${m}`} value={String(m)} />
                  <Label htmlFor={`ex-${m}`}>{m} month{m > 1 ? "s" : ""}</Label>
                </span>
              ))}
            </RadioGroup>
          </Field>
          <Field label="Reason" htmlFor="ex-r" required error={tried && bad ? "Add the reason the employee will see (10+ characters)." : undefined}>
            <Textarea id="ex-r" value={reason} aria-invalid={tried && bad} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setTried(true);
              if (bad) return;
              onExtend(months, reason.trim());
              onClose();
            }}
          >
            Extend by {months} month{months > 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------------------------------- confirmation letter */

export function ConfirmationLetter({ record, letterNo, onClose }: { record: ProbationRecord; letterNo: string; onClose: () => void }) {
  const e = record.employee;
  const manager = employeeByCode(e.managerCode ?? "")?.name ?? "your manager";
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Confirmation letter {letterNo}</DialogTitle>
          <DialogDescription>Auto-generated from the confirmation template on approval. Signed digitally by HR.</DialogDescription>
        </DialogHeader>
        <DialogBody className="bg-muted/40">
          <article className="mx-auto max-w-[620px] rounded-sm border border-border bg-card px-8 py-8 text-[13px] leading-relaxed shadow-sm">
            <p className="text-sm font-semibold">{TENANT.legalName}</p>
            <p className="text-[11px] text-muted-foreground">CIN {TENANT.cin}</p>
            <p className="mt-6 tnum">Ref: {letterNo} · {fmtDate(DEMO_TODAY)}</p>
            <p className="mt-4">
              {e.name}
              <br />
              {e.designation}, {deptName(e.departmentId)} · Employee code {e.code}
            </p>
            <p className="mt-4 font-semibold">Subject: Confirmation of employment</p>
            <p className="mt-3">Dear {e.firstName},</p>
            <p className="mt-2">
              Further to your appointment on {fmtDate(e.joiningDate)}, and on the recommendation of {manager}, we are pleased to confirm your employment
              with {TENANT.shortName} with effect from {fmtDate(record.endDate < DEMO_TODAY ? DEMO_TODAY : record.endDate)}.
            </p>
            <p className="mt-2">
              All other terms of your appointment letter remain unchanged. Your notice period from the date of confirmation is as set out in your
              appointment letter.
            </p>
            <p className="mt-2">We thank you for your contribution so far and look forward to your continued association.</p>
            <p className="mt-6">For {TENANT.legalName}</p>
            <p className="mt-6 font-medium">Priya Menon</p>
            <p className="text-[11px] text-muted-foreground">Head — People &amp; Culture · digitally signed {fmtDate(DEMO_TODAY)}</p>
          </article>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => mockAction("Letter sent for printing", { description: `${letterNo} — PDF generated and emailed to ${e.email}.` })}>
            <Printer aria-hidden /> Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
