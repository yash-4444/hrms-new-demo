"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { cn } from "@/lib/utils";
import { num } from "@/lib/format";
import {
  AXIS_PROPS,
  BAR_RADIUS,
  BAR_RADIUS_H,
  CHART_GRID,
  CHART_SURFACE,
  DOT_SIZE,
  DIVERGING,
  LINE_WIDTH,
  ORDINAL,
  SERIES,
  SEQUENTIAL,
  STATUS,
  type StatusTone,
} from "./palette";
import {
  ChartFrame,
  VizTooltip,
  makeTooltip,
  type ChartFrameProps,
  type SeriesDef,
} from "./chart-frame";

export * from "./palette";
export { ChartFrame, ChartLegend, VizTooltip, makeTooltip } from "./chart-frame";
export type { SeriesDef, ChartFrameProps } from "./chart-frame";

type Row = Record<string, string | number>;
type Fmt = (v: number) => string;

const defaultFmt: Fmt = (v) => num(v);

interface BaseProps extends Omit<ChartFrameProps, "children" | "series" | "tableColumns" | "tableData"> {
  data: Row[];
  xKey: string;
  series: { key: string; label: string }[];
  height?: number;
  valueFormat?: Fmt;
  /** Axis-tick formatter; falls back to valueFormat. */
  tickFormat?: Fmt;
  xLabelFormat?: (v: string) => string;
  /** A fixed registry so colour follows the ENTITY, never its rank. */
  registry?: string[];
}

function assignColors(series: { key: string; label: string }[], registry?: string[]): SeriesDef[] {
  const reg = registry ?? series.map((s) => s.key);
  return series.map((s) => {
    const i = reg.indexOf(s.key);
    return {
      key: s.key,
      label: s.label,
      color: i >= 0 && i < SERIES.length ? SERIES[i] : "var(--muted-foreground)",
    };
  });
}

function tableProps(
  data: Row[],
  xKey: string,
  defs: SeriesDef[],
  xLabel: string,
  fmt: Fmt,
  xLabelFormat?: (v: string) => string,
) {
  return {
    tableData: data as Record<string, unknown>[],
    tableColumns: [
      {
        key: xKey,
        label: xLabel,
        format: (v: unknown) => (xLabelFormat ? xLabelFormat(String(v)) : String(v)),
      },
      ...defs.map((d) => ({
        key: d.key,
        label: d.label,
        numeric: true,
        format: (v: unknown) => (v === undefined || v === null ? "—" : fmt(Number(v))),
      })),
    ],
  };
}

/* ========================================================== Trend — line */

