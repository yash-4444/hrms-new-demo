"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Idea } from "@/mock/engage";
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
import { useDirtyGuard } from "./kit";

export const IDEA_CATEGORIES: Idea["category"][] = ["Workplace", "Product", "Process", "Wellbeing", "Cost saving"];

const schema = z.object({
  title: z.string().trim().min(8, "Give it a clear title (8+ characters)").max(90, "Keep the title under 90 characters"),
  category: z.enum(["Workplace", "Product", "Process", "Wellbeing", "Cost saving"], { message: "Choose a category" }),
  body: z.string().trim().min(30, "Describe the problem and your idea (30+ characters)").max(1000, "Keep it under 1,000 characters"),
});
export type IdeaValues = z.infer<typeof schema>;

export function SubmitIdeaDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (v: IdeaValues) => void;
}) {
  const form = useForm<IdeaValues>({ resolver: zodResolver(schema), defaultValues: { title: "", body: "" } });
  const close = () => {
    onOpenChange(false);
    form.reset({ title: "", body: "" });
  };
  const { onOpenChange: guarded, guard } = useDirtyGuard(form.formState.isDirty, close);
  const errors = form.formState.errors;

  return (
    <>
      <Dialog open={open} onOpenChange={guarded}>
        <DialogContent size="md">
          <form
            noValidate
            onSubmit={form.handleSubmit((v) => {
              onSubmit(v);
              close();
            })}
          >
            <DialogHeader>
              <DialogTitle>Submit an idea</DialogTitle>
              <DialogDescription>People Ops triages new ideas every Friday. Ideas with 50+ votes are reviewed by leadership.</DialogDescription>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-3">
              <Field label="Title" htmlFor="idea-title" required error={errors.title?.message}>
                <Input id="idea-title" placeholder="Quiet room on floor 3" aria-invalid={!!errors.title} {...form.register("title")} />
              </Field>
              <Field label="Category" htmlFor="idea-cat" required error={errors.category?.message}>
                <Select value={form.watch("category") ?? ""} onValueChange={(v) => form.setValue("category", v as IdeaValues["category"], { shouldDirty: true, shouldValidate: true })}>
                  <SelectTrigger id="idea-cat" aria-invalid={!!errors.category}>
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {IDEA_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="The idea" htmlFor="idea-body" required error={errors.body?.message} hint="What problem does it solve, and who benefits?">
                <Textarea id="idea-body" rows={5} aria-invalid={!!errors.body} {...form.register("body")} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => guarded(false)}>
                Cancel
              </Button>
              <Button type="submit">Submit idea</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}
