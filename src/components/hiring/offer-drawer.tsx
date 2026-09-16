"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { differenceInCalendarDays, parseISO } from "date-fns";
import {
  ArrowUpRight,
  Ban,
  CalendarClock,
  Check,
  Download,
  IndianRupee,
  Send,
  TriangleAlert,
  UserRoundCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDateTime, inr } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import { employeeByCode } from "@/mock/employees";
import {
  OFFER_STATUS_LABEL,
  branchLabel,
  buildCtcBreakup,
  deptLabel,
  reqLabel,
  requisitionByCode,
  type ApprovalStep,
  type Offer,
  type OfferStatus,
} from "@/mock/hiring";
import { mockAction } from "@/components/app-state";
import { Gated } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Alert, Avatar, Badge, Field, Input, Separator } from "@/components/ui/primitives";
import {
  ConfirmDialog,
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/overlays";
import { CtcBreakup } from "./ctc-breakup";

/* ============================================================================
   Offer detail — the CTC breakup, the approval trail, and every action a
   recruiter can take on an offer that is in flight.
   ========================================================================== */

/** Approval actions map onto the shared STATUS_MAP vocabulary. */
const APPROVAL_STATUS: Record<ApprovalStep["action"], string> = {
  Raised: "submitted",
  Approved: "approved",
  Awaiting: "pending",
  Declined: "rejected",
};

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-xs text-foreground">{children}</dd>
    </div>
  );
}

/* ------------------------------------------------------------ revise dialog */

const reviseSchema = z.object({
  ctc: z
    .number({ message: "Enter the revised annual CTC in rupees" })
    .int("Enter a whole rupee amount")
    .min(100000, "That is below any grade in the ladder"),
  reason: z.string().trim().min(10, "Say why the number is changing — this goes on the audit trail"),
});

type ReviseValues = { ctc: number; reason: string };

