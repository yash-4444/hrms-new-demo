"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Check, Clock, CreditCard, Download, FileMinus, FileText, IndianRupee, MoreHorizontal, Octagon, Percent, Receipt, RotateCcw, Undo2, Wallet } from "lucide-react";
import { fmtDate, inr, inrCompact, num } from "@/lib/format";
import { COUNTRY_META, type TenantCountry } from "@/mock/console-tenants";
import { consoleKpis } from "@/mock/console-overview";
import { DUNNING_CASES, MRR_MOVEMENT, NET_REVENUE_RETENTION, PLATFORM_INVOICES, invoiceTotal, type BillingStatus, type DunningCase, type PlatformInvoice } from "@/mock/console-billing";
import { mockAction } from "@/components/app-state";
import { useConsole } from "@/components/console/console-state";
import { MrrMovementChart } from "@/components/console/billing-mrr-chart";
import { DunningPanel } from "@/components/console/billing-dunning";
import { CreditNoteDialog, MarkPaidDialog } from "@/components/console/billing-dialogs";
import { DataTable, NumCell } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, ChartSkeleton, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { ReasonDialog, TonePill, type PTone } from "@/components/platform/kit";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, FilterSelect } from "@/components/ui/overlays";

const STATUS: Record<BillingStatus, { label: string; tone: PTone; icon: React.ElementType }> = {
  paid: { label: "Paid", tone: "success", icon: Check },
  due: { label: "Due", tone: "info", icon: Clock },
  overdue: { label: "Overdue", tone: "warning", icon: AlertTriangle },
  failed: { label: "Failed", tone: "danger", icon: Octagon },
  refunded: { label: "Refunded", tone: "neutral", icon: Undo2 },
};

const OPEN: BillingStatus[] = ["due", "overdue", "failed"];
const PERIODS = [...new Set(PLATFORM_INVOICES.map((i) => i.period.replace(" (top-up)", "")))];

type InvoiceAction = { kind: "retry" | "paid" | "credit"; invoice: PlatformInvoice } | null;
type DunningAction = { kind: "pause" | "suspend"; c: DunningCase } | null;

