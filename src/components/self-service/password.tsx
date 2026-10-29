"use client";

import * as React from "react";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/primitives";

/* ============================================================================
   Password policy: one rule list drives the checklist, the strength meter and
   the Zod schema, so the three can never disagree.
   ========================================================================== */

export const PASSWORD_RULES: { id: string; label: string; test: (v: string) => boolean }[] = [
  { id: "len", label: "At least 12 characters", test: (v) => v.length >= 12 },
  { id: "upper", label: "An uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { id: "lower", label: "A lowercase letter", test: (v) => /[a-z]/.test(v) },
  { id: "digit", label: "A number", test: (v) => /\d/.test(v) },
  { id: "symbol", label: "A symbol (! @ # $ …)", test: (v) => /[^A-Za-z0-9]/.test(v) },
  { id: "common", label: "Not a common or company password", test: (v) => v.length > 0 && !/password|stellar|qwerty|123456|welcome/i.test(v) },
];

export const passwordField = z
  .string()
  .min(1, "Enter a new password")
  .refine((v) => PASSWORD_RULES.every((r) => r.test(v)), "The password does not meet every rule in the policy");

/** Schema for a "new + confirm" pair. */
export const newPasswordSchema = z
  .object({ password: passwordField, confirm: z.string().min(1, "Re-enter the password") })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The two passwords do not match" });

export function passwordScore(v: string) {
  if (!v) return 0;
  const passed = PASSWORD_RULES.filter((r) => r.test(v)).length;
  const bonus = v.length >= 16 ? 1 : 0;
  return Math.min(4, Math.floor(((passed + bonus) / (PASSWORD_RULES.length + 1)) * 4));
}

const STRENGTH = [
  { label: "Too weak", bar: "bg-destructive", text: "text-destructive-fg" },
  { label: "Weak", bar: "bg-destructive", text: "text-destructive-fg" },
  { label: "Fair", bar: "bg-warning", text: "text-warning-fg" },
  { label: "Good", bar: "bg-info", text: "text-info-fg" },
  { label: "Strong", bar: "bg-success", text: "text-success-fg" },
];

export function PasswordStrength({ value }: { value: string }) {
  const score = passwordScore(value);
  const s = STRENGTH[score];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden>
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className={cn("h-1.5 rounded-full", value && i <= Math.max(1, score) ? s.bar : "bg-muted")} />
          ))}
        </div>
        <span className={cn("w-16 text-right text-[11px] font-medium", value ? s.text : "text-muted-foreground")} aria-live="polite">
          {value ? s.label : "—"}
        </span>
      </div>
      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2" aria-label="Password policy">
        {PASSWORD_RULES.map((r) => {
          const ok = r.test(value);
          return (
            <li key={r.id} className={cn("flex items-center gap-1.5 text-[11px]", ok ? "text-success-fg" : "text-muted-foreground")}>
              {ok ? <Check className="size-3 shrink-0" aria-hidden /> : <X className="size-3 shrink-0" aria-hidden />}
              <span>{r.label}</span>
              <span className="sr-only">{ok ? "met" : "not met"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Password input with a show / hide toggle. */
export const PasswordInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    const [show, setShow] = React.useState(false);
    return (
      <div className="relative">
        <Input ref={ref} type={show ? "text" : "password"} className={cn("pr-9", className)} {...props} />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-1 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
