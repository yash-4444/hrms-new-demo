"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarClock, CheckCheck, Copy, Eye, Megaphone, MoreHorizontal, Pencil, Plus, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateTime, num } from "@/lib/format";
import { CONSOLE_NOW } from "@/mock/console-tenants";
import {
  ANNOUNCEMENTS,
  CHANNEL_LABEL,
  announcementStatus,
  audienceLabel,
  audienceTenants,
  type Announcement,
  type AnnouncementStatus,
} from "@/mock/console-announcements";
import { mockAction } from "@/components/app-state";
import { useConsole } from "@/components/console/console-state";
import { recordConsoleAudit } from "@/components/console/console-audit-trail";
import { AnnouncementComposer } from "@/components/console/announcements-composer";
import { AnnouncementStatusPill, SeverityPill, TypePill } from "@/components/console/announcements-preview";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { DataTable } from "@/components/data-table";
import { CardsSkeleton, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import {
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";

type Composer = { mode: "new" | "edit" | "duplicate"; initial?: Announcement };

function RateCell({ pct, of, label }: { pct?: number; of: number; label: string }) {
  if (pct === undefined) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex w-[96px] flex-col gap-1">
      <span className="tnum text-xs">
        <span className="font-medium">{pct}%</span>
        <span className="text-muted-foreground"> · {num(Math.round((pct / 100) * of))}/{num(of)}</span>
      </span>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="meter" aria-label={`${label}: ${pct}%`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className={cn("h-full rounded-full", pct >= 60 ? "bg-success" : pct >= 30 ? "bg-primary" : "bg-warning")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AnnouncementsPage() {
  const loading = useFakeLoad();
  const { tenants } = useConsole();
  const [list, setList] = React.useState<Announcement[]>(ANNOUNCEMENTS);
  const [tab, setTab] = React.useState<AnnouncementStatus>("live");
  const [composer, setComposer] = React.useState<Composer | null>(null);
  const [ending, setEnding] = React.useState<Announcement | null>(null);

  const byStatus = (s: AnnouncementStatus) => list.filter((a) => announcementStatus(a) === s);
  const live = byStatus("live");
  const scheduled = byStatus("scheduled");
  const past = byStatus("past");
  const recent = past.filter((a) => a.readPct !== undefined);
  const avgRead = recent.length ? Math.round(recent.reduce((s, a) => s + (a.readPct ?? 0), 0) / recent.length) : 0;
  const awaitingAck = live.filter((a) => a.requiresAck && (a.ackPct ?? 0) < 100);

  const save = (a: Announcement) => {
    const editing = composer?.mode === "edit";
    const next: Announcement = editing ? a : { ...a, id: `ANN-0${48 + list.length - ANNOUNCEMENTS.length}`, readPct: a.publishAt <= CONSOLE_NOW ? 0 : undefined, ackPct: a.requiresAck && a.publishAt <= CONSOLE_NOW ? 0 : undefined };
    setList((l) => (editing ? l.map((x) => (x.id === a.id ? { ...x, ...a } : x)) : [next, ...l]));
    const recipients = audienceTenants(a.audience, tenants).length;
    recordConsoleAudit({
      action: editing ? "announcement.edit" : "announcement.publish",
      category: "announcement",
      target: { kind: "announcement", id: next.id, label: next.title },
      after: { type: a.type, audience: audienceLabel(a.audience, tenants), channel: a.channel, publishAt: a.publishAt },
    });
    const status = announcementStatus(next);
    setTab(status);
    mockAction(editing ? `${a.id} updated` : status === "live" ? "Announcement published" : "Announcement scheduled", {
      description: `${audienceLabel(a.audience, tenants)} · ${num(recipients)} tenants · ${CHANNEL_LABEL[a.channel]}${status === "scheduled" ? ` · goes out ${fmtDateTime(a.publishAt)}` : ""}.`,
    });
    setComposer(null);
  };

  const columns = React.useMemo<ColumnDef<Announcement, unknown>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Announcement",
        cell: ({ row }) => (
          <div className="flex min-w-[260px] max-w-[420px] flex-col gap-1">
            <p className="font-medium text-foreground">{row.original.title}</p>
            <span className="flex flex-wrap items-center gap-1.5">
              <TypePill type={row.original.type} />
              <span className="font-mono text-[11px] text-muted-foreground">{row.original.id}</span>
            </span>
          </div>
        ),
      },
      { accessorKey: "severity", header: "Severity", cell: ({ row }) => <SeverityPill severity={row.original.severity} /> },
      {
        id: "audience",
        header: "Audience",
        accessorFn: (a) => audienceLabel(a.audience, tenants),
        cell: ({ row }) => (
          <div className="text-xs">
            <p>{audienceLabel(row.original.audience, tenants)}</p>
            <p className="tnum text-[11px] text-muted-foreground">{num(audienceTenants(row.original.audience, tenants).length)} tenants</p>
          </div>
        ),
      },
      { accessorKey: "channel", header: "Channel", cell: ({ row }) => <span className="whitespace-nowrap text-xs">{CHANNEL_LABEL[row.original.channel]}</span> },
      {
        accessorKey: "publishAt",
        header: "Schedule",
        cell: ({ row }) => {
          const a = row.original;
          return (
            <div className="tnum whitespace-nowrap text-xs">
              <p>{fmtDateTime(a.publishAt)}</p>
              <p className="text-[11px] text-muted-foreground">
                {a.window ? `Window ${fmtDateTime(a.window.start)} – ${fmtDateTime(a.window.end).slice(-8)}` : `until ${fmtDateTime(a.endedAt ?? a.expiresAt)}`}
              </p>
            </div>
          );
        },
      },
      { id: "status", header: "Status", accessorFn: (a) => announcementStatus(a), cell: ({ row }) => <AnnouncementStatusPill status={announcementStatus(row.original)} endedEarly={!!row.original.endedAt} /> },
      { id: "read", header: "Read", accessorFn: (a) => a.readPct ?? -1, cell: ({ row }) => <RateCell pct={row.original.readPct} of={audienceTenants(row.original.audience, tenants).length} label="Read rate" /> },
      {
        id: "ack",
        header: "Acknowledged",
        accessorFn: (a) => a.ackPct ?? -1,
        cell: ({ row }) =>
          row.original.requiresAck ? (
            <RateCell pct={row.original.ackPct} of={audienceTenants(row.original.audience, tenants).length} label="Acknowledged" />
          ) : (
            <span className="text-[11px] text-muted-foreground">Not required</span>
          ),
      },
      {
        id: "__a",
        header: "",
        enableHiding: false,
        cell: ({ row }) => {
          const a = row.original;
          const s = announcementStatus(a);
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${a.id}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{a.id}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {s === "scheduled" && (
                    <DropdownMenuItem onSelect={() => setComposer({ mode: "edit", initial: a })}>
                      <Pencil /> Edit
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={() => setComposer({ mode: "duplicate", initial: a })}>
                    <Copy /> Duplicate
                  </DropdownMenuItem>
                  {s === "live" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem destructive onSelect={() => setEnding(a)}>
                        <Square /> End now
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [tenants],
  );

  const table = (rows: Announcement[], empty: string) => (
    <DataTable
      columns={columns}
      data={rows}
      searchKeys={["title", "id", "body"]}
      searchPlaceholder="Search announcements…"
      getRowId={(a) => a.id}
      rowTone={(a) => (a.severity === "critical" && announcementStatus(a) === "live" ? "danger" : undefined)}
      exportName="platform-announcements"
      canExport
      emptyIcon={Megaphone}
      emptyTitle={empty}
      emptyDescription="Compose a new announcement to reach tenant admins and owners."
    />
  );

  return (
    <PageBody>
      <PageHeader
        title="Announcements"
        description="Maintenance windows, release notes, incidents and policy changes, sent to tenant admins as an in-app banner, an email to the tenant owner, or both."
        actions={
          <Button size="sm" onClick={() => setComposer({ mode: "new" })}>
            <Plus /> New announcement
          </Button>
        }
      />

      {loading ? (
        <>
          <CardsSkeleton count={4} />
          <TableSkeleton rows={6} />
        </>
      ) : (
        <>
          <StatRow cols={4}>
            <StatTile label="Live now" value={num(live.length)} icon={Megaphone} tone={live.some((a) => a.severity === "critical") ? "critical" : "accent"} hint={live.some((a) => a.severity === "critical") ? "Includes an active incident" : "On tenant screens"} onClick={() => setTab("live")} />
            <StatTile label="Scheduled" value={num(scheduled.length)} icon={CalendarClock} hint={scheduled[0] ? `Next: ${fmtDateTime([...scheduled].sort((x, y) => x.publishAt.localeCompare(y.publishAt))[0].publishAt)}` : "Nothing queued"} onClick={() => setTab("scheduled")} />
            <StatTile label="Average read rate" value={`${avgRead}%`} icon={Eye} hint="Past announcements, share of recipient tenants" onClick={() => setTab("past")} />
            <StatTile label="Awaiting acknowledgement" value={num(awaitingAck.length)} icon={CheckCheck} tone={awaitingAck.length ? "warning" : "good"} hint="Live announcements that need an admin to confirm" onClick={() => setTab("live")} />
          </StatRow>

          <Tabs value={tab} onValueChange={(v) => setTab(v as AnnouncementStatus)}>
            <TabsList>
              <TabsTrigger value="scheduled">Scheduled ({scheduled.length})</TabsTrigger>
              <TabsTrigger value="live">Live ({live.length})</TabsTrigger>
              <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="scheduled">{table(scheduled, "Nothing scheduled")}</TabsContent>
            <TabsContent value="live">{table(live, "No announcement is live")}</TabsContent>
            <TabsContent value="past">{table(past, "No past announcements")}</TabsContent>
          </Tabs>
        </>
      )}

      {composer && <AnnouncementComposer mode={composer.mode} initial={composer.initial} onOpenChange={(v) => !v && setComposer(null)} onSave={save} />}

      <ConfirmDialog
        open={!!ending}
        onOpenChange={(v) => !v && setEnding(null)}
        title={`End ${ending?.id ?? "announcement"} now?`}
        description={`“${ending?.title ?? ""}” comes down from every tenant's screens straight away. Emails already sent cannot be recalled.`}
        confirmLabel="End now"
        destructive
        comment={{ label: "Reason", placeholder: "e.g. Incident resolved; status page updated." }}
        onConfirm={(reason) => {
          if (!ending) return;
          const a = ending;
          setList((l) => l.map((x) => (x.id === a.id ? { ...x, endedAt: CONSOLE_NOW } : x)));
          recordConsoleAudit({ action: "announcement.end", category: "announcement", target: { kind: "announcement", id: a.id, label: a.title }, reason, before: { status: "live" }, after: { status: "ended" } });
          mockAction(`${a.id} ended`, { description: "The banner is down for every recipient tenant.", tone: "info", undo: () => setList((l) => l.map((x) => (x.id === a.id ? { ...x, endedAt: undefined } : x))) });
          setTab("past");
        }}
      />
    </PageBody>
  );
}
