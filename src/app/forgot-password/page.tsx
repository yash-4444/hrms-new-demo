"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, MailCheck } from "lucide-react";
import { mockAction } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input } from "@/components/ui/primitives";
import { AuthShell } from "@/components/self-service/auth-shell";

const schema = z.object({ email: z.string().trim().min(1, "Enter your work email").email("Enter a valid email address") });

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const form = useForm<{ email: string }>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  return (
    <AuthShell
      title={sentTo ? "Check your inbox" : "Reset your password"}
      description={sentTo ? undefined : "Enter the email you sign in with. We'll send a link that works once and expires in 30 minutes."}
    >
      {sentTo ? (
        <div className="flex flex-col gap-4">
          <Alert tone="success" icon={MailCheck}>
            If an account exists for <span className="font-semibold">{sentTo}</span>, a reset link is on its way. For your security we
            don&apos;t confirm whether an address is registered.
          </Alert>
          <p className="text-xs text-muted-foreground">
            Didn&apos;t get it? Check spam, or ask your HR team to confirm the email on your record.
          </p>
          <Button asChild className="w-full">
            <Link href="/reset-password">Open the reset link (demo)</Link>
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => mockAction("Link sent again", { description: "Any earlier link has been invalidated." })}
          >
            Resend link
          </Button>
        </div>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={form.handleSubmit((v) => {
            setBusy(true);
            setTimeout(() => {
              setBusy(false);
              setSentTo(v.email.trim());
            }, 450);
          })}
        >
          <Field label="Work email" htmlFor="fp-email" required error={form.formState.errors.email?.message}>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input id="fp-email" type="email" autoComplete="username" className="pl-8" aria-invalid={!!form.formState.errors.email} {...form.register("email")} />
            </div>
          </Field>
          <Button type="submit" loading={busy} className="mt-1 w-full">
            Send reset link
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Signing in with SSO? Reset your password with your identity provider instead.
          </p>
        </form>
      )}
    </AuthShell>
  );
}
