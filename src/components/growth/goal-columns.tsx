"use client";

import type * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CornerDownRight, Flag, MoreHorizontal, Target, Trash2 } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { Gated } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Badge, Progress } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import type { Goal } from "@/mock/growth";

/* ============================================================================
   DataTable columns for the /goals table view — the same goal sheet as the
   cards, sortable by weightage, progress, target date and last check-in.
   Key-result editing stays on the cards, where each KR has its own slider.
   ========================================================================== */

const stop = (e: React.MouseEvent) => e.stopPropagation();

export function goalColumns({
  onCheckIn,
  onMarkAchieved,
  onRemove,
}: {
  onCheckIn: (g: Goal) => void;
  onMarkAchieved: (g: Goal) => void;
  onRemove: (g: Goal) => void;
}): ColumnDef<Goal, unknown>[] {
  return [
    {
      id: "title",
      header: "Goal",
      accessorKey: "title",
      enableHiding: false,
      cell: ({ row }) => {
        const g = row.original;
        return (
          <div className="min-w-[240px]">
            <p className="font-medium text-foreground">{g.title}</p>
            {g.cascade && (
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                <CornerDownRight className="size-3 shrink-0" aria-hidden />
                <span className="truncate">
                  {g.cascade.parentGoalTitle} · {g.cascade.parentOwnerName}
                </span>
              </p>
            )}
          </div>
        );
      },
    },
    {
      id: "category",
      header: "Category",
      accessorKey: "category",
      cell: ({ row }) => <Badge variant="muted">{row.original.category}</Badge>,
    },
    {
      id: "weightage",
      header: "Weightage",
      accessorKey: "weightage",
      cell: ({ row }) => <span className="tnum block text-right">{row.original.weightage}%</span>,
    },
    {
      id: "progress",
      header: "Progress",
      accessorKey: "progress",
      cell: ({ row }) => (
        <div className="flex min-w-[140px] items-center gap-2">
          <Progress value={row.original.progress} className="flex-1" aria-label="Goal progress" />
          <span className="tnum w-9 text-right">{row.original.progress}%</span>
        </div>
      ),
    },
    {
      id: "keyResults",
      header: "Key results",
      accessorFn: (g) => `${g.keyResults.filter((k) => k.progress >= 100).length} of ${g.keyResults.length}`,
      enableSorting: false,
      cell: ({ getValue }) => <span className="tnum whitespace-nowrap">{getValue() as string} done</span>,
    },
    {
      id: "targetDate",
      header: "Target",
      accessorKey: "targetDate",
      cell: ({ row }) => <span className="tnum whitespace-nowrap">{fmtDate(row.original.targetDate)}</span>,
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "lastCheckIn",
      header: "Last check-in",
      accessorKey: "lastCheckIn",
      cell: ({ row }) => (
        <span className="tnum whitespace-nowrap text-muted-foreground">{fmtDate(row.original.lastCheckIn)}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const g = row.original;
        return (
          <span className="flex justify-end" onClick={stop}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for goal: ${g.title}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <Gated menuKey="my.goals" action="E">
                  <DropdownMenuItem onSelect={() => onCheckIn(g)}>
                    <Flag /> Log a check-in
                  </DropdownMenuItem>
                </Gated>
                <Gated menuKey="my.goals" action="E">
                  <DropdownMenuItem onSelect={() => onMarkAchieved(g)} disabled={g.progress >= 100}>
                    <Target /> Mark every key result achieved
                  </DropdownMenuItem>
                </Gated>
                <DropdownMenuSeparator />
                <Gated menuKey="my.goals" action="E">
                  <DropdownMenuItem destructive onSelect={() => onRemove(g)}>
                    <Trash2 /> Remove this goal
                  </DropdownMenuItem>
                </Gated>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        );
      },
    },
  ];
}
