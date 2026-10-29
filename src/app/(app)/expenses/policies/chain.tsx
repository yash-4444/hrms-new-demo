"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, GitBranch, Pencil } from "lucide-react";
import { inr } from "@/lib/format";
import { EXP_APPROVAL_RULES, type ExpApprovalRule } from "@/mock/finance-expense";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { Badge, Checkbox, Field, Input, Label, Switch } from "@/components/ui/primitives";
import { DataTable, MutedCell } from "@/components/data-table";
import { Gated, Section } from "@/components/shell/page";
import { GuardedDialog } from "@/components/finance/kit";

/* ============================================================================
   Approval chain rules plus a simulator: type an amount and see exactly which
   approvers the claim will route through under the rules as currently edited.
   ========================================================================== */

const schema = z.object({
  threshold: z.number({ error: "Enter an amount" }).int("Whole rupees only").positive("Must be above zero").nullable(),
  slaHours: z.number({ error: "Enter hours" }).int().min(4, "At least 4 hours").max(168, "At most 7 days"),
});
type Values = z.infer<typeof schema>;

export function ChainTab() {
  const { can } = useApp();
  const [rules, setRules] = React.useState<ExpApprovalRule[]>(EXP_APPROVAL_RULES);
  const [editing, setEditing] = React.useState<ExpApprovalRule | null>(null);
  const [amount, setAmount] = React.useState(32000);
  const [overLimit, setOverLimit] = React.useState(false);
  const [training, setTraining] = React.useState(false);
  const form = useForm<Values>({ resolver: zodResolver(schema) });
  const { errors } = form.formState;

  const route = rules
    .filter((r) => r.active)
    .filter(
      (r) =>
        r.kind === "always" ||
        (r.kind === "amount" && amount > (r.threshold ?? Infinity)) ||
        (r.kind === "violation" && overLimit) ||
        (r.kind === "category" && training),
    )
    .map((r) => r.approver.replace(" (exception)", ""))
    .filter((a, i, all) => all.indexOf(a) === i);

  const save = form.handleSubmit((v) => {
    if (!editing) return;
    const before = rules;
    setRules((prev) => prev.map((r) => (r.id === editing.id ? { ...r, threshold: v.threshold, slaHours: v.slaHours } : r)));
    mockAction(`Rule ${editing.order} updated`, {
      description: "New claims route by the updated rule. Claims already in flight keep their chain.",
      undo: () => setRules(before),
    });
    setEditing(null);
  });

  const toggle = (rule: ExpApprovalRule, active: boolean) => {
    const before = rules;
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, active } : r)));
    mockAction(`Rule ${rule.order} ${active ? "enabled" : "disabled"}`, { undo: () => setRules(before) });
  };

  const columns: ColumnDef<ExpApprovalRule, unknown>[] = [
    { accessorKey: "order", header: "Step", cell: ({ row }) => <MutedCell>{row.original.order}</MutedCell> },
    {
      accessorKey: "condition",
      header: "When",
      cell: ({ row }) => (
        <span className="text-xs">
          {row.original.condition}
          {row.original.threshold !== null && (
            <span className="tnum font-semibold"> {inr(row.original.threshold, { decimals: false })}</span>
          )}
        </span>
      ),
    },
    { accessorKey: "approver", header: "Approver", cell: ({ row }) => <span className="font-medium">{row.original.approver}</span> },
    { accessorKey: "slaHours", header: "SLA", cell: ({ row }) => <MutedCell>{row.original.slaHours} h</MutedCell> },
    {
      accessorKey: "active",
      header: "Active",
      cell: ({ row }) => (
        <Switch
          checked={row.original.active}
          disabled={!can("workplace.expense_policies", "E") || row.original.kind === "always"}
          onCheckedChange={(v) => toggle(row.original, v)}
          aria-label={`Rule ${row.original.order} active`}
        />
      ),
    },
    {
      id: "edit",
      header: "",
      enableHiding: false,
      cell: ({ row }) => (
        <Gated menuKey="workplace.expense_policies" action="E">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Edit rule ${row.original.order}`}
            onClick={() => {
              form.reset({ threshold: row.original.threshold, slaHours: row.original.slaHours });
              setEditing(row.original);
            }}
          >
            <Pencil />
          </Button>
        </Gated>
      ),
    },
  ];

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
      <DataTable<ExpApprovalRule>
        columns={columns}
        data={rules}
        getRowId={(r) => r.id}
        exportName="expense-approval-chain"
        emptyIcon={GitBranch}
        emptyTitle="No approval rules"
        emptyDescription="Every claim needs at least the reporting manager. Add a rule to start routing."
      />

      <Section title="Route simulator" description="See who a claim would go to under these rules.">
        <div className="flex flex-col gap-3">
          <Field label="Claim total (₹)" htmlFor="sim-amount">
            <Input id="sim-amount" type="number" className="tnum" value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))} />
          </Field>
          <div className="flex items-center gap-2">
            <Checkbox id="sim-over" checked={overLimit} onCheckedChange={(v) => setOverLimit(v === true)} />
            <Label htmlFor="sim-over">A line is over its policy limit</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="sim-train" checked={training} onCheckedChange={(v) => setTraining(v === true)} />
            <Label htmlFor="sim-train">Includes a training expense</Label>
          </div>
          <ol aria-label="Simulated approval route" className="flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
            <li>
              <Badge variant="muted">Employee submits</Badge>
            </li>
            {route.map((a) => (
              <li key={a} className="flex items-center gap-1.5">
                <ArrowRight className="size-3 text-muted-foreground" aria-hidden />
                <Badge variant="soft">{a}</Badge>
              </li>
            ))}
            <li className="flex items-center gap-1.5">
              <ArrowRight className="size-3 text-muted-foreground" aria-hidden />
              <Badge variant="muted">Finance review</Badge>
            </li>
          </ol>
        </div>
      </Section>

      <GuardedDialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)} dirty={form.formState.isDirty} size="sm">
        <DialogHeader>
          <DialogTitle>Edit rule {editing?.order}</DialogTitle>
          <DialogDescription>{editing?.condition} → {editing?.approver}</DialogDescription>
        </DialogHeader>
        <form onSubmit={save}>
          <DialogBody className="flex flex-col gap-3">
            {editing?.threshold !== null && (
              <Field label="Threshold (₹)" htmlFor="rule-threshold" required error={errors.threshold?.message}>
                <Input id="rule-threshold" type="number" className="tnum" {...form.register("threshold", { valueAsNumber: true })} />
              </Field>
            )}
            <Field label="Decision SLA (hours)" htmlFor="rule-sla" required error={errors.slaHours?.message}>
              <Input id="rule-sla" type="number" className="tnum" {...form.register("slaHours", { valueAsNumber: true })} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">Save rule</Button>
          </DialogFooter>
        </form>
      </GuardedDialog>
    </div>
  );
}
