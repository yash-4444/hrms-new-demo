"use client";

import * as React from "react";
import { pct } from "@/lib/format";
import { absenteeismTrend, MUSTER_PEOPLE, musterRoll } from "@/mock/finance-time";
import { BarCompareChart, TrendLineChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { EmptyState } from "@/components/ui/primitives";
import { TrendingDown } from "lucide-react";
import { applyFilters, type ReportFilters } from "./report-filters";

export function TrendTab({ filters }: { filters: ReportFilters }) {
  const people = React.useMemo(() => applyFilters(MUSTER_PEOPLE, filters), [filters]);
  const trend = React.useMemo(() => absenteeismTrend(people.map((p) => p.code)), [people]);

  /* Department view for the selected month, from the same muster roll. */
  const byDept = React.useMemo(() => {
    const rows = applyFilters(musterRoll(filters.month), filters);
    const map = new Map<string, { department: string; absent: number; leave: number; scheduled: number }>();
    for (const r of rows) {
      const cur = map.get(r.department) ?? { department: r.department, absent: 0, leave: 0, scheduled: 0 };
      cur.absent += r.absent;
      cur.leave += r.leave;
      cur.scheduled += r.present + r.halfDays + r.absent + r.leave;
      map.set(r.department, cur);
    }
    return [...map.values()]
      .map((d) => ({
        department: d.department,
        absentPct: d.scheduled ? Math.round((d.absent / d.scheduled) * 1000) / 10 : 0,
        leavePct: d.scheduled ? Math.round((d.leave / d.scheduled) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.absentPct - a.absentPct);
  }, [filters]);

  if (!people.length) {
    return (
      <EmptyState
        icon={TrendingDown}
        title="No employees match these filters"
        description="Widen the branch or department filter to plot the absenteeism trend."
      />
    );
  }

  const last = trend[trend.length - 1];
  const avg = trend.reduce((s, p) => s + p.absentPct, 0) / Math.max(1, trend.length);
  const peak = trend.reduce((m, p) => (p.absentPct > m.absentPct ? p : m), trend[0]);

  return (
    <div className="flex flex-col gap-3">
      <StatRow cols={3}>
        <StatTile label="Absent rate, latest week" value={pct(last.absentPct)} hint={`Week of ${last.week}`} goodDirection="down" />
        <StatTile label="13-week average" value={pct(avg)} hint="Unplanned absence, LOP only" />
        <StatTile label="Peak week" value={pct(peak.absentPct)} hint={`Week of ${peak.week}`} tone="warning" />
      </StatRow>
      <div className="grid gap-3 lg:grid-cols-2">
        <TrendLineChart
          title="Absenteeism trend"
          description={`Weekly share of scheduled working days · ${people.length} employees in scope`}
          data={trend}
          xKey="week"
          series={[
            { key: "absentPct", label: "Absent (LOP)" },
            { key: "leavePct", label: "On approved leave" },
          ]}
          valueFormat={(v) => pct(v)}
          referenceLine={{ value: 3, label: "3% tolerance" }}
        />
        <BarCompareChart
          title="By department"
          description="Absent and leave share of scheduled days in the selected month"
          data={byDept}
          xKey="department"
          series={[
            { key: "absentPct", label: "Absent (LOP)" },
            { key: "leavePct", label: "On approved leave" },
          ]}
          valueFormat={(v) => pct(v)}
          horizontal
        />
      </div>
    </div>
  );
}
