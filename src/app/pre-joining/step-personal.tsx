"use client";

import { Controller, useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DEMO_TODAY } from "@/mock/org";
import { Field, Input } from "@/components/ui/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { StepFooter } from "./stepper";
import { GENDERS, MARITAL, personalSchema, type PersonalValues } from "./types";

const EMPTY: PersonalValues = {
  dob: "",
  gender: "",
  maritalStatus: "",
  addressLine: "",
  city: "",
  state: "",
  pincode: "",
  emergencyName: "",
  emergencyRelation: "",
  emergencyPhone: "",
};

function ChoiceField({
  control,
  name,
  label,
  options,
  error,
}: {
  control: Control<PersonalValues>;
  name: "gender" | "maritalStatus";
  label: string;
  options: string[];
  error?: string;
}) {
  const id = `pj-${name}`;
  return (
    <Field label={label} htmlFor={id} required error={error}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger id={id} aria-invalid={!!error} onBlur={field.onBlur}>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </Field>
  );
}

export function StepPersonal({ initial, onSave }: { initial?: PersonalValues; onSave: (v: PersonalValues) => void }) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PersonalValues>({ resolver: zodResolver(personalSchema), defaultValues: initial ?? EMPTY });

  return (
    <form onSubmit={handleSubmit(onSave)} noValidate className="flex flex-col gap-5">
      <fieldset className="grid gap-3.5 sm:grid-cols-3">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">About you</legend>
        <Field label="Date of birth" htmlFor="pj-dob" required error={errors.dob?.message}>
          <Input id="pj-dob" type="date" max={DEMO_TODAY} className="tnum" aria-invalid={!!errors.dob} {...register("dob")} />
        </Field>
        <ChoiceField control={control} name="gender" label="Gender" options={GENDERS} error={errors.gender?.message} />
        <ChoiceField
          control={control}
          name="maritalStatus"
          label="Marital status"
          options={MARITAL}
          error={errors.maritalStatus?.message}
        />
      </fieldset>

      <fieldset className="grid gap-3.5 sm:grid-cols-3">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current address</legend>
        <Field label="House and street" htmlFor="pj-addr" required error={errors.addressLine?.message} className="sm:col-span-3">
          <Input id="pj-addr" autoComplete="street-address" aria-invalid={!!errors.addressLine} {...register("addressLine")} />
        </Field>
        <Field label="City" htmlFor="pj-city" required error={errors.city?.message}>
          <Input id="pj-city" autoComplete="address-level2" aria-invalid={!!errors.city} {...register("city")} />
        </Field>
        <Field label="State" htmlFor="pj-state" required error={errors.state?.message}>
          <Input id="pj-state" autoComplete="address-level1" aria-invalid={!!errors.state} {...register("state")} />
        </Field>
        <Field label="PIN code" htmlFor="pj-pin" required error={errors.pincode?.message}>
          <Input
            id="pj-pin"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            className="tnum"
            aria-invalid={!!errors.pincode}
            {...register("pincode")}
          />
        </Field>
      </fieldset>

      <fieldset className="grid gap-3.5 sm:grid-cols-3">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Emergency contact</legend>
        <Field label="Name" htmlFor="pj-em-name" required error={errors.emergencyName?.message}>
          <Input id="pj-em-name" aria-invalid={!!errors.emergencyName} {...register("emergencyName")} />
        </Field>
        <Field label="Relationship" htmlFor="pj-em-rel" required error={errors.emergencyRelation?.message}>
          <Input id="pj-em-rel" placeholder="Spouse, parent, sibling…" aria-invalid={!!errors.emergencyRelation} {...register("emergencyRelation")} />
        </Field>
        <Field label="Mobile" htmlFor="pj-em-phone" required error={errors.emergencyPhone?.message}>
          <Input
            id="pj-em-phone"
            type="tel"
            placeholder="+91 98450 00000"
            className="tnum"
            aria-invalid={!!errors.emergencyPhone}
            {...register("emergencyPhone")}
          />
        </Field>
      </fieldset>

      <StepFooter />
    </form>
  );
}
