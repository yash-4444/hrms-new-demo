"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Braces, History, RotateCcw, Save } from "lucide-react";
import { fmtDateTime } from "@/lib/format";
import { EMPLOYEES, employeeByCode } from "@/mock/employees";
import { DEMO_TODAY } from "@/mock/org";
import { MERGE_TOKENS, renderLetter, type LetterTemplate } from "@/mock/masters";
import { LetterPreview } from "@/components/org/letter-preview";
import { useApp } from "@/components/app-state";
import { Section } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Badge, Field, Input, Textarea } from "@/components/ui/primitives";
import { ConfirmDialog, Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/overlays";

const KNOWN = new Set(MERGE_TOKENS.map((t) => t.token.slice(2, -2)));

const schema = z
  .object({
    subject: z.string().trim().min(5, "Subject needs at least 5 characters."),
    body: z.string().trim().min(40, "The letter body looks too short — at least 40 characters."),
    note: z.string().trim().min(3, "Describe the change for the version history."),
  })
  .superRefine((v, ctx) => {
    const bad = [...`${v.subject} ${v.body}`.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]).filter((k) => !KNOWN.has(k));
    if (bad.length) ctx.addIssue({ code: "custom", path: ["body"], message: `Unknown merge token: {{${bad[0]}}}. Pick from the token panel.` });
  });
type Values = z.infer<typeof schema>;

const SAMPLES = ["STL-0142", "STL-0145", "STL-0149", "STL-0058"];

export function TemplateEditor({
  template,
  onBack,
  onSave,
  onRestore,
}: {
  template: LetterTemplate;
  onBack: () => void;
  onSave: (t: { subject: string; body: string; note: string }) => void;
  onRestore: (version: number) => void;
}) {
  const { can } = useApp();
  const canEdit = can("people.letter_templates", "E");
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { subject: template.subject, body: template.body, note: "" },
  });
  const v = useWatch({ control: form.control });
  const [sample, setSample] = React.useState(SAMPLES[0]);
  const [leave, setLeave] = React.useState(false);
  const [restoring, setRestoring] = React.useState<number | null>(null);
  const bodyRef = React.useRef<HTMLTextAreaElement | null>(null);
  const emp = employeeByCode(sample) ?? EMPLOYEES[0];
  const bodyReg = form.register("body");

  const insert = (token: string) => {
    const el = bodyRef.current;
    const cur = form.getValues("body");
    const at = el?.selectionStart ?? cur.length;
    form.setValue("body", `${cur.slice(0, at)}${token}${cur.slice(el?.selectionEnd ?? at)}`, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + token.length, at + token.length);
    });
  };

  const back = () => (form.formState.isDirty ? setLeave(true) : onBack());
  const save = form.handleSubmit((vals) => {
    onSave(vals);
    form.reset({ subject: vals.subject, body: vals.body, note: "" });
  });
  const err = (k: keyof Values) => form.formState.errors[k]?.message;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={back}>
          <ArrowLeft aria-hidden />
          All templates
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{template.name}</span>
          <Badge variant="soft">v{template.version}</Badge>
          {form.formState.isDirty && <Badge variant="outline">Unsaved changes</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_220px_minmax(0,1fr)]">
        <Section title="Template" bodyClassName="flex flex-col gap-3">
          <Field label="Subject" htmlFor="te-subject" required error={err("subject")}>
            <Input id="te-subject" readOnly={!canEdit} aria-invalid={!!err("subject")} {...form.register("subject")} />
          </Field>
          <Field label="Body" htmlFor="te-body" required error={err("body")} hint="Blank line = new paragraph. Click a token on the right to insert it at the cursor.">
            <Textarea
              id="te-body"
              rows={16}
              readOnly={!canEdit}
              className="font-mono text-xs leading-relaxed"
              aria-invalid={!!err("body")}
              {...bodyReg}
              ref={(el) => {
                bodyReg.ref(el);
                bodyRef.current = el;
              }}
            />
          </Field>
          <Field label="What changed" htmlFor="te-note" required error={err("note")}>
            <Input id="te-note" readOnly={!canEdit} placeholder="e.g. Updated notice-period clause after legal review" aria-invalid={!!err("note")} {...form.register("note")} />
          </Field>
          <div className="flex justify-end">
            <Button onClick={save} disabled={!canEdit || !form.formState.isDirty}>
              <Save aria-hidden />
              Save as v{template.version + 1}
            </Button>
          </div>
        </Section>

        <div className="flex flex-col gap-3">
          <Section title="Merge tokens" bodyClassName="p-2">
            <ul className="flex flex-col gap-0.5" aria-label="Merge tokens">
              {MERGE_TOKENS.map((t) => (
                <li key={t.token}>
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => insert(t.token)}
                    className="flex w-full items-start gap-1.5 rounded px-1.5 py-1 text-left hover:bg-muted disabled:opacity-60"
                    aria-label={`Insert ${t.label}`}
                  >
                    <Braces className="mt-0.5 size-3 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-[11px] text-primary">{t.token}</span>
                      <span className="block text-[10px] text-muted-foreground">{t.label}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Version history" bodyClassName="p-2">
            <ol className="flex flex-col gap-1.5">
              {template.versions.map((h) => (
                <li key={h.version} className="rounded-md border border-border px-2 py-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="flex items-center gap-1 text-xs font-semibold">
                      <History className="size-3 text-muted-foreground" aria-hidden />v{h.version}
                    </span>
                    {h.version === template.version ? (
                      <Badge variant="soft">Current</Badge>
                    ) : (
                      <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[11px]" disabled={!canEdit} onClick={() => setRestoring(h.version)}>
                        <RotateCcw aria-hidden />
                        Restore
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{h.note}</p>
                  <p className="tnum text-[10px] text-muted-foreground">
                    {h.by} · {fmtDateTime(h.at)}
                  </p>
                </li>
              ))}
            </ol>
          </Section>
        </div>

        <Section
          title="Live preview"
          bodyClassName="bg-subtle"
          actions={
            <Select value={sample} onValueChange={setSample}>
              <SelectTrigger size="sm" className="w-[190px]" aria-label="Sample employee">
                <span className="truncate">
                  <span className="text-muted-foreground">Sample: </span>
                  {emp.name}
                </span>
              </SelectTrigger>
              <SelectContent>
                {SAMPLES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {employeeByCode(c)?.name} · {employeeByCode(c)?.designation}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        >
          <LetterPreview refNo="LTR-PREVIEW" subject={renderLetter(v.subject ?? "", emp, DEMO_TODAY)} body={renderLetter(v.body ?? "", emp, DEMO_TODAY)} employee={emp} signed={false} />
        </Section>
      </div>

      <ConfirmDialog
        open={leave}
        onOpenChange={setLeave}
        title="Leave without saving?"
        description="Your edits to this template have not been saved as a new version."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        destructive
        onConfirm={onBack}
      />
      <ConfirmDialog
        open={restoring !== null}
        onOpenChange={(o) => !o && setRestoring(null)}
        title={`Restore v${restoring ?? ""}?`}
        description={`A new version v${template.version + 1} is created with v${restoring ?? ""}'s content. Letters already issued keep the version they were generated from.`}
        confirmLabel="Restore"
        onConfirm={() => restoring !== null && onRestore(restoring)}
      />
    </div>
  );
}
