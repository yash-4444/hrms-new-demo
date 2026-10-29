"use client";

import * as React from "react";
import { FileText, TriangleAlert } from "lucide-react";
import { TENANT } from "@/mock/org";
import { PREJOIN_CANDIDATE, PREJOIN_POLICIES } from "@/mock/lifecycle-public";
import { Alert, Checkbox, Label } from "@/components/ui/primitives";
import { StepFooter } from "./stepper";
import type { DeclValues } from "./types";

export function StepDeclarations({
  initial,
  onSave,
  onBack,
}: {
  initial?: DeclValues;
  onSave: (v: DeclValues) => void;
  onBack: () => void;
}) {
  const [policies, setPolicies] = React.useState<Record<string, boolean>>(initial?.policies ?? {});
  const [declaration, setDeclaration] = React.useState(initial?.declaration ?? false);
  const [tried, setTried] = React.useState(false);

  const pending = PREJOIN_POLICIES.filter((p) => !policies[p.key]);
  const complete = pending.length === 0 && declaration;

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (complete) onSave({ policies, declaration });
      }}
    >
      {tried && !complete && (
        <Alert tone="danger" icon={TriangleAlert} title="A few items still need your acknowledgement">
          {pending.length > 0 && `Policies not yet accepted: ${pending.map((p) => p.label).join(", ")}. `}
          {!declaration && "Tick the declaration at the bottom."}
        </Alert>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Company policies
        </legend>
        {PREJOIN_POLICIES.map((p) => {
          const id = `pj-pol-${p.key}`;
          const flagged = tried && !policies[p.key];
          return (
            <div
              key={p.key}
              className={
                flagged
                  ? "flex items-start gap-3 rounded-md border border-destructive/50 p-3"
                  : "flex items-start gap-3 rounded-md border border-border p-3"
              }
            >
              <Checkbox
                id={id}
                className="mt-0.5"
                checked={!!policies[p.key]}
                aria-invalid={flagged}
                onCheckedChange={(v) => setPolicies((s) => ({ ...s, [p.key]: v === true }))}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Label htmlFor={id} className="cursor-pointer">
                  I have read and accept the {p.label}
                </Label>
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <FileText className="size-3" aria-hidden />
                  <span className="tnum">{p.pages} pages</span> · sent to your email with the offer letter
                </p>
              </div>
            </div>
          );
        })}
      </fieldset>

      <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-3">
        <Checkbox
          id="pj-declaration"
          className="mt-0.5"
          checked={declaration}
          aria-invalid={tried && !declaration}
          onCheckedChange={(v) => setDeclaration(v === true)}
        />
        <Label htmlFor="pj-declaration" className="cursor-pointer font-normal leading-relaxed text-foreground">
          I, {PREJOIN_CANDIDATE.name}, declare that the information and documents I have given {TENANT.legalName} are true and
          complete. I understand that a false statement may lead to withdrawal of the offer or termination of employment.
        </Label>
      </div>

      <StepFooter onBack={onBack} />
    </form>
  );
}
