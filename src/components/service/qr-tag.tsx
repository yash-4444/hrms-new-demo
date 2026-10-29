"use client";

import * as React from "react";
import { mulberry32 } from "@/lib/utils";

/* A QR-style asset label drawn in SVG. The module pattern is seeded from the
   tag, so each asset always prints the same code. It renders black-on-white
   in both themes because that is what a printed label looks like. */

const N = 25;

function seedOf(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function finder(x: number, y: number) {
  return (cx: number, cy: number) => {
    const dx = cx - x;
    const dy = cy - y;
    if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return null;
    const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
    return ring === 3 || ring <= 1;
  };
}

export function QrTag({ value, size = 132, label }: { value: string; size?: number; label?: string }) {
  const cells = React.useMemo(() => {
    const rng = mulberry32(seedOf(value));
    const finders = [finder(0, 0), finder(N - 7, 0), finder(0, N - 7)];
    const on: [number, number][] = [];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const f = finders.map((fn) => fn(x, y)).find((r) => r !== null);
        const quiet = (x <= 7 && y <= 7) || (x >= N - 8 && y <= 7) || (x <= 7 && y >= N - 8);
        const timing = (x === 6 || y === 6) && !quiet;
        const filled = f !== undefined ? f : quiet ? false : timing ? (x + y) % 2 === 0 : rng() < 0.48;
        if (filled) on.push([x, y]);
      }
    }
    return on;
  }, [value]);

  return (
    <figure className="flex flex-col items-center gap-1.5">
      <svg
        viewBox={`-2 -2 ${N + 4} ${N + 4}`}
        width={size}
        height={size}
        role="img"
        aria-label={`QR code for ${value}`}
        className="rounded-md border border-border bg-white"
        shapeRendering="crispEdges"
      >
        <rect x={-2} y={-2} width={N + 4} height={N + 4} fill="#ffffff" />
        {cells.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#101014" />
        ))}
      </svg>
      <figcaption className="font-mono text-[11px] font-medium text-foreground">{label ?? value}</figcaption>
    </figure>
  );
}
