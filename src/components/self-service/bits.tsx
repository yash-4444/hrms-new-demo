"use client";

import * as React from "react";
import { AlarmClock, Check, CircleDashed, Clock, RotateCcw, Sparkles, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "@/lib/format";
import type { ApprovalChainStep, SlaState } from "@/mock/self-service";
import { Hint } from "@/components/ui/primitives";

/* ============================================================================
   Small shared pieces for the self-service, inbox and auth screens.
   ========================================================================== */

/* --------------------------------------------------------------- AI badge */

/** Local stand-in for the AI suite's badge: violet accent, always labelled. */
export function AiBadge({ className, label = "AI" }: { className?: string; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300",
        className,
      )}
    >
      <Sparkles className="size-3" aria-hidden />
      {label}
    </span>
  );
}

/* --------------------------------------------------------------- SLA chip */

const SLA_CLASS: Record<SlaState, string> = {
  ok: "border-success/25 bg-success-soft text-success-fg",
  at_risk: "border-warning/30 bg-warning-soft text-warning-fg",
  breached: "border-destructive/25 bg-destructive-soft text-destructive-fg",
};

export function ageLabel(hours: number) {
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.round(hours)}h`;
  const d = Math.floor(hours / 24);
  const h = Math.round(hours % 24);
  return h ? `${d}d ${h}h` : `${d}d`;
}

export function SlaChip({ state, ageHours, slaHours }: { state: SlaState; ageHours: number; slaHours: number }) {
  const left = slaHours - ageHours;
  const text =
    state === "breached"
      ? `Breached by ${ageLabel(-left)}`
      : state === "at_risk"
        ? `${ageLabel(left)} left`
        : `${ageLabel(left)} left`;
  const Icon = state === "breached" ? AlarmClock : state === "at_risk" ? TriangleAlert : Clock;
  return (
    <Hint text={`Decision SLA ${slaHours}h · waiting ${ageLabel(ageHours)}`}>
      <span
        className={cn(
          "tnum inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
          SLA_CLASS[state],
        )}
      >
        <Icon className="size-3" aria-hidden />
        {text}
      </span>
    </Hint>
  );
}

/* --------------------------------------------------- approval chain timeline */

const STEP_STYLE: Record<ApprovalChainStep["status"], { icon: React.ElementType; dot: string; label: string }> = {
  approved: { icon: Check, dot: "bg-success text-white", label: "Approved" },
  pending: { icon: Clock, dot: "bg-warning text-white", label: "Awaiting decision" },
  waiting: { icon: CircleDashed, dot: "bg-muted text-muted-foreground", label: "Not started" },
  rejected: { icon: X, dot: "bg-destructive text-white", label: "Rejected" },
  sent_back: { icon: RotateCcw, dot: "bg-serious text-white", label: "Sent back" },
};

export function ApprovalChainTimeline({ chain, ageHours }: { chain: ApprovalChainStep[]; ageHours?: number }) {
  return (
    <ol className="flex flex-col" aria-label="Approval chain">
      {chain.map((s, i) => {
        const st = STEP_STYLE[s.status];
        const last = i === chain.length - 1;
        return (
          <li key={`${s.step}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
            {!last && (
              <span
                className={cn(
                  "absolute left-[11px] top-6 h-[calc(100%-1.25rem)] w-px",
                  s.status === "approved" ? "bg-success/50" : "bg-border",
                )}
                aria-hidden
              />
            )}
            <span className={cn("z-10 flex size-6 shrink-0 items-center justify-center rounded-full", st.dot)}>
              <st.icon className="size-3.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <p className="text-xs font-semibold">
                  {i === 0 ? "Step 0" : `Step ${i}`} · {s.step}
                </p>
                <span className="text-[10px] text-muted-foreground">{st.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="text-foreground">{s.approver}</span> · {s.role}
              </p>
              <p className="tnum mt-0.5 text-[11px] text-muted-foreground">
                {s.at
                  ? fmtDateTime(s.at)
                  : s.status === "pending" && s.enteredAt
                    ? `Waiting since ${fmtDateTime(s.enteredAt)}${s.slaHours ? ` · SLA ${s.slaHours}h` : ""}${ageHours !== undefined ? ` · ${ageLabel(ageHours)} elapsed` : ""}`
                    : s.slaHours
                      ? `Starts after the previous step · SLA ${s.slaHours}h`
                      : "—"}
              </p>
              {s.comment && <p className="mt-1 rounded-md bg-subtle px-2 py-1 text-[11px]">{s.comment}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ----------------------------------------------------------- progress ring */

export function ProgressRing({
  value,
  size = 72,
  stroke = 7,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative inline-flex shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${Math.round(v)}% complete`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (v / 100) * c}
          className={cn("transition-all", v >= 100 ? "stroke-success" : "stroke-primary")}
        />
      </svg>
      <span className="tnum absolute inset-0 flex items-center justify-center text-sm font-semibold">
        {label ?? `${Math.round(v)}%`}
      </span>
    </div>
  );
}

/* ----------------------------------------------------- simulated download */

/** Builds a real (tiny) text blob so "Download" produces a file, then toasts. */
export function simulateDownload(fileName: string, body: string) {
  try {
    const blob = new Blob([body], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName.replace(/\.(pdf|jpg|png)$/i, ".txt");
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    /* Downloads can be blocked in embedded previews; the toast still confirms. */
  }
}
