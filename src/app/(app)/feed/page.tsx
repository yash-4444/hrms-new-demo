"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Flag, Megaphone, Newspaper, PenSquare, ShieldCheck } from "lucide-react";
import { fmtDateTime } from "@/lib/format";
import { DEMO_NOW } from "@/mock/org";
import { FEED_POSTS, type FeedPost, type ReactionKey } from "@/mock/engage";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable } from "@/components/data-table";
import { PersonCell } from "@/components/people/person-cell";
import { CardsSkeleton, Gated, PageBody, PageHeader, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { EmptyState, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { FeedPostCard } from "@/components/engage/feed-post";
import { ComposeDialog, type ComposeValues } from "@/components/engage/feed-compose";
import { nameOf } from "@/components/engage/kit";

export default function FeedPage() {
  const loading = useFakeLoad();
  const { persona, can } = useApp();
  const canModerate = can("engage.feed", "E");

  const [posts, setPosts] = React.useState<FeedPost[]>(FEED_POSTS);
  const [reactions, setReactions] = React.useState<Record<string, ReactionKey[]>>({});
  const [votes, setVotes] = React.useState<Record<string, string>>({});
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [hiding, setHiding] = React.useState<FeedPost | null>(null);

  const update = (id: string, fn: (p: FeedPost) => FeedPost) => setPosts((ps) => ps.map((p) => (p.id === id ? fn(p) : p)));

  const visible = React.useMemo(
    () =>
      posts
        .filter((p) => !p.hidden || canModerate)
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.at.localeCompare(a.at)),
    [posts, canModerate],
  );
  const queue = posts.filter((p) => p.flagged || p.hidden);

  const publish = (v: ComposeValues) => {
    const post: FeedPost = {
      id: `POST-${119 + posts.length - FEED_POSTS.length}`,
      authorCode: persona.employeeId,
      at: DEMO_NOW,
      text: v.text,
      image: null,
      poll: v.withPoll
        ? {
            question: v.question,
            closesOn: "2026-09-23",
            options: [v.optionA, v.optionB, v.optionC].filter(Boolean).map((label, i) => ({ id: `o${i}`, label, votes: 0 })),
          }
        : null,
      pinned: false,
      reactions: { like: 0, celebrate: 0, insightful: 0, support: 0 },
      comments: [],
      flagged: false,
      hidden: false,
      audience: v.audience,
    };
    setPosts((ps) => [post, ...ps]);
    mockAction("Posted to the feed", { description: `Visible to ${v.audience === "Everyone" ? "everyone" : v.audience}.` });
  };

  const toggleHide = (p: FeedPost) => {
    if (p.hidden) {
      update(p.id, (x) => ({ ...x, hidden: false, flagged: false }));
      mockAction("Post restored", { description: `${nameOf(p.authorCode)}'s post is visible again.` });
    } else setHiding(p);
  };

  const columns: ColumnDef<FeedPost, unknown>[] = [
      { accessorKey: "authorCode", header: "Author", cell: ({ row }) => <PersonCell name={nameOf(row.original.authorCode)} code={row.original.authorCode} /> },
      { accessorKey: "text", header: "Post", cell: ({ row }) => <span className="line-clamp-2 max-w-md text-xs">{row.original.text}</span> },
      { accessorKey: "at", header: "Posted", cell: ({ row }) => <span className="text-xs">{fmtDateTime(row.original.at)}</span> },
      {
        id: "state",
        header: "State",
        cell: ({ row }) => <StatusBadge status={row.original.hidden ? "on_hold" : "in_review"} label={row.original.hidden ? "Hidden" : "Flagged"} />,
      },
      {
        id: "__a",
        header: "",
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1.5">
            {!row.original.hidden && (
              <Button size="sm" variant="outline" onClick={() => { update(row.original.id, (x) => ({ ...x, flagged: false })); mockAction("Flag cleared", { description: "The post stays on the feed." }); }}>
                Keep
              </Button>
            )}
            <Button size="sm" variant={row.original.hidden ? "outline" : "destructive"} onClick={() => toggleHide(row.original)}>
              {row.original.hidden ? "Restore" : "Hide"}
            </Button>
          </div>
        ),
      },
  ];

  const feed = (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      {visible.length === 0 ? (
        <EmptyState icon={Newspaper} title="Nothing on the feed yet" description="Be the first to share an update with the company." />
      ) : (
        visible.map((p) => (
          <FeedPostCard
            key={p.id}
            post={p}
            myReactions={new Set(reactions[p.id] ?? [])}
            myVote={votes[p.id] ?? null}
            canModerate={canModerate}
            onReact={(key) =>
              setReactions((r) => {
                const cur = r[p.id] ?? [];
                return { ...r, [p.id]: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] };
              })
            }
            onVote={(optionId) => {
              setVotes((v) => ({ ...v, [p.id]: optionId }));
              update(p.id, (x) => ({ ...x, poll: x.poll && { ...x.poll, options: x.poll.options.map((o) => (o.id === optionId ? { ...o, votes: o.votes + 1 } : o)) } }));
              mockAction("Vote recorded");
            }}
            onComment={(text) => {
              update(p.id, (x) => ({ ...x, comments: [...x.comments, { id: `C-${x.comments.length + 1}-${p.id}`, authorCode: persona.employeeId, text, at: DEMO_NOW }] }));
              mockAction("Comment posted");
            }}
            onTogglePin={() => {
              update(p.id, (x) => ({ ...x, pinned: !x.pinned }));
              mockAction(p.pinned ? "Post unpinned" : "Post pinned to the top");
            }}
            onToggleHide={() => toggleHide(p)}
          />
        ))
      )}
    </div>
  );

  return (
    <PageBody>
      <PageHeader
        title="Company Feed"
        description="Wins, updates and questions from across Stellar. Pinned posts stay on top; HR moderates anything flagged."
        actions={
          <Gated menuKey="engage.feed" action="C">
            <Button size="sm" onClick={() => setComposeOpen(true)}>
              <PenSquare /> New post
            </Button>
          </Gated>
        }
      />

      {loading ? (
        <CardsSkeleton count={3} height={180} />
      ) : canModerate ? (
        <Tabs defaultValue="feed">
          <TabsList>
            <TabsTrigger value="feed">
              <Megaphone /> Feed
            </TabsTrigger>
            <TabsTrigger value="moderation">
              <ShieldCheck /> Moderation ({queue.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="feed">{feed}</TabsContent>
          <TabsContent value="moderation">
            <DataTable
              columns={columns}
              data={queue}
              searchKeys={["text"]}
              searchPlaceholder="Search flagged posts…"
              getRowId={(p) => p.id}
              exportName="feed-moderation"
              emptyIcon={Flag}
              emptyTitle="Moderation queue is clear"
              emptyDescription="Flagged and hidden posts appear here for review."
            />
          </TabsContent>
        </Tabs>
      ) : (
        feed
      )}

      <ComposeDialog open={composeOpen} onOpenChange={setComposeOpen} onPublish={publish} />

      <ConfirmDialog
        open={!!hiding}
        onOpenChange={(v) => !v && setHiding(null)}
        title="Hide this post from the feed?"
        description={hiding ? `${nameOf(hiding.authorCode)} will be notified that the post was hidden pending review. You can restore it from Moderation.` : undefined}
        confirmLabel="Hide post"
        destructive
        onConfirm={() => {
          if (!hiding) return;
          update(hiding.id, (x) => ({ ...x, hidden: true, pinned: false }));
          mockAction("Post hidden", { description: "It is no longer visible to employees.", tone: "warning" });
        }}
      />
    </PageBody>
  );
}
