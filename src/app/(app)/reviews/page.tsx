"use client";

import * as React from "react";
import Link from "next/link";
import {
  Award,
  Check,
  ChevronRight,
  Grid3x3,
  Info,
  Save,
  TriangleAlert,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, num, pct } from "@/lib/format";
import { employeeByCode, employeeName } from "@/mock/employees";
import {
  ACTIVE_CYCLE,
  COMPETENCIES,
  RATING_SCALE,
  REVIEW_CYCLES,
  REVIEW_FORMS,
  divergentCompetencies,
  overallRating,
  ratingAnchor,
  reviewFormFor,
  type CompetencyReview,
  type ReviewForm,
} from "@/mock/growth";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Alert,
  Avatar,
  Badge,
  EmptyState,
  Hint,
  Progress,
  Skeleton,
  Textarea,
} from "@/components/ui/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { ShareBar } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import {
  Gated,
  PageBody,
  PageHeader,
  Section,
  useFakeLoad,
} from "@/components/shell/page";

const COLUMNS = [
  { id: "self", label: "Self", blurb: "The employee's own rating." },
  { id: "manager", label: "Manager", blurb: "The reporting manager's rating." },
  { id: "peer", label: "Peer", blurb: "Averaged across the nominated peers." },
] as const;

export default function ReviewsPage() {
  const loading = useFakeLoad();
  const { persona } = useApp();

  const [cycleId, setCycleId] = React.useState(ACTIVE_CYCLE.id);
  const cycle = REVIEW_CYCLES.find((c) => c.id === cycleId) ?? ACTIVE_CYCLE;

  const availableForms = React.useMemo(
    () => REVIEW_FORMS.filter((f) => f.cycleId === cycle.id),
    [cycle.id],
  );

  const [formId, setFormId] = React.useState<string | null>(null);

  const initialForm = React.useMemo(
    () => reviewFormFor(persona.employeeId, cycle.id) ?? availableForms[0] ?? null,
    [persona.employeeId, cycle.id, availableForms],
  );

  const baseForm = React.useMemo(
    () => (formId ? (availableForms.find((f) => f.id === formId) ?? initialForm) : initialForm),
    [formId, availableForms, initialForm],
  );

  /* Local editable copy — the rating scale is genuinely clickable. */
  const [draft, setDraft] = React.useState<CompetencyReview[]>(baseForm?.competencies ?? []);
  const [summary, setSummary] = React.useState(baseForm?.managerSummary ?? "");
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => {
    setDraft(baseForm?.competencies ?? []);
    setSummary(baseForm?.managerSummary ?? "");
    setDirty(false);
  }, [baseForm]);

  const setRating = (competencyId: string, column: "self" | "manager" | "peer", value: number) => {
    setDraft((d) => d.map((c) => (c.competencyId === competencyId ? { ...c, [column]: value } : c)));
    setDirty(true);
  };

  const liveForm: ReviewForm | null = baseForm ? { ...baseForm, competencies: draft } : null;
  const divergent = liveForm ? divergentCompetencies(liveForm) : [];
  const divergentIds = new Set(divergent.map((d) => d.competencyId));

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Reviews" description="Loading review cycles…" />
        <Skeleton className="h-[460px]" />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="Reviews"
        description="Performance cycles across Stellar. The review form puts self, manager and peer side by side so the comparison is the first thing you read."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/reviews/calibration">
              <Grid3x3 /> Calibration
            </Link>
          </Button>
        }
      />

      <StatRow cols={4}>
        <StatTile label="Active cycle" value={ACTIVE_CYCLE.kind} icon={Award} hint={ACTIVE_CYCLE.name} tone="accent" />
        <StatTile label="Participants" value={num(ACTIVE_CYCLE.participants)} icon={Users} />
        <StatTile
          label="Completion"
          value={pct(ACTIVE_CYCLE.completionPct, 0)}
          icon={Check}
          tone={ACTIVE_CYCLE.completionPct >= 80 ? "good" : "warning"}
          hint={`Window closes ${fmtDate(ACTIVE_CYCLE.windowEnd)}`}
        />
        <StatTile
          label="Divergent competencies"
          value={num(divergent.length)}
          icon={TriangleAlert}
          tone={divergent.length > 0 ? "warning" : "neutral"}
          hint="Self and manager differ by 2+ points"
        />
      </StatRow>

      {/* ------------------------------------------------------ cycle list */}
      <Section title="Review cycles" description="Select a cycle to load its forms." bodyClassName="p-0">
        <ul>
          {REVIEW_CYCLES.map((c) => {
            const active = c.id === cycleId;
            return (
              <li key={c.id} className="border-b border-border last:border-0">
                <button
                  type="button"
                  onClick={() => {
                    setCycleId(c.id);
                    setFormId(null);
                  }}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full flex-wrap items-center gap-4 px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    active ? "bg-primary-soft/50" : "hover:bg-muted/60",
                  )}
                >
                  <div className="min-w-[220px] flex-1">
                    <p className="flex items-center gap-1.5 text-xs font-medium">
                      {c.name}
                      <Badge variant="muted">{c.kind}</Badge>
                    </p>
                    <p className="tnum mt-0.5 text-[11px] text-muted-foreground">
                      {fmtDate(c.windowStart)} – {fmtDate(c.windowEnd)} · {num(c.participants)}{" "}
                      participants · owner {employeeName(c.ownerCode)}
                    </p>
                  </div>

                  <div className="min-w-[260px] flex-1">
                    <ShareBar
                      segments={c.stages.map((s, i) => ({
                        key: s.stage,
                        label: s.label,
                        value: s.completed,
                        status: (["good", "warning", "serious", "critical", "good"] as const)[i],
                      }))}
                      total={c.stages.reduce((a, b) => a + b.total, 0)}
                      valueFormat={(v) => num(v)}
                      height={6}
                    />
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <span className="tnum text-right">
                      <span className="block text-xs font-semibold">{pct(c.completionPct, 0)}</span>
                      <span className="block text-[10px] text-muted-foreground">complete</span>
                    </span>
                    <StatusBadge status={c.status} />
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* ----------------------------------------------------- the form */}
      {!liveForm ? (
        <EmptyState
          icon={Award}
          title="No review form in this cycle"
          description="This cycle has not opened yet, or no form has been assigned to you."
        />
      ) : (
        <Section
          title="Review form"
          description={`${cycle.name} · rate each competency on the 1–5 scale. Self, manager and peer sit side by side.`}
          actions={
            <>
              <Select value={liveForm.id} onValueChange={setFormId}>
                <SelectTrigger size="sm" className="w-[230px]" aria-label="Review subject">
                  <span className="truncate text-xs">
                    {employeeName(liveForm.employeeCode)} · {liveForm.employeeCode}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {availableForms.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {employeeName(f.employeeCode)} · {f.employeeCode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Gated menuKey="growth.reviews" action="E">
                <Button
                  size="sm"
                  disabled={!dirty}
                  onClick={() => {
                    setDirty(false);
                    mockAction("Review saved", {
                      description: `${employeeName(liveForm.employeeCode)} · ${cycle.name}. The employee is notified when you submit.`,
                    });
                  }}
                >
                  <Save /> Save draft
                </Button>
              </Gated>
            </>
          }
          bodyClassName="p-0"
        >
          {/* subject header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-subtle px-4 py-3">
            <div className="flex items-center gap-3">
              <Avatar name={employeeName(liveForm.employeeCode)} size={36} />
              <div>
                <p className="text-sm font-semibold">{employeeName(liveForm.employeeCode)}</p>
                <p className="text-xs text-muted-foreground">
                  {employeeByCode(liveForm.employeeCode)?.designation} · reviewed by{" "}
                  {employeeName(liveForm.managerCode)} · {liveForm.peerCodes.length} peer
                  {liveForm.peerCodes.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {COLUMNS.map((c) => {
                const r = overallRating(liveForm, c.id);
                return (
                  <div key={c.id} className="text-right">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{c.label}</p>
                    <p className="tnum text-sm font-semibold">{r.toFixed(2)}</p>
                  </div>
                );
              })}
              <StatusBadge status={liveForm.status} size="md" />
            </div>
          </div>

          {divergent.length > 0 && (
            <div className="border-b border-border px-4 py-2.5">
              <Alert tone="warning" icon={TriangleAlert} title={`${divergent.length} competency gap${divergent.length === 1 ? "" : "s"} to discuss`}>
                Self and manager differ by 2 or more points on:{" "}
                {divergent
                  .map((d) => COMPETENCIES.find((c) => c.id === d.competencyId)?.name)
                  .join(", ")}
                . These are the conversations worth having in the review meeting.
              </Alert>
            </div>
          )}

          {/* the three-column table */}
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-subtle">
                <tr className="border-b border-border">
                  <th scope="col" className="min-w-[220px] px-4 py-2 text-left font-medium text-muted-foreground">
                    Competency
                  </th>
                  {COLUMNS.map((c) => (
                    <th key={c.id} scope="col" className="min-w-[220px] px-3 py-2 text-left font-medium text-muted-foreground">
                      <Hint text={c.blurb}>
                        <span className="inline-flex items-center gap-1">
                          {c.label}
                          <Info className="size-3 opacity-60" aria-hidden />
                        </span>
                      </Hint>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {draft.map((cr) => {
                  const comp = COMPETENCIES.find((c) => c.id === cr.competencyId)!;
                  const flagged = divergentIds.has(cr.competencyId);
                  return (
                    <tr
                      key={cr.competencyId}
                      className={cn("border-b border-border last:border-0", flagged && "bg-warning-soft/30")}
                    >
                      <th scope="row" className="px-4 py-3 text-left align-top font-normal">
                        <p className="flex items-center gap-1.5 text-xs font-medium">
                          {comp.name}
                          {flagged && (
                            <Hint text="Self and manager differ by 2 or more points">
                              <TriangleAlert className="size-3 text-warning-fg" aria-hidden />
                            </Hint>
                          )}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                          {comp.description}
                        </p>
                        <Badge variant="muted" className="mt-1.5">
                          Weight {comp.weight}%
                        </Badge>
                      </th>

                      {COLUMNS.map((col) => {
                        const value = cr[col.id];
                        const comment = cr[`${col.id}Comment` as keyof CompetencyReview] as string;
                        const editable = col.id !== "peer";
                        return (
                          <td key={col.id} className="px-3 py-3 align-top">
                            <div className="flex gap-1" role="radiogroup" aria-label={`${comp.name} — ${col.label} rating`}>
                              {RATING_SCALE.map((a) => {
                                const on = Math.round(value) === a.value;
                                return (
                                  <Hint key={a.value} text={a.label}>
                                    <button
                                      type="button"
                                      role="radio"
                                      aria-checked={on}
                                      aria-label={`${col.label} — ${a.label}`}
                                      disabled={!editable}
                                      onClick={() => editable && setRating(cr.competencyId, col.id, a.value)}
                                      className={cn(
                                        "tnum flex size-6 items-center justify-center rounded border text-[11px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                                        on
                                          ? "border-primary bg-primary text-primary-foreground"
                                          : "border-border bg-card text-muted-foreground",
                                        editable ? "hover:border-primary/50" : "cursor-not-allowed opacity-70",
                                      )}
                                    >
                                      {a.value}
                                    </button>
                                  </Hint>
                                );
                              })}
                            </div>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {ratingAnchor(value).short}
                              {col.id === "peer" && ` · avg ${value.toFixed(1)}`}
                            </p>
                            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                              {comment}
                            </p>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* summaries */}
          <div className="grid gap-4 border-t border-border p-4 lg:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Self summary
              </p>
              <p className="mt-1.5 rounded-md border border-border bg-subtle p-2.5 text-xs leading-relaxed">
                {liveForm.selfSummary}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Manager summary
              </p>
              <Textarea
                value={summary}
                onChange={(e) => {
                  setSummary(e.target.value);
                  setDirty(true);
                }}
                className="mt-1.5 min-h-[92px] text-xs leading-relaxed"
                aria-label="Manager summary"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-border bg-subtle px-4 py-3">
            <div className="min-w-[200px] flex-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Proposed overall rating
              </p>
              <p className="text-sm font-semibold">
                {overallRating(liveForm, "manager").toFixed(2)} —{" "}
                {ratingAnchor(overallRating(liveForm, "manager")).short}
              </p>
              <Progress
                value={(overallRating(liveForm, "manager") / 5) * 100}
                className="mt-1.5"
                aria-label="Proposed rating"
              />
            </div>
            <Gated menuKey="growth.reviews" action="A">
              <Button
                onClick={() =>
                  mockAction("Review submitted to calibration", {
                    description: `${employeeName(liveForm.employeeCode)} enters the 9-box at ${overallRating(liveForm, "manager").toFixed(2)}.`,
                  })
                }
              >
                <Check /> Submit to calibration
              </Button>
            </Gated>
          </div>
        </Section>
      )}

      {/* --------------------------------------------------- rating scale */}
      <Section title="Rating scale" description="The anchors every reviewer is asked to calibrate against.">
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {RATING_SCALE.map((a) => (
            <li key={a.value} className="rounded-md border border-border p-2.5">
              <p className="tnum text-xs font-semibold">{a.label}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{a.description}</p>
            </li>
          ))}
        </ol>
      </Section>
    </PageBody>
  );
}
