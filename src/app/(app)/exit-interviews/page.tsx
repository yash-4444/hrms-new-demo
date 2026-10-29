"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarCheck, MessagesSquare, RefreshCw, Repeat2, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { mockAction } from "@/components/app-state";
import { DataTable } from "@/components/data-table";
import { DonutChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, ChartSkeleton, Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { FilterSelect } from "@/components/ui/overlays";
import { PersonCell } from "@/components/people/person-cell";
import { AI_TONE, AiBadge, AiDraftBanner, AiExplainButton } from "@/components/ai";
import { ExitInterviewSheet, RecordInterviewDialog } from "@/components/lifecycle/exit-interview-sheet";
import { DEMO_TODAY, deptName } from "@/mock/org";
import { EXIT_INTERVIEWS, THEMES, type ExitInterview, type Theme } from "@/mock/lifecycle";

/* ============================================================================
   /exit-interviews — scheduled and completed interviews, the reasons mix, and
   an AI read of the free-text answers. Themes are recomputed from the rows in
   state, so recording a new interview moves the percentages.
   ========================================================================== */

/** Keyword tagger used when HR records a new answer — the "model" behind the themes. */
const THEME_WORDS: Record<Theme, RegExp> = {
  "Career growth": /growth|promot|career|lead|path|staff|level/i,
  "Manager relationship": /manager|lead\b|skip|reporting|mentor/i,
  Compensation: /pay|salary|compensation|ctc|commission|counter-offer|accelerator/i,
  "Work-life balance": /balance|hours|crunch|burn|week|part-time|remote/i,
  "Relocation & personal": /relocat|family|move|city|personal/i,
  "Role clarity": /role|expectation|clarity|goals|handover|restructure/i,
};
const tagThemes = (text: string) => THEMES.filter((t) => THEME_WORDS[t].test(text));

const avgRating = (x: ExitInterview) => (x.ratings ? Object.values(x.ratings).reduce((a, b) => a + b, 0) / 4 : 0);

export default function ExitInterviewsPage() {
  const loading = useFakeLoad();
  const [rows, setRows] = React.useState<ExitInterview[]>(EXIT_INTERVIEWS);
  const [status, setStatus] = React.useState("all");
  const [viewing, setViewing] = React.useState<ExitInterview | null>(null);
  const [recording, setRecording] = React.useState<ExitInterview | null>(null);
  const [regenerating, setRegenerating] = React.useState(false);

  const done = rows.filter((r) => r.status === "completed");
  const themes = THEMES.map((t) => {
    const hits = done.filter((d) => d.themes.includes(t));
    return { theme: t, count: hits.length, pct: Math.round((hits.length / Math.max(1, done.length)) * 100), quote: hits[0]?.keepUs };
  }).sort((a, b) => b.count - a.count);

  const reasons = Object.entries(
    done.reduce<Record<string, number>>((acc, d) => {
      acc[d.primaryReason] = (acc[d.primaryReason] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value }));

  const regenerate = () => {
    setRegenerating(true);
    setTimeout(() => {
      setRegenerating(false);
      mockAction("Themes refreshed", { description: `Re-read ${done.length} completed interviews.`, tone: "info" });
    }, 900);
  };

  const columns: ColumnDef<ExitInterview, unknown>[] = [
    { id: "name", header: "Employee", accessorKey: "name", enableHiding: false, cell: ({ row }) => <PersonCell name={row.original.name} subtitle={row.original.designation} /> },
    { id: "dept", header: "Department", accessorFn: (x) => deptName(x.departmentId) },
    { id: "exit", header: "Exit date", accessorKey: "exitDate", cell: ({ row }) => <span className="tnum">{fmtDate(row.original.exitDate)}</span> },
    { id: "when", header: "Interview", accessorKey: "scheduledOn", cell: ({ row }) => <span className="tnum">{fmtDate(row.original.scheduledOn)}</span> },
    { id: "interviewer", header: "Interviewer", accessorKey: "interviewer" },
    { id: "reason", header: "Primary reason", accessorKey: "primaryReason" },
    {
      id: "score",
      header: "Avg rating",
      accessorFn: avgRating,
      cell: ({ row }) => {
        const v = avgRating(row.original);
        return v ? <span className={cn("tnum font-medium", v < 3 ? "text-destructive-fg" : v < 3.75 ? "text-warning-fg" : "text-success-fg")}>{v.toFixed(2)}</span> : <span className="text-muted-foreground">—</span>;
      },
    },
    { id: "return", header: "Would return", accessorKey: "wouldReturn", cell: ({ row }) => row.original.wouldReturn ?? <span className="text-muted-foreground">—</span> },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) =>
        row.original.status === "completed" ? (
          <StatusBadge status="completed" />
        ) : (
          <span className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <StatusBadge status="scheduled" />
            <Gated menuKey="lifecycle.exit_interviews" action="E">
              <Button size="sm" variant="outline" onClick={() => setRecording(row.original)}>
                Record
              </Button>
            </Gated>
          </span>
        ),
    },
  ];

  return (
    <PageBody>
      <PageHeader title="Exit Interviews" description="Structured conversations with every leaver. Ratings are confidential to HR; themes are reported in aggregate only." />
      {loading ? (
        <CardsSkeleton />
      ) : (
        <StatRow>
          <StatTile label="Completed this FY" value={done.length} icon={MessagesSquare} />
          <StatTile label="Scheduled" value={rows.length - done.length} icon={CalendarCheck} onClick={() => setStatus("scheduled")} />
          <StatTile label="Would recommend Stellar" value={`${Math.round((done.filter((d) => (d.ratings?.recommend ?? 0) >= 4).length / Math.max(1, done.length)) * 100)}%`} icon={ThumbsUp} hint="Rated 4 or 5" />
          <StatTile label="Open to returning" value={`${Math.round((done.filter((d) => d.wouldReturn === "Yes").length / Math.max(1, done.length)) * 100)}%`} icon={Repeat2} hint="Answered Yes — feeds the alumni rehire list" />
        </StatRow>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {loading ? (
          <ChartSkeleton />
        ) : (
          <DonutChart title="Primary reason for leaving" description={`${done.length} completed interviews`} data={reasons} centreLabel="Interviews" centreValue={String(done.length)} />
        )}
        <Section
          title="Themes across responses"
          description="What leavers said we could have done differently."
          actions={
            <>
              <AiExplainButton
                title="How themes are found"
                summary="Each free-text answer is tagged with one or more themes. A theme's share is the number of interviews that mention it divided by completed interviews, so shares can add up to more than 100%."
                drivers={themes.map((t) => ({ label: t.theme, detail: `${t.count} of ${done.length} interviews`, weight: t.count }))}
              />
              <Button size="sm" variant="ghost" onClick={regenerate} disabled={regenerating} aria-label="Regenerate themes">
                <RefreshCw className={cn(regenerating && "animate-spin")} aria-hidden />
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <AiBadge label="AI themes" />
              <p className="text-xs text-muted-foreground">
                Top themes: {themes.slice(0, 2).map((t) => `${t.theme} (${t.pct}%)`).join(", ")}
              </p>
            </div>
            <ul className="flex flex-col gap-2.5" aria-busy={regenerating}>
              {themes.map((t) => (
                <li key={t.theme} className="text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{t.theme}</span>
                    <span className="tnum text-muted-foreground">
                      {t.pct}% · {t.count} interview{t.count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-violet-500 dark:bg-violet-400" style={{ width: `${t.pct}%` }} />
                  </div>
                  {t.quote && t.count > 1 && <p className={cn("mt-1 line-clamp-1 text-[11px] italic", AI_TONE.text)}>“{t.quote}”</p>}
                </li>
              ))}
            </ul>
            <AiDraftBanner>AI summary of free-text answers — review before sharing. Names are never shown alongside themes.</AiDraftBanner>
          </div>
        </Section>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : (
        <DataTable
          columns={columns}
          data={rows.filter((r) => status === "all" || r.status === status)}
          searchKeys={["name", "primaryReason"]}
          searchPlaceholder="Search interviews…"
          getRowId={(r) => r.id}
          onRowClick={(r) => r.status === "completed" && setViewing(r)}
          exportName="exit-interviews"
          emptyIcon={MessagesSquare}
          emptyTitle="No interviews in this status"
          emptyDescription="Clear the filter to see every interview."
          filters={<FilterSelect label="Status" value={status} onValueChange={setStatus} options={[{ value: "scheduled", label: "Scheduled" }, { value: "completed", label: "Completed" }]} />}
        />
      )}

      <ExitInterviewSheet item={viewing} onOpenChange={(v) => !v && setViewing(null)} />
      {recording && (
        <RecordInterviewDialog
          item={recording}
          onClose={() => setRecording(null)}
          onSave={(v) => {
            const tagged = tagThemes(v.keepUs);
            setRows((xs) => xs.map((x) => (x.id === recording.id ? { ...x, ...v, status: "completed", scheduledOn: DEMO_TODAY, themes: tagged } : x)));
            mockAction("Exit interview recorded", { description: `${recording.name} — tagged ${tagged.length ? tagged.join(", ") : "no theme"}. Themes updated.` });
          }}
        />
      )}
    </PageBody>
  );
}
