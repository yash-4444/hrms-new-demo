"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { TriangleAlert } from "lucide-react";
import { fmtDate, pct } from "@/lib/format";
import { LOAN_KIND_LABEL, type Loan } from "@/mock/finance-loans";
import { MutedCell } from "@/components/data-table";
import { PersonCell } from "@/components/people/person-cell";
import { Hint } from "@/components/ui/primitives";
import { FinStatus, MoneyCell } from "@/components/finance/kit";

/** Loan status → the shared finance badge vocabulary. */
export const LOAN_STATUS_BADGE: Record<Loan["status"], string> = {
  pending_approval: "pending_approval",
  sanctioned: "sanctioned",
  active: "recovering",
  closed: "closed",
  foreclosed: "foreclosed",
  rejected: "rejected",
};

export const LOAN_STATUS_LABEL: Record<Loan["status"], string> = {
  pending_approval: "Pending approval",
  sanctioned: "Sanctioned",
  active: "Recovering",
  closed: "Closed",
  foreclosed: "Foreclosed",
  rejected: "Rejected",
};

export const loanColumns: ColumnDef<Loan, unknown>[] = [
  {
    accessorKey: "id",
    header: "Loan",
    cell: ({ row }) => (
      <span className="flex items-center gap-1.5">
        <span className="tnum font-medium">{row.original.id}</span>
        {row.original.flag && (
          <Hint text="Mis-keyed instalment — see the alert above the table">
            <TriangleAlert className="size-3.5 text-destructive-fg" aria-label="Flagged" />
          </Hint>
        )}
      </span>
    ),
  },
  {
    accessorKey: "name",
    header: "Employee",
    cell: ({ row }) => (
      <PersonCell
        name={row.original.name}
        code={row.original.employeeCode}
        subtitle={`${row.original.employeeCode} · ${row.original.department}`}
      />
    ),
  },
  {
    accessorKey: "kind",
    header: "Type",
    cell: ({ row }) => (
      <span className="text-xs">
        {LOAN_KIND_LABEL[row.original.kind]}
        <span className="block text-[11px] text-muted-foreground">
          {row.original.ratePct === 0 ? "Interest-free" : `${pct(row.original.ratePct, 2)} p.a.`}
        </span>
      </span>
    ),
  },
  {
    accessorKey: "principal",
    header: () => <span className="block text-right">Principal</span>,
    cell: ({ row }) => <MoneyCell value={row.original.principal} />,
  },
  {
    accessorKey: "emi",
    header: () => <span className="block text-right">EMI</span>,
    cell: ({ row }) => (
      <span className="block text-right">
        <MoneyCell value={row.original.emi} />
        <span className="block text-[11px] text-muted-foreground">× {row.original.tenureMonths} mo</span>
      </span>
    ),
  },
  {
    accessorKey: "septDeduction",
    header: () => <span className="block text-right">Sep 2026 deduction</span>,
    cell: ({ row }) =>
      row.original.septDeduction > 0 ? (
        <MoneyCell
          value={row.original.septDeduction}
          className={row.original.flag ? "font-semibold text-destructive-fg" : undefined}
        />
      ) : (
        <span className="block text-right text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: "outstanding",
    header: () => <span className="block text-right">Outstanding</span>,
    cell: ({ row }) => <MoneyCell value={row.original.outstanding} />,
  },
  {
    accessorKey: "sanctionedOn",
    header: "Sanctioned",
    cell: ({ row }) => <MutedCell>{row.original.sanctionedOn ? fmtDate(row.original.sanctionedOn) : "—"}</MutedCell>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <FinStatus status={LOAN_STATUS_BADGE[row.original.status]} />,
  },
];
