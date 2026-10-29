import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Deterministic pseudo-random — keeps fixtures identical on every render/SSR pass. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function randInt(rng: () => number, min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/**
 * Seeded shuffle — the replacement for `[...arr].sort(() => rng() - 0.5)`.
 *
 * A random comparator makes the result depend on the engine's sort algorithm
 * (how many times, and in what order, it calls the comparator), and Node's V8
 * and the browser's V8 disagree. The fixtures were authored against Node, so
 * the static prerender and the hydrating browser built different employees.
 * This replays Node 22's V8 path for short arrays (count-and-make-run, then
 * binary insertion — every caller here is well under 64 items) in plain code,
 * so every engine consumes the rng identically and produces the same order.
 */
export function seededShuffle<T>(rng: () => number, input: readonly T[]): T[] {
  const a = [...input];
  const n = a.length;
  if (n < 2) return a;
  const cmp = () => rng() - 0.5;
  /* Count the leading run; a strictly descending one is reversed in place. */
  let run = 2;
  const descending = cmp() < 0;
  for (let i = 2; i < n; i++) {
    const order = cmp();
    if (descending ? order >= 0 : order < 0) break;
    run++;
  }
  if (descending) a.splice(0, run, ...a.slice(0, run).reverse());
  /* Binary-insert the rest. */
  for (let start = run; start < n; start++) {
    const pivot = a[start];
    let left = 0;
    let right = start;
    while (left < right) {
      const mid = left + ((right - left) >> 1);
      if (cmp() < 0) right = mid;
      else left = mid + 1;
    }
    for (let p = start; p > left; p--) a[p] = a[p - 1];
    a[left] = pivot;
  }
  return a;
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function sum(values: number[]) {
  return values.reduce((a, b) => a + b, 0);
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Stable colour index for an avatar chip, derived from the name. */
export function avatarTone(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 8;
}
