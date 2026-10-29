"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarX2, FileUp, HandCoins, ReceiptText, Wallet } from "lucide-react";
import { sum } from "@/lib/utils";
import { fmtDate, inr, num } from "@/lib/format";
import { CURRENT_PERIOD } from "@/mock/payroll";
import {
  PAYROLL_INPUT_CUTOFF,
  PAYROLL_INPUT_LOP,
  PAYROLL_INPUT_RUN_TOTALS,
  PAYROLL_ONE_TIME_INPUTS,
  PAYROLL_REIMBURSEMENTS,
  type PayrollOneTimeInput,
  type PayrollReimbursementRow,
} from "@/mock/finance-payroll";
import { mockAction } from "@/components/app-state";
import { MoneyCell } from "@/components/finance/kit";
import { Button } from "@/components/ui/button";
import { Alert, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { DataTable, MutedCell } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { PersonCell } from "@/components/people/person-cell";
import { CardsSkeleton, Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { ImportInputsDialog } from "./import-dialog";
import { LopTab } from "./lop-tab";
import { OneTimeTab } from "./one-time-tab";

/* ============================================================================
   /payroll/inputs — the variable inputs to the September 2026 run: LOP from
   attendance + leave, one-time earnings/deductions, and reimbursements.
   Every "in the run" figure reconciles to the calculated run.
   ========================================================================== */

const reimbColumns: ColumnDef<PayrollReimbursementRow, unknown>[] = [
  { accessorKey: "claimNo", header: "Claim", cell: ({ row }) => <span className="font-mono text-xs">{row.original.claimNo}</span> },
  { accessorKey: "name", header: "Employee", cell: ({ row }) => <PersonCell name={row.original.name} code={row.original.employeeCode} /> },
  { accessorKey: "department", header: "Department", cell: ({ row }) => <MutedCell>{row.original.department}</MutedCell> },
  { accessorKey: "purpose", header: "Purpose", cell: ({ row }) => <MutedCell>{row.original.purpose}</MutedCell> },
  { accessorKey: "approvedOn", header: "Approved", cell: ({ row }) => <MutedCell>{row.original.approvedOn ? fmtDate(row.original.approvedOn) : "—"}</MutedCell> },
  { accessorKey: "amount", header: "Amount", cell: ({ row }) => <MoneyCell value={row.original.amount} /> },
];

export default function PayrollInputsPage() {
  const loading = useFakeLoad();
  const [tab, setTab] = React.useState("lop");
  const [inputs, setInputs] = React.useState<PayrollOneTimeInput[]>(PAYROLL_ONE_TIME_INPUTS);
  const [importOpen, setImportOpen] = React.useState(false);
  const [released, setReleased] = React.useState<Set<string>>(new Set());

  const pending = inputs.filter((r) => r.status === "pending");
  const pendingNet = sum(pending.map((r) => (r.kind === "earning" ? r.amount : -r.amount)));
  const reimbTotal = sum(PAYROLL_REIMBURSEMENTS.map((r) => r.amount));
  const releasedTotal = sum(PAYROLL_REIMBURSEMENTS.filter((r) => released.has(r.claimNo)).map((r) => r.amount));

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Payroll inputs & LOP" description="Loading September 2026 inputs…" />
        <CardsSkeleton count={4} />
        <TableSkeleton rows={10} />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="Payroll inputs & LOP"
        description={`Variable inputs to the ${CURRENT_PERIOD.label} run (${CURRENT_PERIOD.runId}). Loss of pay is pulled from attendance and leave up to the ${fmtDate(PAYROLL_INPUT_CUTOFF)} cut-off; click any employee to see the days behind it.`}
        actions={
          <Gated menuKey="payroll.inputs" action="C">
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
              <FileUp /> Import CSV
            </Button>
          </Gated>
        }
      />
      <StatRow cols={4}>
        <StatTile
          label="Employees with LOP"
          value={num(PAYROLL_INPUT_LOP.length)}
          icon={CalendarX2}
          hint={`${num(PAYROLL_INPUT_RUN_TOTALS.lopDays, 1)} days · ${inr(PAYROLL_INPUT_RUN_TOTALS.lop, { decimals: false })} deducted`}
          onClick={() => setTab("lop")}
        />
        <StatTile
          label="Overtime + arrears in run"
          value={inr(PAYROLL_INPUT_RUN_TOTALS.overtime + PAYROLL_INPUT_RUN_TOTALS.arrears, { decimals: false })}
          icon={HandCoins}
          hint={`Advance recovery ${inr(PAYROLL_INPUT_RUN_TOTALS.advance, { decimals: false })}`}
          onClick={() => setTab("one-time")}
        />
        <StatTile
          label="Awaiting recalculation"
          value={num(pending.length)}
          icon={ReceiptText}
          tone={pending.length ? "warning" : "neutral"}
          hint={`Net effect ${pendingNet >= 0 ? "+" : "−"}${inr(Math.abs(pendingNet), { decimals: false })} on gross pay`}
          onClick={() => setTab("one-time")}
        />
        <StatTile
          label="Reimbursements to pay"
          value={inr(reimbTotal, { decimals: false })}
          icon={Wallet}
          hint={`${num(PAYROLL_REIMBURSEMENTS.length)} approved claims`}
          onClick={() => setTab("reimb")}
        />
      </StatRow>

      {pending.length > 0 && (
        <Alert tone="warning" title={`${num(pending.length)} manual input${pending.length === 1 ? "" : "s"} not yet in the calculated run`}>
          The run was calculated on 16 Sep 2026 at 08:40. Recalculate it from the pay run screen before locking so these
          inputs are applied.
        </Alert>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="lop">Loss of pay ({num(PAYROLL_INPUT_LOP.length)})</TabsTrigger>
          <TabsTrigger value="one-time">One-time earnings & deductions ({num(inputs.length)})</TabsTrigger>
          <TabsTrigger value="reimb">Reimbursements ({num(PAYROLL_REIMBURSEMENTS.length)})</TabsTrigger>
        </TabsList>
        <TabsContent value="lop" className="mt-3">
          <LopTab />
        </TabsContent>
        <TabsContent value="one-time" className="mt-3">
          <OneTimeTab rows={inputs} setRows={setInputs} />
        </TabsContent>
        <TabsContent value="reimb" className="mt-3 flex flex-col gap-3">
          <Alert tone="info">
            Approved expense claims are paid in a separate, non-taxable reimbursement batch on pay date ({fmtDate(CURRENT_PERIOD.payDate)}).
            They never enter gross or net salary, so the run totals are unaffected.
          </Alert>
          <DataTable<PayrollReimbursementRow>
            columns={reimbColumns}
            data={PAYROLL_REIMBURSEMENTS}
            getRowId={(r) => r.claimNo}
            searchKeys={["claimNo", "name", "purpose"]}
            searchPlaceholder="Search claim, employee or purpose…"
            exportName="reimbursements-sep-2026"
            enableSelection
            rowTone={(r) => (released.has(r.claimNo) ? "success" : undefined)}
            emptyIcon={Wallet}
            emptyTitle="No approved claims waiting to be paid"
            emptyDescription="Claims appear here once a manager and finance have approved them."
            toolbar={<span className="text-xs text-muted-foreground">Released: {inr(releasedTotal, { decimals: false })} of {inr(reimbTotal, { decimals: false })}</span>}
            bulkActions={(sel, clear) => (
              <Gated menuKey="payroll.inputs" action="E">
                <Button
                  size="sm"
                  onClick={() => {
                    const before = released;
                    setReleased((prev) => new Set([...prev, ...sel.map((r) => r.claimNo)]));
                    mockAction(`${num(sel.length)} claims added to the September reimbursement batch`, {
                      description: `${inr(sum(sel.map((r) => r.amount)), { decimals: false })} will be paid on ${fmtDate(CURRENT_PERIOD.payDate)}.`,
                      undo: () => setReleased(before),
                    });
                    clear();
                  }}
                >
                  <Wallet /> Pay with September batch
                </Button>
              </Gated>
            )}
          />
        </TabsContent>
      </Tabs>

      <ImportInputsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        startIndex={inputs.length + 1}
        onImport={(rows) => {
          setInputs((prev) => [...rows, ...prev]);
          setTab("one-time");
          mockAction(`Imported ${num(rows.length)} inputs`, { description: "They apply when the September 2026 run is recalculated." });
        }}
      />
    </PageBody>
  );
}
