"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, CreditCard, Download, FileText, Gauge, Minus, Receipt, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, fmtMonth, inr, num } from "@/lib/format";
import {
  ADD_ONS,
  BILLING_CONTACT,
  INVOICES,
  PLAN_FEATURES,
  PLAN_TIERS,
  SUBSCRIPTION,
  type AddOn,
  type Invoice,
  type PlanTier,
} from "@/mock/platform";
import { mockAction } from "@/components/app-state";
import { DataTable, NumCell } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge, Switch } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/overlays";
import { Facts, Meter, TonePill } from "@/components/platform/kit";

export default function SubscriptionPage() {
  const loading = useFakeLoad();
  const [addOns, setAddOns] = React.useState<AddOn[]>(ADD_ONS);
  const [pendingToggle, setPendingToggle] = React.useState<AddOn | null>(null);
  const [planChange, setPlanChange] = React.useState<PlanTier | null>(null);

  const s = SUBSCRIPTION;
  const addOnMonthly = addOns.filter((a) => a.enabled).reduce((t, a) => t + a.monthlyPrice, 0);
  const seatMonthly = s.seatsPurchased * s.pricePerSeatMonthly;

  const toggle = (a: AddOn) => {
    setAddOns((prev) => prev.map((x) => (x.id === a.id ? { ...x, enabled: !x.enabled } : x)));
    mockAction(a.enabled ? `${a.name} cancelled` : `${a.name} added`, {
      description: a.enabled
        ? "It stays active until the end of the current billing month, then is removed from your next invoice."
        : `${inr(a.monthlyPrice)} per month, pro-rated on the October invoice.`,
      tone: a.enabled ? "warning" : "success",
    });
  };

  const columns = React.useMemo<ColumnDef<Invoice, unknown>[]>(
    () => [
      { accessorKey: "number", header: "Invoice", cell: ({ row }) => <span className="font-mono text-xs">{row.original.number}</span> },
      { accessorKey: "period", header: "Period", cell: ({ row }) => <span className="text-xs">{fmtMonth(`${row.original.period}-01`)}</span> },
      { accessorKey: "issuedAt", header: "Issued", cell: ({ row }) => <span className="tnum text-xs text-muted-foreground">{fmtDate(row.original.issuedAt)}</span> },
      { accessorKey: "taxable", header: "Taxable value", cell: ({ row }) => <NumCell>{inr(row.original.taxable)}</NumCell> },
      { accessorKey: "gst", header: "GST 18%", cell: ({ row }) => <NumCell>{inr(row.original.gst)}</NumCell> },
      { accessorKey: "total", header: "Total", cell: ({ row }) => <NumCell className="font-semibold">{inr(row.original.total)}</NumCell> },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) =>
          row.original.status === "due_soon" ? (
            <StatusBadge status="due_soon" label={`Due ${fmtDate(row.original.dueAt)}`} />
          ) : (
            <StatusBadge status={row.original.status} />
          ),
      },
      {
        id: "__dl",
        header: "",
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Download invoice ${row.original.number}`}
              onClick={() => mockAction(`Downloading ${row.original.number}.pdf`, { description: "Tax invoice with GSTIN, HSN 998314 and IRN QR code.", tone: "info" })}
            >
              <Download />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <PageBody>
      <PageHeader
        title="Plan & Seats"
        description="Your subscription, seat usage, add-ons and GST invoices. Only the tenant owner can change the plan or billing."
        actions={
          <Gated menuKey="admin.subscription" action="E">
            <Button size="sm" variant="outline" onClick={() => mockAction("Billing portal opened", { description: "Update card or switch to NACH auto-debit.", tone: "info" })}>
              <CreditCard /> Payment method
            </Button>
          </Gated>
        }
      />

      {loading ? (
        <>
          <CardsSkeleton />
          <TableSkeleton rows={5} />
        </>
      ) : (
        <>
          <StatRow>
            <StatTile label="Current plan" value={s.plan} icon={Gauge} hint={`${s.billingCycle} · renews ${fmtDate(s.renewsAt)}`} tone="accent" />
            <StatTile label="Seats used" value={`${s.seatsUsed} / ${s.seatsPurchased}`} icon={Users} hint={`${s.seatsPurchased - s.seatsUsed} seats free`} />
            <StatTile label="Monthly run-rate" value={inr(seatMonthly + addOnMonthly)} icon={Receipt} hint="Before 18% GST" />
            <StatTile label="API rate limit" value={`${num(s.rateLimitPerMin)}/min`} icon={FileText} hint="Per tenant, fixed 1-minute window" />
          </StatRow>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Section title="Enterprise plan" description={`Since ${fmtDate(s.startedAt)}`} className="lg:col-span-2">
              <div className="flex flex-col gap-4">
                <Meter label="Seats" used={s.seatsUsed} limit={s.seatsPurchased} />
                <Facts
                  cols={3}
                  items={[
                    { label: "Price per seat", value: `${inr(s.pricePerSeatMonthly)} / month` },
                    { label: "Data residency", value: s.dataResidency },
                    { label: "Support", value: s.supportTier },
                  ]}
                />
                <div className="flex flex-col gap-2 border-t border-border pt-3">
                  <p className="text-xs font-semibold">Add-ons</p>
                  {addOns.map((a) => (
                    <div key={a.id} className="flex flex-col gap-2 rounded-md border border-border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {a.name}{" "}
                            <span className="ml-1 text-xs font-normal text-muted-foreground">{inr(a.monthlyPrice)} / month</span>
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{a.description}</p>
                        </div>
                        <Gated menuKey="admin.subscription" action="E">
                          <Switch checked={a.enabled} onCheckedChange={() => setPendingToggle(a)} aria-label={`${a.enabled ? "Disable" : "Enable"} ${a.name}`} />
                        </Gated>
                      </div>
                      {a.enabled && a.quota && <Meter label={a.quota.label} used={a.quota.used} limit={a.quota.limit} />}
                    </div>
                  ))}
                </div>
              </div>
            </Section>

            <Section title="Billing contact" description="Invoices are emailed here on the 1st.">
              <Facts
                cols={2}
                className="sm:grid-cols-1"
                items={[
                  { label: "Contact", value: `${BILLING_CONTACT.name} · ${BILLING_CONTACT.title}` },
                  { label: "Email", value: BILLING_CONTACT.email },
                  { label: "Phone", value: BILLING_CONTACT.phone },
                  { label: "GSTIN", value: <span className="font-mono">{BILLING_CONTACT.gstin}</span> },
                  { label: "Billing address", value: BILLING_CONTACT.address },
                  { label: "Purchase order", value: BILLING_CONTACT.poNumber },
                ]}
              />
              <Gated menuKey="admin.subscription" action="E">
                <Button size="sm" variant="outline" className="mt-4 w-full" onClick={() => mockAction("Billing contact form opened", { tone: "info" })}>
                  Edit billing details
                </Button>
              </Gated>
            </Section>
          </div>

          <Section title="Compare plans" description="Rate limits are enforced per tenant in a fixed 1-minute window; excess requests receive 429 with Retry-After: 60.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3 text-left font-medium text-muted-foreground">Feature</th>
                    {PLAN_TIERS.map((p) => (
                      <th key={p.id} className={cn("px-3 py-2 text-left", p.id === "enterprise" && "bg-primary-soft/50")}>
                        <div className="flex items-center gap-1.5 text-sm font-semibold">
                          {p.name}
                          {p.id === "enterprise" && <Badge variant="soft">Current</Badge>}
                        </div>
                        <div className="font-normal text-muted-foreground">{p.price} · {p.seats}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PLAN_FEATURES.map((f) => (
                    <tr key={f} className="border-b border-border last:border-0">
                      <td className="py-2 pr-3 text-muted-foreground">{f}</td>
                      {PLAN_TIERS.map((p) => {
                        const val = p.features[f];
                        return (
                          <td key={p.id} className={cn("px-3 py-2", p.id === "enterprise" && "bg-primary-soft/50")}>
                            {val === true ? (
                              <Check className="size-4 text-success-fg" aria-label="Included" />
                            ) : val === false ? (
                              <Minus className="size-4 text-muted-foreground" aria-label="Not included" />
                            ) : (
                              <span className="tnum">{val}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr>
                    <td />
                    {PLAN_TIERS.map((p) => (
                      <td key={p.id} className={cn("px-3 py-3", p.id === "enterprise" && "bg-primary-soft/50")}>
                        {p.id === "enterprise" ? (
                          <TonePill tone="accent">Your plan</TonePill>
                        ) : (
                          <Gated menuKey="admin.subscription" action="E">
                            <Button size="sm" variant="outline" onClick={() => setPlanChange(p)}>
                              Switch to {p.name}
                            </Button>
                          </Gated>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Invoices" description="Tax invoices under GST (SAC 998314). CGST 9% + SGST 9% — billed within Karnataka.">
            <DataTable
              columns={columns}
              data={INVOICES}
              searchKeys={["number", "period"]}
              searchPlaceholder="Search invoices…"
              exportName="invoices"
              emptyTitle="No invoices yet"
              emptyDescription="Your first invoice is issued on the 1st of the month after activation."
              emptyIcon={Receipt}
              pageSize={10}
            />
          </Section>
        </>
      )}

      <ConfirmDialog
        open={!!pendingToggle}
        onOpenChange={(v) => !v && setPendingToggle(null)}
        title={pendingToggle?.enabled ? `Cancel ${pendingToggle.name}?` : `Add ${pendingToggle?.name ?? ""}?`}
        description={
          pendingToggle?.enabled
            ? "Features that depend on this add-on stop working at the end of the billing month. Existing data is kept."
            : `${pendingToggle ? inr(pendingToggle.monthlyPrice) : ""} per month, pro-rated from today.`
        }
        confirmLabel={pendingToggle?.enabled ? "Cancel add-on" : "Add to plan"}
        destructive={pendingToggle?.enabled}
        onConfirm={() => pendingToggle && toggle(pendingToggle)}
      />
      <ConfirmDialog
        open={!!planChange}
        onOpenChange={(v) => !v && setPlanChange(null)}
        title={`Downgrade to ${planChange?.name ?? ""}?`}
        description={
          planChange
            ? `${planChange.name} allows ${planChange.seats.toLowerCase()} seats and ${num(planChange.rateLimit)} API requests per minute. You use ${SUBSCRIPTION.seatsUsed} seats today, so this needs a sales-assisted migration. We'll raise a request with your account manager.`
            : undefined
        }
        confirmLabel="Request downgrade"
        destructive
        onConfirm={() =>
          mockAction("Downgrade request raised", {
            description: "Your account manager will contact Arjun Kapoor within one business day. Nothing changes until you confirm.",
            tone: "info",
          })
        }
      />
    </PageBody>
  );
}
