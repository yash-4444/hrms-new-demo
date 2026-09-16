"use client";

import * as React from "react";
import { Download, FileText, Maximize2, Minus, Plus } from "lucide-react";
import { mulberry32, randInt } from "@/lib/utils";
import { DEMO_TODAY } from "@/mock/org";
import type { Candidate } from "@/mock/hiring";
import { mockAction } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Badge, Hint, Separator } from "@/components/ui/primitives";

/* ============================================================================
   A MOCK resume viewer. There is no PDF and no file — this renders a
   document-shaped surface from the candidate's own fixture data, so the
   demo can show "we have the CV" without shipping an asset.

   Everything is derived deterministically from the candidate id, so the
   server render and the client hydration produce identical text.
   ========================================================================== */

const ZOOM_STEPS = [0.8, 0.9, 1, 1.15, 1.3] as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];

const PRIOR_COMPANIES: Record<string, string[]> = {
  ENG: ["Infosys", "Thoughtworks", "Cognizant", "Wipro Digital", "Tech Mahindra", "Mphasis"],
  PRD: ["Zoho", "Freshworks", "Tally Solutions", "Capillary Technologies"],
  DES: ["Lollypop Design Studio", "Obvious", "Fractal Ink", "Zeta"],
  SAL: ["Oracle India", "SAP India", "Ramco Systems", "Zoho Corporation"],
  MKT: ["Ogilvy India", "Dentsu Webchutney", "Freshworks", "Browserstack"],
  CSM: ["Freshworks", "Chargebee", "Zoho", "Capillary Technologies"],
  FIN: ["Deloitte India", "BDO India", "Grant Thornton Bharat", "S.R. Batliboi & Co."],
  ITO: ["Rackspace", "Nutanix", "HCLTech", "Happiest Minds"],
  HR: ["Randstad India", "ABC Consultants", "Michael Page"],
};

const PRIOR_TITLES: Record<string, string[]> = {
  ENG: ["Software Engineer", "Associate Software Engineer", "Backend Developer"],
  PRD: ["Associate Product Manager", "Business Analyst", "Product Analyst"],
  DES: ["Product Designer", "Visual Designer", "UI Designer"],
  SAL: ["Account Executive", "Sales Development Representative", "Inside Sales Manager"],
  MKT: ["Marketing Manager", "Growth Marketer", "Campaign Manager"],
  CSM: ["Customer Success Executive", "Support Lead", "Onboarding Specialist"],
  FIN: ["Audit Associate", "Finance Executive", "Accounts Executive"],
  ITO: ["DevOps Engineer", "Systems Engineer", "Cloud Engineer"],
  HR: ["Recruiter", "Talent Sourcer"],
};

const DEGREES: Record<string, string[]> = {
  ENG: ["B.E. Computer Science", "B.Tech Computer Science & Engineering", "B.Tech Information Technology"],
  PRD: ["B.Tech Electronics & Communication", "B.E. Industrial Engineering"],
  DES: ["B.Des Communication Design", "B.F.A. Visual Communication"],
  SAL: ["B.B.A. Marketing", "B.Com"],
  MKT: ["B.A. Mass Communication", "B.B.A. Marketing"],
  CSM: ["B.B.A.", "B.Com"],
  FIN: ["B.Com (Hons)", "B.Com"],
  ITO: ["B.E. Computer Science", "B.Sc Computer Science"],
  HR: ["B.A. Psychology", "B.B.A."],
};

const POST_GRAD: Record<string, string | null> = {
  ENG: null,
  PRD: "MBA — Product & Strategy",
  DES: null,
  SAL: "MBA — Marketing",
  MKT: "MBA — Marketing",
  CSM: "MBA — Operations",
  FIN: "Chartered Accountant (ICAI)",
  ITO: null,
  HR: "MBA — Human Resources",
};

const INSTITUTES_IN = [
  "National Institute of Technology, Surathkal",
  "BITS Pilani",
  "College of Engineering, Pune",
  "PES University, Bengaluru",
  "Vellore Institute of Technology",
  "Manipal Institute of Technology",
  "Delhi Technological University",
  "Jadavpur University, Kolkata",
];

