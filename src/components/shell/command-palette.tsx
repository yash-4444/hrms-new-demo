"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  ArrowRight,
  CalendarPlus,
  Clock,
  Moon,
  Sparkles,
  Sun,
  UserRoundCog,
} from "lucide-react";
import { useTheme } from "next-themes";
import { ALL_NAV_ITEMS, menuKeyForPath, navItemVisible } from "@/lib/nav";
import { PERSONAS } from "@/lib/rbac";
import { EMPLOYEES } from "@/mock/employees";
import { deptName } from "@/mock/org";
import { useApp, mockAction } from "@/components/app-state";
import { AI_TONE } from "@/components/ai/ai-ui";
import { useCopilot } from "@/components/ai/copilot-panel";
import { Avatar, Kbd } from "@/components/ui/primitives";
import { Dialog, DialogContent } from "@/components/ui/overlays";

/** Cheap fuzzy score: subsequence match, prefix and word-start weighted. */
function score(text: string, q: string) {
  const t = text.toLowerCase();
  const query = q.toLowerCase();
  if (!query) return 1;
  if (t.startsWith(query)) return 1000;
  const idx = t.indexOf(query);
  if (idx >= 0) return 800 - idx;
  let ti = 0;
  let hits = 0;
  for (const ch of query) {
    const found = t.indexOf(ch, ti);
    if (found < 0) return 0;
    if (found === 0 || t[found - 1] === " ") hits += 3;
    hits += 1;
    ti = found + 1;
  }
  return hits;
}

