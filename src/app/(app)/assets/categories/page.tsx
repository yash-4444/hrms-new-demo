"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronRight, FolderTree, Layers, Pencil, Plus, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { num, pct } from "@/lib/format";
import { ASSET_CATEGORY_TREE, assetCountFor, type AssetCategoryNode } from "@/mock/service";
import { mockAction } from "@/components/app-state";
import { DataTable, NumCell } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { CategoryPolicyDialog } from "@/components/service/category-policy-dialog";

export default function AssetCategoriesPage() {
  const loading = useFakeLoad();
  const [nodes, setNodes] = React.useState<AssetCategoryNode[]>(ASSET_CATEGORY_TREE);
  const [selectedId, setSelectedId] = React.useState("cat-laptop");
  const [editing, setEditing] = React.useState<AssetCategoryNode | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const groups = React.useMemo(() => nodes.filter((n) => n.parentId === null), [nodes]);
  const leaves = React.useMemo(() => nodes.filter((n) => n.parentId !== null), [nodes]);
  const ordered = groups.flatMap((g) => [g, ...leaves.filter((l) => l.parentId === g.id)]);
  const selected = nodes.find((n) => n.id === selectedId) ?? leaves[0];
  const countOf = React.useCallback(
    (n: AssetCategoryNode) =>
      n.parentId === null ? leaves.filter((l) => l.parentId === n.id).reduce((s, l) => s + assetCountFor(l), 0) : assetCountFor(n),
    [leaves],
  );

  const columns = React.useMemo<ColumnDef<AssetCategoryNode, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Category",
        enableSorting: false,
        cell: ({ row }) => {
          const n = row.original;
          const isGroup = n.parentId === null;
          return (
            <span className={cn("flex items-center gap-1.5", !isGroup && "pl-5")}>
              {isGroup ? <FolderTree className="size-3.5 text-muted-foreground" aria-hidden /> : <ChevronRight className="size-3 text-muted-foreground" aria-hidden />}
              <span className={isGroup ? "font-semibold" : "font-medium"}>{n.name}</span>
            </span>
          );
        },
      },
      { id: "assets", header: "Assets", cell: ({ row }) => <NumCell>{num(countOf(row.original))}</NumCell> },
      {
        accessorKey: "method",
        header: "Method",
        cell: ({ row }) => (row.original.parentId === null ? <span className="text-muted-foreground">—</span> : <Badge variant="muted">{row.original.method}</Badge>),
      },
      {
        accessorKey: "rate",
        header: "Rate / yr",
        cell: ({ row }) => <NumCell>{row.original.parentId === null ? "—" : pct(row.original.rate, row.original.method === "SLM" ? 2 : 0)}</NumCell>,
      },
      {
        accessorKey: "usefulLifeYears",
        header: "Useful life",
        cell: ({ row }) => <NumCell>{row.original.parentId === null ? "—" : `${row.original.usefulLifeYears} yrs`}</NumCell>,
      },
      { id: "fields", header: "Custom fields", cell: ({ row }) => <NumCell>{row.original.customFields.length || "—"}</NumCell> },
      { accessorKey: "owner", header: "Owner" },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.parentId === null ? null : (
            <Gated menuKey="workplace.asset_categories" action="E">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Edit ${row.original.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(row.original);
                  setDialogOpen(true);
                }}
              >
                <Pencil />
              </Button>
            </Gated>
          ),
      },
    ],
    [countOf],
  );

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Asset categories" description="Loading categories…" />
        <TableSkeleton />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="Asset categories"
        description="How the register is classified, how each class depreciates, and which extra fields IT captures."
        actions={
          <Gated menuKey="workplace.asset_categories" action="C">
            <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus /> Add category
            </Button>
          </Gated>
        }
      />

      <StatRow cols={4}>
        <StatTile label="Groups" value={num(groups.length)} icon={FolderTree} />
        <StatTile label="Categories" value={num(leaves.length)} icon={Layers} />
        <StatTile label="Tagged assets" value={num(leaves.reduce((s, l) => s + assetCountFor(l), 0))} icon={Tag} href="/assets" />
        <StatTile label="Custom fields" value={num(leaves.reduce((s, l) => s + l.customFields.length, 0))} hint="Captured at intake" />
      </StatRow>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <DataTable
          columns={columns}
          data={ordered}
          getRowId={(n) => n.id}
          exportName="asset-categories"
          pageSize={20}
          onRowClick={(n) => n.parentId !== null && setSelectedId(n.id)}
          emptyIcon={FolderTree}
          emptyTitle="No categories yet"
          emptyDescription="Add a group and a category to start classifying the register."
        />

        {selected && (
          <Section title={selected.name} description={`${num(countOf(selected))} assets · owned by ${selected.owner}`}>
            <div className="flex flex-col gap-3 text-xs">
              <p className="text-muted-foreground">
                {selected.method === "SLM"
                  ? `Straight-line over ${selected.usefulLifeYears} years to a ${selected.salvagePct}% salvage value.`
                  : `Written-down value at ${selected.rate}% a year on opening book value, floor ${selected.salvagePct}%.`}
              </p>
              <div>
                <p className="mb-1.5 font-semibold">Custom fields</p>
                {selected.customFields.length === 0 ? (
                  <p className="text-muted-foreground">No extra fields — only make, model and serial are captured.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
                    {selected.customFields.map((f) => (
                      <li key={f.name} className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                        <span className="font-medium">{f.name}</span>
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          {f.type}
                          {f.required && <Badge variant="soft">Required</Badge>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {countOf(selected) === 0 && (
                <p className="rounded-md border border-dashed border-border px-2.5 py-2 text-muted-foreground">
                  No assets tagged in this category yet. Facilities tags new items here as they are received.
                </p>
              )}
            </div>
          </Section>
        )}
      </div>

      <CategoryPolicyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        node={editing}
        groups={groups}
        onSave={(v) => {
          if (editing) {
            setNodes((ns) => ns.map((n) => (n.id === editing.id ? { ...n, ...v } : n)));
            mockAction(`${v.name} policy saved`, { description: `${v.method} · ${v.rate}% · ${v.usefulLifeYears} years.` });
          } else {
            const id = `cat-new-${nodes.length}`;
            setNodes((ns) => [...ns, { id, ...v, registerCategory: null, owner: "IT Service Desk", customFields: [] }]);
            setSelectedId(id);
            mockAction(`${v.name} added`, { description: `Under ${groups.find((g) => g.id === v.parentId)?.name}.` });
          }
        }}
      />
    </PageBody>
  );
}
