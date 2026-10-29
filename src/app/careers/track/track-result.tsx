"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, FileCheck2, FileUp, HeartHandshake } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import { candidateTimeline, type Candidate, type TimelineEvent } from "@/mock/hiring";
import { DOCS_BY_STAGE, PUBLIC_STAGES, trackingToken } from "@/mock/lifecycle-public";
import { Timeline, type TimelineItem } from "@/components/lifecycle/kit";
import { Card } from "@/components/ui/card";
import { Alert, Badge } from "@/components/ui/primitives";
import { mockAction } from "@/components/app-state";
import { StageStepper } from "./stage-stepper";

/** Candidate-facing wording for the internal activity trail; `null` hides an internal-only event. */
function publicTitle(e: TimelineEvent): string | null {
  if (e.kind === "note") return null;
  if (e.title === "Offer raised") return null;
  if (e.title.startsWith("Applied via")) return "Application received";
  if (e.title.startsWith("Rejected at")) return "Application closed";
  if (e.title === "Marked as hired") return "Welcome aboard";
  return e.title;
}

export function TrackResult({ candidate }: { candidate: Candidate }) {
  const rejected = candidate.stage === "rejected";
  const docs = rejected ? [] : (DOCS_BY_STAGE[candidate.stage] ?? []);
  const [uploaded, setUploaded] = React.useState<Record<string, string>>({});

  const items: TimelineItem[] = candidateTimeline(candidate.id)
    .map((e) => ({ e, title: publicTitle(e) }))
    .filter((x): x is { e: TimelineEvent; title: string } => x.title !== null)
    .map(({ e, title }, i) => {
      const day = e.at.slice(0, 10);
      const tone: TimelineItem["tone"] =
        day > DEMO_TODAY ? "upcoming" : e.title.startsWith("Rejected at") ? "danger" : i === 0 ? "current" : "done";
      return { at: day, title, tone };
    });

  const reachedLabel = PUBLIC_STAGES.find((s) => s.id === candidate.rejectedAtStage)?.label;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight">{candidate.role}</h2>
            <p className="text-xs text-muted-foreground">
              {candidate.name} · {candidate.location} · applied {fmtDate(candidate.appliedDate)}
            </p>
          </div>
          <Badge variant="muted" className="tnum font-mono">
            {trackingToken(candidate.id)}
          </Badge>
        </div>
        <StageStepper stage={candidate.stage} rejectedAtStage={candidate.rejectedAtStage} />

        {rejected ? (
          <Alert tone="neutral" icon={HeartHandshake} title="We will not be taking this application further">
            Thank you for the time you gave us{reachedLabel ? ` — you reached the ${reachedLabel.toLowerCase()} stage` : ""}.
            We keep your profile for 12 months and a recruiter will reach out if a closer match opens up. You are welcome to{" "}
            <Link href="/careers" className="font-medium text-primary hover:underline">
              apply for other roles
            </Link>{" "}
            at any time.
          </Alert>
        ) : candidate.stage === "hired" ? (
          <Alert tone="success" icon={CheckCircle2} title="You have accepted your offer — welcome to the team">
            Your pre-joining formalities are open.{" "}
            <Link href="/pre-joining" className="font-medium underline">
              Continue to pre-joining
            </Link>
            .
          </Alert>
        ) : (
          <p className="text-xs text-muted-foreground">
            {PUBLIC_STAGES.find((s) => s.id === candidate.stage)?.blurb}
            {candidate.stage === "offer" && (
              <>
                {" "}
                <Link href="/offer" className="font-medium text-primary hover:underline">
                  View your offer
                </Link>
                .
              </>
            )}
          </p>
        )}
      </Card>

      <div className={cn("grid gap-4", docs.length > 0 && "md:grid-cols-[1fr_320px]")}>
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Activity</h2>
          <Timeline items={items} />
        </Card>

        {docs.length > 0 && (
          <Card className="p-5">
            <h2 className="text-sm font-semibold">Pending documents</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Uploading these now keeps the next step from waiting on paperwork.
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {docs.map((d, i) => {
                const file = uploaded[d];
                const inputId = `doc-${i}`;
                return (
                  <li key={d} className="flex items-center justify-between gap-2 rounded-md border border-border p-2.5">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground">{d}</p>
                      <p className={cn("truncate text-[11px]", file ? "text-success-fg" : "text-muted-foreground")}>
                        {file ? `Uploaded · ${file}` : "Not uploaded yet"}
                      </p>
                    </div>
                    {file ? (
                      <FileCheck2 className="size-4 shrink-0 text-success" aria-label="Uploaded" />
                    ) : (
                      <label
                        htmlFor={inputId}
                        className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-md border border-input bg-card px-2 text-xs font-medium hover:bg-muted focus-within:ring-2 focus-within:ring-ring"
                      >
                        <FileUp className="size-3.5" aria-hidden />
                        Upload
                        <input
                          id={inputId}
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="sr-only"
                          aria-label={`Upload ${d}`}
                          onChange={(e) => {
                            const name = e.target.files?.[0]?.name;
                            if (!name) return;
                            setUploaded((u) => ({ ...u, [d]: name }));
                            mockAction(`${d} uploaded`, { description: `${name} is with your recruiter for review.` });
                          }}
                        />
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="tnum mt-3 text-[11px] text-muted-foreground">
              {Object.keys(uploaded).length} of {docs.length} uploaded
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
