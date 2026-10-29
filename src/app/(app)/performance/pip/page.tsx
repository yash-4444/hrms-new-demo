"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ClipboardList, Lock, Plus, ShieldAlert, Target } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import { EMPLOYEES, employeeByCode, reporteesOf } from "@/mock/employees";
import { PIPS, RISK_BOX_CODES, type Pip } from "@/mock/engage";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, MutedCell } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { PersonCell } from "@/components/people/person-cell";
import { CardsSkeleton, Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Alert, Progress } from "@/components/ui/primitives";
import { FilterSelect, Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { ClosePipDialog, PipDetail } from "@/components/engage/perf-pip";
import { CreatePipWizard } from "@/components/engage/perf-pip-wizard";
import { nameOf, personLine } from "@/components/engage/kit";

const PIP_STATUS: Record<Pip["status"], { status: string; label: string }> = {
  active: { status: "active", label: "Active" },
  extended: { status: "on_hold", label: "Extended" },
  closed: { status: "closed", label: "Closed" },
};

export default function PipPage() {
  const loading = useFakeLoad();
  const { persona, role } = useApp();
  const me = persona.employeeId;
  /* HR and the owner see every plan; a manager sees only plans for their own reportees. */
  const seeAll = role === "hr_admin" || role === "tenant_owner" || role === "auditor";
  const [pips, setPips] = React.useState<Pip[]>(PIPS);
  const [status, setStatus] = React.useState("all");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [closing, setClosing] = React.useState<Pip | null>(null);
  const [wizardOpen, setWizardOpen] = React.useState(false);

  const visible = pips.filter((p) => (seeAll || p.managerCode === me) && (status === "all" || p.status === status));
  const scoped = pips.filter((p) => seeAll || p.managerCode === me);
  const open = pips.find((p) => p.id === openId) ?? null;

  const candidates = React.useMemo(() => {
    const pool = seeAll ? [...RISK_BOX_CODES, ...EMPLOYEES.filter((e) => e.level === 3 && e.status === "active").slice(0, 30).map((e) => e.code)] : reporteesOf(me).map((e) => e.code);
    const active = new Set(pips.filter((p) => p.status !== "closed").map((p) => p.employeeCode));
    return [...new Set(pool)].filter((c) => !active.has(c));
  }, [seeAll, me, pips]);

  const columns = React.useMemo<ColumnDef<Pip, unknown>[]>(
    () => [
      { id: "employee", accessorFn: (p) => nameOf(p.employeeCode), header: "Employee", cell: ({ row }) => <PersonCell name={nameOf(row.original.employeeCode)} code={row.original.employeeCode} subtitle={personLine(row.original.employeeCode)} /> },
      { id: "manager", accessorFn: (p) => nameOf(p.managerCode), header: "Manager", cell: ({ getValue }) => <MutedCell>{String(getValue())}</MutedCell> },
      { accessorKey: "startDate", header: "Window", cell: ({ row }) => <span className="text-xs">{fmtDate(row.original.startDate)} → {fmtDate(row.original.endDate)}</span> },
      {
        id: "milestones",
        accessorFn: (p) => p.milestones.filter((m) => m.status === "met").length / p.milestones.length,
        header: "Milestones met",
        cell: ({ row }) => {
          const met = row.original.milestones.filter((m) => m.status === "met").length;
          return (
            <div className="flex w-32 flex-col gap-1">
              <span className="tnum text-xs">{met} of {row.original.milestones.length}</span>
              <Progress value={(met / row.original.milestones.length) * 100} tone={met === row.original.milestones.length ? "success" : "accent"} aria-label={`${met} of ${row.original.milestones.length} milestones met`} />
            </div>
          );
        },
      },
      { id: "lastCheckIn", accessorFn: (p) => p.checkIns.at(-1)?.date ?? "", header: "Last check-in", cell: ({ row }) => { const c = row.original.checkIns.at(-1); return c ? <StatusBadge status={c.rating} label={fmtDate(c.date)} /> : <MutedCell>None yet</MutedCell>; } },
      { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={PIP_STATUS[row.original.status].status} label={row.original.outcome ? `Closed · ${row.original.outcome}` : PIP_STATUS[row.original.status].label} /> },
    ],
    [],
  );

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Improvement Plans" description="Loading plans…" />
        <CardsSkeleton count={3} />
        <TableSkeleton rows={4} />
      </PageBody>
    );
  }

  const active = scoped.filter((p) => p.status !== "closed");
  const ending = active.filter((p) => p.endDate <= "2026-10-16");

  return (
    <PageBody>
      <PageHeader
        title="Improvement Plans"
        description="Structured, time-boxed plans with measurable milestones and recorded check-ins. Used only after the gap has been raised in regular 1:1s."
        actions={
          <Gated menuKey="growth.pip" action="C">
            <Button size="sm" onClick={() => setWizardOpen(true)} disabled={candidates.length === 0}>
              <Plus /> Create plan
            </Button>
          </Gated>
        }
      />

      <Alert tone="warning" icon={Lock} title="Restricted visibility">
        {seeAll
          ? "You can see every plan because you hold HR access. Plans are visible to the employee, their manager and the assigned HR partner only — never to peers or skip-level managers."
          : `You see plans for your own reportees only (${reporteesOf(me).length} people). Plans are never visible to peers or skip-level managers.`}
      </Alert>

      <StatRow cols={3}>
        <StatTile label="Active plans" value={active.length} icon={ClipboardList} hint={`${scoped.length - active.length} closed this year`} />
        <StatTile label="Ending in the next 30 days" value={ending.length} icon={Target} tone={ending.length ? "warning" : "neutral"} hint="Outcome decision due" />
        <StatTile label="Closed successfully" value={scoped.filter((p) => p.outcome === "Successful").length} icon={ShieldAlert} tone="good" hint="All milestones met" />
      </StatRow>

      <Section title="Plans" bodyClassName="p-3">
        <DataTable
          columns={columns}
          data={visible}
          getRowId={(p) => p.id}
          onRowClick={(p) => setOpenId(p.id)}
          rowTone={(p) => (p.status !== "closed" && p.endDate < DEMO_TODAY ? "danger" : undefined)}
          filters={<FilterSelect label="Status" value={status} onValueChange={setStatus} options={[{ value: "active", label: "Active" }, { value: "extended", label: "Extended" }, { value: "closed", label: "Closed" }]} />}
          exportName="improvement-plans"
          emptyIcon={ClipboardList}
          emptyTitle={seeAll ? "No plans match" : "No plans for your team"}
          emptyDescription="That's a good sign. Plans appear here when one is created for someone in your scope."
        />
      </Section>

      <Sheet open={!!open} onOpenChange={(v) => !v && setOpenId(null)}>
        <SheetContent>
          {open && (
            <>
              <SheetHeader>
                <SheetTitle>{nameOf(open.employeeCode)} · {open.id}</SheetTitle>
                <SheetDescription>{employeeByCode(open.employeeCode)?.designation} · {PIP_STATUS[open.status].label}</SheetDescription>
              </SheetHeader>
              <SheetBody>
                <PipDetail pip={open} onChange={(p) => setPips((prev) => prev.map((x) => (x.id === p.id ? p : x)))} onClose={() => setClosing(open)} />
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ClosePipDialog
        pip={closing}
        onOpenChange={(v) => !v && setClosing(null)}
        onConfirm={(outcome, comment) => {
          if (!closing) return;
          setPips((prev) => prev.map((p) => (p.id === closing.id ? { ...p, status: outcome === "Extended" ? "extended" : "closed", outcome: outcome === "Extended" ? null : outcome, checkIns: [...p.checkIns, { date: DEMO_TODAY, byCode: me, rating: "on_track", note: `Closed — ${outcome}. ${comment}` }] } : p)));
          mockAction(outcome === "Extended" ? "Plan extended" : `Plan closed — ${outcome}`, { description: `${nameOf(closing.employeeCode)} · recorded with your comment.`, tone: outcome === "Separation" ? "warning" : "success" });
        }}
      />

      <CreatePipWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        candidates={candidates}
        managerCode={(c) => employeeByCode(c)?.managerCode ?? me}
        onCreate={(p) => {
          const id = `PIP-2026-${String(pips.length + 3).padStart(3, "0")}`;
          setPips((prev) => [{ ...p, id }, ...prev]);
          setOpenId(id);
          mockAction(`Plan ${id} created for ${nameOf(p.employeeCode)}`, { description: `${p.milestones.length} milestones · ${fmtDate(p.startDate)} → ${fmtDate(p.endDate)}. Share it in a meeting with HR present.` });
        }}
      />
    </PageBody>
  );
}
