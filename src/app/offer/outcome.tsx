"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, MessageSquareText, XCircle } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { TENANT } from "@/mock/org";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/primitives";
import { KV } from "@/components/lifecycle/kit";
import { CHANGE_TOPICS, type ChangeValues } from "./change-dialog";

export type OfferOutcome =
  | { kind: "pending" }
  | { kind: "accepted"; signedBy: string; method: "drawn" | "typed"; at: string }
  | { kind: "declined"; reason: string; comment: string }
  | { kind: "change"; request: ChangeValues };

/** What the candidate sees once they have responded. */
export function OutcomePanel({ outcome, offerId }: { outcome: OfferOutcome; offerId: string }) {
  if (outcome.kind === "accepted") {
    return (
      <Card className="flex flex-col gap-4 border-success/30 p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-success-fg">
            <CheckCircle2 className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-base font-semibold tracking-tight">Offer accepted — welcome to {TENANT.shortName}</h2>
            <p className="text-xs text-muted-foreground">
              A countersigned copy of {offerId} is on its way to your inbox. Your pre-joining checklist is open now.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <KV label="Signed by">{outcome.signedBy}</KV>
          <KV label="Signed on">
            <span className="tnum">{fmtDate(outcome.at)}</span>
          </KV>
          <KV label="Method">{outcome.method === "drawn" ? "Drawn e-signature" : "Typed e-signature"}</KV>
        </div>
        <div>
          <Button asChild>
            <Link href="/pre-joining">
              Continue to pre-joining
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </Card>
    );
  }

  if (outcome.kind === "declined") {
    return (
      <Card className="flex flex-col gap-3 p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <XCircle className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-base font-semibold tracking-tight">You declined this offer</h2>
            <p className="text-xs text-muted-foreground">
              Thank you for letting us know. Your recruiter has been notified, and we would be glad to hear from you again
              — every open role is on the{" "}
              <Link href="/careers" className="text-primary hover:underline">
                careers page
              </Link>
              .
            </p>
          </div>
        </div>
        <KV label="Reason you gave">
          {outcome.reason}
          <span className="block text-xs text-muted-foreground">{outcome.comment}</span>
        </KV>
      </Card>
    );
  }

  if (outcome.kind === "change") {
    const topic = CHANGE_TOPICS.find((t) => t.value === outcome.request.topic)?.label ?? "Offer terms";
    return (
      <Alert tone="info" icon={MessageSquareText} title={`Change requested · ${topic}`}>
        {outcome.request.proposedDate ? `Preferred joining date ${fmtDate(outcome.request.proposedDate)}. ` : ""}
        Your recruiter will reply within two working days. The offer below stays valid while we discuss it — you can still
        accept or decline it as it stands.
      </Alert>
    );
  }

  return null;
}
