"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarX2, Download, FileText, FolderOpen, Paperclip, ReceiptText, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { fmtDate } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import { employeeByCode } from "@/mock/employees";
import { documentsFor, type DocumentCategory, type EmployeeDocument } from "@/mock/people-extras";
import { aadhaarFor, maskId } from "@/mock/self-service";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, MutedCell } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Alert, Badge, Field, Hint, Input } from "@/components/ui/primitives";
import {
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
} from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { simulateDownload } from "@/components/self-service/bits";
import { useDirtyGuard } from "@/components/self-service/dialogs";

interface DocRow extends EmployeeDocument {
  number: string | null;
  daysToExpiry: number | null;
}

const CATEGORIES: DocumentCategory[] = ["Identity", "Education", "Employment", "Compliance", "Payroll"];

const uploadSchema = z.object({
  name: z.string().min(1, "Choose what you are uploading"),
  fileName: z.string().min(1, "Attach a file"),
  expiresOn: z.string().refine((v) => !v || v > DEMO_TODAY, "An expiry date must be in the future"),
});
type UploadValues = z.infer<typeof uploadSchema>;

export default function MyDocumentsPage() {
  const { persona } = useApp();
  return <MyDocuments key={persona.employeeId} />;
}

function MyDocuments() {
  const loading = useFakeLoad();
  const { persona } = useApp();
  const emp = employeeByCode(persona.employeeId);

  const [rows, setRows] = React.useState<DocRow[]>(() => {
    const docs = documentsFor(persona.employeeId) ?? [];
    return docs.map((d) => ({
      ...d,
      number:
        d.name === "Aadhaar card"
          ? maskId(aadhaarFor(persona.employeeId))
          : d.name === "PAN card" && emp
            ? maskId(emp.pan)
            : d.name === "Passport"
              ? maskId(`Z${persona.employeeId.replace(/\D/g, "")}4417`)
              : null,
      daysToExpiry: d.expiresOn ? differenceInCalendarDays(parseISO(d.expiresOn), parseISO(DEMO_TODAY)) : null,
    }));
  });
  const [category, setCategory] = React.useState("all");
  const [upload, setUpload] = React.useState<{ replace: DocRow | null } | null>(null);

  const expiring = rows.filter((r) => r.daysToExpiry !== null && r.daysToExpiry >= 0 && r.daysToExpiry <= 90);
  const expired = rows.filter((r) => r.status === "expired" || (r.daysToExpiry !== null && r.daysToExpiry < 0));
  const filtered = rows.filter((r) => category === "all" || r.category === category);

  const download = (r: DocRow) => {
    simulateDownload(r.fileName, `${r.name}\n${persona.name} (${persona.employeeId})\nDemo copy — no real document is stored in this build.`);
    mockAction(`Downloading ${r.fileName}`, { description: `${r.sizeKb} KB · watermarked with your employee code.` });
  };

  const form = useForm<UploadValues>({ resolver: zodResolver(uploadSchema), defaultValues: { name: "", fileName: "", expiresOn: "" } });
  const closeUpload = () => setUpload(null);
  const { onOpenChange, guard } = useDirtyGuard(form.formState.isDirty, closeUpload);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const openUpload = (replace: DocRow | null) => {
    form.reset({ name: replace?.name ?? "", fileName: "", expiresOn: "" });
    setUpload({ replace });
  };
  const submitUpload = (v: UploadValues) => {
    const replace = upload?.replace;
    const spec = rows.find((r) => r.name === v.name);
    const next: DocRow = {
      id: replace?.id ?? `new-${rows.length + 1}`,
      employeeCode: persona.employeeId,
      name: v.name,
      category: spec?.category ?? "Compliance",
      fileName: v.fileName,
      sizeKb: 240,
      uploadedOn: DEMO_TODAY,
      expiresOn: v.expiresOn || null,
      status: "pending",
      uploadedBy: persona.name,
      verifiedBy: null,
      number: spec?.number ?? null,
      daysToExpiry: v.expiresOn ? differenceInCalendarDays(parseISO(v.expiresOn), parseISO(DEMO_TODAY)) : null,
    };
    setRows((rs) => (replace ? rs.map((r) => (r.id === replace.id ? next : r)) : [next, ...rs]));
    mockAction(replace ? `Replaced — ${v.name}` : `Uploaded — ${v.name}`, { description: "Sent to HR Operations for verification." });
    setUpload(null);
  };

  const columns: ColumnDef<DocRow, unknown>[] = [
    {
      accessorKey: "name",
      header: "Document",
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{row.original.name}</span>
            <span className="truncate text-[10px] text-muted-foreground">{row.original.fileName}</span>
          </span>
        </span>
      ),
    },
    { accessorKey: "category", header: "Category", cell: ({ row }) => <Badge variant="muted">{row.original.category}</Badge> },
    {
      accessorKey: "number",
      header: "Number",
      cell: ({ row }) =>
        row.original.number ? (
          <Hint text="Masked — only the last 4 characters are ever shown">
            <span className="font-mono text-xs">{row.original.number}</span>
          </Hint>
        ) : (
          <MutedCell>—</MutedCell>
        ),
    },
    { accessorKey: "uploadedOn", header: "Uploaded", cell: ({ row }) => <span className="tnum">{fmtDate(row.original.uploadedOn)}</span> },
    {
      accessorKey: "daysToExpiry",
      header: "Expires",
      cell: ({ row }) => {
        const d = row.original.daysToExpiry;
        if (d === null) return <MutedCell>Never</MutedCell>;
        return (
          <span className="tnum flex items-center gap-1.5">
            {fmtDate(row.original.expiresOn!)}
            {d < 0 ? (
              <Badge variant="outline" className="border-destructive/25 text-destructive-fg">Expired</Badge>
            ) : d <= 90 ? (
              <Badge variant="outline" className="border-warning/30 text-warning-fg">{d}d left</Badge>
            ) : null}
          </span>
        );
      },
    },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} label={row.original.status === "approved" ? "Verified" : undefined} /> },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="icon-sm" variant="ghost" aria-label={`Download ${row.original.name}`} onClick={() => download(row.original)}>
            <Download />
          </Button>
          <Gated menuKey="my.documents" action="C">
            <Button size="sm" variant="outline" onClick={() => openUpload(row.original)}>
              <RefreshCw /> Replace
            </Button>
          </Gated>
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="My documents" description="Loading…" />
        <TableSkeleton rows={8} />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="My documents"
        description="Identity proofs, letters, tax forms and certificates — stored encrypted, numbers masked, every download watermarked and logged."
        actions={
          <Gated menuKey="my.documents" action="C">
            <Button size="sm" onClick={() => openUpload(null)}>
              <Upload /> Upload document
            </Button>
          </Gated>
        }
      />

      {(expiring.length > 0 || expired.length > 0) && (
        <Alert
          tone={expired.length ? "danger" : "warning"}
          icon={CalendarX2}
          title={
            expired.length
              ? `${expired.length} document${expired.length === 1 ? " has" : "s have"} expired`
              : `${expiring.length} document${expiring.length === 1 ? "" : "s"} expiring within 90 days`
          }
          action={
            <Gated menuKey="my.documents" action="C">
              <Button size="sm" variant="outline" onClick={() => openUpload(expired[0] ?? expiring[0])}>
                Upload renewal
              </Button>
            </Gated>
          }
        >
          {[...expired, ...expiring].map((r) => r.name).join(", ")}. Renew before the date to keep travel, compliance and payroll
          records valid.
        </Alert>
      )}

      <StatRow cols={4}>
        <StatTile label="Documents on file" value={rows.length} icon={FolderOpen} />
        <StatTile label="Verified" value={rows.filter((r) => r.status === "approved").length} icon={ShieldCheck} tone="good" />
        <StatTile label="Awaiting verification" value={rows.filter((r) => r.status === "pending").length} icon={Paperclip} tone="warning" />
        <StatTile label="Expiring / expired" value={expiring.length + expired.length} icon={CalendarX2} tone={expired.length ? "critical" : "neutral"} />
      </StatRow>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { title: "Payslips", body: "Last 12 months, with a full statutory breakdown.", href: "/payslips", icon: ReceiptText },
          { title: "Form 16 — FY 2025-26", body: "Part A (TRACES) and Part B, issued 14 Jun 2026.", file: "Form16-FY2025-26.pdf", icon: FileText },
          { title: "Offer & appointment letters", body: "Digitally signed copies from your joining.", file: "Appointment-letter.pdf", icon: FileText },
        ].map((c) => (
          <Section key={c.title} bodyClassName="p-3">
            <div className="flex items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-soft-foreground">
                <c.icon className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold">{c.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{c.body}</p>
                {c.href ? (
                  <Link href={c.href} className="mt-1.5 inline-block text-xs text-primary hover:underline">
                    Open payslips
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="mt-1.5 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    onClick={() => {
                      simulateDownload(c.file!, `${c.title}\n${persona.name}`);
                      mockAction(`Downloading ${c.file}`);
                    }}
                  >
                    <Download className="size-3" aria-hidden /> Download
                  </button>
                )}
              </div>
            </div>
          </Section>
        ))}
      </div>

      <Section title="All documents" bodyClassName="p-4">
        <DataTable
          columns={columns}
          data={filtered}
          searchKeys={["name", "fileName", "category"]}
          searchPlaceholder="Search documents…"
          exportName="my-documents"
          getRowId={(r) => r.id}
          rowTone={(r) => (r.daysToExpiry !== null && r.daysToExpiry < 0 ? "danger" : r.daysToExpiry !== null && r.daysToExpiry <= 90 ? "warning" : undefined)}
          emptyIcon={FolderOpen}
          emptyTitle="No documents in this category"
          emptyDescription="Upload one, or clear the category filter."
          emptyAction={
            <Gated menuKey="my.documents" action="C">
              <Button size="sm" onClick={() => openUpload(null)}>
                <Upload /> Upload document
              </Button>
            </Gated>
          }
          filters={
            <FilterSelect label="Category" value={category} onValueChange={setCategory} allLabel="All" options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          }
        />
      </Section>

      <Dialog open={!!upload} onOpenChange={onOpenChange}>
        <DialogContent size="sm">
          <form onSubmit={form.handleSubmit(submitUpload)} className="flex min-h-0 flex-col">
            <DialogHeader>
              <DialogTitle>{upload?.replace ? `Replace ${upload.replace.name}` : "Upload a document"}</DialogTitle>
              <DialogDescription>HR Operations verifies new uploads within 2 working days.</DialogDescription>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-3">
              <Field label="Document type" required error={form.formState.errors.name?.message}>
                <Select
                  value={form.watch("name")}
                  onValueChange={(v) => form.setValue("name", v, { shouldDirty: true, shouldValidate: true })}
                  disabled={!!upload?.replace}
                >
                  <SelectTrigger aria-label="Document type" aria-invalid={!!form.formState.errors.name}>
                    <SelectValue placeholder="Choose…" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(new Set([...rows.map((r) => r.name), "Passport", "Driving licence", "Professional certification"])).map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="File" required error={form.formState.errors.fileName?.message} hint="PDF, JPG or PNG up to 5 MB.">
                <div className="flex items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="sr-only"
                    aria-label="Choose a file"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) form.setValue("fileName", f.name, { shouldDirty: true, shouldValidate: true });
                    }}
                  />
                  <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                    <Paperclip /> Choose file
                  </Button>
                  <span className="truncate text-xs text-muted-foreground">{form.watch("fileName") || "No file chosen"}</span>
                </div>
              </Field>
              <Field label="Expiry date (if any)" htmlFor="doc-exp" error={form.formState.errors.expiresOn?.message}>
                <Input id="doc-exp" type="date" aria-invalid={!!form.formState.errors.expiresOn} {...form.register("expiresOn")} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">
                <Upload /> {upload?.replace ? "Replace" : "Upload"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </PageBody>
  );
}
