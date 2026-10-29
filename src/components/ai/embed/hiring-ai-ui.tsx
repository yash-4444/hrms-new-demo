"use client";

import * as React from "react";
import { Copy, ListPlus, RotateCcw, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Hint } from "@/components/ui/primitives";
import type { Candidate, Interview } from "@/mock/hiring";
import { AI_TONE, AiBadge, AiConfidence, AiExplainButton, AiFeedback, AiRichText } from "../ai-ui";
import { interviewQuestions, matchCandidate, summariseScorecards } from "./hiring-ai";

/* ============================================================================
   Hiring AI surfaces — match chip, match card, interview questions and the
   scorecard summary. Advisory only: the recruiter and the panel decide.
   ========================================================================== */

export const HIRING_AI_NOTE = "AI does not rank or reject candidates automatically";

/** The human-in-the-loop promise, shown on every hiring screen with AI on it. */
export function AiHiringNote({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-start gap-1.5 text-[11px] text-muted-foreground", className)}>
      <ShieldCheck className="mt-px size-3 shrink-0 text-success-fg" aria-hidden />
      <span>
        {HIRING_AI_NOTE}. Match scores are an explainable aid for the recruiter and panel — every move
        on the board is a human decision.
      </span>
    </p>
  );
}

/** Compact "✨ 82% match" chip for a board card. */
export function AiMatchChip({ candidate }: { candidate: Candidate }) {
  const m = React.useMemo(() => matchCandidate(candidate), [candidate]);
  return (
    <Hint
      text={`AI match to ${candidate.reqCode}: ${m.band} — ${m.matched.length} of ${m.profile.mustHave.length} must-have skills. Advisory only.`}
    >
      <span
        className={cn(
          "tnum inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
          AI_TONE.chip,
        )}
        aria-label={`AI match ${m.score} percent, ${m.band}`}
      >
        ✨ {m.score}% match
      </span>
    </Hint>
  );
}

/** Small label marking a value the resume parser extracted. */
export function ParsedFromResume({ className }: { className?: string }) {
  return (
    <Hint text="Extracted by the resume parser from the uploaded CV. Edit the profile if it is wrong.">
      <span className={cn("inline-flex", className)}>
        <AiBadge label="parsed from resume" className="px-1 py-0 text-[10px]" />
      </span>
    </Hint>
  );
}

/** Highlight wrapper for a parsed field. */
export const PARSED_FIELD = "rounded-md border border-dashed border-violet-300/70 bg-violet-50/50 px-1.5 py-1 dark:border-violet-400/30 dark:bg-violet-500/10";

