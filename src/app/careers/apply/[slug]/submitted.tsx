"use client";

import Link from "next/link";
import { CheckCircle2, Copy, Search } from "lucide-react";
import type { JobPosting } from "@/mock/hiring";
import { PUBLIC_STAGES } from "@/mock/lifecycle-public";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { mockAction } from "@/components/app-state";

/** Confirmation after a successful application — the token is the candidate's key to the tracker. */
export function Submitted({ job, name, email, token }: { job: JobPosting; name: string; email: string; token: string }) {
  const copy = () => {
    void navigator.clipboard?.writeText(token);
    mockAction("Tracking token copied", { tone: "info", description: token });
  };

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col items-center gap-3 px-6 py-8 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-success-soft text-success-fg">
          <CheckCircle2 className="size-6" aria-hidden />
        </span>
        <h1 className="text-xl font-semibold tracking-tight">Thanks, {name.split(" ")[0]} — your application is in</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          We received your application for <span className="font-medium text-foreground">{job.title}</span> and sent a
          confirmation to <span className="font-medium text-foreground">{email}</span>.
        </p>

        <div className="mt-2 flex flex-col items-center gap-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Your tracking token</p>
          <div className="flex items-center gap-2">
            <code className="tnum rounded-md border border-border bg-muted px-3 py-1.5 font-mono text-base font-semibold tracking-wider text-foreground">
              {token}
            </code>
            <Button variant="outline" size="icon-sm" onClick={copy} aria-label="Copy tracking token">
              <Copy />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Keep it — it is the quickest way to check where things stand.</p>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold">What happens next</h2>
        <ol className="mt-3 flex flex-col gap-3">
          {PUBLIC_STAGES.slice(0, 3).map((s, i) => (
            <li key={s.id} className="flex items-start gap-3">
              <span className="tnum flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-foreground">
                {i + 1}
              </span>
              <div>
                <p className="text-xs font-medium text-foreground">{s.label}</p>
                <p className="text-xs text-muted-foreground">{s.blurb}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-muted-foreground">
          Your application appears in the tracker as soon as a recruiter opens it — usually within one working day. You
          can look it up with the token above or with your email address.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/careers/track/?token=${encodeURIComponent(token)}`}>
              <Search />
              Track your application
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/careers">Browse more roles</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
