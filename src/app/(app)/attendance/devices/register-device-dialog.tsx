"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BRANCHES, branchById, DEMO_NOW } from "@/mock/org";
import type { BiometricDevice } from "@/mock/finance-time";
import { mockAction } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import {
  DialogBody,
  DialogClose,
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
import { Field, Input } from "@/components/ui/primitives";
import { GuardedDialog } from "@/components/finance/kit";

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

const schema = z.object({
  name: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}-[A-Z0-9-]{2,20}$/, "Use the BRANCH-LOCATION-NN convention, e.g. BLR-GATE-03"),
  vendor: z.enum(["ZKTeco", "eSSL", "Matrix"]),
  model: z.string().trim().min(2, "Enter the device model"),
  branchId: z.string().min(1, "Pick the branch the device is installed at"),
  location: z.string().trim().min(3, "Describe where the device is mounted"),
  ip: z.string().trim().regex(IPV4, "Enter a valid IPv4 address, e.g. 10.20.4.23"),
  serial: z.string().trim().min(6, "Serial number is printed on the device label"),
});

type Values = z.infer<typeof schema>;

const DEFAULTS: Values = { name: "", vendor: "ZKTeco", model: "", branchId: "", location: "", ip: "", serial: "" };

export function RegisterDeviceDialog({
  open,
  onOpenChange,
  existingIps,
  onRegister,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingIps: string[];
  onRegister: (d: BiometricDevice) => void;
}) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: DEFAULTS });
  const { errors } = form.formState;

  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) form.reset(DEFAULTS);
  };

  const submit = form.handleSubmit((v) => {
    if (existingIps.includes(v.ip)) {
      form.setError("ip", { message: "Another registered device already uses this IP address" });
      return;
    }
    onRegister({
      id: v.name,
      name: v.name,
      vendor: v.vendor,
      model: v.model,
      branchId: v.branchId,
      branch: branchById(v.branchId)?.name ?? v.branchId,
      location: v.location,
      ip: v.ip,
      serial: v.serial,
      firmware: "Awaiting first handshake",
      lastSync: DEMO_NOW,
      status: "offline",
      enrolled: 0,
      punchesToday: 0,
      note: "Registered — the device goes Online after its first ADMS push.",
    });
    mockAction(`${v.name} registered`, {
      description: `Point the device's ADMS server to push.stellartech.in. It appears Online after the first heartbeat.`,
    });
    close(false);
  });

  return (
    <GuardedDialog open={open} onOpenChange={close} dirty={form.formState.isDirty} size="lg">
      <DialogHeader>
        <DialogTitle>Register a biometric device</DialogTitle>
        <DialogDescription>
          Punches are accepted only from registered devices. Templates sync from the employee master after the first
          heartbeat.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} noValidate>
        <DialogBody className="grid gap-3 sm:grid-cols-2">
          <Field label="Device name" htmlFor="dev-name" required error={errors.name?.message}>
            <Input id="dev-name" placeholder="BLR-GATE-03" aria-invalid={!!errors.name} {...form.register("name")} />
          </Field>
          <Field label="Vendor" required>
            <Controller
              control={form.control}
              name="vendor"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-label="Vendor">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["ZKTeco", "eSSL", "Matrix"].map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Model" htmlFor="dev-model" required error={errors.model?.message}>
            <Input id="dev-model" placeholder="SpeedFace-V5L" aria-invalid={!!errors.model} {...form.register("model")} />
          </Field>
          <Field label="Branch" required error={errors.branchId?.message}>
            <Controller
              control={form.control}
              name="branchId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-label="Branch" aria-invalid={!!errors.branchId}>
                    <SelectValue placeholder="Select a branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRANCHES.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Mounted at" htmlFor="dev-loc" required error={errors.location?.message} className="sm:col-span-2">
            <Input id="dev-loc" placeholder="Level 3 east wing entrance" aria-invalid={!!errors.location} {...form.register("location")} />
          </Field>
          <Field label="IP address" htmlFor="dev-ip" required error={errors.ip?.message} hint="Static IP on the access-control VLAN">
            <Input id="dev-ip" placeholder="10.20.4.23" className="tnum" aria-invalid={!!errors.ip} {...form.register("ip")} />
          </Field>
          <Field label="Serial number" htmlFor="dev-serial" required error={errors.serial?.message}>
            <Input id="dev-serial" placeholder="ZKT5591028" aria-invalid={!!errors.serial} {...form.register("serial")} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit">Register device</Button>
        </DialogFooter>
      </form>
    </GuardedDialog>
  );
}
