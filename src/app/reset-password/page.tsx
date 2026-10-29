"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { KeyRound } from "lucide-react";
import { mockAction } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/primitives";
import { AuthShell } from "@/components/self-service/auth-shell";
import { PasswordInput, PasswordStrength, newPasswordSchema } from "@/components/self-service/password";

type Values = z.infer<typeof newPasswordSchema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const form = useForm<Values>({ resolver: zodResolver(newPasswordSchema), defaultValues: { password: "", confirm: "" } });
  const pw = form.watch("password");

  return (
    <AuthShell title="Choose a new password" description="The link is valid for 30 minutes. Every other session is signed out once you save.">
      <form
        className="flex flex-col gap-3"
        onSubmit={form.handleSubmit(() => {
          setBusy(true);
          setTimeout(() => {
            mockAction("Password reset", { description: "Sign in with your new password." });
            router.push("/login");
          }, 450);
        })}
      >
        <Field label="New password" htmlFor="rp-new" required error={form.formState.errors.password?.message}>
          <PasswordInput id="rp-new" autoComplete="new-password" aria-invalid={!!form.formState.errors.password} {...form.register("password")} />
        </Field>
        <PasswordStrength value={pw} />
        <Field label="Confirm new password" htmlFor="rp-confirm" required error={form.formState.errors.confirm?.message}>
          <PasswordInput id="rp-confirm" autoComplete="new-password" aria-invalid={!!form.formState.errors.confirm} {...form.register("confirm")} />
        </Field>
        <Button type="submit" loading={busy} className="mt-1 w-full">
          <KeyRound /> Save new password
        </Button>
      </form>
    </AuthShell>
  );
}
