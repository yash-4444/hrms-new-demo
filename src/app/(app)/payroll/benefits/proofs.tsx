"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, FileCheck2, FileText, X } from "lucide-react";
import { fmtDate, inr } from "@/lib/format";
import { FBP_COMPONENTS, fbpComponent, type FbpProof } from "@/mock/finance-loans";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/primitives";
import { FilterSelect } from "@/components/ui/overlays";
import { DataTable, MutedCell } from "@/components/data-table";
import { PersonCell } from "@/components/people/person-cell";
import { StatusBadge } from "@/components/ui/status-badge";
import { Gated } from "@/components/shell/page";
import { DecisionDialog, downloadFile, MoneyCell } from "@/components/finance/kit";

/** What is reimbursable tax-free: the bill, capped at the monthly limit. */
export const payableOf = (p: FbpProof) => {
  const limit = fbpComponent(p.componentId).monthlyLimit;
  return limit === null ? p.amount : Math.min(p.amount, limit);
};

export function ProofsTab({
  rows,
  onVerify,
  onReject,
}: {
  rows: FbpProof[];
  onVerify: (ids: string[]) => void;
  onReject: (id: string, reason: string) => void;
}) {
  const [status, setStatus] = React.useState("pending");
  const [component, setComponent] = React.useState("all");
  const [rejecting, setRejecting] = React.useState<FbpProof | null>(null);

  const data = rows.filter(
    (p) => (status === "all" || p.status === status) && (component === "all" || p.componentId === component),
  );

  const columns = React.useMemo<ColumnDef<FbpProof, unknown>[]>(
    () => [
      { accessorKey: "id", header: "Proof", cell: ({ row }) => <span className="tnum font-medium">{row.original.id}</span> },
      {
        accessorKey: "name",
        header: "Employee",
        cell: ({ row }) => <PersonCell name={row.original.name} subtitle={`${row.original.employeeCode} · ${row.original.department}`} />,
      },
      { accessorKey: "component", header: "Component" },
      {
        accessorKey: "billNo",
        header: "Bill",
        cell: ({ row }) => (
          <span className="text-xs">
            <span className="tnum">{row.original.billNo}</span>
            <span className="block text-[11px] text-muted-foreground">{fmtDate(row.original.billDate)}</span>
          </span>
        ),
      },
      {
        accessorKey: "amount",
        header: () => <span className="block text-right">Bill amount</span>,
        cell: ({ row }) => <MoneyCell value={row.original.amount} />,
      },
      {
        id: "payable",
        accessorFn: payableOf,
        header: () => <span className="block text-right">Tax-free payable</span>,
        cell: ({ row }) =>
          row.original.exceedsMonthly ? (
            <Hint text={`Capped at the ${inr(fbpComponent(row.original.componentId).monthlyLimit ?? 0, { decimals: false })} monthly limit`}>
              <span tabIndex={0}>
                <MoneyCell value={payableOf(row.original)} className="text-warning-fg" />
              </span>
            </Hint>
          ) : (
            <MoneyCell value={payableOf(row.original)} />
          ),
      },
      {
        accessorKey: "file",
        header: "Receipt",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              downloadFile(row.original.file, `${row.original.component} bill ${row.original.billNo}`);
            }}
          >
            <FileText /> <span className="max-w-[140px] truncate">{row.original.file}</span>
          </Button>
        ),
      },
      { accessorKey: "submittedOn", header: "Submitted", cell: ({ row }) => <MutedCell>{fmtDate(row.original.submittedOn)}</MutedCell> },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <span className="flex flex-col gap-0.5">
            <StatusBadge status={row.original.status === "verified" ? "approved" : row.original.status} label={row.original.status === "verified" ? "Verified" : undefined} />
            {row.original.note && row.original.status === "rejected" && (
              <span className="max-w-[200px] truncate text-[11px] text-muted-foreground">{row.original.note}</span>
            )}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableHiding: false,
        cell: ({ row }) =>
          row.original.status === "pending" ? (
            <span className="flex justify-end gap-1">
              <Gated menuKey="payroll.benefits" action="A">
                <Button variant="outline" size="icon-sm" aria-label={`Reject ${row.original.id}`} onClick={(e) => {
                    e.stopPropagation();
                    setRejecting(row.original);
                  }}>
                  <X />
                </Button>
              </Gated>
              <Gated menuKey="payroll.benefits" action="A">
                <Button size="icon-sm" aria-label={`Verify ${row.original.id}`} onClick={(e) => {
                    e.stopPropagation();
                    onVerify([row.original.id]);
                  }}>
                  <Check />
                </Button>
              </Gated>
            </span>
          ) : null,
      },
    ],
    [onVerify],
  );

  return (
    <>
      <DataTable<FbpProof>
        columns={columns}
        data={data}
        getRowId={(p) => p.id}
        searchKeys={["id", "name", "employeeCode", "billNo", "component"]}
        searchPlaceholder="Search proof, employee or bill…"
        exportName="fbp-proof-queue"
        enableSelection
        rowTone={(p) => (p.exceedsMonthly && p.status === "pending" ? "warning" : undefined)}
        emptyIcon={FileCheck2}
        emptyTitle={status === "pending" ? "Verification queue is clear" : "No proofs match"}
        emptyDescription={
          status === "pending"
            ? "Every submitted bill has been verified or returned. New proofs land here as employees upload them."
            : "Change the status or component filter."
        }
        filters={
          <>
            <FilterSelect
              label="Status"
              value={status}
              onValueChange={setStatus}
              allLabel="All"
              width="w-[150px]"
              options={[
                { value: "pending", label: "Pending" },
                { value: "verified", label: "Verified" },
                { value: "rejected", label: "Rejected" },
              ]}
            />
            <FilterSelect
              label="Component"
              value={component}
              onValueChange={setComponent}
              allLabel="All"
              width="w-[210px]"
              options={FBP_COMPONENTS.filter((c) => c.id !== "meal").map((c) => ({ value: c.id, label: c.name }))}
            />
          </>
        }
        bulkActions={(sel, clear) => {
          const ids = sel.filter((p) => p.status === "pending").map((p) => p.id);
          return (
            <Gated menuKey="payroll.benefits" action="A">
              <Button
                size="sm"
                disabled={!ids.length}
                onClick={() => {
                  onVerify(ids);
                  clear();
                }}
              >
                <Check /> Verify {ids.length || ""} pending
              </Button>
            </Gated>
          );
        }}
      />
      <DecisionDialog
        open={!!rejecting}
        onOpenChange={(v) => !v && setRejecting(null)}
        title={`Reject ${rejecting?.id ?? "proof"}?`}
        description={`${rejecting?.name ?? "The employee"} is asked to re-upload. Nothing is reimbursed for this bill until a valid proof is verified.`}
        confirmLabel="Reject proof"
        placeholder="e.g. Bill is not in the employee's name / bill date is outside FY 2026-27"
        onConfirm={(reason) => {
          if (rejecting) onReject(rejecting.id, reason);
          setRejecting(null);
        }}
      />
    </>
  );
}
