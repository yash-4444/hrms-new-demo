"use client";

import * as React from "react";
import Link from "next/link";
import { differenceInCalendarDays, format, parseISO, startOfMonth, subMonths } from "date-fns";
import { ArrowRight, History, Loader2, Lock, Search, SearchX, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { inr, inrCompact, num, pct } from "@/lib/format";
import type { MenuKey } from "@/lib/rbac";
import { BRANCHES, DEMO_TODAY, DEPARTMENTS, GRADES, branchById, deptName } from "@/mock/org";
import { EMPLOYEES, employeeByCode, type Employee } from "@/mock/employees";
import { LEAVE_BALANCES } from "@/mock/leave";
import { ctcBreakup } from "@/mock/payroll";
import { OVERTIME_REPORT_30D } from "@/mock/attendance";
import { REQUISITIONS } from "@/mock/hiring";
import { HEADCOUNT_12M, TIME_TO_FILL } from "@/mock/insights";
import { useApp } from "@/components/app-state";
import { PageBody, PageHeader, Section } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Alert, Input } from "@/components/ui/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { BarCompareChart, TrendLineChart } from "@/components/charts";
import { AI_TONE, AiBadge } from "@/components/ai/ai-ui";
import { scopeOf, scopedEmployees } from "@/components/ai/engine";

/* ============================================================================
   Ask Analytics — natural language → a structured query over APPROVED reports.
   The parser only ever produces one of the metric definitions below; there is
   no free-form SQL path. The interpreted query is shown as editable chips.
   ========================================================================== */

const TODAY = parseISO(DEMO_TODAY);

type MetricId = "attrition" | "time_to_hire" | "overtime_cost" | "gender_ratio" | "leave_liability" | "headcount" | "payroll_cost" | "joiners_leavers" | "open_positions";
type Dim = "department" | "branch" | "grade" | "month";
type Period = "this_month" | "last_quarter" | "last_12m" | "as_of_today";

interface Query {
  metric: MetricId;
  dimension: Dim;
  period: Period;
  branch: string;
  department: string;
}

interface Result {
  chart: "bar" | "line";
  data: Record<string, string | number>[];
  xKey: string;
  series: { key: string; label: string }[];
  format: (v: number) => string;
  stacked?: boolean;
  narrative: string;
}

interface MetricDef {
  label: string;
  report: string;
  href: "/analytics" | "/reports";
  hrefKey: MenuKey;
  dims: Dim[];
  periods: Period[];
  /** Grant needed besides Ask Analytics — money metrics need a payroll or leave-admin grant. */
  requires?: MenuKey[];
  /** Whether branch / department filters apply. */
  filterable: boolean;
  run: (q: Query, pool: Employee[]) => Result;
}

const DIM_LABEL: Record<Dim, string> = { department: "Department", branch: "Branch", grade: "Grade", month: "Month" };
const PERIOD_LABEL: Record<Period, string> = { this_month: "This month", last_quarter: "Last quarter", last_12m: "Last 12 months", as_of_today: "As of today" };

const keyOf = (e: Employee, d: Dim) => (d === "department" ? deptName(e.departmentId) : d === "branch" ? branchById(e.branchId)?.city ?? e.branchId : d === "grade" ? e.gradeId : format(parseISO(e.joiningDate), "MMM yy"));

function groupCount(list: Employee[], d: Dim) {
  const m = new Map<string, number>();
  for (const e of list) m.set(keyOf(e, d), (m.get(keyOf(e, d)) ?? 0) + 1);
  return m;
}

function periodStart(p: Period) {
  if (p === "last_quarter") {
    // Calendar quarter before the one DEMO_TODAY sits in.
    const qStartMonth = Math.floor(TODAY.getMonth() / 3) * 3;
    return subMonths(new Date(TODAY.getFullYear(), qStartMonth, 1), 3);
  }
  if (p === "last_12m") return subMonths(startOfMonth(TODAY), 11);
  return startOfMonth(TODAY);
}
function periodEnd(p: Period) {
  if (p === "last_quarter") {
    const qStartMonth = Math.floor(TODAY.getMonth() / 3) * 3;
    return new Date(TODAY.getFullYear(), qStartMonth, 0);
  }
  return TODAY;
}

