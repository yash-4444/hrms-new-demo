"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { CalendarClock, Check, FileCheck2, Info, Paperclip, Scale, Send, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, inr } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import { employeeByCode } from "@/mock/employees";
import {
  DECLARATION_WINDOW,
  OLD_REGIME_SLABS,
  TAX_FY,
  compareRegimes,
  seedDeclarations,
  type DeclarationItem,
  type DeclarationSection,
  type RegimeResult,
} from "@/mock/self-service";
import { TAX_SLABS } from "@/mock/payroll";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Alert, Badge, Hint, Input, Progress } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { CardsSkeleton, Gated, PageBody, PageHeader, Section, useFakeLoad } from "@/components/shell/page";

const SECTION_META: Record<DeclarationSection, { title: string; cap: number | null; note: string }> = {
  "80C": { title: "Section 80C", cap: 150000, note: "EPF, PPF, ELSS, life insurance, tuition fees, principal on home loan" },
  "80D": { title: "Section 80D", cap: 75000, note: "Health insurance — ₹25,000 self & family + ₹50,000 senior-citizen parents" },
  HRA: { title: "HRA — Sec 10(13A)", cap: null, note: "Exemption = least of HRA received, rent − 10% of basic, 50% of basic (metro)" },
  "24B": { title: "Section 24(b)", cap: 200000, note: "Interest on a home loan for a self-occupied property" },
  "80CCD1B": { title: "Section 80CCD(1B)", cap: 50000, note: "Additional voluntary NPS contribution, over and above 80C" },
};

const PROOF_STATUS: Record<DeclarationItem["proof"], { status: string; label: string }> = {
  verified: { status: "approved", label: "Verified" },
  pending: { status: "pending", label: "Pending review" },
  rejected: { status: "rejected", label: "Rejected" },
  not_uploaded: { status: "draft", label: "No proof" },
};

const schema = z
  .object({
    amounts: z.record(z.string(), z.number({ message: "Enter an amount" }).min(0, "Cannot be negative").max(5000000, "That looks too high")),
    landlordPan: z.string(),
  })
  .superRefine((v, ctx) => {
    if ((v.amounts.d5 ?? 0) > 100000 && !/^[A-Z]{5}\d{4}[A-Z]$/.test(v.landlordPan.trim().toUpperCase()))
      ctx.addIssue({ code: "custom", path: ["landlordPan"], message: "Landlord PAN (e.g. ABCDE1234F) is mandatory when annual rent exceeds ₹1,00,000" });
  });
type TaxForm = z.infer<typeof schema>;

export default function TaxPage() {
  const { persona } = useApp();
  return <TaxDeclaration key={persona.employeeId} />;
}

