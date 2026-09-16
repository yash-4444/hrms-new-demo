"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  BarChart3,
  Building2,
  Download,
  Filter,
  RefreshCw,
  TrendingDown,
  Users,
  Wallet,
} from "lucide-react";
import { inr, inrCompact, num, pct } from "@/lib/format";
import { BRANCHES, DEPARTMENTS, deptName } from "@/mock/org";
import { PEOPLE_STATS } from "@/mock/employees";
import {
  ATTRITION,
  ATTRITION_TREND,
  BRANCH_DISTRIBUTION,
  COST_BY_BRANCH,
  COST_BY_CENTRE,
  DEPT_DISTRIBUTION,
  GENDER_BY_DEPT,
  GENDER_DISTRIBUTION,
  GRADE_DISTRIBUTION,
  HEADCOUNT_24M,
  JOINERS_LEAVERS_12M,
  LEAVE_UTILISATION,
  PAYROLL_COST_TREND,
  PERIODS,
  RECRUITMENT_FUNNEL,
  SOURCE_MIX,
  SPAN_OF_CONTROL,
  TENURE_BANDS,
  TIME_TO_FILL,
  trimTo,
  type Period,
} from "@/mock/insights";
import { mockAction } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Badge, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import {
  FilterSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/overlays";
import {
  BarCompareChart,
  DonutChart,
  FunnelChart,
  HeatmapChart,
  TrendAreaChart,
  TrendLineChart,
} from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import {
  ChartSkeleton,
  CardsSkeleton,
  PageBody,
  PageHeader,
  useFakeLoad,
} from "@/components/shell/page";

/* ============================================================================
   /analytics — the chart surface of the product.

   Every chart here goes through the shared chart kit, which means: one fixed
   categorical order (colour follows the entity, never its rank), a validated
   CVD-safe palette in both themes, a legend whenever there are ≥2 series, a
   Table view on every frame, and a single y-axis everywhere.
   ========================================================================== */

interface Drill {
  title: string;
  subtitle: string;
  rows: { label: string; value: string; extra?: string }[];
  href?: string;
}

export default function AnalyticsPage() {
  const loading = useFakeLoad();
  const router = useRouter();
  const [period, setPeriod] = React.useState<Period>("12m");
  const [branch, setBranch] = React.useState("all");
  const [department, setDepartment] = React.useState("all");
  const [drill, setDrill] = React.useState<Drill | null>(null);

  const scope = React.useMemo(() => {
    const parts: string[] = [];
    if (branch !== "all") parts.push(BRANCHES.find((b) => b.id === branch)?.city ?? branch);
    if (department !== "all") parts.push(deptName(department));
    return parts.length ? parts.join(" · ") : "All branches · all departments";
  }, [branch, department]);

  /* Filters scale the derived series so the numbers move when you filter. */
  const scale = React.useMemo(() => {
    let s = 1;
    if (branch !== "all") {
      const b = BRANCHES.find((x) => x.id === branch);
      s *= (b?.headcount ?? PEOPLE_STATS.headcount) / PEOPLE_STATS.headcount;
    }
    if (department !== "all") {
      const d = DEPARTMENTS.find((x) => x.id === department);
      s *= (d?.headcount ?? PEOPLE_STATS.headcount) / PEOPLE_STATS.headcount;
    }
    return s;
  }, [branch, department]);

  const headcountSeries = React.useMemo(
    () =>
      trimTo(HEADCOUNT_24M, period).map((p) => ({
        month: p.month,
        headcount: Math.round(p.headcount * scale),
      })),
    [period, scale],
  );

  const attritionSeries = React.useMemo(
    () => trimTo(ATTRITION_TREND, period).map((p) => ({ month: p.month, attrition: p.attrition })),
    [period],
  );

  const movementSeries = React.useMemo(
    () =>
      trimTo(JOINERS_LEAVERS_12M, period).map((p) => ({
        month: p.month,
        joiners: Math.max(0, Math.round(p.joiners * scale)),
        leavers: Math.max(0, Math.round(p.leavers * scale)),
      })),
    [period, scale],
  );

  const costSeries = React.useMemo(
    () =>
      trimTo(PAYROLL_COST_TREND, period).map((p) => ({
        month: p.month,
        gross: Math.round(p.gross * scale),
        employerCost: Math.round(p.employerCost * scale),
      })),
    [period, scale],
  );

  const deptRows = React.useMemo(
    () => (department === "all" ? DEPT_DISTRIBUTION : DEPT_DISTRIBUTION.filter((d) => d.id === department)),
    [department],
  );

  const headcountNow = headcountSeries.at(-1)?.headcount ?? PEOPLE_STATS.headcount;
  const headcountThen = headcountSeries[0]?.headcount ?? headcountNow;
  const headcountGrowth = ((headcountNow - headcountThen) / Math.max(1, headcountThen)) * 100;
  const monthlyCost = costSeries.at(-1);

  const resetFilters = () => {
    setPeriod("12m");
    setBranch("all");
    setDepartment("all");
    mockAction("Filters reset", { description: "Showing all branches and departments, last 12 months." });
  };

  const openDrill = (d: Drill) => setDrill(d);

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Analytics" description="Loading workforce insights…" />
        <CardsSkeleton count={4} />
        <div className="grid gap-3 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="Analytics"
        description={`Workforce, cost and hiring insight across Stellar Technologies. Scope: ${scope}.`}
        actions={
          <>
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger size="sm" className="w-[150px]" aria-label="Reporting period">
                <span className="truncate text-xs">
                  {PERIODS.find((p) => p.value === period)?.label}
                </span>
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FilterSelect
              label="Branch"
              value={branch}
              onValueChange={setBranch}
              allLabel="All branches"
              width="w-[164px]"
              options={BRANCHES.map((b) => ({ value: b.id, label: b.city }))}
            />
            <FilterSelect
              label="Dept"
              value={department}
              onValueChange={setDepartment}
              allLabel="All departments"
              width="w-[184px]"
              options={DEPARTMENTS.map((d) => ({ value: d.id, label: d.name }))}
            />
            <Button variant="outline" size="sm" onClick={resetFilters}>
              <RefreshCw /> Reset
            </Button>
            <Button
              size="sm"
              onClick={() =>
                mockAction("Analytics pack queued", {
                  description: `${scope} · ${PERIODS.find((p) => p.value === period)?.label}. 7 charts as PDF.`,
                })
              }
            >
              <Download /> Export pack
            </Button>
          </>
        }
      />

      {/* -------------------------------------------------------- KPI row */}
      <StatRow cols={4}>
        <StatTile
          label="Headcount"
          value={num(headcountNow)}
          deltaValue={Number(headcountGrowth.toFixed(1))}
          deltaLabel={`vs ${headcountSeries[0]?.month ?? "start"}`}
          goodDirection="up"
          icon={Users}
          spark={headcountSeries.map((p) => ({ value: p.headcount }))}
          href="/employees"
        />
        <StatTile
          label="Attrition (rolling 12m)"
          value={pct(ATTRITION.rate)}
          deltaValue={ATTRITION.delta}
          deltaLabel="vs prior year"
          goodDirection="down"
          icon={TrendingDown}
          tone={ATTRITION.rate > 14 ? "warning" : "good"}
          footer={`${ATTRITION.leavers12m} exits · ${pct(ATTRITION.voluntaryPct)} voluntary`}
          onClick={() =>
            openDrill({
              title: "Attrition breakdown",
              subtitle: `Rolling 12 months · ${scope}`,
              rows: [
                { label: "Total exits", value: num(ATTRITION.leavers12m) },
                { label: "Attrition rate", value: pct(ATTRITION.rate) },
                { label: "Prior-year rate", value: pct(ATTRITION.prevRate) },
                { label: "Voluntary", value: pct(ATTRITION.voluntaryPct) },
                { label: "Regrettable", value: pct(ATTRITION.regrettablePct) },
                { label: "Currently on notice", value: num(PEOPLE_STATS.onNotice) },
              ],
              href: "/employees?status=notice",
            })
          }
        />
        <StatTile
          label="Monthly payroll cost"
          value={inrCompact((monthlyCost?.gross ?? 0) + (monthlyCost?.employerCost ?? 0))}
          hint={`Gross ${inrCompact(monthlyCost?.gross ?? 0)} + employer ${inrCompact(monthlyCost?.employerCost ?? 0)}`}
          icon={Wallet}
          href="/payroll/runs"
        />
        <StatTile
          label="Average span of control"
          value={SPAN_OF_CONTROL.average.toFixed(1)}
          hint={`${num(SPAN_OF_CONTROL.managers.length)} people managers`}
          icon={Building2}
          onClick={() =>
            openDrill({
              title: "Span of control",
              subtitle: "Average direct reports per manager, by department",
              rows: SPAN_OF_CONTROL.byDepartment.map((d) => ({
                label: d.dept,
                value: d.span.toFixed(1),
              })),
              href: "/org-chart",
            })
          }
        />
      </StatRow>

      {/* ---------------------------------------------------------- tabs */}
      <Tabs defaultValue="workforce">
        <TabsList>
          <TabsTrigger value="workforce">
            <Users /> Workforce
          </TabsTrigger>
          <TabsTrigger value="diversity">
            <BarChart3 /> Diversity
          </TabsTrigger>
          <TabsTrigger value="cost">
            <Wallet /> Cost
          </TabsTrigger>
          <TabsTrigger value="hiring">
            <ArrowUpRight /> Hiring
          </TabsTrigger>
          <TabsTrigger value="time">
            <Filter /> Time & leave
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------- workforce */}
        <TabsContent value="workforce" className="flex flex-col gap-3">
          <TrendAreaChart
            title="Headcount trend"
            description={`Closing headcount at the end of each month. ${scope}.`}
            data={headcountSeries}
            xKey="month"
            series={[{ key: "headcount", label: "Headcount" }]}
            height={250}
            footnote="Back-computed from real joining dates in the employee master, so it reconciles with the directory."
          />

          <div className="grid gap-3 lg:grid-cols-2">
            <BarCompareChart
              title="Joiners and leavers"
              description="Monthly movement in and out of the organisation."
              data={movementSeries}
              xKey="month"
              series={[
                { key: "joiners", label: "Joiners" },
                { key: "leavers", label: "Leavers" },
              ]}
              height={250}
              onBarClick={(row) =>
                openDrill({
                  title: `Movement — ${row.month}`,
                  subtitle: scope,
                  rows: [
                    { label: "Joiners", value: num(Number(row.joiners)) },
                    { label: "Leavers", value: num(Number(row.leavers)) },
                    {
                      label: "Net change",
                      value: num(Number(row.joiners) - Number(row.leavers)),
                    },
                  ],
                  href: "/employees",
                })
              }
            />
            <TrendLineChart
              title="Attrition rate"
              description="Annualised monthly attrition. The dashed line is the 12 % board target."
              data={attritionSeries}
              xKey="month"
              series={[{ key: "attrition", label: "Attrition rate" }]}
              valueFormat={(v) => `${v.toFixed(1)}%`}
              height={250}
              referenceLine={{ value: 12, label: "Target 12%" }}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <BarCompareChart
              title="Headcount by department"
              description="Click a bar to drill into that department."
              data={deptRows.map((d) => ({ name: d.name, headcount: d.value }))}
              xKey="name"
              series={[{ key: "headcount", label: "Headcount" }]}
              horizontal
              height={280}
              onBarClick={(row) => {
                const d = DEPARTMENTS.find((x) => x.name === row.name);
                if (d) {
                  setDepartment(d.id);
                  mockAction(`Filtered to ${d.name}`, {
                    description: "Every chart on this page now reflects that department.",
                  });
                }
              }}
            />
            <BarCompareChart
              title="Span of control distribution"
              description="How many managers sit in each band of direct reports."
              data={SPAN_OF_CONTROL.bands.map((b) => ({ name: b.name, managers: b.value }))}
              xKey="name"
              series={[{ key: "managers", label: "Managers" }]}
              height={280}
              footnote="Bands of 1–2 usually indicate an org-design problem, not a management style."
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <DonutChart
              title="Tenure mix"
              description="How long the current roster has been with Stellar."
              data={TENURE_BANDS}
              centreValue={`${PEOPLE_STATS.avgTenureYears.toFixed(1)} yrs`}
              centreLabel="average tenure"
              height={250}
            />
            <BarCompareChart
              title="Grade pyramid"
              description="Distribution across the seven salary grades."
              data={GRADE_DISTRIBUTION.map((g) => ({ name: g.name, employees: g.value }))}
              xKey="name"
              series={[{ key: "employees", label: "Employees" }]}
              height={250}
            />
          </div>
        </TabsContent>

        {/* ------------------------------------------------- diversity */}
        <TabsContent value="diversity" className="flex flex-col gap-3">
          <div className="grid gap-3 lg:grid-cols-[1fr_1.4fr]">
            <DonutChart
              title="Gender diversity"
              description="Whole-organisation split across the current roster."
              data={GENDER_DISTRIBUTION}
              centreValue={pct(PEOPLE_STATS.femalePct)}
              centreLabel="female"
              height={260}
            />
            <BarCompareChart
              title="Gender split by department"
              description="Stacked headcount. Departments are ordered by female representation."
              data={GENDER_BY_DEPT.map((d) => ({ dept: d.dept, female: d.female, male: d.male }))}
              xKey="dept"
              series={[
                { key: "female", label: "Female" },
                { key: "male", label: "Male" },
              ]}
              stacked
              horizontal
              height={260}
            />
          </div>

          <HeatmapChart
            title="Female representation by department and grade band"
            description="Percentage of women at each level. The sequential ramp is one hue — light is low, dark is high."
            rows={GENDER_BY_DEPT.slice(0, 9).map((d) => d.dept)}
            columns={["G1–G2", "G3–G4", "G5", "G6–G7"]}
            values={GENDER_BY_DEPT.slice(0, 9).map((d, i) => [
              Math.round(d.femalePct + 6 - (i % 3) * 2),
              Math.round(d.femalePct - 1 - (i % 4)),
              Math.max(0, Math.round(d.femalePct - 9 + (i % 3) * 3)),
              Math.max(0, Math.round(d.femalePct - 15 + (i % 2) * 6)),
            ])}
            valueFormat={(v) => `${v}%`}
            scaleLabel="0%"
            rowLabelWidth={150}
            footnote="Representation thins at senior grades in every department — the classic leaky-pipeline shape."
          />
        </TabsContent>

        {/* ------------------------------------------------------ cost */}
        <TabsContent value="cost" className="flex flex-col gap-3">
          <TrendAreaChart
            title="Payroll cost trend"
            description="Employee gross and employer statutory cost, month by month."
            data={costSeries}
            xKey="month"
            series={[
              { key: "gross", label: "Employee gross" },
              { key: "employerCost", label: "Employer cost" },
            ]}
            stacked
            valueFormat={inrCompact}
            height={260}
            footnote="Employer cost = PF 12% + ESI 3.25% where applicable + 4.81% gratuity provision."
          />

          <div className="grid gap-3 lg:grid-cols-2">
            <BarCompareChart
              title="Monthly cost by cost centre"
              description="Click a bar for the cost-centre detail."
              data={COST_BY_CENTRE.map((c) => ({ name: `${c.name} · ${c.department}`, cost: c.value }))}
              xKey="name"
              series={[{ key: "cost", label: "Monthly cost" }]}
              horizontal
              valueFormat={inrCompact}
              height={300}
              onBarClick={(row) => {
                const c = COST_BY_CENTRE.find((x) => `${x.name} · ${x.department}` === row.name);
                if (!c) return;
                openDrill({
                  title: `${c.name} — ${c.department}`,
                  subtitle: "Cost centre detail",
                  rows: [
                    { label: "Headcount", value: num(c.headcount) },
                    { label: "Monthly cost", value: inr(c.value, { decimals: false }) },
                    { label: "Annualised cost", value: inr(c.annual, { decimals: false }) },
                    { label: "Average cost per head", value: inr(c.perHead, { decimals: false }) },
                  ],
                  href: "/payroll/runs",
                });
              }}
            />
            <DonutChart
              title="Cost by branch"
              description="Monthly payroll cost split across the three staffed locations."
              data={COST_BY_BRANCH.map((b) => ({ name: b.name, value: b.value }))}
              valueFormat={inrCompact}
              centreValue={inrCompact(COST_BY_BRANCH.reduce((a, b) => a + b.value, 0))}
              centreLabel="per month"
              height={300}
            />
          </div>
        </TabsContent>

        {/* ---------------------------------------------------- hiring */}
        <TabsContent value="hiring" className="flex flex-col gap-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <FunnelChart
              title="Recruitment funnel"
              description="Last 12 months. The right-hand column is stage-to-stage conversion."
              stages={RECRUITMENT_FUNNEL}
              onStageClick={(s) =>
                openDrill({
                  title: `${s.stage} — ${num(s.value)} candidates`,
                  subtitle: "Recruitment funnel drill-down",
                  rows: RECRUITMENT_FUNNEL.map((x) => ({
                    label: x.stage,
                    value: num(x.value),
                    extra: x.stage === s.stage ? "selected" : undefined,
                  })),
                  href: "/candidates",
                })
              }
              footnote="1,284 applications produced 31 hires — a 2.4% end-to-end conversion."
            />
            <DonutChart
              title="Source mix"
              description="Where hired candidates came from, as a share of hires."
              data={SOURCE_MIX}
              valueFormat={(v) => `${v}%`}
              centreValue="38%"
              centreLabel="referrals"
              height={250}
            />
          </div>
          <BarCompareChart
            title="Time to fill by department"
            description="Median days from requisition approval to offer acceptance."
            data={TIME_TO_FILL.map((t) => ({ name: t.dept, days: t.days }))}
            xKey="name"
            series={[{ key: "days", label: "Days to fill" }]}
            horizontal
            height={240}
            footnote="Sales roles in Newark are the slowest to close, driven by visa-status screening."
          />
        </TabsContent>

        {/* ----------------------------------------------- time & leave */}
        <TabsContent value="time" className="flex flex-col gap-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <DonutChart
              title="Leave utilisation by type"
              description="Days consumed across the organisation this financial year."
              data={LEAVE_UTILISATION}
              valueFormat={(v) => `${num(v)} d`}
              centreValue={num(LEAVE_UTILISATION.reduce((a, b) => a + b.value, 0))}
              centreLabel="days taken"
              height={260}
            />
            <BarCompareChart
              title="Headcount by location"
              description="Where the roster physically sits."
              data={BRANCH_DISTRIBUTION.map((b) => ({ name: b.name, employees: b.value }))}
              xKey="name"
              series={[{ key: "employees", label: "Employees" }]}
              height={260}
              onBarClick={(row) => {
                const b = BRANCHES.find((x) => x.city === row.name);
                if (b) {
                  setBranch(b.id);
                  mockAction(`Filtered to ${b.city}`, {
                    description: "Every chart on this page now reflects that branch.",
                  });
                }
              }}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* ------------------------------------------------- drill-down panel */}
      <Sheet open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
        <SheetContent side="right" width="sm:max-w-md">
          {drill && (
            <>
              <SheetHeader>
                <SheetTitle>{drill.title}</SheetTitle>
                <SheetDescription>{drill.subtitle}</SheetDescription>
              </SheetHeader>
              <SheetBody>
                <dl className="flex flex-col">
                  {drill.rows.map((r) => (
                    <div
                      key={r.label}
                      className="flex items-center justify-between gap-4 border-b border-border py-2 last:border-0"
                    >
                      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {r.label}
                        {r.extra && <Badge variant="soft">{r.extra}</Badge>}
                      </dt>
                      <dd className="tnum text-xs font-medium">{r.value}</dd>
                    </div>
                  ))}
                </dl>
                {drill.href && (
                  <Button
                    size="sm"
                    className="mt-4 w-full"
                    onClick={() => {
                      const href = drill.href!;
                      setDrill(null);
                      router.push(href);
                    }}
                  >
                    Open the underlying list <ArrowUpRight />
                  </Button>
                )}
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>
    </PageBody>
  );
}
