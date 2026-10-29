"use client";

import * as React from "react";
import Link from "next/link";
import { Check, CheckCheck, Eye, FilePen, FileText, Plus, Receipt, Send, Trash2, TriangleAlert, Wallet, X } from "lucide-react";
import { sum } from "@/lib/utils";
import { inr, inrCompact, num } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import { EXP_ALL_CLAIMS } from "@/mock/finance-expense";
import { EXPENSE_CATEGORIES, EXPENSE_POLICY, type ExpenseClaim } from "@/mock/workplace";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Hint, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/overlays";
import { BarCompareChart, DonutChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { ExpenseClaimDetail } from "@/components/workplace/expense-claim-detail";
import { ExpenseClaimDialog, type ClaimSaveMode } from "@/components/workplace/expense-claim-dialog";
import { ClaimFilters, claimColumns } from "@/components/workplace/expense-claim-columns";

/* ============================================================================
   /expenses — persona-aware. Everyone lands on their own claims (my.expenses);
   a persona holding workplace.expenses also gets the approval queue and the
   tenant-wide register, every admin control gated on that key. Reads the base
   fifty claims plus the W5 additions (EXP_ALL_CLAIMS already contains both).
   ========================================================================== */

type Batch = { rows: ExpenseClaim[]; clear?: () => void };

export default function ExpensesPage() {
  const loading = useFakeLoad();
  const { persona, can, markDecided } = useApp();
  const isAdmin = can("workplace.expenses", "V");

  const [claims, setClaims] = React.useState<ExpenseClaim[]>(EXP_ALL_CLAIMS);
  const [tab, setTab] = React.useState(isAdmin ? "queue" : "mine");
  const [status, setStatus] = React.useState("all");
  const [onlyBreaches, setOnlyBreaches] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [compose, setCompose] = React.useState<{ open: boolean; draft: ExpenseClaim | null }>({ open: false, draft: null });
  const [approving, setApproving] = React.useState<Batch | null>(null);
  const [rejecting, setRejecting] = React.useState<Batch | null>(null);
  const [withdrawing, setWithdrawing] = React.useState<ExpenseClaim | null>(null);

  /* A persona switch can take the admin tabs away — fall back to My claims. */
  const activeTab = isAdmin || tab === "mine" || tab === "policy" ? tab : "mine";
  const me = persona.employeeId;
  const detail = claims.find((c) => c.id === detailId) ?? null;

  const mine = React.useMemo(() => claims.filter((c) => c.employeeCode === me), [claims, me]);
  /* Nobody approves their own claim. */
  const queue = React.useMemo(
    () => claims.filter((c) => c.status === "submitted" && c.employeeCode !== me),
    [claims, me],
  );
  const filterRows = (list: ExpenseClaim[]) =>
    list.filter((c) => (status === "all" || c.status === status) && (!onlyBreaches || c.hasViolation));

  /* ----------------------------------------------------------- mutations */

  const saveClaim = (claim: ExpenseClaim, mode: ClaimSaveMode) => {
    setClaims((cs) => (cs.some((c) => c.id === claim.id) ? cs.map((c) => (c.id === claim.id ? claim : c)) : [claim, ...cs]));
    mockAction(mode === "submit" ? `Claim ${claim.claimNo} submitted` : `Draft ${claim.claimNo} saved`, {
      description:
        mode === "submit"
          ? `${inr(claim.total, { decimals: false })} across ${claim.lines.length} line${claim.lines.length === 1 ? "" : "s"} · routed to ${claim.approverName}.`
          : "Only you can see a draft. Submit it when the receipts are complete.",
    });
  };

  const submitDraft = (claim: ExpenseClaim) => {
    const before = claims;
    setClaims((cs) =>
      cs.map((c) => (c.id === claim.id ? { ...c, status: "submitted", submittedOn: `${DEMO_TODAY}T14:35:00` } : c)),
    );
    mockAction(`Claim ${claim.claimNo} submitted`, {
      description: `${inr(claim.total, { decimals: false })} · routed to ${claim.approverName}.`,
      undo: () => setClaims(before),
    });
  };

  const withdraw = (claim: ExpenseClaim) => {
    const before = claims;
    setClaims((cs) => cs.map((c) => (c.id === claim.id ? { ...c, status: "cancelled" } : c)));
    setDetailId(null);
    mockAction(`Draft ${claim.claimNo} withdrawn`, {
      description: "It stays on your list as Withdrawn and never reaches an approver.",
      undo: () => setClaims(before),
    });
  };

  const decide = (batch: Batch, approve: boolean, comment: string) => {
    const ids = new Set(batch.rows.map((r) => r.id));
    const before = claims;
    setClaims((cs) =>
      cs.map((c) =>
        ids.has(c.id)
          ? {
              ...c,
              status: approve ? "approved" : "rejected",
              decidedOn: `${DEMO_TODAY}T14:35:00`,
              decisionNote: approve
                ? c.hasViolation
                  ? "Approved with an exception noted against the over-limit line."
                  : null
                : `Rejected — ${comment}`,
              approverName: persona.name,
            }
          : c,
      ),
    );
    /* Only items that were in this persona's own inbox move the badge. */
    const fromInbox = batch.rows.filter((r) => r.approverCode === me).map((r) => `expense:${r.id}`);
    markDecided(fromInbox);
    batch.clear?.();
    setDetailId(null);
    const one = batch.rows.length === 1 ? batch.rows[0] : null;
    mockAction(
      approve
        ? one ? `Approved ${one.claimNo}` : `Approved ${batch.rows.length} claims`
        : one ? `Rejected ${one.claimNo}` : `Rejected ${batch.rows.length} claims`,
      {
        description: approve
          ? `${inr(sum(batch.rows.map((r) => r.total)), { decimals: false })} moves to finance review.`
          : `Reason sent to ${one ? one.employeeName : "each claimant"}: “${comment}”`,
        tone: approve ? "success" : "warning",
        undo: () => {
          setClaims(before);
          markDecided(fromInbox, false);
        },
      },
    );
  };

  /* -------------------------------------------------------------- columns */

  const myColumns = React.useMemo(
    () =>
      claimColumns({
        showEmployee: false,
        actions: (c) => (
          <>
            <ViewButton claim={c} onView={() => setDetailId(c.id)} />
            {c.status === "draft" && (
              <>
                <Gated menuKey="my.expenses" action="E">
                  <Button size="icon-sm" variant="ghost" aria-label={`Edit ${c.claimNo}`} onClick={() => setCompose({ open: true, draft: c })}>
                    <FilePen />
                  </Button>
                </Gated>
                <Gated menuKey="my.expenses" action="D">
                  <Button size="icon-sm" variant="ghost" aria-label={`Withdraw ${c.claimNo}`} onClick={() => setWithdrawing(c)}>
                    <Trash2 />
                  </Button>
                </Gated>
              </>
            )}
          </>
        ),
      }),
    [],
  );

  const queueColumns = React.useMemo(
    () =>
      claimColumns({
        showEmployee: true,
        actions: (c) => (
          <>
            <ViewButton claim={c} onView={() => setDetailId(c.id)} />
            <Gated menuKey="workplace.expenses" action="A">
              <Button size="icon-sm" variant="ghost" aria-label={`Reject ${c.claimNo}`} onClick={() => setRejecting({ rows: [c] })}>
                <X />
              </Button>
            </Gated>
            <Gated menuKey="workplace.expenses" action="A">
              <Button size="icon-sm" variant="soft" aria-label={`Approve ${c.claimNo}`} onClick={() => setApproving({ rows: [c] })}>
                <Check />
              </Button>
            </Gated>
          </>
        ),
      }),
    [],
  );

  const registerColumns = React.useMemo(
    () => claimColumns({ showEmployee: true, actions: (c) => <ViewButton claim={c} onView={() => setDetailId(c.id)} /> }),
    [],
  );

  /* ----------------------------------------------------------- figures */

  const stats = React.useMemo(() => {
    const own = (s: ExpenseClaim["status"][]) => mine.filter((c) => s.includes(c.status));
    return {
      pending: queue.length,
      pendingValue: sum(queue.map((c) => c.total)),
      approved: claims.filter((c) => c.status === "approved" || c.status === "completed").length,
      breaches: claims.filter((c) => c.hasViolation).length,
      myDrafts: own(["draft"]).length,
      myPending: own(["submitted"]),
      myToBePaid: own(["approved"]),
      myReimbursed: own(["completed"]),
    };
  }, [claims, mine, queue]);

  const byCategory = React.useMemo(
    () =>
      EXPENSE_CATEGORIES.map((category) => {
        const lines = claims.flatMap((c) => c.lines).filter((l) => l.category === category);
        return {
          name: category,
          claimed: Math.round(sum(lines.map((l) => l.amount))),
          breaches: Math.round(sum(lines.map((l) => l.excess))),
        };
      }),
    [claims],
  );

  /* ---------------------------------------------------------------- render */

  const header = (
    <PageHeader
      title={isAdmin ? "Expenses" : "My expenses"}
      description={
        isAdmin
          ? "Approve claims, see every claim in the tenant, and file your own — policy breaches are flagged on the exact line that caused them."
          : "Claim reimbursement for work spend, track each claim to payout, and see any policy breach on the line that caused it."
      }
      actions={
        <Gated menuKey="my.expenses" action="C">
          <Button size="sm" onClick={() => setCompose({ open: true, draft: null })}>
            <Plus /> New claim
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
    <ClaimFilters status={status} setStatus={setStatus} onlyBreaches={onlyBreaches} setOnlyBreaches={setOnlyBreaches} />
  );

  return (
    <PageBody>
      {header}

      {isAdmin ? (
        <StatRow cols={4}>
          <StatTile
            label="Awaiting approval"
            value={num(stats.pending)}
            icon={Receipt}
            tone={stats.pending > 0 ? "warning" : "good"}
            hint={inr(stats.pendingValue, { decimals: false })}
            onClick={() => setTab("queue")}
          />
          <StatTile
            label="Approved claims"
            value={num(stats.approved)}
            icon={Check}
            tone="good"
            onClick={() => {
              setStatus("approved");
              setTab("all");
            }}
          />
          <StatTile
            label="Policy breaches"
            value={num(stats.breaches)}
            icon={TriangleAlert}
            tone={stats.breaches > 0 ? "critical" : "good"}
            hint="Claims with at least one over-limit line"
            onClick={() => {
              setOnlyBreaches(true);
              setTab("all");
            }}
          />
          <StatTile
            label="My claims"
            value={num(mine.length)}
            icon={Wallet}
            hint={inr(sum(mine.map((c) => c.total)), { decimals: false })}
            onClick={() => setTab("mine")}
          />
        </StatRow>
      ) : (
        <StatRow cols={4}>
          <StatTile label="Drafts" value={num(stats.myDrafts)} icon={FilePen} hint="Not yet submitted" onClick={() => setStatus("draft")} />
          <StatTile
            label="Awaiting approval"
            value={num(stats.myPending.length)}
            icon={Send}
            tone={stats.myPending.length ? "warning" : "neutral"}
            hint={inr(sum(stats.myPending.map((c) => c.total)), { decimals: false })}
            onClick={() => setStatus("submitted")}
          />
          <StatTile
            label="Approved, to be paid"
            value={inrCompact(sum(stats.myToBePaid.map((c) => c.total)))}
            icon={Check}
            tone="good"
            hint="Paid with the next payroll run"
            onClick={() => setStatus("approved")}
          />
          <StatTile
            label="Reimbursed this year"
            value={inrCompact(sum(stats.myReimbursed.map((c) => c.total)))}
            icon={Wallet}
            hint={`${stats.myReimbursed.length} claim${stats.myReimbursed.length === 1 ? "" : "s"}`}
            onClick={() => setStatus("completed")}
          />
        </StatRow>
      )}

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList>
          {isAdmin && (
            <TabsTrigger value="queue">
              <CheckCheck /> Approval queue ({queue.length})
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="all">
              <Receipt /> All claims ({claims.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="mine">
            <Wallet /> My claims ({mine.length})
          </TabsTrigger>
          <TabsTrigger value="policy">
            <FileText /> Policy
          </TabsTrigger>
        </TabsList>

        {isAdmin && (
          <TabsContent value="queue" className="flex flex-col gap-3">
            {can("workplace.expense_approvals", "V") && (
              <p className="text-xs text-muted-foreground">
                Claims above the department-head or finance threshold continue through their chain in the{" "}
                <Link href="/expenses/approvals" className="font-medium text-foreground underline-offset-2 hover:underline">
                  approvals inbox
                </Link>
                .
              </p>
            )}
            <DataTable<ExpenseClaim>
              columns={queueColumns}
              data={filterRows(queue)}
              getRowId={(c) => c.id}
              searchKeys={["claimNo", "employeeName", "employeeCode", "purpose", "department"]}
              searchPlaceholder="Search claim, employee or purpose…"
              exportName="expense-approval-queue"
              canExport={can("workplace.expenses", "X")}
              enableSelection={can("workplace.expenses", "A")}
              onRowClick={(c) => setDetailId(c.id)}
              rowTone={(c) => (c.hasViolation ? "warning" : undefined)}
              filters={filters}
              emptyIcon={CheckCheck}
              emptyTitle={queue.length ? "No claim matches these filters" : "Nothing to approve"}
              emptyDescription={
                queue.length ? "Clear a filter to see the rest of the queue." : "Every submitted claim has been decided."
              }
              bulkActions={(rows, clear) => (
                <>
                  <Gated menuKey="workplace.expenses" action="A">
                    <Button size="sm" variant="outline" onClick={() => setRejecting({ rows, clear })}>
                      <X /> Reject {rows.length}
                    </Button>
                  </Gated>
                  <Gated menuKey="workplace.expenses" action="A">
                    <Button size="sm" onClick={() => setApproving({ rows, clear })}>
                      <Check /> Approve {rows.length}
                    </Button>
                  </Gated>
                </>
              )}
            />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="all" className="flex flex-col gap-3">
            <DataTable<ExpenseClaim>
              columns={registerColumns}
              data={filterRows(claims)}
              getRowId={(c) => c.id}
              searchKeys={["claimNo", "employeeName", "employeeCode", "purpose", "department"]}
              searchPlaceholder="Search claim, employee or purpose…"
              exportName="expense-claims"
              canExport={can("workplace.expenses", "X")}
              onRowClick={(c) => setDetailId(c.id)}
              rowTone={(c) => (c.hasViolation ? "warning" : undefined)}
              filters={filters}
              emptyIcon={Receipt}
              emptyTitle="No claim matches these filters"
              emptyDescription="Clear the status or policy filter to widen the register."
            />
            <div className="grid gap-3 lg:grid-cols-2">
              <DonutChart
                title="Spend by category"
                description="Across every claim in the tenant this financial year."
                data={byCategory.map((c) => ({ name: c.name, value: c.claimed }))}
                valueFormat={(v) => inr(v, { decimals: false })}
                centreValue={inrCompact(sum(byCategory.map((c) => c.claimed)))}
                centreLabel="claimed"
                height={260}
              />
              <BarCompareChart
                title="Claims and breaches by category"
                description="Where policy is most often exceeded."
                data={byCategory}
                xKey="name"
                series={[
                  { key: "claimed", label: "Claimed" },
                  { key: "breaches", label: "Over limit" },
                ]}
                horizontal
                height={260}
              />
            </div>
          </TabsContent>
        )}

        <TabsContent value="mine" className="flex flex-col gap-3">
          <DataTable<ExpenseClaim>
            columns={myColumns}
            data={filterRows(mine)}
            getRowId={(c) => c.id}
            searchKeys={["claimNo", "purpose"]}
            searchPlaceholder="Search claim number or purpose…"
            exportName="my-expense-claims"
            onRowClick={(c) => setDetailId(c.id)}
            rowTone={(c) => (c.hasViolation && c.status !== "cancelled" ? "warning" : undefined)}
            filters={filters}
            emptyIcon={Receipt}
            emptyTitle={mine.length ? "No claim matches these filters" : "You have not raised any claims yet"}
            emptyDescription={
              mine.length
                ? "Clear the status or policy filter to see the rest."
                : "Add a line per receipt — the claim goes to your manager and is paid with the next payroll run."
            }
          />
        </TabsContent>

        <TabsContent value="policy">
          <Section
            title="Reimbursement limits"
            description="The caps the inline warning quotes verbatim when a line goes over."
            bodyClassName="p-0"
            actions={
              can("workplace.expense_policies", "V") ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/expenses/policies">Manage policies</Link>
                </Button>
              ) : undefined
            }
          >
            <table className="w-full text-xs">
              <thead className="bg-subtle">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Category</th>
                  <th data-numeric className="px-4 py-2 text-right font-medium text-muted-foreground">Limit</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Basis</th>
                </tr>
              </thead>
              <tbody>
                {EXPENSE_POLICY.map((p) => (
                  <tr key={p.category} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 font-medium">{p.category}</td>
                    <td data-numeric className="px-4 py-2 text-right">{inr(p.limit, { decimals: false })}</td>
                    <td className="px-4 py-2 text-muted-foreground">{p.basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </TabsContent>
      </Tabs>

      {/* ------------------------------------------------- claim detail */}
      <ExpenseClaimDetail
        claim={detail}
        onOpenChange={(v) => !v && setDetailId(null)}
        footer={detail && detailActions(detail)}
      />

      <ExpenseClaimDialog
        open={compose.open}
        onOpenChange={(open) => setCompose((c) => ({ ...c, open }))}
        employeeCode={me}
        claim={compose.draft}
        onSave={saveClaim}
      />

      <ConfirmDialog
        open={!!approving}
        onOpenChange={(v) => !v && setApproving(null)}
        title={approving?.rows.length === 1 ? `Approve ${approving.rows[0].claimNo}?` : `Approve ${approving?.rows.length ?? 0} claims?`}
        description={
          approving &&
          `Total ${inr(sum(approving.rows.map((r) => r.total)), { decimals: false })}. ${
            approving.rows.some((r) => r.hasViolation)
              ? "Over-limit lines are approved with an exception recorded against each."
              : "Every line is within policy."
          }`
        }
        confirmLabel="Approve"
        onConfirm={() => approving && decide(approving, true, "")}
      />

      <ConfirmDialog
        open={!!rejecting}
        onOpenChange={(v) => !v && setRejecting(null)}
        title={rejecting?.rows.length === 1 ? `Reject ${rejecting.rows[0].claimNo}?` : `Reject ${rejecting?.rows.length ?? 0} claims?`}
        description="The claimant is notified with your reason and can correct and resubmit."
        confirmLabel="Reject"
        destructive
        comment={{ label: "Reason for rejection", placeholder: "e.g. The hotel folio is missing — attach it and resubmit." }}
        onConfirm={(comment) => rejecting && decide(rejecting, false, comment)}
      />

      <ConfirmDialog
        open={!!withdrawing}
        onOpenChange={(v) => !v && setWithdrawing(null)}
        title={`Withdraw draft ${withdrawing?.claimNo ?? ""}?`}
        description="The draft is closed and never reaches an approver. You can raise a new claim at any time."
        confirmLabel="Withdraw draft"
        destructive
        onConfirm={() => withdrawing && withdraw(withdrawing)}
      />
    </PageBody>
  );

  /* Footer controls for the detail sheet — what this persona may do to this claim. */
  function detailActions(detail: ExpenseClaim) {
    if (detail.employeeCode === me && detail.status === "draft") {
      return (
        <>
          <Gated menuKey="my.expenses" action="D">
            <Button variant="outline" onClick={() => setWithdrawing(detail)}>
              <Trash2 /> Withdraw
            </Button>
          </Gated>
          <Gated menuKey="my.expenses" action="E">
            <Button variant="outline" onClick={() => setCompose({ open: true, draft: detail })}>
              <FilePen /> Edit
            </Button>
          </Gated>
          <Gated menuKey="my.expenses" action="E">
            <Button onClick={() => submitDraft(detail)}>
              <Send /> Submit
            </Button>
          </Gated>
        </>
      );
    }
    if (isAdmin && detail.status === "submitted" && detail.employeeCode !== me) {
      return (
        <>
          <Gated menuKey="workplace.expenses" action="A">
            <Button variant="outline" onClick={() => setRejecting({ rows: [detail] })}>
              <X /> Reject
            </Button>
          </Gated>
          <Gated menuKey="workplace.expenses" action="A">
            <Button onClick={() => setApproving({ rows: [detail] })}>
              <Check /> Approve {inr(detail.total, { decimals: false })}
            </Button>
          </Gated>
        </>
      );
    }
    return null;
  }
}

function ViewButton({ claim, onView }: { claim: ExpenseClaim; onView: () => void }) {
  return (
    <Hint text="Open the claim">
      <Button size="icon-sm" variant="ghost" aria-label={`View ${claim.claimNo}`} onClick={onView}>
        <Eye />
      </Button>
    </Hint>
  );
}
