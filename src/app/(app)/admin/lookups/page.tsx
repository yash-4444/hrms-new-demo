"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Building, Globe2, ListTree, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { num } from "@/lib/format";
import { LOOKUP_CATEGORIES, type LookupCategory, type LookupValue } from "@/mock/platform";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, NumCell } from "@/components/data-table";
import { Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Badge, Field, Input, Switch } from "@/components/ui/primitives";
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
import { TonePill, useDirtyGuard } from "@/components/platform/kit";

type Row = LookupValue & { index: number; total: number };

export default function LookupsPage() {
  const loading = useFakeLoad();
  const { can } = useApp();
  const [cats, setCats] = React.useState<LookupCategory[]>(LOOKUP_CATEGORIES);
  const [catId, setCatId] = React.useState("separation_reason");
  const [deleting, setDeleting] = React.useState<LookupValue | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);

  const cat = cats.find((c) => c.id === catId)!;
  const rows: Row[] = cat.values.map((v, index) => ({ ...v, index, total: cat.values.length }));
  const canEdit = can("admin.lookups", "E");

  const patchValues = (fn: (vals: LookupValue[]) => LookupValue[]) =>
    setCats((prev) => prev.map((c) => (c.id === catId ? { ...c, values: fn(c.values) } : c)));

  const move = (i: number, dir: -1 | 1) => {
    patchValues((vals) => {
      const next = [...vals];
      [next[i], next[i + dir]] = [next[i + dir], next[i]];
      return next;
    });
    mockAction("Display order updated", { description: "Dropdowns across the app show the new order immediately.", tone: "info" });
  };

  const schema = React.useMemo(
    () =>
      z.object({
        label: z.string().trim().min(2, "Enter a label").refine((l) => !cat.values.some((v) => v.label.toLowerCase() === l.toLowerCase()), "This value already exists in the category"),
        code: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,29}$/, "Upper-case letters, digits and underscores, e.g. SABBATICAL"),
        tag: z.string(),
      }).refine((v) => !cat.tagOptions || v.tag !== "", { path: ["tag"], message: `Pick a ${cat.tagLabel?.toLowerCase()}` }),
    [cat],
  );
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { label: "", code: "", tag: "" } });
  const close = () => {
    setAddOpen(false);
    form.reset({ label: "", code: "", tag: "" });
  };
  const guard = useDirtyGuard(form.formState.isDirty, close);

  const onAdd = form.handleSubmit((v) => {
    patchValues((vals) => [...vals, { id: `LV-N-${catId}-${vals.length}`, code: v.code, label: v.label, active: true, scope: "tenant", tag: v.tag || undefined, usage: 0 }]);
    mockAction(`“${v.label}” added to ${cat.name}`, { description: "Tenant-only value. It appears at the end of the list — reorder if needed." });
    close();
  });

  const columns: ColumnDef<Row, unknown>[] = [
    {
      id: "order",
      header: "Order",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-0.5">
          <span className="tnum w-5 text-xs text-muted-foreground">{row.original.index + 1}</span>
          <Button variant="ghost" size="icon-sm" aria-label={`Move ${row.original.label} up`} disabled={!canEdit || row.original.index === 0} onClick={() => move(row.original.index, -1)}>
            <ArrowUp />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={`Move ${row.original.label} down`} disabled={!canEdit || row.original.index === row.original.total - 1} onClick={() => move(row.original.index, 1)}>
            <ArrowDown />
          </Button>
        </div>
      ),
    },
    { accessorKey: "label", header: "Value", enableSorting: false, cell: ({ row }) => <span className={cn("text-xs font-medium", !row.original.active && "text-muted-foreground line-through")}>{row.original.label}</span> },
    { accessorKey: "code", header: "Code", enableSorting: false, cell: ({ row }) => <span className="font-mono text-[11px]">{row.original.code}</span> },
    ...(cat.tagLabel
      ? [{ accessorKey: "tag", header: cat.tagLabel, enableSorting: false, cell: ({ row }: { row: { original: Row } }) => <TonePill tone={row.original.tag?.startsWith("Involuntary") ? "serious" : row.original.tag?.includes("non-") ? "neutral" : "warning"}>{row.original.tag}</TonePill> } as ColumnDef<Row, unknown>]
      : []),
    {
      accessorKey: "scope",
      header: "Source",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.scope === "baseline" ? (
          <TonePill tone="neutral" icon={Globe2}>Platform baseline</TonePill>
        ) : (
          <TonePill tone="accent" icon={Building}>Tenant</TonePill>
        ),
    },
    { accessorKey: "usage", header: "Records using it", enableSorting: false, cell: ({ row }) => <NumCell>{num(row.original.usage)}</NumCell> },
    {
      accessorKey: "active",
      header: "Active",
      enableSorting: false,
      cell: ({ row }) => (
        <Gated menuKey="admin.lookups" action="E">
          <Switch
            checked={row.original.active}
            aria-label={`${row.original.active ? "Deactivate" : "Activate"} ${row.original.label}`}
            onCheckedChange={(on) => {
              patchValues((vals) => vals.map((x) => (x.id === row.original.id ? { ...x, active: on } : x)));
              mockAction(`${row.original.label} ${on ? "activated" : "deactivated"}`, {
                description: on ? "Available in dropdowns again." : `Hidden from new entries. The ${num(row.original.usage)} existing records keep it.`,
              });
            }}
          />
        </Gated>
      ),
    },
    {
      id: "__a",
      header: "",
      enableHiding: false,
      cell: ({ row }) =>
        row.original.scope === "tenant" ? (
          <div className="flex justify-end">
            <Gated menuKey="admin.lookups" action="D">
              <Button variant="ghost" size="icon-sm" aria-label={`Delete ${row.original.label}`} onClick={() => setDeleting(row.original)}>
                <Trash2 />
              </Button>
            </Gated>
          </div>
        ) : null,
    },
  ];

  return (
    <PageBody>
      <PageHeader
        title="Lookups"
        description="The pick-lists behind every dropdown. Platform baseline values ship to every tenant and can be deactivated but not deleted; tenant values are yours."
      />

      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[250px_1fr]">
          <Section title="Categories" bodyClassName="p-2">
            <nav aria-label="Lookup categories" className="flex flex-col gap-0.5">
              {cats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCatId(c.id)}
                  aria-current={c.id === catId ? "true" : undefined}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    c.id === catId && "bg-primary-soft text-primary-soft-foreground",
                  )}
                >
                  <span>
                    <span className="block font-medium">{c.name}</span>
                    <span className="text-[11px] text-muted-foreground">{c.module}</span>
                  </span>
                  <Badge variant="muted" className="tnum">{c.values.filter((v) => v.active).length}</Badge>
                </button>
              ))}
            </nav>
          </Section>

          <Section
            title={cat.name}
            description={cat.description}
            actions={
              <Gated menuKey="admin.lookups" action="C">
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  <Plus /> Add value
                </Button>
              </Gated>
            }
          >
            <DataTable
              key={catId}
              columns={columns}
              data={rows}
              searchKeys={["label", "code"]}
              searchPlaceholder={`Search ${cat.name.toLowerCase()}…`}
              getRowId={(r) => r.id}
              rowTone={(r) => (r.active ? undefined : "warning")}
              pageSize={20}
              exportName={`lookup-${cat.id}`}
              emptyIcon={ListTree}
              emptyTitle="No values"
              emptyDescription="Add the first value for this category."
            />
          </Section>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={guard.onOpenChange}>
        <DialogContent size="sm">
          <form onSubmit={onAdd} noValidate>
            <DialogHeader>
              <DialogTitle>Add value to {cat.name}</DialogTitle>
              <DialogDescription>Tenant values are visible only to Stellar Technologies.</DialogDescription>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-3">
              <Field label="Label" htmlFor="lk-label" required error={form.formState.errors.label?.message}>
                <Input id="lk-label" {...form.register("label")} aria-invalid={!!form.formState.errors.label} />
              </Field>
              <Field label="Code" htmlFor="lk-code" required error={form.formState.errors.code?.message} hint="Used in imports, APIs and reports. Cannot be changed later.">
                <Input id="lk-code" className="font-mono uppercase" {...form.register("code", { setValueAs: (v: string) => v.toUpperCase() })} aria-invalid={!!form.formState.errors.code} />
              </Field>
              {cat.tagOptions && (
                <Field label={cat.tagLabel ?? "Classification"} required error={form.formState.errors.tag?.message}>
                  <Select value={form.watch("tag")} onValueChange={(v) => form.setValue("tag", v, { shouldDirty: true, shouldValidate: true })}>
                    <SelectTrigger aria-label={cat.tagLabel}>
                      <SelectValue placeholder="Choose…" />
                    </SelectTrigger>
                    <SelectContent>
                      {cat.tagOptions.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => guard.onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Add value</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard.guard}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Delete “${deleting?.label ?? ""}”?`}
        description={
          deleting && deleting.usage > 0
            ? `${num(deleting.usage)} records use this value. They keep it, but it can no longer be chosen. Deactivating is usually the better option.`
            : "The value is soft-deleted and disappears from every dropdown."
        }
        confirmLabel="Delete value"
        destructive
        onConfirm={() => {
          if (!deleting) return;
          patchValues((vals) => vals.filter((x) => x.id !== deleting.id));
          mockAction(`“${deleting.label}” deleted`, { tone: "warning" });
        }}
      />
    </PageBody>
  );
}
