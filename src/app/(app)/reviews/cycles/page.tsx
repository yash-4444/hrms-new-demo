"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { BellRing, CalendarRange, Gauge, Send, Users } from "lucide-react";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { DEMO_NOW } from "@/mock/org";
import { REVIEW_CYCLES, ACTIVE_CYCLE } from "@/mock/growth";
import { ELIGIBILITY_RULES, REMINDERS, participationFor, phasesFor, type CyclePhase, type ReminderLog } from "@/mock/engage";
import { mockAction } from "@/components/app-state";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { BarCompareChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, ChartSkeleton, Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Label, Switch } from "@/components/ui/primitives";
import { ConfirmDialog, FilterSelect, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { PhaseTimeline } from "@/components/engage/cycle-timeline";

type Participation = ReturnType<typeof participationFor>[number];
const pctOf = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

export default function ReviewCycleAdminPage() {
  const loading = useFakeLoad();
  const [cycleId, setCycleId] = React.useState(ACTIVE_CYCLE.id);
  const cycle = REVIEW_CYCLES.find((c) => c.id === cycleId) ?? ACTIVE_CYCLE;
  const [phaseState, setPhaseState] = React.useState<Record<string, CyclePhase[]>>(() =>
    Object.fromEntries(REVIEW_CYCLES.map((c) => [c.id, phasesFor(c.id)])),
  );
  const phases = phaseState[cycle.id] ?? [];
  const [rules, setRules] = React.useState(ELIGIBILITY_RULES);
  const [toggling, setToggling] = React.useState<CyclePhase | null>(null);
  const [reminders, setReminders] = React.useState<ReminderLog[]>(REMINDERS);
  const [audience, setAudience] = React.useState("self");
  const [confirmRemind, setConfirmRemind] = React.useState(false);
  const rows = React.useMemo(() => participationFor(cycle.id), [cycle.id]);
  const readOnly = cycle.status === "completed";

  const pending = {
    self: rows.reduce((a, r) => a + (r.participants - r.self), 0),
    manager: rows.reduce((a, r) => a + (r.participants - r.manager), 0),
    peer: rows.reduce((a, r) => a + (r.participants - r.peer), 0),
  };
  const AUDIENCE: Record<string, { label: string; recipients: number }> = {
    self: { label: "Self review not submitted", recipients: pending.self },
    manager: { label: "Managers with pending reviews", recipients: Math.ceil(pending.manager / 6) },
    peer: { label: "360 raters with pending requests", recipients: pending.peer * 2 },
  };

  const columns = React.useMemo<ColumnDef<Participation, unknown>[]>(
    () => [
      { accessorKey: "department", header: "Department" },
      { accessorKey: "participants", header: "Eligible", cell: ({ getValue }) => <NumCell>{String(getValue())}</NumCell> },
      ...(["self", "manager", "peer"] as const).map<ColumnDef<Participation, unknown>>((k) => ({
        id: k,
        accessorFn: (r) => pctOf(r[k], r.participants),
        header: k === "self" ? "Self review" : k === "manager" ? "Manager review" : "360",
        cell: ({ row }) => (
          <NumCell>
            {row.original[k]} <span className="text-muted-foreground">({pctOf(row.original[k], row.original.participants)}%)</span>
          </NumCell>
        ),
      })),
    ],
    [],
  );
  const reminderColumns = React.useMemo<ColumnDef<ReminderLog, unknown>[]>(
    () => [
      { accessorKey: "sentOn", header: "Sent", cell: ({ row }) => <MutedCell>{fmtDateTime(row.original.sentOn)}</MutedCell> },
      { accessorKey: "audience", header: "Audience" },
      { accessorKey: "recipients", header: "Recipients", cell: ({ getValue }) => <NumCell>{String(getValue())}</NumCell> },
      { accessorKey: "channel", header: "Channel", cell: ({ getValue }) => <MutedCell>{String(getValue())}</MutedCell> },
    ],
    [],
  );

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Review Cycle Admin" description="Loading cycles…" />
        <CardsSkeleton />
        <ChartSkeleton />
        <TableSkeleton />
      </PageBody>
    );
  }

  const eligible = rules.find((r) => r.id === "interns")?.enabled ? cycle.participants + 9 : cycle.participants;
  const chart = rows.map((r) => ({ department: r.department, self: pctOf(r.self, r.participants), manager: pctOf(r.manager, r.participants), peer: pctOf(r.peer, r.participants) }));

  return (
    <PageBody>
      <PageHeader
        title="Review Cycle Admin"
        description="Set up and run review cycles: phase windows, who is eligible, progress by department, and reminders."
        actions={
          <FilterSelect
            label="Cycle"
            value={cycle.id}
            onValueChange={(v) => setCycleId(v === "all" ? ACTIVE_CYCLE.id : v)}
            allLabel="Active cycle"
            width="w-[300px]"
            options={REVIEW_CYCLES.map((c) => ({ value: c.id, label: c.name }))}
          />
        }
      />

      <StatRow cols={4}>
        <StatTile label="Window" value={`${fmtDate(cycle.windowStart)} – ${fmtDate(cycle.windowEnd)}`} icon={CalendarRange} hint={cycle.kind} />
        <StatTile label="Eligible participants" value={eligible} icon={Users} hint={cycle.scope} />
        <StatTile label="Overall completion" value={`${cycle.completionPct}%`} icon={Gauge} tone={cycle.completionPct === 100 ? "good" : "neutral"} hint="Mean across all phases" />
        <StatTile label="Status" value={<StatusBadge status={cycle.status} />} icon={BellRing} hint={readOnly ? "Closed — read only" : "Phases can be opened and closed below"} />
      </StatRow>

      <Section title="Phases" description={readOnly ? "This cycle has been released; phases are locked." : "Closing a phase stops new submissions; anything still in draft is flagged for HR follow-up."}>
        <PhaseTimeline phases={phases} readOnly={readOnly} onToggle={setToggling} />
      </Section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Section title="Eligibility rules" description={`${eligible} people match today.`} className="xl:col-span-1">
          <ul className="flex flex-col gap-2">
            {rules.map((r) => (
              <li key={r.id} className="flex items-start gap-2">
                <Gated menuKey="growth.cycles" action="E">
                  <Switch
                    id={`rule-${r.id}`}
                    checked={r.enabled}
                    disabled={readOnly}
                    onCheckedChange={(v) => {
                      setRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, enabled: v } : x)));
                      mockAction(`${r.label} — ${v ? "on" : "off"}`, { description: "Eligibility recalculated for this cycle." });
                    }}
                  />
                </Gated>
                <div>
                  <Label htmlFor={`rule-${r.id}`} className="text-xs">{r.label}</Label>
                  <p className="text-[11px] text-muted-foreground">{r.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
        <div className="xl:col-span-2">
          <BarCompareChart
            title="Completion by department"
            description="Share of eligible people who have submitted each review."
            data={chart}
            xKey="department"
            series={[{ key: "self", label: "Self review" }, { key: "manager", label: "Manager review" }, { key: "peer", label: "360" }]}
            valueFormat={(v) => `${v}%`}
          />
        </div>
      </div>

      <Section title="Participation by department" bodyClassName="p-3">
        <DataTable columns={columns} data={rows} getRowId={(r) => r.departmentId} exportName={`participation-${cycle.id}`} rowTone={(r) => (!readOnly && pctOf(r.self, r.participants) < 75 ? "warning" : undefined)} emptyIcon={Users} emptyTitle="No participants" emptyDescription="Adjust the eligibility rules to bring people into this cycle." />
      </Section>

      <Section
        title="Reminders"
        description="Every reminder is logged. Recipients get an email and an in-app task."
        actions={
          !readOnly && (
            <div className="flex items-center gap-1.5">
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger size="sm" className="w-[250px]" aria-label="Reminder audience"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(AUDIENCE).map(([k, a]) => <SelectItem key={k} value={k}>{a.label} ({a.recipients})</SelectItem>)}
                </SelectContent>
              </Select>
              <Gated menuKey="growth.cycles" action="E">
                <Button size="sm" onClick={() => setConfirmRemind(true)} disabled={AUDIENCE[audience].recipients === 0}>
                  <Send /> Send reminder
                </Button>
              </Gated>
            </div>
          )
        }
        bodyClassName="p-3"
      >
        <DataTable columns={reminderColumns} data={reminders.filter((r) => r.cycleId === cycle.id)} getRowId={(r) => r.id} exportName="review-reminders" emptyIcon={BellRing} emptyTitle="No reminders sent for this cycle" emptyDescription="Reminders you send appear here with the recipient count." />
      </Section>

      <ConfirmDialog
        open={!!toggling}
        onOpenChange={(v) => !v && setToggling(null)}
        title={toggling?.state === "open" ? `Close ${toggling.label}?` : `Open ${toggling?.label ?? ""}?`}
        description={toggling?.state === "open" ? "No further submissions will be accepted for this phase. Drafts are kept and flagged for HR follow-up." : "Participants are notified and the phase appears in their task list straight away."}
        confirmLabel={toggling?.state === "open" ? "Close phase" : "Open phase"}
        destructive={toggling?.state === "open"}
        onConfirm={() => {
          if (!toggling) return;
          const next = toggling.state === "open" ? "done" : "open";
          setPhaseState((prev) => ({ ...prev, [cycle.id]: prev[cycle.id].map((p) => (p.id === toggling.id ? { ...p, state: next } : p)) }));
          mockAction(`${toggling.label} ${next === "done" ? "closed" : "opened"}`, { description: cycle.name });
        }}
      />
      <ConfirmDialog
        open={confirmRemind}
        onOpenChange={setConfirmRemind}
        title={`Send a reminder to ${AUDIENCE[audience].recipients} people?`}
        description={`${AUDIENCE[audience].label} · ${cycle.name}. Sent by email and in-app.`}
        confirmLabel="Send reminder"
        onConfirm={() => {
          setReminders((prev) => [{ id: `RM-${prev.length + 15}`, cycleId: cycle.id, sentOn: DEMO_NOW, audience: AUDIENCE[audience].label, recipients: AUDIENCE[audience].recipients, channel: "Email + in-app" }, ...prev]);
          mockAction(`Reminder sent to ${AUDIENCE[audience].recipients} people`, { description: AUDIENCE[audience].label });
        }}
      />
    </PageBody>
  );
}
