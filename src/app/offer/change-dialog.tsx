"use client";

import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Send } from "lucide-react";
import { useDirtyGuard } from "@/components/lifecycle/kit";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, RadioGroup, RadioGroupItem, Textarea } from "@/components/ui/primitives";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/overlays";

export const CHANGE_TOPICS = [
  { value: "joining_date", label: "Joining date" },
  { value: "ctc", label: "CTC or its breakup" },
  { value: "location", label: "Work location" },
  { value: "other", label: "Something else" },
] as const;

const schema = z
  .object({
    topic: z.enum(["joining_date", "ctc", "location", "other"], { message: "Pick what you would like to change" }),
    proposedDate: z.string().optional(),
    details: z.string().trim().min(20, "Explain the change in a sentence or two (20+ characters)"),
  })
  .refine((v) => v.topic !== "joining_date" || !!v.proposedDate, {
    path: ["proposedDate"],
    message: "Pick the joining date you would prefer",
  });
export type ChangeValues = z.infer<typeof schema>;

export function ChangeDialog({
  open,
  onOpenChange,
  minDate,
  onRequested,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  minDate: string;
  onRequested: (v: ChangeValues) => void;
}) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ChangeValues>({
    resolver: zodResolver(schema),
    defaultValues: { topic: undefined, proposedDate: "", details: "" },
  });
  const topic = useWatch({ control, name: "topic" });

  const close = () => {
    reset();
    onOpenChange(false);
  };
  const { onOpenChange: guarded, guard } = useDirtyGuard(isDirty, close);

  return (
    <>
      <Dialog open={open} onOpenChange={guarded}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Request a change</DialogTitle>
            <DialogDescription>
              Your recruiter reviews the request with the hiring manager and replies within two working days. The current
              offer stays valid in the meantime.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleSubmit((v) => {
              onRequested(v);
              close();
            })}
            noValidate
          >
            <DialogBody className="flex flex-col gap-4">
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1.5 text-xs font-medium text-foreground">
                  What would you like to change?<span className="ml-0.5 text-destructive-fg">*</span>
                </legend>
                <Controller
                  control={control}
                  name="topic"
                  render={({ field }) => (
                    <RadioGroup
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      className="grid gap-2 sm:grid-cols-2"
                      aria-invalid={!!errors.topic}
                    >
                      {CHANGE_TOPICS.map((t) => (
                        <div
                          key={t.value}
                          className="flex items-center gap-2 rounded-md border border-border px-3 py-2 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary-soft/50"
                        >
                          <RadioGroupItem value={t.value} id={`change-${t.value}`} />
                          <Label htmlFor={`change-${t.value}`} className="flex-1 cursor-pointer font-normal">
                            {t.label}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}
                />
                {errors.topic && (
                  <p role="alert" className="text-xs text-destructive-fg">
                    {errors.topic.message}
                  </p>
                )}
              </fieldset>

              {topic === "joining_date" && (
                <Field label="Preferred joining date" htmlFor="change-date" required error={errors.proposedDate?.message}>
                  <Input
                    id="change-date"
                    type="date"
                    min={minDate}
                    className="tnum w-48"
                    aria-invalid={!!errors.proposedDate}
                    {...register("proposedDate")}
                  />
                </Field>
              )}

              <Field label="Details" htmlFor="change-details" required error={errors.details?.message}>
                <Textarea
                  id="change-details"
                  rows={4}
                  placeholder="For example: my notice period ends on 30 November, so a 1 December start would avoid a buy-out."
                  aria-invalid={!!errors.details}
                  {...register("details")}
                />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => guarded(false)}>
                Cancel
              </Button>
              <Button type="submit">
                <Send />
                Send request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}
