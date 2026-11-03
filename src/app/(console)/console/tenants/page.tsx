"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Ban, Building2, Eye, Headset, Hourglass, Layers, Mail, MoreHorizontal, Play, Plus } from "lucide-react";
import { fmtAgo, fmtDate, inr } from "@/lib/format";
import {
  CONSOLE_TENANTS,
  COUNTRY_META,
  PLAN_META,
  STATUS_LABEL,
  type ConsoleTenant,
  type TenantCountry,
  type TenantStatus,
} from "@/mock/console-tenants";
import { mockAction } from "@/components/app-state";
import { useConsole } from "@/components/console/console-state";
import { CreateTenantDialog } from "@/components/console/create-tenant-dialog";
import { PlanBadge, SeatMeter, TenantStatusBadge } from "@/components/console/kit";
import { useTenantActions } from "@/components/console/tenant-actions";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { ReasonDialog } from "@/components/platform/kit";
import { Button } from "@/components/ui/button";
import {
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  FilterSelect,
} from "@/components/ui/overlays";

/* Only tenants in the fixture have a pre-rendered detail page in the static
   export; one created this session is still provisioning anyway. */
const HAS_PAGE = new Set(CONSOLE_TENANTS.map((t) => t.id));

export default function TenantsPage() {
  return (
    <React.Suspense fallback={<TableSkeleton />}>
      <TenantsScreen />
    </React.Suspense>
  );
}

type Bulk = { kind: "suspend" | "reactivate"; rows: ConsoleTenant[]; clear: () => void };

