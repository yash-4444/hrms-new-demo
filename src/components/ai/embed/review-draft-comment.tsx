"use client";

import * as React from "react";
import { Check, Pencil, RefreshCw, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { mockAction } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/primitives";
import { AI_TONE, AiBadge, AiDraftBanner, AiExplainButton } from "@/components/ai";
import { goalsFor, type CompetencyReview, type ReviewForm } from "@/mock/growth";
import { draftManagerComment } from "./review-ai";

/* ============================================================================
   "✨ Draft comment" for the manager summary. Generates an editable AI draft
   from the live ratings and the reviewee's goals. Accept copies the (edited)
   draft into the manager summary — the manager still saves and submits.
   ========================================================================== */

export function ReviewDraftComment({
  form,
  draft,
  onAccept,
}: {
  form: ReviewForm;
  draft: CompetencyReview[];
  /** Receives the final, possibly edited text. */
  onAccept: (text: string) => void;
}) {
  const [text, setText] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);
  const goals = goalsFor(form.employeeCode);

  const generate = () => {
    setText(draftManagerComment(form, draft));
    setEditing(false);
  };

  if (text === null) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={cn("h-7 gap-1 border-violet-300/70 text-violet-700 hover:bg-violet-50 dark:border-violet-400/30 dark:text-violet-200 dark:hover:bg-violet-500/15", AI_TONE.ring)}
        onClick={generate}
      >
        <Sparkles aria-hidden /> Draft comment
      </Button>
    );
  }

  return (
    <div className={cn("mt-1 w-full basis-full rounded-md border p-2.5", AI_TONE.soft)} role="region" aria-label="AI draft manager comment">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <AiBadge label="AI draft" /> Manager summary
        </span>
        <AiExplainButton
          title="What the draft used"
          drivers={[
            { label: "Your manager ratings on this form", detail: "Highest two become strengths; the lowest becomes the development area.", weight: 3 },
            { label: `${goals.length} goal${goals.length === 1 ? "" : "s"} for FY 2026-27`, detail: "Progress and at-risk status from the goals module.", weight: 2 },
            { label: "Self vs manager gaps of 2+ points", detail: "Named so the meeting covers them.", weight: 1 },
          ]}
          footnote="A draft only — the rating is whatever you set on the scale."
        />
      </div>
      <AiDraftBanner className="mt-2">AI draft — edit it into your own words before you accept. Nothing is saved until you press Save draft.</AiDraftBanner>
      {editing ? (
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="mt-2 min-h-[110px] text-xs leading-relaxed"
          aria-label="Edit AI draft comment"
          autoFocus
        />
      ) : (
        <p className="mt-2 rounded-md border border-border bg-card p-2.5 text-xs leading-relaxed">{text}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          className={AI_TONE.solid}
          onClick={() => {
            onAccept(text);
            setText(null);
            mockAction("Draft copied into the manager summary", { description: "Review it, then Save draft." });
          }}
        >
          <Check /> Accept
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing((v) => !v)} aria-pressed={editing}>
          <Pencil /> {editing ? "Done editing" : "Edit"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={generate}>
          <RefreshCw /> Regenerate
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setText(null)}>
          <X /> Discard
        </Button>
      </div>
    </div>
  );
}
