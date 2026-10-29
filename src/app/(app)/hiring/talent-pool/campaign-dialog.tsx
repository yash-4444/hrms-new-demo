"use client";

import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Megaphone } from "lucide-react";

import { fmtMonth } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import { REQUISITIONS, requisitionByCode } from "@/mock/hiring";
import type { PoolCandidate } from "@/mock/lifecycle";
import { useDirtyGuard } from "@/components/lifecycle/kit";
import { Button } from "@/components/ui/button";
import { AvatarStack, Field, Input, Textarea } from "@/components/ui/primitives";
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

/* ============================================================================
   Re-engage campaign — one templated message to a slice of the talent pool,
   pointed at a live requisition. Placeholders resolve per recipient.
   ========================================================================== */

const OPEN_REQS = REQUISITIONS.filter((r) => r.status === "open" && r.approvalStatus === "approved");
const CHANNELS = ["Email", "LinkedIn InMail"] as const;

const TEMPLATE = `Hi {{first_name}},

We stayed in touch after your last conversation with us, and a role has opened that looks like a strong fit: {{role}}.

The team has grown since we last spoke and the scope is broader. Would you be open to a 20-minute catch-up this week?

Warm regards,
Talent Acquisition, Stellar Tech`;

const schema = z.object({
  name: z.string().trim().min(4, "Give the campaign a name you will recognise in reports"),
  reqCode: z.string().min(1, "Pick the requisition this campaign recruits for"),
  channel: z.enum(CHANNELS, { message: "Pick a channel" }),
  message: z
    .string()
    .trim()
    .min(40, "The message is too short to send")
    .refine((v) => v.includes("{{first_name}}"), { message: "Keep the {{first_name}} placeholder so each message is personal" }),
  sendOn: z
    .string()
    .min(1, "Pick a send date")
    .refine((v) => v >= DEMO_TODAY, { message: "The send date can't be in the past" }),
});
type Values = z.infer<typeof schema>;

export function CampaignDialog({
  open,
  onOpenChange,
  recipients,
  defaultReq,
  onSent,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recipients: PoolCandidate[];
  defaultReq?: string;
  onSent: (ids: string[], v: Values) => void;
}) {
  const reqCode0 = defaultReq ?? recipients[0]?.matches[0]?.reqCode ?? "";
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: `Silver medallist re-engage — ${fmtMonth(DEMO_TODAY)}`,
      reqCode: reqCode0,
      channel: "Email",
      message: TEMPLATE,
      sendOn: DEMO_TODAY,
    },
  });
  const { errors, isDirty } = form.formState;
  const close = () => onOpenChange(false);
  const { onOpenChange: guardedChange, guard } = useDirtyGuard(isDirty, close);

  const [reqCode, channel, message] = useWatch({ control: form.control, name: ["reqCode", "channel", "message"] });
  const role = reqCode ? (requisitionByCode(reqCode)?.role ?? "") : "";
  const first = recipients[0];
  const preview = first
    ? message.replaceAll("{{first_name}}", first.name.split(" ")[0]).replaceAll("{{role}}", role || "{{role}}")
    : message;

  const submit = form.handleSubmit((v) => {
    onSent(
      recipients.map((r) => r.id),
      v,
    );
    close();
  });

  return (
    <>
      <Dialog open={open} onOpenChange={guardedChange}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="size-4 text-primary" aria-hidden /> Re-engage campaign
            </DialogTitle>
            <DialogDescription>
              Replies land in the recruiter&apos;s inbox and move the person into the requisition&apos;s pipeline as Applied.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} noValidate>
            <DialogBody className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-2.5 rounded-md border border-border bg-muted/40 px-3 py-2 sm:col-span-2">
                <AvatarStack names={recipients.map((r) => r.name)} max={5} size={24} />
                <p className="text-xs">
                  <span className="tnum font-semibold text-foreground">{recipients.length}</span>{" "}
                  <span className="text-muted-foreground">
                    recipient{recipients.length === 1 ? "" : "s"} · {recipients.slice(0, 3).map((r) => r.name).join(", ")}
                    {recipients.length > 3 ? ` and ${recipients.length - 3} more` : ""}
                  </span>
                </p>
              </div>
              <Field label="Campaign name" htmlFor="cmp-name" required error={errors.name?.message} className="sm:col-span-2">
                <Input id="cmp-name" {...form.register("name")} aria-invalid={!!errors.name} />
              </Field>
              <Field label="Target requisition" htmlFor="cmp-req" required error={errors.reqCode?.message}>
                <Controller
                  control={form.control}
                  name="reqCode"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="cmp-req" aria-invalid={!!errors.reqCode}>
                        <SelectValue placeholder="Choose a requisition…" />
                      </SelectTrigger>
                      <SelectContent>
                        {OPEN_REQS.map((r) => (
                          <SelectItem key={r.code} value={r.code}>
                            {r.code} · {r.role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Channel" htmlFor="cmp-channel" required error={errors.channel?.message}>
                <Controller
                  control={form.control}
                  name="channel"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="cmp-channel" aria-invalid={!!errors.channel}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CHANNELS.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field
                label="Message"
                htmlFor="cmp-msg"
                required
                error={errors.message?.message}
                className="sm:col-span-2"
                hint="Placeholders: {{first_name}} and {{role}} are filled in for each recipient."
              >
                <Textarea id="cmp-msg" rows={8} className="font-mono text-xs" {...form.register("message")} aria-invalid={!!errors.message} />
              </Field>
              <Field label="Send on" htmlFor="cmp-date" required error={errors.sendOn?.message}>
                <Input id="cmp-date" type="date" min={DEMO_TODAY} {...form.register("sendOn")} aria-invalid={!!errors.sendOn} />
              </Field>
              <p className="self-end pb-2 text-[11px] text-muted-foreground">
                {channel === "LinkedIn InMail"
                  ? `Uses ${recipients.length} InMail credit${recipients.length === 1 ? "" : "s"} from the recruiter's LinkedIn seat.`
                  : "Sent from careers@stellartech.in with an unsubscribe link, per the DPDP consent on file."}
              </p>
              {first && (
                <div className="rounded-md border border-border p-3 sm:col-span-2">
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Preview for {first.name}
                  </p>
                  <p className="whitespace-pre-line text-xs text-foreground">{preview}</p>
                </div>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => guardedChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={recipients.length === 0}>
                Schedule for {recipients.length} recipient{recipients.length === 1 ? "" : "s"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}

export type CampaignValues = Values;
