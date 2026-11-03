"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { FileClock, Lock, ShieldX, Users, X } from "lucide-react";
import { fmtDateTime, num } from "@/lib/format";
import { CONSOLE_TODAY, type ConsoleTenant } from "@/mock/console-tenants";
import type { TenantActivity } from "@/mock/console-tenant-detail";
import {
  AUDIT_CATEGORY_LABEL,
  AUDIT_RETENTION_YEARS,
  CONSOLE_AUDIT,
  OPERATOR_IP,
  type AuditCategory,
  type ConsoleAuditEntry,
} from "@/mock/console-audit";
import { useConsole } from "@/components/console/console-state";
import { useConsoleAuditTrail } from "@/components/console/console-audit-trail";
import { AuditDetailSheet, AuditResultPill } from "@/components/console/audit-detail-sheet";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { DataTable } from "@/components/data-table";
import { CardsSkeleton, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Alert, Avatar, Input } from "@/components/ui/primitives";
import { FilterSelect } from "@/components/ui/overlays";

type Row = ConsoleAuditEntry & { targetLabel: string };

const slug = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, "").trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

/* Operator actions logged on a tenant this session (useConsole().activityFor),
   reshaped into console audit entries. The verb is read from the action text. */
function fromActivity(t: ConsoleTenant, a: TenantActivity): ConsoleAuditEntry {
  const s = a.action.toLowerCase();
  const category: AuditCategory = a.category === "support" ? "support" : a.category === "billing" && !s.includes("plan") && !s.includes("trial") ? "billing" : "tenant";
  const verb =
    a.category === "support"
      ? s.includes("terminated") ? "session_terminate" : s.includes("requested") ? "access_request" : s.includes("ended") ? "session_end" : "session_start"
      : s.includes("suspended") ? "suspend"
      : s.includes("reactivated") ? "reactivate"
      : s.includes("deletion cancelled") ? "delete_cancelled"
      : s.includes("deletion scheduled") ? "delete_scheduled"
      : s.includes("export") ? "export"
      : s.includes("plan changed") ? "plan_change"
      : s.includes("trial extended") ? "trial_extend"
      : slug(a.action);
  const [before, after] = a.detail.includes(" → ") ? a.detail.split(" → ") : [];
  return {
    id: a.id.toUpperCase(),
    at: a.at,
    operator: a.actor,
    action: `${category === "billing" ? "billing" : category === "support" ? "support" : "tenant"}.${verb}`,
    category,
    target: { kind: "tenant", id: t.id, label: t.name },
    tenantId: t.id,
    reason: a.detail,
    ip: OPERATOR_IP[a.actor] ?? "103.21.58.14",
    result: "success",
    before: before ? { summary: before } : undefined,
    after: after ? { summary: after.split(" — ")[0] } : undefined,
  };
}

