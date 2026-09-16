"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { differenceInCalendarDays, parseISO } from "date-fns";
import {
  Ban,
  BellRing,
  Check,
  FileText,
  Handshake,
  Percent,
  RotateCcw,
  Send,
  Hourglass,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { fmtDate, inr, pct } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import {
  HIRING_BRANCHES,
  HIRING_DEPARTMENTS,
  OFFERS,
  OFFER_STATUS_LABEL,
  REQ_OPTIONS,
  branchLabel,
  deptLabel,
  requisitionByCode,
  type Offer,
  type OfferStatus,
} from "@/mock/hiring";
import { mockAction } from "@/components/app-state";
import { DataTable } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { CardsSkeleton } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Avatar, Badge, Hint } from "@/components/ui/primitives";
import { ConfirmDialog, FilterSelect } from "@/components/ui/overlays";
import { OfferDrawer, reviseOffer } from "@/components/hiring/offer-drawer";

/* ============================================================================
   /offers — every offer in flight, and the CTC breakup behind each one.

   The table is the index; the drawer is where the money is explained. Offer
   state lives in this component so an approval, a withdrawal or a CTC revision
   changes the badge, the KPI row and the drawer in the same tick.
   ========================================================================== */

const STATUS_OPTIONS: { value: OfferStatus; label: string }[] = (
  ["pending", "approved", "hired", "rejected", "expired"] as OfferStatus[]
).map((s) => ({ value: s, label: OFFER_STATUS_LABEL[s] }));

/** Days until the offer lapses — negative once it already has. */
const daysToExpiry = (o: Offer) =>
  differenceInCalendarDays(parseISO(o.validTill), parseISO(DEMO_TODAY));

const isLive = (o: Offer) => o.status === "approved" || o.status === "pending";