export function TrendLineChart({
  data,
  xKey,
  series,
  height = 240,
  valueFormat = defaultFmt,
  tickFormat,
  xLabelFormat,
  registry,
  referenceLine,
  ...frame
}: BaseProps & { referenceLine?: { value: number; label: string } }) {
  const defs = assignColors(series, registry);
  const labels = Object.fromEntries(defs.map((d) => [d.key, d.label]));
  return (
    <ChartFrame
      {...frame}
      series={defs}
      {...tableProps(data, xKey, defs, frame.title, valueFormat, xLabelFormat)}
    >
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke={CHART_GRID} strokeDasharray="0" />
          <XAxis dataKey={xKey} {...AXIS_PROPS} tickFormatter={xLabelFormat} minTickGap={16} />
          <YAxis {...AXIS_PROPS} width={52} tickFormatter={tickFormat ?? valueFormat} />
          {referenceLine && (
            <ReferenceLine
              y={referenceLine.value}
              stroke="var(--chart-axis)"
              strokeDasharray="4 4"
              label={{
                value: referenceLine.label,
                position: "insideTopRight",
                fill: "var(--chart-ink-muted)",
                fontSize: 10,
              }}
            />
          )}
          {/* crosshair + tooltip — the default interaction layer on a line chart */}
          <Tooltip
            cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1, strokeDasharray: "3 3" }}
            content={makeTooltip(valueFormat, xLabelFormat, labels)}
          />
          {defs.map((d) => (
            <Line
              key={d.key}
              type="monotone"
              dataKey={d.key}
              name={d.label}
              stroke={d.color}
              strokeWidth={LINE_WIDTH}
              dot={false}
              activeDot={{ r: DOT_SIZE / 2, strokeWidth: 2, stroke: CHART_SURFACE }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* ========================================================== Trend — area */

export function TrendAreaChart({
  data,
  xKey,
  series,
  height = 240,
  valueFormat = defaultFmt,
  tickFormat,
  xLabelFormat,
  registry,
  stacked,
  ...frame
}: BaseProps & { stacked?: boolean }) {
  const defs = assignColors(series, registry);
  const labels = Object.fromEntries(defs.map((d) => [d.key, d.label]));
  const gid = React.useId().replace(/:/g, "");
  return (
    <ChartFrame
      {...frame}
      series={defs}
      {...tableProps(data, xKey, defs, frame.title, valueFormat, xLabelFormat)}
    >
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <defs>
            {defs.map((d, i) => (
              <linearGradient key={d.key} id={`${gid}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={d.color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={d.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke={CHART_GRID} />
          <XAxis dataKey={xKey} {...AXIS_PROPS} tickFormatter={xLabelFormat} minTickGap={16} />
          <YAxis {...AXIS_PROPS} width={52} tickFormatter={tickFormat ?? valueFormat} />
          <Tooltip
            cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1, strokeDasharray: "3 3" }}
            content={makeTooltip(valueFormat, xLabelFormat, labels)}
          />
          {defs.map((d, i) => (
            <Area
              key={d.key}
              type="monotone"
              dataKey={d.key}
              name={d.label}
              stackId={stacked ? "a" : undefined}
              stroke={d.color}
              strokeWidth={LINE_WIDTH}
              fill={`url(#${gid}-${i})`}
              activeDot={{ r: DOT_SIZE / 2, strokeWidth: 2, stroke: CHART_SURFACE }}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* ================================================== Bars — grouped/stacked */

export function BarCompareChart({
  data,
  xKey,
  series,
  height = 240,
  valueFormat = defaultFmt,
  tickFormat,
  xLabelFormat,
  registry,
  stacked,
  horizontal,
  onBarClick,
  ...frame
}: BaseProps & {
  stacked?: boolean;
  horizontal?: boolean;
  onBarClick?: (row: Row) => void;
}) {
  const defs = assignColors(series, registry);
  const labels = Object.fromEntries(defs.map((d) => [d.key, d.label]));
  return (
    <ChartFrame
      {...frame}
      series={defs}
      {...tableProps(data, xKey, defs, frame.title, valueFormat, xLabelFormat)}
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 8, right: 16, left: horizontal ? 8 : 4, bottom: 4 }}
          barCategoryGap={horizontal ? "22%" : "28%"}
          barGap={2}
        >
          <CartesianGrid
            vertical={!!horizontal}
            horizontal={!horizontal}
            stroke={CHART_GRID}
          />
          {horizontal ? (
            <>
              <XAxis type="number" {...AXIS_PROPS} tickFormatter={tickFormat ?? valueFormat} />
              <YAxis
                type="category"
                dataKey={xKey}
                {...AXIS_PROPS}
                width={124}
                tickFormatter={xLabelFormat}
              />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} {...AXIS_PROPS} tickFormatter={xLabelFormat} interval={0} />
              <YAxis {...AXIS_PROPS} width={52} tickFormatter={tickFormat ?? valueFormat} />
            </>
          )}
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
            content={makeTooltip(valueFormat, xLabelFormat, labels)}
          />
          {defs.map((d) => (
            <Bar
              key={d.key}
              dataKey={d.key}
              name={d.label}
              stackId={stacked ? "a" : undefined}
              fill={d.color}
              radius={horizontal ? BAR_RADIUS_H : BAR_RADIUS}
              /* 2px surface ring keeps stacked segments and adjacent bars apart */
              stroke={CHART_SURFACE}
              strokeWidth={2}
              maxBarSize={horizontal ? 18 : 34}
              isAnimationActive={false}
              onClick={onBarClick ? (d2: unknown) => onBarClick((d2 as { payload: Row }).payload) : undefined}
              cursor={onBarClick ? "pointer" : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* =============================================== Categorical share — donut */

export function DonutChart({
  data,
  nameKey = "name",
  valueKey = "value",
  height = 240,
  valueFormat = defaultFmt,
  centreLabel,
  centreValue,
  onSliceClick,
  registry,
  ...frame
}: Omit<ChartFrameProps, "children" | "series" | "tableColumns" | "tableData"> & {
  data: Row[];
  nameKey?: string;
  valueKey?: string;
  height?: number;
  valueFormat?: Fmt;
  centreLabel?: string;
  centreValue?: string;
  onSliceClick?: (row: Row) => void;
  registry?: string[];
}) {
  const reg = registry ?? data.map((d) => String(d[nameKey]));
  const total = data.reduce((a, b) => a + Number(b[valueKey]), 0);
  const defs: SeriesDef[] = data.map((d) => {
    const i = reg.indexOf(String(d[nameKey]));
    return {
      key: String(d[nameKey]),
      label: String(d[nameKey]),
      color: i >= 0 && i < SERIES.length ? SERIES[i] : "var(--muted-foreground)",
    };
  });

  return (
    <ChartFrame
      {...frame}
      series={defs}
      tableData={data as Record<string, unknown>[]}
      tableColumns={[
        { key: nameKey, label: "Category" },
        { key: valueKey, label: "Value", numeric: true, format: (v) => valueFormat(Number(v)) },
        {
          key: "__share",
          label: "Share",
          numeric: true,
          format: (_v, row) => `${((Number(row[valueKey]) / total) * 100).toFixed(1)}%`,
        },
      ]}
    >
      <div className="relative">
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Tooltip
              content={(p: TooltipContentProps<ValueType, NameType>) => {
                if (!p.active || !p.payload?.length) return null;
                const item = p.payload[0];
                const v = Number(item.value);
                const i = reg.indexOf(String(item.name));
                return (
                  <VizTooltip
                    heading={item.name}
                    rows={[
                      { label: "Value", value: valueFormat(v), color: SERIES[i] ?? undefined },
                      { label: "Share", value: `${((v / total) * 100).toFixed(1)}%` },
                    ]}
                  />
                );
              }}
            />
            <Pie
              data={data}
              dataKey={valueKey}
              nameKey={nameKey}
              innerRadius="58%"
              outerRadius="82%"
              paddingAngle={0}
              stroke={CHART_SURFACE}
              /* 2px surface gap between adjacent fills */
              strokeWidth={2}
              isAnimationActive={false}
              onClick={onSliceClick ? (d: unknown) => onSliceClick((d as { payload: Row }).payload) : undefined}
              cursor={onSliceClick ? "pointer" : undefined}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={defs[i].color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {(centreValue || centreLabel) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-semibold text-foreground">{centreValue}</span>
            {centreLabel && <span className="text-xs text-muted-foreground">{centreLabel}</span>}
          </div>
        )}
      </div>
    </ChartFrame>
  );
}

/* ================================================ Funnel (ordinal stages) */

export interface FunnelStage {
  stage: string;
  value: number;
}

export function FunnelChart({
  stages,
  valueFormat = defaultFmt,
  onStageClick,
  ...frame
}: Omit<ChartFrameProps, "children" | "series" | "tableColumns" | "tableData"> & {
  stages: FunnelStage[];
  valueFormat?: Fmt;
  onStageClick?: (s: FunnelStage) => void;
}) {
  const top = Math.max(...stages.map((s) => s.value), 1);
  return (
    <ChartFrame
      {...frame}
      tableData={stages as unknown as Record<string, unknown>[]}
      tableColumns={[
        { key: "stage", label: "Stage" },
        { key: "value", label: "Count", numeric: true, format: (v) => valueFormat(Number(v)) },
        {
          key: "__conv",
          label: "Conversion",
          numeric: true,
          format: (_v, row) => {
            const i = stages.findIndex((s) => s.stage === row.stage);
            if (i <= 0) return "—";
            return `${((stages[i].value / stages[i - 1].value) * 100).toFixed(1)}%`;
          },
        },
      ]}
    >
      {/* Ordinal ramp: one hue, stepped — magnitude, not identity, so no legend. */}
      <ol className="flex flex-col gap-1.5 px-2 py-1">
        {stages.map((s, i) => {
          const width = Math.max(6, (s.value / top) * 100);
          const conv = i > 0 ? (s.value / stages[i - 1].value) * 100 : null;
          const Row = onStageClick ? "button" : "div";
          return (
            <li key={s.stage}>
              <Row
                {...(onStageClick
                  ? { type: "button" as const, onClick: () => onStageClick(s) }
                  : {})}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-md px-1 py-0.5 text-left",
                  onStageClick && "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <span className="w-24 shrink-0 truncate text-xs text-muted-foreground">{s.stage}</span>
                <span className="relative h-6 min-w-0 flex-1 overflow-hidden rounded-sm bg-muted/60">
                  <span
                    className="absolute inset-y-0 left-0 rounded-sm"
                    style={{
                      width: `${width}%`,
                      background: ORDINAL[Math.min(i, ORDINAL.length - 1)],
                    }}
                  />
                </span>
                {/* direct label — the relief rule, so value never depends on colour */}
                <span className="tnum w-14 shrink-0 text-right text-xs font-medium text-foreground">
                  {valueFormat(s.value)}
                </span>
                <span className="tnum w-14 shrink-0 text-right text-xs text-muted-foreground">
                  {conv === null ? "—" : `${conv.toFixed(0)}%`}
                </span>
              </Row>
            </li>
          );
        })}
      </ol>
    </ChartFrame>
  );
}

/* ================================================== Heatmap (sequential) */

export function HeatmapChart({
  rows,
  columns,
  values,
  valueFormat = defaultFmt,
  rowLabelWidth = 120,
  onCellClick,
  scaleLabel,
  ...frame
}: Omit<ChartFrameProps, "children" | "series" | "tableColumns" | "tableData"> & {
  rows: string[];
  columns: string[];
  /** values[rowIndex][colIndex] */
  values: number[][];
  valueFormat?: Fmt;
  rowLabelWidth?: number;
  scaleLabel?: string;
  onCellClick?: (row: string, col: string, value: number) => void;
}) {
  const flat = values.flat();
  const max = Math.max(...flat, 1);
  const min = Math.min(...flat, 0);
  const norm = (v: number) => (max === min ? 0.5 : (v - min) / (max - min));

  return (
    <ChartFrame
      {...frame}
      tableData={rows.map((r, i) => ({
        row: r,
        ...Object.fromEntries(columns.map((c, j) => [c, values[i][j]])),
      }))}
      tableColumns={[
        { key: "row", label: "Row" },
        ...columns.map((c) => ({
          key: c,
          label: c,
          numeric: true,
          format: (v: unknown) => valueFormat(Number(v)),
        })),
      ]}
    >
      <div className="scrollbar-thin overflow-x-auto px-2 pb-1">
        <table className="w-full border-separate border-spacing-0.5 text-xs">
          <caption className="sr-only">{frame.title}</caption>
          <thead>
            <tr>
              <th style={{ width: rowLabelWidth }} className="text-left font-medium text-muted-foreground" />
              {columns.map((c) => (
                <th key={c} scope="col" className="px-1 pb-1 text-center text-xs font-medium text-muted-foreground">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r}>
                <th
                  scope="row"
                  className="truncate pr-2 text-left text-xs font-normal text-muted-foreground"
                  style={{ maxWidth: rowLabelWidth }}
                >
                  {r}
                </th>
                {columns.map((c, j) => {
                  const v = values[i][j];
                  const t = norm(v);
                  const Cellish = onCellClick ? "button" : "div";
                  return (
                    <td key={c} className="p-0">
                      <Cellish
                        {...(onCellClick
                          ? { type: "button" as const, onClick: () => onCellClick(r, c, v) }
                          : {})}
                        title={`${r} · ${c}: ${valueFormat(v)}`}
                        className={cn(
                          "tnum flex h-7 w-full items-center justify-center rounded-sm text-[11px] font-medium",
                          onCellClick && "hover:ring-2 hover:ring-ring focus-visible:ring-2 focus-visible:ring-ring",
                        )}
                        style={{
                          background: SEQUENTIAL[Math.round(t * (SEQUENTIAL.length - 1))],
                          color: t > 0.55 ? "#ffffff" : "var(--chart-ink)",
                        }}
                      >
                        {valueFormat(v)}
                      </Cellish>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* sequential scale legend — one hue, light -> dark */}
      <div className="flex items-center gap-2 px-3 pb-1 pt-2">
        <span className="text-xs text-muted-foreground">{scaleLabel ?? "Low"}</span>
        <div className="flex h-2 flex-1 overflow-hidden rounded-full">
          {SEQUENTIAL.map((c) => (
            <span key={c} className="h-full flex-1" style={{ background: c }} />
          ))}
        </div>
        <span className="tnum text-xs text-muted-foreground">{valueFormat(max)}</span>
      </div>
    </ChartFrame>
  );
}

/* ================================================ Diverging bar (polarity) */

export function DivergingBarChart({
  data,
  labelKey = "name",
  valueKey = "value",
  valueFormat = defaultFmt,
  height,
  ...frame
}: Omit<ChartFrameProps, "children" | "series" | "tableColumns" | "tableData"> & {
  data: Row[];
  labelKey?: string;
  valueKey?: string;
  valueFormat?: Fmt;
  height?: number;
}) {
  const maxAbs = Math.max(...data.map((d) => Math.abs(Number(d[valueKey]))), 1);
  return (
    <ChartFrame
      {...frame}
      tableData={data as Record<string, unknown>[]}
      tableColumns={[
        { key: labelKey, label: "Item" },
        { key: valueKey, label: "Change", numeric: true, format: (v) => valueFormat(Number(v)) },
      ]}
    >
      <ul className="flex flex-col gap-1 px-3 py-1" style={height ? { minHeight: height } : undefined}>
        {data.map((d) => {
          const v = Number(d[valueKey]);
          const w = (Math.abs(v) / maxAbs) * 50;
          const positive = v >= 0;
          return (
            <li key={String(d[labelKey])} className="flex items-center gap-2">
              <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">{String(d[labelKey])}</span>
              <span className="relative h-5 min-w-0 flex-1">
                <span className="absolute inset-y-0 left-1/2 w-px bg-border" aria-hidden />
                <span
                  className="absolute inset-y-0.5 rounded-sm"
                  style={{
                    width: `${w}%`,
                    left: positive ? "50%" : `${50 - w}%`,
                    background: positive ? DIVERGING[5] : DIVERGING[1],
                  }}
                />
              </span>
              <span className="tnum w-16 shrink-0 text-right text-xs font-medium text-foreground">
                {v > 0 ? "+" : ""}
                {valueFormat(v)}
              </span>
            </li>
          );
        })}
      </ul>
    </ChartFrame>
  );
}

/* ============================================================ Progress ring */

export function ProgressRing({
  value,
  max = 100,
  size = 56,
  thickness = 6,
  tone = "accent",
  label,
  sublabel,
  className,
}: {
  value: number;
  max?: number;
  size?: number;
  thickness?: number;
  tone?: "accent" | StatusTone;
  label?: React.ReactNode;
  sublabel?: string;
  className?: string;
}) {
  const pct = max === 0 ? 0 : Math.max(0, Math.min(1, value / max));
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const color = tone === "accent" ? "var(--primary)" : STATUS[tone];
  return (
    <div className={cn("relative inline-flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={`${Math.round(pct * 100)}%${sublabel ? ` ${sublabel}` : ""}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={thickness} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnum text-xs font-semibold leading-none text-foreground">
          {label ?? `${Math.round(pct * 100)}%`}
        </span>
        {sublabel && <span className="mt-0.5 text-[10px] leading-none text-muted-foreground">{sublabel}</span>}
      </span>
    </div>
  );
}

/* ================================================================ Gauge */

export function GaugeChart({
  value,
  max = 100,
  label,
  valueLabel,
  tone = "accent",
  height = 140,
}: {
  value: number;
  max?: number;
  label?: string;
  valueLabel?: string;
  tone?: "accent" | StatusTone;
  height?: number;
}) {
  const color = tone === "accent" ? "var(--primary)" : STATUS[tone];
  const data = [{ name: label ?? "value", value, fill: color }];
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height={height}>
        <RadialBarChart
          data={data}
          innerRadius="70%"
          outerRadius="100%"
          startAngle={210}
          endAngle={-30}
          barSize={12}
        >
          <PolarAngleAxis type="number" domain={[0, max]} tick={false} />
          <RadialBar background={{ fill: "var(--muted)" }} dataKey="value" cornerRadius={6} isAnimationActive={false} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-3">
        <span className="tnum text-lg font-semibold text-foreground">{valueLabel ?? num(value)}</span>
        {label && <span className="text-xs text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}

/* ============================================================= Sparkline */

export function Sparkline({
  data,
  dataKey = "value",
  width = 92,
  height = 26,
  tone = "accent",
  className,
  ariaLabel,
}: {
  data: Row[];
  dataKey?: string;
  width?: number;
  height?: number;
  tone?: "accent" | StatusTone | "series-1";
  className?: string;
  ariaLabel?: string;
}) {
  const color =
    tone === "accent" ? "var(--primary)" : tone === "series-1" ? SERIES[0] : STATUS[tone as StatusTone];
  const vals = data.map((d) => Number(d[dataKey]));
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const pts = vals
    .map((v, i) => {
      const x = (i / Math.max(1, vals.length - 1)) * (width - 2) + 1;
      const y = height - 2 - ((v - min) / span) * (height - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      width={width}
      height={height}
      className={cn("overflow-visible", className)}
      role="img"
      aria-label={ariaLabel ?? "Trend sparkline"}
    >
      <polyline points={pts} fill="none" stroke={color} strokeWidth={LINE_WIDTH} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ====================================== Horizontal share bar (single row) */

export function ShareBar({
  segments,
  total,
  valueFormat = defaultFmt,
  className,
  height = 8,
}: {
  segments: { key: string; label: string; value: number; color?: string; status?: StatusTone }[];
  total?: number;
  valueFormat?: Fmt;
  className?: string;
  height?: number;
}) {
  const t = (total ?? segments.reduce((a, b) => a + b.value, 0)) || 1;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex w-full gap-0.5 overflow-hidden rounded-full" style={{ height }}>
        {segments.map((s, i) => (
          <span
            key={s.key}
            title={`${s.label}: ${valueFormat(s.value)}`}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${(s.value / t) * 100}%`,
              background: s.color ?? (s.status ? STATUS[s.status] : SERIES[i % SERIES.length]),
            }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {segments.map((s, i) => (
          <li key={s.key} className="flex items-center gap-1.5 text-xs">
            <span
              aria-hidden
              className="size-2 rounded-[2px]"
              style={{ background: s.color ?? (s.status ? STATUS[s.status] : SERIES[i % SERIES.length]) }}
            />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="tnum font-medium text-foreground">{valueFormat(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --------------------------------------------------------------- re-export */

export { Legend };
