"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarClock, Check, FilePlus2, History, Scale, Users } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { effectiveTo, rateStatus, type RateKind, type RateStatus, type StatutoryRate } from "@/mock/console-baselines";
import { DataTable } from "@/components/data-table";
import { TonePill, type PTone } from "@/components/platform/kit";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/overlays";

/* Reference Baselines — the Statutory Rates tab. Each rule is a series of
   versions; only the newest version can be succeeded, and only by a new one. */

const STATUS: Record<RateStatus, { label: string; tone: PTone; icon: React.ElementType }> = {
  current: { label: "In force", tone: "success", icon: Check },
  scheduled: { label: "Scheduled", tone: "info", icon: CalendarClock },
  superseded: { label: "Superseded", tone: "neutral", icon: History },
};

const KINDS: { value: RateKind; label: string }[] = [
  { value: "PF", label: "Provident fund (PF)" },
  { value: "ESI", label: "ESI" },
  { value: "PT", label: "Professional tax (PT)" },
  { value: "LWF", label: "Labour welfare fund" },
  { value: "TDS", label: "Income tax (TDS)" },
];

export function RatesTab({
  rates,
  onNewVersion,
  onOverrides,
}: {
  rates: StatutoryRate[];
  onNewVersion: (r: StatutoryRate) => void;
  onOverrides: (r: StatutoryRate) => void;
}) {
  const [kind, setKind] = React.useState("all");
  const [status, setStatus] = React.useState<string>("all");
  const latest = React.useMemo(() => {
    const m = new Map<string, number>();
    rates.forEach((r) => m.set(r.series, Math.max(m.get(r.series) ?? 0, r.version)));
    return m;
  }, [rates]);
  const data = rates
    .filter((r) => (kind === "all" || r.kind === kind) && (status === "all" || rateStatus(r, rates) === status))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.series.localeCompare(b.series) || b.version - a.version);

  const columns = React.useMemo<ColumnDef<StatutoryRate, unknown>[]>(
    () => [
      {
        accessorKey: "component",
        header: "Component",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="rounded bg-muted px-1 font-mono text-[10px] text-muted-foreground">{row.original.kind}</span>
              {row.original.component}
              {row.original.draft && <TonePill tone="accent">Draft</TonePill>}
            </p>
            <p className="text-[11px] text-muted-foreground">{row.original.scope}</p>
          </div>
        ),
      },
      { accessorKey: "value", header: "Value", cell: ({ row }) => <span className="block max-w-[340px] text-xs">{row.original.value}</span> },
      {
        accessorKey: "effectiveFrom",
        header: "Effective",
        cell: ({ row }) => {
          const to = effectiveTo(row.original, rates);
          return (
            <span className="tnum whitespace-nowrap text-xs">
              {fmtDate(row.original.effectiveFrom)} → {to ? fmtDate(to) : "open"}
            </span>
          );
        },
      },
      { accessorKey: "version", header: "Version", cell: ({ row }) => <span className="tnum text-xs">v{row.original.version}</span> },
      {
        id: "status",
        header: "Status",
        accessorFn: (r) => rateStatus(r, rates),
        cell: ({ row }) => {
          const s = STATUS[rateStatus(row.original, rates)];
          return (
            <TonePill tone={s.tone} icon={s.icon}>
              {s.label}
            </TonePill>
          );
        },
      },
      {
        id: "overrides",
        header: "Overridden by",
        accessorFn: (r) => r.overrides.length,
        cell: ({ row }) =>
          row.original.overrides.length ? (
            <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={() => onOverrides(row.original)}>
              <Users /> {row.original.overrides.length} tenant{row.original.overrides.length === 1 ? "" : "s"}
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">None</span>
          ),
      },
      {
        id: "__a",
        header: "",
        enableHiding: false,
        cell: ({ row }) =>
          latest.get(row.original.series) === row.original.version ? (
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => onNewVersion(row.original)}>
                <FilePlus2 /> New version
              </Button>
            </div>
          ) : null,
      },
    ],
    [rates, latest, onNewVersion, onOverrides],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      searchKeys={["component", "scope", "value"]}
      searchPlaceholder="Search component, state, value…"
      filters={
        <>
          <FilterSelect label="Type" value={kind} onValueChange={setKind} width="w-[200px]" options={KINDS} />
          <FilterSelect label="Status" value={status} onValueChange={setStatus} options={(Object.keys(STATUS) as RateStatus[]).map((s) => ({ value: s, label: STATUS[s].label }))} />
        </>
      }
      getRowId={(r) => r.id}
      enableColumnFilters={false}
      pageSize={25}
      exportName="statutory-baselines"
      canExport
      emptyIcon={Scale}
      emptyTitle="No rates match"
      emptyDescription="Clear the filters to see every statutory component."
    />
  );
}
