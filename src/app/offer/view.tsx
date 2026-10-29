"use client";

import * as React from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { CalendarClock, FileSignature, MessageSquarePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, inr } from "@/lib/format";
import { DEMO_TODAY, TENANT } from "@/mock/org";
import { branchLabel, deptLabel } from "@/mock/hiring";
import { PUBLIC_OFFER, PUBLIC_OFFER_CANDIDATE } from "@/mock/lifecycle-public";
import { PublicShell } from "@/components/lifecycle/public-shell";
import { KV } from "@/components/lifecycle/kit";
import { CtcBreakup } from "@/components/hiring/ctc-breakup";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/primitives";
import { mockAction } from "@/components/app-state";
import { EsignDialog } from "./esign-dialog";
import { DeclineDialog } from "./decline-dialog";
import { ChangeDialog } from "./change-dialog";
import { OutcomePanel, type OfferOutcome } from "./outcome";

/* ============================================================================
   /offer — the candidate's view of a released offer: read it, then accept
   with an e-signature, decline with a reason, or ask for a change.
   ========================================================================== */

const offer = PUBLIC_OFFER;
const candidate = PUBLIC_OFFER_CANDIDATE;

/** G1–G3 serve six months' probation; G4 and above serve three. */
const probationMonths = Number(offer.gradeId.replace(/\D/g, "")) >= 4 ? 3 : 6;
const daysLeft = differenceInCalendarDays(parseISO(offer.validTill), parseISO(DEMO_TODAY));

const TERMS = [
  { title: "Probation", body: `${probationMonths} months, with a written review at the end. Confirmation is automatic if the review is positive.` },
  { title: "Notice period", body: "60 days from either side. Earned leave can be set off against the notice period with your manager’s agreement." },
  { title: "Joining bonus", body: "Paid with your first salary. Recoverable pro rata if you leave within 12 months of joining." },
  { title: "Background verification", body: "Education, last two employers and address — run after you accept, with your consent." },
];

export default function OfferView() {
  const [outcome, setOutcome] = React.useState<OfferOutcome>({ kind: "pending" });
  const [dialog, setDialog] = React.useState<"accept" | "decline" | "change" | null>(null);
  const responded = outcome.kind === "accepted" || outcome.kind === "declined";
  const firstName = candidate.name.split(" ")[0];

  return (
    <PublicShell subtitle="Your offer" nav={false} width="max-w-4xl">
      <header className="mb-6 flex flex-col gap-1">
        <p className="text-xs font-medium text-primary">
          {offer.id} · issued {fmtDate(offer.offerDate)}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Your offer from {TENANT.shortName}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Congratulations, {firstName}. Everything we have agreed is set out below — take your time to read it, and ask us
          if anything is unclear.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        <OutcomePanel outcome={outcome} offerId={offer.id} />

        <Card className="grid gap-4 p-5 sm:grid-cols-3">
          <KV label="Role">{offer.role}</KV>
          <KV label="Team">{deptLabel(offer.departmentId)}</KV>
          <KV label="Location">{branchLabel(offer.branchId)}</KV>
          <KV label="Annual CTC">
            <span className="tnum text-lg font-semibold">{inr(offer.ctc)}</span>
          </KV>
          <KV label="Joining date">
            <span className="tnum">{fmtDate(offer.joiningDate)}</span>
          </KV>
          <KV label="Offer valid till">
            <span className="tnum">{fmtDate(offer.validTill)}</span>
            {!responded && (
              <Badge
                variant="muted"
                className={cn(
                  "tnum ml-2 align-middle",
                  daysLeft <= 3 && daysLeft >= 0 && "border-warning/30 bg-warning-soft text-warning-fg",
                  daysLeft < 0 && "border-destructive/25 bg-destructive-soft text-destructive-fg",
                )}
              >
                <CalendarClock className="size-3" aria-hidden />
                {daysLeft < 0 ? "Expired" : daysLeft === 0 ? "Last day" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
              </Badge>
            )}
          </KV>
          {offer.joiningBonus > 0 && (
            <KV label="Joining bonus (one-time)">
              <span className="tnum">{inr(offer.joiningBonus)}</span>
            </KV>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold">How your CTC is made up</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Annual figures. The rows add up to your CTC to the rupee; the joining bonus sits outside it.
          </p>
          <CtcBreakup breakup={offer.breakup} ctc={offer.ctc} joiningBonus={offer.joiningBonus} />
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold">Key terms</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {TERMS.map((t) => (
              <div key={t.title} className="rounded-md border border-border p-3">
                <dt className="text-xs font-medium text-foreground">{t.title}</dt>
                <dd className="mt-0.5 text-xs text-muted-foreground">{t.body}</dd>
              </div>
            ))}
          </dl>
        </Card>

        {!responded && (
          <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold">Ready to respond?</h2>
              <p className="text-xs text-muted-foreground">
                Accepting takes about a minute. You can also ask for a change before deciding.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setDialog("decline")}>
                <X />
                Decline
              </Button>
              {outcome.kind !== "change" && (
                <Button variant="outline" onClick={() => setDialog("change")}>
                  <MessageSquarePlus />
                  Request a change
                </Button>
              )}
              <Button onClick={() => setDialog("accept")} disabled={daysLeft < 0}>
                <FileSignature />
                Accept offer
              </Button>
            </div>
          </Card>
        )}
      </div>

      <EsignDialog
        open={dialog === "accept"}
        onOpenChange={(v) => setDialog(v ? "accept" : null)}
        candidateName={candidate.name}
        role={offer.role}
        onSigned={(signedBy, method) => {
          setOutcome({ kind: "accepted", signedBy, method, at: DEMO_TODAY });
          mockAction("Offer accepted and signed", {
            description: `${offer.id} signed by ${signedBy} on ${fmtDate(DEMO_TODAY)}. Your recruiter and HR have been notified.`,
          });
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
      <DeclineDialog
        open={dialog === "decline"}
        onOpenChange={(v) => setDialog(v ? "decline" : null)}
        onDeclined={(v) => {
          setOutcome({ kind: "declined", reason: v.reason, comment: v.comment });
          mockAction("Offer declined", { tone: "info", description: "Your recruiter has been notified. Thank you for your time." });
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
      <ChangeDialog
        open={dialog === "change"}
        onOpenChange={(v) => setDialog(v ? "change" : null)}
        minDate={DEMO_TODAY}
        onRequested={(request) => {
          setOutcome({ kind: "change", request });
          mockAction("Change request sent", { description: "Your recruiter will reply within two working days." });
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    </PublicShell>
  );
}
