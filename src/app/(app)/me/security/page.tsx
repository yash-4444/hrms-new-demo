"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Copy,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Monitor,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  Tablet,
} from "lucide-react";
import { cn, mulberry32 } from "@/lib/utils";
import { fmtDateTime, fmtTime } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import { RECOVERY_CODES, loginHistoryFor, sessionsFor, type ActiveSession, type LoginEvent } from "@/mock/self-service";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, MutedCell } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Alert, Badge, Field, Input } from "@/components/ui/primitives";
import {
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { simulateDownload } from "@/components/self-service/bits";
import { PasswordInput, PasswordStrength, passwordField } from "@/components/self-service/password";
import { useDirtyGuard } from "@/components/self-service/dialogs";

const KIND_ICON = { desktop: Monitor, mobile: Smartphone, tablet: Tablet } as const;

/* ---------------------------------------------------------- QR placeholder */

/** A deterministic QR-like matrix — a visual placeholder, not a scannable code. */
function QrPlaceholder({ seed, size = 168 }: { seed: number; size?: number }) {
  const n = 25;
  const rng = mulberry32(seed);
  const cells: [number, number][] = [];
  const finder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) if (!finder(x, y) && rng() < 0.48) cells.push([x, y]);
  const eye = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={7} height={7} fill="#111" />
      <rect x={x + 1} y={y + 1} width={5} height={5} fill="#fff" />
      <rect x={x + 2} y={y + 2} width={3} height={3} fill="#111" />
    </g>
  );
  return (
    <div className="w-fit rounded-md border border-border bg-white p-2.5">
      <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" role="img" aria-label="QR code for your authenticator app (demo placeholder)">
        {cells.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#111" />
        ))}
        {eye(0, 0)}
        {eye(n - 7, 0)}
        {eye(0, n - 7)}
      </svg>
    </div>
  );
}

