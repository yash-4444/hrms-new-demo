"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BarChart3, ClipboardCheck, SearchX, ShieldAlert } from "lucide-react";
import { fmtDate, num } from "@/lib/format";
import { surveyById } from "@/mock/engage";
import { useApp } from "@/components/app-state";
import { PageBody, PageHeader, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { SurveyTake } from "@/components/engage/survey-take";
import { SurveyResults } from "@/components/engage/survey-results";

export default function SurveyDetailView() {
  const loading = useFakeLoad();
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  const survey = surveyById(id);
  const { can, persona } = useApp();
  const isHr = can("engage.surveys", "E");

  const back = (
    <Button variant="outline" size="sm" asChild>
      <Link href="/surveys">
        <ArrowLeft /> All surveys
      </Link>
    </Button>
  );

  if (loading)
    return (
      <PageBody>
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-[420px]" />
      </PageBody>
    );

  if (!survey)
    return (
      <PageBody>
        <EmptyState icon={SearchX} title="Survey not found" description={`There is no survey with the id ${id || "—"}. It may have been deleted.`} action={back} />
      </PageBody>
    );

  return (
    <PageBody>
      <PageHeader
        title={survey.title}
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{survey.kind}</Badge>
            <StatusBadge status={survey.status === "active" ? "open" : survey.status} label={survey.status === "active" ? "Open" : undefined} />
            <span>
              {fmtDate(survey.opensOn)} – {fmtDate(survey.closesOn)} · {survey.audience} · {num(survey.responded)} responses
            </span>
          </span>
        }
        actions={back}
      />

      <Tabs defaultValue={isHr ? "results" : "take"}>
        <TabsList>
          <TabsTrigger value="take">
            <ClipboardCheck /> Take survey
          </TabsTrigger>
          <TabsTrigger value="results">
            <BarChart3 /> Results
          </TabsTrigger>
        </TabsList>
        <TabsContent value="take">
          <SurveyTake survey={survey} />
        </TabsContent>
        <TabsContent value="results">
          {isHr ? (
            <SurveyResults survey={survey} />
          ) : (
            <EmptyState
              icon={ShieldAlert}
              title="Results are visible to HR"
              description={`${persona.role} does not have the Edit grant on Surveys & Pulse. HR shares a company-wide summary once the survey closes.`}
            />
          )}
        </TabsContent>
      </Tabs>
    </PageBody>
  );
}
