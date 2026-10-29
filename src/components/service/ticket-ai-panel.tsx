"use client";

import * as React from "react";
import { History, Tags } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { AiBadge, AiCitation, AiConfidence, AiSuggestionCard } from "@/components/ai";
import { Button } from "@/components/ui/button";
import { Gated } from "@/components/shell/page";
import { queueTicket, type QueueTicket } from "@/mock/service";
import { PriorityChip, SentimentChip } from "./kit";

/**
 * The AI column of the ticket workspace: triage (category + priority with
 * confidence), sentiment, a KB-grounded reply with numbered citations, and
 * similar resolved tickets. Nothing is applied until the agent accepts.
 */
export function TicketAiPanel({
  ticket,
  onApplyTriage,
  onUseReply,
}: {
  ticket: QueueTicket;
  onApplyTriage: () => void;
  onUseReply: (text: string, edit: boolean) => void;
}) {
  const [triageDismissed, setTriageDismissed] = React.useState(false);
  const [replyDismissed, setReplyDismissed] = React.useState(false);
  const ai = ticket.ai;
  const agrees = ai.category === ticket.category && ai.priority === ticket.priority;
  const similar = ai.similar.map((id) => queueTicket(id)).filter((t): t is QueueTicket => !!t);
  const plain = ai.reply.replace(/\s\[\d\]/g, "");

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border border-border p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold"><Tags className="size-3.5" aria-hidden /> Triage</p>
          <AiBadge />
        </div>
        <dl className="grid grid-cols-[5.5rem_1fr] items-center gap-x-2 gap-y-1.5 text-xs">
          <dt className="text-muted-foreground">Category</dt>
          <dd className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium">{ai.category}</span>
            <AiConfidence value={ai.categoryConfidence} />
          </dd>
          <dt className="text-muted-foreground">Priority</dt>
          <dd className="flex flex-wrap items-center gap-1.5">
            <PriorityChip priority={ai.priority} />
            <AiConfidence value={ai.priorityConfidence} />
          </dd>
          <dt className="text-muted-foreground">Sentiment</dt>
          <dd><SentimentChip sentiment={ai.sentiment} /></dd>
        </dl>
        <p className="mt-2 text-[11px] text-muted-foreground">{ai.reason}</p>
        {!agrees && !triageDismissed && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <p className="text-[11px] text-foreground">
              Differs from the ticket ({ticket.category} · {ticket.priority}).
            </p>
            <Gated menuKey="helpdesk.queue" action="E">
              <Button size="sm" variant="outline" onClick={onApplyTriage}>Apply suggestion</Button>
            </Gated>
            <Button size="sm" variant="ghost" onClick={() => setTriageDismissed(true)}>Keep as is</Button>
          </div>
        )}
      </div>

      {!replyDismissed && (
        <AiSuggestionCard
          title="Suggested reply"
          confidence={ai.categoryConfidence > 80 ? 88 : 69}
          body={
            <div className="flex flex-col gap-2">
              <p className="whitespace-pre-line">{ai.reply}</p>
              <div className="flex flex-col gap-1">
                <p className="text-[11px] font-medium text-muted-foreground">Grounded in</p>
                {ai.citations.map((c, i) => (
                  <AiCitation key={`${c.docId}-${c.section}`} index={i + 1} docTitle={c.docTitle} section={c.section} page={c.page} href="/ai/knowledge" />
                ))}
              </div>
            </div>
          }
          acceptLabel="Use reply"
          onAccept={() => onUseReply(plain, false)}
          onEdit={() => onUseReply(plain, true)}
          onDismiss={() => setReplyDismissed(true)}
        />
      )}

      <div className="rounded-md border border-border p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold"><History className="size-3.5" aria-hidden /> Similar resolved tickets</p>
        {similar.length === 0 ? (
          <p className="text-xs text-muted-foreground">No resolved {ticket.category} tickets yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {similar.map((s) => (
              <li key={s.id} className="text-xs">
                <p className="font-medium">
                  <span className="font-mono text-[11px] text-muted-foreground">{s.id}</span> {s.subject}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Resolved {s.resolvedAt ? fmtDate(s.resolvedAt) : "—"} by {s.assigneeName}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
