"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Ban, Laptop, PackageCheck, PackagePlus, PackageX, Plus, ShieldCheck, Undo2, Wrench } from "lucide-react";
import { fmtDate, inr, inrCompact, num } from "@/lib/format";
import { BRANCHES } from "@/mock/org";
import { ASSETS, ASSET_ALLOCATION_BY_CATEGORY, ASSET_CATEGORIES, ASSETS_BY_CATEGORY, type Asset } from "@/mock/workplace";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, NumCell } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { ConfirmDialog, FilterSelect } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { BarCompareChart, DonutChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { AssetAllocationDialog, NO_PRESELECTION, type AssetAllocation } from "@/components/workplace/asset-allocation-dialog";
import { MyAssetCards } from "@/components/workplace/my-asset-cards";

/* ============================================================================
   /assets — persona-aware. Everyone lands on the equipment they hold
   (my.assets); a persona holding workplace.assets gets the full register,
   with every admin control gated on that key and a row opening /assets/<id>.
   ========================================================================== */

type Batch = { rows: Asset[]; clear: () => void };

export default function AssetsPage() {
  const loading = useFakeLoad();
  const router = useRouter();
  const { persona, can } = useApp();
  const isAdmin = can("workplace.assets", "V");

  const [assets, setAssets] = React.useState<Asset[]>(ASSETS);
  const [tab, setTab] = React.useState("register");
  const [category, setCategory] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [branch, setBranch] = React.useState("all");
  const [allocating, setAllocating] = React.useState<{ open: boolean; preselected: Asset[]; clear?: () => void }>({
    open: false,
    preselected: NO_PRESELECTION,
  });
  const [returning, setReturning] = React.useState<Asset | null>(null);
  const [retiring, setRetiring] = React.useState<(Batch & { lost: boolean }) | null>(null);

  const filtered = React.useMemo(
    () =>
      assets.filter(
        (a) =>
          (category === "all" || a.category === category) &&
          (status === "all" || a.status === status) &&
          (branch === "all" || a.branchId === branch),
      ),
    [assets, category, status, branch],
  );
  const mine = React.useMemo(() => assets.filter((a) => a.allocatedTo === persona.employeeId), [assets, persona.employeeId]);
  const stock = React.useMemo(() => assets.filter((a) => a.status === "in_stock"), [assets]);

  const stats = React.useMemo(
    () => ({
      total: assets.length,
      allocated: assets.filter((a) => a.status === "allocated").length,
      inStock: stock.length,
      repair: assets.filter((a) => a.status === "under_repair").length,
      value: assets.filter((a) => a.status !== "retired" && a.status !== "lost").reduce((s, a) => s + a.purchaseCost, 0),
      outOfWarranty: assets.filter((a) => !a.inWarranty && a.status === "allocated").length,
    }),
    [assets, stock.length],
  );

  /* ----------------------------------------------------------- mutations */

  const update = (ids: string[], patch: (a: Asset) => Partial<Asset>) => {
    const set = new Set(ids);
    setAssets((as) => as.map((a) => (set.has(a.id) ? { ...a, ...patch(a) } : a)));
  };

  const allocate = (al: AssetAllocation) => {
    const before = assets;
    update(al.assetIds, () => ({
      status: "allocated",
      allocatedTo: al.employeeCode,
      allocatedToName: al.employeeName,
      allocatedOn: al.allocationDate,
      condition: al.condition,
      location: al.employeeLocation,
    }));
    allocating.clear?.();
    mockAction(al.assetIds.length === 1 ? `${al.assetIds[0]} allocated` : `${al.assetIds.length} assets allocated`, {
      description: `Handed to ${al.employeeName} on ${fmtDate(al.allocationDate)}. It shows in their My assets straight away.`,
      undo: () => setAssets(before),
    });
  };

  const returnAsset = (a: Asset) => {
    const before = assets;
    update([a.id], () => ({ status: "in_stock", allocatedTo: null, allocatedToName: "—", allocatedOn: null }));
    mockAction(`${a.tag} returned to stock`, {
      description: `Recovered from ${a.allocatedToName}. Condition logged as ${a.condition}.`,
      undo: () => setAssets(before),
    });
  };

  const sendForRepair = ({ rows, clear }: Batch) => {
    const before = assets;
    update(
      rows.map((r) => r.id),
      () => ({ status: "under_repair", condition: "Needs repair" }),
    );
    clear();
    mockAction(`${rows.length} asset${rows.length === 1 ? "" : "s"} sent for repair`, {
      description: "A service ticket has been raised with each vendor.",
      undo: () => setAssets(before),
    });
  };

  const retire = (batch: Batch & { lost: boolean }, reason: string) => {
    const before = assets;
    update(
      batch.rows.map((r) => r.id),
      () => ({ status: batch.lost ? "lost" : "retired", allocatedTo: null, allocatedToName: "—", allocatedOn: null }),
    );
    batch.clear();
    mockAction(
      `${batch.rows.length} asset${batch.rows.length === 1 ? "" : "s"} ${batch.lost ? "written off as lost" : "retired"}`,
      {
        description: `${inr(batch.rows.reduce((s, a) => s + a.purchaseCost, 0), { decimals: false })} removed from the register value. Reason: “${reason}”`,
        tone: "warning",
        undo: () => setAssets(before),
      },
    );
  };

  /* -------------------------------------------------------------- columns */

  const columns = React.useMemo<ColumnDef<Asset, unknown>[]>(
    () => [
      {
        accessorKey: "tag",
        header: "Asset tag",
        cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.tag}</span>,
      },
      {
        accessorKey: "make",
        header: "Item",
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span className="font-medium">
              {row.original.make} {row.original.model}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">SN {row.original.serial}</span>
          </span>
        ),
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => <Badge variant="muted">{row.original.category}</Badge>,
      },
      {
        accessorKey: "allocatedToName",
        header: "Allocated to",
        cell: ({ row }) =>
          row.original.allocatedTo ? (
            <Link
              href={`/employees/${row.original.allocatedTo}`}
              className="flex items-center gap-1.5 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <Avatar name={row.original.allocatedToName} size={20} />
              <span className="truncate">{row.original.allocatedToName}</span>
            </Link>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      { accessorKey: "location", header: "Location" },
      {
        accessorKey: "purchaseCost",
        header: "Cost",
        cell: ({ row }) => <NumCell>{inr(row.original.purchaseCost, { decimals: false })}</NumCell>,
      },
      {
        accessorKey: "warrantyExpiry",
        header: "Warranty",
        cell: ({ row }) => (
          <span className="tnum flex flex-col">
            <span className={row.original.inWarranty ? "" : "text-muted-foreground"}>
              {fmtDate(row.original.warrantyExpiry)}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {row.original.inWarranty ? "In warranty" : "Expired"}
            </span>
          </span>
        ),
      },
      {
        accessorKey: "condition",
        header: "Condition",
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.condition}</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <Gated menuKey="workplace.assets" action="E">
              {row.original.status === "allocated" ? (
                <Button variant="outline" size="sm" onClick={() => setReturning(row.original)}>
                  <Undo2 /> Return
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={row.original.status !== "in_stock"}
                  onClick={() => setAllocating({ open: true, preselected: [row.original] })}
                >
                  Allocate
                </Button>
              )}
            </Gated>
          </div>
        ),
      },
    ],
    [],
  );

  /* ---------------------------------------------------------------- render */

  const requestLink = can("workplace.asset_requests", "V") && (
    <Button size="sm" variant={isAdmin ? "outline" : "default"} asChild>
      <Link href="/assets/requests">
        <PackagePlus /> Request an asset
      </Link>
    </Button>
  );

  const header = (
    <PageHeader
      title={isAdmin ? "Assets" : "My assets"}
      description={
        isAdmin
          ? "Every laptop, monitor, phone and access card Stellar owns, and who is holding it."
          : "The equipment issued to you. Report a fault here, or request something new and IT ships it from stock."
      }
      actions={
        isAdmin ? (
          <>
            {requestLink}
            <Gated menuKey="workplace.assets" action="E">
              <Button size="sm" variant="outline" onClick={() => setAllocating({ open: true, preselected: NO_PRESELECTION })}>
                <PackageCheck /> Allocate from stock
              </Button>
            </Gated>
            <Gated menuKey="workplace.assets" action="C">
              <Button
                size="sm"
                onClick={() =>
                  mockAction("Asset added to the register", {
                    description: "A new tag is issued automatically in the STL-AST-#### series.",
                  })
                }
              >
                <Plus /> Add asset
              </Button>
            </Gated>
          </>
        ) : (
          requestLink
        )
      }
    />
  );

  if (loading) {
    return (
      <PageBody>
        {header}
        {isAdmin && <CardsSkeleton count={5} />}
        <TableSkeleton />
      </PageBody>
    );
  }

  if (!isAdmin) {
    return (
      <PageBody>
        {header}
        <MyAssetCards assets={mine} holderName={persona.name} />
      </PageBody>
    );
  }

  return (
    <PageBody>
      {header}

      <StatRow cols={5}>
        <StatTile label="Total assets" value={num(stats.total)} icon={Laptop} hint={`${ASSET_CATEGORIES.length} categories`} />
        <StatTile label="Allocated" value={num(stats.allocated)} icon={PackageCheck} tone="good" onClick={() => setStatus("allocated")} />
        <StatTile label="In stock" value={num(stats.inStock)} icon={PackageX} onClick={() => setStatus("in_stock")} />
        <StatTile
          label="Under repair"
          value={num(stats.repair)}
          icon={Wrench}
          tone={stats.repair > 0 ? "warning" : "neutral"}
          onClick={() => setStatus("under_repair")}
        />
        <StatTile
          label="Register value"
          value={inrCompact(stats.value)}
          icon={ShieldCheck}
          hint={`${num(stats.outOfWarranty)} allocated out of warranty`}
        />
      </StatRow>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="register">
            <Laptop /> Register
          </TabsTrigger>
          <TabsTrigger value="mine">
            <PackageCheck /> My assets ({mine.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="register" className="flex flex-col gap-3">
          <DataTable<Asset>
            columns={columns}
            data={filtered}
            searchKeys={["search", "serial"]}
            searchPlaceholder="Search tag, make, serial, holder…"
            exportName="asset-register"
            canExport={can("workplace.assets", "X")}
            getRowId={(a) => a.id}
            onRowClick={(a) => router.push(`/assets/${a.id}`)}
            enableSelection={can("workplace.assets", "E") || can("workplace.assets", "D")}
            pageSize={15}
            emptyIcon={Laptop}
            emptyTitle="No assets match"
            emptyDescription="Clear a filter to widen the search."
            rowTone={(a) => (a.status === "lost" ? "danger" : a.status === "under_repair" ? "warning" : undefined)}
            filters={
              <>
                <FilterSelect
                  label="Category"
                  value={category}
                  onValueChange={setCategory}
                  allLabel="All categories"
                  width="w-[180px]"
                  options={ASSET_CATEGORIES.map((c) => ({ value: c, label: c }))}
                />
                <FilterSelect
                  label="Status"
                  value={status}
                  onValueChange={setStatus}
                  allLabel="All statuses"
                  width="w-[170px]"
                  options={[
                    { value: "allocated", label: "Allocated" },
                    { value: "in_stock", label: "In stock" },
                    { value: "under_repair", label: "Under repair" },
                    { value: "retired", label: "Retired" },
                    { value: "lost", label: "Lost" },
                  ]}
                />
                <FilterSelect
                  label="Branch"
                  value={branch}
                  onValueChange={setBranch}
                  allLabel="All branches"
                  width="w-[170px]"
                  options={BRANCHES.map((b) => ({ value: b.id, label: b.city }))}
                />
              </>
            }
            bulkActions={(rows, clear) => {
              const live = rows.filter((a) => a.status !== "retired" && a.status !== "lost");
              const allInStock = rows.every((a) => a.status === "in_stock");
              return (
                <>
                  {allInStock && (
                    <Gated menuKey="workplace.assets" action="E">
                      <Button size="sm" onClick={() => setAllocating({ open: true, preselected: rows, clear })}>
                        <PackageCheck /> Allocate {rows.length}
                      </Button>
                    </Gated>
                  )}
                  <Gated menuKey="workplace.assets" action="E">
                    <Button size="sm" variant="outline" disabled={!live.length} onClick={() => sendForRepair({ rows: live, clear })}>
                      <Wrench /> Send for repair
                    </Button>
                  </Gated>
                  <Gated menuKey="workplace.assets" action="D">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!live.length}
                      onClick={() => setRetiring({ rows: live, clear, lost: false })}
                    >
                      <Ban /> Retire
                    </Button>
                  </Gated>
                  <Gated menuKey="workplace.assets" action="D">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!live.length}
                      onClick={() => setRetiring({ rows: live, clear, lost: true })}
                    >
                      Write off as lost
                    </Button>
                  </Gated>
                </>
              );
            }}
          />

          <div className="grid gap-3 lg:grid-cols-2">
            <DonutChart
              title="Assets by category"
              description="What the register is actually made of."
              data={ASSETS_BY_CATEGORY.map((c) => ({ name: c.name, value: c.value }))}
              centreValue={num(stats.total)}
              centreLabel="assets"
              height={260}
              onSliceClick={(row) => setCategory(String(row.name))}
            />
            <BarCompareChart
              title="Allocated versus in stock"
              description="Where the spare capacity sits, by category."
              data={ASSET_ALLOCATION_BY_CATEGORY.map((c) => ({
                name: c.category,
                allocated: c.allocated,
                inStock: c.in_stock,
              }))}
              xKey="name"
              series={[
                { key: "allocated", label: "Allocated" },
                { key: "inStock", label: "In stock" },
              ]}
              stacked
              horizontal
              height={260}
            />
          </div>
        </TabsContent>

        <TabsContent value="mine">
          <MyAssetCards assets={mine} holderName={persona.name} />
        </TabsContent>
      </Tabs>

      <AssetAllocationDialog
        open={allocating.open}
        onOpenChange={(open) => setAllocating((s) => (open ? { ...s, open } : { open: false, preselected: NO_PRESELECTION }))}
        preselected={allocating.preselected}
        stock={stock}
        onAllocate={allocate}
      />

      <ConfirmDialog
        open={!!returning}
        onOpenChange={(o) => !o && setReturning(null)}
        title="Return this asset to stock?"
        description={
          returning
            ? `${returning.tag} — ${returning.make} ${returning.model} will be recovered from ${returning.allocatedToName} and marked in stock.`
            : undefined
        }
        confirmLabel="Return to stock"
        onConfirm={() => returning && returnAsset(returning)}
      />

      <ConfirmDialog
        open={!!retiring}
        onOpenChange={(o) => !o && setRetiring(null)}
        title={
          retiring?.lost
            ? `Write off ${retiring.rows.length} asset${retiring.rows.length === 1 ? "" : "s"} as lost?`
            : `Retire ${retiring?.rows.length ?? 0} asset${retiring?.rows.length === 1 ? "" : "s"}?`
        }
        description={
          retiring &&
          `${inr(retiring.rows.reduce((s, a) => s + a.purchaseCost, 0), { decimals: false })} at cost leaves the active register${
            retiring.rows.some((a) => a.allocatedTo) ? ", and the current holders are unassigned" : ""
          }. The reason is kept on each asset's history for the auditors.`
        }
        confirmLabel={retiring?.lost ? "Write off" : "Retire"}
        destructive
        comment={{
          label: "Reason",
          placeholder: retiring?.lost
            ? "e.g. Reported stolen on the 14 Sep commute — FIR 1128/2026 attached."
            : "e.g. Battery swollen, beyond economical repair.",
        }}
        onConfirm={(reason) => retiring && retire(retiring, reason)}
      />
    </PageBody>
  );
}
