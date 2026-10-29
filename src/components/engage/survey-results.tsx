"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { MessageSquareQuote, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { num, pct } from "@/lib/format";
import { ENPS_SPLIT, ENPS_TREND, SURVEY_THEMES, driverHeatmap, enpsScore, participationByDept, type Survey } from "@/mock/engage";
import { AI_TONE, AiBadge, AiConfidence, AiExplainButton } from "@/components/ai";
import { DataTable, NumCell } from "@/components/data-table";
import { HeatmapChart, ShareBar, TrendLineChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { Section } from "@/components/shell/page";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { MiniBar } from "./kit";

type Part = ReturnType<typeof participationByDept>[number];

const partCols: ColumnDef<Part, unknown>[] = [
  { accessorKey: "department", header: "Department" },
  { accessorKey: "invited", header: "Invited", cell: ({ row }) => <NumCell>{num(row.original.invited)}</NumCell> },
  { accessorKey: "responded", header: "Responded", cell: ({ row }) => <NumCell>{num(row.original.responded)}</NumCell> },
  {
    accessorKey: "rate",
    header: "Rate",
    cell: ({ row }) => <MiniBar value={row.original.rate} tone={row.original.rate >= 75 ? "success" : row.original.rate >= 50 ? "accent" : "warning"} label={`${row.original.rate}%`} />,
  },
];

export function SurveyResults({ survey }: { survey: Survey }) {
  const split = ENPS_SPLIT[survey.id];
  if (!survey.responded || !split)
    return <EmptyState icon={Users} title="No responses yet" description="Results appear once at least five people have responded." />;

  const score = enpsScore(split);
  const total = split.promoters + split.passives + split.detractors;
  const part = participationByDept(survey);
  const heat = driverHeatmap(survey);
  const showThemes = survey.kind === "Engagement" || survey.kind === "eNPS pulse";

  return (
    <div className="flex flex-col gap-4">
      <StatRow cols={4}>
        <StatTile label="Participation" value={pct((survey.responded / Math.max(1, survey.invited)) * 100, 0)} icon={Users} hint={`${num(survey.responded)} of ${num(survey.invited)} invited`} tone="good" />
        <StatTile label="eNPS" value={score > 0 ? `+${score}` : String(score)} hint="% promoters − % detractors, range −100 to +100" tone={score >= 20 ? "good" : score >= 0 ? "warning" : "critical"} />
        <StatTile label="Promoters (9–10)" value={num(split.promoters)} hint={pct((split.promoters / total) * 100, 0)} />
        <StatTile label="Detractors (0–6)" value={num(split.detractors)} hint={pct((split.detractors / total) * 100, 0)} />
      </StatRow>

      <Section title="eNPS breakdown" description={`${num(total)} answers to the recommend question`}>
        <ShareBar
          segments={[
            { key: "promoters", label: "Promoters", value: split.promoters, status: "good" },
            { key: "passives", label: "Passives (7–8)", value: split.passives, status: "warning" },
            { key: "detractors", label: "Detractors", value: split.detractors, status: "critical" },
          ]}
          height={12}
        />
      </Section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <TrendLineChart
          title="eNPS trend"
          description="Quarterly pulse; latest quarter includes this survey."
          data={ENPS_TREND}
          xKey="quarter"
          series={[{ key: "enps", label: "eNPS" }]}
          referenceLine={{ value: 20, label: "Target +20" }}
        />
        {heat.columns.length > 0 ? (
          <HeatmapChart
            title="Driver favourability by department"
            description="% who agree or strongly agree"
            rows={heat.rows}
            columns={heat.columns}
            values={heat.values}
            valueFormat={(v) => `${v}%`}
            scaleLabel="% favourable"
          />
        ) : (
          <Section title="Driver favourability by department">
            <p className="text-xs text-muted-foreground">This pulse asks only the recommend question, so there are no drivers to break down.</p>
          </Section>
        )}
      </div>

      <Section title="Participation by department" description="Departments under 5 responses are suppressed in anonymous reports.">
        <DataTable columns={partCols} data={part} getRowId={(p) => p.department} exportName={`${survey.id}-participation`} emptyIcon={Users} emptyTitle="No departments invited" />
      </Section>

      {showThemes && <AiThemes />}
    </div>
  );
}

function AiThemes() {
  const [open, setOpen] = React.useState<string | null>(SURVEY_THEMES[0]?.theme ?? null);
  const totalMentions = SURVEY_THEMES.reduce((a, t) => a + t.mentions, 0);
  return (
    <section className={cn("rounded-md border p-4", AI_TONE.soft)} aria-labelledby="ai-themes">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AiBadge />
          <h2 id="ai-themes" className="text-sm font-semibold">
            AI sentiment & themes from open-text answers
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <AiConfidence value={81} />
          <AiExplainButton
            title="How themes were found"
            summary={`${num(totalMentions)} theme mentions clustered from open-text comments. Comments are de-identified before analysis.`}
            drivers={SURVEY_THEMES.map((t) => ({ label: t.theme, detail: `${t.mentions} mentions · sentiment ${t.sentiment > 0 ? "+" : ""}${t.sentiment.toFixed(2)}`, weight: t.mentions }))}
          />
        </div>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">AI suggestion — review before use. Quotes are verbatim; names and team identifiers are removed.</p>

      <ul className="mt-3 flex flex-col gap-2">
        {SURVEY_THEMES.map((t) => {
          const positive = t.sentiment >= 0;
          const expanded = open === t.theme;
          return (
            <li key={t.theme} className="rounded-md border border-border bg-card">
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : t.theme)}
                className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left"
              >
                <span className="text-sm font-medium">{t.theme}</span>
                <Badge variant="outline" className={positive ? "text-success-fg" : "text-destructive-fg"}>
                  {positive ? "Positive" : "Negative"} {t.sentiment > 0 ? "+" : ""}
                  {t.sentiment.toFixed(2)}
                </Badge>
                <span className="tnum ml-auto text-xs text-muted-foreground">{num(t.mentions)} mentions</span>
              </button>
              {expanded && (
                <div className="flex flex-col gap-1.5 border-t border-border px-3 py-2">
                  {[t.quote, ...t.comments].map((c) => (
                    <p key={c} className="flex gap-1.5 text-xs text-foreground/90">
                      <MessageSquareQuote className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />“{c}”
                    </p>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
