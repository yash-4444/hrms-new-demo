"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Clock, Headset, Inbox, Octagon, Sparkles, UserCheck } from "lucide-react";
import { fmtAgo, hm, num } from "@/lib/format";
import { TICKET_CATEGORIES, TICKET_PRIORITIES, isTicketOpen } from "@/mock/workplace";
import { CHANNELS, QUEUE_TICKETS, type QueueTicket } from "@/mock/service";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, MutedCell } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Avatar, Badge } from "@/components/ui/primitives";
import { FilterSelect } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { AI_TONE } from "@/components/ai";
import { ChannelChip, PriorityChip, SlaChip } from "@/components/service/kit";
import { TicketWorkspace, type TicketPatch } from "@/components/service/ticket-workspace";

const TEAM_BY_DEPT: Record<string, string> = {
  "Human Resources": "People Operations",
  "IT & Operations": "IT Service Desk",
  Finance: "Payroll Operations",
};

export default function AgentQueuePage() {
  const loading = useFakeLoad();
  const { persona } = useApp();
  const [tickets, setTickets] = React.useState<QueueTicket[]>(QUEUE_TICKETS);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [view, setView] = React.useState("open");
  const [category, setCategory] = React.useState("all");
  const [priority, setPriority] = React.useState("all");
  const [channel, setChannel] = React.useState("all");
  const [sla, setSla] = React.useState("all");

  const myTeam = TEAM_BY_DEPT[persona.department] ?? null;
  const open = tickets.filter(isTicketOpen);
  const filtered = tickets.filter(
    (t) =>
      (view === "all" || (view === "open" && isTicketOpen(t)) || (view === "team" && isTicketOpen(t) && t.assigneeTeam === myTeam) || (view === "mine" && isTicketOpen(t) && t.assigneeCode === persona.employeeId)) &&
      (category === "all" || t.category === category) &&
      (priority === "all" || t.priority === priority) &&
      (channel === "all" || t.channel === channel) &&
      (sla === "all" || t.slaState === sla),
  );
  const current = tickets.find((t) => t.id === openId) ?? null;

  const update = React.useCallback((id: string, patch: TicketPatch, toast: string, description?: string) => {
    setTickets((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    mockAction(toast, { description });
  }, []);

  const columns = React.useMemo<ColumnDef<QueueTicket, unknown>[]>(
    () => [
      {
        accessorKey: "subject",
        header: "Ticket",
        cell: ({ row }) => {
          const t = row.original;
          const aiDiffers = isTicketOpen(t) && (t.ai.category !== t.category || t.ai.priority !== t.priority);
          return (
            <span className="flex max-w-md flex-col gap-0.5">
              <span className="flex items-center gap-1.5">
                <span className="font-mono text-[11px] text-muted-foreground">{t.id}</span>
                {aiDiffers && (
                  <span className={`inline-flex items-center gap-0.5 rounded border px-1 text-[10px] font-semibold ${AI_TONE.chip}`}>
                    <Sparkles className="size-2.5" aria-hidden /> AI suggests {t.ai.priority !== t.priority ? t.ai.priority : t.ai.category}
                  </span>
                )}
              </span>
              <span className="truncate font-medium">{t.subject}</span>
            </span>
          );
        },
      },
      { accessorKey: "requesterName", header: "Requester", cell: ({ row }) => <span className="flex items-center gap-1.5"><Avatar name={row.original.requesterName} size={20} /><span className="truncate">{row.original.requesterName}</span></span> },
      { accessorKey: "category", header: "Category", cell: ({ row }) => <Badge variant="muted">{row.original.category}</Badge> },
      { accessorKey: "priority", header: "Priority", sortingFn: (a, b) => TICKET_PRIORITIES.indexOf(a.original.priority) - TICKET_PRIORITIES.indexOf(b.original.priority), cell: ({ row }) => <PriorityChip priority={row.original.priority} /> },
      { accessorKey: "channel", header: "Channel", cell: ({ row }) => <ChannelChip channel={row.original.channel} /> },
      {
        accessorKey: "slaMinutesRemaining",
        header: "SLA",
        cell: ({ row }) => <SlaChip state={row.original.slaState} minutes={row.original.slaMinutesRemaining} done={!isTicketOpen(row.original)} />,
      },
      { accessorKey: "assigneeName", header: "Assignee", cell: ({ row }) => <span className="flex flex-col"><span>{row.original.assigneeName}</span><span className="text-[10px] text-muted-foreground">{row.original.assigneeTeam}</span></span> },
      { accessorKey: "updatedAt", header: "Updated", cell: ({ row }) => <MutedCell>{fmtAgo(row.original.updatedAt)}</MutedCell> },
      { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    ],
    [],
  );

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Agent queue" description="Loading the queue…" />
        <TableSkeleton />
      </PageBody>
    );
  }

  const breached = open.filter((t) => t.slaState === "sla_breached").length;
  const atRisk = open.filter((t) => t.slaState === "sla_at_risk").length;
  const aiPending = open.filter((t) => t.ai.category !== t.category || t.ai.priority !== t.priority).length;
  const avgFrt = Math.round(tickets.reduce((s, t) => s + t.firstResponseMins, 0) / tickets.length);

  return (
    <PageBody>
      <PageHeader
        title="Agent queue"
        description="Every open employee request across IT, HR, Payroll, Facilities and Access — sorted by what breaches first."
      />

      <StatRow cols={5}>
        <StatTile label="Open" value={num(open.length)} icon={Inbox} onClick={() => { setView("open"); setSla("all"); }} />
        <StatTile label="Breached" value={num(breached)} icon={Octagon} tone={breached ? "critical" : "good"} onClick={() => { setView("open"); setSla("sla_breached"); }} />
        <StatTile label="At risk" value={num(atRisk)} icon={AlertTriangle} tone="warning" onClick={() => { setView("open"); setSla("sla_at_risk"); }} />
        <StatTile label="Avg first response" value={hm(avgFrt)} icon={Clock} hint="All channels" />
        <StatTile label="AI triage to review" value={num(aiPending)} icon={Sparkles} tone="accent" hint="Category or priority differs" />
      </StatRow>

      <DataTable
        columns={columns}
        data={[...filtered].sort((a, b) => (isTicketOpen(b) ? 1 : 0) - (isTicketOpen(a) ? 1 : 0) || a.slaMinutesRemaining - b.slaMinutesRemaining)}
        getRowId={(t) => t.id}
        searchKeys={["search"]}
        searchPlaceholder="Search ticket, subject, requester…"
        exportName="helpdesk-queue"
        enableSelection
        pageSize={15}
        onRowClick={(t) => setOpenId(t.id)}
        rowTone={(t) => (isTicketOpen(t) && t.slaState === "sla_breached" ? "danger" : undefined)}
        filters={
          <>
            <FilterSelect label="View" value={view} onValueChange={setView} allLabel="All tickets" width="w-[170px]"
              options={[{ value: "open", label: "All open" }, ...(myTeam ? [{ value: "team", label: `${myTeam}` }] : []), { value: "mine", label: "Assigned to me" }]} />
            <FilterSelect label="Category" value={category} onValueChange={setCategory} allLabel="All" options={TICKET_CATEGORIES.map((c) => ({ value: c, label: c }))} />
            <FilterSelect label="Priority" value={priority} onValueChange={setPriority} allLabel="All" options={TICKET_PRIORITIES.map((p) => ({ value: p, label: p }))} />
            <FilterSelect label="Channel" value={channel} onValueChange={setChannel} allLabel="All" options={CHANNELS.map((c) => ({ value: c, label: c }))} />
            <FilterSelect label="SLA" value={sla} onValueChange={setSla} allLabel="All" options={[{ value: "sla_ok", label: "On track" }, { value: "sla_at_risk", label: "At risk" }, { value: "sla_breached", label: "Breached" }]} />
          </>
        }
        bulkActions={(selected, clear) => (
          <Gated menuKey="helpdesk.queue" action="E">
            <Button
              size="sm"
              onClick={() => {
                setTickets((ts) => ts.map((t) => (selected.some((s) => s.id === t.id) ? { ...t, assigneeCode: persona.employeeId, assigneeName: persona.name } : t)));
                mockAction(`${selected.length} ticket(s) assigned to you`);
                clear();
              }}
            >
              <UserCheck /> Assign to me
            </Button>
          </Gated>
        )}
        emptyIcon={Headset}
        emptyTitle="Queue is clear"
        emptyDescription="No tickets match these filters. Widen the view to see resolved tickets."
      />

      <TicketWorkspace key={current?.id ?? "none"} ticket={current} onOpenChange={(o) => !o && setOpenId(null)} onUpdate={update} />
    </PageBody>
  );
}
