"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Check, Lock, Octagon, RotateCcw, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateTime, hm } from "@/lib/format";
import type { MenuKey } from "@/lib/rbac";
import type { SlaState, Ticket } from "@/mock/workplace";
import { useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Alert, Avatar, Badge, Hint, Textarea } from "@/components/ui/primitives";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { Gated } from "@/components/shell/page";

/* ============================================================================
   One ticket, read as a conversation. Internal notes are shown only to a
   persona on the agent queue — a requester never sees them — and only an
   agent can write one. Requesters act on their own tickets under
   workplace.helpdesk; agents act on anyone's under helpdesk.queue.
   ========================================================================== */

/* SLA chips are colour + icon + text, never colour alone. */
const SLA_META: Record<SlaState, { label: string; icon: React.ElementType; cls: string }> = {
  sla_ok: { label: "On track", icon: Check, cls: "border-success/25 bg-success-soft text-success-fg" },
  sla_at_risk: { label: "At risk", icon: AlertTriangle, cls: "border-warning/30 bg-warning-soft text-warning-fg" },
  sla_breached: { label: "Breached", icon: Octagon, cls: "border-destructive/25 bg-destructive-soft text-destructive-fg" },
};

export function SlaChip({ state, minutes }: { state: SlaState; minutes: number }) {
  const m = SLA_META[state];
  const Icon = m.icon;
  const abs = Math.abs(minutes);
  return (
    <Hint text={minutes < 0 ? `Breached ${hm(abs)} ago` : `${hm(abs)} left before the SLA is breached`}>
      <span
        className={cn(
          "inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-xs font-medium",
          m.cls,
        )}
      >
        <Icon className="size-3" aria-hidden />
        {m.label}
        <span className="tnum opacity-80">
          {minutes < 0 ? "−" : ""}
          {hm(abs)}
        </span>
      </span>
    </Hint>
  );
}