const METRICS: Record<MetricId, MetricDef> = {
  attrition: {
    label: "Attrition",
    report: "Attrition Analysis",
    href: "/analytics",
    hrefKey: "analytics",
    dims: ["month", "department", "branch"],
    periods: ["last_quarter", "last_12m"],
    filterable: true,
    run: (q, pool) => {
      const a = periodStart(q.period);
      const b = periodEnd(q.period);
      const leavers = pool.filter((e) => e.exitDate && parseISO(e.exitDate) >= a && parseISO(e.exitDate) <= b);
      const base = pool.filter((e) => parseISO(e.joiningDate) <= b && (!e.exitDate || parseISO(e.exitDate) >= a)).length;
      const months = Math.max(1, Math.round(differenceInCalendarDays(b, a) / 30.4));
      const annualised = base ? (leavers.length / base) * (12 / months) * 100 : 0;
      let data: Record<string, string | number>[];
      if (q.dimension === "month") {
        data = Array.from({ length: months }, (_, i) => {
          const m = format(subMonths(b, months - 1 - i), "MMM yy");
          return { month: m, leavers: leavers.filter((e) => format(parseISO(e.exitDate!), "MMM yy") === m).length };
        });
      } else {
        const g = groupCount(leavers, q.dimension);
        data = [...g.entries()].map(([k, v]) => ({ [q.dimension]: k, leavers: v })).sort((x, y) => Number(y.leavers) - Number(x.leavers));
      }
      return {
        chart: q.dimension === "month" ? "line" : "bar",
        data,
        xKey: q.dimension,
        series: [{ key: "leavers", label: "Leavers" }],
        format: (v) => num(v),
        narrative: leavers.length
          ? `${num(leavers.length)} ${leavers.length === 1 ? "person" : "people"} left between ${format(a, "dd MMM yyyy")} and ${format(b, "dd MMM yyyy")} out of an average base of ${num(base)} — an annualised attrition rate of ${pct(annualised)}.`
          : `No exits were recorded between ${format(a, "dd MMM yyyy")} and ${format(b, "dd MMM yyyy")} for this selection (base of ${num(base)} people).`,
      };
    },
  },
  time_to_hire: {
    label: "Average time to hire",
    report: "Recruitment Funnel & Time to Fill",
    href: "/analytics",
    hrefKey: "analytics",
    dims: ["department"],
    periods: ["last_12m"],
    filterable: true,
    run: (q) => {
      const rows = TIME_TO_FILL.map((r) => ({ department: r.dept, days: r.days }));
      const avg = Math.round(rows.reduce((a, r) => a + r.days, 0) / rows.length);
      const focus = q.department !== "all" ? rows.find((r) => r.department === deptName(q.department)) : null;
      return {
        chart: "bar",
        data: rows,
        xKey: "department",
        series: [{ key: "days", label: "Days to hire" }],
        format: (v) => `${num(v)} d`,
        narrative: focus
          ? `${focus.department} takes ${focus.days} days on average from requisition approval to offer acceptance — ${focus.days > avg ? `${focus.days - avg} days slower` : `${avg - focus.days} days faster`} than the ${avg}-day company average.`
          : `The company average is ${avg} days; ${[...rows].sort((a, b) => b.days - a.days)[0].department} is the slowest at ${[...rows].sort((a, b) => b.days - a.days)[0].days} days.`,
      };
    },
  },
  overtime_cost: {
    label: "Overtime cost",
    report: "Late Arrivals & Overtime",
    href: "/reports",
    hrefKey: "reports",
    dims: ["department", "branch"],
    periods: ["this_month"],
    filterable: true,
    run: (q, pool) => {
      const ids = new Set(pool.map((e) => e.code));
      const m = new Map<string, { hours: number; cost: number }>();
      for (const r of OVERTIME_REPORT_30D) {
        if (!ids.has(r.code)) continue;
        const e = employeeByCode(r.code);
        if (!e) continue;
        // Factories Act s.59: overtime at twice the ordinary hourly rate (CTC ÷ 12 ÷ 26 days ÷ 9 h).
        const hourly = e.ctc / 12 / 26 / 9;
        const k = keyOf(e, q.dimension);
        const cur = m.get(k) ?? { hours: 0, cost: 0 };
        m.set(k, { hours: cur.hours + r.otHours, cost: cur.cost + r.otHours * hourly * 2 });
      }
      const data = [...m.entries()].map(([k, v]) => ({ [q.dimension]: k, cost: Math.round(v.cost), hours: Math.round(v.hours) })).sort((a, b) => Number(b.cost) - Number(a.cost));
      const total = data.reduce((a, r) => a + Number(r.cost), 0);
      return {
        chart: "bar",
        data,
        xKey: q.dimension,
        series: [{ key: "cost", label: "Overtime cost" }],
        format: (v) => inrCompact(v),
        narrative: data.length
          ? `Overtime over the last 30 days costs an estimated ${inr(total)}; ${data[0][q.dimension]} accounts for ${pct((Number(data[0].cost) / total) * 100)} of it (${num(Number(data[0].hours))} hours).`
          : "No overtime was recorded in the last 30 days for this selection.",
      };
    },
  },
  gender_ratio: {
    label: "Gender ratio",
    report: "Diversity & Inclusion",
    href: "/reports",
    hrefKey: "reports",
    dims: ["grade", "department", "branch"],
    periods: ["as_of_today"],
    filterable: true,
    run: (q, pool) => {
      const active = pool.filter((e) => e.status !== "exited");
      const keys = q.dimension === "grade" ? GRADES.map((g) => g.id) : [...new Set(active.map((e) => keyOf(e, q.dimension)))];
      const data = keys
        .map((k) => {
          const inK = active.filter((e) => keyOf(e, q.dimension) === k);
          return { [q.dimension]: k, female: inK.filter((e) => e.gender === "Female").length, male: inK.filter((e) => e.gender === "Male").length };
        })
        .filter((r) => Number(r.female) + Number(r.male) > 0);
      const f = active.filter((e) => e.gender === "Female").length;
      const lowest = [...data].sort((a, b) => Number(a.female) / (Number(a.female) + Number(a.male)) - Number(b.female) / (Number(b.female) + Number(b.male)))[0];
      return {
        chart: "bar",
        data,
        xKey: q.dimension,
        series: [
          { key: "female", label: "Women" },
          { key: "male", label: "Men" },
        ],
        stacked: true,
        format: (v) => num(v),
        narrative: `Women are ${pct(active.length ? (f / active.length) * 100 : 0)} of ${num(active.length)} active employees.${lowest ? ` Representation is lowest in ${lowest[q.dimension]} (${pct((Number(lowest.female) / (Number(lowest.female) + Number(lowest.male))) * 100)}).` : ""}`,
      };
    },
  },
  leave_liability: {
    label: "Leave liability",
    report: "Leave Balance & Liability",
    href: "/reports",
    hrefKey: "reports",
    dims: ["department", "branch"],
    periods: ["as_of_today"],
    requires: ["leave.admin", "payroll.runs"],
    filterable: true,
    run: (q, pool) => {
      const ids = new Set(pool.map((e) => e.code));
      const m = new Map<string, { days: number; value: number }>();
      for (const b of LEAVE_BALANCES) {
        if (b.typeCode !== "EL" || !ids.has(b.employeeCode)) continue;
        const e = employeeByCode(b.employeeCode);
        if (!e) continue;
        // Leave Policy §6.1 — encashment at last drawn basic per day.
        const perDay = ctcBreakup(e.gradeId, e.ctc).basic / 30;
        const k = keyOf(e, q.dimension);
        const cur = m.get(k) ?? { days: 0, value: 0 };
        m.set(k, { days: cur.days + b.available, value: cur.value + b.available * perDay });
      }
      const data = [...m.entries()].map(([k, v]) => ({ [q.dimension]: k, liability: Math.round(v.value), days: Math.round(v.days) })).sort((a, b) => Number(b.liability) - Number(a.liability));
      const total = data.reduce((a, r) => a + Number(r.liability), 0);
      const days = data.reduce((a, r) => a + Number(r.days), 0);
      return {
        chart: "bar",
        data,
        xKey: q.dimension,
        series: [{ key: "liability", label: "EL liability" }],
        format: (v) => inrCompact(v),
        narrative: data.length
          ? `Earned Leave liability as of ${format(TODAY, "dd MMM yyyy")} is ${inr(total)} across ${num(days)} unused days, valued at basic pay per day (Leave Policy §6.1). Covers employees with a ledger in FY 2026-27.`
          : "No Earned Leave balances are on record for this selection.",
      };
    },
  },
  headcount: {
    label: "Headcount",
    report: "Headcount & Movement",
    href: "/analytics",
    hrefKey: "analytics",
    dims: ["department", "branch", "grade", "month"],
    periods: ["as_of_today", "last_12m"],
    filterable: true,
    run: (q, pool) => {
      if (q.dimension === "month") {
        const all = q.branch === "all" && q.department === "all" && pool.length > 300;
        const data = all
          ? HEADCOUNT_12M.map((p) => ({ month: p.month, headcount: p.headcount }))
          : HEADCOUNT_12M.map((p) => {
              const end = parseISO(`${p.monthIso}-28`);
              return { month: p.month, headcount: pool.filter((e) => parseISO(e.joiningDate) <= end && (!e.exitDate || parseISO(e.exitDate) > end)).length };
            });
        const last = Number(data[data.length - 1].headcount);
        const first = Number(data[0].headcount);
        return { chart: "line", data, xKey: "month", series: [{ key: "headcount", label: "Headcount" }], format: (v) => num(v), narrative: `Headcount moved from ${num(first)} to ${num(last)} over 12 months (${last >= first ? "+" : ""}${num(last - first)}).` };
      }
      const active = pool.filter((e) => e.status !== "exited");
      const g = groupCount(active, q.dimension);
      const data = [...g.entries()].map(([k, v]) => ({ [q.dimension]: k, headcount: v })).sort((a, b) => Number(b.headcount) - Number(a.headcount));
      return { chart: "bar", data, xKey: q.dimension, series: [{ key: "headcount", label: "Headcount" }], format: (v) => num(v), narrative: `${num(active.length)} active employees; the largest ${DIM_LABEL[q.dimension].toLowerCase()} is ${data[0]?.[q.dimension]} with ${num(Number(data[0]?.headcount ?? 0))}.` };
    },
  },
  payroll_cost: {
    label: "Payroll cost",
    report: "Payroll Register",
    href: "/reports",
    hrefKey: "reports",
    dims: ["department", "branch"],
    periods: ["this_month"],
    requires: ["payroll.runs"],
    filterable: true,
    run: (q, pool) => {
      const active = pool.filter((e) => e.status !== "exited");
      const m = new Map<string, number>();
      for (const e of active) m.set(keyOf(e, q.dimension), (m.get(keyOf(e, q.dimension)) ?? 0) + e.ctc / 12);
      const data = [...m.entries()].map(([k, v]) => ({ [q.dimension]: k, cost: Math.round(v) })).sort((a, b) => Number(b.cost) - Number(a.cost));
      const total = data.reduce((a, r) => a + Number(r.cost), 0);
      return { chart: "bar", data, xKey: q.dimension, series: [{ key: "cost", label: "Monthly CTC" }], format: (v) => inrCompact(v), narrative: `Monthly cost to company is ${inr(total)}; ${data[0]?.[q.dimension]} is the largest at ${pct(total ? (Number(data[0]?.cost ?? 0) / total) * 100 : 0)}.` };
    },
  },
  joiners_leavers: {
    label: "Joiners vs leavers",
    report: "Headcount & Movement",
    href: "/analytics",
    hrefKey: "analytics",
    dims: ["month"],
    periods: ["last_12m"],
    filterable: false,
    run: () => {
      const data = HEADCOUNT_12M.map((p) => ({ month: p.month, joiners: p.joiners, leavers: p.leavers }));
      const j = data.reduce((a, r) => a + r.joiners, 0);
      const l = data.reduce((a, r) => a + r.leavers, 0);
      return {
        chart: "bar",
        data,
        xKey: "month",
        series: [
          { key: "joiners", label: "Joiners" },
          { key: "leavers", label: "Leavers" },
        ],
        format: (v) => num(v),
        narrative: `${num(j)} joiners and ${num(l)} leavers in the last 12 months — net ${j - l >= 0 ? "+" : ""}${num(j - l)}.`,
      };
    },
  },
  open_positions: {
    label: "Open positions",
    report: "Requisition register",
    href: "/reports",
    hrefKey: "reports",
    dims: ["department", "branch"],
    periods: ["as_of_today"],
    filterable: false,
    run: (q) => {
      const open = REQUISITIONS.filter((r) => r.status === "open");
      const m = new Map<string, number>();
      for (const r of open) {
        const k = q.dimension === "branch" ? branchById(r.branchId)?.city ?? r.branchId : deptName(r.departmentId);
        m.set(k, (m.get(k) ?? 0) + r.headcount - r.filled);
      }
      const data = [...m.entries()].map(([k, v]) => ({ [q.dimension]: k, positions: v })).sort((a, b) => Number(b.positions) - Number(a.positions));
      const total = data.reduce((a, r) => a + Number(r.positions), 0);
      return { chart: "bar", data, xKey: q.dimension, series: [{ key: "positions", label: "Open positions" }], format: (v) => num(v), narrative: `${num(total)} open positions across ${open.length} requisitions.` };
    },
  },
};

