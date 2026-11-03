"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ShieldCheck, Smartphone } from "lucide-react";
import { isPlatformRole } from "@/lib/rbac";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/primitives";
import { AuthShell } from "@/components/self-service/auth-shell";
import { OtpInput } from "@/components/self-service/otp-input";

export default function MfaPage() {
  const router = useRouter();
  const { persona, role } = useApp();
  const [mode, setMode] = React.useState<"totp" | "recovery">("totp");
  const [code, setCode] = React.useState("");
  const [recovery, setRecovery] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [trust, setTrust] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  const verify = (value = code) => {
    if (mode === "totp" && !/^\d{6}$/.test(value)) {
      setError("Enter all 6 digits from your authenticator app.");
      return;
    }
    if (mode === "recovery" && !/^[A-Z0-9]{4}-?[A-Z0-9]{4}$/i.test(recovery.trim())) {
      setError("Recovery codes look like K7QF-2MXP.");
      return;
    }
    setError(null);
    setBusy(true);
    setTimeout(() => {
      mockAction(`Welcome back, ${persona.name.split(" ")[0]}`, {
        description: mode === "recovery" ? "That recovery code is now used up — 8 remain." : trust ? "This device is trusted for 30 days." : undefined,
      });
      router.push(isPlatformRole(role) ? "/console" : "/dashboard");
    }, 450);
  };

  return (
    <AuthShell
      title="Two-step verification"
      description={
        mode === "totp" ? (
          <>Enter the 6-digit code from your authenticator app for <span className="font-medium text-foreground">{persona.email}</span>.</>
        ) : (
          "Enter one of the recovery codes you saved when you set up two-step verification."
        )
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          verify();
        }}
      >
        {mode === "totp" ? (
          <div className="flex flex-col gap-1.5">
            <OtpInput
              value={code}
              onChange={(v) => {
                setCode(v);
                if (error) setError(null);
              }}
              invalid={!!error}
              disabled={busy}
              onComplete={(v) => verify(v)}
            />
            {error ? (
              <p role="alert" className="text-xs text-destructive-fg">
                {error}
              </p>
            ) : (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Smartphone className="size-3" aria-hidden /> Tip: paste the whole code into any box. Any 6 digits work in this demo.
              </p>
            )}
          </div>
        ) : (
          <Field label="Recovery code" htmlFor="mfa-rec" required error={error ?? undefined}>
            <Input
              id="mfa-rec"
              value={recovery}
              autoFocus
              onChange={(e) => {
                setRecovery(e.target.value.toUpperCase());
                if (error) setError(null);
              }}
              placeholder="XXXX-XXXX"
              className="font-mono tracking-widest"
              aria-invalid={!!error}
            />
          </Field>
        )}

        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} className="size-3.5 accent-[var(--primary)]" />
          Trust this device for 30 days
        </label>

        <Button type="submit" loading={busy} className="w-full">
          <ShieldCheck /> Verify
        </Button>

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "totp" ? "recovery" : "totp"));
            setError(null);
          }}
          className="inline-flex items-center justify-center gap-1 text-xs text-primary hover:underline"
        >
          <KeyRound className="size-3" aria-hidden />
          {mode === "totp" ? "Use a recovery code instead" : "Use my authenticator app"}
        </button>
      </form>
    </AuthShell>
  );
}
