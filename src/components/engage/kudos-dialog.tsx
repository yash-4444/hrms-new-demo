"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EMPLOYEES } from "@/mock/employees";
import { COMPANY_VALUES, HIGH_VALUE_THRESHOLD } from "@/mock/engage";
import { Button } from "@/components/ui/button";
import { Alert, Avatar, Badge, Field, Input, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { nameOf, personLine, useDirtyGuard } from "./kit";

export interface KudosValues {
  recipients: string[];
  valueId: string;
  points: number;
  message: string;
}

const ACTIVE = EMPLOYEES.filter((e) => e.status !== "exited");

export function GiveKudosDialog({
  open,
  onOpenChange,
  remaining,
  meCode,
  onGive,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Points the giver can still award this month. */
  remaining: number;
  meCode: string;
  onGive: (v: KudosValues) => void;
}) {
  const schema = z
    .object({
      recipients: z.array(z.string()).min(1, "Choose at least one person").max(5, "Up to 5 people per kudos"),
      valueId: z.string().min(1, "Pick the value this shows"),
      points: z.number({ message: "Enter points" }).int().min(0, "Cannot be negative").multipleOf(10, "Use multiples of 10"),
      message: z.string().trim().min(15, "Say what they did (15+ characters)").max(500, "Keep it under 500 characters"),
    })
    .refine((v) => v.points * v.recipients.length <= remaining, {
      path: ["points"],
      message: `Exceeds your remaining ${remaining} points this month`,
    });

  const defaults: KudosValues = { recipients: [], valueId: "", points: 50, message: "" };
  const form = useForm<KudosValues>({ resolver: zodResolver(schema), defaultValues: defaults });
  const [query, setQuery] = React.useState("");
  const close = () => {
    onOpenChange(false);
    form.reset(defaults);
    setQuery("");
  };
  const { onOpenChange: guarded, guard } = useDirtyGuard(form.formState.isDirty, close);
  const errors = form.formState.errors;
  const recipients = form.watch("recipients");
  const points = form.watch("points");
  const valueId = form.watch("valueId");

  const matches = query.trim().length >= 2
    ? ACTIVE.filter((e) => e.code !== meCode && !recipients.includes(e.code) && e.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
    : [];
  const setRecipients = (r: string[]) => form.setValue("recipients", r, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });

  return (
    <>
      <Dialog open={open} onOpenChange={guarded}>
        <DialogContent size="md">
          <form noValidate onSubmit={form.handleSubmit((v) => { onGive(v); close(); })}>
            <DialogHeader>
              <DialogTitle>Give kudos</DialogTitle>
              <DialogDescription>Recognise someone for living a company value. Points convert to rewards at ₹1 per point.</DialogDescription>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-3">
              <Field label="Who" htmlFor="kd-search" required error={errors.recipients?.message}>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input id="kd-search" className="pl-7" placeholder="Type a name…" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
                </div>
                {matches.length > 0 && (
                  <ul className="mt-1 flex flex-col rounded-md border border-border" role="listbox" aria-label="Matching people">
                    {matches.map((e) => (
                      <li key={e.code}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-muted"
                          onClick={() => {
                            setRecipients([...recipients, e.code]);
                            setQuery("");
                          }}
                        >
                          <Avatar name={e.name} size={20} />
                          <span className="font-medium">{e.name}</span>
                          <span className="truncate text-muted-foreground">{personLine(e.code)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {recipients.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {recipients.map((c) => (
                      <Badge key={c} variant="soft" className="gap-1">
                        {nameOf(c)}
                        <button type="button" aria-label={`Remove ${nameOf(c)}`} onClick={() => setRecipients(recipients.filter((x) => x !== c))}>
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </Field>

              <Field label="Company value" required error={errors.valueId?.message}>
                <div className="grid gap-1.5 sm:grid-cols-2" role="radiogroup" aria-label="Company value">
                  {COMPANY_VALUES.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      role="radio"
                      aria-checked={valueId === v.id}
                      onClick={() => form.setValue("valueId", v.id, { shouldDirty: true, shouldValidate: true })}
                      className={cn("rounded-md border border-border px-2.5 py-1.5 text-left", valueId === v.id ? "border-primary bg-primary-soft" : "hover:bg-muted")}
                    >
                      <span className="block text-xs font-semibold">{v.name}</span>
                      <span className="block text-[11px] text-muted-foreground">{v.blurb}</span>
                    </button>
                  ))}
                </div>
              </Field>

              <Field
                label="Points per person"
                htmlFor="kd-points"
                error={errors.points?.message}
                hint={`${remaining} points left to give this month${recipients.length > 1 ? ` · total ${points * recipients.length}` : ""}`}
              >
                <Input id="kd-points" type="number" step={10} min={0} className="w-32" aria-invalid={!!errors.points} {...form.register("points", { valueAsNumber: true })} />
              </Field>
              {points >= HIGH_VALUE_THRESHOLD && (
                <Alert tone="info" title="High-value award">
                  Awards of {HIGH_VALUE_THRESHOLD}+ points are reviewed by HR before the points post. The kudos appears on the wall straight away.
                </Alert>
              )}

              <Field label="Message" htmlFor="kd-msg" required error={errors.message?.message}>
                <Textarea id="kd-msg" rows={3} placeholder="What did they do, and what difference did it make?" aria-invalid={!!errors.message} {...form.register("message")} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => guarded(false)}>
                Cancel
              </Button>
              <Button type="submit">Send kudos</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}