export default function BillingPage() {
  const loading = useFakeLoad();
  const { tenants, updateTenant, logActivity } = useConsole();
  const [patches, setPatches] = React.useState<Record<string, Partial<PlatformInvoice>>>({});
  const [status, setStatus] = React.useState("all");
  const [period, setPeriod] = React.useState("all");
  const [country, setCountry] = React.useState("all");
  const [action, setAction] = React.useState<InvoiceAction>(null);
  const [dunning, setDunning] = React.useState<DunningAction>(null);
  const [paused, setPaused] = React.useState<Set<string>>(new Set());

  const invoices = React.useMemo(() => PLATFORM_INVOICES.map((i) => ({ ...i, ...patches[i.id] })), [patches]);
  const data = invoices.filter(
    (i) => (status === "all" || i.status === status) && (period === "all" || i.period.startsWith(period)) && (country === "all" || i.country === country),
  );
  const k = consoleKpis(tenants);
  const outstanding = invoices.filter((i) => OPEN.includes(i.status));
  const failed = invoices.filter((i) => i.status === "failed");
  const cases = DUNNING_CASES.filter((c) => OPEN.includes(invoices.find((i) => i.id === c.invoiceId)?.status ?? "paid"));

  const patch = (id: string, p: Partial<PlatformInvoice>) => setPatches((s) => ({ ...s, [id]: { ...s[id], ...p } }));

  const columns = React.useMemo<ColumnDef<PlatformInvoice, unknown>[]>(
    () => [
      { accessorKey: "id", header: "Invoice", cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span> },
      {
        accessorKey: "tenantName",
        header: "Tenant",
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link href={`/console/tenants/${row.original.tenantId}`} className="block truncate text-xs font-medium text-foreground hover:underline">
              {row.original.tenantName}
            </Link>
            <span className="text-[11px] text-muted-foreground">{COUNTRY_META[row.original.country].label}</span>
          </div>
        ),
      },
      { accessorKey: "period", header: "Period", cell: ({ row }) => <span className="text-xs">{row.original.period}</span> },
      {
        id: "total",
        header: "Amount",
        accessorFn: (i) => invoiceTotal(i),
        cell: ({ row }) => (
          <div className="text-right">
            <NumCell>{inr(invoiceTotal(row.original), { decimals: false })}</NumCell>
            <p className="tnum text-[11px] text-muted-foreground">{row.original.tax ? `incl. GST ${inr(row.original.tax, { decimals: false })}` : "Zero-rated export"}</p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const s = STATUS[row.original.status];
          return (
            <div className="flex flex-col gap-0.5">
              <TonePill tone={s.tone} icon={s.icon}>
                {s.label}
              </TonePill>
              {row.original.note && <span className="max-w-[220px] truncate text-[11px] text-muted-foreground">{row.original.note}</span>}
            </div>
          );
        },
      },
      { accessorKey: "dueOn", header: "Due", cell: ({ row }) => <span className="tnum text-xs">{fmtDate(row.original.dueOn)}</span> },
      { accessorKey: "method", header: "Method", cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.method}</span> },
      {
        id: "__a",
        header: "",
        enableHiding: false,
        cell: ({ row }) => {
          const i = row.original;
          const open = OPEN.includes(i.status);
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${i.id}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{i.id}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => mockAction(`${i.id}.pdf downloaded`, { description: "In the demo the file is not written to disk.", tone: "info" })}>
                    <Download /> Download PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={i.status !== "failed" || i.method !== "Card"} onSelect={() => setAction({ kind: "retry", invoice: i })}>
                    <RotateCcw /> Retry charge
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={!open} onSelect={() => setAction({ kind: "paid", invoice: i })}>
                    <Wallet /> Mark paid offline
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive disabled={i.status === "refunded"} onSelect={() => setAction({ kind: "credit", invoice: i })}>
                    <FileMinus /> Issue credit note
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [],
  );

  const inv = action?.invoice;
  const dc = dunning?.c;
  const dcTenant = dc ? tenants.find((t) => t.id === dc.tenantId) : undefined;
  return (
    <PageBody>
      <PageHeader
        title="Billing"
        description="Platform revenue and collections across every tenant. Amounts in INR; Indian tenants are charged 18% GST, exports of service are zero-rated."
      />

      {loading ? (
        <>
          <CardsSkeleton count={5} />
          <ChartSkeleton height={260} />
          <TableSkeleton />
        </>
      ) : (
        <>
          <StatRow cols={5}>
            <StatTile label="MRR" value={inrCompact(k.mrr)} icon={IndianRupee} hint="Active tenants, contracted" spark={MRR_MOVEMENT.map((m) => ({ value: m.mrr }))} />
            <StatTile label="ARR" value={inrCompact(k.arr)} icon={Receipt} hint="MRR × 12" />
            <StatTile label="Net revenue retention" value={`${NET_REVENUE_RETENTION.toFixed(1)}%`} icon={Percent} tone={NET_REVENUE_RETENTION >= 100 ? "good" : "warning"} hint="Trailing 12 months" />
            <StatTile
              label="Outstanding"
              value={inrCompact(outstanding.reduce((a, i) => a + invoiceTotal(i), 0))}
              icon={Wallet}
              tone={outstanding.length ? "warning" : "neutral"}
              hint={`${num(outstanding.length)} invoices due, overdue or failed`}
              onClick={() => setStatus("overdue")}
            />
            <StatTile label="Failed payments" value={num(failed.length)} icon={CreditCard} tone={failed.length ? "critical" : "neutral"} hint={`${cases.length} tenants in dunning`} onClick={() => setStatus("failed")} />
          </StatRow>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <MrrMovementChart data={MRR_MOVEMENT} />
            <DunningPanel
              cases={cases}
              tenants={tenants}
              invoices={invoices}
              paused={paused}
              onRetry={(c) => {
                const i = invoices.find((x) => x.id === c.invoiceId);
                if (i && c.kind === "card") setAction({ kind: "retry", invoice: i });
                else mockAction(`Reminder sent for ${c.invoiceId}`, { description: "To the owner, copied to the billing contact.", tone: "info" });
              }}
              onPause={(c) => setDunning({ kind: "pause", c })}
              onSuspend={(c) => setDunning({ kind: "suspend", c })}
            />
          </div>

          <DataTable
            columns={columns}
            data={data}
            searchKeys={["id", "tenantName", "tenantId"]}
            searchPlaceholder="Search invoice or tenant…"
            filters={
              <>
                <FilterSelect label="Status" value={status} onValueChange={setStatus} options={(Object.keys(STATUS) as BillingStatus[]).map((s) => ({ value: s, label: STATUS[s].label }))} />
                <FilterSelect label="Period" value={period} onValueChange={setPeriod} options={PERIODS.map((p) => ({ value: p, label: p }))} />
                <FilterSelect label="Country" value={country} onValueChange={setCountry} width="w-[170px]" options={(Object.keys(COUNTRY_META) as TenantCountry[]).map((c) => ({ value: c, label: COUNTRY_META[c].label }))} />
              </>
            }
            getRowId={(i) => i.id}
            rowTone={(i) => (i.status === "failed" || i.status === "overdue" ? "danger" : undefined)}
            exportName="platform-invoices"
            canExport
            emptyIcon={FileText}
            emptyTitle="No invoices match"
            emptyDescription="Clear the filters or search to see every invoice."
          />
        </>
      )}

      <ConfirmDialog
        open={action?.kind === "retry"}
        onOpenChange={(v) => !v && setAction(null)}
        title={`Retry the charge for ${inv?.id ?? ""}?`}
        description={inv ? `${inr(invoiceTotal(inv), { decimals: false })} on ${inv.tenantName}'s card on file. The owner is emailed the result either way.` : undefined}
        confirmLabel="Retry now"
        onConfirm={() => {
          if (!inv) return;
          if (tenants.find((t) => t.id === inv.tenantId)?.status === "suspended") {
            mockAction(`Charge declined again for ${inv.id}`, { description: "The card is blocked. Ask the owner for a new payment method.", tone: "error" });
            return;
          }
          patch(inv.id, { status: "paid", note: "Paid on manual retry." });
          logActivity(inv.tenantId, { category: "billing", action: "Payment retried — succeeded", detail: `${inv.id} · ${inr(invoiceTotal(inv), { decimals: false })}` });
          mockAction(`${inv.id} paid`, { description: `${inv.tenantName} — dunning stopped.` });
        }}
      />
      {action?.kind === "paid" && inv && (
        <MarkPaidDialog
          invoice={inv}
          onOpenChange={(v) => !v && setAction(null)}
          onConfirm={(ref, on) => {
            patch(inv.id, { status: "paid", note: `Paid offline on ${fmtDate(on)} · ref ${ref}` });
            logActivity(inv.tenantId, { category: "billing", action: "Invoice marked paid offline", detail: `${inv.id} · ref ${ref}` });
            mockAction(`${inv.id} marked paid`, { description: `Receipt emailed to ${inv.tenantName}'s owner. A suspended tenant is reactivated from its own page.` });
            setAction(null);
          }}
        />
      )}
      {action?.kind === "credit" && inv && (
        <CreditNoteDialog
          invoice={inv}
          onOpenChange={(v) => !v && setAction(null)}
          onConfirm={(amount, reason) => {
            const cn = `CN-${inv.id.slice(4)}`;
            const full = amount === invoiceTotal(inv);
            patch(inv.id, full ? { status: "refunded", note: `${cn}: ${reason}` } : { note: `${cn} for ${inr(amount, { decimals: false })}: ${reason}` });
            logActivity(inv.tenantId, { category: "billing", action: "Credit note issued", detail: `${cn} against ${inv.id} · ${inr(amount, { decimals: false })} — ${reason}` });
            mockAction(`Credit note ${cn} issued`, { description: `${inr(amount, { decimals: false })} to ${inv.tenantName}${full ? " — invoice refunded." : ", set against the next invoice."}` });
            setAction(null);
          }}
        />
      )}
      <ReasonDialog
        open={dunning?.kind === "pause"}
        onOpenChange={(v) => !v && setDunning(null)}
        title={`Pause dunning for ${dcTenant?.name ?? ""}?`}
        description="No further retries, reminders or automatic suspension until it is resumed. Use for a promised payment or an open dispute."
        confirmLabel="Pause dunning"
        destructive={false}
        onConfirm={(reason) => {
          if (!dc) return;
          setPaused((s) => new Set(s).add(dc.tenantId));
          logActivity(dc.tenantId, { category: "billing", action: "Dunning paused", detail: reason });
          mockAction(`Dunning paused for ${dcTenant?.name ?? dc.tenantId}`, { tone: "info" });
        }}
      />
      <ReasonDialog
        open={dunning?.kind === "suspend"}
        onOpenChange={(v) => !v && setDunning(null)}
        title={`Suspend ${dcTenant?.name ?? ""} now?`}
        description="Every user is signed out and jobs pause. Data is retained; paying the invoice and reactivating restores access."
        confirmLabel="Suspend tenant"
        commentLabel="Reason (shown to the tenant owner)"
        onConfirm={(reason) => {
          if (!dc) return;
          updateTenant(dc.tenantId, { status: "suspended", statusNote: reason });
          logActivity(dc.tenantId, { category: "lifecycle", action: "Tenant suspended for non-payment", detail: reason });
          mockAction(`${dcTenant?.name ?? dc.tenantId} suspended`, { description: reason, tone: "warning" });
        }}
      />
    </PageBody>
  );
}
