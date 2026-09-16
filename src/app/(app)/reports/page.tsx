"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Play,
  ScrollText,
  Search,
  ShieldCheck,
  Star,
  StarOff,
} from "lucide-react";
import { fmtDate, num } from "@/lib/format";
import { BRANCHES, DEPARTMENTS } from "@/mock/org";
import {
  REPORTS,
  REPORT_MODULES,
  REPORT_RUN_ACTIVITY,
  type ReportDef,
} from "@/mock/insights";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Alert,
  Badge,
  Field,
  Hint,
  Label,
  Skeleton,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/primitives";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FilterSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { BarCompareChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import {
  Gated,
  PageBody,
  PageHeader,
  Section,
  TableSkeleton,
  useFakeLoad,
} from "@/components/shell/page";

/* ============================================================================
   /reports — the report library.

   Every report is runnable: choosing parameters and pressing Run produces a
   queued-then-ready run in the Run History tab, with a preview of the first
   rows. Nothing is written to disk; the run log is in-memory.
   ========================================================================== */

interface RunRecord {
  id: string;
  reportId: string;
  reportName: string;
  format: string;
  scope: string;
  period: string;
  rows: number;
  at: string;
  status: "processing" | "completed";
  by: string;
}

const SEED_RUNS: RunRecord[] = [
  { id: "RUN-2481", reportId: "r-py-01", reportName: "Payroll Register", format: "XLSX", scope: "All branches", period: "August 2026", rows: 340, at: "2026-08-31T18:04:00", status: "completed", by: "Rahul Desai" },
  { id: "RUN-2480", reportId: "r-py-03", reportName: "PF ECR", format: "CSV", scope: "India", period: "August 2026", rows: 306, at: "2026-08-20T11:22:00", status: "completed", by: "Rahul Desai" },
  { id: "RUN-2479", reportId: "r-at-01", reportName: "Monthly Attendance Register", format: "PDF", scope: "All branches", period: "August 2026", rows: 340, at: "2026-09-01T07:00:00", status: "completed", by: "Scheduler" },
  { id: "RUN-2478", reportId: "r-hc-03", reportName: "Attrition Analysis", format: "XLSX", scope: "All branches", period: "FY 2026-27 to date", rows: 61, at: "2026-09-01T07:02:00", status: "completed", by: "Scheduler" },
  { id: "RUN-2477", reportId: "r-wp-03", reportName: "Helpdesk SLA Performance", format: "XLSX", scope: "All branches", period: "Last 7 days", rows: 40, at: "2026-09-16T06:30:00", status: "completed", by: "Scheduler" },
];

const PERIOD_OPTIONS = [
  "This month",
  "Last month",
  "Last 3 months",
  "Current quarter",
  "FY 2026-27 to date",
  "Last financial year",
  "Custom range",
];

