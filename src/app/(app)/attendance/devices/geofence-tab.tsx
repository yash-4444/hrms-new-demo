"use client";

import * as React from "react";
import { MapPin, Save } from "lucide-react";
import { num } from "@/lib/format";
import { DEVICE_GEOFENCES, type GeoFence } from "@/mock/finance-time";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch, Label } from "@/components/ui/primitives";
import { Gated, Section } from "@/components/shell/page";

/** Per-branch mobile punch rules: geo-fence radius and the selfie check. */
export function GeofenceTab() {
  const { can } = useApp();
  const editable = can("time.devices", "E");
  const [saved, setSaved] = React.useState<GeoFence[]>(DEVICE_GEOFENCES);
  const [draft, setDraft] = React.useState<GeoFence[]>(DEVICE_GEOFENCES);

  const update = (id: string, patch: Partial<GeoFence>) =>
    setDraft((d) => d.map((g) => (g.branchId === id ? { ...g, ...patch } : g)));

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {draft.map((g) => {
        const base = saved.find((s) => s.branchId === g.branchId)!;
        const dirty = JSON.stringify(base) !== JSON.stringify(g);
        const radiusError = g.radius < 50 || g.radius > 1000 ? "Radius must be between 50 m and 1,000 m" : undefined;
        return (
          <Section
            key={g.branchId}
            title={g.branch}
            description={`${g.lat.toFixed(4)}° N, ${g.lng.toFixed(4)}° E · ${num(g.mobilePunches30d)} mobile punches in 30 days`}
          >
            <div className="flex flex-col gap-3">
              <div className="relative flex h-28 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                <span
                  aria-hidden
                  className="absolute rounded-full border-2 border-primary/50 bg-primary/10"
                  style={{ width: Math.min(104, 24 + g.radius / 8), height: Math.min(104, 24 + g.radius / 8) }}
                />
                <MapPin className="relative size-5 text-primary" aria-hidden />
                <span className="absolute bottom-1.5 right-2 text-[10px] text-muted-foreground">{num(g.radius)} m radius</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={`mob-${g.branchId}`}>Mobile punching enabled</Label>
                <Switch
                  id={`mob-${g.branchId}`}
                  checked={g.mobileEnabled}
                  disabled={!editable}
                  onCheckedChange={(v) => update(g.branchId, { mobileEnabled: v })}
                />
              </div>
              <Field label="Geo-fence radius (metres)" htmlFor={`rad-${g.branchId}`} error={radiusError} hint="Punches outside the circle are rejected with the distance shown.">
                <Input
                  id={`rad-${g.branchId}`}
                  type="number"
                  step={25}
                  className="tnum"
                  value={g.radius}
                  disabled={!editable || !g.mobileEnabled}
                  aria-invalid={!!radiusError}
                  onChange={(e) => update(g.branchId, { radius: Number(e.target.value) || 0 })}
                />
              </Field>
              <div className="flex items-center justify-between gap-2">
                <span className="flex flex-col">
                  <Label htmlFor={`selfie-${g.branchId}`}>Selfie required</Label>
                  <span className="text-[11px] text-muted-foreground">Face match against the profile photo</span>
                </span>
                <Switch
                  id={`selfie-${g.branchId}`}
                  checked={g.selfieRequired}
                  disabled={!editable || !g.mobileEnabled}
                  onCheckedChange={(v) => update(g.branchId, { selfieRequired: v })}
                />
              </div>
              <div className="flex justify-end gap-1.5 border-t border-border pt-3">
                {dirty && (
                  <Button size="sm" variant="ghost" onClick={() => update(g.branchId, base)}>
                    Revert
                  </Button>
                )}
                <Gated menuKey="time.devices" action="E">
                  <Button
                    size="sm"
                    disabled={!dirty || !!radiusError}
                    onClick={() => {
                      setSaved((s) => s.map((x) => (x.branchId === g.branchId ? g : x)));
                      mockAction(`Mobile punch rules saved for ${g.branch}`, {
                        description: g.mobileEnabled
                          ? `${num(g.radius)} m geo-fence · selfie ${g.selfieRequired ? "required" : "not required"}. Applies from the next punch.`
                          : "Mobile punching is now off for this branch — biometric and web punches only.",
                      });
                    }}
                  >
                    <Save /> Save
                  </Button>
                </Gated>
              </div>
            </div>
          </Section>
        );
      })}
    </div>
  );
}
