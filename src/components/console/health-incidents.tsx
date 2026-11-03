"use client";

import * as React from "react";
import Link from "next/link";
import { Check, CircleDot, Eye, Megaphone, Search, ShieldCheck } from "lucide-react";
import { fmtAgo, fmtDateTime, hm } from "@/lib/format";
import { differenceInMinutes, parseISO } from "date-fns";
import type { Incident, IncidentStatus, Severity } from "@/mock/console-health";
import { TonePill, type PTone } from "@/components/platform/kit";
import { Section } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Label, Textarea } from "@/components/ui/primitives";
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

/* System Health — incidents and their status-page updates. */

export const INCIDENT_STYLE: Record<IncidentStatus, { label: string; tone: PTone; icon: React.ElementType }> = {
  investigating: { label: "Investigating", tone: "danger", icon: Search },
  identified: { label: "Identified", tone: "warning", icon: CircleDot },
  monitoring: { label: "Monitoring", tone: "info", icon: Eye },
  resolved: { label: "Resolved", tone: "success", icon: Check },
};

const SEV_TONE: Record<Severity, PTone> = { SEV1: "danger", SEV2: "serious", SEV3: "warning" };

export function IncidentsSection({ incidents, onPost }: { incidents: Incident[]; onPost: (id: string) => void }) {
  return (
    <Section title="Incidents" description="Open incidents first. Updates go to the status page and, optionally, to affected tenant admins." bodyClassName="p-0">
      <ul className="divide-y divide-border">
        {incidents.map((i) => {
          const s = INCIDENT_STYLE[i.status];
          const latest = i.updates[0];
          return (
            <li key={i.id} className="flex flex-col gap-1.5 px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5">
                    <TonePill tone={SEV_TONE[i.severity]}>{i.severity}</TonePill>
                    <TonePill tone={s.tone} icon={s.icon}>
                      {s.label}
                    </TonePill>
                    <span className="text-xs font-medium text-foreground">{i.title}</span>
                  </p>
                  <p className="tnum mt-1 text-[11px] text-muted-foreground">
                    <span className="font-mono">{i.id}</span> · started {fmtDateTime(i.startedAt)}
                    {i.resolvedAt ? ` · resolved in ${hm(differenceInMinutes(parseISO(i.resolvedAt), parseISO(i.startedAt)))}` : ` · open ${fmtAgo(i.startedAt).replace(" ago", "")}`}
                    {" · "}
                    {i.services.join(", ")}
                    {i.tenantIds.map((t) => (
                      <React.Fragment key={t}>
                        {" · "}
                        <Link href={`/console/tenants/${t}`} className="font-mono hover:underline">
                          {t}
                        </Link>
                      </React.Fragment>
                    ))}
                  </p>
                </div>
                {i.status !== "resolved" && (
                  <Button size="sm" variant="outline" onClick={() => onPost(i.id)}>
                    <Megaphone /> Post update
                  </Button>
                )}
              </div>
              {latest && (
                <p className="rounded-md bg-subtle px-2.5 py-1.5 text-xs text-foreground">
                  {latest.message}
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {INCIDENT_STYLE[latest.status].label} · {latest.author}, {fmtAgo(latest.at)}
                    {i.updates.length > 1 && ` · ${i.updates.length - 1} earlier update${i.updates.length === 2 ? "" : "s"}`}
                  </span>
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/** Rendered only while open, so each opening starts from the incident's current status. */
export function PostUpdateDialog({
  incidents,
  initialId,
  onOpenChange,
  onPost,
}: {
  incidents: Incident[];
  initialId: string;
  onOpenChange: (v: boolean) => void;
  onPost: (id: string, status: IncidentStatus, message: string, notify: boolean) => void;
}) {
  const open = incidents.filter((i) => i.status !== "resolved");
  const [id, setId] = React.useState(initialId);
  const current = open.find((i) => i.id === id);
  const [status, setStatus] = React.useState<IncidentStatus>(current?.status ?? "investigating");
  const [message, setMessage] = React.useState("");
  const [notify, setNotify] = React.useState(true);
  const [touched, setTouched] = React.useState(false);
  const msgError = message.trim().length < 10 ? "Write at least a sentence (10+ characters)." : undefined;
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Post status update</DialogTitle>
          <DialogDescription>Published to status.hrms-new.app immediately and kept on the incident&apos;s timeline. Write for tenant admins, not engineers.</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-3 sm:grid-cols-2">
          <Field label="Incident" required className="sm:col-span-2">
            <Select
              value={id}
              onValueChange={(v) => {
                setId(v);
                setStatus(open.find((i) => i.id === v)?.status ?? "investigating");
              }}
            >
              <SelectTrigger aria-label="Incident">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {open.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.id} — {i.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="New status" required>
            <Select value={status} onValueChange={(v) => setStatus(v as IncidentStatus)}>
              <SelectTrigger aria-label="New status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(INCIDENT_STYLE) as IncidentStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {INCIDENT_STYLE[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="flex items-end gap-2 pb-1.5">
            <Checkbox id="pu-notify" checked={notify} onCheckedChange={(v) => setNotify(v === true)} />
            <Label htmlFor="pu-notify" className="text-xs font-normal leading-snug">
              Email admins of {current?.tenantIds.length ? `the ${current.tenantIds.length} affected tenant${current.tenantIds.length === 1 ? "" : "s"}` : "every live tenant"}
            </Label>
          </div>
          <Field label="Update" htmlFor="pu-msg" required error={touched ? msgError : undefined} className="sm:col-span-2">
            <Textarea id="pu-msg" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What is affected, what we are doing, and when the next update is due." aria-invalid={touched && !!msgError} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!current}
            onClick={() => {
              setTouched(true);
              if (msgError || !current) return;
              onPost(current.id, status, message.trim(), notify);
            }}
          >
            {status === "resolved" ? <ShieldCheck /> : <Megaphone />} {status === "resolved" ? "Resolve & publish" : "Publish update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
