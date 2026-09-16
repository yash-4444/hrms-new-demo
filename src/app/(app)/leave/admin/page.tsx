"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCog,
  Check,
  FlaskConical,
  Play,
  RotateCcw,
  Save,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDateTime, num } from "@/lib/format";
import { employeeByCode } from "@/mock/employees";
import {
  ACCRUAL_CONFIGS,
  LEAVE_EMPLOYEE_CODES,
  LEAVE_POLICY_RULES,
  LEAVE_RUNS,
  LEAVE_TYPES,
  dryRunAccrual,
  dryRunYearEnd,
  resolveAccrualConfig,
  type AccrualPreviewRow,
  type LeavePolicyRule,
  type LeaveRun,
  type LeaveTypeCode,
  type PolicyValue,
  type YearEndPreviewRow,
} from "@/mock/leave";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, NumCell } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Alert,
  Badge,
  Hint,
  Input,
  Label,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import {
  Gated,
  PageBody,
  PageHeader,
  Section,
  TableSkeleton,
  useFakeLoad,
} from "@/components/shell/page";

export default function LeaveAdminPage() {
  const loading = useFakeLoad();

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Leave administration" description="Loading configuration…" />
        <TableSkeleton />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="Leave administration"
        description="Batch jobs, leave types, accrual configuration and the 13 rules that govern every leave decision in the tenant."
      />

      <Tabs defaultValue="jobs">
        <TabsList>
          <TabsTrigger value="jobs">
            <Play /> Jobs
          </TabsTrigger>
          <TabsTrigger value="types">
            <CalendarCog /> Leave types
          </TabsTrigger>
          <TabsTrigger value="accruals">
            <Settings2 /> Accrual configs
          </TabsTrigger>
          <TabsTrigger value="policies">
            <SlidersHorizontal /> Policies
          </TabsTrigger>
        </TabsList>

        <TabsContent value="jobs">
          <JobsTab />
        </TabsContent>
        <TabsContent value="types">
          <TypesTab />
        </TabsContent>
        <TabsContent value="accruals">
          <AccrualsTab />
        </TabsContent>
        <TabsContent value="policies">
          <PoliciesTab />
        </TabsContent>
      </Tabs>
    </PageBody>
  );
}

/* ================================================================== jobs */

