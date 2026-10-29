"use client";

/* Feedback wall card and the AI feedback summary. */

import * as React from "react";
import { EyeOff, Quote, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { summariseFeedback, type FeedbackItem, type ThemeSummary } from "@/mock/engage";
import { mockAction } from "@/components/app-state";
import { Card } from "@/components/ui/card";
import { Avatar, Badge, EmptyState } from "@/components/ui/primitives";
import { AiBadge, AiConfidence, AiExplainButton, AI_TONE } from "@/components/ai";
import { Button } from "@/components/ui/button";
import { nameOf, personLine } from "./kit";

export function FeedbackCard({ item, perspective }: { item: FeedbackItem; perspective: "received" | "given" }) {
  const otherCode = perspective === "received" ? item.fromCode : item.toCode;
  const hidden = perspective === "received" && item.anonymous;
  const name = hidden ? "Anonymous colleague" : nameOf(otherCode);
  return (
    <Card className="flex flex-col gap-2 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {hidden ? (
            <span className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <EyeOff className="size-3.5" aria-hidden />
            </span>
          ) : (
            <Avatar name={name} size={28} />
          )}
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">
              {perspective === "given" ? "To " : ""}
              {name}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {hidden ? "Identity hidden" : personLine(otherCode)} · {fmtDate(item.date)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          <Badge variant={item.kind === "praise" ? "soft" : "outline"}>{item.kind === "praise" ? "Praise" : "Constructive"}</Badge>
          {item.source === "360" && <Badge variant="muted">360</Badge>}
          {perspective === "given" && item.anonymous && <Badge variant="muted">Sent anonymously</Badge>}
        </div>
      </div>
      <p className="text-xs leading-relaxed text-foreground/90">{item.text}</p>
      <div className="flex flex-wrap gap-1">
        {item.themes.map((t) => (
          <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {t}
          </span>
        ))}
      </div>
    </Card>
  );
}

function ThemeRow({ t }: { t: ThemeSummary }) {
  return (
    <li className="rounded-md border border-border bg-card p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">{t.theme}</span>
        <span className="tnum text-[11px] text-muted-foreground">
          {t.evidence} mention{t.evidence === 1 ? "" : "s"}
        </span>
      </div>
      <p className="mt-1 flex gap-1 text-[11px] italic leading-relaxed text-muted-foreground">
        <Quote className="mt-0.5 size-3 shrink-0" aria-hidden />
        {t.quote}
      </p>
    </li>
  );
}

/** "✨ AI summary of feedback received this cycle" — strengths / development themes with evidence. */
export function FeedbackAiSummary({ items, cycleName }: { items: FeedbackItem[]; cycleName: string }) {
  const [dismissed, setDismissed] = React.useState(false);
  const themes = React.useMemo(() => summariseFeedback(items), [items]);
  const strengths = themes.filter((t) => t.kind === "strength");
  const development = themes.filter((t) => t.kind === "development");
  const confidence = Math.min(92, 48 + items.length * 4);

  if (dismissed) {
    return (
      <div className={cn("flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs", AI_TONE.soft)}>
        <span className="flex items-center gap-1.5">
          <AiBadge /> Summary dismissed for this session.
        </span>
        <Button size="sm" variant="ghost" onClick={() => setDismissed(false)}>
          Show again
        </Button>
      </div>
    );
  }

  if (items.length < 3) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Not enough feedback to summarise yet"
        description={`The AI summary needs at least 3 feedback items this cycle — you have ${items.length}. Request a 360 to gather more.`}
      />
    );
  }


  return (
    <section className={cn("rounded-md border p-3.5", AI_TONE.soft)} aria-labelledby="fb-ai-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <AiBadge />
          <h2 id="fb-ai-title" className="text-sm font-semibold">
            Summary of feedback received this cycle
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <AiConfidence value={confidence} />
          <AiExplainButton
            title="How this summary was built"
            summary={`${items.length} feedback items in ${cycleName}, grouped by the themes each one was tagged with.`}
            drivers={themes.map((t) => ({ label: t.theme, detail: `${t.evidence} item(s) · ${t.kind}`, weight: t.evidence }))}
            footnote="Summaries never include who said what for anonymous items, and are not used for ratings automatically."
          />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-success-fg">Strengths</h3>
          <ul className="flex flex-col gap-1.5">
            {strengths.map((t) => (
              <ThemeRow key={t.theme} t={t} />
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-warning-fg">Development themes</h3>
          <ul className="flex flex-col gap-1.5">
            {development.map((t) => (
              <ThemeRow key={t.theme} t={t} />
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">AI suggestion — review before use. Quotes are verbatim; counts are the number of items tagged with each theme.</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button
          size="sm"
          className={AI_TONE.solid}
          onClick={() =>
            mockAction("Summary added to your self-review draft", {
              description: "It lands in the Highlights field of your mid-year self review, where you can edit it.",
            })
          }
        >
          Add to self review
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
          Dismiss
        </Button>
      </div>
    </section>
  );
}