const otpSchema = z.object({ code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app") });

const passwordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password"),
    password: passwordField,
    confirm: z.string().min(1, "Re-enter the new password"),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The two passwords do not match" })
  .refine((v) => v.password !== v.current, { path: ["password"], message: "The new password must differ from the current one" });
type PasswordValues = z.infer<typeof passwordSchema>;

export default function SecurityPage() {
  const { persona } = useApp();
  return <Security key={persona.employeeId} />;
}

function Security() {
  const loading = useFakeLoad();
  const { persona } = useApp();
  const [sessions, setSessions] = React.useState<ActiveSession[]>(() => sessionsFor(persona.employeeId));
  const history = React.useMemo<LoginEvent[]>(() => loginHistoryFor(persona.employeeId), [persona.employeeId]);
  const [revoke, setRevoke] = React.useState<ActiveSession | "others" | null>(null);

  const [mfaOn, setMfaOn] = React.useState(persona.id !== "employee");
  const [enrolOpen, setEnrolOpen] = React.useState(false);
  const [enrolStep, setEnrolStep] = React.useState<"scan" | "codes">("scan");
  const [disableMfa, setDisableMfa] = React.useState(false);
  const [codesVisible, setCodesVisible] = React.useState(false);

  const otp = useForm<{ code: string }>({ resolver: zodResolver(otpSchema), defaultValues: { code: "" } });
  const closeEnrol = () => {
    setEnrolOpen(false);
    setEnrolStep("scan");
  };
  const enrolGuard = useDirtyGuard(enrolStep === "scan" && otp.formState.isDirty, closeEnrol);

  const pw = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema), defaultValues: { current: "", password: "", confirm: "" } });
  const newPw = pw.watch("password");

  const downloadCodes = () => {
    simulateDownload("hrms-recovery-codes.txt", `HRMS-NEW recovery codes for ${persona.email}\n\n${RECOVERY_CODES.join("\n")}\n\nEach code works once.`);
    mockAction("Recovery codes downloaded", { description: "Store them somewhere safe — each code works once." });
  };

  const sessionColumns: ColumnDef<ActiveSession, unknown>[] = [
    {
      accessorKey: "device",
      header: "Device",
      cell: ({ row }) => {
        const Icon = KIND_ICON[row.original.kind];
        return (
          <span className="flex items-center gap-2">
            <Icon className="size-4 text-muted-foreground" aria-hidden />
            <span className="flex flex-col">
              <span className="flex items-center gap-1.5 font-medium">
                {row.original.device}
                {row.original.current && <Badge variant="soft">This device</Badge>}
              </span>
              <span className="text-[10px] text-muted-foreground">{row.original.os}</span>
            </span>
          </span>
        );
      },
    },
    { accessorKey: "browser", header: "Browser / app" },
    { accessorKey: "ip", header: "IP address", cell: ({ row }) => <span className="font-mono text-xs">{row.original.ip}</span> },
    { accessorKey: "location", header: "Location" },
    {
      accessorKey: "lastActive",
      header: "Last active",
      cell: ({ row }) => <span className="tnum">{row.original.current ? "Active now" : fmtDateTime(row.original.lastActive)}</span>,
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.current ? (
          <MutedCell>—</MutedCell>
        ) : (
          <span className="flex justify-end">
            <Gated menuKey="my.security" action="E">
              <Button size="sm" variant="outline" onClick={() => setRevoke(row.original)}>
                <LogOut /> Revoke
              </Button>
            </Gated>
          </span>
        ),
    },
  ];

  const historyColumns: ColumnDef<LoginEvent, unknown>[] = [
    { accessorKey: "at", header: "When", cell: ({ row }) => <span className="tnum">{fmtDateTime(row.original.at)}</span> },
    {
      accessorKey: "outcome",
      header: "Outcome",
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.outcome === "success" ? "approved" : row.original.outcome === "failed" ? "rejected" : "pending"}
          label={row.original.outcome === "success" ? "Signed in" : row.original.outcome === "failed" ? "Failed" : "MFA challenge"}
        />
      ),
    },
    { accessorKey: "method", header: "Method" },
    { accessorKey: "device", header: "Device" },
    { accessorKey: "ip", header: "IP", cell: ({ row }) => <span className="font-mono text-xs">{row.original.ip}</span> },
    { accessorKey: "location", header: "Location" },
  ];

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Security & sessions" description="Loading…" />
        <TableSkeleton rows={4} />
      </PageBody>
    );
  }

  const failed = history.filter((h) => h.outcome === "failed");

  return (
    <PageBody>
      <PageHeader
        title="Security & sessions"
        description="Where you are signed in, how you sign in, and every attempt on your account."
        actions={
          <Gated menuKey="my.security" action="E">
            <Button size="sm" variant="outline" disabled={sessions.length <= 1} onClick={() => setRevoke("others")}>
              <LogOut /> Sign out other sessions
            </Button>
          </Gated>
        }
      />

      {failed.length > 0 && (
        <Alert tone="warning" icon={ShieldOff} title={`${failed.length} failed sign-in attempts from ${failed[0].location}`}>
          On {fmtDateTime(failed[0].at)}, with a wrong password. If this wasn&apos;t you, change your password below and revoke
          unfamiliar sessions.
        </Alert>
      )}

      <Section title="Active sessions" description={`${sessions.length} device${sessions.length === 1 ? "" : "s"} signed in`} bodyClassName="p-4">
        <DataTable
          columns={sessionColumns}
          data={sessions}
          getRowId={(r) => r.id}
          exportName="active-sessions"
          emptyIcon={Monitor}
          emptyTitle="Only this device"
          emptyDescription="Every other session has been revoked."
        />
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="Two-factor authentication"
          description="An authenticator app code on top of your password."
          actions={mfaOn ? <StatusBadge status="active" label="On" /> : <StatusBadge status="pending" label="Off" />}
        >
          {mfaOn ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-success-fg">
                  <ShieldCheck className="size-4.5" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-semibold">Authenticator app (TOTP)</p>
                  <p className="text-[11px] text-muted-foreground">Enrolled 14 Feb 2026 · last used today at {fmtTime("2026-09-16T09:41:00")}</p>
                </div>
              </div>
              <div className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold">Recovery codes</p>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setCodesVisible((v) => !v)}>
                      {codesVisible ? <EyeOff /> : <Eye />} {codesVisible ? "Hide" : "Reveal"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={downloadCodes}>
                      <Download /> Download
                    </Button>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5 font-mono text-xs sm:grid-cols-5">
                  {RECOVERY_CODES.map((c, i) => (
                    <span key={c} className={cn("rounded bg-subtle px-1.5 py-1 text-center", i === 2 && "line-through opacity-50")}>
                      {codesVisible ? c : "••••-••••"}
                    </span>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">9 of 10 unused. Each code works once.</p>
              </div>
              <Gated menuKey="my.security" action="E">
                <Button size="sm" variant="outline" className="w-fit" onClick={() => setDisableMfa(true)}>
                  <ShieldOff /> Turn off two-factor
                </Button>
              </Gated>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Alert tone="warning" title="Your account is protected by a password only">
                Your tenant requires two-factor for HR, payroll and admin roles. Turn it on now — it takes a minute.
              </Alert>
              <Gated menuKey="my.security" action="E">
                <Button size="sm" className="w-fit" onClick={() => { otp.reset({ code: "" }); setEnrolOpen(true); }}>
                  <ShieldCheck /> Set up authenticator app
                </Button>
              </Gated>
            </div>
          )}
        </Section>

        <Section title="Change password" description="Last changed 62 days ago. Policy: 12+ characters, mixed case, a number and a symbol.">
          <form
            className="flex flex-col gap-3"
            onSubmit={pw.handleSubmit(() => {
              pw.reset({ current: "", password: "", confirm: "" });
              mockAction("Password changed", { description: "Other sessions stay signed in. Revoke them above if you're unsure." });
            })}
          >
            <Field label="Current password" htmlFor="pw-current" required error={pw.formState.errors.current?.message}>
              <PasswordInput id="pw-current" autoComplete="current-password" aria-invalid={!!pw.formState.errors.current} {...pw.register("current")} />
            </Field>
            <Field label="New password" htmlFor="pw-new" required error={pw.formState.errors.password?.message}>
              <PasswordInput id="pw-new" autoComplete="new-password" aria-invalid={!!pw.formState.errors.password} {...pw.register("password")} />
            </Field>
            <PasswordStrength value={newPw} />
            <Field label="Confirm new password" htmlFor="pw-confirm" required error={pw.formState.errors.confirm?.message}>
              <PasswordInput id="pw-confirm" autoComplete="new-password" aria-invalid={!!pw.formState.errors.confirm} {...pw.register("confirm")} />
            </Field>
            <Gated menuKey="my.security" action="E">
              <Button type="submit" size="sm" className="w-fit">
                <KeyRound /> Update password
              </Button>
            </Gated>
          </form>
        </Section>
      </div>

      <Section title="Login history" description="Your last 20 sign-in attempts." bodyClassName="p-4">
        <DataTable
          columns={historyColumns}
          data={history}
          getRowId={(r) => r.id}
          searchKeys={["location", "ip", "device", "method"]}
          searchPlaceholder="Search history…"
          exportName="login-history"
          rowTone={(r) => (r.outcome === "failed" ? "danger" : undefined)}
          pageSize={10}
          emptyTitle="No sign-ins recorded"
        />
      </Section>

      {/* ------------------------------------------------------- dialogs */}
      <ConfirmDialog
        open={!!revoke}
        onOpenChange={(o) => !o && setRevoke(null)}
        title={revoke === "others" ? "Sign out every other session?" : `Revoke ${typeof revoke === "object" && revoke ? revoke.device : ""}?`}
        description={
          revoke === "others"
            ? `${sessions.length - 1} device(s) will be signed out immediately and must sign in again with MFA.`
            : "That device is signed out immediately. Any unsaved work there is lost."
        }
        confirmLabel={revoke === "others" ? "Sign out others" : "Revoke"}
        destructive
        onConfirm={() => {
          const before = sessions;
          if (revoke === "others") setSessions((s) => s.filter((x) => x.current));
          else if (revoke) setSessions((s) => s.filter((x) => x.id !== revoke.id));
          mockAction(revoke === "others" ? "Other sessions signed out" : "Session revoked", { tone: "warning", undo: () => setSessions(before) });
        }}
      />

      <ConfirmDialog
        open={disableMfa}
        onOpenChange={setDisableMfa}
        title="Turn off two-factor authentication?"
        description="Your account will be protected by your password alone. Your tenant owner is notified, and your role may require it again at next sign-in."
        confirmLabel="Turn off"
        destructive
        onConfirm={() => {
          setMfaOn(false);
          mockAction("Two-factor turned off", { tone: "warning", undo: () => setMfaOn(true) });
        }}
      />

      <Dialog open={enrolOpen} onOpenChange={enrolGuard.onOpenChange}>
        <DialogContent size="md">
          {enrolStep === "scan" ? (
            <form
              className="flex min-h-0 flex-col"
              onSubmit={otp.handleSubmit(() => {
                setEnrolStep("codes");
                setMfaOn(true);
                mockAction("Two-factor is on", { description: "Save your recovery codes before closing." });
              })}
            >
              <DialogHeader>
                <DialogTitle>Set up your authenticator app</DialogTitle>
                <DialogDescription>Scan with Microsoft Authenticator, Google Authenticator or 1Password, then enter the 6-digit code.</DialogDescription>
              </DialogHeader>
              <DialogBody className="flex flex-col gap-4 sm:flex-row">
                <QrPlaceholder seed={Number(persona.employeeId.replace(/\D/g, "")) + 7} />
                <div className="flex flex-1 flex-col gap-3">
                  <div>
                    <p className="text-xs font-medium">Can&apos;t scan? Enter this key</p>
                    <div className="mt-1 flex items-center gap-1">
                      <code className="rounded bg-subtle px-2 py-1 font-mono text-xs">JBSW Y3DP EHPK 3PXP</code>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Copy setup key"
                        onClick={() => {
                          void navigator.clipboard?.writeText("JBSWY3DPEHPK3PXP").catch(() => undefined);
                          mockAction("Setup key copied");
                        }}
                      >
                        <Copy />
                      </Button>
                    </div>
                  </div>
                  <Field label="6-digit code" htmlFor="otp-code" required error={otp.formState.errors.code?.message} hint="Any 6 digits work in this demo.">
                    <Input id="otp-code" inputMode="numeric" maxLength={6} autoComplete="one-time-code" placeholder="123456" className="tnum tracking-[0.3em]" aria-invalid={!!otp.formState.errors.code} {...otp.register("code")} />
                  </Field>
                </div>
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => enrolGuard.onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit">Verify &amp; turn on</Button>
              </DialogFooter>
            </form>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Save your recovery codes</DialogTitle>
                <DialogDescription>If you lose your phone, each code signs you in once. They will not be shown in full again.</DialogDescription>
              </DialogHeader>
              <DialogBody>
                <div className="grid grid-cols-2 gap-1.5 font-mono text-sm">
                  {RECOVERY_CODES.map((c) => (
                    <span key={c} className="rounded bg-subtle px-2 py-1 text-center">
                      {c}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">Generated {DEMO_TODAY} for {persona.email}.</p>
              </DialogBody>
              <DialogFooter>
                <Button variant="outline" onClick={downloadCodes}>
                  <Download /> Download
                </Button>
                <Button onClick={closeEnrol}>I&apos;ve saved them</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      {enrolGuard.guard}
    </PageBody>
  );
}
