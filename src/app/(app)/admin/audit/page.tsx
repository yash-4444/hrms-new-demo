"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight, History, Monitor, ShieldAlert, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateTime, num } from "@/lib/format";
import {
  AUDIT_ACTIONS,
  AUDIT_ACTION_LABEL,
  AUDIT_ACTION_STATUS,
  AUDIT_ACTORS,
  AUDIT_BY_ACTION,
  AUDIT_DAILY,
  AUDIT_ENTITY_TYPES,
  AUDIT_LOG,
  AUDIT_STATS,
  type AuditEntry,
  type AuditFields,
} from "@/mock/admin";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, EmptyState } from "@/components/ui/primitives";
import {
  FilterSelect,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { TrendAreaChart, BarCompareChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import {
  PageBody,
  PageHeader,
  Section,
  TableSkeleton,
  useFakeLoad,
} from "@/components/shell/page";

export default function AuditPage() {
  const loading = useFakeLoad();

  const [actor, setActor] = React.useState("all");
  const [action, setAction] = React.useState("all");
  const [entityType, setEntityType] = React.useState("all");
  const [range, setRange] = React.useState("all");
  const [detail, setDetail] = React.useState<AuditEntry | null>(null);

  const filtered = React.useMemo(() => {
    const cutoff =
      range === "24h" ? "2026-09-15" : range === "7d" ? "2026-09-09" : range === "30d" ? "2026-08-17" : null;
    return AUDIT_LOG.filter(
      (e) =>
        (actor === "all" || e.actorCode === actor) &&
        (action === "all" || e.action === action) &&
        (entityType === "all" || e.entityType === entityType) &&
        (!cutoff || e.at.slice(0, 10) >= cutoff),
    );
  }, [actor, action, entityType, range]);

  const columns = React.useMemo<ColumnDef<AuditEntry, unknown>[]>(
    () => [
      {
        accessorKey: "at",
        header: "When",
        cell: ({ row }) => <span className="tnum whitespace-nowrap">{fmtDateTime(row.original.at)}</span>,
      },
      {
        accessorKey: "actorName",
        header: "Actor",
        cell: ({ row }) => (
          <span className="flex items-center gap-2">
            <Avatar name={row.original.actorName} size={22} />
            <span className="flex flex-col">
              <Link
                href={`/employees/${row.original.actorCode}`}
                className="font-medium hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {row.original.actorName}
              </Link>
              <span className="text-[10px] text-muted-foreground">{row.original.actorRole}</span>
            </span>
          </span>
        ),
      },
      {
        accessorKey: "action",
        header: "Action",
        cell: ({ row }) => (
          <StatusBadge
            status={AUDIT_ACTION_STATUS[row.original.action]}
            label={AUDIT_ACTION_LABEL[row.original.action]}
          />
        ),
      },
      {
        accessorKey: "entityType",
        header: "Entity",
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span className="font-medium">{row.original.entityLabel}</span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {row.original.entityType} · {row.original.entityId}
            </span>
          </span>
        ),
      },
      {
        accessorKey: "summary",
        header: "Summary",
        cell: ({ row }) => (
          <span className="block max-w-[320px] truncate text-muted-foreground">
            {row.original.summary}
          </span>
        ),
      },
      {
        accessorKey: "ip",
        header: "IP",
        cell: ({ row }) => <span className="tnum font-mono text-[11px]">{row.original.ip}</span>,
      },
      {
        accessorKey: "device",
        header: "Device",
        cell: ({ row }) => (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Monitor className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{row.original.device}</span>
          </span>
        ),
      },
      {
        accessorKey: "outcome",
        header: "Outcome",
        cell: ({ row }) => (
          <StatusBadge status={row.original.outcome === "success" ? "completed" : "failed"} />
        ),
      },
      {
        id: "open",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <Button variant="ghost" size="sm" onClick={() => setDetail(row.original)}>
            Details
          </Button>
        ),
      },
    ],
    [],
  );

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Audit log" description="Loading the trail…" />
        <TableSkeleton />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="Audit log"
        description="Every change made in the tenant: who, what, when, from where — and the exact before-and-after values."
      />

      <StatRow cols={4}>
        <StatTile label="Events recorded" value={num(AUDIT_STATS.total)} icon={History} hint="Retained for 7 years" />
        <StatTile
          label="Last 7 days"
          value={num(AUDIT_STATS.last7)}
          icon={History}
          onClick={() => setRange("7d")}
        />
        <StatTile
          label="Permission changes"
          value={num(AUDIT_STATS.permissionChanges)}
          icon={ShieldAlert}
          tone="warning"
          hint="Reviewed in the quarterly access certification"
          onClick={() => setAction("permission_change")}
        />
        <StatTile
          label="Failed sign-ins"
          value={num(AUDIT_STATS.failedSignIns)}
          icon={User}
          tone={AUDIT_STATS.failedSignIns > 0 ? "warning" : "good"}
          hint={`${num(AUDIT_STATS.exports)} data exports recorded`}
          onClick={() => setAction("login")}
        />
      </StatRow>

      <Section title="Trail" bodyClassName="p-4">
        <DataTable
          columns={columns}
          data={filtered}
          searchKeys={["actorName", "summary", "entityLabel", "entityId", "ip"]}
          searchPlaceholder="Search actor, entity, IP…"
          exportName="audit-trail"
          getRowId={(e) => e.id}
          onRowClick={(e) => setDetail(e)}
          pageSize={15}
          emptyIcon={History}
          emptyTitle="No events match"
          emptyDescription="Widen the date range, or clear the actor and action filters."
          rowTone={(e) => (e.outcome === "failed" ? "danger" : undefined)}
          filters={
            <>
              <FilterSelect
                label="Actor"
                value={actor}
                onValueChange={setActor}
                allLabel="All actors"
                width="w-[185px]"
                options={AUDIT_ACTORS.map((a) => ({ value: a.code, label: a.name }))}
              />
              <FilterSelect
                label="Action"
                value={action}
                onValueChange={setAction}
                allLabel="All actions"
                width="w-[185px]"
                options={AUDIT_ACTIONS.map((a) => ({ value: a, label: AUDIT_ACTION_LABEL[a] }))}
              />
              <FilterSelect
                label="Entity"
                value={entityType}
                onValueChange={setEntityType}
                allLabel="All entities"
                width="w-[175px]"
                options={AUDIT_ENTITY_TYPES.map((t) => ({ value: t, label: t }))}
              />
              <FilterSelect
                label="Range"
                value={range}
                onValueChange={setRange}
                allLabel="All time"
                width="w-[155px]"
                options={[
                  { value: "24h", label: "Last 24 hours" },
                  { value: "7d", label: "Last 7 days" },
                  { value: "30d", label: "Last 30 days" },
                ]}
              />
            </>
          }
        />
      </Section>

      <div className="grid gap-3 lg:grid-cols-2">
        <TrendAreaChart
          title="Activity over time"
          description="All events, and the subset touching permissions or compensation."
          data={AUDIT_DAILY.map((d) => ({ day: d.day, events: d.events, sensitive: d.sensitive }))}
          xKey="day"
          series={[
            { key: "events", label: "All events" },
            { key: "sensitive", label: "Sensitive events" },
          ]}
          height={240}
        />
        <BarCompareChart
          title="Events by action"
          description="Click a bar to filter the trail to that action."
          data={AUDIT_BY_ACTION}
          xKey="name"
          series={[{ key: "value", label: "Events" }]}
          horizontal
          height={240}
          onBarClick={(row) => {
            const hit = AUDIT_ACTIONS.find((a) => AUDIT_ACTION_LABEL[a] === row.name);
            if (hit) setAction(hit);
          }}
        />
      </div>

      {/* --------------------------------------------- old vs new drawer */}
      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent side="right" width="sm:max-w-xl">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle>{AUDIT_ACTION_LABEL[detail.action]}</SheetTitle>
                <SheetDescription>
                  {detail.entityLabel} · {detail.entityType} {detail.entityId}
                </SheetDescription>
              </SheetHeader>
              <SheetBody className="flex flex-col gap-3">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {[
                    ["Actor", `${detail.actorName} (${detail.actorRole})`],
                    ["When", fmtDateTime(detail.at)],
                    ["IP address", detail.ip],
                    ["Device", detail.device],
                    ["Outcome", detail.outcome === "success" ? "Success" : "Failed"],
                    ["Event id", detail.id],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</dt>
                      <dd className="tnum mt-0.5 break-all text-xs font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>

                <div className="rounded-md border border-border bg-subtle p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Summary
                  </p>
                  <p className="mt-1 text-xs leading-relaxed">{detail.summary}</p>
                </div>

                {detail.before || detail.after ? (
                  <ValueDiff before={detail.before} after={detail.after} />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    This event type carries no field-level change — it is recorded for the action
                    alone.
                  </p>
                )}

                <p className="border-t border-border pt-2.5 font-mono text-[10px] leading-relaxed text-muted-foreground">
                  {detail.userAgent}
                </p>
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>
    </PageBody>
  );
}

/* ------------------------------------------------------ old vs new diff */

function ValueDiff({ before, after }: { before?: AuditFields; after?: AuditFields }) {
  const keys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]));
  const fmt = (v: unknown) =>
    v === null || v === undefined || v === "" ? "—" : typeof v === "boolean" ? (v ? "Yes" : "No") : String(v);

  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Field changes
      </p>
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-xs">
          <thead className="bg-subtle">
            <tr className="border-b border-border">
              <th className="px-2.5 py-1.5 text-left font-medium text-muted-foreground">Field</th>
              <th className="px-2.5 py-1.5 text-left font-medium text-muted-foreground">Before</th>
              <th className="w-6 px-1 py-1.5" />
              <th className="px-2.5 py-1.5 text-left font-medium text-muted-foreground">After</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => {
              const b = before?.[k];
              const a = after?.[k];
              const changed = fmt(b) !== fmt(a);
              return (
                <tr
                  key={k}
                  className={cn(
                    "border-b border-border last:border-0",
                    changed ? "bg-warning-soft/30" : "opacity-60",
                  )}
                >
                  <td className="px-2.5 py-1.5 font-medium">{k}</td>
                  <td
                    className={cn(
                      "px-2.5 py-1.5 font-mono",
                      changed ? "text-destructive-fg line-through decoration-destructive/40" : "text-muted-foreground",
                    )}
                  >
                    {fmt(b)}
                  </td>
                  <td className="px-1 py-1.5 text-center text-muted-foreground">
                    {changed && <ArrowRight className="mx-auto size-3" aria-hidden />}
                  </td>
                  <td
                    className={cn(
                      "px-2.5 py-1.5 font-mono",
                      changed ? "font-semibold text-success-fg" : "text-muted-foreground",
                    )}
                  >
                    {fmt(a)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground">
        Changed fields are highlighted; unchanged fields are shown muted for context.
      </p>
    </div>
  );
}
