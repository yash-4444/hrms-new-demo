"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, MessageSquareText, RotateCcw, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { menuKeyForPath } from "@/lib/nav";
import { DEMO_TODAY } from "@/mock/org";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Hint } from "@/components/ui/primitives";
import { AI_TONE, AiBadge, AiExplainButton, AiRichText } from "../ai-ui";
import { useCopilot } from "../copilot-panel";
import { briefingFor, type BriefingTone } from "./briefing-lines";

/* ============================================================================
   ✨ AI briefing — the top card on /dashboard.

   A few persona-specific lines computed from the module fixtures. Each one
   says why it is there, links to the screen that owns it (only when the
   persona may open that screen), and can be handed to the Copilot. Nothing
   here acts on its own; dismissing a line only hides it for this session.
   ========================================================================== */

const TONE_TILE: Record<BriefingTone, string> = {
  critical: "bg-destructive-soft text-destructive-fg",
  warning: "bg-warning-soft text-warning-fg",
  info: "bg-info-soft text-info-fg",
  good: "bg-success-soft text-success-fg",
};

const TONE_LABEL: Record<BriefingTone, string> = {
  critical: "Needs attention",
  warning: "Review soon",
  info: "For your information",
  good: "All good",
};

export function DashboardBriefing() {
  const { role, persona, can, exceptionCount } = useApp();
  const copilot = useCopilot();
  const canAsk = can("ai.copilot", "V") && copilot !== null;
  const [dismissed, setDismissed] = React.useState<{ role: string; ids: string[] }>({ role, ids: [] });
  // A persona switch starts a fresh briefing (adjusting state during render, not in an effect).
  if (dismissed.role !== role) setDismissed({ role, ids: [] });

  const lines = React.useMemo(
    () =>
      briefingFor({
        role,
        employeeId: persona.employeeId,
        name: persona.name,
        exceptionCount,
      }),
    [role, persona, exceptionCount],
  );
  const visible = lines.filter((l) => !dismissed.ids.includes(l.id));
  const canOpen = (href: string) => {
    const key = menuKeyForPath(href.split("?")[0]);
    return !key || can(key);
  };

  if (!lines.length) return null;

  const dismiss = (id: string, text: string) => {
    setDismissed((d) => ({ role: d.role, ids: [...d.ids, id] }));
    mockAction("Briefing item dismissed", {
      description: `${text.replace(/\*\*/g, "").slice(0, 72)}… — the AI will not resurface it today.`,
      tone: "info",
      undo: () => setDismissed((d) => ({ role: d.role, ids: d.ids.filter((x) => x !== id) })),
    });
  };

  return (
    <Card className={cn("overflow-hidden border", AI_TONE.soft)} aria-labelledby="ai-briefing-title">
      <div className="flex flex-wrap items-center gap-2 border-b border-violet-200/70 px-4 py-2.5 dark:border-violet-400/20">
        <span className={cn("flex size-6 items-center justify-center rounded-full border", AI_TONE.chip)} aria-hidden>
          <Sparkles className="size-3.5" />
        </span>
        <h2 id="ai-briefing-title" className="text-sm font-semibold tracking-tight">
          AI briefing
        </h2>
        <AiBadge />
        <span className="text-[11px] text-muted-foreground">
          {visible.length} of {lines.length} for {persona.shortName} · {fmtDate(DEMO_TODAY)}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <AiExplainButton
            label="Why am I seeing this?"
            title="How the briefing is built"
            summary={`Read from the modules your ${persona.role} role can see — nothing outside your permissions is summarised.`}
            drivers={lines.map((l) => ({ label: TONE_LABEL[l.tone], detail: l.text.replace(/\*\*/g, "") }))}
            footnote="Signals only — every action stays with you."
          />
          {dismissed.ids.length > 0 && (
            <Hint text="Show dismissed items">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Show dismissed briefing items"
                onClick={() => setDismissed({ role, ids: [] })}
              >
                <RotateCcw aria-hidden />
              </Button>
            </Hint>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="px-4 py-4 text-xs text-muted-foreground" role="status">
          You have cleared today&apos;s briefing. New signals appear here as the data changes.
        </p>
      ) : (
        <ul className="divide-y divide-violet-200/60 dark:divide-violet-400/15">
          {visible.map((l) => {
            const linkable = canOpen(l.href);
            return (
              <li key={l.id} className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-2.5">
                  <span
                    className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md", TONE_TILE[l.tone])}
                    aria-hidden
                  >
                    <l.icon className="size-3.5" />
                  </span>
                  <div className="min-w-0 text-xs text-foreground/90">
                    <span className="sr-only">{TONE_LABEL[l.tone]}: </span>
                    <AiRichText text={l.text} />
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5 pl-8 sm:pl-0">
                  <AiExplainButton
                    title="Why this item?"
                    drivers={l.why}
                    footnote="Computed from your module data — never used for automated decisions."
                  />
                  {canAsk && (
                    <button
                      type="button"
                      onClick={() => copilot?.ask(l.ask)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium outline-none focus-visible:ring-2",
                        AI_TONE.chip,
                        AI_TONE.ring,
                      )}
                      aria-label={`Ask Copilot: ${l.ask}`}
                    >
                      <MessageSquareText className="size-3" aria-hidden />
                      Ask Copilot
                    </button>
                  )}
                  {linkable && (
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" asChild>
                      <Link href={l.href}>
                        {l.linkLabel}
                        <ArrowRight aria-hidden />
                      </Link>
                    </Button>
                  )}
                  <Hint text="Dismiss for today">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="size-6"
                      aria-label={`Dismiss: ${l.text.replace(/\*\*/g, "")}`}
                      onClick={() => dismiss(l.id, l.text)}
                    >
                      <X aria-hidden />
                    </Button>
                  </Hint>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="border-t border-violet-200/70 px-4 py-1.5 text-[11px] text-muted-foreground dark:border-violet-400/20">
        AI briefing — generated from your data as of {fmtDate(DEMO_TODAY)}; review before acting. It suggests, you decide.
      </p>
    </Card>
  );
}
