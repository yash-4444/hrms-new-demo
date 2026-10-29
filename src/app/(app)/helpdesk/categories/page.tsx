"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronRight, FolderTree, Pencil, Plus, Timer, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { num } from "@/lib/format";
import { TICKET_CATEGORIES, type TicketCategory, type TicketPriority } from "@/mock/workplace";
import { HD_CATEGORY_TREE, SLA_POLICIES, openTicketsIn, type HdCategoryNode } from "@/mock/service";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { PriorityChip } from "@/components/service/kit";
import { HD_TEAMS, HdCategoryDialog } from "@/components/service/hd-category-dialog";

const policyName = (id: string) => SLA_POLICIES.find((p) => p.id === id)?.name ?? id;

export default function TicketCategoriesPage() {
  const loading = useFakeLoad();
  const { can } = useApp();
  const canSla = can("helpdesk.sla");
  const [nodes, setNodes] = React.useState<HdCategoryNode[]>(HD_CATEGORY_TREE);
  const [selectedId, setSelectedId] = React.useState("hc-it-net");
  const [editing, setEditing] = React.useState<HdCategoryNode | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const ordered = TICKET_CATEGORIES.flatMap((c) => nodes.filter((n) => n.name === c && n.parent === null).concat(nodes.filter((n) => n.parent === c)));
  const selected = nodes.find((n) => n.id === selectedId);
  const policy = SLA_POLICIES.find((p) => p.id === selected?.slaPolicyId);

  const columns = React.useMemo<ColumnDef<HdCategoryNode, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Category",
        enableSorting: false,
        cell: ({ row }) => {
          const top = row.original.parent === null;
          return (
            <span className={cn("flex items-center gap-1.5", !top && "pl-5")}>
              {top ? <FolderTree className="size-3.5 text-muted-foreground" aria-hidden /> : <ChevronRight className="size-3 text-muted-foreground" aria-hidden />}
              <span className={top ? "font-semibold" : "font-medium"}>{row.original.name}</span>
            </span>
          );
        },
      },
      {
        id: "open",
        header: "Open tickets",
        cell: ({ row }) => (row.original.parent === null ? <NumCell>{openTicketsIn(row.original.name as TicketCategory)}</NumCell> : <MutedCell>—</MutedCell>),
      },
      { accessorKey: "team", header: "Owning team" },
      { accessorKey: "defaultPriority", header: "Default priority", cell: ({ row }) => <PriorityChip priority={row.original.defaultPriority} /> },
      { accessorKey: "slaPolicyId", header: "SLA policy", cell: ({ row }) => (canSla ? <Link href="/helpdesk/sla" className="text-xs hover:underline" onClick={(e) => e.stopPropagation()}>{policyName(row.original.slaPolicyId)}</Link> : <span className="text-xs">{policyName(row.original.slaPolicyId)}</span>) },
      { accessorKey: "autoAssign", header: "Routing", cell: ({ row }) => <MutedCell>{row.original.autoAssign}</MutedCell> },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <Gated menuKey="helpdesk.categories" action="E">
            <Button size="icon-sm" variant="ghost" aria-label={`Edit ${row.original.name}`} onClick={(e) => { e.stopPropagation(); setEditing(row.original); setDialogOpen(true); }}>
              <Pencil />
            </Button>
          </Gated>
        ),
      },
    ],
    [canSla],
  );

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Ticket categories" description="Loading categories…" />
        <TableSkeleton />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="Ticket categories"
        description="What employees can ask for, which team owns it, how urgent it is by default, and which SLA clock it runs on."
        actions={
          <Gated menuKey="helpdesk.categories" action="C">
            <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus /> Add category
            </Button>
          </Gated>
        }
      />

      <StatRow cols={4}>
        <StatTile label="Top-level categories" value={num(TICKET_CATEGORIES.length)} icon={FolderTree} />
        <StatTile label="Sub-categories" value={num(nodes.filter((n) => n.parent !== null).length)} />
        <StatTile label="Owning teams" value={num(HD_TEAMS.length)} icon={Users} />
        <StatTile label="SLA policies in use" value={num(new Set(nodes.map((n) => n.slaPolicyId)).size)} icon={Timer} href={canSla ? "/helpdesk/sla" : undefined} />
      </StatRow>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <DataTable
          columns={columns}
          data={ordered}
          getRowId={(n) => n.id}
          exportName="ticket-categories"
          pageSize={25}
          onRowClick={(n) => setSelectedId(n.id)}
          emptyIcon={FolderTree}
          emptyTitle="No categories"
          emptyDescription="Add a category so employees can route their requests."
        />
        {selected && policy && (
          <Section title={selected.name} description={`${selected.team} · ${selected.autoAssign}`}>
            <div className="flex flex-col gap-2 text-xs">
              <p className="font-semibold">{policy.name}</p>
              <p className="text-muted-foreground">{policy.appliesTo}</p>
              <table className="w-full text-left">
                <thead className="text-muted-foreground">
                  <tr><th className="py-1 font-medium">Priority</th><th className="py-1 text-right font-medium">First response</th><th className="py-1 text-right font-medium">Resolve</th></tr>
                </thead>
                <tbody>
                  {policy.targets.map((t) => (
                    <tr key={t.priority} className={cn("border-t border-border", t.priority === selected.defaultPriority && "bg-primary-soft/50")}>
                      <td className="py-1"><PriorityChip priority={t.priority as TicketPriority} /></td>
                      <td className="tnum py-1 text-right">{t.firstResponseHrs}h</td>
                      <td className="tnum py-1 text-right">{t.resolutionHrs}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[11px] text-muted-foreground">Highlighted row is this category&apos;s default priority.</p>
            </div>
          </Section>
        )}
      </div>

      <HdCategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        node={editing}
        onSave={(v) => {
          /* Top-level categories are fixed by the ticket form; only their routing is editable. */
          const values = editing?.parent === null ? { ...v, name: editing.name, parent: null } : { ...v, parent: v.parent as TicketCategory };
          if (editing) {
            setNodes((ns) => ns.map((n) => (n.id === editing.id ? { ...n, ...values } : n)));
            mockAction(`${v.name} updated`, { description: `${v.team} · ${v.defaultPriority} · ${policyName(v.slaPolicyId)}` });
          } else {
            const id = `hc-new-${nodes.length}`;
            setNodes((ns) => [...ns, { id, ...values }]);
            setSelectedId(id);
            mockAction(`${v.name} added under ${v.parent}`);
          }
        }}
      />
    </PageBody>
  );
}
