"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ColumnDef } from "@tanstack/react-table";
import {
  BookOpen,
  Check,
  FileText,
  HelpCircle,
  Loader2,
  MessageSquareQuote,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, num, pct } from "@/lib/format";
import {
  KB_DEFLECTION_TREND,
  KB_DOCUMENTS,
  KB_STATS,
  KB_TOP_QUESTIONS,
  KB_UNANSWERED,
  kbConfidence,
  searchKnowledge,
  type KbDocument,
  type KbHit,
} from "@/mock/ai";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { BarCompareChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Alert, EmptyState, Field, Input, Progress } from "@/components/ui/primitives";
import {
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FilterSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/overlays";
import { AI_TONE, AiBadge, AiCitation, AiConfidence } from "@/components/ai/ai-ui";

const STATUS: Record<KbDocument["status"], { status: string; label: string }> = {
  indexed: { status: "completed", label: "Indexed" },
  indexing: { status: "processing", label: "Indexing" },
  failed: { status: "failed", label: "Failed" },
};

const CATEGORIES: KbDocument["category"][] = ["Leave & Time", "Conduct", "Benefits", "Workplace", "IT", "Handbook", "Payroll"];

/* ------------------------------------------------------------ highlight */

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  const t = terms.filter((x) => x.length > 2);
  if (!t.length) return <>{text}</>;
  const re = new RegExp(`(${t.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return (
    <>
      {text.split(re).map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-sm bg-violet-200/70 px-0.5 text-foreground dark:bg-violet-500/30">
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}

const termsFor = (question: string, hit: KbHit) => {
  const q = question.toLowerCase();
  return hit.passage.terms.filter((t) => q.includes(t) || q.split(/\W+/).some((w) => w.length > 4 && t.startsWith(w)));
};

/* ------------------------------------------------------------ test panel */

const EXAMPLES = ["How many earned leaves carry forward?", "What is the hotel limit in Mumbai?", "Is there a sabbatical policy?", "When is gratuity payable?"];

function TestQuestion() {
  const [q, setQ] = React.useState("");
  const [asked, setAsked] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const hits = React.useMemo(() => (asked ? searchKnowledge(asked, 3) : []), [asked]);
  const conf = kbConfidence(hits);

  const ask = (text: string) => {
    if (!text.trim()) return;
    setQ(text);
    setLoading(true);
    setAsked(null);
    setTimeout(() => {
      setAsked(text);
      setLoading(false);
    }, 600);
  };

  return (
    <Section
      title="Test a question"
      description="See exactly what employees will get — answer, cited passages and confidence."
      actions={<AiBadge />}
      bodyClassName="flex flex-col gap-3"
    >
      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
      >
        <label htmlFor="kb-test" className="sr-only">
          Question
        </label>
        <Input id="kb-test" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. How many WFH days am I allowed?" />
        <Button type="submit" size="default" className={AI_TONE.solid} disabled={!q.trim() || loading}>
          {loading ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Search aria-hidden />}
          Ask
        </Button>
      </form>
      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => ask(e)}
            className={cn("rounded-full border px-2 py-0.5 text-[11px] outline-none focus-visible:ring-2", AI_TONE.chip, AI_TONE.ring)}
          >
            {e}
          </button>
        ))}
      </div>

      <div aria-live="polite" className="min-h-[120px]">
        {loading && (
          <p className="flex items-center gap-1.5 py-6 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
            Retrieving passages from {KB_STATS.indexed} indexed documents…
          </p>
        )}
        {!loading && asked && hits.length === 0 && (
          <Alert tone="neutral" icon={HelpCircle} title="I don't know">
            No indexed policy covers “{asked}”. I won&apos;t guess — this has been logged as a knowledge gap for the document owners, and the employee is offered a helpdesk ticket instead.
          </Alert>
        )}
        {!loading && asked && hits.length > 0 && (
          <div className="flex flex-col gap-2.5">
            <div className={cn("rounded-md border p-3", AI_TONE.soft)}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold">Answer</p>
                <AiConfidence value={conf} />
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-foreground">
                <Highlight text={hits[0].passage.text} terms={termsFor(asked, hits[0])} />
                <sup className={cn("ml-0.5 font-semibold", AI_TONE.text)}>[1]</sup>
              </p>
            </div>
            <p className="text-[11px] font-semibold text-muted-foreground">Cited passages</p>
            <ol className="flex flex-col gap-2">
              {hits.map((h, i) => (
                <li key={h.passage.id} className="rounded-md border border-border p-2.5">
                  <AiCitation index={i + 1} docTitle={`${h.doc.title} ${h.doc.version}`} section={h.passage.section} page={h.passage.page} />
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                    <Highlight text={h.passage.text} terms={termsFor(asked, h)} />
                  </p>
                </li>
              ))}
            </ol>
          </div>
        )}
        {!loading && !asked && (
          <p className="py-6 text-center text-xs text-muted-foreground">Ask a question or pick an example above.</p>
        )}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------ upload */

const uploadSchema = z.object({
  title: z.string().min(3, "Give the document a title"),
  category: z.string().min(1, "Pick a category"),
  version: z.string().min(1, "Enter a version, e.g. v1.0"),
  audience: z.string().min(3, "Who does this apply to?"),
});
type UploadValues = z.infer<typeof uploadSchema>;

const STEPS = ["Upload", "Extract text", "Chunk", "Embed & index"] as const;

function UploadDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: (doc: KbDocument) => void;
}) {
  const { persona } = useApp();
  const [file, setFile] = React.useState<{ name: string; size: number } | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [step, setStep] = React.useState(-1);
  const [drag, setDrag] = React.useState(false);
  const [discard, setDiscard] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const form = useForm<UploadValues>({
    resolver: zodResolver(uploadSchema),
    defaultValues: { title: "", category: "", version: "v1.0", audience: "All employees" },
  });

  const category = useWatch({ control: form.control, name: "category" });

  React.useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const reset = () => {
    timers.current.forEach(clearTimeout);
    form.reset();
    setFile(null);
    setFileError(null);
    setStep(-1);
  };

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (!/\.(pdf|docx|md|txt)$/i.test(f.name)) {
      setFileError("Only PDF, DOCX, Markdown or text files can be indexed.");
      return;
    }
    setFileError(null);
    setFile({ name: f.name, size: f.size });
    if (!form.getValues("title")) form.setValue("title", f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "), { shouldDirty: true });
  };

  const submit = form.handleSubmit((v) => {
    if (!file) {
      setFileError("Choose a file to upload.");
      return;
    }
    setStep(0);
    STEPS.forEach((_, i) => {
      timers.current.push(setTimeout(() => setStep(i + 1), 700 * (i + 1)));
    });
    timers.current.push(
      setTimeout(() => {
        const pages = Math.max(2, Math.round(file.size / 48000) || 6);
        onDone({
          id: `kb-up-${file.name}`,
          title: v.title,
          category: v.category as KbDocument["category"],
          version: v.version,
          owner: persona.name,
          pages,
          chunks: pages * 4,
          status: "indexed",
          updatedOn: "2026-09-16",
          indexedOn: "2026-09-16",
          audience: v.audience,
          passages: [],
        });
        mockAction(`${v.title} indexed`, { description: `${pages} pages · ${pages * 4} chunks · PII scan passed · available to Copilot now` });
        reset();
        onOpenChange(false);
      }, 700 * (STEPS.length + 1)),
    );
  });

  const running = step >= 0;
  const dirty = form.formState.isDirty || !!file;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v && running) return;
          if (!v && dirty) {
            setDiscard(true);
            return;
          }
          onOpenChange(v);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload policy document</DialogTitle>
            <DialogDescription>The document is extracted, split into passages, embedded and made searchable by the Copilot. Instructions inside documents are treated as data, never commands.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit}>
            <DialogBody className="flex flex-col gap-3">
              <div
                role="button"
                tabIndex={0}
                aria-label="Choose a file to upload"
                onClick={() => !running && inputRef.current?.click()}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && !running) {
                    e.preventDefault();
                    inputRef.current?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  pickFile(e.dataTransfer.files[0]);
                }}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-1.5 rounded-md border border-dashed px-4 py-6 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  drag ? "border-violet-400 bg-violet-50 dark:bg-violet-500/10" : "border-border bg-subtle",
                )}
              >
                <Upload className="size-5 text-muted-foreground" aria-hidden />
                {file ? (
                  <p className="text-xs font-medium">
                    {file.name} <span className="text-muted-foreground">· {num(Math.max(1, Math.round(file.size / 1024)))} KB</span>
                  </p>
                ) : (
                  <p className="text-xs">
                    <span className="font-medium text-foreground">Drop a file here</span> <span className="text-muted-foreground">or click to browse</span>
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground">PDF, DOCX, Markdown or text · up to 25 MB · scanned PDFs need a text layer</p>
                <input ref={inputRef} type="file" accept=".pdf,.docx,.md,.txt" className="sr-only" tabIndex={-1} onChange={(e) => pickFile(e.target.files?.[0])} />
              </div>
              {fileError && (
                <p role="alert" className="text-xs text-destructive-fg">
                  {fileError}
                </p>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Title" htmlFor="kb-title" required error={form.formState.errors.title?.message} className="sm:col-span-2">
                  <Input id="kb-title" aria-invalid={!!form.formState.errors.title} disabled={running} {...form.register("title")} />
                </Field>
                <Field label="Category" required error={form.formState.errors.category?.message}>
                  <Select
                    value={category}
                    onValueChange={(v) => form.setValue("category", v, { shouldValidate: true, shouldDirty: true })}
                    disabled={running}
                  >
                    <SelectTrigger aria-label="Category" aria-invalid={!!form.formState.errors.category}>
                      <SelectValue placeholder="Choose…" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Version" htmlFor="kb-version" required error={form.formState.errors.version?.message}>
                  <Input id="kb-version" disabled={running} {...form.register("version")} />
                </Field>
                <Field label="Applies to" htmlFor="kb-aud" required error={form.formState.errors.audience?.message} className="sm:col-span-2">
                  <Input id="kb-aud" disabled={running} {...form.register("audience")} />
                </Field>
              </div>

              {running && (
                <ol className="flex flex-col gap-1.5 rounded-md border border-border p-3" aria-live="polite">
                  {STEPS.map((s, i) => (
                    <li key={s} className="flex items-center gap-2 text-xs">
                      {step > i ? (
                        <Check className="size-3.5 text-success-fg" aria-hidden />
                      ) : step === i ? (
                        <Loader2 className="size-3.5 animate-spin text-violet-600 motion-reduce:animate-none dark:text-violet-300" aria-hidden />
                      ) : (
                        <span className="size-3.5 rounded-full border border-border" aria-hidden />
                      )}
                      <span className={cn(step >= i ? "text-foreground" : "text-muted-foreground")}>{s}</span>
                      {step > i && <span className="ml-auto text-[11px] text-muted-foreground">Done</span>}
                    </li>
                  ))}
                  <Progress value={Math.min(100, (step / STEPS.length) * 100)} aria-label="Indexing progress" className="mt-1" />
                </ol>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={running} onClick={() => (dirty ? setDiscard(true) : onOpenChange(false))}>
                Cancel
              </Button>
              <Button type="submit" className={AI_TONE.solid} disabled={running}>
                {running ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Upload aria-hidden />}
                {running ? "Indexing…" : "Upload & index"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={discard}
        onOpenChange={setDiscard}
        title="Discard this upload?"
        description="The file and the details you entered will be lost."
        confirmLabel="Discard"
        destructive
        onConfirm={() => {
          reset();
          setDiscard(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------ page */

export default function KnowledgePage() {
  const loading = useFakeLoad();
  const { can } = useApp();
  const [docs, setDocs] = React.useState<KbDocument[]>(KB_DOCUMENTS);
  const [category, setCategory] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [viewing, setViewing] = React.useState<KbDocument | null>(null);
  const [deleting, setDeleting] = React.useState<KbDocument | null>(null);

  // Citation links arrive as /ai/knowledge?doc=<id> — open that document.
  React.useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("doc");
    const d = id ? KB_DOCUMENTS.find((x) => x.id === id) : null;
    if (d) setViewing(d);
  }, []);

  const filtered = docs.filter((d) => (category === "all" || d.category === category) && (status === "all" || d.status === status));
  const canManage = can("ai.knowledge", "C");

  const columns = React.useMemo<ColumnDef<KbDocument, unknown>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Document",
        cell: ({ row }) => (
          <button type="button" className="flex min-w-0 items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setViewing(row.original)}>
            <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium text-foreground hover:underline">{row.original.title}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{row.original.audience}</span>
            </span>
          </button>
        ),
      },
      { accessorKey: "category", header: "Category", cell: ({ row }) => <MutedCell>{row.original.category}</MutedCell> },
      { accessorKey: "version", header: "Version", cell: ({ row }) => <span className="font-mono text-xs">{row.original.version}</span> },
      { accessorKey: "owner", header: "Owner", cell: ({ row }) => <span className="text-xs">{row.original.owner}</span> },
      { accessorKey: "pages", header: "Pages", cell: ({ row }) => <NumCell>{row.original.pages}</NumCell> },
      { accessorKey: "chunks", header: "Chunks", cell: ({ row }) => <NumCell>{row.original.chunks ? num(row.original.chunks) : "—"}</NumCell> },
      {
        accessorKey: "status",
        header: "Index status",
        cell: ({ row }) => {
          const d = row.original;
          return (
            <div className="flex flex-col gap-0.5">
              <StatusBadge status={STATUS[d.status].status} label={STATUS[d.status].label} />
              {d.failReason && <span className="max-w-[220px] text-[11px] leading-snug text-destructive-fg">{d.failReason}</span>}
            </div>
          );
        },
      },
      { accessorKey: "updatedOn", header: "Last updated", cell: ({ row }) => <MutedCell>{fmtDate(row.original.updatedOn)}</MutedCell> },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        cell: ({ row }) => {
          const d = row.original;
          return (
            <div className="flex justify-end gap-1">
              {d.status === "failed" && (
                <Gated menuKey="ai.knowledge" action="E" hide>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDocs((all) => all.map((x) => (x.id === d.id ? { ...x, status: "indexing", failReason: undefined } : x)));
                      mockAction(`Re-indexing ${d.title}`, { description: "OCR retry with the high-accuracy model — you'll be notified when it completes.", tone: "info" });
                    }}
                  >
                    <RefreshCw aria-hidden />
                    Retry
                  </Button>
                </Gated>
              )}
              <Gated menuKey="ai.knowledge" action="D">
                <Button size="icon-sm" variant="ghost" aria-label={`Delete ${d.title}`} onClick={() => setDeleting(d)}>
                  <Trash2 aria-hidden />
                </Button>
              </Gated>
            </div>
          );
        },
      },
    ],
    [],
  );

  return (
    <PageBody>
      <PageHeader
        title="Policy Knowledge Base"
        description="The documents the Copilot answers policy questions from. Every answer cites the passage it used; questions no document covers are logged here as gaps."
        actions={
          <>
            <AiBadge label="Powers Copilot & Helpdesk AI" />
            <Gated menuKey="ai.knowledge" action="C">
              <Button size="sm" className={AI_TONE.solid} onClick={() => setUploadOpen(true)}>
                <Upload aria-hidden />
                Upload document
              </Button>
            </Gated>
          </>
        }
      />

      {loading ? (
        <CardsSkeleton />
      ) : (
        <StatRow>
          <StatTile label="Indexed documents" value={`${docs.filter((d) => d.status === "indexed").length} / ${docs.length}`} icon={BookOpen} hint={`${num(docs.reduce((a, d) => a + d.chunks, 0))} searchable passages`} />
          <StatTile label="Questions answered · 30 days" value={num(KB_STATS.questions30d)} icon={MessageSquareQuote} hint={`${pct(KB_STATS.answeredPct)} answered with a citation`} />
          <StatTile label="Tickets deflected · Sep" value={num(KB_STATS.deflectedTickets)} deltaValue={7.2} goodDirection="up" deltaLabel="vs Aug" icon={Check} tone="good" />
          <StatTile label="Knowledge gaps" value={num(KB_UNANSWERED.length)} icon={HelpCircle} hint={`${num(KB_UNANSWERED.reduce((a, g) => a + g.count, 0))} unanswered asks this month`} tone="warning" />
        </StatRow>
      )}

      {!canManage && (
        <Alert tone="neutral" icon={BookOpen}>
          You can read and test the knowledge base. Uploading and removing documents is limited to HR and HR operations.
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Section title="Indexed documents" description="Only Indexed documents are used to answer questions." bodyClassName="p-0">
          <div className="p-3">
            {loading ? (
              <TableSkeleton />
            ) : (
              <DataTable
                columns={columns}
                data={filtered}
                searchKeys={["title", "owner", "category"]}
                searchPlaceholder="Search documents…"
                getRowId={(d) => d.id}
                exportName="knowledge-base-documents"
                dense
                rowTone={(d) => (d.status === "failed" ? "danger" : undefined)}
                filters={
                  <>
                    <FilterSelect label="Category" value={category} onValueChange={setCategory} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
                    <FilterSelect
                      label="Status"
                      value={status}
                      onValueChange={setStatus}
                      options={[
                        { value: "indexed", label: "Indexed" },
                        { value: "indexing", label: "Indexing" },
                        { value: "failed", label: "Failed" },
                      ]}
                      width="w-[130px]"
                    />
                  </>
                }
                emptyTitle="No documents match"
                emptyDescription="Clear the filters, or upload a policy document to start answering questions from it."
                emptyIcon={BookOpen}
              />
            )}
          </div>
        </Section>

        <TestQuestion />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Section title="Top questions asked" description="Last 30 days, all channels">
          <ol className="flex flex-col divide-y divide-border">
            {KB_TOP_QUESTIONS.map((t, i) => (
              <li key={t.question} className="flex items-start gap-2 py-1.5 text-xs">
                <span className="tnum w-4 shrink-0 text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-foreground">{t.question}</span>
                  <span className="block text-[11px] text-muted-foreground">{t.doc}</span>
                </span>
                <span className="tnum shrink-0 font-medium">{num(t.count)}</span>
              </li>
            ))}
          </ol>
        </Section>
        <Section title="Unanswered questions" description="Gaps to fill — the Copilot said “I don't know”">
          {KB_UNANSWERED.length === 0 ? (
            <EmptyState title="No gaps" description="Every question this month was answered from an indexed document." />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {KB_UNANSWERED.map((g) => (
                <li key={g.question} className="flex items-start gap-2 py-1.5 text-xs">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-foreground">{g.question}</span>
                    <span className="block text-[11px] text-muted-foreground">{g.suggestion}</span>
                  </span>
                  <span className="tnum shrink-0 text-muted-foreground">{g.count}×</span>
                  <Gated menuKey="ai.knowledge" action="E" hide>
                    <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[11px]" onClick={() => mockAction("Gap assigned to document owner", { description: g.question })}>
                      Assign
                    </Button>
                  </Gated>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <BarCompareChart
          title="Tickets deflected vs raised"
          description="Policy questions answered by AI instead of becoming HR tickets"
          data={KB_DEFLECTION_TREND}
          xKey="month"
          series={[
            { key: "deflected", label: "Deflected by AI" },
            { key: "raised", label: "Raised as tickets" },
          ]}
          height={210}
        />
      </div>

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} onDone={(d) => setDocs((all) => [d, ...all])} />

      <Sheet open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <SheetContent width="sm:max-w-lg">
          {viewing && (
            <>
              <SheetHeader>
                <SheetTitle>{viewing.title}</SheetTitle>
                <SheetDescription>
                  {viewing.version} · {viewing.pages} pages · owner {viewing.owner} · updated {fmtDate(viewing.updatedOn)}
                </SheetDescription>
              </SheetHeader>
              <SheetBody className="scrollbar-thin flex flex-col gap-2 overflow-y-auto">
                <StatusBadge status={STATUS[viewing.status].status} label={STATUS[viewing.status].label} />
                {viewing.failReason && <Alert tone="danger">{viewing.failReason}</Alert>}
                {viewing.passages.length === 0 && !viewing.failReason && (
                  <p className="text-xs text-muted-foreground">
                    {viewing.status === "indexing" ? "Passages appear here once indexing completes." : "Passages for this upload are being prepared for preview."}
                  </p>
                )}
                {viewing.passages.map((p) => (
                  <article key={p.id} className="rounded-md border border-border p-3">
                    <p className="flex items-center justify-between text-xs font-semibold">
                      {p.section}
                      <span className="text-[11px] font-normal text-muted-foreground">p.{p.page}</span>
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{p.text}</p>
                  </article>
                ))}
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Remove ${deleting?.title ?? "document"}?`}
        description="The Copilot will stop citing it immediately. Past answers in the audit log keep their citation for traceability."
        confirmLabel="Remove document"
        destructive
        onConfirm={() => {
          const d = deleting;
          if (!d) return;
          setDocs((all) => all.filter((x) => x.id !== d.id));
          setDeleting(null);
          mockAction(`${d.title} removed from the knowledge base`, { undo: () => setDocs((all) => [d, ...all]) });
        }}
      />
    </PageBody>
  );
}
