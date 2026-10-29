"use client";

import * as React from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ColumnDef } from "@tanstack/react-table";
import { Ban, CheckCircle2, MoreHorizontal, Pencil, Plus, Power, type LucideIcon } from "lucide-react";
import { fmtDateTime } from "@/lib/format";
import type { MenuKey } from "@/lib/rbac";
import { DEMO_NOW } from "@/mock/org";
import type { MasterAudit } from "@/mock/masters";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable } from "@/components/data-table";
import { Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch, Textarea } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  FilterSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/overlays";

/* ============================================================================
   MasterTable — the one pattern every Organization master uses, so Branches,
   Grades, Shifts and the rest feel identical: header with a count, search,
   DataTable, a create/edit dialog (RHF + Zod, inline errors, dirty guard),
   activate/deactivate behind a confirm, and a "last changed by" audit column.
   Each page supplies only its domain columns, fields and row mapping.
   ========================================================================== */

export type MasterRow = MasterAudit & { id: string };
export type MasterValues = Record<string, string>;

export interface MasterField {
  name: string;
  label: string;
  kind?: "text" | "number" | "select" | "textarea" | "time" | "date" | "switch";
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  hint?: string;
  min?: number;
  max?: number;
  pattern?: { re: RegExp; message: string };
  /** Field spans both grid columns. */
  wide?: boolean;
  /** Read-only once the record exists (codes, ids). */
  lockOnEdit?: boolean;
}

export interface MasterTableProps<T extends MasterRow> {
  menuKey: MenuKey;
  title: string;
  description: React.ReactNode;
  /** Singular noun, lower case: "branch", "cost centre". */
  noun: string;
  plural: string;
  icon: LucideIcon;
  rows: T[];
  onRowsChange: React.Dispatch<React.SetStateAction<T[]>>;
  columns: ColumnDef<T, unknown>[];
  fields: MasterField[];
  toValues: (row: T | null) => MasterValues;
  fromValues: (values: MasterValues, existing: T | null, all: T[]) => Omit<T, keyof MasterAudit>;
  /** Unique business key, checked across rows on save. */
  uniqueField?: { name: string; get: (row: T) => string; message: string };
  searchKeys?: (keyof T & string)[];
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  /** Applied on top of the active/inactive filter. */
  filter?: (row: T) => boolean;
  /** Rendered between the header and the table (stat tiles, charts, trees). */
  children?: React.ReactNode;
  headerActions?: React.ReactNode;
  rowActions?: (row: T) => React.ReactNode;
  /** Shown in the deactivate confirmation, e.g. "36 employees are still mapped". */
  deactivateWarning?: (row: T) => string | undefined;
  onRowClick?: (row: T) => void;
  dialogSize?: "md" | "lg";
  /** Override the section title for the table card. */
  tableTitle?: string;
  /** Hide the table card when the page swaps in an alternate view (e.g. a calendar). */
  hideTable?: boolean;
}

