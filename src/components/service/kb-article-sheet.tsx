"use client";

import * as React from "react";
import { Eye, Pencil, Send, ShieldCheck, ThumbsDown, ThumbsUp } from "lucide-react";
import { fmtDate, num, pct } from "@/lib/format";
import { KB_DOCUMENTS } from "@/mock/ai";
import type { KbArticle } from "@/mock/service";
import { AiCitation } from "@/components/ai";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { Gated } from "@/components/shell/page";

/** Reader view of one article: steps, source policy, helpfulness vote, versions, publish. */
export function KbArticleSheet({
  article,
  onOpenChange,
  onVote,
  onPublish,
  onEdit,
}: {
  article: KbArticle | null;
  onOpenChange: (v: boolean) => void;
  onVote: (a: KbArticle, helpful: boolean) => void;
  onPublish: (a: KbArticle) => void;
  onEdit: (a: KbArticle) => void;
}) {
  const [voted, setVoted] = React.useState<Record<string, boolean>>({});
  const doc = article ? KB_DOCUMENTS.find((d) => d.id === article.sourceDocId) : undefined;
  const votes = article ? article.helpfulYes + article.helpfulNo : 0;

  return (
    <Sheet open={!!article} onOpenChange={onOpenChange}>
      <SheetContent width="sm:max-w-xl">
        {article && (
          <>
            <SheetHeader>
              <SheetTitle className="pr-6">{article.title}</SheetTitle>
              <SheetDescription asChild>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="muted">{article.category}</Badge>
                  <StatusBadge status={article.status === "published" ? "active" : "draft"} label={article.status === "published" ? "Published" : undefined} />
                  <span className="text-xs text-muted-foreground">
                    {article.id} · {article.versions[0]?.version} · updated {fmtDate(article.updatedOn)} by {article.author}
                  </span>
                </div>
              </SheetDescription>
            </SheetHeader>
            <SheetBody className="flex flex-col gap-4 overflow-y-auto text-sm">
              <p className="text-foreground">{article.summary}</p>
              <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-xs">
                {article.steps.map((s) => <li key={s}>{s}</li>)}
              </ol>
              {doc && (
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-medium text-muted-foreground">Source policy</p>
                  <AiCitation docTitle={doc.title} section={doc.version} href="/ai/knowledge" />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 rounded-md border border-border p-2.5 text-xs">
                <span className="flex items-center gap-1 text-muted-foreground"><Eye className="size-3.5" aria-hidden /> {num(article.views)} views</span>
                <span className="flex items-center gap-1 text-muted-foreground"><ShieldCheck className="size-3.5" aria-hidden /> {num(article.deflected)} tickets deflected</span>
                <span className="text-muted-foreground">{votes ? `${pct((article.helpfulYes / votes) * 100, 0)} found it helpful` : "No votes yet"}</span>
              </div>

              {article.status === "published" && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium">Was this helpful?</span>
                  {voted[article.id] === undefined ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => { setVoted((v) => ({ ...v, [article.id]: true })); onVote(article, true); }}><ThumbsUp /> Yes</Button>
                      <Button size="sm" variant="outline" onClick={() => { setVoted((v) => ({ ...v, [article.id]: false })); onVote(article, false); }}><ThumbsDown /> No</Button>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Thanks — your vote was recorded.</span>
                  )}
                </div>
              )}

              <div>
                <p className="mb-1.5 text-xs font-semibold">Versions</p>
                <ul className="flex flex-col divide-y divide-border rounded-md border border-border text-xs">
                  {article.versions.map((v) => (
                    <li key={v.version} className="flex items-start justify-between gap-2 px-2.5 py-1.5">
                      <span className="flex flex-col">
                        <span className="font-medium">{v.version} · {v.note}</span>
                        <span className="text-muted-foreground">{v.author}</span>
                      </span>
                      <span className="tnum text-muted-foreground">{fmtDate(v.date)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </SheetBody>
            <SheetFooter>
              <Gated menuKey="helpdesk.kb" action="E">
                <Button variant="outline" onClick={() => onEdit(article)}><Pencil /> Edit</Button>
              </Gated>
              {article.status === "draft" && (
                <Gated menuKey="helpdesk.kb" action="E">
                  <Button onClick={() => onPublish(article)}><Send /> Publish</Button>
                </Gated>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
