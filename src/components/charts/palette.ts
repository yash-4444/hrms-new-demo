/* ============================================================================
   Chart palette — the ONLY place a chart colour is chosen.

   Values live as CSS custom properties in globals.css so light/dark swap in
   one place; SVG fill/stroke accept var() directly, so a theme toggle repaints
   every chart with no JS.

   Rules enforced by construction:
     • categorical slots are assigned in FIXED order and never cycled
     • a 9th series is never generated — it folds into "Other"
     • sequential = one hue light->dark; diverging = two hues + neutral gray mid
     • status colours are reserved and never used as "series 4"
     • colour follows the ENTITY, not its rank (see seriesColorFor)

   Validated with the dataviz validator against this app's real surfaces
   (#ffffff light / #18181b dark) — all checks pass in both modes. Three light
   slots sit under 3:1 contrast, so every chart ships legend + direct labels or
   the table view (the "relief rule").
   ========================================================================== */

export const SERIES = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
] as const;

export const SERIES_HUE_NAME = [
  "blue",
  "orange",
  "aqua",
  "yellow",
  "magenta",
  "green",
  "violet",
  "red",
] as const;

/** Max series before folding to "Other". Scatter/bubble/choropleth cap at 3. */
export const MAX_SERIES = 8;
export const MAX_SERIES_ALL_PAIRS = 3;

export const SEQUENTIAL = [
  "var(--seq-1)",
  "var(--seq-2)",
  "var(--seq-3)",
  "var(--seq-4)",
  "var(--seq-5)",
  "var(--seq-6)",
  "var(--seq-7)",
] as const;

/** Discrete ordered marks (funnel stages, tiers) — lightest step still clears 2:1. */
export const ORDINAL = [
  "var(--ord-1)",
  "var(--ord-2)",
  "var(--ord-3)",
  "var(--ord-4)",
  "var(--ord-5)",
  "var(--ord-6)",
] as const;

export const DIVERGING = [
  "var(--div-neg-3)",
  "var(--div-neg-2)",
  "var(--div-neg-1)",
  "var(--div-mid)",
  "var(--div-pos-1)",
  "var(--div-pos-2)",
  "var(--div-pos-3)",
] as const;

export const STATUS = {
  good: "var(--status-good)",
  warning: "var(--status-warning)",
  serious: "var(--status-serious)",
  critical: "var(--status-critical)",
} as const;
export type StatusTone = keyof typeof STATUS;

export const CHART_SURFACE = "var(--chart-surface)";
export const CHART_GRID = "var(--chart-grid)";
export const CHART_AXIS = "var(--chart-axis)";
export const CHART_INK = "var(--chart-ink)";
export const CHART_INK_MUTED = "var(--chart-ink-muted)";

/* -------------------------------------------------------------------------- */

/**
 * Colour follows the ENTITY, not its rank. Pass a stable registry of every
 * entity that can appear in the chart (in a fixed order) and a filter that
 * removes some of them will NOT repaint the survivors.
 */
export function seriesColorFor(entity: string, registry: readonly string[]) {
  const i = registry.indexOf(entity);
  if (i < 0 || i >= MAX_SERIES) return "var(--muted-foreground)"; // "Other"
  return SERIES[i];
}

export function makeScale(registry: readonly string[]) {
  const map = new Map<string, string>();
  registry.slice(0, MAX_SERIES).forEach((e, i) => map.set(e, SERIES[i]));
  return {
    color: (entity: string) => map.get(entity) ?? "var(--muted-foreground)",
    entries: () => [...map.entries()],
  };
}

/** Bucket a 0..1 magnitude onto the sequential ramp. */
export function sequentialStep(t: number) {
  const i = Math.min(
    SEQUENTIAL.length - 1,
    Math.max(0, Math.round(t * (SEQUENTIAL.length - 1))),
  );
  return SEQUENTIAL[i];
}

/** Bucket a -1..1 signed value onto the diverging ramp (index 3 is neutral). */
export function divergingStep(t: number) {
  const clamped = Math.max(-1, Math.min(1, t));
  const i = Math.round(clamped * 3) + 3;
  return DIVERGING[i];
}

/** Ordered texture angle for the CVD / print / forced-colors channel. */
export function textureClass(index: number) {
  return index % 2 === 0 ? "viz-texture-45" : "viz-texture-135";
}

/* --------------------------------------------------- shared chart geometry */

export const AXIS_PROPS = {
  stroke: CHART_AXIS,
  tickLine: false,
  axisLine: false,
  tick: { fill: "var(--chart-ink-muted)", fontSize: 11 },
} as const;

/** 2px surface ring between adjacent / stacked fills. */
export const FILL_SEPARATOR = {
  stroke: CHART_SURFACE,
  strokeWidth: 2,
} as const;

export const LINE_WIDTH = 2;
export const DOT_SIZE = 8;
export const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0];
export const BAR_RADIUS_H: [number, number, number, number] = [0, 4, 4, 0];