export function MasterTable<T extends MasterRow>({
  menuKey,
  title,
  description,
  noun,
  plural,
  icon,
  rows,
  onRowsChange,
  columns,
  fields,
  toValues,
  fromValues,
  uniqueField,
  searchKeys,
  searchPlaceholder,
  filters,
  filter,
  children,
  headerActions,
  rowActions,
  deactivateWarning,
  onRowClick,
  dialogSize = "md",
  tableTitle,
  hideTable,
}: MasterTableProps<T>) {
  const loading = useFakeLoad();
  const { can, persona } = useApp();
  const canEdit = can(menuKey, "E");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [editing, setEditing] = React.useState<T | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [toggling, setToggling] = React.useState<T[] | null>(null);

  const stamp = React.useCallback(
    (): Pick<MasterAudit, "updatedBy" | "updatedAt"> => ({ updatedBy: persona.name, updatedAt: DEMO_NOW }),
    [persona.name],
  );

  const visible = React.useMemo(
    () =>
      rows.filter(
        (r) =>
          (statusFilter === "all" || (statusFilter === "active" ? r.active : !r.active)) &&
          (!filter || filter(r)),
      ),
    [rows, statusFilter, filter],
  );

  const activeCount = rows.filter((r) => r.active).length;

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = React.useCallback((row: T) => {
    setEditing(row);
    setFormOpen(true);
  }, []);

  const save = (values: MasterValues): { name: string; message: string } | null => {
    if (uniqueField) {
      const key = values[uniqueField.name]?.trim().toLowerCase();
      const clash = rows.find((r) => r.id !== editing?.id && uniqueField.get(r).trim().toLowerCase() === key);
      if (clash) return { name: uniqueField.name, message: uniqueField.message };
    }
    const base = fromValues(values, editing, rows);
    if (editing) {
      const prev = editing;
      const next = { ...prev, ...base, ...stamp() } as T;
      onRowsChange((rs) => rs.map((r) => (r.id === prev.id ? next : r)));
      mockAction(`${capitalise(noun)} updated`, {
        description: `Saved by ${persona.name}. The change is in the audit log.`,
        undo: () => onRowsChange((rs) => rs.map((r) => (r.id === prev.id ? prev : r))),
      });
    } else {
      const created = { ...base, active: true, ...stamp() } as T;
      onRowsChange((rs) => [created, ...rs]);
      mockAction(`${capitalise(noun)} created`, {
        description: `${created.id} is active and available in every picker.`,
        undo: () => onRowsChange((rs) => rs.filter((r) => r.id !== created.id)),
      });
    }
    setFormOpen(false);
    return null;
  };

  const applyToggle = (targets: T[]) => {
    const activate = !targets[0].active;
    const ids = new Set(targets.map((t) => t.id));
    const before = rows;
    onRowsChange((rs) => rs.map((r) => (ids.has(r.id) ? { ...r, active: activate, ...stamp() } : r)));
    mockAction(
      targets.length === 1
        ? `${targets[0].id} ${activate ? "activated" : "deactivated"}`
        : `${targets.length} ${plural} ${activate ? "activated" : "deactivated"}`,
      {
        description: activate
          ? "Available again in pickers across the product."
          : "Hidden from pickers. History and existing employee mappings are kept.",
        tone: activate ? "success" : "warning",
        undo: () => onRowsChange(before),
      },
    );
  };

  const allColumns = React.useMemo<ColumnDef<T, unknown>[]>(
    () => [
      ...columns,
      {
        id: "status",
        header: "Status",
        accessorFn: (r) => (r.active ? "Active" : "Inactive"),
        cell: ({ row }) =>
          row.original.active ? (
            <StatusBadge status="active" />
          ) : (
            <StatusBadge status="closed" label="Inactive" />
          ),
      },
      {
        id: "updated",
        header: "Last changed",
        accessorFn: (r) => r.updatedAt,
        cell: ({ row }) => (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-xs text-foreground">{row.original.updatedBy}</p>
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
                <DropdownMenuItem disabled={!canEdit} onSelect={() => openEdit(row.original)}>
                  <Pencil aria-hidden />
                  Edit{!canEdit && " (no edit grant)"}
                </DropdownMenuItem>
                {rowActions?.(row.original)}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={!canEdit}
                  destructive={row.original.active}
                  onSelect={() => setToggling([row.original])}
                >
                  {row.original.active ? <Ban aria-hidden /> : <CheckCircle2 aria-hidden />}
                  {row.original.active ? "Deactivate" : "Activate"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [columns, canEdit, openEdit, rowActions],
  );

  const toggleTarget = toggling?.[0];
  const toggleWarn = toggling && toggling.length === 1 && toggleTarget?.active ? deactivateWarning?.(toggleTarget) : undefined;

  return (
    <PageBody>
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            {headerActions}
            <Gated menuKey={menuKey} action="C">
              <Button size="sm" onClick={openCreate}>
                <Plus aria-hidden />
                New {noun}
              </Button>
            </Gated>
          </>
        }
      />

      {children}

      {!hideTable && (
        <Section
          title={tableTitle ?? `${capitalise(plural)}`}
          description={`${rows.length} total · ${activeCount} active · ${rows.length - activeCount} inactive`}
          bodyClassName="p-3"
        >
          {loading ? (
            <TableSkeleton rows={6} />
          ) : (
            <DataTable<T>
              columns={allColumns}
              data={visible}
              searchKeys={searchKeys}
              searchPlaceholder={searchPlaceholder ?? `Search ${plural}…`}
              getRowId={(r) => r.id}
              onRowClick={onRowClick ?? (canEdit ? openEdit : undefined)}
              exportName={plural.replace(/\s+/g, "-")}
              enableSelection={canEdit}
              filters={
                <>
                  <FilterSelect
                    label="Status"
                    value={statusFilter}
                    onValueChange={setStatusFilter}
                    options={[
                      { value: "active", label: "Active" },
                      { value: "inactive", label: "Inactive" },
                    ]}
                    width="w-[140px]"
                  />
                  {filters}
                </>
              }
              bulkActions={(selected, clear) => (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setToggling(selected.filter((s) => s.active));
                      clear();
                    }}
                    disabled={!selected.some((s) => s.active)}
                  >
                    <Power aria-hidden />
                    Deactivate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      applyToggle(selected.filter((s) => !s.active));
                      clear();
                    }}
                    disabled={!selected.some((s) => !s.active)}
                  >
                    <CheckCircle2 aria-hidden />
                    Activate
                  </Button>
                </>
              )}
              emptyIcon={icon}
              emptyTitle={rows.length ? `No ${plural} match` : `No ${plural} yet`}
              emptyDescription={
                rows.length
                  ? "Clear the search or switch the status filter to see more."
                  : `Add the first ${noun} — it becomes available in every picker immediately.`
              }
              emptyAction={
                !rows.length && can(menuKey, "C") ? (
                  <Button size="sm" onClick={openCreate}>
                    <Plus aria-hidden />
                    New {noun}
                  </Button>
                ) : undefined
              }
            />
          )}
        </Section>
      )}

      <MasterFormDialog
        key={`${formOpen}-${editing?.id ?? "new"}`}
        open={formOpen}
        onOpenChange={setFormOpen}
        noun={noun}
        editing={editing}
        fields={fields}
        defaults={toValues(editing)}
        onSave={save}
        size={dialogSize}
      />

      <ConfirmDialog
        open={!!toggling?.length}
        onOpenChange={(v) => !v && setToggling(null)}
        title={
          toggling && toggling.length > 1
            ? `Deactivate ${toggling.length} ${plural}?`
            : toggleTarget?.active
              ? `Deactivate ${toggleTarget.id}?`
              : `Activate ${toggleTarget?.id ?? ""}?`
        }
        description={
          toggleTarget?.active ? (
            <>
              {toggleWarn && <span className="mb-1.5 block font-medium text-warning-fg">{toggleWarn}</span>}
              Deactivated {plural} disappear from pickers for new records. Existing employees and history keep
              their mapping, and you can reactivate at any time.
            </>
          ) : (
            "It becomes selectable again across the product."
          )
        }
        confirmLabel={toggleTarget?.active ? "Deactivate" : "Activate"}
        destructive={toggleTarget?.active}
        onConfirm={() => toggling && toggling.length && applyToggle(toggling)}
      />
    </PageBody>
  );
}

