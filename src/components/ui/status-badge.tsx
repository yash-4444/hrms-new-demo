import * as React from "react";
import {
  AlertTriangle,
  Ban,
  CalendarOff,
  Check,
  CircleDashed,
  CircleDot,
  Clock,
  FileText,
  Hourglass,
  Lock,
  Minus,
  Octagon,
  Plane,
  RotateCcw,
  Send,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ============================================================================
   ONE status vocabulary for the entire product.

   Every status anywhere in HRMS-NEW resolves through this map, so "Approved"
   is the same green on the leave queue, the pay run, the expense claim and
   the requisition. Status colour is ALWAYS paired with an icon + a label —
   never colour alone.
   ========================================================================== */

export type Tone =
  | "success"
  | "warning"
  | "serious"
  | "danger"
  | "info"
  | "neutral"
  | "accent";

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-success-soft text-success-fg border-success/25",
  warning: "bg-warning-soft text-warning-fg border-warning/30",
  serious: "bg-serious-soft text-serious-fg border-serious/30",
  danger: "bg-destructive-soft text-destructive-fg border-destructive/25",
  info: "bg-info-soft text-info-fg border-info/25",
  neutral: "bg-neutral-soft text-neutral-fg border-border",
  accent: "bg-primary-soft text-primary-soft-foreground border-primary/25",
};

export const TONE_DOT: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  serious: "bg-serious",
  danger: "bg-destructive",
  info: "bg-info",
  neutral: "bg-muted-foreground",
  accent: "bg-primary",
};

interface StatusDef {
  label: string;
  tone: Tone;
  icon: LucideIcon;
}

const S = (label: string, tone: Tone, icon: LucideIcon): StatusDef => ({ label, tone, icon });

export const STATUS_MAP: Record<string, StatusDef> = {
  /* generic workflow */
  draft: S("Draft", "neutral", CircleDashed),
  pending: S("Pending", "warning", Hourglass),
  submitted: S("Submitted", "info", Send),
  in_review: S("In Review", "info", CircleDot),
  approved: S("Approved", "success", Check),
  rejected: S("Rejected", "danger", X),
  sent_back: S("Sent Back", "serious", RotateCcw),
  cancelled: S("Cancelled", "neutral", Ban),
  withdrawn: S("Withdrawn", "neutral", Ban),
  expired: S("Expired", "neutral", CalendarOff),
  completed: S("Completed", "success", Check),
  failed: S("Failed", "danger", Octagon),
  scheduled: S("Scheduled", "info", Clock),
  running: S("Running", "info", Hourglass),
  published: S("Published", "success", Check),

  /* employment */
  active: S("Active", "success", Check),
  probation: S("Probation", "warning", Hourglass),
  notice: S("Notice Period", "serious", AlertTriangle),
  resigned: S("Resigned", "danger", X),
  exited: S("Exited", "neutral", Ban),
  on_leave: S("On Leave", "info", Plane),
  invited: S("Invited", "info", Send),
  suspended: S("Suspended", "danger", Ban),

  /* attendance day states */
  present: S("Present", "success", Check),
  half_day: S("Half Day", "warning", Minus),
  absent: S("Absent", "danger", X),
  leave: S("On Leave", "info", Plane),
  holiday: S("Holiday", "accent", CalendarOff),
  weekend: S("Weekend", "neutral", CalendarOff),
  overtime: S("Overtime", "serious", Clock),
  late: S("Late", "warning", Clock),
  not_marked: S("Not Marked", "neutral", CircleDashed),

  /* payroll */
  calculated: S("Calculated", "info", FileText),
  locked: S("Locked", "serious", Lock),
  paid: S("Paid", "success", Check),
  exception: S("Exception", "danger", AlertTriangle),
  processing: S("Processing", "info", Hourglass),

  /* hiring */
  applied: S("Applied", "neutral", CircleDashed),
  screening: S("Screening", "info", CircleDot),
  interview: S("Interview", "accent", CircleDot),
  offer: S("Offer", "warning", FileText),
  hired: S("Hired", "success", Check),
  on_hold: S("On Hold", "neutral", Hourglass),
  open: S("Open", "info", CircleDot),
  closed: S("Closed", "neutral", Ban),
  filled: S("Filled", "success", Check),

  /* helpdesk SLA */
  sla_ok: S("On Track", "success", Check),
  sla_at_risk: S("At Risk", "warning", AlertTriangle),
  sla_breached: S("Breached", "danger", Octagon),
  resolved: S("Resolved", "success", Check),
  reopened: S("Reopened", "serious", RotateCcw),

  /* assets */
  allocated: S("Allocated", "info", Check),
  in_stock: S("In Stock", "success", Check),
  under_repair: S("Under Repair", "warning", AlertTriangle),
  retired: S("Retired", "neutral", Ban),
  lost: S("Lost", "danger", Octagon),

  /* compliance */
  filed: S("Filed", "success", Check),
  due_soon: S("Due Soon", "warning", Clock),
  overdue: S("Overdue", "danger", AlertTriangle),
  not_started: S("Not Started", "neutral", CircleDashed),

  /* goals / reviews */
  on_track: S("On Track", "success", Check),
  at_risk: S("At Risk", "warning", AlertTriangle),
  off_track: S("Off Track", "danger", Octagon),
  achieved: S("Achieved", "success", Check),
  self_pending: S("Self Review Pending", "warning", Hourglass),
  manager_pending: S("Manager Review Pending", "warning", Hourglass),
};

export function statusDef(status: string): StatusDef {
  return (
    STATUS_MAP[status] ?? {
      label: status
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      tone: "neutral" as Tone,
      icon: CircleDashed,
    }
  );
}

export function statusTone(status: string): Tone {
  return statusDef(status).tone;
}

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: string;
  /** Override the resolved label (the colour mapping still comes from `status`). */
  label?: string;
  size?: "sm" | "md";
  showIcon?: boolean;
}

export function StatusBadge({
  status,
  label,
  size = "sm",
  showIcon = true,
  className,
  ...props
}: StatusBadgeProps) {
  const def = statusDef(status);
  const Icon = def.icon;
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-md border font-medium whitespace-nowrap",
        size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-xs",
        TONE_CLASS[def.tone],
        className,
      )}
      {...props}
    >
      {showIcon && <Icon className="size-3" aria-hidden />}
      {label ?? def.label}
    </span>
  );
}

/** Small coloured dot + text, for dense table cells and legends. */
export function StatusDot({ status, className }: { status: string; className?: string }) {
  const def = statusDef(status);
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className={cn("size-1.5 rounded-full", TONE_DOT[def.tone])} aria-hidden />
      <span>{def.label}</span>
    </span>
  );
}
