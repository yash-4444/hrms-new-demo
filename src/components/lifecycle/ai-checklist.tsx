"use client";

import * as React from "react";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";
import { AI_TONE, AiDraftBanner, AiSuggestionCard } from "@/components/ai";
import { offsetLabel, type OnboardingInstance, type TaskOwner } from "@/mock/lifecycle";
import { branchById } from "@/mock/org";
import { OwnerChip } from "./kit";

/* ============================================================================
   "AI-generated checklist" — role- and location-aware additions to the
   template. Deterministic: the same joiner always gets the same suggestions,
   each with the reason it was suggested.
   ========================================================================== */

export interface ChecklistSuggestion {
  key: string;
  title: string;
  owner: TaskOwner;
  offset: number;
  why: string;
  confidence: number;
}

export function suggestChecklist(i: OnboardingInstance): ChecklistSuggestion[] {
  const out: ChecklistSuggestion[] = [];
  const city = branchById(i.branchId)?.city ?? i.branchId;
  const has = (k: string) => i.tasks.some((t) => t.key === k);
  if (["ENG", "ITO"].includes(i.departmentId)) {
    out.push({ key: "ai-oncall", title: "Shadow one on-call rotation", owner: "Manager", offset: 21, why: "Engineers at Stellar join the on-call roster in month two; 9 of the last 11 engineering joiners shadowed first.", confidence: 88 });
    out.push({ key: "ai-staging", title: "Request read access to the staging database", owner: "IT", offset: 2, why: `${i.role} tickets in the first sprint usually touch staging data.`, confidence: 74 });
  }
  if (["SAL", "CSM", "MKT"].includes(i.departmentId)) {
    out.push({ key: "ai-accounts", title: "Introduce to the top 10 named accounts", owner: "Manager", offset: 10, why: "GTM joiners who met key accounts in month one ramped 3 weeks faster last year.", confidence: 81 });
  }
  if (i.branchId === "EWR") {
    out.push({ key: "ai-tdi", title: "Share the NJ temporary-disability and family-leave notice", owner: "HR", offset: 3, why: `New Jersey requires the notice at hire; ${city} is the only US site.`, confidence: 93 });
    out.push({ key: "ai-ship", title: "Ship a home-office kit for remote days", owner: "IT", offset: -5, why: "US hybrid joiners work remotely two days a week.", confidence: 70 });
  } else {
    out.push({ key: "ai-transport", title: `Issue ${city} cafeteria and shuttle pass`, owner: "HR", offset: 0, why: `${city} campus services need a pass from Day 1.`, confidence: 77 });
  }
  if (["G4", "G5", "G6", "G7"].includes(i.gradeId)) {
    out.push({ key: "ai-skip", title: "Schedule a skip-level 1:1 with the department head", owner: "Manager", offset: 10, why: `${i.gradeId} hires get a skip-level in week two under the leadership onboarding standard.`, confidence: 85 });
  }
  return out.filter((s) => !has(s.key));
}

export function AiChecklistPanel({
  instance,
  canEdit,
  onAccept,
}: {
  instance: OnboardingInstance;
  canEdit: boolean;
  onAccept: (s: ChecklistSuggestion) => void;
}) {
  const [state, setState] = React.useState<"idle" | "thinking" | "ready">("idle");
  const [items, setItems] = React.useState<ChecklistSuggestion[]>([]);
  const [editing, setEditing] = React.useState<string | null>(null);

  const generate = () => {
    setState("thinking");
    setTimeout(() => {
      setItems(suggestChecklist(instance));
      setState("ready");
    }, 900);
  };

  const remove = (key: string) => setItems((xs) => xs.filter((x) => x.key !== key));
  const patch = (key: string, p: Partial<ChecklistSuggestion>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...p } : x)));

  if (state === "idle")
    return (
      <Button size="sm" className={AI_TONE.solid} onClick={generate}>
        <Sparkles aria-hidden /> AI-generated checklist
      </Button>
    );

  if (state === "thinking")
    return (
      <p role="status" className={cn("flex items-center gap-1.5 text-xs", AI_TONE.text)}>
        <Loader2 className="size-3.5 animate-spin" aria-hidden /> Reading the role, grade and {branchById(instance.branchId)?.city} site rules…
      </p>
    );

  return (
    <div className="flex flex-col gap-2">
      <AiDraftBanner>
        Suggested from the role ({instance.role}), grade {instance.gradeId} and location. These are additions to the
        template — nothing is added until you accept it.
      </AiDraftBanner>
      {items.length === 0 && <p className="text-xs text-muted-foreground">All suggestions handled. The checklist is up to date.</p>}
      {items.map((s) => (
        <AiSuggestionCard
          key={s.key}
          title={s.title}
          confidence={s.confidence}
          acceptLabel="Add to checklist"
          body={
            editing === s.key ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium" htmlFor={`ai-${s.key}`}>
                  Task title
                </label>
                <Input id={`ai-${s.key}`} value={s.title} onChange={(e) => patch(s.key, { title: e.target.value })} />
                <label className="text-[11px] font-medium" htmlFor={`ai-off-${s.key}`}>
                  Day offset from joining
                </label>
                <Input id={`ai-off-${s.key}`} type="number" className="tnum w-24" value={s.offset} onChange={(e) => patch(s.key, { offset: Number(e.target.value) || 0 })} />
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-1.5">
                  <OwnerChip owner={s.owner} />
                  <span className="tnum text-muted-foreground">{offsetLabel(s.offset)}</span>
                </span>
                <span>{s.why}</span>
              </div>
            )
          }
          onAccept={
            canEdit && s.title.trim().length > 3
              ? () => {
                  onAccept(s);
                  remove(s.key);
                  setEditing(null);
                }
              : undefined
          }
          onEdit={canEdit ? () => setEditing(editing === s.key ? null : s.key) : undefined}
          onDismiss={() => remove(s.key)}
        />
      ))}
      {!canEdit && <p className="text-[11px] text-muted-foreground">Your role can view suggestions but not change the checklist.</p>}
    </div>
  );
}
