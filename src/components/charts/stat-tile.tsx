"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Sparkline } from "./index";
import type { StatusTone } from "./palette";

/* ============================================================================
   KPI tile. A hero number is a *form choice*, not a fallback — when the answer
   is one figure, the tile beats a chart.

   Delta carries its sign in the STRING and an arrow icon, so it never depends
   on colour alone. `goodDirection` decides whether up is green or red
   (attrition rising is bad; headcount rising is good).
   ========================================================================== */

export interface StatTileProps {
  label: string;
  value: React.ReactNode;
  /** Signed percentage change vs. the comparison period. */
  deltaValue?: number;
  deltaSuffix?: string;
  deltaLabel?: string;
  goodDirection?: "up" | "down" | "none";
  hint?: React.ReactNode;
  icon?: React.ElementType;
  /** Drill-down target — every KPI tile should be clickable. */
  href?: string;
  onClick?: () => void;
  spark?: { value: number }[];
  tone?: StatusTone | "accent" | "neutral";
  className?: string;
  footer?: React.ReactNode;
  compact?: boolean;
}

export function StatTile({
  label,
  value,
  deltaValue,
  deltaSuffix = "%",
  deltaLabel,
  goodDirection = "up",
  hint,
  icon: Icon,
  href,
  onClick,
  spark,
  tone = "neutral",
  className,
  footer,
  compact,
}: StatTileProps) {
  const isGood =
    deltaValue === undefined || goodDirection === "none" || deltaValue === 0
      ? null
      : goodDirection === "up"
        ? deltaValue > 0
        : deltaValue < 0;

  const DeltaIcon = deltaValue === undefined ? Minus : deltaValue > 0 ? TrendingUp : deltaValue < 0 ? TrendingDown : Minus;

  const accentBar = {
    accent: "bg-primary",
    good: "bg-success",
    warning: "bg-warning",
    serious: "bg-serious",
    critical: "bg-destructive",
    neutral: "bg-transparent",
  }[tone];

  const body = (
    <>
      {tone !== "neutral" && <span className={cn("absolute inset-y-0 left-0 w-0.5 rounded-l-md", accentBar)} aria-hidden />}
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon && <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
      </div>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className={cn("font-semibold tracking-tight text-foreground", compact ? "text-base" : "text-lg")}>
            {value}
          </p>
          {deltaValue !== undefined && (
            <p
              className={cn(
                "mt-0.5 flex items-center gap-1 text-xs font-medium",
                isGood === null ? "text-muted-foreground" : isGood ? "text-success-fg" : "text-destructive-fg",
              )}
            >
              <DeltaIcon className="size-3" aria-hidden />
              <span className="tnum">
                {deltaValue > 0 ? "+" : deltaValue < 0 ? "−" : ""}
                {Math.abs(deltaValue).toFixed(1)}
                {deltaSuffix}
              </span>
              {deltaLabel && <span className="font-normal text-muted-foreground">{deltaLabel}</span>}
            </p>
          )}
          {hint && !deltaValue && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {spark && spark.length > 1 && (
          <Sparkline
            data={spark}
            tone="series-1"
            width={76}
            height={24}
            ariaLabel={`${label} trend`}
            className="shrink-0 pb-1"
          />
        )}
      </div>
      {footer && <div className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">{footer}</div>}
      {(href || onClick) && (
        <ArrowRight
          className="absolute right-3 top-3 size-3.5 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
          aria-hidden
        />
      )}
    </>
  );

  const shell = cn(
    "group relative block w-full overflow-hidden rounded-md border border-border bg-card p-3 text-left transition-colors",
    (href || onClick) && "hover:border-primary/40 hover:bg-subtle focus-visible:ring-2 focus-visible:ring-ring",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={shell}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={shell}>
        {body}
      </button>
    );
  }
  return <Card className={cn(shell, "cursor-default")}>{body}</Card>;
}

/** Responsive KPI row. */
export function StatRow({
  children,
  cols = 4,
  className,
}: {
  children: React.ReactNode;
  cols?: 2 | 3 | 4 | 5;
  className?: string;
}) {
  const grid = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
    5: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  }[cols];
  return <div className={cn("grid grid-cols-1 gap-3", grid, className)}>{children}</div>;
}
