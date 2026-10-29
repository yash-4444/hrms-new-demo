"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { menuKeyForPath } from "@/lib/nav";
import { mockAction, useApp } from "@/components/app-state";
import { AI_TONE, AiBadge, AiConfidence, AiExplainButton } from "@/components/ai/ai-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, Field, Textarea } from "@/components/ui/primitives";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/overlays";
import { dayVerdict, type AttendanceFlag } from "./attendance-ai";

/* ------------------------------------------------------------ row chip */

/** AI check on one day-board row, with the drivers behind it. */
export function DayVerdictChip({ code, name }: { code: string; name: string }) {
  const v = React.useMemo(() => dayVerdict(code), [code]);
  const normal = v.level === "normal";
  return (
    <span className="flex items-center gap-1">
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
          normal ? AI_TONE.chip : "border-warning/30 bg-warning-soft text-warning-fg",
        )}
      >
        {normal ? <ShieldCheck className="size-3" aria-hidden /> : <ShieldAlert className="size-3" aria-hidden />}
        {v.label}
      </span>
      <AiExplainButton
        title="Why this check?"
        summary={`${name} · last 5 working days and last 30 days of punches. AI recommends; you decide.`}
        drivers={v.drivers}
        footnote="Pattern signal only — never used to mark attendance or take disciplinary action."
      />
    </span>
  );
}

/* --------------------------------------------------------- flag panel */

const DISMISS_REASONS = [
  { value: "verified", label: "Verified with the employee — legitimate" },
  { value: "known", label: "Known situation (travel, client site, device issue)" },
  { value: "false_positive", label: "False positive — data is wrong" },
  { value: "handled", label: "Already handled through regularisation" },
];

const SEVERITY_CLASS: Record<AttendanceFlag["severity"], string> = {
  High: "border-destructive/25 bg-destructive-soft text-destructive-fg",
  Medium: "border-warning/30 bg-warning-soft text-warning-fg",
  Low: "border-border bg-muted text-muted-foreground",
};

/** Violet AI card listing anomaly flags, each explainable and dismissible with a reason. */
export function AttendanceFlagsPanel({
  flags,
  title = "AI attendance flags",
  description,
  emptyText,
}: {
  flags: AttendanceFlag[];
  title?: string;
  description?: React.ReactNode;
  /** Shown when nothing is flagged; omit to render nothing in that case. */
  emptyText?: string;
}) {
  const { can } = useApp();
  const [dismissed, setDismissed] = React.useState<Set<string>>(() => new Set());
  const [active, setActive] = React.useState<AttendanceFlag | null>(null);
  const [reason, setReason] = React.useState("");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const visible = flags.filter((f) => !dismissed.has(f.id));
  if (!visible.length && !emptyText) return null;

  const canOpen = (href?: string) => {
    if (!href) return false;
    const key = menuKeyForPath(href.split("?")[0]);
    return !key || can(key);
  };

  const openDismiss = (f: AttendanceFlag) => {
    setActive(f);
    setReason("");
    setNote("");
    setError(null);
  };

  const confirmDismiss = () => {
    if (!active) return;
    if (!reason) {
      setError("Choose why this flag is being dismissed — it is recorded in the AI audit log.");
      return;
    }
    const f = active;
    setDismissed((s) => new Set(s).add(f.id));
    mockAction("Flag dismissed", {
      description: `${f.title} · ${f.subject} — ${DISMISS_REASONS.find((r) => r.value === reason)?.label}. Feedback improves future flags.`,
      undo: () =>
        setDismissed((s) => {
          const n = new Set(s);
          n.delete(f.id);
          return n;
        }),
    });
    setActive(null);
  };

  return (
    <Card className={cn("border p-4", AI_TONE.soft)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <AiBadge /> {title}
          </h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        <span className="text-[11px] text-muted-foreground">Do not take action on a signal alone.</span>
      </div>

      {!visible.length ? (
        <p className="mt-3 text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {visible.map((f) => (
            <li key={f.id} className="rounded-md border border-border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={SEVERITY_CLASS[f.severity]}>
                  {f.severity}
                </Badge>
                <p className="text-xs font-semibold text-foreground">{f.title}</p>
                <span className="text-xs text-muted-foreground">· {f.subject}</span>
                <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {f.source === "model" ? "Anomaly model" : "Pattern rule"}
                </span>
              </div>
              <ul className="mt-1.5 ml-4 list-disc space-y-0.5 text-xs text-muted-foreground marker:text-muted-foreground">
                {f.evidence.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
              <p className="mt-1.5 text-xs">
                <span className="font-medium">Suggested: </span>
                {f.suggestedAction}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <AiConfidence value={f.confidence} />
                <span className="ml-auto flex flex-wrap items-center gap-1.5">
                  <AiExplainButton
                    title="Why was this flagged?"
                    summary={`${f.subject} · ${f.source === "model" ? "detected by the anomaly model" : "rule over the last 30 days of punches"}.`}
                    drivers={f.drivers}
                  />
                  {canOpen(f.href) && (
                    <Button size="sm" variant="outline" asChild>
                      <Link href={f.href!}>
                        Review <ArrowRight aria-hidden />
                      </Link>
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => openDismiss(f)} aria-label={`Dismiss flag: ${f.title}`}>
                    <X aria-hidden /> Dismiss
                  </Button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent size="sm">
          {active && (
            <>
              <DialogHeader>
                <DialogTitle>Dismiss AI flag</DialogTitle>
                <DialogDescription>
                  {active.title} · {active.subject}. The reason is logged and used to tune future flags.
                </DialogDescription>
              </DialogHeader>
              <DialogBody className="flex flex-col gap-3">
                <Field label="Reason" htmlFor="dismiss-reason" required error={error ?? undefined}>
                  <Select
                    value={reason}
                    onValueChange={(v) => {
                      setReason(v);
                      setError(null);
                    }}
                  >
                    <SelectTrigger id="dismiss-reason" aria-label="Reason for dismissing" aria-invalid={!!error}>
                      <SelectValue placeholder="Choose a reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {DISMISS_REASONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Note (optional)" htmlFor="dismiss-note">
                  <Textarea
                    id="dismiss-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Confirmed with the manager — both were at the client site that week."
                  />
                </Field>
              </DialogBody>
              <DialogFooter>
                <Button variant="outline" onClick={() => setActive(null)}>
                  Cancel
                </Button>
                <Button onClick={confirmDismiss}>Dismiss flag</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
