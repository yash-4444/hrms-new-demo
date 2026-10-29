"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { BookOpen, Eye, FilePen, Plus, ShieldCheck, Sparkles, ThumbsUp } from "lucide-react";
import { fmtDate, num, pct } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import { KB_AI_DRAFT, KB_ARTICLES, KB_ARTICLE_CATEGORIES, KB_DRAFT_SOURCE_TICKETS, queueTicket, type KbArticle } from "@/mock/service";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, NumCell } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { FilterSelect } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { AI_TONE, AiSuggestionCard } from "@/components/ai";
import { KbArticleDialog, type KbArticleValues } from "@/components/service/kb-article-dialog";
import { KbArticleSheet } from "@/components/service/kb-article-sheet";

const helpful = (a: KbArticle) => (a.helpfulYes + a.helpfulNo ? (a.helpfulYes / (a.helpfulYes + a.helpfulNo)) * 100 : 0);
const toValues = (a: { title: string; category: KbArticle["category"]; summary: string; steps: string[] }): KbArticleValues => ({
  title: a.title, category: a.category, summary: a.summary, steps: a.steps.join("\n"),
});

export default function KnowledgeBasePage() {
  const loading = useFakeLoad();
  const { persona, can } = useApp();
  const [articles, setArticles] = React.useState<KbArticle[]>(KB_ARTICLES);
  const [category, setCategory] = React.useState("all");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [editor, setEditor] = React.useState<{ id: string | null; values: KbArticleValues | null; ai: boolean } | null>(null);
  const [aiShown, setAiShown] = React.useState(false);

  const canEdit = can("helpdesk.kb", "E");
  const visible = articles.filter((a) => (canEdit || a.status === "published") && (category === "all" || a.category === category));
  const published = articles.filter((a) => a.status === "published");
  const open = articles.find((a) => a.id === openId) ?? null;
  const votesYes = published.reduce((s, a) => s + a.helpfulYes, 0);
  const votesAll = published.reduce((s, a) => s + a.helpfulYes + a.helpfulNo, 0);

  const save = (v: KbArticleValues, ctx = editor) => {
    const steps = v.steps.split("\n").map((s) => s.trim()).filter(Boolean);
    const id = ctx?.id;
    if (id) {
      setArticles((as) => as.map((a) => {
        if (a.id !== id) return a;
        const next = `v${a.versions.length + 1}`;
        return { ...a, ...v, steps, updatedOn: DEMO_TODAY, versions: [{ version: next, date: DEMO_TODAY, author: persona.name, note: "Revised" }, ...a.versions] };
      }));
      mockAction("Article revised", { description: "A new version was saved." });
    } else {
      const newId = `KB-${1001 + articles.length}`;
      setArticles((as) => [{
        id: newId, ...v, steps, status: "draft", author: persona.name, updatedOn: DEMO_TODAY, views: 0, helpfulYes: 0, helpfulNo: 0, deflected: 0,
        sourceDocId: v.category === "IT" ? "kb-it" : v.category === "Leave" ? "kb-leave" : v.category === "Travel" ? "kb-travel" : "kb-handbook",
        versions: [{ version: "v1", date: DEMO_TODAY, author: persona.name, note: ctx?.ai ? "Drafted with AI from resolved tickets" : "First draft" }],
        search: `${newId} ${v.title} ${v.category} ${v.summary}`.toLowerCase(),
      }, ...as]);
      mockAction(`${newId} saved as draft`, { description: "Publish it when it has been reviewed." });
      setAiShown(false);
    }
  };

  const columns = React.useMemo<ColumnDef<KbArticle, unknown>[]>(
    () => [
      { accessorKey: "title", header: "Article", cell: ({ row }) => <span className="flex max-w-md flex-col"><span className="font-medium">{row.original.title}</span><span className="truncate text-[11px] text-muted-foreground">{row.original.summary}</span></span> },
      { accessorKey: "category", header: "Category", cell: ({ row }) => <Badge variant="muted">{row.original.category}</Badge> },
      { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status === "published" ? "active" : "draft"} label={row.original.status === "published" ? "Published" : undefined} /> },
      { accessorKey: "views", header: "Views", cell: ({ row }) => <NumCell>{num(row.original.views)}</NumCell> },
      { id: "helpful", header: "Helpful", accessorFn: helpful, cell: ({ row }) => <NumCell>{row.original.helpfulYes + row.original.helpfulNo ? pct(helpful(row.original), 0) : "—"}</NumCell> },
      { accessorKey: "deflected", header: "Deflected", cell: ({ row }) => <NumCell>{num(row.original.deflected)}</NumCell> },
      { accessorKey: "updatedOn", header: "Updated", cell: ({ row }) => <span className="tnum">{fmtDate(row.original.updatedOn)}</span> },
    ],
    [],
  );

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Knowledge base" description="Loading articles…" />
        <TableSkeleton />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="Knowledge base"
        description="Answers employees find on their own — every article is grounded in a policy, and every view that ends without a ticket counts as deflected."
        actions={
          <>
            <Gated menuKey="helpdesk.kb" action="C">
              <Button size="sm" variant="outline" className={AI_TONE.ring} onClick={() => setAiShown(true)}>
                <Sparkles className={AI_TONE.icon} /> Draft article from resolved tickets
              </Button>
            </Gated>
            <Gated menuKey="helpdesk.kb" action="C">
              <Button size="sm" onClick={() => setEditor({ id: null, values: null, ai: false })}>
                <Plus /> New article
              </Button>
            </Gated>
          </>
        }
      />

      <StatRow cols={4}>
        <StatTile label="Published articles" value={num(published.length)} icon={BookOpen} hint={canEdit ? `${articles.length - published.length} in draft` : undefined} />
        <StatTile label="Views" value={num(published.reduce((s, a) => s + a.views, 0))} icon={Eye} />
        <StatTile label="Tickets deflected" value={num(published.reduce((s, a) => s + a.deflected, 0))} icon={ShieldCheck} tone="good" hint="Answered without an agent" href={can("helpdesk.analytics") ? "/helpdesk/analytics" : undefined} />
        <StatTile label="Found helpful" value={pct(votesAll ? (votesYes / votesAll) * 100 : 0, 0)} icon={ThumbsUp} hint={`${num(votesAll)} votes`} />
      </StatRow>

      {aiShown && (
        <AiSuggestionCard
          title={`Draft: ${KB_AI_DRAFT.title}`}
          confidence={81}
          body={
            <div className="flex flex-col gap-1.5">
              <p>{KB_AI_DRAFT.summary}</p>
              <ol className="list-decimal pl-5">{KB_AI_DRAFT.steps.map((s) => <li key={s}>{s}</li>)}</ol>
              <p className="text-[11px] text-muted-foreground">
                Source tickets: {KB_DRAFT_SOURCE_TICKETS.map((id) => `${id} (${queueTicket(id)?.subject.slice(0, 32) ?? ""}…)`).slice(0, 4).join(", ")}
                {KB_DRAFT_SOURCE_TICKETS.length > 4 ? ` and ${KB_DRAFT_SOURCE_TICKETS.length - 4} more` : ""}
              </p>
            </div>
          }
          acceptLabel="Save as draft"
          onAccept={() => save(toValues(KB_AI_DRAFT), { id: null, values: null, ai: true })}
          onEdit={() => setEditor({ id: null, values: toValues(KB_AI_DRAFT), ai: true })}
          onDismiss={() => setAiShown(false)}
        />
      )}

      <DataTable
        columns={columns}
        data={visible}
        getRowId={(a) => a.id}
        searchKeys={["search"]}
        searchPlaceholder="Search articles…"
        exportName="knowledge-base"
        onRowClick={(a) => setOpenId(a.id)}
        filters={<FilterSelect label="Category" value={category} onValueChange={setCategory} allLabel="All" options={KB_ARTICLE_CATEGORIES.map((c) => ({ value: c, label: c }))} />}
        emptyIcon={FilePen}
        emptyTitle="No articles match"
        emptyDescription="Try another category or search term."
      />

      <KbArticleSheet
        article={open}
        onOpenChange={(o) => !o && setOpenId(null)}
        onVote={(a, yes) => {
          setArticles((as) => as.map((x) => (x.id === a.id ? { ...x, helpfulYes: x.helpfulYes + (yes ? 1 : 0), helpfulNo: x.helpfulNo + (yes ? 0 : 1) } : x)));
          mockAction("Thanks for the feedback", { tone: "info" });
        }}
        onPublish={(a) => {
          setArticles((as) => as.map((x) => (x.id === a.id ? { ...x, status: "published", updatedOn: DEMO_TODAY } : x)));
          mockAction(`${a.id} published`, { description: "Employees and Copilot can now use it." });
        }}
        onEdit={(a) => { setOpenId(null); setEditor({ id: a.id, values: toValues(a), ai: false }); }}
      />
      <KbArticleDialog
        key={editor ? `${editor.id ?? "new"}-${editor.ai}` : "closed"}
        open={!!editor}
        onOpenChange={(o) => !o && setEditor(null)}
        initial={editor?.values ?? null}
        fromAi={editor?.ai}
        onSave={(v) => save(v)}
      />
    </PageBody>
  );
}
