"use client";

/* Review-cycle phase timeline with open / close controls. */

import * as React from "react";
import { CheckCircle2, CircleDot, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateShort } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import type { CyclePhase } from "@/mock/engage";
import { Gated } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";

const STATE_META = {
  done: { icon: CheckCircle2, status: "completed", label: "Closed", tone: "text-success-fg" },
  open: { icon: CircleDot, status: "active", label: "Open", tone: "text-primary" },
  upcoming: { icon: Clock, status: "scheduled", label: "Upcoming", tone: "text-muted-foreground" },
} as const;

export function PhaseTimeline({
  phases,
  readOnly,
  onToggle,
}: {
  phases: CyclePhase[];
  readOnly: boolean;
  onToggle: (p: CyclePhase) => void;
}) {
  return (
    <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6" aria-label="Cycle phases">
      {phases.map((p, i) => {
        const meta = STATE_META[p.state];
        const Icon = meta.icon;
        const overdue = p.state === "open" && p.end < DEMO_TODAY;
        return (
          <li
            key={p.id}
            className={cn(
              "relative flex flex-col gap-1.5 rounded-md border p-2.5",
              p.state === "open" ? "border-primary/40 bg-primary-soft/40" : "border-border bg-card",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                <Icon className={cn("size-3.5", meta.tone)} aria-hidden />
                <span className="text-muted-foreground tnum">{i + 1}.</span> {p.label}
              </span>
            </div>
            <p className="tnum text-[11px] text-muted-foreground">
              {fmtDateShort(p.start)} → {fmtDateShort(p.end)}
            </p>
            <div className="flex items-center justify-between gap-1.5">
              <StatusBadge status={overdue ? "overdue" : meta.status} label={overdue ? "Past end date" : meta.label} />
              {!readOnly && p.state !== "done" && (
                <Gated menuKey="growth.cycles" action="E">
                  <Button size="sm" variant={p.state === "open" ? "outline" : "soft"} onClick={() => onToggle(p)}>
                    {p.state === "open" ? "Close" : "Open"}
                  </Button>
                </Gated>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
