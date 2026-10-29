"use client";

/* Improvement plan detail: milestones, check-ins, and the close-with-outcome dialog. */

import * as React from "react";
import { fmtDate } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import type { MilestoneStatus, Pip, PipCheckIn, PipOutcome } from "@/mock/engage";
import { mockAction } from "@/components/app-state";
import { Gated } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/primitives";
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { nameOf } from "./kit";

export const MILESTONE_BADGE: Record<MilestoneStatus, { status: string; label: string }> = {
  met: { status: "achieved", label: "Met" },
  in_progress: { status: "on_track", label: "In progress" },
  missed: { status: "off_track", label: "Missed" },
  not_started: { status: "not_started", label: "Not started" },
};

const MS_ORDER: MilestoneStatus[] = ["not_started", "in_progress", "met", "missed"];

export function PipDetail({ pip, onChange, onClose }: { pip: Pip; onChange: (p: Pip) => void; onClose: () => void }) {
  const [note, setNote] = React.useState("");
  const [rating, setRating] = React.useState<PipCheckIn["rating"]>("on_track");
  const closed = pip.status === "closed";

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-border bg-subtle p-2.5 text-xs">
        <p className="font-medium">Performance gap</p>
        <p className="mt-0.5 text-muted-foreground">{pip.reason}</p>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Manager {nameOf(pip.managerCode)} · HR partner {nameOf(pip.hrCode)} · {fmtDate(pip.startDate)} → {fmtDate(pip.endDate)}
        </p>
      </div>

      <section aria-labelledby="pip-ms">
        <h3 id="pip-ms" className="mb-1.5 text-xs font-semibold">Milestones</h3>
        <ul className="flex flex-col gap-1.5">
          {pip.milestones.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium">{m.title}</p>
                <p className="text-[11px] text-muted-foreground">{m.measure} · due {fmtDate(m.dueOn)}</p>
              </div>
              {closed ? (
                <StatusBadge status={MILESTONE_BADGE[m.status].status} label={MILESTONE_BADGE[m.status].label} />
              ) : (
                <Gated menuKey="growth.pip" action="E">
                  <Select
                    value={m.status}
                    onValueChange={(v) => {
                      onChange({ ...pip, milestones: pip.milestones.map((x) => (x.id === m.id ? { ...x, status: v as MilestoneStatus } : x)) });
                      mockAction(`Milestone marked ${MILESTONE_BADGE[v as MilestoneStatus].label.toLowerCase()}`, { description: m.title });
                    }}
                  >
                    <SelectTrigger size="sm" className="w-[130px]" aria-label={`Status of ${m.title}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MS_ORDER.map((s) => (
                        <SelectItem key={s} value={s}>{MILESTONE_BADGE[s].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Gated>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="pip-ci">
        <h3 id="pip-ci" className="mb-1.5 text-xs font-semibold">Check-ins ({pip.checkIns.length})</h3>
        <ol className="flex flex-col gap-2 border-l border-border pl-3">
          {pip.checkIns.map((c, i) => (
            <li key={i} className="text-xs">
              <div className="flex items-center gap-2">
                <span className="font-medium">{fmtDate(c.date)}</span>
                <StatusBadge status={c.rating} />
                <span className="text-[11px] text-muted-foreground">{nameOf(c.byCode)}</span>
              </div>
              <p className="mt-0.5 text-muted-foreground">{c.note}</p>
            </li>
          ))}
          {pip.checkIns.length === 0 && <li className="text-xs text-muted-foreground">No check-ins yet. The first is due a week after the start.</li>}
        </ol>
        {!closed && (
          <div className="mt-2 flex flex-col gap-1.5 rounded-md border border-border p-2.5">
            <label htmlFor="pip-note" className="text-xs font-medium">Record a check-in</label>
            <Textarea id="pip-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Progress against each milestone since the last check-in." />
            <div className="flex flex-wrap items-center gap-1.5">
              <Select value={rating} onValueChange={(v) => setRating(v as PipCheckIn["rating"])}>
                <SelectTrigger size="sm" className="w-[130px]" aria-label="Overall status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="on_track">On track</SelectItem>
                  <SelectItem value="at_risk">At risk</SelectItem>
                  <SelectItem value="off_track">Off track</SelectItem>
                </SelectContent>
              </Select>
              <Gated menuKey="growth.pip" action="E">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={note.trim().length < 10}
                  onClick={() => {
                    onChange({ ...pip, checkIns: [...pip.checkIns, { date: DEMO_TODAY, byCode: pip.managerCode, rating, note: note.trim() }] });
                    setNote("");
                    mockAction("Check-in recorded", { description: `${nameOf(pip.employeeCode)} and the HR partner can see it.` });
                  }}
                >
                  Save check-in
                </Button>
              </Gated>
              <Gated menuKey="growth.pip" action="E">
                <Button size="sm" variant="destructive" className="ml-auto" onClick={onClose}>
                  Close plan…
                </Button>
              </Gated>
            </div>
          </div>
        )}
        {closed && pip.outcome && (
          <p className="mt-2 text-xs">
            Closed with outcome <span className="font-semibold">{pip.outcome}</span>.
          </p>
        )}
      </section>
    </div>
  );
}

const OUTCOMES: PipOutcome[] = ["Successful", "Extended", "Role change", "Separation"];

/** Close a plan — outcome and a recorded comment are both required. */
export function ClosePipDialog({
  pip,
  onOpenChange,
  onConfirm,
}: {
  pip: Pip | null;
  onOpenChange: (v: boolean) => void;
  onConfirm: (outcome: PipOutcome, comment: string) => void;
}) {
  const [outcome, setOutcome] = React.useState<PipOutcome | "">("");
  const [comment, setComment] = React.useState("");
  const [tried, setTried] = React.useState(false);
  const reset = (v: boolean) => {
    if (!v) {
      setOutcome("");
      setComment("");
      setTried(false);
    }
    onOpenChange(v);
  };
  const met = pip ? pip.milestones.filter((m) => m.status === "met").length : 0;
  return (
    <Dialog open={!!pip} onOpenChange={reset}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Close plan for {pip ? nameOf(pip.employeeCode) : ""}?</DialogTitle>
          <DialogDescription>
            {met} of {pip?.milestones.length ?? 0} milestones met. Closing locks the plan; the outcome and your comment go on the employee&apos;s record.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <Field label="Outcome" htmlFor="pip-outcome" required error={tried && !outcome ? "Choose an outcome" : undefined}>
            <Select value={outcome} onValueChange={(v) => setOutcome(v as PipOutcome)}>
              <SelectTrigger id="pip-outcome"><SelectValue placeholder="Choose an outcome" /></SelectTrigger>
              <SelectContent>
                {OUTCOMES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Comment" htmlFor="pip-close-comment" required error={tried && comment.trim().length < 10 ? "At least 10 characters" : undefined}>
            <Textarea id="pip-close-comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Summary of evidence for this outcome." />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => reset(false)}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => {
              setTried(true);
              if (!outcome || comment.trim().length < 10) return;
              onConfirm(outcome, comment.trim());
              reset(false);
            }}
          >
            Close plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
