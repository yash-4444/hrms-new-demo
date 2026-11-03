"use client";

import * as React from "react";
import { AlertTriangle, Check, Octagon } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtAgo, hm, num } from "@/lib/format";
import type { HealthStatus, QueueDepth, ServiceHealth } from "@/mock/console-health";
import { Section } from "@/components/shell/page";
import { TonePill, type PTone } from "@/components/platform/kit";
import { Card } from "@/components/ui/card";

/* System Health — dependency cards and queue depths. */

export const HEALTH_STYLE: Record<HealthStatus, { label: string; tone: PTone; icon: React.ElementType }> = {
  healthy: { label: "Healthy", tone: "success", icon: Check },
  degraded: { label: "Degraded", tone: "warning", icon: AlertTriangle },
  unhealthy: { label: "Unhealthy", tone: "danger", icon: Octagon },
};

export function HealthPill({ status }: { status: HealthStatus }) {
  const s = HEALTH_STYLE[status];
  return (
    <TonePill tone={s.tone} icon={s.icon}>
      {s.label}
    </TonePill>
  );
}

export function ServiceCards({ services }: { services: ServiceHealth[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {services.map((s) => (
        <Card key={s.id} className={cn("flex flex-col gap-2 p-3.5", s.status === "degraded" && "border-warning/40", s.status === "unhealthy" && "border-destructive/40")}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold tracking-tight text-foreground">{s.name}</h3>
              <p className="truncate text-[11px] text-muted-foreground">{s.provider}</p>
            </div>
            <HealthPill status={s.status} />
          </div>
          <p className="text-xs text-muted-foreground">{s.detail}</p>
          <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-border pt-2 text-xs">
            <div>
              <dt className="text-[11px] text-muted-foreground">Latency</dt>
              <dd className="tnum font-medium text-foreground">{num(s.latencyMs)} ms</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">Uptime 30d</dt>
              <dd className={cn("tnum font-medium", s.uptime30d < 99.95 ? "text-warning-fg" : "text-foreground")}>{s.uptime30d.toFixed(2)}%</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">Checked</dt>
              <dd className="tnum font-medium text-foreground">{fmtAgo(s.lastChecked)}</dd>
            </div>
          </dl>
          <p className="text-[11px] text-muted-foreground">{s.critical ? "Critical — can mark the platform Unhealthy" : "Non-critical — reports Degraded at worst"}</p>
        </Card>
      ))}
    </div>
  );
}

const age = (sec: number) => (sec < 60 ? `${sec}s` : sec < 86_400 ? hm(sec / 60) : `${Math.floor(sec / 86_400)}d ${Math.floor((sec % 86_400) / 3600)}h`);

export function QueueDepths({ queues }: { queues: QueueDepth[] }) {
  const max = Math.max(...queues.map((q) => Math.max(q.depth, q.warnAt)), 1);
  return (
    <Section title="Queue depths" description="RabbitMQ, right now. A dead-lettered message needs an operator — it is never retried silently." bodyClassName="p-0">
      <ul className="divide-y divide-border">
        {queues.map((q) => {
          const hot = q.depth >= q.warnAt;
          return (
            <li key={q.name} className="flex flex-col gap-1 px-4 py-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
                <span className="font-mono text-foreground">{q.name}</span>
                <span className="tnum text-muted-foreground">
                  <span className={cn("font-medium", hot ? "text-warning-fg" : "text-foreground")}>{num(q.depth)}</span> queued · {q.consumers} consumers · oldest {age(q.oldestSec)}
                  {q.deadLettered > 0 && <span className="text-destructive-fg"> · {num(q.deadLettered)} dead-lettered</span>}
                </span>
              </div>
              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                role="meter"
                aria-label={`${q.name} depth`}
                aria-valuemin={0}
                aria-valuemax={max}
                aria-valuenow={q.depth}
              >
                <div className={cn("h-full rounded-full", hot ? "bg-warning" : "bg-primary")} style={{ width: `${Math.max(q.depth ? 1 : 0, (Math.log10(q.depth + 1) / Math.log10(max + 1)) * 100)}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">Bars use a log scale so a quiet queue stays visible beside a backed-up one.</p>
    </Section>
  );
}
