"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { addDays, format, parseISO } from "date-fns";
import { Briefcase, CalendarClock, FolderLock, Lock, Plus, Scale } from "lucide-react";
import { fmtDate, num } from "@/lib/format";
import { employeeByCode, employeeName } from "@/mock/employees";
import { DEMO_NOW, DEMO_TODAY, deptName } from "@/mock/org";
import { CASE_TYPES, HR_CASES, type HrCase } from "@/mock/service";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, MutedCell } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/primitives";
import { FilterSelect } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { CaseSheet } from "@/components/service/case-sheet";
import { NewCaseDialog } from "@/components/service/new-case-dialog";

export default function HrCasesPage() {
  const loading = useFakeLoad();
  const { persona, role, can } = useApp();
  const [cases, setCases] = React.useState<HrCase[]>(HR_CASES);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [type, setType] = React.useState("all");
  const [newOpen, setNewOpen] = React.useState(false);

  /* POSH referrals: HR Admin and the owner only — the agent grant is restricted. */
  const canSeeRestricted = role === "hr_admin" || role === "tenant_owner";
  const visible = cases.filter((c) => type === "all" || c.type === type);
  const open = cases.filter((c) => c.status !== "closed");
  const current = cases.find((c) => c.id === openId) ?? null;

  const logAccess = (c: HrCase, action: string) =>
    setCases((cs) => cs.map((x) => (x.id === c.id ? { ...x, access: [{ at: DEMO_NOW, who: persona.name, action }, ...x.access] } : x)));

  const openCase = (c: HrCase) => {
    logAccess(c, c.restricted && !canSeeRestricted ? "Access denied — restricted case" : "Viewed case");
    setOpenId(c.id);
  };

  const columns = React.useMemo<ColumnDef<HrCase, unknown>[]>(
    () => [
      { accessorKey: "id", header: "Case", cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span> },
      {
        accessorKey: "title",
        header: "Summary",
        cell: ({ row }) =>
          row.original.restricted && !canSeeRestricted ? (
            <span className="flex items-center gap-1.5 text-muted-foreground"><Lock className="size-3.5" aria-hidden /> Restricted — Internal Committee only</span>
          ) : (
            <span className="line-clamp-2 max-w-md font-medium">{row.original.title}</span>
          ),
      },
      { accessorKey: "type", header: "Type", cell: ({ row }) => <Badge variant="muted">{row.original.type}</Badge> },
      { accessorKey: "subjectName", header: "Concerning", cell: ({ row }) => <MutedCell>{row.original.restricted && !canSeeRestricted ? "Withheld" : row.original.subjectCode ? `${row.original.subjectName} · ${row.original.department}` : row.original.subjectName}</MutedCell> },
      { accessorKey: "owner", header: "Owner" },
      { accessorKey: "openedOn", header: "Opened", cell: ({ row }) => <span className="tnum">{fmtDate(row.original.openedOn)}</span> },
      { accessorKey: "dueOn", header: "Due", cell: ({ row }) => <span className="tnum">{fmtDate(row.original.dueOn)}</span> },
      { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    ],
    [canSeeRestricted],
  );

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="HR cases" description="Loading cases…" />
        <TableSkeleton />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="HR cases"
        description="Grievances, disciplinary matters, investigations and POSH referrals — handled confidentially, with every access logged."
        actions={
          <Gated menuKey="helpdesk.cases" action="C">
            <Button size="sm" onClick={() => setNewOpen(true)}><Plus /> Open case</Button>
          </Gated>
        }
      />

      <Alert tone="warning" icon={FolderLock} title="Restricted visibility">
        Cases are visible to case handlers only. Opening a case is written to its access log with your name and the time
        {can("helpdesk.cases", "A") ? "." : "; recording an outcome needs HR Admin."}
        {!canSeeRestricted && " POSH referrals are limited to the Internal Committee and HR Admin."}
      </Alert>

      <StatRow cols={4}>
        <StatTile label="Open cases" value={num(open.length)} icon={Briefcase} />
        <StatTile label="Due in 14 days" value={num(open.filter((c) => c.dueOn <= format(addDays(parseISO(DEMO_TODAY), 14), "yyyy-MM-dd")).length)} icon={CalendarClock} tone="warning" />
        <StatTile label="Investigations" value={num(open.filter((c) => c.type === "Investigation" || c.type === "Disciplinary").length)} icon={Scale} />
        <StatTile label="Restricted" value={num(cases.filter((c) => c.restricted).length)} icon={Lock} hint="POSH — Internal Committee" />
      </StatRow>

      <DataTable
        columns={columns}
        data={visible}
        getRowId={(c) => c.id}
        searchKeys={["id", "type", "owner"]}
        searchPlaceholder="Search case, type, owner…"
        exportName="hr-cases"
        onRowClick={openCase}
        filters={<FilterSelect label="Type" value={type} onValueChange={setType} allLabel="All types" width="w-[180px]" options={CASE_TYPES.map((t) => ({ value: t, label: t }))} />}
        emptyIcon={Briefcase}
        emptyTitle="No cases"
        emptyDescription="No HR cases match this filter."
      />

      <CaseSheet
        key={current?.id ?? "none"}
        hrCase={current}
        canSeeRestricted={canSeeRestricted}
        onOpenChange={(o) => !o && setOpenId(null)}
        onAddNote={(c, text) => {
          setCases((cs) => cs.map((x) => (x.id === c.id ? { ...x, notes: [...x.notes, { date: DEMO_TODAY, author: persona.name, text }], access: [{ at: DEMO_NOW, who: persona.name, action: "Added note" }, ...x.access] } : x)));
          mockAction("Note added to the case file");
        }}
        onClose={(c, outcome) => {
          setCases((cs) => cs.map((x) => (x.id === c.id ? { ...x, status: "closed", outcome, timeline: [...x.timeline, { date: DEMO_TODAY, actor: persona.name, event: "Outcome recorded; case closed" }], access: [{ at: DEMO_NOW, who: persona.name, action: "Closed case" }, ...x.access] } : x)));
          mockAction(`${c.id} closed`, { description: outcome });
        }}
      />
      <NewCaseDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onSave={(v) => {
          const id = `HRC-2026-${String(17 + cases.length - HR_CASES.length).padStart(3, "0")}`;
          const subject = v.subjectCode ? employeeByCode(v.subjectCode.toUpperCase()) : undefined;
          const posh = v.type === "POSH referral";
          setCases((cs) => [{
            id, type: v.type, title: posh ? "Referral to the Internal Committee" : v.title, complainant: posh ? "Withheld" : v.complainant,
            subjectCode: posh ? null : (subject?.code ?? null), subjectName: posh ? "Withheld" : subject ? employeeName(subject.code) : "Not applicable",
            department: posh ? "Withheld" : subject ? deptName(subject.departmentId) : "—", openedOn: DEMO_TODAY, owner: posh ? "Priya Menon" : persona.name,
            status: "open", restricted: posh, dueOn: format(addDays(parseISO(DEMO_TODAY), posh ? 90 : 30), "yyyy-MM-dd"),
            timeline: [{ date: DEMO_TODAY, actor: persona.name, event: posh ? "Referred to the Internal Committee" : "Case opened" }],
            notes: [], evidence: [], outcome: null, access: [{ at: DEMO_NOW, who: persona.name, action: "Opened case" }],
          }, ...cs]);
          mockAction(`${id} opened`, { description: posh ? "Referred to the Internal Committee." : `Owner: ${persona.name}.` });
        }}
      />
    </PageBody>
  );
}
