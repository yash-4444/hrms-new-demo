"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { TriangleAlert } from "lucide-react";
import { fmtDate, fmtDateShort, inr } from "@/lib/format";
import type { ExpenseClaim } from "@/mock/workplace";
import { MutedCell, NumCell } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { PersonCell } from "@/components/people/person-cell";
import { PolicyCell } from "./expense-claim-detail";

/* ============================================================================
   Columns and filters shared by every claim table on /expenses — My claims,
   the approval queue and the tenant-wide register differ only in whether the
   claimant column shows and in the row actions.
   ========================================================================== */

export function claimColumns({
  showEmployee,
  actions,
}: {
  showEmployee: boolean;
  actions: (c: ExpenseClaim) => React.ReactNode;
}): ColumnDef<ExpenseClaim, unknown>[] {
  const cols: ColumnDef<ExpenseClaim, unknown>[] = [
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
  ];
  if (showEmployee) {
    cols.push({
      accessorKey: "employeeName",
      header: "Employee",
      cell: ({ row }) => (
        <PersonCell
          name={row.original.employeeName}
          subtitle={`${row.original.employeeCode} · ${row.original.department}`}
        />
      ),
    });
  }
  cols.push(
    {
      accessorKey: "periodTo",
      header: "Period",
      cell: ({ row }) => (
        <span className="tnum whitespace-nowrap text-xs">
          {fmtDateShort(row.original.periodFrom)} – {fmtDate(row.original.periodTo)}
        </span>
      ),
    },
    {
      id: "lineCount",
      accessorFn: (c) => c.lines.length,
      header: "Lines",
      cell: ({ row }) => <MutedCell>{row.original.lines.length}</MutedCell>,
    },
    {
      accessorKey: "total",
      header: "Amount",
      cell: ({ row }) => <NumCell>{inr(row.original.total, { decimals: false })}</NumCell>,
    },
    {
      accessorKey: "violationCount",
      header: "Policy",
      cell: ({ row }) => <PolicyCell count={row.original.violationCount} />,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "submittedOn",
      header: "Submitted",
      cell: ({ row }) =>
        row.original.submittedOn ? (
          <span className="tnum whitespace-nowrap text-xs">{fmtDate(row.original.submittedOn)}</span>
        ) : (
          <MutedCell>Not submitted</MutedCell>
        ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {actions(row.original)}
        </div>
      ),
    },
  );
  return cols;
}

export function ClaimFilters({
  status,
  setStatus,
  onlyBreaches,
  setOnlyBreaches,
}: {
  status: string;
  setStatus: (v: string) => void;
  onlyBreaches: boolean;
  setOnlyBreaches: (v: boolean) => void;
}) {
  return (
    <>
      <FilterSelect
        label="Status"
        value={status}
        onValueChange={setStatus}
        allLabel="All statuses"
        width="w-[170px]"
        options={[
          { value: "draft", label: "Draft" },
          { value: "submitted", label: "Submitted" },
          { value: "approved", label: "Approved" },
          { value: "rejected", label: "Rejected" },
          { value: "completed", label: "Reimbursed" },
          { value: "cancelled", label: "Withdrawn" },
        ]}
      />
      <Button
        variant={onlyBreaches ? "default" : "outline"}
        size="sm"
        aria-pressed={onlyBreaches}
        onClick={() => setOnlyBreaches(!onlyBreaches)}
      >
        <TriangleAlert /> Policy breaches only
      </Button>
    </>
  );
}