function TenantsScreen() {
  const loading = useFakeLoad();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tenants, updateTenant, logActivity } = useConsole();
  const { open, can, dialogs } = useTenantActions();
  const [creating, setCreating] = React.useState(false);
  const [status, setStatus] = React.useState(() => searchParams.get("status") ?? "all");
  const [plan, setPlan] = React.useState("all");
  const [country, setCountry] = React.useState("all");
  const [bulk, setBulk] = React.useState<Bulk | null>(null);

  const data = React.useMemo(
    () =>
      tenants.filter(
        (t) => (status === "all" || t.status === status) && (plan === "all" || t.plan === plan) && (country === "all" || t.country === country),
      ),
    [tenants, status, plan, country],
  );

  const openTenant = React.useCallback(
    (t: ConsoleTenant) => {
      if (HAS_PAGE.has(t.id)) router.push(`/console/tenants/${t.id}`);
      else mockAction(`${t.name} is still provisioning`, { description: "Its detail page opens once the owner accepts the invitation.", tone: "info" });
    },
    [router],
  );

  const columns = React.useMemo<ColumnDef<ConsoleTenant, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Tenant",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{row.original.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              <span className="font-mono">{row.original.id}</span> · {COUNTRY_META[row.original.country].label}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "subdomain",
        header: "Subdomain",
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.subdomain}</span>,
      },
      { accessorKey: "plan", header: "Plan", cell: ({ row }) => <PlanBadge plan={row.original.plan} /> },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <TenantStatusBadge status={row.original.status} />
            {row.original.status === "trial" && row.original.trialEndsAt && (
              <span className="text-[11px] text-muted-foreground">ends {fmtDate(row.original.trialEndsAt)}</span>
            )}
          </div>
        ),
      },
      {
        id: "seats",
        header: "Seats",
        accessorFn: (t) => t.seatsUsed / (t.seatLimit || 1),
        cell: ({ row }) => <SeatMeter used={row.original.seatsUsed} limit={row.original.seatLimit} />,
      },
      {
        accessorKey: "mrr",
        header: "MRR",
        cell: ({ row }) =>
          row.original.mrr ? <NumCell>{inr(row.original.mrr, { decimals: false })}</NumCell> : <NumCell className="text-muted-foreground">—</NumCell>,
      },
      {
        accessorKey: "ownerName",
        header: "Owner",
        cell: ({ row }) => (
          <div className="min-w-0 text-xs">
            <p className="truncate">{row.original.ownerName}</p>
            <p className="truncate text-[11px] text-muted-foreground">{row.original.ownerEmail}</p>
          </div>
        ),
      },
      { accessorKey: "createdAt", header: "Created", cell: ({ row }) => <span className="tnum text-xs">{fmtDate(row.original.createdAt)}</span> },
      { accessorKey: "lastActiveAt", header: "Last active", cell: ({ row }) => <MutedCell>{fmtAgo(row.original.lastActiveAt)}</MutedCell> },
      {
        id: "__a",
        header: "",
        enableHiding: false,
        cell: ({ row }) => {
          const t = row.original;
          return (
            <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${t.name}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{t.name}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => openTenant(t)}>
                    <Eye /> Open
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={!can("plan", t)} onSelect={() => open("plan", t)}>
                    <Layers /> Change plan or seats
                  </DropdownMenuItem>
                  {t.status === "trial" && (
                    <DropdownMenuItem onSelect={() => open("trial", t)}>
                      <Hourglass /> Extend trial
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem disabled={!can("impersonate", t)} onSelect={() => open("impersonate", t)}>
                    <Headset /> Impersonate for support
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {t.status === "suspended" ? (
                    <DropdownMenuItem onSelect={() => open("reactivate", t)}>
                      <Play /> Reactivate
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem destructive disabled={!can("suspend", t)} onSelect={() => open("suspend", t)}>
                      <Ban /> Suspend
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [open, can, openTenant],
  );

  const runBulk = (reason: string) => {
    if (!bulk) return;
    const next: TenantStatus = bulk.kind === "suspend" ? "suspended" : "active";
    bulk.rows.forEach((t) => {
      updateTenant(t.id, bulk.kind === "suspend" ? { status: next, statusNote: reason } : { status: next, statusNote: undefined });
      logActivity(t.id, { category: "lifecycle", action: bulk.kind === "suspend" ? "Tenant suspended (bulk)" : "Tenant reactivated (bulk)", detail: reason || "Bulk reactivation" });
    });
    bulk.clear();
    mockAction(`${bulk.rows.length} tenant${bulk.rows.length === 1 ? "" : "s"} ${bulk.kind === "suspend" ? "suspended" : "reactivated"}`, {
      description: bulk.rows.map((t) => t.name).join(", "),
      tone: bulk.kind === "suspend" ? "warning" : "success",
    });
  };

  return (
    <PageBody>
      <PageHeader
        title="Tenants"
        description="Every organisation on the platform. Plans, seats and lifecycle are managed here; nothing inside a tenant is visible without a support session."
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus /> Create tenant
          </Button>
        }
      />

      {loading ? (
        <TableSkeleton rows={12} />
      ) : (
        <DataTable
          columns={columns}
          data={data}
          searchKeys={["name", "subdomain", "ownerName", "ownerEmail", "id"]}
          searchPlaceholder="Search tenant, subdomain, owner…"
          filters={
            <>
              <FilterSelect
                label="Status"
                value={status}
                onValueChange={setStatus}
                width="w-[170px]"
                options={(Object.keys(STATUS_LABEL) as TenantStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
              />
              <FilterSelect label="Plan" value={plan} onValueChange={setPlan} options={Object.values(PLAN_META).map((p) => ({ value: p.id, label: p.label }))} />
              <FilterSelect
                label="Region"
                value={country}
                onValueChange={setCountry}
                width="w-[170px]"
                options={(Object.keys(COUNTRY_META) as TenantCountry[]).map((c) => ({ value: c, label: COUNTRY_META[c].label }))}
              />
            </>
          }
          onRowClick={openTenant}
          getRowId={(t) => t.id}
          rowTone={(t) => (t.status === "suspended" ? "danger" : t.payment === "failed" || t.payment === "overdue" ? "warning" : undefined)}
          enableSelection
          bulkActions={(sel, clear) => {
            const suspendable = sel.filter((t) => can("suspend", t));
            const suspended = sel.filter((t) => t.status === "suspended");
            return (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    clear();
                    mockAction(`Email queued to ${sel.length} owner${sel.length === 1 ? "" : "s"}`, { description: "Sent from platform-ops@hrms-new.app. Replies go to the support queue." });
                  }}
                >
                  <Mail /> Email owners
                </Button>
                <Button size="sm" variant="outline" disabled={!suspended.length} onClick={() => setBulk({ kind: "reactivate", rows: suspended, clear })}>
                  <Play /> Reactivate {suspended.length || ""}
                </Button>
                <Button size="sm" variant="destructive" disabled={!suspendable.length} onClick={() => setBulk({ kind: "suspend", rows: suspendable, clear })}>
                  <Ban /> Suspend {suspendable.length || ""}
                </Button>
              </>
            );
          }}
          exportName="platform-tenants"
          canExport
          emptyIcon={Building2}
          emptyTitle="No tenants match"
          emptyDescription="Clear the filters or search to see every organisation on the platform."
        />
      )}

      <ReasonDialog
        open={bulk?.kind === "suspend"}
        onOpenChange={(v) => !v && setBulk(null)}
        title={`Suspend ${bulk?.rows.length ?? 0} tenant${bulk?.rows.length === 1 ? "" : "s"}?`}
        description={`${bulk?.rows.map((t) => t.name).join(", ") ?? ""}. Every user is signed out; data is retained and jobs pause until reactivated.`}
        confirmLabel="Suspend all"
        commentLabel="Reason (shown to each tenant owner)"
        onConfirm={runBulk}
      />
      <ConfirmDialog
        open={bulk?.kind === "reactivate"}
        onOpenChange={(v) => !v && setBulk(null)}
        title={`Reactivate ${bulk?.rows.length ?? 0} tenant${bulk?.rows.length === 1 ? "" : "s"}?`}
        description={`${bulk?.rows.map((t) => t.name).join(", ") ?? ""}. Users can sign in again straight away.`}
        confirmLabel="Reactivate all"
        onConfirm={() => runBulk("")}
      />
      <CreateTenantDialog open={creating} onOpenChange={setCreating} />
      {dialogs}
    </PageBody>
  );
}
