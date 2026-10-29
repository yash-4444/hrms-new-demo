"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MailOpen } from "lucide-react";
import { TENANT } from "@/mock/org";
import { mockAction } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Avatar, Checkbox, Field, Input } from "@/components/ui/primitives";
import { AuthShell } from "@/components/self-service/auth-shell";
import { PasswordInput, PasswordStrength, passwordField } from "@/components/self-service/password";

const schema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name"),
    password: passwordField,
    confirm: z.string().min(1, "Re-enter the password"),
    terms: z.boolean().refine((v) => v, "Accept the acceptable-use and privacy policies to continue"),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The two passwords do not match" });
type Values = z.infer<typeof schema>;

const INVITE = {
  email: "meera.joshi@stellartech.in",
  inviter: "Priya Menon",
  inviterRole: "HR Admin",
  role: "Employee",
  designation: "Product Designer",
  expires: "23 Sep 2026",
};

export default function AcceptInvitePage() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "Meera Joshi", password: "", confirm: "", terms: false },
  });
  const pw = form.watch("password");
  const errors = form.formState.errors;

  return (
    <AuthShell
      title={`Join ${TENANT.name}`}
      description="Set a password to activate your account."
      backHref={null}
      pitchTitle="Welcome aboard."
      pitch="Your HR team has set up your profile. Once you're in, your onboarding checklist, documents and first-week schedule are waiting."
      points={["Your onboarding checklist in one place", "Upload documents from your phone", "Payslips, leave and tax — self-service"]}
    >
      <div className="mb-4 flex items-center gap-3 rounded-md border border-border bg-subtle p-3">
        <Avatar name={INVITE.inviter} size={32} />
        <p className="text-xs">
          <span className="font-semibold">{INVITE.inviter}</span> ({INVITE.inviterRole}) invited{" "}
          <span className="font-semibold">{INVITE.email}</span> as {INVITE.designation}. The invitation expires {INVITE.expires}.
        </p>
      </div>
      <form
        className="flex flex-col gap-3"
        onSubmit={form.handleSubmit((v) => {
          setBusy(true);
          setTimeout(() => {
            mockAction(`Welcome, ${v.name.split(" ")[0]}`, { description: "Your account is active. Set up two-step verification next." });
            router.push("/mfa");
          }, 450);
        })}
      >
        <Field label="Work email" htmlFor="ai-email">
          <Input id="ai-email" value={INVITE.email} readOnly disabled />
        </Field>
        <Field label="Full name" htmlFor="ai-name" required error={errors.name?.message}>
          <Input id="ai-name" autoComplete="name" aria-invalid={!!errors.name} {...form.register("name")} />
        </Field>
        <Field label="Password" htmlFor="ai-pw" required error={errors.password?.message}>
          <PasswordInput id="ai-pw" autoComplete="new-password" aria-invalid={!!errors.password} {...form.register("password")} />
        </Field>
        <PasswordStrength value={pw} />
        <Field label="Confirm password" htmlFor="ai-confirm" required error={errors.confirm?.message}>
          <PasswordInput id="ai-confirm" autoComplete="new-password" aria-invalid={!!errors.confirm} {...form.register("confirm")} />
        </Field>
        <div className="flex flex-col gap-1">
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <Checkbox
              className="mt-0.5"
              checked={form.watch("terms")}
              onCheckedChange={(v) => form.setValue("terms", v === true, { shouldValidate: true, shouldDirty: true })}
              aria-invalid={!!errors.terms}
            />
            I accept the acceptable-use policy and the employee privacy notice (DPDP Act, 2023).
          </label>
          {errors.terms && (
            <p role="alert" className="text-xs text-destructive-fg">
              {errors.terms.message}
            </p>
          )}
        </div>
        <Button type="submit" loading={busy} className="mt-1 w-full">
          <MailOpen /> Accept invitation
        </Button>
      </form>
    </AuthShell>
  );
}
