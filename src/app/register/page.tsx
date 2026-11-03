"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Building2, Check, Globe2, Send, UserRound, WalletCards } from "lucide-react";
import { cn } from "@/lib/utils";
import { SIGNUP_REQUESTS, type CompanySize } from "@/mock/console-signups";
import { computeSignupChecks, subdomainAvailability } from "@/mock/signup-checks";
import { useConsole } from "@/components/console/console-state";
import { submitSignup, useSignupStore } from "@/components/console/signup-store";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/self-service/auth-shell";
import { REGISTER_DEFAULTS, registerSchema, type RegisterValues } from "@/components/self-service/register-schema";
import { AdminStep, CompanyStep, DefaultsStep, type SubdomainCheck } from "@/components/self-service/register-steps";
import { PlanStep } from "@/components/self-service/register-plan";

/* Self-serve sign-up. Submitting files a pending request with the platform —
   it lands in /console/signups for an operator — and opens the applicant's
   live status page. Nothing is provisioned here. */

const STEPS: { id: string; label: string; icon: React.ElementType; fields: (keyof RegisterValues)[] }[] = [
  { id: "company", label: "Company", icon: Building2, fields: ["company", "subdomain", "size"] },
  { id: "admin", label: "Admin", icon: UserRound, fields: ["adminName", "adminEmail", "password"] },
  { id: "defaults", label: "Defaults", icon: Globe2, fields: ["country", "fyStart", "timezone"] },
  { id: "plan", label: "Plan", icon: WalletCards, fields: ["plan", "terms"] },
];

export default function RegisterPage() {
  const router = useRouter();
  const { tenants } = useConsole();
  const store = useSignupStore();
  const [step, setStep] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const form = useForm<RegisterValues>({ resolver: zodResolver(registerSchema), mode: "onTouched", defaultValues: REGISTER_DEFAULTS });
  const subdomain = form.watch("subdomain");

  /* Live tenants, plus every request still holding a name — fixtures and this browser's own. */
  const holders = React.useMemo(() => [...store.requests, ...SIGNUP_REQUESTS], [store.requests]);
  const check = React.useMemo<SubdomainCheck>(() => {
    if (!registerSchema.shape.subdomain.safeParse(subdomain).success) return null;
    const res = subdomainAvailability(subdomain, tenants, holders);
    if (res.available) return res;
    const suggestion = ["hr", "team", "2", "3"].map((s) => `${subdomain}-${s}`).find((s) => subdomainAvailability(s, tenants, holders).available);
    return { ...res, suggestion };
  }, [subdomain, tenants, holders]);

  /* A taken name blocks the Company step rather than failing at the very end. */
  const claimSubdomain = () => {
    if (check?.available !== false) return true;
    form.setError("subdomain", { message: `${subdomain}.hrms-new.app ${check.reason} — choose another address` }, { shouldFocus: true });
    return false;
  };

  const next = async () => {
    const ok = await form.trigger(STEPS[step].fields);
    if (ok && (step !== 0 || claimSubdomain())) setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const submit = form.handleSubmit((values) => {
    if (!claimSubdomain()) {
      setStep(0);
      return;
    }
    setBusy(true);
    setTimeout(() => {
      /* Only the request's fields are passed on — the password stays in this form and dies with it. */
      const request = submitSignup({
        company: values.company,
        subdomain: values.subdomain,
        industry: "Not stated",
        plan: values.plan,
        country: values.country,
        size: values.size as CompanySize,
        adminName: values.adminName,
        adminEmail: values.adminEmail.toLowerCase(),
        checks: computeSignupChecks({ company: values.company, adminEmail: values.adminEmail }, tenants),
      });
      form.resetField("password");
      router.push(`/register/submitted?ref=${request.id}`);
    }, 600);
  });

  return (
    <AuthShell
      wide
      title="Create your organisation"
      description="Four steps, about two minutes. You can change every default later in Admin › Settings."
      pitchTitle="Run HR on autopilot, from day one."
      pitch="AI-assisted approvals, a policy-aware copilot and statutory payroll for India out of the box — set up in minutes, not months."
      points={["Free for up to 25 employees", "Indian payroll, PF, ESI, PT and TDS built in", "Import employees from a spreadsheet"]}
    >
      <ol className="mb-5 grid grid-cols-4 gap-2" aria-label="Sign-up progress">
        {STEPS.map((s, i) => (
          <li key={s.id} className="flex flex-col gap-1.5">
            <span className={cn("h-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")} aria-hidden />
            <span className={cn("flex items-center gap-1 text-[11px]", i === step ? "font-semibold text-foreground" : "text-muted-foreground")} aria-current={i === step ? "step" : undefined}>
              {i < step ? <Check className="size-3 text-success-fg" aria-hidden /> : <s.icon className="size-3" aria-hidden />}
              {s.label}
            </span>
          </li>
        ))}
      </ol>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (step < STEPS.length - 1) void next();
          else void submit();
        }}
      >
        {step === 0 && <CompanyStep form={form} check={check} />}
        {step === 1 && <AdminStep form={form} />}
        {step === 2 && <DefaultsStep form={form} />}
        {step === 3 && <PlanStep form={form} />}

        <div className="mt-2 flex items-center justify-between gap-2">
          {step > 0 ? (
            <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft /> Back
            </Button>
          ) : (
            <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground">
              Already have an account? Sign in
            </Link>
          )}
          {step < STEPS.length - 1 ? (
            <Button type="submit">
              Continue <ArrowRight />
            </Button>
          ) : (
            <Button type="submit" loading={busy}>
              <Send /> Submit sign-up
            </Button>
          )}
        </div>
        {step === STEPS.length - 1 && (
          <p className="text-[11px] text-muted-foreground">
            We verify every new organisation before provisioning it — you&apos;ll see the status of your request on the next screen.
          </p>
        )}
      </form>
    </AuthShell>
  );
}
