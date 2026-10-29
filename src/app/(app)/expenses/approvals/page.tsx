"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, Clock, Eye, Inbox, Receipt, TriangleAlert, Wallet, X } from "lucide-react";
import { fmtDate, inr, inrCompact, num } from "@/lib/format";
import { sum } from "@/lib/utils";
import {
  EXP_APPROVAL_QUEUE,
  EXP_DEPT_HEAD_THRESHOLD,
  EXP_STAGE_LABEL,
  type ExpApprovalItem,
} from "@/mock/finance-expense";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, FilterSelect } from "@/components/ui/overlays";
import { Badge, Hint } from "@/components/ui/primitives";
import { DataTable, MutedCell } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { PersonCell } from "@/components/people/person-cell";
import { CardsSkeleton, Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { DecisionDialog, MoneyCell, useTeamScope } from "@/components/finance/kit";
import { ClaimSheet } from "./claim-sheet";

/* ============================================================================
   /expenses/approvals — the approver's queue. Managers and department heads see
   their own people; the finance controller sees every claim in flight. Approving
   moves a claim to the next step of its chain (dept head above ₹25,000 or with a
   policy breach, finance above ₹1,00,000) and, after the last step, to finance.
   ========================================================================== */

const SLA_DAYS = 2;

export default function ExpenseApprovalsPage() {
  const loading = useFakeLoad();
  const { role, persona, can } = useApp();
  const scope = useTeamScope();
  const [items, setItems] = React.useState<ExpApprovalItem[]>(EXP_APPROVAL_QUEUE);
  const [stageFilter, setStageFilter] = React.useState("all");
  const [flagFilter, setFlagFilter] = React.useState("all");
  const [preview, setPreview] = React.useState<ExpApprovalItem | null>(null);
  const [reject, setReject] = React.useState<ExpApprovalItem | null>(null);
  const [bulk, setBulk] = React.useState<{ rows: ExpApprovalItem[]; clear: () => void } | null>(null);
  const canApprove = can("workplace.expense_approvals", "A");

  const mine = React.useMemo(() => {
    const me = persona.employeeId;
    return items.filter((i) => {
      if (i.employeeCode === me) return false;
      const inScope = scope.codes?.has(i.employeeCode) || i.approverCode === me;
      if (role === "manager") return i.stage === "manager" && inScope;
      if (role === "department_head")
        return i.stage !== "finance" && (inScope || i.deptHeadCode === me);
      return true;
    });
  }, [items, role, persona.employeeId, scope]);

  const rows = mine.filter(
    (i) =>
      (stageFilter === "all" || i.stage === stageFilter) &&
      (flagFilter === "all" || (flagFilter === "flagged" ? i.hasViolation : !i.hasViolation)),
  );

  const approve = (ids: string[]) => {
    const before = items;
    const outcome: string[] = [];
    setItems((prev) =>
      prev.flatMap((i) => {
        if (!ids.includes(i.id)) return [i];
        const idx = i.chain.findIndex((s) => s.state === "current");
        if (idx < i.chain.length - 1) {
          const chain = i.chain.map((s, k) =>
            k === idx ? { ...s, state: "done" as const } : k === idx + 1 ? { ...s, state: "current" as const } : s,
          );
          outcome.push(`${i.claimNo} → ${EXP_STAGE_LABEL[chain[idx + 1].stage]} (${chain[idx + 1].approver})`);
          return [{ ...i, chain, stage: chain[idx + 1].stage }];
        }
        outcome.push(`${i.claimNo} → finance review`);
        return [];
      }),
    );
    mockAction(ids.length === 1 ? `Approved ${ids[0]}` : `Approved ${ids.length} claims`, {
      description:
        ids.length === 1
          ? `Routed: ${outcome[0] ?? "finance review"}.`
          : "Each claim moved to its next approver, or to finance review after the last step.",
      undo: () => setItems(before),
    });
  };

  const columns = React.useMemo<ColumnDef<ExpApprovalItem, unknown>[]>(
    () => [
      {
        accessorKey: "claimNo",
        header: "Claim",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="tnum font-medium">{row.original.claimNo}</p>
            <p className="max-w-[260px] truncate text-[11px] text-muted-foreground">{row.original.purpose}</p>
          </div>
        ),
      },
      {
        accessorKey: "employeeName",
        header: "Employee",
        cell: ({ row }) => (
          <PersonCell name={row.original.employeeName} subtitle={`${row.original.employeeCode} · ${row.original.department}`} />
        ),
      },
      { accessorKey: "total", header: "Amount", cell: ({ row }) => <MoneyCell value={row.original.total} /> },
      { accessorKey: "lineCount", header: "Lines", cell: ({ row }) => <MutedCell>{row.original.lineCount}</MutedCell> },
      {
        accessorKey: "violationCount",
        header: "Policy",
        cell: ({ row }) =>
          row.original.hasViolation ? (
            <Badge variant="outline" className="gap-1 border-warning/40 text-warning-fg">
              <TriangleAlert className="size-3" aria-hidden /> {row.original.violationCount} over limit
            </Badge>
          ) : (
            <MutedCell>Within policy</MutedCell>
          ),
      },
      {
        accessorKey: "stage",
        header: "Waiting on",
        cell: ({ row }) => (
          <span className="text-xs">
            {EXP_STAGE_LABEL[row.original.stage]}
            {row.original.total > EXP_DEPT_HEAD_THRESHOLD && row.original.stage === "manager" && (
              <span className="block text-[11px] text-muted-foreground">then department head</span>
            )}
          </span>
        ),
      },
      {
        accessorKey: "ageDays",
        header: "Submitted",
        cell: ({ row }) => (
          <span className="text-xs">
            {row.original.submittedOn ? fmtDate(row.original.submittedOn) : "—"}
            <span
              className={
                row.original.ageDays > SLA_DAYS ? "block text-[11px] text-warning-fg" : "block text-[11px] text-muted-foreground"
              }
            >
              {row.original.ageDays} day{row.original.ageDays === 1 ? "" : "s"} waiting
            </span>
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Hint text="Preview receipts">
              <Button size="icon-sm" variant="ghost" aria-label={`Preview ${row.original.claimNo}`} onClick={() => setPreview(row.original)}>
                <Eye />
              </Button>
            </Hint>
            <Gated menuKey="workplace.expense_approvals" action="A">
              <Button size="icon-sm" variant="ghost" aria-label={`Reject ${row.original.claimNo}`} onClick={() => setReject(row.original)}>
                <X />
              </Button>
            </Gated>
            <Gated menuKey="workplace.expense_approvals" action="A">
              <Button size="icon-sm" variant="soft" aria-label={`Approve ${row.original.claimNo}`} onClick={() => approve([row.original.id])}>
                <Check />
              </Button>
            </Gated>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items],
  );

  const overdue = mine.filter((i) => i.ageDays > SLA_DAYS).length;
  const flagged = mine.filter((i) => i.hasViolation).length;
  const scopeText =
    role === "manager" || role === "department_head"
      ? `Showing ${scope.label}.`
      : "Showing every claim in flight across the tenant.";

  return (
    <PageBody>
      <PageHeader
        title="Expense approvals"
        description={`Review receipts, check policy flags and approve or reject. Claims above ${inr(EXP_DEPT_HEAD_THRESHOLD, { decimals: false })}, or with a line over its limit, also need the department head. ${scopeText}`}
      />

      {loading ? (
        <>
          <CardsSkeleton count={4} />
          <TableSkeleton />
        </>
      ) : (
        <>
          <StatRow cols={4}>
            <StatTile label="In your queue" value={num(mine.length)} icon={Inbox} onClick={() => setStageFilter("all")} />
            <StatTile label="Value awaiting decision" value={inrCompact(sum(mine.map((i) => i.total)))} icon={Wallet} tone="accent" />
            <StatTile
              label="With policy violations"
              value={num(flagged)}
              icon={TriangleAlert}
              tone={flagged ? "warning" : "neutral"}
              onClick={() => setFlagFilter("flagged")}
              hint="Filter to flagged claims"
            />
            <StatTile label={`Past the ${SLA_DAYS}-day SLA`} value={num(overdue)} icon={Clock} tone={overdue ? "critical" : "neutral"} />
          </StatRow>

          <DataTable<ExpApprovalItem>
            columns={columns}
            data={rows}
            getRowId={(r) => r.id}
            searchKeys={["claimNo", "employeeName", "employeeCode", "purpose", "department"]}
            searchPlaceholder="Search claim, employee or purpose…"
            exportName="expense-approvals"
            enableSelection={canApprove}
            onRowClick={setPreview}
            rowTone={(r) => (r.hasViolation ? "warning" : undefined)}
            emptyIcon={Receipt}
            emptyTitle={mine.length ? "No claim matches these filters" : "Your approval queue is clear"}
            emptyDescription={
              mine.length
                ? "Clear the stage or policy filter to see the rest of the queue."
                : "New claims from your people land here as soon as they are submitted."
            }
            filters={
              <>
                <FilterSelect
                  label="Waiting on"
                  value={stageFilter}
                  onValueChange={setStageFilter}
                  allLabel="Any step"
                  width="w-[200px]"
                  options={(["manager", "dept_head", "finance"] as const).map((s) => ({ value: s, label: EXP_STAGE_LABEL[s] }))}
                />
                <FilterSelect
                  label="Policy"
                  value={flagFilter}
                  onValueChange={setFlagFilter}
                  allLabel="All claims"
                  width="w-[170px]"
                  options={[
                    { value: "flagged", label: "Over limit" },
                    { value: "clean", label: "Within policy" },
                  ]}
                />
              </>
            }
            bulkActions={(sel, clear) => (
              <Gated menuKey="workplace.expense_approvals" action="A">
                <Button size="sm" onClick={() => setBulk({ rows: sel, clear })}>
                  <Check /> Approve {sel.length}
                </Button>
              </Gated>
            )}
          />
        </>
      )}

      <ClaimSheet
        claim={preview}
        chain={preview?.chain}
        onOpenChange={(v) => !v && setPreview(null)}
        footer={
          preview && (
            <>
              <Gated menuKey="workplace.expense_approvals" action="A">
                <Button variant="outline" onClick={() => setReject(preview)}>
                  <X /> Reject
                </Button>
              </Gated>
              <Gated menuKey="workplace.expense_approvals" action="A">
                <Button
                  onClick={() => {
                    approve([preview.id]);
                    setPreview(null);
                  }}
                >
                  <Check /> Approve
                </Button>
              </Gated>
            </>
          )
        }
      />

      <DecisionDialog
        open={!!reject}
        onOpenChange={(v) => !v && setReject(null)}
        title={`Reject ${reject?.claimNo ?? ""}?`}
        description={`${reject?.employeeName ?? ""} is notified with your reason and can correct and resubmit the claim.`}
        confirmLabel="Reject claim"
        onConfirm={(comment) => {
          if (!reject) return;
          const before = items;
          setItems((prev) => prev.filter((i) => i.id !== reject.id));
          mockAction(`Rejected ${reject.claimNo}`, { description: `Reason sent to ${reject.employeeName}: “${comment}”`, undo: () => setItems(before) });
          setPreview(null);
        }}
      />

      <ConfirmDialog
        open={!!bulk}
        onOpenChange={(v) => !v && setBulk(null)}
        title={`Approve ${bulk?.rows.length ?? 0} claims?`}
        description={
          bulk &&
          `Total ${inr(sum(bulk.rows.map((r) => r.total)), { decimals: false })}. ${
            bulk.rows.filter((r) => r.hasViolation).length
              ? `${bulk.rows.filter((r) => r.hasViolation).length} of them carry a policy violation — approving records an exception against each over-limit line.`
              : "All selected claims are within policy."
          }`
        }
        confirmLabel="Approve all"
        onConfirm={() => {
          if (!bulk) return;
          approve(bulk.rows.map((r) => r.id));
          bulk.clear();
        }}
      />
    </PageBody>
  );
}
