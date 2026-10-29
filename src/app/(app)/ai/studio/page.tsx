"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Copy,
  FileSignature,
  History,
  Languages,
  Pencil,
  RefreshCw,
  Scissors,
  Send,
  Smile,
  Sparkles,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { DEMO_TODAY, deptName } from "@/mock/org";
import { EMPLOYEES, descendantsOf, employeeByCode, employeeName } from "@/mock/employees";
import { CANDIDATES, OFFERS, REQUISITIONS, requisitionByCode } from "@/mock/hiring";
import { KB_DOCUMENTS, STUDIO_TEMPLATES, type StudioTemplate, type StudioTemplateId } from "@/mock/ai";
import { mockAction, useApp } from "@/components/app-state";
import { Gated, PageBody, PageHeader, Section } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { EmptyState, Field, Textarea } from "@/components/ui/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { AI_TONE, AiBadge, AiDraftBanner, useStreamedText } from "@/components/ai/ai-ui";
import { generateDraft, placeholderCount, type DraftInput, type Language, type Length, type Tone } from "./drafts";

/* ------------------------------------------------------------ form */

const schema = z
  .object({
    template: z.string(),
    subjectId: z.string(),
    tone: z.enum(["formal", "warm", "concise"]),
    length: z.enum(["short", "standard", "detailed"]),
    language: z.enum(["en", "hi"]),
    note: z.string().max(400, "Keep this under 400 characters"),
  })
  .superRefine((v, ctx) => {
    if (v.template !== "announcement" && !v.subjectId)
      ctx.addIssue({ code: "custom", path: ["subjectId"], message: v.template === "jd" ? "Pick a requisition" : v.template === "policy_summary" ? "Pick a policy" : "Pick who this is for" });
    if (v.template === "announcement" && v.note.trim().length < 10)
      ctx.addIssue({ code: "custom", path: ["note"], message: "Describe what is being announced (at least 10 characters)" });
  });
type Values = z.infer<typeof schema>;

interface Version {
  id: number;
  label: string;
  text: string;
  at: string;
  inputs: DraftInput;
}

/* ------------------------------------------------------------ draft view */

