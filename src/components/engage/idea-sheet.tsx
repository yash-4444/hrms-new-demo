"use client";

import * as React from "react";
import { Check, Rocket, Send, ThumbsUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import { IDEA_STATUS_LABEL, type Idea, type IdeaStatus } from "@/mock/engage";
import { Gated } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Alert, Avatar, Badge, Input } from "@/components/ui/primitives";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { DecisionDialog, nameOf, personLine } from "./kit";

export const IDEA_BADGE: Record<IdeaStatus, string> = {
  new: "submitted",
  under_review: "in_review",
  accepted: "approved",
  implemented: "completed",
  declined: "rejected",
};

export function IdeaSheet({
  idea,
  voted,
  onOpenChange,
  onVote,
  onComment,
  onStatus,
}: {
  idea: Idea | null;
  voted: boolean;
  onOpenChange: (v: boolean) => void;
  onVote: () => void;
  onComment: (text: string) => void;
  onStatus: (s: IdeaStatus, note?: string) => void;
}) {
  const [draft, setDraft] = React.useState("");
  const [declining, setDeclining] = React.useState(false);
  const inputId = React.useId();

  return (
    <>
      <Sheet open={!!idea} onOpenChange={onOpenChange}>
        <SheetContent width="sm:max-w-lg">
          {idea && (
            <>
              <SheetHeader>
                <SheetTitle>{idea.title}</SheetTitle>
                <SheetDescription>
                  {idea.id} · {nameOf(idea.authorCode)} · submitted {fmtDate(idea.submittedOn)}
                </SheetDescription>
              </SheetHeader>
              <SheetBody className="flex flex-col gap-3 overflow-y-auto">
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={IDEA_BADGE[idea.status]} label={IDEA_STATUS_LABEL[idea.status]} />
                  <Badge variant="outline">{idea.category}</Badge>
                  <button
                    type="button"
                    aria-pressed={voted}
                    onClick={onVote}
                    className={cn(
                      "ml-auto inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs",
                      voted ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border hover:bg-muted",
                    )}
                  >
                    <ThumbsUp className="size-3.5" aria-hidden /> <span className="tnum">{idea.votes}</span>
                    <span className="sr-only">{voted ? "Remove vote" : "Vote"}</span>
                  </button>
                </div>
                <p className="text-sm leading-relaxed">{idea.body}</p>
                <p className="text-[11px] text-muted-foreground">{personLine(idea.authorCode)}</p>
                {idea.decisionNote && (
                  <Alert tone={idea.status === "declined" ? "neutral" : "success"} title="Decision from People Ops">
                    {idea.decisionNote}
                  </Alert>
                )}

                <div className="flex flex-col gap-2 border-t border-border pt-3">
                  <h3 className="text-xs font-semibold">Comments ({idea.comments.length})</h3>
                  {idea.comments.map((c, i) => (
                    <div key={i} className="flex gap-2">
                      <Avatar name={nameOf(c.authorCode)} size={24} />
                      <div className="min-w-0 flex-1 rounded-md bg-muted px-2.5 py-1.5 text-xs">
                        <p>
                          <span className="font-semibold">{nameOf(c.authorCode)}</span>{" "}
                          <span className="text-[11px] text-muted-foreground">{fmtDateTime(c.at)}</span>
                        </p>
                        <p>{c.text}</p>
                      </div>
                    </div>
                  ))}
                  <form
                    className="flex gap-1.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!draft.trim()) return;
                      onComment(draft.trim());
                      setDraft("");
                    }}
                  >
                    <label htmlFor={inputId} className="sr-only">
                      Add a comment
                    </label>
                    <Input id={inputId} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a comment…" className="h-8 text-xs" />
                    <Button type="submit" size="sm" disabled={!draft.trim()} aria-label="Post comment">
                      <Send />
                    </Button>
                  </form>
                </div>
              </SheetBody>
              <SheetFooter className="flex-wrap">
                {idea.status === "new" && (
                  <Gated menuKey="engage.ideas" action="E">
                    <Button variant="outline" size="sm" onClick={() => onStatus("under_review")}>
                      Move to review
                    </Button>
                  </Gated>
                )}
                {(idea.status === "new" || idea.status === "under_review") && (
                  <>
                    <Gated menuKey="engage.ideas" action="A">
                      <Button variant="outline" size="sm" onClick={() => setDeclining(true)}>
                        <X /> Decline
                      </Button>
                    </Gated>
                    <Gated menuKey="engage.ideas" action="A">
                      <Button size="sm" onClick={() => onStatus("accepted", "Accepted by People Ops — an owner will be assigned this week.")}>
                        <Check /> Accept
                      </Button>
                    </Gated>
                  </>
                )}
                {idea.status === "accepted" && (
                  <Gated menuKey="engage.ideas" action="A">
                    <Button size="sm" onClick={() => onStatus("implemented", `Implemented on ${fmtDate(DEMO_TODAY)}.`)}>
                      <Rocket /> Mark implemented
                    </Button>
                  </Gated>
                )}
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
      <DecisionDialog
        open={declining}
        onOpenChange={setDeclining}
        title="Decline this idea?"
        description="The author and everyone who voted will see your note. Be specific — a clear 'why not' keeps ideas coming."
        confirmLabel="Decline idea"
        commentLabel="Note to the author"
        onConfirm={(note) => onStatus("declined", note)}
      />
    </>
  );
}
