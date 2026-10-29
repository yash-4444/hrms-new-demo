"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Check, Eye, Headset, LifeBuoy, Octagon, Plus, Timer } from "lucide-react";
import { fmtDateTime, hm, num } from "@/lib/format";
import { DEMO_NOW } from "@/mock/org";
import {
  SLA_COMPLIANCE_BY_PRIORITY,
  SLA_HOURS,
  TICKETS,
  TICKETS_BY_CATEGORY,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  isTicketOpen,
  type Ticket,
  type TicketPriority,
} from "@/mock/workplace";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, MutedCell } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Badge, Hint } from "@/components/ui/primitives";
import { ConfirmDialog, FilterSelect } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { BarCompareChart, DonutChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { PersonCell } from "@/components/people/person-cell";
import { CardsSkeleton, Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { RaiseTicketDialog, type TicketPrefill } from "@/components/workplace/raise-ticket-dialog";
import { HelpdeskDeflectDialog } from "@/components/ai/embed/helpdesk-deflect";
import { SlaChip, TicketThreadSheet } from "@/components/workplace/ticket-thread-sheet";

/* ============================================================================
   /helpdesk — My Tickets. Everyone sees the tickets they raised; a persona on
   the agent queue can widen the list to every ticket (and gets the tenant
   charts and bulk resolve). Internal notes stay hidden from requesters.
   ========================================================================== */

const PRIORITY_RANK: Record<TicketPriority, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

type Batch = { rows: Ticket[]; clear: () => void };

export default function HelpdeskPage() {
  const loading = useFakeLoad();
  const { persona, can } = useApp();
  const isAgent = can("helpdesk.queue", "V");
  const me = persona.employeeId;

  const [tickets, setTickets] = React.useState<Ticket[]>(TICKETS);
  const [scope, setScope] = React.useState("mine");
  const [category, setCategory] = React.useState("all");
  const [priority, setPriority] = React.useState("all");
  const [sla, setSla] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [composeOpen, setComposeOpen] = React.useState(false);
  /* The AI knowledge-base check runs before the ticket form opens. */
  const [deflectOpen, setDeflectOpen] = React.useState(false);
  const [prefill, setPrefill] = React.useState<TicketPrefill | null>(null);
  const [resolving, setResolving] = React.useState<Batch | null>(null);

  const everyone = isAgent && scope === "all";
  const scoped = React.useMemo(
    () => (everyone ? tickets : tickets.filter((t) => t.requesterCode === me)),
    [tickets, everyone, me],
  );
  const rows = scoped.filter(
    (t) =>
      (category === "all" || t.category === category) &&
      (priority === "all" || t.priority === priority) &&
      (sla === "all" || t.slaState === sla) &&
      (status === "all" || t.status === status),
  );
  const open = tickets.find((t) => t.id === openId) ?? null;

  const stats = React.useMemo(() => {
    const live = scoped.filter(isTicketOpen);
    const responses = scoped.map((t) => t.firstResponseMins).sort((a, b) => a - b);
    return {
      open: live.length,
      atRisk: live.filter((t) => t.slaState === "sla_at_risk").length,
      breached: live.filter((t) => t.slaState === "sla_breached").length,
      medianResponse: responses.length ? responses[Math.floor(responses.length / 2)] : 0,
    };
  }, [scoped]);

  /* ----------------------------------------------------------- mutations */

  const setTicketStatus = (ids: string[], next: Ticket["status"], note?: string) => {
    const before = tickets;
    setTickets((ts) =>
      ts.map((t) =>
        ids.includes(t.id)
          ? {
              ...t,
              status: next,
              slaState: next === "resolved" ? "sla_ok" : t.slaState,
              resolvedAt: next === "resolved" ? DEMO_NOW : null,
              updatedAt: DEMO_NOW,
              thread: note
                ? [
                    ...t.thread,
                    {
                      id: `${t.ticketNo}-R${t.thread.length + 1}`,
                      authorCode: me,
                      authorName: persona.name,
                      authorRole: persona.role,
                      at: DEMO_NOW,
                      body: note,
                      internal: false,
                    },
                  ]
                : t.thread,
            }
          : t,
      ),
    );
    const one = ids.length === 1 ? before.find((t) => t.id === ids[0]) : null;
    mockAction(
      one ? `${one.ticketNo} ${next === "resolved" ? "resolved" : "reopened"}` : `${ids.length} tickets resolved`,
      {
        description: one
          ? `${one.subject} — ${one.requesterCode === me ? one.assigneeTeam : one.requesterName} has been notified.`
          : "Each requester has been notified with the resolution note.",
        undo: () => setTickets(before),
      },
    );
  };

  const post = (t: Ticket, body: string, internal: boolean) => {
    setTickets((ts) =>
      ts.map((x) =>
        x.id === t.id
          ? {
              ...x,
              updatedAt: DEMO_NOW,
              thread: [
                ...x.thread,
                {
                  id: `${x.ticketNo}-R${x.thread.length + 1}`,
                  authorCode: me,
                  authorName: persona.name,
                  authorRole: persona.role,
                  at: DEMO_NOW,
                  body,
                  internal,
                },
              ],
            }
          : x,
      ),
    );
    mockAction(internal ? "Internal note added" : "Reply sent", {
      description: internal
        ? "Visible to the assignee team only — never to the requester."
        : t.requesterCode === me
          ? `${t.assigneeTeam} has been notified.`
          : `${t.requesterName} has been notified.`,
    });
  };

  /* -------------------------------------------------------------- columns */

  const columns = React.useMemo<ColumnDef<Ticket, unknown>[]>(() => {
    const cols: ColumnDef<Ticket, unknown>[] = [
      {
        accessorKey: "ticketNo",
        header: "Ticket",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="max-w-[320px] truncate font-medium">{row.original.subject}</p>
            <p className="tnum text-[11px] text-muted-foreground">
              {row.original.ticketNo} · {fmtDateTime(row.original.createdAt)}
            </p>
          </div>
        ),
      },
    ];
    if (everyone) {
      cols.push({
        accessorKey: "requesterName",
        header: "Requester",
        cell: ({ row }) => <PersonCell name={row.original.requesterName} subtitle={row.original.requesterBranch} />,
      });
    }
    cols.push(
      { accessorKey: "category", header: "Category", cell: ({ row }) => <Badge variant="outline">{row.original.category}</Badge> },
      {
        id: "priority",
        accessorFn: (t) => PRIORITY_RANK[t.priority],
        header: "Priority",
        enableColumnFilter: false,
        cell: ({ row }) => <Badge variant="muted">{row.original.priority}</Badge>,
      },
      { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        accessorKey: "slaMinutesRemaining",
        header: "SLA",
        enableColumnFilter: false,
        cell: ({ row }) =>
          isTicketOpen(row.original) ? (
            <SlaChip state={row.original.slaState} minutes={row.original.slaMinutesRemaining} />
          ) : (
            <MutedCell>{row.original.status === "resolved" ? "Met" : "—"}</MutedCell>
          ),
      },
      { accessorKey: "assigneeTeam", header: "Assigned to", cell: ({ row }) => <MutedCell>{row.original.assigneeTeam}</MutedCell> },
      {
        accessorKey: "updatedAt",
        header: "Last update",
        cell: ({ row }) => <span className="tnum whitespace-nowrap text-xs">{fmtDateTime(row.original.updatedAt)}</span>,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <Hint text="Open the thread">
              <Button size="icon-sm" variant="ghost" aria-label={`Open ${row.original.ticketNo}`} onClick={() => setOpenId(row.original.id)}>
                <Eye />
              </Button>
            </Hint>
          </div>
        ),
      },
    );
    return cols;
  }, [everyone]);

  /* ---------------------------------------------------------------- render */

  const header = (
    <PageHeader
      title="My tickets"
      description="Requests you have raised with IT, Facilities, HR, Payroll and Access, each with a live SLA countdown."
      actions={
        <>
          {isAgent && (
            <Button size="sm" variant="outline" asChild>
              <Link href="/helpdesk/queue">
                <Headset /> Open agent queue
              </Link>
            </Button>
          )}
          <Gated menuKey="workplace.helpdesk" action="C">
            <Button size="sm" onClick={() => setDeflectOpen(true)}>
              <Plus /> Raise a ticket
            </Button>
          </Gated>
        </>
      }
    />
  );

  if (loading) {
    return (
      <PageBody>
        {header}
        <CardsSkeleton count={4} />
        <TableSkeleton />
      </PageBody>
    );
  }

  const canResolveAll = can("helpdesk.queue", "E");

  return (
    <PageBody>
      {header}

      <StatRow cols={4}>
        <StatTile label="Open" value={num(stats.open)} icon={LifeBuoy} onClick={() => setStatus("submitted")} />
        <StatTile
          label="At risk"
          value={num(stats.atRisk)}
          icon={AlertTriangle}
          tone={stats.atRisk ? "warning" : "neutral"}
          hint="Under 25% of the SLA window left"
          onClick={() => setSla("sla_at_risk")}
        />
        <StatTile
          label="Breached"
          value={num(stats.breached)}
          icon={Octagon}
          tone={stats.breached ? "critical" : "neutral"}
          onClick={() => setSla("sla_breached")}
        />
        <StatTile
          label="Median first response"
          value={hm(stats.medianResponse)}
          icon={Timer}
          hint={everyone ? "Across every ticket" : "On your tickets"}
        />
      </StatRow>

      <DataTable<Ticket>
        columns={columns}
        data={rows}
        getRowId={(t) => t.id}
        searchKeys={["search", "subject"]}
        searchPlaceholder="Search ticket, subject or tag…"
        exportName={everyone ? "helpdesk-tickets" : "my-tickets"}
        onRowClick={(t) => setOpenId(t.id)}
        enableSelection={everyone && canResolveAll}
        rowTone={(t) => (isTicketOpen(t) && t.slaState === "sla_breached" ? "danger" : undefined)}
        emptyIcon={LifeBuoy}
        emptyTitle={scoped.length ? "No ticket matches these filters" : "You have not raised any tickets"}
        emptyDescription={
          scoped.length
            ? "Clear a filter to see the rest."
            : "Something broken, or need access? Raise a ticket and the owning team picks it up within its SLA."
        }
        filters={
          <>
            {isAgent && (
              <FilterSelect
                label="Scope"
                value={scope}
                onValueChange={setScope}
                allLabel="Every ticket"
                width="w-[160px]"
                options={[{ value: "mine", label: "Raised by me" }]}
              />
            )}
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
          </>
        }
        bulkActions={(sel, clear) => {
          const live = sel.filter((t) => t.status !== "resolved" && t.status !== "cancelled");
          return (
            <Gated menuKey="helpdesk.queue" action="E">
              <Button size="sm" disabled={!live.length} onClick={() => setResolving({ rows: live, clear })}>
                <Check /> Resolve {live.length}
              </Button>
            </Gated>
          );
        }}
      />

      {everyone && (
        <div className="grid gap-3 lg:grid-cols-2">
          <DonutChart
            title="Tickets by category"
            description="Where the support load actually sits."
            data={TICKETS_BY_CATEGORY.map((c) => ({ name: c.category, value: c.on_track + c.at_risk + c.breached }))}
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
      )}

      <TicketThreadSheet
        ticket={open}
        onOpenChange={(v) => !v && setOpenId(null)}
        onPost={post}
        onStatus={(t, next) => setTicketStatus([t.id], next)}
      />

      <HelpdeskDeflectDialog
        open={deflectOpen}
        onOpenChange={setDeflectOpen}
        onContinue={(p) => {
          setPrefill(p);
          setDeflectOpen(false);
          setComposeOpen(true);
        }}
      />

      <RaiseTicketDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        prefill={prefill}
        employeeCode={me}
        onRaised={(t) => {
          setTickets((ts) => [t, ...ts]);
          setOpenId(t.id);
          mockAction(`${t.ticketNo} raised`, {
            description: `${t.category} · ${t.priority} priority · ${t.slaHours}h SLA. Assigned to ${t.assigneeTeam}.`,
          });
        }}
      />

      <ConfirmDialog
        open={!!resolving}
        onOpenChange={(v) => !v && setResolving(null)}
        title={`Resolve ${resolving?.rows.length ?? 0} ticket${resolving?.rows.length === 1 ? "" : "s"}?`}
        description="Each requester receives your resolution note and can reopen the ticket within 7 days."
        confirmLabel="Resolve"
        comment={{ label: "Resolution note", placeholder: "e.g. Fixed by the 14 Sep VPN policy change — please reconnect once." }}
        onConfirm={(note) => {
          if (!resolving) return;
          setTicketStatus(
            resolving.rows.map((t) => t.id),
            "resolved",
            note,
          );
          resolving.clear();
        }}
      />
    </PageBody>
  );
}
