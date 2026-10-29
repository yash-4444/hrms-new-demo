"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, ArrowRightLeft, Ban, Camera, History, Laptop, Printer, ShieldCheck, Undo2, Wrench } from "lucide-react";
import { fmtDate, inr } from "@/lib/format";
import { employeeName } from "@/mock/employees";
import { DEMO_TODAY } from "@/mock/org";
import { ASSETS, type Asset } from "@/mock/workplace";
import { MODEL_SPECS, assetStory, categoryForAsset, type AssetMaintenance } from "@/mock/service";
import { mockAction } from "@/components/app-state";
import { DataTable, NumCell } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, EmptyState, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { CardsSkeleton, Gated, PageBody, PageHeader, Section, useFakeLoad } from "@/components/shell/page";
import { FactGrid, ReasonDialog, Timeline } from "@/components/service/kit";
import { QrTag } from "@/components/service/qr-tag";
import { DepreciationPanel } from "@/components/service/depreciation-panel";
import { AssetTransferDialog } from "@/components/service/asset-transfer-dialog";

export default function AssetDetailView() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? decodeURIComponent(params.id) : "";
  const loading = useFakeLoad();
  const asset = React.useMemo(() => ASSETS.find((a) => a.id === id), [id]);

  if (loading) {
    return (
      <PageBody>
        <Skeleton className="h-6 w-72" />
        <CardsSkeleton count={4} />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Skeleton className="h-[420px]" />
          <Skeleton className="h-[420px]" />
        </div>
      </PageBody>
    );
  }

  if (!asset) {
    return (
      <PageBody>
        <PageHeader title="Asset not found" description={`No asset carries the tag ${id || "—"} in this tenant.`} />
        <EmptyState
          icon={Laptop}
          title="This tag is not in the register"
          description="It may have been mistyped on the label, or the asset was disposed of before the register moved to the HRMS."
          action={
            <Button size="sm" asChild>
              <Link href="/assets">
                <ArrowLeft /> Back to the register
              </Link>
            </Button>
          }
        />
      </PageBody>
    );
  }
  return <AssetDetail key={asset.id} initial={asset} />;
}

