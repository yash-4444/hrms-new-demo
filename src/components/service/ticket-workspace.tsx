"use client";

import * as React from "react";
import { ArrowUpRight, CheckCircle2, Lock, MessageSquareText, Send, UserCheck, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "@/lib/format";
import { DEMO_NOW } from "@/mock/org";
import { MACROS, type QueueTicket } from "@/mock/service";
import type { TicketMessage } from "@/mock/workplace";
import { useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, Textarea } from "@/components/ui/primitives";
import {
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { Gated } from "@/components/shell/page";
import { ChannelChip, PriorityChip, ReasonDialog, SlaChip } from "./kit";
import { TicketAiPanel } from "./ticket-ai-panel";

export type TicketPatch = Partial<QueueTicket>;

/** Agent workspace: conversation, internal notes, macros, AI assist and the ticket's actions. */
export function TicketWorkspace({
  ticket,
  onOpenChange,
  onUpdate,
}: {
  ticket: QueueTicket | null;
  onOpenChange: (v: boolean) => void;
  onUpdate: (id: string, patch: TicketPatch, toast: string, description?: string) => void;
}) {
  const { persona } = useApp();
  const [draft, setDraft] = React.useState("");
  const [internal, setInternal] = React.useState(false);
  const [escalating, setEscalating] = React.useState(false);
  const [closing, setClosing] = React.useState(false);
  const composer = React.useRef<HTMLTextAreaElement>(null);

  /* The parent keys this component by ticket id, so the draft resets per ticket. */
  if (!ticket) return <Sheet open={false} onOpenChange={onOpenChange} />;
  const done = ticket.status === "resolved" || ticket.status === "cancelled";

  const send = () => {
    const body = draft.trim();
    if (body.length < 2) return;
    const msg: TicketMessage = {
      id: `${ticket.id}-R${ticket.thread.length + 1}`,
      authorCode: persona.employeeId,
      authorName: persona.name,
      authorRole: persona.role,
      at: DEMO_NOW,
      body,
      internal,
    };
    onUpdate(
      ticket.id,
      { thread: [...ticket.thread, msg], status: internal ? ticket.status : "pending", updatedAt: DEMO_NOW },
      internal ? "Internal note added" : `Reply sent to ${ticket.requesterName}`,
      internal ? "Visible to agents only." : `Via ${ticket.channel}.`,
    );
    setDraft("");
  };

  return (
    <>
      <Sheet open onOpenChange={onOpenChange}>
        <SheetContent width="sm:max-w-5xl">
          <SheetHeader>
            <SheetTitle className="pr-6">
              <span className="font-mono text-xs text-muted-foreground">{ticket.id}</span> {ticket.subject}
            </SheetTitle>
            <SheetDescription asChild>
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge status={ticket.status} />
                <PriorityChip priority={ticket.priority} />
                <Badge variant="muted">{ticket.category}</Badge>
                <ChannelChip channel={ticket.channel} />
                <SlaChip state={ticket.slaState} minutes={ticket.slaMinutesRemaining} done={done} />
                <span className="text-xs text-muted-foreground">· {ticket.requesterName}, {ticket.requesterBranch} · assigned to {ticket.assigneeName}</span>
              </div>
            </SheetDescription>
          </SheetHeader>
          <SheetBody className="grid min-h-0 flex-1 gap-4 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                <Gated menuKey="helpdesk.queue" action="E">
                  <Button size="sm" variant="outline" disabled={done || ticket.assigneeCode === persona.employeeId}
                    onClick={() => onUpdate(ticket.id, { assigneeCode: persona.employeeId, assigneeName: persona.name }, `${ticket.id} assigned to you`)}>
                    <UserCheck /> Assign to me
                  </Button>
                </Gated>
                <Gated menuKey="helpdesk.queue" action="E">
                  <Button size="sm" variant="outline" disabled={done} onClick={() => setEscalating(true)}>
                    <ArrowUpRight /> Escalate
                  </Button>
                </Gated>
                <Gated menuKey="helpdesk.queue" action="A">
                  <Button size="sm" disabled={done} onClick={() => setClosing(true)}>
                    <CheckCircle2 /> Resolve
                  </Button>
                </Gated>
              </div>

              <ol className="flex flex-col gap-2.5" aria-label="Conversation">
                {ticket.thread.map((m) => (
                  <li
                    key={m.id}
                    className={cn(
                      "rounded-md border p-3",
                      m.internal ? "border-dashed border-warning/50 bg-warning-soft/60" : m.authorCode === ticket.requesterCode ? "border-border bg-subtle" : "border-border bg-card",
                    )}
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs">
                      <Avatar name={m.authorName} size={20} />
                      <span className="font-medium">{m.authorName}</span>
                      <span className="text-muted-foreground">{m.authorRole}</span>
                      {m.internal && (
                        <span className="inline-flex items-center gap-1 rounded border border-warning/40 px-1 text-[10px] font-semibold text-warning-fg">
                          <Lock className="size-2.5" aria-hidden /> Internal note
                        </span>
                      )}
                      <span className="tnum ml-auto text-[11px] text-muted-foreground">{fmtDateTime(m.at)}</span>
                    </div>
                    <p className="whitespace-pre-line text-xs text-foreground">{m.body}</p>
                  </li>
                ))}
              </ol>

              {!done && (
                <div className={cn("rounded-md border p-2", internal ? "border-dashed border-warning/50 bg-warning-soft/40" : "border-border")}>
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    <div role="radiogroup" aria-label="Message type" className="inline-flex rounded-md border border-border p-0.5">
                      {[{ v: false, l: "Reply", i: MessageSquareText }, { v: true, l: "Internal note", i: Lock }].map((o) => (
                        <button key={o.l} type="button" role="radio" aria-checked={internal === o.v} onClick={() => setInternal(o.v)}
                          className={cn("inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium", internal === o.v ? "bg-primary-soft text-primary-soft-foreground" : "text-muted-foreground hover:bg-muted")}>
                          <o.i className="size-3" aria-hidden /> {o.l}
                        </button>
                      ))}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost"><Zap /> Macros</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-72">
                        <DropdownMenuLabel>Canned responses</DropdownMenuLabel>
                        {MACROS.filter((mc) => mc.category === "Any" || mc.category === ticket.category).map((mc) => (
                          <DropdownMenuItem key={mc.id} onSelect={() => setDraft((d) => (d ? `${d}\n\n${mc.body}` : mc.body))}>
                            {mc.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <Textarea
                    ref={composer}
                    aria-label={internal ? "Internal note" : `Reply to ${ticket.requesterName}`}
                    placeholder={internal ? "Only agents see internal notes." : `Reply to ${ticket.requesterName}…`}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="min-h-24"
                  />
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground">{internal ? "Not sent to the requester." : `Sent via ${ticket.channel}.`}</p>
                    <Gated menuKey="helpdesk.queue" action="E">
                      <Button size="sm" disabled={draft.trim().length < 2} onClick={send}>
                        {internal ? <Lock /> : <Send />} {internal ? "Add note" : "Send reply"}
                      </Button>
                    </Gated>
                  </div>
                </div>
              )}
            </div>

            <TicketAiPanel
              key={ticket.id}
              ticket={ticket}
              onApplyTriage={() =>
                onUpdate(ticket.id, { category: ticket.ai.category, priority: ticket.ai.priority }, "AI triage applied", `${ticket.ai.category} · ${ticket.ai.priority}`)
              }
              onUseReply={(text, edit) => {
                setInternal(false);
                setDraft(text);
                if (edit) requestAnimationFrame(() => composer.current?.focus());
              }}
            />
          </SheetBody>
        </SheetContent>
      </Sheet>

      <ReasonDialog
        open={escalating}
        onOpenChange={setEscalating}
        title={`Escalate ${ticket.id}?`}
        description={`Moves the ticket to the ${ticket.assigneeTeam} lead and notifies them now.`}
        confirmLabel="Escalate"
        destructive={false}
        commentLabel="Why it needs escalation"
        onConfirm={(reason) => onUpdate(ticket.id, { priority: ticket.priority === "Low" ? "Medium" : ticket.priority }, `${ticket.id} escalated`, reason)}
      />
      <ConfirmDialog
        open={closing}
        onOpenChange={setClosing}
        title={`Resolve ${ticket.id}?`}
        description={`${ticket.requesterName} is asked to rate the support. Replying within 7 days reopens the ticket.`}
        confirmLabel="Resolve ticket"
        onConfirm={() => onUpdate(ticket.id, { status: "resolved", resolvedAt: DEMO_NOW, slaState: "sla_ok" }, `${ticket.id} resolved`)}
      />
    </>
  );
}
