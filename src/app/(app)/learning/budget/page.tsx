"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Check, IndianRupee, PiggyBank, Receipt, Wallet, X } from "lucide-react";
import { fmtDate, inr, inrCompact, pct } from "@/lib/format";
import { employeeName } from "@/mock/employees";
import { deptName } from "@/mock/org";
import { BUDGET_REQUESTS, TRAINING_BUDGET, type BudgetRequest, type DeptBudget } from "@/mock/engage";
import { mockAction } from "@/components/app-state";
import { BarCompareChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { DataTable, NumCell } from "@/components/data-table";
import { PersonCell } from "@/components/people/person-cell";
import { DecisionDialog, MiniBar } from "@/components/engage/kit";
import { CardsSkeleton, ChartSkeleton, Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";

const used = (b: DeptBudget) => b.spent + b.committed;

export default function TrainingBudgetPage() {
  const loading = useFakeLoad();
  const [budgets, setBudgets] = React.useState<DeptBudget[]>(TRAINING_BUDGET);
  const [requests, setRequests] = React.useState<BudgetRequest[]>(BUDGET_REQUESTS);
  const [rejecting, setRejecting] = React.useState<BudgetRequest | null>(null);

  const totals = budgets.reduce(
    (a, b) => ({ allocated: a.allocated + b.allocated, spent: a.spent + b.spent, committed: a.committed + b.committed, headcount: a.headcount + b.headcount }),
    { allocated: 0, spent: 0, committed: 0, headcount: 0 },
  );
  const available = totals.allocated - totals.spent - totals.committed;
  const overDepts = budgets.filter((b) => used(b) > b.allocated);
  const budgetOf = (deptId: string) => budgets.find((b) => b.departmentId === deptId)!;
  const overBy = (r: BudgetRequest) => {
    const b = budgetOf(r.departmentId);
    return used(b) + r.amount - b.allocated;
  };

  const approve = (r: BudgetRequest) => {
    setRequests((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: "approved" } : x)));
    setBudgets((prev) => prev.map((b) => (b.departmentId === r.departmentId ? { ...b, committed: b.committed + r.amount } : b)));
    const over = overBy(r);
    mockAction(`Approved — ${inr(r.amount)}`, {
      description: over > 0 ? `${deptName(r.departmentId)} is now ${inr(over)} over its L&D budget. Finance has been notified.` : `${r.item}. Committed against ${deptName(r.departmentId)}'s budget.`,
      tone: over > 0 ? "warning" : "success",
    });
  };

  const columns = React.useMemo<ColumnDef<DeptBudget, unknown>[]>(
    () => [
      { accessorKey: "department", header: "Department", cell: ({ row }) => <span className="text-xs font-medium">{row.original.department}</span> },
      { accessorKey: "headcount", header: "Headcount", cell: ({ row }) => <NumCell>{row.original.headcount}</NumCell> },
      { accessorKey: "allocated", header: "Allocated", cell: ({ row }) => <NumCell>{inr(row.original.allocated)}</NumCell> },
      { accessorKey: "spent", header: "Spent", cell: ({ row }) => <NumCell>{inr(row.original.spent)}</NumCell> },
      { accessorKey: "committed", header: "Committed", cell: ({ row }) => <NumCell>{inr(row.original.committed)}</NumCell> },
      {
        id: "remaining",
        accessorFn: (r) => r.allocated - used(r),
        header: "Remaining",
        cell: ({ row }) => {
          const rem = row.original.allocated - used(row.original);
          return <NumCell className={rem < 0 ? "text-destructive-fg" : undefined}>{rem < 0 ? `−${inr(-rem)}` : inr(rem)}</NumCell>;
        },
      },
      { id: "perHead", accessorFn: (r) => r.spent / r.headcount, header: "Spent per head", cell: ({ row }) => <NumCell>{inr(Math.round(row.original.spent / row.original.headcount))}</NumCell> },
      {
        id: "util",
        accessorFn: (r) => used(r) / r.allocated,
        header: "Utilisation",
        cell: ({ row }) => {
          const u = (used(row.original) / row.original.allocated) * 100;
          return <MiniBar value={Math.min(u, 100)} label={pct(u, 0)} tone={u > 100 ? "danger" : u > 85 ? "warning" : "accent"} />;
        },
      },
    ],
    [],
  );

  const reqColumns = React.useMemo<ColumnDef<BudgetRequest, unknown>[]>(
    () => [
      { id: "who", accessorFn: (r) => employeeName(r.employeeCode), header: "Requested by", cell: ({ row }) => <PersonCell name={employeeName(row.original.employeeCode)} code={row.original.employeeCode} subtitle={deptName(row.original.departmentId)} /> },
      {
        accessorKey: "item",
        header: "Item",
        cell: ({ row }) => (
          <div className="flex max-w-[360px] flex-col text-xs">
            <span className="font-medium">{row.original.item}</span>
            <span className="text-muted-foreground">{row.original.justification}</span>
          </div>
        ),
      },
      { accessorKey: "amount", header: "Amount", cell: ({ row }) => <NumCell>{inr(row.original.amount)}</NumCell> },
      { accessorKey: "requestedOn", header: "Requested", cell: ({ row }) => <span className="text-xs">{fmtDate(row.original.requestedOn)}</span> },
      {
        id: "impact",
        header: "Budget impact",
        cell: ({ row }) => {
          if (row.original.status !== "pending") return <span className="text-xs text-muted-foreground">—</span>;
          const over = overBy(row.original);
          return over > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs text-destructive-fg">
              <AlertTriangle className="size-3.5" aria-hidden /> Over budget by {inr(over)}
            </span>
          ) : (
            <span className="text-xs text-success-fg">Within budget · {inr(-over)} left after</span>
          );
        },
      },
      { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        id: "__a",
        header: "",
        enableHiding: false,
        cell: ({ row }) =>
          row.original.status === "pending" ? (
            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              <Gated menuKey="growth.budget" action="E">
                <Button size="sm" variant="outline" onClick={() => setRejecting(row.original)}>
                  <X /> Reject
                </Button>
              </Gated>
              <Gated menuKey="growth.budget" action="E">
                <Button size="sm" onClick={() => approve(row.original)}>
                  <Check /> {overBy(row.original) > 0 ? "Approve over budget" : "Approve"}
                </Button>
              </Gated>
            </div>
          ) : null,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- overBy/approve read the latest budgets
    [budgets],
  );

  return (
    <PageBody>
      <PageHeader
        title="Training Budget"
        description="FY 2026-27 learning & development budget by department — allocated, spent and committed (approved but not yet invoiced). Requests that would exceed a department's budget need People Ops approval."
      />

      {loading ? (
        <>
          <CardsSkeleton />
          <ChartSkeleton />
          <TableSkeleton />
        </>
      ) : (
        <>
          <StatRow>
            <StatTile label="Allocated" value={inrCompact(totals.allocated)} icon={Wallet} hint={`${inr(Math.round(totals.allocated / totals.headcount))} per head`} />
            <StatTile label="Spent" value={inrCompact(totals.spent)} icon={Receipt} hint={`${pct((totals.spent / totals.allocated) * 100, 0)} of allocation`} />
            <StatTile label="Committed" value={inrCompact(totals.committed)} icon={IndianRupee} hint="Approved, not yet invoiced" />
            <StatTile
              label="Available"
              value={inrCompact(available)}
              icon={PiggyBank}
              tone={overDepts.length ? "warning" : "good"}
              hint={overDepts.length ? `${overDepts.map((d) => d.department).join(", ")} over budget` : "Every department within budget"}
            />
          </StatRow>

          <BarCompareChart
            title="Allocated vs spent vs committed"
            description="By department, in rupees"
            data={budgets.map((b) => ({ department: b.department, allocated: b.allocated, spent: b.spent, committed: b.committed }))}
            xKey="department"
            series={[
              { key: "allocated", label: "Allocated" },
              { key: "spent", label: "Spent" },
              { key: "committed", label: "Committed" },
            ]}
            valueFormat={inr}
            tickFormat={inrCompact}
            height={280}
          />

          <Section title="Requests awaiting approval" description="Approving commits the amount against the department's budget immediately.">
            {requests.length === 0 ? (
              <EmptyState icon={Receipt} title="No budget requests" description="Requests from managers appear here." />
            ) : (
              <DataTable
                columns={reqColumns}
                data={requests}
                getRowId={(r) => r.id}
                rowTone={(r) => (r.status === "pending" && overBy(r) > 0 ? "warning" : undefined)}
                exportName="training-budget-requests"
                emptyIcon={Receipt}
                emptyTitle="No requests"
                dense
              />
            )}
          </Section>

          <Section title="By department">
            <DataTable
              columns={columns}
              data={budgets}
              getRowId={(r) => r.departmentId}
              rowTone={(r) => (used(r) > r.allocated ? "danger" : undefined)}
              exportName="training-budget"
              emptyIcon={Wallet}
              emptyTitle="No budgets set"
            />
          </Section>
        </>
      )}

      <DecisionDialog
        open={!!rejecting}
        onOpenChange={(v) => !v && setRejecting(null)}
        title={`Reject ${rejecting ? inr(rejecting.amount) : ""} request?`}
        description={rejecting ? `${rejecting.item} — requested by ${employeeName(rejecting.employeeCode)}.` : undefined}
        confirmLabel="Reject request"
        commentLabel="Reason"
        onConfirm={(reason) => {
          if (!rejecting) return;
          setRequests((prev) => prev.map((x) => (x.id === rejecting.id ? { ...x, status: "rejected" } : x)));
          mockAction("Request rejected", { description: reason, tone: "warning" });
        }}
      />
    </PageBody>
  );
}