export default function ConsoleAuditPage() {
  const loading = useFakeLoad();
  const { tenants, activityFor } = useConsole();
  const trail = useConsoleAuditTrail();
  const [operator, setOperator] = React.useState("all");
  const [category, setCategory] = React.useState("all");
  const [tenant, setTenant] = React.useState("all");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [detail, setDetail] = React.useState<Row | null>(null);

  const all = React.useMemo<Row[]>(() => {
    const live = tenants.flatMap((t) => activityFor(t.id).filter((a) => a.actorKind === "operator").map((a) => fromActivity(t, a)));
    return [...trail, ...live, ...CONSOLE_AUDIT]
      .map((e) => ({ ...e, targetLabel: e.target.label }))
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [tenants, activityFor, trail]);

  const data = React.useMemo(
    () =>
      all.filter(
        (e) =>
          (operator === "all" || e.operator === operator) &&
          (category === "all" || e.category === category) &&
          (tenant === "all" || e.tenantId === tenant) &&
          (!from || e.at.slice(0, 10) >= from) &&
          (!to || e.at.slice(0, 10) <= to),
      ),
    [all, operator, category, tenant, from, to],
  );

  const operators = Array.from(new Set(all.map((e) => e.operator))).sort();
  const touchedTenants = tenants.filter((t) => all.some((e) => e.tenantId === t.id));
  const today = all.filter((e) => e.at.startsWith(CONSOLE_TODAY)).length;
  const refused = all.filter((e) => e.result !== "success").length;
  const weekAgo = "2026-09-09";
  const filtered = operator !== "all" || category !== "all" || tenant !== "all" || from || to;

  const columns = React.useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      { accessorKey: "at", header: "When", cell: ({ row }) => <span className="tnum whitespace-nowrap text-xs">{fmtDateTime(row.original.at)}</span> },
      {
        accessorKey: "operator",
        header: "Operator",
        cell: ({ row }) => (
          <span className="flex items-center gap-2 whitespace-nowrap">
            <Avatar name={row.original.operator} size={22} />
            {row.original.operator}
          </span>
        ),
      },
      {
        accessorKey: "action",
        header: "Action",
        cell: ({ row }) => (
          <div>
            <p className="font-mono text-xs">{row.original.action}</p>
            <p className="text-[11px] text-muted-foreground">{AUDIT_CATEGORY_LABEL[row.original.category]}</p>
          </div>
        ),
      },
      {
        accessorKey: "targetLabel",
        header: "Target",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{row.original.target.label}</p>
            <p className="font-mono text-[11px] text-muted-foreground">
              {row.original.target.kind} · {row.original.target.id}
            </p>
          </div>
        ),
      },
      { accessorKey: "reason", header: "Reason", cell: ({ row }) => <span className="block max-w-[280px] truncate text-xs text-muted-foreground">{row.original.reason ?? "—"}</span> },
      { accessorKey: "ip", header: "IP", cell: ({ row }) => <span className="font-mono text-[11px]">{row.original.ip}</span> },
      { accessorKey: "result", header: "Result", cell: ({ row }) => <AuditResultPill result={row.original.result} /> },
    ],
    [],
  );

  return (
    <PageBody>
      <PageHeader
        title="Audit Log"
        description="Every action taken in the Platform Console — by whom, from where, why, and exactly what changed. Separate from each tenant's own audit trail."
      />
      <Alert tone="neutral" icon={Lock} title="Append-only">
        Entries cannot be edited or deleted, by anyone — including Super Admins. Retained {AUDIT_RETENTION_YEARS} years, then purged
        by the retention job. Each entry is hash-chained to the one before it.
      </Alert>

      {loading ? (
        <>
          <CardsSkeleton count={4} />
          <TableSkeleton rows={12} />
        </>
      ) : (
        <>
          <StatRow cols={4}>
            <StatTile label="Entries" value={num(all.length)} icon={FileClock} hint={trail.length ? `${trail.length} recorded this session` : "Showing the last 30 days"} />
            <StatTile label="Today" value={num(today)} icon={FileClock} hint="16 Sep 2026" onClick={() => { setFrom(CONSOLE_TODAY); setTo(CONSOLE_TODAY); }} />
            <StatTile label="Denied or failed" value={num(refused)} icon={ShieldX} tone={refused ? "warning" : "good"} hint="Refused at policy or step-up" />
            <StatTile label="Operators active (7 days)" value={num(new Set(all.filter((e) => e.at >= weekAgo).map((e) => e.operator)).size)} icon={Users} />
          </StatRow>

          <Section title="Console actions" bodyClassName="p-4">
            <DataTable
              columns={columns}
              data={data}
              searchKeys={["action", "operator", "targetLabel", "reason", "ip", "id"]}
              searchPlaceholder="Search action, target, reason, IP…"
              getRowId={(e) => e.id}
              onRowClick={setDetail}
              rowTone={(e) => (e.result === "denied" ? "danger" : e.result === "failed" ? "warning" : undefined)}
              exportName="console-audit-log"
              canExport
              pageSize={15}
              emptyIcon={FileClock}
              emptyTitle="No entries match"
              emptyDescription="Widen the date range or clear the filters."
              filters={
                <>
                  <FilterSelect label="Operator" value={operator} onValueChange={setOperator} allLabel="All" width="w-[180px]" options={operators.map((o) => ({ value: o, label: o }))} />
                  <FilterSelect label="Category" value={category} onValueChange={setCategory} width="w-[185px]" options={(Object.keys(AUDIT_CATEGORY_LABEL) as AuditCategory[]).map((c) => ({ value: c, label: AUDIT_CATEGORY_LABEL[c] }))} />
                  <FilterSelect label="Tenant" value={tenant} onValueChange={setTenant} width="w-[200px]" options={touchedTenants.map((t) => ({ value: t.id, label: t.name }))} />
                  <span className="flex items-center gap-1">
                    <Input type="date" aria-label="From date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="h-7 w-[136px] text-xs" />
                    <span className="text-xs text-muted-foreground" aria-hidden>
                      –
                    </span>
                    <Input type="date" aria-label="To date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="h-7 w-[136px] text-xs" />
                  </span>
                  {filtered && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setOperator("all");
                        setCategory("all");
                        setTenant("all");
                        setFrom("");
                        setTo("");
                      }}
                    >
                      <X /> Clear
                    </Button>
                  )}
                </>
              }
            />
          </Section>
        </>
      )}

      <AuditDetailSheet entry={detail} onOpenChange={(v) => !v && setDetail(null)} />
    </PageBody>
  );
}