function TaxDeclaration() {
  const loading = useFakeLoad();
  const { persona, can } = useApp();
  const emp = employeeByCode(persona.employeeId);
  const [items, setItems] = React.useState<DeclarationItem[]>(() => seedDeclarations(persona.employeeId));
  const [submitted, setSubmitted] = React.useState(false);
  const [confirm, setConfirm] = React.useState(false);
  const [regime, setRegime] = React.useState<"old" | "new" | null>(null);
  const editable = can("my.tax", "E") && !submitted;

  const form = useForm<TaxForm>({
    resolver: zodResolver(schema),
    defaultValues: { amounts: Object.fromEntries(items.map((i) => [i.id, i.declared])), landlordPan: "" },
  });
  const amounts = form.watch("amounts");
  const live = React.useMemo(() => items.map((i) => ({ ...i, declared: Number(amounts[i.id]) || 0 })), [items, amounts]);
  const cmp = React.useMemo(() => (emp ? compareRegimes(emp, live) : null), [emp, live]);

  if (loading || !emp || !cmp) {
    return (
      <PageBody>
        <PageHeader title="Tax declaration" description="Loading…" />
        <CardsSkeleton count={2} height={260} />
      </PageBody>
    );
  }

  const chosen = regime ?? cmp.better;
  const daysLeft = differenceInCalendarDays(parseISO(DECLARATION_WINDOW.closes), parseISO(DEMO_TODAY));
  const sectionTotals = (Object.keys(SECTION_META) as DeclarationSection[]).map((s) => {
    const total = live.filter((i) => i.section === s && i.proof !== "rejected").reduce((a, i) => a + i.declared, 0);
    const cap = SECTION_META[s].cap;
    const counted = s === "HRA" ? cmp.old.exemptions : Math.min(cap ?? total, total);
    return { s, total, cap, counted };
  });

  const uploadProof = (id: string, name: string) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, proof: "pending", proofFile: name, rejectReason: undefined } : x)));
    mockAction("Proof uploaded", { description: `${name} · Payroll verifies proofs within 5 working days.` });
  };

  return (
    <PageBody>
      <PageHeader
        title={`Tax declaration · ${TAX_FY}`}
        description="Declare investments and rent so the right TDS is deducted every month. We compute both regimes from your actual salary structure."
        actions={
          <Gated menuKey="my.tax" action="E">
            <Button size="sm" disabled={submitted} onClick={form.handleSubmit(() => setConfirm(true))}>
              <Send /> {submitted ? "Submitted" : "Submit declaration"}
            </Button>
          </Gated>
        }
      />

      {submitted ? (
        <Alert tone="success" icon={FileCheck2} title="Declaration submitted">
          Your {chosen === "new" ? "new" : "old"} regime choice and declarations are locked for the window. October&apos;s TDS uses them.
          Payroll can reopen it if something needs to change.
        </Alert>
      ) : (
        <Alert tone={daysLeft <= 7 ? "warning" : "info"} icon={CalendarClock} title={`Declaration window open — closes ${fmtDate(DECLARATION_WINDOW.closes)} (${daysLeft} days left)`}>
          Opened {fmtDate(DECLARATION_WINDOW.opens)}. Without a declaration, TDS defaults to the new regime with no deductions.
          Proofs for the final computation are due by 15 Jan 2027.
        </Alert>
      )}

      {/* ------------------------------------------------- regime compare */}
      <div className="grid gap-4 lg:grid-cols-2">
        {[cmp.old, cmp.new].map((r) => (
          <RegimeCard
            key={r.regime}
            r={r}
            better={cmp.better === r.regime}
            saving={cmp.saving}
            selected={chosen === r.regime}
            disabled={!editable}
            onSelect={() => {
              setRegime(r.regime);
              mockAction(`${r.regime === "new" ? "New" : "Old"} regime selected`, { description: `Projected TDS ${inr(r.monthly)} a month.` });
            }}
          />
        ))}
      </div>
      <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
        Assumptions: annual gross {inr(cmp.annual.gross)} from your current salary structure; individual below 60; HRA computed for a metro
        city; professional tax ₹2,400. New regime: slabs {TAX_SLABS.map((s) => `${s.rate * 100}%`).join(" / ")} with ₹75,000 standard
        deduction and Sec 87A rebate up to ₹12,00,000. Old regime: slabs{" "}
        {OLD_REGIME_SLABS.map((s) => `${s.rate * 100}%`).join(" / ")} with ₹50,000 standard deduction, assumed unchanged for {TAX_FY}. 4%
        health &amp; education cess on both. Surcharge not applied. An estimate, not tax advice.
      </p>

      {/* ------------------------------------------------- section progress */}
      <Section title="Chapter VI-A & exemptions" description="Claimable under the old regime. Rejected proofs are excluded until re-uploaded.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {sectionTotals.map(({ s, total, cap, counted }) => (
            <div key={s} className="rounded-md border border-border p-3">
              <p className="text-xs font-semibold">{SECTION_META[s].title}</p>
              <p className="tnum mt-1 text-sm font-semibold">{inr(counted)}</p>
              <p className="tnum text-[11px] text-muted-foreground">
                {cap ? `of ${inr(cap)} limit` : `exempt from ${inr(total)} rent`}
              </p>
              <Progress
                className="mt-2"
                value={cap ? (Math.min(total, cap) / cap) * 100 : total ? 100 : 0}
                tone={cap && total > cap ? "warning" : "accent"}
                aria-label={`${SECTION_META[s].title} utilisation`}
              />
              {cap && total > cap && <p className="mt-1 text-[10px] text-warning-fg">{inr(total - cap)} above the limit — not counted</p>}
            </div>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------- declarations */}
      <Section title="Declarations & proofs" bodyClassName="p-0">
        {chosen === "new" && (
          <div className="border-b border-border px-4 py-2.5">
            <p className="text-xs text-muted-foreground">
              You&apos;re on the <span className="font-medium text-foreground">new regime</span>, so these deductions do not reduce your TDS. Keep them
              up to date to compare — you can switch regime until the window closes.
            </p>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2 font-medium">Item</th>
                <th className="px-2 py-2 font-medium">Section</th>
                <th className="px-2 py-2 text-right font-medium">Declared (₹ / year)</th>
                <th className="px-2 py-2 font-medium">Proof</th>
                <th className="px-4 py-2 text-right font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const err = form.formState.errors.amounts?.[i.id]?.message;
                const ps = PROOF_STATUS[i.proof];
                return (
                  <tr key={i.id} className="border-b border-border align-top last:border-0">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{i.label}</p>
                      <p className="text-[11px] text-muted-foreground">{i.help}</p>
                      {i.id === "d5" && (amounts.d5 ?? 0) > 100000 && (
                        <div className="mt-1.5 max-w-[220px]">
                          <Input
                            aria-label="Landlord PAN"
                            placeholder="Landlord PAN"
                            className="h-7 font-mono uppercase"
                            disabled={!editable}
                            aria-invalid={!!form.formState.errors.landlordPan}
                            {...form.register("landlordPan")}
                          />
                          {form.formState.errors.landlordPan && (
                            <p role="alert" className="mt-1 text-[11px] text-destructive-fg">
                              {form.formState.errors.landlordPan.message}
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      <Badge variant="muted">{i.section === "24B" ? "24(b)" : i.section === "80CCD1B" ? "80CCD(1B)" : i.section}</Badge>
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <Input
                        type="number"
                        min={0}
                        step={1000}
                        aria-label={`Declared amount for ${i.label}`}
                        className="tnum ml-auto h-7 w-32 text-right"
                        disabled={!editable}
                        readOnly={i.id === "d1"}
                        title={i.id === "d1" ? "Deducted through payroll — counted automatically" : undefined}
                        aria-invalid={!!err}
                        {...form.register(`amounts.${i.id}` as const, { valueAsNumber: true })}
                      />
                      {err && (
                        <p role="alert" className="mt-1 text-[11px] text-destructive-fg">
                          {err}
                        </p>
                      )}
                      {i.limit > 0 && <p className="tnum mt-1 text-[10px] text-muted-foreground">Limit {inr(i.limit)}</p>}
                    </td>
                    <td className="px-2 py-2.5">
                      <StatusBadge status={ps.status} label={ps.label} />
                      {i.proofFile && <p className="mt-1 max-w-[180px] truncate text-[10px] text-muted-foreground">{i.proofFile}</p>}
                      {i.rejectReason && <p className="mt-1 max-w-[220px] text-[10px] text-destructive-fg">{i.rejectReason}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {i.id !== "d1" && <ProofUpload disabled={!editable} label={i.label} hasFile={!!i.proofFile} onFile={(n) => uploadProof(i.id, n)} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Submit your ${TAX_FY} declaration?`}
        description={
          <span className="flex flex-col gap-1.5">
            <span>
              Regime: <strong>{chosen === "new" ? "New" : "Old"}</strong> · projected tax {inr(chosen === "new" ? cmp.new.total : cmp.old.total)} · TDS{" "}
              {inr(chosen === "new" ? cmp.new.monthly : cmp.old.monthly)} a month.
            </span>
            {chosen !== cmp.better && (
              <span className="text-warning-fg">The {cmp.better} regime would save you {inr(cmp.saving)} on these figures.</span>
            )}
            <span>Your declaration is locked once submitted; Payroll can reopen it.</span>
          </span>
        }
        confirmLabel="Submit"
        onConfirm={() => {
          setSubmitted(true);
          mockAction("Declaration submitted", { description: `${TAX_FY} · ${chosen === "new" ? "New" : "Old"} regime. Payroll has been notified.` });
        }}
      />
    </PageBody>
  );
}

function RegimeCard({
  r,
  better,
  saving,
  selected,
  disabled,
  onSelect,
}: {
  r: RegimeResult;
  better: boolean;
  saving: number;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const rows: [string, number, "minus" | "plus" | "total" | "plain"][] = [
    ["Gross salary", r.gross, "plain"],
    ...r.lines.filter((l) => l.amount > 0).map((l) => [l.label, l.amount, "minus"] as [string, number, "minus"]),
    ["Taxable income", r.taxable, "total"],
    ["Tax on slabs", r.slabTax, "plain"],
    ["Rebate u/s 87A", r.rebate, "minus"],
    ["Health & education cess (4%)", r.cess, "plus"],
  ];
  return (
    <div className={cn("flex flex-col rounded-md border bg-card", selected ? "border-primary ring-2 ring-primary/20" : "border-border")}>
      <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Scale className="size-4 text-muted-foreground" aria-hidden />
            {r.regime === "new" ? "New regime" : "Old regime"}
          </p>
          <p className="text-[11px] text-muted-foreground">{r.regime === "new" ? "Default · lower slabs, almost no deductions" : "Higher slabs, deductions & exemptions allowed"}</p>
        </div>
        {better ? (
          <Badge className="border-success/25 bg-success-soft text-success-fg">Saves {inr(saving)}</Badge>
        ) : (
          <Badge variant="muted">Costs {inr(saving)} more</Badge>
        )}
      </div>
      <dl className="flex-1 px-4 py-2">
        {rows.map(([k, v, kind]) => (
          <div key={k} className={cn("flex justify-between gap-3 py-1 text-xs", kind === "total" && "mt-1 border-t border-border pt-2 font-semibold")}>
            <dt className={cn(kind !== "total" && "text-muted-foreground")}>{k}</dt>
            <dd className="tnum">
              {kind === "minus" ? "− " : kind === "plus" ? "+ " : ""}
              {inr(v)}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex items-center justify-between gap-2 border-t border-border bg-subtle px-4 py-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total tax for the year</p>
          <p className="tnum text-lg font-semibold">{inr(r.total)}</p>
          <p className="tnum text-[11px] text-muted-foreground">≈ {inr(r.monthly)} TDS a month</p>
        </div>
        {selected ? (
          <Badge variant="soft">
            <Check className="size-3" aria-hidden /> Selected
          </Badge>
        ) : (
          <Gated menuKey="my.tax" action="E">
            <Button size="sm" variant="outline" disabled={disabled} onClick={onSelect}>
              Choose {r.regime}
            </Button>
          </Gated>
        )}
      </div>
    </div>
  );
}

function ProofUpload({ disabled, label, hasFile, onFile }: { disabled: boolean; label: string; hasFile: boolean; onFile: (name: string) => void }) {
  const ref = React.useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="sr-only"
        aria-label={`Upload proof for ${label}`}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f.name);
          e.target.value = "";
        }}
      />
      <Hint text={disabled ? "The declaration is locked" : "PDF, JPG or PNG up to 5 MB"}>
        <span className="inline-flex">
          <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => ref.current?.click()}>
            {hasFile ? <Paperclip /> : <Upload />} {hasFile ? "Replace" : "Upload proof"}
          </Button>
        </span>
      </Hint>
    </>
  );
}
