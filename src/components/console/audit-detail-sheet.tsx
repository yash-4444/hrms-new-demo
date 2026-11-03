"use client";

import * as React from "react";
import { FileClock, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "@/lib/format";
import { AUDIT_CATEGORY_LABEL, type AuditResult, type AuditValues, type ConsoleAuditEntry } from "@/mock/console-audit";
import { Facts, TonePill, type PTone } from "@/components/platform/kit";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/overlays";

/* One console audit entry: who, what, from where, why — and the before/after
   values as a JSON diff. Read-only by construction; there is nothing to edit. */

const RESULT: Record<AuditResult, { tone: PTone; label: string }> = {
  success: { tone: "success", label: "Success" },
  denied: { tone: "danger", label: "Denied" },
  failed: { tone: "warning", label: "Failed" },
};

export function AuditResultPill({ result }: { result: AuditResult }) {
  return <TonePill tone={RESULT[result].tone}>{RESULT[result].label}</TonePill>;
}

/* A stable, short pseudo-digest so each entry shows its chain hash. */
function digest(s: string) {
  let a = 0x811c9dc5;
  let b = 0x1234567;
  for (let i = 0; i < s.length; i++) {
    a = Math.imul(a ^ s.charCodeAt(i), 16777619) >>> 0;
    b = Math.imul(b + s.charCodeAt(i), 2246822519) >>> 0;
  }
  return `${a.toString(16).padStart(8, "0")}${b.toString(16).padStart(8, "0")}`;
}

type Line = { sign: " " | "-" | "+"; text: string };

function diffLines(before?: AuditValues, after?: AuditValues): Line[] {
  const keys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]));
  const out: Line[] = [{ sign: " ", text: "{" }];
  const fmt = (k: string, v: unknown) => `  "${k}": ${JSON.stringify(v)},`;
  keys.forEach((k) => {
    const hasB = before && k in before;
    const hasA = after && k in after;
    const b = hasB ? JSON.stringify(before![k]) : undefined;
    const a = hasA ? JSON.stringify(after![k]) : undefined;
    if (hasB && hasA && a === b) out.push({ sign: " ", text: fmt(k, before![k]) });
    else {
      if (hasB) out.push({ sign: "-", text: fmt(k, before![k]) });
      if (hasA) out.push({ sign: "+", text: fmt(k, after![k]) });
    }
  });
  out.push({ sign: " ", text: "}" });
  return out;
}

export function AuditDetailSheet({ entry: e, onOpenChange }: { entry: ConsoleAuditEntry | null; onOpenChange: (v: boolean) => void }) {
  return (
    <Sheet open={!!e} onOpenChange={onOpenChange}>
      <SheetContent side="right" width="sm:max-w-xl">
        {e && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2 font-mono text-sm">
                <FileClock className="size-4" aria-hidden /> {e.action}
              </SheetTitle>
              <SheetDescription>
                {e.target.label} · {AUDIT_CATEGORY_LABEL[e.category]} · {e.id}
              </SheetDescription>
            </SheetHeader>
            <SheetBody className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-1.5">
                <AuditResultPill result={e.result} />
                <TonePill tone="neutral" icon={Lock}>
                  Immutable
                </TonePill>
              </div>
              <Facts
                items={[
                  { label: "When", value: <span className="tnum">{fmtDateTime(e.at)}</span> },
                  { label: "Operator", value: e.operator },
                  { label: "Source IP", value: <span className="font-mono">{e.ip}</span> },
                  { label: "Target", value: `${e.target.label} (${e.target.kind} ${e.target.id})` },
                ]}
              />
              <div className="rounded-md border border-border bg-subtle p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Reason</p>
                <p className="mt-1 text-xs leading-relaxed">{e.reason ?? <span className="text-muted-foreground">No reason required for this action.</span>}</p>
              </div>
              {e.result !== "success" && (
                <p className="text-xs text-muted-foreground">
                  {e.result === "denied" ? "The console refused this action; nothing changed." : "The action was attempted but did not complete; nothing changed."}
                </p>
              )}
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Before → after</p>
                {e.before || e.after ? (
                  <pre className="scrollbar-thin overflow-x-auto rounded-md border border-border bg-card py-2 font-mono text-[11px] leading-relaxed" aria-label="JSON diff of the change">
                    {diffLines(e.before, e.after).map((l, i) => (
                      <div
                        key={i}
                        className={cn(
                          "px-3",
                          l.sign === "-" && "bg-destructive-soft text-destructive-fg",
                          l.sign === "+" && "bg-success-soft text-success-fg",
                        )}
                      >
                        <span className="mr-2 select-none opacity-70" aria-hidden>
                          {l.sign}
                        </span>
                        <span className="sr-only">{l.sign === "-" ? "removed " : l.sign === "+" ? "added " : ""}</span>
                        {l.text}
                      </div>
                    ))}
                  </pre>
                ) : (
                  <p className="text-xs text-muted-foreground">This action carries no field-level change — it is recorded for the action alone.</p>
                )}
              </div>
              <p className="border-t border-border pt-2.5 font-mono text-[10px] leading-relaxed text-muted-foreground">
                sha256 chain · {digest(`${e.id}|${e.at}|${e.action}|${e.target.id}`)}…{digest(e.operator).slice(0, 8)}
              </p>
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
