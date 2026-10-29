"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronsUp,
  Equal,
  Frown,
  Globe,
  Mail,
  MessageCircle,
  Meh,
  Minus,
  Octagon,
  Smile,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { hm } from "@/lib/format";
import { useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Field, Hint, Textarea } from "@/components/ui/primitives";
import {
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/overlays";
import type { SlaState, TicketPriority } from "@/mock/workplace";
import type { Channel, Sentiment } from "@/mock/service";

/* ============================================================================
   Shared helpers for the Assets & Helpdesk screens. Every chip is icon +
   label + tone — colour never carries meaning on its own.
   ========================================================================== */

const CHIP = "inline-flex w-fit items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap";

export const TONE_CHIP = {
  success: "border-success/25 bg-success-soft text-success-fg",
  warning: "border-warning/30 bg-warning-soft text-warning-fg",
  serious: "border-serious/30 bg-serious-soft text-serious-fg",
  danger: "border-destructive/25 bg-destructive-soft text-destructive-fg",
  info: "border-info/25 bg-info-soft text-info-fg",
  neutral: "border-border bg-muted text-muted-foreground",
} as const;
export type ChipTone = keyof typeof TONE_CHIP;

/** A labelled chip for values that are not workflow statuses (kind, channel…). */
export function ToneChip({
  tone,
  icon: Icon,
  children,
  className,
}: {
  tone: ChipTone;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn(CHIP, TONE_CHIP[tone], className)}>
      {Icon && <Icon className="size-3" aria-hidden />}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------ SLA countdown */

const SLA_META: Record<SlaState, { label: string; icon: LucideIcon; tone: ChipTone }> = {
  sla_ok: { label: "On track", icon: Check, tone: "success" },
  sla_at_risk: { label: "At risk", icon: AlertTriangle, tone: "warning" },
  sla_breached: { label: "Breached", icon: Octagon, tone: "danger" },
};

export function SlaChip({ state, minutes, done }: { state: SlaState; minutes: number; done?: boolean }) {
  if (done) return <ToneChip tone="neutral" icon={Check}>Closed</ToneChip>;
  const m = SLA_META[state];
  const abs = Math.abs(minutes);
  return (
    <Hint text={minutes < 0 ? `Breached ${hm(abs)} ago` : `${hm(abs)} left before the SLA is breached`}>
      <span className={cn(CHIP, TONE_CHIP[m.tone])}>
        <m.icon className="size-3" aria-hidden />
        {m.label}
        <span className="tnum opacity-80">
          {minutes < 0 ? "−" : ""}
          {hm(abs)}
        </span>
      </span>
    </Hint>
  );
}

/* -------------------------------------------------------- priority / channel */

const PRIORITY_META: Record<TicketPriority, { icon: LucideIcon; tone: ChipTone }> = {
  Critical: { icon: ChevronsUp, tone: "danger" },
  High: { icon: AlertTriangle, tone: "serious" },
  Medium: { icon: Equal, tone: "info" },
  Low: { icon: Minus, tone: "neutral" },
};

export function PriorityChip({ priority }: { priority: TicketPriority }) {
  const m = PRIORITY_META[priority];
  return <ToneChip tone={m.tone} icon={m.icon}>{priority}</ToneChip>;
}

const CHANNEL_ICON: Record<Channel, LucideIcon> = { Portal: Globe, Email: Mail, WhatsApp: MessageCircle, Copilot: Bot };

export function ChannelChip({ channel }: { channel: Channel }) {
  const Icon = CHANNEL_ICON[channel];
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Icon className="size-3.5" aria-hidden />
      {channel}
    </span>
  );
}

const SENTIMENT_META: Record<Sentiment, { icon: LucideIcon; tone: ChipTone }> = {
  Frustrated: { icon: Frown, tone: "danger" },
  Neutral: { icon: Meh, tone: "neutral" },
  Positive: { icon: Smile, tone: "success" },
};

export function SentimentChip({ sentiment }: { sentiment: Sentiment }) {
  const m = SENTIMENT_META[sentiment];
  return <ToneChip tone={m.tone} icon={m.icon}>{sentiment}</ToneChip>;
}

/* ------------------------------------------------------------- dirty guard */

/** Wraps a dialog's onOpenChange so closing a dirty form asks first. */
export function useDirtyGuard(isDirty: boolean, close: () => void) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const onOpenChange = (open: boolean) => {
    if (open) return;
    if (isDirty) setConfirmOpen(true);
    else close();
  };
  const guard = (
    <ConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      title="Discard your changes?"
      description="You have unsaved changes in this form. Closing now will lose them."
      confirmLabel="Discard"
      cancelLabel="Keep editing"
      destructive
      onConfirm={close}
    />
  );
  return { onOpenChange, guard };
}

/* ------------------------------------------------------------ reason dialog */

/** Confirm dialog that records a human decision with a required comment. */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = true,
  commentLabel = "Reason",
  placeholder = "Recorded in the audit trail with your name and the time.",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  commentLabel?: string;
  placeholder?: string;
  onConfirm: (comment: string) => void;
}) {
  const [comment, setComment] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const id = React.useId();
  const tooShort = comment.trim().length < 5;

  const close = (v: boolean) => {
    if (!v) {
      setComment("");
      setTouched(false);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogBody>
          <Field label={commentLabel} htmlFor={id} required error={touched && tooShort ? "Add a short reason (5+ characters)." : undefined}>
            <Textarea
              id={id}
              value={comment}
              placeholder={placeholder}
              aria-invalid={touched && tooShort}
              onChange={(e) => setComment(e.target.value)}
            />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={() => {
              setTouched(true);
              if (tooShort) return;
              onConfirm(comment.trim());
              close(false);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------ small layout */

/** Two-column "label: value" grid used on detail panels. */
export function FactGrid({ items, className }: { items: [string, React.ReactNode][]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-[minmax(0,10rem)_1fr] gap-x-3 gap-y-1.5 text-xs", className)}>
      {items.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 text-foreground">{v}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

/** Vertical timeline; each item is date + title + optional note. */
export function Timeline({
  items,
}: {
  items: { key: string; date: React.ReactNode; title: React.ReactNode; note?: React.ReactNode; tone?: ChipTone }[];
}) {
  return (
    <ol className="relative flex flex-col gap-3 border-l border-border pl-4">
      {items.map((it) => (
        <li key={it.key} className="relative">
          <span
            className={cn(
              "absolute top-1 -left-[21px] size-2.5 rounded-full border-2 border-card",
              it.tone === "danger" ? "bg-destructive" : it.tone === "warning" ? "bg-warning" : it.tone === "success" ? "bg-success" : "bg-primary",
            )}
            aria-hidden
          />
          <p className="tnum text-[11px] text-muted-foreground">{it.date}</p>
          <p className="text-xs font-medium text-foreground">{it.title}</p>
          {it.note && <p className="text-xs text-muted-foreground">{it.note}</p>}
        </li>
      ))}
    </ol>
  );
}

/** Links an asset tag to its detail page — or plain text for roles without the register. */
export function AssetLink({ id, label, className }: { id: string; label?: React.ReactNode; className?: string }) {
  const { can } = useApp();
  const content = label ?? <span className="font-mono text-xs font-medium">{id}</span>;
  if (!can("workplace.assets")) return <span className={className}>{content}</span>;
  return (
    <Link href={`/assets/${id}`} className={cn("hover:underline", className)} onClick={(e) => e.stopPropagation()}>
      {content}
    </Link>
  );
}
