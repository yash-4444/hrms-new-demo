"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, KeyRound, Lock, Mail, MessageSquareText, ScanText, ShieldCheck, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { ALL_PERSONAS, PERSONA_GROUPS, isPlatformRole, personaById, type RoleId } from "@/lib/rbac";
import { BRANCHES, DEPARTMENTS, TENANT } from "@/mock/org";
import { EMPLOYEES } from "@/mock/employees";
import { useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AI_TONE, AiBadge } from "@/components/ai/ai-ui";
import { Avatar, Field, Input, Separator } from "@/components/ui/primitives";

/* The pitch figures are counted from the fixtures, never typed in. */
const STAFFED_BRANCHES = new Set(EMPLOYEES.map((e) => e.branchId));
const COUNTRY_COUNT = new Set(
  BRANCHES.filter((b) => STAFFED_BRANCHES.has(b.id) && b.country).map((b) => b.country),
).size;
const PITCH_STATS: [string, string][] = [
  [String(EMPLOYEES.length), "employees"],
  [String(COUNTRY_COUNT), COUNTRY_COUNT === 1 ? "country" : "countries"],
  [String(DEPARTMENTS.length), "departments"],
];

/* What the assistant does in the product — every item is a working screen in this build. */
const AI_HIGHLIGHTS = [
  { icon: MessageSquareText, title: "HR Copilot", body: "Ask about leave, pay or your team in plain words; it proposes, you confirm." },
  { icon: BookOpen, title: "Policy answers with sources", body: "Replies quote the policy section and page they came from." },
  { icon: TrendingDown, title: "Attrition insights", body: "Explainable risk drivers for HR and managers — never an automated decision." },
  { icon: ScanText, title: "Receipt reading", body: "Merchant, date and amount filled from a receipt photo, highlighted for review." },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const { setRole } = useApp();
  const [email, setEmail] = React.useState("priya.menon@stellartech.in");
  const [password, setPassword] = React.useState("demo1234");
  const [busy, setBusy] = React.useState(false);

  /* A typed sign-in goes through two-step verification, as it would for real;
     the persona shortcuts below skip straight to the dashboard mid-demo. */
  const signIn = (roleId?: RoleId) => {
    setBusy(true);
    const match = roleId ?? ALL_PERSONAS.find((p) => p.email === email.trim().toLowerCase())?.id ?? "hr_admin";
    setTimeout(() => {
      setRole(match);
      /* The vendor operator has no tenant home: the persona shortcut lands in the console. */
      router.push(!roleId ? "/mfa" : isPlatformRole(roleId) ? "/console" : "/dashboard");
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
            {PITCH_STATS.map(([v, l]) => (
              <div key={l}>
                <dt className="tnum text-lg font-semibold">{v}</dt>
                <dd className="text-xs text-muted-foreground">{l}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-8 border-t border-border pt-5">
            <div className="flex items-center gap-2">
              <AiBadge label="AI-assisted" />
              <p className="text-xs text-muted-foreground">Built in, permission-aware, human in the loop.</p>
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
              {AI_HIGHLIGHTS.map((h) => (
                <li key={h.title} className="flex items-start gap-2">
                  <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border ${AI_TONE.chip}`} aria-hidden>
                    <h.icon className="size-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-medium">{h.title}</span>
                    <span className="block text-[11px] leading-snug text-muted-foreground">{h.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
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
              <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                Forgot password?
              </Link>
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

          <p className="mt-4 text-center text-xs text-muted-foreground">
            New to HRMS-NEW?{" "}
            <Link href="/register" className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline">
              Register your company <ArrowRight className="size-3" aria-hidden />
            </Link>
          </p>

          <Card className="mt-5 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold">
              <KeyRound className="size-3.5 text-muted-foreground" aria-hidden />
              Demo personas
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Pick one to jump straight in. You can switch at any time from the top bar.
            </p>
            {/* Tenant staff first; the vendor's operator sits apart — it signs in outside every tenant. */}
            {[PERSONA_GROUPS.filter((g) => !g.roles.some(isPlatformRole)), PERSONA_GROUPS.filter((g) => g.roles.some(isPlatformRole))].map((groups, gi) => (
              <React.Fragment key={gi}>
                {gi > 0 && (
                  <p className="mt-2 border-t border-border px-1.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {groups.map((g) => g.label).join(" · ")}
                  </p>
                )}
                <ul className="mt-2 grid grid-cols-1 gap-0.5 sm:grid-cols-2">
                  {groups.flatMap((g) => g.roles).map(personaById).map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setEmail(p.email);
                          signIn(p.id);
                        }}
                        title={p.description}
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
              </React.Fragment>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
