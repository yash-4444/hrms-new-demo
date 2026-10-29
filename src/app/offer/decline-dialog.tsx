"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useDirtyGuard } from "@/components/lifecycle/kit";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/primitives";
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

export const DECLINE_REASONS = [
  "Accepted another offer",
  "Compensation below my expectation",
  "Counter-offer from my current employer",
  "Role or location does not suit me",
  "Personal or family reasons",
  "Other",
];

const schema = z.object({
  reason: z.string().min(1, "Pick the main reason"),
  comment: z.string().trim().min(10, "A sentence or two, please — it goes straight to the hiring manager"),
});
type Values = z.infer<typeof schema>;

export function DeclineDialog({
  open,
  onOpenChange,
  onDeclined,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDeclined: (v: Values) => void;
}) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { reason: "", comment: "" } });

  const close = () => {
    reset();
    onOpenChange(false);
  };
  const { onOpenChange: guarded, guard } = useDirtyGuard(isDirty, close);

  return (
    <>
      <Dialog open={open} onOpenChange={guarded}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Decline this offer?</DialogTitle>
            <DialogDescription>
              Once declined, the offer is withdrawn and cannot be reopened from this page. Your feedback helps us make better
              offers.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleSubmit((v) => {
              onDeclined(v);
              close();
            })}
            noValidate
          >
            <DialogBody className="flex flex-col gap-3.5">
              <Field label="Main reason" htmlFor="decline-reason" required error={errors.reason?.message}>
                <Controller
                  control={control}
                  name="reason"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="decline-reason" aria-invalid={!!errors.reason} onBlur={field.onBlur}>
                        <SelectValue placeholder="Choose a reason" />
                      </SelectTrigger>
                      <SelectContent>
                        {DECLINE_REASONS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Anything you would like us to know" htmlFor="decline-comment" required error={errors.comment?.message}>
                <Textarea id="decline-comment" aria-invalid={!!errors.comment} {...register("comment")} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => guarded(false)}>
                Keep the offer
              </Button>
              <Button type="submit" variant="destructive">
                Decline offer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}
