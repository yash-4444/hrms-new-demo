"use client";

import * as React from "react";
import { MessageSquare, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateShort, fmtTime } from "@/lib/format";
import { CONVERSATION_SEEDS } from "@/mock/ai";
import { useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageBody, PageHeader } from "@/components/shell/page";
import { AI_TONE, AiBadge, AiGuardrailChips } from "@/components/ai/ai-ui";
import { CopilotThreadView, replayPair, useCopilotThread, type ChatMessage } from "@/components/ai/copilot-chat";
import { INTENT_CATALOG, titleFor } from "@/components/ai/engine";

interface HistoryItem {
  id: string;
  title: string;
  at: string | null;
  question: string | null;
  /** Saved messages of a conversation started this session. */
  messages?: ChatMessage[];
}

export default function CopilotPage() {
  const { role, persona, can } = useApp();
  const thread = useCopilotThread();
  const [activeId, setActiveId] = React.useState("new");
  const [session, setSession] = React.useState<{ role: string; items: HistoryItem[] }>({ role, items: [] });

  if (session.role !== role) {
    setSession({ role, items: [] });
    setActiveId("new");
  }

  const seeds: HistoryItem[] = (CONVERSATION_SEEDS[role] ?? []).map((s) => ({ id: s.id, title: s.title, at: s.at, question: s.firstQuestion }));
  const history = [...session.items, ...seeds];

  // First question of a fresh chat becomes a history entry.
  const first = thread.messages[0];
  if (activeId === "new" && first) {
    const id = `live-${first.id}`;
    setSession((s) => ({ ...s, items: [{ id, title: titleFor(first.text), at: null, question: null }, ...s.items] }));
    setActiveId(id);
  }

  const saveActive = () => {
    if (!activeId.startsWith("live-")) return;
    const saved = thread.messages.map((m) => ({ ...m, status: "done" as const }));
    setSession((s) => ({ ...s, items: s.items.map((i) => (i.id === activeId ? { ...i, messages: saved } : i)) }));
  };

  const openHistory = (h: HistoryItem) => {
    if (h.id === activeId) return;
    saveActive();
    setActiveId(h.id);
    if (h.messages) thread.reset(h.messages);
    else if (h.question) thread.reset(replayPair(h.question, { role, persona, can }));
  };

  const capabilities = INTENT_CATALOG.filter((i) => i.available({ role, persona, can }));

  return (
    <PageBody>
      <PageHeader
        title="AI Copilot"
        description="Ask in plain language. Answers come only from data your role can already see, cite their sources, and every change is proposed for your confirmation first."
        actions={<AiGuardrailChips />}
      />

      <Card className="grid h-[calc(100dvh-12rem)] min-h-[540px] grid-cols-1 overflow-hidden md:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)_250px]">
        {/* history */}
        <aside className="hidden min-h-0 flex-col border-r border-border md:flex" aria-label="Conversation history">
          <div className="border-b border-border p-2.5">
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                saveActive();
                setActiveId("new");
                thread.reset();
              }}
            >
              <Plus aria-hidden />
              New conversation
            </Button>
          </div>
          <nav className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-1.5">
            <p className="px-2 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Recent</p>
            {history.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">No conversations yet.</p>}
            <ul className="flex flex-col gap-0.5">
              {history.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => openHistory(h)}
                    aria-current={h.id === activeId ? "true" : undefined}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                      h.id === activeId ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <MessageSquare className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{h.title}</span>
                      <span className="block text-[10px] text-muted-foreground">{h.at ? `${fmtDateShort(h.at)} · ${fmtTime(h.at)}` : "Today · now"}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <p className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">Conversations are kept for 30 days, then purged. Every question is written to the AI audit log.</p>
        </aside>

        {/* chat */}
        <section className="flex min-h-0 flex-col" aria-label="Chat">
          <CopilotThreadView thread={thread} autoFocus />
        </section>

        {/* capabilities */}
        <aside className="hidden min-h-0 flex-col border-l border-border xl:flex" aria-label="What I can do">
          <div className="flex items-center gap-1.5 border-b border-border px-3 py-2.5">
            <Sparkles className={cn("size-3.5", AI_TONE.icon)} aria-hidden />
            <p className="text-xs font-semibold">What I can do for you</p>
          </div>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2">
            <p className="px-1 pb-2 text-[11px] text-muted-foreground">
              {capabilities.length} capabilities for <span className="font-medium text-foreground">{persona.role}</span>. Click one to try it.
            </p>
            <ul className="flex flex-col gap-1">
              {capabilities.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={thread.busy}
                    onClick={() => thread.send(c.example)}
                    className="w-full rounded-md border border-transparent px-2 py-1.5 text-left outline-none transition-colors hover:border-border hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <span className="flex items-center justify-between gap-1.5">
                      <span className="text-xs font-medium text-foreground">{c.label}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{c.module}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">“{c.example}”</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t border-border p-3">
            <div className="flex items-center gap-1.5">
              <AiBadge label="Guardrails" />
            </div>
            <ul className="mt-1.5 flex list-disc flex-col gap-0.5 pl-4 text-[11px] text-muted-foreground">
              <li>Scoped to {persona.role} grants</li>
              <li>PAN, Aadhaar, bank numbers masked</li>
              <li>Writes need your Confirm</li>
              <li>Unknown → says so, never guesses</li>
            </ul>
          </div>
        </aside>
      </Card>
    </PageBody>
  );
}
