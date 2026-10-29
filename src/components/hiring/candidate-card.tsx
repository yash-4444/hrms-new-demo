"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock3, GripVertical, MoveRight, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { inrCompact } from "@/lib/format";
import { Avatar, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import {
  PIPELINE_STAGES,
  type Candidate,
  type PipelineStage,
} from "@/mock/hiring";
import { AiMatchChip } from "@/components/ai/embed/hiring-ai-ui";

/* ============================================================================
   One draggable candidate card.

   Drag is never the only path: the "Move to…" menu runs the exact same
   `onMove(id, stage)` callback the drop handler runs, so the board is fully
   operable from the keyboard.
   ========================================================================== */

export interface CandidateCardProps {
  candidate: Candidate;
  dragging: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
  onDragEnd: () => void;
  onMove: (id: string, to: PipelineStage) => void;
}

export function CandidateCard({
  candidate: c,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
}: CandidateCardProps) {
  const router = useRouter();
  const href = `/candidates/${c.id}`;
  const stale = c.stageAgeDays > 14;

  const open = () => router.push(href);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, c.id)}
      onDragEnd={onDragEnd}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          open();
        }
      }}
      tabIndex={0}
      aria-label={`${c.name}, ${c.role}. ${c.stageAgeDays} days in stage. Press Enter to open the profile.`}
      className={cn(
        "group relative cursor-grab select-none rounded-md border border-border bg-card p-2.5 shadow-xs transition-colors",
        "hover:border-primary/40 hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        dragging && "cursor-grabbing opacity-40 ring-2 ring-primary",
      )}
    >
      <div className="flex items-start gap-2">
        <Avatar name={c.name} size={26} />
        <div className="min-w-0 flex-1">
          <Link
            href={href}
            onClick={(e) => e.stopPropagation()}
            className="block truncate text-xs font-semibold text-foreground hover:text-primary hover:underline"
          >
            {c.name}
          </Link>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{c.role}</p>
        </div>

        <div className="flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
          <GripVertical
            className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-60"
            aria-hidden
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Move ${c.name} to another stage`}
                onClick={(e) => e.stopPropagation()}
              >
                <MoveRight />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuLabel>Move to…</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {PIPELINE_STAGES.filter((s) => s.id !== c.stage).map((s) => (
                <DropdownMenuItem
                  key={s.id}
                  destructive={s.id === "rejected"}
                  onSelect={() => onMove(c.id, s.id)}
                >
                  {s.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => router.push(href)}>
                Open profile
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        <Badge variant="muted">{c.source}</Badge>
        <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground" title={c.currentCompany}>
          {c.currentCompany}
        </span>
        {c.stage !== "rejected" && c.stage !== "hired" && <AiMatchChip candidate={c} />}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-1.5">
        <span
          className={cn(
            "tnum inline-flex items-center gap-1 text-[11px] font-medium",
            stale ? "text-warning-fg" : "text-muted-foreground",
          )}
          title={
            stale
              ? `Ageing — ${c.stageAgeDays} days in this stage`
              : `${c.stageAgeDays} days in this stage`
          }
        >
          <Clock3 className="size-3" aria-hidden />
          {c.stageAgeDays}d in stage
        </span>
        <span className="flex items-center gap-2">
          <span
            className="tnum inline-flex items-center gap-0.5 text-[11px] font-medium text-foreground"
            title={`Panel rating ${c.rating.toFixed(1)} out of 5`}
          >
            <Star className="size-3 fill-warning text-warning" aria-hidden />
            {c.rating.toFixed(1)}
          </span>
          <span
            className="tnum text-[11px] font-medium text-foreground"
            title={`Expected CTC ${inrCompact(c.expectedCtc)} per annum`}
          >
            {inrCompact(c.expectedCtc)}
          </span>
        </span>
      </div>
    </div>
  );
}