export default function OffersPage() {
  const loading = useFakeLoad();

  /* Offers are cloned into local state — every mutation on this screen is
     optimistic and in-memory, and nothing survives a refresh. By design. */
  const [offers, setOffers] = React.useState<Offer[]>(() => OFFERS.map((o) => ({ ...o })));

  const [status, setStatus] = React.useState("all");
  const [dept, setDept] = React.useState("all");
  const [branch, setBranch] = React.useState("all");
  const [req, setReq] = React.useState("all");

  const [selected, setSelected] = React.useState<Offer | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [bulkWithdraw, setBulkWithdraw] = React.useState<{ rows: Offer[]; clear: () => void } | null>(
    null,
  );

  /* -------------------------------------------------------------- mutators */

  const setOfferStatus = React.useCallback(
    (id: string, next: OfferStatus, note: string) => {
      setOffers((prev) =>
        prev.map((o) =>
          o.id === id
            ? {
                ...o,
                status: next,
                respondedAt:
                  next === "hired" || next === "rejected"
                    ? `${DEMO_TODAY}T11:05:00`
                    : o.respondedAt,
                approvals:
                  next === "approved"
                    ? o.approvals.map((a) =>
                        a.action === "Awaiting"
                          ? {
                              ...a,
                              action: "Approved" as const,
                              at: `${DEMO_TODAY}T11:05:00`,
                              comment: "Approved from the offers queue during this session.",
                            }
                          : a,
                      )
                    : o.approvals,
              }
            : o,
        ),
      );
      mockAction(`Offer ${OFFER_STATUS_LABEL[next].toLowerCase()}`, { description: note });
    },
    [],
  );

  const setOfferCtc = React.useCallback((id: string, ctc: number, reason: string) => {
    let becamePending = false;
    setOffers((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        const next = reviseOffer(o, ctc, reason);
        becamePending = o.status !== "pending" && next.status === "pending";
        return next;
      }),
    );
    mockAction("CTC revised", {
      description: becamePending
        ? `Recomputed at ${inr(ctc, { decimals: false })}. Above band — returned to Pending approval. Reason: ${reason}`
        : `Structure recomputed at ${inr(ctc, { decimals: false })}. Reason: ${reason}`,
    });
  }, []);

  const bulkApprove = (rows: Offer[], clear: () => void) => {
    const targets = rows.filter((r) => r.status === "pending");
    if (!targets.length) {
      mockAction("Nothing to approve", {
        description: "None of the selected offers are waiting on an approval.",
        tone: "info",
      });
      return;
    }
    const ids = new Set(targets.map((t) => t.id));
    setOffers((prev) =>
      prev.map((o) =>
        ids.has(o.id)
          ? {
              ...o,
              status: "approved" as OfferStatus,
              approvals: o.approvals.map((a) =>
                a.action === "Awaiting"
                  ? {
                      ...a,
                      action: "Approved" as const,
                      at: `${DEMO_TODAY}T11:05:00`,
                      comment: "Bulk-approved from the offers queue.",
                    }
                  : a,
              ),
            }
          : o,
      ),
    );
    clear();
    mockAction(`${targets.length} offer${targets.length === 1 ? "" : "s"} approved`, {
      description: `${targets.map((t) => t.candidateName).join(", ")} — now released and awaiting a candidate response.`,
    });
  };

  const bulkRemind = (rows: Offer[], clear: () => void) => {
    clear();
    mockAction(`Reminder sent to ${rows.length} candidate${rows.length === 1 ? "" : "s"}`, {
      description: `${rows.map((r) => r.candidateName).join(", ")} — nudged on the pending offer response.`,
    });
  };

  const doBulkWithdraw = () => {
    if (!bulkWithdraw) return;
    const ids = new Set(bulkWithdraw.rows.map((r) => r.id));
    setOffers((prev) =>
      prev.map((o) => (ids.has(o.id) ? { ...o, status: "expired" as OfferStatus } : o)),
    );
    bulkWithdraw.clear();
    mockAction(`${bulkWithdraw.rows.length} offer${bulkWithdraw.rows.length === 1 ? "" : "s"} withdrawn`, {
      description: `Marked as lapsed: ${bulkWithdraw.rows.map((r) => r.candidateName).join(", ")}.`,
      tone: "warning",
    });
    setBulkWithdraw(null);
  };

  /* ---------------------------------------------------------------- derived */

  const kpis = React.useMemo(() => {
    const released = offers.filter((o) => o.status === "approved").length;
    const pending = offers.filter((o) => o.status === "pending").length;
    const accepted = offers.filter((o) => o.status === "hired").length;
    const declined = offers.filter((o) => o.status === "rejected").length;
    const decided = accepted + declined;
    return {
      released,
      pending,
      accepted,
      declined,
      acceptance: decided === 0 ? 0 : Math.round((accepted / decided) * 1000) / 10,
      expiringSoon: offers.filter((o) => isLive(o) && daysToExpiry(o) <= 3).length,
      committedCtc: offers
        .filter((o) => o.status === "hired")
        .reduce((a, o) => a + o.ctc, 0),
    };
  }, [offers]);

  const rows = React.useMemo(
    () =>
      offers.filter(
        (o) =>
          (status === "all" || o.status === status) &&
          (dept === "all" || o.departmentId === dept) &&
          (branch === "all" || o.branchId === branch) &&
          (req === "all" || o.reqCode === req),
      ),
    [offers, status, dept, branch, req],
  );

  const filtersActive =
    status !== "all" || dept !== "all" || branch !== "all" || req !== "all";

  const resetFilters = () => {
    setStatus("all");
    setDept("all");
    setBranch("all");
    setReq("all");
  };

  /* Keep the open drawer pointed at the live copy of the offer. */
  const activeOffer = selected ? (offers.find((o) => o.id === selected.id) ?? null) : null;

  const openOffer = (o: Offer) => {
    setSelected(o);
    setDrawerOpen(true);
  };

  /* ---------------------------------------------------------------- columns */

  const columns = React.useMemo<ColumnDef<Offer, unknown>[]>(
    () => [
      {
        id: "offerId",
        header: "Offer",
        accessorKey: "id",
        enableHiding: false,
        cell: ({ row }) => (
          <span className="tnum font-medium text-foreground">{row.original.id}</span>
        ),
      },
      {
        id: "candidate",
        header: "Candidate",
        accessorKey: "candidateName",
        enableHiding: false,
        cell: ({ row }) => (
          <span className="flex items-center gap-2">
            <Avatar name={row.original.candidateName} size={24} />
            <Link
              href={`/candidates/${row.original.candidateId}`}
              onClick={(e) => e.stopPropagation()}
              className="truncate font-medium text-foreground hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {row.original.candidateName}
            </Link>
          </span>
        ),
      },
      { id: "role", header: "Role", accessorKey: "role" },
      {
        id: "requisition",
        header: "Requisition",
        accessorKey: "reqCode",
        cell: ({ row }) => (
          <span className="tnum text-muted-foreground">{row.original.reqCode}</span>
        ),
      },
      {
        id: "department",
        header: "Department",
        accessorFn: (o) => deptLabel(o.departmentId),
      },
      { id: "branch", header: "Branch", accessorFn: (o) => branchLabel(o.branchId) },
      { id: "grade", header: "Grade", accessorKey: "gradeId" },
      {
        id: "ctc",
        header: "Annual CTC",
        accessorKey: "ctc",
        cell: ({ row }) => (
          <span className="tnum block text-right font-medium">
            {inr(row.original.ctc, { decimals: false })}
          </span>
        ),
      },
      {
        id: "offerDate",
        header: "Offered",
        accessorKey: "offerDate",
        cell: ({ row }) => (
          <span className="tnum whitespace-nowrap text-muted-foreground">
            {fmtDate(row.original.offerDate)}
          </span>
        ),
      },
      {
        id: "validTill",
        header: "Valid till",
        accessorKey: "validTill",
        cell: ({ row }) => {
          const o = row.original;
          const d = daysToExpiry(o);
          const flag = isLive(o) && d <= 3;
          return (
            <Hint
              text={
                flag
                  ? d < 0
                    ? `Lapsed ${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"} ago — chase or withdraw.`
                    : `Expires in ${d} day${d === 1 ? "" : "s"}.`
                  : ""
              }
            >
              <span
                className={cn(
                  "tnum whitespace-nowrap",
                  flag ? "font-medium text-warning-fg" : "text-muted-foreground",
                )}
              >
                {fmtDate(o.validTill)}
              </span>
            </Hint>
          );
        },
      },
      {
        id: "joiningDate",
        header: "Joining",
        accessorKey: "joiningDate",
        cell: ({ row }) => (
          <span className="tnum whitespace-nowrap">{fmtDate(row.original.joiningDate)}</span>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (o) => OFFER_STATUS_LABEL[o.status],
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
            label={OFFER_STATUS_LABEL[row.original.status]}
          />
        ),
      },
    ],
    [],
  );

  /* ------------------------------------------------------------------ view */

  return (
    <PageBody>
      <PageHeader
        title="Offers"
        description={`${offers.length} offers raised this cycle across ${
          new Set(offers.map((o) => o.reqCode)).size
        } requisitions. Approval trail, CTC breakup and candidate response in one place.`}
        actions={
          <>
            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <RotateCcw /> Clear filters
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href="/candidates">Candidate pipeline</Link>
            </Button>
            <Gated menuKey="hiring.offers" action="C">
              <Button
                size="sm"
                onClick={() =>
                  mockAction("Start from a candidate", {
                    description:
                      "Offers are raised from a candidate in the Offer stage — open the pipeline board and pick one.",
                    tone: "info",
                  })
                }
              >
                <FileText /> Raise offer
              </Button>
            </Gated>
          </>
        }
      />

      {loading ? (
        <CardsSkeleton count={4} />
      ) : (
        <StatRow cols={4}>
          <StatTile
            label="Offers released"
            value={kpis.released}
            icon={Send}
            tone="accent"
            hint={`${kpis.expiringSoon} expiring within 3 days`}
            onClick={() => setStatus(status === "approved" ? "all" : "approved")}
            footer={
              status === "approved" ? "Filtering the table — click again to clear" : undefined
            }
          />
          <StatTile
            label="Pending approval"
            value={kpis.pending}
            icon={Hourglass}
            tone={kpis.pending > 0 ? "warning" : "neutral"}
            hint="Blocked on HR or Finance sign-off"
            onClick={() => setStatus(status === "pending" ? "all" : "pending")}
            footer={
              status === "pending" ? "Filtering the table — click again to clear" : undefined
            }
          />
          <StatTile
            label="Offers accepted"
            value={kpis.accepted}
            icon={Handshake}
            tone="good"
            hint={`${inr(kpis.committedCtc, { decimals: false })} of annual CTC committed`}
            onClick={() => setStatus(status === "hired" ? "all" : "hired")}
            footer={status === "hired" ? "Filtering the table — click again to clear" : undefined}
          />
          <StatTile
            label="Offer acceptance rate"
            value={pct(kpis.acceptance)}
            icon={Percent}
            tone={kpis.acceptance >= 80 ? "good" : "warning"}
            hint={`${kpis.accepted} accepted · ${kpis.declined} declined`}
            onClick={() => setStatus(status === "rejected" ? "all" : "rejected")}
            footer={
              status === "rejected" ? "Showing declined offers — click again to clear" : undefined
            }
          />
        </StatRow>
      )}

      {loading ? (
        <TableSkeleton rows={10} />
      ) : (
        <DataTable<Offer>
          columns={columns}
          data={rows}
          getRowId={(o) => o.id}
          searchKeys={["candidateName", "role"]}
          searchPlaceholder="Search candidate or role…"
          exportName="offers"
          enableSelection
          onRowClick={openOffer}
          emptyIcon={FileText}
          emptyTitle="No offers match these filters"
          emptyDescription="Offers appear here the moment a candidate is moved into the Offer stage on the pipeline board."
          emptyAction={
            filtersActive ? (
              <Button variant="outline" size="sm" onClick={resetFilters}>
                <RotateCcw /> Clear filters
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link href="/candidates">Open the pipeline</Link>
              </Button>
            )
          }
          rowTone={(o) => (isLive(o) && daysToExpiry(o) <= 3 ? "warning" : undefined)}
          filters={
            <>
              <FilterSelect
                label="Status"
                value={status}
                onValueChange={setStatus}
                options={STATUS_OPTIONS}
                allLabel="All statuses"
                width="w-[190px]"
              />
              <FilterSelect
                label="Department"
                value={dept}
                onValueChange={setDept}
                options={HIRING_DEPARTMENTS}
                allLabel="All departments"
                width="w-[180px]"
              />
              <FilterSelect
                label="Branch"
                value={branch}
                onValueChange={setBranch}
                options={HIRING_BRANCHES}
                allLabel="All branches"
                width="w-[160px]"
              />
              <FilterSelect
                label="Requisition"
                value={req}
                onValueChange={setReq}
                options={REQ_OPTIONS}
                allLabel="All requisitions"
                width="w-[230px]"
              />
              {filtersActive && (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  Reset
                </Button>
              )}
            </>
          }
          toolbar={
            <Badge variant="muted" className="tnum">
              {rows.length} of {offers.length}
            </Badge>
          }
          bulkActions={(rowsSel, clear) => (
            <>
              <Gated menuKey="hiring.offers" action="A">
                <Button size="sm" onClick={() => bulkApprove(rowsSel, clear)}>
                  <Check /> Approve selected
                </Button>
              </Gated>
              <Button variant="outline" size="sm" onClick={() => bulkRemind(rowsSel, clear)}>
                <BellRing /> Send reminder
              </Button>
              <Gated menuKey="hiring.offers" action="E">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkWithdraw({ rows: rowsSel, clear })}
                >
                  <Ban /> Withdraw offer
                </Button>
              </Gated>
            </>
          )}
        />
      )}

      <OfferDrawer
        offer={activeOffer}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onStatusChange={setOfferStatus}
        onCtcChange={setOfferCtc}
      />

      <ConfirmDialog
        open={!!bulkWithdraw}
        onOpenChange={(v) => !v && setBulkWithdraw(null)}
        title={`Withdraw ${bulkWithdraw?.rows.length ?? 0} offer${
          (bulkWithdraw?.rows.length ?? 0) === 1 ? "" : "s"
        }?`}
        description={
          <>
            {bulkWithdraw?.rows.map((r) => r.candidateName).join(", ")} will be marked as lapsed
            and notified. Offers that have already been accepted are not reversed by this action
            on the candidate&rsquo;s side — you would need to raise a separate withdrawal.
          </>
        }
        confirmLabel="Withdraw offers"
        destructive
        onConfirm={doBulkWithdraw}
      />
    </PageBody>
  );
}