const INSTITUTES_US = [
  "Rutgers University, New Brunswick",
  "Stevens Institute of Technology",
  "New York University — Tandon",
  "Pennsylvania State University",
];

const PG_INSTITUTES = [
  "Indian Institute of Management, Kozhikode",
  "S.P. Jain Institute of Management",
  "Symbiosis Institute of Business Management",
  "XLRI Jamshedpur",
];

const BULLETS: Record<string, string[]> = {
  ENG: [
    "Owned the settlement service through a 4× growth in daily volume; cut p99 latency from 940 ms to 180 ms by reworking the write path and removing two synchronous calls.",
    "Led the migration of 14 tables to partitioned storage on a live database with no downtime and no data loss.",
    "Introduced contract tests between six services, which took integration failures in the release pipeline from weekly to roughly one a quarter.",
    "Carried the primary pager for two years and rewrote the incident runbooks after the third repeat page on the same alert.",
    "Mentored three engineers through their first production launch and their first on-call rotation.",
  ],
  PRD: [
    "Owned the statutory compliance roadmap across four quarters; every filing deadline in the period was met without an extension.",
    "Ran discovery with 23 payroll administrators and turned it into a specification that cut post-launch change requests by half.",
    "Shipped the calculation-trace feature that reduced payroll support tickets by 31% in the first two cycles.",
    "Rebuilt the pricing model with Finance; average contract value rose 18% with no measurable churn impact.",
  ],
  DES: [
    "Owned the design system through its second year, including a dark theme and a WCAG 2.2 AA audit across 40 screens.",
    "Redesigned the pay-run table; task completion time in usability testing fell from 4m 10s to 1m 40s.",
    "Ran fortnightly usability sessions with real administrators and published the findings the same week.",
    "Introduced design tokens shared with engineering, removing 60+ one-off colour values from the codebase.",
  ],
  SAL: [
    "Closed ₹4.2 Cr of new ACV against a ₹3.5 Cr quota, at an average cycle length of 118 days.",
    "Landed three of the five largest logos in the territory, each through a full security and procurement review.",
    "Built the named-account plan for the region and handed a qualified pipeline of ₹9 Cr to the successor.",
    "Partnered with Customer Success on the first 90 days; none of the accounts closed in the period churned at renewal.",
  ],
  MKT: [
    "Owned a sourced-pipeline number of ₹22 Cr and delivered 108% of it across paid, lifecycle and events.",
    "Built the multi-touch attribution model that Sales and Finance both adopted for planning.",
    "Cut cost per qualified opportunity by 34% by shutting down two channels that only looked good on last-click.",
    "Managed a team of two and the agency relationship, including the annual scope and rate negotiation.",
  ],
  CSM: [
    "Managed a 31-account mid-market book with net revenue retention of 113% and gross retention of 96%.",
    "Took 18 customers through their first two pay runs; all 18 renewed.",
    "Built the health-score model now used across the CS team, combining usage, ticket volume and sponsor changes.",
    "Recovered two at-risk renewals worth ₹1.1 Cr by escalating product gaps with a written business case.",
  ],
  FIN: [
    "Brought the monthly close from day 9 to day 5 by restructuring the reconciliation calendar and automating three schedules.",
    "Owned PF, ESI, PT and TDS filings for a 400-person, three-entity structure with no late filings in 24 months.",
    "Supported two statutory audits with zero significant observations.",
    "Rebuilt the cost-centre allocation model in partnership with Payroll, giving department heads usable monthly variance reporting.",
  ],
  ITO: [
    "Established the on-call rotation, paging policy and blameless postmortem process across a 60-service estate.",
    "Halved actionable-alert noise in two quarters by deleting 40% of alerts and rewriting the rest against SLOs.",
    "Owned the Terraform estate across three AWS accounts and ran the quarterly disaster-recovery exercise for real, not on paper.",
    "Reduced mean time to recovery from 78 minutes to 24 minutes over four quarters.",
  ],
  HR: [
    "Ran full-cycle hiring across engineering and go-to-market, closing 34 roles in a year at a 71% offer-acceptance rate.",
    "Rebuilt the interview scorecard and cut time-to-decision after the final round from 9 days to 2.",
  ],
};

