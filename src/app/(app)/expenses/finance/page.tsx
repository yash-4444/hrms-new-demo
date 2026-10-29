"use client";

import * as React from "react";
import { BadgeCheck, FileSearch, Landmark, ShieldAlert, Wallet } from "lucide-react";
import { inr, inrCompact, num } from "@/lib/format";
import { sum } from "@/lib/utils";
import {
  EXP_BATCH_FOR_MODE,
  EXP_DUPLICATE_FLAGS,
  EXP_FINANCE_QUEUE,
  EXP_PAYOUT_BATCHES,
  expDuplicateFor,
  type ExpDuplicateFlag,
  type ExpFinanceRow,
} from "@/mock/finance-expense";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, FilterSelect } from "@/components/ui/overlays";
import { DataTable } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { DecisionDialog } from "@/components/finance/kit";
import { ClaimSheet } from "../approvals/claim-sheet";
import { financeColumns } from "./columns";
import { DuplicatePanel } from "./duplicate-panel";
import { PayoutBatches } from "./batches";

/* ============================================================================
   /expenses/finance — after the approvers, finance verifies each claim against
   its receipts, queries back what is missing and releases the rest, either with
   the October payroll or as a direct NEFT payment. Segregation of duties: the
   finance controller verifies and releases; the payroll admin can only look.
   ========================================================================== */

const STATUS_OPTIONS = [
  { value: "pending", label: "Awaiting verification" },
  { value: "verified", label: "Verified" },
  { value: "queried", label: "Queried" },
  { value: "on_hold", label: "On hold" },
  { value: "released_payroll", label: "Released to payroll" },
  { value: "released_direct", label: "Paid directly" },
];

