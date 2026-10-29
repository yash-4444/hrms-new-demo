"use client";

import Link from "next/link";
import { CircleCheck, Megaphone, Sparkles, Star } from "lucide-react";

import { fmtDate } from "@/lib/format";
import { deptLabel } from "@/mock/hiring";
import { daysSince, type PoolCandidate, type PoolMatch } from "@/mock/lifecycle";
import { AI_TONE, AiSuggestionCard } from "@/components/ai";
import { Gated } from "@/components/shell/page";
import { KV } from "@/components/lifecycle/kit";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, EmptyState } from "@/components/ui/primitives";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/overlays";

/* ============================================================================
   Talent-pool profile — who they are, how far they got last time, and the
   AI's read on which open requisitions they fit today.
   ========================================================================== */

export const matchKey = (poolId: string, reqCode: string) => `${poolId}:${reqCode}`;

export const agoLabel = (iso: string) => {
  const d = daysSince(iso);
  return d <= 0 ? "Today" : d === 1 ? "Yesterday" : `${d} days ago`;
};

export function ProfileSheet({
  person,
  open,
  onOpenChange,
  dismissed,
  added,
  canAdd,
  linkPipeline,
  onAccept,
  onDismiss,
  onReengage,
}: {
  person: PoolCandidate | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dismissed: Set<string>;
  added: Set<string>;
  canAdd: boolean;
  linkPipeline: boolean;
  onAccept: (p: PoolCandidate, m: PoolMatch) => void;
  onDismiss: (p: PoolCandidate, m: PoolMatch) => void;
  onReengage: (p: PoolCandidate) => void;
}) {
  const matches = person ? person.matches.filter((m) => !dismissed.has(matchKey(person.id, m.reqCode))) : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent width="sm:max-w-lg">
        {person && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2.5">
                <Avatar name={person.name} size={36} />
                <span className="min-w-0">
                  <span className="block truncate">{person.name}</span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {person.currentTitle} · {person.currentCompany}
                  </span>
                </span>
              </SheetTitle>
              <SheetDescription className="sr-only">Talent pool profile and AI requisition matches</SheetDescription>
            </SheetHeader>

            <SheetBody className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-1">
                {person.tags.map((t) => (
                  <Badge key={t} variant="soft">
                    {t}
                  </Badge>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-md border border-border p-3">
                <KV label="Experience">{person.experienceYears} years</KV>
                <KV label="Department">{deptLabel(person.departmentId)}</KV>
                <KV label="Last assessed for">{person.lastRole}</KV>
                <KV label="Furthest stage">{person.lastStageReached}</KV>
                <KV label="Last contacted">
                  <span className="tnum">
                    {fmtDate(person.lastContacted)} <span className="text-muted-foreground">· {agoLabel(person.lastContacted)}</span>
                  </span>
                </KV>
                <KV label="Panel rating">
                  <span className="tnum inline-flex items-center gap-1">
                    <Star className="size-3.5 fill-warning text-warning" aria-hidden /> {person.rating.toFixed(1)} / 5
                  </span>
                </KV>
                <KV label="Original source">{person.source}</KV>
                <KV label="Email">
                  <span className="block truncate">{person.email}</span>
                </KV>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-semibold text-foreground">Skills</p>
                <div className="flex flex-wrap gap-1">
                  {person.skills.map((s) => (
                    <Badge key={s} variant="outline">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>

              <section aria-labelledby="ai-match-h" className="flex flex-col gap-2">
                <h3 id="ai-match-h" className={`flex items-center gap-1.5 text-xs font-semibold ${AI_TONE.text}`}>
                  <Sparkles className="size-3.5" aria-hidden /> AI match to open requisitions
                </h3>
                {matches.length === 0 ? (
                  <EmptyState
                    icon={Sparkles}
                    title="No open requisitions match right now"
                    description="Matches are recomputed whenever a requisition in this department is approved."
                    className="py-6"
                  />
                ) : (
                  matches.map((m) => {
                    const isAdded = added.has(matchKey(person.id, m.reqCode));
                    return isAdded ? (
                      <div
                        key={m.reqCode}
                        className="flex items-center gap-2 rounded-md border border-success/25 bg-success-soft px-3 py-2 text-xs text-success-fg"
                      >
                        <CircleCheck className="size-4 shrink-0" aria-hidden />
                        <span className="min-w-0 flex-1">
                          Added to <span className="font-medium">{m.reqCode} · {m.role}</span> as Applied.
                        </span>
                        {linkPipeline && (
                          <Link href="/candidates" className="font-medium underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                            Open pipeline
                          </Link>
                        )}
                      </div>
                    ) : (
                      <AiSuggestionCard
                        key={m.reqCode}
                        title={`${m.score}% match · ${m.role}`}
                        confidence={m.score}
                        acceptLabel="Add to requisition pipeline"
                        onAccept={canAdd ? () => onAccept(person, m) : undefined}
                        onDismiss={() => onDismiss(person, m)}
                        body={
                          <>
                            <p className="tnum mb-1 text-muted-foreground">{m.reqCode}</p>
                            <ul className="flex list-disc flex-col gap-0.5 pl-4">
                              {m.reasons.map((r) => (
                                <li key={r}>{r}</li>
                              ))}
                            </ul>
                          </>
                        }
                      />
                    );
                  })
                )}
              </section>
            </SheetBody>

            <SheetFooter>
              <Gated menuKey="hiring.talent_pool" action="C">
                <Button size="sm" variant="outline" onClick={() => onReengage(person)}>
                  <Megaphone /> Re-engage
                </Button>
              </Gated>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
