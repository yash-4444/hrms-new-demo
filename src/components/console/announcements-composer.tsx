"use client";

import * as React from "react";
import { Mail, Megaphone, Send, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { num } from "@/lib/format";
import { PLATFORM_PERSONA } from "@/lib/rbac";
import { COUNTRY_META, CONSOLE_NOW, PLAN_META, type PlanId, type TenantCountry } from "@/mock/console-tenants";
import {
  CHANNEL_LABEL,
  SEVERITY_LABEL,
  TYPE_LABEL,
  audienceTenants,
  type Announcement,
  type AnnouncementChannel,
  type AnnouncementSeverity,
  type AnnouncementType,
  type Audience,
  type AudienceKind,
} from "@/mock/console-announcements";
import { useConsole } from "@/components/console/console-state";
import { TenantMultiSelect } from "@/components/console/tenant-multi-select";
import { BannerPreview, EmailPreview } from "@/components/console/announcements-preview";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Switch, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";

/* Compose (or edit, or duplicate) an announcement, with a live preview of the
   banner and the email beside the form. Datetimes are the console's local
   wall clock, like every other console timestamp. */

const local = (iso: string) => iso.slice(0, 16);
const full = (v: string) => (v.length === 16 ? `${v}:00` : v);

function Chips<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md border px-2.5 py-1 text-xs focus-visible:ring-2 focus-visible:ring-ring",
            value === o.value ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border hover:bg-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const opts = <T extends string>(m: Record<T, string>) => (Object.keys(m) as T[]).map((k) => ({ value: k, label: m[k] }));

export function AnnouncementComposer({
  initial,
  mode,
  onOpenChange,
  onSave,
}: {
  initial?: Announcement;
  mode: "new" | "edit" | "duplicate";
  onOpenChange: (v: boolean) => void;
  onSave: (a: Announcement) => void;
}) {
  const { tenants } = useConsole();
  const [type, setType] = React.useState<AnnouncementType>(initial?.type ?? "maintenance");
  const [title, setTitle] = React.useState(initial ? (mode === "duplicate" ? `${initial.title} (copy)` : initial.title) : "");
  const [body, setBody] = React.useState(initial?.body ?? "");
  const [severity, setSeverity] = React.useState<AnnouncementSeverity>(initial?.severity ?? "warning");
  const [audience, setAudience] = React.useState<Audience>(initial?.audience ?? { kind: "all", plans: [], countries: [], tenantIds: [] });
  const [channel, setChannel] = React.useState<AnnouncementChannel>(initial?.channel ?? "both");
  const [when, setWhen] = React.useState<"now" | "at">(mode === "edit" ? "at" : "now");
  const [publishAt, setPublishAt] = React.useState(mode === "edit" && initial ? local(initial.publishAt) : "2026-09-17T09:00");
  const [expiresAt, setExpiresAt] = React.useState(mode === "edit" && initial ? local(initial.expiresAt) : "2026-09-23T09:00");
  const [winStart, setWinStart] = React.useState(initial?.window && mode === "edit" ? local(initial.window.start) : "2026-09-27T02:00");
  const [winEnd, setWinEnd] = React.useState(initial?.window && mode === "edit" ? local(initial.window.end) : "2026-09-27T04:00");
  const [requiresAck, setRequiresAck] = React.useState(initial?.requiresAck ?? false);
  const [touched, setTouched] = React.useState(false);

  const maintenance = type === "maintenance";
  const start = when === "now" ? CONSOLE_NOW : full(publishAt);
  const end = maintenance ? full(winEnd) : full(expiresAt);
  const recipients = audienceTenants(audience, tenants);
  const errors = {
    title: title.trim().length < 5 ? "A headline of at least 5 characters." : undefined,
    body: body.trim().length < 20 ? "Say what changes and what tenants should do (20+ characters)." : undefined,
    audience: recipients.length === 0 ? "Pick at least one plan, region or tenant." : undefined,
    publish: when === "at" && start <= CONSOLE_NOW ? "Schedule it in the future, or choose Publish now." : undefined,
    window: maintenance && (full(winEnd) <= full(winStart) || full(winStart) < start) ? "The window must end after it starts, and start after publishing." : undefined,
    expires: !maintenance && end <= start ? "The banner must come down after it goes up." : undefined,
  };
  const valid = Object.values(errors).every((e) => !e);
  const err = (k: keyof typeof errors) => (touched ? errors[k] : undefined);

  const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    onSave({
      id: mode === "edit" && initial ? initial.id : "",
      type,
      title: title.trim(),
      body: body.trim(),
      severity,
      audience,
      channel,
      publishAt: start,
      expiresAt: end,
      window: maintenance ? { start: full(winStart), end: full(winEnd) } : undefined,
      requiresAck,
      createdBy: mode === "edit" && initial ? initial.createdBy : PLATFORM_PERSONA.name,
    });
  };

  const preview = { type, severity, title, body, requiresAck, window: maintenance ? { start: full(winStart), end: full(winEnd) } : undefined };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="size-4" aria-hidden />
            {mode === "edit" ? `Edit ${initial?.id}` : mode === "duplicate" ? "Duplicate announcement" : "New announcement"}
          </DialogTitle>
          <DialogDescription>Shown to tenant admins and owners only — employees never see platform announcements.</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <div className="flex flex-col gap-3.5">
            <Field label="Type" required>
              <Chips label="Type" value={type} options={opts(TYPE_LABEL)} onChange={setType} />
            </Field>
            <Field label="Headline" htmlFor="ann-title" required error={err("title")}>
              <Input id="ann-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} aria-invalid={!!err("title")} placeholder="e.g. Planned maintenance — Sunday 27 Sep, 02:00–04:00 IST" />
            </Field>
            <Field label="Message" htmlFor="ann-body" required error={err("body")}>
              <Textarea id="ann-body" value={body} onChange={(e) => setBody(e.target.value)} rows={4} aria-invalid={!!err("body")} />
            </Field>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Severity" required>
                <Chips label="Severity" value={severity} options={opts(SEVERITY_LABEL)} onChange={setSeverity} />
              </Field>
              <Field label="Channel" required>
                <Chips label="Channel" value={channel} options={opts(CHANNEL_LABEL)} onChange={setChannel} />
              </Field>
            </div>
            <Field label="Audience" required error={err("audience")} hint={<span className="tnum">{num(recipients.length)} tenant{recipients.length === 1 ? "" : "s"} will receive it</span>}>
              <Chips<AudienceKind>
                label="Audience"
                value={audience.kind}
                options={[
                  { value: "all", label: "All tenants" },
                  { value: "plan", label: "By plan" },
                  { value: "country", label: "By country" },
                  { value: "tenants", label: "Specific tenants" },
                ]}
                onChange={(kind) => setAudience({ ...audience, kind })}
              />
              {audience.kind === "plan" && (
                <div className="flex flex-wrap gap-3 pt-1">
                  {(Object.keys(PLAN_META) as PlanId[]).map((p) => (
                    <label key={p} className="flex items-center gap-1.5 text-xs">
                      <Checkbox checked={audience.plans.includes(p)} onCheckedChange={() => setAudience({ ...audience, plans: toggleIn(audience.plans, p) })} />
                      {PLAN_META[p].label}
                    </label>
                  ))}
                </div>
              )}
              {audience.kind === "country" && (
                <div className="flex flex-wrap gap-3 pt-1">
                  {(Object.keys(COUNTRY_META) as TenantCountry[]).map((c) => (
                    <label key={c} className="flex items-center gap-1.5 text-xs">
                      <Checkbox checked={audience.countries.includes(c)} onCheckedChange={() => setAudience({ ...audience, countries: toggleIn(audience.countries, c) })} />
                      {COUNTRY_META[c].label}
                    </label>
                  ))}
                </div>
              )}
              {audience.kind === "tenants" && (
                <TenantMultiSelect tenants={tenants} value={audience.tenantIds} onChange={(tenantIds) => setAudience({ ...audience, tenantIds })} invalid={!!err("audience")} />
              )}
            </Field>
            <Field label="Publish" required error={err("publish")}>
              <Chips label="Publish" value={when} options={[{ value: "now", label: "Publish now" }, { value: "at", label: "Schedule" }]} onChange={setWhen} />
              {when === "at" && <Input type="datetime-local" aria-label="Publish at" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} className="sm:w-60" />}
            </Field>
            {maintenance ? (
              <Field label="Maintenance window" required error={err("window")} hint="The banner stays up until the window closes.">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input type="datetime-local" aria-label="Window starts" value={winStart} onChange={(e) => setWinStart(e.target.value)} />
                  <Input type="datetime-local" aria-label="Window ends" value={winEnd} onChange={(e) => setWinEnd(e.target.value)} />
                </div>
              </Field>
            ) : (
              <Field label="Take the banner down at" htmlFor="ann-exp" required error={err("expires")}>
                <Input id="ann-exp" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="sm:w-60" />
              </Field>
            )}
            <label className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-xs">
              <span>
                <span className="font-medium">Require acknowledgement</span>
                <span className="block text-muted-foreground">An admin must confirm on behalf of the organisation; the rate is tracked.</span>
              </span>
              <Switch checked={requiresAck} onCheckedChange={setRequiresAck} aria-label="Require acknowledgement" />
            </label>
          </div>

          <div className="flex flex-col gap-3 lg:sticky lg:top-0 lg:self-start">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Live preview</p>
            {channel !== "email" && (
              <div className="flex flex-col gap-1.5">
                <p className="flex items-center gap-1.5 text-xs font-medium"><Users className="size-3.5" aria-hidden /> In-app banner</p>
                <BannerPreview {...preview} />
              </div>
            )}
            {channel !== "banner" && (
              <div className="flex flex-col gap-1.5">
                <p className="flex items-center gap-1.5 text-xs font-medium"><Mail className="size-3.5" aria-hidden /> Email to tenant owners</p>
                <EmailPreview {...preview} ownerName={recipients[0]?.ownerName} />
              </div>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={touched && !valid} onClick={submit}>
            <Send /> {mode === "edit" ? "Save changes" : when === "now" ? `Publish to ${num(recipients.length)} tenants` : "Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
