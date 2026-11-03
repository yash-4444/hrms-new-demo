"use client";

import * as React from "react";
import { AlertTriangle, CalendarClock, Info, Megaphone, Rocket, ScrollText, ShieldAlert, Wrench, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "@/lib/format";
import {
  SEVERITY_LABEL,
  TYPE_LABEL,
  type AnnouncementSeverity,
  type AnnouncementStatus,
  type AnnouncementType,
} from "@/mock/console-announcements";
import { TonePill, type PTone } from "@/components/platform/kit";

/* Announcements — the bits shared by the list and the composer: type and
   severity pills, and the two previews (the in-app banner a tenant admin sees
   and the email the tenant owner receives). */

export const TYPE_ICON: Record<AnnouncementType, React.ElementType> = {
  maintenance: Wrench,
  release: Rocket,
  incident: ShieldAlert,
  policy: ScrollText,
};

const SEVERITY_TONE: Record<AnnouncementSeverity, PTone> = { info: "info", warning: "warning", critical: "danger" };
const SEVERITY_ICON: Record<AnnouncementSeverity, React.ElementType> = { info: Info, warning: AlertTriangle, critical: ShieldAlert };

export function SeverityPill({ severity }: { severity: AnnouncementSeverity }) {
  return (
    <TonePill tone={SEVERITY_TONE[severity]} icon={SEVERITY_ICON[severity]}>
      {SEVERITY_LABEL[severity]}
    </TonePill>
  );
}

export function TypePill({ type }: { type: AnnouncementType }) {
  return (
    <TonePill tone="neutral" icon={TYPE_ICON[type]}>
      {TYPE_LABEL[type]}
    </TonePill>
  );
}

const STATUS_STYLE: Record<AnnouncementStatus, { tone: PTone; label: string }> = {
  scheduled: { tone: "info", label: "Scheduled" },
  live: { tone: "success", label: "Live" },
  past: { tone: "neutral", label: "Past" },
};

export function AnnouncementStatusPill({ status, endedEarly }: { status: AnnouncementStatus; endedEarly?: boolean }) {
  const s = STATUS_STYLE[status];
  return (
    <TonePill tone={s.tone} icon={status === "scheduled" ? CalendarClock : status === "live" ? Megaphone : undefined}>
      {endedEarly ? "Ended early" : s.label}
    </TonePill>
  );
}

const BANNER_CLASS: Record<AnnouncementSeverity, string> = {
  info: "border-info/30 bg-info-soft text-info-fg",
  warning: "border-warning/40 bg-warning-soft text-warning-fg",
  critical: "border-destructive/30 bg-destructive-soft text-destructive-fg",
};

export interface PreviewProps {
  type: AnnouncementType;
  severity: AnnouncementSeverity;
  title: string;
  body: string;
  window?: { start: string; end: string };
  requiresAck: boolean;
}

/** The strip a tenant admin sees across the top of every screen. */
export function BannerPreview({ type, severity, title, body, window, requiresAck }: PreviewProps) {
  const Icon = TYPE_ICON[type];
  return (
    <div className={cn("flex items-start gap-2.5 rounded-md border px-3 py-2 text-xs", BANNER_CLASS[severity])}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title || "Your headline appears here"}</p>
        <p className="mt-0.5 line-clamp-2 opacity-90">{body || "The first two lines of the message show in the banner; admins open the rest."}</p>
        {window && (
          <p className="mt-1 font-medium">
            Window: {fmtDateTime(window.start)} – {fmtDateTime(window.end)}
          </p>
        )}
        <p className="mt-1.5 flex gap-3 font-medium underline-offset-2">
          <span className="underline">Read more</span>
          {requiresAck && <span className="underline">Acknowledge</span>}
        </p>
      </div>
      <X className="size-3.5 shrink-0 opacity-60" aria-hidden />
    </div>
  );
}

/** The email the tenant owner receives, from platform-ops@hrms-new.app. */
export function EmailPreview({ type, title, body, window, requiresAck, ownerName = "Ramesh Subramanian" }: PreviewProps & { ownerName?: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card text-xs">
      <dl className="grid grid-cols-[56px_minmax(0,1fr)] gap-y-0.5 border-b border-border bg-subtle px-3 py-2 text-[11px]">
        <dt className="text-muted-foreground">From</dt>
        <dd className="truncate">HRMS-NEW Platform &lt;platform-ops@hrms-new.app&gt;</dd>
        <dt className="text-muted-foreground">To</dt>
        <dd className="truncate">{ownerName} (tenant owner)</dd>
        <dt className="text-muted-foreground">Subject</dt>
        <dd className="truncate font-medium">
          [{TYPE_LABEL[type]}] {title || "Your headline"}
        </dd>
      </dl>
      <div className="flex flex-col gap-2 px-3 py-3 leading-relaxed">
        <p>Hello {ownerName.split(" ")[0]},</p>
        <p className="whitespace-pre-line">{body || "Your message body appears here."}</p>
        {window && (
          <p className="rounded-md border border-border bg-subtle px-2 py-1.5">
            <span className="font-medium">Maintenance window:</span> {fmtDateTime(window.start)} – {fmtDateTime(window.end)}
          </p>
        )}
        {requiresAck && (
          <span className="w-fit rounded-md bg-primary px-2.5 py-1 font-medium text-primary-foreground">Acknowledge for your organisation</span>
        )}
        <p className="text-muted-foreground">— The HRMS-NEW platform team</p>
      </div>
      <p className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
        Service email — sent to every tenant owner in the audience, regardless of marketing preferences.
      </p>
    </div>
  );
}
