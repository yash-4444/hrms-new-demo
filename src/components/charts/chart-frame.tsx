"use client";

import * as React from "react";
import type { TooltipContentProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { BarChart3, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/primitives";

/* ============================================================================
   The frame every chart in HRMS-NEW lives in.

   It is the enforcement point for three accessibility rules:
     1. ≥2 series  -> a legend is ALWAYS rendered (identity is never colour-alone)
     2. a Table view is ALWAYS reachable (the "relief rule" for low-contrast slots)
     3. texture is available on demand for the CVD / print / forced-colors case
   ========================================================================== */

export interface SeriesDef {
  key: string;
  label: string;
  color: string;
  /** rendered in the legend instead of a solid swatch */
  dashed?: boolean;
}

export interface ChartFrameProps {
  title: string;
  description?: string;
  /** Period selector / filters — one row, top-right of the frame. */
  actions?: React.ReactNode;
  series?: SeriesDef[];
  /** Rows backing the Table view. Required for the relief rule to be satisfied. */
  tableData?: Record<string, unknown>[];
  tableColumns?: { key: string; label: string; numeric?: boolean; format?: (v: unknown, row: Record<string, unknown>) => React.ReactNode }[];
  footnote?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
  /** Set when the chart draws its own labels beside each mark. */
  directLabelled?: boolean;
}

export function ChartFrame({
  title,
  description,
  actions,
  series,
  tableData,
  tableColumns,
  footnote,
  className,
  bodyClassName,
  children,
}: ChartFrameProps) {
  const [view, setView] = React.useState<"chart" | "table">("chart");
  const hasTable = Boolean(tableData?.length && tableColumns?.length);
  const showLegend = (series?.length ?? 0) >= 2;

  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2 p-4 pb-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 no-print">
          {actions}
          {hasTable && (
            <div className="flex items-center rounded-md border border-border p-0.5">
              <Hint text="Chart view">
                <Button
                  variant={view === "chart" ? "secondary" : "ghost"}
                  size="icon-sm"
                  aria-label="Chart view"
                  aria-pressed={view === "chart"}
                  onClick={() => setView("chart")}
                >
                  <BarChart3 />
                </Button>
              </Hint>
              <Hint text="Table view — the same numbers, readable without colour">
                <Button
                  variant={view === "table" ? "secondary" : "ghost"}
                  size="icon-sm"
                  aria-label="Table view"
                  aria-pressed={view === "table"}
                  onClick={() => setView("table")}
                >
                  <Table2 />
                </Button>
              </Hint>
            </div>
          )}
        </div>
      </div>

      {showLegend && view === "chart" && <ChartLegend series={series!} className="px-4 pb-1" />}

      <div className={cn("min-w-0 flex-1 px-2 pb-2", bodyClassName)}>
        {view === "chart" ? children : <ChartTable data={tableData!} columns={tableColumns!} />}
      </div>

      {footnote && (
        <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">{footnote}</p>
      )}
    </Card>
  );
}

/* ----------------------------------------------------------------- Legend */

export function ChartLegend({
  series,
  className,
  onToggle,
  hidden,
}: {
  series: SeriesDef[];
  className?: string;
  onToggle?: (key: string) => void;
  hidden?: Set<string>;
}) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
      {series.map((s) => {
        const off = hidden?.has(s.key);
        const content = (
          <>
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-[2px]"
              style={{
                background: s.dashed ? "transparent" : s.color,
                border: s.dashed ? `1.5px dashed ${s.color}` : undefined,
                opacity: off ? 0.35 : 1,
              }}
            />
            <span className={cn("text-xs", off ? "text-muted-foreground line-through" : "text-muted-foreground")}>
              {s.label}
            </span>
          </>
        );
        return (
          <li key={s.key}>
            {onToggle ? (
              <button
                type="button"
                onClick={() => onToggle(s.key)}
                aria-pressed={!off}
                className="flex items-center gap-1.5 rounded px-0.5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                {content}
              </button>
            ) : (
              <span className="flex items-center gap-1.5">{content}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------ Table view */

function ChartTable({
  data,
  columns,
}: {
  data: Record<string, unknown>[];
  columns: NonNullable<ChartFrameProps["tableColumns"]>;
}) {
  return (
    <div className="scrollbar-thin max-h-[300px] overflow-auto px-2">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-card">
          <tr className="border-b border-border">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                data-numeric={c.numeric ? "" : undefined}
                className={cn(
                  "px-2 py-1.5 font-medium text-muted-foreground",
                  c.numeric ? "text-right" : "text-left",
                )}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-border/60 last:border-0">
              {columns.map((c) => (
                <td
                  key={c.key}
                  data-numeric={c.numeric ? "" : undefined}
                  className={cn("px-2 py-1.5", c.numeric ? "text-right" : "text-left")}
                >
                  {c.format ? c.format(row[c.key], row) : String(row[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------------------------------------- Tooltip */

export interface TooltipRow {
  label: string;
  value: React.ReactNode;
  color?: string;
}

export function VizTooltip({
  heading,
  rows,
  footer,
}: {
  heading?: React.ReactNode;
  rows: TooltipRow[];
  footer?: React.ReactNode;
}) {
  return (
    <div className="pointer-events-none min-w-[140px] rounded-md border border-border bg-popover px-2.5 py-2 text-xs shadow-md">
      {heading && <p className="mb-1.5 font-semibold text-popover-foreground">{heading}</p>}
      <ul className="flex flex-col gap-1">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {r.color && (
                <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ background: r.color }} />
              )}
              {r.label}
            </span>
            <span className="tnum font-medium text-popover-foreground">{r.value}</span>
          </li>
        ))}
      </ul>
      {footer && <p className="mt-1.5 border-t border-border pt-1.5 text-muted-foreground">{footer}</p>}
    </div>
  );
}

/** Recharts content adapter — builds a VizTooltip from a Recharts payload. */
export function makeTooltip(
  format: (v: number, key: string) => React.ReactNode,
  labelFormat?: (label: string) => React.ReactNode,
  seriesLabels?: Record<string, string>,
) {
  const Content = (props: TooltipContentProps<ValueType, NameType>) => {
    if (!props.active || !props.payload?.length) return null;
    const rows = props.payload
      .filter((p) => p.value !== undefined && p.value !== null)
      .map((p) => {
        const key = String(p.dataKey ?? p.name ?? "");
        return {
          label: String(seriesLabels?.[key] ?? p.name ?? key),
          value: format(Number(p.value), key),
          color: p.color ?? p.stroke ?? p.fill,
        };
      });
    return (
      <VizTooltip
        heading={labelFormat ? labelFormat(String(props.label ?? "")) : String(props.label ?? "")}
        rows={rows}
      />
    );
  };
  Content.displayName = "VizTooltipContent";
  return Content;
}
