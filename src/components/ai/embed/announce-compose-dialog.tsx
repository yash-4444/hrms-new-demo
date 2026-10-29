"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Megaphone, Undo2, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { num } from "@/lib/format";
import { BRANCHES } from "@/mock/org";
import { EMPLOYEES } from "@/mock/employees";
import type { AnnouncementCategory } from "@/mock/workplace";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch, Textarea } from "@/components/ui/primitives";
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
  useDiscardGuard,
} from "@/components/ui/overlays";
import { AI_TONE, AiBadge, AiDraftBanner } from "@/components/ai";
import { draftAnnouncement, type AnnounceTone } from "./announce-draft";

/* ============================================================================
   New announcement — RHF + zod with inline errors and a discard guard, plus
   "✨ Draft with AI": a topic, audience and tone become an editable draft.
   The draft fills the form only; a person still reads it and presses Publish.
   ========================================================================== */

export const ANNOUNCE_CATEGORIES: AnnouncementCategory[] = ["Policy", "People", "Benefits", "Office", "Product", "Compliance"];

/** "All employees" matches the 340 audience the seeded announcements use. */
export const ANNOUNCE_AUDIENCES: { value: string; label: string; size: number }[] = [
  { value: "All employees", label: "All employees", size: 340 },
  ...BRANCHES.map((b) => ({
    value: `${b.city} office`,
    label: `${b.city} office`,
    size: EMPLOYEES.filter((e) => e.branchId === b.id && e.status !== "exited").length,
  })).filter((a) => a.size > 0),
];

const TONES: AnnounceTone[] = ["Friendly", "Formal", "Urgent"];

const schema = z.object({
  title: z.string().trim().min(8, "Give the announcement a title of at least 8 characters").max(120, "Keep the title under 120 characters"),
  summary: z.string().trim().max(200, "Keep the summary to one line — under 200 characters"),
  body: z.string().trim().max(4000, "Body is too long — attach a document instead"),
  category: z.enum(ANNOUNCE_CATEGORIES as [AnnouncementCategory, ...AnnouncementCategory[]]),
  audience: z.string().min(1, "Pick an audience"),
  pinned: z.boolean(),
  requiresAck: z.boolean(),
});

export type AnnounceValues = z.infer<typeof schema>;

const DEFAULTS: AnnounceValues = {
  title: "",
  summary: "",
  body: "",
  category: "Office",
  audience: "All employees",
  pinned: false,
  requiresAck: true,
};

