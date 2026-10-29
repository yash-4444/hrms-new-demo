"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { addDays, format, parseISO } from "date-fns";
import { CalendarClock, CalendarPlus, Check, FileClock, Hammer, Timer, Wrench } from "lucide-react";
import { fmtDate, inr, inrCompact, num } from "@/lib/format";
import { employeeName } from "@/mock/employees";
import { BRANCHES, DEMO_TODAY } from "@/mock/org";
import { ASSETS } from "@/mock/workplace";
import { AMC_CONTRACTS, BREAKDOWNS, PM_SCHEDULE, type AmcContract, type Breakdown, type PmSchedule } from "@/mock/service";
import { mockAction } from "@/components/app-state";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Badge, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { AssetLink, ToneChip } from "@/components/service/kit";
import { PmDialog } from "@/components/service/pm-dialog";

const cityOf = (id: string) => BRANCHES.find((b) => b.id === id)?.city ?? id;
const NEXT_BY_FREQ = { Monthly: 30, Quarterly: 91, "Half-yearly": 182, Yearly: 365 } as const;

export default function MaintenancePage() {
  const loading = useFakeLoad();
  const [plans, setPlans] = React.useState<PmSchedule[]>(PM_SCHEDULE);
  const [breakdowns, setBreakdowns] = React.useState<Breakdown[]>(BREAKDOWNS);
  const [pmOpen, setPmOpen] = React.useState(false);

  const openBreakdowns = breakdowns.filter((b) => b.status !== "completed");
  const expiring = AMC_CONTRACTS.filter((c) => c.daysLeft <= 60);

  const completePlan = (p: PmSchedule) => {
    const next = format(addDays(parseISO(DEMO_TODAY), NEXT_BY_FREQ[p.frequency]), "yyyy-MM-dd");
    setPlans((ps) => ps.map((x) => (x.id === p.id ? { ...x, lastDone: DEMO_TODAY, nextDue: next, status: "scheduled" } : x)));
    mockAction(`${p.id} marked done`, { description: `Next visit ${fmtDate(next)}.` });
  };

  const planCols = React.useMemo<ColumnDef<PmSchedule, unknown>[]>(
    () => [
      { accessorKey: "title", header: "Plan", cell: ({ row }) => <span className="flex flex-col"><span className="font-medium">{row.original.title}</span><span className="font-mono text-[10px] text-muted-foreground">{row.original.id}</span></span> },
      { accessorKey: "category", header: "Category", cell: ({ row }) => <Badge variant="muted">{row.original.category}</Badge> },
      { accessorKey: "branch", header: "Branch", cell: ({ row }) => cityOf(row.original.branch) },
      { accessorKey: "assets", header: "Assets", cell: ({ row }) => <NumCell>{row.original.assets}</NumCell> },
      { accessorKey: "frequency", header: "Frequency" },
      { accessorKey: "lastDone", header: "Last done", cell: ({ row }) => <span className="tnum">{fmtDate(row.original.lastDone)}</span> },
      { accessorKey: "nextDue", header: "Next due", cell: ({ row }) => <span className="tnum">{fmtDate(row.original.nextDue)}</span> },
      { accessorKey: "vendor", header: "Vendor", cell: ({ row }) => <MutedCell>{row.original.vendor}</MutedCell> },
      { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <Gated menuKey="workplace.asset_maintenance" action="E">
            <Button size="sm" variant="outline" disabled={row.original.status === "scheduled"} onClick={() => completePlan(row.original)}>
              <Check /> Mark done
            </Button>
          </Gated>
        ),
      },
    ],
    [],
  );

  const breakdownCols = React.useMemo<ColumnDef<Breakdown, unknown>[]>(
    () => [
      { accessorKey: "id", header: "Ref", cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span> },
      {
        accessorKey: "assetId",
        header: "Asset",
        cell: ({ row }) => (
          <span className="flex flex-col">
            <AssetLink id={row.original.assetId} />
            <span className="text-[11px] text-muted-foreground">{row.original.assetLabel}</span>
          </span>
        ),
      },
      { accessorKey: "issue", header: "Issue" },
      { accessorKey: "reportedBy", header: "Reported by", cell: ({ row }) => employeeName(row.original.reportedBy) },
      { accessorKey: "reportedOn", header: "Reported", cell: ({ row }) => <span className="tnum">{fmtDate(row.original.reportedOn)}</span> },
      { accessorKey: "vendor", header: "Vendor", cell: ({ row }) => <MutedCell>{row.original.vendor}</MutedCell> },
      { accessorKey: "cost", header: "Cost", cell: ({ row }) => <NumCell>{row.original.cost === 0 ? "Warranty" : inr(row.original.cost, { decimals: false })}</NumCell> },
      { accessorKey: "downtimeDays", header: "Downtime", cell: ({ row }) => <NumCell>{row.original.downtimeDays} d</NumCell> },
      { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.status === "completed" ? null : (
            <Gated menuKey="workplace.asset_maintenance" action="E">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setBreakdowns((bs) => bs.map((b) => (b.id === row.original.id ? { ...b, status: "completed", resolvedOn: DEMO_TODAY } : b)));
                  mockAction(`${row.original.id} closed`, { description: `${row.original.assetId} back in service after ${row.original.downtimeDays} days.` });
                }}
              >
                <Check /> Close
              </Button>
            </Gated>
          ),
      },
    ],
    [],
  );

  const amcCols = React.useMemo<ColumnDef<AmcContract, unknown>[]>(
    () => [
      { accessorKey: "id", header: "Contract", cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span> },
      { accessorKey: "vendor", header: "Vendor", cell: ({ row }) => <span className="font-medium">{row.original.vendor}</span> },
      { accessorKey: "scope", header: "Scope" },
      { accessorKey: "coverage", header: "Coverage", cell: ({ row }) => <MutedCell>{row.original.coverage}</MutedCell> },
      { accessorKey: "annualValue", header: "Annual value", cell: ({ row }) => <NumCell>{inr(row.original.annualValue, { decimals: false })}</NumCell> },
      { accessorKey: "end", header: "Expires", cell: ({ row }) => <span className="tnum">{fmtDate(row.original.end)}</span> },
      {
        accessorKey: "daysLeft",
        header: "Days left",
        cell: ({ row }) => {
          const d = row.original.daysLeft;
          return d < 0 ? <ToneChip tone="danger" icon={FileClock}>Lapsed</ToneChip> : d <= 30 ? <ToneChip tone="danger" icon={FileClock}>{d} days</ToneChip> : d <= 60 ? <ToneChip tone="warning" icon={FileClock}>{d} days</ToneChip> : <NumCell>{d} days</NumCell>;
        },
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <Gated menuKey="workplace.asset_maintenance" action="E">
            <Button size="sm" variant="outline" disabled={row.original.daysLeft > 60} onClick={() => mockAction(`Renewal raised for ${row.original.id}`, { description: `Purchase request sent to Finance for ${inr(row.original.annualValue, { decimals: false })}.` })}>
              Start renewal
            </Button>
          </Gated>
        ),
      },
    ],
    [],
  );

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Maintenance" description="Loading schedules…" />
        <TableSkeleton />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="Maintenance"
        description="Preventive plans, breakdown repairs and the AMC contracts that pay for them."
        actions={
          <Gated menuKey="workplace.asset_maintenance" action="C">
            <Button size="sm" onClick={() => setPmOpen(true)}>
              <CalendarPlus /> Schedule maintenance
            </Button>
          </Gated>
        }
      />

      <StatRow cols={5}>
        <StatTile label="Overdue plans" value={num(plans.filter((p) => p.status === "overdue").length)} icon={CalendarClock} tone="critical" />
        <StatTile label="Due in 14 days" value={num(plans.filter((p) => p.status === "due_soon").length)} icon={CalendarClock} tone="warning" />
        <StatTile label="Open breakdowns" value={num(openBreakdowns.length)} icon={Hammer} hint={`${num(openBreakdowns.reduce((s, b) => s + b.downtimeDays, 0))} device-days down`} />
        <StatTile label="Repair spend" value={inrCompact(breakdowns.reduce((s, b) => s + b.cost, 0))} icon={Wrench} hint="Out-of-warranty repairs, last 6 months" />
        <StatTile label="AMCs expiring ≤ 60 days" value={num(expiring.length)} icon={Timer} tone={expiring.length ? "warning" : "neutral"} hint={inrCompact(expiring.reduce((s, c) => s + c.annualValue, 0))} />
      </StatRow>

      <Tabs defaultValue="schedule">
        <TabsList>
          <TabsTrigger value="schedule"><CalendarClock /> Preventive schedule</TabsTrigger>
          <TabsTrigger value="breakdowns"><Hammer /> Breakdown log ({openBreakdowns.length} open)</TabsTrigger>
          <TabsTrigger value="amc"><FileClock /> AMC contracts</TabsTrigger>
        </TabsList>
        <TabsContent value="schedule">
          <DataTable columns={planCols} data={plans} getRowId={(p) => p.id} exportName="pm-schedule" searchKeys={["title", "vendor"]} searchPlaceholder="Search plan or vendor…"
            rowTone={(p) => (p.status === "overdue" ? "danger" : undefined)} emptyIcon={CalendarClock} emptyTitle="No preventive plans" emptyDescription="Schedule a recurring plan to keep warranties valid and devices healthy." />
        </TabsContent>
        <TabsContent value="breakdowns">
          <DataTable columns={breakdownCols} data={breakdowns} getRowId={(b) => b.id} exportName="breakdown-log" searchKeys={["assetId", "issue", "assetLabel"]} searchPlaceholder="Search tag or issue…"
            emptyIcon={Hammer} emptyTitle="No breakdowns logged" emptyDescription="Repairs reported against an asset tag appear here." />
        </TabsContent>
        <TabsContent value="amc">
          <DataTable columns={amcCols} data={[...AMC_CONTRACTS].sort((a, b) => a.daysLeft - b.daysLeft)} getRowId={(c) => c.id} exportName="amc-contracts"
            rowTone={(c) => (c.daysLeft <= 30 ? "danger" : c.daysLeft <= 60 ? "warning" : undefined)} emptyIcon={FileClock} emptyTitle="No AMC contracts" emptyDescription="Annual maintenance contracts and their renewal dates appear here." />
        </TabsContent>
      </Tabs>

      <PmDialog
        open={pmOpen}
        onOpenChange={setPmOpen}
        onSave={(v) => {
          const id = `PM-${101 + plans.length}`;
          setPlans((ps) => [{ id, title: v.title, category: v.category as PmSchedule["category"], branch: v.branch, assets: ASSETS.filter((a) => a.category === v.category && a.branchId === v.branch && a.status !== "retired").length, frequency: v.frequency, lastDone: DEMO_TODAY, nextDue: v.nextDue, vendor: v.vendor, status: "scheduled" }, ...ps]);
          mockAction(`${id} scheduled`, { description: `${v.frequency} at ${cityOf(v.branch)} from ${fmtDate(v.nextDue)}.` });
        }}
      />
    </PageBody>
  );
}
