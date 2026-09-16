"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Lock, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PERSONAS, type RoleId } from "@/lib/rbac";
import { TENANT } from "@/mock/org";
import { useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, Field, Input, Separator } from "@/components/ui/primitives";

export default function LoginPage() {
  const router = useRouter();
  const { setRole } = useApp();
  const [email, setEmail] = React.useState("priya.menon@stellartech.in");
  const [password, setPassword] = React.useState("demo1234");
  const [busy, setBusy] = React.useState(false);

  const signIn = (roleId?: RoleId) => {
    setBusy(true);
    const match = roleId ?? PERSONAS.find((p) => p.email === email.trim().toLowerCase())?.id ?? "hr_admin";
    setTimeout(() => {
      setRole(match);
      router.push("/dashboard");
    }, 450);
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* left: the pitch */}
      <div className="hidden flex-col justify-between border-r border-border bg-card p-10 lg:flex">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            H
          </span>
          <span className="text-sm font-semibold tracking-tight">HRMS-NEW</span>
        </div>
        <div className="max-w-md">
          <h1 className="text-lg font-semibold tracking-tight">
            The whole employee lifecycle, in one place.
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Attendance and leave, payroll with a full statutory breakdown, hiring, performance and
            the workplace desk — under one permission model, one design system and one audit trail.
          </p>
          <dl className="mt-6 grid grid-cols-3 gap-4">
            {[
              ["340", "employees"],
              ["3", "countries"],
              ["9", "departments"],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="tnum text-lg font-semibold">{v}</dt>
                <dd className="text-xs text-muted-foreground">{l}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="text-[10px] text-muted-foreground">
          {TENANT.legalName} · CIN {TENANT.cin}
        </p>
      </div>

      {/* right: the form */}
      <div className="flex items-center justify-center p-5">
        <div className="w-full max-w-sm">
          <div className="mb-5 lg:hidden">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              H
            </span>
          </div>
          <h2 className="text-lg font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Use any credentials — this build has no backend.
          </p>

          <form
            className="mt-5 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              signIn();
            }}
          >
            <Field label="Work email" htmlFor="email" required>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-8"
                  autoComplete="username"
                />
              </div>
            </Field>

            <Field label="Password" htmlFor="password" required>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-8"
                  autoComplete="current-password"
                />
              </div>
            </Field>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input type="checkbox" defaultChecked className="size-3.5 accent-[var(--primary)]" />
                Keep me signed in
              </label>
              <button
                type="button"
                onClick={() => toast.info("Password reset link sent", { description: "Demo only — no email leaves this build." })}
                className="text-xs text-primary hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <Button type="submit" loading={busy} className="mt-1 w-full">
              Sign in
            </Button>

            <div className="flex items-center gap-2 py-0.5">
              <Separator className="flex-1" />
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">or</span>
              <Separator className="flex-1" />
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                toast.info("Redirecting to Okta…", { description: "SSO is stubbed in the demo." });
                signIn();
              }}
            >
              <ShieldCheck /> Sign in with SSO
            </Button>
          </form>

          <Card className="mt-5 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold">
              <KeyRound className="size-3.5 text-muted-foreground" aria-hidden />
              Demo personas
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Pick one to jump straight in. You can switch at any time from the top bar.
            </p>
            <ul className="mt-2 flex flex-col gap-0.5">
              {PERSONAS.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(p.email);
                      signIn(p.id);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Avatar name={p.name} size={22} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{p.name}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">{p.role}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
