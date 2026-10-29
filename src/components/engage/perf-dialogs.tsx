"use client";

/* Feedback & 360 dialogs — give feedback, request a 360. */

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { employeeByCode, reporteesOf } from "@/mock/employees";
import type { RaterRelation } from "@/mock/engage";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Label, Switch, Textarea } from "@/components/ui/primitives";
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
import { nameOf, personLine, useDirtyGuard } from "./kit";

/** People someone works with: manager, peers, reportees and the leadership bench. */
export function colleaguesOf(code: string): { code: string; relation: RaterRelation }[] {
  const me = employeeByCode(code);
  const out = new Map<string, RaterRelation>();
  if (me?.managerCode) out.set(me.managerCode, "Manager");
  if (me?.managerCode)
    for (const p of reporteesOf(me.managerCode)) if (p.code !== code && p.status !== "exited") out.set(p.code, "Peer");
  for (const r of reporteesOf(code)) if (r.status !== "exited") out.set(r.code, "Direct report");
  for (const c of ["STL-0004", "STL-0006", "STL-0009", "STL-0017", "STL-0031", "STL-0058", "STL-0145"])
    if (c !== code && !out.has(c)) out.set(c, "Cross-functional");
  return [...out.entries()].slice(0, 18).map(([c, relation]) => ({ code: c, relation }));
}

/* ---------------------------------------------------------- give feedback */

const giveSchema = z.object({
  toCode: z.string().min(1, "Choose who the feedback is for"),
  kind: z.enum(["praise", "constructive"]),
  anonymous: z.boolean(),
  text: z.string().trim().min(20, "Be specific — at least 20 characters (situation, behaviour, impact)"),
});
export type GiveValues = z.infer<typeof giveSchema>;

