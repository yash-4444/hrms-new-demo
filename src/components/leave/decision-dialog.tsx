"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Ban, Check, RotateCcw, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { LEAVE_APPLICATIONS, balanceFor, type LeaveApplication } from "@/mock/leave";
import { employeeByCode } from "@/mock/employees";
import { Avatar, Alert, Field, Textarea } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/overlays";

/* ============================================================================
   The manager's decision surface. Reject and Send Back are the two outcomes
   the applicant has to act on, so both refuse to submit without a comment —
   enforced by zod, not by a disabled button.
   ========================================================================== */

export type Decision = "approved" | "rejected" | "sent_back" | "cancelled";

const DECISIONS: {
  value: Decision;
  label: string;
  icon: React.ElementType;
  requiresComment: boolean;
  blurb: string;
}[] = [
  { value: "approved", label: "Approve", icon: Check, requiresComment: false, blurb: "Days are deducted from the balance and the calendar is updated." },
  { value: "rejected", label: "Reject", icon: X, requiresComment: true, blurb: "The request is closed. The applicant must raise a fresh one." },
  { value: "sent_back", label: "Send back", icon: RotateCcw, requiresComment: true, blurb: "Returns to the applicant for edits and keeps the original reference." },
  { value: "cancelled", label: "Cancel", icon: Ban, requiresComment: false, blurb: "Withdraws the request on the applicant's behalf. Nothing is deducted." },
];

const schema = z
  .object({
    decision: z.enum(["approved", "rejected", "sent_back", "cancelled"]),
    comment: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    const needs = DECISIONS.find((d) => d.value === v.decision)?.requiresComment;
    if (needs && v.comment.length < 10) {
      ctx.addIssue({
        code: "custom",
        path: ["comment"],
        message: `A comment of at least 10 characters is required to ${v.decision === "rejected" ? "reject" : "send back"} a request`,
      });
    }
  });

type FormValues = z.infer<typeof schema>;

export function DecisionDialog({
  open,
  onOpenChange,
  application,
  onDecide,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  application: LeaveApplication | null;
  onDecide: (application: LeaveApplication, decision: Decision, comment: string) => void;
}) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { decision: "approved", comment: "" },
  });

  React.useEffect(() => {
    if (open) reset({ decision: "approved", comment: "" });
  }, [open, reset]);

  const decision = watch("decision");
  const active = DECISIONS.find((d) => d.value === decision)!;

  const employee = application ? employeeByCode(application.employeeCode) : undefined;
  const balance = application ? balanceFor(application.employeeCode, application.typeCode) : undefined;

  // Who else from the same team is already out on these dates.
  const clashes = React.useMemo(() => {
    if (!application) return [];
    return LEAVE_APPLICATIONS.filter(
      (a) =>
        a.id !== application.id &&
        a.status === "approved" &&
        a.approverCode === application.approverCode &&
        a.fromDate <= application.toDate &&
        a.toDate >= application.fromDate,
    );
  }, [application]);

  if (!application) return null;

  const submit = (values: FormValues) => {
    onDecide(application, values.decision, values.comment.trim());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{application.id} · {application.typeName}</DialogTitle>
          <DialogDescription>
            {application.employeeName} · {application.department} · applied {fmtDate(application.appliedOn)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(submit)} className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="flex flex-col gap-3.5">
            <div className="flex items-start gap-3 rounded-md border border-border bg-subtle p-3">
              <Avatar name={application.employeeName} size={36} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{application.employeeName}</p>
                <p className="text-xs text-muted-foreground">
                  {employee?.designation ?? "—"} · {application.employeeCode} ·{" "}
                  {application.contactNumber}
                </p>
              </div>
              <StatusBadge status={application.status} />
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
              {[
                ["Dates", `${fmtDate(application.fromDate)} → ${fmtDate(application.toDate)}`],
                ["Deducted", `${application.days} day${application.days === 1 ? "" : "s"}`],
                ["Not deducted", `${application.sandwichDays} weekend / holiday`],
                [
                  "Balance after",
                  balance ? `${Math.round((balance.available - application.days) * 100) / 100} ${application.typeCode}` : "—",
                ],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{k}</dt>
                  <dd className="tnum mt-0.5 text-xs font-medium">{v}</dd>
                </div>
              ))}
            </dl>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Reason given</p>
              <p className="mt-1 rounded-md border border-border bg-card px-2.5 py-2 text-xs">
                {application.reason}
              </p>
            </div>

            {application.documentName && (
              <p className="text-xs text-muted-foreground">
                Attachment: <span className="font-medium text-foreground">{application.documentName}</span>
              </p>
            )}

            {clashes.length > 0 && (
              <Alert tone="warning" icon={Users} title={`${clashes.length} teammate${clashes.length === 1 ? " is" : "s are"} already out on these dates`}>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {clashes.slice(0, 4).map((c) => (
                    <li key={c.id}>
                      {c.employeeName} · {c.typeName} · {fmtDate(c.fromDate)} → {fmtDate(c.toDate)}
                    </li>
                  ))}
                </ul>
              </Alert>
            )}

            <Field label="Decision" required error={errors.decision?.message}>
              <Controller
                control={control}
                name="decision"
                render={({ field }) => (
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="radiogroup" aria-label="Decision">
                    {DECISIONS.map((d) => {
                      const Icon = d.icon;
                      const on = field.value === d.value;
                      return (
                        <button
                          key={d.value}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => field.onChange(d.value)}
                          className={cn(
                            "flex items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-xs font-medium transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            on
                              ? "border-primary bg-primary-soft text-primary-soft-foreground"
                              : "border-border bg-card hover:bg-muted",
                          )}
                        >
                          <Icon className="size-3.5" aria-hidden />
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              />
            </Field>
            <p className="-mt-2 text-xs text-muted-foreground">{active.blurb}</p>

            <Field
              label={`Comment${active.requiresComment ? "" : " (optional)"}`}
              htmlFor="decision-comment"
              error={errors.comment?.message}
              required={active.requiresComment}
              hint={
                active.requiresComment
                  ? "The applicant sees this verbatim — say what needs to change."
                  : "Optional note, stored on the request's timeline."
              }
            >
              <Textarea
                id="decision-comment"
                aria-invalid={!!errors.comment}
                placeholder={
                  decision === "sent_back"
                    ? "e.g. Please attach the medical certificate and resubmit."
                    : decision === "rejected"
                      ? "e.g. Two people from the pod are already out that week."
                      : "e.g. Approved — Karthik will cover the standups."
                }
                {...register("comment")}
              />
            </Field>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant={decision === "rejected" ? "destructive" : "default"}>
              {active.label} request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
