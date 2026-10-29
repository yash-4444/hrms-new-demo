"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { PolicyDoc } from "@/mock/engage";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input, Textarea } from "@/components/ui/primitives";
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
import { useDirtyGuard } from "./kit";

const vnum = (v: string) => v.split(".").map(Number);
const newer = (a: string, b: string) => {
  const [a1, a2] = vnum(a);
  const [b1, b2] = vnum(b);
  return a1 > b1 || (a1 === b1 && a2 > b2);
};

export interface PublishValues {
  policyId: string;
  version: string;
  changeNote: string;
}

export function PublishVersionDialog({
  open,
  onOpenChange,
  policies,
  onPublish,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  policies: PolicyDoc[];
  onPublish: (v: PublishValues) => void;
}) {
  const schema = z
    .object({
      policyId: z.string().min(1, "Choose a policy"),
      version: z.string().trim().regex(/^\d+\.\d+$/, "Use major.minor, e.g. 4.2"),
      changeNote: z.string().trim().min(10, "Summarise what changed (10+ characters)"),
    })
    .superRefine((v, ctx) => {
      const p = policies.find((x) => x.id === v.policyId);
      if (p && /^\d+\.\d+$/.test(v.version) && !newer(v.version, p.versions[0].version))
        ctx.addIssue({ code: "custom", path: ["version"], message: `Must be newer than v${p.versions[0].version}` });
    });

  const defaults: PublishValues = { policyId: "", version: "", changeNote: "" };
  const form = useForm<PublishValues>({ resolver: zodResolver(schema), defaultValues: defaults });
  const close = () => {
    onOpenChange(false);
    form.reset(defaults);
  };
  const { onOpenChange: guarded, guard } = useDirtyGuard(form.formState.isDirty, close);
  const errors = form.formState.errors;
  const chosen = policies.find((p) => p.id === form.watch("policyId"));

  return (
    <>
      <Dialog open={open} onOpenChange={guarded}>
        <DialogContent size="md">
          <form
            noValidate
            onSubmit={form.handleSubmit((v) => {
              onPublish(v);
              close();
            })}
          >
            <DialogHeader>
              <DialogTitle>Publish a new policy version</DialogTitle>
              <DialogDescription>Employees who accepted the previous version will be asked to accept again.</DialogDescription>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-3">
              <Field label="Policy" htmlFor="pv-policy" required error={errors.policyId?.message}>
                <Select value={form.watch("policyId")} onValueChange={(v) => form.setValue("policyId", v, { shouldDirty: true, shouldValidate: true })}>
                  <SelectTrigger id="pv-policy" aria-invalid={!!errors.policyId}>
                    <SelectValue placeholder="Choose a policy" />
                  </SelectTrigger>
                  <SelectContent>
                    {policies.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title} (v{p.versions[0].version})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="New version" htmlFor="pv-version" required error={errors.version?.message} hint={chosen ? `Current: v${chosen.versions[0].version}` : undefined}>
                <Input id="pv-version" placeholder="4.2" aria-invalid={!!errors.version} {...form.register("version")} />
              </Field>
              <Field label="What changed" htmlFor="pv-note" required error={errors.changeNote?.message}>
                <Textarea id="pv-note" rows={3} aria-invalid={!!errors.changeNote} {...form.register("changeNote")} />
              </Field>
              {chosen?.requiresAcceptance && (
                <Alert tone="warning" title="Re-acceptance will be required">
                  Every active employee must read and accept v{form.watch("version") || "—"} — acceptance tracking resets to zero.
                </Alert>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => guarded(false)}>
                Cancel
              </Button>
              <Button type="submit">Publish version</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}
