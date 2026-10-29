"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { BadgeCheck, ChevronDown, Landmark, MessageSquareReply, PauseCircle, Wallet } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { expDuplicateFor, type ExpFinanceRow } from "@/mock/finance-expense";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { Badge } from "@/components/ui/primitives";
import { MutedCell } from "@/components/data-table";
import { PersonCell } from "@/components/people/person-cell";
import { Gated } from "@/components/shell/page";
import { AiBadge } from "@/components/ai";
import { FinStatus, MoneyCell } from "@/components/finance/kit";

export interface FinanceHandlers {
  verify: (ids: string[]) => void;
  query: (row: ExpFinanceRow) => void;
  release: (ids: string[], mode: "payroll" | "direct") => void;
  clearHold: (row: ExpFinanceRow) => void;
  dismissed: Set<string>;
}

/** Release menu as one element, so `Gated` can disable its trigger. */
function ReleaseMenu({
  row,
  onRelease,
  disabled,
}: {
  row: ExpFinanceRow;
  onRelease: FinanceHandlers["release"];
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button size="sm" variant="soft" disabled={disabled}>
          Release <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onRelease([row.id], "payroll")}>
          <Wallet /> With October 2026 payroll
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onRelease([row.id], "direct")}>
          <Landmark /> Direct payment (NEFT 18 Sep)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function financeColumns(h: FinanceHandlers): ColumnDef<ExpFinanceRow, unknown>[] {
  return [
    {
      accessorKey: "claimNo",
      header: "Claim",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="tnum font-medium">{row.original.claimNo}</p>
          <p className="max-w-[240px] truncate text-[11px] text-muted-foreground">{row.original.purpose}</p>
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
    {
      accessorKey: "approvedOn",
      header: "Approved",
      cell: ({ row }) => (
        <span className="text-xs">
          {fmtDate(row.original.approvedOn)}
          <span className="block text-[11px] text-muted-foreground">by {row.original.approvedBy}</span>
        </span>
      ),
    },
    { accessorKey: "total", header: "Amount", cell: ({ row }) => <MoneyCell value={row.original.total} /> },
    {
      id: "flags",
      header: "Flags",
      cell: ({ row }) => {
        const dup = expDuplicateFor(row.original.claimNo);
        return (
          <div className="flex flex-col items-start gap-1">
            {dup && !h.dismissed.has(dup.claimNo) && (
              <span className="flex items-center gap-1 text-[11px] text-violet-700 dark:text-violet-300">
                <AiBadge /> Possible duplicate of {dup.duplicateOf}
              </span>
            )}
            {row.original.violationCount > 0 && (
              <Badge variant="outline" className="border-warning/40 text-warning-fg">
                Approved with exception
              </Badge>
            )}
            {!dup && row.original.violationCount === 0 && <MutedCell>None</MutedCell>}
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <div className="flex max-w-[220px] flex-col items-start gap-0.5">
          <FinStatus status={row.original.status === "pending" ? "in_review" : row.original.status} />
          {row.original.note && <span className="line-clamp-2 text-[11px] text-muted-foreground">{row.original.note}</span>}
        </div>
      ),
    },
    {
      accessorKey: "batchId",
      header: "Batch",
      cell: ({ row }) => <MutedCell>{row.original.batchId ?? "—"}</MutedCell>,
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {(r.status === "pending" || r.status === "queried") && (
              <>
                <Gated menuKey="workplace.expense_finance" action="E">
                  <Button size="sm" variant="ghost" onClick={() => h.query(r)} aria-label={`Query back ${r.claimNo}`}>
                    <MessageSquareReply /> Query
                  </Button>
                </Gated>
                <Gated menuKey="workplace.expense_finance" action="E">
                  <Button size="sm" variant="outline" onClick={() => h.verify([r.id])}>
                    <BadgeCheck /> Verify
                  </Button>
                </Gated>
              </>
            )}
            {r.status === "verified" && (
              <Gated menuKey="workplace.expense_finance" action="A">
                <ReleaseMenu row={r} onRelease={h.release} />
              </Gated>
            )}
            {r.status === "on_hold" && (
              <Gated menuKey="workplace.expense_finance" action="E">
                <Button size="sm" variant="outline" onClick={() => h.clearHold(r)}>
                  <PauseCircle /> Clear hold
                </Button>
              </Gated>
            )}
          </div>
        );
      },
    },
  ];
}
