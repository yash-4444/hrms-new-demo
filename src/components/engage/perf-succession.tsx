"use client";

/* Succession — successor list with flight-risk overlay, and the nominate dialog. */

import * as React from "react";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EMPLOYEES } from "@/mock/employees";
import { boxById, NINE_BOXES } from "@/mock/growth";
import { flightRiskFor, READINESS_LABEL, type CriticalRole, type Readiness } from "@/mock/engage";
import { AiBadge, AiExplainButton } from "@/components/ai";
import { PersonCell } from "@/components/people/person-cell";
import { Gated } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/primitives";
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { nameOf, personLine, useDirtyGuard } from "./kit";

export const READINESS_STATUS: Record<Readiness, string> = { now: "completed", "1-2": "in_review", "3+": "scheduled" };
const BAND_TONE = { High: "text-destructive-fg", Medium: "text-warning-fg", Low: "text-success-fg" } as const;

export function SuccessorList({ role, overlay, onRemove }: { role: CriticalRole; overlay: boolean; onRemove: (code: string) => void }) {
  if (role.successors.length === 0) {
    return <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No successor identified — this role has no bench. Nominate one below.</p>;
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {role.successors.map((s) => {
        const risk = flightRiskFor(s.code);
        const box = boxById(s.boxId);
        return (
          <li key={s.code} className="flex flex-col gap-1.5 rounded-md border border-border p-2.5">
            <div className="flex items-start justify-between gap-2">
              <PersonCell name={nameOf(s.code)} code={s.code} subtitle={personLine(s.code)} />
              <Gated menuKey="growth.succession" action="E">
                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${nameOf(s.code)} as successor`} onClick={() => onRemove(s.code)}>
                  <Trash2 />
                </Button>
              </Gated>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <StatusBadge status={READINESS_STATUS[s.readiness]} label={READINESS_LABEL[s.readiness]} />
              <Link href="/reviews/calibration" className="rounded border border-border px-1.5 py-0.5 text-muted-foreground hover:text-foreground hover:underline">
                9-box: {box.name}
              </Link>
              {overlay && risk && (
                <span className="inline-flex items-center gap-1">
                  <AiBadge label="Flight risk" />
                  <span className={cn("font-semibold", BAND_TONE[risk.band])}>{risk.band}</span>
                  <span className="tnum text-muted-foreground">· {risk.score}</span>
                  <AiExplainButton
                    title={`Why ${nameOf(s.code).split(" ")[0]} is ${risk.band.toLowerCase()} risk`}
                    drivers={risk.drivers.map((d) => ({ label: d.label, detail: d.detail, weight: d.weight }))}
                  />
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const schema = z.object({
  code: z.string().min(1, "Choose a successor"),
  readiness: z.enum(["now", "1-2", "3+"]),
  boxId: z.string().min(1, "Choose the 9-box placement"),
  plan: z.string().trim().min(15, "Note the development plan — at least 15 characters"),
});
type Values = z.infer<typeof schema>;

export function NominateDialog({
  role,
  onOpenChange,
  onNominate,
}: {
  role: CriticalRole | null;
  onOpenChange: (v: boolean) => void;
  onNominate: (v: Values) => void;
}) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { code: "", readiness: "1-2", boxId: "high_performer", plan: "" } });
  const close = () => {
    onOpenChange(false);
    form.reset();
  };
  const { onOpenChange: guarded, guard } = useDirtyGuard(form.formState.isDirty, close);
  const errors = form.formState.errors;
  const pool = React.useMemo(() => {
    if (!role) return [];
    const taken = new Set([role.incumbentCode, ...role.successors.map((s) => s.code)]);
    return EMPLOYEES.filter((e) => e.departmentId === role.departmentId && e.status === "active" && !taken.has(e.code) && ["G3", "G4", "G5", "G6"].includes(e.gradeId)).slice(0, 25);
  }, [role]);

  return (
    <>
      <Dialog open={!!role} onOpenChange={guarded}>
        <DialogContent size="sm">
          <form noValidate onSubmit={form.handleSubmit((v) => { onNominate(v); close(); })}>
            <DialogHeader>
              <DialogTitle>Nominate successor</DialogTitle>
              <DialogDescription>For {role?.title} — incumbent {role ? nameOf(role.incumbentCode) : ""}. Nominations are confidential to HR and the department head.</DialogDescription>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-3">
              <Field label="Successor" htmlFor="nom-code" required error={errors.code?.message}>
                <Controller control={form.control} name="code" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="nom-code" aria-invalid={!!errors.code}><SelectValue placeholder="Choose a person" /></SelectTrigger>
                    <SelectContent>
                      {pool.map((e) => <SelectItem key={e.code} value={e.code}>{e.name} — {e.designation} ({e.gradeId})</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Readiness" htmlFor="nom-ready">
                  <Controller control={form.control} name="readiness" render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="nom-ready"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(READINESS_LABEL) as Readiness[]).map((r) => <SelectItem key={r} value={r}>{READINESS_LABEL[r]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
                </Field>
                <Field label="9-box placement" htmlFor="nom-box" error={errors.boxId?.message}>
                  <Controller control={form.control} name="boxId" render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="nom-box"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {NINE_BOXES.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
                </Field>
              </div>
              <Field label="Development plan" htmlFor="nom-plan" required error={errors.plan?.message} hint="What closes the readiness gap — stretch project, course, mentor.">
                <Textarea id="nom-plan" rows={3} {...form.register("plan")} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => guarded(false)}>Cancel</Button>
              <Button type="submit">Nominate</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}
