"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Headset, KeyRound, Play, ShieldQuestion, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtAgo, fmtDateTime } from "@/lib/format";
import { APPROVAL_REQUIRED, type AccessRequest, type AccessRequestStatus } from "@/mock/console-support";
import type { ConsoleTenant } from "@/mock/console-tenants";
import { mockAction, useApp } from "@/components/app-state";
import { useConsole } from "@/components/console/console-state";
import { PlanBadge } from "@/components/console/kit";
import { Section } from "@/components/shell/page";
import { TonePill, type PTone } from "@/components/platform/kit";
import { Button } from "@/components/ui/button";
import { Field, Hint, Input, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";

/* Tenants whose owner must approve support access in advance. The operator
   files a request (reason, ticket, duration); the owner approves or declines
   from their own admin screens; an approved request can be used once. */

const TICKET = /^SUP-\d{3,6}$/i;
const DURATIONS = [15, 30, 60];

const REQ_STYLE: Record<AccessRequestStatus, { tone: PTone; icon: React.ElementType; label: string }> = {
  pending: { tone: "warning", icon: Clock, label: "Awaiting owner" },
  approved: { tone: "success", icon: CheckCircle2, label: "Approved" },
  declined: { tone: "danger", icon: XCircle, label: "Declined" },
  used: { tone: "neutral", icon: CheckCircle2, label: "Used" },
};

export function SupportApprovals({
  requests,
  onRequest,
  onUse,
}: {
  requests: AccessRequest[];
  onRequest: (tenant: ConsoleTenant, r: { reason: string; ticket: string; minutes: number }) => void;
  onUse: (id: string) => void;
}) {
  const { tenants, logActivity } = useConsole();
  const { supportSession, startSupportSession } = useApp();
  const router = useRouter();
  const [asking, setAsking] = React.useState<ConsoleTenant | null>(null);
  const gated = tenants.filter((t) => APPROVAL_REQUIRED.has(t.id));

  const start = (t: ConsoleTenant, r: AccessRequest) => {
    logActivity(t.id, { category: "support", action: "Support session started (read-only)", detail: `${r.ticket} · ${r.minutes} min · approved by ${r.decidedBy} · ${r.reason}` });
    startSupportSession({ tenantId: t.id, tenantName: t.name, ticket: r.ticket, reason: r.reason, minutes: r.minutes });
    onUse(r.id);
    mockAction(`Support session open in ${t.name}`, { description: `${r.ticket} · ${r.minutes} minutes, read-only, under ${r.id}.`, tone: "warning" });
    router.push("/dashboard");
  };

  return (
    <Section
      title="Approval required"
      description="These tenants have switched on “Owner approves support access”. A session opens only after the owner approves the request."
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-border">
        {gated.map((t) => {
          const r = requests.filter((x) => x.tenantId === t.id).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))[0];
          const st = r ? REQ_STYLE[r.status] : null;
          return (
            <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-[200px] flex-1">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {t.name} <PlanBadge plan={t.plan} />
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Owner {t.ownerName} · <span className="font-mono">{t.id}</span>
                </p>
              </div>
              <div className="min-w-[220px] flex-1 text-xs">
                {r && st ? (
                  <>
                    <TonePill tone={st.tone} icon={st.icon}>
                      {st.label}
                      {r.decidedBy && r.status !== "pending" ? ` by ${r.decidedBy}` : ""}
                    </TonePill>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {r.id} · {r.ticket} · {r.operator} · {r.status === "pending" ? `asked ${fmtAgo(r.requestedAt)}` : fmtDateTime(r.decidedAt ?? r.requestedAt)}
                    </p>
                    {r.note && <p className={cn("mt-0.5 text-[11px]", r.status === "declined" ? "text-destructive-fg" : "text-muted-foreground")}>“{r.note}”</p>}
                  </>
                ) : (
                  <span className="text-muted-foreground">No request on file</span>
                )}
              </div>
              <div className="flex shrink-0 gap-1.5">
                {r?.status === "approved" ? (
                  <Hint text={supportSession ? "End the session that is already open first." : ""}>
                    <span className="inline-flex">
                      <Button size="sm" disabled={!!supportSession} onClick={() => start(t, r)}>
                        <Play /> Start {r.minutes}-min session
                      </Button>
                    </span>
                  </Hint>
                ) : r?.status === "pending" ? (
                  <Button size="sm" variant="outline" disabled>
                    <Clock /> Waiting for {t.ownerName.split(" ").slice(-1)[0]}
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setAsking(t)}>
                    <KeyRound /> Request access
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {asking && (
        <RequestAccessDialog
          tenant={asking}
          onOpenChange={(v) => !v && setAsking(null)}
          onConfirm={(r) => {
            onRequest(asking, r);
            setAsking(null);
          }}
        />
      )}
    </Section>
  );
}

function RequestAccessDialog({
  tenant,
  onOpenChange,
  onConfirm,
}: {
  tenant: ConsoleTenant;
  onOpenChange: (v: boolean) => void;
  onConfirm: (r: { reason: string; ticket: string; minutes: number }) => void;
}) {
  const [reason, setReason] = React.useState("");
  const [ticket, setTicket] = React.useState("");
  const [minutes, setMinutes] = React.useState(30);
  const [touched, setTouched] = React.useState(false);
  const reasonOk = reason.trim().length >= 10;
  const ticketOk = TICKET.test(ticket.trim());

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldQuestion className="size-4" aria-hidden /> Request support access — {tenant.name}
          </DialogTitle>
          <DialogDescription>
            {tenant.ownerName} receives the request by email and in their admin inbox. Nothing opens until they approve it.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <Field label="Reason (shown to the owner)" htmlFor="req-reason" required error={touched && !reasonOk ? "At least 10 characters — the owner decides on this." : undefined}>
            <Textarea id="req-reason" value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={touched && !reasonOk} />
          </Field>
          <Field label="Support ticket" htmlFor="req-ticket" required error={touched && !ticketOk ? "Use the ticket reference, e.g. SUP-4417." : undefined}>
            <Input id="req-ticket" value={ticket} onChange={(e) => setTicket(e.target.value)} placeholder="SUP-4417" className="font-mono" autoComplete="off" aria-invalid={touched && !ticketOk} />
          </Field>
          <Field label="Duration" required>
            <div className="flex gap-1.5" role="radiogroup" aria-label="Duration">
              {DURATIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={minutes === m}
                  onClick={() => setMinutes(m)}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-1.5 text-xs focus-visible:ring-2 focus-visible:ring-ring",
                    minutes === m ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border hover:bg-muted",
                  )}
                >
                  {m} min
                </button>
              ))}
            </div>
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={touched && (!reasonOk || !ticketOk)}
            onClick={() => {
              setTouched(true);
              if (reasonOk && ticketOk) onConfirm({ reason: reason.trim(), ticket: ticket.trim().toUpperCase(), minutes });
            }}
          >
            <Headset /> Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
