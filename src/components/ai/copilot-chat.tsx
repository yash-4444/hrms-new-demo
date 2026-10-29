"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ArrowUp, Bot, Loader2, ShieldAlert, Sparkles, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { inrCompact, num, pct } from "@/lib/format";
import type { RoleId } from "@/lib/rbac";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Avatar, Kbd, Textarea } from "@/components/ui/primitives";
import { BarCompareChart, TrendLineChart } from "@/components/charts";
import {
  AI_TONE,
  AiBadge,
  AiCitation,
  AiConfidence,
  AiConfirmCard,
  AiExplainButton,
  AiFeedback,
  AiRichText,
  useStreamedText,
} from "./ai-ui";
import { respond, suggestedPrompts, type CopilotContext, type CopilotReply, type ReplyBlock } from "./engine";

/* ============================================================================
   Chat thread — shared by the /ai/copilot page and the slide-over panel.
   ========================================================================== */

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  reply?: CopilotReply;
  /** thinking → streaming → done. Restored conversations start at done. */
  status: "thinking" | "streaming" | "done";
}

export interface CopilotThread {
  messages: ChatMessage[];
  busy: boolean;
  send: (question: string) => void;
  stop: () => void;
  reset: (messages?: ChatMessage[]) => void;
  markDone: (id: string) => void;
  actionState: Record<string, "pending" | "confirmed" | "cancelled">;
  resolveAction: (key: string, state: "confirmed" | "cancelled") => void;
}

let seq = 0;
const nextId = (p: string) => `${p}-${++seq}`;

/** Builds a finished question/answer pair — used to restore past conversations. */
export function replayPair(question: string, ctx: CopilotContext): ChatMessage[] {
  return [
    { id: nextId("u"), role: "user", text: question, status: "done" },
    { id: nextId("a"), role: "assistant", text: "", reply: respond(question, ctx), status: "done" },
  ];
}

/** Holds one conversation. Resets automatically when the persona changes. */
export function useCopilotThread(): CopilotThread {
  const { role, persona, can } = useApp();
  const [state, setState] = React.useState<{ role: RoleId; messages: ChatMessage[] }>({ role, messages: [] });
  const [actionState, setActionState] = React.useState<CopilotThread["actionState"]>({});
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  if (state.role !== role) {
    setState({ role, messages: [] });
    setActionState({});
  }

  React.useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const send = React.useCallback(
    (question: string) => {
      const q = question.trim();
      if (!q) return;
      const reply = respond(q, { role, persona, can });
      const aid = nextId("a");
      setState((s) => ({
        role: s.role,
        messages: [
          ...s.messages,
          { id: nextId("u"), role: "user", text: q, status: "done" },
          { id: aid, role: "assistant", text: "", reply, status: "thinking" },
        ],
      }));
      timers.current.push(
        setTimeout(() => {
          setState((s) => ({
            ...s,
            messages: s.messages.map((m) => (m.id === aid && m.status === "thinking" ? { ...m, status: "streaming" } : m)),
          }));
        }, 550),
      );
    },
    [role, persona, can],
  );

  const markDone = React.useCallback((id: string) => {
    setState((s) => ({ ...s, messages: s.messages.map((m) => (m.id === id ? { ...m, status: "done" } : m)) }));
  }, []);

  const stop = React.useCallback(() => {
    setState((s) => ({ ...s, messages: s.messages.map((m) => (m.status !== "done" ? { ...m, status: "done" } : m)) }));
  }, []);

  const reset = React.useCallback(
    (messages: ChatMessage[] = []) => {
      timers.current.forEach(clearTimeout);
      setState({ role, messages });
      setActionState({});
    },
    [role],
  );

  const resolveAction = React.useCallback((key: string, s: "confirmed" | "cancelled") => {
    setActionState((a) => ({ ...a, [key]: s }));
  }, []);

  const busy = state.messages.some((m) => m.status !== "done");
  return { messages: state.messages, busy, send, stop, reset, markDone, actionState, resolveAction };
}

