"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight, Bus, Car, Check, CheckCheck, Eye, Plane, Plus, Train, Wallet, X } from "lucide-react";
import { sum } from "@/lib/utils";
import { fmtDate, fmtDateShort, inr, inrCompact, num } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import { TRAVEL_REQUESTS, type TravelMode, type TravelRequest } from "@/mock/workplace";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Hint, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { ConfirmDialog, FilterSelect, Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { ShareBar } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { PersonCell } from "@/components/people/person-cell";
import { CardsSkeleton, Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { TravelItineraryCard } from "@/components/workplace/travel-itinerary-card";
import { TravelRequestDialog } from "@/components/workplace/travel-request-dialog";

/* ============================================================================
   /travel — persona-aware. Everyone lands on their own trips (my.travel); a
   persona holding workplace.travel also gets the approval queue and the
   tenant-wide register with the advance balance, admin controls gated on it.
   ========================================================================== */

const MODE_ICON: Record<TravelMode, React.ElementType> = { Flight: Plane, Train: Train, Cab: Car, Bus: Bus };
const NOW_STAMP = `${DEMO_TODAY}T14:35:00`;

type Batch = { rows: TravelRequest[]; clear?: () => void };

function travelColumns(showEmployee: boolean, actions: (r: TravelRequest) => React.ReactNode) {
  const cols: ColumnDef<TravelRequest, unknown>[] = [
    {
      accessorKey: "requestNo",
      header: "Request",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="tnum font-medium">{row.original.requestNo}</p>
          <p className="max-w-[260px] truncate text-[11px] text-muted-foreground">{row.original.purpose}</p>
        </div>
      ),
    },
  ];
  if (showEmployee) {
    cols.push({
      accessorKey: "employeeName",
      header: "Traveller",
      cell: ({ row }) => (
        <PersonCell name={row.original.employeeName} subtitle={`${row.original.employeeCode} · ${row.original.department}`} />
      ),
    });
  }
  cols.push(
    {
      id: "route",
      accessorFn: (r) => `${r.legs[0]?.from ?? ""} → ${r.legs[0]?.to ?? ""}`,
      header: "Route",
      cell: ({ row }) => {
        const leg = row.original.legs[0];
        const Icon = leg ? MODE_ICON[leg.mode] : Plane;
        return (
          <span className="flex items-center gap-1.5 whitespace-nowrap text-xs">
            <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            {leg?.from}
            <ArrowRight className="size-3 text-muted-foreground" aria-hidden />
            {leg?.to}
            {row.original.legs.length > 1 && (
              <span className="text-muted-foreground">+{row.original.legs.length - 1}</span>
            )}
          </span>
        );
      },
    },
    { accessorKey: "tripType", header: "Trip", cell: ({ row }) => <MutedCell>{row.original.tripType}</MutedCell> },
    {
      accessorKey: "startDate",
      header: "Dates",
      cell: ({ row }) => (
        <span className="tnum whitespace-nowrap text-xs">
          {fmtDateShort(row.original.startDate)} – {fmtDate(row.original.endDate)}
          <span className="block text-[11px] text-muted-foreground">
            {row.original.nights} night{row.original.nights === 1 ? "" : "s"}
          </span>
        </span>
      ),
    },
    {
      accessorKey: "estimatedCost",
      header: "Estimate",
      cell: ({ row }) => <NumCell>{inr(row.original.estimatedCost, { decimals: false })}</NumCell>,
    },
    {
      accessorKey: "advanceOutstanding",
      header: "Advance out",
      cell: ({ row }) =>
        row.original.advanceOutstanding > 0 ? (
          <NumCell className="text-warning-fg">{inr(row.original.advanceOutstanding, { decimals: false })}</NumCell>
        ) : (
          <NumCell className="text-muted-foreground">—</NumCell>
        ),
    },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {actions(row.original)}
        </div>
      ),
    },
  );
  return cols;
}

