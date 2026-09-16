"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Columns3,
  Download,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { mockAction } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Checkbox, EmptyState, Skeleton } from "@/components/ui/primitives";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/overlays";

/* ============================================================================
   One data table for the whole product: sortable columns, a filter row,
   column visibility, pagination, row selection with a sticky bulk-action bar,
   an Export button, keyboard navigation and a designed empty state.
   ========================================================================== */

export interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  /** Free-text search across these accessor keys. */
  searchKeys?: (keyof T & string)[];
  searchPlaceholder?: string;
  /** Rendered in the filter row, left of the search box. */
  filters?: React.ReactNode;
  /** Rendered at the right end of the toolbar. */
  toolbar?: React.ReactNode;
  enableSelection?: boolean;
  bulkActions?: (selected: T[], clear: () => void) => React.ReactNode;
  onRowClick?: (row: T) => void;
  getRowId?: (row: T) => string;
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ElementType;
  emptyAction?: React.ReactNode;
  exportName?: string;
  loading?: boolean;
  dense?: boolean;
  className?: string;
  /** Row-level tone, e.g. an exception row tinted red. */
  rowTone?: (row: T) => "danger" | "warning" | "success" | undefined;
}

export function DataTable<T extends object>({
  columns,
  data,
  searchKeys,
  searchPlaceholder = "Search…",
  filters,
  toolbar,
  enableSelection,
  bulkActions,
  onRowClick,
  getRowId,
  pageSize = 15,
  emptyTitle = "Nothing to show yet",
  emptyDescription = "Adjust your filters, or add the first record to get started.",
  emptyIcon,
  emptyAction,
  exportName = "export",
  loading,
  dense,
  className,
  rowTone,
}: DataTableProps<T>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    if (!query.trim() || !searchKeys?.length) return data;
    const q = query.toLowerCase();
    return data.filter((row) =>
      searchKeys.some((k) => String(row[k] ?? "").toLowerCase().includes(q)),
    );
  }, [data, query, searchKeys]);

  const allColumns = React.useMemo<ColumnDef<T, unknown>[]>(() => {
    if (!enableSelection) return columns;
    return [
      {
        id: "__select",
        size: 32,
        enableSorting: false,
        enableHiding: false,
        header: ({ table }) => (
          <Checkbox
            aria-label="Select all rows on this page"
            checked={
              table.getIsAllPageRowsSelected()
                ? true
                : table.getIsSomePageRowsSelected()
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label="Select row"
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            onClick={(e) => e.stopPropagation()}
          />
        ),
      },
      ...columns,
    ];
  }, [columns, enableSelection]);

  const table = useReactTable({
    data: filtered,
    columns: allColumns,
    state: { sorting, columnFilters, columnVisibility, rowSelection },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: getRowId ? (r) => getRowId(r) : undefined,
    initialState: { pagination: { pageSize } },
    enableRowSelection: !!enableSelection,
  });

  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
  const clearSelection = () => setRowSelection({});

  const exportCsv = () => {
    const visible = table.getVisibleLeafColumns().filter((c) => c.id !== "__select");
    const head = visible.map((c) => String(c.columnDef.header ?? c.id));
    const rows = table.getFilteredRowModel().rows.map((r) =>
      visible.map((c) => {
        const v = r.getValue(c.id);
        return typeof v === "object" ? "" : String(v ?? "");
      }),
    );
    mockAction(`Exported ${rows.length} rows`, {
      description: `${exportName}.csv — ${head.length} columns. In the demo the file is not written to disk.`,
    });
  };

  const bodyRef = React.useRef<HTMLTableSectionElement>(null);
  const onKeyDown = (e: React.KeyboardEvent<HTMLTableSectionElement>) => {
    if (!["ArrowDown", "ArrowUp"].includes(e.key)) return;
    e.preventDefault();
    const rows = Array.from(bodyRef.current?.querySelectorAll<HTMLTableRowElement>("tr[tabindex]") ?? []);
    const idx = rows.findIndex((r) => r === document.activeElement);
    const next = e.key === "ArrowDown" ? Math.min(rows.length - 1, idx + 1) : Math.max(0, idx - 1);
    rows[next]?.focus();
  };

  const showToolbar = Boolean(searchKeys?.length || filters || toolbar);
  const hasRows = table.getRowModel().rows.length > 0;

  return (
    <div className={cn("relative flex flex-col gap-2", className)}>
      {showToolbar && (
        <div className="flex flex-wrap items-center gap-1.5">
          {searchKeys?.length ? (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="h-7 w-[200px] rounded-md border border-input bg-card pl-7 pr-6 text-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          ) : null}
          {filters}
          <div className="ml-auto flex items-center gap-1.5">
            {toolbar}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" aria-label="Column visibility">
                  <Columns3 /> Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {table
                  .getAllLeafColumns()
                  .filter((c) => c.getCanHide() && c.id !== "__select")
                  .map((c) => (
                    <DropdownMenuCheckboxItem
                      key={c.id}
                      checked={c.getIsVisible()}
                      onCheckedChange={(v) => c.toggleVisibility(!!v)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {String(c.columnDef.header ?? c.id)}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download /> Export
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-border bg-card">
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full caption-bottom text-xs">
            <thead className="bg-subtle">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-border">
                  {hg.headers.map((h) => {
                    const canSort = h.column.getCanSort();
                    const dir = h.column.getIsSorted();
                    return (
                      <th
                        key={h.id}
                        scope="col"
                        style={{ width: h.getSize() !== 150 ? h.getSize() : undefined }}
                        className="h-8 whitespace-nowrap px-2.5 text-left align-middle font-medium text-muted-foreground"
                      >
                        {h.isPlaceholder ? null : canSort ? (
                          <button
                            type="button"
                            onClick={h.column.getToggleSortingHandler()}
                            className="inline-flex items-center gap-1 rounded hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={`Sort by ${String(h.column.columnDef.header)}`}
                          >
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            {dir === "asc" ? (
                              <ArrowUp className="size-3" />
                            ) : dir === "desc" ? (
                              <ArrowDown className="size-3" />
                            ) : (
                              <ChevronsUpDown className="size-3 opacity-40" />
                            )}
                          </button>
                        ) : (
                          flexRender(h.column.columnDef.header, h.getContext())
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody ref={bodyRef} onKeyDown={onKeyDown}>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    {table.getVisibleLeafColumns().map((c) => (
                      <td key={c.id} className="px-2.5 py-2">
                        <Skeleton className="h-3.5 w-full max-w-[140px]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : hasRows ? (
                table.getRowModel().rows.map((row) => {
                  const tone = rowTone?.(row.original);
                  return (
                    <tr
                      key={row.id}
                      tabIndex={0}
                      data-state={row.getIsSelected() ? "selected" : undefined}
                      onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                      onKeyDown={
                        onRowClick
                          ? (e) => {
                              if (e.key === "Enter") onRowClick(row.original);
                            }
                          : undefined
                      }
                      className={cn(
                        "border-b border-border outline-none transition-colors last:border-0",
                        "hover:bg-muted/60 focus-visible:bg-muted data-[state=selected]:bg-primary-soft/40",
                        onRowClick && "cursor-pointer",
                        tone === "danger" && "bg-destructive-soft/40",
                        tone === "warning" && "bg-warning-soft/40",
                        tone === "success" && "bg-success-soft/40",
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={cn("px-2.5 align-middle", dense ? "py-1" : "py-1.5")}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={table.getVisibleLeafColumns().length} className="p-0">
                    <EmptyState
                      icon={emptyIcon}
                      title={emptyTitle}
                      description={emptyDescription}
                      action={emptyAction}
                      className="border-0"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {hasRows && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-2.5 py-1.5">
            <p className="tnum text-xs text-muted-foreground">
              {enableSelection && selectedRows.length > 0
                ? `${selectedRows.length} of ${table.getFilteredRowModel().rows.length} selected`
                : `${table.getFilteredRowModel().rows.length} record${table.getFilteredRowModel().rows.length === 1 ? "" : "s"}`}
            </p>
            <div className="flex items-center gap-2">
              <Select
                value={String(table.getState().pagination.pageSize)}
                onValueChange={(v) => table.setPageSize(Number(v))}
              >
                <SelectTrigger size="sm" className="h-7 w-[92px]" aria-label="Rows per page">
                  <span className="text-xs">{table.getState().pagination.pageSize} / page</span>
                </SelectTrigger>
                <SelectContent>
                  {[10, 15, 25, 50, 100].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} / page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="tnum text-xs text-muted-foreground">
                Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Previous page"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Next page"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        )}
      </div>

      {enableSelection && selectedRows.length > 0 && bulkActions && (
        <div className="sticky bottom-3 z-20 mx-auto flex w-fit items-center gap-2 rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
          <span className="tnum text-xs font-medium">{selectedRows.length} selected</span>
          <span className="h-4 w-px bg-border" aria-hidden />
          {bulkActions(selectedRows, clearSelection)}
          <Button variant="ghost" size="icon-sm" aria-label="Clear selection" onClick={clearSelection}>
            <X />
          </Button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- cell bits */

export function NumCell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("tnum block text-right font-medium", className)}>{children}</span>;
}

export function MutedCell({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}
