"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, CircleCheck, CircleX, Hourglass, MailCheck, MessageSquareMore, RotateCcw, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "@/lib/format";
import { COUNTRY_META, PLAN_META } from "@/mock/console-tenants";
import { AUTO_APPROVER, SIGNUP_TRIAL_DAYS, autoApprovable, type SignupRequest } from "@/mock/console-signups";
import { isSubdomainTaken } from "@/mock/signup-checks";
import { mockAction, useApp } from "@/components/app-state";
import { useConsole } from "@/components/console/console-state";
import { patchSignup, signupNowIso, useSignupStore } from "@/components/console/signup-store";
import { Facts } from "@/components/platform/kit";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/primitives";
import { AuthShell } from "@/components/self-service/auth-shell";

/* The applicant's view of their sign-up, live: an operator's decision in
   /console/signups — in this tab or another — reaches it through the shared
   sign-up store. A Free request that passes every check is provisioned the
   moment the email is verified when the console's auto-approve is on. */

type Phase = "pending" | "info" | "approved" | "rejected";

const PHASE: Record<Phase, { label: string; icon: React.ElementType; className: string }> = {
  pending: { label: "Pending review", icon: Hourglass, className: "border-warning/30 bg-warning-soft text-warning-fg" },
  info: { label: "More info requested", icon: MessageSquareMore, className: "border-info/30 bg-info-soft text-info-fg" },
  approved: { label: "Approved", icon: CircleCheck, className: "border-success/25 bg-success-soft text-success-fg" },
  rejected: { label: "Rejected", icon: CircleX, className: "border-destructive/25 bg-destructive-soft text-destructive-fg" },
};

const phaseOf = (s: SignupRequest): Phase => (s.status === "approved" ? "approved" : s.status === "rejected" ? "rejected" : s.infoRequest ? "info" : "pending");

const noSubscribe = () => () => {};

