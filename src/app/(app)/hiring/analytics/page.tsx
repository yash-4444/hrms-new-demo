"use client";

import Link from "next/link";
import { Briefcase, Handshake, Timer, Users } from "lucide-react";

import { num } from "@/lib/format";
import { HIRING_KPIS } from "@/mock/hiring";
import {
  DIVERSITY_BY_STAGE,
  FUNNEL,
  OFFER_ACCEPTANCE,
  SOURCE_EFFECTIVENESS,
  TIME_TO_HIRE_BY_DEPT,
} from "@/mock/lifecycle";
import { useApp } from "@/components/app-state";
import { AiExplainButton } from "@/components/ai";
import { BarCompareChart, FunnelChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import {
  CardsSkeleton,
  ChartSkeleton,
  PageBody,
  PageHeader,
  Section,
  TableSkeleton,
  useFakeLoad,
} from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { RecruiterTable, SourceTable } from "./analytics-tables";

/* ============================================================================
   /hiring/analytics — read-only. Every number is derived from the same
   candidate, offer and interview fixtures the pipeline board renders, so the
   funnel here and the board's column counts always agree.
   ========================================================================== */

const days = (v: number) => `${num(v)} d`;

const HIRED_DEPTS = TIME_TO_HIRE_BY_DEPT.filter((d) => d.hires > 0);
const ACTIVE_AGE = [...TIME_TO_HIRE_BY_DEPT].sort(
  (a, b) => b.activeAge - a.activeAge,
);

/* Drivers for the time-to-fill explainer, computed rather than written. */
const SLOWEST = [...HIRED_DEPTS].sort((a, b) => b.reqToHire - a.reqToHire);
const BIGGEST_SOURCE = [...SOURCE_EFFECTIVENESS].sort(
  (a, b) => b.candidates - a.candidates,
)[0];
const FILL_DRIVERS = [
  ...SLOWEST.slice(0, 2).map((d) => ({
    label: d.dept,
    detail: `${d.reqToHire} days requisition → hire across ${d.hires} hire${d.hires === 1 ? "" : "s"}`,
    weight: d.reqToHire,
  })),
  {
    label: `${ACTIVE_AGE[0].dept} pipeline age`,
    detail: `Active candidates have waited ${ACTIVE_AGE[0].activeAge} days on average since applying`,
    weight: ACTIVE_AGE[0].activeAge,
  },
  {
    label: `${BIGGEST_SOURCE.source} volume`,
    detail: `Largest source (${BIGGEST_SOURCE.candidates} candidates) converts ${BIGGEST_SOURCE.hireRate}% to hire — screening load without matching yield`,
  },
];

export default function RecruitmentAnalyticsPage() {
  const loading = useFakeLoad();
  const { can } = useApp();
  const linkCandidates = can("hiring.candidates", "V");
  const linkRequisitions = can("hiring.requisitions", "V");
  const linkOffers = can("hiring.offers", "V");
  const linkEmployees = can("people.directory", "V");

  return (
    <PageBody>
      <PageHeader
        title="Recruitment Analytics"
        description="Funnel, speed, source quality, recruiter output and pipeline diversity — computed from the live pipeline, not a monthly extract."
        actions={
          linkCandidates ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/candidates">Candidate pipeline</Link>
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <CardsSkeleton count={4} />
      ) : (
        <StatRow cols={4}>
          <StatTile
            label="Offer acceptance"
            value={`${OFFER_ACCEPTANCE.rate}%`}
            icon={Handshake}
            tone={OFFER_ACCEPTANCE.rate >= 80 ? "good" : "warning"}
            hint={`${OFFER_ACCEPTANCE.accepted} accepted · ${OFFER_ACCEPTANCE.declined} declined · ${OFFER_ACCEPTANCE.open} open`}
            href={linkOffers ? "/offers" : undefined}
          />
          <StatTile
            label="Time to fill"
            value={`${HIRING_KPIS.timeToFillDays} days`}
            icon={Timer}
            tone="accent"
            hint="Requisition raised → candidate hired"
            footer={
              <AiExplainButton
                title="What is driving time to fill?"
                summary={`Average of ${HIRING_KPIS.timeToFillDays} days from requisition raised to hire. The largest contributors this cycle:`}
                drivers={FILL_DRIVERS}
              />
            }
          />
          <StatTile
            label="Active candidates"
            value={HIRING_KPIS.activeCandidates}
            icon={Users}
            hint={`${HIRING_KPIS.interviewsThisWeek} interviews scheduled this week`}
            href={linkCandidates ? "/candidates" : undefined}
          />
          <StatTile
            label="Open positions"
            value={HIRING_KPIS.openPositions}
            icon={Briefcase}
            hint={`Across ${HIRING_KPIS.openRequisitions} open requisitions · ${HIRING_KPIS.ageingOver45} older than 45 days`}
            href={linkRequisitions ? "/requisitions" : undefined}
          />
        </StatRow>
      )}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartSkeleton height={280} />
          <ChartSkeleton height={280} />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <FunnelChart
            title="Recruitment funnel"
            description="Candidates who reached each stage this cycle."
            stages={FUNNEL}
            footnote="Reconciles with the Candidates board: same candidates, same stage definitions. Rejected candidates count at the stage they dropped out."
          />
          <BarCompareChart
            title="Time to hire by department"
            description="Average days, departments with at least one hire this cycle."
            data={HIRED_DEPTS}
            xKey="dept"
            series={[
              { key: "applyToHire", label: "Application → hire" },
              { key: "reqToHire", label: "Requisition → hire" },
            ]}
            valueFormat={days}
            height={260}
          />
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartSkeleton height={260} />
          <ChartSkeleton height={260} />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <BarCompareChart
            title="Age of the active pipeline"
            description="Average days since applying, candidates still in play."
            data={ACTIVE_AGE}
            xKey="dept"
            series={[{ key: "activeAge", label: "Average age" }]}
            valueFormat={days}
            horizontal
            height={260}
          />
          <BarCompareChart
            title="Pipeline diversity by stage"
            description="Self-declared gender (voluntary EEO form)"
            data={DIVERSITY_BY_STAGE}
            xKey="stage"
            series={[
              { key: "women", label: "Women" },
              { key: "men", label: "Men" },
              { key: "undisclosed", label: "Not disclosed" },
            ]}
            stacked
            height={260}
            footnote="Declaration is optional and collected separately from the application. It is never shown to interviewers or used in any selection decision — reported in aggregate only."
          />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Section
          title="Source effectiveness"
          description="Which channels produce hires, not just applications. Best hire rate highlighted."
        >
          {loading ? <TableSkeleton rows={6} /> : <SourceTable />}
        </Section>
        {loading ? (
          <ChartSkeleton height={260} />
        ) : (
          <BarCompareChart
            title="Source volume vs. yield"
            description="Candidates, interviews and hires by source."
            data={SOURCE_EFFECTIVENESS}
            xKey="source"
            series={[
              { key: "candidates", label: "Candidates" },
              { key: "interviewed", label: "Interviewed" },
              { key: "hires", label: "Hired" },
            ]}
            height={260}
          />
        )}
      </div>

      <Section
        title="Recruiter leaderboard"
        description="Ranked by hires, then offers. Average days to hire runs application → hired."
      >
        {loading ? (
          <TableSkeleton rows={5} />
        ) : (
          <RecruiterTable linkEmployees={linkEmployees} />
        )}
      </Section>
    </PageBody>
  );
}