function seedOf(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0);
  return h >>> 0;
}

interface ResumeRole {
  title: string;
  company: string;
  period: string;
  location: string;
  bullets: string[];
}

interface ResumeDoc {
  roles: ResumeRole[];
  degree: string;
  institute: string;
  gradYear: number;
  postGrad: string | null;
  pgInstitute: string | null;
  pgYear: number | null;
}

/** Builds a plausible CV entirely from the candidate record — never random. */
function buildResume(candidate: Candidate): ResumeDoc {
  const rng = mulberry32(seedOf(candidate.id));
  const dept = candidate.departmentId;
  const us = candidate.branchId === "EWR";
  const thisYear = Number(DEMO_TODAY.slice(0, 4));
  const exp = Math.max(2, candidate.experienceYears);

  const bulletPool = BULLETS[dept] ?? BULLETS.ENG;
  const priorCos = PRIOR_COMPANIES[dept] ?? PRIOR_COMPANIES.ENG;
  const priorTitles = PRIOR_TITLES[dept] ?? PRIOR_TITLES.ENG;

  /* Tenure split: current role, then one or two before it. */
  const current = Math.min(exp - 1, randInt(rng, 2, 4));
  const second = Math.min(exp - current - 1, randInt(rng, 2, 3));
  const third = exp - current - second;

  const startCurrent = thisYear - current;
  const startSecond = startCurrent - second;
  const startThird = startSecond - third;

  const m = () => MONTHS[randInt(rng, 0, MONTHS.length - 1)];

  const roles: ResumeRole[] = [
    {
      title: candidate.currentTitle,
      company: candidate.currentCompany,
      period: `${m()} ${startCurrent} — Present`,
      location: us ? "New Jersey, US" : candidate.location,
      bullets: [bulletPool[0], bulletPool[1 % bulletPool.length], bulletPool[2 % bulletPool.length]],
    },
    {
      title: priorTitles[randInt(rng, 0, priorTitles.length - 1)],
      company: priorCos[randInt(rng, 0, priorCos.length - 1)],
      period: `${m()} ${startSecond} — ${m()} ${startCurrent}`,
      location: us ? "New York, US" : candidate.location,
      bullets: [bulletPool[3 % bulletPool.length], bulletPool[(bulletPool.length - 1) % bulletPool.length]],
    },
  ];

  if (third >= 2) {
    const firstCo = priorCos[(randInt(rng, 0, priorCos.length - 1) + 2) % priorCos.length];
    roles.push({
      title: priorTitles[priorTitles.length - 1],
      company: firstCo,
      period: `${m()} ${startThird} — ${m()} ${startSecond}`,
      location: us ? "Newark, NJ" : candidate.location,
      bullets: [bulletPool[1 % bulletPool.length]],
    });
  }

  const degrees = DEGREES[dept] ?? DEGREES.ENG;
  const institutes = us ? INSTITUTES_US : INSTITUTES_IN;
  const postGrad = POST_GRAD[dept] ?? null;
  const gradYear = thisYear - exp - (postGrad ? 2 : 0);

  return {
    roles,
    degree: degrees[randInt(rng, 0, degrees.length - 1)],
    institute: institutes[randInt(rng, 0, institutes.length - 1)],
    gradYear,
    postGrad,
    pgInstitute: postGrad ? PG_INSTITUTES[randInt(rng, 0, PG_INSTITUTES.length - 1)] : null,
    pgYear: postGrad ? gradYear + 2 : null,
  };
}

