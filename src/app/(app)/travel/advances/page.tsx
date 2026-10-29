"use client";

import * as React from "react";
import { AlarmClock, HandCoins, Plus, Wallet, WalletCards } from "lucide-react";
import { inr, num } from "@/lib/format";
import { sum } from "@/lib/utils";
import { DEMO_TODAY } from "@/mock/org";
import { TRAVEL_ADVANCE_SUMMARY, TRAVEL_REQUESTS } from "@/mock/workplace";
import {
  TRAVEL_ADV_ROWS,
  TRAVEL_ADV_TRIP_TOTALS,
  travelAdvOverdue,
  travelAdvRecoveryPlan,
} from "@/mock/finance-travel";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, FilterSelect } from "@/components/ui/overlays";
import { DataTable } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { DecisionDialog, ReconcileCheck } from "@/components/finance/kit";
import { advanceColumns, type AdvAction, type AdvRow } from "./columns";
import { SettleDialog, type SettleValues } from "./settle-dialog";
import { RaiseAdvanceDialog, type RaiseValues } from "./raise-dialog";
import { RecoverySection } from "./recovery-section";

/* ============================================================================
   /travel/advances — the travel advance ledger.

   Trip-linked rows come straight from the travel requests, so their issued and
   outstanding columns tie to TRAVEL_ADVANCE_SUMMARY. Every row keeps the
   identity issued = settled + outstanding + written off, and overdue balances
   are recovered through the next three pay runs.
   ========================================================================== */

const APPROVED_TRIPS = new Set(TRAVEL_REQUESTS.filter((t) => t.status === "approved" || t.status === "completed").map((t) => t.requestNo));

const SEED: AdvRow[] = TRAVEL_ADV_ROWS.map((r) => ({
  ...r,
  writtenOff: 0,
  tripApproved: r.requestNo === null || APPROVED_TRIPS.has(r.requestNo),
}));

type Pending = { row: AdvRow; action: AdvAction } | null;

