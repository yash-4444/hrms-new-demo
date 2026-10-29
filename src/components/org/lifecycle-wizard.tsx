"use client";

import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight,
  ArrowUpCircle,
  BadgeCheck,
  Ban,
  Check,
  LogOut,
  MapPinned,
  Plane,
  RotateCcw,
  Search,
  Sunset,
  Tag,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, inr } from "@/lib/format";
import { BRANCHES, DEMO_TODAY, DESIGNATIONS, GRADES, branchById, deptName, gradeById } from "@/mock/org";
import { EMPLOYEES, employeeByCode, employeeName, type Employee } from "@/mock/employees";
import {
  LIFECYCLE_LABEL,
  lifecycleImpact,
  type ApprovalStep,
  type LifecycleChange,
  type LifecycleEvent,
  type LifecycleType,
} from "@/mock/masters";
import { Button } from "@/components/ui/button";
import { Alert, Avatar, Field, Input, Textarea } from "@/components/ui/primitives";
import {
  ConfirmDialog,
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
import { StatusBadge } from "@/components/ui/status-badge";

/* ============================================================================
   Record lifecycle event — pick employee → event type → effective-dated
   changes with a before/after preview → downstream impact → approval chain.
   ========================================================================== */

type WizardType = Exclude<LifecycleType, "join" | "rehire">;

export const WIZARD_TYPES: { type: WizardType; icon: LucideIcon; hint: string }[] = [
  { type: "confirm", icon: BadgeCheck, hint: "End probation" },
  { type: "promote", icon: ArrowUpCircle, hint: "New grade, title and pay" },
  { type: "redesignate", icon: Tag, hint: "Title only, same grade" },
  { type: "transfer", icon: MapPinned, hint: "Move to another branch" },
  { type: "deputation", icon: Plane, hint: "Temporary posting" },
  { type: "suspend", icon: Ban, hint: "Pending inquiry" },
  { type: "reinstate", icon: RotateCcw, hint: "Back from suspension" },
  { type: "resign", icon: LogOut, hint: "Employee-initiated exit" },
  { type: "terminate", icon: UserX, hint: "Employer-initiated exit" },
  { type: "retire", icon: Sunset, hint: "Superannuation" },
];

const schema = z
  .object({
    type: z.string(),
    effectiveDate: z.string().min(1, "Pick the effective date."),
    branchId: z.string(),
    designation: z.string(),
    gradeId: z.string(),
    ctc: z.string(),
    location: z.string(),
    endDate: z.string(),
    lastDay: z.string(),
    reason: z.string(),
    currentBranch: z.string(),
    currentCtc: z.string(),
  })
  .superRefine((v, ctx) => {
    const req = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (v.effectiveDate && v.effectiveDate < "2026-01-01") req("effectiveDate", "Back-dating before 1 Jan 2026 needs a payroll re-open — raise it with Payroll.");
    if (v.type === "promote") {
      if (!v.designation) req("designation", "Pick the new designation.");
      if (!v.gradeId) req("gradeId", "Pick the new grade.");
      if (!v.ctc || Number.isNaN(Number(v.ctc))) req("ctc", "Enter the new annual CTC.");
      else if (Number(v.ctc) <= Number(v.currentCtc)) req("ctc", `Must be higher than the current ${inr(Number(v.currentCtc))}.`);
    }
    if (v.type === "redesignate" && !v.designation) req("designation", "Pick the new designation.");
    if (v.type === "transfer") {
      if (!v.branchId) req("branchId", "Pick the receiving branch.");
      else if (v.branchId === v.currentBranch) req("branchId", "That is the employee's current branch.");
    }
    if (v.type === "deputation") {
      if (!v.location.trim()) req("location", "Where is the employee deputed to?");
      if (!v.endDate) req("endDate", "Deputation needs an end date.");
      else if (v.endDate <= v.effectiveDate) req("endDate", "End date must be after the effective date.");
    }
    if (["resign", "terminate", "retire"].includes(v.type)) {
      if (!v.lastDay) req("lastDay", "Set the last working day.");
      else if (v.effectiveDate && v.lastDay < v.effectiveDate) req("lastDay", "Last working day can't be before the effective date.");
    }
    if (["resign", "terminate", "suspend"].includes(v.type) && v.reason.trim().length < 10)
      req("reason", "Record the reason in at least 10 characters — it goes on the employee's file.");
  });

type Values = z.infer<typeof schema>;

const receivingManager = (e: Employee, branchId: string) =>
  EMPLOYEES.find((x) => x.branchId === branchId && x.departmentId === e.departmentId && x.level === 2 && x.code !== e.code)?.code ??
  EMPLOYEES.find((x) => x.departmentId === e.departmentId && x.level === 1)?.code ??
  "STL-0009";

export function buildChanges(e: Employee, v: Values): LifecycleChange[] {
  const t = v.type as WizardType;
  switch (t) {
    case "confirm":
      return [
        { field: "Status", from: "Probation", to: "Confirmed" },
        { field: "Notice period", from: "15 days", to: "60 days" },
      ];
    case "promote":
      return [
        { field: "Designation", from: e.designation, to: v.designation },
        { field: "Grade", from: gradeById(e.gradeId)?.label ?? e.gradeId, to: gradeById(v.gradeId)?.label ?? v.gradeId },
        { field: "Annual CTC", from: inr(e.ctc), to: v.ctc ? inr(Number(v.ctc)) : "—" },
      ];
    case "redesignate":
      return [{ field: "Designation", from: e.designation, to: v.designation || "—" }];
    case "transfer":
      return [
        { field: "Branch", from: branchById(e.branchId)?.name ?? e.branchId, to: branchById(v.branchId)?.name ?? "—" },
        { field: "Reporting manager", from: employeeName(e.managerCode), to: v.branchId ? employeeName(receivingManager(e, v.branchId)) : "—" },
        { field: "Timezone", from: branchById(e.branchId)?.timezone ?? "—", to: branchById(v.branchId)?.timezone ?? "—" },
      ];
    case "deputation":
      return [
        { field: "Deputed to", from: "—", to: v.location || "—" },
        { field: "Until", from: "—", to: v.endDate ? fmtDate(v.endDate) : "—" },
      ];
    case "suspend":
      return [
        { field: "Status", from: "Active", to: "Suspended" },
        { field: "Payroll", from: "Full pay", to: "Subsistence allowance — 50%" },
      ];
    case "reinstate":
      return [{ field: "Status", from: "Suspended", to: "Active" }];
    case "resign":
    case "terminate":
    case "retire":
      return [
        { field: "Status", from: "Active", to: t === "resign" ? "Notice period" : t === "retire" ? "Retired" : "Separated (terminated)" },
        { field: "Last working day", from: "—", to: v.lastDay ? fmtDate(v.lastDay) : "—" },
        ...(v.reason ? [{ field: "Reason", from: "—", to: v.reason }] : []),
      ];
  }
}

function chainFor(e: Employee, t: LifecycleType, initiator: string): ApprovalStep[] {
  const steps: ApprovalStep[] = [];
  if (e.managerCode && e.managerCode !== initiator) steps.push({ step: "Reporting manager", approverCode: e.managerCode, status: "pending" });
  if (["promote", "terminate", "transfer", "deputation", "retire"].includes(t)) steps.push({ step: "Department head", approverCode: "STL-0004", status: "waiting" });
  steps.push({ step: "HR business partner", approverCode: "STL-0009", status: "waiting" });
  if (steps[0]) steps[0].status = "pending";
  return steps;
}

const STEPS = ["Employee", "Event", "Changes", "Impact & approval"];

export function LifecycleWizard({
  open,
  onOpenChange,
  initiatorCode,
  initialEmployeeCode,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initiatorCode: string;
  /** Pre-selects this employee and opens on the Event step (deep link from a profile). */
  initialEmployeeCode?: string;
  onSubmit: (ev: Omit<LifecycleEvent, "id">) => void;
}) {
  const [step, setStep] = React.useState(0);
  const [query, setQuery] = React.useState("");
  const [code, setCode] = React.useState<string | null>(null);
  const [discard, setDiscard] = React.useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "",
      effectiveDate: "",
      branchId: "",
      designation: "",
      gradeId: "",
      ctc: "",
      location: "",
      endDate: "",
      lastDay: "",
      reason: "",
      currentBranch: "",
      currentCtc: "0",
    },
  });
  const values = useWatch({ control: form.control }) as Values;
  const emp = code ? employeeByCode(code) : undefined;
  const type = values.type as WizardType | "";

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? EMPLOYEES.filter((e) => e.name.toLowerCase().includes(q) || e.code.toLowerCase().includes(q) || e.designation.toLowerCase().includes(q)) : EMPLOYEES.filter((e) => e.level >= 2);
    return list.slice(0, 8);
  }, [query]);

  const reset = () => {
    setStep(0);
    setQuery("");
    setCode(null);
    form.reset();
  };

  const close = (v: boolean) => {
    if (v) return onOpenChange(true);
    if (code || form.formState.isDirty) setDiscard(true);
    else {
      reset();
      onOpenChange(false);
    }
  };

  const pickEmployee = (e: Employee) => {
    setCode(e.code);
    form.setValue("currentBranch", e.branchId);
    form.setValue("currentCtc", String(e.ctc));
  };

  /* Opened from a profile — start with that employee already chosen. */
  const { setValue } = form;
  React.useEffect(() => {
    if (!open || !initialEmployeeCode) return;
    const e = employeeByCode(initialEmployeeCode);
    if (!e) return;
    setCode(e.code);
    setValue("currentBranch", e.branchId);
    setValue("currentCtc", String(e.ctc));
    setStep(1);
  }, [open, initialEmployeeCode, setValue]);

  const pickType = (t: WizardType) => {
    form.setValue("type", t, { shouldDirty: true });
    if (emp) {
      if (t === "promote") {
        const list = DESIGNATIONS[emp.departmentId] ?? [];
        const i = list.indexOf(emp.designation);
        form.setValue("designation", list[Math.min(list.length - 1, i + 1)] ?? emp.designation);
        form.setValue("gradeId", `G${Math.min(7, Number(emp.gradeId.slice(1)) + 1)}`);
        form.setValue("ctc", String(Math.round((emp.ctc * 1.15) / 1000) * 1000));
      }
      if (t === "transfer") form.setValue("branchId", emp.branchId === "BLR" ? "PNQ" : "BLR");
      if (t === "retire") form.setValue("lastDay", "2026-12-31");
    }
  };

  const next = async () => {
    if (step === 2) {
      const ok = await form.trigger();
      if (!ok) return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const submit = form.handleSubmit((v) => {
    if (!emp) return;
    onSubmit({
      employeeCode: emp.code,
      type: v.type as LifecycleType,
      effectiveDate: v.effectiveDate,
      changes: buildChanges(emp, v),
      status: "pending",
      initiatedBy: initiatorCode,
      initiatedOn: DEMO_TODAY,
      chain: chainFor(emp, v.type as LifecycleType, initiatorCode),
    });
    reset();
    onOpenChange(false);
  });

  const err = (k: keyof Values) => form.formState.errors[k]?.message;
  const designations = emp ? DESIGNATIONS[emp.departmentId] ?? [] : [];
  const changes = emp && type ? buildChanges(emp, values) : [];

  return (
    <>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Record lifecycle event</DialogTitle>
            <DialogDescription>
              Step {step + 1} of {STEPS.length} · {STEPS[step]}
            </DialogDescription>
            <ol className="mt-2 grid grid-cols-4 gap-1" aria-label="Progress">
              {STEPS.map((s, i) => (
                <li key={s} className="flex flex-col gap-1">
                  <span className={cn("h-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
                  <span className={cn("text-[10px]", i === step ? "font-semibold text-foreground" : "text-muted-foreground")} aria-current={i === step ? "step" : undefined}>
                    {s}
                  </span>
                </li>
              ))}
            </ol>
          </DialogHeader>
          <DialogBody className="min-h-[300px]">
            {step === 0 && (
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, code or designation…" className="pl-8" aria-label="Search employees" />
                </div>
                <div role="radiogroup" aria-label="Employee" className="flex flex-col gap-1">
                  {matches.map((e) => (
                    <button
                      key={e.code}
                      type="button"
                      role="radio"
                      aria-checked={code === e.code}
                      onClick={() => pickEmployee(e)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md border px-2.5 py-1.5 text-left transition-colors",
                        code === e.code ? "border-primary bg-primary-soft" : "border-border hover:bg-muted",
                      )}
                    >
                      <Avatar name={e.name} size={26} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{e.name}</span>
                        <span className="tnum block truncate text-[11px] text-muted-foreground">
                          {e.code} · {e.designation} · {deptName(e.departmentId)} · {branchById(e.branchId)?.city}
                        </span>
                      </span>
                      <StatusBadge status={e.status} />
                    </button>
                  ))}
                  {!matches.length && <p className="py-6 text-center text-xs text-muted-foreground">No employee matches “{query}”.</p>}
                </div>
              </div>
            )}

            {step === 1 && emp && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">
                  What is happening to <span className="font-medium text-foreground">{emp.name}</span>? Joins and rehires start from Onboarding.
                </p>
                <div role="radiogroup" aria-label="Event type" className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {WIZARD_TYPES.map(({ type: t, icon: Icon, hint }) => {
                    const disabled = (t === "confirm" && emp.status !== "probation") || (t === "reinstate" && emp.status === "active");
                    return (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={type === t}
                        disabled={disabled}
                        onClick={() => pickType(t)}
                        className={cn(
                          "flex items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45",
                          type === t ? "border-primary bg-primary-soft" : "border-border hover:bg-muted",
                        )}
                      >
                        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span>
                          <span className="block text-xs font-semibold">{LIFECYCLE_LABEL[t]}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {disabled ? (t === "confirm" ? "Already confirmed" : "Not suspended") : hint}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 2 && emp && type && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <Field label="Effective date" htmlFor="lc-eff" required error={err("effectiveDate")}>
                    <Input id="lc-eff" type="date" aria-invalid={!!err("effectiveDate")} {...form.register("effectiveDate")} />
                  </Field>
                  {(type === "promote" || type === "redesignate") && (
                    <Field label="New designation" htmlFor="lc-des" required error={err("designation")}>
                      <Controller
                        control={form.control}
                        name="designation"
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger id="lc-des" aria-invalid={!!err("designation")}>
                              <SelectValue placeholder="Select designation" />
                            </SelectTrigger>
                            <SelectContent>
                              {[...new Set(designations)].map((d) => (
                                <SelectItem key={d} value={d}>
                                  {d}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </Field>
                  )}
                  {type === "promote" && (
                    <>
                      <Field label="New grade" htmlFor="lc-grade" required error={err("gradeId")}>
                        <Controller
                          control={form.control}
                          name="gradeId"
                          render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger id="lc-grade">
                                <SelectValue placeholder="Select grade" />
                              </SelectTrigger>
                              <SelectContent>
                                {GRADES.map((g) => (
                                  <SelectItem key={g.id} value={g.id}>
                                    {g.label} ({inr(g.minCtc)} – {inr(g.maxCtc)})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </Field>
                      <Field label="New annual CTC (₹)" htmlFor="lc-ctc" required error={err("ctc")} hint={`Current ${inr(emp.ctc)}`}>
                        <Input id="lc-ctc" inputMode="numeric" aria-invalid={!!err("ctc")} {...form.register("ctc")} />
                      </Field>
                    </>
                  )}
                  {type === "transfer" && (
                    <Field label="Receiving branch" htmlFor="lc-branch" required error={err("branchId")}>
                      <Controller
                        control={form.control}
                        name="branchId"
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger id="lc-branch" aria-invalid={!!err("branchId")}>
                              <SelectValue placeholder="Select branch" />
                            </SelectTrigger>
                            <SelectContent>
                              {BRANCHES.map((b) => (
                                <SelectItem key={b.id} value={b.id}>
                                  {b.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </Field>
                  )}
                  {type === "deputation" && (
                    <>
                      <Field label="Deputed to" htmlFor="lc-loc" required error={err("location")}>
                        <Input id="lc-loc" placeholder="Newark NJ (client site — Meridian Health)" aria-invalid={!!err("location")} {...form.register("location")} />
                      </Field>
                      <Field label="Deputation ends" htmlFor="lc-end" required error={err("endDate")}>
                        <Input id="lc-end" type="date" aria-invalid={!!err("endDate")} {...form.register("endDate")} />
                      </Field>
                    </>
                  )}
                  {["resign", "terminate", "retire"].includes(type) && (
                    <Field label="Last working day" htmlFor="lc-lwd" required error={err("lastDay")}>
                      <Input id="lc-lwd" type="date" aria-invalid={!!err("lastDay")} {...form.register("lastDay")} />
                    </Field>
                  )}
                  {["resign", "terminate", "suspend"].includes(type) && (
                    <Field label="Reason" htmlFor="lc-reason" required error={err("reason")}>
                      <Textarea id="lc-reason" rows={3} aria-invalid={!!err("reason")} {...form.register("reason")} />
                    </Field>
                  )}
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold">Before → after</p>
                  <div className="overflow-hidden rounded-md border border-border">
                    <table className="w-full text-xs">
                      <thead className="bg-subtle text-left">
                        <tr>
                          <th className="px-2 py-1.5 font-semibold">Field</th>
                          <th className="px-2 py-1.5 font-semibold">Before</th>
                          <th className="px-2 py-1.5 font-semibold">After</th>
                        </tr>
                      </thead>
                      <tbody>
                        {changes.map((c) => (
                          <tr key={c.field} className="border-t border-border align-top">
                            <td className="px-2 py-1.5 text-muted-foreground">{c.field}</td>
                            <td className="px-2 py-1.5 text-muted-foreground line-through decoration-muted-foreground/50">{c.from}</td>
                            <td className="px-2 py-1.5 font-medium">{c.to}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {values.effectiveDate && (
                    <p className="tnum mt-1.5 text-[11px] text-muted-foreground">
                      Effective {fmtDate(values.effectiveDate)}
                      {values.effectiveDate < DEMO_TODAY ? " — back-dated; arrears are computed in the next pay run." : "."}
                    </p>
                  )}
                </div>
              </div>
            )}

            {step === 3 && emp && type && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-xs font-semibold">What changes downstream</p>
                  <ul className="flex flex-col gap-1.5">
                    {lifecycleImpact(emp, type).map((i) => (
                      <li key={i.area}>
                        <Alert tone={i.tone} title={i.area}>
                          {i.detail}
                        </Alert>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold">Approval chain</p>
                  <ol className="flex flex-col gap-2">
                    {chainFor(emp, type, initiatorCode).map((s, i) => (
                      <li key={s.step} className="flex items-center gap-2.5">
                        <span className="tnum flex size-6 items-center justify-center rounded-full border border-border text-[11px] font-semibold">{i + 1}</span>
                        <Avatar name={employeeName(s.approverCode)} size={24} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium">{employeeName(s.approverCode)}</span>
                          <span className="block text-[11px] text-muted-foreground">{s.step}</span>
                        </span>
                        {i === 0 && <StatusBadge status="pending" label="First" />}
                      </li>
                    ))}
                  </ol>
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    The change is applied on {values.effectiveDate ? fmtDate(values.effectiveDate) : "the effective date"} only after the last approval. Rejection at any
                    step returns it to you with the comment.
                  </p>
                </div>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            {emp && (
              <span className="mr-auto hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                <Avatar name={emp.name} size={18} />
                {emp.name}
                {type && (
                  <>
                    <ArrowRight className="size-3" aria-hidden />
                    {LIFECYCLE_LABEL[type]}
                  </>
                )}
              </span>
            )}
            {step > 0 && (
              <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={next} disabled={(step === 0 && !code) || (step === 1 && !type)}>
                Continue
              </Button>
            ) : (
              <Button type="button" onClick={submit}>
                <Check aria-hidden />
                Submit for approval
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={discard}
        onOpenChange={setDiscard}
        title="Discard this event?"
        description="Nothing has been submitted yet. Closing loses the employee, event type and changes you entered."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => {
          reset();
          onOpenChange(false);
        }}
      />
    </>
  );
}
