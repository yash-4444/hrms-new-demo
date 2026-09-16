# 03 · Design system

Everything lives in `src/app/globals.css` as CSS custom properties, exposed to Tailwind 4
through `@theme inline`. There is no `tailwind.config.js` — Tailwind 4 is CSS-first.

To change a colour product-wide, change it in one place in `globals.css`. Both themes are
declared there: `:root` for light, `.dark` for dark.

---

## Principles

1. **Enterprise density.** Compact rows, small controls, tight spacing. A screen that
   shows 25 rows without scrolling beats one that shows 8 beautifully.
2. **Calm and professional.** Neutral base, exactly one accent (indigo). No gradients, no
   glassmorphism, no decorative colour.
3. **Colour means something.** Semantic colour is reserved for **status** and for **chart
   series**. It is never used to make a card look nice.
4. **Both themes are designed.** Dark is not an inverted light theme; its values were
   picked against the dark surface. Every screen must be checked in both.

---

## Colour

### Neutrals and surfaces

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--background` | `#f7f7f8` | `#0d0d0f` | the page plane |
| `--card` | `#ffffff` | `#18181b` | every card, table, panel |
| `--subtle` | `#fafafb` | `#141417` | table headers, inset panels |
| `--muted` | `#f1f1f3` | `#232327` | hover, chips, skeletons |
| `--border` | `#e4e4e8` | `#2a2a2f` | every hairline |
| `--foreground` | `#101014` | `#f4f4f5` | primary ink |
| `--muted-foreground` | `#64646e` | `#a1a1ab` | secondary ink |

Tailwind classes: `bg-card`, `bg-subtle`, `bg-muted`, `border-border`, `text-foreground`,
`text-muted-foreground`.

### Accent

One accent, indigo. `--primary` `#4f46e5` (light) / `#6366f1` (dark), plus a soft pair
(`--primary-soft` / `--primary-soft-foreground`) for selected nav items, chips and
low-emphasis fills.

### Semantic status colour

Four tones, each with a solid, a foreground-safe text colour, and a soft background:

| Tone | Solid | Meaning |
|---|---|---|
| `success` | `#0ca30c` | approved, present, paid, on track, filed |
| `warning` | `#fab219` | pending, half day, at risk, due soon |
| `serious` | `#ec835a` | sent back, notice period, locked, overtime |
| `destructive` | `#d03b3b` | rejected, absent, overdue, breached |
| `info` | `#2a78d6` | submitted, in review, on leave, scheduled |

Classes: `bg-success-soft text-success-fg`, `bg-warning-soft text-warning-fg`, and so on.

> **Rule:** a status colour never appears without an icon and a label. Colour alone fails
> for colour-blind viewers, in print, and in forced-colors mode.

---

## The status vocabulary

`src/components/ui/status-badge.tsx` holds **one map** of every status string in the
product to a `{ label, tone, icon }` triple. "Approved" is the same green with the same
check icon on the leave queue, the pay run, the expense claim and the requisition —
because they all resolve through the same map.

```tsx
<StatusBadge status="approved" />     // ✓ Approved, success tone
<StatusBadge status="sla_breached" /> // ⬣ Breached, destructive tone
<StatusDot status="present" />        // dense table variant
```

**Adding a status:** add it to `STATUS_MAP`, do not invent a local chip. If you find
yourself writing `<span className="bg-green-100 …">` you are creating the inconsistency
this map exists to prevent.

Current groups in the map: generic workflow, employment, attendance day states, payroll,
hiring, helpdesk SLA, assets, compliance, goals and reviews.

---

## Typography

One family: **Inter**, loaded via `next/font` and bound to `--font-sans`.

Four sizes only:

| Token | Size | Used for |
|---|---|---|
| `text-xs` | 12px | table cells, captions, metadata — the workhorse |
| `text-sm` | 13px | body, labels, section titles |
| `text-base` | 15px | card titles |
| `text-lg` | 18px | page titles, hero figures |

**Tabular numerals are mandatory on every figure column.** Add `className="tnum"` or the
`data-numeric` attribute; the global CSS turns on `font-variant-numeric: tabular-nums`.
Without it, columns of rupee amounts visibly wobble.

Large standalone numbers (KPI values, hero figures) use the default proportional figures —
they read better at size and have nothing to align with.

---

## Shape, depth and motion

- Radius: `--radius` = `0.375rem` (`rounded-md`). Dialogs use `rounded-lg`.
- Borders: 1px hairline in `--border`. This is the primary separator, not shadow.
- Shadow: `shadow-xs` on cards, `shadow-md` on popovers, `shadow-lg` on dialogs. Nothing
  heavier.
- Motion: fast and functional. Everything is disabled under
  `prefers-reduced-motion: reduce`.

---

## Money and dates

Never format by hand. `src/lib/format.ts` is the only formatter.

```ts
inr(123456.78)        // "₹1,23,456.78"   Indian digit grouping, always
inr(123456, {decimals:false})  // "₹1,23,456"
inrCompact(12300000)  // "₹1.23 Cr"       for axis ticks and KPI tiles
num(340)              // "340"
pct(13.4)             // "13.4%"
delta(-2.1)           // "−2.1%"          sign is in the string, not just the colour

fmtDate("2026-09-16")      // "16 Sep 2026"
fmtDateTime(…)             // "16 Sep 2026, 02:35 PM"
hms(27_732)                // "07:42:12"   the live punch timer
hm(525)                    // "8h 45m"
fyLabel("2026-09-16", 4)   // "FY 2026-27"
```

---

## Accessibility baseline

Non-negotiable, and cheap if done as you go:

- `aria-label` on every icon-only button.
- `role="alert"` on error text.
- A visible focus ring everywhere (global `:focus-visible`, 2px in `--ring`).
- A skip-to-content link, first in the app shell.
- Keyboard parity for every mouse-only interaction — the kanban board and the 9-box grid
  both ship a "Move to…" dropdown beside drag-and-drop.
- Data tables support <kbd>↑</kbd>/<kbd>↓</kbd> row navigation and <kbd>Enter</kbd> to open.
- Colour is never the only channel: status = colour + icon + label; charts = colour +
  legend + direct labels + a Table view.

---

## Responsive behaviour

| Breakpoint | Sidebar | Layout |
|---|---|---|
| `≥ lg` | full, collapsible to a 52px icon rail | multi-column grids |
| `md` – `lg` | collapses to a sheet behind the hamburger | grids fold to one or two columns |
| `< md` | sheet | single column; wide tables scroll horizontally inside their card |

Wide content (tables, the roles matrix, the kanban board) scrolls inside its own
`overflow-x-auto` container. The page body never scrolls horizontally.
