"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { TrendingDown } from "lucide-react";
import { inr, inrCompact, pct } from "@/lib/format";
import { DataTable, NumCell } from "@/components/data-table";
import { TrendLineChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { categoryForAsset, depreciationSchedule, type DepMethod, type DepRow } from "@/mock/service";
import type { Asset } from "@/mock/workplace";

const WDV_RATE = 40;

/** Book value today, the schedule by financial year and SLM vs WDV compared. */
export function DepreciationPanel({ asset }: { asset: Asset }) {
  const policy = categoryForAsset(asset.category);
  const [method, setMethod] = React.useState<DepMethod>(policy.method);

  const slm = React.useMemo(
    () => depreciationSchedule(asset, "SLM", 0, policy.usefulLifeYears, policy.salvagePct),
    [asset, policy],
  );
  const wdv = React.useMemo(
    () => depreciationSchedule(asset, "WDV", policy.method === "WDV" ? policy.rate : WDV_RATE, policy.usefulLifeYears, policy.salvagePct),
    [asset, policy],
  );
  const active = method === "SLM" ? slm : wdv;

  const chartData = slm.rows.map((r, i) => ({ fy: r.fy, slm: r.closing, wdv: wdv.rows[i]?.closing ?? r.closing }));

  const columns = React.useMemo<ColumnDef<DepRow, unknown>[]>(
    () => [
      { accessorKey: "fy", header: "Financial year", cell: ({ row }) => <span className="font-medium">{row.original.fy}</span> },
      { accessorKey: "opening", header: "Opening", cell: ({ row }) => <NumCell>{inr(row.original.opening, { decimals: false })}</NumCell> },
      { accessorKey: "depreciation", header: "Depreciation", cell: ({ row }) => <NumCell>{inr(row.original.depreciation, { decimals: false })}</NumCell> },
      { accessorKey: "closing", header: "Closing book value", cell: ({ row }) => <NumCell>{inr(row.original.closing, { decimals: false })}</NumCell> },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Category policy: <Badge variant="muted">{policy.method}</Badge>{" "}
          {policy.method === "WDV" ? `${policy.rate}% a year` : `${pct(policy.rate, 2)} a year`} · useful life{" "}
          {policy.usefulLifeYears} years · salvage {policy.salvagePct}%
        </p>
        <div role="radiogroup" aria-label="Depreciation method" className="inline-flex rounded-md border border-border p-0.5">
          {(["SLM", "WDV"] as DepMethod[]).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={method === m}
              onClick={() => setMethod(m)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                method === m ? "bg-primary-soft text-primary-soft-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {m === "SLM" ? "Straight-line" : "Written-down value"}
            </button>
          ))}
        </div>
      </div>

      <StatRow cols={3}>
        <StatTile label="Purchase cost" value={inr(asset.purchaseCost, { decimals: false })} compact />
        <StatTile label="Book value today" value={inr(active.bookToday, { decimals: false })} icon={TrendingDown} tone="accent" compact />
        <StatTile
          label="Accumulated depreciation"
          value={inrCompact(active.accumulated)}
          hint={pct((active.accumulated / asset.purchaseCost) * 100)}
          compact
        />
      </StatRow>

      <TrendLineChart
        title="Book value by financial year"
        description="Closing value under each method — the selected method drives the register."
        data={chartData}
        xKey="fy"
        series={[
          { key: "slm", label: "Straight-line" },
          { key: "wdv", label: "Written-down value" },
        ]}
        valueFormat={(v) => inr(v, { decimals: false })}
        tickFormat={(v) => inrCompact(v)}
        height={220}
      />

      <DataTable
        columns={columns}
        data={active.rows}
        getRowId={(r) => r.fy}
        exportName={`${asset.tag}-depreciation-${method.toLowerCase()}`}
        pageSize={10}
        emptyIcon={TrendingDown}
        emptyTitle="No depreciation yet"
        emptyDescription="The schedule starts in the month the asset is capitalised."
        dense
      />
    </div>
  );
}
