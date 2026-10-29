"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { ClipboardList, Gauge, Plus, Users } from "lucide-react";
import { fmtDate, num } from "@/lib/format";
import { ENPS_SPLIT, SURVEYS, enpsScore, type Survey } from "@/mock/engage";
import { mockAction } from "@/components/app-state";
import { DataTable } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { FilterSelect } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { MiniBar } from "@/components/engage/kit";
import { CreateSurveyDialog, type SurveyDraft } from "@/components/engage/survey-create";

const STATUS_LABEL: Record<Survey["status"], { status: string; label: string }> = {
  active: { status: "open", label: "Open" },
  closed: { status: "closed", label: "Closed" },
  scheduled: { status: "scheduled", label: "Scheduled" },
  draft: { status: "draft", label: "Draft" },
};

export default function SurveysPage() {
  const loading = useFakeLoad();
  const router = useRouter();
  const [surveys, setSurveys] = React.useState<Survey[]>(SURVEYS);
  const [status, setStatus] = React.useState("all");
  const [createOpen, setCreateOpen] = React.useState(false);

  const data = surveys.filter((s) => status === "all" || s.status === status);
  const live = surveys.filter((s) => s.status === "active");
  const engagement = SURVEYS[0];
  const enps = enpsScore(ENPS_SPLIT[engagement.id]);

  const create = (v: SurveyDraft) => {
    const s: Survey = {
      id: `SRV-NEW-${surveys.length + 1}`,
      title: v.title,
      kind: v.kind,
      status: "scheduled",
      anonymous: v.anonymous,
      opensOn: v.opensOn,
      closesOn: v.closesOn,
      audience: v.audience,
      invited: 0,
      responded: 0,
      questions: [],
      respondedByMe: false,
    };
    setSurveys((ss) => [s, ...ss]);
    mockAction(`${v.title} scheduled`, { description: `Opens ${fmtDate(v.opensOn)} for ${v.audience}. Edit questions before it opens.` });
  };

  const columns: ColumnDef<Survey, unknown>[] = [
    {
      accessorKey: "title",
      header: "Survey",
      cell: ({ row }) => {
        const s = row.original;
        const linkable = SURVEYS.some((x) => x.id === s.id);
        return (
          <div className="flex flex-col">
            {linkable ? (
              <Link href={`/surveys/${s.id}`} className="font-medium text-foreground hover:underline" onClick={(e) => e.stopPropagation()}>
                {s.title}
              </Link>
            ) : (
              <span className="font-medium">{s.title}</span>
            )}
            <span className="text-[11px] text-muted-foreground">
              {s.audience}
              {s.anonymous ? " · anonymous" : ""}
            </span>
          </div>
        );
      },
    },
    { accessorKey: "kind", header: "Type", cell: ({ row }) => <Badge variant="outline">{row.original.kind}</Badge> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge {...STATUS_LABEL[row.original.status]} /> },
    {
      accessorKey: "opensOn",
      header: "Window",
      cell: ({ row }) => (
        <span className="text-xs">
          {fmtDate(row.original.opensOn)} – {fmtDate(row.original.closesOn)}
        </span>
      ),
    },
    {
      id: "participation",
      header: "Participation",
      accessorFn: (s) => (s.invited ? s.responded / s.invited : 0),
      cell: ({ row }) => {
        const s = row.original;
        const rate = s.invited ? Math.round((s.responded / s.invited) * 100) : 0;
        return s.invited ? (
          <MiniBar value={rate} tone={rate >= 75 ? "success" : rate >= 50 ? "accent" : "warning"} label={`${rate}% · ${num(s.responded)}/${num(s.invited)}`} />
        ) : (
          <span className="text-xs text-muted-foreground">Not open yet</span>
        );
      },
    },
  ];

  return (
    <PageBody>
      <PageHeader
        title="Surveys & Pulse"
        description="Engagement surveys, quarterly eNPS pulses and lifecycle check-ins. Anonymous surveys never show results for groups smaller than five."
        actions={
          <Gated menuKey="engage.surveys" action="C">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus /> New survey
            </Button>
          </Gated>
        }
      />

      {loading ? (
        <>
          <CardsSkeleton count={3} />
          <TableSkeleton rows={5} />
        </>
      ) : (
        <>
          <StatRow cols={3}>
            <StatTile label="Open now" value={num(live.length)} icon={ClipboardList} hint={live.map((s) => s.kind).join(" · ")} />
            <StatTile
              label="Engagement participation"
              value={`${Math.round((engagement.responded / engagement.invited) * 100)}%`}
              icon={Users}
              tone="good"
              hint={`${num(engagement.responded)} of ${num(engagement.invited)} · closes ${fmtDate(engagement.closesOn)}`}
            />
            <StatTile label="eNPS (September)" value={enps > 0 ? `+${enps}` : String(enps)} icon={Gauge} deltaValue={enps - enpsScore(ENPS_SPLIT["SRV-PULSE-Q3"])} deltaSuffix=" pts" deltaLabel="vs Q3 pulse" hint="Promoters minus detractors" />
          </StatRow>

          <DataTable
            columns={columns}
            data={data}
            searchKeys={["title", "audience"]}
            searchPlaceholder="Search surveys…"
            filters={
              <FilterSelect
                label="Status"
                value={status}
                onValueChange={setStatus}
                options={Object.entries(STATUS_LABEL).map(([value, v]) => ({ value, label: v.label }))}
              />
            }
            onRowClick={(s) => SURVEYS.some((x) => x.id === s.id) && router.push(`/surveys/${s.id}`)}
            getRowId={(s) => s.id}
            exportName="surveys"
            emptyIcon={ClipboardList}
            emptyTitle="No surveys with this status"
            emptyDescription="Change the status filter, or create a new survey."
          />
        </>
      )}

      <CreateSurveyDialog open={createOpen} onOpenChange={setCreateOpen} onCreate={create} />
    </PageBody>
  );
}
