"use client";

import * as React from "react";
import { ArrowRight, Check, Loader2, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { KB_DOCUMENTS, kbConfidence, searchKnowledge, type KbHit } from "@/mock/ai";
import { KB_ARTICLES, type KbArticle } from "@/mock/service-kb";
import type { TicketCategory } from "@/mock/workplace";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/primitives";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/overlays";
import { AI_TONE, AiBadge, AiCitation, AiConfidence, AiFeedback } from "@/components/ai";
import type { TicketPrefill } from "@/components/workplace/raise-ticket-dialog";

/* ============================================================================
   Helpdesk deflection — before a ticket is raised, the AI looks for an answer
   in the published help articles and the indexed policy documents and cites
   them. "Yes, that answered it" closes without a ticket; "No" carries the
   question into the ticket form. The AI never closes or routes a ticket.
   ========================================================================== */

const EXAMPLES = [
  "VPN keeps dropping on office Wi-Fi",
  "When will my expense reimbursement be paid?",
  "How much earned leave carries forward?",
  "Hotel limit for a Mumbai trip",
];

const ARTICLE_COUNT = KB_ARTICLES.filter((a) => a.status === "published").length;
const DOC_COUNT = KB_DOCUMENTS.filter((d) => d.status === "indexed").length;

const STOP = new Set(["the", "a", "an", "is", "my", "i", "to", "of", "on", "in", "for", "how", "what", "when", "will", "be", "do", "does", "can", "and", "keeps", "much"]);

function searchArticles(q: string): KbArticle[] {
  const words = q.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
  if (!words.length) return [];
  return KB_ARTICLES.filter((a) => a.status === "published")
    .map((a) => {
      const hay = `${a.search} ${a.steps.join(" ")}`.toLowerCase();
      return { a, score: words.filter((w) => hay.includes(w.length > 5 ? w.slice(0, -1) : w)).length };
    })
    .filter((x) => x.score >= Math.min(2, words.length))
    .sort((x, y) => y.score - x.score)
    .slice(0, 2)
    .map((x) => x.a);
}

const ARTICLE_TO_TICKET: Record<KbArticle["category"], TicketCategory> = {
  Leave: "HR",
  Payroll: "Payroll",
  Tax: "Payroll",
  Benefits: "HR",
  IT: "IT",
  Travel: "HR",
};

function guessCategory(q: string, article?: KbArticle): TicketCategory {
  const s = q.toLowerCase();
  if (/access|password|login|permission|sso|mfa/.test(s)) return "Access";
  if (/chair|desk|ac\b|parking|canteen|cab pickup|washroom|light/.test(s)) return "Facilities";
  if (article) return ARTICLE_TO_TICKET[article.category];
  if (/salary|payslip|tds|tax|pf|reimburse/.test(s)) return "Payroll";
  if (/laptop|vpn|wifi|wi-fi|email|software|printer/.test(s)) return "IT";
  return "HR";
}

interface Answer {
  question: string;
  articles: KbArticle[];
  hits: KbHit[];
  confidence: number;
}

export function HelpdeskDeflectDialog({
  open,
  onOpenChange,
  onContinue,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Continue to the ticket form with the question carried over. */
  onContinue: (prefill: TicketPrefill) => void;
}) {
  const { can } = useApp();
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [answer, setAnswer] = React.useState<Answer | null>(null);

  /* A fresh question every time the dialog opens (adjusting state during render). */
  const [wasOpen, setWasOpen] = React.useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setQ("");
      setAnswer(null);
      setBusy(false);
    }
  }

  const ask = (text: string) => {
    const question = text.trim();
    if (question.length < 4) return;
    setBusy(true);
    window.setTimeout(() => {
      const articles = searchArticles(question);
      const hits = searchKnowledge(question, 2);
      const confidence = articles.length ? Math.max(kbConfidence(hits), 78 + articles.length * 6) : kbConfidence(hits);
      setAnswer({ question, articles, hits, confidence: Math.min(96, confidence) });
      setBusy(false);
    }, 700);
  };

  const proceed = () => {
    const question = answer?.question ?? q.trim();
    const subject = question.length >= 8 ? question.slice(0, 90) : `Help needed: ${question}`;
    onContinue({
      subject,
      category: guessCategory(question, answer?.articles[0]),
      description: question.length >= 15 ? question : "",
    });
  };

  const resolved = () => {
    mockAction("Glad that helped — no ticket raised", {
      description: "Logged as a self-service answer. You can still raise a ticket any time.",
    });
    onOpenChange(false);
  };

  const articleHref = (a: KbArticle) => (can("helpdesk.kb", "V") ? `/helpdesk/kb?article=${a.id}` : undefined);
  const docHref = (id: string) => (can("ai.knowledge", "V") ? `/ai/knowledge?doc=${id}` : undefined);
  const found = !!answer && (answer.articles.length > 0 || answer.hits.length > 0);
  const top = answer?.articles[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Raise a request <AiBadge label="AI answers first" />
          </DialogTitle>
          <DialogDescription>
            Describe the problem. AI checks the help articles and policies for an answer before a ticket is created.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(q);
            }}
            className="flex flex-col gap-2"
          >
            <Field label="What do you need help with?" htmlFor="hd-ask">
              <Textarea id="hd-ask" rows={2} value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. VPN drops every 20 minutes on the Pune office Wi-Fi" />
            </Field>
            <div className="flex flex-wrap items-center gap-1.5">
              {EXAMPLES.map((x) => (
                <button
                  key={x}
                  type="button"
                  onClick={() => {
                    setQ(x);
                    ask(x);
                  }}
                  className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {x}
                </button>
              ))}
              <Button type="submit" size="sm" className={cn("ml-auto", AI_TONE.solid)} disabled={busy || q.trim().length < 4}>
                {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />}
                ✨ Check for an answer
              </Button>
            </div>
          </form>

          <div aria-live="polite">
            {busy && <p className="text-xs text-muted-foreground">Searching {ARTICLE_COUNT} help articles and {DOC_COUNT} policy documents…</p>}
            {answer && !busy && (
              <div className={cn("flex flex-col gap-2 rounded-md border p-3", AI_TONE.soft)}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-semibold">
                    <Sparkles className={cn("size-3.5", AI_TONE.icon)} aria-hidden /> Suggested answer
                  </span>
                  <AiConfidence value={found ? answer.confidence : 0} />
                </div>
                {found ? (
                  <>
                    <p className="text-xs text-foreground">{top ? top.summary : answer.hits[0].passage.text}</p>
                    {top && (
                      <ol className="ml-4 list-decimal space-y-0.5 text-xs text-foreground/90">
                        {top.steps.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ol>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {answer.articles.map((a, i) => (
                        <AiCitation key={a.id} index={i + 1} docTitle={`${a.id} · ${a.title}`} href={articleHref(a)} />
                      ))}
                      {answer.hits.map((h, i) => (
                        <AiCitation
                          key={h.passage.id}
                          index={answer.articles.length + i + 1}
                          docTitle={h.doc.title}
                          section={h.passage.section}
                          page={h.passage.page}
                          href={docHref(h.doc.id)}
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-violet-200/70 pt-2 dark:border-violet-400/20">
                      <span className="text-[11px] text-muted-foreground">AI answer grounded in the cited sources — check them.</span>
                      <AiFeedback />
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No help article or policy covers this. Raise a ticket and the right team picks it up.
                  </p>
                )}
              </div>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          {found ? (
            <>
              <span className="mr-auto self-center text-xs font-medium">Did this answer your question?</span>
              <Button variant="outline" onClick={proceed}>
                No, raise a ticket <ArrowRight aria-hidden />
              </Button>
              <Button onClick={resolved}>
                <Check aria-hidden /> Yes, that solved it
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={proceed}>
                {answer ? "Raise a ticket" : "Skip — raise a ticket"} <ArrowRight aria-hidden />
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