export function AnnounceComposeDialog({
  open,
  onOpenChange,
  onPublish,
  authorName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPublish: (v: AnnounceValues, audienceSize: number) => void;
  authorName: string;
}) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    getValues,
    setValue,
    formState: { errors, isDirty },
  } = useForm<AnnounceValues>({ resolver: zodResolver(schema), defaultValues: DEFAULTS });

  const [topic, setTopic] = React.useState("");
  const [tone, setTone] = React.useState<AnnounceTone>("Friendly");
  const [busy, setBusy] = React.useState(false);
  const [undo, setUndo] = React.useState<AnnounceValues | null>(null);

  React.useEffect(() => {
    if (open) {
      reset(DEFAULTS);
      setTopic("");
      setUndo(null);
    }
  }, [open, reset]);

  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);
  const { requestClose, guard } = useDiscardGuard(isDirty, close);
  const audience = watch("audience");
  const size = ANNOUNCE_AUDIENCES.find((a) => a.value === audience)?.size ?? 340;

  const draft = () => {
    if (topic.trim().length < 3) return;
    setBusy(true);
    window.setTimeout(() => {
      const v = getValues();
      setUndo(v);
      const d = draftAnnouncement({ topic, tone, audience: v.audience, category: v.category, author: authorName });
      setValue("title", d.title, { shouldDirty: true, shouldValidate: true });
      setValue("summary", d.summary, { shouldDirty: true });
      setValue("body", d.body, { shouldDirty: true });
      setValue("category", d.category, { shouldDirty: true });
      setBusy(false);
    }, 650);
  };

  const submit = handleSubmit((v) => {
    onPublish(v, size);
    close();
  });

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : requestClose())}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>New announcement</DialogTitle>
            <DialogDescription>Published immediately to the selected audience. Separate paragraphs with a blank line.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <DialogBody className="flex flex-col gap-3">
              <div className={cn("flex flex-col gap-2 rounded-md border p-3", AI_TONE.soft)}>
                <div className="flex items-center gap-2">
                  <AiBadge label="Draft with AI" />
                  <span className="text-[11px] text-muted-foreground">Describe the news; AI writes a title, summary and body you can edit.</span>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <Input
                    aria-label="What is the announcement about?"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        draft();
                      }
                    }}
                    placeholder="e.g. Pune office moving to the new Hinjewadi campus on 5 Oct"
                    className="min-w-[220px] flex-1"
                  />
                  <Select value={tone} onValueChange={(v) => setTone(v as AnnounceTone)}>
                    <SelectTrigger aria-label="Tone" className="w-[120px]">
                      <span className="text-xs">{tone}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {TONES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" size="sm" className={AI_TONE.solid} onClick={draft} disabled={busy || topic.trim().length < 3}>
                    {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Wand2 aria-hidden />}
                    ✨ Draft with AI
                  </Button>
                </div>
                {undo && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <AiDraftBanner className="flex-1">
                      AI draft for “{audience}” in a {tone.toLowerCase()} tone — check dates, names and facts before publishing.
                    </AiDraftBanner>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        reset(undo, { keepDefaultValues: true });
                        setUndo(null);
                      }}
                    >
                      <Undo2 aria-hidden /> Undo draft
                    </Button>
                  </div>
                )}
              </div>

              <Field label="Title" htmlFor="ann-title" required error={errors.title?.message}>
                <Input id="ann-title" aria-invalid={!!errors.title} placeholder="Deepavali holiday calendar published" {...register("title")} />
              </Field>
              <Field label="Summary" htmlFor="ann-summary" hint="One line shown in the feed and in the notification." error={errors.summary?.message}>
                <Input id="ann-summary" aria-invalid={!!errors.summary} placeholder="08 and 09 November are company holidays across both Indian branches." {...register("summary")} />
              </Field>
              <Field label="Body" htmlFor="ann-body" error={errors.body?.message}>
                <Textarea id="ann-body" aria-invalid={!!errors.body} className="min-h-[140px]" placeholder={"First paragraph.\n\nSecond paragraph."} {...register("body")} />
              </Field>

              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Category" htmlFor="ann-cat" required>
                  <Controller
                    control={control}
                    name="category"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="ann-cat">
                          <span className="text-xs">{field.value}</span>
                        </SelectTrigger>
                        <SelectContent>
                          {ANNOUNCE_CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <Field label="Audience" htmlFor="ann-aud" required error={errors.audience?.message} hint={`${num(size)} recipients`}>
                  <Controller
                    control={control}
                    name="audience"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="ann-aud">
                          <span className="truncate text-xs">{field.value}</span>
                        </SelectTrigger>
                        <SelectContent>
                          {ANNOUNCE_AUDIENCES.map((a) => (
                            <SelectItem key={a.value} value={a.value}>
                              {a.label} · {num(a.size)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <div className="flex flex-col justify-end gap-2">
                  <Controller
                    control={control}
                    name="pinned"
                    render={({ field }) => (
                      <label className="flex cursor-pointer items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5">
                        <span className="text-xs">Pin to the top</span>
                        <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Pin to the top" />
                      </label>
                    )}
                  />
                  <Controller
                    control={control}
                    name="requiresAck"
                    render={({ field }) => (
                      <label className="flex cursor-pointer items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5">
                        <span className="text-xs">Require acknowledgement</span>
                        <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Require acknowledgement" />
                      </label>
                    )}
                  />
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={requestClose}>
                Cancel
              </Button>
              <Button type="submit">
                <Megaphone /> Publish to {num(size)} employees
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}
