"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Megaphone, Trophy } from "lucide-react";

import { cn } from "@/lib/utils";
import { pct } from "@/lib/format";
import { RECRUITER_LEADERBOARD, SOURCE_EFFECTIVENESS } from "@/mock/lifecycle";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { PersonCell } from "@/components/people/person-cell";
import { Progress } from "@/components/ui/primitives";

/* ============================================================================
   The two ranked tables on the analytics page. Both come straight from the
   pipeline fixtures, so Export gives the same numbers the board shows.
   ========================================================================== */

type SourceRow = (typeof SOURCE_EFFECTIVENESS)[number];
type RecruiterRow = (typeof RECRUITER_LEADERBOARD)[number] & { rank: number };

const right = (label: string) =>
  function RightHeader() {
    return <span className="block text-right">{label}</span>;
  };

export function SourceTable() {
  const best = Math.max(...SOURCE_EFFECTIVENESS.map((s) => s.hireRate));
  const columns = React.useMemo<ColumnDef<SourceRow, unknown>[]>(
    () => [
      { id: "source", header: "Source", accessorKey: "source", enableHiding: false, cell: ({ row }) => <span className="font-medium">{row.original.source}</span> },
      { id: "candidates", header: right("Candidates"), accessorKey: "candidates", cell: ({ row }) => <NumCell>{row.original.candidates}</NumCell> },
      { id: "interviewed", header: right("Interviewed"), accessorKey: "interviewed", cell: ({ row }) => <NumCell>{row.original.interviewed}</NumCell> },
      { id: "interviewRate", header: right("Interview rate"), accessorKey: "interviewRate", cell: ({ row }) => <NumCell>{pct(row.original.interviewRate)}</NumCell> },
      { id: "offered", header: right("Offered"), accessorKey: "offered", cell: ({ row }) => <NumCell>{row.original.offered}</NumCell> },
      { id: "hires", header: right("Hired"), accessorKey: "hires", cell: ({ row }) => <NumCell>{row.original.hires}</NumCell> },
      {
        id: "hireRate",
        header: "Hire rate",
        accessorKey: "hireRate",
        cell: ({ row }) => {
          const v = row.original.hireRate;
          return (
            <span className="flex min-w-[120px] items-center gap-2">
              <Progress value={best ? (v / best) * 100 : 0} tone={v === best && v > 0 ? "success" : "accent"} className="h-1.5 flex-1" aria-label={`Hire rate ${pct(v)}`} />
              <span className={cn("tnum w-11 text-right text-xs", v === best && v > 0 && "font-semibold text-success-fg")}>{pct(v)}</span>
            </span>
          );
        },
      },
    ],
    [best],
  );

  return (
    <DataTable<SourceRow>
      columns={columns}
      data={SOURCE_EFFECTIVENESS}
      getRowId={(s) => s.source}
      exportName="source-effectiveness"
      dense
      emptyIcon={Megaphone}
      emptyTitle="No candidates sourced yet"
      emptyDescription="Sources appear as soon as the first application is tagged."
    />
  );
}

export function RecruiterTable({ linkEmployees }: { linkEmployees: boolean }) {
  const data = React.useMemo<RecruiterRow[]>(() => RECRUITER_LEADERBOARD.map((r, i) => ({ ...r, rank: i + 1 })), []);
  const columns = React.useMemo<ColumnDef<RecruiterRow, unknown>[]>(
    () => [
      {
        id: "rank",
        header: "#",
        accessorKey: "rank",
        enableHiding: false,
        cell: ({ row }) => (
          <span
            className={cn(
              "tnum inline-flex size-6 items-center justify-center rounded-full text-[11px] font-semibold",
              row.original.rank === 1 ? "bg-warning-soft text-warning-fg" : "bg-muted text-muted-foreground",
            )}
          >
            {row.original.rank}
          </span>
        ),
      },
      {
        id: "name",
        header: "Recruiter",
        accessorKey: "name",
        enableHiding: false,
        cell: ({ row }) => <PersonCell name={row.original.name} code={row.original.code} href={linkEmployees ? `/employees/${row.original.code}` : undefined} />,
      },
      { id: "candidates", header: right("Candidates"), accessorKey: "candidates", cell: ({ row }) => <NumCell>{row.original.candidates}</NumCell> },
      { id: "active", header: right("Active"), accessorKey: "active", cell: ({ row }) => <NumCell>{row.original.active}</NumCell> },
      { id: "interviews", header: right("Interviews"), accessorKey: "interviews", cell: ({ row }) => <NumCell>{row.original.interviews}</NumCell> },
      { id: "offers", header: right("Offers"), accessorKey: "offers", cell: ({ row }) => <NumCell>{row.original.offers}</NumCell> },
      { id: "hires", header: right("Hires"), accessorKey: "hires", cell: ({ row }) => <NumCell className="font-semibold">{row.original.hires}</NumCell> },
      {
        id: "avgDays",
        header: right("Avg days to hire"),
        accessorFn: (r) => r.avgDaysToHire ?? -1,
        cell: ({ row }) =>
          row.original.avgDaysToHire === null ? (
            <span className="block text-right">
              <MutedCell>No hires yet</MutedCell>
            </span>
          ) : (
            <NumCell>{row.original.avgDaysToHire} d</NumCell>
          ),
      },
    ],
    [linkEmployees],
  );

  return (
    <DataTable<RecruiterRow>
      columns={columns}
      data={data}
      getRowId={(r) => r.code}
      searchKeys={["name"]}
      searchPlaceholder="Search recruiter…"
      exportName="recruiter-leaderboard"
      dense
      emptyIcon={Trophy}
      emptyTitle="No recruiters match"
      emptyDescription="Try a different name."
    />
  );
}
