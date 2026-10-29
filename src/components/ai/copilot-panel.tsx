"use client";

import * as React from "react";
import Link from "next/link";
import { Maximize2, RotateCcw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/overlays";
import { Hint, Kbd } from "@/components/ui/primitives";
import { AI_TONE, AiBadge, AiGuardrailChips } from "./ai-ui";
import { CopilotThreadView, useCopilotThread, type CopilotThread } from "./copilot-chat";

/* ============================================================================
   Copilot slide-over + launcher + provider.
   The provider owns the open state, the ⌘J / Ctrl+J shortcut and the panel's
   conversation, so the thread survives closing and re-opening the panel.
   ========================================================================== */

interface CopilotCtx {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  /** Opens the panel and asks a question straight away. */
  ask: (question: string) => void;
  thread: CopilotThread;
}

const Ctx = React.createContext<CopilotCtx | null>(null);

/** Returns the copilot context, or null outside a CopilotProvider. */
export function useCopilot() {
  return React.useContext(Ctx);
}

/**
 * Mount once inside AppStateProvider. Renders the slide-over panel and binds
 * ⌘J / Ctrl+J. Children can open it via `useCopilot()` or `<CopilotLauncher />`.
 */
export function CopilotProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const thread = useCopilotThread();
  const { can } = useApp();
  const allowed = can("ai.copilot", "V");

  React.useEffect(() => {
    if (!allowed) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [allowed]);

  const { send } = thread;
  const value = React.useMemo<CopilotCtx>(
    () => ({
      open,
      setOpen,
      toggle: () => setOpen((v) => !v),
      ask: (q: string) => {
        setOpen(true);
        send(q);
      },
      thread,
    }),
    [open, thread, send],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {allowed && <CopilotPanel open={open} onOpenChange={setOpen} thread={thread} />}
    </Ctx.Provider>
  );
}

/**
 * Slide-over copilot. Uses the same engine and thread view as /ai/copilot.
 * Pass `thread` to share a conversation; otherwise it keeps its own.
 */
export function CopilotPanel({
  open,
  onOpenChange,
  thread: external,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  thread?: CopilotThread;
}) {
  const own = useCopilotThread();
  const thread = external ?? own;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent width="sm:max-w-[480px]" className="p-0" aria-describedby="copilot-panel-desc">
        <div className="flex flex-col gap-2 border-b border-border px-4 py-3 pr-12">
          <div className="flex items-center gap-2">
            <div className={cn("flex size-7 items-center justify-center rounded-full border", AI_TONE.chip)} aria-hidden>
              <Sparkles className="size-3.5" />
            </div>
            <SheetTitle className="text-sm">HR Copilot</SheetTitle>
            <AiBadge />
            <div className="ml-auto flex items-center gap-1">
              <Hint text="New conversation">
                <Button size="icon-sm" variant="ghost" aria-label="New conversation" onClick={() => thread.reset()} disabled={!thread.messages.length}>
                  <RotateCcw aria-hidden />
                </Button>
              </Hint>
              <Hint text="Open full page">
                <Button size="icon-sm" variant="ghost" aria-label="Open Copilot full page" asChild>
                  <Link href="/ai/copilot" onClick={() => onOpenChange(false)}>
                    <Maximize2 aria-hidden />
                  </Link>
                </Button>
              </Hint>
            </div>
          </div>
          <SheetDescription id="copilot-panel-desc" className="sr-only">
            Ask questions about leave, pay, attendance, policies and your team.
          </SheetDescription>
          <AiGuardrailChips />
        </div>
        <CopilotThreadView thread={thread} compact autoFocus={open} />
      </SheetContent>
    </Sheet>
  );
}

/**
 * Top-bar button with a ⌘J hint. Inside a CopilotProvider it toggles the
 * shared panel; on its own it manages a private panel.
 */
export function CopilotLauncher({ className }: { className?: string }) {
  const ctx = useCopilot();
  const { can } = useApp();
  const [localOpen, setLocalOpen] = React.useState(false);
  if (!can("ai.copilot", "V")) return null;
  const open = ctx ? ctx.open : localOpen;
  const setOpen = ctx ? ctx.setOpen : setLocalOpen;
  return (
    <>
      <Hint
        text={
          <span className="flex items-center gap-1.5">
            Ask HR Copilot <Kbd>⌘J</Kbd>
          </span>
        }
      >
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-1.5 border-violet-300/70 text-violet-700 hover:bg-violet-50 dark:border-violet-400/30 dark:text-violet-200 dark:hover:bg-violet-500/15", className)}
          onClick={() => setOpen(!open)}
          aria-label="Open HR Copilot (Ctrl+J)"
          aria-expanded={open}
        >
          <Sparkles aria-hidden />
          <span className="hidden sm:inline">Copilot</span>
          <Kbd className="hidden md:inline-flex">⌘J</Kbd>
        </Button>
      </Hint>
      {!ctx && <CopilotPanel open={localOpen} onOpenChange={setLocalOpen} />}
    </>
  );
}
