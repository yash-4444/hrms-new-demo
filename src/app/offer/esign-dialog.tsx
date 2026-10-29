"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PenLine } from "lucide-react";
import { TENANT } from "@/mock/org";
import { useDirtyGuard } from "@/components/lifecycle/kit";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Label } from "@/components/ui/primitives";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/overlays";
import { SignaturePad } from "./signature-pad";

type Values = { typedName: string; useTyped: boolean; consent: boolean };

const makeSchema = (expected: string) =>
  z.object({
    typedName: z
      .string()
      .trim()
      .min(1, "Type your full name")
      .refine((v) => v.toLowerCase() === expected.toLowerCase(), {
        message: `Type your name exactly as it appears on the offer — ${expected}`,
      }),
    useTyped: z.boolean(),
    consent: z.boolean().refine((v) => v, { message: "Tick to confirm you are signing electronically" }),
  });

export function EsignDialog({
  open,
  onOpenChange,
  candidateName,
  role,
  onSigned,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  candidateName: string;
  role: string;
  onSigned: (signedBy: string, method: "drawn" | "typed") => void;
}) {
  const schema = React.useMemo(() => makeSchema(candidateName), [candidateName]);
  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { typedName: "", useTyped: false, consent: false } });

  const [hasInk, setHasInk] = React.useState(false);
  const [inkError, setInkError] = React.useState(false);
  const [useTyped, consent, typedName] = useWatch({ control, name: ["useTyped", "consent", "typedName"] });

  const close = () => {
    reset();
    setHasInk(false);
    setInkError(false);
    onOpenChange(false);
  };
  const { onOpenChange: guarded, guard } = useDirtyGuard(isDirty || hasInk, close);

  const submit = handleSubmit(
    (v) => {
      if (!v.useTyped && !hasInk) {
        setInkError(true);
        return;
      }
      onSigned(v.typedName.trim(), v.useTyped ? "typed" : "drawn");
      close();
    },
    () => setInkError(!useTyped && !hasInk),
  );

  return (
    <>
      <Dialog open={open} onOpenChange={guarded}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Accept and sign your offer</DialogTitle>
            <DialogDescription>
              {role} at {TENANT.legalName}. Your e-signature is legally binding under the Information Technology Act, 2000.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} noValidate>
            <DialogBody className="flex flex-col gap-4">
              <Field
                label="Type your full name"
                htmlFor="esign-name"
                required
                error={errors.typedName?.message}
                hint={`Must match the name on your offer: ${candidateName}`}
              >
                <Input id="esign-name" autoComplete="name" aria-invalid={!!errors.typedName} {...register("typedName")} />
              </Field>

              <div className="flex flex-col gap-1.5">
                <Label id="esign-sig-label">Signature</Label>
                {useTyped ? (
                  <div className="flex h-36 items-center justify-center rounded-md border border-input bg-card px-4">
                    <span className="truncate font-serif text-3xl italic text-foreground">
                      {typedName.trim() || "Your typed name"}
                    </span>
                  </div>
                ) : (
                  <SignaturePad
                    hasInk={hasInk}
                    invalid={inkError}
                    describedBy="esign-sig-label"
                    onInkChange={(v) => {
                      setHasInk(v);
                      if (v) setInkError(false);
                    }}
                  />
                )}
                {inkError && !useTyped && (
                  <p role="alert" className="text-xs text-destructive-fg">
                    Draw your signature in the box, or sign with your typed name instead.
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="esign-typed"
                    checked={useTyped}
                    onCheckedChange={(v) => {
                      setValue("useTyped", v === true, { shouldDirty: true });
                      setInkError(false);
                    }}
                  />
                  <Label htmlFor="esign-typed" className="font-normal text-muted-foreground">
                    I cannot draw a signature — sign with my typed name instead
                  </Label>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="esign-consent"
                    className="mt-0.5"
                    checked={consent}
                    aria-invalid={!!errors.consent}
                    onCheckedChange={(v) => setValue("consent", v === true, { shouldDirty: true, shouldValidate: true })}
                  />
                  <Label htmlFor="esign-consent" className="font-normal leading-relaxed text-muted-foreground">
                    I accept this offer on the terms set out above and agree to sign it electronically. A signed PDF copy will
                    be emailed to me.
                  </Label>
                </div>
                {errors.consent && (
                  <p role="alert" className="text-xs text-destructive-fg">
                    {errors.consent.message}
                  </p>
                )}
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => guarded(false)}>
                Cancel
              </Button>
              <Button type="submit">
                <PenLine />
                Sign and accept
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}