export default function TravelPage() {
  const loading = useFakeLoad();
  const { persona, can, markDecided } = useApp();
  const isAdmin = can("workplace.travel", "V");

  const [requests, setRequests] = React.useState<TravelRequest[]>(TRAVEL_REQUESTS);
  const [tab, setTab] = React.useState(isAdmin ? "queue" : "mine");
  const [status, setStatus] = React.useState("all");
  const [tripType, setTripType] = React.useState("all");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [approving, setApproving] = React.useState<Batch | null>(null);
  const [rejecting, setRejecting] = React.useState<Batch | null>(null);
  const [cancelling, setCancelling] = React.useState<TravelRequest | null>(null);

  const activeTab = isAdmin || tab === "mine" ? tab : "mine";
  const me = persona.employeeId;
  const open = requests.find((r) => r.id === openId) ?? null;

  const mine = React.useMemo(() => requests.filter((r) => r.employeeCode === me), [requests, me]);
  const queue = React.useMemo(
    () => requests.filter((r) => r.status === "submitted" && r.employeeCode !== me),
    [requests, me],
  );
  const filterRows = (list: TravelRequest[]) =>
    list.filter((r) => (status === "all" || r.status === status) && (tripType === "all" || r.tripType === tripType));

  /* Advance balance recomputes from the live list, not the frozen fixture. */
  const advance = React.useMemo(
    () => ({
      requested: sum(requests.map((r) => r.advanceRequested)),
      disbursed: sum(requests.map((r) => r.advanceDisbursed)),
      settled: sum(requests.map((r) => r.advanceSettled)),
      outstanding: sum(requests.map((r) => r.advanceOutstanding)),
    }),
    [requests],
  );

  /* ----------------------------------------------------------- mutations */

  const decide = (batch: Batch, approve: boolean, comment: string) => {
    const ids = new Set(batch.rows.map((r) => r.id));
    const before = requests;
    setRequests((rs) =>
      rs.map((r) =>
        ids.has(r.id)
          ? {
              ...r,
              status: approve ? "approved" : "rejected",
              decidedOn: NOW_STAMP,
              decisionNote: approve ? null : `Rejected — ${comment}`,
              approverName: persona.name,
              advanceDisbursed: approve ? r.advanceRequested : 0,
              advanceOutstanding: approve ? r.advanceRequested : 0,
              legs: approve ? r.legs : r.legs.map((l) => ({ ...l, bookingStatus: "cancelled" as const })),
            }
          : r,
      ),
    );
    const fromInbox = batch.rows.filter((r) => r.approverCode === me).map((r) => `travel:${r.id}`);
    markDecided(fromInbox);
    batch.clear?.();
    setOpenId(null);
    const one = batch.rows.length === 1 ? batch.rows[0] : null;
    mockAction(
      approve
        ? one ? `Approved ${one.requestNo}` : `Approved ${batch.rows.length} trips`
        : one ? `Rejected ${one.requestNo}` : `Rejected ${batch.rows.length} trips`,
      {
        description: approve
          ? "The travel desk starts booking; any advance is disbursed with the next payout."
          : `Reason sent to ${one ? one.employeeName : "each traveller"}: “${comment}”`,
        tone: approve ? "success" : "warning",
        undo: () => {
          setRequests(before);
          markDecided(fromInbox, false);
        },
      },
    );
  };

  const cancel = (r: TravelRequest, reason: string) => {
    const before = requests;
    setRequests((rs) =>
      rs.map((x) =>
        x.id === r.id
          ? {
              ...x,
              status: "cancelled",
              decisionNote: reason ? `Cancelled by the traveller — ${reason}` : "Cancelled by the traveller.",
              legs: x.legs.map((l) => ({ ...l, bookingStatus: "cancelled" as const })),
            }
          : x,
      ),
    );
    setOpenId(null);
    mockAction(`${r.requestNo} cancelled`, {
      description:
        r.advanceDisbursed > 0
          ? `${inr(r.advanceDisbursed, { decimals: false })} advance is due back to finance.`
          : "The travel desk has been told to release any holds.",
      undo: () => setRequests(before),
    });
  };

  const settle = (r: TravelRequest) => {
    const before = requests;
    setRequests((rs) =>
      rs.map((x) => (x.id === r.id ? { ...x, advanceSettled: x.advanceDisbursed, advanceOutstanding: 0 } : x)),
    );
    mockAction(`Advance settled — ${r.requestNo}`, {
      description: `${inr(r.advanceOutstanding, { decimals: false })} reconciled against submitted bills.`,
      undo: () => setRequests(before),
    });
  };

  /* -------------------------------------------------------------- columns */

  const myColumns = React.useMemo(
    () => travelColumns(false, (r) => <ViewButton request={r} onView={() => setOpenId(r.id)} />),
    [],
  );
  const registerColumns = React.useMemo(
    () => travelColumns(true, (r) => <ViewButton request={r} onView={() => setOpenId(r.id)} />),
    [],
  );
  const queueColumns = React.useMemo(
    () =>
      travelColumns(true, (r) => (
        <>
          <ViewButton request={r} onView={() => setOpenId(r.id)} />
          <Gated menuKey="workplace.travel" action="A">
            <Button size="icon-sm" variant="ghost" aria-label={`Reject ${r.requestNo}`} onClick={() => setRejecting({ rows: [r] })}>
              <X />
            </Button>
          </Gated>
          <Gated menuKey="workplace.travel" action="A">
            <Button size="icon-sm" variant="soft" aria-label={`Approve ${r.requestNo}`} onClick={() => setApproving({ rows: [r] })}>
              <Check />
            </Button>
          </Gated>
        </>
      )),
    [],
  );

  const stats = React.useMemo(() => {
    const upcoming = mine.filter((r) => r.status === "approved" && r.startDate >= DEMO_TODAY);
    return {
      upcoming,
      myPending: mine.filter((r) => r.status === "submitted").length,
      myAdvance: sum(mine.map((r) => r.advanceOutstanding)),
      myTrips: mine.filter((r) => r.status === "completed").length,
      tenantUpcoming: requests.filter((r) => r.status === "approved" && r.startDate >= DEMO_TODAY).length,
      spend: sum(requests.filter((r) => r.status !== "rejected" && r.status !== "cancelled").map((r) => r.estimatedCost)),
    };
  }, [mine, requests]);

  /* ---------------------------------------------------------------- render */

  const header = (
    <PageHeader
      title={isAdmin ? "Travel" : "My travel"}
      description={
        isAdmin
          ? "Approve trip requests, see every itinerary in flight, and track the advance money tied up against them."
          : "Raise a trip, follow its approval and bookings leg by leg, and see the advance you still need to settle."
      }
      actions={
        <Gated menuKey="my.travel" action="C">
          <Button size="sm" onClick={() => setComposeOpen(true)}>
            <Plus /> New travel request
          </Button>
        </Gated>
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

  const filters = (
    <>
      <FilterSelect
        label="Status"
        value={status}
        onValueChange={setStatus}
        allLabel="All statuses"
        width="w-[170px]"
        options={[
          { value: "draft", label: "Draft" },
          { value: "submitted", label: "Submitted" },
          { value: "approved", label: "Approved" },
          { value: "rejected", label: "Rejected" },
          { value: "completed", label: "Completed" },
          { value: "cancelled", label: "Cancelled" },
        ]}
      />
      <FilterSelect
        label="Trip"
        value={tripType}
        onValueChange={setTripType}
        allLabel="All trips"
        width="w-[160px]"
        options={[
          { value: "Domestic", label: "Domestic" },
          { value: "International", label: "International" },
        ]}
      />
    </>
  );

  const canSettle = (r: TravelRequest) =>
    can("workplace.travel_advances", "E") && r.advanceOutstanding > 0 && r.endDate <= DEMO_TODAY;
  const canCancel = (r: TravelRequest) =>
    r.employeeCode === me && can("my.travel", "E") && ["draft", "submitted", "approved"].includes(r.status) && r.startDate > DEMO_TODAY;

  const myTable = (
    <DataTable<TravelRequest>
      columns={myColumns}
      data={filterRows(mine)}
      getRowId={(r) => r.id}
      searchKeys={["requestNo", "purpose", "search"]}
      searchPlaceholder="Search request, purpose or city…"
      exportName="my-travel-requests"
      onRowClick={(r) => setOpenId(r.id)}
      filters={filters}
      emptyIcon={Plane}
      emptyTitle={mine.length ? "No trip matches these filters" : "You have no travel requests yet"}
      emptyDescription={
        mine.length
          ? "Clear the status or trip filter to see the rest."
          : "Raise a request before you book — your manager approves it and the travel desk books every leg."
      }
    />
  );

  return (
    <PageBody>
      {header}

      {isAdmin ? (
        <StatRow cols={4}>
          <StatTile
            label="Awaiting approval"
            value={num(queue.length)}
            icon={CheckCheck}
            tone={queue.length ? "warning" : "good"}
            onClick={() => setTab("queue")}
          />
          <StatTile label="Upcoming trips" value={num(stats.tenantUpcoming)} icon={Plane} hint="Approved, not yet started" />
          <StatTile label="Estimated spend" value={inrCompact(stats.spend)} icon={Wallet} hint="Approved and pending trips" />
          <StatTile
            label="Advance outstanding"
            value={inrCompact(advance.outstanding)}
            icon={Wallet}
            tone={advance.outstanding > 0 ? "warning" : "good"}
            hint="Disbursed, not yet settled"
            onClick={() => setTab("all")}
          />
        </StatRow>
      ) : (
        <StatRow cols={4}>
          <StatTile
            label="Upcoming trips"
            value={num(stats.upcoming.length)}
            icon={Plane}
            hint={stats.upcoming[0] ? `Next: ${stats.upcoming[0].legs[0]?.to} on ${fmtDate(stats.upcoming[0].startDate)}` : "Nothing booked"}
            onClick={() => setStatus("approved")}
          />
          <StatTile
            label="Awaiting approval"
            value={num(stats.myPending)}
            icon={CheckCheck}
            tone={stats.myPending ? "warning" : "neutral"}
            onClick={() => setStatus("submitted")}
          />
          <StatTile
            label="Advance in hand"
            value={inr(stats.myAdvance, { decimals: false })}
            icon={Wallet}
            tone={stats.myAdvance > 0 ? "warning" : "good"}
            hint="Settle against bills within 10 days of returning"
          />
          <StatTile label="Trips completed" value={num(stats.myTrips)} icon={Check} onClick={() => setStatus("completed")} />
        </StatRow>
      )}

      {isAdmin ? (
        <Tabs value={activeTab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="queue">
              <CheckCheck /> Approval queue ({queue.length})
            </TabsTrigger>
            <TabsTrigger value="all">
              <Plane /> All requests ({requests.length})
            </TabsTrigger>
            <TabsTrigger value="mine">
              <Wallet /> My trips ({mine.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="flex flex-col gap-3">
            <DataTable<TravelRequest>
              columns={queueColumns}
              data={filterRows(queue)}
              getRowId={(r) => r.id}
              searchKeys={["requestNo", "employeeName", "purpose", "search"]}
              searchPlaceholder="Search request, traveller or city…"
              exportName="travel-approval-queue"
              canExport={can("workplace.travel", "X")}
              enableSelection={can("workplace.travel", "A")}
              onRowClick={(r) => setOpenId(r.id)}
              filters={filters}
              emptyIcon={CheckCheck}
              emptyTitle={queue.length ? "No request matches these filters" : "Nothing to approve"}
              emptyDescription={queue.length ? "Clear a filter to see the rest of the queue." : "Every trip request has been decided."}
              bulkActions={(rows, clear) => (
                <>
                  <Gated menuKey="workplace.travel" action="A">
                    <Button size="sm" variant="outline" onClick={() => setRejecting({ rows, clear })}>
                      <X /> Reject {rows.length}
                    </Button>
                  </Gated>
                  <Gated menuKey="workplace.travel" action="A">
                    <Button size="sm" onClick={() => setApproving({ rows, clear })}>
                      <Check /> Approve {rows.length}
                    </Button>
                  </Gated>
                </>
              )}
            />
          </TabsContent>

          <TabsContent value="all" className="flex flex-col gap-3">
            <Section
              title="Advance balance"
              description="Company money currently in employees' hands. Settlement closes the loop after each trip."
              actions={
                can("workplace.travel_advances", "V") ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/travel/advances">Open travel advances</Link>
                  </Button>
                ) : undefined
              }
            >
              <ShareBar
                segments={[
                  { key: "settled", label: "Settled", value: advance.settled, status: "good" },
                  { key: "outstanding", label: "Outstanding", value: advance.outstanding, status: "warning" },
                  {
                    key: "undisbursed",
                    label: "Requested, not disbursed",
                    value: Math.max(0, advance.requested - advance.disbursed),
                    status: "serious",
                  },
                ]}
                total={Math.max(advance.requested, 1)}
                valueFormat={(v) => inr(v, { decimals: false })}
                height={10}
              />
            </Section>
            <DataTable<TravelRequest>
              columns={registerColumns}
              data={filterRows(requests)}
              getRowId={(r) => r.id}
              searchKeys={["requestNo", "employeeName", "purpose", "search"]}
              searchPlaceholder="Search request, traveller or city…"
              exportName="travel-requests"
              canExport={can("workplace.travel", "X")}
              onRowClick={(r) => setOpenId(r.id)}
              rowTone={(r) => (r.advanceOutstanding > 0 && r.endDate < DEMO_TODAY ? "warning" : undefined)}
              filters={filters}
              emptyIcon={Plane}
              emptyTitle="No request matches these filters"
              emptyDescription="Clear the status or trip filter to widen the register."
            />
          </TabsContent>

          <TabsContent value="mine" className="flex flex-col gap-3">
            {myTable}
          </TabsContent>
        </Tabs>
      ) : (
        myTable
      )}

      {/* -------------------------------------------------- itinerary sheet */}
      <Sheet open={!!open} onOpenChange={(v) => !v && setOpenId(null)}>
        <SheetContent side="right" width="sm:max-w-2xl">
          {open && (
            <>
              <SheetHeader>
                <SheetTitle className="tnum">{open.requestNo}</SheetTitle>
                <SheetDescription>
                  {open.employeeName} · {open.purpose}
                </SheetDescription>
              </SheetHeader>
              <SheetBody>
                <TravelItineraryCard
                  request={open}
                  onSettle={canSettle(open) ? settle : undefined}
                  onCancel={canCancel(open) ? setCancelling : undefined}
                  footer={
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isAdmin && open.status === "submitted" && open.employeeCode !== me && (
                        <>
                          <Gated menuKey="workplace.travel" action="A">
                            <Button size="sm" onClick={() => setApproving({ rows: [open] })}>
                              <Check /> Approve
                            </Button>
                          </Gated>
                          <Gated menuKey="workplace.travel" action="A">
                            <Button size="sm" variant="outline" onClick={() => setRejecting({ rows: [open] })}>
                              <X /> Reject
                            </Button>
                          </Gated>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto"
                        onClick={() =>
                          mockAction("Itinerary emailed", { description: `${open.requestNo} sent to ${open.employeeName}.` })
                        }
                      >
                        Email itinerary
                      </Button>
                    </div>
                  }
                />
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>

      <TravelRequestDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        employeeCode={me}
        onSubmitted={(r) => {
          setRequests((rs) => [r, ...rs]);
          mockAction(`${r.requestNo} submitted`, {
            description: `${r.legs[0].from} → ${r.legs[0].to} · ${r.nights} night${r.nights === 1 ? "" : "s"} · routed to ${r.approverName}.`,
          });
        }}
      />

      <ConfirmDialog
        open={!!approving}
        onOpenChange={(v) => !v && setApproving(null)}
        title={approving?.rows.length === 1 ? `Approve ${approving.rows[0].requestNo}?` : `Approve ${approving?.rows.length ?? 0} trips?`}
        description={
          approving &&
          `Estimated ${inr(sum(approving.rows.map((r) => r.estimatedCost)), { decimals: false })}, with ${inr(
            sum(approving.rows.map((r) => r.advanceRequested)),
            { decimals: false },
          )} of advance to disburse. The travel desk starts booking straight away.`
        }
        confirmLabel="Approve"
        onConfirm={() => approving && decide(approving, true, "")}
      />

      <ConfirmDialog
        open={!!rejecting}
        onOpenChange={(v) => !v && setRejecting(null)}
        title={rejecting?.rows.length === 1 ? `Reject ${rejecting.rows[0].requestNo}?` : `Reject ${rejecting?.rows.length ?? 0} trips?`}
        description="The traveller is notified with your reason; nothing is booked and no advance is paid."
        confirmLabel="Reject"
        destructive
        comment={{ label: "Reason for rejection", placeholder: "e.g. The review can run over video this quarter." }}
        onConfirm={(comment) => rejecting && decide(rejecting, false, comment)}
      />

      <ConfirmDialog
        open={!!cancelling}
        onOpenChange={(v) => !v && setCancelling(null)}
        title={`Cancel ${cancelling?.requestNo ?? ""}?`}
        description="Every leg is released and the travel desk stops booking. Any advance already paid is due back to finance."
        confirmLabel="Cancel trip"
        cancelLabel="Keep trip"
        destructive
        comment={{ label: "Reason", placeholder: "Optional — e.g. the customer moved the review online.", required: false }}
        onConfirm={(comment) => cancelling && cancel(cancelling, comment.trim())}
      />
    </PageBody>
  );
}

function ViewButton({ request, onView }: { request: TravelRequest; onView: () => void }) {
  return (
    <Hint text="Open the itinerary">
      <Button size="icon-sm" variant="ghost" aria-label={`View ${request.requestNo}`} onClick={onView}>
        <Eye />
      </Button>
    </Hint>
  );
}