function AssetDetail({ initial }: { initial: Asset }) {
  const [asset, setAsset] = React.useState(initial);
  const story = React.useMemo(() => assetStory(initial), [initial]);
  const [events, setEvents] = React.useState(story.events);
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [returnOpen, setReturnOpen] = React.useState(false);
  const [retireOpen, setRetireOpen] = React.useState(false);
  const policy = categoryForAsset(asset.category);
  const specs = MODEL_SPECS[asset.model] ?? [];
  const closed = asset.status === "retired" || asset.status === "lost";

  const log = (kind: (typeof events)[number]["kind"], title: string, note: string) =>
    setEvents((es) => [...es, { date: DEMO_TODAY, kind, title, by: "You", note }]);

  const maintenanceCols = React.useMemo<ColumnDef<AssetMaintenance, unknown>[]>(
    () => [
      { accessorKey: "date", header: "Date", cell: ({ row }) => <span className="tnum">{fmtDate(row.original.date)}</span> },
      { accessorKey: "type", header: "Type", cell: ({ row }) => <Badge variant="muted">{row.original.type}</Badge> },
      { accessorKey: "description", header: "Work done" },
      { accessorKey: "vendor", header: "Vendor" },
      { accessorKey: "cost", header: "Cost", cell: ({ row }) => <NumCell>{row.original.cost === 0 ? "Warranty" : inr(row.original.cost, { decimals: false })}</NumCell> },
      { accessorKey: "downtimeDays", header: "Downtime", cell: ({ row }) => <NumCell>{row.original.downtimeDays} d</NumCell> },
      { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    ],
    [],
  );

  return (
    <PageBody>
      <PageHeader
        title={`${asset.make} ${asset.model}`}
        description={
          <>
            <Link href="/assets" className="hover:underline">Asset register</Link> · <span className="font-mono">{asset.tag}</span> · {asset.category} · SN{" "}
            <span className="font-mono">{asset.serial}</span>
          </>
        }
        actions={
          <>
            <Gated menuKey="workplace.assets" action="E">
              <Button size="sm" variant="outline" disabled={closed || asset.status === "under_repair"} onClick={() => setTransferOpen(true)}>
                <ArrowRightLeft /> Transfer
              </Button>
            </Gated>
            <Gated menuKey="workplace.assets" action="E">
              <Button size="sm" variant="outline" disabled={asset.status !== "allocated"} onClick={() => setReturnOpen(true)}>
                <Undo2 /> Return to stock
              </Button>
            </Gated>
            <Gated menuKey="workplace.assets" action="D">
              <Button size="sm" variant="destructive" disabled={closed} onClick={() => setRetireOpen(true)}>
                <Ban /> Retire
              </Button>
            </Gated>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Tabs defaultValue="overview" className="min-w-0">
          <TabsList>
            <TabsTrigger value="overview"><Laptop /> Overview</TabsTrigger>
            <TabsTrigger value="history"><History /> Assignment history</TabsTrigger>
            <TabsTrigger value="condition"><Camera /> Condition log</TabsTrigger>
            <TabsTrigger value="maintenance"><Wrench /> Maintenance ({story.maintenance.length})</TabsTrigger>
            <TabsTrigger value="depreciation">Depreciation</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="grid gap-3 md:grid-cols-2">
            <Section title="Specifications" description={`Custom fields from the ${policy.name} category.`}>
              <FactGrid items={[["Make", asset.make], ["Model", asset.model], ["Serial", <span key="s" className="font-mono">{asset.serial}</span>], ...specs]} />
            </Section>
            <Section title="Purchase" description="From the capitalised invoice.">
              <FactGrid
                items={[
                  ["Vendor", asset.vendor],
                  ["Invoice", <span key="i" className="font-mono">{story.invoiceNo}</span>],
                  ["Purchase date", fmtDate(asset.purchaseDate)],
                  ["Cost", <span key="c" className="tnum">{inr(asset.purchaseCost, { decimals: false })}</span>],
                  ["Warranty expiry", <span key="w" className="tnum">{fmtDate(asset.warrantyExpiry)} {asset.inWarranty ? "· in warranty" : "· expired"}</span>],
                  ["Depreciation", `${policy.method} · ${policy.usefulLifeYears}-year life`],
                ]}
              />
            </Section>
          </TabsContent>

          <TabsContent value="history">
            <Section title="Assignment history" description="Every movement of this asset, oldest first.">
              <Timeline
                items={events.map((e, i) => ({
                  key: `${e.date}-${i}`,
                  date: fmtDate(e.date),
                  title: e.title,
                  note: `${e.note} · by ${e.by}`,
                  tone: e.kind === "retired" ? "danger" : e.kind === "repair" ? "warning" : e.kind === "allocated" ? "success" : undefined,
                }))}
              />
            </Section>
          </TabsContent>

          <TabsContent value="condition">
            <Section title="Condition log" description="Recorded at every handover and verification, with photos.">
              <ul className="flex flex-col divide-y divide-border">
                {story.conditions.map((c, i) => (
                  <li key={`${c.date}-${i}`} className="flex flex-wrap items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-xs font-medium">{c.condition} <span className="tnum font-normal text-muted-foreground">· {fmtDate(c.date)}</span></p>
                      <p className="text-xs text-muted-foreground">{c.note} · {c.recordedBy}</p>
                    </div>
                    <div className="flex gap-1.5" aria-label={`${c.photos} photos`}>
                      {Array.from({ length: c.photos }).map((_, k) => (
                        <span key={k} className="flex size-12 items-center justify-center rounded-md border border-dashed border-border bg-muted text-muted-foreground">
                          <Camera className="size-4" aria-hidden />
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          </TabsContent>

          <TabsContent value="maintenance">
            <DataTable
              columns={maintenanceCols}
              data={story.maintenance}
              getRowId={(m) => m.id}
              exportName={`${asset.tag}-maintenance`}
              emptyIcon={Wrench}
              emptyTitle="No maintenance recorded"
              emptyDescription="Preventive visits and breakdown repairs for this asset will appear here."
              dense
            />
          </TabsContent>

          <TabsContent value="depreciation">
            <DepreciationPanel asset={asset} />
          </TabsContent>
        </Tabs>

        <div className="flex flex-col gap-3">
          <Section title="Status">
            <div className="flex flex-col gap-2.5">
              <StatusBadge status={asset.status} />
              {asset.allocatedTo ? (
                <Link href={`/employees/${asset.allocatedTo}`} className="flex items-center gap-2 hover:underline">
                  <Avatar name={asset.allocatedToName} size={28} />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">{asset.allocatedToName}</span>
                    <span className="tnum text-xs text-muted-foreground">since {asset.allocatedOn ? fmtDate(asset.allocatedOn) : "—"}</span>
                  </span>
                </Link>
              ) : (
                <p className="text-xs text-muted-foreground">Not allocated to anyone.</p>
              )}
              <FactGrid items={[["Location", asset.location], ["Condition", asset.condition]]} />
            </div>
          </Section>
          <Section
            title="Asset tag"
            actions={
              <Button size="sm" variant="ghost" onClick={() => mockAction(`Label for ${asset.tag} sent to the printer`, { description: "Zebra ZD421 · IT store, 7F" })}>
                <Printer /> Print
              </Button>
            }
          >
            <div className="flex flex-col items-center gap-2">
              <QrTag value={asset.tag} />
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-3" aria-hidden /> Scan in the HRMS app to verify or report an issue
              </p>
            </div>
          </Section>
        </div>
      </div>

      <AssetTransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        asset={asset}
        onSave={(v) => {
          const name = employeeName(v.toCode);
          setAsset((a) => ({ ...a, status: "allocated", allocatedTo: v.toCode, allocatedToName: name, allocatedOn: v.effective, condition: v.condition }));
          log("allocated", `Transferred to ${name}`, v.note);
          mockAction(`${asset.tag} transferred to ${name}`, { description: `Effective ${fmtDate(v.effective)} · condition ${v.condition}.` });
        }}
      />
      <ConfirmDialog
        open={returnOpen}
        onOpenChange={setReturnOpen}
        title={`Return ${asset.tag} to stock?`}
        description={`${asset.allocatedToName} will be asked to hand it to the IT store. The asset is wiped before it is re-issued.`}
        confirmLabel="Return to stock"
        onConfirm={() => {
          log("returned", `Returned by ${asset.allocatedToName}`, "Queued for wipe and re-image");
          setAsset((a) => ({ ...a, status: "in_stock", allocatedTo: null, allocatedToName: "—", allocatedOn: null }));
          mockAction(`${asset.tag} returned to stock`);
        }}
      />
      <ReasonDialog
        open={retireOpen}
        onOpenChange={setRetireOpen}
        title={`Retire ${asset.tag}?`}
        description="Removes the asset from the active register and writes off its remaining book value. This cannot be undone."
        confirmLabel="Retire asset"
        commentLabel="Reason for retirement"
        onConfirm={(reason) => {
          log("retired", "Retired and written off", reason);
          setAsset((a) => ({ ...a, status: "retired", allocatedTo: null, allocatedToName: "—", allocatedOn: null }));
          mockAction(`${asset.tag} retired`, { description: reason });
        }}
      />
    </PageBody>
  );
}
