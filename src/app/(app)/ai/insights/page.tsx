"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  HeartPulse,
  IndianRupee,
  ShieldCheck,
  TrendingUp,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, inr, inrCompact, num, pct } from "@/lib/format";
import { BRANCHES, DEPARTMENTS } from "@/mock/org";
import {
  ANOMALIES,
  ATTRITION_RISK,
  FORECAST_ASSUMPTIONS,
  FORECAST_SUMMARY,
  HEADCOUNT_FORECAST,
  HIRING_NEEDS,
  PAYROLL_FORECAST,
  PULSE_BY_DEPT,
  PULSE_THEMES,
  PULSE_TREND,
  type Anomaly,
  type AttritionRiskRow,
  type RiskBand,
} from "@/mock/ai";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { PersonCell } from "@/components/people/person-cell";
import { BarCompareChart, DivergingBarChart, TrendLineChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, ChartSkeleton, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState, Field, Tabs, TabsContent, TabsList, TabsTrigger, Textarea } from "@/components/ui/primitives";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  FilterSelect,
} from "@/components/ui/overlays";
import { AI_TONE, AiBadge, AiExplainButton } from "@/components/ai/ai-ui";
import { scopeOf, scopedEmployees, type CopilotContext, type Scope } from "@/components/ai/engine";

const BAND_CLS: Record<RiskBand, string> = {
  High: "border-destructive/25 bg-destructive-soft text-destructive-fg",
  Medium: "border-warning/30 bg-warning-soft text-warning-fg",
  Low: "border-success/25 bg-success-soft text-success-fg",
};

const SEV_CLS: Record<Anomaly["severity"], string> = BAND_CLS;

const SCOPE_TEXT: Record<Scope, string> = {
  self: "",
  team: "your reporting line",
  department: "your department",
  org: "the whole organisation",
};

/* ========================================================= attrition tab */

