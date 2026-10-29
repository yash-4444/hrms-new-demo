"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sparkles } from "lucide-react";
import { DEPARTMENTS } from "@/mock/org";
import { AI_TONE, AiDraftBanner, AiSuggestionCard } from "@/components/ai";
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
  SelectValue,
} from "@/components/ui/overlays";
import { useDirtyGuard } from "./kit";

const schema = z
  .object({
    text: z.string().trim().min(10, "Write at least 10 characters").max(1200, "Keep it under 1,200 characters"),
    audience: z.string().min(1),
    withPoll: z.boolean(),
    question: z.string().trim(),
    optionA: z.string().trim(),
    optionB: z.string().trim(),
    optionC: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    if (!v.withPoll) return;
    if (v.question.length < 5) ctx.addIssue({ code: "custom", path: ["question"], message: "Ask a question (5+ characters)" });
    if (!v.optionA) ctx.addIssue({ code: "custom", path: ["optionA"], message: "Option 1 is required" });
    if (!v.optionB) ctx.addIssue({ code: "custom", path: ["optionB"], message: "Option 2 is required" });
  });

export type ComposeValues = z.infer<typeof schema>;

const DEFAULTS: ComposeValues = { text: "", audience: "Everyone", withPoll: false, question: "", optionA: "", optionB: "", optionC: "" };

/** Deterministic "AI" rewrite: tidies casing and shorthand, adds a hook and a call to action. */
export function improvePost(text: string) {
  let t = text
    .replace(/\s+/g, " ")
    .replace(/\bpls\b|\bplz\b/gi, "please")
    .replace(/\bu\b/gi, "you")
    .replace(/\bthx\b|\bthnx\b/gi, "thanks")
    .replace(/!{2,}/g, "!")
    .trim();
  t = t.replace(/(^|[.!?]\s+)([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase());
  if (!/[.!?]$/.test(t)) t += ".";
  const m = /^([^.!?]*[.!?])\s+([\s\S]*)$/.exec(t);
  const lead = m ? m[1] : t;
  const rest = m ? m[2] : "";
  const hook = /thank|shipped|launched|crossed|welcome/i.test(t) ? "🎉 " : "📣 ";
  const cta = t.includes("?") ? "" : "\n\nQuestions or ideas? Drop them in the comments.";
  return `${hook}${lead}${rest ? `\n\n${rest}` : ""}${cta}`;
}

export function ComposeDialog({
  open,
  onOpenChange,
  onPublish,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPublish: (v: ComposeValues) => void;
}) {
  const form = useForm<ComposeValues>({ resolver: zodResolver(schema), defaultValues: DEFAULTS });
  const [suggestion, setSuggestion] = React.useState<string | null>(null);
  const [aiUsed, setAiUsed] = React.useState(false);
  const close = () => {
    onOpenChange(false);
    form.reset(DEFAULTS);
    setSuggestion(null);
    setAiUsed(false);
  };
  const { onOpenChange: guardedChange, guard } = useDirtyGuard(form.formState.isDirty, close);
  const withPoll = form.watch("withPoll");
  const text = form.watch("text");
  const errors = form.formState.errors;

  const submit = form.handleSubmit((v) => {
    onPublish(v);
    close();
  });

  return (
    <>
      <Dialog open={open} onOpenChange={guardedChange}>
        <DialogContent size="lg">
          <form onSubmit={submit} noValidate>
            <DialogHeader>
              <DialogTitle>New post</DialogTitle>
              <DialogDescription>Shared on the company feed. Be kind — HR moderates flagged posts.</DialogDescription>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-3">
              {aiUsed && <AiDraftBanner>AI-improved text — check it still says what you meant before posting.</AiDraftBanner>}
              <Field label="Post" htmlFor="post-text" required error={errors.text?.message} hint={`${text.length} / 1,200`}>
                <Textarea id="post-text" rows={5} placeholder="Share an update, a win or a question…" aria-invalid={!!errors.text} {...form.register("text")} />
              </Field>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={AI_TONE.text}
                  disabled={text.trim().length < 10}
                  onClick={() => setSuggestion(improvePost(text))}
                >
                  <Sparkles /> Improve with AI
                </Button>
                <span className="text-[11px] text-muted-foreground">Rewrites for clarity and tone. Nothing is posted until you click Publish.</span>
              </div>
              {suggestion && (
                <AiSuggestionCard
                  title="Suggested rewrite"
                  confidence={82}
                  body={<p className="whitespace-pre-line">{suggestion}</p>}
                  acceptLabel="Use this text"
                  onAccept={() => {
                    form.setValue("text", suggestion, { shouldDirty: true, shouldValidate: true });
                    setSuggestion(null);
                    setAiUsed(true);
                  }}
                  onDismiss={() => setSuggestion(null)}
                />
              )}
              <Field label="Audience" htmlFor="post-audience">
                <Select value={form.watch("audience")} onValueChange={(v) => form.setValue("audience", v, { shouldDirty: true })}>
                  <SelectTrigger id="post-audience">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Everyone">Everyone</SelectItem>
                    {DEPARTMENTS.map((d) => (
                      <SelectItem key={d.id} value={d.name}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <label className="flex items-center gap-2 text-xs font-medium">
                <Switch checked={withPoll} onCheckedChange={(v) => form.setValue("withPoll", v, { shouldDirty: true })} aria-label="Add a poll" />
                Add a poll
              </label>
              {withPoll && (
                <div className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2">
                  <Field label="Question" htmlFor="poll-q" required error={errors.question?.message} className="sm:col-span-2">
                    <Input id="poll-q" {...form.register("question")} aria-invalid={!!errors.question} />
                  </Field>
                  <Field label="Option 1" htmlFor="poll-a" required error={errors.optionA?.message}>
                    <Input id="poll-a" {...form.register("optionA")} aria-invalid={!!errors.optionA} />
                  </Field>
                  <Field label="Option 2" htmlFor="poll-b" required error={errors.optionB?.message}>
                    <Input id="poll-b" {...form.register("optionB")} aria-invalid={!!errors.optionB} />
                  </Field>
                  <Field label="Option 3 (optional)" htmlFor="poll-c">
                    <Input id="poll-c" {...form.register("optionC")} />
                  </Field>
                </div>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => guardedChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Publish</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}
