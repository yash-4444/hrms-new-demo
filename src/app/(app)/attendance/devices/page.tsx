"use client";

import * as React from "react";
import { AlertOctagon, Fingerprint, Inbox, MapPin, Plus, Wifi, WifiOff } from "lucide-react";
import { num } from "@/lib/format";
import { DEVICE_BATCHES, DEVICE_FAILED_PUNCHES, DEVICE_LIST, type BiometricDevice } from "@/mock/finance-time";
import { mockAction } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { DevicesTab, syncDevices } from "./devices-tab";
import { IngestTab, NEEDS_MASTER_FIX } from "./ingest-tab";
import { GeofenceTab } from "./geofence-tab";
import { RegisterDeviceDialog } from "./register-device-dialog";

/* ============================================================================
   /attendance/devices — biometric and access-control devices, the punch
   ingestion queue with replay, and mobile geo-fence rules per branch.
   ========================================================================== */

export default function DevicesPage() {
  const loading = useFakeLoad();
  const [tab, setTab] = React.useState("devices");
  const [devices, setDevices] = React.useState<BiometricDevice[]>(DEVICE_LIST);
  const [batches, setBatches] = React.useState(DEVICE_BATCHES);
  const [failed, setFailed] = React.useState(DEVICE_FAILED_PUNCHES);
  const [registerOpen, setRegisterOpen] = React.useState(false);

  const online = devices.filter((d) => d.status === "online").length;
  const down = devices.filter((d) => d.status !== "online").length;
  const received = batches.reduce((s, b) => s + b.received, 0);
  const processed = batches.reduce((s, b) => s + b.processed, 0);

  const onSync = React.useCallback((ids: string[]) => setDevices((d) => syncDevices(d, ids)), []);

  const onReplay = (ids: string[]) => {
    const target = failed.filter((p) => ids.includes(p.id));
    const fixed = target.filter((p) => !NEEDS_MASTER_FIX.includes(p.reason));
    const fixedIds = new Set(fixed.map((p) => p.id));
    setFailed((f) => f.filter((p) => !fixedIds.has(p.id)));
    /* Move the replayed punches from Failed to Processed on their batches, so the queue totals still add up. */
    setBatches((bs) =>
      bs.map((b) => {
        const n = fixed.filter((p) => p.id.startsWith(`${b.id}-F`)).length;
        return n ? { ...b, failed: b.failed - n, processed: b.processed + n } : b;
      }),
    );
    mockAction(`${fixed.length} of ${target.length} punches replayed`, {
      description:
        target.length > fixed.length
          ? `${target.length - fixed.length} still need a master-data fix (unmapped badge or inactive employee) and stay in the list.`
          : "Each punch was attached to its attendance day; the muster roll reflects it on next refresh.",
      tone: target.length > fixed.length ? "warning" : "success",
    });
  };

  return (
    <PageBody>
      <PageHeader
        title="Biometric devices"
        description="Every device that may push punches, the queue those punches land in, and the rules that govern mobile punching."
        actions={
          <Gated menuKey="time.devices" action="C">
            <Button size="sm" onClick={() => setRegisterOpen(true)}>
              <Plus /> Register device
            </Button>
          </Gated>
        }
      />

      {loading ? (
        <>
          <CardsSkeleton count={4} />
          <TableSkeleton />
        </>
      ) : (
        <>
          <StatRow cols={4}>
            <StatTile label="Devices" value={num(devices.length)} icon={Fingerprint} hint="Across four branches" onClick={() => setTab("devices")} />
            <StatTile label="Online" value={num(online)} icon={Wifi} tone="good" hint="Heartbeat in the last 10 min" onClick={() => setTab("devices")} />
            <StatTile
              label="Offline or in error"
              value={num(down)}
              icon={down ? WifiOff : Wifi}
              tone={down ? "critical" : "neutral"}
              hint={down ? "Punches from these devices are delayed" : "All devices healthy"}
              onClick={() => setTab("devices")}
            />
            <StatTile
              label="Punches today"
              value={`${num(processed)} / ${num(received)}`}
              icon={Inbox}
              hint={`${num(failed.length)} failed · ${num(received - processed - failed.length)} in queue`}
              tone={failed.length ? "warning" : "neutral"}
              onClick={() => setTab("ingest")}
            />
          </StatRow>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="devices">
                <Fingerprint aria-hidden /> Devices
              </TabsTrigger>
              <TabsTrigger value="ingest">
                <AlertOctagon aria-hidden /> Ingestion queue
                {failed.length > 0 && (
                  <span className="tnum rounded bg-destructive-soft px-1 text-[10px] text-destructive-fg">{failed.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="geo">
                <MapPin aria-hidden /> Mobile geo-fence
              </TabsTrigger>
            </TabsList>
            <TabsContent value="devices" className="mt-3">
              <DevicesTab devices={devices} onSync={onSync} />
            </TabsContent>
            <TabsContent value="ingest" className="mt-3">
              <IngestTab batches={batches} failed={failed} onReplay={onReplay} />
            </TabsContent>
            <TabsContent value="geo" className="mt-3">
              <GeofenceTab />
            </TabsContent>
          </Tabs>
        </>
      )}

      <RegisterDeviceDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        existingIps={devices.map((d) => d.ip)}
        onRegister={(d) => setDevices((ds) => [...ds, d])}
      />
    </PageBody>
  );
}
