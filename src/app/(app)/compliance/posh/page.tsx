"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { EyeOff, FileText, GraduationCap, Scale, ShieldAlert, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, pct } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import { IC_MEMBERS, POSH_CASES, POSH_STAGES, POSH_TRAINING, type PoshCase } from "@/mock/platform";
import { mockAction } from "@/components/app-state";
import { DataTable } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Alert, Avatar, Progress } from "@/components/ui/primitives";
import { FilterSelect } from "@/components/ui/overlays";
import { Facts, ReasonDialog, TonePill, useSimulatedTask } from "@/components/platform/kit";

const DAY = 86_400_000;
const daysSince = (iso: string, to = DEMO_TODAY) => Math.round((Date.parse(to) - Date.parse(iso)) / DAY);
const stageIndex = (c: PoshCase) => POSH_STAGES.findIndex((s) => s.id === c.stage);

function NinetyDayBar({ c }: { c: PoshCase }) {
  const elapsed = daysSince(c.filedAt, c.closedAt ?? DEMO_TODAY);
  const ratio = Math.min(1, elapsed / 90);
  const tone = c.stage === "closed" ? "bg-success" : elapsed > 90 ? "bg-destructive" : elapsed > 70 ? "bg-warning" : "bg-primary";
  return (
    <div className="w-[160px]">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="meter" aria-label="Days of the 90-day inquiry window used" aria-valuemin={0} aria-valuemax={90} aria-valuenow={Math.min(elapsed, 90)}>
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${ratio * 100}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {c.stage === "closed" ? `Closed in ${elapsed} days` : elapsed > 90 ? `${elapsed - 90} days over the limit` : `Day ${elapsed} of 90 · due ${fmtDate(new Date(Date.parse(c.filedAt) + 90 * DAY).toISOString().slice(0, 10))}`}
      </p>
    </div>
  );
}

function StageTrack({ c }: { c: PoshCase }) {
  const at = stageIndex(c);
  return (
    <ol className="flex items-center gap-1" aria-label={`Stage: ${POSH_STAGES[at].label}`}>
      {POSH_STAGES.map((s, i) => (
        <li key={s.id} title={s.label} className={cn("h-1.5 w-6 rounded-full", i <= at ? (c.stage === "closed" ? "bg-success" : "bg-primary") : "bg-muted")} />
      ))}
      <span className="ml-1.5 text-xs">{POSH_STAGES[at].label}</span>
    </ol>
  );
}

