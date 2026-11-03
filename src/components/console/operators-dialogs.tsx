"use client";

import * as React from "react";
import { UserCog, UserPlus } from "lucide-react";
import { PLATFORM_ROLE_DESCRIPTION, PLATFORM_ROLE_LABEL, type Operator, type PlatformRole } from "@/mock/console-operators";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input, RadioGroup, RadioGroupItem, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";

/* Invite an operator, and change an operator's platform role. Both are
   Super Admin actions and both are written to the console audit log. */

const ROLES = Object.keys(PLATFORM_ROLE_LABEL) as PlatformRole[];
const CIDR = /^(\d{1,3}\.){3}\d{1,3}\/(\d|[12]\d|3[0-2])$/;

function RolePicker({ value, onChange, disabledRole }: { value: PlatformRole; onChange: (r: PlatformRole) => void; disabledRole?: PlatformRole }) {
  return (
    <RadioGroup value={value} onValueChange={(v) => onChange(v as PlatformRole)} className="flex flex-col gap-1.5" aria-label="Platform role">
      {ROLES.map((r) => (
        <label key={r} className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border px-3 py-2 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary-soft/50">
          <RadioGroupItem value={r} disabled={r === disabledRole} className="mt-0.5" />
          <span className="text-xs">
            <span className="font-medium">
              {PLATFORM_ROLE_LABEL[r]}
              {r === disabledRole && <span className="font-normal text-muted-foreground"> (current)</span>}
            </span>
            <span className="block text-muted-foreground">{PLATFORM_ROLE_DESCRIPTION[r]}</span>
          </span>
        </label>
      ))}
    </RadioGroup>
  );
}

export function InviteOperatorDialog({
  existingEmails,
  onOpenChange,
  onInvite,
}: {
  existingEmails: string[];
  onOpenChange: (v: boolean) => void;
  onInvite: (o: { name: string; email: string; role: PlatformRole; ipAllowList: string[] }) => void;
}) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<PlatformRole>("support_engineer");
  const [ips, setIps] = React.useState("103.21.58.0/24");
  const [touched, setTouched] = React.useState(false);

  const list = ips.split(/[\s,]+/).filter(Boolean);
  const errors = {
    name: name.trim().length < 3 ? "Enter the operator's full name." : undefined,
    email: !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
      ? "Enter a valid work email."
      : existingEmails.includes(email.trim().toLowerCase())
        ? "This person already has console access."
        : undefined,
    ips: list.length === 0 ? "At least one range — operators cannot sign in from anywhere." : list.some((x) => !CIDR.test(x)) ? "Use CIDR notation, e.g. 103.21.58.0/24." : undefined,
  };
  const valid = !errors.name && !errors.email && !errors.ips;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-4" aria-hidden /> Invite operator
          </DialogTitle>
          <DialogDescription>The invitation expires in 72 hours. The operator must enrol an MFA factor before their first sign-in completes.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name" htmlFor="op-name" required error={touched ? errors.name : undefined}>
              <Input id="op-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={touched && !!errors.name} />
            </Field>
            <Field label="Work email" htmlFor="op-email" required error={touched ? errors.email : undefined}>
              <Input id="op-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@hrms-new.app" aria-invalid={touched && !!errors.email} />
            </Field>
          </div>
          <Field label="Platform role" required>
            <RolePicker value={role} onChange={setRole} />
          </Field>
          <Field label="IP allow-list" htmlFor="op-ips" required error={touched ? errors.ips : undefined} hint="CIDR ranges, comma or space separated. The office egress is pre-filled.">
            <Textarea id="op-ips" value={ips} onChange={(e) => setIps(e.target.value)} rows={2} className="font-mono" aria-invalid={touched && !!errors.ips} />
          </Field>
          {role === "super_admin" && (
            <Alert tone="warning" title="Super Admin can delete tenants and manage operators">
              Keep the number of Super Admins small; every grant is reviewed in the quarterly access certification.
            </Alert>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={touched && !valid}
            onClick={() => {
              setTouched(true);
              if (valid) onInvite({ name: name.trim(), email: email.trim().toLowerCase(), role, ipAllowList: list });
            }}
          >
            <UserPlus /> Send invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ChangeRoleDialog({
  operator,
  onOpenChange,
  onConfirm,
}: {
  operator: Operator;
  onOpenChange: (v: boolean) => void;
  onConfirm: (role: PlatformRole, reason: string) => void;
}) {
  const [role, setRole] = React.useState<PlatformRole>(operator.role);
  const [reason, setReason] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const changed = role !== operator.role;
  const reasonOk = reason.trim().length >= 5;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="size-4" aria-hidden /> Change role — {operator.name}
          </DialogTitle>
          <DialogDescription>Takes effect on their next request; open support sessions are closed if the new role cannot hold them.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <RolePicker value={role} onChange={setRole} disabledRole={operator.role} />
          <Field label="Reason" htmlFor="role-reason" required error={touched && !reasonOk ? "Add a short reason (at least 5 characters)." : undefined}>
            <Textarea id="role-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Recorded in the console audit log." aria-invalid={touched && !reasonOk} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!changed || (touched && !reasonOk)}
            onClick={() => {
              setTouched(true);
              if (changed && reasonOk) onConfirm(role, reason.trim());
            }}
          >
            Change to {PLATFORM_ROLE_LABEL[role]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