/* ------------------------------------------------------------ blocks */

const FMT = { num: (v: number) => num(v), inr: (v: number) => inrCompact(v), pct: (v: number) => pct(v) };

function BlockView({
  block,
  actionKey,
  thread,
}: {
  block: ReplyBlock;
  actionKey: string;
  thread: CopilotThread;
}) {
  const { can } = useApp();
  switch (block.kind) {
    case "table":
      return (
        <div className="overflow-hidden rounded-md border border-border bg-card">
          {block.title && <p className="border-b border-border bg-subtle px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground">{block.title}</p>}
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-subtle text-left">
                  {block.columns.map((c, i) => (
                    <th key={c + i} scope="col" className={cn("px-2.5 py-1.5 font-medium whitespace-nowrap text-muted-foreground", block.numeric?.includes(i) && "text-right")}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((r, ri) => (
                  <tr key={ri} className="border-b border-border last:border-0">
                    {r.map((cell, ci) => (
                      <td key={ci} className={cn("px-2.5 py-1.5 align-top", block.numeric?.includes(ci) && "tnum text-right whitespace-nowrap", ci === 0 && "font-medium")}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    case "chart": {
      const common = {
        title: block.title,
        description: block.description,
        data: block.data,
        xKey: block.xKey,
        series: block.series,
        valueFormat: FMT[block.format],
        height: 170,
      };
      return block.type === "line" ? <TrendLineChart {...common} /> : <BarCompareChart {...common} />;
    }
    case "citations":
      return (
        <div className={cn("rounded-md border p-2.5", AI_TONE.soft)}>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-muted-foreground">Sources</p>
            <AiConfidence value={block.confidence} />
          </div>
          <ol className="flex flex-col gap-1.5">
            {block.items.map((c, i) => (
              <li key={c.docId + c.section} className="flex flex-col gap-1">
                <AiCitation index={i + 1} docTitle={c.docTitle} section={c.section} page={c.page} href={`/ai/knowledge?doc=${c.docId}`} />
                {i === 0 && <blockquote className="border-l-2 border-violet-300 pl-2 text-[11px] text-muted-foreground dark:border-violet-400/50">{c.quote}</blockquote>}
              </li>
            ))}
          </ol>
        </div>
      );
    case "action": {
      const a = block.action;
      const state = thread.actionState[actionKey] ?? "pending";
      return (
        <AiConfirmCard
          title={a.title}
          description={a.description}
          fields={a.fields}
          warnings={a.warnings}
          confirmLabel={a.confirmLabel}
          state={state}
          disabled={!!a.blocked}
          disabledReason={a.blocked}
          onConfirm={() => {
            thread.resolveAction(actionKey, "confirmed");
            mockAction(a.successMessage, { description: a.successDescription });
          }}
          onCancel={() => thread.resolveAction(actionKey, "cancelled")}
        />
      );
    }
    case "links": {
      const items = block.items.filter((l) => can(l.menuKey, "V"));
      if (!items.length) return null;
      return (
        <div className="flex flex-wrap gap-1.5">
          {items.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              {l.label}
              <ArrowRight className="size-3" aria-hidden />
            </Link>
          ))}
        </div>
      );
    }
    case "explain":
      return (
        <div className="overflow-hidden rounded-md border border-border bg-card">
          <p className="border-b border-border bg-subtle px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground">{block.title}</p>
          <ul>
            {block.rows.map((r) => (
              <li key={r.code} className="flex items-center gap-2 border-b border-border px-2.5 py-1.5 text-xs last:border-0">
                <Avatar name={r.name} size={22} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{r.drivers[0]?.label ?? "No strong drivers"}</p>
                </div>
                <span
                  className={cn(
                    "tnum rounded-md border px-1.5 py-0.5 text-[11px] font-semibold",
                    r.band === "High"
                      ? "border-destructive/25 bg-destructive-soft text-destructive-fg"
                      : r.band === "Medium"
                        ? "border-warning/30 bg-warning-soft text-warning-fg"
                        : "border-success/25 bg-success-soft text-success-fg",
                  )}
                >
                  {r.score} · {r.band}
                </span>
                <AiExplainButton title={`Why ${r.name} scores ${r.score}`} drivers={r.drivers} />
              </li>
            ))}
          </ul>
        </div>
      );
  }
}

/* ------------------------------------------------------------ messages */

function AssistantMessage({
  message,
  thread,
  onFollowUp,
}: {
  message: ChatMessage;
  thread: CopilotThread;
  onFollowUp: (q: string) => void;
}) {
  const reply = message.reply!;
  const streaming = message.status === "streaming";
  const { shown, done } = useStreamedText(message.status === "thinking" ? "" : reply.text, {
    instant: message.status === "done",
  });
  const finished = message.status === "done" || (streaming && done);
  const { markDone } = thread;

  React.useEffect(() => {
    if (streaming && done) markDone(message.id);
  }, [streaming, done, markDone, message.id]);

  return (
    <div className="flex gap-2.5">
      <div className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border", AI_TONE.chip)} aria-hidden>
        <Sparkles className="size-3.5" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">HR Copilot</span>
          <AiBadge />
          {reply.refusal && (
            <span className="inline-flex items-center gap-1 rounded-md border border-warning/30 bg-warning-soft px-1.5 py-0.5 text-[11px] font-medium text-warning-fg">
              <ShieldAlert className="size-3" aria-hidden />
              Outside your access
            </span>
          )}
        </div>
        {message.status === "thinking" ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
            {reply.tools.length ? `Checking ${reply.tools.slice(0, 3).join(" · ")}…` : "Thinking…"}
          </p>
        ) : (
          <div className="text-[13px] leading-relaxed text-foreground" aria-busy={!finished}>
            <AiRichText text={finished ? reply.text : shown} />
            {!finished && <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-violet-500 align-middle motion-reduce:animate-none" aria-hidden />}
          </div>
        )}
        {finished && (
          <>
            {reply.blocks.map((b, i) => (
              <BlockView key={i} block={b} actionKey={`${message.id}:${i}`} thread={thread} />
            ))}
            {reply.basedOn && (
              <p className="text-[11px] text-muted-foreground">
                Based on: <span className="font-medium text-foreground">{reply.basedOn}</span>
              </p>
            )}
            {reply.followUps && reply.followUps.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {reply.followUps.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => onFollowUp(f)}
                    className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2", AI_TONE.chip, AI_TONE.ring, "hover:bg-violet-100 dark:hover:bg-violet-500/25")}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-1.5">
              <p className="text-[11px] text-muted-foreground">
                {reply.tools.length ? (
                  <>
                    Used: <span className="text-foreground">{reply.tools.join(" · ")}</span>
                  </>
                ) : (
                  "No data sources used"
                )}
              </p>
              <AiFeedback
                onRate={(v) =>
                  mockAction(v === "up" ? "Thanks for the feedback" : "Feedback recorded", {
                    description: v === "up" ? "Helpful answers improve the evaluation score." : "This answer is queued for review by the AI admin.",
                    tone: "info",
                  })
                }
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function UserMessage({ message }: { message: ChatMessage }) {
  const { persona } = useApp();
  return (
    <div className="flex justify-end gap-2.5">
      <div className="max-w-[85%] rounded-lg rounded-tr-sm bg-primary px-3 py-2 text-[13px] whitespace-pre-wrap text-primary-foreground">{message.text}</div>
      <Avatar name={persona.name} size={28} />
    </div>
  );
}

/* ------------------------------------------------------------ thread view */

/** Renders a conversation with composer, starter prompts and an aria-live announcer. */
export function CopilotThreadView({
  thread,
  compact,
  className,
  autoFocus,
}: {
  thread: CopilotThread;
  compact?: boolean;
  className?: string;
  autoFocus?: boolean;
}) {
  const { role, persona } = useApp();
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const prompts = suggestedPrompts(role);

  const last = thread.messages[thread.messages.length - 1];
  const announce = last?.role === "assistant" && last.status === "done" ? last.reply?.text.replace(/\*\*/g, "") ?? "" : "";

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  });

  React.useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const submit = (q: string) => {
    if (!q.trim() || thread.busy) return;
    thread.send(q);
    setDraft("");
    inputRef.current?.focus();
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div ref={scrollRef} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        {thread.messages.length === 0 ? (
          <div className={cn("flex flex-col items-center px-4 text-center", compact ? "py-6" : "py-12")}>
            <div className={cn("flex size-10 items-center justify-center rounded-full border", AI_TONE.chip)}>
              <Bot className="size-5" aria-hidden />
            </div>
            <p className="mt-3 text-sm font-semibold">Hi {persona.shortName}, how can I help?</p>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">
              Ask about leave, pay, attendance, policies or your team. I answer only from data your role can see, cite my sources, and ask before I change anything.
            </p>
            <div className={cn("mt-4 grid w-full gap-1.5", compact ? "grid-cols-1" : "max-w-2xl grid-cols-1 sm:grid-cols-2")}>
              {prompts.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => submit(p)}
                  className="group flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-left text-xs text-foreground outline-none transition-colors hover:border-violet-300 hover:bg-violet-50/60 focus-visible:ring-2 focus-visible:ring-violet-500 dark:hover:border-violet-400/40 dark:hover:bg-violet-500/10"
                >
                  {p}
                  <ArrowRight className="size-3 shrink-0 text-muted-foreground group-hover:text-violet-600 dark:group-hover:text-violet-300" aria-hidden />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={cn("flex flex-col gap-5", compact ? "p-3" : "mx-auto max-w-3xl p-4")} role="log" aria-label="Conversation">
            {thread.messages.map((m) =>
              m.role === "user" ? <UserMessage key={m.id} message={m} /> : <AssistantMessage key={m.id} message={m} thread={thread} onFollowUp={submit} />,
            )}
          </div>
        )}
      </div>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </div>

      <form
        className={cn("border-t border-border bg-card", compact ? "p-2.5" : "p-3")}
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
      >
        <div className={cn("mx-auto flex items-end gap-2 rounded-lg border border-input bg-background p-1.5 focus-within:ring-2 focus-within:ring-violet-500/60", !compact && "max-w-3xl")}>
          <label htmlFor={compact ? "copilot-input-panel" : "copilot-input"} className="sr-only">
            Ask the HR Copilot
          </label>
          <Textarea
            id={compact ? "copilot-input-panel" : "copilot-input"}
            ref={inputRef}
            value={draft}
            rows={1}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit(draft);
              }
            }}
            placeholder="Ask anything about leave, pay, policies, your team…"
            className="max-h-32 min-h-8 flex-1 resize-none border-0 bg-transparent px-1.5 py-1 shadow-none focus-visible:ring-0"
          />
          {thread.busy ? (
            <Button type="button" size="icon-sm" variant="outline" onClick={thread.stop} aria-label="Stop generating">
              <Square aria-hidden />
            </Button>
          ) : (
            <Button type="submit" size="icon-sm" className={AI_TONE.solid} disabled={!draft.trim()} aria-label="Send">
              <ArrowUp aria-hidden />
            </Button>
          )}
        </div>
        <p className={cn("mx-auto mt-1.5 flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground", !compact && "max-w-3xl")}>
          <span>
            <Kbd>Enter</Kbd> send · <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> new line
          </span>
          <span className="ml-auto">AI answers can be wrong — check the cited source before acting.</span>
        </p>
      </form>
    </div>
  );
}
