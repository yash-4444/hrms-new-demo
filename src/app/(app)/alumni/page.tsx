"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight, GraduationCap, HeartHandshake, Repeat2, ShieldX } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { DataTable } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Badge, Hint } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { FilterSelect } from "@/components/ui/overlays";
import { PersonCell } from "@/components/people/person-cell";
import { LcBadge } from "@/components/lifecycle/kit";
import { deptName } from "@/mock/org";
import { employeeByCode } from "@/mock/employees";
import { ALUMNI, tenureYears, type Alumnus } from "@/mock/lifecycle";

/* ============================================================================
   /alumni — everyone who has left, whether we would hire them again and why,
   and the boomerangs who already came back.
   ========================================================================== */

const TYPE_LABEL = { voluntary: "Voluntary", involuntary: "Involuntary", retirement: "Retirement" } as const;

export default function AlumniPage() {
  const loading = useFakeLoad();
  const [rehire, setRehire] = React.useState("all");
  const [type, setType] = React.useState("all");

  const data = ALUMNI.filter(
    (a) =>
      (rehire === "all" || (rehire === "boomerang" ? !!a.boomerangCode : a.rehire === rehire && !a.boomerangCode)) &&
      (type === "all" || a.type === type),
  );
  const boomerangs = ALUMNI.filter((a) => a.boomerangCode);
  const leavers = ALUMNI.filter((a) => !a.boomerangCode);
  const eligible = leavers.filter((a) => a.rehire === "eligible");

  const columns: ColumnDef<Alumnus, unknown>[] = [
    { id: "name", header: "Alumnus", accessorKey: "name", enableHiding: false, cell: ({ row }) => <PersonCell name={row.original.name} subtitle={row.original.code.replace(/-P$/, "")} /> },
    { id: "designation", header: "Last designation", accessorKey: "lastDesignation" },
    { id: "dept", header: "Department", accessorFn: (a) => deptName(a.departmentId) },
    { id: "exit", header: "Exit date", accessorKey: "exitDate", cell: ({ row }) => <span className="tnum">{fmtDate(row.original.exitDate)}</span> },
    { id: "tenure", header: "Tenure", accessorFn: (a) => tenureYears(a.joiningDate, a.exitDate), cell: ({ getValue }) => <span className="tnum">{(getValue() as number).toFixed(1)} yrs</span> },
    {
      id: "reason",
      header: "Exit",
      accessorFn: (a) => `${TYPE_LABEL[a.type]} ${a.reason}`,
      cell: ({ row }) => (
        <span className="text-xs">
          {TYPE_LABEL[row.original.type]}
          <span className="block text-[11px] text-muted-foreground">{row.original.reason}</span>
        </span>
      ),
    },
    { id: "nowAt", header: "Now at", accessorKey: "nowAt" },
    {
      id: "rehire",
      header: "Rehire",
      accessorFn: (a) => (a.boomerangCode ? "boomerang" : a.rehire),
      cell: ({ row }) => {
        const a = row.original;
        if (a.boomerangCode)
          return (
            <Link href={`/employees/${a.boomerangCode}`} onClick={(e) => e.stopPropagation()} className="flex flex-col gap-0.5 rounded focus-visible:ring-2 focus-visible:ring-ring">
              <StatusBadge status="active" label="Rejoined" />
              <span className="text-[11px] text-primary hover:underline">{a.rehireNote}</span>
            </Link>
          );
        return (
          <Hint text={a.rehireNote}>
            <span className="flex flex-col gap-0.5">
              {a.rehire === "eligible" ? <LcBadge status="eligible" /> : <StatusBadge status="rejected" label="Not eligible" />}
              <span className="max-w-[220px] truncate text-[11px] text-muted-foreground">{a.rehireNote}</span>
            </span>
          </Hint>
        );
      },
    },
  ];

  return (
    <PageBody>
      <PageHeader
        title="Alumni"
        description="Former employees, their rehire eligibility and the reason on record. Eligible alumni with a positive exit interview are surfaced to recruiters as warm leads."
      />
      {loading ? (
        <CardsSkeleton />
      ) : (
        <StatRow>
          <StatTile label="Alumni" value={leavers.length} icon={GraduationCap} hint="Excludes those who have rejoined" />
          <StatTile label="Eligible for rehire" value={`${Math.round((eligible.length / Math.max(1, leavers.length)) * 100)}%`} icon={HeartHandshake} tone="good" onClick={() => setRehire("eligible")} />
          <StatTile label="Not eligible" value={leavers.length - eligible.length} icon={ShieldX} tone="critical" onClick={() => setRehire("not_eligible")} />
          <StatTile label="Boomerang rehires" value={boomerangs.length} icon={Repeat2} onClick={() => setRehire("boomerang")} />
        </StatRow>
      )}

      {!loading && (
        <Section title="Boomerangs" description="Alumni who came back — rehiring a known performer cut time-to-productivity roughly in half.">
          <ul className="grid gap-3 sm:grid-cols-2">
            {boomerangs.map((a) => {
              const e = employeeByCode(a.boomerangCode!)!;
              return (
                <li key={a.code}>
                  <Link
                    href={`/employees/${e.code}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <PersonCell name={e.name} subtitle={`${a.lastDesignation} → ${e.designation}`} />
                    <span className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
                      <Badge variant="soft" className="tnum">
                        Away {Math.round(tenureYears(a.exitDate, e.joiningDate) * 12)} mo
                      </Badge>
                      <ArrowRight className="size-3.5" aria-hidden />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {loading ? (
        <TableSkeleton />
      ) : (
        <DataTable
          columns={columns}
          data={data}
          searchKeys={["name", "lastDesignation", "nowAt"]}
          searchPlaceholder="Search alumni…"
          getRowId={(r) => r.code}
          exportName="alumni"
          emptyIcon={GraduationCap}
          emptyTitle="No alumni match"
          emptyDescription="Clear the filters to see the full alumni directory."
          filters={
            <>
              <FilterSelect label="Rehire" value={rehire} onValueChange={setRehire} options={[{ value: "eligible", label: "Eligible" }, { value: "not_eligible", label: "Not eligible" }, { value: "boomerang", label: "Rejoined" }]} />
              <FilterSelect label="Exit type" value={type} onValueChange={setType} options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))} />
            </>
          }
        />
      )}
    </PageBody>
  );
}