function DraftText({ text, instant }: { text: string; instant: boolean }) {
  const { shown, done } = useStreamedText(text, { instant, speed: 6 });
  const parts = shown.split(/(\[\[[^\]]+\]\])/g);
  return (
    <div className="text-[13px] leading-relaxed whitespace-pre-wrap text-foreground" aria-busy={!done}>
      {parts.map((p, i) =>
        p.startsWith("[[") && p.endsWith("]]") ? (
          <mark key={i} className="rounded-sm border border-dashed border-amber-400 bg-amber-100/70 px-0.5 text-amber-900 dark:border-amber-400/60 dark:bg-amber-500/20 dark:text-amber-100">
            {p.slice(2, -2)}
          </mark>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
      {!done && <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-violet-500 align-middle motion-reduce:animate-none" aria-hidden />}
    </div>
  );
}

/* ------------------------------------------------------------ page */

export default function StudioPage() {
  const { role, persona, can } = useApp();
  const [templateId, setTemplateId] = React.useState<StudioTemplateId>("offer");
  const template = STUDIO_TEMPLATES.find((t) => t.id === templateId) as StudioTemplate;
  const [versions, setVersions] = React.useState<Version[]>([]);
  const [activeVersion, setActiveVersion] = React.useState<number | null>(null);
  const [streamId, setStreamId] = React.useState<number | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [edited, setEdited] = React.useState("");
  const counter = React.useRef(0);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { template: "offer", subjectId: "", tone: "formal", length: "standard", language: "en", note: "" },
  });

  const [subjectId, tone, length, language] = useWatch({ control: form.control, name: ["subjectId", "tone", "length", "language"] });

  // Deep links: /ai/studio?template=jd
  React.useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("template");
    if (t && STUDIO_TEMPLATES.some((x) => x.id === t)) {
      setTemplateId(t as StudioTemplateId);
      form.setValue("template", t);
    }
  }, [form]);

  /* subject options per template — always from records the persona may see */
  const options = React.useMemo(() => {
    const pool =
      role === "manager" || role === "department_head"
        ? descendantsOf(persona.employeeId).filter((e) => e.status !== "exited")
        : EMPLOYEES.filter((e) => e.status !== "exited");
    switch (templateId) {
      case "offer":
        return OFFERS.filter((o) => o.status !== "rejected" && o.status !== "expired").slice(0, 20).map((o) => ({ value: o.id, label: `${o.candidateName} — ${o.role}` }));
      case "rejection":
        return CANDIDATES.filter((c) => c.stage === "rejected" || c.stage === "screening").slice(0, 20).map((c) => ({ value: c.id, label: `${c.name} — ${c.role}` }));
      case "appointment":
      case "welcome":
        return [...pool].sort((a, b) => (a.joiningDate < b.joiningDate ? 1 : -1)).slice(0, 15).map((e) => ({ value: e.code, label: `${e.name} — joined ${fmtDate(e.joiningDate)}` }));
      case "experience":
        return EMPLOYEES.filter((e) => e.status === "notice" || e.status === "exited").slice(0, 15).map((e) => ({ value: e.code, label: `${e.name} — ${e.status === "exited" ? "exited" : "serving notice"}` }));
      case "warning":
      case "review_comment":
        return pool.filter((e) => e.level === 3).slice(0, 25).map((e) => ({ value: e.code, label: `${e.name} — ${e.designation}` }));
      case "jd":
        return REQUISITIONS.filter((r) => r.status === "open").map((r) => ({ value: r.code, label: `${r.code} — ${r.role}` }));
      case "policy_summary":
        return KB_DOCUMENTS.filter((d) => d.status === "indexed").map((d) => ({ value: d.id, label: d.title }));
      default:
        return [];
    }
  }, [templateId, role, persona.employeeId]);

  function chooseTemplate(id: StudioTemplateId) {
    setTemplateId(id);
    form.reset({ ...form.getValues(), template: id, subjectId: "", note: "" });
    setVersions([]);
    setActiveVersion(null);
    setEditing(false);
  }

  const buildInputs = (v: Values, variant: number): DraftInput => {
    const subject: DraftInput["subject"] = {};
    if (templateId === "offer") {
      const o = OFFERS.find((x) => x.id === v.subjectId);
      subject.offer = o;
      subject.requisition = o ? requisitionByCode(o.reqCode) : undefined;
    } else if (templateId === "rejection") subject.candidate = CANDIDATES.find((c) => c.id === v.subjectId);
    else if (templateId === "jd") subject.requisition = requisitionByCode(v.subjectId);
    else if (templateId === "policy_summary") subject.docId = v.subjectId;
    else if (templateId !== "announcement") subject.employee = employeeByCode(v.subjectId);
    return {
      template: templateId,
      subject,
      tone: v.tone as Tone,
      length: v.length as Length,
      language: v.language as Language,
      note: v.note,
      author: { name: persona.name, title: persona.title },
      variant,
    };
  };

  const push = (inputs: DraftInput, label: string) => {
    const id = ++counter.current;
    const text = generateDraft(inputs);
    setVersions((vs) => [{ id, label, text, at: `v${id}`, inputs }, ...vs]);
    setActiveVersion(id);
    setStreamId(id);
    setEditing(false);
  };

  const generate = form.handleSubmit((v) => push(buildInputs(v, 0), "Generated"));

  const current = versions.find((v) => v.id === activeVersion) ?? null;
  const variant = (label: string, patch: Partial<DraftInput>) => {
    if (!current) return;
    push({ ...current.inputs, ...patch }, label);
  };

  const canCreate = can("ai.studio", "C");
  const finalText = editing ? edited : current?.text ?? "";
  const holes = placeholderCount(finalText);
  const approver =
    templateId === "offer" || templateId === "rejection" || templateId === "jd"
      ? "Priya Menon (HR)"
      : employeeName(employeeByCode(persona.employeeId)?.managerCode) || "Priya Menon (HR)";

  return (
    <PageBody>
      <PageHeader
        title="AI Drafting Studio"
        description="Letters, job descriptions and messages drafted from your HR records. Every draft is reviewed by a person and sent for approval — nothing goes out on its own."
        actions={<AiBadge label="Drafts only — human approval required" />}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[210px_320px_minmax(0,1fr)]">
        {/* templates */}
        <Section title="Templates" bodyClassName="p-1.5">
          <ul className="flex flex-col gap-0.5" role="listbox" aria-label="Template">
            {STUDIO_TEMPLATES.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={t.id === templateId}
                  onClick={() => chooseTemplate(t.id)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    t.id === templateId ? "bg-violet-50 text-foreground dark:bg-violet-500/15" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <FileSignature className={cn("mt-0.5 size-3.5 shrink-0", t.id === templateId && AI_TONE.icon)} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium">{t.label}</span>
                    <span className="block text-[10px] leading-snug text-muted-foreground">{t.description}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Section>

        {/* inputs */}
        <Section title={template.label} description="Inputs" bodyClassName="p-0">
          <form onSubmit={generate} className="flex flex-col gap-3 p-4">
            {template.id !== "announcement" && (
              <Field
                label={template.id === "jd" ? "Requisition" : template.id === "policy_summary" ? "Policy" : template.subject === "candidate" ? "Candidate" : "Employee"}
                required
                error={form.formState.errors.subjectId?.message}
                hint={options.length === 0 ? "No records in your scope for this template." : undefined}
              >
                <Select value={subjectId} onValueChange={(v) => form.setValue("subjectId", v, { shouldValidate: true, shouldDirty: true })}>
                  <SelectTrigger aria-label="Who or what this draft is for" aria-invalid={!!form.formState.errors.subjectId}>
                    <SelectValue placeholder="Choose…" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tone">
                <Select value={tone} onValueChange={(v) => form.setValue("tone", v as Tone)}>
                  <SelectTrigger aria-label="Tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="warm">Warm</SelectItem>
                    <SelectItem value="concise">Concise</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Length">
                <Select value={length} onValueChange={(v) => form.setValue("length", v as Length)}>
                  <SelectTrigger aria-label="Length">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">Short</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="detailed">Detailed</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Language">
              <Select value={language} onValueChange={(v) => form.setValue("language", v as Language)}>
                <SelectTrigger aria-label="Language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="hi">हिन्दी (Hindi)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={template.noteLabel} htmlFor="studio-note" required={template.id === "announcement"} error={form.formState.errors.note?.message}>
              <Textarea id="studio-note" rows={3} placeholder={template.notePlaceholder} aria-invalid={!!form.formState.errors.note} {...form.register("note")} />
            </Field>
            <p className="text-[11px] text-muted-foreground">
              Uses only fields you can already see. Salary figures appear only for templates your role is allowed to issue.
            </p>
            <Gated menuKey="ai.studio" action="C">
              <Button type="submit" className={cn("w-full", AI_TONE.solid)}>
                <Wand2 aria-hidden />
                Generate draft
              </Button>
            </Gated>
          </form>
        </Section>

        {/* output */}
        <Section
          title="Draft"
          description={current ? `${current.at} · ${current.label}` : "Your draft appears here"}
          actions={current ? <AiBadge /> : undefined}
          bodyClassName="flex flex-col gap-3"
        >
          {!current ? (
            <EmptyState
              icon={Sparkles}
              title="Pick a template and generate"
              description="Names, dates, CTC and reporting lines are filled from the record you choose. Anything a person must decide stays highlighted as a placeholder."
            />
          ) : (
            <>
              <AiDraftBanner />
              <div className="flex flex-wrap items-center gap-1.5">
                <Button size="sm" variant="outline" disabled={!canCreate} onClick={() => variant("Regenerated", { variant: current.inputs.variant + 1 })}>
                  <RefreshCw aria-hidden />
                  Regenerate
                </Button>
                <Button size="sm" variant="outline" disabled={!canCreate || current.inputs.length === "short"} onClick={() => variant("Shorter", { length: current.inputs.length === "detailed" ? "standard" : "short" })}>
                  <Scissors aria-hidden />
                  Shorten
                </Button>
                <Button size="sm" variant="outline" disabled={!canCreate || current.inputs.tone === "warm"} onClick={() => variant("Warmer", { tone: "warm" })}>
                  <Smile aria-hidden />
                  Make warmer
                </Button>
                <Button size="sm" variant="outline" disabled={!canCreate} onClick={() => variant(current.inputs.language === "hi" ? "English" : "Hindi translation", { language: current.inputs.language === "hi" ? "en" : "hi" })}>
                  <Languages aria-hidden />
                  {current.inputs.language === "hi" ? "Back to English" : "Translate to Hindi"}
                </Button>
                <Button
                  size="sm"
                  variant={editing ? "soft" : "ghost"}
                  className="ml-auto"
                  aria-pressed={editing}
                  onClick={() => {
                    if (!editing) setEdited(current.text);
                    setEditing(!editing);
                  }}
                >
                  <Pencil aria-hidden />
                  {editing ? "Done editing" : "Edit"}
                </Button>
              </div>

              <div className="rounded-md border border-border bg-background p-4" aria-live="polite">
                {editing ? (
                  <>
                    <label htmlFor="studio-edit" className="sr-only">
                      Edit draft
                    </label>
                    <Textarea id="studio-edit" value={edited} onChange={(e) => setEdited(e.target.value)} rows={18} className="font-sans text-[13px] leading-relaxed" />
                  </>
                ) : (
                  <DraftText key={current.id} text={current.text} instant={streamId !== current.id} />
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
                    holes ? "border-amber-400/60 bg-amber-100/70 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100" : "border-success/25 bg-success-soft text-success-fg",
                  )}
                >
                  {holes ? `${holes} placeholder${holes === 1 ? "" : "s"} to fill` : "No placeholders left"}
                </span>
                <div className="ml-auto flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      try {
                        void navigator.clipboard.writeText(finalText);
                      } catch {
                        /* clipboard blocked — the toast still confirms intent */
                      }
                      mockAction("Draft copied to clipboard", { tone: "info" });
                    }}
                  >
                    <Copy aria-hidden />
                    Copy
                  </Button>
                  <Gated menuKey="ai.studio" action="C">
                    <Button
                      size="sm"
                      className={AI_TONE.solid}
                      onClick={() =>
                        mockAction("Sent for approval", {
                          description: `${template.label} · ${current.at} → ${approver}${holes ? ` · ${holes} placeholder(s) flagged for the approver` : ""}`,
                        })
                      }
                    >
                      <Send aria-hidden />
                      Send for approval
                    </Button>
                  </Gated>
                </div>
              </div>

              <div className="border-t border-border pt-3">
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                  <History className="size-3.5" aria-hidden />
                  Version history
                </p>
                <ol className="flex flex-wrap gap-1.5">
                  {versions.map((v) => (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveVersion(v.id);
                          setEditing(false);
                        }}
                        aria-current={v.id === activeVersion ? "true" : undefined}
                        className={cn(
                          "rounded-md border px-2 py-1 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          v.id === activeVersion ? cn(AI_TONE.chip, "font-semibold") : "border-border text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {v.at} · {v.label}
                      </button>
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Drafted {fmtDate(DEMO_TODAY)} by {persona.name} with AI assistance · {deptName(employeeByCode(persona.employeeId)?.departmentId ?? "HR")} · logged in the AI audit trail.
                </p>
              </div>
            </>
          )}
        </Section>
      </div>
    </PageBody>
  );
}
