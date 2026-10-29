"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { addDays, addMinutes, format, parseISO } from "date-fns";
import {
  ArrowLeft,
  ArrowRightLeft,
  Ban,
  Briefcase,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  Download,
  ExternalLink,
  FileText,
  Gauge,
  Inbox,
  Mail,
  MessageSquarePlus,
  Phone,
  Send,
  Sparkles,
  UserSearch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDateTime, inr } from "@/lib/format";
import { DEMO_NOW, DEMO_TODAY, branchById } from "@/mock/org";
import { EMPLOYEES, employeeByCode } from "@/mock/employees";
import { PREJOIN_CANDIDATE } from "@/mock/lifecycle-public";
import {
  INTERVIEW_MODES,
  INTERVIEW_ROUNDS,
  PIPELINE_STAGES,
  candidateById,
  candidateTimeline,
  deptLabel,
  interviewsForCandidate,
  offerForCandidate,
  requisitionByCode,
  stageLabel,
  type Candidate,
  type Interview,
  type InterviewMode,
  type InterviewRound,
  type PipelineStage,
  type TimelineEvent,
} from "@/mock/hiring";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Avatar,
  Badge,
  EmptyState,
  Field,
  Hint,
  Input,
  Separator,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@/components/ui/primitives";
import {
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/overlays";
import { ProgressRing } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, Gated, PageBody, PageHeader, Section, useFakeLoad } from "@/components/shell/page";
import { ResumePreview } from "@/components/hiring/resume-preview";
import { ScorecardPanel } from "@/components/hiring/scorecard-panel";
import {
  AiInterviewQuestions,
  AiMatchCard,
  AiScorecardSummary,
  PARSED_FIELD,
  ParsedFromResume,
} from "@/components/ai/embed/hiring-ai-ui";

/* ============================================================================
   Candidate profile — the recruiter's single screen for one person:
   the facts, the parsed resume, every scorecard, and the activity trail.
   Every control here mutates in-memory state and shows a toast; nothing
   persists past a refresh, by design.
   ========================================================================== */

const REJECTION_PRESETS = [
  "Technical depth did not clear the bar for this grade.",
  "Compensation expectation is outside the approved band.",
  "Notice period does not work against the target close date.",
  "Stronger profiles are further along on this requisition.",
  "Candidate withdrew from the process.",
  "Role requirements changed after the requisition was re-scoped.",
];

const TIMELINE_ICON: Record<TimelineEvent["kind"], React.ElementType> = {
  application: Inbox,
  stage: ArrowRightLeft,
  interview: CalendarClock,
  note: MessageSquarePlus,
  offer: FileText,
  decision: CheckCircle2,
};

/* ------------------------------------------------------------------ forms */

const scheduleSchema = z
  .object({
    round: z.string().min(1, "Select a round"),
    date: z.string().min(1, "Pick a date"),
    time: z.string().min(1, "Pick a start time"),
    mode: z.string().min(1, "Select a mode"),
    duration: z.string().min(1, "Select a duration"),
    venue: z.string().optional(),
    panelCodes: z.array(z.string()).min(1, "Add at least one panel member"),
  })
  .refine((v) => v.date >= DEMO_TODAY, {
    message: "Interviews can only be scheduled for today or a future date",
    path: ["date"],
  });

type ScheduleValues = z.infer<typeof scheduleSchema>;

const rejectSchema = z.object({
  reason: z.string().min(1, "Pick a reason"),
  note: z.string().min(10, "Add at least 10 characters so the decision is on record"),
});
type RejectValues = z.infer<typeof rejectSchema>;

const noteSchema = z.object({
  note: z.string().min(5, "A note needs at least 5 characters"),
});
type NoteValues = z.infer<typeof noteSchema>;

/* ------------------------------------------------------------------- page */

export default function CandidateDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  const loading = useFakeLoad();
  const candidate = React.useMemo(() => candidateById(id), [id]);

  if (loading) {
    return (
      <PageBody>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-3.5 w-96" />
        </div>
        <CardsSkeleton count={4} />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Skeleton className="h-[420px]" />
          <Skeleton className="h-[420px]" />
        </div>
      </PageBody>
    );
  }

  if (!candidate) {
    return (
      <PageBody>
        <PageHeader
          title="Candidate not found"
          description={`No candidate matches the reference ${id || "—"} in this tenant.`}
        />
        <EmptyState
          icon={UserSearch}
          title="This candidate is not on the board"
          description="The reference may be from another tenant, or the record was closed out and archived."
          action={
            <Button size="sm" asChild>
              <Link href="/candidates">
                <ArrowLeft /> Back to pipeline
              </Link>
            </Button>
          }
        />
      </PageBody>
    );
  }

  return <CandidateDetail key={candidate.id} candidate={candidate} />;
}