function ReviseCtcDialog({
  open,
  onOpenChange,
  offer,
  onRevise,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  offer: Offer;
  onRevise: (ctc: number, reason: string) => void;
}) {
  const req = requisitionByCode(offer.reqCode);
  const min = req?.budgetMinCtc ?? 0;
  const max = req?.budgetMaxCtc ?? Number.MAX_SAFE_INTEGER;
  /* A revision may stretch the ceiling by 10%, but not silently — anything
     above the approved band drops the offer back to Pending approval. */
  const hardCeiling = Math.round(max * 1.1);

  const schema = React.useMemo(
    () =>
      reviseSchema
        .refine((v) => v.ctc >= min, {
          path: ["ctc"],
          message: `Below the approved band for ${offer.reqCode} — the floor is ${inr(min, { decimals: false })}`,
        })
        .refine((v) => v.ctc <= hardCeiling, {
          path: ["ctc"],
          message: `More than 10% over the band ceiling of ${inr(max, { decimals: false })}. Raise a band exception first.`,
        }),
    [min, max, hardCeiling, offer.reqCode],
  );

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ReviseValues>({
    resolver: zodResolver(schema),
    defaultValues: { ctc: offer.ctc, reason: "" },
    mode: "onSubmit",
  });

  React.useEffect(() => {
    if (open) reset({ ctc: offer.ctc, reason: "" });
  }, [open, offer.ctc, reset]);

  const nextCtc = Number(watch("ctc")) || 0;
  const delta = nextCtc - offer.ctc;
  const overBand = nextCtc > max;

  const onSubmit = handleSubmit((values) => {
    onRevise(Math.round(values.ctc), values.reason);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Revise offered CTC</DialogTitle>
          <DialogDescription>
            {offer.candidateName} · {offer.role} · band{" "}
            <span className="tnum">
              {inr(min, { decimals: false })} – {inr(max, { decimals: false })}
            </span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <DialogBody className="flex flex-col gap-3">
            <Field
              label="Revised annual CTC"
              htmlFor="revise-ctc"
              required
              error={errors.ctc?.message}
              hint="The full structure is recomputed from this figure."
            >
              <div className="relative">
                <IndianRupee
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="revise-ctc"
                  type="number"
                  step={1000}
                  className="tnum pl-8"
                  aria-invalid={!!errors.ctc}
                  {...register("ctc", { valueAsNumber: true })}
                />
              </div>
            </Field>

            {delta !== 0 && !errors.ctc && (
              <p className="tnum text-xs text-muted-foreground">
                {delta > 0 ? "Increase" : "Reduction"} of{" "}
                <span className="font-medium text-foreground">
                  {inr(Math.abs(delta), { decimals: false })}
                </span>{" "}
                ({((Math.abs(delta) / offer.ctc) * 100).toFixed(1)}%) against the current offer.
              </p>
            )}

            {overBand && (
              <Alert tone="warning" icon={TriangleAlert} title="Above the approved band">
                This revision returns the offer to <strong>Pending approval</strong> and needs a
                fresh sign-off from HR and Finance before it can be released again.
              </Alert>
            )}

            <Field
              label="Reason for the revision"
              htmlFor="revise-reason"
              required
              error={errors.reason?.message}
            >
              <Input
                id="revise-reason"
                placeholder="Counter-offer at the current employer; matched on fixed component"
                aria-invalid={!!errors.reason}
                {...register("reason")}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Revise and recompute</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ drawer */

export function OfferDrawer({
  offer,
  open,
  onOpenChange,
  onStatusChange,
  onCtcChange,
}: {
  offer: Offer | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onStatusChange: (id: string, status: OfferStatus, note: string) => void;
  onCtcChange: (id: string, ctc: number, reason: string) => void;
}) {
  const [confirmWithdraw, setConfirmWithdraw] = React.useState(false);
  const [reviseOpen, setReviseOpen] = React.useState(false);

  if (!offer) return null;

  const req = requisitionByCode(offer.reqCode);
  const daysToExpiry = differenceInCalendarDays(
    parseISO(offer.validTill),
    parseISO(DEMO_TODAY),
  );
  const live = offer.status === "approved" || offer.status === "pending";
  const expiringSoon = live && daysToExpiry <= 3;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" width="sm:max-w-2xl" aria-describedby={undefined}>
          <SheetHeader>
            <div className="flex items-start gap-2.5">
              <Avatar name={offer.candidateName} size={36} />
              <div className="min-w-0 flex-1">
                <SheetTitle className="truncate text-base">{offer.candidateName}</SheetTitle>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {offer.role} · {deptLabel(offer.departmentId)} · {branchLabel(offer.branchId)}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <StatusBadge
                    status={offer.status}
                    label={OFFER_STATUS_LABEL[offer.status]}
                  />
                  <Badge variant="muted">{offer.id}</Badge>
                  <Badge variant="outline">Grade {offer.gradeId}</Badge>
                  <Link
                    href={`/candidates/${offer.candidateId}`}
                    className="inline-flex items-center gap-0.5 rounded text-xs text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Candidate profile
                    <ArrowUpRight className="size-3" aria-hidden />
                  </Link>
                </div>
              </div>
            </div>
          </SheetHeader>

          <SheetBody className="flex flex-col gap-4">
            {expiringSoon && (
              <Alert
                tone={daysToExpiry < 0 ? "danger" : "warning"}
                icon={CalendarClock}
                title={
                  daysToExpiry < 0
                    ? `Validity lapsed ${Math.abs(daysToExpiry)} day${Math.abs(daysToExpiry) === 1 ? "" : "s"} ago`
                    : daysToExpiry === 0
                      ? "Offer validity expires today"
                      : `Offer validity expires in ${daysToExpiry} day${daysToExpiry === 1 ? "" : "s"}`
                }
              >
                Valid till {fmtDate(offer.validTill)}. Extend the window or withdraw the offer —
                an offer that quietly lapses is the worst version of this conversation.
              </Alert>
            )}

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <MetaItem label="Requisition">
                <Link
                  href="/requisitions"
                  className="text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  title={reqLabel(offer.reqCode)}
                >
                  {offer.reqCode}
                </Link>
              </MetaItem>
              <MetaItem label="Hiring manager">
                {employeeByCode(req?.hiringManagerCode ?? "")?.name ?? "—"}
              </MetaItem>
              <MetaItem label="Recruiter">
                {employeeByCode(req?.recruiterCode ?? "")?.name ?? "—"}
              </MetaItem>
              <MetaItem label="Offer date">{fmtDate(offer.offerDate)}</MetaItem>
              <MetaItem label="Valid till">
                <span className={cn(expiringSoon && "font-medium text-warning-fg")}>
                  {fmtDate(offer.validTill)}
                </span>
              </MetaItem>
              <MetaItem label="Joining date">{fmtDate(offer.joiningDate)}</MetaItem>
              <MetaItem label="Approved band">
                <span className="tnum">
                  {inr(req?.budgetMinCtc ?? 0, { decimals: false })} –{" "}
                  {inr(req?.budgetMaxCtc ?? 0, { decimals: false })}
                </span>
              </MetaItem>
              <MetaItem label="Offered CTC">
                <span className="tnum font-semibold">{inr(offer.ctc, { decimals: false })}</span>
              </MetaItem>
              <MetaItem label="Candidate response">
                {offer.respondedAt ? fmtDateTime(offer.respondedAt) : "Awaiting"}
              </MetaItem>
            </dl>

            <Separator />

            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold tracking-tight">CTC breakup</h3>
                  <p className="text-xs text-muted-foreground">
                    Annual cost to company as it appears on the offer letter.
                  </p>
                </div>
                <Gated menuKey="hiring.offers" action="E">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setReviseOpen(true)}
                    disabled={offer.status === "hired" || offer.status === "expired"}
                  >
                    <IndianRupee /> Revise CTC
                  </Button>
                </Gated>
              </div>
              <CtcBreakup
                breakup={offer.breakup}
                ctc={offer.ctc}
                joiningBonus={offer.joiningBonus}
              />
            </section>

            <Separator />

            <section>
              <h3 className="text-sm font-semibold tracking-tight">Approval trail</h3>
              <p className="mb-2.5 text-xs text-muted-foreground">
                Four steps, in order. An offer cannot be released until every one of them is
                green.
              </p>
              <ol className="flex flex-col">
                {offer.approvals.map((step, i) => {
                  const actor = employeeByCode(step.actorCode);
                  const last = i === offer.approvals.length - 1;
                  return (
                    <li key={`${step.actorCode}-${i}`} className="flex gap-2.5">
                      <div className="flex flex-col items-center">
                        <Avatar name={actor?.name ?? step.role} size={26} />
                        {!last && <span className="my-1 w-px flex-1 bg-border" aria-hidden />}
                      </div>
                      <div className={cn("min-w-0 flex-1", !last && "pb-3.5")}>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-xs font-medium text-foreground">
                            {actor?.name ?? step.actorCode}
                          </span>
                          <span className="text-xs text-muted-foreground">{step.role}</span>
                          <StatusBadge
                            status={APPROVAL_STATUS[step.action]}
                            label={step.action}
                          />
                          <span className="ml-auto text-[11px] text-muted-foreground">
                            {step.at ? fmtDateTime(step.at) : "Not yet actioned"}
                          </span>
                        </div>
                        {step.comment && (
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {step.comment}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            <Separator />

            <section>
              <h3 className="text-sm font-semibold tracking-tight">Recruiter notes</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{offer.notes}</p>
            </section>
          </SheetBody>

          <SheetFooter className="flex-wrap">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                mockAction("Offer letter generated", {
                  description: `${offer.id} — ${offer.candidateName}.pdf. In the demo the file is not written to disk.`,
                })
              }
            >
              <Download /> Download offer letter
            </Button>

            {offer.status === "approved" && !offer.respondedAt && (
              <Gated menuKey="hiring.offers" action="E">
                <Button
                  variant="outline"
                  onClick={() =>
                    mockAction("Offer letter sent", {
                      description: `Emailed to ${offer.candidateName} with a response window till ${fmtDate(offer.validTill)}.`,
                    })
                  }
                >
                  <Send /> Release offer
                </Button>
              </Gated>
            )}

            {offer.status === "approved" && !offer.respondedAt && (
              <Gated menuKey="hiring.offers" action="E">
                <Button
                  variant="secondary"
                  onClick={() =>
                    onStatusChange(
                      offer.id,
                      "hired",
                      `${offer.candidateName} accepted — joining ${fmtDate(offer.joiningDate)}.`,
                    )
                  }
                >
                  <UserRoundCheck /> Mark as accepted
                </Button>
              </Gated>
            )}

            {offer.status === "pending" && (
              <Gated menuKey="hiring.offers" action="A">
                <Button
                  onClick={() =>
                    onStatusChange(
                      offer.id,
                      "approved",
                      `${offer.id} approved at ${inr(offer.ctc, { decimals: false })} and ready to release.`,
                    )
                  }
                >
                  <Check /> Approve
                </Button>
              </Gated>
            )}

            {(offer.status === "pending" || offer.status === "approved") && (
              <Gated menuKey="hiring.offers" action="E">
                <Button variant="destructive" onClick={() => setConfirmWithdraw(true)}>
                  <Ban /> Withdraw
                </Button>
              </Gated>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ReviseCtcDialog
        open={reviseOpen}
        onOpenChange={setReviseOpen}
        offer={offer}
        onRevise={(ctc, reason) => onCtcChange(offer.id, ctc, reason)}
      />

      <ConfirmDialog
        open={confirmWithdraw}
        onOpenChange={setConfirmWithdraw}
        title={`Withdraw the offer to ${offer.candidateName}?`}
        description={
          <>
            The offer lapses immediately and the candidate is notified. This is visible on the
            candidate&rsquo;s timeline and cannot be undone from this screen — you would have to
            raise a fresh offer.
          </>
        }
        confirmLabel="Withdraw offer"
        destructive
        onConfirm={() =>
          onStatusChange(
            offer.id,
            "expired",
            `${offer.id} withdrawn. ${offer.candidateName} has been informed.`,
          )
        }
      />
    </>
  );
}

/** Recompute an offer after a CTC revision — band breach pushes it back to Pending. */
export function reviseOffer(offer: Offer, ctc: number, reason: string): Offer {
  const req = requisitionByCode(offer.reqCode);
  const overBand = req ? ctc > req.budgetMaxCtc : false;
  const nextStatus: OfferStatus =
    overBand && offer.status === "approved" ? "pending" : offer.status;

  const approvals: ApprovalStep[] = overBand
    ? offer.approvals.map((step) =>
        step.role === "HR Admin" || step.role === "Finance"
          ? { ...step, action: "Awaiting", at: null, comment: `Re-approval needed: ${reason}` }
          : step,
      )
    : offer.approvals;

  return {
    ...offer,
    ctc,
    breakup: buildCtcBreakup(ctc),
    status: nextStatus,
    approvals,
  };
}