const SUGGESTIONS = [
  "Attrition in Pune last quarter",
  "Average time to hire for engineering",
  "Overtime cost by department this month",
  "Gender ratio by grade",
  "Leave liability as of today",
  "Headcount by branch",
  "Joiners vs leavers last 12 months",
  "Payroll cost by department",
];

/* ------------------------------------------------------------ parser */

function parse(text: string): Query | null {
  const s = text.toLowerCase();
  const metric: MetricId | null = /attrition|turnover|exits?|leavers? rate|resign/.test(s)
    ? /joiners/.test(s)
      ? "joiners_leavers"
      : "attrition"
    : /time to (hire|fill)|hiring time|days to hire/.test(s)
      ? "time_to_hire"
      : /overtime/.test(s)
        ? "overtime_cost"
        : /gender|diversity|women|female/.test(s)
          ? "gender_ratio"
          : /leave liability|leave encash|el liability|liability/.test(s)
            ? "leave_liability"
            : /joiners|hires vs|new joiners/.test(s)
              ? "joiners_leavers"
              : /payroll cost|salary cost|ctc cost|payroll by|salary bill/.test(s)
                ? "payroll_cost"
                : /open positions|open roles|requisitions|vacanc/.test(s)
                  ? "open_positions"
                  : /headcount|head count|how many employees|employees by|strength/.test(s)
                    ? "headcount"
                    : null;
  if (!metric) return null;
  const def = METRICS[metric];
  const branch = BRANCHES.find((b) => s.includes(b.city.toLowerCase()) || s.includes(b.id.toLowerCase() + " "))?.id ?? "all";
  const department = DEPARTMENTS.find((d) => s.includes(d.name.toLowerCase()) || (d.id === "ENG" && /engineer/.test(s)))?.id ?? "all";
  let dimension: Dim = def.dims[0];
  if (/by grade|per grade|grade/.test(s) && def.dims.includes("grade")) dimension = "grade";
  else if (/by branch|per branch|by location|by city/.test(s) && def.dims.includes("branch")) dimension = "branch";
  else if (/by department|per department|by dept|by team/.test(s) && def.dims.includes("department")) dimension = "department";
  else if (/trend|by month|monthly|over time/.test(s) && def.dims.includes("month")) dimension = "month";
  let period: Period = def.periods[0];
  if (/last quarter|previous quarter|last 3 months/.test(s) && def.periods.includes("last_quarter")) period = "last_quarter";
  else if (/last 12 months|this year|last year|past year|12 months/.test(s) && def.periods.includes("last_12m")) period = "last_12m";
  if (metric === "headcount" && period === "last_12m") dimension = "month";
  return { metric, dimension, period, branch: def.filterable ? branch : "all", department: def.filterable ? department : "all" };
}

