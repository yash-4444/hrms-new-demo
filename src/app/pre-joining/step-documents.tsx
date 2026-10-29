"use client";

import * as React from "react";
import { FileCheck2, FileUp, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PREJOIN_CANDIDATE, PREJOIN_DOCS } from "@/mock/lifecycle-public";
import { Button } from "@/components/ui/button";
import { Alert, Badge, Progress } from "@/components/ui/primitives";
import { AI_TONE } from "@/components/ai";
import { mockAction } from "@/components/app-state";
import { StepFooter } from "./stepper";
import type { DocsValues } from "./types";

const REQUIRED = PREJOIN_DOCS.filter((d) => d.required);

export function StepDocuments({
  initial,
  onSave,
  onBack,
}: {
  initial?: DocsValues;
  onSave: (v: DocsValues) => void;
  onBack: () => void;
}) {
  const [files, setFiles] = React.useState<DocsValues>(initial ?? {});
  const [tried, setTried] = React.useState(false);
  const missing = REQUIRED.filter((d) => !files[d.key]);
  const requiredDone = REQUIRED.length - missing.length;

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (missing.length === 0) onSave(files);
      }}
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Required documents</span>
          <span className="tnum font-medium text-foreground">
            {requiredDone} of {REQUIRED.length} uploaded
          </span>
        </div>
        <Progress
          value={(requiredDone / REQUIRED.length) * 100}
          tone={missing.length === 0 ? "success" : "accent"}
          aria-label="Required documents uploaded"
        />
      </div>

      {tried && missing.length > 0 && (
        <Alert tone="danger" icon={TriangleAlert} title={`Upload ${missing.length} more required document${missing.length === 1 ? "" : "s"} to continue`}>
          Still missing: {missing.map((d) => d.label).join(", ")}.
        </Alert>
      )}

      <ul className="flex flex-col gap-2">
        {PREJOIN_DOCS.map((d) => {
          const file = files[d.key];
          const inputId = `pj-doc-${d.key}`;
          const flagged = tried && d.required && !file;
          return (
            <li
              key={d.key}
              className={cn(
                "flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between",
                flagged ? "border-destructive/50" : "border-border",
              )}
            >
              <div className="flex min-w-0 items-start gap-2.5">
                {file ? (
                  <FileCheck2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                ) : (
                  <FileUp className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-foreground">
                    {d.label}
                    {file ? (
                      <Badge className="border-success/25 bg-success-soft text-success-fg">Uploaded</Badge>
                    ) : d.required ? (
                      <Badge variant="outline">Required</Badge>
                    ) : (
                      <Badge variant="muted">Optional</Badge>
                    )}
                  </p>
                  {file ? (
                    <>
                      <p className="truncate text-[11px] text-muted-foreground">{file}</p>
                      <p className={cn("text-[11px]", AI_TONE.text)}>
                        ✨ AI suggestion: looks legible and names {PREJOIN_CANDIDATE.name} — HR still verifies it before Day 1.
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">PDF, JPG or PNG, up to 5 MB</p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {file && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${d.label}`}
                    onClick={() => {
                      setFiles((f) => {
                        const next = { ...f };
                        delete next[d.key];
                        return next;
                      });
                    }}
                  >
                    <X />
                  </Button>
                )}
                <Button variant="outline" size="sm" asChild>
                  <label htmlFor={inputId} className="cursor-pointer focus-within:ring-2 focus-within:ring-ring">
                    {file ? "Replace" : "Upload"}
                    <input
                  id={inputId}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="sr-only"
                  aria-label={`Upload ${d.label}`}
                  onChange={(e) => {
                    const name = e.target.files?.[0]?.name;
                    e.target.value = "";
                    if (!name) return;
                    setFiles((f) => ({ ...f, [d.key]: name }));
                    mockAction(`${d.label} uploaded`, { description: name });
                  }}
                    />
                  </label>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <StepFooter onBack={onBack} />
    </form>
  );
}
