"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, Mail, MoreHorizontal, ReceiptText } from "lucide-react";
import { fmtDateTime, num } from "@/lib/format";
import type { PayslipRegRow } from "@/mock/finance-run";
import { useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { Hint } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { MutedCell, NumCell } from "@/components/data-table";
import { PersonCell } from "@/components/people/person-cell";
import { FinStatus, MoneyCell } from "@/components/finance/kit";

export interface RowActions {
  runId: string;
  onEmail: (rows: PayslipRegRow[]) => void;
  onDownload: (rows: PayslipRegRow[]) => void;
}

function RowMenu({ row, actions }: { row: PayslipRegRow; actions: RowActions }) {
  const { can, why } = useApp();
  const allowed = can("payroll.payslips", "X");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label={`Actions for ${row.name}`} onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem asChild>
          <Link href={`/payroll/runs/${actions.runId}/employee/${row.code}`}>
            <ReceiptText /> Open payslip breakdown
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!allowed || !row.published}
          title={!allowed ? why("payroll.payslips", "X") : !row.published ? "Publish the payslip first" : undefined}
          onSelect={() => actions.onEmail([row])}
        >
          <Mail /> {row.emailState === "emailed" ? "Resend email" : "Email payslip"}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!allowed}
          title={!allowed ? why("payroll.payslips", "X") : undefined}
          onSelect={() => actions.onDownload([row])}
        >
          <Download /> Download PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function payslipColumns(actions: RowActions): ColumnDef<PayslipRegRow, unknown>[] {
  return [
    {
      accessorKey: "name",
      header: "Employee",
      cell: ({ row }) => (
        <PersonCell
          name={row.original.name}
          subtitle={`${row.original.code} · ${row.original.department}`}
          href={`/payroll/runs/${actions.runId}/employee/${row.original.code}`}
        />
      ),
    },
    { accessorKey: "branch", header: "Branch", cell: ({ getValue }) => <MutedCell>{String(getValue())}</MutedCell> },
    {
      accessorKey: "paidDays",
      header: () => <span className="block text-right">Paid days</span>,
      cell: ({ getValue }) => <NumCell>{num(Number(getValue()), 1)}</NumCell>,
    },
    {
      accessorKey: "gross",
      header: () => <span className="block text-right">Gross</span>,
      cell: ({ getValue }) => <MoneyCell value={Number(getValue())} />,
    },
    {
      accessorKey: "deductions",
      header: () => <span className="block text-right">Deductions</span>,
      cell: ({ getValue }) => <MoneyCell value={Number(getValue())} />,
    },
    {
      accessorKey: "net",
      header: () => <span className="block text-right">Net pay</span>,
      cell: ({ getValue }) => <MoneyCell value={Number(getValue())} className="font-semibold" />,
    },
    {
      id: "published",
      accessorFn: (r) => (r.published ? "published" : "unpublished"),
      header: "Published",
      cell: ({ row }) => {
        const r = row.original;
        const badge = <FinStatus status={r.published ? "published" : "unpublished"} />;
        if (r.holdNote)
          return (
            <Hint text={r.holdNote}>
              <span>
                <StatusBadge status="on_hold" />
              </span>
            </Hint>
          );
        if (!r.publishedAt) return badge;
        return (
          <Hint text={`Published ${fmtDateTime(r.publishedAt)}`}>
            <span>{badge}</span>
          </Hint>
        );
      },
    },
    {
      id: "emailState",
      accessorFn: (r) => r.emailState,
      header: "Email",
      cell: ({ row }) => {
        const r = row.original;
        if (r.emailState === "bounced")
          return (
            <Hint text={r.bounceNote ?? "Delivery failed"}>
              <span>
                <StatusBadge status="failed" label="Bounced" />
              </span>
            </Hint>
          );
        return <FinStatus status={r.emailState} />;
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => <RowMenu row={row.original} actions={actions} />,
    },
  ];
}
