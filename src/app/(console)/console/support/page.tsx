"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { addMinutes, differenceInMinutes, format, parseISO } from "date-fns";
import { Building2, Clock, FileSearch, Headset, Ticket, Timer, XOctagon } from "lucide-react";
import { fmtDateTime, fmtTime, num } from "@/lib/format";
import { PLATFORM_PERSONA } from "@/lib/rbac";
import { ACCESS_REQUESTS, APPROVAL_REQUIRED, ENDED_BY_LABEL, SUPPORT_SESSIONS, type AccessRequest, type SupportSessionLog } from "@/mock/console-support";
import { mockAction, useApp, useDemoNow } from "@/components/app-state";
import { useConsole } from "@/components/console/console-state";
import { SupportApprovals } from "@/components/console/support-approvals";
import { SessionStatusPill, SupportDetailSheet } from "@/components/console/support-detail-sheet";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { DataTable, MutedCell } from "@/components/data-table";
import { CardsSkeleton, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { TonePill } from "@/components/platform/kit";
import { Button } from "@/components/ui/button";
import { Avatar, Progress } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/overlays";

const iso = (ms: number) => format(new Date(ms), "yyyy-MM-dd'T'HH:mm:ss");

type Row = SupportSessionLog & { live: boolean; minutes: number; current?: boolean };

export default function SupportAccessPage() {
  const loading = useFakeLoad();
  const now = useDemoNow(15_000);
  const { tenantById, logActivity } = useConsole();
  const { supportSession, endSupportSession } = useApp();
  const [sessions, setSessions] = React.useState<SupportSessionLog[]>(SUPPORT_SESSIONS);
  const [requests, setRequests] = React.useState<AccessRequest[]>(ACCESS_REQUESTS);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [terminating, setTerminating] = React.useState<Row | null>(null);

  /* A session past its granted time is closed by the timeout, even if no one ended it. */
  const rows = React.useMemo<Row[]>(() => {
    const out: Row[] = sessions.map((s) => {
      const timeout = addMinutes(parseISO(s.startedAt), s.grantedMinutes).getTime();
      if (!s.endedAt && timeout <= now) {
        return { ...s, endedAt: iso(timeout), endedBy: "timeout", live: false, minutes: s.grantedMinutes };
      }
      const live = !s.endedAt;
      return { ...s, live, minutes: differenceInMinutes(live ? new Date(now) : parseISO(s.endedAt!), parseISO(s.startedAt)) };
    });
    if (supportSession) {
      const startedMs = supportSession.endsAt - supportSession.minutes * 60_000;
      out.unshift({
        id: `SS-0${472 + sessions.length - SUPPORT_SESSIONS.length}`,
        operator: PLATFORM_PERSONA.name,
        tenantId: supportSession.tenantId,
        reason: supportSession.reason,
        ticket: supportSession.ticket,
        startedAt: iso(startedMs),
        grantedMinutes: supportSession.minutes,
        views: [{ at: iso(startedMs), path: "/dashboard", label: "Dashboard" }],
        blockedWrites: 0,
        live: true,
        minutes: Math.max(0, Math.floor((now - startedMs) / 60_000)),
        current: true,
      });
    }
    return out.sort((a, b) => Number(b.live) - Number(a.live) || b.startedAt.localeCompare(a.startedAt));
  }, [sessions, supportSession, now]);

  const live = rows.filter((r) => r.live);
  const month = rows.filter((r) => r.startedAt.startsWith("2026-09"));
  const ended = month.filter((r) => !r.live);
  const avg = ended.length ? Math.round(ended.reduce((s, r) => s + r.minutes, 0) / ended.length) : 0;
  const noTicket = month.filter((r) => !r.ticket).length;
  const detail = rows.find((r) => r.id === detailId) ?? null;

  const columns = React.useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      { id: "status", header: "Status", accessorFn: (r) => (r.live ? "Live" : "Ended"), cell: ({ row }) => <SessionStatusPill live={row.original.live} /> },
      {
        accessorKey: "operator",
        header: "Operator",
        cell: ({ row }) => (
          <span className="flex items-center gap-2 whitespace-nowrap">
            <Avatar name={row.original.operator} size={22} />
            {row.original.operator}
            {row.original.current && <span className="text-[11px] text-muted-foreground">(you)</span>}
          </span>
        ),
      },
      {
        accessorKey: "tenantId",
        header: "Tenant",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{tenantById(row.original.tenantId)?.name ?? row.original.tenantId}</p>
            <p className="font-mono text-[11px] text-muted-foreground">{row.original.tenantId}</p>
          </div>
        ),
      },
      {
        id: "policy",
        header: "Tenant policy",
        accessorFn: (r) => (APPROVAL_REQUIRED.has(r.tenantId) ? "Approval required" : "Notify owner"),
        cell: ({ row }) =>
          APPROVAL_REQUIRED.has(row.original.tenantId) ? <TonePill tone="accent">Approval required</TonePill> : <MutedCell>Notify owner</MutedCell>,
      },
      {
        accessorKey: "reason",
        header: "Reason",
        cell: ({ row }) => (
          <div className="max-w-[280px]">
            <p className="truncate text-xs">{row.original.reason}</p>
            <p className="font-mono text-[11px] text-muted-foreground">{row.original.ticket ?? "No ticket"}</p>
          </div>
        ),
      },
      { accessorKey: "startedAt", header: "Started", cell: ({ row }) => <span className="tnum whitespace-nowrap text-xs">{fmtDateTime(row.original.startedAt)}</span> },
      {
        accessorKey: "minutes",
        header: "Duration",
        cell: ({ row }) => (
          <span className="tnum whitespace-nowrap text-xs">
            {row.original.minutes} min <span className="text-muted-foreground">/ {row.original.grantedMinutes}</span>
          </span>
        ),
      },
      {
        accessorKey: "endedBy",
        header: "Ended by",
        cell: ({ row }) => (row.original.endedBy ? <span className="whitespace-nowrap text-xs">{ENDED_BY_LABEL[row.original.endedBy]}</span> : <MutedCell>—</MutedCell>),
      },
      {
        id: "views",
        header: "Actions",
        accessorFn: (r) => r.views.length,
        cell: ({ row }) => (
          <span className="tnum whitespace-nowrap text-xs">
            {row.original.views.length} views <span className="text-muted-foreground">· 0 writes</span>
          </span>
        ),
      },
    ],
    [tenantById],
  );

  const terminate = (r: Row, reason: string) => {
    logActivity(r.tenantId, { category: "support", action: "Support session terminated", detail: `${r.id} · ${r.ticket ?? "no ticket"} · ${r.operator}'s session closed by ${PLATFORM_PERSONA.name} — ${reason}` });
    if (r.current) {
      /* Keep your own session in the log once it closes. */
      const log: SupportSessionLog = { id: r.id, operator: r.operator, tenantId: r.tenantId, reason: r.reason, ticket: r.ticket, startedAt: r.startedAt, grantedMinutes: r.grantedMinutes, views: r.views, blockedWrites: 0 };
      setSessions((ss) => [{ ...log, endedAt: iso(now), endedBy: "operator" }, ...ss]);
      endSupportSession();
      return;
    }
    setSessions((ss) => ss.map((s) => (s.id === r.id ? { ...s, endedAt: iso(now), endedBy: "terminated", endedByName: PLATFORM_PERSONA.name } : s)));
    mockAction(`${r.id} terminated`, { description: `${r.operator} is returned to the console. The tenant owner sees the close in their audit trail.`, tone: "warning" });
  };

  const request = (tenantId: string, tenantName: string, owner: string, r: { reason: string; ticket: string; minutes: number }) => {
    const id = `REQ-${119 + requests.length - ACCESS_REQUESTS.length}`;
    setRequests((rs) => [{ id, tenantId, operator: PLATFORM_PERSONA.name, requestedAt: iso(now), status: "pending", ...r }, ...rs]);
    logActivity(tenantId, { category: "support", action: "Support access requested", detail: `${id} · ${r.ticket} · ${r.minutes} min · ${r.reason}` });
    mockAction(`Request ${id} sent to ${owner}`, { description: `${tenantName} must approve before a session can open.`, tone: "info" });
    /* Demo only: the owner approves a few seconds later. */
    setTimeout(() => {
      setRequests((rs) => rs.map((x) => (x.id === id && x.status === "pending" ? { ...x, status: "approved", decidedAt: iso(now + 4000), decidedBy: owner } : x)));
      mockAction(`${owner} approved ${id}`, { description: `You can now open a ${r.minutes}-minute read-only session in ${tenantName}.` });
    }, 4000);
  };

  return (
    <PageBody>
      <PageHeader
        title="Support Access"
        description="Every support session into a tenant — who opened it, why, under which ticket, for how long and what they looked at. Sessions are read-only and recorded in the tenant's own audit trail."
      />

      {loading ? (
        <>
          <CardsSkeleton count={4} />
          <TableSkeleton rows={8} />
        </>
      ) : (
        <>
          <StatRow cols={4}>
            <StatTile label="Sessions this month" value={num(month.length)} icon={Headset} hint={`${live.length} live right now`} />
            <StatTile label="Average duration" value={`${avg} min`} icon={Timer} hint="Ended sessions, September" />
            <StatTile label="Tenants accessed" value={num(new Set(month.map((r) => r.tenantId)).size)} icon={Building2} hint="Distinct tenants, September" />
            <StatTile label="Sessions without a ticket" value={num(noTicket)} icon={Ticket} tone={noTicket ? "critical" : "good"} hint="Target is 0 — the console refuses a session without one" />
          </StatRow>

          <Section title="Live now" description="Open sessions, newest first. Terminating closes the operator's view immediately.">
            {live.length === 0 ? (
              <p className="text-xs text-muted-foreground">No support session is open.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {live.map((r) => (
                  <div key={r.id} className="flex flex-col gap-2 rounded-md border border-warning/40 bg-warning-soft/40 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Avatar name={r.operator} size={28} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {r.operator} {r.current && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">in {tenantById(r.tenantId)?.name ?? r.tenantId} · {r.ticket}</p>
                        </div>
                      </div>
                      <SessionStatusPill live />
                    </div>
                    <p className="line-clamp-2 text-xs">{r.reason}</p>
                    <div className="flex items-center gap-2">
                      <Progress value={(r.minutes / r.grantedMinutes) * 100} tone="warning" aria-label={`${r.minutes} of ${r.grantedMinutes} minutes used`} className="flex-1" />
                      <span className="tnum shrink-0 text-[11px] text-muted-foreground">
                        <Clock className="mr-0.5 inline size-3" aria-hidden />
                        {r.minutes}/{r.grantedMinutes} min · since {fmtTime(r.startedAt)}
                      </span>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => setDetailId(r.id)}>
                        <FileSearch /> {r.views.length} pages viewed
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setTerminating(r)}>
                        <XOctagon /> Terminate
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <SupportApprovals
            requests={requests}
            onRequest={(t, r) => request(t.id, t.name, t.ownerName, r)}
            onUse={(id) => setRequests((rs) => rs.map((x) => (x.id === id ? { ...x, status: "used" } : x)))}
          />

          <Section title="Session log" description="All sessions, including ended ones. Select a row for the page-by-page trail." bodyClassName="p-4">
            <DataTable
              columns={columns}
              data={rows}
              searchKeys={["operator", "tenantId", "reason", "id"]}
              searchPlaceholder="Search operator, tenant, reason…"
              getRowId={(r) => r.id}
              onRowClick={(r) => setDetailId(r.id)}
              rowTone={(r) => (r.live ? "warning" : undefined)}
              exportName="support-sessions"
              canExport
              emptyIcon={Headset}
              emptyTitle="No support sessions"
              emptyDescription="Sessions opened from a tenant's page appear here."
            />
          </Section>
        </>
      )}

      <SupportDetailSheet session={detail} tenant={detail ? tenantById(detail.tenantId) : undefined} live={!!detail?.live} minutes={detail?.minutes ?? 0} onOpenChange={(v) => !v && setDetailId(null)} />

      <ConfirmDialog
        open={!!terminating}
        onOpenChange={(v) => !v && setTerminating(null)}
        title={`Terminate ${terminating?.current ? "your" : `${terminating?.operator ?? ""}'s`} session?`}
        description={`The read-only view into ${terminating ? (tenantById(terminating.tenantId)?.name ?? terminating.tenantId) : "the tenant"} closes at once. The termination and your reason are written to the tenant's audit trail.`}
        confirmLabel="Terminate session"
        destructive
        comment={{ label: "Reason", placeholder: "e.g. Ticket resolved; session no longer needed." }}
        onConfirm={(reason) => terminating && terminate(terminating, reason)}
      />
    </PageBody>
  );
}
