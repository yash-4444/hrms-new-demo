"use client";

import * as React from "react";
import { UserRoundSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import { CandidateCard } from "./candidate-card";
import {
  PIPELINE_STAGES,
  type Candidate,
  type PipelineStage,
} from "@/mock/hiring";

/* ============================================================================
   The pipeline board.

   Drag and drop is the native HTML5 API only — no library. The two rules that
   make it actually work:
     1. onDragOver MUST call preventDefault(), or onDrop never fires
     2. the payload travels in dataTransfer, with a ref fallback for the
        browsers that hand back an empty string mid-drag
   ========================================================================== */

export interface KanbanBoardProps {
  /** Already filtered by the page — the board renders exactly what it is given. */
  candidates: Candidate[];
  /** Shared by the drop handler and each card's "Move to…" menu. */
  onMove: (id: string, to: PipelineStage) => void;
  /** Column brought into view and ringed after a funnel-stage click. */
  focusStage: PipelineStage | null;
}

export function KanbanBoard({ candidates, onMove, focusStage }: KanbanBoardProps) {
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = React.useState<PipelineStage | null>(null);
  const draggingRef = React.useRef<string | null>(null);
  const columnRefs = React.useRef<Partial<Record<PipelineStage, HTMLElement | null>>>({});

  /* Funnel click -> bring that column into view. */
  React.useEffect(() => {
    if (!focusStage) return;
    columnRefs.current[focusStage]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [focusStage]);

  const byStage = React.useMemo(() => {
    const map = new Map<PipelineStage, Candidate[]>();
    for (const s of PIPELINE_STAGES) map.set(s.id, []);
    for (const c of candidates) map.get(c.stage)?.push(c);
    for (const [, list] of map) {
      list.sort((a, b) => b.stageAgeDays - a.stageAgeDays || a.name.localeCompare(b.name));
    }
    return map;
  }, [candidates]);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    draggingRef.current = id;
    setDraggingId(id);
  };

  const handleDragEnd = () => {
    draggingRef.current = null;
    setDraggingId(null);
    setDragOverStage(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLElement>, stage: PipelineStage) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || draggingRef.current;
    draggingRef.current = null;
    setDraggingId(null);
    setDragOverStage(null);
    if (id) onMove(id, stage);
  };

  return (
    <div
      className="scrollbar-thin -mx-1 flex gap-3 overflow-x-auto px-1 pb-2"
      role="list"
      aria-label="Candidate pipeline board"
    >
      {PIPELINE_STAGES.map((stage) => {
        const list = byStage.get(stage.id) ?? [];
        const isOver = dragOverStage === stage.id;
        const isFocus = focusStage === stage.id;
        return (
          <section
            key={stage.id}
            role="listitem"
            aria-label={`${stage.label} — ${list.length} candidates`}
            ref={(el) => {
              columnRefs.current[stage.id] = el;
            }}
            onDragOver={(e) => {
              /* Without this the browser refuses the drop and the card snaps back. */
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (dragOverStage !== stage.id) setDragOverStage(stage.id);
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOverStage(stage.id);
            }}
            onDragLeave={(e) => {
              const next = e.relatedTarget as Node | null;
              if (next && e.currentTarget.contains(next)) return;
              setDragOverStage((s) => (s === stage.id ? null : s));
            }}
            onDrop={(e) => handleDrop(e, stage.id)}
            className={cn(
              "flex w-[272px] shrink-0 flex-col rounded-md border bg-subtle transition-colors",
              isOver ? "border-primary bg-primary-soft/40" : "border-border",
              isFocus && !isOver && "border-primary/60 ring-2 ring-primary/25",
            )}
          >
            <header className="flex items-start justify-between gap-2 border-b border-border px-2.5 py-2">
              <div className="min-w-0">
                <StatusBadge status={stage.id} />
                <p className="mt-1 text-[11px] leading-tight text-muted-foreground">
                  {stage.hint}
                </p>
              </div>
              <span
                className="tnum shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold text-foreground"
                aria-label={`${list.length} candidates in ${stage.label}`}
              >
                {list.length}
              </span>
            </header>

            <div className="scrollbar-thin flex max-h-[58vh] min-h-[140px] flex-col gap-2 overflow-y-auto p-2">
              {list.length ? (
                list.map((c) => (
                  <CandidateCard
                    key={c.id}
                    candidate={c}
                    dragging={draggingId === c.id}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onMove={onMove}
                  />
                ))
              ) : (
                <div
                  className={cn(
                    "flex flex-1 flex-col items-center justify-center gap-1.5 rounded-md border border-dashed px-3 py-6 text-center transition-colors",
                    isOver ? "border-primary bg-primary-soft/40" : "border-border",
                  )}
                >
                  <UserRoundSearch className="size-4 text-muted-foreground" aria-hidden />
                  <p className="text-[11px] font-medium text-foreground">
                    No one in {stage.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Drop a card here, or use a card&apos;s Move to… menu.
                  </p>
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
