"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookOpen,
  Check,
  Info,
  Pencil,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";
import { Hint } from "@/components/ui/primitives";

/* ============================================================================
   AI building blocks. One violet accent, used ONLY for AI-originated content,
   so a viewer can always tell what the machine said from what a person did.
   ========================================================================== */

/** Shared violet accent classes — chips, borders, soft surfaces. */
export const AI_TONE = {
  chip: "border-violet-300/70 bg-violet-50 text-violet-700 dark:border-violet-400/30 dark:bg-violet-500/15 dark:text-violet-200",
  soft: "border-violet-200 bg-violet-50/60 dark:border-violet-400/25 dark:bg-violet-500/10",
  text: "text-violet-700 dark:text-violet-300",
  solid: "bg-violet-600 text-white hover:bg-violet-600/90 dark:bg-violet-500 dark:hover:bg-violet-500/90",
  ring: "focus-visible:ring-violet-500",
  icon: "text-violet-600 dark:text-violet-300",
} as const;

/* -------------------------------------------------------------- AiBadge */

/** Violet "✨ AI" chip. Put it beside any title or value that a model produced. */
export function AiBadge({ label = "AI", className }: { label?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        AI_TONE.chip,
        className,
      )}
    >
      <Sparkles className="size-3" aria-hidden />
      {label}
    </span>
  );
}

/* ------------------------------------------------------- AiDraftBanner */

/** Banner stating that the content below is an AI draft and needs human review. */
export function AiDraftBanner({
  children = "AI draft — review before sending. Placeholders are highlighted; nothing is sent until you approve it.",
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex items-start gap-2 rounded-md border px-3 py-2 text-xs", AI_TONE.soft, className)}
      role="note"
    >
      <Sparkles className={cn("mt-0.5 size-3.5 shrink-0", AI_TONE.icon)} aria-hidden />
      <p className="text-foreground">{children}</p>
    </div>
  );
}

/* ---------------------------------------------------------- AiCitation */

/** Inline source chip that links to the cited passage in the knowledge base. */
export function AiCitation({
  index,
  docTitle,
  section,
  page,
  href,
  className,
}: {
  index?: number;
  docTitle: string;
  section?: string;
  page?: number;
  href?: string;
  className?: string;
}) {
  const label = (
    <>
      {index !== undefined && (
        <span className={cn("tnum font-semibold", AI_TONE.text)}>[{index}]</span>
      )}
      <BookOpen className="size-3 shrink-0 text-muted-foreground" aria-hidden />
      <span className="truncate">
        {docTitle}
        {section ? ` · ${section}` : ""}
        {page ? ` · p.${page}` : ""}
      </span>
    </>
  );
  const cls = cn(
    "inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] text-foreground transition-colors",
    href && "hover:border-violet-300 hover:bg-violet-50 dark:hover:border-violet-400/40 dark:hover:bg-violet-500/10",
    className,
  );
  return href ? (
    <Link href={href} className={cls}>
      {label}
    </Link>
  ) : (
    <span className={cls}>{label}</span>
  );
}

/* ---------------------------------------------------- confidence meter */

/** Small 5-segment confidence indicator with a text label (never colour alone). */
export function AiConfidence({ value, className }: { value: number; className?: string }) {
  const label = value >= 85 ? "High" : value >= 65 ? "Medium" : value > 0 ? "Low" : "None";
  const filled = Math.round(value / 20);
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px] text-muted-foreground", className)}>
      <span className="flex gap-0.5" aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-2 w-1.5 rounded-[2px]",
              i < filled ? "bg-violet-500 dark:bg-violet-400" : "bg-muted",
            )}
          />
        ))}
      </span>
      <span>
        Confidence <span className="font-medium text-foreground">{label}</span>
        <span className="tnum"> · {value}%</span>
      </span>
    </span>
  );
}

/* ------------------------------------------------------ AiExplainButton */

export interface ExplainDriver {
  label: string;
  detail?: string;
  /** Relative contribution, any scale — drawn as a bar. */
  weight?: number;
}

