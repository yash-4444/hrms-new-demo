"use client";

import * as React from "react";
import Link from "next/link";
import {
  Briefcase,
  Eye,
  ExternalLink,
  Link2,
  MapPin,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, num } from "@/lib/format";
import { branchById } from "@/mock/org";
import { employeeByCode } from "@/mock/employees";
import {
  JOBS,
  branchLabel,
  candidatesForReq,
  deptLabel,
  requisitionByCode,
  type JobPosting,
} from "@/mock/hiring";
import { mockAction } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Avatar, Badge, EmptyState, Separator } from "@/components/ui/primitives";
import {
  CardsSkeleton,
  Gated,
  PageBody,
  PageHeader,
  useFakeLoad,
} from "@/components/shell/page";
import {
  ConfirmDialog,
  FilterSelect,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/overlays";

/* ============================================================================
   /jobs — the postings derived from approved requisitions, and the controls
   that decide what the public careers site shows.

   Publishing is local state: flip a card and the badge, the counters and the
   "live on the careers site" figure all move together.
   ========================================================================== */

const DEPT_OPTIONS = Array.from(new Set(JOBS.map((j) => j.departmentId))).map((id) => ({
  value: id,
  label: deptLabel(id),
}));

const BRANCH_OPTIONS = Array.from(new Set(JOBS.map((j) => j.branchId))).map((id) => ({
  value: id,
  label: branchLabel(id),
}));

const PUBLISHED_OPTIONS = [
  { value: "published", label: "Published" },
  { value: "draft", label: "Not published" },
];

export default function JobsPage() {
  const loading = useFakeLoad();

  const [jobs, setJobs] = React.useState<JobPosting[]>(() => JOBS.map((j) => ({ ...j })));
  const [dept, setDept] = React.useState("all");
  const [branch, setBranch] = React.useState("all");
  const [published, setPublished] = React.useState("all");
  const [query, setQuery] = React.useState("");

  const [preview, setPreview] = React.useState<JobPosting | null>(null);
  const [unpublishTarget, setUnpublishTarget] = React.useState<JobPosting | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter((j) => {
      if (dept !== "all" && j.departmentId !== dept) return false;
      if (branch !== "all" && j.branchId !== branch) return false;
      if (published === "published" && !j.published) return false;
      if (published === "draft" && j.published) return false;
      if (q && !`${j.title} ${j.reqCode} ${j.location}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [jobs, dept, branch, published, query]);

  const liveCount = jobs.filter((j) => j.published).length;
  const totalApplicants = jobs.reduce(
    (a, j) => a + candidatesForReq(j.reqCode).length,
    0,
  );
  const dirty = dept !== "all" || branch !== "all" || published !== "all" || query !== "";

  const clearFilters = () => {
    setDept("all");
    setBranch("all");
    setPublished("all");
    setQuery("");
  };

  const setPublishedFlag = (id: string, value: boolean) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, published: value } : j)));
    setPreview((p) => (p && p.id === id ? { ...p, published: value } : p));
  };

  const publish = (job: JobPosting) => {
    setPublishedFlag(job.id, true);
    mockAction("Job posting published", {
      description: `${job.title} is live on the careers site and on ${job.channels.join(", ")}.`,
    });
  };

  const unpublish = (job: JobPosting) => {
    setPublishedFlag(job.id, false);
    mockAction("Job posting unpublished", {
      description: `${job.title} has been withdrawn from the careers site. Existing applicants are unaffected.`,
      tone: "warning",
    });
  };

  const copyLink = async (job: JobPosting) => {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    const url = `${origin}/careers#${job.id}`;
    try {
      await navigator.clipboard.writeText(url);
      mockAction("Link copied", { description: url });
    } catch {
      mockAction("Copy the link manually", { description: url, tone: "info" });
    }
  };

  return (
    <PageBody>
      <PageHeader
        title="Job postings"
        description={`${liveCount} of ${jobs.length} postings are live on the careers site, carrying ${num(totalApplicants)} applicants in total.`}
        actions={
          <Button size="sm" asChild>
            <a href="/careers" target="_blank" rel="noreferrer">
              <ExternalLink /> View careers site
            </a>
          </Button>
        }
      />

      {/* --------------------------------------------------------- filters */}
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, code or location…"
            aria-label="Search job postings"
            className="h-7 w-[230px] rounded-md border border-input bg-card pl-7 pr-6 text-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
        <FilterSelect
          label="Dept"
          value={dept}
          onValueChange={setDept}
          options={DEPT_OPTIONS}
          allLabel="All departments"
        />
        <FilterSelect
          label="Location"
          value={branch}
          onValueChange={setBranch}
          options={BRANCH_OPTIONS}
          allLabel="All locations"
          width="w-[150px]"
        />
        <FilterSelect
          label="State"
          value={published}
          onValueChange={setPublished}
          options={PUBLISHED_OPTIONS}
          allLabel="Published & draft"
          width="w-[170px]"
        />
        {dirty && (
          <Button size="sm" variant="ghost" onClick={clearFilters}>
            Clear
          </Button>
        )}
        <span className="tnum ml-auto text-xs text-muted-foreground">
          {filtered.length} of {jobs.length} postings
        </span>
      </div>

      {/* ----------------------------------------------------------- grid */}
      {loading ? (
        <>
          <CardsSkeleton count={4} height={190} />
          <CardsSkeleton count={4} height={190} />
        </>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No postings match these filters"
          description="Every approved requisition gets a posting. Loosen a filter to see the rest."
          action={
            <Button size="sm" variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onPreview={() => setPreview(job)}
              onPublish={() => publish(job)}
              onUnpublish={() => setUnpublishTarget(job)}
              onCopy={() => copyLink(job)}
            />
          ))}
        </div>
      )}

      {/* -------------------------------------------------- preview drawer */}
      <Sheet open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <SheetContent side="right" width="sm:max-w-2xl">
          {preview && (
            <>
              <SheetHeader>
                <SheetTitle className="pr-6">{preview.title}</SheetTitle>
                <SheetDescription>
                  This is what a candidate sees on the careers site.
                </SheetDescription>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <StatusBadge
                    status={preview.published ? "open" : "closed"}
                    label={preview.published ? "Published" : "Not published"}
                  />
                  <Badge variant="muted">{deptLabel(preview.departmentId)}</Badge>
                  <Badge variant="muted">{preview.location}</Badge>
                  <Badge variant="muted">{preview.workMode}</Badge>
                  <Badge variant="muted">{preview.experience}</Badge>
                </div>
              </SheetHeader>

              <SheetBody className="flex flex-col gap-4">
                <p className="text-sm leading-relaxed text-foreground">{preview.summary}</p>

                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    What you will do
                  </h3>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {preview.responsibilities.map((r) => (
                      <li key={r} className="flex gap-2 text-xs leading-relaxed text-foreground">
                        <span
                          aria-hidden
                          className="mt-1.5 size-1 shrink-0 rounded-full bg-primary"
                        />
                        {r}
                      </li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    What we are looking for
                  </h3>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {preview.requirements.map((r) => (
                      <li key={r} className="flex gap-2 text-xs leading-relaxed text-foreground">
                        <span
                          aria-hidden
                          className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground"
                        />
                        {r}
                      </li>
                    ))}
                  </ul>
                </section>

                <Separator />

                <section className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Requisition
                    </p>
                    <p className="mt-0.5 font-mono text-foreground">{preview.reqCode}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Posted
                    </p>
                    <p className="tnum mt-0.5 text-foreground">{fmtDate(preview.postedDate)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Applicants
                    </p>
                    <p className="tnum mt-0.5 text-foreground">
                      {candidatesForReq(preview.reqCode).length}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Views
                    </p>
                    <p className="tnum mt-0.5 text-foreground">{num(preview.views)}</p>
                  </div>
                </section>
              </SheetBody>

              <SheetFooter>
                <Button variant="outline" onClick={() => setPreview(null)}>
                  Close
                </Button>
                <Button variant="outline" onClick={() => copyLink(preview)}>
                  <Link2 /> Copy link
                </Button>
                <Gated menuKey="hiring.jobs" action="E">
                  {preview.published ? (
                    <Button
                      variant="outline"
                      onClick={() => setUnpublishTarget(preview)}
                    >
                      Unpublish
                    </Button>
                  ) : (
                    <Button onClick={() => publish(preview)}>
                      <Send /> Publish
                    </Button>
                  )}
                </Gated>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!unpublishTarget}
        onOpenChange={(v) => !v && setUnpublishTarget(null)}
        destructive
        title="Unpublish this posting?"
        description={
          unpublishTarget
            ? `${unpublishTarget.title} will be removed from the careers site and from ${unpublishTarget.channels.join(", ")}. Candidates already in the pipeline keep their applications.`
            : undefined
        }
        confirmLabel="Unpublish"
        onConfirm={() => {
          if (unpublishTarget) unpublish(unpublishTarget);
          setUnpublishTarget(null);
        }}
      />
    </PageBody>
  );
}

/* ------------------------------------------------------------- job card */

function JobCard({
  job,
  onPreview,
  onPublish,
  onUnpublish,
  onCopy,
}: {
  job: JobPosting;
  onPreview: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onCopy: () => void;
}) {
  const applicants = candidatesForReq(job.reqCode);
  const req = requisitionByCode(job.reqCode);
  const recruiter = req ? employeeByCode(req.recruiterCode) : undefined;
  const branch = branchById(job.branchId);

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-border px-3.5 py-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onPreview}
            className="rounded text-left text-sm font-semibold tracking-tight text-foreground hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
          >
            {job.title}
          </button>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            <span>{deptLabel(job.departmentId)}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-0.5">
              <MapPin className="size-3" aria-hidden />
              {branch?.city ?? job.location}
            </span>
            <span aria-hidden>·</span>
            <span>{job.workMode}</span>
          </p>
        </div>
        <StatusBadge
          status={job.published ? "open" : "closed"}
          label={job.published ? "Published" : "Draft"}
        />
      </div>

      <div className="flex flex-1 flex-col gap-2.5 px-3.5 py-3">
        <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
          {job.summary}
        </p>

        <ul className="flex flex-wrap gap-1">
          {job.channels.map((c) => (
            <li key={c}>
              <Badge variant="muted">{c}</Badge>
            </li>
          ))}
        </ul>

        <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-border pt-2.5">
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Applicants
            </dt>
            <dd className="tnum text-sm font-semibold text-foreground">{applicants.length}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Views</dt>
            <dd className="tnum text-sm font-semibold text-foreground">{num(job.views)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Posted</dt>
            <dd className="tnum text-xs text-foreground">{fmtDate(job.postedDate)}</dd>
          </div>
        </dl>

        {recruiter && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Avatar name={recruiter.name} size={18} />
            <span className="truncate">{recruiter.name}</span>
            <span aria-hidden>·</span>
            <span className="truncate font-mono">{job.reqCode}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-3.5 py-2.5">
        <Button size="sm" variant="outline" onClick={onPreview}>
          <Eye /> Preview
        </Button>
        <Gated menuKey="hiring.jobs" action="E">
          {job.published ? (
            <Button size="sm" variant="outline" onClick={onUnpublish}>
              Unpublish
            </Button>
          ) : (
            <Button size="sm" onClick={onPublish}>
              <Send /> Publish
            </Button>
          )}
        </Gated>
        <Button size="sm" variant="ghost" onClick={onCopy} aria-label={`Copy link to ${job.title}`}>
          <Link2 />
        </Button>
        <Button size="sm" variant="ghost" asChild className="ml-auto">
          <Link
            href={`/candidates?req=${job.reqCode}`}
            aria-label={`Open the pipeline for ${job.title}`}
          >
            <Users /> Pipeline
          </Link>
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <Link href="/requisitions" aria-label={`Open requisition ${job.reqCode}`}>
            <Briefcase /> Req
          </Link>
        </Button>
      </div>
    </Card>
  );
}
