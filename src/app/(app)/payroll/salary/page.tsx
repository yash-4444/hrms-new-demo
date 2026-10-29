"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { BadgeIndianRupee, Clock, FilePen, Plus, TrendingUp, Users } from "lucide-react";
import { sum } from "@/lib/utils";
import { fmtDate, inr, inrCompact, num, pct } from "@/lib/format";
import { DEPARTMENTS, GRADES } from "@/mock/org";
import {
  SALARY_ASSIGNMENTS,
  SALARY_REVISIONS,
  revisionArrearsTotal,
  type SalaryAssignment,
  type SalaryRevision,
} from "@/mock/finance-payroll";
import { mockAction, useApp } from "@/components/app-state";
import { FinStatus, MoneyCell } from "@/components/finance/kit";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { FilterSelect } from "@/components/ui/overlays";
import { DataTable, MutedCell } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { PersonCell } from "@/components/people/person-cell";
import { CardsSkeleton, Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { BulkIncrementPanel } from "./bulk-increment";
import { RevisionFormDialog } from "./revision-form";
import { RevisionSheet } from "./revision-sheet";

/* ============================================================================
   /payroll/salary — who is on which structure at what CTC, and the
   effective-dated revision workflow (Payroll raises, Finance approves).
   ========================================================================== */

const incPct = (r: SalaryRevision) => ((r.newCtc - r.oldCtc) / r.oldCtc) * 100;

export default function SalaryAssignmentsPage() {
  const loading = useFakeLoad();
  const { persona } = useApp();
  const [tab, setTab] = React.useState("assignments");
  const [grade, setGrade] = React.useState("all");
  const [dept, setDept] = React.useState("all");
  const [revStatus, setRevStatus] = React.useState("all");
  const [revisions, setRevisions] = React.useState<SalaryRevision[]>(SALARY_REVISIONS);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);

  const assignments = React.useMemo(
    () => SALARY_ASSIGNMENTS.filter((a) => (grade === "all" || a.gradeId === grade) && (dept === "all" || a.departmentId === dept)),
    [grade, dept],
  );
  const shownRevisions = revisions.filter((r) => revStatus === "all" || r.status === revStatus);
  const pending = revisions.filter((r) => r.status === "pending_approval");
  const pendingArrears = sum(pending.map(revisionArrearsTotal));
  const open = revisions.find((r) => r.id === openId) ?? null;

  const update = (id: string, patch: Partial<SalaryRevision>) =>
    setRevisions((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const assignmentColumns = React.useMemo<ColumnDef<SalaryAssignment, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Employee",
        cell: ({ row }) => <PersonCell name={row.original.name} code={row.original.employeeCode} subtitle={`${row.original.employeeCode} · ${row.original.designation}`} />,
      },
      { accessorKey: "department", header: "Department", cell: ({ row }) => <MutedCell>{row.original.department}</MutedCell> },
      { accessorKey: "structureName", header: "Structure", cell: ({ row }) => <span className="text-xs">{row.original.structureName}</span> },
      { accessorKey: "annualCtc", header: "Annual CTC", cell: ({ row }) => <MoneyCell value={row.original.annualCtc} /> },
      { accessorKey: "monthlyGross", header: "Monthly gross", cell: ({ row }) => <MoneyCell value={row.original.monthlyGross} /> },
      { accessorKey: "effectiveFrom", header: "Effective from", cell: ({ row }) => <MutedCell>{fmtDate(row.original.effectiveFrom)}</MutedCell> },
      {
        accessorKey: "lastIncrementPct",
        header: "Apr-26 increment",
        cell: ({ row }) => <MutedCell>{row.original.lastIncrementPct === null ? "New joiner" : pct(row.original.lastIncrementPct)}</MutedCell>,
      },
    ],
    [],
  );

  const revisionColumns = React.useMemo<ColumnDef<SalaryRevision, unknown>[]>(
    () => [
      { accessorKey: "id", header: "Revision", cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span> },
      { accessorKey: "name", header: "Employee", cell: ({ row }) => <PersonCell name={row.original.name} code={row.original.employeeCode} /> },
      { accessorKey: "reason", header: "Reason", cell: ({ row }) => <MutedCell>{row.original.reason}</MutedCell> },
      { accessorKey: "oldCtc", header: "Current CTC", cell: ({ row }) => <MoneyCell value={row.original.oldCtc} /> },
      { accessorKey: "newCtc", header: "Revised CTC", cell: ({ row }) => <MoneyCell value={row.original.newCtc} /> },
      { id: "inc", accessorFn: incPct, header: "Increase", cell: ({ row }) => <MutedCell>{`+${pct(incPct(row.original))}`}</MutedCell> },
      { accessorKey: "effectiveFrom", header: "Effective", cell: ({ row }) => <MutedCell>{fmtDate(row.original.effectiveFrom)}</MutedCell> },
      { id: "arrears", accessorFn: revisionArrearsTotal, header: "Arrears", cell: ({ row }) => <MoneyCell value={revisionArrearsTotal(row.original)} /> },
      { accessorKey: "status", header: "Status", cell: ({ row }) => <FinStatus status={row.original.status} /> },
    ],
    [],
  );

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Salary assignments & revisions" description="Loading assignments…" />
        <CardsSkeleton count={4} />
        <TableSkeleton rows={10} />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="Salary assignments & revisions"
        description="Every India-payroll employee's structure and CTC, with effective-dated revisions. Payroll raises a revision; the Finance Controller approves it."
        actions={
          <Gated menuKey="payroll.salary" action="C">
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus /> New revision
            </Button>
          </Gated>
        }
      />
      <StatRow cols={4}>
        <StatTile label="Employees assigned" value={num(SALARY_ASSIGNMENTS.length)} icon={Users} hint="India payroll · September 2026 run" onClick={() => setTab("assignments")} />
        <StatTile label="Annual CTC on payroll" value={inrCompact(sum(SALARY_ASSIGNMENTS.map((a) => a.annualCtc)))} icon={BadgeIndianRupee} />
        <StatTile label="Awaiting approval" value={num(pending.length)} icon={Clock} tone={pending.length ? "warning" : "neutral"} hint="Finance Controller queue" onClick={() => { setTab("revisions"); setRevStatus("pending_approval"); }} />
        <StatTile label="Arrears if approved" value={inr(pendingArrears, { decimals: false })} icon={TrendingUp} hint="Back-dated revisions, paid in the next run" />
      </StatRow>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="revisions">Revisions ({num(revisions.length)})</TabsTrigger>
          <TabsTrigger value="bulk">Bulk increment</TabsTrigger>
        </TabsList>
        <TabsContent value="assignments" className="mt-3">
          <DataTable<SalaryAssignment>
            columns={assignmentColumns}
            data={assignments}
            getRowId={(a) => a.employeeCode}
            searchKeys={["name", "employeeCode", "designation", "structureName"]}
            searchPlaceholder="Search name, code or structure…"
            exportName="salary-assignments"
            emptyIcon={Users}
            emptyTitle="No employee matches these filters"
            emptyDescription="Clear the grade or department filter."
            emptyAction={<Button variant="outline" size="sm" onClick={() => { setGrade("all"); setDept("all"); }}>Clear filters</Button>}
            filters={
              <>
                <FilterSelect label="Grade" value={grade} onValueChange={setGrade} allLabel="All grades" options={GRADES.map((g) => ({ value: g.id, label: g.label }))} />
                <FilterSelect label="Department" value={dept} onValueChange={setDept} allLabel="All" width="w-[190px]" options={DEPARTMENTS.map((d) => ({ value: d.id, label: d.name }))} />
              </>
            }
          />
        </TabsContent>
        <TabsContent value="revisions" className="mt-3">
          <DataTable<SalaryRevision>
            columns={revisionColumns}
            data={shownRevisions}
            getRowId={(r) => r.id}
            searchKeys={["id", "name", "employeeCode", "reason"]}
            searchPlaceholder="Search revision, employee or reason…"
            exportName="salary-revisions"
            onRowClick={(r) => setOpenId(r.id)}
            rowTone={(r) => (r.status === "pending_approval" && revisionArrearsTotal(r) > 0 ? "warning" : undefined)}
            emptyIcon={FilePen}
            emptyTitle="No revision in this status"
            emptyDescription="Clear the status filter, or raise a new revision."
            emptyAction={<Button variant="outline" size="sm" onClick={() => setRevStatus("all")}>Clear filter</Button>}
            filters={
              <FilterSelect
                label="Status"
                value={revStatus}
                onValueChange={setRevStatus}
                allLabel="All"
                width="w-[190px]"
                options={[
                  { value: "draft", label: "Draft" },
                  { value: "pending_approval", label: "Pending approval" },
                  { value: "approved", label: "Approved" },
                  { value: "rejected", label: "Rejected" },
                ]}
              />
            }
          />
        </TabsContent>
        <TabsContent value="bulk" className="mt-3">
          <BulkIncrementPanel onSubmitted={() => setTab("bulk")} />
        </TabsContent>
      </Tabs>

      <RevisionSheet
        revision={open}
        onOpenChange={(v) => !v && setOpenId(null)}
        onSubmit={(r) => {
          update(r.id, { status: "pending_approval" });
          mockAction(`${r.id} submitted for approval`, { description: "Lakshmi Pillai (Finance Controller) has been notified." });
        }}
        onApprove={(r) => {
          const arrears = revisionArrearsTotal(r);
          update(r.id, { status: "approved", decidedBy: persona.name, decidedOn: "2026-09-16" });
          mockAction(`${r.id} approved`, {
            description: arrears > 0
              ? `${inr(arrears, { decimals: false })} arrears posted to the September 2026 run, which is now marked for recalculation.`
              : `${r.name}'s revised salary applies from ${fmtDate(r.effectiveFrom)}.`,
            undo: () => update(r.id, { status: "pending_approval", decidedBy: null, decidedOn: null }),
          });
        }}
        onReject={(r, comment) => {
          update(r.id, { status: "rejected", decidedBy: persona.name, decidedOn: "2026-09-16", note: `${r.note} — Rejected: ${comment}` });
          mockAction(`${r.id} rejected`, { description: "Payroll has been notified with your reason.", tone: "warning" });
        }}
      />
      <RevisionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        nextId={`REV-2026-${String(41 + revisions.length).padStart(4, "0")}`}
        onCreate={(r) => {
          setRevisions((prev) => [r, ...prev]);
          setTab("revisions");
          mockAction(`${r.id} submitted for approval`, {
            description: `${r.name}: ${inr(r.oldCtc, { decimals: false })} → ${inr(r.newCtc, { decimals: false })}. Sent to the Finance Controller.`,
          });
        }}
      />
    </PageBody>
  );
}