export default function ExpenseFinancePage() {
  const loading = useFakeLoad();
  const { can } = useApp();
  const [rows, setRows] = React.useState<ExpFinanceRow[]>(EXP_FINANCE_QUEUE);
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [preview, setPreview] = React.useState<ExpFinanceRow | null>(null);
  const [query, setQuery] = React.useState<ExpFinanceRow | null>(null);
  const [bulkRelease, setBulkRelease] = React.useState<{ rows: ExpFinanceRow[]; mode: "payroll" | "direct"; clear: () => void } | null>(null);

  const patch = (ids: string[], fn: (r: ExpFinanceRow) => ExpFinanceRow) => {
    const before = rows;
    setRows((prev) => prev.map((r) => (ids.includes(r.id) ? fn(r) : r)));
    return () => setRows(before);
  };

  const verify = (ids: string[]) => {
    const eligible = rows.filter((r) => ids.includes(r.id) && (r.status === "pending" || r.status === "queried")).map((r) => r.id);
    if (!eligible.length) return mockAction("Nothing to verify", { tone: "info", description: "Only claims awaiting verification or queried can be verified." });
    const undo = patch(eligible, (r) => ({ ...r, status: "verified", note: null }));
    mockAction(`Verified ${eligible.length === 1 ? eligible[0] : `${eligible.length} claims`}`, {
      description: "Receipts matched to the claim lines. Ready to release.",
      undo,
    });
  };

  const release = (ids: string[], mode: "payroll" | "direct") => {
    const eligible = rows.filter((r) => ids.includes(r.id) && r.status === "verified");
    if (!eligible.length) return mockAction("Nothing to release", { tone: "warning", description: "Verify a claim before releasing it." });
    const batch = EXP_PAYOUT_BATCHES.find((b) => b.id === EXP_BATCH_FOR_MODE[mode])!;
    const undo = patch(
      eligible.map((r) => r.id),
      (r) => ({ ...r, status: mode === "payroll" ? "released_payroll" : "released_direct", batchId: batch.id }),
    );
    const skipped = ids.length - eligible.length;
    mockAction(`Released ${inr(sum(eligible.map((r) => r.total)), { decimals: false })} to ${batch.label}`, {
      description: `${eligible.length} claim${eligible.length === 1 ? "" : "s"} added to ${batch.id}.${skipped ? ` ${skipped} not yet verified were skipped.` : ""}`,
      undo,
    });
  };

  const hold = (f: ExpDuplicateFlag) => {
    const undo = patch([f.claimNo], (r) => ({ ...r, status: "on_hold", note: `Held — possible duplicate of ${f.duplicateOf}.` }));
    mockAction(`${f.claimNo} put on hold`, { description: `${f.duplicateOf} has been linked for the employee to explain.`, undo });
  };

  const dismiss = (f: ExpDuplicateFlag) => {
    setDismissed((s) => new Set(s).add(f.claimNo));
    mockAction("Duplicate flag dismissed", {
      tone: "info",
      description: `${f.claimNo} stays in the queue. Your decision is logged to tune the detector.`,
      undo: () => setDismissed((s) => { const n = new Set(s); n.delete(f.claimNo); return n; }),
    });
  };

  const columns = financeColumns({
    verify,
    query: setQuery,
    release,
    clearHold: (r) => {
      const undo = patch([r.id], (x) => ({ ...x, status: "pending", note: null }));
      mockAction(`Hold cleared on ${r.claimNo}`, { description: "Back in the verification queue.", undo });
    },
    dismissed,
  });

  const openFlags = EXP_DUPLICATE_FLAGS.filter(
    (f) => !dismissed.has(f.claimNo) && rows.find((r) => r.id === f.claimNo)?.status === "pending",
  );
  const pending = rows.filter((r) => r.status === "pending" || r.status === "queried");
  const verified = rows.filter((r) => r.status === "verified");
  const toPayroll = rows.filter((r) => r.status === "released_payroll");
  const direct = rows.filter((r) => r.status === "released_direct");
  const data = rows.filter((r) => statusFilter === "all" || r.status === statusFilter);
  const previewDup = preview ? expDuplicateFor(preview.claimNo) : undefined;

  return (
    <PageBody>
      <PageHeader
        title="Finance review"
        description="Approved claims arrive here. Verify receipts, query back anything missing, and release the money — with the October 2026 payroll or as a direct NEFT payment."
      />

      {loading ? (
        <>
          <CardsSkeleton count={4} />
          <TableSkeleton />
        </>
      ) : (
        <>
          <StatRow cols={4}>
            <StatTile label="Awaiting verification" value={num(pending.length)} hint={inr(sum(pending.map((r) => r.total)), { decimals: false })} icon={FileSearch} onClick={() => setStatusFilter("pending")} />
            <StatTile label="Verified, ready to release" value={num(verified.length)} hint={inr(sum(verified.map((r) => r.total)), { decimals: false })} icon={BadgeCheck} tone="accent" onClick={() => setStatusFilter("verified")} />
            <StatTile label="Released to October payroll" value={inrCompact(sum(toPayroll.map((r) => r.total)))} hint={`${toPayroll.length} claims`} icon={Wallet} onClick={() => setStatusFilter("released_payroll")} />
            <StatTile label="Direct payments scheduled" value={inrCompact(sum(direct.map((r) => r.total)))} hint={`${direct.length} claims · NEFT 18 Sep`} icon={Landmark} onClick={() => setStatusFilter("released_direct")} />
          </StatRow>

          <DuplicatePanel
            flags={openFlags}
            canAct={can("workplace.expense_finance", "E")}
            onHold={hold}
            onReview={(f) => setPreview(rows.find((r) => r.id === f.claimNo) ?? null)}
            onDismiss={dismiss}
          />

          <DataTable<ExpFinanceRow>
            columns={columns}
            data={data}
            getRowId={(r) => r.id}
            searchKeys={["claimNo", "employeeName", "employeeCode", "purpose", "department"]}
            searchPlaceholder="Search claim, employee or purpose…"
            exportName="expense-finance-review"
            enableSelection={can("workplace.expense_finance", "E")}
            onRowClick={setPreview}
            rowTone={(r) => (r.status === "on_hold" ? "danger" : expDuplicateFor(r.claimNo) && !dismissed.has(r.claimNo) ? "warning" : undefined)}
            emptyIcon={ShieldAlert}
            emptyTitle="No claim in this state"
            emptyDescription="Pick another status, or clear the filter to see the whole review queue."
            emptyAction={<Button variant="outline" size="sm" onClick={() => setStatusFilter("all")}>Clear filter</Button>}
            filters={<FilterSelect label="Status" value={statusFilter} onValueChange={setStatusFilter} allLabel="All" width="w-[220px]" options={STATUS_OPTIONS} />}
            bulkActions={(sel, clear) => (
              <>
                <Gated menuKey="workplace.expense_finance" action="E">
                  <Button size="sm" variant="outline" onClick={() => { verify(sel.map((r) => r.id)); clear(); }}>
                    <BadgeCheck /> Verify
                  </Button>
                </Gated>
                <Gated menuKey="workplace.expense_finance" action="A">
                  <Button size="sm" variant="outline" onClick={() => setBulkRelease({ rows: sel, mode: "payroll", clear })}>
                    <Wallet /> Release to payroll
                  </Button>
                </Gated>
                <Gated menuKey="workplace.expense_finance" action="A">
                  <Button size="sm" onClick={() => setBulkRelease({ rows: sel, mode: "direct", clear })}>
                    <Landmark /> Pay directly
                  </Button>
                </Gated>
              </>
            )}
          />

          <PayoutBatches rows={rows} />
        </>
      )}

      <ClaimSheet
        claim={preview?.claim ?? null}
        onOpenChange={(v) => !v && setPreview(null)}
        flaggedLineId={previewDup && !dismissed.has(previewDup.claimNo) ? previewDup.lineId : undefined}
        flaggedAgainst={previewDup?.duplicateOf}
        footer={
          preview && (preview.status === "pending" || preview.status === "queried") && (
            <>
              <Gated menuKey="workplace.expense_finance" action="E">
                <Button variant="outline" onClick={() => setQuery(preview)}>Query back</Button>
              </Gated>
              <Gated menuKey="workplace.expense_finance" action="E">
                <Button onClick={() => { verify([preview.id]); setPreview(null); }}>
                  <BadgeCheck /> Verify
                </Button>
              </Gated>
            </>
          )
        }
      />

      <DecisionDialog
        open={!!query}
        onOpenChange={(v) => !v && setQuery(null)}
        destructive={false}
        title={`Query back ${query?.claimNo ?? ""}`}
        description={`${query?.employeeName ?? ""} gets your question and the claim waits until they respond. Nothing is paid meanwhile.`}
        confirmLabel="Send query"
        placeholder="What is missing or unclear on this claim?"
        onConfirm={(comment) => {
          if (!query) return;
          const undo = patch([query.id], (r) => ({ ...r, status: "queried", note: comment }));
          mockAction(`Queried ${query.claimNo}`, { description: `Sent to ${query.employeeName}.`, undo });
          setPreview(null);
        }}
      />

      <ConfirmDialog
        open={!!bulkRelease}
        onOpenChange={(v) => !v && setBulkRelease(null)}
        title={bulkRelease?.mode === "payroll" ? "Release to the October 2026 payroll?" : "Pay directly in the 18 Sep NEFT batch?"}
        description={
          bulkRelease &&
          `${bulkRelease.rows.filter((r) => r.status === "verified").length} of ${bulkRelease.rows.length} selected claims are verified, totalling ${inr(
            sum(bulkRelease.rows.filter((r) => r.status === "verified").map((r) => r.total)),
            { decimals: false },
          )}. Unverified claims are skipped.`
        }
        confirmLabel="Release"
        onConfirm={() => {
          if (!bulkRelease) return;
          release(bulkRelease.rows.map((r) => r.id), bulkRelease.mode);
          bulkRelease.clear();
        }}
      />
    </PageBody>
  );
}
