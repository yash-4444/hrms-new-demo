"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { BedDouble, Bus, Car, ClipboardList, FileCheck2, Paperclip, Plane, Ticket, Train } from "lucide-react";
import { cn, sum } from "@/lib/utils";
import { fmtDate, inr, num } from "@/lib/format";
import {
  TRAVEL_DESK_ITEMS,
  TRAVEL_DESK_LEG_ESTIMATE,
  type TravelDeskItem,
  type TravelDeskKind,
} from "@/mock/finance-travel";
import { mockAction } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/overlays";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { PersonCell } from "@/components/people/person-cell";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { FinStatus, MoneyCell, ReconcileCheck, downloadFile } from "@/components/finance/kit";
import { VoucherDialog, type VoucherValues } from "./voucher-dialog";

/* ============================================================================
   /travel/desk — the travel desk's booking queue.

   Approved requests arrive as one row per leg plus a hotel stay. The desk books
   what is pending, attaches the e-ticket or voucher, and the variance column
   compares the invoiced cost with the estimate the approver signed off.
   ========================================================================== */

const KIND_ICON: Record<TravelDeskKind, React.ElementType> = {
  Flight: Plane,
  Train: Train,
  Cab: Car,
  Bus: Bus,
  Hotel: BedDouble,
};

type StageTab = "all" | "booking_pending" | "booked" | "completed";