export default function SubmittedView() {
  const ref = useSearchParams().get("ref");
  const router = useRouter();
  const { setRole } = useApp();
  const { tenants, provisionSignups } = useConsole();
  const store = useSignupStore();
  /* The stored requests exist only in the browser — never judge "not found" from the server snapshot. */
  const hydrated = React.useSyncExternalStore(noSubscribe, () => true, () => false);
  const s = store.requests.find((r) => r.id === ref) ?? (ref ? undefined : store.requests[0]);

  if (!hydrated)
    return (
      <AuthShell title="Your sign-up">
        <p className="text-xs text-muted-foreground">Loading your request…</p>
      </AuthShell>
    );

  if (!s)
    return (
      <AuthShell title="We couldn't find that sign-up" description="It may have been cleared from this browser — demo sign-ups can be reset from the Platform Console.">
        <Button asChild>
          <Link href="/register">
            <UserPlus /> Register your company
          </Link>
        </Button>
      </AuthShell>
    );

  const phase = phaseOf(s);
  const P = PHASE[phase];
  const auto = s.decidedBy === AUTO_APPROVER;

  const verify = () => {
    const checks = { ...s.checks, emailVerified: true };
    patchSignup(s.id, { checks });
    if (store.autoApprove && autoApprovable({ ...s, checks }, isSubdomainTaken(s.subdomain, tenants))) {
      const [tenant] = provisionSignups([{ ...s, checks }], AUTO_APPROVER);
      patchSignup(s.id, { status: "approved", decidedAt: signupNowIso(), decidedBy: AUTO_APPROVER, tenantId: tenant.id });
      mockAction(`${s.company} is live`, { description: "Auto-approved — Free plan, every check passed." });
    } else mockAction("Email verified", { description: "Your request is now with our review team." });
  };

  const steps: { label: string; state: "done" | "current" | "failed" | "todo"; detail: React.ReactNode }[] = [
    { label: "Application received", state: "done", detail: fmtDateTime(s.submittedAt) },
    {
      label: "Email verified",
      state: s.checks.emailVerified ? "done" : phase === "rejected" ? "todo" : "current",
      detail: s.checks.emailVerified ? s.adminEmail : `We sent a verification link to ${s.adminEmail}.`,
    },
    {
      label: "Review by our team",
      state: phase === "approved" ? "done" : phase === "rejected" ? "failed" : s.checks.emailVerified ? "current" : "todo",
      detail:
        phase === "approved"
          ? auto
            ? "Auto-approved — Free plan, every check passed"
            : `Approved ${fmtDateTime(s.decidedAt ?? "")}`
          : phase === "rejected"
            ? `Not approved ${fmtDateTime(s.decidedAt ?? "")}`
            : "An operator reviews new organisations, usually within 1 business day.",
    },
    {
      label: "Workspace ready",
      state: phase === "approved" ? "done" : "todo",
      detail: <span className="font-mono">{s.subdomain}.hrms-new.app</span>,
    },
  ];

  return (
    <AuthShell
      wide
      title={`Thanks — we've received the sign-up for ${s.company}`}
      description={`We email ${s.adminEmail} at every step. You can close this page and come back; it keeps its place and updates on its own.`}
      pitchTitle="Every new organisation is verified."
      pitch="A quick check keeps impostors and duplicate workspaces off the platform — and means your data lands in the right country's data region from day one."
      points={["Email ownership confirmed", "Workspace address reserved for you", "Reviewed by a person, usually within 1 business day"]}
    >
      <Card className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Request reference</p>
            <p className="font-mono text-sm font-semibold">{s.id}</p>
          </div>
          <p role="status" aria-live="polite" className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium", P.className)}>
            <P.icon className="size-3.5" aria-hidden />
            <span className="sr-only">Status: </span>
            {P.label}
          </p>
        </div>

        {phase === "pending" && !s.checks.emailVerified && (
          <Alert tone="warning" icon={MailCheck} title="Verify your email to send this for review">
            <p>Open the link we sent to {s.adminEmail}. Nothing is reviewed until the address is confirmed.</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Button size="sm" onClick={verify}>
                <Check /> I&apos;ve verified my email
              </Button>
              <Button size="sm" variant="outline" onClick={() => mockAction("Verification link sent again", { description: `Check ${s.adminEmail}, including spam.`, tone: "info" })}>
                <RotateCcw /> Resend link
              </Button>
            </div>
          </Alert>
        )}
        {phase === "info" && s.infoRequest && (
          <Alert tone="info" icon={MessageSquareMore} title={`We need a little more information · ${fmtDateTime(s.infoRequest.at)}`}>
            <p>{s.infoRequest.message}</p>
            <p className="mt-1 text-muted-foreground">Reply to the email we sent to {s.adminEmail}; your answer goes straight to our review team.</p>
          </Alert>
        )}
        {phase === "rejected" && (
          <Alert tone="danger" icon={CircleX} title="Your sign-up wasn't approved">
            <p>{s.rejectReason}</p>
            <Link href="/register" className="mt-1 inline-block font-medium underline">
              Register again
            </Link>
          </Alert>
        )}
        {phase === "approved" && (
          <Alert tone="success" icon={CircleCheck} title={`${s.subdomain}.hrms-new.app is ready`}>
            <p>
              {s.plan === "free"
                ? "You're live on the Free plan — up to 25 employees, no card needed."
                : `Your ${SIGNUP_TRIAL_DAYS}-day ${PLAN_META[s.plan].label} trial has started; billing begins only when you add a payment method.`}
            </p>
            <Button
              size="sm"
              className="mt-2"
              onClick={() => {
                setRole("tenant_owner");
                router.push("/dashboard");
              }}
            >
              Go to your workspace <ArrowRight />
            </Button>
            <p className="mt-1.5 text-[11px] text-muted-foreground">This demo opens the sample workspace as its Tenant Owner.</p>
          </Alert>
        )}

        <ol className="flex flex-col gap-2.5" aria-label="Sign-up progress">
          {steps.map((st) => (
            <li key={st.label} className="flex items-start gap-2.5">
              <span
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                  st.state === "done" && "bg-success text-white",
                  st.state === "current" && "bg-warning text-white",
                  st.state === "failed" && "bg-destructive text-white",
                  st.state === "todo" && "border border-border bg-muted text-muted-foreground",
                )}
                aria-hidden
              >
                {st.state === "done" ? <Check className="size-3" /> : st.state === "failed" ? <CircleX className="size-3" /> : st.state === "current" ? <Hourglass className="size-3" /> : null}
              </span>
              <span className="min-w-0">
                <span className={cn("block text-xs font-medium", st.state === "todo" ? "text-muted-foreground" : "text-foreground")}>
                  {st.label}
                  <span className="sr-only">: {st.state === "done" ? "complete" : st.state === "current" ? "in progress" : st.state === "failed" ? "not approved" : "not started"}</span>
                </span>
                <span className="block text-[11px] text-muted-foreground">{st.detail}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="border-t border-border pt-3">
          <Facts
            items={[
              { label: "Company", value: s.company },
              { label: "Workspace", value: <span className="font-mono">{s.subdomain}.hrms-new.app</span> },
              { label: "Plan", value: PLAN_META[s.plan].label },
              { label: "Data region", value: COUNTRY_META[s.country].dataResidency },
            ]}
          />
        </div>
      </Card>
    </AuthShell>
  );
}
