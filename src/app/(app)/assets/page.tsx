"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Check,
  Laptop,
  PackageCheck,
  PackageX,
  Plus,
  ShieldCheck,
  Undo2,
  Wrench,
} from "lucide-react";
import { fmtDate, inr, inrCompact, num } from "@/lib/format";
import { BRANCHES } from "@/mock/org";
import { EMPLOYEES, employeeName } from "@/mock/employees";
import {
  ASSETS,
  ASSET_ALLOCATION_BY_CATEGORY,
  ASSET_CATEGORIES,
  ASSETS_BY_CATEGORY,
  type Asset,
  type AssetCondition,
} from "@/mock/workplace";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, NumCell } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Alert,
  Avatar,
  Badge,
  Checkbox,
  EmptyState,
  Field,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/primitives";
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
} from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { BarCompareChart, DonutChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import {
  Gated,
  PageBody,
  PageHeader,
  Section,
  TableSkeleton,
  useFakeLoad,
} from "@/components/shell/page";

const CONDITIONS: AssetCondition[] = ["New", "Excellent", "Good", "Fair", "Needs repair"];

export default function AssetsPage() {
  const loading = useFakeLoad();
  const { persona } = useApp();

  const [assets, setAssets] = React.useState<Asset[]>(ASSETS);
  const [category, setCategory] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [branch, setBranch] = React.useState("all");
  const [allocating, setAllocating] = React.useState<Asset | null>(null);
  const [returning, setReturning] = React.useState<Asset | null>(null);

  /* allocation form */
  const [toCode, setToCode] = React.useState("STL-0142");
  const [allocDate, setAllocDate] = React.useState("2026-09-16");
  const [condition, setCondition] = React.useState<AssetCondition>("Excellent");
  const [acknowledged, setAcknowledged] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

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

  const mine = React.useMemo(
    () => assets.filter((a) => a.allocatedTo === persona.employeeId),
    [assets, persona.employeeId],
  );

  const stats = React.useMemo(
    () => ({
      total: assets.length,
      allocated: assets.filter((a) => a.status === "allocated").length,
      inStock: assets.filter((a) => a.status === "in_stock").length,
      repair: assets.filter((a) => a.status === "under_repair").length,
      value: assets.reduce((s, a) => s + a.purchaseCost, 0),
      outOfWarranty: assets.filter((a) => !a.inWarranty && a.status === "allocated").length,
    }),
    [assets],
  );

  const openAllocate = (a: Asset) => {
    setAllocating(a);
    setToCode("STL-0142");
    setAllocDate("2026-09-16");
    setCondition(a.condition);
    setAcknowledged(false);
    setFormError(null);
  };

  const allocate = () => {
    if (!allocating) return;
    if (!acknowledged) {
      setFormError("The employee must acknowledge the asset handover policy before allocation.");
      return;
    }
    setAssets((as) =>
      as.map((a) =>
        a.id === allocating.id
          ? {
              ...a,
              status: "allocated",
              allocatedTo: toCode,
              allocatedToName: employeeName(toCode),
              allocatedOn: allocDate,
              condition,
            }
          : a,
      ),
    );
    mockAction(`${allocating.tag} allocated`, {
      description: `${allocating.make} ${allocating.model} → ${employeeName(toCode)} on ${fmtDate(allocDate)}.`,
    });
    setAllocating(null);
  };

  const returnAsset = (a: Asset) => {
    setAssets((as) =>
      as.map((x) =>
        x.id === a.id
          ? { ...x, status: "in_stock", allocatedTo: null, allocatedToName: "—", allocatedOn: null }
          : x,
      ),
    );
    mockAction(`${a.tag} returned to stock`, {
      description: `Recovered from ${a.allocatedToName}. Condition logged as ${a.condition}.`,
    });
  };

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
            <span className="font-mono text-[10px] text-muted-foreground">
              SN {row.original.serial}
            </span>
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
        cell: ({ row }) => (
          <Gated menuKey="workplace.assets" action="E">
            {row.original.status === "allocated" ? (
              <Button variant="outline" size="sm" onClick={() => setReturning(row.original)}>
                <Undo2 /> Return
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={row.original.status === "retired" || row.original.status === "lost"}
                onClick={() => openAllocate(row.original)}
              >
                Allocate
              </Button>
            )}
          </Gated>
        ),
      },
    ],
    [],
  );

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Assets" description="Loading the register…" />
        <TableSkeleton />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="Assets"
        description="Every laptop, monitor, phone and access card Stellar owns, and who is holding it."
        actions={
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
        }
      />

      <StatRow cols={5}>
        <StatTile label="Total assets" value={num(stats.total)} icon={Laptop} hint={`${ASSET_CATEGORIES.length} categories`} />
        <StatTile
          label="Allocated"
          value={num(stats.allocated)}
          icon={PackageCheck}
          tone="good"
          onClick={() => setStatus("allocated")}
        />
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

      <Tabs defaultValue="register">
        <TabsList>
          <TabsTrigger value="register">
            <Laptop /> Register
          </TabsTrigger>
          <TabsTrigger value="mine">
            <PackageCheck /> My assets ({mine.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="register" className="flex flex-col gap-3">
          <DataTable
            columns={columns}
            data={filtered}
            searchKeys={["search"]}
            searchPlaceholder="Search tag, make, serial, holder…"
            exportName="asset-register"
            getRowId={(a) => a.id}
            enableSelection
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
            bulkActions={(selected, clear) => (
              <>
                <Gated menuKey="workplace.assets" action="E">
                  <Button
                    size="sm"
                    onClick={() => {
                      setAssets((as) =>
                        as.map((a) =>
                          selected.some((s) => s.id === a.id) ? { ...a, status: "under_repair" } : a,
                        ),
                      );
                      mockAction(`${selected.length} asset(s) sent for repair`, {
                        description: "A service ticket has been raised with the vendor.",
                      });
                      clear();
                    }}
                  >
                    <Wrench /> Send for repair
                  </Button>
                </Gated>
                <Gated menuKey="workplace.assets" action="D">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAssets((as) =>
                        as.map((a) =>
                          selected.some((s) => s.id === a.id)
                            ? { ...a, status: "retired", allocatedTo: null, allocatedToName: "—" }
                            : a,
                        ),
                      );
                      mockAction(`${selected.length} asset(s) retired`, {
                        description: "Removed from the active register and written off.",
                      });
                      clear();
                    }}
                  >
                    Retire
                  </Button>
                </Gated>
              </>
            )}
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
          {mine.length === 0 ? (
            <EmptyState
              icon={Laptop}
              title="No assets allocated to you"
              description={`Nothing in the register is currently assigned to ${persona.name}. Raise a helpdesk ticket if you need equipment.`}
              action={
                <Button size="sm" asChild>
                  <Link href="/helpdesk">Raise a request</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {mine.map((a) => (
                <Card key={a.id} className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {a.make} {a.model}
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground">{a.tag}</p>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                  <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-border pt-2.5 text-[11px]">
                    {[
                      ["Serial", a.serial],
                      ["Condition", a.condition],
                      ["Allocated on", a.allocatedOn ? fmtDate(a.allocatedOn) : "—"],
                      ["Warranty", a.inWarranty ? `until ${fmtDate(a.warrantyExpiry)}` : "Expired"],
                    ].map(([k, v]) => (
                      <React.Fragment key={k}>
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd className="truncate text-right font-medium">{v}</dd>
                      </React.Fragment>
                    ))}
                  </dl>
                  <div className="mt-2.5 flex gap-1.5 border-t border-border pt-2.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() =>
                        mockAction("Support ticket raised", {
                          description: `${a.tag} — an IT engineer will contact you within the SLA.`,
                        })
                      }
                    >
                      <Wrench /> Report issue
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setReturning(a)}>
                      <Undo2 /> Return
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ------------------------------------------------ allocation dialog */}
      <Dialog open={!!allocating} onOpenChange={(o) => !o && setAllocating(null)}>
        <DialogContent size="md">
          {allocating && (
            <>
              <DialogHeader>
                <DialogTitle>Allocate {allocating.tag}</DialogTitle>
                <DialogDescription>
                  {allocating.make} {allocating.model} · serial {allocating.serial} ·{" "}
                  {inr(allocating.purchaseCost, { decimals: false })}
                </DialogDescription>
              </DialogHeader>
              <DialogBody className="flex flex-col gap-3">
                <Field label="Allocate to" htmlFor="alloc-to" required>
                  <Select value={toCode} onValueChange={setToCode}>
                    <SelectTrigger id="alloc-to">
                      <span className="truncate text-xs">
                        {employeeName(toCode)} · {toCode}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {EMPLOYEES.slice(0, 60).map((e) => (
                        <SelectItem key={e.code} value={e.code}>
                          {e.name} · {e.code} · {e.designation}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Allocation date" htmlFor="alloc-date" required>
                    <Input
                      id="alloc-date"
                      type="date"
                      value={allocDate}
                      onChange={(e) => setAllocDate(e.target.value)}
                    />
                  </Field>
                  <Field label="Condition at handover" htmlFor="alloc-cond" required>
                    <Select value={condition} onValueChange={(v) => setCondition(v as AssetCondition)}>
                      <SelectTrigger id="alloc-cond">
                        <span className="text-xs">{condition}</span>
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITIONS.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                {!allocating.inWarranty && (
                  <Alert tone="warning" title="Out of warranty">
                    Warranty expired on {fmtDate(allocating.warrantyExpiry)}. Any repair will be billed
                    to the cost centre rather than covered by {allocating.vendor}.
                  </Alert>
                )}

                <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border p-2.5">
                  <Checkbox
                    checked={acknowledged}
                    onCheckedChange={(v) => {
                      setAcknowledged(!!v);
                      if (v) setFormError(null);
                    }}
                    aria-label="Handover acknowledged"
                  />
                  <span className="text-[11px] leading-relaxed">
                    <span className="font-medium">{employeeName(toCode)}</span> acknowledges receipt
                    and accepts responsibility for the asset under the IT equipment policy, including
                    return on exit.
                  </span>
                </label>

                {formError && (
                  <p role="alert" className="text-xs text-destructive-fg">
                    {formError}
                  </p>
                )}
              </DialogBody>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAllocating(null)}>
                  Cancel
                </Button>
                <Button onClick={allocate}>
                  <Check /> Allocate
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

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
    </PageBody>
  );
}
