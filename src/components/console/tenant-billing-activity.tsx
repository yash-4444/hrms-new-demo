"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Bot, Building2, Download, FileText, RotateCcw, Send, ServerCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDateTime, inr, num } from "@/lib/format";
import { PLAN_META, type ConsoleTenant } from "@/mock/console-tenants";
import { tenantActivity, tenantInvoices, type ActivityCategory, type TenantActivity, type TenantInvoice } from "@/mock/console-tenant-detail";
import { mockAction } from "@/components/app-state";
import { useConsole } from "@/components/console/console-state";
import { PlanBadge } from "@/components/console/kit";
import { DataTable, NumCell } from "@/components/data-table";
import { Section } from "@/components/shell/page";
import { Facts } from "@/components/platform/kit";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { FilterSelect } from "@/components/ui/overlays";

/* Tenant detail — the Billing and Activity tabs. */

export function TenantBillingTab({ tenant: t, onChangePlan }: { tenant: ConsoleTenant; onChangePlan: () => void }) {
  const invoices = React.useMemo(() => tenantInvoices(t), [t]);
  const plan = PLAN_META[t.plan];
  const monthly = t.seatLimit * plan.seatPrice;
  const outstanding = invoices.filter((i) => i.status === "failed" || i.status === "overdue");

  const columns = React.useMemo<ColumnDef<TenantInvoice, unknown>[]>(
    () => [
      { accessorKey: "id", header: "Invoice", cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span> },
      { accessorKey: "period", header: "Period" },
      { accessorKey: "issuedOn", header: "Issued", cell: ({ row }) => <span className="tnum text-xs">{fmtDate(row.original.issuedOn)}</span> },
      { accessorKey: "dueOn", header: "Due", cell: ({ row }) => <span className="tnum text-xs">{fmtDate(row.original.dueOn)}</span> },
      { accessorKey: "amount", header: "Amount", cell: ({ row }) => <NumCell>{inr(row.original.amount, { decimals: false })}</NumCell> },
      {
        accessorKey: "tax",
        header: "GST",
        cell: ({ row }) => <NumCell className="text-muted-foreground">{row.original.tax ? inr(row.original.tax, { decimals: false }) : "—"}</NumCell>,
      },
      {
        id: "total",
        header: "Total",
        accessorFn: (i) => i.amount + i.tax,
        cell: ({ row }) => <NumCell>{inr(row.original.amount + row.original.tax, { decimals: false })}</NumCell>,
      },
      { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        id: "__a",
        header: "",
        enableHiding: false,
        cell: ({ row }) => {
          const i = row.original;
          return (
            <div className="flex justify-end gap-1">
              {i.status === "failed" && (
                <Button size="sm" variant="outline" onClick={() => mockAction(`Payment retried for ${i.id}`, { description: "The card issuer will respond within a minute; the owner is emailed either way.", tone: "info" })}>
                  <RotateCcw /> Retry
                </Button>
              )}
              {i.status === "overdue" && (
                <Button size="sm" variant="outline" onClick={() => mockAction(`Reminder sent for ${i.id}`, { description: `To ${t.ownerEmail}, copied to the billing contact.` })}>
                  <Send /> Remind
                </Button>
              )}
              <Button size="icon-sm" variant="ghost" aria-label={`Download ${i.id}`} onClick={() => mockAction(`${i.id}.pdf downloaded`, { description: "In the demo the file is not written to disk.", tone: "info" })}>
                <Download />
              </Button>
            </div>
          );
        },
      },
    ],
    [t.ownerEmail],
  );

  return (
    <div className="flex flex-col gap-4">
      <Section
        title="Subscription"
        actions={
          <Button size="sm" variant="outline" onClick={onChangePlan} disabled={t.status === "churned" || t.status === "scheduled_deletion"}>
            Change plan or seats
          </Button>
        }
      >
        <Facts
          cols={4}
          items={[
            { label: "Plan", value: <PlanBadge plan={t.plan} /> },
            { label: "Seats", value: `${num(t.seatsUsed)} used of ${num(t.seatLimit)}` },
            { label: "Price", value: plan.seatPrice ? `${inr(plan.seatPrice, { decimals: false })} / seat / month` : "Free" },
            { label: "Monthly value", value: <span className="tnum">{inr(monthly, { decimals: false })}</span> },
            { label: "Billing", value: t.plan === "enterprise" ? "Annual contract, invoiced monthly" : plan.seatPrice ? "Monthly, in advance" : "—" },
            { label: "Payment method", value: !plan.seatPrice ? "—" : t.plan === "enterprise" ? "NEFT / RTGS mandate" : "Card ending 4242" },
            { label: "Next invoice", value: t.mrr ? fmtDate("2026-10-01") : "—" },
            { label: "Outstanding", value: outstanding.length ? <span className="tnum text-destructive-fg">{inr(outstanding.reduce((a, i) => a + i.amount + i.tax, 0), { decimals: false })}</span> : "Nothing due" },
          ]}
        />
      </Section>
      <DataTable
        columns={columns}
        data={invoices}
        getRowId={(i) => i.id}
        enableColumnFilters={false}
        rowTone={(i) => (i.status === "failed" || i.status === "overdue" ? "danger" : undefined)}
        exportName={`${t.subdomain}-invoices`}
        canExport
        pageSize={6}
        emptyIcon={FileText}
        emptyTitle="No invoices"
        emptyDescription={t.status === "trial" ? "The tenant is on a trial — the first invoice is raised when it converts." : "Free and unprovisioned tenants are never invoiced."}
      />
    </div>
  );
}

