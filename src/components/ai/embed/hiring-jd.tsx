"use client";

import * as React from "react";
import { Check, Pencil, RotateCcw, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { mockAction } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/primitives";
import type { JobPosting } from "@/mock/hiring";
import { AI_TONE, AiDraftBanner } from "../ai-ui";
import { generateJd, jdToText, parseJd, type JdInput } from "./hiring-ai";

/* ============================================================================
   "✨ Write JD with AI" — the draft lands in an editable field with a banner;
   Accept keeps it, Edit focuses the field, Dismiss restores what was there.
   ========================================================================== */

/** Violet trigger button. */
export function WriteJdButton({
  onClick,
  label = "Write JD with AI",
  disabled,
  className,
}: {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={disabled}
      onClick={onClick}
      className={cn("gap-1.5 border-violet-300/70 text-violet-700 hover:bg-violet-50 dark:border-violet-400/30 dark:text-violet-200 dark:hover:bg-violet-500/15", className)}
    >
      <Sparkles aria-hidden /> {label}
    </Button>
  );
}

/** Banner + Accept / Edit / Dismiss shown above a field holding an AI draft. */
export function AiJdDraftBar({
  onAccept,
  onEdit,
  onDismiss,
  onRegenerate,
}: {
  onAccept: () => void;
  onEdit: () => void;
  onDismiss: () => void;
  onRegenerate?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <AiDraftBanner>
        AI draft from the requisition fields — review before use. Placeholders in [[brackets]] need a human;
        nothing is published until you save.
      </AiDraftBanner>
      <div className="flex flex-wrap gap-1.5">
        <Button type="button" size="sm" className={AI_TONE.solid} onClick={onAccept}>
          <Check aria-hidden /> Accept
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onEdit}>
          <Pencil aria-hidden /> Edit
        </Button>
        {onRegenerate && (
          <Button type="button" size="sm" variant="ghost" onClick={onRegenerate}>
            <RotateCcw aria-hidden /> Regenerate
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
          <X aria-hidden /> Dismiss
        </Button>
      </div>
    </div>
  );
}

/** Generates the JD text for a set of requisition fields. */
export function jdTextFor(input: JdInput, variant = 0) {
  const d = generateJd(input);
  // Regenerate rotates the responsibilities so the reviewer sees an alternative ordering.
  const k = variant % d.responsibilities.length;
  return jdToText({ ...d, responsibilities: [...d.responsibilities.slice(k), ...d.responsibilities.slice(0, k)] });
}

/** Posting-level rewrite panel for the job preview sheet. */
export function JobJdRewrite({
  job,
  canEdit,
  onApply,
}: {
  job: JobPosting;
  canEdit: boolean;
  onApply: (patch: Pick<JobPosting, "summary" | "responsibilities" | "requirements">) => void;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const [variant, setVariant] = React.useState(0);
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const input: JdInput = {
    role: job.title,
    departmentId: job.departmentId,
    branchId: job.branchId,
    experience: job.experience,
    workMode: job.workMode,
  };

  if (!draft) {
    return (
      <div className={cn("flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2", AI_TONE.soft)}>
        <p className="text-xs text-foreground">Refresh this posting&apos;s copy from the requisition with an AI draft.</p>
        <WriteJdButton
          label="Rewrite JD with AI"
          disabled={!canEdit}
          onClick={() => {
            setVariant(0);
            setDraft(jdTextFor(input, 0));
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <AiJdDraftBar
        onAccept={() => {
          const before = { summary: job.summary, responsibilities: job.responsibilities, requirements: job.requirements };
          const parsed = parseJd(draft);
          onApply({
            summary: parsed.summary || job.summary,
            responsibilities: parsed.responsibilities.length ? parsed.responsibilities : job.responsibilities,
            requirements: parsed.requirements.length ? parsed.requirements : job.requirements,
          });
          setDraft(null);
          mockAction("Posting copy updated from the AI draft", {
            description: `${job.title} — reviewed and accepted by you.`,
            undo: () => onApply(before),
          });
        }}
        onEdit={() => ref.current?.focus()}
        onRegenerate={() => {
          const v = variant + 1;
          setVariant(v);
          setDraft(jdTextFor(input, v));
        }}
        onDismiss={() => setDraft(null)}
      />
      <label htmlFor={`jd-${job.id}`} className="sr-only">
        AI job description draft
      </label>
      <Textarea
        id={`jd-${job.id}`}
        ref={ref}
        rows={14}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="border-violet-300/70 font-mono text-xs dark:border-violet-400/30"
      />
    </div>
  );
}
