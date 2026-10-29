"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  Check,
  Clock,
  GraduationCap,
  Search,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";
import { fmtDate, hm, num, pct } from "@/lib/format";
import {
  COMPLIANCE_RECORDS,
  COMPLIANCE_SUMMARY,
  COMPLIANCE_TOTALS,
  COURSES,
  COURSE_CATEGORIES,
  COURSE_FORMATS,
  ENROLMENTS,
  courseById,
  expiryBand,
  trainingById,
  type Course,
  type Enrolment,
} from "@/mock/growth";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Alert,
  Badge,
  EmptyState,
  Input,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/primitives";
import { FilterSelect } from "@/components/ui/overlays";
import { DataTable } from "@/components/data-table";
import { ViewToggle, type ListView } from "@/components/people/view-toggle";
import {
  catalogueColumns,
  complianceColumns,
  myLearningColumns,
  type ComplianceRow,
} from "@/components/growth/learning-columns";
import { BarCompareChart, DonutChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { PageBody, PageHeader, Section, useFakeLoad } from "@/components/shell/page";

export default function LearningPage() {
  const loading = useFakeLoad();
  const router = useRouter();
  const { persona } = useApp();
  const [view, setView] = React.useState<ListView>("cards");

  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [format, setFormat] = React.useState("all");
  const [level, setLevel] = React.useState("all");
  const [complianceBand, setComplianceBand] = React.useState("all");

  /* Enrolments are local so "Enrol" genuinely moves a course into My learning. */
  const [enrolments, setEnrolments] = React.useState<Enrolment[]>(ENROLMENTS);

  const mine = React.useMemo(
    () => enrolments.filter((e) => e.employeeCode === persona.employeeId),
    [enrolments, persona.employeeId],
  );
  const myCourseIds = React.useMemo(() => new Set(mine.map((e) => e.courseId)), [mine]);

  const visibleCourses = React.useMemo(
    () =>
      COURSES.filter(
        (c) =>
          (category === "all" || c.category === category) &&
          (format === "all" || c.format === format) &&
          (level === "all" || c.level === level) &&
          (!query.trim() ||
            c.title.toLowerCase().includes(query.toLowerCase()) ||
            c.provider.toLowerCase().includes(query.toLowerCase()) ||
            c.summary.toLowerCase().includes(query.toLowerCase())),
      ),
    [category, format, level, query],
  );

  const myCompliance = React.useMemo(
    () =>
      COMPLIANCE_RECORDS.filter((r) => r.employeeCode === persona.employeeId).map((r) => ({
        record: r,
        band: expiryBand(r),
        training: trainingById(r.trainingId),
      })),
    [persona.employeeId],
  );

  const visibleCompliance = React.useMemo(
    () =>
      complianceBand === "all"
        ? myCompliance
        : myCompliance.filter((c) => c.band === complianceBand),
    [myCompliance, complianceBand],
  );

  const enrol = (course: Course) => {
    if (myCourseIds.has(course.id)) return;
    const record: Enrolment = {
      id: `ENR-${persona.employeeId}-${course.id}`,
      employeeCode: persona.employeeId,
      courseId: course.id,
      status: "scheduled",
      progress: 0,
      enrolledOn: "2026-09-16",
      dueOn: "2026-12-16",
      lastActivityOn: null,
      completedOn: null,
      minutesDone: 0,
    };
    setEnrolments((es) => [record, ...es]);
    mockAction(`Enrolled — ${course.title}`, {
      description: `${course.provider} · ${hm(course.durationMins)} · due 16 Dec 2026. It is now in My learning.`,
    });
  };

  const advance = (enrolmentId: string) => {
    setEnrolments((es) =>
      es.map((e) => {
        if (e.id !== enrolmentId) return e;
        const course = courseById(e.courseId);
        const next = Math.min(100, e.progress + 25);
        return {
          ...e,
          progress: next,
          status: next >= 100 ? "completed" : "on_track",
          completedOn: next >= 100 ? "2026-09-16" : null,
          lastActivityOn: "2026-09-16",
          minutesDone: Math.round(((course?.durationMins ?? 60) * next) / 100),
        };
      }),
    );
    const e = enrolments.find((x) => x.id === enrolmentId);
    const course = e ? courseById(e.courseId) : null;
    mockAction("Progress saved", {
      description: course ? `${course.title} — resumed where you left off.` : undefined,
    });
  };

  const enrolMany = (courses: Course[]) => {
    const fresh = courses.filter((c) => !myCourseIds.has(c.id));
    setEnrolments((es) => [
      ...fresh.map<Enrolment>((c) => ({
        id: `ENR-${persona.employeeId}-${c.id}`,
        employeeCode: persona.employeeId,
        courseId: c.id,
        status: "scheduled",
        progress: 0,
        enrolledOn: "2026-09-16",
        dueOn: "2026-12-16",
        lastActivityOn: null,
        completedOn: null,
        minutesDone: 0,
      })),
      ...es,
    ]);
    mockAction(`Enrolled in ${fresh.length} course${fresh.length === 1 ? "" : "s"}`, {
      description: "Due 16 Dec 2026. They are now in My learning.",
    });
  };

  const complianceAction = ({ record, band, training }: ComplianceRow) =>
    mockAction(band === "valid" ? "Certificate downloaded" : `Started — ${training.shortName}`, {
      description:
        band === "valid"
          ? `${training.name} · valid until ${record.expiresOn ? fmtDate(record.expiresOn) : "—"}`
          : `${hm(training.durationMins)}. Your certificate renews for ${training.validityMonths} months on completion.`,
    });

  const myStats = {
    enrolled: mine.length,
    completed: mine.filter((e) => e.status === "completed").length,
    minutes: mine.reduce((a, b) => a + b.minutesDone, 0),
    atRisk: mine.filter((e) => e.status === "at_risk").length,
  };

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Learning" description="Loading the catalogue…" />
        <Skeleton className="h-[460px]" />
      </PageBody>
    );
  }

  const expiredCount = myCompliance.filter((c) => c.band === "expired").length;
  const expiringCount = myCompliance.filter((c) => c.band === "expiring").length;

  const catalogueFilters = (
    <>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search courses…"
          aria-label="Search courses"
          className="h-7 w-[220px] pl-7 text-xs"
        />
      </div>
      <FilterSelect
        label="Category"
        value={category}
        onValueChange={setCategory}
        allLabel="All categories"
        width="w-[180px]"
        options={COURSE_CATEGORIES.map((c) => ({ value: c, label: c }))}
      />
      <FilterSelect
        label="Format"
        value={format}
        onValueChange={setFormat}
        allLabel="All formats"
        width="w-[170px]"
        options={COURSE_FORMATS.map((f) => ({ value: f, label: f }))}
      />
      <FilterSelect
        label="Level"
        value={level}
        onValueChange={setLevel}
        allLabel="All levels"
        width="w-[160px]"
        options={["Foundation", "Intermediate", "Advanced"].map((l) => ({ value: l, label: l }))}
      />
    </>
  );
  const clearCatalogueButton = (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        setQuery("");
        setCategory("all");
        setFormat("all");
        setLevel("all");
      }}
    >
      Clear filters
    </Button>
  );

  return (
    <PageBody>
      <PageHeader
        title="Learning"
        description="The course catalogue, your enrolments, and the compliance training every employee must keep current."
      />

      <StatRow cols={4}>
        <StatTile label="Courses available" value={num(COURSES.length)} icon={BookOpen} hint={`${COURSE_CATEGORIES.length} categories`} />
        <StatTile label="My enrolments" value={num(myStats.enrolled)} icon={GraduationCap} hint={`${myStats.completed} completed`} />
        <StatTile label="Learning time" value={hm(myStats.minutes)} icon={Clock} hint="Logged this financial year" />
        <StatTile
          label="Compliance gaps"
          value={num(expiredCount + expiringCount)}
          icon={ShieldCheck}
          tone={expiredCount > 0 ? "critical" : expiringCount > 0 ? "warning" : "good"}
          hint={`${expiredCount} expired · ${expiringCount} expiring within 30 days`}
        />
      </StatRow>

      {expiredCount > 0 && (
        <Alert
          tone="danger"
          icon={AlertTriangle}
          title={`${expiredCount} mandatory training${expiredCount === 1 ? " has" : "s have"} expired`}
        >
          {myCompliance
            .filter((c) => c.band === "expired")
            .map((c) => `${c.training.shortName} (expired ${c.record.expiresOn ? fmtDate(c.record.expiresOn) : "—"})`)
            .join(" · ")}
          . Expired certification is an audit finding, not a reminder.
        </Alert>
      )}

      <Tabs defaultValue="catalogue">
        <TabsList>
          <TabsTrigger value="catalogue">
            <BookOpen /> Catalogue
          </TabsTrigger>
          <TabsTrigger value="mine">
            <GraduationCap /> My learning
          </TabsTrigger>
          <TabsTrigger value="compliance">
            <ShieldCheck /> Compliance training
          </TabsTrigger>
        </TabsList>

        {/* --------------------------------------------------- catalogue */}
        <TabsContent value="catalogue" className="flex flex-col gap-3">
          {view === "table" ? (
            <DataTable<Course>
              columns={catalogueColumns(myCourseIds, enrol)}
              data={visibleCourses}
              getRowId={(c) => c.id}
              filters={catalogueFilters}
              toolbar={<ViewToggle view={view} onChange={setView} />}
              onRowClick={(c) => router.push(`/learning/courses/${c.id}`)}
              enableSelection
              exportName="course-catalogue"
              emptyIcon={Search}
              emptyTitle="No course matches those filters"
              emptyDescription="Try a broader category, or clear the search box."
              emptyAction={clearCatalogueButton}
              bulkActions={(rows, clear) => (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={rows.every((c) => myCourseIds.has(c.id))}
                  onClick={() => {
                    enrolMany(rows);
                    clear();
                  }}
                >
                  <GraduationCap /> Enrol
                </Button>
              )}
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                {catalogueFilters}
                <span className="tnum ml-auto text-xs text-muted-foreground">
                  {visibleCourses.length} of {COURSES.length} courses
                </span>
                <ViewToggle view={view} onChange={setView} />
              </div>

              {visibleCourses.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="No course matches those filters"
                  description="Try a broader category, or clear the search box."
                  action={clearCatalogueButton}
                />
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {visibleCourses.map((c) => {
                    const enrolled = myCourseIds.has(c.id);
                    return (
                      <Card key={c.id} className="flex flex-col p-3.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold leading-tight tracking-tight">
                              <Link
                                href={`/learning/courses/${c.id}`}
                                className="hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                {c.title}
                              </Link>
                            </h3>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">{c.provider}</p>
                          </div>
                          <Badge variant="muted" className="shrink-0">
                            {c.level}
                          </Badge>
                        </div>

                        <p className="mt-1.5 min-h-[44px] text-[11px] leading-relaxed text-muted-foreground">
                          {c.summary}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline">{c.category}</Badge>
                          <Badge variant="outline">{c.format}</Badge>
                          <Badge variant="outline">
                            <Clock className="size-3" aria-hidden /> {hm(c.durationMins)}
                          </Badge>
                        </div>

                        <div className="mt-2.5 flex items-center gap-3 border-t border-border pt-2.5 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Star className="size-3 fill-[var(--warning)] text-[var(--warning)]" aria-hidden />
                            <span className="tnum font-medium text-foreground">{c.rating.toFixed(1)}</span>
                            <span className="tnum">({num(c.ratingCount)})</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="size-3" aria-hidden />
                            <span className="tnum">{num(c.enrolments)} enrolled</span>
                          </span>
                          <Button
                            size="sm"
                            variant={enrolled ? "outline" : "default"}
                            className="ml-auto"
                            disabled={enrolled}
                            onClick={() => enrol(c)}
                          >
                            {enrolled ? (
                              <>
                                <Check /> Enrolled
                              </>
                            ) : (
                              "Enrol"
                            )}
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ------------------------------------------------ my enrolments */}
        <TabsContent value="mine" className="flex flex-col gap-3">
          {mine.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="Nothing enrolled yet"
              description="Browse the catalogue and enrol in your first course — it will appear here with a progress bar."
            />
          ) : (
            <>
              <Section title="In progress and completed" bodyClassName="p-3">
                <DataTable<Enrolment>
                  columns={myLearningColumns(advance)}
                  data={mine}
                  getRowId={(e) => e.id}
                  toolbar={
                    <span className="tnum text-xs text-muted-foreground">
                      {myStats.completed} of {mine.length} completed
                    </span>
                  }
                  onRowClick={(e) => router.push(`/learning/courses/${e.courseId}`)}
                  exportName="my-learning"
                  pageSize={10}
                  emptyIcon={GraduationCap}
                  emptyTitle="Nothing matches this search"
                />
              </Section>

              <DonutChart
                title="My learning by category"
                description="Where the time has gone across everything you are enrolled in."
                data={Object.entries(
                  mine.reduce<Record<string, number>>((acc, e) => {
                    const c = courseById(e.courseId);
                    if (c) acc[c.category] = (acc[c.category] ?? 0) + e.minutesDone;
                    return acc;
                  }, {}),
                ).map(([name, value]) => ({ name, value }))}
                valueFormat={(v) => hm(v)}
                centreValue={hm(myStats.minutes)}
                centreLabel="logged"
                height={240}
              />
            </>
          )}
        </TabsContent>

        {/* ------------------------------------------------- compliance */}
        <TabsContent value="compliance" className="flex flex-col gap-3">
          <Section
            title="My mandatory training"
            description="Every one of these has an expiry. Colour is always paired with an icon and a label."
            bodyClassName="p-3"
          >
            <DataTable<ComplianceRow>
              columns={complianceColumns(complianceAction)}
              data={visibleCompliance}
              getRowId={(r) => r.training.id}
              filters={
                <FilterSelect
                  label="Status"
                  value={complianceBand}
                  onValueChange={setComplianceBand}
                  allLabel="All statuses"
                  width="w-[180px]"
                  options={[
                    { value: "expired", label: "Expired" },
                    { value: "expiring", label: "Expiring soon" },
                    { value: "pending", label: "Never completed" },
                    { value: "valid", label: "Valid" },
                  ]}
                />
              }
              rowTone={(r) => (r.band === "expired" ? "danger" : r.band === "expiring" ? "warning" : undefined)}
              exportName="my-mandatory-training"
              emptyIcon={ShieldCheck}
              emptyTitle="Nothing in this status"
              emptyDescription="Change the filter to see your other training records."
            />
          </Section>

          <BarCompareChart
            title="Organisation-wide completion"
            description="Every mandatory training, split by the state of its certificate."
            data={COMPLIANCE_SUMMARY.map((s) => ({
              name: s.shortName,
              valid: s.completed - s.expiring,
              expiring: s.expiring,
              expired: s.expired,
              pending: s.pending,
            }))}
            xKey="name"
            series={[
              { key: "valid", label: "Valid" },
              { key: "expiring", label: "Expiring" },
              { key: "expired", label: "Expired" },
              { key: "pending", label: "Never completed" },
            ]}
            stacked
            horizontal
            height={260}
            footnote={`Tenant-wide completion ${pct(COMPLIANCE_TOTALS.completionRate)} across ${num(COMPLIANCE_TOTALS.records)} records · ${num(COMPLIANCE_TOTALS.expired)} expired.`}
          />
        </TabsContent>
      </Tabs>
    </PageBody>
  );
}
