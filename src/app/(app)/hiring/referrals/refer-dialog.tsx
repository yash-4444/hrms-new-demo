"use client";

import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FileText, Paperclip, UserPlus, X } from "lucide-react";

import { inr } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import { REQUISITIONS, deptLabel, requisitionByCode } from "@/mock/hiring";
import { REFERRAL_TENURE_DAYS, bonusFor, type Referral } from "@/mock/lifecycle";
import { useDirtyGuard } from "@/components/lifecycle/kit";
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

/* ============================================================================
   "Refer a friend" — the employee-side form. Only open, approved requisitions
   are referable; the bonus shown is the one the rule table will pay.
   ========================================================================== */

const OPEN_REQS = REQUISITIONS.filter((r) => r.status === "open" && r.approvalStatus === "approved");

const RELATIONSHIPS = ["Former colleague", "College batchmate", "Friend", "Ex-manager's team", "Family"];

const schema = z.object({
  name: z.string().trim().min(3, "Enter the candidate's full name"),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 -]{10,15}$/, "Enter a 10-digit mobile number, with country code if outside India"),
  reqCode: z.string().min(1, "Pick the requisition you are referring for"),
  relationship: z.string().min(1, "How do you know them?"),
  linkedin: z
    .string()
    .trim()
    .refine((v) => v === "" || /^https?:\/\/([a-z]+\.)?linkedin\.com\/in\/[\w-]+\/?$/i.test(v), {
      message: "Use a profile link like https://www.linkedin.com/in/name",
    }),
  why: z.string().trim().min(30, "Tell the recruiter why they fit — at least 30 characters"),
  resume: z.string().min(1, "Attach the candidate's resume"),
});
type Values = z.infer<typeof schema>;

const EMPTY: Values = { name: "", email: "", phone: "", reqCode: "", relationship: "", linkedin: "", why: "", resume: "" };

export function ReferDialog({
  open,
  onOpenChange,
  referrer,
  existing,
  nextId,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  referrer: { code: string; name: string };
  /** Emails already referred — a duplicate is refused inline. */
  existing: string[];
  nextId: string;
  onSubmitted: (r: Referral) => void;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const { errors, isDirty } = form.formState;

  const close = () => {
    onOpenChange(false);
    form.reset(EMPTY);
  };
  const { onOpenChange: guardedChange, guard } = useDirtyGuard(isDirty, close);

  const reqCode = useWatch({ control: form.control, name: "reqCode" });
  const resume = useWatch({ control: form.control, name: "resume" });
  const req = reqCode ? requisitionByCode(reqCode) : undefined;
  const bonus = req ? bonusFor(req.gradeId, req.priority === "Critical") : null;

  const submit = form.handleSubmit((v) => {
    if (existing.includes(v.email.toLowerCase())) {
      form.setError("email", { message: "This person has already been referred — duplicates don't earn a second bonus." });
      return;
    }
    const r = requisitionByCode(v.reqCode)!;
    onSubmitted({
      id: nextId,
      candidateName: v.name,
      candidateEmail: v.email.toLowerCase(),
      role: r.role,
      reqCode: r.code,
      referrerCode: referrer.code,
      referrerName: referrer.name,
      relationship: v.relationship,
      submittedOn: DEMO_TODAY,
      stage: "submitted",
      candidateId: null,
      hiredEmployeeCode: null,
      joiningDate: null,
      bonus: bonusFor(r.gradeId, r.priority === "Critical"),
      bonusStatus: "in_pipeline",
      payoutPeriod: null,
    });
    close();
  });

  return (
    <>
      <Dialog open={open} onOpenChange={guardedChange}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-4 text-primary" aria-hidden /> Refer a friend
            </DialogTitle>
            <DialogDescription>
              Your referral goes straight to the requisition&apos;s recruiter. You can track every stage from My referrals.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} noValidate>
            <DialogBody className="grid gap-3 sm:grid-cols-2">
              <Field label="Candidate name" htmlFor="ref-name" required error={errors.name?.message}>
                <Input id="ref-name" autoComplete="off" {...form.register("name")} aria-invalid={!!errors.name} />
              </Field>
              <Field label="Email" htmlFor="ref-email" required error={errors.email?.message}>
                <Input id="ref-email" type="email" autoComplete="off" {...form.register("email")} aria-invalid={!!errors.email} />
              </Field>
              <Field label="Mobile" htmlFor="ref-phone" required error={errors.phone?.message}>
                <Input id="ref-phone" inputMode="tel" placeholder="+91 98450 12345" {...form.register("phone")} aria-invalid={!!errors.phone} />
              </Field>
              <Field label="Relationship" htmlFor="ref-rel" required error={errors.relationship?.message}>
                <Controller
                  control={form.control}
                  name="relationship"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="ref-rel" aria-invalid={!!errors.relationship}>
                        <SelectValue placeholder="Select…" />
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
              <Field
                label="Requisition"
                htmlFor="ref-req"
                required
                error={errors.reqCode?.message}
                className="sm:col-span-2"
                hint={req && bonus !== null ? `${deptLabel(req.departmentId)} · ${req.gradeId}${req.priority === "Critical" ? " · Critical" : ""} — bonus ${inr(bonus, { decimals: false })} after ${REFERRAL_TENURE_DAYS} days` : undefined}
              >
                <Controller
                  control={form.control}
                  name="reqCode"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="ref-req" aria-invalid={!!errors.reqCode}>
                        <SelectValue placeholder="Choose an open role…" />
                      </SelectTrigger>
                      <SelectContent>
                        {OPEN_REQS.map((r) => (
                          <SelectItem key={r.code} value={r.code}>
                            {r.code} · {r.role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="LinkedIn profile" htmlFor="ref-li" error={errors.linkedin?.message} hint="Optional" className="sm:col-span-2">
                <Input id="ref-li" placeholder="https://www.linkedin.com/in/…" {...form.register("linkedin")} aria-invalid={!!errors.linkedin} />
              </Field>
              <Field label="Why are they a fit?" htmlFor="ref-why" required error={errors.why?.message} className="sm:col-span-2">
                <Textarea
                  id="ref-why"
                  rows={3}
                  placeholder="What you have seen them do, and how it maps to this role."
                  {...form.register("why")}
                  aria-invalid={!!errors.why}
                />
              </Field>
              <Field label="Resume" htmlFor="ref-resume" required error={errors.resume?.message} className="sm:col-span-2">
                {resume ? (
                  <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs">
                    <FileText className="size-3.5 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{resume}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove resume"
                      onClick={() => form.setValue("resume", "", { shouldDirty: true, shouldValidate: true })}
                    >
                      <X />
                    </Button>
                  </div>
                ) : (
                  <Button
                    id="ref-resume"
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    aria-invalid={!!errors.resume}
                    onClick={() => fileRef.current?.click()}
                  >
                    <Paperclip /> Attach PDF or DOCX
                  </Button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="sr-only"
                  tabIndex={-1}
                  aria-label="Resume file"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) form.setValue("resume", f.name, { shouldDirty: true, shouldValidate: true });
                    e.target.value = "";
                  }}
                />
              </Field>
              <Alert tone="info" className="sm:col-span-2">
                The candidate is emailed a consent link before their details reach the pipeline. You are notified at every stage change.
              </Alert>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => guardedChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Submit referral</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}
