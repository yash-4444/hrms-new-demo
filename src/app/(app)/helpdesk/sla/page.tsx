"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarClock, Gauge, Octagon, Pencil, ShieldCheck, Siren } from "lucide-react";
import { hm, num, pct } from "@/lib/format";
import { SLA_COMPLIANCE_BY_PRIORITY, TICKETS, isTicketOpen, type TicketPriority } from "@/mock/workplace";
import { BUSINESS_CALENDARS, HD_TIMES_BY_PRIORITY, SLA_POLICIES, type SlaPolicy } from "@/mock/service";
import { mockAction } from "@/components/app-state";
import { DataTable, MutedCell } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { BarCompareChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { ChartSkeleton, Gated, PageBody, PageHeader, Section, useFakeLoad } from "@/components/shell/page";
import { PriorityChip, SlaChip } from "@/components/service/kit";
import { SlaPolicyDialog } from "@/components/service/sla-policy-dialog";

type BreachRow = (typeof TICKETS)[number];
const calendarName = (id: string) => BUSINESS_CALENDARS.find((c) => c.id === id)?.name ?? id;

export default function SlaPoliciesPage() {
  const loading = useFakeLoad();
  const [policies, setPolicies] = React.useState<SlaPolicy[]>(SLA_POLICIES);
  const [editing, setEditing] = React.useState<SlaPolicy | null>(null);

  const breached = TICKETS.filter((t) => t.slaState === "sla_breached");
  const compliance = ((TICKETS.length - breached.length) / TICKETS.length) * 100;
  const frtMet = TICKETS.filter((t) => t.firstResponseMins <= t.slaHours * 60).length;

  const breachCols = React.useMemo<ColumnDef<BreachRow, unknown>[]>(
    () => [
      { accessorKey: "id", header: "Ticket", cell: ({ row }) => <span className="flex flex-col"><span className="font-mono text-[11px] text-muted-foreground">{row.original.id}</span><span className="font-medium">{row.original.subject}</span></span> },
      { accessorKey: "category", header: "Category", cell: ({ row }) => <Badge variant="muted">{row.original.category}</Badge> },
      { accessorKey: "priority", header: "Priority", cell: ({ row }) => <PriorityChip priority={row.original.priority} /> },
      { accessorKey: "slaMinutesRemaining", header: "Overdue by", cell: ({ row }) => <SlaChip state={row.original.slaState} minutes={row.original.slaMinutesRemaining} /> },
      { accessorKey: "assigneeName", header: "Escalated to", cell: ({ row }) => <MutedCell>{row.original.assigneeTeam} lead</MutedCell> },
    ],
    [],
  );

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="SLA policies" description="Loading policies…" />
        <ChartSkeleton />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader title="SLA policies" description="Response and resolution commitments by priority, the clock they run on, and who hears about it when they slip." />

      <StatRow cols={4}>
        <StatTile label="SLA compliance" value={pct(compliance)} icon={ShieldCheck} tone={compliance >= 90 ? "good" : "warning"} hint={`${TICKETS.length} tickets this period`} />
        <StatTile label="First response met" value={pct((frtMet / TICKETS.length) * 100)} icon={Gauge} hint={`${frtMet} of ${TICKETS.length}`} />
        <StatTile label="Breached and open" value={num(breached.filter(isTicketOpen).length)} icon={Octagon} tone="critical" href="/helpdesk/queue" />
        <StatTile label="Escalations fired" value={num(breached.length)} icon={Siren} hint="L2 notified on every breach" />
      </StatRow>

      <div className="grid gap-3 xl:grid-cols-3">
        {policies.map((p) => (
          <Section
            key={p.id}
            title={p.name}
            description={p.appliesTo}
            actions={
              <Gated menuKey="helpdesk.sla" action="E">
                <Button size="icon-sm" variant="ghost" aria-label={`Edit ${p.name}`} onClick={() => setEditing(p)}><Pencil /></Button>
              </Gated>
            }
          >
            <div className="flex flex-col gap-3 text-xs">
              <p className="flex items-center gap-1.5 text-muted-foreground"><CalendarClock className="size-3.5" aria-hidden /> {calendarName(p.calendarId)}</p>
              <table className="w-full text-left">
                <thead className="text-muted-foreground">
                  <tr><th className="py-1 font-medium">Priority</th><th className="py-1 text-right font-medium">First response</th><th className="py-1 text-right font-medium">Resolution</th></tr>
                </thead>
                <tbody>
                  {p.targets.map((t) => (
                    <tr key={t.priority} className="border-t border-border">
                      <td className="py-1"><PriorityChip priority={t.priority as TicketPriority} /></td>
                      <td className="tnum py-1 text-right">{hm(t.firstResponseHrs * 60)}</td>
                      <td className="tnum py-1 text-right">{hm(t.resolutionHrs * 60)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div>
                <p className="mb-1 font-semibold">Escalation</p>
                <ol className="flex flex-col gap-1">
                  {p.escalations.map((e) => (
                    <li key={e.level} className="flex flex-col rounded-md border border-border px-2 py-1">
                      <span className="font-medium">{e.level} <span className="font-normal text-muted-foreground">· {e.after}</span></span>
                      <span className="text-[11px] text-muted-foreground">{e.notify}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </Section>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <BarCompareChart
          title="SLA met vs breached by priority"
          description="All tickets this period against the standard policy."
          data={SLA_COMPLIANCE_BY_PRIORITY.map((r) => ({ name: r.priority, met: r.met, breached: r.breached }))}
          xKey="name"
          series={[{ key: "met", label: "Met" }, { key: "breached", label: "Breached" }]}
          stacked
          height={240}
        />
        <BarCompareChart
          title="Average first response vs target (hours)"
          description="Measured in business hours."
          data={HD_TIMES_BY_PRIORITY.map((r) => ({ name: r.name, actual: r.frt, target: r.frtTarget }))}
          xKey="name"
          series={[{ key: "actual", label: "Actual" }, { key: "target", label: "Target" }]}
          valueFormat={(v) => `${v}h`}
          height={240}
        />
      </div>

      <Section title="Business hours calendars" description="The SLA clock pauses outside these hours and on holidays.">
        <ul className="grid gap-2 md:grid-cols-3">
          {BUSINESS_CALENDARS.map((c) => (
            <li key={c.id} className="rounded-md border border-border p-2.5 text-xs">
              <p className="font-semibold">{c.name}</p>
              <p className="text-muted-foreground">{c.hours}</p>
              <p className="text-[11px] text-muted-foreground">{c.holidays}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Breaches" description="Tickets that missed their first-response commitment." bodyClassName="p-0">
        <DataTable columns={breachCols} data={breached} getRowId={(t) => t.id} exportName="sla-breaches" dense className="border-0 shadow-none"
          emptyIcon={ShieldCheck} emptyTitle="No breaches" emptyDescription="Every ticket met its first-response commitment." />
      </Section>

      <SlaPolicyDialog
        policy={editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSave={(id, v) => {
          setPolicies((ps) => ps.map((p) => (p.id === id ? { ...p, calendarId: v.calendarId, targets: v.targets.map((t) => ({ ...t, priority: t.priority as TicketPriority })) } : p)));
          mockAction("SLA policy saved", { description: "Applies to tickets raised from now on." });
        }}
      />
    </PageBody>
  );
}
