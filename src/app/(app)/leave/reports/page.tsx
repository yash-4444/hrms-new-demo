"use client";

import * as React from "react";
import { BarChart3, CalendarX2, CircleSlash, Download, Landmark, Users } from "lucide-react";
import { BRANCHES, DEPARTMENTS } from "@/mock/org";
import {
  LEAVE_REPORT_ABSENCE,
  LEAVE_REPORT_LIABILITY,
  LEAVE_REPORT_LOP,
  type TimeReportPerson,
} from "@/mock/finance-time";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { FilterSelect } from "@/components/ui/overlays";
import { Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { downloadFile, useTeamScope } from "@/components/finance/kit";
import { AbsenceTab, TrendTab } from "./absence-tab";
import { LiabilityTab } from "./liability-tab";
import { LopTab } from "./lop-tab";

/* ============================================================================
   /leave/reports — absence, encashment liability, leave trend and the LOP
   report that feeds the September pay run.
   ========================================================================== */

const TABS = [
  { value: "absence", label: "Absence", icon: CalendarX2 },
  { value: "liability", label: "Leave liability", icon: Landmark },
  { value: "trend", label: "Leave trend", icon: BarChart3 },
  { value: "lop", label: "LOP · Sep 2026", icon: CircleSlash },
] as const;

export default function LeaveReportsPage() {
  const loading = useFakeLoad();
  const scope = useTeamScope();
  const [tab, setTab] = React.useState<string>("absence");
  const [branch, setBranch] = React.useState("all");
  const [dept, setDept] = React.useState("all");

  const keep = React.useCallback(
    <T extends TimeReportPerson>(rows: T[]) =>
      rows.filter(
        (r) =>
          (branch === "all" || r.branchId === branch) &&
          (dept === "all" || r.departmentId === dept) &&
          (!scope.codes || scope.codes.has(r.code)),
      ),
    [branch, dept, scope.codes],
  );

  const absence = React.useMemo(() => keep(LEAVE_REPORT_ABSENCE), [keep]);
  const liability = React.useMemo(() => keep(LEAVE_REPORT_LIABILITY), [keep]);
  const lop = React.useMemo(() => keep(LEAVE_REPORT_LOP), [keep]);

  /* The trend chart filters by employee code, so fold branch and department into the code set. */
  const trendCodes = React.useMemo(() => {
    if (branch === "all" && dept === "all") return scope.codes;
    return new Set(keep(LEAVE_REPORT_ABSENCE).map((r) => r.code));
  }, [branch, dept, keep, scope.codes]);

  const exportName = (report: string) =>
    [
      `leave-${report}`,
      "fy2026-27",
      branch === "all" ? "all-branches" : branch.toLowerCase(),
      dept === "all" ? "all-depts" : dept.toLowerCase(),
      scope.codes ? "my-team" : null,
    ]
      .filter(Boolean)
      .join("_");

  const tabLabel = TABS.find((t) => t.value === tab)?.label ?? tab;

  return (
    <PageBody>
      <PageHeader
        title="Leave reports"
        description="Who is away and how often, what the encashable balance costs the company, and the loss-of-pay that flows into payroll."
        actions={
          <Gated menuKey="leave.reports" action="X">
            <Button size="sm" variant="outline" onClick={() => downloadFile(`${exportName(tab)}.xlsx`, `${tabLabel} · ${scope.label}`)}>
              <Download /> Export {tabLabel.toLowerCase()}
            </Button>
          </Gated>
        }
      />

      <Card className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <FilterSelect
          label="Branch"
          value={branch}
          onValueChange={setBranch}
          allLabel="All branches"
          width="w-[200px]"
          options={BRANCHES.map((b) => ({ value: b.id, label: b.name }))}
        />
        <FilterSelect
          label="Department"
          value={dept}
          onValueChange={setDept}
          allLabel="All departments"
          width="w-[210px]"
          options={DEPARTMENTS.map((d) => ({ value: d.id, label: d.name }))}
        />
        {(branch !== "all" || dept !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setBranch("all");
              setDept("all");
            }}
          >
            Clear
          </Button>
        )}
        <Badge variant={scope.codes ? "soft" : "muted"} className="ml-auto gap-1">
          <Users className="size-3" aria-hidden />
          Scope: {scope.label}
        </Badge>
      </Card>

      {loading ? (
        <TableSkeleton rows={10} />
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                <t.icon aria-hidden /> {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="absence" className="mt-3">
            <AbsenceTab rows={absence} exportName={exportName("absence")} />
          </TabsContent>
          <TabsContent value="liability" className="mt-3">
            <LiabilityTab rows={liability} exportName={exportName("liability")} />
          </TabsContent>
          <TabsContent value="trend" className="mt-3">
            <TrendTab codes={trendCodes} />
          </TabsContent>
          <TabsContent value="lop" className="mt-3">
            <LopTab rows={lop} exportName={exportName("lop-2026-09")} />
          </TabsContent>
        </Tabs>
      )}
    </PageBody>
  );
}
