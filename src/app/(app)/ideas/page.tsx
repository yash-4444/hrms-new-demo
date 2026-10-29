"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Lightbulb, MessageSquare, Plus, ThumbsUp, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, num } from "@/lib/format";
import { DEMO_NOW, DEMO_TODAY } from "@/mock/org";
import { IDEAS, IDEA_STATUS_LABEL, type Idea, type IdeaStatus } from "@/mock/engage";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, NumCell } from "@/components/data-table";
import { PersonCell } from "@/components/people/person-cell";
import { CardsSkeleton, Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/primitives";
import { FilterSelect } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { SubmitIdeaDialog, IDEA_CATEGORIES, type IdeaValues } from "@/components/engage/idea-dialog";
import { IDEA_BADGE, IdeaSheet } from "@/components/engage/idea-sheet";
import { nameOf } from "@/components/engage/kit";

const PIPELINE: IdeaStatus[] = ["new", "under_review", "accepted", "implemented", "declined"];

export default function IdeasPage() {
  const loading = useFakeLoad();
  const { persona } = useApp();
  const [ideas, setIdeas] = React.useState<Idea[]>(IDEAS);
  const [voted, setVoted] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState("all");
  const [category, setCategory] = React.useState("all");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [submitOpen, setSubmitOpen] = React.useState(false);

  const update = (id: string, fn: (i: Idea) => Idea) => setIdeas((is) => is.map((i) => (i.id === id ? fn(i) : i)));
  const toggleVote = (id: string) => {
    const has = voted.includes(id);
    setVoted((v) => (has ? v.filter((x) => x !== id) : [...v, id]));
    update(id, (i) => ({ ...i, votes: i.votes + (has ? -1 : 1) }));
  };

  const data = ideas.filter((i) => (status === "all" || i.status === status) && (category === "all" || i.category === category));
  const top = [...ideas].filter((i) => i.status !== "declined").sort((a, b) => b.votes - a.votes).slice(0, 3);
  const open = ideas.find((i) => i.id === openId) ?? null;

  const submit = (v: IdeaValues) => {
    const idea: Idea = {
      id: `IDEA-${String(88 + ideas.length - IDEAS.length).padStart(3, "0")}`,
      authorCode: persona.employeeId,
      title: v.title,
      body: v.body,
      category: v.category,
      status: "new",
      votes: 1,
      comments: [],
      submittedOn: DEMO_TODAY,
      decisionNote: null,
    };
    setIdeas((is) => [idea, ...is]);
    setVoted((vs) => [...vs, idea.id]);
    mockAction("Idea submitted", { description: "People Ops triages new ideas every Friday. Share it to gather votes." });
  };

  const changeStatus = (s: IdeaStatus, note?: string) => {
    if (!open) return;
    update(open.id, (i) => ({ ...i, status: s, decisionNote: note ?? i.decisionNote }));
    mockAction(`Idea moved to ${IDEA_STATUS_LABEL[s]}`, {
      description: `${nameOf(open.authorCode)} and ${num(open.votes)} voters were notified.`,
      tone: s === "declined" ? "warning" : "success",
    });
  };

  const columns: ColumnDef<Idea, unknown>[] = [
    {
      accessorKey: "title",
      header: "Idea",
      cell: ({ row }) => (
        <div className="flex max-w-md flex-col">
          <span className="font-medium">{row.original.title}</span>
          <span className="line-clamp-1 text-[11px] text-muted-foreground">{row.original.body}</span>
        </div>
      ),
    },
    { accessorKey: "authorCode", header: "Author", cell: ({ row }) => <PersonCell name={nameOf(row.original.authorCode)} code={row.original.authorCode} /> },
    { accessorKey: "category", header: "Category", cell: ({ row }) => <Badge variant="outline">{row.original.category}</Badge> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={IDEA_BADGE[row.original.status]} label={IDEA_STATUS_LABEL[row.original.status]} /> },
    { accessorKey: "submittedOn", header: "Submitted", cell: ({ row }) => <span className="text-xs">{fmtDate(row.original.submittedOn)}</span> },
    { id: "comments", header: "Comments", accessorFn: (i) => i.comments.length, cell: ({ row }) => <NumCell>{row.original.comments.length}</NumCell> },
    {
      accessorKey: "votes",
      header: "Votes",
      cell: ({ row }) => {
        const has = voted.includes(row.original.id);
        return (
          <button
            type="button"
            aria-pressed={has}
            aria-label={`${has ? "Remove vote from" : "Vote for"} ${row.original.title} — ${row.original.votes} votes`}
            onClick={(e) => {
              e.stopPropagation();
              toggleVote(row.original.id);
            }}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs",
              has ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border hover:bg-muted",
            )}
          >
            <ThumbsUp className="size-3.5" aria-hidden />
            <span className="tnum">{row.original.votes}</span>
          </button>
        );
      },
    },
  ];

  return (
    <PageBody>
      <PageHeader
        title="Idea Box"
        description="Suggest improvements to how we work, vote on the best ones, and see what happened to every idea."
        actions={
          <Gated menuKey="engage.ideas" action="C">
            <Button size="sm" onClick={() => setSubmitOpen(true)}>
              <Plus /> Submit idea
            </Button>
          </Gated>
        }
      />

      {loading ? (
        <>
          <CardsSkeleton count={5} height={64} />
          <TableSkeleton rows={6} />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="group" aria-label="Filter by status">
            {PIPELINE.map((s) => {
              const n = ideas.filter((i) => i.status === s).length;
              const active = status === s;
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStatus(active ? "all" : s)}
                  className={cn("rounded-md border border-border bg-card p-3 text-left transition-colors hover:bg-muted", active && "border-primary ring-1 ring-primary")}
                >
                  <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{IDEA_STATUS_LABEL[s]}</span>
                  <span className="tnum mt-0.5 block text-xl font-semibold">{n}</span>
                </button>
              );
            })}
          </div>

          <Section title="Top ideas" description="Most-voted ideas still in play" actions={<Trophy className="size-4 text-muted-foreground" aria-hidden />}>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {top.map((i, n) => (
                <Card key={i.id} className="flex cursor-pointer flex-col gap-1.5 p-3 hover:bg-muted/50" onClick={() => setOpenId(i.id)}>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="soft" className="tnum">#{n + 1}</Badge>
                    <StatusBadge status={IDEA_BADGE[i.status]} label={IDEA_STATUS_LABEL[i.status]} />
                  </div>
                  <button type="button" className="text-left text-sm font-semibold hover:underline" onClick={(e) => { e.stopPropagation(); setOpenId(i.id); }}>
                    {i.title}
                  </button>
                  <p className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><ThumbsUp className="size-3" aria-hidden /> {i.votes}</span>
                    <span className="flex items-center gap-1"><MessageSquare className="size-3" aria-hidden /> {i.comments.length}</span>
                    <span>{nameOf(i.authorCode)}</span>
                  </p>
                </Card>
              ))}
            </div>
          </Section>

          <DataTable
            columns={columns}
            data={data}
            searchKeys={["title", "body"]}
            searchPlaceholder="Search ideas…"
            filters={
              <>
                <FilterSelect label="Status" value={status} onValueChange={setStatus} options={PIPELINE.map((s) => ({ value: s, label: IDEA_STATUS_LABEL[s] }))} />
                <FilterSelect label="Category" value={category} onValueChange={setCategory} options={IDEA_CATEGORIES.map((c) => ({ value: c, label: c }))} />
              </>
            }
            onRowClick={(i) => setOpenId(i.id)}
            getRowId={(i) => i.id}
            exportName="idea-box"
            emptyIcon={Lightbulb}
            emptyTitle="No ideas match"
            emptyDescription="Clear the filters, or be the first to submit one in this category."
          />
        </>
      )}

      <SubmitIdeaDialog open={submitOpen} onOpenChange={setSubmitOpen} onSubmit={submit} />
      <IdeaSheet
        idea={open}
        voted={open ? voted.includes(open.id) : false}
        onOpenChange={(v) => !v && setOpenId(null)}
        onVote={() => open && toggleVote(open.id)}
        onComment={(text) => {
          if (!open) return;
          update(open.id, (i) => ({ ...i, comments: [...i.comments, { authorCode: persona.employeeId, text, at: DEMO_NOW }] }));
          mockAction("Comment added");
        }}
        onStatus={changeStatus}
      />
    </PageBody>
  );
}
