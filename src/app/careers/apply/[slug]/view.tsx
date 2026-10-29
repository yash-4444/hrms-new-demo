"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { deptLabel } from "@/mock/hiring";
import { jobBySlug, jobSlug, trackingToken } from "@/mock/lifecycle-public";
import { PublicShell } from "@/components/lifecycle/public-shell";
import { mockAction } from "@/components/app-state";
import { RoleNotFound } from "@/app/careers/jobs/[slug]/role-not-found";
import { ApplyForm } from "./apply-form";
import { Submitted } from "./submitted";

/* ============================================================================
   /careers/apply/[slug] — full-page application for one published role.
   ========================================================================== */

export default function ApplyView() {
  const { slug } = useParams<{ slug: string }>();
  const job = jobBySlug(slug);
  const [submitted, setSubmitted] = React.useState<{ name: string; email: string; token: string } | null>(null);

  if (!job) {
    return (
      <PublicShell width="max-w-3xl">
        <RoleNotFound />
      </PublicShell>
    );
  }

  return (
    <PublicShell width="max-w-3xl">
      {submitted ? (
        <Submitted job={job} {...submitted} />
      ) : (
        <>
          <Link
            href={`/careers/jobs/${jobSlug(job)}`}
            className="mb-5 inline-flex items-center gap-1.5 rounded text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Back to the role
          </Link>
          <header className="mb-6 flex flex-col gap-1">
            <p className="text-xs font-medium text-primary">Apply · {deptLabel(job.departmentId)}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{job.title}</h1>
            <p className="text-xs text-muted-foreground">
              {job.location} · {job.workMode} · {job.employmentType} · {job.experience}
            </p>
          </header>
          <ApplyForm
            job={job}
            onSubmitted={(v) => {
              const token = trackingToken(`NEW-${v.email.trim().toLowerCase()}`);
              setSubmitted({ name: v.fullName, email: v.email, token });
              mockAction(`Application received for ${job.title}`, {
                description: `Tracking token ${token} — we have also emailed it to ${v.email}.`,
              });
              window.scrollTo({ top: 0 });
            }}
          />
        </>
      )}
    </PublicShell>
  );
}
