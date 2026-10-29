"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Landmark, Pencil, ShieldCheck } from "lucide-react";
import { PREJOIN_CANDIDATE } from "@/mock/lifecycle-public";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/primitives";
import { KV } from "@/components/lifecycle/kit";
import { StepFooter } from "./stepper";
import { IFSC_RE, bankFromIfsc, bankSchema, maskAccount, type BankInput, type BankValues } from "./types";

/** Once saved, the account shows masked; editing re-opens the full form. */
export function StepBank({
  initial,
  onSave,
  onBack,
}: {
  initial?: BankValues;
  onSave: (v: BankValues) => void;
  onBack: () => void;
}) {
  const [editing, setEditing] = React.useState(!initial);

  if (initial && !editing) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 rounded-md border border-border p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-xs font-medium text-success-fg">
              <ShieldCheck className="size-4" aria-hidden />
              Saved — your full account number is never shown again on screen
            </p>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil />
              Change
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <KV label="Account holder">{initial.holder}</KV>
            <KV label="Account number">
              <span className="tnum font-mono">{maskAccount(initial.accountNumber)}</span>
            </KV>
            <KV label="IFSC">
              <span className="tnum font-mono">{initial.ifsc}</span>
              {bankFromIfsc(initial.ifsc) && <span className="block text-xs text-muted-foreground">{bankFromIfsc(initial.ifsc)}</span>}
            </KV>
          </div>
        </div>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            onSave(initial);
          }}
        >
          <StepFooter onBack={onBack} />
        </form>
      </div>
    );
  }

  return <BankForm initial={initial} onSave={onSave} onBack={onBack} />;
}

function BankForm({
  initial,
  onSave,
  onBack,
}: {
  initial?: BankValues;
  onSave: (v: BankValues) => void;
  onBack: () => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<BankInput, unknown, BankValues>({
    resolver: zodResolver(bankSchema),
    defaultValues: initial ?? { holder: PREJOIN_CANDIDATE.name, accountNumber: "", confirmAccount: "", ifsc: "" },
  });
  const ifsc = (useWatch({ control, name: "ifsc" }) ?? "").trim().toUpperCase();
  const bank = IFSC_RE.test(ifsc) ? bankFromIfsc(ifsc) : undefined;

  return (
    <form onSubmit={handleSubmit(onSave)} noValidate className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        Your salary is credited to this account from your first pay run. It must be a savings account in your own name.
      </p>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field
          label="Account holder name"
          htmlFor="pj-holder"
          required
          error={errors.holder?.message}
          hint="As printed on your passbook or cheque."
          className="sm:col-span-2"
        >
          <Input id="pj-holder" autoComplete="name" aria-invalid={!!errors.holder} {...register("holder")} />
        </Field>
        <Field label="Account number" htmlFor="pj-acc" required error={errors.accountNumber?.message}>
          <Input
            id="pj-acc"
            inputMode="numeric"
            autoComplete="off"
            className="tnum font-mono"
            aria-invalid={!!errors.accountNumber}
            {...register("accountNumber")}
          />
        </Field>
        <Field label="Confirm account number" htmlFor="pj-acc2" required error={errors.confirmAccount?.message}>
          <Input
            id="pj-acc2"
            inputMode="numeric"
            autoComplete="off"
            className="tnum font-mono"
            aria-invalid={!!errors.confirmAccount}
            onPaste={(e) => e.preventDefault()}
            {...register("confirmAccount")}
          />
        </Field>
        <Field
          label="IFSC"
          htmlFor="pj-ifsc"
          required
          error={errors.ifsc?.message}
          hint={
            bank ? (
              <span className="inline-flex items-center gap-1 text-success-fg">
                <Landmark className="size-3" aria-hidden />
                {bank} — matched from the IFSC
              </span>
            ) : (
              "Printed on your cheque leaf, e.g. HDFC0001234."
            )
          }
        >
          <Input
            id="pj-ifsc"
            maxLength={11}
            autoComplete="off"
            className="tnum font-mono uppercase"
            aria-invalid={!!errors.ifsc}
            {...register("ifsc")}
          />
        </Field>
      </div>
      <StepFooter onBack={onBack} />
    </form>
  );
}
