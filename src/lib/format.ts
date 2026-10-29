import { format, formatDistanceStrict, isValid, parseISO } from "date-fns";
import { DEMO_NOW } from "@/mock/org";

/* ---------------------------------------------------------------- currency */

const inrFull = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inrWhole = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inNum = new Intl.NumberFormat("en-IN");

/** ₹1,23,456.78 — Indian digit grouping, always. */
export function inr(value: number, opts?: { decimals?: boolean }) {
  const decimals = opts?.decimals ?? true;
  return (decimals ? inrFull : inrWhole).format(value);
}

/** Compact Indian money for axis ticks and KPI tiles: ₹1.23 Cr / ₹4.5 L / ₹12,300 */
export function inrCompact(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(abs >= 1e8 ? 1 : 2)} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(abs >= 1e6 ? 1 : 2)} L`;
  if (abs >= 1e3) return `${sign}₹${inNum.format(Math.round(abs))}`;
  return `${sign}₹${abs.toFixed(0)}`;
}

/** 1,23,456 — Indian grouping without the currency symbol. */
export function num(value: number, decimals = 0) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function pct(value: number, decimals = 1) {
  return `${value.toFixed(decimals)}%`;
}

/** Signed delta for KPI tiles — the sign is part of the string, not just the colour. */
export function delta(value: number, decimals = 1, unit = "%") {
  const s = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${s}${Math.abs(value).toFixed(decimals)}${unit}`;
}

/* -------------------------------------------------------------------- date */

export const toDate = (d: string | Date) => (typeof d === "string" ? parseISO(d) : d);

/** "—" for a missing or unparseable date — one bad fixture row must not take
    the whole screen down with a RangeError from date-fns. */
const safeFormat = (d: string | Date | null | undefined, pattern: string) => {
  const date = d == null ? null : toDate(d);
  return date && isValid(date) ? format(date, pattern) : "—";
};

export const fmtDate = (d: string | Date) => safeFormat(d, "dd MMM yyyy");
export const fmtDateShort = (d: string | Date) => safeFormat(d, "dd MMM");
export const fmtDay = (d: string | Date) => safeFormat(d, "EEE, dd MMM");
export const fmtMonth = (d: string | Date) => safeFormat(d, "MMM yyyy");
export const fmtTime = (d: string | Date) => safeFormat(d, "hh:mm a");
export const fmtDateTime = (d: string | Date) => safeFormat(d, "dd MMM yyyy, hh:mm a");
export const fmtIso = (d: Date) => format(d, "yyyy-MM-dd");
/** "2 hours ago" / "in 3 days", measured from the demo's fixed now (DEMO_NOW),
    never the wall clock — so the label is stable and SSR matches the client. */
export const fmtAgo = (d: string | Date) => {
  const when = d == null ? null : toDate(d);
  if (!when || !isValid(when)) return "—";
  const now = parseISO(DEMO_NOW);
  if (Math.abs(when.getTime() - now.getTime()) < 60_000) return "just now";
  const dist = formatDistanceStrict(when, now);
  return when > now ? `in ${dist}` : `${dist} ago`;
};

/** Seconds -> 07:42:13 for the live punch timer. */
export function hms(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, "0")).join(":");
}

/** Minutes -> "8h 45m" */
export function hm(totalMinutes: number) {
  const m = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

export function days(n: number) {
  return `${n % 1 === 0 ? n : n.toFixed(1)} ${n === 1 ? "day" : "days"}`;
}

/** Financial-year label for a date under an Apr–Mar or Jan–Dec start month. */
export function fyLabel(d: string | Date, startMonth: 1 | 4 = 4) {
  const dt = toDate(d);
  const y = dt.getFullYear();
  if (startMonth === 1) return `CY ${y}`;
  const start = dt.getMonth() + 1 >= 4 ? y : y - 1;
  return `FY ${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}
