"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  Clock,
  LifeBuoy,
  Lock,
  Octagon,
  Plus,
  Send,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateTime, hm, num, pct } from "@/lib/format";
import {
  SLA_COMPLIANCE_BY_PRIORITY,
  SLA_HOURS,
  TICKETS,
  TICKETS_BY_CATEGORY,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATS,
  type SlaState,
  type Ticket,
  type TicketCategory,
  type TicketMessage,
  type TicketPriority,
} from "@/mock/workplace";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Alert,
  Avatar,
  Badge,
  EmptyState,
  Field,
  Hint,
  Input,
  Skeleton,
  Textarea,
} from "@/components/ui/primitives";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FilterSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { BarCompareChart, DonutChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import {
  Gated,
  PageBody,
  PageHeader,
  Section,
  useFakeLoad,
} from "@/components/shell/page";

/* SLA chips are colour + icon + text, never colour alone. */
const SLA_META: Record<SlaState, { label: string; icon: React.ElementType; cls: string }> = {
  sla_ok: { label: "On track", icon: Check, cls: "border-success/25 bg-success-soft text-success-fg" },
  sla_at_risk: { label: "At risk", icon: AlertTriangle, cls: "border-warning/30 bg-warning-soft text-warning-fg" },
  sla_breached: { label: "Breached", icon: Octagon, cls: "border-destructive/25 bg-destructive-soft text-destructive-fg" },
};

function SlaChip({ state, minutes }: { state: SlaState; minutes: number }) {
  const m = SLA_META[state];
  const Icon = m.icon;
  const abs = Math.abs(minutes);
  return (
    <Hint
      text={
        minutes < 0
          ? `Breached ${hm(abs)} ago`
          : `${hm(abs)} left before the SLA is breached`
      }
    >
      <span
        className={cn(
          "inline-flex w-fit items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
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

export default function HelpdeskPage() {
  const loading = useFakeLoad();
  const { persona } = useApp();

  const [tickets, setTickets] = React.useState<Ticket[]>(TICKETS);
  const [category, setCategory] = React.useState("all");
  const [priority, setPriority] = React.useState("all");
  const [sla, setSla] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [selectedId, setSelectedId] = React.useState<string | null>(TICKETS[0]?.id ?? null);
  const [reply, setReply] = React.useState("");
  const [internal, setInternal] = React.useState(false);
  const [composeOpen, setComposeOpen] = React.useState(false);

  /* new-ticket form */
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [newCategory, setNewCategory] = React.useState<TicketCategory>("IT");
  const [newPriority, setNewPriority] = React.useState<TicketPriority>("Medium");
  const [error, setError] = React.useState<string | null>(null);

  const filtered = React.useMemo(
    () =>
      tickets.filter(
        (t) =>
          (category === "all" || t.category === category) &&
          (priority === "all" || t.priority === priority) &&
          (sla === "all" || t.slaState === sla) &&
          (status === "all" || t.status === status),
      ),
    [tickets, category, priority, sla, status],
  );

  const selected = filtered.find((t) => t.id === selectedId) ?? filtered[0] ?? null;

  const postMessage = () => {
    if (!selected || !reply.trim()) return;
    const msg: TicketMessage = {
      id: `MSG-${selected.id}-${selected.thread.length}`,
      authorCode: persona.employeeId,
      authorName: persona.name,
      authorRole: persona.role,
      at: "2026-09-16T14:35:00",
      body: reply.trim(),
      internal,
    };
    setTickets((ts) =>
      ts.map((t) =>
        t.id === selected.id
          ? { ...t, thread: [...t.thread, msg], updatedAt: "2026-09-16T14:35:00" }
          : t,
      ),
    );
    setReply("");
    mockAction(internal ? "Internal note added" : "Reply sent", {
      description: internal
        ? "Visible to the assignee team only — never to the requester."
        : `${selected.requesterName} has been notified.`,
    });
  };

  const setTicketStatus = (t: Ticket, next: Ticket["status"]) => {
    setTickets((ts) =>
      ts.map((x) =>
        x.id === t.id
          ? {
              ...x,
              status: next,
              resolvedAt: next === "resolved" ? "2026-09-16T14:35:00" : null,
              updatedAt: "2026-09-16T14:35:00",
            }
          : x,
      ),
    );
    mockAction(`${t.ticketNo} ${next === "resolved" ? "resolved" : next}`, {
      description: `${t.subject} — ${t.requesterName} has been notified.`,
    });
  };

  const createTicket = () => {
    if (subject.trim().length < 8) {
      setError("Give the ticket a subject of at least 8 characters so it can be triaged.");
      return;
    }
    const hours = SLA_HOURS[newPriority];
    const t: Ticket = {
      id: `TKT-NEW-${tickets.length}`,
      ticketNo: `TKT-2026-${String(5000 + tickets.length)}`,
      category: newCategory,
      priority: newPriority,
      subject: subject.trim(),
      description: body.trim() || subject.trim(),
      requesterCode: persona.employeeId,
      requesterName: persona.name,
      requesterBranch: persona.branch,
      assigneeCode: "STL-0010",
      assigneeName: "Girish Gowda",
      assigneeTeam: `${newCategory} Support`,
      createdAt: "2026-09-16T14:35:00",
      updatedAt: "2026-09-16T14:35:00",
      status: "submitted",
      slaHours: hours,
      slaDueAt: "2026-09-17T14:35:00",
      slaMinutesRemaining: hours * 60,
      slaState: "sla_ok",
      resolvedAt: null,
      firstResponseMins: 0,
      thread: [
        {
          id: "MSG-0",
          authorCode: persona.employeeId,
          authorName: persona.name,
          authorRole: persona.role,
          at: "2026-09-16T14:35:00",
          body: body.trim() || subject.trim(),
          internal: false,
        },
      ],
      tags: [newCategory.toLowerCase()],
      search: `${subject} ${persona.name} ${newCategory}`.toLowerCase(),
    };
    setTickets((ts) => [t, ...ts]);
    setSelectedId(t.id);
    setComposeOpen(false);
    setSubject("");
    setBody("");
    setError(null);
    mockAction(`${t.ticketNo} raised`, {
      description: `${newCategory} · ${newPriority} priority · ${hours}h SLA. Assigned to ${t.assigneeTeam}.`,
    });
  };

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Helpdesk" description="Loading tickets…" />
        <Skeleton className="h-[480px]" />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="Helpdesk"
        description="Every request raised against IT, Facilities, HR, Payroll and Access, with a live SLA countdown on each."
        actions={
          <Gated menuKey="workplace.helpdesk" action="C">
            <Button size="sm" onClick={() => setComposeOpen(true)}>
              <Plus /> Raise a ticket
            </Button>
          </Gated>
        }
      />

      <StatRow cols={4}>
        <StatTile label="Open tickets" value={num(TICKET_STATS.open)} icon={LifeBuoy} onClick={() => setStatus("submitted")} />
        <StatTile
          label="At risk"
          value={num(tickets.filter((t) => t.slaState === "sla_at_risk").length)}
          icon={AlertTriangle}
          tone="warning"
          hint="Under 25% of the SLA window left"
          onClick={() => setSla("sla_at_risk")}
        />
        <StatTile
          label="Breached"
          value={num(tickets.filter((t) => t.slaState === "sla_breached").length)}
          icon={Octagon}
          tone="critical"
          onClick={() => setSla("sla_breached")}
        />
        <StatTile
          label="Median first response"
          value={hm(TICKET_STATS.avgFirstResponseMins)}
          icon={Timer}
          hint="Across all open tickets"
        />
      </StatRow>

      <div className="flex flex-wrap items-center gap-1.5">
        <FilterSelect
          label="Category"
          value={category}
          onValueChange={setCategory}
          allLabel="All categories"
          width="w-[165px]"
          options={TICKET_CATEGORIES.map((c) => ({ value: c, label: c }))}
        />
        <FilterSelect
          label="Priority"
          value={priority}
          onValueChange={setPriority}
          allLabel="Any priority"
          width="w-[160px]"
          options={TICKET_PRIORITIES.map((p) => ({ value: p, label: p }))}
        />
        <FilterSelect
          label="SLA"
          value={sla}
          onValueChange={setSla}
          allLabel="Any SLA state"
          width="w-[165px]"
          options={[
            { value: "sla_ok", label: "On track" },
            { value: "sla_at_risk", label: "At risk" },
            { value: "sla_breached", label: "Breached" },
          ]}
        />
        <FilterSelect
          label="Status"
          value={status}
          onValueChange={setStatus}
          allLabel="All statuses"
          width="w-[165px]"
          options={[
            { value: "submitted", label: "Open" },
            { value: "pending", label: "Pending requester" },
            { value: "resolved", label: "Resolved" },
            { value: "reopened", label: "Reopened" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />
        <span className="tnum ml-auto text-xs text-muted-foreground">
          {filtered.length} of {tickets.length} tickets
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,360px)_1fr]">
        {/* --------------------------------------------------- ticket list */}
        <Section title="Tickets" bodyClassName="p-0">
          {filtered.length === 0 ? (
            <EmptyState
              icon={LifeBuoy}
              title="No tickets match"
              description="Clear a filter to widen the queue."
              className="border-0"
            />
          ) : (
            <ul className="scrollbar-thin max-h-[620px] overflow-y-auto">
              {filtered.map((t) => {
                const active = t.id === selected?.id;
                return (
                  <li key={t.id} className="border-b border-border last:border-0">
                    <button
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "flex w-full flex-col gap-1.5 px-4 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                        active ? "bg-primary-soft" : "hover:bg-muted/60",
                      )}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium">{t.subject}</span>
                          <span className="tnum block truncate text-[11px] text-muted-foreground">
                            {t.ticketNo} · {t.requesterName} · {t.assigneeTeam}
                          </span>
                        </span>
                        <Badge variant="muted" className="shrink-0">
                          {t.priority}
                        </Badge>
                      </span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline">{t.category}</Badge>
                        <StatusBadge status={t.status} />
                        <SlaChip state={t.slaState} minutes={t.slaMinutesRemaining} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* --------------------------------------------------- the thread */}
        {selected ? (
          <Card className="flex flex-col overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-subtle p-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{selected.subject}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {selected.ticketNo} · raised by{" "}
                  <Link href={`/employees/${selected.requesterCode}`} className="hover:underline">
                    {selected.requesterName}
                  </Link>{" "}
                  ({selected.requesterBranch}) · {fmtDateTime(selected.createdAt)}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <Badge variant="muted">{selected.category}</Badge>
                  <Badge variant="muted">{selected.priority}</Badge>
                  <Badge variant="outline">Assigned to {selected.assigneeName}</Badge>
                  {selected.tags.map((t) => (
                    <Badge key={t} variant="outline">
                      #{t}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <StatusBadge status={selected.status} size="md" />
                <SlaChip state={selected.slaState} minutes={selected.slaMinutesRemaining} />
                <span className="tnum text-[10px] text-muted-foreground">
                  {selected.slaHours}h SLA · due {fmtDateTime(selected.slaDueAt)}
                </span>
              </div>
            </div>

            {selected.slaState === "sla_breached" && (
              <div className="border-b border-border px-4 py-2.5">
                <Alert tone="danger" icon={Octagon} title="SLA breached">
                  This ticket passed its {selected.slaHours}-hour commitment{" "}
                  {hm(Math.abs(selected.slaMinutesRemaining))} ago. It appears on the weekly SLA
                  report until it is resolved.
                </Alert>
              </div>
            )}

            {/* conversation */}
            <ul className="scrollbar-thin flex max-h-[420px] flex-1 flex-col gap-3 overflow-y-auto p-4">
              {selected.thread.map((m) => (
                <li
                  key={m.id}
                  className={cn(
                    "rounded-md border p-3",
                    m.internal
                      ? "border-warning/30 bg-warning-soft/40"
                      : "border-border bg-card",
                  )}
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
                    <span className="tnum ml-auto text-[10px] text-muted-foreground">
                      {fmtDateTime(m.at)}
                    </span>
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

            {/* composer */}
            <div className="border-t border-border p-3">
              <div className="mb-2 flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant={!internal ? "default" : "outline"}
                  aria-pressed={!internal}
                  onClick={() => setInternal(false)}
                >
                  <Send /> Reply to requester
                </Button>
                <Button
                  size="sm"
                  variant={internal ? "default" : "outline"}
                  aria-pressed={internal}
                  onClick={() => setInternal(true)}
                >
                  <Lock /> Internal note
                </Button>
                <div className="ml-auto flex gap-1.5">
                  {selected.status !== "resolved" ? (
                    <Gated menuKey="workplace.helpdesk" action="E">
                      <Button size="sm" variant="outline" onClick={() => setTicketStatus(selected, "resolved")}>
                        <Check /> Resolve
                      </Button>
                    </Gated>
                  ) : (
                    <Gated menuKey="workplace.helpdesk" action="E">
                      <Button size="sm" variant="outline" onClick={() => setTicketStatus(selected, "reopened")}>
                        Reopen
                      </Button>
                    </Gated>
                  )}
                </div>
              </div>

              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={
                  internal
                    ? "Context for the team — the requester will never see this…"
                    : `Reply to ${selected.requesterName}…`
                }
                aria-label={internal ? "Internal note" : "Reply to requester"}
                className={cn("text-xs", internal && "border-warning/40 bg-warning-soft/30")}
              />

              <div className="mt-2 flex items-center gap-2">
                <p className="text-[10px] text-muted-foreground">
                  {internal
                    ? "Stored on the ticket, visible to the assignee team only."
                    : `${selected.requesterName} receives an email and an in-app notification.`}
                </p>
                <Button size="sm" className="ml-auto" disabled={!reply.trim()} onClick={postMessage}>
                  {internal ? <Lock /> : <Send />}
                  {internal ? "Add note" : "Send reply"}
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <EmptyState icon={LifeBuoy} title="Select a ticket" description="Pick one from the queue to open its thread." />
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <DonutChart
          title="Tickets by category"
          description="Where the support load actually sits."
          data={TICKETS_BY_CATEGORY.map((c) => ({
            name: c.category,
            value: c.on_track + c.at_risk + c.breached,
          }))}
          centreValue={num(tickets.length)}
          centreLabel="tickets"
          height={260}
          onSliceClick={(row) => setCategory(String(row.name))}
        />
        <BarCompareChart
          title="SLA attainment by priority"
          description="How each priority band is performing against its commitment."
          data={SLA_COMPLIANCE_BY_PRIORITY.map((p) => ({
            name: `${p.priority} (${SLA_HOURS[p.priority as TicketPriority]}h)`,
            met: p.met,
            breached: p.breached,
          }))}
          xKey="name"
          series={[
            { key: "met", label: "Met" },
            { key: "breached", label: "Breached" },
          ]}
          stacked
          horizontal
          height={260}
        />
      </div>

      {/* ------------------------------------------------------ new ticket */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Raise a ticket</DialogTitle>
            <DialogDescription>
              Priority sets the SLA clock: Critical 4h, High 8h, Medium 24h, Low 72h.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3">
            <Field
              label="Subject"
              htmlFor="tkt-subject"
              required
              error={error ?? undefined}
              hint="Say what is broken and where, e.g. “VPN drops every 20 minutes on the Pune office Wi-Fi”."
            >
              <Input
                id="tkt-subject"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  if (error) setError(null);
                }}
                aria-invalid={!!error}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Category" htmlFor="tkt-cat" required>
                <Select value={newCategory} onValueChange={(v) => setNewCategory(v as TicketCategory)}>
                  <SelectTrigger id="tkt-cat">
                    <span className="text-xs">{newCategory}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Priority" htmlFor="tkt-pri" required hint={`${SLA_HOURS[newPriority]}h SLA`}>
                <Select value={newPriority} onValueChange={(v) => setNewPriority(v as TicketPriority)}>
                  <SelectTrigger id="tkt-pri">
                    <span className="text-xs">{newPriority}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p} · {SLA_HOURS[p]}h
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="Description" htmlFor="tkt-body" hint="Steps to reproduce, error messages, anything you have already tried.">
              <Textarea id="tkt-body" value={body} onChange={(e) => setBody(e.target.value)} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createTicket}>
              <Check /> Raise ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageBody>
  );
}
