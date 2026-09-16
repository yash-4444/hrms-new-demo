# 04 · Charts

Every chart in HRMS-NEW goes through `src/components/charts`. Recharts is an
implementation detail — **no screen imports it directly**, and no screen ever picks a
colour.

## Why the indirection

A chart is read by people and executed by code. The wrapper makes six things true by
construction instead of by discipline:

1. Colour is assigned from a **fixed, validated palette** — never ad hoc.
2. Colour follows the **entity**, never its rank, so filtering doesn't repaint survivors.
3. A **legend** is always present when there are ≥2 series.
4. A **Table view** is always one click away.
5. Grid and axes are **recessive**; marks are thin; fills are separated by a 2px surface ring.
6. There is **exactly one y-axis**, always.

## Using it

```tsx
import { TrendAreaChart, BarCompareChart, DonutChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { inrCompact } from "@/lib/format";

<TrendAreaChart
  title="Payroll cost trend"
  description="Employee gross and employer statutory cost, month by month."
  data={rows}                       // [{ month: "Sep 26", gross: 1234, employerCost: 567 }]
  xKey="month"
  series={[
    { key: "gross",        label: "Employee gross" },
    { key: "employerCost", label: "Employer cost"  },
  ]}
  stacked
  valueFormat={inrCompact}
  height={260}
  footnote="Employer cost = PF 12% + ESI 3.25% where applicable + 4.81% gratuity."
/>
```

Colours come from the **order of the `series` array**. Slot 1 is blue, slot 2 orange, slot
3 aqua, and so on. You never pass a colour.

### The components

| Component | Use it for |
|---|---|
| `TrendLineChart` | change over time, one axis, optional reference line |
| `TrendAreaChart` | same, when magnitude matters; `stacked` for composition |
| `BarCompareChart` | comparison across categories; `stacked`, `horizontal`, `onBarClick` |
| `DonutChart` | share of a whole, with a hero figure in the middle |
| `FunnelChart` | ordered stages with stage-to-stage conversion |
| `HeatmapChart` | two dimensions × one magnitude, sequential ramp |
| `DivergingBarChart` | signed values around a neutral midpoint |
| `ProgressRing` | one ratio, inline (leave balance, goal progress) |
| `GaugeChart` | one value against a target |
| `Sparkline` | trend inside a KPI tile or table cell |
| `ShareBar` | a single composition bar with an inline legend |
| `StatTile` / `StatRow` | when the answer is one number, not a chart |

## The colour system

Defined once in `globals.css`, consumed only through `charts/palette.ts`.

### Categorical — identity

Eight slots, in a fixed order that is itself the accessibility mechanism:

| Slot | Hue | Light | Dark |
|---|---|---|---|
| 1 | blue | `#2a78d6` | `#3987e5` |
| 2 | orange | `#eb6834` | `#d95926` |
| 3 | aqua | `#1baf7a` | `#199e70` |
| 4 | yellow | `#eda100` | `#c98500` |
| 5 | magenta | `#e87ba4` | `#d55181` |
| 6 | green | `#008300` | `#008300` |
| 7 | violet | `#4a3aa7` | `#9085e9` |
| 8 | red | `#e34948` | `#e66767` |

Rules:

- **Never cycle.** A ninth series folds into "Other", becomes small multiples, or the
  chart gets faceted. It never wraps back to slot 1.
- **Colour follows the entity.** Use `makeScale(registry)` or pass `registry` so
  "Engineering" is the same blue whether or not Sales is currently filtered out.
- Scatter/bubble/choropleth cap at **three** slots — with every pair on screen at once,
  more than three cannot clear the separation floors.

### Sequential — magnitude

One hue, light → dark (`--seq-1` … `--seq-7`). Heatmaps, choropleths, the 9-box grid.
Never a rainbow. For *ordinal* marks (funnel stages, tiers) use `ORDINAL` instead — it
starts at a darker step so the lightest band still reads against the surface.

### Diverging — polarity

Blue ↔ red with a **neutral grey midpoint** (`--div-mid`). Two cool hues would fail,
because the midpoint has to read as "nothing".

### Status — state

`good` / `warning` / `serious` / `critical`. These are **reserved**: a status colour is
never reused as "series 4", and it always ships with an icon and a label.

## Validation — computed, not eyeballed

The palette was run through the dataviz validator against this app's real surfaces
(`#ffffff` light, `#18181b` dark):

```
Light  ✓ lightness band  ✓ chroma floor  ✓ CVD separation (worst ΔE 9.1)
       ✓ normal-vision floor (worst ΔE 19.6)   ⚠ contrast: 3 slots under 3:1
Dark   ✓ lightness band  ✓ chroma floor  ✓ CVD separation (worst ΔE 8.4)
       ✓ normal-vision floor (worst ΔE 19.3)   ✓ contrast: all ≥ 3:1
```

The light-mode contrast warning is **not dismissable** — it obliges *relief*: visible
direct labels or a table view. That is precisely why `ChartFrame` always ships the Table
toggle. Do not remove it.

**If you change a palette value, re-run the validator.** Do not reason about ΔE by eye.

## Anti-patterns — these are bugs

- A **dual-axis chart**. Two measures of different scale → two charts, small multiples,
  or index both to a common base. This is the single most common chart mistake.
- A number printed on **every** point. Label selectively.
- A **rainbow** sequential ramp, or a hue at a diverging midpoint.
- A legend omitted because "you can tell from the colours". You can't, and neither can
  8% of men.
- A status colour used decoratively.
- A grid heavier than the data.
- Passing a raw hex anywhere in `src/app/`.

## Accessibility contract

Every chart ships colour **plus** at least one other channel:

- ≥2 series → a legend, always.
- ≤4 series → direct labels too.
- Every frame with data → a Table view button.
- Tooltips on hover: crosshair on line/area, per-mark on bar/dot/cell.
- Texture utilities (`.viz-texture-45` / `.viz-texture-135`) are available for the
  print and `forced-colors` case.
- Dark mode is **selected**, not flipped — its steps were chosen and validated against
  the dark surface independently.
