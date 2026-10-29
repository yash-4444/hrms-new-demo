"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Bot, Clock, Inbox, ShieldCheck, Smile, Users } from "lucide-react";
import { hm, num, pct } from "@/lib/format";
import { isTicketOpen } from "@/mock/workplace";
import {
  HD_AGENTS,
  HD_BACKLOG_TREND,
  HD_CSAT,
  HD_DEFLECTION,
  HD_TIMES_BY_PRIORITY,
  HD_VOLUME_BY_CATEGORY,
  HD_VOLUME_BY_CHANNEL,
  QUEUE_TICKETS,
} from "@/mock/service";
import { DataTable, NumCell } from "@/components/data-table";
import { Avatar } from "@/components/ui/primitives";
import { BarCompareChart, DonutChart, TrendLineChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { ChartSkeleton, PageBody, PageHeader, Section, useFakeLoad } from "@/components/shell/page";
import { AiBadge } from "@/components/ai";

type AgentRow = (typeof HD_AGENTS)[number];

const agentCols: ColumnDef<AgentRow, unknown>[] = [
  { accessorKey: "name", header: "Agent", cell: ({ row }) => <span className="flex items-center gap-1.5"><Avatar name={row.original.name} size={22} /><span className="flex flex-col"><span className="font-medium">{row.original.name}</span><span className="text-[10px] text-muted-foreground">{row.original.team}</span></span></span> },
  { accessorKey: "assigned", header: "Assigned", cell: ({ row }) => <NumCell>{row.original.assigned}</NumCell> },
  { accessorKey: "open", header: "Open", cell: ({ row }) => <NumCell>{row.original.open}</NumCell> },
  { accessorKey: "resolved", header: "Resolved", cell: ({ row }) => <NumCell>{row.original.resolved}</NumCell> },
  { accessorKey: "breached", header: "Breached", cell: ({ row }) => <NumCell className={row.original.breached ? "text-destructive-fg" : ""}>{row.original.breached}</NumCell> },
  { accessorKey: "avgFrtMins", header: "Avg first response", cell: ({ row }) => <NumCell>{hm(row.original.avgFrtMins)}</NumCell> },
  { accessorKey: "csat", header: "CSAT", cell: ({ row }) => <NumCell>{row.original.csat ? `${row.original.csat} / 5` : "—"}</NumCell> },
];

export default function HelpdeskAnalyticsPage() {
  const loading = useFakeLoad();
  const latest = HD_DEFLECTION[HD_DEFLECTION.length - 1];
  const first = HD_DEFLECTION[0];
  const open = QUEUE_TICKETS.filter(isTicketOpen).length;
  const avgFrt = Math.round(QUEUE_TICKETS.reduce((s, t) => s + t.firstResponseMins, 0) / QUEUE_TICKETS.length);
  const copilot = QUEUE_TICKETS.filter((t) => t.channel === "Copilot").length;

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Helpdesk analytics" description="Loading analytics…" />
        <div className="grid gap-3 lg:grid-cols-2"><ChartSkeleton /><ChartSkeleton /></div>
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader title="Helpdesk analytics" description="Volume, speed against SLA, backlog, agent load, satisfaction — and how much the AI answered before a ticket was ever raised." />

      <StatRow cols={5}>
        <StatTile label="Tickets this period" value={num(QUEUE_TICKETS.length)} icon={Inbox} hint={`${open} open`} href="/helpdesk/queue" />
        <StatTile label="Avg first response" value={hm(avgFrt)} icon={Clock} />
        <StatTile label="CSAT" value={`${HD_CSAT.average} / 5`} icon={Smile} tone="good" hint={`${pct(HD_CSAT.satisfiedPct, 0)} satisfied · ${HD_CSAT.responses} ratings`} />
        <StatTile label="AI deflection rate" value={pct(latest.rate)} icon={Bot} tone="accent" deltaValue={latest.rate - first.rate} deltaSuffix=" pts" deltaLabel={`vs ${first.month}`} goodDirection="up" />
        <StatTile label="Raised via Copilot" value={num(copilot)} icon={ShieldCheck} hint="Copilot could not answer and opened a ticket" />
      </StatRow>

      <div className="grid gap-3 lg:grid-cols-2">
        <BarCompareChart
          title="Volume by category"
          description="Open and closed tickets this period."
          data={HD_VOLUME_BY_CATEGORY}
          xKey="name"
          series={[{ key: "open", label: "Open" }, { key: "closed", label: "Closed" }]}
          stacked
          height={250}
        />
        <DonutChart
          title="Volume by channel"
          description="Where employees ask for help."
          data={HD_VOLUME_BY_CHANNEL}
          centreValue={num(QUEUE_TICKETS.length)}
          centreLabel="tickets"
          height={250}
        />
        <BarCompareChart
          title="First response vs SLA (hours)"
          description="Average against the standard policy target, by priority."
          data={HD_TIMES_BY_PRIORITY.map((r) => ({ name: r.name, actual: r.frt, target: r.frtTarget }))}
          xKey="name"
          series={[{ key: "actual", label: "Actual" }, { key: "target", label: "SLA target" }]}
          valueFormat={(v) => `${v}h`}
          height={250}
        />
        <BarCompareChart
          title="Resolution time vs SLA (hours)"
          description="Resolved tickets only."
          data={HD_TIMES_BY_PRIORITY.map((r) => ({ name: r.name, actual: r.resolution, target: r.resolutionTarget }))}
          xKey="name"
          series={[{ key: "actual", label: "Actual" }, { key: "target", label: "SLA target" }]}
          valueFormat={(v) => `${v}h`}
          height={250}
        />
        <TrendLineChart
          title="Backlog trend"
          description="Open tickets at each week's end against the 30-ticket target."
          data={HD_BACKLOG_TREND}
          xKey="week"
          series={[{ key: "open", label: "Open tickets" }]}
          referenceLine={{ value: 30, label: "Target" }}
          height={250}
        />
        <BarCompareChart
          title="CSAT distribution"
          description="Ratings left on resolved tickets."
          data={HD_CSAT.dist}
          xKey="name"
          series={[{ key: "value", label: "Ratings" }]}
          height={250}
        />
      </div>

      <Section
        title="AI deflection"
        description="Questions answered by Copilot or a knowledge-base article without an agent, against tickets that still reached the queue."
        actions={<AiBadge label="AI impact" />}
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
          <BarCompareChart
            title="Deflected vs raised, by month"
            data={HD_DEFLECTION}
            xKey="month"
            series={[{ key: "deflected", label: "Answered by AI / KB" }, { key: "raised", label: "Raised to an agent" }]}
            height={240}
          />
          <dl className="flex flex-col gap-3 text-xs">
            <div className="rounded-md border border-border p-3">
              <dt className="text-muted-foreground">Deflection rate, {latest.month}</dt>
              <dd className="text-lg font-semibold">{pct(latest.rate)}</dd>
              <dd className="text-muted-foreground">up from {pct(first.rate)} in {first.month}</dd>
            </div>
            <div className="rounded-md border border-border p-3">
              <dt className="text-muted-foreground">Agent hours saved, {latest.month}</dt>
              <dd className="text-lg font-semibold">{num(Math.round((latest.deflected * 18) / 60))} h</dd>
              <dd className="text-muted-foreground">at 18 minutes handling time per ticket</dd>
            </div>
          </dl>
        </div>
      </Section>

      <Section title="Agent performance" description="Load, speed and satisfaction for everyone working the queue." bodyClassName="p-0">
        <DataTable columns={agentCols} data={HD_AGENTS} getRowId={(a) => a.code} exportName="helpdesk-agents" dense className="border-0 shadow-none"
          emptyIcon={Users} emptyTitle="No agents" emptyDescription="Agents appear once tickets are assigned." />
      </Section>
    </PageBody>
  );
}
