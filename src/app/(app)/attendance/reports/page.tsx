"use client";

import * as React from "react";
import { AlarmClock, CalendarDays, Download, LogOut, Timer, TrendingDown, Users } from "lucide-react";
import { DEPARTMENTS } from "@/mock/org";
import { MUSTER_DEFAULT_MONTH, MUSTER_MONTHS, TIME_REPORT_BRANCH_OPTIONS } from "@/mock/finance-time";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { FilterSelect, Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/overlays";
import { Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { downloadFile, useTeamScope } from "@/components/finance/kit";
import { exportNameFor, type ReportFilters } from "./report-filters";
import { MusterTab } from "./muster-tab";
import { OvertimeTab, PunctualityTab } from "./punctuality-tab";
import { TrendTab } from "./trend-tab";

/* ============================================================================
   /attendance/reports — muster roll, late-comers, early-goers, overtime cost
   and the absenteeism trend. One filter bar drives every tab; managers and
   department heads are scoped to their own people.
   ========================================================================== */

const TABS = [
  { value: "muster", label: "Muster roll", icon: CalendarDays },
  { value: "late", label: "Late-comers", icon: AlarmClock },
  { value: "early", label: "Early-goers", icon: LogOut },
  { value: "overtime", label: "Overtime", icon: Timer },
  { value: "trend", label: "Absenteeism trend", icon: TrendingDown },
] as const;

export default function AttendanceReportsPage() {
  const loading = useFakeLoad();
  const scope = useTeamScope();
  const [tab, setTab] = React.useState<string>("muster");
  const [branch, setBranch] = React.useState("all");
  const [dept, setDept] = React.useState("all");
  const [month, setMonth] = React.useState(MUSTER_DEFAULT_MONTH);

  const filters = React.useMemo<ReportFilters>(
    () => ({ branch, dept, month, codes: scope.codes }),
    [branch, dept, month, scope.codes],
  );
  const monthLabel = MUSTER_MONTHS.find((m) => m.value === month)?.label ?? month;
  const tabLabel = TABS.find((t) => t.value === tab)?.label ?? tab;

  return (
    <PageBody>
      <PageHeader
        title="Attendance reports"
        description="Statutory muster roll and the exception reports supervisors act on. Every tab honours the filters below, and exports keep them in the file name."
        actions={
          <Gated menuKey="time.reports" action="X">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                downloadFile(`${exportNameFor(tab === "trend" ? "absenteeism" : tab, filters)}.xlsx`, `${tabLabel} · ${monthLabel} · ${scope.label}`)
              }
            >
              <Download /> Export {tabLabel.toLowerCase()}
            </Button>
          </Gated>
        }
      />

      <Card className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger size="sm" aria-label="Month" className="w-[230px]">
            <span className="truncate">
              <span className="text-muted-foreground">Month: </span>
              {monthLabel}
            </span>
          </SelectTrigger>
          <SelectContent>
            {MUSTER_MONTHS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FilterSelect
          label="Branch"
          value={branch}
          onValueChange={setBranch}
          allLabel="All branches"
          width="w-[200px]"
          options={TIME_REPORT_BRANCH_OPTIONS}
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
          <TabsContent value="muster" className="mt-3">
            <MusterTab filters={filters} />
          </TabsContent>
          <TabsContent value="late" className="mt-3">
            <PunctualityTab filters={filters} mode="late" />
          </TabsContent>
          <TabsContent value="early" className="mt-3">
            <PunctualityTab filters={filters} mode="early" />
          </TabsContent>
          <TabsContent value="overtime" className="mt-3">
            <OvertimeTab filters={filters} />
          </TabsContent>
          <TabsContent value="trend" className="mt-3">
            <TrendTab filters={filters} />
          </TabsContent>
        </Tabs>
      )}
    </PageBody>
  );
}
