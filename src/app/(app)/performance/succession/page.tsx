"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Crown, ShieldCheck, UserPlus, Users } from "lucide-react";
import { deptName } from "@/mock/org";
import { employeeByCode } from "@/mock/employees";
import { benchStrength, CRITICAL_ROLES, flightRiskFor, READINESS_LABEL, type CriticalRole } from "@/mock/engage";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, NumCell } from "@/components/data-table";
import { BarCompareChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { PersonCell } from "@/components/people/person-cell";
import { CardsSkeleton, ChartSkeleton, Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Label, Switch } from "@/components/ui/primitives";
import { ConfirmDialog, Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { AiBadge } from "@/components/ai";
import { NominateDialog, SuccessorList } from "@/components/engage/perf-succession";
import { nameOf } from "@/components/engage/kit";

const BENCH_STATUS = { Strong: "completed", Adequate: "on_track", Weak: "at_risk", None: "off_track" } as const;

export default function SuccessionPage() {
  const loading = useFakeLoad();
  const { persona, role: personaRole } = useApp();
  const me = persona.employeeId;
  const seeAll = personaRole === "hr_admin" || personaRole === "tenant_owner" || personaRole === "auditor";
  const myDept = employeeByCode(me)?.departmentId;

  const [roles, setRoles] = React.useState<CriticalRole[]>(CRITICAL_ROLES);
  const [overlay, setOverlay] = React.useState(true);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [nominateFor, setNominateFor] = React.useState<CriticalRole | null>(null);
  const [removing, setRemoving] = React.useState<{ roleId: string; code: string } | null>(null);

  const scoped = roles.filter((r) => seeAll || r.departmentId === myDept || employeeByCode(r.incumbentCode)?.managerCode === me);
  const open = roles.find((r) => r.id === openId) ?? null;
  const withReadyNow = scoped.filter((r) => r.successors.some((s) => s.readiness === "now")).length;
  const noBench = scoped.filter((r) => r.successors.length === 0).length;
  const riskySuccessors = scoped.flatMap((r) => r.successors).filter((s) => flightRiskFor(s.code)?.band === "High").length;

  const chartData = scoped.map((r) => ({
    role: r.title.replace(" — Payroll Core", ""),
    now: r.successors.filter((s) => s.readiness === "now").length,
    mid: r.successors.filter((s) => s.readiness === "1-2").length,
    late: r.successors.filter((s) => s.readiness === "3+").length,
  }));

  const columns = React.useMemo<ColumnDef<CriticalRole, unknown>[]>(
    () => [
      { accessorKey: "title", header: "Critical role", cell: ({ row }) => <div><p className="text-xs font-medium">{row.original.title}</p><p className="text-[11px] text-muted-foreground">{deptName(row.original.departmentId)}</p></div> },
      { id: "incumbent", accessorFn: (r) => nameOf(r.incumbentCode), header: "Incumbent", cell: ({ row }) => <PersonCell name={nameOf(row.original.incumbentCode)} code={row.original.incumbentCode} /> },
      { accessorKey: "criticality", header: "Criticality", cell: ({ row }) => <StatusBadge status={row.original.criticality === "Critical" ? "sla_breached" : "sla_at_risk"} label={row.original.criticality} /> },
      ...(["now", "1-2", "3+"] as const).map<ColumnDef<CriticalRole, unknown>>((k) => ({
        id: `r-${k}`,
        accessorFn: (r) => r.successors.filter((s) => s.readiness === k).length,
        header: READINESS_LABEL[k],
        cell: ({ getValue }) => <NumCell>{String(getValue())}</NumCell>,
      })),
      { id: "bench", accessorFn: (r) => benchStrength(r), header: "Bench strength", cell: ({ row }) => { const b = benchStrength(row.original); return <StatusBadge status={BENCH_STATUS[b]} label={b} />; } },
      {
        id: "incRisk",
        accessorFn: (r) => flightRiskFor(r.incumbentCode)?.score ?? 0,
        header: "Incumbent flight risk",
        cell: ({ row }) => { const risk = flightRiskFor(row.original.incumbentCode); return risk ? <span className="tnum text-xs">{risk.band} · {risk.score}</span> : <span className="text-xs text-muted-foreground">—</span>; },
      },
    ],
    [],
  );

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Succession" description="Loading critical roles…" />
        <CardsSkeleton />
        <ChartSkeleton />
        <TableSkeleton rows={6} />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="Succession"
        description={seeAll ? "Critical roles across the company, who could step in and when. Confidential to HR and department heads." : `Critical roles in ${deptName(myDept ?? "")} and roles that report to you. Confidential to HR and department heads.`}
        actions={
          <div className="flex items-center gap-2 rounded-md border border-border px-2 py-1">
            <Switch id="risk-overlay" checked={overlay} onCheckedChange={setOverlay} />
            <Label htmlFor="risk-overlay" className="flex items-center gap-1 text-xs">
              Flight-risk overlay <AiBadge />
            </Label>
          </div>
        }
      />

      <StatRow cols={4}>
        <StatTile label="Critical roles" value={scoped.length} icon={Crown} hint={`${scoped.filter((r) => r.criticality === "Critical").length} rated Critical`} />
        <StatTile label="With a ready-now successor" value={`${withReadyNow} of ${scoped.length}`} icon={ShieldCheck} tone={withReadyNow / Math.max(1, scoped.length) >= 0.5 ? "good" : "warning"} hint="Target: 60% by March 2027" />
        <StatTile label="No successor at all" value={noBench} icon={AlertTriangle} tone={noBench ? "critical" : "good"} hint="Single point of failure" />
        <StatTile label="Successors at high flight risk" value={riskySuccessors} icon={Users} tone={riskySuccessors ? "warning" : "neutral"} hint="From the AI attrition model" />
      </StatRow>

      <BarCompareChart
        title="Bench by readiness"
        description="Named successors per critical role, stacked by readiness."
        data={chartData}
        xKey="role"
        series={[{ key: "now", label: "Ready now" }, { key: "mid", label: "1–2 yrs" }, { key: "late", label: "3+ yrs" }]}
        stacked
        horizontal
        height={Math.max(200, chartData.length * 30)}
      />

      <Section title="Critical roles" description="Open a role to see successors, 9-box placement and flight risk." bodyClassName="p-3">
        <DataTable
          columns={columns}
          data={scoped}
          getRowId={(r) => r.id}
          onRowClick={(r) => setOpenId(r.id)}
          rowTone={(r) => (r.successors.length === 0 ? "danger" : undefined)}
          exportName="succession-critical-roles"
          emptyIcon={Crown}
          emptyTitle="No critical roles in your scope"
          emptyDescription="Ask HR to flag a role in your department as critical."
        />
      </Section>

      <Sheet open={!!open} onOpenChange={(v) => !v && setOpenId(null)}>
        <SheetContent>
          {open && (
            <>
              <SheetHeader>
                <SheetTitle>{open.title}</SheetTitle>
                <SheetDescription>Incumbent {nameOf(open.incumbentCode)} · bench {benchStrength(open).toLowerCase()}</SheetDescription>
              </SheetHeader>
              <SheetBody className="flex flex-col gap-3">
                <SuccessorList role={open} overlay={overlay} onRemove={(code) => setRemoving({ roleId: open.id, code })} />
                {overlay && <p className="text-[11px] text-muted-foreground">Flight risk is an explainable AI signal for planning conversations only — never used for automated decisions.</p>}
                <Gated menuKey="growth.succession" action="C">
                  <Button size="sm" className="self-start" onClick={() => setNominateFor(open)}>
                    <UserPlus /> Nominate successor
                  </Button>
                </Gated>
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>

      <NominateDialog
        role={nominateFor}
        onOpenChange={(v) => !v && setNominateFor(null)}
        onNominate={(v) => {
          if (!nominateFor) return;
          setRoles((prev) => prev.map((r) => (r.id === nominateFor.id ? { ...r, successors: [...r.successors, { code: v.code, readiness: v.readiness, boxId: v.boxId }] } : r)));
          mockAction(`${nameOf(v.code)} nominated for ${nominateFor.title}`, { description: `${READINESS_LABEL[v.readiness]}. Development plan saved to their profile (visible to HR only).` });
        }}
      />

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(v) => !v && setRemoving(null)}
        title={`Remove ${removing ? nameOf(removing.code) : ""} as a successor?`}
        description="Their development plan for this role is archived. Bench strength is recalculated immediately."
        confirmLabel="Remove successor"
        destructive
        onConfirm={() => {
          if (!removing) return;
          setRoles((prev) => prev.map((r) => (r.id === removing.roleId ? { ...r, successors: r.successors.filter((s) => s.code !== removing.code) } : r)));
          mockAction(`${nameOf(removing.code)} removed from the bench`, { tone: "warning" });
        }}
      />
    </PageBody>
  );
}
