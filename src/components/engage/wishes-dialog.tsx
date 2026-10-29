"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sparkles } from "lucide-react";
import { employeeByCode } from "@/mock/employees";
import { deptName } from "@/mock/org";
import { AI_TONE, AiSuggestionCard } from "@/components/ai";
import { Button } from "@/components/ui/button";
import { Field, Switch, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { useDirtyGuard } from "./kit";

export type Occasion = "birthday" | "anniversary" | "joiner";

export interface WishTarget {
  code: string;
  occasion: Occasion;
  /** Completed years for an anniversary. */
  years?: number;
}

const schema = z.object({
  message: z.string().trim().min(5, "Write a short message (5+ characters)").max(400, "Keep it under 400 characters"),
  onFeed: z.boolean(),
});
type Values = z.infer<typeof schema>;

const defaultMessage = (t: WishTarget, first: string) =>
  t.occasion === "birthday"
    ? `Happy birthday, ${first}! Have a wonderful day.`
    : t.occasion === "anniversary"
      ? `Happy work anniversary, ${first}! Thank you for ${t.years} year${t.years === 1 ? "" : "s"} with us.`
      : `Welcome to Stellar, ${first}! Glad to have you on board.`;

/** Deterministic "AI" personalisation from role, department and tenure. */
export function personalise(t: WishTarget) {
  const e = employeeByCode(t.code);
  if (!e) return "";
  const dept = deptName(e.departmentId);
  const skill = e.skills[0];
  if (t.occasion === "birthday")
    return `Happy birthday, ${e.firstName}! 🎂 The ${dept} team is lucky to have a ${e.designation.toLowerCase()} who ${skill ? `knows ${skill} inside out` : "always shows up for others"}. Hope today is all about you — no stand-ups, only cake.`;
  if (t.occasion === "anniversary")
    return `${t.years} year${t.years === 1 ? "" : "s"} at Stellar, ${e.firstName}! 🎉 From your first week in ${dept} to the ${e.designation} you are today, your work has made a real difference. Thank you — here's to the next chapter.`;
  return `Welcome aboard, ${e.firstName}! 👋 Great to have a new ${e.designation} in ${dept}${e.location ? ` at ${e.location}` : ""}. Shout if you need anything — the coffee machine on floor 3 is the best place to meet the team.`;
}

export function WishesDialog({
  target,
  onOpenChange,
  onSend,
}: {
  target: WishTarget | null;
  onOpenChange: (v: boolean) => void;
  onSend: (t: WishTarget, v: Values) => void;
}) {
  const e = target ? employeeByCode(target.code) : null;
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { message: "", onFeed: true } });
  const [suggestion, setSuggestion] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (target && e) form.reset({ message: defaultMessage(target, e.firstName), onFeed: true });
  }, [target, e, form]);

  const close = () => {
    onOpenChange(false);
    setSuggestion(null);
  };
  const { onOpenChange: guarded, guard } = useDirtyGuard(form.formState.isDirty, close);
  const errors = form.formState.errors;

  return (
    <>
      <Dialog open={!!target} onOpenChange={guarded}>
        <DialogContent size="md">
          {target && e && (
            <form
              noValidate
              onSubmit={form.handleSubmit((v) => {
                onSend(target, v);
                close();
              })}
            >
              <DialogHeader>
                <DialogTitle>Send wishes to {e.name}</DialogTitle>
                <DialogDescription>
                  {e.designation} · {deptName(e.departmentId)}
                </DialogDescription>
              </DialogHeader>
              <DialogBody className="flex flex-col gap-3">
                <Field label="Message" htmlFor="wish-msg" required error={errors.message?.message}>
                  <Textarea id="wish-msg" rows={4} aria-invalid={!!errors.message} {...form.register("message")} />
                </Field>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" variant="outline" className={AI_TONE.text} onClick={() => setSuggestion(personalise(target))}>
                    <Sparkles /> AI personalise
                  </Button>
                  <span className="text-[11px] text-muted-foreground">Uses role, team and tenure only — never personal data.</span>
                </div>
                {suggestion && (
                  <AiSuggestionCard
                    title="Personalised message"
                    confidence={88}
                    body={suggestion}
                    acceptLabel="Use this message"
                    onAccept={() => {
                      form.setValue("message", suggestion, { shouldDirty: true, shouldValidate: true });
                      setSuggestion(null);
                    }}
                    onDismiss={() => setSuggestion(null)}
                  />
                )}
                <label className="flex items-center gap-2 text-xs font-medium">
                  <Switch checked={form.watch("onFeed")} onCheckedChange={(v) => form.setValue("onFeed", v, { shouldDirty: true })} aria-label="Also post on the company feed" />
                  Also post on the company feed
                </label>
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => guarded(false)}>
                  Cancel
                </Button>
                <Button type="submit">Send wishes</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}