function nearest(text: string) {
  const words = new Set(text.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  return SUGGESTIONS.map((sug) => ({ sug, score: sug.toLowerCase().split(/\W+/).filter((w) => words.has(w)).length }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.sug);
}

/* ------------------------------------------------------------ chip */

function Chip({ label, value, options, onChange, disabled }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className={cn("inline-flex items-center overflow-hidden rounded-md border text-xs", AI_TONE.chip)}>
      <span className="px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide opacity-80">{label}</span>
      <Select value={value} onValueChange={onChange} disabled={disabled || options.length < 2}>
        <SelectTrigger aria-label={label} className="h-6 rounded-none border-0 border-l border-violet-300/60 bg-card px-1.5 text-xs text-foreground shadow-none dark:border-violet-400/30">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/* ------------------------------------------------------------ page */

interface Asked {
  id: number;
  text: string;
  query: Query | null;
}

export default function AskPage() {
  const { role, persona, can } = useApp();
  const scope = scopeOf({ role, persona, can });
  const broad = scope === "org" || role === "payroll_admin" || role === "finance_controller";
  const pool = React.useMemo(() => (broad ? EMPLOYEES : scopedEmployees({ role, persona, can }).concat(EMPLOYEES.filter((e) => e.code === persona.employeeId))), [broad, role, persona, can]);

  const [text, setText] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [history, setHistory] = React.useState<Asked[]>([]);
  const [current, setCurrent] = React.useState<Asked | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = React.useRef(0);
  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const ask = (t: string) => {
    if (!t.trim()) return;
    setText(t);
    setLoading(true);
    const a: Asked = { id: ++counter.current, text: t.trim(), query: parse(t) };
    timer.current = setTimeout(() => {
      setCurrent(a);
      setHistory((h) => [a, ...h.filter((x) => x.text.toLowerCase() !== a.text.toLowerCase())].slice(0, 12));
      setLoading(false);
    }, 650);
  };

  // Deep links: /ai/ask?q=<question> (the Analytics "Ask a question" bar) — ask it on arrival.
  React.useEffect(() => {
    const q0 = new URLSearchParams(window.location.search).get("q");
    if (!q0) return;
    const t = setTimeout(() => ask(q0), 0);
    return () => clearTimeout(t);
  }, []);

  const update = (patch: Partial<Query>) => {
    if (!current?.query) return;
    setCurrent({ ...current, query: { ...current.query, ...patch } });
  };

  const q = current?.query ?? null;
  const def = q ? METRICS[q.metric] : null;
  const blocked = def?.requires && !def.requires.some((k) => can(k, "V"));
  const filteredPool = q ? pool.filter((e) => (q.branch === "all" || e.branchId === q.branch) && (q.department === "all" || e.departmentId === q.department)) : pool;
  const result = q && def && !blocked ? def.run(q, filteredPool) : null;
  const filtersText = q
    ? [q.branch !== "all" ? `Branch = ${branchById(q.branch)?.city}` : null, q.department !== "all" ? `Department = ${deptName(q.department)}` : null, !broad ? `Scope = ${scope === "team" ? "your team" : "your department"}` : null].filter(Boolean).join(" · ")
    : "";

  return (
    <PageBody>
      <PageHeader
        title="Ask Analytics"
        description="Ask a question in plain English. It is translated into a query over approved, permission-checked reports — you can see and edit exactly how it was interpreted."
        actions={
          <span className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground">
            <Lock className="size-3 text-success-fg" aria-hidden />
            Answers come from permission-checked reports · no free-form SQL
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex flex-col gap-4">
          <Section bodyClassName="flex flex-col gap-3">
            <form
              className="flex gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                ask(text);
              }}
            >
              <label htmlFor="ask-input" className="sr-only">
                Ask a question about your workforce
              </label>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input id="ask-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Attrition in Pune last quarter" className="h-9 pl-8" autoComplete="off" />
              </div>
              <Button type="submit" size="lg" className={AI_TONE.solid} disabled={!text.trim() || loading}>
                {loading ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <ArrowRight aria-hidden />}
                Ask
              </Button>
            </form>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => ask(s)} className={cn("rounded-full border px-2 py-0.5 text-[11px] outline-none focus-visible:ring-2", AI_TONE.chip, AI_TONE.ring)}>
                  {s}
                </button>
              ))}
            </div>
          </Section>

          <div aria-live="polite" className="flex flex-col gap-3">
            {loading && (
              <Section bodyClassName="flex items-center gap-2 py-10 text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                Interpreting your question and checking report permissions…
              </Section>
            )}

            {!loading && current && !q && (
              <Section>
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <SearchX className="size-6 text-muted-foreground" aria-hidden />
                  <p className="text-sm font-semibold">I can only answer from approved reports</p>
                  <p className="max-w-md text-xs text-muted-foreground">
                    “{current.text}” doesn&apos;t map to a report I&apos;m allowed to query. I won&apos;t estimate or invent a number. Closest questions I can answer:
                  </p>
                  <div className="mt-1 flex flex-wrap justify-center gap-1.5">
                    {nearest(current.text).map((s) => (
                      <Button key={s} size="sm" variant="outline" onClick={() => ask(s)}>
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>
              </Section>
            )}

            {!loading && q && def && (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground">Interpreted as</span>
                  <AiBadge />
                  <Chip label="Metric" value={q.metric} options={(Object.keys(METRICS) as MetricId[]).map((m) => ({ value: m, label: METRICS[m].label }))} onChange={(v) => {
                    const m = v as MetricId;
                    update({ metric: m, dimension: METRICS[m].dims.includes(q.dimension) ? q.dimension : METRICS[m].dims[0], period: METRICS[m].periods.includes(q.period) ? q.period : METRICS[m].periods[0] });
                  }} />
                  <Chip label="By" value={q.dimension} options={def.dims.map((d) => ({ value: d, label: DIM_LABEL[d] }))} onChange={(v) => update({ dimension: v as Dim })} />
                  <Chip label="Period" value={q.period} options={def.periods.map((p) => ({ value: p, label: PERIOD_LABEL[p] }))} onChange={(v) => update({ period: v as Period })} />
                  {def.filterable && (
                    <>
                      <Chip label="Branch" value={q.branch} options={[{ value: "all", label: "All branches" }, ...BRANCHES.map((b) => ({ value: b.id, label: b.city }))]} onChange={(v) => update({ branch: v })} />
                      <Chip label="Department" value={q.department} options={[{ value: "all", label: "All departments" }, ...DEPARTMENTS.map((d) => ({ value: d.id, label: d.name }))]} onChange={(v) => update({ department: v })} />
                    </>
                  )}
                </div>

                {blocked ? (
                  <Alert tone="warning" icon={Lock} title={`${def.report} is outside your access`}>
                    This answer needs the {def.requires!.map((k) => (k === "payroll.runs" ? "Pay Runs" : "Leave Administration")).join(" or ")} grant, which {persona.role} doesn&apos;t hold. Ask Analytics never bypasses report permissions.
                  </Alert>
                ) : result && result.data.length > 0 ? (
                  <>
                    <div className={cn("rounded-md border px-3 py-2.5 text-[13px] text-foreground", AI_TONE.soft)}>{result.narrative}</div>
                    {result.chart === "line" ? (
                      <TrendLineChart title={`${def.label} · ${PERIOD_LABEL[q.period]}`} data={result.data} xKey={result.xKey} series={result.series} valueFormat={result.format} height={260} />
                    ) : (
                      <BarCompareChart title={`${def.label} by ${DIM_LABEL[q.dimension].toLowerCase()} · ${PERIOD_LABEL[q.period]}`} data={result.data} xKey={result.xKey} series={result.series} valueFormat={result.format} stacked={result.stacked} height={260} />
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <p>
                        Based on: <span className="font-medium text-foreground">{def.report}</span>
                        {filtersText && ` · ${filtersText}`} · {PERIOD_LABEL[q.period]} · as of {format(TODAY, "dd MMM yyyy")}
                      </p>
                      {can(def.hrefKey, "V") && (
                        <Button size="sm" variant="outline" asChild>
                          <Link href={def.href}>
                            Open full report
                            <ArrowRight aria-hidden />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <Alert tone="neutral" title="No data for this selection">
                    {result?.narrative ?? "The report returned no rows."} Try widening the filters.
                  </Alert>
                )}
              </>
            )}

            {!loading && !current && (
              <Section bodyClassName="flex flex-col items-center gap-2 py-10 text-center">
                <ShieldCheck className="size-6 text-success-fg" aria-hidden />
                <p className="text-sm font-semibold">Ask anything your reports can answer</p>
                <p className="max-w-lg text-xs text-muted-foreground">
                  Headcount, attrition, hiring speed, diversity, overtime and leave liability. Results respect your access — {broad ? "you see the whole organisation" : `you see ${scope === "team" ? "your reporting line" : "your department"} only`}.
                </p>
              </Section>
            )}
          </div>
        </div>

        <Section title="Your recent questions" actions={<History className="size-4 text-muted-foreground" aria-hidden />} bodyClassName="p-1.5">
          {history.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">Questions you ask in this session appear here.</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {history.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => ask(h.text)}
                    className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className={cn("mt-1 size-1.5 shrink-0 rounded-full", h.query ? "bg-success" : "bg-muted-foreground")} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-foreground">{h.text}</span>
                      <span className="block text-[10px] text-muted-foreground">{h.query ? METRICS[h.query.metric].report : "Not answerable"}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </PageBody>
  );
}