export function TicketThreadSheet({
  ticket,
  onOpenChange,
  onPost,
  onStatus,
}: {
  ticket: Ticket | null;
  onOpenChange: (v: boolean) => void;
  onPost: (t: Ticket, body: string, internal: boolean) => void;
  onStatus: (t: Ticket, next: Ticket["status"]) => void;
}) {
  const { persona, can } = useApp();
  const [reply, setReply] = React.useState("");
  const [internal, setInternal] = React.useState(false);

  const isAgent = can("helpdesk.queue", "V");
  const canNote = can("helpdesk.queue", "E");
  const own = ticket?.requesterCode === persona.employeeId;
  const actKey: MenuKey = own ? "workplace.helpdesk" : "helpdesk.queue";
  const asNote = internal && canNote;
  const thread = ticket ? ticket.thread.filter((m) => isAgent || !m.internal) : [];

  const close = (v: boolean) => {
    if (!v) {
      setReply("");
      setInternal(false);
    }
    onOpenChange(v);
  };

  return (
    <Sheet open={!!ticket} onOpenChange={close}>
      <SheetContent side="right" width="sm:max-w-2xl">
        {ticket && (
          <>
            <SheetHeader>
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="tnum">{ticket.ticketNo}</SheetTitle>
                <StatusBadge status={ticket.status} />
                <SlaChip state={ticket.slaState} minutes={ticket.slaMinutesRemaining} />
              </div>
              <SheetDescription>{ticket.subject}</SheetDescription>
            </SheetHeader>

            <SheetBody className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                Raised by{" "}
                {can("people.directory", "V") ? (
                  <Link href={`/employees/${ticket.requesterCode}`} className="font-medium text-foreground hover:underline">
                    {ticket.requesterName}
                  </Link>
                ) : (
                  <span className="font-medium text-foreground">{ticket.requesterName}</span>
                )}{" "}
                ({ticket.requesterBranch}) · {fmtDateTime(ticket.createdAt)} · {ticket.slaHours}h SLA, due{" "}
                {fmtDateTime(ticket.slaDueAt)}
              </p>
              <div className="flex flex-wrap gap-1">
                <Badge variant="muted">{ticket.category}</Badge>
                <Badge variant="muted">{ticket.priority}</Badge>
                <Badge variant="outline">
                  {ticket.assigneeName} · {ticket.assigneeTeam}
                </Badge>
                {ticket.tags.map((t) => (
                  <Badge key={t} variant="outline">
                    #{t}
                  </Badge>
                ))}
              </div>

              {ticket.slaState === "sla_breached" && (
                <Alert tone="danger" icon={Octagon} title="SLA breached">
                  This ticket passed its {ticket.slaHours}-hour commitment {hm(Math.abs(ticket.slaMinutesRemaining))} ago.
                  It appears on the weekly SLA report until it is resolved.
                </Alert>
              )}

              <ul className="flex flex-col gap-3">
                {thread.map((m) => (
                  <li
                    key={m.id}
                    className={cn("rounded-md border p-3", m.internal ? "border-warning/30 bg-warning-soft/40" : "border-border bg-card")}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Avatar name={m.authorName} size={22} />
                      <span className="text-xs font-medium">{m.authorName}</span>
                      <span className="text-[10px] text-muted-foreground">{m.authorRole}</span>
                      {m.internal && (
                        <Badge variant="outline" className="border-warning/40 text-warning-fg">
                          <Lock className="size-3" aria-hidden /> Internal note
                        </Badge>
                      )}
                      <span className="tnum ml-auto text-[10px] text-muted-foreground">{fmtDateTime(m.at)}</span>
                    </div>
                    <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed">{m.body}</p>
                    {m.internal && (
                      <p className="mt-1.5 border-t border-warning/25 pt-1.5 text-[10px] text-warning-fg">
                        Internal note — not visible to the requester.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </SheetBody>

            <SheetFooter className="flex-col items-stretch gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Button size="sm" variant={!asNote ? "default" : "outline"} aria-pressed={!asNote} onClick={() => setInternal(false)}>
                  <Send /> {own ? "Reply" : "Reply to requester"}
                </Button>
                {canNote && (
                  <Button size="sm" variant={asNote ? "default" : "outline"} aria-pressed={asNote} onClick={() => setInternal(true)}>
                    <Lock /> Internal note
                  </Button>
                )}
                <span className="ml-auto">
                  {ticket.status !== "resolved" ? (
                    <Gated menuKey={actKey} action="E">
                      <Button size="sm" variant="outline" onClick={() => onStatus(ticket, "resolved")}>
                        <Check /> {own ? "Mark resolved" : "Resolve"}
                      </Button>
                    </Gated>
                  ) : (
                    <Gated menuKey={actKey} action="E">
                      <Button size="sm" variant="outline" onClick={() => onStatus(ticket, "reopened")}>
                        <RotateCcw /> Reopen
                      </Button>
                    </Gated>
                  )}
                </span>
              </div>
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={asNote ? "Context for the team — the requester will never see this…" : own ? "Add a reply for the support team…" : `Reply to ${ticket.requesterName}…`}
                aria-label={asNote ? "Internal note" : "Reply"}
                className={cn("text-xs", asNote && "border-warning/40 bg-warning-soft/30")}
              />
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-muted-foreground">
                  {asNote
                    ? "Stored on the ticket, visible to the assignee team only."
                    : own
                      ? `${ticket.assigneeTeam} is notified straight away.`
                      : `${ticket.requesterName} receives an email and an in-app notification.`}
                </p>
                <Gated menuKey={actKey} action="E">
                  <Button
                    size="sm"
                    className="ml-auto"
                    disabled={!reply.trim()}
                    onClick={() => {
                      onPost(ticket, reply.trim(), asNote);
                      setReply("");
                    }}
                  >
                    {asNote ? <Lock /> : <Send />}
                    {asNote ? "Add note" : "Send reply"}
                  </Button>
                </Gated>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
