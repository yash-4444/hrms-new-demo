"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { inrCompact } from "@/lib/format";
import type { MrrMovement } from "@/mock/console-billing";
import { AXIS_PROPS, CHART_GRID, CHART_SURFACE, ChartFrame, DIVERGING, makeTooltip, type SeriesDef } from "@/components/charts";

/* MRR movement — gains stack above the zero line, losses below it. The shared
   BarCompareChart stacks without a sign offset, so mixed-sign stacks need
   their own chart; it still sits in the shared ChartFrame (legend, table view). */

const SERIES_DEFS: SeriesDef[] = [
  { key: "new", label: "New", color: DIVERGING[0] },
  { key: "expansion", label: "Expansion", color: DIVERGING[1] },
  { key: "contraction", label: "Contraction", color: DIVERGING[5] },
  { key: "churn", label: "Churn", color: DIVERGING[6] },
];

const LABELS = Object.fromEntries(SERIES_DEFS.map((s) => [s.key, s.label]));
const shortMonth = (m: string) => m.slice(0, 3);

export function MrrMovementChart({ data, height = 260 }: { data: MrrMovement[]; height?: number }) {
  return (
    <ChartFrame
      title="MRR movement"
      description="New, expansion, contraction and churn per month, INR. September is month to date."
      series={SERIES_DEFS}
      tableData={data as unknown as Record<string, unknown>[]}
      tableColumns={[
        { key: "month", label: "Month" },
        ...SERIES_DEFS.map((s) => ({ key: s.key, label: s.label, numeric: true, format: (v: unknown) => inrCompact(Number(v)) })),
        { key: "net", label: "Net", numeric: true, format: (v: unknown) => inrCompact(Number(v)) },
        { key: "mrr", label: "Month-end MRR", numeric: true, format: (v: unknown) => inrCompact(Number(v)) },
      ]}
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} stackOffset="sign" margin={{ top: 8, right: 16, left: 4, bottom: 4 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke={CHART_GRID} />
          <XAxis dataKey="month" {...AXIS_PROPS} tickFormatter={shortMonth} interval={0} />
          <YAxis {...AXIS_PROPS} width={60} tickFormatter={inrCompact} />
          <ReferenceLine y={0} stroke="var(--chart-axis)" />
          <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.5 }} content={makeTooltip((v) => inrCompact(v), (m) => m, LABELS)} />
          {SERIES_DEFS.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId="mrr"
              fill={s.color}
              stroke={CHART_SURFACE}
              strokeWidth={2}
              maxBarSize={34}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
