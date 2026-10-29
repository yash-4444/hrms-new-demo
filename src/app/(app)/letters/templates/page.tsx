"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Copy, LayoutTemplate, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { fmtDateTime, num } from "@/lib/format";
import { DEMO_NOW } from "@/mock/org";
import { LETTERS, LETTER_LABEL, LETTER_TEMPLATES, type LetterTemplate, type LetterType } from "@/mock/masters";
import { TemplateEditor } from "@/components/org/template-editor";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, NumCell } from "@/components/data-table";
import { Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { ConfirmDialog, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, FilterSelect } from "@/components/ui/overlays";

type Row = LetterTemplate & { typeLabel: string; usage: number };

export default function LetterTemplatesPage() {
  const loading = useFakeLoad();
  const { can, persona } = useApp();
  const [templates, setTemplates] = React.useState<LetterTemplate[]>(LETTER_TEMPLATES);
  const [type, setType] = React.useState("all");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<LetterTemplate | null>(null);

  const editing = templates.find((t) => t.id === editingId) ?? null;
  const rows: Row[] = templates
    .filter((t) => type === "all" || t.type === type)
    .map((t) => ({ ...t, typeLabel: LETTER_LABEL[t.type], usage: LETTERS.filter((l) => l.templateId === t.id).length }));

  const bump = (id: string, patch: Partial<LetterTemplate>, note: string) =>
    setTemplates((ts) =>
      ts.map((t) =>
        t.id === id
          ? {
              ...t,
              ...patch,
              version: t.version + 1,
              versions: [{ version: t.version + 1, at: DEMO_NOW, by: persona.name, note }, ...t.versions],
              updatedBy: persona.name,
              updatedAt: DEMO_NOW,
            }
          : t,
      ),
    );

  const duplicate = (t: LetterTemplate) => {
    const id = `TPL-${String(templates.length + 1).padStart(2, "0")}`;
    setTemplates((ts) => [
      { ...t, id, name: `${t.name} (copy)`, version: 1, versions: [{ version: 1, at: DEMO_NOW, by: persona.name, note: `Copied from ${t.id} v${t.version}` }], updatedBy: persona.name, updatedAt: DEMO_NOW },
      ...ts,
    ]);
    mockAction(`${t.name} duplicated as ${id}`, { description: "Edit the copy freely — the original is untouched." });
    return id;
  };

  const create = () => {
    const base = templates.find((t) => t.type === (type === "all" ? "offer" : type)) ?? templates[0];
    setEditingId(duplicate(base));
  };

  const columns: ColumnDef<Row, unknown>[] = [
    {
      accessorKey: "name",
      header: "Template",
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-foreground">{row.original.name}</p>
          <p className="tnum text-[11px] text-muted-foreground">{row.original.id}</p>
        </div>
      ),
    },
    { accessorKey: "typeLabel", header: "Letter type", cell: ({ getValue }) => <Badge variant="muted">{getValue() as string}</Badge> },
    { accessorKey: "subject", header: "Subject line", cell: ({ getValue }) => <span className="line-clamp-1 max-w-[260px] font-mono text-[11px]">{getValue() as string}</span> },
    { accessorKey: "version", header: "Version", cell: ({ getValue }) => <NumCell>{`v${getValue()}`}</NumCell> },
    { accessorKey: "usage", header: "Letters generated", cell: ({ getValue }) => <NumCell>{num(getValue() as number)}</NumCell> },
    {
      accessorKey: "updatedAt",
      header: "Last changed",
      cell: ({ row }) => (
        <div className="leading-tight">
          <p className="text-xs">{row.original.updatedBy}</p>
          <p className="tnum text-[11px] text-muted-foreground">{fmtDateTime(row.original.updatedAt)}</p>
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.original.id}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditingId(row.original.id)}>
                <Pencil aria-hidden />
                {can("people.letter_templates", "E") ? "Edit" : "Open"}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!can("people.letter_templates", "C")} onSelect={() => duplicate(row.original)}>
                <Copy aria-hidden />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive disabled={!can("people.letter_templates", "D")} onSelect={() => setDeleting(row.original)}>
                <Trash2 aria-hidden />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <PageBody>
      <PageHeader
        title="Letter Templates"
        description="Versioned templates with merge tokens. Every generated letter records the template version it came from, so editing a template never rewrites a letter already issued."
        actions={
          !editing && (
            <Gated menuKey="people.letter_templates" action="C">
              <Button size="sm" onClick={create}>
                <Plus aria-hidden />
                New template
              </Button>
            </Gated>
          )
        }
      />

      {editing ? (
        <TemplateEditor
          key={`${editing.id}-${editing.version}`}
          template={editing}
          onBack={() => setEditingId(null)}
          onSave={(t) => {
            bump(editing.id, { subject: t.subject, body: t.body }, t.note);
            mockAction(`${editing.name} saved as v${editing.version + 1}`, { description: "New letters use this version. Issued letters keep theirs." });
          }}
          onRestore={(v) => {
            bump(editing.id, {}, `Restored content of v${v}`);
            mockAction(`v${v} restored as v${editing.version + 1}`, { tone: "info" });
          }}
        />
      ) : (
        <Section bodyClassName="p-3">
          {loading ? (
            <TableSkeleton rows={8} />
          ) : (
            <DataTable<Row>
              columns={columns}
              data={rows}
              searchKeys={["name", "subject", "typeLabel", "id"]}
              searchPlaceholder="Search templates…"
              getRowId={(r) => r.id}
              onRowClick={(r) => setEditingId(r.id)}
              exportName="letter-templates"
              filters={
                <FilterSelect label="Type" value={type} onValueChange={setType} options={(Object.keys(LETTER_LABEL) as LetterType[]).map((t) => ({ value: t, label: LETTER_LABEL[t] }))} width="w-[210px]" />
              }
              emptyIcon={LayoutTemplate}
              emptyTitle="No templates for this letter type"
              emptyDescription="Create one from an existing template — it starts as an editable copy."
            />
          )}
        </Section>
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Delete ${deleting?.name ?? ""}?`}
        description={`${LETTERS.filter((l) => l.templateId === deleting?.id).length} letters were generated from it; they stay intact with their version. The template disappears from the Generate letter dialog.`}
        confirmLabel="Delete template"
        destructive
        onConfirm={() => {
          if (!deleting) return;
          const gone = deleting;
          setTemplates((ts) => ts.filter((t) => t.id !== gone.id));
          mockAction(`${gone.name} deleted`, { tone: "warning", undo: () => setTemplates((ts) => [gone, ...ts]) });
        }}
      />
    </PageBody>
  );
}
