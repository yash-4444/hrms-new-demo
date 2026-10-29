"use client";

import * as React from "react";
import { EyeOff, Flag, MessageSquare, MoreHorizontal, Pin, PinOff, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "@/lib/format";
import { REACTIONS, type FeedPost, type ReactionKey } from "@/mock/engage";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, Badge, Input } from "@/components/ui/primitives";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { ImagePlaceholder, nameOf, personLine } from "./kit";

export interface FeedPostCardProps {
  post: FeedPost;
  myReactions: Set<ReactionKey>;
  myVote: string | null;
  canModerate: boolean;
  onReact: (key: ReactionKey) => void;
  onVote: (optionId: string) => void;
  onComment: (text: string) => void;
  onTogglePin: () => void;
  onToggleHide: () => void;
}

export function FeedPostCard({
  post,
  myReactions,
  myVote,
  canModerate,
  onReact,
  onVote,
  onComment,
  onTogglePin,
  onToggleHide,
}: FeedPostCardProps) {
  const [draft, setDraft] = React.useState("");
  const [showComments, setShowComments] = React.useState(post.comments.length > 0 && post.comments.length <= 2);
  const commentId = React.useId();
  const totalVotes = post.poll?.options.reduce((a, o) => a + o.votes, 0) ?? 0;

  const submitComment = () => {
    if (!draft.trim()) return;
    onComment(draft.trim());
    setDraft("");
    setShowComments(true);
  };

  return (
    <Card className={cn("flex flex-col gap-3 p-4", post.hidden && "opacity-60")}>
      <div className="flex items-start gap-2.5">
        <Avatar name={nameOf(post.authorCode)} size={34} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-foreground">{nameOf(post.authorCode)}</span>
            {post.pinned && (
              <Badge variant="soft">
                <Pin className="size-3" aria-hidden /> Pinned
              </Badge>
            )}
            {post.flagged && canModerate && (
              <Badge variant="outline" className="text-warning-fg">
                <Flag className="size-3" aria-hidden /> Flagged
              </Badge>
            )}
            {post.hidden && (
              <Badge variant="muted">
                <EyeOff className="size-3" aria-hidden /> Hidden from feed
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {personLine(post.authorCode)} · {fmtDateTime(post.at)} · {post.audience}
          </p>
        </div>
        {canModerate && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Moderate post by ${nameOf(post.authorCode)}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onTogglePin}>
                {post.pinned ? <PinOff /> : <Pin />} {post.pinned ? "Unpin" : "Pin to top"}
              </DropdownMenuItem>
              <DropdownMenuItem destructive={!post.hidden} onSelect={onToggleHide}>
                <EyeOff /> {post.hidden ? "Restore to feed" : "Hide from feed"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{post.text}</p>

      {post.image && <ImagePlaceholder tone={post.image.tone} caption={post.image.caption} />}

      {post.poll && (
        <fieldset className="flex flex-col gap-1.5 rounded-md border border-border p-3">
          <legend className="px-1 text-xs font-semibold">{post.poll.question}</legend>
          {post.poll.options.map((o) => {
            const share = totalVotes ? Math.round((o.votes / totalVotes) * 100) : 0;
            const mine = myVote === o.id;
            return (
              <button
                key={o.id}
                type="button"
                disabled={!!myVote}
                aria-pressed={mine}
                onClick={() => onVote(o.id)}
                className={cn(
                  "relative overflow-hidden rounded-md border border-border px-3 py-1.5 text-left text-xs transition-colors",
                  !myVote && "hover:bg-muted",
                  mine && "border-primary",
                )}
              >
                {myVote && <span className="absolute inset-y-0 left-0 bg-primary-soft" style={{ width: `${share}%` }} aria-hidden />}
                <span className="relative flex justify-between gap-2">
                  <span className={cn(mine && "font-semibold")}>{o.label}</span>
                  {myVote && <span className="tnum text-muted-foreground">{share}% · {o.votes}</span>}
                </span>
              </button>
            );
          })}
          <p className="text-[11px] text-muted-foreground">
            {totalVotes} votes · {myVote ? "You voted — results are live." : `Vote to see results. Closes ${post.poll.closesOn}.`}
          </p>
        </fieldset>
      )}

      <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5">
        {REACTIONS.map((r) => {
          const active = myReactions.has(r.key);
          const count = post.reactions[r.key] + (active ? 1 : 0);
          return (
            <button
              key={r.key}
              type="button"
              aria-pressed={active}
              aria-label={`${r.label} — ${count}`}
              onClick={() => onReact(r.key)}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs transition-colors",
                active ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border hover:bg-muted",
              )}
            >
              <span aria-hidden>{r.emoji}</span>
              <span className="tnum">{count}</span>
            </button>
          );
        })}
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setShowComments((v) => !v)} aria-expanded={showComments}>
          <MessageSquare /> {post.comments.length} comment{post.comments.length === 1 ? "" : "s"}
        </Button>
      </div>

      {showComments && (
        <div className="flex flex-col gap-2">
          {post.comments.map((c) => (
            <div key={c.id} className="flex gap-2">
              <Avatar name={nameOf(c.authorCode)} size={24} />
              <div className="min-w-0 flex-1 rounded-md bg-muted px-2.5 py-1.5">
                <p className="text-xs">
                  <span className="font-semibold">{nameOf(c.authorCode)}</span>{" "}
                  <span className="text-[11px] text-muted-foreground">{fmtDateTime(c.at)}</span>
                </p>
                <p className="text-xs text-foreground">{c.text}</p>
              </div>
            </div>
          ))}
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              submitComment();
            }}
          >
            <label htmlFor={commentId} className="sr-only">
              Write a comment
            </label>
            <Input id={commentId} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a comment…" className="h-8 text-xs" />
            <Button type="submit" size="sm" disabled={!draft.trim()} aria-label="Post comment">
              <Send />
            </Button>
          </form>
        </div>
      )}
    </Card>
  );
}
