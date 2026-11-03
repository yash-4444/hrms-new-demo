"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Check, CircleCheck, CircleX, MessageSquareMore, ShieldAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateTime, inr, num } from "@/lib/format";
import { CONSOLE_TENANTS, COUNTRY_META, PLAN_META } from "@/mock/console-tenants";
import { SIGNUP_TRIAL_DAYS, signupBlockers, signupRisks, type SignupRequest } from "@/mock/console-signups";
import { PlanBadge } from "@/components/console/kit";
import { Facts } from "@/components/platform/kit";
import { Button } from "@/components/ui/button";
import { Alert, Checkbox, Label } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/overlays";

/* Sign-up Requests — the verification checklist, the review sheet and the
   approve dialog. The page owns the queue state and writes the tenant. */

/** Only fixture tenants have a pre-rendered detail page in the static export. */
export const TENANT_HAS_PAGE = new Set(CONSOLE_TENANTS.map((t) => t.id));

/** The five verification checks, pass / fail with text, never colour alone. */
export function SignupChecklist({ request: s, subdomainTaken }: { request: SignupRequest; subdomainTaken: boolean }) {
  const items: { label: string; pass: boolean; detail: string }[] = [
    { label: "Email verified", pass: s.checks.emailVerified, detail: s.checks.emailVerified ? s.adminEmail : "Verification link not opened yet" },
    { label: "Domain matches company", pass: s.checks.domainMatches, detail: `@${s.adminEmail.split("@")[1]}` },
    { label: "Subdomain available", pass: !subdomainTaken, detail: `${s.subdomain}.hrms-new.app${subdomainTaken ? " is taken" : ""}` },
    { label: "No duplicate company", pass: !s.checks.duplicateOf, detail: s.checks.duplicateOf ? `Similar to ${s.checks.duplicateOf}` : "No similar tenant found" },
    { label: "Not a disposable email", pass: !s.checks.disposableEmail, detail: s.checks.disposableEmail ? "Domain is on the blocklist" : "Domain is not on the blocklist" },
  ];
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((i) => (
        <li key={i.label} className="flex items-start gap-2 text-xs">
          {i.pass ? (
            <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-success-fg" aria-hidden />
          ) : (
            <CircleX className="mt-0.5 size-3.5 shrink-0 text-destructive-fg" aria-hidden />
          )}
          <span className="min-w-0">
            <span className="font-medium text-foreground">
              {i.label}
              <span className="sr-only">: {i.pass ? "passed" : "failed"}</span>
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">{i.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Compact table-cell summary: "All checks pass" or "2 flags". */
export function SignupCheckSummary({ request: s, subdomainTaken }: { request: SignupRequest; subdomainTaken: boolean }) {
  const blockers = signupBlockers(s, subdomainTaken).length;
  const risks = signupRisks(s).length;
  if (!blockers && !risks)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-success-fg">
        <Check className="size-3" aria-hidden /> All checks pass
      </span>
    );
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", blockers ? "text-destructive-fg" : "text-warning-fg")}>
      {blockers ? <X className="size-3" aria-hidden /> : <AlertTriangle className="size-3" aria-hidden />}
      {blockers ? `${blockers} blocking` : ""}
      {blockers && risks ? " · " : ""}
      {risks ? `${risks} risk flag${risks === 1 ? "" : "s"}` : ""}
    </span>
  );
}

export function SignupSheet({
  request: s,
  subdomainTaken,
  onOpenChange,
  onApprove,
  onReject,
  onRequestInfo,
}: {
  request: SignupRequest | null;
  subdomainTaken: boolean;
  onOpenChange: (v: boolean) => void;
  onApprove: () => void;
  onReject: () => void;
  onRequestInfo: () => void;
}) {
  return (
    <Sheet open={!!s} onOpenChange={onOpenChange}>
      <SheetContent width="sm:max-w-lg">
        {s && (
          <>
            <SheetHeader>
              <SheetTitle>{s.company}</SheetTitle>
              <SheetDescription>
                <span className="font-mono">{s.id}</span> · submitted {fmtDateTime(s.submittedAt)}
              </SheetDescription>
            </SheetHeader>
            <SheetBody className="flex flex-col gap-4 overflow-y-auto">
              <Facts
                items={[
                  { label: "Status", value: <StatusBadge status={s.status} /> },
                  { label: "Requested plan", value: <PlanBadge plan={s.plan} /> },
                  { label: "Workspace", value: <span className="font-mono">{s.subdomain}.hrms-new.app</span> },
                  { label: "Country", value: `${COUNTRY_META[s.country].label} — ${COUNTRY_META[s.country].dataResidency}` },
                  { label: "Admin", value: `${s.adminName} · ${s.adminEmail}` },
                  { label: "Company size", value: `${s.size} employees · ${s.industry}` },
                ]}
              />
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Verification</p>
                <SignupChecklist request={s} subdomainTaken={subdomainTaken} />
              </div>
              {s.infoRequest && (
                <Alert tone="info" icon={MessageSquareMore} title={`Information requested ${fmtDateTime(s.infoRequest.at)}`}>
                  {s.infoRequest.message}
                </Alert>
              )}
              {s.status === "rejected" && s.rejectReason && (
                <Alert tone="danger" icon={CircleX} title={`Rejected by ${s.decidedBy} · ${fmtDateTime(s.decidedAt ?? "")}`}>
                  {s.rejectReason}
                </Alert>
              )}
              {s.status === "approved" && (
                <Alert tone="success" icon={CircleCheck} title={`Approved by ${s.decidedBy} · ${fmtDateTime(s.decidedAt ?? "")}`}>
                  {s.tenantId && TENANT_HAS_PAGE.has(s.tenantId) ? (
                    <>
                      Provisioned as{" "}
                      <Link href={`/console/tenants/${s.tenantId}`} className="font-mono underline">
                        {s.tenantId}
                      </Link>
                      .
                    </>
                  ) : (
                    `Provisioned this session as ${s.tenantId ?? "a new tenant"} — the owner has been invited.`
                  )}
                </Alert>
              )}
            </SheetBody>
            {s.status === "pending" && (
              <SheetFooter>
                <Button variant="outline" size="sm" onClick={onRequestInfo}>
                  <MessageSquareMore /> Request info
                </Button>
                <Button variant="outline" size="sm" onClick={onReject}>
                  <X /> Reject
                </Button>
                <Button size="sm" disabled={signupBlockers(s, subdomainTaken).length > 0} onClick={onApprove}>
                  <Check /> Approve
                </Button>
              </SheetFooter>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Rendered only while open, so the acknowledgement starts unticked each time. */
export function ApproveSignupDialog({
  request: s,
  onOpenChange,
  onConfirm,
}: {
  request: SignupRequest;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
}) {
  const [ack, setAck] = React.useState(false);
  const risks = signupRisks(s);
  const plan = PLAN_META[s.plan];
  const id = React.useId();
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Approve {s.company}?</DialogTitle>
          <DialogDescription>
            Provisions <span className="font-mono">{s.subdomain}.hrms-new.app</span> in {COUNTRY_META[s.country].dataResidency} and emails{" "}
            {s.adminEmail} a link to finish setup. Data residency cannot change after provisioning.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <div className="rounded-md border border-border bg-subtle p-2.5 text-xs">
            <p className="font-medium text-foreground">
              {plan.label} · {plan.modules.length} of 14 modules · {num(plan.rateLimit)} requests / min
            </p>
            <p className="mt-0.5 text-muted-foreground">
              {s.plan === "free"
                ? "Goes live immediately — free for up to 25 employees."
                : `Starts a ${SIGNUP_TRIAL_DAYS}-day trial; billing at ${inr(plan.seatPrice, { decimals: false })} / seat / month begins only when the owner adds a payment method.`}
            </p>
          </div>
          {risks.length > 0 && (
            <>
              <Alert tone="warning" icon={ShieldAlert} title="Risk flags on this request">
                <ul className="list-disc pl-4">
                  {risks.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </Alert>
              <div className="flex items-start gap-2">
                <Checkbox id={`${id}-ack`} checked={ack} onCheckedChange={(v) => setAck(v === true)} />
                <Label htmlFor={`${id}-ack`} className="text-xs font-normal leading-snug">
                  I have reviewed these flags and confirmed the applicant is genuine. My name is recorded on the approval.
                </Label>
              </div>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={risks.length > 0 && !ack} onClick={onConfirm}>
            <Check /> Approve &amp; provision
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
