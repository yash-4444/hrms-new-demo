"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/primitives";
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
import { AiDraftBanner } from "@/components/ai";
import { KB_ARTICLE_CATEGORIES, type KbArticleCategory } from "@/mock/service";
import { useDirtyGuard } from "./kit";

const schema = z.object({
  title: z.string().trim().min(8, "Give the article a descriptive title"),
  category: z.enum(KB_ARTICLE_CATEGORIES as [KbArticleCategory, ...KbArticleCategory[]]),
  summary: z.string().trim().min(30, "Summarise the answer in a sentence or two (30+ characters)"),
  steps: z
    .string()
    .trim()
    .min(1, "Add at least one step")
    .refine((s) => s.split("\n").filter((l) => l.trim()).length >= 2, "Add at least two steps, one per line"),
});
export type KbArticleValues = z.infer<typeof schema>;

/** Writes or revises a knowledge-base article. Saving creates a new version as a draft. */
export function KbArticleDialog({
  open,
  onOpenChange,
  initial,
  fromAi,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: KbArticleValues | null;
  fromAi?: boolean;
  onSave: (v: KbArticleValues) => void;
}) {
  const defaults = React.useMemo<KbArticleValues>(
    () => initial ?? { title: "", category: "Leave", summary: "", steps: "" },
    [initial],
  );
  const { register, handleSubmit, control, reset, formState } = useForm<KbArticleValues>({ resolver: zodResolver(schema), values: defaults });
  const close = () => {
    reset(defaults);
    onOpenChange(false);
  };
  const { onOpenChange: guarded, guard } = useDirtyGuard(formState.isDirty, close);
  const submit = handleSubmit((v) => {
    onSave(v);
    reset(v);
    onOpenChange(false);
  });
  const e = formState.errors;

  return (
    <>
      <Dialog open={open} onOpenChange={guarded}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{initial ? "Edit article" : "New article"}</DialogTitle>
            <DialogDescription>Saved as a draft. It is visible to employees only after you publish it.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} noValidate>
            <DialogBody className="grid gap-3.5 sm:grid-cols-[1fr_180px]">
              {fromAi && <AiDraftBanner className="sm:col-span-2">AI draft from resolved tickets — check every step against the policy before publishing.</AiDraftBanner>}
              <Field label="Title" htmlFor="kb-title" required error={e.title?.message}>
                <Input id="kb-title" aria-invalid={!!e.title} placeholder="How to…" {...register("title")} />
              </Field>
              <Field label="Category" htmlFor="kb-cat" required>
                <Controller
                  control={control}
                  name="category"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="kb-cat"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {KB_ARTICLE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Summary" htmlFor="kb-summary" required error={e.summary?.message} className="sm:col-span-2">
                <Textarea id="kb-summary" aria-invalid={!!e.summary} {...register("summary")} />
              </Field>
              <Field label="Steps (one per line)" htmlFor="kb-steps" required error={e.steps?.message} className="sm:col-span-2">
                <Textarea id="kb-steps" className="min-h-32" aria-invalid={!!e.steps} {...register("steps")} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => guarded(false)}>Cancel</Button>
              <Button type="submit">Save draft</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}
