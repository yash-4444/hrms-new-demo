"use client";

import * as React from "react";
import { FileUp, Loader2, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/primitives";
import { AI_TONE, AiBadge } from "@/components/ai";

/** Resume picker with the "AI auto-fill" affordance once a file is attached. */
export function ResumeField({
  fileName,
  error,
  parsing,
  parsed,
  onChoose,
  onClear,
  onAutofill,
}: {
  fileName: string;
  error?: string;
  parsing: boolean;
  parsed: boolean;
  onChoose: (name: string) => void;
  onClear: () => void;
  onAutofill: () => void;
}) {
  const inputId = "apply-resume";

  return (
    <Field label="Resume" htmlFor={inputId} required error={error}>
      <div
        className={cn(
          "flex flex-col gap-3 rounded-md border border-dashed px-3 py-3 transition-colors sm:flex-row sm:items-center sm:justify-between",
          fileName ? "border-primary/40 bg-primary-soft/40" : "border-input bg-muted/40",
          error && "border-destructive",
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {fileName ? (
            <Paperclip className="size-4 shrink-0 text-primary" aria-hidden />
          ) : (
            <FileUp className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-foreground">{fileName || "PDF or DOCX, up to 5 MB"}</p>
            <p className="text-[11px] text-muted-foreground">
              {fileName
                ? "Attached — this demo keeps the file in your browser only."
                : "Attach it first and we can fill most of this form for you."}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {fileName && (
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove attached resume" onClick={onClear}>
              <X />
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <label htmlFor={inputId} className="cursor-pointer focus-within:ring-2 focus-within:ring-ring">
              {fileName ? "Replace" : "Choose file"}
              <input
                id={inputId}
                type="file"
                accept=".pdf,.doc,.docx"
                className="sr-only"
                aria-invalid={!!error}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const name = e.target.files?.[0]?.name ?? "";
                  if (name) onChoose(name);
                  e.target.value = "";
                }}
              />
            </label>
          </Button>
          {fileName && (
            <Button
              type="button"
              size="sm"
              className={cn(AI_TONE.solid, AI_TONE.ring)}
              disabled={parsing}
              onClick={onAutofill}
              aria-describedby="ai-autofill-note"
            >
              {parsing ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {parsing ? "Reading your resume…" : parsed ? "✨ Re-run AI auto-fill" : "✨ AI auto-fill"}
            </Button>
          )}
        </div>
      </div>
      {fileName && (
        <p id="ai-autofill-note" className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <AiBadge />
          Auto-fill reads your name, contact details, experience, skills and education. You review everything before
          submitting.
        </p>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {parsing ? "Reading your resume" : ""}
      </span>
    </Field>
  );
}
