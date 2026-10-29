"use client";

import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { addDays, format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/primitives";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/overlays";
import { DEMO_TODAY } from "@/mock/org";
import { ASSET_CATEGORIES, type AssetCategory } from "@/mock/workplace";
import { useDirtyGuard } from "./kit";

export const CATALOGUE: Record<AssetCategory, string[]> = {
  Laptop: ['Apple MacBook Pro 14" M4', "Dell Latitude 5450", "Lenovo ThinkPad T14 Gen 5"],
  Monitor: ['Dell UltraSharp 27" 4K', 'LG 27UP850N 27"'],
  Phone: ["Apple iPhone 15", "Samsung Galaxy A55 5G"],
  "Access Card": ["HID iCLASS proximity card"],
  Headset: ["Jabra Evolve2 65", "Logitech Zone Vibe 100"],
  "Docking Station": ["Dell WD22TB4 dock"],
  Tablet: ['Apple iPad Air 11"'],
};

const MIN_DATE = format(addDays(parseISO(DEMO_TODAY), 3), "yyyy-MM-dd");

const schema = z.object({
  category: z.enum(ASSET_CATEGORIES as [AssetCategory, ...AssetCategory[]]),
  item: z.string().min(1, "Pick an item from the catalogue"),
  justification: z.string().trim().min(20, "Explain the business need in a sentence or two (20+ characters)"),
  neededBy: z.string().min(1, "Pick a date").refine((d) => d >= MIN_DATE, "Allow at least 3 days for approval and fulfilment"),
});
export type AssetRequestValues = z.infer<typeof schema>;

const DEFAULTS: AssetRequestValues = { category: "Monitor", item: CATALOGUE.Monitor[0], justification: "", neededBy: MIN_DATE };

/** Raise a request for equipment. Goes to the reporting manager, then IT. */
export function AssetRequestDialog({
  open,
  onOpenChange,
  managerName,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  managerName: string;
  onSave: (v: AssetRequestValues) => void;
}) {
  const { register, handleSubmit, control, reset, setValue, formState } = useForm<AssetRequestValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });
  const category = useWatch({ control, name: "category" });
  const close = () => {
    reset(DEFAULTS);
    onOpenChange(false);
  };
  const { onOpenChange: guarded, guard } = useDirtyGuard(formState.isDirty, close);
  const submit = handleSubmit((v) => {
    onSave(v);
    reset(DEFAULTS);
    onOpenChange(false);
  });
  const e = formState.errors;

  return (
    <>
      <Dialog open={open} onOpenChange={guarded}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Request equipment</DialogTitle>
            <DialogDescription>Goes to {managerName} for approval, then to the IT Service Desk to fulfil.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} noValidate>
            <DialogBody className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Category" htmlFor="ar-cat" required>
                <Select
                  value={category}
                  onValueChange={(v) => {
                    setValue("category", v as AssetCategory, { shouldDirty: true });
                    setValue("item", CATALOGUE[v as AssetCategory][0], { shouldDirty: true });
                  }}
                >
                  <SelectTrigger id="ar-cat"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASSET_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Item" htmlFor="ar-item" required error={e.item?.message}>
                <Controller
                  control={control}
                  name="item"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="ar-item"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATALOGUE[category].map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Business justification" htmlFor="ar-why" required error={e.justification?.message} className="sm:col-span-2">
                <Textarea id="ar-why" placeholder="What will this let you do that you cannot do today?" aria-invalid={!!e.justification} {...register("justification")} />
              </Field>
              <Field label="Needed by" htmlFor="ar-date" required error={e.neededBy?.message}>
                <Input id="ar-date" type="date" min={MIN_DATE} className="tnum" aria-invalid={!!e.neededBy} {...register("neededBy")} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => guarded(false)}>Cancel</Button>
              <Button type="submit">Submit request</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}