function JobsTab() {
  const { persona } = useApp();
  const [country, setCountry] = React.useState<"IN" | "US">("IN");
  const [runs, setRuns] = React.useState<LeaveRun[]>(LEAVE_RUNS);
  const [dialog, setDialog] = React.useState<null | "accrual" | "year_end">(null);
  const [preview, setPreview] = React.useState<
    { kind: "accrual"; rows: AccrualPreviewRow[] } | { kind: "year_end"; rows: YearEndPreviewRow[] } | null
  >(null);

  const filtered = runs.filter((r) => r.country === country);
  const lastRun = filtered[0];

  const openDialog = (kind: "accrual" | "year_end") => {
    setDialog(kind);
    setPreview(null);
  };

  const runDryRun = () => {
    if (dialog === "accrual") {
      setPreview({ kind: "accrual", rows: dryRunAccrual(country, "October 2026") });
      mockAction("Dry run complete", { description: "Nothing was written. Review the preview below." });
    } else if (dialog === "year_end") {
      setPreview({ kind: "year_end", rows: dryRunYearEnd(country) });
      mockAction("Dry run complete", { description: "Nothing was written. Review the preview below." });
    }
  };

  const commit = () => {
    if (!dialog) return;
    const isAccrual = dialog === "accrual";
    const rows = preview?.rows ?? [];
    const credited = isAccrual
      ? (rows as AccrualPreviewRow[]).reduce((a, b) => a + b.change, 0)
      : 0;
    const lapsed = !isAccrual ? (rows as YearEndPreviewRow[]).reduce((a, b) => a + b.lapsed, 0) : 0;
    const carried = !isAccrual
      ? (rows as YearEndPreviewRow[]).reduce((a, b) => a + b.carryForward, 0)
      : 0;
    const encashed = !isAccrual
      ? (rows as YearEndPreviewRow[]).reduce((a, b) => a + b.encashed, 0)
      : 0;

    const record: LeaveRun = {
      id: `${isAccrual ? "AC" : "YE"}-${country}-2026-10-${runs.length}`,
      runType: isAccrual ? "accrual" : "year_end",
      country,
      periodLabel: isAccrual ? "October 2026" : "FY 2026-27",
      runDate: "2026-09-16",
      status: "completed",
      employeesProcessed: rows.length,
      daysCredited: Math.round(credited * 100) / 100,
      daysLapsed: Math.round(lapsed * 100) / 100,
      daysCarriedForward: Math.round(carried * 100) / 100,
      daysEncashed: Math.round(encashed * 100) / 100,
      triggeredBy: persona.name,
      durationSeconds: 4,
      note: `Committed from the ${isAccrual ? "accrual" : "year-end"} dialog after a dry run.`,
    };
    setRuns((r) => [record, ...r]);
    setDialog(null);
    setPreview(null);
    mockAction(`${isAccrual ? "Accrual" : "Year-end"} run committed`, {
      description: `${num(rows.length)} employees processed for ${country === "IN" ? "India" : "United States"}.`,
    });
  };

  const columns = React.useMemo<ColumnDef<LeaveRun, unknown>[]>(
    () => [
      { accessorKey: "id", header: "Run", cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span> },
      {
        accessorKey: "runType",
        header: "Type",
        cell: ({ row }) => (
          <Badge variant="muted">{row.original.runType === "accrual" ? "Accrual" : "Year end"}</Badge>
        ),
      },
      { accessorKey: "periodLabel", header: "Period" },
      { accessorKey: "runDate", header: "Run on", cell: ({ row }) => <span className="tnum">{fmtDate(row.original.runDate)}</span> },
      { accessorKey: "employeesProcessed", header: "Employees", cell: ({ row }) => <NumCell>{num(row.original.employeesProcessed)}</NumCell> },
      { accessorKey: "daysCredited", header: "Credited", cell: ({ row }) => <NumCell>{row.original.daysCredited || "—"}</NumCell> },
      { accessorKey: "daysCarriedForward", header: "Carried", cell: ({ row }) => <NumCell>{row.original.daysCarriedForward || "—"}</NumCell> },
      { accessorKey: "daysEncashed", header: "Encashed", cell: ({ row }) => <NumCell>{row.original.daysEncashed || "—"}</NumCell> },
      { accessorKey: "daysLapsed", header: "Lapsed", cell: ({ row }) => <NumCell>{row.original.daysLapsed || "—"}</NumCell> },
      { accessorKey: "triggeredBy", header: "Triggered by" },
      { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-3">
      <StatRow cols={4}>
        <StatTile label="Runs on record" value={num(filtered.length)} icon={Play} hint={country === "IN" ? "India" : "United States"} />
        <StatTile label="Last run" value={lastRun ? fmtDate(lastRun.runDate) : "—"} icon={CalendarCog} hint={lastRun?.periodLabel} />
        <StatTile
          label="Days credited (all runs)"
          value={num(filtered.reduce((a, b) => a + b.daysCredited, 0))}
          icon={Sparkles}
          tone="good"
        />
        <StatTile
          label="Days lapsed (all runs)"
          value={num(filtered.reduce((a, b) => a + b.daysLapsed, 0))}
          icon={AlertTriangle}
          tone="warning"
          hint="Above the carry-forward cap"
        />
      </StatRow>

      <Section
        title="Batch jobs"
        description="Both jobs offer a dry run. Nothing is written until you commit the preview."
        actions={
          <>
            <Select value={country} onValueChange={(v) => setCountry(v as "IN" | "US")}>
              <SelectTrigger size="sm" className="w-[170px]" aria-label="Country">
                <span className="text-xs">{country === "IN" ? "India" : "United States"}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IN">India</SelectItem>
                <SelectItem value="US">United States</SelectItem>
              </SelectContent>
            </Select>
            <Gated menuKey="leave.admin" action="X">
              <Button variant="outline" size="sm" onClick={() => openDialog("accrual")}>
                <Play /> Run accrual
              </Button>
            </Gated>
            <Gated menuKey="leave.admin" action="X">
              <Button size="sm" onClick={() => openDialog("year_end")}>
                <RotateCcw /> Run year-end
              </Button>
            </Gated>
          </>
        }
        bodyClassName="p-4"
      >
        <DataTable
          columns={columns}
          data={filtered}
          searchKeys={["id", "periodLabel", "triggeredBy"]}
          searchPlaceholder="Search runs…"
          exportName="leave-run-ledger"
          getRowId={(r) => r.id}
          pageSize={10}
          emptyIcon={Play}
          emptyTitle="No runs for this country yet"
          emptyDescription="Trigger an accrual to create the first entry."
        />
      </Section>

      {/* ------------------------------------------------------- dialog */}
      <Dialog open={!!dialog} onOpenChange={(o) => !o && (setDialog(null), setPreview(null))}>
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>
              {dialog === "accrual" ? "Run monthly accrual" : "Run financial year-end close"}
            </DialogTitle>
            <DialogDescription>
              {dialog === "accrual"
                ? `Credits the next period's entitlement to every eligible employee in ${country === "IN" ? "India" : "the United States"}.`
                : `Closes FY 2026-27: carries forward up to the cap, encashes what the policy allows, and lapses the rest.`}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3">
            <Alert tone="info" icon={FlaskConical} title="Always dry-run first">
              A dry run computes exactly what would change and writes nothing. Review the preview,
              then commit only if it looks right.
            </Alert>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={runDryRun}>
                <FlaskConical /> Dry run
              </Button>
              {preview && (
                <span className="tnum text-xs text-muted-foreground">
                  {num(preview.rows.length)} employees would be affected
                </span>
              )}
            </div>

            {preview && (
              <div className="scrollbar-thin max-h-[320px] overflow-auto rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-subtle">
                    <tr className="border-b border-border">
                      <th className="px-2.5 py-1.5 text-left font-medium text-muted-foreground">Employee</th>
                      <th className="px-2.5 py-1.5 text-left font-medium text-muted-foreground">Department</th>
                      {preview.kind === "accrual" ? (
                        <>
                          <th data-numeric className="px-2.5 py-1.5 text-right font-medium text-muted-foreground">Current</th>
                          <th data-numeric className="px-2.5 py-1.5 text-right font-medium text-muted-foreground">Change</th>
                          <th data-numeric className="px-2.5 py-1.5 text-right font-medium text-muted-foreground">New balance</th>
                        </>
                      ) : (
                        <>
                          <th data-numeric className="px-2.5 py-1.5 text-right font-medium text-muted-foreground">Closing</th>
                          <th data-numeric className="px-2.5 py-1.5 text-right font-medium text-muted-foreground">Carry fwd</th>
                          <th data-numeric className="px-2.5 py-1.5 text-right font-medium text-muted-foreground">Encashed</th>
                          <th data-numeric className="px-2.5 py-1.5 text-right font-medium text-muted-foreground">Lapsed</th>
                        </>
                      )}
                      <th className="px-2.5 py-1.5 text-left font-medium text-muted-foreground">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.kind === "accrual"
                      ? preview.rows.map((r) => (
                          <tr key={r.employeeCode} className="border-b border-border/60 last:border-0">
                            <td className="px-2.5 py-1.5">
                              <span className="font-medium">{r.employeeName}</span>
                              <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">{r.employeeCode}</span>
                            </td>
                            <td className="px-2.5 py-1.5 text-muted-foreground">{r.department}</td>
                            <td data-numeric className="px-2.5 py-1.5 text-right">{r.currentBalance}</td>
                            <td data-numeric className={cn("px-2.5 py-1.5 text-right font-medium", r.change > 0 ? "text-success-fg" : "text-muted-foreground")}>
                              {r.change > 0 ? `+${r.change}` : "0"}
                            </td>
                            <td data-numeric className="px-2.5 py-1.5 text-right font-medium">{r.newBalance}</td>
                            <td className="px-2.5 py-1.5 text-[11px] text-muted-foreground">{r.note}</td>
                          </tr>
                        ))
                      : preview.rows.map((r) => (
                          <tr key={r.employeeCode} className="border-b border-border/60 last:border-0">
                            <td className="px-2.5 py-1.5">
                              <span className="font-medium">{r.employeeName}</span>
                              <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">{r.employeeCode}</span>
                            </td>
                            <td className="px-2.5 py-1.5 text-muted-foreground">{r.department}</td>
                            <td data-numeric className="px-2.5 py-1.5 text-right">{r.closing}</td>
                            <td data-numeric className="px-2.5 py-1.5 text-right text-success-fg">{r.carryForward}</td>
                            <td data-numeric className="px-2.5 py-1.5 text-right">{r.encashed || "—"}</td>
                            <td data-numeric className={cn("px-2.5 py-1.5 text-right", r.lapsed > 0 && "text-destructive-fg")}>
                              {r.lapsed || "—"}
                            </td>
                            <td className="px-2.5 py-1.5 text-[11px] text-muted-foreground">{r.note}</td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => (setDialog(null), setPreview(null))}>
              Cancel
            </Button>
            <Hint text={preview ? "" : "Run the dry run first so you can see what would change."}>
              <span className={cn(!preview && "cursor-not-allowed")}>
                <Button disabled={!preview} onClick={commit}>
                  <Check /> Commit run
                </Button>
              </span>
            </Hint>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ================================================================= types */

function TypesTab() {
  const [types, setTypes] = React.useState(LEAVE_TYPES);

  const toggle = (code: string, key: "paid" | "encashable" | "countsCalendarDays") => {
    setTypes((ts) =>
      ts.map((t) => (t.code === code ? { ...t, [key]: !t[key] } : t)),
    );
    const t = types.find((x) => x.code === code)!;
    mockAction(`${t.name} updated`, {
      description: `${key} is now ${!t[key] ? "on" : "off"}. Applies from the next accrual run.`,
    });
  };

  return (
    <Section
      title="Leave types"
      description="The catalogue every application, balance and accrual refers to."
      bodyClassName="p-0"
    >
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-subtle">
            <tr className="border-b border-border">
              {["Type", "Code", "Annual entitlement", "Accrual", "Max carry fwd", "Doc above", "Paid", "Encashable", "Calendar days"].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.code} className="border-b border-border last:border-0 hover:bg-muted/50">
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded bg-info-soft text-[10px] font-bold text-info-fg">
                      {t.letter}
                    </span>
                    <span className="font-medium">{t.name}</span>
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{t.code}</td>
                <td data-numeric className="px-3 py-2 text-muted-foreground">{t.annualQuota} days</td>
                <td className="px-3 py-2 text-muted-foreground">{t.accrualPerMonth > 0 ? `${t.accrualPerMonth}/month` : "Annual grant"}</td>
                <td data-numeric className="px-3 py-2 text-muted-foreground">{t.maxCarryForward}</td>
                <td data-numeric className="px-3 py-2 text-muted-foreground">
                  {t.requiresDocAboveDays ? `> ${t.requiresDocAboveDays} days` : "Never"}
                </td>
                {(["paid", "encashable", "countsCalendarDays"] as const).map((k) => (
                  <td key={k} className="px-3 py-2">
                    <Gated menuKey="leave.admin" action="E">
                      <Switch
                        checked={Boolean(t[k])}
                        onCheckedChange={() => toggle(t.code, k)}
                        aria-label={`${t.name} — ${k}`}
                      />
                    </Gated>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
        “Calendar days” means weekends and holidays inside the range are deducted too — the norm for
        maternity and paternity leave, never for casual leave.
      </p>
    </Section>
  );
}

/* ============================================================== accruals */

function AccrualsTab() {
  const [configs, setConfigs] = React.useState(ACCRUAL_CONFIGS);
  const [employeeCode, setEmployeeCode] = React.useState(LEAVE_EMPLOYEE_CODES[0]);
  const [typeCode, setTypeCode] = React.useState<LeaveTypeCode>("EL");

  const resolution = React.useMemo(
    () => resolveAccrualConfig(employeeCode, typeCode),
    [employeeCode, typeCode],
  );
  const employee = employeeByCode(employeeCode);

  const toggleActive = (id: string) => {
    setConfigs((cs) => cs.map((c) => (c.id === id ? { ...c, active: !c.active } : c)));
    const c = configs.find((x) => x.id === id)!;
    mockAction(`${c.name} ${c.active ? "deactivated" : "activated"}`, {
      description: "Resolution order re-evaluates on the next accrual run.",
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <Section
        title="Accrual configurations"
        description="Highest priority wins. A config only applies where every one of its scopes matches the employee."
        bodyClassName="p-0"
      >
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-subtle">
              <tr className="border-b border-border">
                {["Priority", "Config", "Type", "Scope", "Rate", "Frequency", "Credit on", "Waiting", "Round", "Active"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...configs]
                .sort((a, b) => b.priority - a.priority)
                .map((c) => {
                  const scopes = [
                    c.country && `Country ${c.country}`,
                    c.branchId && `Branch ${c.branchId}`,
                    c.departmentId && `Dept ${c.departmentId}`,
                    c.gradeId && `Grade ${c.gradeId}+`,
                    c.employmentType && c.employmentType,
                  ].filter(Boolean) as string[];
                  const isWinner = resolution.config?.id === c.id;
                  return (
                    <tr
                      key={c.id}
                      className={cn(
                        "border-b border-border last:border-0 hover:bg-muted/50",
                        isWinner && "bg-success-soft/40",
                        !c.active && "opacity-55",
                      )}
                    >
                      <td data-numeric className="px-3 py-2 font-medium">{c.priority}</td>
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-1.5">
                          <span className="font-medium">{c.name}</span>
                          {isWinner && (
                            <Badge variant="soft">
                              <Check className="size-3" aria-hidden /> resolves
                            </Badge>
                          )}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">{c.id}</span>
                      </td>
                      <td className="px-3 py-2"><Badge variant="muted">{c.typeCode}</Badge></td>
                      <td className="px-3 py-2">
                        <span className="flex flex-wrap gap-1">
                          {scopes.length ? (
                            scopes.map((s) => (
                              <Badge key={s} variant="outline">
                                {s}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground">Everyone</span>
                          )}
                        </span>
                      </td>
                      <td data-numeric className="px-3 py-2">{c.ratePerPeriod}</td>
                      <td className="px-3 py-2 text-muted-foreground">{c.frequency}</td>
                      <td className="px-3 py-2 text-muted-foreground">{c.creditOn}</td>
                      <td data-numeric className="px-3 py-2 text-muted-foreground">{c.waitingPeriodMonths} mo</td>
                      <td data-numeric className="px-3 py-2 text-muted-foreground">{c.roundTo}</td>
                      <td className="px-3 py-2">
                        <Gated menuKey="leave.admin" action="E">
                          <Switch
                            checked={c.active}
                            onCheckedChange={() => toggleActive(c.id)}
                            aria-label={`${c.name} active`}
                          />
                        </Gated>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ------------------------------------------------- the diagnostic */}
      <Section
        title="Which config resolves for this employee — and why"
        description="Walks the resolution chain step by step, so an unexpected accrual is never a mystery."
        actions={
          <>
            <Select value={employeeCode} onValueChange={setEmployeeCode}>
              <SelectTrigger size="sm" className="w-[230px]" aria-label="Employee">
                <span className="truncate text-xs">
                  {employee ? `${employee.name} · ${employee.code}` : employeeCode}
                </span>
              </SelectTrigger>
              <SelectContent>
                {LEAVE_EMPLOYEE_CODES.slice(0, 40).map((code) => {
                  const e = employeeByCode(code);
                  return (
                    <SelectItem key={code} value={code}>
                      {e ? `${e.name} · ${code}` : code}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Select value={typeCode} onValueChange={(v) => setTypeCode(v as LeaveTypeCode)}>
              <SelectTrigger size="sm" className="w-[170px]" aria-label="Leave type">
                <span className="truncate text-xs">
                  {LEAVE_TYPES.find((t) => t.code === typeCode)?.name}
                </span>
              </SelectTrigger>
              <SelectContent>
                {LEAVE_TYPES.map((t) => (
                  <SelectItem key={t.code} value={t.code}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      >
        <ol className="flex flex-col gap-0">
          {resolution.steps.map((s, i) => {
            const tone =
              s.outcome === "pass"
                ? "text-success-fg bg-success-soft border-success/25"
                : s.outcome === "narrow"
                  ? "text-info-fg bg-info-soft border-info/25"
                  : "text-destructive-fg bg-destructive-soft border-destructive/25";
            const Icon = s.outcome === "fail" ? X : s.outcome === "narrow" ? ArrowRight : Check;
            return (
              <li key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border", tone)}>
                    <Icon className="size-3" aria-hidden />
                  </span>
                  {i < resolution.steps.length - 1 && <span className="w-px flex-1 bg-border" aria-hidden />}
                </div>
                <div className="pb-3">
                  <p className="text-xs font-medium">{s.label}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{s.detail}</p>
                </div>
              </li>
            );
          })}
        </ol>

        {resolution.config ? (
          <Alert tone="success" icon={Check} title={`Resolved: ${resolution.config.name}`} className="mt-1">
            {resolution.config.ratePerPeriod} day(s) per {resolution.config.frequency.toLowerCase()}{" "}
            period, credited on the {resolution.config.creditOn.toLowerCase()}, rounded to{" "}
            {resolution.config.roundTo}, after a {resolution.config.waitingPeriodMonths}-month waiting
            period. Priority {resolution.config.priority} beat every other matching config.
          </Alert>
        ) : (
          <Alert tone="danger" icon={AlertTriangle} title="No configuration resolves" className="mt-1">
            This employee would accrue nothing for {LEAVE_TYPES.find((t) => t.code === typeCode)?.name}.
            The engine fails closed rather than guessing a default.
          </Alert>
        )}
      </Section>
    </div>
  );
}

/* =============================================================== policies */

function PoliciesTab() {
  const [rules, setRules] = React.useState<LeavePolicyRule[]>(LEAVE_POLICY_RULES);
  const [dirty, setDirty] = React.useState(false);
  const [query, setQuery] = React.useState("");

  /* Unsaved-changes guard. */
  React.useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const setValue = (id: string, value: PolicyValue) => {
    setRules((rs) => rs.map((r) => (r.id === id ? { ...r, value } : r)));
    setDirty(true);
  };

  const groups = ["Eligibility", "Application", "Balance", "Approval"] as const;

  const visible = rules.filter(
    (r) =>
      !query.trim() ||
      r.label.toLowerCase().includes(query.toLowerCase()) ||
      r.explanation.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the 13 rules…"
            aria-label="Search policy rules"
            className="h-7 w-[240px] pl-7 text-xs"
          />
        </div>
        <span className="tnum text-xs text-muted-foreground">
          {visible.length} of {rules.length} rules
        </span>
        <div className="ml-auto flex gap-1.5">
          {dirty && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRules(LEAVE_POLICY_RULES);
                setDirty(false);
                mockAction("Policy reverted", { description: "Back to the saved configuration." });
              }}
            >
              <RotateCcw /> Revert
            </Button>
          )}
          <Gated menuKey="leave.admin" action="E">
            <Button
              size="sm"
              disabled={!dirty}
              onClick={() => {
                setDirty(false);
                mockAction("Leave policy saved", {
                  description: "All 13 rules applied. New applications are validated against them immediately.",
                });
              }}
            >
              <Save /> Save policy
            </Button>
          </Gated>
        </div>
      </div>

      {dirty && (
        <Alert tone="warning" icon={AlertTriangle} title="Unsaved changes">
          Leaving this tab keeps your edits in memory, but navigating away from the app will discard
          them.
        </Alert>
      )}

      {groups.map((g) => {
        const inGroup = visible.filter((r) => r.group === g);
        if (inGroup.length === 0) return null;
        return (
          <Section key={g} title={g} description={`${inGroup.length} rule${inGroup.length === 1 ? "" : "s"}`} bodyClassName="p-0">
            <ul>
              {inGroup.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-start gap-4 border-b border-border px-4 py-3 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <Label htmlFor={r.id} className="text-xs">
                      {r.label}
                    </Label>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {r.explanation}
                    </p>
                  </div>
                  <div className="flex w-[190px] shrink-0 items-center justify-end gap-2">
                    {r.kind === "toggle" ? (
                      <Gated menuKey="leave.admin" action="E">
                        <Switch
                          id={r.id}
                          checked={Boolean(r.value)}
                          onCheckedChange={(v) => setValue(r.id, v)}
                          aria-label={r.label}
                        />
                      </Gated>
                    ) : r.kind === "select" ? (
                      <Select value={String(r.value)} onValueChange={(v) => setValue(r.id, v)}>
                        <SelectTrigger size="sm" id={r.id} className="w-full" aria-label={r.label}>
                          <span className="truncate text-xs">{String(r.value)}</span>
                        </SelectTrigger>
                        <SelectContent>
                          {(r.options ?? []).map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : r.kind === "number" ? (
                      <>
                        <Input
                          id={r.id}
                          type="number"
                          min={r.min}
                          max={r.max}
                          step={r.step ?? 1}
                          value={Number(r.value)}
                          onChange={(e) => setValue(r.id, Number(e.target.value))}
                          className="tnum h-7 w-[92px]"
                        />
                        {r.unit && (
                          <span className="shrink-0 text-[11px] text-muted-foreground">{r.unit}</span>
                        )}
                      </>
                    ) : (
                      <Input
                        id={r.id}
                        value={String(r.value)}
                        onChange={(e) => setValue(r.id, e.target.value)}
                        className="h-7"
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        );
      })}

      {visible.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-sm font-semibold">No rule matches “{query}”</p>
          <p className="mt-1 text-xs text-muted-foreground">Try “notice”, “carry”, “negative” or “approval”.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setQuery("")}>
            Clear search
          </Button>
        </Card>
      )}
    </div>
  );
}
