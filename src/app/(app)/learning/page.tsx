"use client";

import * as React from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  Clock,
  GraduationCap,
  Play,
  Search,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, hm, num, pct } from "@/lib/format";
import { employeeName } from "@/mock/employees";
import {
  COMPLIANCE_RECORDS,
  COMPLIANCE_SUMMARY,
  COMPLIANCE_TOTALS,
  COMPLIANCE_TRAININGS,
  COURSES,
  COURSE_CATEGORIES,
  COURSE_FORMATS,
  ENROLMENTS,
  courseById,
  expiryBand,
  trainingById,
  type Course,
  type Enrolment,
  type ExpiryBand,
} from "@/mock/growth";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Alert,
  Badge,
  EmptyState,
  Hint,
  Input,
  Progress,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/primitives";
import { FilterSelect } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { BarCompareChart, DonutChart, ProgressRing } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { PageBody, PageHeader, Section, useFakeLoad } from "@/components/shell/page";

const BAND_META: Record<ExpiryBand, { label: string; status: string; tone: string }> = {
  expired: { label: "Expired", status: "expired", tone: "text-destructive-fg" },
  expiring: { label: "Expiring soon", status: "due_soon", tone: "text-warning-fg" },
  pending: { label: "Never completed", status: "not_started", tone: "text-muted-foreground" },
  valid: { label: "Valid", status: "completed", tone: "text-success-fg" },
};

export default function LearningPage() {
  const loading = useFakeLoad();
  const { persona } = useApp();

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
          <div className="flex flex-wrap items-center gap-1.5">
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
            <span className="tnum ml-auto text-xs text-muted-foreground">
              {visibleCourses.length} of {COURSES.length} courses
            </span>
          </div>

          {visibleCourses.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No course matches those filters"
              description="Try a broader category, or clear the search box."
              action={
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
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleCourses.map((c) => {
                const enrolled = myCourseIds.has(c.id);
                return (
                  <Card key={c.id} className="flex flex-col p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold leading-tight tracking-tight">{c.title}</h3>
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
              <Section title="In progress and completed" bodyClassName="p-0">
                <ul>
                  {mine.map((e) => {
                    const c = courseById(e.courseId);
                    if (!c) return null;
                    return (
                      <li
                        key={e.id}
                        className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-0"
                      >
                        <ProgressRing
                          value={e.progress}
                          size={42}
                          thickness={5}
                          tone={
                            e.status === "completed" ? "good" : e.status === "at_risk" ? "warning" : "accent"
                          }
                        />
                        <div className="min-w-[200px] flex-1">
                          <p className="text-xs font-medium">{c.title}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {c.provider} · {c.format} · {hm(e.minutesDone)} of {hm(c.durationMins)} done
                          </p>
                          <Progress
                            value={e.progress}
                            className="mt-1.5 max-w-[320px]"
                            tone={e.status === "completed" ? "success" : e.status === "at_risk" ? "warning" : "accent"}
                            aria-label={`${c.title} progress`}
                          />
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <StatusBadge status={e.status} />
                          <span className="tnum text-[10px] text-muted-foreground">
                            {e.completedOn ? `Completed ${fmtDate(e.completedOn)}` : `Due ${fmtDate(e.dueOn)}`}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant={e.status === "completed" ? "outline" : "default"}
                          disabled={e.status === "completed"}
                          onClick={() => advance(e.id)}
                        >
                          {e.status === "completed" ? (
                            <>
                              <Check /> Done
                            </>
                          ) : (
                            <>
                              <Play /> {e.progress === 0 ? "Start" : "Continue"}
                            </>
                          )}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
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
            actions={
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
            bodyClassName="p-0"
          >
            {visibleCompliance.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="Nothing in this status"
                description="Change the filter to see your other training records."
                className="border-0"
              />
            ) : (
              <ul>
                {visibleCompliance.map(({ record, band, training }) => {
                  const meta = BAND_META[band];
                  return (
                    <li
                      key={training.id}
                      className={cn(
                        "flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-0",
                        band === "expired" && "bg-destructive-soft/30",
                        band === "expiring" && "bg-warning-soft/30",
                      )}
                    >
                      <div
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-md",
                          band === "expired"
                            ? "bg-destructive-soft text-destructive-fg"
                            : band === "expiring"
                              ? "bg-warning-soft text-warning-fg"
                              : band === "pending"
                                ? "bg-muted text-muted-foreground"
                                : "bg-success-soft text-success-fg",
                        )}
                      >
                        {band === "valid" ? (
                          <Check className="size-3.5" aria-hidden />
                        ) : band === "pending" ? (
                          <Clock className="size-3.5" aria-hidden />
                        ) : (
                          <AlertTriangle className="size-3.5" aria-hidden />
                        )}
                      </div>

                      <div className="min-w-[220px] flex-1">
                        <p className="text-xs font-medium">{training.name}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {training.mandate} · valid {training.validityMonths} months · owner{" "}
                          {employeeName(training.ownerCode)}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className={cn("text-[11px] font-medium", meta.tone)}>{meta.label}</p>
                        <p className="tnum text-[10px] text-muted-foreground">
                          {record.expiresOn
                            ? `${record.daysToExpiry !== null && record.daysToExpiry < 0 ? "Expired" : "Expires"} ${fmtDate(record.expiresOn)}`
                            : "No record on file"}
                          {record.daysToExpiry !== null &&
                            record.daysToExpiry >= 0 &&
                            ` · ${record.daysToExpiry}d left`}
                        </p>
                      </div>

                      <StatusBadge status={meta.status} />

                      <Button
                        size="sm"
                        variant={band === "valid" ? "outline" : "default"}
                        onClick={() =>
                          mockAction(
                            band === "valid" ? "Certificate downloaded" : `Started — ${training.shortName}`,
                            {
                              description:
                                band === "valid"
                                  ? `${training.name} · valid until ${record.expiresOn ? fmtDate(record.expiresOn) : "—"}`
                                  : `${hm(training.durationMins)}. Your certificate renews for ${training.validityMonths} months on completion.`,
                            },
                          )
                        }
                      >
                        {band === "valid" ? "Certificate" : band === "pending" ? "Start" : "Renew now"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
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
