"use client";

import * as React from "react";
import Link from "next/link";
import { Banknote, Check, HandCoins, Landmark, Plus, TriangleAlert, Wallet } from "lucide-react";
import { inr, inrCompact, num } from "@/lib/format";
import { employeeByCode } from "@/mock/employees";
import { deptName } from "@/mock/org";
import { CURRENT_PERIOD } from "@/mock/payroll";
import {
  buildSchedule,
  emiFor,
  LOAN_KIND_LABEL,
  LOAN_MISKEYED_CODE,
  LOAN_MISKEYED_EMI,
  LOAN_RUN_ADVANCE_TOTAL,
  LOANS,
  type Loan,
} from "@/mock/finance-loans";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { FilterSelect } from "@/components/ui/overlays";
import { DataTable } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { DecisionDialog, ReconcileCheck } from "@/components/finance/kit";
import { loanColumns, LOAN_STATUS_LABEL } from "./loan-columns";
import { LoanSheet, type LoanAction } from "./loan-sheet";
import { NewLoanDialog, type NewLoanValues } from "./new-loan-dialog";

/* ============================================================================
   /payroll/loans — loans & salary advances, reconciled to the September run.
   ========================================================================== */

export default function LoansPage() {
  const loading = useFakeLoad();
  const { persona } = useApp();
  const [loans, setLoans] = React.useState<Loan[]>(LOANS);
  const [status, setStatus] = React.useState("all");
  const [kind, setKind] = React.useState("all");
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [newOpen, setNewOpen] = React.useState(false);
  const [decision, setDecision] = React.useState<{ loan: Loan; kind: "reject" | "foreclose" } | null>(null);

  const detail = loans.find((l) => l.id === detailId) ?? null;
  const filtered = loans.filter((l) => (status === "all" || l.status === status) && (kind === "all" || l.kind === kind));

  const active = loans.filter((l) => l.status === "active");
  const pending = loans.filter((l) => l.status === "pending_approval");
  const septTotal = loans.reduce((s, l) => s + l.septDeduction, 0);
  const miskeyed = loans.find((l) => l.employeeCode === LOAN_MISKEYED_CODE && l.flag);

  const patch = (id: string, p: Partial<Loan>) => setLoans((ls) => ls.map((l) => (l.id === id ? { ...l, ...p } : l)));

  const approve = (ids: string[]) => {
    ids.forEach((id) => patch(id, { status: "sanctioned", sanctionedOn: "2026-09-16", sanctionedBy: persona.name }));
    mockAction(`Sanctioned ${ids.length} loan${ids.length === 1 ? "" : "s"}`, {
      description: "Payroll can now disburse; recovery starts in the first run after disbursement.",
    });
  };

  const onAction = (loan: Loan, action: LoanAction) => {
    if (action === "approve") approve([loan.id]);
    else if (action === "disburse") {
      patch(loan.id, { status: "active", disbursedOn: "2026-09-16", outstanding: loan.principal });
      mockAction(`${loan.id} disbursed`, {
        description: `${inr(loan.principal, { decimals: false })} credited to ${loan.name}. First EMI in ${loan.schedule[0]?.label}.`,
      });
    } else setDecision({ loan, kind: action });
  };

  const addLoan = (v: NewLoanValues) => {
    const emp = employeeByCode(v.employeeCode)!;
    const emi = emiFor(v.principal, v.ratePct, v.tenureMonths);
    const id = `LN-2026-${String(loans.length + 1).padStart(3, "0")}`;
    const schedule = buildSchedule(v.principal, v.ratePct, emi, "2026-10");
    setLoans((ls) => [
      {
        id,
        employeeCode: emp.code,
        name: emp.name,
        department: deptName(emp.departmentId),
        designation: emp.designation,
        kind: v.kind,
        purpose: v.purpose,
        principal: v.principal,
        ratePct: v.ratePct,
        tenureMonths: v.tenureMonths,
        emi,
        requestedOn: "2026-09-16",
        sanctionedOn: null,
        sanctionedBy: null,
        disbursedOn: null,
        firstEmiPeriod: "2026-10",
        status: "pending_approval",
        septDeduction: 0,
        flag: null,
        schedule,
        outstanding: 0,
        emisRecovered: 0,
        medicalExempt: false,
      },
      ...ls,
    ]);
    mockAction(`${id} sent for approval`, {
      description: `${LOAN_KIND_LABEL[v.kind]} of ${inr(v.principal, { decimals: false })} for ${emp.name} · EMI ${inr(emi, { decimals: false })}.`,
    });
  };

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Loans & advances" description="Loading the loan book…" />
        <TableSkeleton />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="Loans & advances"
        description={`Salary advances and personal loans, with EMI schedules recovered through payroll. Instalments shown against ${CURRENT_PERIOD.label} are exactly the advance deductions in the open run.`}
        actions={
          <Gated menuKey="payroll.loans" action="C">
            <Button size="sm" onClick={() => setNewOpen(true)}>
              <Plus /> New loan
            </Button>
          </Gated>
        }
      />

      <StatRow cols={4}>
        <StatTile label="Active loans" value={num(active.length)} icon={HandCoins} onClick={() => setStatus("active")} />
        <StatTile
          label="Outstanding principal"
          value={inrCompact(active.reduce((s, l) => s + l.outstanding, 0))}
          icon={Landmark}
          hint="Before the September instalment"
        />
        <StatTile
          label={`${CURRENT_PERIOD.shortLabel} recovery`}
          value={inr(septTotal, { decimals: false })}
          icon={Wallet}
          tone="accent"
          hint={`${num(loans.filter((l) => l.septDeduction > 0).length)} employees in the open run`}
        />
        <StatTile
          label="Awaiting approval"
          value={num(pending.length)}
          icon={Banknote}
          tone={pending.length ? "warning" : "neutral"}
          onClick={() => setStatus("pending_approval")}
          hint={`${num(loans.filter((l) => l.status === "sanctioned").length)} sanctioned, not yet disbursed`}
        />
      </StatRow>

      <ReconcileCheck
        label="Reconciles with the run"
        leftLabel="Σ September instalments on this page"
        left={septTotal}
        rightLabel={`Σ advance deductions in ${CURRENT_PERIOD.runId}`}
        right={LOAN_RUN_ADVANCE_TOTAL}
      />

      {miskeyed && (
        <Alert
          tone="danger"
          icon={TriangleAlert}
          title={`${miskeyed.name} (${miskeyed.employeeCode}) — instalment keyed as the full balance`}
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href={`/payroll/runs/${CURRENT_PERIOD.runId}`}>Open run exception</Link>
            </Button>
          }
        >
          {miskeyed.flag} The scheduled EMI is {inr(LOAN_MISKEYED_EMI, { decimals: false })}; correcting it lifts net pay
          by {inr(miskeyed.septDeduction - LOAN_MISKEYED_EMI, { decimals: false })} and clears the negative-net exception.
        </Alert>
      )}

      <DataTable<Loan>
        columns={loanColumns}
        data={filtered}
        getRowId={(l) => l.id}
        searchKeys={["id", "name", "employeeCode", "purpose", "department"]}
        searchPlaceholder="Search loan, employee or purpose…"
        exportName="loans-and-advances"
        enableSelection
        onRowClick={(l) => setDetailId(l.id)}
        rowTone={(l) => (l.flag ? "danger" : l.status === "pending_approval" ? "warning" : undefined)}
        emptyIcon={HandCoins}
        emptyTitle="No loans match these filters"
        emptyDescription="Clear the status or type filter to see the whole loan book."
        emptyAction={
          <Button variant="outline" size="sm" onClick={() => {
              setStatus("all");
              setKind("all");
            }}>
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
              options={Object.entries(LOAN_STATUS_LABEL).map(([value, label]) => ({ value, label }))}
            />
            <FilterSelect
              label="Type"
              value={kind}
              onValueChange={setKind}
              allLabel="All types"
              width="w-[170px]"
              options={Object.entries(LOAN_KIND_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </>
        }
        bulkActions={(rows, clear) => {
          const ids = rows.filter((r) => r.status === "pending_approval").map((r) => r.id);
          return (
            <Gated menuKey="payroll.loans" action="A">
              <Button
                size="sm"
                disabled={!ids.length}
                onClick={() => {
                  approve(ids);
                  clear();
                }}
              >
                <Check /> Approve {ids.length ? `${ids.length} pending` : "pending"}
              </Button>
            </Gated>
          );
        }}
      />

      <LoanSheet loan={detail} onOpenChange={(v) => !v && setDetailId(null)} onAction={onAction} />
      <NewLoanDialog open={newOpen} onOpenChange={setNewOpen} onSubmit={addLoan} />
      <DecisionDialog
        open={!!decision}
        onOpenChange={(v) => !v && setDecision(null)}
        title={
          decision?.kind === "foreclose"
            ? `Foreclose ${decision.loan.id}?`
            : `Reject ${decision?.loan.id ?? "loan"}?`
        }
        description={
          decision?.kind === "foreclose"
            ? `The outstanding ${inr(decision.loan.outstanding, { decimals: false })} is recovered in full from the October 2026 run (or paid in by ${decision.loan.name}) and the remaining EMIs are cancelled.`
            : `${decision?.loan.name ?? "The employee"} is notified with your reason. The request cannot be reopened.`
        }
        confirmLabel={decision?.kind === "foreclose" ? "Foreclose loan" : "Reject request"}
        onConfirm={(reason) => {
          if (!decision) return;
          const { loan } = decision;
          if (decision.kind === "foreclose") {
            patch(loan.id, { status: "foreclosed", outstanding: 0 });
            mockAction(`${loan.id} foreclosed`, { description: `${inr(loan.outstanding, { decimals: false })} to recover · ${reason}` });
          } else {
            patch(loan.id, { status: "rejected" });
            mockAction(`${loan.id} rejected`, { description: reason, tone: "warning" });
          }
          setDecision(null);
        }}
      />
    </PageBody>
  );
}
