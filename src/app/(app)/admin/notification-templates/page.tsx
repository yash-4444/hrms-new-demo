"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Bell, Braces, Mail, MessageCircle, Save, Send, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "@/lib/format";
import { CHANNEL_LABEL, NOTIFY_EVENTS, NOTIFY_TEMPLATES, type NotifyChannel, type NotifyTemplate } from "@/mock/platform";
import { mockAction, useApp } from "@/components/app-state";
import { Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Badge, Field, Input, Label, Switch, Tabs, TabsList, TabsTrigger, Textarea } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/overlays";
import { TonePill } from "@/components/platform/kit";

const CHANNEL_ICON: Record<NotifyChannel, React.ElementType> = { email: Mail, in_app: Bell, whatsapp: MessageCircle, teams: Users };
const LIMITS: Record<NotifyChannel, number> = { email: 4000, in_app: 280, whatsapp: 1024, teams: 2000 };

const render = (text: string, sample: Record<string, string>) => text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k: string) => sample[k] ?? `{{${k}}}`);

export default function NotificationTemplatesPage() {
  const loading = useFakeLoad();
  const { can, persona } = useApp();
  const [templates, setTemplates] = React.useState<NotifyTemplate[]>(NOTIFY_TEMPLATES);
  const [eventId, setEventId] = React.useState(NOTIFY_EVENTS[0].id);
  const [channel, setChannel] = React.useState<NotifyChannel>("email");
  const [pendingNav, setPendingNav] = React.useState<{ eventId: string; channel: NotifyChannel } | null>(null);

  const event = NOTIFY_EVENTS.find((e) => e.id === eventId)!;
  const tpl = templates.find((t) => t.eventId === eventId && t.channel === channel)!;
  const readOnly = !can("admin.notification_templates", "E");

  const schema = React.useMemo(
    () =>
      z.object({
        subject: z.string().trim().min(3, "A subject or title is required").max(140, "Keep it under 140 characters"),
        body: z
          .string()
          .trim()
          .min(10, "The message is too short")
          .max(LIMITS[channel], `${CHANNEL_LABEL[channel]} messages are limited to ${LIMITS[channel]} characters`)
          .refine((b) => (b.match(/\{\{\s*([\w.]+)\s*\}\}/g) ?? []).every((t) => event.tokens.includes(t.replace(/[{}\s]/g, ""))), "Uses a token this event does not provide"),
        enabled: z.boolean(),
      }),
    [channel, event],
  );
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({ resolver: zodResolver(schema), values: { subject: tpl.subject, body: tpl.body, enabled: tpl.enabled } });
  const bodyRef = React.useRef<HTMLTextAreaElement | null>(null);
  const subject = form.watch("subject");
  const body = form.watch("body");
  const enabled = form.watch("enabled");
  const errors = form.formState.errors;

  const go = (next: { eventId: string; channel: NotifyChannel }) => {
    if (form.formState.isDirty) setPendingNav(next);
    else {
      setEventId(next.eventId);
      setChannel(next.channel);
    }
  };

  const insertToken = (t: string) => {
    const el = bodyRef.current;
    const token = `{{${t}}}`;
    const cur = form.getValues("body");
    const at = el?.selectionStart ?? cur.length;
    form.setValue("body", cur.slice(0, at) + token + cur.slice(el?.selectionEnd ?? at), { shouldDirty: true, shouldValidate: true });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + token.length, at + token.length);
    });
  };

  const save = form.handleSubmit((v) => {
    setTemplates((prev) => prev.map((t) => (t.id === tpl.id ? { ...t, ...v, updatedAt: "2026-09-16T14:35:00", updatedBy: persona.name } : t)));
    form.reset(v);
    mockAction(`${event.label} · ${CHANNEL_LABEL[channel]} template saved`, { description: v.enabled ? "Live for the next event." : "Saved but disabled — this channel will be skipped." });
  });

  const { ref: bodyFormRef, ...bodyReg } = form.register("body");

  return (
    <PageBody>
      <PageHeader
        title="Notification Templates"
        description="What employees receive for each event, on each channel. Tokens in {{double braces}} are filled per recipient; WhatsApp templates must also be approved by Meta before they go live."
      />

      {loading ? (
        <TableSkeleton rows={6} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
          <Section title="Events" bodyClassName="p-2">
            <nav aria-label="Notification events" className="flex flex-col gap-0.5">
              {NOTIFY_EVENTS.map((e) => {
                const on = templates.filter((t) => t.eventId === e.id && t.enabled).length;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => go({ eventId: e.id, channel })}
                    aria-current={e.id === eventId ? "true" : undefined}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      e.id === eventId && "bg-primary-soft text-primary-soft-foreground",
                    )}
                  >
                    <span>
                      <span className="block font-medium">{e.label}</span>
                      <span className="text-[11px] text-muted-foreground">{e.module}</span>
                    </span>
                    <Badge variant="muted" className="tnum">{on}/4</Badge>
                  </button>
                );
              })}
            </nav>
          </Section>

          <form onSubmit={save} noValidate className="flex min-w-0 flex-col gap-4">
            <Tabs value={channel} onValueChange={(v) => go({ eventId, channel: v as NotifyChannel })}>
              <TabsList>
                {(Object.keys(CHANNEL_LABEL) as NotifyChannel[]).map((c) => {
                  const Icon = CHANNEL_ICON[c];
                  return (
                    <TabsTrigger key={c} value={c}>
                      <Icon className="size-3.5" aria-hidden /> {CHANNEL_LABEL[c]}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">
              <Section
                title={`${event.label} · ${CHANNEL_LABEL[channel]}`}
                description={`Last edited ${fmtDateTime(tpl.updatedAt)} by ${tpl.updatedBy}`}
                actions={
                  <div className="flex items-center gap-2">
                    <Switch id="tpl-enabled" checked={enabled} disabled={readOnly} onCheckedChange={(v) => form.setValue("enabled", v, { shouldDirty: true })} />
                    <Label htmlFor="tpl-enabled">{enabled ? "Enabled" : "Disabled"}</Label>
                  </div>
                }
              >
                <div className="flex flex-col gap-3">
                  <Field label={channel === "email" ? "Subject" : "Title"} htmlFor="tpl-subject" required error={errors.subject?.message}>
                    <Input id="tpl-subject" readOnly={readOnly} {...form.register("subject")} aria-invalid={!!errors.subject} />
                  </Field>
                  <Field label="Message" htmlFor="tpl-body" required error={errors.body?.message} hint={`${body.length} / ${LIMITS[channel]} characters`}>
                    <Textarea
                      id="tpl-body"
                      rows={channel === "email" ? 9 : 5}
                      readOnly={readOnly}
                      className="font-mono text-xs"
                      {...bodyReg}
                      ref={(el) => {
                        bodyFormRef(el);
                        bodyRef.current = el;
                      }}
                      aria-invalid={!!errors.body}
                    />
                  </Field>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        mockAction(`Test ${CHANNEL_LABEL[channel]} sent to ${persona.name}`, {
                          description: channel === "email" ? persona.email : channel === "whatsapp" ? "+91 98•••• 4210 (sandbox number)" : "Your in-app inbox",
                          tone: "info",
                        })
                      }
                    >
                      <Send /> Send test
                    </Button>
                    <Gated menuKey="admin.notification_templates" action="E">
                      <Button type="submit" size="sm" disabled={!form.formState.isDirty}>
                        <Save /> Save template
                      </Button>
                    </Gated>
                  </div>
                </div>
              </Section>

              <div className="flex flex-col gap-4">
                <Section title="Tokens" description={readOnly ? "Available for this event." : "Click to insert at the cursor."}>
                  <div className="flex flex-wrap gap-1.5">
                    {event.tokens.map((t) => (
                      <Button key={t} type="button" size="sm" variant="soft" className="font-mono text-[11px]" disabled={readOnly} onClick={() => insertToken(t)}>
                        <Braces /> {t}
                      </Button>
                    ))}
                  </div>
                </Section>
                <Section title="Preview" description="Filled with sample data.">
                  <div className="rounded-md border border-border bg-subtle p-3 text-xs">
                    {!enabled && <TonePill tone="neutral" className="mb-2">Disabled — not sent</TonePill>}
                    <p className="font-semibold">{render(subject, event.sample)}</p>
                    <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{render(body, event.sample)}</p>
                  </div>
                </Section>
              </div>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingNav}
        onOpenChange={(v) => !v && setPendingNav(null)}
        title="Discard unsaved changes?"
        description="You edited this template but did not save it."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => {
          if (!pendingNav) return;
          setEventId(pendingNav.eventId);
          setChannel(pendingNav.channel);
        }}
      />
    </PageBody>
  );
}
