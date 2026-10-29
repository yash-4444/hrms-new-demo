"use client";

import type { ElementType } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  CalendarDays,
  Check,
  GraduationCap,
  HeartPulse,
  Laptop,
  MapPin,
  PiggyBank,
  Timer,
} from "lucide-react";
import { fmtDate } from "@/lib/format";
import { TENANT } from "@/mock/org";
import { deptLabel } from "@/mock/hiring";
import { PUBLIC_JOBS, jobBySlug, jobSlug } from "@/mock/lifecycle-public";
import { PublicShell } from "@/components/lifecycle/public-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, Separator } from "@/components/ui/primitives";
import { RoleNotFound } from "./role-not-found";

/* ============================================================================
   /careers/jobs/[slug] — one published role, in full. Public: no app shell.
   ========================================================================== */

const BENEFITS = [
  { icon: HeartPulse, text: "₹10 lakh family floater health cover from day one, parents included" },
  { icon: GraduationCap, text: "₹75,000 a year to spend on learning, no approval below ₹25,000" },
  { icon: CalendarDays, text: "30 days of leave plus public holidays, with carry-forward" },
  { icon: PiggyBank, text: "ESOP grant for every full-time employee, refreshed at promotion" },
];

export default function JobDetailView() {
  const { slug } = useParams<{ slug: string }>();
  const job = jobBySlug(slug);

  if (!job) {
    return (
      <PublicShell>
        <RoleNotFound />
      </PublicShell>
    );
  }

  const applyHref = `/careers/apply/${jobSlug(job)}`;
  const similar = PUBLIC_JOBS.filter((j) => j.departmentId === job.departmentId && j.id !== job.id);
  const facts = [
    { icon: Building2, label: "Team", value: deptLabel(job.departmentId) },
    { icon: MapPin, label: "Location", value: job.location },
    { icon: Laptop, label: "Work mode", value: job.workMode },
    { icon: Timer, label: "Experience", value: job.experience },
    { icon: Briefcase, label: "Employment", value: job.employmentType },
    { icon: CalendarDays, label: "Posted", value: fmtDate(job.postedDate) },
  ];

  return (
    <PublicShell>
      <Link
        href="/careers"
        className="mb-5 inline-flex items-center gap-1.5 rounded text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Back to all roles
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <article className="flex min-w-0 flex-col gap-6">
          <header className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="soft">{deptLabel(job.departmentId)}</Badge>
              <Badge variant="muted">{job.workMode}</Badge>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{job.title}</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{job.summary}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild>
                <Link href={applyHref}>
                  Apply now
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/careers/track">Already applied? Track it</Link>
              </Button>
            </div>
          </header>

          <Card className="p-4 lg:hidden">
            <FactList facts={facts} />
          </Card>

          <section aria-labelledby="resp-h" className="flex flex-col gap-2.5">
            <h2 id="resp-h" className="text-base font-semibold tracking-tight">
              What you will do
            </h2>
            <BulletList items={job.responsibilities} />
          </section>

          <section aria-labelledby="req-h" className="flex flex-col gap-2.5">
            <h2 id="req-h" className="text-base font-semibold tracking-tight">
              What we are looking for
            </h2>
            <BulletList items={job.requirements} />
          </section>

          <section aria-labelledby="ben-h" className="flex flex-col gap-2.5">
            <h2 id="ben-h" className="text-base font-semibold tracking-tight">
              What you get
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {BENEFITS.map((b) => (
                <li key={b.text} className="flex items-start gap-2.5 rounded-md border border-border bg-card p-3 text-xs text-foreground">
                  <b.icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  {b.text}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              The full benefits list is on the{" "}
              <Link href="/careers" className="text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                {TENANT.shortName} careers page
              </Link>
              .
            </p>
          </section>

          <Card className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-sm font-semibold">Sound like you?</h2>
              <p className="text-xs text-muted-foreground">
                The form takes about five minutes — upload your resume and our AI fills the rest for you to check.
              </p>
            </div>
            <Button asChild>
              <Link href={applyHref}>
                Apply now
                <ArrowRight />
              </Link>
            </Button>
          </Card>
        </article>

        <aside className="flex flex-col gap-4" aria-label="Role details and similar roles">
          <Card className="hidden p-4 lg:block">
            <FactList facts={facts} />
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold">Similar roles</h2>
            <Separator className="my-3" />
            {similar.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No other {deptLabel(job.departmentId)} roles are open right now.{" "}
                <Link href="/careers" className="text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                  Browse every team
                </Link>
                .
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {similar.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/careers/jobs/${jobSlug(s)}`}
                      className="flex flex-col rounded-md px-2 py-1.5 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="text-xs font-medium text-foreground">{s.title}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {s.location} · {s.workMode}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </PublicShell>
  );
}

function FactList({ facts }: { facts: { icon: ElementType; label: string; value: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-1">
      {facts.map((f) => (
        <div key={f.label} className="flex items-start gap-2">
          <f.icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{f.label}</dt>
            <dd className="tnum text-xs text-foreground">{f.value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((it) => (
        <li key={it} className="flex items-start gap-2 text-sm leading-relaxed text-foreground">
          <Check className="mt-1 size-3.5 shrink-0 text-success" aria-hidden />
          {it}
        </li>
      ))}
    </ul>
  );
}