export default function ReportsPage() {
  const loading = useFakeLoad();
  const { persona } = useApp();

  const [moduleFilter, setModuleFilter] = React.useState("all");
  const [onlyFavourites, setOnlyFavourites] = React.useState(false);
  const [onlyStatutory, setOnlyStatutory] = React.useState(false);
  const [favourites, setFavourites] = React.useState<Set<string>>(
    () => new Set(REPORTS.filter((r) => r.favourite).map((r) => r.id)),
  );
  const [runs, setRuns] = React.useState<RunRecord[]>(SEED_RUNS);
  const [active, setActive] = React.useState<ReportDef | null>(null);
  const [tab, setTab] = React.useState("library");

  /* run dialog parameters */
  const [fmt, setFmt] = React.useState("XLSX");
  const [period, setPeriod] = React.useState("This month");
  const [branch, setBranch] = React.useState("all");
  const [department, setDepartment] = React.useState("all");
  const [includeInactive, setIncludeInactive] = React.useState(false);

  const openRun = (r: ReportDef) => {
    setActive(r);
    setFmt(r.format[0]);
    setPeriod(r.module === "Payroll" ? "Last month" : "This month");
    setBranch("all");
    setDepartment("all");
    setIncludeInactive(false);
  };

  const toggleFavourite = (id: string) => {
    setFavourites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        mockAction("Removed from favourites");
      } else {
        next.add(id);
        mockAction("Added to favourites");
      }
      return next;
    });
  };

  const runReport = () => {
    if (!active) return;
    const scopeParts: string[] = [];
    scopeParts.push(branch === "all" ? "All branches" : BRANCHES.find((b) => b.id === branch)!.city);
    if (department !== "all") scopeParts.push(DEPARTMENTS.find((d) => d.id === department)!.name);
    const id = `RUN-${2482 + runs.length - SEED_RUNS.length}`;
    const record: RunRecord = {
      id,
      reportId: active.id,
      reportName: active.name,
      format: fmt,
      scope: scopeParts.join(" · "),
      period,
      rows: active.rows,
      at: "2026-09-16T14:35:00",
      status: "processing",
      by: persona.name,
    };
    setRuns((r) => [record, ...r]);
    setActive(null);
    setTab("history");
    mockAction(`${record.reportName} queued`, {
      description: `${record.scope} · ${period} · ${fmt}. Run ${id}.`,
    });
    // Optimistic completion so the demo shows the finished state.
    setTimeout(() => {
      setRuns((rs) => rs.map((x) => (x.id === id ? { ...x, status: "completed" } : x)));
    }, 1400);
  };

  const visible = React.useMemo(
    () =>
      REPORTS.filter(
        (r) =>
          (moduleFilter === "all" || r.module === moduleFilter) &&
          (!onlyFavourites || favourites.has(r.id)) &&
          (!onlyStatutory || r.statutory),
      ),
    [moduleFilter, onlyFavourites, onlyStatutory, favourites],
  );

  const scheduledCount = REPORTS.filter((r) => r.scheduled).length;
  const statutoryCount = REPORTS.filter((r) => r.statutory).length;

  const runColumns = React.useMemo<ColumnDef<RunRecord, unknown>[]>(
    () => [
      { accessorKey: "id", header: "Run", cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span> },
      { accessorKey: "reportName", header: "Report" },
      { accessorKey: "scope", header: "Scope" },
      { accessorKey: "period", header: "Period" },
      {
        accessorKey: "rows",
        header: "Rows",
        cell: ({ row }) => <span className="tnum block text-right">{num(row.original.rows)}</span>,
      },
      { accessorKey: "format", header: "Format", cell: ({ row }) => <Badge variant="muted">{row.original.format}</Badge> },
      { accessorKey: "by", header: "Run by" },
      {
        accessorKey: "at",
        header: "When",
        cell: ({ row }) => <span className="tnum">{fmtDate(row.original.at)}</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Download ${row.original.reportName}`}
            disabled={row.original.status !== "completed"}
            onClick={() =>
              mockAction(`Downloading ${row.original.reportName}`, {
                description: `${row.original.id}.${row.original.format.toLowerCase()} — not written to disk in the demo.`,
              })
            }
          >
            <Download />
          </Button>
        ),
      },
    ],
    [],
  );

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Reports" description="Loading the report library…" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px]" />
          ))}
        </div>
        <TableSkeleton />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="Reports"
        description="Every operational and statutory report in one library. Choose parameters, run it, and pick the output up from the run history."
        actions={
          <Gated menuKey="reports" action="C">
            <Button
              size="sm"
              onClick={() =>
                mockAction("Report builder opened", {
                  description: "Custom report authoring is stubbed in this demo build.",
                })
              }
            >
              <ScrollText /> New custom report
            </Button>
          </Gated>
        }
      />

      <StatRow cols={4}>
        <StatTile label="Reports available" value={num(REPORTS.length)} icon={FileText} hint={`Across ${REPORT_MODULES.length} modules`} />
        <StatTile label="Scheduled" value={num(scheduledCount)} icon={CalendarClock} hint="Running without anyone asking" />
        <StatTile label="Statutory packs" value={num(statutoryCount)} icon={ShieldCheck} tone="warning" hint="PF, ESI, PT, TDS, POSH, access review" />
        <StatTile label="Runs this week" value={num(runs.length + 23)} icon={Play} deltaValue={11.4} deltaLabel="vs last week" />
      </StatRow>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="library">
            <FileSpreadsheet /> Library
          </TabsTrigger>
          <TabsTrigger value="history">
            <Clock /> Run history
          </TabsTrigger>
          <TabsTrigger value="schedules">
            <CalendarClock /> Schedules
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------ library */}
        <TabsContent value="library" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterSelect
              label="Module"
              value={moduleFilter}
              onValueChange={setModuleFilter}
              allLabel="All modules"
              width="w-[170px]"
              options={REPORT_MODULES.map((m) => ({ value: m, label: m }))}
            />
            <label className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 text-xs">
              <Switch checked={onlyFavourites} onCheckedChange={setOnlyFavourites} aria-label="Favourites only" />
              Favourites only
            </label>
            <label className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 text-xs">
              <Switch checked={onlyStatutory} onCheckedChange={setOnlyStatutory} aria-label="Statutory only" />
              Statutory only
            </label>
            <span className="tnum ml-auto text-xs text-muted-foreground">
              {visible.length} of {REPORTS.length} reports
            </span>
          </div>

          {visible.length === 0 ? (
            <Card className="flex flex-col items-center gap-2 border-dashed p-10 text-center">
              <Search className="size-5 text-muted-foreground" aria-hidden />
              <p className="text-sm font-semibold">No reports match those filters</p>
              <p className="text-xs text-muted-foreground">
                Clear the favourites or statutory switches, or pick a different module.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-1"
                onClick={() => {
                  setModuleFilter("all");
                  setOnlyFavourites(false);
                  setOnlyStatutory(false);
                }}
              >
                Clear filters
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((r) => {
                const fav = favourites.has(r.id);
                return (
                  <Card key={r.id} className="flex flex-col p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="text-sm font-semibold tracking-tight">{r.name}</h3>
                          {r.statutory && (
                            <Hint text="Statutory pack — the filing layout is fixed by the regulator">
                              <Badge variant="muted">
                                <ShieldCheck className="size-3" aria-hidden /> Statutory
                              </Badge>
                            </Hint>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{r.module}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={fav ? `Remove ${r.name} from favourites` : `Add ${r.name} to favourites`}
                        aria-pressed={fav}
                        onClick={() => toggleFavourite(r.id)}
                      >
                        {fav ? <Star className="fill-[var(--warning)] text-[var(--warning)]" /> : <StarOff />}
                      </Button>
                    </div>

                    <p className="mt-1.5 min-h-[48px] text-xs leading-relaxed text-muted-foreground">
                      {r.description}
                    </p>

                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border pt-2 text-[11px]">
                      <dt className="text-muted-foreground">Rows</dt>
                      <dd className="tnum text-right font-medium">{num(r.rows)}</dd>
                      <dt className="text-muted-foreground">Owner</dt>
                      <dd className="truncate text-right font-medium">{r.owner}</dd>
                      <dt className="text-muted-foreground">Last run</dt>
                      <dd className="tnum text-right font-medium">{r.lastRun ? fmtDate(r.lastRun) : "Never"}</dd>
                      <dt className="text-muted-foreground">Schedule</dt>
                      <dd className="truncate text-right font-medium">{r.scheduled ?? "On demand"}</dd>
                    </dl>

                    <div className="mt-2.5 flex items-center gap-1.5 border-t border-border pt-2.5">
                      <div className="flex gap-1">
                        {r.format.map((f) => (
                          <Badge key={f} variant="outline">
                            {f}
                          </Badge>
                        ))}
                      </div>
                      <Gated menuKey="reports" action="X">
                        <Button size="sm" className="ml-auto" onClick={() => openRun(r)}>
                          <Play /> Run
                        </Button>
                      </Gated>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ------------------------------------------------------ history */}
        <TabsContent value="history" className="flex flex-col gap-3">
          <DataTable
            columns={runColumns}
            data={runs}
            searchKeys={["reportName", "id", "by", "scope"]}
            searchPlaceholder="Search runs…"
            exportName="report-run-history"
            getRowId={(r) => r.id}
            emptyIcon={Clock}
            emptyTitle="No runs yet"
            emptyDescription="Run a report from the Library tab and it will appear here."
            pageSize={10}
          />
          <BarCompareChart
            title="Report runs by week"
            description="Scheduled runs versus runs a human asked for."
            data={REPORT_RUN_ACTIVITY.map((w) => ({
              week: w.week,
              scheduled: w.scheduled,
              manual: w.manual,
            }))}
            xKey="week"
            series={[
              { key: "scheduled", label: "Scheduled" },
              { key: "manual", label: "Manual" },
            ]}
            stacked
            height={220}
            footnote="A healthy ratio tilts toward scheduled — manual spikes usually mean a schedule is missing."
          />
        </TabsContent>

        {/* ---------------------------------------------------- schedules */}
        <TabsContent value="schedules">
          <Section
            title="Active schedules"
            description="Reports that run on their own and land in the owner's inbox."
          >
            <ul className="flex flex-col">
              {REPORTS.filter((r) => r.scheduled).map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 border-b border-border py-2.5 last:border-0"
                >
                  <CheckCircle2 className="size-4 shrink-0 text-success-fg" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">{r.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {r.module} · owner {r.owner} · {num(r.rows)} rows
                    </p>
                  </div>
                  <Badge variant="soft">{r.scheduled}</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      mockAction(`Schedule paused — ${r.name}`, {
                        description: "It will not run again until resumed.",
                      })
                    }
                  >
                    Pause
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openRun(r)}>
                    <Play /> Run now
                  </Button>
                </li>
              ))}
            </ul>
          </Section>
        </TabsContent>
      </Tabs>

      {/* ------------------------------------------------------ run dialog */}
      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent size="md">
          {active && (
            <>
              <DialogHeader>
                <DialogTitle>Run · {active.name}</DialogTitle>
                <DialogDescription>{active.description}</DialogDescription>
              </DialogHeader>
              <DialogBody className="flex flex-col gap-3">
                {active.statutory && (
                  <Alert tone="warning" icon={ShieldCheck} title="Statutory output">
                    The column layout of this pack is fixed by the regulator and cannot be customised.
                  </Alert>
                )}

                <Field label="Period" htmlFor="rp-period" required>
                  <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger id="rp-period">
                      <span className="text-xs">{period}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {PERIOD_OPTIONS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Branch" htmlFor="rp-branch">
                    <Select value={branch} onValueChange={setBranch}>
                      <SelectTrigger id="rp-branch">
                        <span className="text-xs">
                          {branch === "all" ? "All branches" : BRANCHES.find((b) => b.id === branch)?.city}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All branches</SelectItem>
                        {BRANCHES.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Department" htmlFor="rp-dept">
                    <Select value={department} onValueChange={setDepartment}>
                      <SelectTrigger id="rp-dept">
                        <span className="truncate text-xs">
                          {department === "all"
                            ? "All departments"
                            : DEPARTMENTS.find((d) => d.id === department)?.name}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All departments</SelectItem>
                        {DEPARTMENTS.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <Field label="Output format" required>
                  <div className="flex gap-1.5">
                    {active.format.map((f) => (
                      <Button
                        key={f}
                        type="button"
                        variant={fmt === f ? "default" : "outline"}
                        size="sm"
                        aria-pressed={fmt === f}
                        onClick={() => setFmt(f)}
                      >
                        {f}
                      </Button>
                    ))}
                  </div>
                </Field>

                <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <div>
                    <Label htmlFor="rp-inactive">Include exited employees</Label>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Off by default — most consumers want the live roster only.
                    </p>
                  </div>
                  <Switch id="rp-inactive" checked={includeInactive} onCheckedChange={setIncludeInactive} />
                </div>

                <div className="rounded-md border border-border bg-subtle p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Preview
                  </p>
                  <p className="tnum mt-1 text-xs">
                    ~{num(includeInactive ? active.rows + 61 : active.rows)} rows ·{" "}
                    {branch === "all" ? "all branches" : BRANCHES.find((b) => b.id === branch)?.city} ·{" "}
                    {department === "all" ? "all departments" : DEPARTMENTS.find((d) => d.id === department)?.name} ·{" "}
                    {period} · {fmt}
                  </p>
                </div>
              </DialogBody>
              <DialogFooter>
                <Button variant="outline" onClick={() => setActive(null)}>
                  Cancel
                </Button>
                <Button onClick={runReport}>
                  <Play /> Run report
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </PageBody>
  );
}