export function ResumePreview({ candidate }: { candidate: Candidate }) {
  const [zoomIdx, setZoomIdx] = React.useState(2);
  const zoom = ZOOM_STEPS[zoomIdx];
  const doc = React.useMemo(() => buildResume(candidate), [candidate]);

  /* The scaled page needs a wrapper of the right height, or the scroll
     container clips it at zoom > 1. */
  const innerRef = React.useRef<HTMLDivElement>(null);
  const [naturalHeight, setNaturalHeight] = React.useState(0);
  React.useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const measure = () => setNaturalHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex flex-col gap-2">
      {/* viewer toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-subtle px-2 py-1.5">
        <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate font-mono text-xs text-foreground">{candidate.resumeFile}</span>
        <Badge variant="muted" className="ml-1">
          1 page
        </Badge>
        <Badge variant="muted">Parsed {candidate.appliedDate}</Badge>

        <div className="ml-auto flex items-center gap-1">
          <div className="flex items-center rounded-md border border-border bg-card p-0.5">
            <Hint text="Zoom out">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Zoom out"
                disabled={zoomIdx === 0}
                onClick={() => setZoomIdx((i) => Math.max(0, i - 1))}
              >
                <Minus />
              </Button>
            </Hint>
            <span className="tnum w-11 text-center text-xs text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <Hint text="Zoom in">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Zoom in"
                disabled={zoomIdx === ZOOM_STEPS.length - 1}
                onClick={() => setZoomIdx((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
              >
                <Plus />
              </Button>
            </Hint>
          </div>
          <Hint text="Reset to 100%">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Reset zoom to 100%"
              onClick={() => setZoomIdx(2)}
            >
              <Maximize2 />
            </Button>
          </Hint>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              mockAction("Resume download started", {
                description: `${candidate.resumeFile} — in the demo no file is written to disk.`,
              })
            }
          >
            <Download /> Download
          </Button>
        </div>
      </div>

      {/* the "page" */}
      <div className="scrollbar-thin max-h-[620px] overflow-auto rounded-md border border-border bg-muted/50 p-4">
        <div style={naturalHeight ? { height: naturalHeight * zoom } : undefined}>
          <div
            ref={innerRef}
            style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
            className="w-full max-w-[760px]"
          >
            <article className="rounded-md border border-border bg-card px-8 py-7 shadow-sm">
              {/* header */}
              <header>
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  {candidate.name}
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {candidate.currentTitle} · {candidate.currentCompany}
                </p>
                <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{candidate.email}</span>
                  <span aria-hidden>·</span>
                  <span className="tnum">{candidate.phone}</span>
                  <span aria-hidden>·</span>
                  <span>{candidate.location}</span>
                  <span aria-hidden>·</span>
                  <span className="tnum">{candidate.experienceYears} years experience</span>
                </p>
              </header>

              <Separator className="my-4" />

              {/* summary */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Summary
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground">{candidate.summary}</p>
              </section>

              <Separator className="my-4" />

              {/* experience */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Experience
                </h3>
                <ol className="mt-2 flex flex-col gap-4">
                  {doc.roles.map((role, i) => (
                    <li key={`${role.company}-${i}`}>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <p className="text-sm font-semibold text-foreground">
                          {role.title}
                          <span className="font-normal text-muted-foreground"> — {role.company}</span>
                        </p>
                        <p className="tnum text-xs text-muted-foreground">{role.period}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{role.location}</p>
                      <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4 text-xs leading-relaxed text-foreground">
                        {role.bullets.map((b, bi) => (
                          <li key={bi}>{b}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              </section>

              <Separator className="my-4" />

              {/* education */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Education
                </h3>
                <ul className="mt-2 flex flex-col gap-2">
                  {doc.postGrad && (
                    <li className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="text-sm text-foreground">
                        <span className="font-medium">{doc.postGrad}</span>
                        <span className="text-muted-foreground"> — {doc.pgInstitute}</span>
                      </p>
                      <p className="tnum text-xs text-muted-foreground">{doc.pgYear}</p>
                    </li>
                  )}
                  <li className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="text-sm text-foreground">
                      <span className="font-medium">{doc.degree}</span>
                      <span className="text-muted-foreground"> — {doc.institute}</span>
                    </p>
                    <p className="tnum text-xs text-muted-foreground">{doc.gradYear}</p>
                  </li>
                </ul>
              </section>

              <Separator className="my-4" />

              {/* skills */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Skills
                </h3>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {candidate.skills.map((s) => (
                    <li key={s}>
                      <Badge variant="outline">{s}</Badge>
                    </li>
                  ))}
                </ul>
              </section>

              <p className="mt-6 border-t border-border pt-2 text-[10px] text-muted-foreground">
                Rendered preview · parsed from {candidate.resumeFile}. This demo build does not
                store or display the original file.
              </p>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}
