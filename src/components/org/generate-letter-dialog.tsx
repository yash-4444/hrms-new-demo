"use client";

import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FileSignature, Sparkles } from "lucide-react";
import { DEMO_TODAY } from "@/mock/org";
import { EMPLOYEES, employeeByCode } from "@/mock/employees";
import { LETTER_TEMPLATES, renderLetter, type GeneratedLetter, type LetterTemplate } from "@/mock/masters";
import { AiBadge, AiSuggestionCard, AI_TONE } from "@/components/ai/ai-ui";
import { LetterPreview } from "@/components/org/letter-preview";
import { aiLetterParagraph } from "@/components/org/letter-ai";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/primitives";
import {
  ConfirmDialog,
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

const schema = z.object({
  templateId: z.string().min(1, "Pick a template."),
  employeeCode: z.string().min(1, "Pick the employee."),
  effectiveDate: z.string().min(1, "Set the effective date."),
});
type Values = z.infer<typeof schema>;

type AiState = { status: "idle" } | { status: "suggested" | "editing" | "accepted"; text: string; sources: string[] };

export function GenerateLetterDialog({
  open,
  onOpenChange,
  nextRef,
  templates = LETTER_TEMPLATES,
  onGenerate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  nextRef: string;
  templates?: LetterTemplate[];
  onGenerate: (l: Omit<GeneratedLetter, "id">, issue: boolean) => void;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { templateId: "", employeeCode: "", effectiveDate: DEMO_TODAY },
  });
  const v = useWatch({ control: form.control });
  const [ai, setAi] = React.useState<AiState>({ status: "idle" });
  const [discard, setDiscard] = React.useState(false);

  const tpl = templates.find((t) => t.id === v.templateId);
  const emp = v.employeeCode ? employeeByCode(v.employeeCode) : undefined;
  const people = React.useMemo(() => EMPLOYEES.filter((e) => e.level >= 2).slice(0, 80), []);

  const reset = () => {
    form.reset();
    setAi({ status: "idle" });
  };
  const finish = () => {
    reset();
    onOpenChange(false);
  };
  const close = (open: boolean) => {
    if (open) return onOpenChange(true);
    if (form.formState.isDirty || ai.status !== "idle") setDiscard(true);
    else finish();
  };

  const draftWithAi = () => {
    if (!tpl || !emp) return;
    setAi({ status: "suggested", ...aiLetterParagraph(tpl.type, emp) });
  };

  const submit = (issue: boolean) =>
    form.handleSubmit((vals) => {
      const t = templates.find((x) => x.id === vals.templateId)!;
      onGenerate(
        {
          type: t.type,
          templateId: t.id,
          employeeCode: vals.employeeCode,
          effectiveDate: vals.effectiveDate,
          generatedOn: DEMO_TODAY,
          status: issue ? "issued" : "draft",
          issuedBy: "Priya Menon",
          version: t.version,
        },
        issue,
      );
      finish();
    })();

  const err = (k: keyof Values) => form.formState.errors[k]?.message;
  const accepted = ai.status === "accepted" ? ai.text : null;

  return (
    <>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent size="full">
          <DialogHeader>
            <DialogTitle>Generate letter</DialogTitle>
            <DialogDescription>Pick a template and an employee — every merge field fills from the live record. Review the preview before issuing.</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
            <div className="flex flex-col gap-3">
              <Field label="Template" htmlFor="gl-tpl" required error={err("templateId")}>
                <Controller
                  control={form.control}
                  name="templateId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(x) => { field.onChange(x); setAi({ status: "idle" }); }}>
                      <SelectTrigger id="gl-tpl" aria-invalid={!!err("templateId")}>
                        <SelectValue placeholder="Select a template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.filter((t) => t.active).map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} · v{t.version}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Employee" htmlFor="gl-emp" required error={err("employeeCode")}>
                <Controller
                  control={form.control}
                  name="employeeCode"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(x) => { field.onChange(x); setAi({ status: "idle" }); }}>
                      <SelectTrigger id="gl-emp" aria-invalid={!!err("employeeCode")}>
                        <SelectValue placeholder="Select an employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {people.map((e) => (
                          <SelectItem key={e.code} value={e.code}>
                            {e.name} · {e.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Effective date" htmlFor="gl-eff" required error={err("effectiveDate")}>
                <Input id="gl-eff" type="date" aria-invalid={!!err("effectiveDate")} {...form.register("effectiveDate")} />
              </Field>

              <div className={`rounded-md border p-3 ${AI_TONE.soft}`}>
                <div className="flex items-center justify-between gap-2">
                  <AiBadge label="AI draft" />
                  <Button size="sm" className={AI_TONE.solid} disabled={!tpl || !emp} onClick={draftWithAi}>
                    <Sparkles aria-hidden />
                    {ai.status === "idle" ? "Draft with AI" : "Redraft"}
                  </Button>
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Adds one personalised paragraph using the employee&apos;s tenure, team and skills. Nothing is added until you accept it.
                </p>
              </div>

              {ai.status === "suggested" && (
                <AiSuggestionCard
                  title="Tailored paragraph"
                  body={
                    <>
                      <p>{ai.text}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">Sources: {ai.sources.join(" · ")}</p>
                    </>
                  }
                  confidence={0.86}
                  onAccept={() => setAi({ ...ai, status: "accepted" })}
                  onEdit={() => setAi({ ...ai, status: "editing" })}
                  onDismiss={() => setAi({ status: "idle" })}
                />
              )}
              {ai.status === "editing" && (
                <Field label="Edit AI paragraph" htmlFor="gl-ai">
                  <Textarea id="gl-ai" rows={5} value={ai.text} onChange={(e) => setAi({ ...ai, text: e.target.value })} />
                  <div className="flex gap-1.5">
                    <Button size="sm" onClick={() => setAi({ ...ai, status: "accepted" })} disabled={!ai.text.trim()}>
                      Use this paragraph
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAi({ status: "idle" })}>
                      Remove
                    </Button>
                  </div>
                </Field>
              )}
              {ai.status === "accepted" && (
                <p className="text-[11px] text-muted-foreground">
                  AI paragraph accepted — highlighted in the preview.{" "}
                  <button type="button" className="font-medium text-primary hover:underline" onClick={() => setAi({ ...ai, status: "editing" })}>
                    Edit
                  </button>
                </p>
              )}
            </div>

            <div className="min-w-0 rounded-md bg-subtle p-4">
              {tpl && emp ? (
                <LetterPreview
                  refNo={nextRef}
                  subject={renderLetter(tpl.subject, emp, v.effectiveDate || DEMO_TODAY)}
                  body={renderLetter(tpl.body, emp, v.effectiveDate || DEMO_TODAY)}
                  employee={emp}
                  aiParagraph={accepted}
                  signed={false}
                />
              ) : (
                <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground">
                  <FileSignature className="size-6" aria-hidden />
                  Pick a template and an employee to see the rendered letter.
                </div>
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button variant="outline" onClick={() => submit(false)}>
              Save as draft
            </Button>
            <Button onClick={() => submit(true)}>Sign &amp; issue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={discard}
        onOpenChange={setDiscard}
        title="Discard this letter?"
        description="The template, employee and any AI paragraph you accepted will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={finish}
      />
    </>
  );
}