export function GiveFeedbackDialog({
  open,
  onOpenChange,
  fromCode,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fromCode: string;
  onSubmit: (v: GiveValues) => void;
}) {
  const form = useForm<GiveValues>({
    resolver: zodResolver(giveSchema),
    defaultValues: { toCode: "", kind: "praise", anonymous: false, text: "" },
  });
  const close = () => {
    onOpenChange(false);
    form.reset();
  };
  const { onOpenChange: guarded, guard } = useDirtyGuard(form.formState.isDirty, close);
  const people = React.useMemo(() => colleaguesOf(fromCode), [fromCode]);
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
              <DialogTitle>Give feedback</DialogTitle>
              <DialogDescription>Feedback is shared with the recipient straight away and counts towards this review cycle.</DialogDescription>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-3">
              <Field label="For" htmlFor="fb-to" required error={errors.toCode?.message}>
                <Controller
                  control={form.control}
                  name="toCode"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="fb-to" aria-invalid={!!errors.toCode}>
                        <SelectValue placeholder="Choose a colleague" />
                      </SelectTrigger>
                      <SelectContent>
                        {people.map((p) => (
                          <SelectItem key={p.code} value={p.code}>
                            {nameOf(p.code)} — {p.relation}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Type" htmlFor="fb-kind">
                <Controller
                  control={form.control}
                  name="kind"
                  render={({ field }) => (
                    <div className="flex gap-1.5" role="radiogroup" aria-label="Feedback type" id="fb-kind">
                      {(["praise", "constructive"] as const).map((k) => (
                        <Button
                          key={k}
                          type="button"
                          size="sm"
                          role="radio"
                          aria-checked={field.value === k}
                          variant={field.value === k ? "default" : "outline"}
                          onClick={() => field.onChange(k)}
                        >
                          {k === "praise" ? "Praise" : "Constructive"}
                        </Button>
                      ))}
                    </div>
                  )}
                />
              </Field>
              <Field label="Feedback" htmlFor="fb-text" required error={errors.text?.message} hint="Situation → behaviour → impact works best.">
                <Textarea id="fb-text" rows={4} aria-invalid={!!errors.text} {...form.register("text")} />
              </Field>
              <Controller
                control={form.control}
                name="anonymous"
                render={({ field }) => (
                  <div className="flex items-start gap-2 rounded-md border border-border p-2.5">
                    <Switch id="fb-anon" checked={field.value} onCheckedChange={field.onChange} />
                    <div>
                      <Label htmlFor="fb-anon">Share anonymously</Label>
                      <p className="text-[11px] text-muted-foreground">
                        Your name is hidden from the recipient and their manager. HR can still see it if a conduct concern is raised.
                      </p>
                    </div>
                  </div>
                )}
              />
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => guarded(false)}>
                Cancel
              </Button>
              <Button type="submit">Send feedback</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}

/* --------------------------------------------------------- request a 360 */

const reqSchema = z.object({
  raters: z.array(z.string()).min(3, "Pick at least 3 raters so answers stay anonymous").max(8, "8 raters at most"),
  note: z.string().trim().max(300, "Keep the note under 300 characters"),
});
export type RequestValues = z.infer<typeof reqSchema>;

export function Request360Dialog({
  open,
  onOpenChange,
  subjectCode,
  cycleName,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  subjectCode: string;
  cycleName: string;
  onSubmit: (v: RequestValues, relations: Record<string, RaterRelation>) => void;
}) {
  const form = useForm<RequestValues>({ resolver: zodResolver(reqSchema), defaultValues: { raters: [], note: "" } });
  const close = () => {
    onOpenChange(false);
    form.reset();
  };
  const { onOpenChange: guarded, guard } = useDirtyGuard(form.formState.isDirty, close);
  const people = React.useMemo(() => colleaguesOf(subjectCode), [subjectCode]);
  const relations = Object.fromEntries(people.map((p) => [p.code, p.relation]));
  const errors = form.formState.errors;

  return (
    <>
      <Dialog open={open} onOpenChange={guarded}>
        <DialogContent size="md">
          <form
            noValidate
            onSubmit={form.handleSubmit((v) => {
              onSubmit(v, relations);
              close();
            })}
          >
            <DialogHeader>
              <DialogTitle>Request 360 feedback</DialogTitle>
              <DialogDescription>
                For {nameOf(subjectCode)} · {cycleName}. Raters get an in-app task and an email; answers are pooled so no single rater is identifiable.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-3">
              <Controller
                control={form.control}
                name="raters"
                render={({ field }) => (
                  <fieldset className="flex flex-col gap-1.5">
                    <legend className="mb-1 text-xs font-medium">
                      Raters <span className="text-destructive-fg">*</span>
                      <span className="tnum ml-1 font-normal text-muted-foreground">({field.value.length} selected)</span>
                    </legend>
                    <div className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
                      {people.map((p) => {
                        const checked = field.value.includes(p.code);
                        const id = `r360-${p.code}`;
                        return (
                          <label key={p.code} htmlFor={id} className="flex cursor-pointer items-start gap-2 rounded-md border border-border p-2 hover:bg-muted/50">
                            <Checkbox
                              id={id}
                              checked={checked}
                              onCheckedChange={(v) =>
                                field.onChange(v ? [...field.value, p.code] : field.value.filter((c) => c !== p.code))
                              }
                            />
                            <span className="min-w-0 text-xs">
                              <span className="block truncate font-medium">{nameOf(p.code)}</span>
                              <span className="block truncate text-[11px] text-muted-foreground">
                                {p.relation} · {personLine(p.code)}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {errors.raters && (
                      <p role="alert" className="text-xs text-destructive-fg">
                        {errors.raters.message}
                      </p>
                    )}
                  </fieldset>
                )}
              />
              <Field label="Note to raters" htmlFor="r360-note" error={errors.note?.message} hint="Optional — what you would most like feedback on.">
                <Textarea id="r360-note" rows={2} {...form.register("note")} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => guarded(false)}>
                Cancel
              </Button>
              <Button type="submit">Send requests</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}