/** Full match card for the candidate profile. */
export function AiMatchCard({ candidate }: { candidate: Candidate }) {
  const m = React.useMemo(() => matchCandidate(candidate), [candidate]);
  return (
    <Card className={cn("flex flex-col gap-3 p-4", AI_TONE.soft)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <AiBadge />
            <h2 className="text-sm font-semibold tracking-tight">Match to requisition</h2>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {candidate.reqCode} · must-haves {m.profile.mustHave.join(", ")} · {m.profile.experienceLabel}
          </p>
        </div>
        <div className="text-right">
          <p className={cn("tnum text-2xl font-semibold leading-none", AI_TONE.text)}>{m.score}%</p>
          <p className="mt-1 text-[11px] font-medium text-muted-foreground">{m.band} match</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-success-fg">Strengths</p>
          <ul className="mt-1 ml-4 list-disc space-y-0.5 text-xs text-foreground">
            {m.strengths.length ? m.strengths.map((s) => <li key={s}>{s}</li>) : <li>No clear strengths against the must-haves.</li>}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold text-warning-fg">Gaps to probe</p>
          <ul className="mt-1 ml-4 list-disc space-y-0.5 text-xs text-foreground">
            {m.gaps.length ? m.gaps.map((s) => <li key={s}>{s}</li>) : <li>No gaps against the requisition.</li>}
          </ul>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-violet-200/70 pt-2 dark:border-violet-400/20">
        <AiConfidence value={m.matched.length === m.profile.mustHave.length ? 88 : 72} />
        <AiExplainButton
          title="How the match is scored"
          summary="Weighted from the resume and the requisition. Protected attributes, name, photo and college are never used."
          drivers={m.drivers.map((d) => ({ label: `${d.label} · ${d.weight} pts`, detail: d.detail, weight: d.weight }))}
        />
      </div>
      <AiHiringNote />
    </Card>
  );
}

/** Five suggested questions aimed at the gaps. Add to the scorecard, copy, or dismiss. */
export function AiInterviewQuestions({ candidate }: { candidate: Candidate }) {
  const { can, why } = useApp();
  const canAdd = can("hiring.interviews", "E") || can("hiring.interviews", "C");
  const all = React.useMemo(() => interviewQuestions(candidate, matchCandidate(candidate)), [candidate]);
  const [hidden, setHidden] = React.useState<Set<number>>(new Set());
  const [added, setAdded] = React.useState<Set<number>>(new Set());
  const visible = all.map((q, i) => ({ ...q, i })).filter((q) => !hidden.has(q.i));

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      mockAction("Question copied", { description: text });
    } catch {
      mockAction("Copy the question manually", { description: text, tone: "info" });
    }
  };

  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <AiBadge />
          <h2 className="text-sm font-semibold tracking-tight">Suggested interview questions</h2>
        </div>
        {hidden.size > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setHidden(new Set())}>
            <RotateCcw aria-hidden /> Restore dismissed
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Aimed at the gaps first, then depth on claimed skills. AI suggestion — review before use; the
        panel decides what to ask.
      </p>
      {visible.length === 0 ? (
        <p className="text-xs text-muted-foreground">All suggestions dismissed.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {visible.map((q) => (
            <li key={q.i} className="rounded-md border border-border bg-card px-3 py-2">
              <p className="text-xs font-medium text-foreground">{q.q}</p>
              <p className={cn("mt-0.5 text-[11px]", AI_TONE.text)}>{q.why}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {canAdd ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={added.has(q.i)}
                    onClick={() => {
                      setAdded((s) => new Set(s).add(q.i));
                      mockAction("Added to the next round's scorecard", {
                        description: `The panel for ${candidate.name} will see this question as a prompt.`,
                        undo: () => setAdded((s) => { const n = new Set(s); n.delete(q.i); return n; }),
                      });
                    }}
                  >
                    <ListPlus aria-hidden /> {added.has(q.i) ? "Added" : "Add to scorecard"}
                  </Button>
                ) : (
                  <Hint text={why("hiring.interviews", "E")}>
                    <span className="inline-flex cursor-not-allowed">
                      <Button size="sm" variant="outline" disabled>
                        <ListPlus aria-hidden /> Add to scorecard
                      </Button>
                    </span>
                  </Hint>
                )}
                <Button size="sm" variant="ghost" onClick={() => copy(q.q)}>
                  <Copy aria-hidden /> Copy
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setHidden((s) => new Set(s).add(q.i))} aria-label="Dismiss this question">
                  <X aria-hidden /> Dismiss
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/** Neutral summary of the submitted scorecards. */
export function AiScorecardSummary({ interviews }: { interviews: Interview[] }) {
  const s = React.useMemo(() => summariseScorecards(interviews), [interviews]);
  return (
    <div className={cn("rounded-md border p-3", AI_TONE.soft)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <AiBadge />
          <p className="text-xs font-semibold text-foreground">Summary of scorecards</p>
        </div>
        {s && <AiConfidence value={s.cards >= 3 ? 86 : 70} />}
      </div>
      {s ? (
        <>
          <AiRichText text={s.text} className="mt-1.5 text-xs text-foreground" />
          {s.quotes.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {s.quotes.map((q) => (
                <li key={q.by + q.round} className="text-[11px] text-muted-foreground">
                  “{q.text}” — <span className="font-medium text-foreground">{q.by}</span>, {q.round}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              Summarised from the panel&apos;s own words. The hiring decision stays with the panel.
            </p>
            <AiFeedback onRate={(v) => mockAction(v === "up" ? "Thanks — marked helpful" : "Thanks — we'll improve this summary", { tone: "info" })} />
          </div>
        </>
      ) : (
        <p className="mt-1.5 text-xs text-muted-foreground">
          No scorecards submitted yet. A summary appears here once the first panel member submits.
        </p>
      )}
    </div>
  );
}