/** "Why?" popover listing the drivers behind a number or flag. */
export function AiExplainButton({
  title = "Why this score?",
  summary,
  drivers,
  footnote = "Explainable signal only — never used for automated decisions.",
  label = "Why?",
  className,
}: {
  title?: string;
  summary?: React.ReactNode;
  drivers: ExplainDriver[];
  footnote?: React.ReactNode;
  label?: string;
  className?: string;
}) {
  const max = Math.max(1, ...drivers.map((d) => d.weight ?? 0));
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium outline-none focus-visible:ring-2",
            AI_TONE.chip,
            AI_TONE.ring,
            className,
          )}
        >
          <Sparkles className="size-3" aria-hidden />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="border-b border-border px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold">{title}</p>
            <AiBadge />
          </div>
          {summary && <p className="mt-1 text-xs text-muted-foreground">{summary}</p>}
        </div>
        <ol className="flex flex-col gap-2.5 px-3 py-2.5">
          {drivers.map((d, i) => (
            <li key={d.label} className="text-xs">
              <div className="flex items-start gap-2">
                <span className={cn("tnum mt-px font-semibold", AI_TONE.text)}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{d.label}</p>
                  {d.detail && <p className="mt-0.5 text-muted-foreground">{d.detail}</p>}
                  {d.weight !== undefined && (
                    <div className="mt-1 h-1 w-full rounded-full bg-muted" aria-hidden>
                      <div
                        className="h-1 rounded-full bg-violet-500 dark:bg-violet-400"
                        style={{ width: `${Math.round(((d.weight ?? 0) / max) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
        {footnote && (
          <p className="flex items-start gap-1.5 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="mt-px size-3 shrink-0" aria-hidden />
            {footnote}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* -------------------------------------------------------- AiConfirmCard */

export interface ConfirmField {
  label: string;
  value: React.ReactNode;
}

/**
 * Proposed write action. The assistant never writes on its own — this card
 * shows exactly what will be created, and only Confirm performs it.
 */
export function AiConfirmCard({
  title,
  description,
  fields,
  warnings,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  state = "pending",
  disabled,
  disabledReason,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  fields: ConfirmField[];
  warnings?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  state?: "pending" | "confirmed" | "cancelled";
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-md border border-violet-200 bg-card dark:border-violet-400/25", className)}>
      <div className="flex items-start justify-between gap-2 border-b border-border bg-violet-50/60 px-3 py-2 dark:bg-violet-500/10">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">{title}</p>
          {description && <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>}
        </div>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Proposed action
        </span>
      </div>
      <dl className="grid grid-cols-[minmax(96px,auto)_1fr] gap-x-3 gap-y-1.5 px-3 py-2.5 text-xs">
        {fields.map((f) => (
          <React.Fragment key={f.label}>
            <dt className="text-muted-foreground">{f.label}</dt>
            <dd className="min-w-0 font-medium text-foreground">{f.value}</dd>
          </React.Fragment>
        ))}
      </dl>
      {warnings && warnings.length > 0 && (
        <ul className="mx-3 mb-2.5 flex flex-col gap-1 rounded-md border border-warning/30 bg-warning-soft px-2.5 py-1.5 text-[11px] text-warning-fg">
          {warnings.map((w) => (
            <li key={w} className="flex items-start gap-1.5">
              <Info className="mt-px size-3 shrink-0" aria-hidden />
              {w}
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-end gap-1.5 border-t border-border px-3 py-2">
        {state === "pending" ? (
          <>
            <Button size="sm" variant="ghost" onClick={onCancel}>
              <X aria-hidden />
              {cancelLabel}
            </Button>
            {disabled ? (
              <Hint text={disabledReason}>
                <span className="inline-flex cursor-not-allowed">
                  <Button size="sm" disabled>
                    <Check aria-hidden />
                    {confirmLabel}
                  </Button>
                </span>
              </Hint>
            ) : (
              <Button size="sm" className={AI_TONE.solid} onClick={onConfirm}>
                <Check aria-hidden />
                {confirmLabel}
              </Button>
            )}
          </>
        ) : (
          <p
            className={cn(
              "flex items-center gap-1 text-xs font-medium",
              state === "confirmed" ? "text-success-fg" : "text-muted-foreground",
            )}
            role="status"
          >
            {state === "confirmed" ? <Check className="size-3.5" aria-hidden /> : <X className="size-3.5" aria-hidden />}
            {state === "confirmed" ? "Confirmed — done." : "Cancelled — nothing was changed."}
          </p>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------- AiSuggestionCard */

/** An AI suggestion with explicit Accept / Edit / Dismiss — the human always decides. */
export function AiSuggestionCard({
  title,
  body,
  confidence,
  onAccept,
  onEdit,
  onDismiss,
  acceptLabel = "Accept",
  className,
}: {
  title: string;
  body: React.ReactNode;
  confidence?: number;
  onAccept?: () => void;
  onEdit?: () => void;
  onDismiss?: () => void;
  acceptLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-md border p-3", AI_TONE.soft, className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <AiBadge />
          <p className="text-xs font-semibold text-foreground">{title}</p>
        </div>
        {confidence !== undefined && <AiConfidence value={confidence} />}
      </div>
      <div className="mt-1.5 text-xs text-foreground/90">{body}</div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">AI suggestion — review before use.</p>
      {(onAccept || onEdit || onDismiss) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {onAccept && (
            <Button size="sm" className={AI_TONE.solid} onClick={onAccept}>
              <Check aria-hidden />
              {acceptLabel}
            </Button>
          )}
          {onEdit && (
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Pencil aria-hidden />
              Edit
            </Button>
          )}
          {onDismiss && (
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              <X aria-hidden />
              Dismiss
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------- AiFeedback */

/** Thumbs up / down on an AI answer. */
export function AiFeedback({ onRate }: { onRate?: (v: "up" | "down") => void }) {
  const [v, setV] = React.useState<"up" | "down" | null>(null);
  const rate = (x: "up" | "down") => {
    setV(x);
    onRate?.(x);
  };
  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="Rate this answer">
      <button
        type="button"
        aria-pressed={v === "up"}
        aria-label="Helpful"
        onClick={() => rate("up")}
        className={cn(
          "rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring outline-none",
          v === "up" && "text-success-fg",
        )}
      >
        <ThumbsUp className="size-3.5" aria-hidden />
      </button>
      <button
        type="button"
        aria-pressed={v === "down"}
        aria-label="Not helpful"
        onClick={() => rate("down")}
        className={cn(
          "rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring outline-none",
          v === "down" && "text-destructive-fg",
        )}
      >
        <ThumbsDown className="size-3.5" aria-hidden />
      </button>
      {v && <span className="ml-1 text-[11px] text-muted-foreground">Thanks — feedback logged.</span>}
    </div>
  );
}

/* ------------------------------------------------ streaming + reduced motion */

/** True when the user prefers reduced motion — streaming then renders instantly. */
export function useReducedMotion() {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/**
 * Simulated token streaming. Reveals `text` a few characters at a time and
 * reports completion. With reduced motion, or `instant`, it completes at once.
 */
export function useStreamedText(text: string, { instant = false, speed = 3 }: { instant?: boolean; speed?: number } = {}) {
  const reduced = useReducedMotion();
  const skip = instant || reduced;
  const [progress, setProgress] = React.useState({ text, count: 0 });
  // A new text restarts the stream (adjusting state during render, not in an effect).
  if (progress.text !== text) setProgress({ text, count: 0 });

  React.useEffect(() => {
    if (skip) return;
    let n = 0;
    const id = setInterval(() => {
      // Emit roughly a "token" (word fragment) per tick.
      n = Math.min(text.length, n + speed + (n % 3));
      setProgress({ text, count: n });
      if (n >= text.length) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [text, skip, speed]);

  const count = skip ? text.length : progress.text === text ? progress.count : 0;
  return { shown: text.slice(0, count), done: count >= text.length };
}

/* --------------------------------------------------------- rich text */

/** Renders the tiny markup the engine emits: paragraphs, "- " bullets and **bold**. */
export function AiRichText({ text, className }: { text: string; className?: string }) {
  const blocks = text.split("\n");
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = (key: string) => {
    if (!list.length) return;
    out.push(
      <ul key={key} className="ml-4 list-disc space-y-0.5 marker:text-muted-foreground">
        {list.map((l, i) => (
          <li key={i}>{inline(l)}</li>
        ))}
      </ul>,
    );
    list = [];
  };
  blocks.forEach((b, i) => {
    if (b.startsWith("- ")) {
      list.push(b.slice(2));
      return;
    }
    flush(`l${i}`);
    if (b.trim()) out.push(<p key={i}>{inline(b)}</p>);
  });
  flush("end");
  return <div className={cn("flex flex-col gap-1.5", className)}>{out}</div>;
}

function inline(s: string) {
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-foreground">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
}

/* --------------------------------------------------- guardrail chips */

/** The three trust promises shown in every AI surface's header. */
export function AiGuardrailChips({ className }: { className?: string }) {
  const chips = [
    { label: "Respects your permissions", tip: "Answers only use data your role can already see." },
    { label: "Personal data redacted", tip: "PAN, Aadhaar, bank numbers and others' salaries are masked before reaching the model." },
    { label: "Actions need your confirmation", tip: "The assistant proposes; nothing is created until you press Confirm." },
  ];
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {chips.map((c) => (
        <Hint key={c.label} text={c.tip}>
          <span className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3 text-success-fg" aria-hidden />
            {c.label}
          </span>
        </Hint>
      ))}
    </div>
  );
}