export default function TravelAdvancesPage() {
  const loading = useFakeLoad();
  const { can } = useApp();
  const [rows, setRows] = React.useState<AdvRow[]>(SEED);
  const [status, setStatus] = React.useState("all");
  const [source, setSource] = React.useState("all");
  const [pending, setPending] = React.useState<Pending>(null);
  const [raiseOpen, setRaiseOpen] = React.useState(false);

  const update = (id: string, patch: Partial<AdvRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const act = (row: AdvRow, action: AdvAction) => {
    if (action === "approve") {
      update(row.id, { issued: row.requested, outstanding: row.requested - row.settled, issuedOn: DEMO_TODAY, status: "outstanding" });
      mockAction(`Approved ${row.id}`, {
        description: `${inr(row.requested, { decimals: false })} is queued for disbursal to ${row.employeeName} today.`,
        undo: () => update(row.id, row),
      });
      return;
    }
    setPending({ row, action });
  };

  const settle = (row: AdvRow, v: SettleValues) => {
    const offset = v.claimAmount + v.cashReturned;
    const balance = row.outstanding - offset;
    if (balance <= 0) {
      update(row.id, { settled: row.issued, outstanding: 0, recovery: [], status: "settled" });
    } else {
      update(row.id, {
        settled: row.settled + offset,
        outstanding: balance,
        recovery: travelAdvRecoveryPlan(balance, v.instalments),
        status: "recovering",
      });
    }
    mockAction(`Settlement recorded on ${row.id}`, {
      description:
        balance > 0
          ? `${inr(balance, { decimals: false })} will be recovered over ${v.instalments} pay run${v.instalments === 1 ? "" : "s"}.`
          : balance < 0
            ? `${inr(-balance, { decimals: false })} is reimbursed to ${row.employeeName} with the next expense batch.`
            : "The advance is fully settled and closed.",
      undo: () => update(row.id, row),
    });
  };

  const raise = (trip: (typeof TRAVEL_REQUESTS)[number], v: RaiseValues) => {
    const id = `ADV-${trip.requestNo.slice(4)}-T${rows.filter((r) => r.requestNo === trip.requestNo).length}`;
    const next: AdvRow = {
      id,
      requestNo: trip.requestNo,
      employeeCode: trip.employeeCode,
      employeeName: trip.employeeName,
      department: trip.department,
      purpose: trip.purpose,
      tripStart: trip.startDate,
      tripEnd: trip.endDate,
      requested: v.amount,
      issued: 0,
      settled: 0,
      outstanding: 0,
      issuedOn: null,
      settleBy: rows.find((r) => r.requestNo === trip.requestNo)?.settleBy ?? trip.endDate,
      status: "pending_approval",
      carried: false,
      recovery: [],
      note: v.note || `Top-up via ${v.mode}`,
      writtenOff: 0,
      tripApproved: true,
    };
    setRows((prev) => [next, ...prev]);
    mockAction(`Advance ${id} raised`, {
      description: `${inr(v.amount, { decimals: false })} for ${trip.employeeName} · ${v.mode}. Waiting for approval.`,
      undo: () => setRows((prev) => prev.filter((r) => r.id !== id)),
    });
  };

  const visible = rows.filter(
    (r) =>
      (status === "all" || (status === "overdue" ? travelAdvOverdue(r) : r.status === status)) &&
      (source === "all" || (source === "carried") === r.carried),
  );

  const totals = {
    issued: sum(rows.map((r) => r.issued)),
    settled: sum(rows.map((r) => r.settled)),
    outstanding: sum(rows.map((r) => r.outstanding)),
    writtenOff: sum(rows.map((r) => r.writtenOff)),
  };
  const overdue = rows.filter(travelAdvOverdue);
  const pendingApproval = rows.filter((r) => r.status === "pending_approval");

  const columns = React.useMemo(
    () => advanceColumns(act, (a) => can("workplace.travel_advances", a)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [can],
  );

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Travel advances" description="Loading the advance ledger…" />
        <CardsSkeleton count={4} />
        <TableSkeleton />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="Travel advances"
        description="Every advance issued against a trip, what has been settled with expense claims or cash, and what is still out. Balances not settled within 10 days of return are recovered through payroll."
        actions={
          <Gated menuKey="workplace.travel_advances" action="C">
            <Button size="sm" onClick={() => setRaiseOpen(true)}>
              <Plus /> Raise advance
            </Button>
          </Gated>
        }
      />

      <StatRow cols={4}>
        <StatTile label="Issued" value={inr(totals.issued, { decimals: false })} icon={WalletCards} hint={`${num(rows.filter((r) => r.issued > 0).length)} advances disbursed`} />
        <StatTile label="Settled" value={inr(totals.settled, { decimals: false })} icon={HandCoins} tone="good" hint="Offset by claims or cash returned" onClick={() => setStatus("settled")} />
        <StatTile label="Outstanding" value={inr(totals.outstanding, { decimals: false })} icon={Wallet} tone="warning" hint={`${num(pendingApproval.length)} more awaiting approval`} onClick={() => setStatus("outstanding")} />
        <StatTile
          label="Overdue"
          value={inr(sum(overdue.map((r) => r.outstanding)), { decimals: false })}
          icon={AlarmClock}
          tone={overdue.length ? "critical" : "good"}
          hint={`${num(overdue.length)} past the settlement deadline`}
          onClick={() => setStatus("overdue")}
        />
      </StatRow>

      <div className="grid gap-2 lg:grid-cols-3">
        <ReconcileCheck
          label="Trip advances tie to travel requests"
          left={TRAVEL_ADV_TRIP_TOTALS.outstanding}
          right={TRAVEL_ADVANCE_SUMMARY.outstanding}
          leftLabel="Σ ledger outstanding"
          rightLabel="Σ request outstanding"
        />
        <ReconcileCheck
          label="Disbursals tie out"
          left={TRAVEL_ADV_TRIP_TOTALS.issued}
          right={TRAVEL_ADVANCE_SUMMARY.settled + TRAVEL_ADVANCE_SUMMARY.outstanding}
          leftLabel="Σ issued"
          rightLabel="settled + outstanding"
        />
        <ReconcileCheck
          label="Ledger identity (live)"
          left={totals.issued}
          right={totals.settled + totals.outstanding + totals.writtenOff}
          leftLabel="Issued"
          rightLabel="settled + outstanding + written off"
        />
      </div>

      <DataTable<AdvRow>
        columns={columns}
        data={visible}
        getRowId={(r) => r.id}
        searchKeys={["id", "requestNo", "employeeName", "employeeCode", "purpose"]}
        searchPlaceholder="Search advance, trip or employee…"
        exportName={`travel-advances${status === "all" ? "" : `-${status}`}${source === "all" ? "" : `-${source}`}`}
        rowTone={(r) => (travelAdvOverdue(r) ? "danger" : r.status === "pending_approval" ? "warning" : undefined)}
        emptyIcon={Wallet}
        emptyTitle="No advances match these filters"
        emptyDescription="Clear the status or source filter to see the full ledger."
        emptyAction={
          <Button variant="outline" size="sm" onClick={() => { setStatus("all"); setSource("all"); }}>
            Clear filters
          </Button>
        }
        filters={
          <>
            <FilterSelect
              label="Status"
              value={status}
              onValueChange={setStatus}
              allLabel="All statuses"
              width="w-[190px]"
              options={[
                { value: "pending_approval", label: "Pending approval" },
                { value: "outstanding", label: "Outstanding" },
                { value: "overdue", label: "Overdue" },
                { value: "recovering", label: "Recovering via payroll" },
                { value: "settled", label: "Settled" },
                { value: "written_off", label: "Written off" },
                { value: "rejected", label: "Rejected" },
              ]}
            />
            <FilterSelect
              label="Source"
              value={source}
              onValueChange={setSource}
              allLabel="All advances"
              width="w-[170px]"
              options={[
                { value: "current", label: "Current trips" },
                { value: "carried", label: "Carried over" },
              ]}
            />
          </>
        }
      />

      <RecoverySection rows={rows} />

      <SettleDialog row={pending?.action === "settle" ? pending.row : null} onOpenChange={(v) => !v && setPending(null)} onSave={settle} />

      <RaiseAdvanceDialog open={raiseOpen} onOpenChange={setRaiseOpen} onSave={raise} />

      <ConfirmDialog
        open={pending?.action === "schedule"}
        onOpenChange={(v) => !v && setPending(null)}
        title={`Recover ${pending ? inr(pending.row.outstanding, { decimals: false }) : ""} through payroll?`}
        description={
          pending
            ? `${pending.row.employeeName}'s balance on ${pending.row.id} is split into three deductions in the October, November and December 2026 pay runs. The employee is notified and the deduction shows on each payslip.`
            : undefined
        }
        confirmLabel="Schedule recovery"
        onConfirm={() => {
          if (!pending) return;
          const { row } = pending;
          update(row.id, { status: "recovering", recovery: travelAdvRecoveryPlan(row.outstanding, 3) });
          mockAction(`Recovery scheduled for ${row.id}`, {
            description: `${inr(row.outstanding, { decimals: false })} over three pay runs, starting October 2026.`,
            undo: () => update(row.id, row),
          });
          setPending(null);
        }}
      />

      <DecisionDialog
        open={pending?.action === "reject" || pending?.action === "write_off"}
        onOpenChange={(v) => !v && setPending(null)}
        title={pending?.action === "write_off" ? `Write off ${pending.row.id}?` : `Reject advance ${pending?.row.id ?? ""}?`}
        description={
          pending?.action === "write_off"
            ? `${inr(pending.row.outstanding, { decimals: false })} is charged to travel expense and no longer recovered from ${pending.row.employeeName}. This cannot be undone after month-end close.`
            : `${pending?.row.employeeName ?? ""} is notified and no money is disbursed.`
        }
        confirmLabel={pending?.action === "write_off" ? "Write off" : "Reject advance"}
        onConfirm={(comment) => {
          if (!pending) return;
          const { row, action } = pending;
          if (action === "write_off") {
            update(row.id, { writtenOff: row.outstanding, outstanding: 0, recovery: [], status: "written_off", note: comment });
            mockAction(`${row.id} written off`, { description: `${inr(row.outstanding, { decimals: false })} · ${comment}`, tone: "warning" });
          } else {
            update(row.id, { status: "rejected", note: comment });
            mockAction(`Advance ${row.id} rejected`, { description: comment, tone: "warning" });
          }
          setPending(null);
        }}
      />
    </PageBody>
  );
}