export function CommandPalette() {
  const { commandOpen, setCommandOpen, can, setRole, punchedIn, punchIn, punchOut } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const routeKey = menuKeyForPath(pathname);
  const canExportView = routeKey ? can(routeKey, "X") : false;
  const { setTheme, theme } = useTheme();
  const [query, setQuery] = React.useState("");
  const copilot = useCopilot();
  const question = query.trim();
  const canAsk = can("ai.copilot", "V") && question.length > 0;
  /* A sentence or a question reads as something to ask, so it leads the list. */
  const askFirst = canAsk && (/\s/.test(question) || question.endsWith("?"));

  const askCopilot = () => {
    setCommandOpen(false);
    if (copilot) copilot.ask(question);
    else router.push(`/ai/ask?q=${encodeURIComponent(question)}`);
  };

  React.useEffect(() => {
    if (!commandOpen) setQuery("");
  }, [commandOpen]);

  const go = (href: string) => {
    setCommandOpen(false);
    router.push(href);
  };

  const screens = React.useMemo(
    () =>
      ALL_NAV_ITEMS.filter((i) => navItemVisible(i, can))
        .map((i) => ({ ...i, s: score(i.label, query) }))
        .filter((i) => i.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 7),
    [query, can],
  );

  const people = React.useMemo(() => {
    if (query.trim().length < 2) return EMPLOYEES.slice(0, 5);
    return EMPLOYEES.map((e) => ({
      e,
      s: Math.max(score(e.name, query), score(e.code, query), score(e.designation, query) * 0.6),
    }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 6)
      .map((r) => r.e);
  }, [query]);

  const actions = React.useMemo(
    () =>
      [
        {
          id: "punch",
          label: punchedIn ? "Punch out" : "Punch in",
          icon: Clock,
          run: () => {
            if (punchedIn) punchOut();
            else punchIn();
            setCommandOpen(false);
          },
        },
        {
          id: "apply-leave",
          label: "Apply for leave",
          icon: CalendarPlus,
          run: () => go("/leave?apply=1"),
        },
        {
          id: "theme",
          label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
          icon: theme === "dark" ? Sun : Moon,
          run: () => {
            setTheme(theme === "dark" ? "light" : "dark");
            setCommandOpen(false);
          },
        },
        ...(canExportView
          ? [
              {
                id: "export",
                label: "Export current view",
                icon: ArrowRight,
                run: () => {
                  mockAction("Export queued", { description: "The file is not written to disk in the demo." });
                  setCommandOpen(false);
                },
              },
            ]
          : []),
      ]
        .map((a) => ({ ...a, s: score(a.label, query) }))
        .filter((a) => a.s > 0)
        .sort((a, b) => b.s - a.s),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, punchedIn, theme, canExportView],
  );

  const personas = React.useMemo(
    () =>
      PERSONAS.map((p) => ({ p, s: Math.max(score(`view as ${p.name}`, query), score(p.role, query)) }))
        .filter((r) => r.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, query ? 4 : 0),
    [query],
  );

  return (
    <Dialog open={commandOpen} onOpenChange={setCommandOpen}>
      <DialogContent size="lg" className="top-[18%] translate-y-0 p-0" aria-label="Command palette">
        <Command shouldFilter={false} label="Global command palette" className="flex flex-col">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Command.Input
              value={query}
              onValueChange={setQuery}
              autoFocus
              placeholder="Search employees, screens and actions…"
              className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <Kbd>ESC</Kbd>
          </div>
          <Command.List className="scrollbar-thin max-h-[380px] overflow-y-auto p-1.5">
            <Command.Empty className="px-3 py-8 text-center text-xs text-muted-foreground">
              Nothing matches “{query}”. Try an employee name, a code like STL-0142, or a screen.
            </Command.Empty>

            {askFirst && <AskGroup question={question} onAsk={askCopilot} />}

            {screens.length > 0 && (
              <Command.Group heading="Screens" className="mb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground">
                {screens.map((s) => (
                  <Command.Item
                    key={s.href}
                    value={s.href}
                    onSelect={() => go(s.href)}
                    className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs data-[selected=true]:bg-muted"
                  >
                    <s.icon className="size-3.5 text-muted-foreground" aria-hidden />
                    <span>{s.label}</span>
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">{s.href}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {people.length > 0 && (
              <Command.Group heading="People" className="mb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground">
                {people.map((e) => (
                  <Command.Item
                    key={e.code}
                    value={`p-${e.code}`}
                    onSelect={() => go(`/employees/${e.code}`)}
                    className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs data-[selected=true]:bg-muted"
                  >
                    <Avatar name={e.name} size={20} />
                    <span className="font-medium">{e.name}</span>
                    <span className="text-muted-foreground">
                      {e.designation} · {deptName(e.departmentId)}
                    </span>
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">{e.code}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {actions.length > 0 && (
              <Command.Group heading="Actions" className="mb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground">
                {actions.map((a) => (
                  <Command.Item
                    key={a.id}
                    value={`a-${a.id}`}
                    onSelect={a.run}
                    className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs data-[selected=true]:bg-muted"
                  >
                    <a.icon className="size-3.5 text-muted-foreground" aria-hidden />
                    {a.label}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {canAsk && !askFirst && <AskGroup question={question} onAsk={askCopilot} />}

            {personas.length > 0 && (
              <Command.Group heading="Switch persona" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground">
                {personas.map(({ p }) => (
                  <Command.Item
                    key={p.id}
                    value={`r-${p.id}`}
                    onSelect={() => {
                      setRole(p.id);
                      setCommandOpen(false);
                    }}
                    className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs data-[selected=true]:bg-muted"
                  >
                    <UserRoundCog className="size-3.5 text-muted-foreground" aria-hidden />
                    View as {p.name}
                    <span className="ml-auto text-[10px] text-muted-foreground">{p.role}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
          <div className="flex items-center gap-3 border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> navigate
            </span>
            <span className="flex items-center gap-1">
              <Kbd>↵</Kbd> open
            </span>
            <span className="ml-auto flex items-center gap-1">
              <Kbd>⌥1</Kbd>–<Kbd>⌥0</Kbd> switch persona
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

/** "Ask AI Copilot: <query>" — hands the typed text to the Copilot panel. */
function AskGroup({ question, onAsk }: { question: string; onAsk: () => void }) {
  return (
    <Command.Group heading="AI Copilot" className="mb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground">
      <Command.Item
        value="ai-ask"
        onSelect={onAsk}
        className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs data-[selected=true]:bg-violet-50 dark:data-[selected=true]:bg-violet-500/15"
      >
        <Sparkles className={`size-3.5 ${AI_TONE.icon}`} aria-hidden />
        <span className={`shrink-0 font-medium ${AI_TONE.text}`}>Ask AI Copilot:</span>
        <span className="truncate">{question}</span>
        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">answers use only data you can see</span>
      </Command.Item>
    </Command.Group>
  );
}