function ScoreBar({ score, band }: { score: number; band: RiskBand }) {
  return (
    <div className="flex items-center gap-2">
      <span className="tnum w-6 text-right text-xs font-semibold">{score}</span>
      <div className="h-1.5 w-16 rounded-full bg-muted" aria-hidden>
        <div
          className={cn("h-1.5 rounded-full", band === "High" ? "bg-destructive" : band === "Medium" ? "bg-warning" : "bg-success")}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function AttritionTab({ rows, scope }: { rows: AttritionRiskRow[]; scope: Scope }) {
  const loading = useFakeLoad();
  const [dept, setDept] = React.useState("all");
  const [branch, setBranch] = React.useState("all");
  const [band, setBand] = React.useState("all");
  const filtered = rows.filter((r) => (dept === "all" || r.departmentId === dept) && (branch === "all" || r.branchId === branch) && (band === "all" || r.band === band));
  const high = rows.filter((r) => r.band === "High").length;
  const med = rows.filter((r) => r.band === "Medium").length;
  const avg = rows.length ? Math.round(rows.reduce((a, r) => a + r.score, 0) / rows.length) : 0;

  const driverMix = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows.filter((x) => x.band !== "Low"))
      for (const d of r.drivers) {
        const k = d.label.replace(/\d+% below/, "below").replace(/in \d+ months/, "in 18+ months").replace(/\d+–\d+ month/, "18–36 month");
        m.set(k, (m.get(k) ?? 0) + 1);
      }
    return [...m.entries()].map(([driver, people]) => ({ driver, people })).sort((a, b) => b.people - a.people).slice(0, 6);
  }, [rows]);

  const columns = React.useMemo<ColumnDef<AttritionRiskRow, unknown>[]>(
    () => [
      { accessorKey: "name", header: "Employee", cell: ({ row }) => <PersonCell name={row.original.name} code={row.original.code} subtitle={row.original.designation} size={24} /> },
      { accessorKey: "department", header: "Department", cell: ({ row }) => <MutedCell>{row.original.department}</MutedCell> },
      { accessorKey: "branch", header: "Branch", cell: ({ row }) => <MutedCell>{row.original.branch}</MutedCell> },
      { accessorKey: "tenureMonths", header: "Tenure", cell: ({ row }) => <NumCell>{row.original.tenureMonths >= 12 ? `${(row.original.tenureMonths / 12).toFixed(1)} y` : `${row.original.tenureMonths} m`}</NumCell> },
      { accessorKey: "score", header: "Risk score", cell: ({ row }) => <ScoreBar score={row.original.score} band={row.original.band} /> },
      {
        accessorKey: "band",
        header: "Band",
        cell: ({ row }) => <span className={cn("inline-flex rounded-md border px-1.5 py-0.5 text-xs font-medium", BAND_CLS[row.original.band])}>{row.original.band}</span>,
      },
      {
        id: "drivers",
        header: "Top drivers",
        cell: ({ row }) =>
          row.original.drivers.length ? (
            <ul className="flex max-w-[360px] flex-col gap-0.5">
              {row.original.drivers.map((d) => (
                <li key={d.label} className="truncate text-[11px] text-muted-foreground">
                  • {d.label}
                </li>
              ))}
            </ul>
          ) : (
            <MutedCell>No strong drivers</MutedCell>
          ),
      },
      {
        accessorKey: "trend",
        header: "30-day move",
        cell: ({ row }) => (
          <NumCell className={row.original.trend > 0 ? "text-destructive-fg" : row.original.trend < 0 ? "text-success-fg" : undefined}>
            {row.original.trend > 0 ? "+" : ""}
            {row.original.trend}
          </NumCell>
        ),
      },
      {
        id: "why",
        header: "",
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <AiExplainButton
              title={`Why ${row.original.name} scores ${row.original.score}`}
              summary={`${row.original.band} risk · ${row.original.department}, ${row.original.branch}`}
              drivers={row.original.drivers}
            />
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-4">
      <Alert tone="info" icon={ShieldCheck} title="Scores are explainable and never used for automated decisions">
        Each score lists the signals behind it. Use it to start a stay conversation — not to decide pay, promotion or exit. Showing {SCOPE_TEXT[scope]}.
      </Alert>
      {loading ? (
        <CardsSkeleton />
      ) : (
        <StatRow>
          <StatTile label="People scored" value={num(rows.length)} icon={Users} hint={SCOPE_TEXT[scope]} />
          <StatTile label="High risk" value={num(high)} icon={AlertTriangle} tone="critical" hint={`${pct(rows.length ? (high / rows.length) * 100 : 0)} of scored`} />
          <StatTile label="Medium risk" value={num(med)} icon={UserMinus} tone="warning" />
          <StatTile label="Average score" value={num(avg)} icon={TrendingUp} deltaValue={-2.1} deltaSuffix=" pts" deltaLabel="vs last month" goodDirection="down" />
        </StatRow>
      )}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Section title="Attrition risk" description="Model v2.3 · retrained 01 Sep 2026 · AUC 0.81 on FY 2025-26 exits" actions={<AiBadge />} bodyClassName="p-3">
          {loading ? (
            <TableSkeleton />
          ) : (
            <DataTable
              columns={columns}
              data={filtered}
              searchKeys={["name", "code", "designation"]}
              searchPlaceholder="Search people…"
              getRowId={(r) => r.code}
              exportName="attrition-risk"
              dense
              enableSelection
              bulkActions={(sel, clear) => (
                <Button
                  size="sm"
                  onClick={() => {
                    mockAction(`Stay conversations planned for ${sel.length} people`, { description: "Added to each manager's 1:1 agenda with the drivers attached." });
                    clear();
                  }}
                >
                  <CalendarClock aria-hidden />
                  Plan stay conversations
                </Button>
              )}
              filters={
                <>
                  {scope !== "team" && (
                    <FilterSelect label="Department" value={dept} onValueChange={setDept} options={DEPARTMENTS.filter((d) => rows.some((r) => r.departmentId === d.id)).map((d) => ({ value: d.id, label: d.name }))} />
                  )}
                  <FilterSelect label="Branch" value={branch} onValueChange={setBranch} options={BRANCHES.filter((b) => rows.some((r) => r.branchId === b.id)).map((b) => ({ value: b.id, label: b.city }))} width="w-[130px]" />
                  <FilterSelect label="Band" value={band} onValueChange={setBand} options={(["High", "Medium", "Low"] as const).map((b) => ({ value: b, label: b }))} width="w-[110px]" />
                </>
              }
              emptyTitle="No one matches these filters"
              emptyDescription="Widen the department, branch or band filter."
              emptyIcon={Users}
            />
          )}
        </Section>
        {loading ? (
          <ChartSkeleton />
        ) : (
          <BarCompareChart
            title="Most common drivers"
            description="Across medium and high-risk people"
            data={driverMix}
            xKey="driver"
            series={[{ key: "people", label: "People" }]}
            horizontal
            height={280}
          />
        )}
      </div>
    </div>
  );
}

/* ========================================================= anomalies tab */

const OWNERS = ["Rahul Desai (Payroll)", "Lakshmi Pillai (Finance)", "Priya Menon (HR)", "Reporting manager"];

function AnomaliesTab({ items: initial, canAct }: { items: Anomaly[]; canAct: boolean }) {
  const [items, setItems] = React.useState(initial.map((a) => ({ ...a, state: "open" as "open" | "dismissed" | "assigned", owner: "" })));
  const [kind, setKind] = React.useState("all");
  const [sev, setSev] = React.useState("all");
  const [dismissing, setDismissing] = React.useState<Anomaly | null>(null);
  const [reason, setReason] = React.useState("");
  const [reasonError, setReasonError] = React.useState<string | null>(null);

  const visible = items.filter((a) => a.state !== "dismissed" && (kind === "all" || a.kind === kind) && (sev === "all" || a.severity === sev));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterSelect label="Type" value={kind} onValueChange={setKind} options={["Payroll variance", "Attendance", "Expense", "Overtime"].map((k) => ({ value: k, label: k }))} />
        <FilterSelect label="Severity" value={sev} onValueChange={setSev} options={["High", "Medium", "Low"].map((k) => ({ value: k, label: k }))} width="w-[120px]" />
        <p className="ml-auto text-xs text-muted-foreground">
          {visible.length} open · {items.filter((a) => a.state === "dismissed").length} dismissed this session
        </p>
      </div>
      {visible.length === 0 ? (
        <EmptyState icon={Check} title="No open anomalies" description="Nothing in your scope needs a look right now. Dismissed items stay in the AI audit log." />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {visible.map((a) => (
            <article key={a.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={cn("inline-flex rounded-md border px-1.5 py-0.5 text-[11px] font-semibold", SEV_CLS[a.severity])}>{a.severity}</span>
                    <span className="text-[11px] text-muted-foreground">{a.kind}</span>
                    <span className="text-[11px] text-muted-foreground">· detected {fmtDate(a.detectedOn)}</span>
                  </div>
                  <h3 className="mt-1 text-sm font-semibold">{a.title}</h3>
                  <p className="text-xs text-muted-foreground">{a.subject}</p>
                </div>
                <AiExplainButton
                  label={`${a.confidence}%`}
                  title="Why this was flagged"
                  drivers={a.evidence.map((e) => ({ label: e }))}
                  footnote="A flag is a prompt to check, not a finding. A person decides."
                />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground">Evidence</p>
                <ul className="mt-0.5 flex list-disc flex-col gap-0.5 pl-4 text-xs text-foreground/90">
                  {a.evidence.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
              <div className={cn("rounded-md border px-2.5 py-1.5 text-xs", AI_TONE.soft)}>
                <span className="font-semibold">Suggested action: </span>
                {a.suggestedAction}
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                {a.state === "assigned" ? (
                  <span className="inline-flex items-center gap-1 text-xs text-success-fg">
                    <Check className="size-3.5" aria-hidden />
                    Assigned to {a.owner}
                  </span>
                ) : canAct ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline">
                        <UserPlus aria-hidden />
                        Assign
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuLabel>Assign to</DropdownMenuLabel>
                      {OWNERS.map((o) => (
                        <DropdownMenuItem
                          key={o}
                          onSelect={() => {
                            setItems((all) => all.map((x) => (x.id === a.id ? { ...x, state: "assigned", owner: o } : x)));
                            mockAction("Anomaly assigned", { description: `${a.title} → ${o}` });
                          }}
                        >
                          {o}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
                {canAct && a.state !== "assigned" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDismissing(a);
                      setReason("");
                      setReasonError(null);
                    }}
                  >
                    <X aria-hidden />
                    Dismiss
                  </Button>
                )}
                {!canAct && <span className="text-[11px] text-muted-foreground">Read-only — your role can view but not act on anomalies.</span>}
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={!!dismissing} onOpenChange={(v) => !v && setDismissing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dismiss this anomaly?</DialogTitle>
            <DialogDescription>{dismissing?.title} — {dismissing?.subject}. Your reason is recorded in the AI audit log and used to tune the detector.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Field label="Reason" htmlFor="dismiss-reason" required error={reasonError ?? undefined}>
              <Textarea id="dismiss-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Verified with the manager — both employees car-pool and arrive together." aria-invalid={!!reasonError} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDismissing(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (reason.trim().length < 10) {
                  setReasonError("Give a reason of at least 10 characters.");
                  return;
                }
                const a = dismissing!;
                setItems((all) => all.map((x) => (x.id === a.id ? { ...x, state: "dismissed" } : x)));
                setDismissing(null);
                mockAction("Anomaly dismissed", {
                  description: reason.trim(),
                  undo: () => setItems((all) => all.map((x) => (x.id === a.id ? { ...x, state: "open" } : x))),
                });
              }}
            >
              Dismiss anomaly
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ========================================================= forecast tab */

function ForecastTab() {
  const loading = useFakeLoad();
  // History rows carry only "actual"; forecast rows only the projection. The
  // last actual month carries both so the two lines join without a gap.
  const split = (pts: typeof HEADCOUNT_FORECAST) =>
    pts.map((p, i): Record<string, string | number> =>
      i < 5
        ? { month: p.month, actual: p.actual }
        : i === 5
          ? { month: p.month, actual: p.actual, forecast: p.actual, low: p.actual, high: p.actual }
          : { month: p.month, forecast: p.forecast, low: p.low, high: p.high },
    );
  const hcData = split(HEADCOUNT_FORECAST);
  const costData = split(PAYROLL_FORECAST);
  const endHc = HEADCOUNT_FORECAST[HEADCOUNT_FORECAST.length - 1];
  const endCost = PAYROLL_FORECAST[PAYROLL_FORECAST.length - 1];
  const nowCost = PAYROLL_FORECAST[5].actual;
  const need = HIRING_NEEDS.reduce((a, r) => a + r.total, 0);
  const series = [
    { key: "actual", label: "Actual" },
    { key: "forecast", label: "Forecast" },
    { key: "low", label: "Low (P10)" },
    { key: "high", label: "High (P90)" },
  ];

  if (loading)
    return (
      <div className="flex flex-col gap-4">
        <CardsSkeleton count={3} />
        <ChartSkeleton />
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <StatRow cols={3}>
        <StatTile label={`Projected headcount · ${endHc.month}`} value={num(endHc.forecast)} icon={Users} hint={`Range ${num(endHc.low)}–${num(endHc.high)}`} deltaValue={((endHc.forecast - HEADCOUNT_FORECAST[5].actual) / HEADCOUNT_FORECAST[5].actual) * 100} deltaLabel="vs today" goodDirection="none" />
        <StatTile label={`Projected monthly CTC · ${endCost.month}`} value={inrCompact(endCost.forecast)} icon={IndianRupee} hint={`Range ${inrCompact(endCost.low)}–${inrCompact(endCost.high)}`} deltaValue={((endCost.forecast - nowCost) / nowCost) * 100} deltaLabel="vs current run" goodDirection="none" />
        <StatTile label="Hiring need · next 6 months" value={num(need)} icon={UserPlus} hint="Open requisitions + projected backfills" />
      </StatRow>
      <Alert tone="warning" icon={TrendingUp} title={`Filling only today's open positions shrinks headcount to ${num(endHc.forecast)} by ${endHc.month}`}>
        At the current attrition rate about {num(FORECAST_SUMMARY.leavers6m)} people leave over the next 6 months.
        Holding headcount flat needs {num(HIRING_NEEDS.reduce((a, r) => a + r.backfill, 0))} backfills on top of the {num(HIRING_NEEDS.reduce((a, r) => a + r.open, 0))} open positions — Engineering carries the largest share.
      </Alert>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <TrendLineChart title="Headcount projection" description="6 months actual, 6 months forecast with an 80% confidence band" data={hcData} xKey="month" series={series} height={240} />
        <TrendLineChart title="Payroll cost projection" description="Monthly cost to company at today\u2019s average cost per head" data={costData} xKey="month" series={series} valueFormat={inrCompact} height={240} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <BarCompareChart
          title="Hiring needs by department"
          description="Open positions today plus backfills expected from attrition"
          data={HIRING_NEEDS}
          xKey="department"
          series={[
            { key: "open", label: "Open positions" },
            { key: "backfill", label: "Projected backfills" },
          ]}
          stacked
          height={250}
        />
        <Section title="Assumptions" description="Change these in the workforce plan to re-run the forecast" actions={<AiBadge />}>
          <ul className="flex list-disc flex-col gap-1.5 pl-4 text-xs text-foreground/90">
            {FORECAST_ASSUMPTIONS.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Backtest: the same model forecast Sep 2026 headcount within ±{num(4)} people and cost within {inr(310000)} three months ahead.
          </p>
        </Section>
      </div>
    </div>
  );
}

/* ========================================================= engagement tab */

function EngagementTab() {
  const loading = useFakeLoad();
  if (loading)
    return (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    );
  const last = PULSE_TREND[PULSE_TREND.length - 1];
  const prev = PULSE_TREND[PULSE_TREND.length - 2];
  return (
    <div className="flex flex-col gap-4">
      <StatRow cols={3}>
        <StatTile label="Pulse sentiment · Sep" value={`${last.sentiment}/100`} icon={HeartPulse} deltaValue={last.sentiment - prev.sentiment} deltaSuffix=" pts" deltaLabel="vs Aug" goodDirection="up" />
        <StatTile label="Participation" value={pct(last.participation, 0)} icon={Users} deltaValue={last.participation - prev.participation} deltaSuffix=" pts" deltaLabel="vs Aug" goodDirection="up" />
        <StatTile label="Comments analysed · 12 months" value={num(PULSE_THEMES.reduce((a, t) => a + t.mentions, 0))} icon={Check} hint="Themes extracted by AI; quotes anonymised" />
      </StatRow>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <TrendLineChart
          title="Pulse sentiment trend"
          description="Monthly pulse — sentiment score and response rate"
          data={PULSE_TREND}
          xKey="month"
          series={[
            { key: "sentiment", label: "Sentiment" },
            { key: "participation", label: "Participation %" },
          ]}
          height={240}
        />
        <DivergingBarChart
          title="Theme sentiment"
          description="Net sentiment of comments per theme (−100 to +100)"
          data={PULSE_THEMES.map((t) => ({ name: t.theme, value: Math.round(t.sentiment * 100) }))}
          height={240}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Section title="What people are saying" description="AI-extracted themes with a representative anonymised quote" actions={<AiBadge />} bodyClassName="p-0">
          <ul className="divide-y divide-border">
            {PULSE_THEMES.map((t) => (
              <li key={t.theme} className="flex items-start gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">
                    {t.theme}
                    <span className="ml-1.5 font-normal text-muted-foreground">{num(t.mentions)} mentions · {t.trend === "up" ? "rising" : t.trend === "down" ? "falling" : "steady"}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground italic">“{t.quote}”</p>
                </div>
                <span className={cn("tnum shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold", t.sentiment >= 0 ? BAND_CLS.Low : t.sentiment < -0.3 ? BAND_CLS.High : BAND_CLS.Medium)}>
                  {t.sentiment > 0 ? "+" : ""}
                  {Math.round(t.sentiment * 100)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
        <BarCompareChart title="Sentiment by department" description="Groups smaller than 5 responses are hidden" data={PULSE_BY_DEPT} xKey="department" series={[{ key: "score", label: "Sentiment" }]} horizontal height={300} />
      </div>
    </div>
  );
}

/* ========================================================= page */

export default function InsightsPage() {
  const { role, persona, can } = useApp();
  const ctx: CopilotContext = { role, persona, can };
  const scope = scopeOf(ctx);
  const people = React.useMemo(() => new Set(scopedEmployees({ role, persona, can }).map((e) => e.code)), [role, persona, can]);

  const riskRows = scope === "self" ? [] : ATTRITION_RISK.filter((r) => people.has(r.code));
  const seesPayroll = can("payroll.runs", "V");
  const seesOrg = scope === "org";
  const anomalies = ANOMALIES.filter((a) => {
    if (a.audience === "payroll") return seesPayroll;
    if (seesOrg) return true;
    if (a.audience === "expense" && role === "finance_controller") return true;
    return a.subjectCode ? people.has(a.subjectCode) : false;
  });
  const canAct = role !== "auditor" && (seesOrg || seesPayroll || role === "finance_controller" || scope !== "self");
  const forecastAllowed = ["hr_admin", "tenant_owner", "auditor", "finance_controller", "payroll_admin", "department_head"].includes(role);
  const engagementAllowed = scope !== "self";

  return (
    <PageBody>
      <PageHeader
        title="AI Insights"
        description={`Explainable signals across people, pay and time — scoped to ${scope === "self" ? "the modules your role covers" : SCOPE_TEXT[scope]}. Every flag shows its evidence; people make the decisions.`}
        actions={<AiBadge label="Model-generated" />}
      />
      <Tabs defaultValue={scope === "self" ? "anomalies" : "attrition"}>
        <TabsList>
          <TabsTrigger value="attrition">Attrition risk</TabsTrigger>
          <TabsTrigger value="anomalies">
            Anomalies
            {anomalies.length > 0 && <span className="tnum ml-1 rounded bg-destructive-soft px-1 text-[10px] text-destructive-fg">{anomalies.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="forecast">Workforce forecast</TabsTrigger>
          <TabsTrigger value="engagement">Engagement signals</TabsTrigger>
        </TabsList>
        <TabsContent value="attrition" className="mt-4">
          {scope === "self" ? (
            <Alert tone="neutral" icon={ShieldCheck} title="Attrition risk is limited to people leaders and HR">
              {persona.role} has no reporting line, so there are no attrition scores to show. Managers see their own team, department heads their department, HR the organisation.
            </Alert>
          ) : (
            <AttritionTab rows={riskRows} scope={scope} />
          )}
        </TabsContent>
        <TabsContent value="anomalies" className="mt-4">
          <AnomaliesTab key={role} items={anomalies} canAct={canAct} />
        </TabsContent>
        <TabsContent value="forecast" className="mt-4">
          {forecastAllowed ? (
            <ForecastTab />
          ) : (
            <Alert tone="neutral" icon={ShieldCheck} title="Workforce forecasts are for HR, Finance and department heads">
              The forecast includes organisation-wide payroll cost, which is outside {persona.role} access.
            </Alert>
          )}
        </TabsContent>
        <TabsContent value="engagement" className="mt-4">
          {engagementAllowed ? (
            <EngagementTab />
          ) : (
            <Alert tone="neutral" icon={ShieldCheck} title="Engagement signals are aggregated for people leaders and HR">
              Pulse results are only shown in aggregate to roles that look after a team.
            </Alert>
          )}
        </TabsContent>
      </Tabs>
    </PageBody>
  );
}
