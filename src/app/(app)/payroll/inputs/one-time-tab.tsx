"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, ReceiptText, Trash2 } from "lucide-react";
import { sum } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { PAYROLL_INPUT_RUN_TOTALS, type PayrollOneTimeInput } from "@/mock/finance-payroll";
import { mockAction } from "@/components/app-state";
import { MoneyCell, ReconcileCheck } from "@/components/finance/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { ConfirmDialog, FilterSelect } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, MutedCell } from "@/components/data-table";
import { PersonCell } from "@/components/people/person-cell";
import { Gated } from "@/components/shell/page";
import { AddInputDialog } from "./add-input-dialog";

const includedSum = (rows: PayrollOneTimeInput[], component: string) =>
  sum(rows.filter((r) => r.status === "included" && r.component === component).map((r) => r.amount));

/** One-time earnings and deductions: run-sourced lines plus manual entries awaiting recalculation. */
export function OneTimeTab({
  rows,
  setRows,
}: {
  rows: PayrollOneTimeInput[];
  setRows: React.Dispatch<React.SetStateAction<PayrollOneTimeInput[]>>;
}) {
  const [kind, setKind] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [adding, setAdding] = React.useState(false);
  const [removing, setRemoving] = React.useState<PayrollOneTimeInput[] | null>(null);
  const shown = rows.filter((r) => (kind === "all" || r.kind === kind) && (status === "all" || r.status === status));

  const columns = React.useMemo<ColumnDef<PayrollOneTimeInput, unknown>[]>(
    () => [
      { accessorKey: "name", header: "Employee", cell: ({ row }) => <PersonCell name={row.original.name} code={row.original.employeeCode} /> },
      {
        accessorKey: "componentName",
        header: "Component",
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span className="font-medium">{row.original.componentName}</span>
            <span className="font-mono text-[11px] text-muted-foreground">{row.original.component}</span>
          </span>
        ),
      },
      {
        accessorKey: "kind",
        header: "Kind",
        cell: ({ row }) => <Badge variant={row.original.kind === "earning" ? "soft" : "outline"}>{row.original.kind === "earning" ? "Earning" : "Deduction"}</Badge>,
      },
      { accessorKey: "amount", header: "Amount", cell: ({ row }) => <MoneyCell value={row.original.kind === "deduction" ? -row.original.amount : row.original.amount} /> },
      { accessorKey: "source", header: "Source", cell: ({ row }) => <MutedCell>{row.original.source}</MutedCell> },
      { accessorKey: "enteredOn", header: "Entered", cell: ({ row }) => <MutedCell>{`${row.original.enteredBy} · ${fmtDate(row.original.enteredOn)}`}</MutedCell> },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) =>
          row.original.status === "included" ? (
            <StatusBadge status="calculated" label="In calculated run" />
          ) : (
            <StatusBadge status="pending" label="Applies on recalculation" />
          ),
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 lg:grid-cols-3">
        <ReconcileCheck label="Overtime" left={includedSum(rows, "OT")} right={PAYROLL_INPUT_RUN_TOTALS.overtime} leftLabel="Σ inputs" rightLabel="run" />
        <ReconcileCheck label="Arrears" left={includedSum(rows, "ARR")} right={PAYROLL_INPUT_RUN_TOTALS.arrears} leftLabel="Σ inputs" rightLabel="run" />
        <ReconcileCheck label="Advance recovery" left={includedSum(rows, "ADV")} right={PAYROLL_INPUT_RUN_TOTALS.advance} leftLabel="Σ inputs" rightLabel="run" />
      </div>
      <DataTable<PayrollOneTimeInput>
        columns={columns}
        data={shown}
        getRowId={(r) => r.id}
        searchKeys={["name", "employeeCode", "componentName", "source"]}
        searchPlaceholder="Search employee, component or source…"
        exportName="one-time-inputs-sep-2026"
        enableSelection
        emptyIcon={ReceiptText}
        emptyTitle="No inputs match these filters"
        emptyDescription="Clear the filters, or add a one-time earning or deduction."
        emptyAction={<Button variant="outline" size="sm" onClick={() => { setKind("all"); setStatus("all"); }}>Clear filters</Button>}
        filters={
          <>
            <FilterSelect label="Kind" value={kind} onValueChange={setKind} allLabel="All" options={[{ value: "earning", label: "Earnings" }, { value: "deduction", label: "Deductions" }]} />
            <FilterSelect label="Status" value={status} onValueChange={setStatus} allLabel="All" width="w-[200px]" options={[{ value: "included", label: "In calculated run" }, { value: "pending", label: "Applies on recalculation" }]} />
          </>
        }
        toolbar={
          <Gated menuKey="payroll.inputs" action="C">
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus /> Add input
            </Button>
          </Gated>
        }
        bulkActions={(sel, clear) => (
          <Gated menuKey="payroll.inputs" action="E">
            <Button
              variant="destructive"
              size="sm"
              disabled={sel.some((r) => r.status === "included")}
              onClick={() => {
                setRemoving(sel);
                clear();
              }}
            >
              <Trash2 /> Remove pending
            </Button>
          </Gated>
        )}
      />
      <p className="text-[11px] text-muted-foreground">
        Lines already in the calculated run are sourced from attendance, revisions and loan schedules — correct them at the
        source. Only manual entries awaiting recalculation can be removed here.
      </p>

      <AddInputDialog
        open={adding}
        onOpenChange={setAdding}
        nextIndex={rows.length + 1}
        onAdd={(r) => {
          setRows((prev) => [r, ...prev]);
          mockAction(`${r.componentName} added for ${r.name}`, { description: "Applies when the September 2026 run is recalculated." });
        }}
      />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(v) => !v && setRemoving(null)}
        destructive
        title={`Remove ${removing?.length ?? 0} pending input${removing?.length === 1 ? "" : "s"}?`}
        description="They will not be applied when the run is recalculated."
        confirmLabel="Remove"
        onConfirm={() => {
          if (!removing) return;
          const ids = new Set(removing.map((r) => r.id));
          const before = rows;
          setRows((prev) => prev.filter((r) => !ids.has(r.id)));
          mockAction(`Removed ${ids.size} pending input${ids.size === 1 ? "" : "s"}`, { undo: () => setRows(before) });
        }}
      />
    </div>
  );
}