const CATEGORY_LABEL: Record<ActivityCategory, string> = {
  billing: "Billing",
  access: "Access",
  config: "Configuration",
  lifecycle: "Lifecycle",
  support: "Support",
};

const ACTOR_ICON = { tenant: Building2, operator: ServerCog, system: Bot } as const;

export function TenantActivityTab({ tenant: t }: { tenant: ConsoleTenant }) {
  const { activityFor } = useConsole();
  const [category, setCategory] = React.useState("all");
  const all: TenantActivity[] = React.useMemo(() => [...activityFor(t.id), ...tenantActivity(t)], [activityFor, t]);
  const rows = all.filter((a) => category === "all" || a.category === category);

  return (
    <Section
      title="Activity"
      description="Tenant-level events the platform records — lifecycle, billing, access and every operator action. Employee-level audit stays inside the tenant."
      actions={
        <FilterSelect
          label="Type"
          value={category}
          onValueChange={setCategory}
          options={(Object.keys(CATEGORY_LABEL) as ActivityCategory[]).map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
        />
      }
      bodyClassName="p-0"
    >
      <ol className="divide-y divide-border">
        {rows.map((a) => {
          const Icon = ACTOR_ICON[a.actorKind];
          return (
            <li key={a.id} className="flex gap-3 px-4 py-2.5">
              <span
                className={cn(
                  "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
                  a.actorKind === "operator" ? "bg-warning-soft text-warning-fg" : a.actorKind === "system" ? "bg-muted text-muted-foreground" : "bg-primary-soft text-primary-soft-foreground",
                )}
                aria-hidden
              >
                <Icon className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground">{a.action}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{a.detail}</p>
                <p className="tnum mt-0.5 text-[10px] text-muted-foreground">
                  {fmtDateTime(a.at)} · {a.actor}
                  {a.actorKind === "operator" && " (platform operator)"} · {CATEGORY_LABEL[a.category]}
                </p>
              </div>
            </li>
          );
        })}
        {rows.length === 0 && <li className="px-4 py-8 text-center text-xs text-muted-foreground">No {CATEGORY_LABEL[category as ActivityCategory]?.toLowerCase()} events.</li>}
      </ol>
    </Section>
  );
}