/* --------------------------------------------------------------- the body */

function CandidateDetail({ candidate }: { candidate: Candidate }) {
  const { can } = useApp();
  const req = requisitionByCode(candidate.reqCode);
  const branch = branchById(candidate.branchId);
  const offer = offerForCandidate(candidate.id);
  const recruiter = employeeByCode(candidate.ownerCode);
  const hiringManager = req ? employeeByCode(req.hiringManagerCode) : undefined;

  /* ----------------------------------------------------------- local state */
  const [stage, setStage] = React.useState<PipelineStage>(candidate.stage);
  const [rejectionNote, setRejectionNote] = React.useState<string | null>(
    candidate.rejectionReason,
  );
  const [interviews, setInterviews] = React.useState<Interview[]>(() =>
    interviewsForCandidate(candidate.id),
  );
  const [extraEvents, setExtraEvents] = React.useState<TimelineEvent[]>([]);
  const [tab, setTab] = React.useState("overview");

  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [confirmRejectOpen, setConfirmRejectOpen] = React.useState(false);
  const [pendingRejection, setPendingRejection] = React.useState<RejectValues | null>(null);

  const seqRef = React.useRef(0);
  const nextSeq = () => (seqRef.current += 1);

  /** Deterministic "now" for locally-added events — never Date.now(). */
  const stamp = React.useCallback(
    (offsetMinutes: number) =>
      format(addMinutes(parseISO(DEMO_NOW), offsetMinutes), "yyyy-MM-dd'T'HH:mm:ss"),
    [],
  );

  const pushEvent = React.useCallback((event: TimelineEvent) => {
    setExtraEvents((prev) => [event, ...prev]);
  }, []);

  /* ------------------------------------------------------------- mutations */

  const applyStage = (next: PipelineStage, detail?: string) => {
    const from = stage;
    setStage(next);
    pushEvent({
      at: stamp(nextSeq()),
      title: `Moved from ${stageLabel(from)} to ${stageLabel(next)}`,
      detail:
        detail ??
        `Stage changed on the candidate profile. ${candidate.name} is now in the ${stageLabel(next)} column on the pipeline board.`,
      kind: "stage",
      actor: recruiter?.name ?? "Recruiting",
    });
    mockAction(`${candidate.name} moved to ${stageLabel(next)}`, {
      description: `${stageLabel(from)} → ${stageLabel(next)} · ${candidate.reqCode}. In-memory only — nothing is persisted.`,
    });
  };

  const confirmRejection = () => {
    if (!pendingRejection) return;
    const { reason, note } = pendingRejection;
    setStage("rejected");
    setRejectionNote(reason);
    pushEvent({
      at: stamp(nextSeq()),
      title: `Rejected at ${stageLabel(stage === "rejected" ? (candidate.rejectedAtStage ?? "interview") : stage)}`,
      detail: `${reason} ${note}`,
      kind: "decision",
      actor: recruiter?.name ?? "Recruiting",
    });
    setPendingRejection(null);
    mockAction(`${candidate.name} rejected`, {
      description: `${reason} A rejection note has been recorded against ${candidate.reqCode}.`,
      tone: "warning",
    });
  };

  const addInterview = (values: ScheduleValues) => {
    const mode = values.mode as InterviewMode;
    const fallbackVenue =
      mode === "Video call"
        ? `meet.stellartech.in/${candidate.id.toLowerCase()}-r${interviews.length + 1}`
        : mode === "In person"
          ? "Meeting Room 2A — Kepler"
          : `Call to ${candidate.phone}`;

    const created: Interview = {
      id: `INT-LOCAL-${nextSeq()}`,
      candidateId: candidate.id,
      candidateName: candidate.name,
      reqCode: candidate.reqCode,
      role: candidate.role,
      round: values.round as InterviewRound,
      panelCodes: values.panelCodes,
      date: values.date,
      time: values.time,
      startsAt: `${values.date}T${values.time}:00`,
      durationMins: Number(values.duration),
      mode,
      venue: values.venue?.trim() ? values.venue.trim() : fallbackVenue,
      status: "scheduled",
      scorecards: [],
    };

    setInterviews((prev) => [created, ...prev]);
    pushEvent({
      at: stamp(nextSeq()),
      title: `${created.round} scheduled`,
      detail: `${fmtDateTime(created.startsAt)} · ${created.mode} · ${created.durationMins} min · panel: ${created.panelCodes
        .map((c) => employeeByCode(c)?.name ?? c)
        .join(", ")}.`,
      kind: "interview",
      actor: recruiter?.name ?? "Recruiting",
    });
    setScheduleOpen(false);
    setTab("interviews");
    mockAction(`${created.round} scheduled for ${candidate.name}`, {
      description: `${fmtDateTime(created.startsAt)} · ${created.mode}. Calendar invites are not sent in the demo.`,
    });
  };

  const addNote = (values: NoteValues) => {
    pushEvent({
      at: stamp(nextSeq()),
      title: "Note added",
      detail: values.note,
      kind: "note",
      actor: recruiter?.name ?? "Recruiting",
    });
    mockAction("Note added to the candidate record", {
      description: `Visible to everyone with access to ${candidate.reqCode}.`,
    });
  };

  /* --------------------------------------------------------------- derived */

  const timeline = React.useMemo(() => {
    const base = candidateTimeline(candidate.id);
    return [...extraEvents, ...base];
  }, [candidate.id, extraEvents]);

  const completedRounds = interviews.filter((i) => i.status === "completed").length;
  const upcomingRounds = interviews.filter((i) => i.status === "scheduled").length;
  const allCards = interviews.flatMap((i) => i.scorecards);
  const panelAverage = allCards.length
    ? allCards.reduce((a, c) => a + c.overall, 0) / allCards.length
    : null;

  const panelOptions = React.useMemo(() => {
    const codes: string[] = [];
    if (req) {
      codes.push(req.hiringManagerCode, req.recruiterCode);
    }
    EMPLOYEES.filter((e) => e.departmentId === candidate.departmentId && e.status !== "exited")
      .sort((a, b) => a.level - b.level || a.code.localeCompare(b.code))
      .slice(0, 10)
      .forEach((e) => codes.push(e.code));
    return Array.from(new Set(codes)).map((code) => ({
      code,
      name: employeeByCode(code)?.name ?? code,
      title: employeeByCode(code)?.designation ?? "Panel member",
    }));
  }, [candidate.departmentId, req]);

  const canEdit = can("hiring.candidates", "E");

  /* ------------------------------------------------------------------ view */

  return (
    <PageBody>
      <PageHeader
        title={candidate.name}
        description={
          <>
            {candidate.role} ·{" "}
            <Link href="/requisitions" className="text-primary hover:underline">
              {candidate.reqCode}
            </Link>{" "}
            · {deptLabel(candidate.departmentId)}, {branch?.city ?? candidate.branchId} ·{" "}
            {candidate.experienceYears} years experience · sourced via {candidate.source}
          </>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/candidates">
                <ArrowLeft /> Pipeline
              </Link>
            </Button>

            {canEdit ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <ArrowRightLeft /> Move to… <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Move to stage</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {PIPELINE_STAGES.map((s) => (
                    <DropdownMenuItem
                      key={s.id}
                      disabled={s.id === stage}
                      destructive={s.id === "rejected"}
                      onSelect={() => {
                        if (s.id === stage) return;
                        if (s.id === "rejected") setRejectOpen(true);
                        else applyStage(s.id);
                      }}
                    >
                      {s.id === stage ? `${s.label} (current)` : s.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Gated menuKey="hiring.candidates" action="E">
                <Button variant="outline" size="sm">
                  <ArrowRightLeft /> Move to…
                </Button>
              </Gated>
            )}

            <Gated menuKey="hiring.interviews" action="C">
              <Button variant="outline" size="sm" onClick={() => setScheduleOpen(true)}>
                <CalendarPlus /> Schedule interview
              </Button>
            </Gated>

            {/* A hired candidate completes their joining formalities on the public portal. */}
            {stage === "hired" && (
              <Hint
                text={
                  candidate.id === PREJOIN_CANDIDATE.id
                    ? `The portal ${candidate.name.split(" ")[0]} uses before day one — personal details, bank, nominees, documents.`
                    : `The demo portal is seeded for ${PREJOIN_CANDIDATE.name}; every hire gets the same flow.`
                }
              >
                <Button variant="outline" size="sm" asChild>
                  <Link href="/pre-joining" target="_blank" rel="noopener">
                    <ExternalLink /> Pre-joining portal
                  </Link>
                </Button>
              </Hint>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                mockAction("Resume download started", {
                  description: `${candidate.resumeFile} — in the demo no file is written to disk.`,
                })
              }
            >
              <Download /> Resume
            </Button>

            <Gated menuKey="hiring.candidates" action="D">
              <Button
                variant="destructive"
                size="sm"
                disabled={stage === "rejected"}
                onClick={() => setRejectOpen(true)}
              >
                <Ban /> Reject
              </Button>
            </Gated>
          </>
        }
      />

      {/* KPI strip — every tile goes somewhere */}
      <StatRow cols={4}>
        <StatTile
          label="Pipeline stage"
          value={stageLabel(stage)}
          hint={`${candidate.stageAgeDays} days in stage · applied ${fmtDate(candidate.appliedDate)}`}
          icon={Sparkles}
          tone={stage === "rejected" ? "critical" : stage === "hired" ? "good" : "accent"}
          href="/candidates"
        />
        <StatTile
          label="Panel rating"
          value={
            panelAverage !== null
              ? `${panelAverage.toFixed(1)} / 5`
              : `${candidate.rating.toFixed(1)} / 5`
          }
          hint={
            panelAverage !== null
              ? `${allCards.length} scorecard${allCards.length === 1 ? "" : "s"} across ${completedRounds} completed round${completedRounds === 1 ? "" : "s"}`
              : "Recruiter screen rating — no panel feedback yet"
          }
          icon={Gauge}
          onClick={() => setTab("interviews")}
        />
        <StatTile
          label="Expected CTC"
          value={inr(candidate.expectedCtc, { decimals: false })}
          hint={`Current ${inr(candidate.currentCtc, { decimals: false })} · ${
            candidate.noticePeriodDays === 0
              ? "immediate joiner"
              : `${candidate.noticePeriodDays}-day notice`
          }`}
          icon={Briefcase}
          href="/offers"
        />
        <StatTile
          label="Interview rounds"
          value={`${completedRounds} done`}
          hint={`${upcomingRounds} scheduled · ${interviews.length} total on this requisition`}
          icon={CalendarClock}
          href="/interviews"
        />
      </StatRow>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="resume">Resume</TabsTrigger>
          <TabsTrigger value="interviews">
            Interviews
            <span className="tnum ml-1 text-muted-foreground">{interviews.length}</span>
          </TabsTrigger>
          <TabsTrigger value="timeline">
            Timeline
            <span className="tnum ml-1 text-muted-foreground">{timeline.length}</span>
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------- overview */}
        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="flex flex-col gap-4">
              <Card className="p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <Avatar name={candidate.name} size={56} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h2 className="text-base font-semibold tracking-tight">{candidate.name}</h2>
                      <StatusBadge status={stage} />
                      <Badge variant="soft">{candidate.source}</Badge>
                      {candidate.referredBy && (
                        <Badge variant="muted">Referred by {candidate.referredBy}</Badge>
                      )}
                    </div>
                    <div className={cn("mt-1.5 w-fit", PARSED_FIELD)}>
                    <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {candidate.currentTitle} at {candidate.currentCompany} ·{" "}
                      {candidate.location}
                      <ParsedFromResume />
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <a
                        href={`mailto:${candidate.email}`}
                        className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <Mail className="size-3.5" aria-hidden />
                        {candidate.email}
                      </a>
                      <a
                        href={`tel:${candidate.phone.replace(/\s/g, "")}`}
                        className="tnum flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <Phone className="size-3.5" aria-hidden />
                        {candidate.phone}
                      </a>
                    </div>
                    </div>
                  </div>
                  <ProgressRing
                    value={candidate.rating}
                    max={5}
                    size={62}
                    label={candidate.rating.toFixed(1)}
                    sublabel="rating"
                  />
                </div>

                <Separator className="my-4" />

                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                  <Fact label="Current CTC" value={inr(candidate.currentCtc, { decimals: false })} numeric />
                  <Fact label="Expected CTC" value={inr(candidate.expectedCtc, { decimals: false })} numeric />
                  <Fact
                    label="Hike expected"
                    value={`${Math.round(
                      ((candidate.expectedCtc - candidate.currentCtc) / candidate.currentCtc) * 100,
                    )}%`}
                    numeric
                  />
                  <Fact
                    label="Notice period"
                    value={
                      candidate.noticePeriodDays === 0
                        ? "Immediate"
                        : `${candidate.noticePeriodDays} days`
                    }
                    numeric
                  />
                  <Fact
                    label="Experience"
                    value={
                      <span className="inline-flex items-center gap-1.5">
                        {candidate.experienceYears} years <ParsedFromResume />
                      </span>
                    }
                    numeric
                  />
                  <Fact label="Applied on" value={fmtDate(candidate.appliedDate)} />
                  <Fact
                    label="In this stage"
                    value={`${candidate.stageAgeDays} days · since ${fmtDate(candidate.stageSince)}`}
                  />
                  <Fact label="Location" value={candidate.location} />
                  <Fact label="Resume" value={candidate.resumeFile} mono />
                </dl>

                <Separator className="my-4" />

                <div>
                  <p className="text-xs font-medium text-muted-foreground">Recruiter summary</p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground">
                    {candidate.summary}
                  </p>
                </div>

                <div className={cn("mt-3", PARSED_FIELD)}>
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    Skills <ParsedFromResume />
                  </p>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {candidate.skills.map((s) => (
                      <li key={s}>
                        <Badge variant="muted">{s}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>

                {stage === "rejected" && rejectionNote && (
                  <div className="mt-4 rounded-md border border-destructive/25 bg-destructive-soft px-3 py-2.5">
                    <p className="text-xs font-semibold text-destructive-fg">Rejection reason</p>
                    <p className="mt-0.5 text-xs text-destructive-fg opacity-90">{rejectionNote}</p>
                  </div>
                )}
              </Card>

              {can("hiring.candidates", "V") && (
                <>
                  <AiMatchCard candidate={candidate} />
                  <AiScorecardSummary interviews={interviews} />
                </>
              )}

              {offer && (
                <Section
                  title="Offer on record"
                  description={`${offer.id} · raised ${fmtDate(offer.offerDate)} · valid till ${fmtDate(offer.validTill)}`}
                  actions={
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/offers">
                        <FileText /> Open in Offers
                      </Link>
                    </Button>
                  }
                >
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                    <Fact label="Annual CTC" value={inr(offer.ctc, { decimals: false })} numeric />
                    <Fact
                      label="Joining bonus"
                      value={offer.joiningBonus ? inr(offer.joiningBonus, { decimals: false }) : "—"}
                      numeric
                    />
                    <Fact label="Joining date" value={fmtDate(offer.joiningDate)} />
                    <Fact label="Grade" value={offer.gradeId} />
                  </dl>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusBadge status={offer.status} />
                    <p className="text-xs text-muted-foreground">{offer.notes}</p>
                  </div>
                </Section>
              )}
            </div>

            {/* side rail */}
            <div className="flex flex-col gap-4">
              <Section title="Requisition" description={candidate.reqCode}>
                {req ? (
                  <dl className="flex flex-col gap-3">
                    <Fact label="Role" value={req.role} />
                    <Fact label="Department" value={deptLabel(req.departmentId)} />
                    <Fact label="Grade" value={req.gradeId} />
                    <Fact
                      label="Budget band"
                      value={`${inr(req.budgetMinCtc, { decimals: false })} — ${inr(req.budgetMaxCtc, { decimals: false })}`}
                      numeric
                    />
                    <Fact
                      label="Positions"
                      value={`${req.filled} of ${req.headcount} filled`}
                      numeric
                    />
                    <Fact label="Target close" value={fmtDate(req.targetCloseDate)} />
                    <div>
                      <dt className="text-xs text-muted-foreground">Status</dt>
                      <dd className="mt-1 flex flex-wrap gap-1.5">
                        <StatusBadge status={req.status} />
                        <StatusBadge
                          status={req.approvalStatus}
                          label={`Approval: ${
                            req.approvalStatus === "approved"
                              ? "Approved"
                              : req.approvalStatus === "pending"
                                ? "Pending"
                                : "Rejected"
                          }`}
                        />
                      </dd>
                    </div>
                    <Button variant="outline" size="sm" asChild className="mt-1 w-full">
                      <Link href="/requisitions">
                        <Briefcase /> Open requisitions
                      </Link>
                    </Button>
                  </dl>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    The requisition behind this application is no longer available.
                  </p>
                )}
              </Section>

              <Section title="Owners" description="Who is accountable for this candidate">
                <ul className="flex flex-col gap-3">
                  {[
                    { person: recruiter, role: "Recruiter" },
                    { person: hiringManager, role: "Hiring manager" },
                  ].map(({ person, role }) => (
                    <li key={role} className="flex items-center gap-2.5">
                      <Avatar name={person?.name ?? role} size={30} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-foreground">
                          {person?.name ?? "Unassigned"}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {role}
                          {person ? ` · ${person.designation}` : ""}
                        </p>
                      </div>
                      {person && (
                        <Button variant="ghost" size="icon-sm" asChild aria-label={`Email ${person.name}`}>
                          <a href={`mailto:${person.email}`}>
                            <Mail />
                          </a>
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() =>
                    mockAction("Profile shared with the panel", {
                      description: `${candidate.name}'s profile link sent to ${panelOptions
                        .slice(0, 3)
                        .map((p) => p.name)
                        .join(", ")}. No email leaves this build.`,
                    })
                  }
                >
                  <Send /> Share with panel
                </Button>
              </Section>
            </div>
          </div>
        </TabsContent>

        {/* --------------------------------------------------------- resume */}
        <TabsContent value="resume">
          <Section
            title="Resume preview"
            description={`Parsed from ${candidate.resumeFile} on ${fmtDate(candidate.appliedDate)}. This is a rendered preview, not the original file.`}
          >
            <ResumePreview candidate={candidate} />
          </Section>
        </TabsContent>

        {/* ----------------------------------------------------- interviews */}
        <TabsContent value="interviews">
          <Section
            title="Interview rounds & scorecards"
            description={`${completedRounds} completed · ${upcomingRounds} scheduled. Every competency shows its score as a number, not only as a bar.`}
            actions={
              <Gated menuKey="hiring.interviews" action="C">
                <Button variant="outline" size="sm" onClick={() => setScheduleOpen(true)}>
                  <CalendarPlus /> Schedule round
                </Button>
              </Gated>
            }
          >
            <div className="flex flex-col gap-3">
              <AiScorecardSummary interviews={interviews} />
              <ScorecardPanel
                interviews={interviews}
                candidateName={candidate.name}
                onSchedule={() => setScheduleOpen(true)}
              />
            </div>
          </Section>
          {stage !== "rejected" && stage !== "hired" && (
            <div className="mt-4">
              <AiInterviewQuestions candidate={candidate} />
            </div>
          )}
        </TabsContent>

        {/* ------------------------------------------------------- timeline */}
        <TabsContent value="timeline">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Section
              title="Activity timeline"
              description="Everything that has happened on this application, newest first."
            >
              <ol className="flex flex-col">
                {timeline.map((event, i) => {
                  const Icon = TIMELINE_ICON[event.kind];
                  const last = i === timeline.length - 1;
                  return (
                    <li key={`${event.at}-${event.title}-${i}`} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-subtle text-muted-foreground">
                          <Icon className="size-3" aria-hidden />
                        </span>
                        {!last && <span className="w-px flex-1 bg-border" aria-hidden />}
                      </div>
                      <div className={cn("min-w-0 flex-1", last ? "pb-0" : "pb-4")}>
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <p className="text-xs font-semibold text-foreground">{event.title}</p>
                          <p className="tnum text-[11px] text-muted-foreground">
                            {fmtDateTime(event.at)}
                          </p>
                        </div>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {event.detail}
                        </p>
                        {event.actor && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            by <span className="text-foreground">{event.actor}</span>
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Section>

            <Section
              title="Add a note"
              description="Recorded against the candidate and visible to everyone on the requisition."
            >
              <AddNoteForm onSubmit={addNote} />
            </Section>
          </div>
        </TabsContent>
      </Tabs>

      {/* ------------------------------------------------------------ modals */}
      <ScheduleInterviewDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        candidate={candidate}
        panelOptions={panelOptions}
        defaultPanel={req ? [req.hiringManagerCode] : []}
        onSubmit={addInterview}
      />

      <RejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        candidateName={candidate.name}
        stageName={stageLabel(stage)}
        onSubmit={(values) => {
          setPendingRejection(values);
          setRejectOpen(false);
          setConfirmRejectOpen(true);
        }}
      />

      <ConfirmDialog
        open={confirmRejectOpen}
        onOpenChange={(v) => {
          setConfirmRejectOpen(v);
          if (!v) setPendingRejection(null);
        }}
        title={`Reject ${candidate.name}?`}
        description={
          <>
            This closes the application against {candidate.reqCode} and moves the card to the
            Rejected column.
            {pendingRejection && (
              <span className="mt-2 block rounded-md border border-border bg-subtle p-2 text-xs text-foreground">
                <span className="font-medium">{pendingRejection.reason}</span>
                <span className="mt-1 block text-muted-foreground">{pendingRejection.note}</span>
              </span>
            )}
          </>
        }
        confirmLabel="Reject candidate"
        destructive
        onConfirm={confirmRejection}
      />
    </PageBody>
  );
}

/* ------------------------------------------------------------ small parts */

function Fact({
  label,
  value,
  numeric,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  numeric?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 truncate text-sm font-medium text-foreground",
          numeric && "tnum",
          mono && "font-mono text-xs",
        )}
        title={typeof value === "string" ? value : undefined}
      >
        {value}
      </dd>
    </div>
  );
}

function AddNoteForm({ onSubmit }: { onSubmit: (values: NoteValues) => void }) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<NoteValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: { note: "" },
  });
  const value = watch("note") ?? "";

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={handleSubmit((values) => {
        onSubmit(values);
        reset({ note: "" });
      })}
    >
      <Field
        label="Note"
        htmlFor="candidate-note"
        required
        error={errors.note?.message}
        hint={`${value.length} characters · minimum 5`}
      >
        <Textarea
          id="candidate-note"
          placeholder="Spoke to the candidate about the joining date — they can start two weeks earlier if the offer lands this week."
          aria-invalid={!!errors.note}
          {...register("note")}
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => reset({ note: "" })}>
          Clear
        </Button>
        <Button type="submit" size="sm" loading={isSubmitting}>
          <MessageSquarePlus /> Add note
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------ schedule dialog */

function ScheduleInterviewDialog({
  open,
  onOpenChange,
  candidate,
  panelOptions,
  defaultPanel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  candidate: Candidate;
  panelOptions: { code: string; name: string; title: string }[];
  defaultPanel: string[];
  onSubmit: (values: ScheduleValues) => void;
}) {
  const defaults = React.useMemo<ScheduleValues>(
    () => ({
      round: "Technical 1",
      date: format(addDays(parseISO(DEMO_TODAY), 3), "yyyy-MM-dd"),
      time: "11:00",
      mode: "Video call",
      duration: "60",
      venue: "",
      panelCodes: defaultPanel.length ? defaultPanel : panelOptions.slice(0, 1).map((p) => p.code),
    }),
    [defaultPanel, panelOptions],
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ScheduleValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: defaults,
  });

  /* Re-seed the form each time the dialog opens, so a cancelled draft
     never leaks into the next one. */
  React.useEffect(() => {
    if (open) reset(defaults);
  }, [open, reset, defaults]);

  const panelCodes = watch("panelCodes") ?? [];
  const round = watch("round");
  const mode = watch("mode");
  const duration = watch("duration");

  const togglePanel = (code: string) => {
    const next = panelCodes.includes(code)
      ? panelCodes.filter((c) => c !== code)
      : [...panelCodes, code];
    setValue("panelCodes", next, { shouldValidate: true, shouldDirty: true });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Schedule an interview</DialogTitle>
          <DialogDescription>
            {candidate.name} · {candidate.role} · {candidate.reqCode}. Invites are not sent in the
            demo build.
          </DialogDescription>
        </DialogHeader>

        <form
          id="schedule-interview-form"
          onSubmit={handleSubmit((values) => onSubmit(values))}
          className="contents"
        >
          <DialogBody>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Round" required error={errors.round?.message}>
                <Select value={round} onValueChange={(v) => setValue("round", v, { shouldValidate: true })}>
                  <SelectTrigger aria-label="Interview round">
                    <SelectValue placeholder="Select a round" />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVIEW_ROUNDS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Mode" required error={errors.mode?.message}>
                <Select value={mode} onValueChange={(v) => setValue("mode", v, { shouldValidate: true })}>
                  <SelectTrigger aria-label="Interview mode">
                    <SelectValue placeholder="Select a mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVIEW_MODES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Date" htmlFor="iv-date" required error={errors.date?.message}>
                <Input id="iv-date" type="date" aria-invalid={!!errors.date} {...register("date")} />
              </Field>

              <Field label="Start time" htmlFor="iv-time" required error={errors.time?.message}>
                <Input id="iv-time" type="time" aria-invalid={!!errors.time} {...register("time")} />
              </Field>

              <Field label="Duration" required error={errors.duration?.message}>
                <Select
                  value={duration}
                  onValueChange={(v) => setValue("duration", v, { shouldValidate: true })}
                >
                  <SelectTrigger aria-label="Duration in minutes">
                    <SelectValue placeholder="Select a duration" />
                  </SelectTrigger>
                  <SelectContent>
                    {["30", "45", "60", "75", "90"].map((d) => (
                      <SelectItem key={d} value={d}>
                        {d} minutes
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Venue or link"
                htmlFor="iv-venue"
                error={errors.venue?.message}
                hint="Leave blank to generate one from the mode"
              >
                <Input
                  id="iv-venue"
                  placeholder="meet.stellartech.in/…"
                  {...register("venue")}
                />
              </Field>
            </div>

            <div className="mt-4">
              <Field
                label="Panel"
                required
                error={errors.panelCodes?.message}
                hint={`${panelCodes.length} selected — the panel receives the scorecard template for this round`}
              >
                <ul className="scrollbar-thin max-h-52 overflow-y-auto rounded-md border border-border">
                  {panelOptions.map((p) => {
                    const checked = panelCodes.includes(p.code);
                    return (
                      <li key={p.code} className="border-b border-border last:border-0">
                        <label
                          className={cn(
                            "flex cursor-pointer items-center gap-2.5 px-2.5 py-2 transition-colors hover:bg-muted/60",
                            checked && "bg-primary-soft/40",
                          )}
                        >
                          <input
                            type="checkbox"
                            className="size-3.5 accent-[var(--primary)]"
                            checked={checked}
                            onChange={() => togglePanel(p.code)}
                            aria-label={`Add ${p.name} to the panel`}
                          />
                          <Avatar name={p.name} size={24} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium text-foreground">
                              {p.name}
                            </span>
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {p.title} · {p.code}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </Field>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              <CalendarPlus /> Schedule round
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------- reject dialog */

function RejectDialog({
  open,
  onOpenChange,
  candidateName,
  stageName,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  candidateName: string;
  stageName: string;
  onSubmit: (values: RejectValues) => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RejectValues>({
    resolver: zodResolver(rejectSchema),
    defaultValues: { reason: "", note: "" },
  });

  React.useEffect(() => {
    if (open) reset({ reason: "", note: "" });
  }, [open, reset]);

  const reason = watch("reason");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Reject {candidateName}</DialogTitle>
          <DialogDescription>
            Currently in {stageName}. A reason is mandatory — it is shown on the candidate record
            and in the rejection analytics.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((values) => onSubmit(values))} className="contents">
          <DialogBody>
            <div className="flex flex-col gap-3">
              <Field label="Reason" required error={errors.reason?.message}>
                <Select
                  value={reason}
                  onValueChange={(v) => setValue("reason", v, { shouldValidate: true })}
                >
                  <SelectTrigger aria-label="Rejection reason">
                    <SelectValue placeholder="Pick a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {REJECTION_PRESETS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Context for the record"
                htmlFor="reject-note"
                required
                error={errors.note?.message}
                hint="At least 10 characters — the panel and the hiring manager will read this."
              >
                <Textarea
                  id="reject-note"
                  placeholder="Panel was aligned after the system design round: strong on delivery, not yet at the depth this grade needs."
                  aria-invalid={!!errors.note}
                  {...register("note")}
                />
              </Field>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" loading={isSubmitting}>
              <Ban /> Continue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
