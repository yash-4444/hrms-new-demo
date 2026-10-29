"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Six single-digit boxes: typing advances, Backspace steps back, arrow keys
 * move, and pasting a code anywhere fills every box at once.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  invalid,
  disabled,
  onComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  invalid?: boolean;
  disabled?: boolean;
  onComplete?: (v: string) => void;
}) {
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);
  /* Empty boxes are held as spaces so a gap never shifts the digits after it. */
  const digits = Array.from({ length }, (_, i) => (value[i] && value[i] !== " " ? value[i] : ""));
  const emit = (next: string[]) => {
    const joined = next.map((c) => c || " ").join("").trimEnd();
    onChange(joined);
    if (joined.length === length && /^\d+$/.test(joined) && onComplete) onComplete(joined);
  };

  const setAt = (i: number, d: string) => {
    const next = digits.slice();
    next[i] = d;
    emit(next);
  };

  const fill = (raw: string, from = 0) => {
    const clean = raw.replace(/\D/g, "").slice(0, length - from);
    if (!clean) return;
    const next = digits.slice();
    clean.split("").forEach((c, k) => (next[from + k] = c));
    emit(next);
    refs.current[Math.min(length - 1, from + clean.length)]?.focus();
  };

  return (
    <div className="flex gap-2" role="group" aria-label={`${length}-digit verification code`}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          aria-label={`Digit ${i + 1}`}
          aria-invalid={invalid}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            if (v.length > 1) return fill(v, i);
            setAt(i, v);
            if (v && i < length - 1) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => {
            e.preventDefault();
            fill(e.clipboardData.getData("text"), 0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !d && i > 0) {
              e.preventDefault();
              setAt(i - 1, "");
              refs.current[i - 1]?.focus();
            } else if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            else if (e.key === "ArrowRight" && i < length - 1) refs.current[i + 1]?.focus();
          }}
          onFocus={(e) => e.target.select()}
          className={cn(
            "tnum h-11 w-10 rounded-md border bg-card text-center text-lg font-semibold shadow-xs transition-colors",
            "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25",
            "disabled:opacity-50",
            invalid ? "border-destructive" : "border-input",
          )}
        />
      ))}
    </div>
  );
}
