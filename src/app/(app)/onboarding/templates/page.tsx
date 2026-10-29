"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Copy, ListChecks, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { mockAction } from "@/components/app-state";
import { DataTable } from "@/components/data-table";
import { Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, Field, Input } from "@/components/ui/primitives";
import {
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/overlays";
import { LcBadge, OwnerChip, useDirtyGuard } from "@/components/lifecycle/kit";
import { DEMO_TODAY, branchById, deptName } from "@/mock/org";
import { ONBOARDING, TEMPLATES, offsetLabel, phaseOf, type ChecklistTemplate, type TemplateTask } from "@/mock/lifecycle";

/* ============================================================================
   /onboarding/templates — the checklists that every onboarding instance is
   generated from. Offsets are relative to the joining date (D-7, D0, D+14).
   ========================================================================== */

const cloneSchema = z.object({
  name: z.string().trim().min(4, "Give the template a name"),
  appliesTo: z.string().trim().min(8, "Say who it is for"),
});
type CloneValues = z.infer<typeof cloneSchema>;

function CloneDialog({ source, onClose, onSave }: { source: ChecklistTemplate; onClose: () => void; onSave: (v: CloneValues) => void }) {
  const form = useForm<CloneValues>({ resolver: zodResolver(cloneSchema), defaultValues: { name: `${source.name} (copy)`, appliesTo: source.appliesTo } });
  const { onOpenChange, guard } = useDirtyGuard(form.formState.isDirty, onClose);
  const { errors } = form.formState;
  return (
    <>
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Clone “{source.name}”</DialogTitle>
            <DialogDescription>Copies all {source.tasks.length} tasks, owners, offsets and SLAs. Edit the copy afterwards.</DialogDescription>
          </DialogHeader>
          <form
            noValidate
            onSubmit={form.handleSubmit((v) => {
              onSave(v);
              onClose();
            })}
          >
            <DialogBody className="flex flex-col gap-3.5">
              <Field label="Template name" htmlFor="cl-name" required error={errors.name?.message}>
                <Input id="cl-name" aria-invalid={!!errors.name} {...form.register("name")} />
              </Field>
              <Field label="Applies to" htmlFor="cl-applies" required error={errors.appliesTo?.message}>
                <Input id="cl-applies" aria-invalid={!!errors.appliesTo} {...form.register("appliesTo")} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Clone template</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}

export default function TemplatesPage() {
  const loading = useFakeLoad();
  const [templates, setTemplates] = React.useState<ChecklistTemplate[]>(TEMPLATES);
  const [activeId, setActiveId] = React.useState(TEMPLATES[0].id);
  const [cloning, setCloning] = React.useState<ChecklistTemplate | null>(null);
  const [removing, setRemoving] = React.useState<TemplateTask | null>(null);
  const [deleting, setDeleting] = React.useState<ChecklistTemplate | null>(null);

  const active = templates.find((t) => t.id === activeId) ?? templates[0];
  const inUse = (t: ChecklistTemplate) => ONBOARDING.filter((i) => i.templateId === t.id).length;

  const columns = React.useMemo<ColumnDef<TemplateTask, unknown>[]>(
    () => [
      { id: "title", header: "Task", accessorKey: "title", enableHiding: false, cell: ({ row }) => <span className="font-medium">{row.original.title}</span> },
      { id: "owner", header: "Owner", accessorKey: "owner", cell: ({ row }) => <OwnerChip owner={row.original.owner} /> },
      {
        id: "offset",
        header: "When",
        accessorKey: "offset",
        cell: ({ row }) => (
          <span className="tnum font-mono text-xs">
            {offsetLabel(row.original.offset)}
            <span className="ml-1.5 font-sans text-muted-foreground">{phaseOf(row.original.offset)}</span>
          </span>
        ),
      },
      { id: "sla", header: "SLA", accessorKey: "slaHours", cell: ({ row }) => <span className="tnum">{row.original.slaHours}h</span> },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <Gated menuKey="lifecycle.templates" action="D">
            <Button size="icon-sm" variant="ghost" aria-label={`Remove ${row.original.title}`} onClick={(e) => { e.stopPropagation(); setRemoving(row.original); }}>
              <Trash2 aria-hidden />
            </Button>
          </Gated>
        ),
      },
    ],
    [],
  );

  const sorted = [...active.tasks].sort((a, b) => a.offset - b.offset);

  return (
    <PageBody>
      <PageHeader
        title="Checklist Templates"
        description="Onboarding checklists by department and location. A template is picked automatically when an offer is accepted, and every instance keeps the version it was generated from."
      />
      {loading ? (
        <TableSkeleton rows={6} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <nav aria-label="Templates" className="flex flex-col gap-2">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveId(t.id)}
                aria-current={t.id === active.id ? "true" : undefined}
                className={cn(
                  "rounded-md border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  t.id === active.id ? "border-primary/40 bg-primary-soft" : "border-border bg-card hover:bg-muted",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{t.name}</span>
                  <Badge variant="muted" className="tnum">{t.tasks.length} tasks</Badge>
                </span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">{t.appliesTo}</span>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  {inUse(t) ? `${inUse(t)} active joiner${inUse(t) === 1 ? "" : "s"}` : "No active joiners"} · updated {fmtDate(t.updatedOn)}
                </span>
              </button>
            ))}
          </nav>

          <Section
            title={active.name}
            description={`${active.departmentIds.map(deptName).join(", ")} · ${active.branchIds.map((b) => branchById(b)?.city ?? b).join(", ")} · last edited by ${active.updatedBy}`}
            actions={
              <>
                <Gated menuKey="lifecycle.templates" action="C">
                  <Button size="sm" variant="outline" onClick={() => setCloning(active)}>
                    <Copy aria-hidden /> Clone
                  </Button>
                </Gated>
                <Gated menuKey="lifecycle.templates" action="D">
                  <Button size="sm" variant="ghost" onClick={() => setDeleting(active)} disabled={inUse(active) > 0}>
                    <Trash2 aria-hidden /> Delete
                  </Button>
                </Gated>
              </>
            }
          >
            <div className="mb-3 flex flex-wrap gap-1.5">
              {(["Pre-joining", "Day 1", "Week 1", "Month 1"] as const).map((p) => (
                <LcBadge key={p} status="upcoming" label={`${p} · ${active.tasks.filter((t) => phaseOf(t.offset) === p).length}`} />
              ))}
            </div>
            {sorted.length ? (
              <DataTable columns={columns} data={sorted} getRowId={(r) => r.key} exportName={`template-${active.id}`} dense pageSize={25} />
            ) : (
              <EmptyState icon={ListChecks} title="No tasks in this template" description="Clone another template to start from a proven checklist." />
            )}
          </Section>
        </div>
      )}

      {cloning && (
        <CloneDialog
          source={cloning}
          onClose={() => setCloning(null)}
          onSave={(v) => {
            const id = `TPL-COPY-${templates.length + 1}`;
            setTemplates((xs) => [...xs, { ...cloning, id, name: v.name, appliesTo: v.appliesTo, updatedOn: DEMO_TODAY, updatedBy: "You", tasks: cloning.tasks.map((t) => ({ ...t })) }]);
            setActiveId(id);
            mockAction("Template cloned", { description: `${v.name} — ${cloning.tasks.length} tasks copied from ${cloning.name}.` });
          }}
        />
      )}
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(v) => !v && setRemoving(null)}
        title="Remove this task from the template?"
        description={`“${removing?.title}” will not be generated for future joiners. Checklists already generated keep it.`}
        confirmLabel="Remove task"
        destructive
        onConfirm={() => {
          if (!removing) return;
          setTemplates((xs) => xs.map((t) => (t.id === active.id ? { ...t, tasks: t.tasks.filter((x) => x.key !== removing.key), updatedOn: DEMO_TODAY, updatedBy: "You" } : t)));
          mockAction("Task removed", { description: `${removing.title} removed from ${active.name}.` });
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Delete “${deleting?.name}”?`}
        description="Joiners in these departments and locations fall back to the Corporate functions – India template."
        confirmLabel="Delete template"
        destructive
        onConfirm={() => {
          if (!deleting) return;
          setTemplates((xs) => xs.filter((t) => t.id !== deleting.id));
          setActiveId(templates[0].id === deleting.id ? templates[1].id : templates[0].id);
          mockAction("Template deleted", { description: deleting.name, tone: "warning" });
        }}
      />
    </PageBody>
  );
}