export default function TravelDeskPage() {
  const loading = useFakeLoad();
  const [items, setItems] = React.useState<TravelDeskItem[]>(TRAVEL_DESK_ITEMS);
  const [tab, setTab] = React.useState<StageTab>("all");
  const [kind, setKind] = React.useState("all");
  const [editing, setEditing] = React.useState<TravelDeskItem | null>(null);

  const visible = items.filter(
    (i) => (tab === "all" || i.stage === tab) && (kind === "all" || (kind === "Hotel" ? i.kind === "Hotel" : i.kind !== "Hotel")),
  );

  const pending = items.filter((i) => i.stage === "booking_pending");
  const missingVoucher = items.filter((i) => i.stage === "booked" && !i.voucher);
  const invoiced = items.filter((i) => i.actual !== null);
  const invoicedEstimate = sum(invoiced.map((i) => i.estimate));
  const invoicedActual = sum(invoiced.map((i) => i.actual ?? 0));
  const variancePct = invoicedEstimate ? ((invoicedActual - invoicedEstimate) / invoicedEstimate) * 100 : 0;
  const legEstimate = sum(items.filter((i) => i.kind !== "Hotel").map((i) => i.estimate));

  const save = (item: TravelDeskItem, v: VoucherValues) => {
    const before = items;
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? {
              ...i,
              vendor: v.vendor,
              bookingRef: v.bookingRef.toUpperCase(),
              actual: v.actual,
              voucher: v.fileName,
              stage: i.stage === "completed" ? "completed" : "booked",
            }
          : i,
      ),
    );
    mockAction(item.stage === "booking_pending" ? `Booked ${item.description}` : `Voucher attached to ${item.id}`, {
      description: `${v.vendor} · ${v.bookingRef.toUpperCase()} · ${inr(v.actual, { decimals: false })}. ${item.employeeName} has been emailed the itinerary.`,
      undo: () => setItems(before),
    });
  };

  const columns = React.useMemo<ColumnDef<TravelDeskItem, unknown>[]>(
    () => [
      {
        accessorKey: "description",
        header: "Booking",
        cell: ({ row }) => {
          const Icon = KIND_ICON[row.original.kind];
          return (
            <div className="flex min-w-0 items-start gap-2">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Icon className="size-3.5" aria-label={row.original.kind} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-foreground">{row.original.description}</p>
                <p className="truncate text-[11px] text-muted-foreground">{row.original.carrier}</p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "employeeName",
        header: "Traveller",
        cell: ({ row }) => (
          <PersonCell
            name={row.original.employeeName}
            subtitle={`${row.original.requestNo} · ${row.original.department}`}
            size={22}
          />
        ),
      },
      {
        accessorKey: "travelDate",
        header: "Travel date",
        cell: ({ row }) => {
          const d = row.original.daysToTravel;
          return (
            <div>
              <p className="tnum text-xs">{fmtDate(row.original.travelDate)}</p>
              <p className={cn("text-[11px]", d >= 0 && d <= 3 ? "text-warning-fg" : "text-muted-foreground")}>
                {d < 0 ? `${-d} days ago` : d === 0 ? "Today" : `In ${d} day${d === 1 ? "" : "s"}`}
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "vendor",
        header: "Vendor",
        cell: ({ row }) => <MutedCell>{row.original.vendor ?? "Not booked"}</MutedCell>,
      },
      {
        accessorKey: "bookingRef",
        header: "Booking ref",
        cell: ({ row }) => (
          <span className="font-mono text-[11px] text-muted-foreground">{row.original.bookingRef ?? "—"}</span>
        ),
      },
      {
        accessorKey: "estimate",
        header: "Estimate",
        cell: ({ row }) => <MoneyCell value={row.original.estimate} />,
      },
      {
        accessorKey: "actual",
        header: "Actual",
        cell: ({ row }) =>
          row.original.actual === null ? <NumCell className="text-muted-foreground">—</NumCell> : <MoneyCell value={row.original.actual} />,
      },
      {
        id: "variance",
        header: "Variance",
        accessorFn: (r) => (r.actual === null ? 0 : r.actual - r.estimate),
        cell: ({ row }) => {
          const r = row.original;
          if (r.actual === null) return <NumCell className="text-muted-foreground">—</NumCell>;
          const v = r.actual - r.estimate;
          return (
            <NumCell className={cn(v > r.estimate * 0.1 ? "text-destructive-fg" : v > 0 ? "text-warning-fg" : "text-success-fg")}>
              {v > 0 ? "+" : ""}
              {inr(v, { decimals: false })}
              <span className="block text-[10px] opacity-80">
                {v > 0 ? "+" : ""}
                {((v / r.estimate) * 100).toFixed(1)}%
              </span>
            </NumCell>
          );
        },
      },
      {
        accessorKey: "voucher",
        header: "Voucher",
        cell: ({ row }) =>
          row.original.voucher ? (
            <button
              type="button"
              className="inline-flex max-w-[160px] items-center gap-1 truncate rounded text-[11px] text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={(e) => {
                e.stopPropagation();
                downloadFile(row.original.voucher!, `${row.original.requestNo} · ${row.original.description}`);
              }}
            >
              <Paperclip className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{row.original.voucher}</span>
            </button>
          ) : (
            <span className="text-[11px] text-warning-fg">Not attached</span>
          ),
      },
      {
        accessorKey: "stage",
        header: "Stage",
        cell: ({ row }) => <FinStatus status={row.original.stage} />,
      },
      {
        id: "__actions",
        header: "",
        enableHiding: false,
        cell: ({ row }) => {
          const r = row.original;
          if (r.stage === "completed") return null;
          const pendingBooking = r.stage === "booking_pending";
          return (
            <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
              <Gated menuKey="workplace.travel_desk" action={pendingBooking ? "C" : "E"}>
                <Button size="sm" variant={pendingBooking || !r.voucher ? "default" : "outline"} onClick={() => setEditing(r)}>
                  {pendingBooking ? <Ticket /> : <Paperclip />}
                  {pendingBooking ? "Book" : r.voucher ? "Edit" : "Attach"}
                </Button>
              </Gated>
            </div>
          );
        },
      },
    ],
    [],
  );

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Travel desk" description="Loading the booking queue…" />
        <CardsSkeleton count={4} />
        <TableSkeleton />
      </PageBody>
    );
  }

  const counts = {
    all: items.length,
    booking_pending: pending.length,
    booked: items.filter((i) => i.stage === "booked").length,
    completed: items.filter((i) => i.stage === "completed").length,
  };

  return (
    <PageBody>
      <PageHeader
        title="Travel desk"
        description="Approved travel requests land here as one row per leg plus a hotel stay. Book what is pending, attach the e-ticket or hotel voucher, and watch the invoiced cost against the estimate the approver signed off."
      />

      <StatRow cols={4}>
        <StatTile label="Booking pending" value={num(pending.length)} icon={ClipboardList} tone={pending.length ? "warning" : "good"} hint="Hotel stays not yet confirmed" onClick={() => setTab("booking_pending")} />
        <StatTile label="Vouchers missing" value={num(missingVoucher.length)} icon={Paperclip} tone={missingVoucher.length ? "warning" : "good"} hint="Booked, e-ticket not yet on file" onClick={() => setTab("booked")} />
        <StatTile label="Invoiced so far" value={inr(invoicedActual, { decimals: false })} icon={FileCheck2} hint={`Against an estimate of ${inr(invoicedEstimate, { decimals: false })}`} />
        <StatTile
          label="Cost vs estimate"
          value={`${variancePct > 0 ? "+" : ""}${variancePct.toFixed(1)}%`}
          icon={Plane}
          tone={variancePct > 5 ? "critical" : variancePct > 0 ? "warning" : "good"}
          hint={`${inr(invoicedActual - invoicedEstimate, { decimals: false })} across ${num(invoiced.length)} bookings`}
        />
      </StatRow>

      <ReconcileCheck
        label="Desk ties to approved requests"
        left={legEstimate}
        right={TRAVEL_DESK_LEG_ESTIMATE}
        leftLabel="Σ transport estimates on the desk"
        rightLabel="Σ leg estimates on approved and completed requests"
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as StageTab)}>
        <TabsList aria-label="Booking stage">
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="booking_pending">Booking pending ({counts.booking_pending})</TabsTrigger>
          <TabsTrigger value="booked">Booked ({counts.booked})</TabsTrigger>
          <TabsTrigger value="completed">Travelled ({counts.completed})</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable<TravelDeskItem>
        columns={columns}
        data={visible}
        getRowId={(r) => r.id}
        searchKeys={["requestNo", "employeeName", "description", "bookingRef", "vendor"]}
        searchPlaceholder="Search request, traveller, route or PNR…"
        exportName={`travel-desk-${tab}${kind === "all" ? "" : `-${kind.toLowerCase()}`}`}
        rowTone={(r) => (r.stage === "booking_pending" && r.daysToTravel <= 7 ? "warning" : undefined)}
        emptyIcon={ClipboardList}
        emptyTitle={tab === "booking_pending" ? "Nothing waiting to be booked" : "No bookings match these filters"}
        emptyDescription="Approved travel requests appear here as soon as the approver signs off."
        emptyAction={
          <Button variant="outline" size="sm" onClick={() => { setTab("all"); setKind("all"); }}>
            Show every booking
          </Button>
        }
        filters={
          <FilterSelect
            label="Type"
            value={kind}
            onValueChange={setKind}
            allLabel="All types"
            width="w-[150px]"
            options={[
              { value: "transport", label: "Tickets" },
              { value: "Hotel", label: "Hotels" },
            ]}
          />
        }
      />

      <VoucherDialog item={editing} onOpenChange={(v) => !v && setEditing(null)} onSave={save} />
    </PageBody>
  );
}