export default function PoshPage() {
  const loading = useFakeLoad();
  const [cases, setCases] = React.useState<PoshCase[]>(POSH_CASES);
  const [stageFilter, setStageFilter] = React.useState("all");
  const [advancing, setAdvancing] = React.useState<PoshCase | null>(null);
  const [year, setYear] = React.useState("2026");
  const task = useSimulatedTask(1600);

  const open = cases.filter((c) => c.stage !== "closed");
  const yearCases = cases.filter((c) => c.filedAt.startsWith(year));
  const report = {
    received: yearCases.length,
    disposed: yearCases.filter((c) => c.stage === "closed").length,
    pending: yearCases.filter((c) => c.stage !== "closed").length,
    over90: yearCases.filter((c) => c.stage !== "closed" && daysSince(c.filedAt) > 90).length,
  };

  const columns: ColumnDef<PoshCase, unknown>[] = [
    { accessorKey: "code", header: "Case", cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.code}</span> },
    { accessorKey: "filedAt", header: "Received", cell: ({ row }) => <span className="tnum text-xs">{fmtDate(row.original.filedAt)}</span> },
    { accessorKey: "branch", header: "Location", cell: ({ row }) => <span className="text-xs">{row.original.branch}</span> },
    { accessorKey: "nature", header: "Nature", cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.nature}</span> },
    { accessorKey: "stage", header: "Stage", cell: ({ row }) => <StageTrack c={row.original} /> },
    { id: "timeline", header: "90-day inquiry window", cell: ({ row }) => <NinetyDayBar c={row.original} /> },
    { accessorKey: "outcome", header: "Outcome", cell: ({ row }) => (row.original.outcome ? <TonePill tone={row.original.outcome === "Upheld" ? "serious" : "neutral"}>{row.original.outcome}</TonePill> : <span className="text-xs text-muted-foreground">—</span>) },
    {
      id: "__a",
      header: "",
      enableHiding: false,
      cell: ({ row }) =>
        row.original.stage !== "closed" ? (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <Gated menuKey="compliance.posh" action="E">
              <Button size="sm" variant="outline" onClick={() => setAdvancing(row.original)}>
                Move to {POSH_STAGES[stageIndex(row.original) + 1].label.toLowerCase()}
              </Button>
            </Gated>
          </div>
        ) : null,
    },
  ];

  return (
    <PageBody>
      <PageHeader
        title="POSH Register"
        description="Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013 — Internal Committee, case register and the annual report under Section 21."
      />

      <Alert tone="danger" icon={EyeOff} title="Restricted register">
        Visible only to Internal Committee members and the HR head. Names of complainants, respondents and witnesses are never shown here — cases are referenced by confidential code (Section 16). Every view is audit-logged.
      </Alert>

      {loading ? (
        <>
          <CardsSkeleton />
          <TableSkeleton rows={6} />
        </>
      ) : (
        <>
          <StatRow>
            <StatTile label="Open cases" value={open.length} icon={Scale} tone={open.length ? "warning" : "neutral"} onClick={() => setStageFilter("open")} />
            <StatTile label="Past 90 days, still open" value={open.filter((c) => daysSince(c.filedAt) > 90).length} icon={ShieldAlert} tone={open.some((c) => daysSince(c.filedAt) > 90) ? "critical" : "good"} hint="Inquiry must finish within 90 days" />
            <StatTile label="Awareness training" value={pct((POSH_TRAINING.completed / POSH_TRAINING.assigned) * 100)} icon={GraduationCap} hint={`${POSH_TRAINING.overdue} employees overdue`} />
            <StatTile label="IC members" value={IC_MEMBERS.length} icon={Users} hint="Incl. 1 external member" />
          </StatRow>

          <DataTable
            columns={columns}
            data={cases.filter((c) => (stageFilter === "all" ? true : stageFilter === "open" ? c.stage !== "closed" : c.stage === stageFilter))}
            searchKeys={["code", "branch", "nature"]}
            searchPlaceholder="Search by case code…"
            filters={<FilterSelect label="Stage" value={stageFilter} onValueChange={setStageFilter} width="w-[220px]" options={[{ value: "open", label: "All open" }, ...POSH_STAGES.map((s) => ({ value: s.id, label: s.label }))]} />}
            rowTone={(c) => (c.stage !== "closed" && daysSince(c.filedAt) > 70 ? "warning" : undefined)}
            exportName="posh-register"
            emptyIcon={Scale}
            emptyTitle="No cases"
            emptyDescription="No complaints match this filter."
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Section title="Internal Committee" description="Constituted under Section 4 · term to 31 Mar 2027" className="lg:col-span-1">
              <ul className="flex flex-col gap-2.5">
                {IC_MEMBERS.map((m) => (
                  <li key={m.name} className="flex items-start gap-2.5">
                    <Avatar name={m.name} size={28} />
                    <div className="min-w-0 text-xs">
                      <p className="font-medium">
                        {m.name} {m.role !== "Member" && <TonePill tone={m.role === "Presiding Officer" ? "accent" : "info"} className="ml-1">{m.role}</TonePill>}
                      </p>
                      <p className="text-muted-foreground">{m.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>

            <Section
              title="Annual report (Section 21)"
              description="Filed with the District Officer by 31 January."
              actions={<FilterSelect label="Year" value={year} onValueChange={(v) => v !== "all" && setYear(v)} allLabel="Year" width="w-[120px]" options={[{ value: "2026", label: "2026" }, { value: "2025", label: "2025" }]} />}
            >
              <Facts
                cols={2}
                items={[
                  { label: "Complaints received", value: <span className="tnum text-base font-semibold">{report.received}</span> },
                  { label: "Disposed of", value: <span className="tnum text-base font-semibold">{report.disposed}</span> },
                  { label: "Pending", value: <span className="tnum text-base font-semibold">{report.pending}</span> },
                  { label: "Pending over 90 days", value: <span className="tnum text-base font-semibold">{report.over90}</span> },
                  { label: "Awareness programmes", value: year === "2026" ? "3 workshops · 1 IC refresher" : "4 workshops" },
                  { label: "Action taken", value: year === "2026" ? "1 settled by conciliation" : "1 upheld (warning + transfer), 1 not upheld" },
                ]}
              />
              {task.runningKey === "report" && <Progress className="mt-3" value={task.progress} aria-label="Generating annual report" />}
              <Gated menuKey="compliance.posh" action="E">
                <Button
                  size="sm"
                  className="mt-3 w-full"
                  disabled={!!task.runningKey}
                  onClick={() =>
                    task.start("report", () =>
                      mockAction(`POSH annual report ${year} generated`, { description: "Form prescribed by the Karnataka rules, with no personal identifiers. Ready for the District Officer." }),
                    )
                  }
                >
                  <FileText /> Generate annual report
                </Button>
              </Gated>
            </Section>

            <Section title="Awareness training" description="Mandatory for every employee, annually.">
              <div className="flex flex-col gap-3 text-xs">
                <div>
                  <div className="mb-1 flex justify-between">
                    <span className="text-muted-foreground">Completed</span>
                    <span className="tnum font-medium">{POSH_TRAINING.completed} / {POSH_TRAINING.assigned}</span>
                  </div>
                  <Progress value={(POSH_TRAINING.completed / POSH_TRAINING.assigned) * 100} tone="success" aria-label="Training completion" />
                </div>
                <Facts
                  cols={2}
                  items={[
                    { label: "Overdue", value: `${POSH_TRAINING.overdue} employees` },
                    { label: "In progress", value: `${POSH_TRAINING.assigned - POSH_TRAINING.completed - POSH_TRAINING.overdue} employees` },
                    { label: "IC refresher", value: fmtDate(POSH_TRAINING.icRefresher) },
                    { label: "Next workshop", value: fmtDate(POSH_TRAINING.nextAwareness) },
                  ]}
                />
                <Gated menuKey="compliance.posh" action="E">
                  <Button size="sm" variant="outline" onClick={() => mockAction(`Reminder sent to ${POSH_TRAINING.overdue} employees`, { description: "Their managers are copied." })}>
                    Remind overdue employees
                  </Button>
                </Gated>
              </div>
            </Section>
          </div>
        </>
      )}

      <ReasonDialog
        open={!!advancing}
        onOpenChange={(v) => !v && setAdvancing(null)}
        title={advancing ? `Move ${advancing.code} to “${POSH_STAGES[stageIndex(advancing) + 1].label}”?` : ""}
        description="Recorded in the case file. Do not include names — refer to parties as Complainant, Respondent and Witness 1, 2…"
        confirmLabel="Update stage"
        destructive={false}
        commentLabel="Committee note"
        onConfirm={(note) => {
          if (!advancing) return;
          const next = POSH_STAGES[stageIndex(advancing) + 1].id;
          setCases((prev) => prev.map((c) => (c.code === advancing.code ? { ...c, stage: next, ...(next === "closed" ? { closedAt: DEMO_TODAY } : {}) } : c)));
          mockAction(`${advancing.code} moved to ${POSH_STAGES[stageIndex(advancing) + 1].label.toLowerCase()}`, { description: `Note: “${note}”` });
        }}
      />
    </PageBody>
  );
}
