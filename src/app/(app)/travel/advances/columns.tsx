"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarClock, Check, HandCoins, MoreHorizontal, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { travelAdvOverdue, type TravelAdvRow } from "@/mock/finance-travel";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { Badge, Hint } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { MutedCell } from "@/components/data-table";
import { PersonCell } from "@/components/people/person-cell";
import { Gated } from "@/components/shell/page";
import { FinStatus, MoneyCell } from "@/components/finance/kit";

/** A ledger row plus what this session has done to it. */
export type AdvRow = TravelAdvRow & { writtenOff: number; tripApproved: boolean };

export type AdvAction = "approve" | "reject" | "settle" | "schedule" | "write_off";

export function AdvStatus({ status }: { status: AdvRow["status"] }) {
  if (status === "written_off") return <StatusBadge status="closed" label="Written off" />;
  return <FinStatus status={status} />;
}

export function advanceColumns(
  act: (row: AdvRow, action: AdvAction) => void,
  can: (action: "E" | "A") => boolean,
): ColumnDef<AdvRow, unknown>[] {
  return [
    {
      accessorKey: "id",
      header: "Advance",
      cell: ({ row }) => (
        <div>
          <p className="font-mono text-[11px] font-medium text-foreground">{row.original.id}</p>
          {row.original.requestNo ? (
            <p className="font-mono text-[11px] text-muted-foreground">{row.original.requestNo}</p>
          ) : (
            <Badge variant="muted" className="mt-0.5 text-[10px]">
              Carried over
            </Badge>
          )}
        </div>
      ),
    },
    {
      accessorKey: "employeeName",
      header: "Employee",
      cell: ({ row }) => (
        <PersonCell name={row.original.employeeName} subtitle={`${row.original.employeeCode} · ${row.original.department}`} size={22} />
      ),
    },
    {
      accessorKey: "purpose",
      header: "Trip",
      cell: ({ row }) => (
        <div className="max-w-[240px]">
          <p className="truncate text-xs text-foreground" title={row.original.purpose}>
            {row.original.purpose}
          </p>
          <p className="tnum text-[11px] text-muted-foreground">
            {fmtDate(row.original.tripStart)} – {fmtDate(row.original.tripEnd)}
          </p>
        </div>
      ),
    },
    { accessorKey: "requested", header: "Requested", cell: ({ row }) => <MoneyCell value={row.original.requested} /> },
    { accessorKey: "issued", header: "Issued", cell: ({ row }) => <MoneyCell value={row.original.issued} /> },
    { accessorKey: "settled", header: "Settled", cell: ({ row }) => <MoneyCell value={row.original.settled} /> },
    {
      accessorKey: "outstanding",
      header: "Outstanding",
      cell: ({ row }) => (
        <MoneyCell value={row.original.outstanding} className={cn(row.original.outstanding > 0 && "font-semibold")} />
      ),
    },
    {
      accessorKey: "settleBy",
      header: "Settle by",
      cell: ({ row }) => {
        const r = row.original;
        if (r.outstanding === 0) return <MutedCell>—</MutedCell>;
        const overdue = travelAdvOverdue(r);
        return (
          <span className={cn("tnum text-xs", overdue ? "font-medium text-destructive-fg" : "text-muted-foreground")}>
            {fmtDate(r.settleBy)}
            {overdue && <span className="block text-[10px]">Overdue</span>}
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <AdvStatus status={row.original.status} />,
    },
    {
      id: "__actions",
      header: "",
      enableHiding: false,
      cell: ({ row }) => <RowActions row={row.original} act={act} can={can} />,
    },
  ];
}

function RowActions({
  row,
  act,
  can,
}: {
  row: AdvRow;
  act: (row: AdvRow, action: AdvAction) => void;
  can: (action: "E" | "A") => boolean;
}) {
  const open = row.status === "outstanding" || row.status === "recovering";
  if (row.status === "pending_approval") {
    return (
      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <Gated menuKey="workplace.travel_advances" action="A">
          {row.tripApproved ? (
            <Button size="sm" onClick={() => act(row, "approve")}>
              <Check /> Approve
            </Button>
          ) : (
            <Hint text="The trip is still waiting for its approver — the advance is released once the trip is approved.">
              <span className="inline-flex cursor-not-allowed">
                <Button size="sm" disabled>
                  <Check /> Approve
                </Button>
              </span>
            </Hint>
          )}
        </Gated>
        <Gated menuKey="workplace.travel_advances" action="A">
          <Button size="icon-sm" variant="outline" aria-label={`Reject ${row.id}`} onClick={() => act(row, "reject")}>
            <X />
          </Button>
        </Gated>
      </div>
    );
  }
  if (!open) return null;
  const canSchedule = row.status === "outstanding" && travelAdvOverdue(row);
  return (
    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <Gated menuKey="workplace.travel_advances" action="E">
        <Button size="sm" variant="outline" onClick={() => act(row, "settle")}>
          <HandCoins /> Settle
        </Button>
      </Gated>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label={`More actions for ${row.id}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={!canSchedule || !can("E")} onSelect={() => act(row, "schedule")}>
            <CalendarClock /> Recover through payroll
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!can("A")}
            className="text-destructive-fg"
            onSelect={() => act(row, "write_off")}
          >
            <Trash2 /> Write off balance
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
