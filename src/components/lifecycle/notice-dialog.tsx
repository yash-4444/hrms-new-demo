"use client";

import * as React from "react";
import { fmtDate, inr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input, Label, RadioGroup, RadioGroupItem, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { ctcBreakup } from "@/mock/payroll";
import { DEMO_TODAY } from "@/mock/org";
import { computeLwd, type Separation } from "@/mock/lifecycle";
import { useDirtyGuard } from "./kit";

/**
 * Waive (company releases early, no recovery) or buy out (employee pays for
 * the unserved days, recovered in F&F) part of the notice period.
 */
export function NoticeDialog({
  separation: s,
  onClose,
  onSave,
}: {
  separation: Separation;
  onClose: () => void;
  onSave: (p: { waivedDays: number; buyoutDays: number; lwd: string; comment: string }) => void;
}) {
  const [mode, setMode] = React.useState<"waive" | "buyout">(s.buyoutDays ? "buyout" : "waive");
  const [days, setDays] = React.useState(String(s.buyoutDays || s.waivedDays || 15));
  const [comment, setComment] = React.useState("");
  const [tried, setTried] = React.useState(false);
  const dirty = comment !== "" || days !== String(s.buyoutDays || s.waivedDays || 15);
  const { onOpenChange, guard } = useDirtyGuard(dirty, onClose);

  const n = Math.floor(Number(days));
  const served = Math.max(0, Math.round((Date.parse(DEMO_TODAY) - Date.parse(s.initiatedOn)) / 86400000));
  const maxDays = s.noticeDays - served;
  const daysErr = !Number.isFinite(n) || n < 1 ? "Enter at least 1 day" : n > maxDays ? `At most ${maxDays} days — ${served} days are already served` : undefined;
  const commentErr = comment.trim().length < 10 ? "Record why (10+ characters)" : undefined;
  const lwd = daysErr ? s.lwd : computeLwd(s.initiatedOn, s.noticeDays, mode === "waive" ? n : 0, mode === "buyout" ? n : 0);
  const basic = ctcBreakup(s.gradeId, s.ctc).basic;
  const recovery = mode === "buyout" && !daysErr ? Math.round((basic / 30) * n) : 0;

  return (
    <>
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Waive or buy out notice — {s.name}</DialogTitle>
            <DialogDescription>
              {s.noticeDays} days&apos; notice from {fmtDate(s.initiatedOn)} · current last working day {fmtDate(s.lwd)}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3.5">
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as "waive" | "buyout")} className="flex flex-col gap-2">
              <span className="flex items-start gap-2">
                <RadioGroupItem id="nd-waive" value="waive" className="mt-0.5" />
                <Label htmlFor="nd-waive" className="font-normal">
                  <span className="font-medium">Waive</span> — the company releases early; nothing is recovered.
                </Label>
              </span>
              <span className="flex items-start gap-2">
                <RadioGroupItem id="nd-buyout" value="buyout" className="mt-0.5" />
                <Label htmlFor="nd-buyout" className="font-normal">
                  <span className="font-medium">Buyout</span> — the employee pays for the unserved days (Basic ÷ 30 per day), recovered in F&amp;F.
                </Label>
              </span>
            </RadioGroup>
            <Field label="Days" htmlFor="nd-days" required error={tried ? daysErr : undefined}>
              <Input id="nd-days" type="number" min={1} max={maxDays} className="tnum w-28" value={days} aria-invalid={tried && !!daysErr} onChange={(e) => setDays(e.target.value)} />
            </Field>
            <Alert tone={mode === "buyout" ? "warning" : "info"} title={`New last working day ${fmtDate(lwd)}`}>
              {mode === "buyout" ? `Recovery in F&F: ${inr(recovery)} (Basic ${inr(basic)} ÷ 30 × ${daysErr ? 0 : n})` : "No recovery — the manager has agreed to an early release."}
            </Alert>
            <Field label="Comment" htmlFor="nd-comment" required error={tried ? commentErr : undefined}>
              <Textarea id="nd-comment" value={comment} aria-invalid={tried && !!commentErr} onChange={(e) => setComment(e.target.value)} placeholder="Handover is complete; manager agreed to release on…" />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setTried(true);
                if (daysErr || commentErr) return;
                onSave({ waivedDays: mode === "waive" ? n : 0, buyoutDays: mode === "buyout" ? n : 0, lwd, comment: comment.trim() });
                onClose();
              }}
            >
              Save — LWD {fmtDate(lwd)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}
