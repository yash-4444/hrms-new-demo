"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { KeyRound, TimerReset } from "lucide-react";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Alert, Field } from "@/components/ui/primitives";
import { AuthShell } from "@/components/self-service/auth-shell";
import { PasswordInput, PasswordStrength, passwordField } from "@/components/self-service/password";

const schema = z
  .object({
    current: z.string().min(1, "Enter your current password"),
    password: passwordField,
    confirm: z.string().min(1, "Re-enter the new password"),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The two passwords do not match" })
  .refine((v) => v.password !== v.current, { path: ["password"], message: "Choose a password you haven't used before" });
type Values = z.infer<typeof schema>;

export default function ForcePasswordChangePage() {
  const router = useRouter();
  const { persona } = useApp();
  const [busy, setBusy] = React.useState(false);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { current: "", password: "", confirm: "" } });
  const errors = form.formState.errors;

  return (
    <AuthShell
      title="Update your password to continue"
      description={<>Signed in as <span className="font-medium text-foreground">{persona.email}</span>.</>}
      backLabel="Sign out"
    >
      <Alert tone="warning" icon={TimerReset} title="Your password expired" className="mb-4">
        Your organisation requires a new password every 90 days, and it can&apos;t match your last 5.
      </Alert>
      <form
        className="flex flex-col gap-3"
        onSubmit={form.handleSubmit(() => {
          setBusy(true);
          setTimeout(() => {
            mockAction("Password updated", { description: "Next change due in 90 days." });
            router.push("/dashboard");
          }, 450);
        })}
      >
        <Field label="Current password" htmlFor="fc-current" required error={errors.current?.message}>
          <PasswordInput id="fc-current" autoComplete="current-password" aria-invalid={!!errors.current} {...form.register("current")} />
        </Field>
        <Field label="New password" htmlFor="fc-new" required error={errors.password?.message}>
          <PasswordInput id="fc-new" autoComplete="new-password" aria-invalid={!!errors.password} {...form.register("password")} />
        </Field>
        <PasswordStrength value={form.watch("password")} />
        <Field label="Confirm new password" htmlFor="fc-confirm" required error={errors.confirm?.message}>
          <PasswordInput id="fc-confirm" autoComplete="new-password" aria-invalid={!!errors.confirm} {...form.register("confirm")} />
        </Field>
        <Button type="submit" loading={busy} className="mt-1 w-full">
          <KeyRound /> Update password
        </Button>
      </form>
    </AuthShell>
  );
}
