"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, Award, BookOpen, CalendarDays, Clock, GraduationCap, Lock, MapPin, Star, Users, Video } from "lucide-react";
import { fmtDate, fmtDay, hm, num } from "@/lib/format";
import { employeeName } from "@/mock/employees";
import { courseById, type Enrolment } from "@/mock/growth";
import {
  CERTIFICATE_COURSES,
  PREREQUISITES,
  TRAINING_SESSIONS,
  courseModules,
  courseReviews,
  enrolledIn,
} from "@/mock/engage";
import { DEMO_TODAY } from "@/mock/org";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable } from "@/components/data-table";
import { PersonCell } from "@/components/people/person-cell";
import { Stars, personLine } from "@/components/engage/kit";
import { Gated, PageBody, PageHeader, Section, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, Progress, Skeleton } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";

export default function CourseDetailView() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  const course = courseById(id);
  const loading = useFakeLoad();
  const { persona } = useApp();
  const enrolled = React.useMemo(() => (course ? enrolledIn(course.id) : []), [course]);
  const [joined, setJoined] = React.useState(false);
  const alreadyIn = joined || enrolled.some((e) => e.employeeCode === persona.employeeId);

  const columns = React.useMemo<ColumnDef<Enrolment, unknown>[]>(
    () => [
      {
        id: "name",
        accessorFn: (r) => employeeName(r.employeeCode),
        header: "Learner",
        cell: ({ row }) => (
          <PersonCell name={employeeName(row.original.employeeCode)} code={row.original.employeeCode} subtitle={personLine(row.original.employeeCode)} />
        ),
      },
      { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        accessorKey: "progress",
        header: "Progress",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Progress value={row.original.progress} className="w-20" aria-label={`${row.original.progress}% complete`} />
            <span className="tnum text-xs text-muted-foreground">{row.original.progress}%</span>
          </div>
        ),
      },
      { accessorKey: "enrolledOn", header: "Enrolled", cell: ({ row }) => <span className="text-xs">{fmtDate(row.original.enrolledOn)}</span> },
      { accessorKey: "dueOn", header: "Due", cell: ({ row }) => <span className="text-xs">{fmtDate(row.original.dueOn)}</span> },
    ],
    [],
  );

  if (!course) {
    return (
      <PageBody>
        <EmptyState
          icon={BookOpen}
          title="Course not found"
          description={`There is no course with the id “${id}” in the catalogue.`}
          action={
            <Button size="sm" variant="outline" asChild>
              <Link href="/learning">Back to the catalogue</Link>
            </Button>
          }
        />
      </PageBody>
    );
  }

  if (loading) {
    return (
      <PageBody>
        <PageHeader title={course.title} description="Loading course…" />
        <Skeleton className="h-[420px]" />
      </PageBody>
    );
  }

  const modules = courseModules(course);
  const prereqs = (PREREQUISITES[course.id] ?? []).map((pid) => courseById(pid)).filter((c) => c !== null);
  const sessions = TRAINING_SESSIONS.filter((s) => s.courseId === course.id);
  const upcoming = sessions.filter((s) => s.date >= DEMO_TODAY);
  const reviews = courseReviews(course);
  const certificate = CERTIFICATE_COURSES.has(course.id);
  const completed = enrolled.filter((e) => e.status === "completed").length;

  const enrol = () => {
    setJoined(true);
    mockAction(`Enrolled — ${course.title}`, {
      description: upcoming[0]
        ? `Seat requested on ${fmtDay(upcoming[0].date)}. Your manager gets an approval request.`
        : "It is now in My learning, due in 90 days.",
    });
  };

  return (
    <PageBody>
      <Button variant="ghost" size="sm" className="w-fit" asChild>
        <Link href="/learning">
          <ArrowLeft /> Learning catalogue
        </Link>
      </Button>
      <PageHeader
        title={course.title}
        description={`${course.provider} · ${course.category} · ${course.format} · ${course.level}`}
        actions={
          <Gated menuKey="growth.learning" action="C">
            <Button size="sm" onClick={enrol} disabled={alreadyIn}>
              <GraduationCap /> {alreadyIn ? "Enrolled" : "Enrol"}
            </Button>
          </Gated>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Section title="Overview">
            <p className="text-sm text-foreground/90">{course.summary}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge variant="outline"><Clock className="size-3" aria-hidden /> {hm(course.durationMins)}</Badge>
              <Badge variant="outline"><Users className="size-3" aria-hidden /> {num(course.enrolments)} enrolled company-wide</Badge>
              <Badge variant="outline"><Star className="size-3" aria-hidden /> {course.rating.toFixed(1)} from {num(course.ratingCount)} ratings</Badge>
            </div>
          </Section>

          <Section title="Modules" description={`${modules.length} modules · ${hm(course.durationMins)} in total`}>
            <ol className="flex flex-col divide-y divide-border">
              {modules.map((m, i) => (
                <li key={m.title} className="flex items-center gap-3 py-2 text-sm">
                  <span className="tnum flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">{i + 1}</span>
                  <span className="min-w-0 flex-1">{m.title}</span>
                  <Badge variant="muted">{m.kind}</Badge>
                  <span className="tnum w-16 text-right text-xs text-muted-foreground">{hm(m.mins)}</span>
                </li>
              ))}
            </ol>
          </Section>

          <Section title="Enrolled learners" description={`${enrolled.length} tracked enrolments · ${completed} completed`}>
            <DataTable
              columns={columns}
              data={enrolled}
              getRowId={(r) => r.id}
              exportName={`${course.id}-enrolments`}
              emptyIcon={Users}
              emptyTitle="No tracked enrolments yet"
              emptyDescription="Learners appear here as soon as they enrol or are nominated."
              dense
            />
          </Section>

          <Section title="Ratings" description={`${course.rating.toFixed(1)} average from ${num(course.ratingCount)} learners`}>
            <ul className="flex flex-col gap-3">
              {reviews.map((r, i) => (
                <li key={i} className="flex flex-col gap-1 border-b border-border pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <PersonCell name={employeeName(r.code)} subtitle={fmtDate(r.date)} size={22} />
                    <Stars value={r.stars} />
                  </div>
                  <p className="text-xs text-foreground/90">{r.text}</p>
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <div className="flex flex-col gap-4">
          <Section title="Prerequisites">
            {prereqs.length === 0 ? (
              <p className="text-xs text-muted-foreground">None — open to everyone.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {prereqs.map((p) => (
                  <li key={p.id} className="flex items-start gap-2 text-xs">
                    <Lock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <Link href={`/learning/courses/${p.id}`} className="font-medium text-primary hover:underline">
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Sessions" description={course.format === "Self-paced" ? "Self-paced — start any time" : `${upcoming.length} upcoming`}>
            {sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No instructor-led sessions are scheduled for this course.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {sessions.map((s) => (
                  <li key={s.id} className="rounded-md border border-border p-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-medium">
                        <CalendarDays className="size-3.5" aria-hidden /> {fmtDay(s.date)} · {s.start}–{s.end}
                      </span>
                      <StatusBadge status={s.date < DEMO_TODAY ? "completed" : "scheduled"} />
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                      {s.mode === "Virtual" ? <Video className="size-3.5" aria-hidden /> : <MapPin className="size-3.5" aria-hidden />}
                      {s.venue}
                    </p>
                    <p className="tnum mt-1 text-muted-foreground">
                      {s.trainer} · {s.attendees.length}/{s.capacity} seats{s.waitlist.length ? ` · ${s.waitlist.length} waitlisted` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <Button size="sm" variant="link" className="mt-2 h-auto px-0" asChild>
              <Link href="/learning/sessions">Open the session calendar</Link>
            </Button>
          </Section>

          <Section title="Certificate">
            {certificate ? (
              <div className="flex items-start gap-2.5 text-xs">
                <Award className="mt-0.5 size-5 shrink-0 text-success-fg" aria-hidden />
                <p>
                  A verifiable certificate is issued on completion
                  {modules.some((m) => m.kind === "Assessment") ? " and a pass mark of 70% in the final assessment" : ""}.
                  It appears in{" "}
                  <Link href="/learning/certifications" className="text-primary hover:underline">Certifications</Link>.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Completion is recorded in your learning history; no certificate is issued.</p>
            )}
          </Section>
        </div>
      </div>
    </PageBody>
  );
}