/* ----------------------------------------------------------- form dialog */

function buildSchema(fields: MasterField[]) {
  const shape: Record<string, z.ZodType<string>> = {};
  for (const f of fields) {
    let s: z.ZodType<string> = z.string().trim();
    if (f.required && f.kind !== "switch") s = z.string().trim().min(1, `${f.label} is required.`);
    if (f.kind === "number") {
      s = s
        .refine((v) => v === "" || !Number.isNaN(Number(v)), `${f.label} must be a number.`)
        .refine((v) => v === "" || f.min === undefined || Number(v) >= f.min, `${f.label} must be at least ${f.min}.`)
        .refine((v) => v === "" || f.max === undefined || Number(v) <= f.max, `${f.label} must be at most ${f.max}.`);
    }
    if (f.pattern) {
      const p = f.pattern;
      s = s.refine((v) => v === "" || p.re.test(v), p.message);
    }
    shape[f.name] = s;
  }
  return z.object(shape);
}

function MasterFormDialog({
  open,
  onOpenChange,
  noun,
  editing,
  fields,
  defaults,
  onSave,
  size,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  noun: string;
  editing: MasterRow | null;
  fields: MasterField[];
  defaults: MasterValues;
  onSave: (values: MasterValues) => { name: string; message: string } | null;
  size: "md" | "lg";
}) {
  const schema = React.useMemo(() => buildSchema(fields), [fields]);
  const form = useForm<MasterValues>({
    resolver: zodResolver(schema) as unknown as Resolver<MasterValues>,
    defaultValues: defaults,
  });
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const firstKey = fields.find((f) => !(editing && f.lockOnEdit))?.name;

  const requestClose = (v: boolean) => {
    if (v) return onOpenChange(true);
    if (form.formState.isDirty) setDiscardOpen(true);
    else onOpenChange(false);
  };

  const submit = form.handleSubmit((values) => {
    const err = onSave(values);
    if (err) form.setError(err.name, { message: err.message }, { shouldFocus: true });
  });

  return (
    <>
      <Dialog open={open} onOpenChange={requestClose}>
        <DialogContent size={size === "lg" ? "lg" : "md"}>
          <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
            <DialogHeader>
              <DialogTitle>{editing ? `Edit ${noun} · ${editing.id}` : `New ${noun}`}</DialogTitle>
              <DialogDescription>
                {editing
                  ? "Changes apply from now on; history keeps the values that were stamped at the time."
                  : "Fields marked * are required. The record is active as soon as you save it."}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {fields.map((f) => {
                const id = `mf-${f.name}`;
                const err = form.formState.errors[f.name]?.message;
                const locked = !!editing && f.lockOnEdit;
                return (
                  <Field
                    key={f.name}
                    label={f.label}
                    htmlFor={id}
                    required={f.required}
                    error={typeof err === "string" ? err : undefined}
                    hint={locked ? "Locked after creation — referenced by other records." : f.hint}
                    className={f.wide || f.kind === "textarea" ? "sm:col-span-2" : undefined}
                  >
                    {f.kind === "select" ? (
                      <Controller
                        control={form.control}
                        name={f.name}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange} disabled={locked}>
                            <SelectTrigger id={id} aria-invalid={!!err}>
                              <SelectValue placeholder={f.placeholder ?? `Select ${f.label.toLowerCase()}`} />
                            </SelectTrigger>
                            <SelectContent>
                              {f.options?.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    ) : f.kind === "switch" ? (
                      <Controller
                        control={form.control}
                        name={f.name}
                        render={({ field }) => (
                          <div className="flex h-8 items-center gap-2">
                            <Switch
                              id={id}
                              checked={field.value === "true"}
                              onCheckedChange={(v) => field.onChange(v ? "true" : "false")}
                            />
                            <span className="text-xs text-muted-foreground">{field.value === "true" ? "Yes" : "No"}</span>
                          </div>
                        )}
                      />
                    ) : f.kind === "textarea" ? (
                      <Textarea id={id} rows={3} placeholder={f.placeholder} aria-invalid={!!err} {...form.register(f.name)} />
                    ) : (
                      <Input
                        id={id}
                        type={f.kind === "number" ? "number" : f.kind === "time" ? "time" : f.kind === "date" ? "date" : "text"}
                        inputMode={f.kind === "number" ? "decimal" : undefined}
                        placeholder={f.placeholder}
                        readOnly={locked}
                        aria-invalid={!!err}
                        autoFocus={f.name === firstKey}
                        {...form.register(f.name)}
                      />
                    )}
                  </Field>
                );
              })}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => requestClose(false)}>
                Cancel
              </Button>
              <Button type="submit">{editing ? "Save changes" : `Create ${noun}`}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard unsaved changes?"
        description={`You have edited this ${noun}. Closing now loses those edits.`}
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => onOpenChange(false)}
      />
    </>
  );
}

export function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Option helpers so every master's selects read the same way. */
export const toOptions = <T,>(items: readonly T[], value: (t: T) => string, label: (t: T) => string) =>
  items.map((i) => ({ value: value(i), label: label(i) }));
