"use client";

import * as React from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isValid, parseISO } from "date-fns";
import { AlertTriangle, Check, Plus, Save, Trash2, TriangleAlert } from "lucide-react";
import { cn, round2 } from "@/lib/utils";
import { fmtDate, inr } from "@/lib/format";
import { DEMO_TODAY, deptName } from "@/mock/org";
import { employeeByCode, employeeName } from "@/mock/employees";
import {
  EXPENSE_CATEGORIES,
  policyFor,
  type ExpenseCategory,
  type ExpenseClaim,
  type ExpenseLine,
} from "@/mock/workplace";
import { Button } from "@/components/ui/button";
import { Badge, Field, Input, Label } from "@/components/ui/primitives";
import {
  AiFilledTag,
  DuplicateReceiptWarning,
  ExpensePolicyCheck,
  ReceiptReader,
  aiFieldClass,
  findDuplicate,
  type AiLineField,
  type ReceiptRead,
} from "@/components/ai/embed/expense-ai";
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
  useDiscardGuard,
} from "@/components/ui/overlays";

/* ============================================================================
   New / edit expense claim — RHF + zod with one field-array row per receipt.

   A line needs a category, a date on or before today, a description and an
   amount above zero. Over-limit lines are allowed (the approver records an
   exception) but are flagged inline with the exact cap they clear.
   ========================================================================== */

const MAX_LINE_AMOUNT = 500000;

const lineSchema = z.object({
  category: z
    .string()
    .refine((v) => EXPENSE_CATEGORIES.includes(v as ExpenseCategory), "Pick a category"),
  date: z
    .string()
    .min(1, "Date is required")
    .refine((v) => isValid(parseISO(v)), "Enter a real calendar date")
    .refine((v) => !isValid(parseISO(v)) || v <= DEMO_TODAY, `Cannot be after ${fmtDate(DEMO_TODAY)}`),
  description: z.string().trim().min(3, "Say what this was for"),
  amount: z
    .string()
    .trim()
    .min(1, "Enter an amount")
    .refine((v) => Number.isFinite(Number(v)), "Enter a number")
    .refine((v) => !Number.isFinite(Number(v)) || Number(v) > 0, "Must be more than ₹0")
    .refine((v) => Number(v) <= MAX_LINE_AMOUNT, `Above ${inr(MAX_LINE_AMOUNT, { decimals: false })} — split it`),
  /** Fields the receipt OCR filled and the claimant has not edited since. */
  aiFields: z.array(z.string()),
  /** File name of a receipt read by the OCR, if any. */
  receipt: z.string(),
});

const schema = z.object({
  purpose: z
    .string()
    .trim()
    .min(6, "Give the claim a purpose of at least 6 characters — approvers read this first"),
  lines: z.array(lineSchema).min(1, "Add at least one line"),
});

type ClaimValues = z.infer<typeof schema>;
type LineValues = ClaimValues["lines"][number];

const blankLine = (): LineValues => ({ category: "", date: DEMO_TODAY, description: "", amount: "", aiFields: [], receipt: "" });

const valuesFrom = (claim: ExpenseClaim | null | undefined): ClaimValues =>
  claim
    ? {
        purpose: claim.purpose,
        lines: claim.lines.map((l) => ({
          category: l.category,
          date: l.date,
          description: l.description,
          amount: String(l.amount),
          aiFields: [],
          receipt: l.receipt,
        })),
      }
    : { purpose: "", lines: [blankLine()] };

/** Claim numbers for claims raised during the demo session. */
let claimSequence = 0;

export type ClaimSaveMode = "draft" | "submit";

export function ExpenseClaimDialog({
  open,
  onOpenChange,
  employeeCode,
  claim,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employeeCode: string;
  /** A draft being edited; null raises a new claim. */
  claim?: ExpenseClaim | null;
  onSave: (claim: ExpenseClaim, mode: ClaimSaveMode) => void;
}) {
  const form = useForm<ClaimValues>({ resolver: zodResolver(schema), defaultValues: valuesFrom(claim) });
  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    getValues,
    setValue,
    formState: { errors, isDirty },
  } = form;
  const { fields, append, remove, update, replace } = useFieldArray({ control, name: "lines" });

  /* A fresh form every time the dialog opens, seeded from the draft if any. */
  React.useEffect(() => {
    if (open) reset(valuesFrom(claim));
  }, [open, claim, reset]);

  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);
  const { requestClose, guard } = useDiscardGuard(isDirty, close);

  const lines = watch("lines");

  /* ---- receipt OCR: fill the first blank line (or a new one), undoably */
  const [undoFill, setUndoFill] = React.useState<ClaimValues["lines"] | null>(null);
  React.useEffect(() => {
    if (open) setUndoFill(null);
  }, [open]);
  const applyRead = (r: ReceiptRead) => {
    const before = getValues("lines");
    setUndoFill(before);
    const filled: LineValues = {
      category: r.category,
      date: r.date,
      description: r.description,
      amount: String(r.amount),
      aiFields: ["category", "date", "description", "amount"],
      receipt: r.receipt,
    };
    const blank = before.findIndex((l) => !l.category && !l.amount && !l.description.trim());
    if (blank >= 0) update(blank, filled);
    else append(filled);
  };
  const undoRead = () => {
    if (!undoFill) return;
    replace(undoFill);
    setUndoFill(null);
  };
  /** The claimant edited a field — it is theirs now, not the AI's. */
  const touchField = (i: number, k: AiLineField) => {
    const cur = getValues(`lines.${i}.aiFields`) ?? [];
    if (cur.includes(k)) setValue(`lines.${i}.aiFields`, cur.filter((x) => x !== k));
  };
  const total = round2(lines.reduce((a, l) => a + (Number(l.amount) > 0 ? Number(l.amount) : 0), 0));
  const overLimit = lines.filter((l) => {
    const p = policyFor(l.category);
    return p && Number(l.amount) > p.limit;
  }).length;

  const build = (v: ClaimValues, mode: ClaimSaveMode): ExpenseClaim => {
    const emp = employeeByCode(employeeCode);
    const claimNo = claim?.claimNo ?? `EXP-2026-${String(901 + claimSequence++).padStart(4, "0")}`;
    const built: ExpenseLine[] = v.lines.map((l, i) => {
      const p = policyFor(l.category)!;
      const amount = round2(Number(l.amount));
      const excess = Math.max(0, round2(amount - p.limit));
      return {
        id: `${claimNo}-L${i + 1}`,
        category: l.category as ExpenseCategory,
        date: l.date,
        description: l.description.trim(),
        amount,
        receipt: l.receipt || (claim?.lines[i]?.receipt ?? `receipt-${claimNo.toLowerCase()}-${i + 1}.jpg`),
        receiptKind: claim?.lines[i]?.receiptKind ?? "photo",
        limit: p.limit,
        limitBasis: p.basis,
        excess,
        violation: excess > 0,
      };
    });
    const dates = built.map((l) => l.date).sort();
    const approverCode = emp?.managerCode ?? "STL-0008";
    const violationCount = built.filter((l) => l.violation).length;
    return {
      id: claim?.id ?? claimNo,
      claimNo,
      employeeCode,
      employeeName: emp?.name ?? employeeCode,
      department: deptName(emp?.departmentId ?? ""),
      purpose: v.purpose.trim(),
      periodFrom: dates[0],
      periodTo: dates[dates.length - 1],
      lines: built,
      total: round2(built.reduce((a, l) => a + l.amount, 0)),
      status: mode === "submit" ? "submitted" : "draft",
      submittedOn: mode === "submit" ? `${DEMO_TODAY}T14:35:00` : null,
      approverCode,
      approverName: employeeName(approverCode),
      decidedOn: null,
      decisionNote: null,
      reimbursedOn: null,
      violationCount,
      hasViolation: violationCount > 0,
      search: `${claimNo} ${emp?.name ?? ""} ${employeeCode} ${v.purpose}`.toLowerCase(),
    };
  };

  const save = (mode: ClaimSaveMode) =>
    handleSubmit((v) => {
      onSave(build(v, mode), mode);
      close();
    });

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : requestClose())}>
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>{claim ? `Edit draft ${claim.claimNo}` : "New expense claim"}</DialogTitle>
            <DialogDescription>
              Add a line per receipt. The running total and any policy breach update as you type. Routed to{" "}
              {employeeName(employeeByCode(employeeCode)?.managerCode ?? "STL-0008")} on submit.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={save("submit")} className="flex min-h-0 flex-1 flex-col">
            <DialogBody className="flex flex-col gap-3">
              <Field
                label="Purpose"
                htmlFor="claim-purpose"
                required
                error={errors.purpose?.message}
                hint="One line an approver can act on, e.g. “Client visit — Mumbai, 8–10 Sep”."
              >
                <Input
                  id="claim-purpose"
                  placeholder="Client visit — Mumbai, 8–10 Sep"
                  aria-invalid={!!errors.purpose}
                  {...register("purpose")}
                />
              </Field>

              <ReceiptReader
                employeeCode={employeeCode}
                onRead={applyRead}
                onUndo={undoRead}
                canUndo={undoFill !== null}
              />

              <div className="flex items-center justify-between">
                <Label>Lines</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => append(blankLine())}>
                  <Plus /> Add line
                </Button>
              </div>

              <ul className="flex flex-col gap-2">
                {fields.map((f, i) => {
                  const line = lines[i];
                  const p = policyFor(line?.category ?? "");
                  const excess = p ? Math.max(0, Number(line?.amount) - p.limit) : 0;
                  const e = errors.lines?.[i];
                  const ai = (k: AiLineField) => !!line?.aiFields?.includes(k);
                  const dup = line ? findDuplicate(employeeCode, line, claim?.claimNo) : null;
                  const anyAi = (line?.aiFields?.length ?? 0) > 0;
                  return (
                    <li
                      key={f.id}
                      className={cn(
                        "rounded-md border p-2.5",
                        excess > 0 ? "border-warning/40 bg-warning-soft/40" : "border-border",
                      )}
                    >
                      <div className="grid gap-2 sm:grid-cols-[160px_140px_1fr_120px_32px]">
                        <div className="flex flex-col gap-1">
                          <Controller
                            control={control}
                            name={`lines.${i}.category`}
                            render={({ field }) => (
                              <Select
                                value={field.value}
                                onValueChange={(v) => {
                                  field.onChange(v);
                                  touchField(i, "category");
                                }}
                              >
                                <SelectTrigger
                                  size="sm"
                                  aria-label={`Line ${i + 1} category`}
                                  aria-invalid={!!e?.category}
                                  className={aiFieldClass(ai("category"))}
                                >
                                  <span className={cn("truncate text-xs", !field.value && "text-muted-foreground")}>
                                    {field.value || "Category"}
                                  </span>
                                </SelectTrigger>
                                <SelectContent>
                                  {EXPENSE_CATEGORIES.map((c) => (
                                    <SelectItem key={c} value={c}>
                                      {c}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                          <AiFilledTag show={ai("category")} />
                          <LineError message={e?.category?.message} />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Input
                            type="date"
                            max={DEMO_TODAY}
                            aria-label={`Line ${i + 1} date`}
                            aria-invalid={!!e?.date}
                            className={cn("h-7 text-xs", aiFieldClass(ai("date")))}
                            {...register(`lines.${i}.date`, { onChange: () => touchField(i, "date") })}
                          />
                          <AiFilledTag show={ai("date")} />
                          <LineError message={e?.date?.message} />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Input
                            aria-label={`Line ${i + 1} description`}
                            aria-invalid={!!e?.description}
                            placeholder="What was this for?"
                            className={cn("h-7 text-xs", aiFieldClass(ai("description")))}
                            {...register(`lines.${i}.description`, { onChange: () => touchField(i, "description") })}
                          />
                          <AiFilledTag show={ai("description")} label="AI-filled · merchant" />
                          <LineError message={e?.description?.message} />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step="0.01"
                            aria-label={`Line ${i + 1} amount`}
                            aria-invalid={!!e?.amount}
                            placeholder="0"
                            className={cn("tnum h-7 text-xs", aiFieldClass(ai("amount")))}
                            {...register(`lines.${i}.amount`, { onChange: () => touchField(i, "amount") })}
                          />
                          <AiFilledTag show={ai("amount")} />
                          <LineError message={e?.amount?.message} />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove line ${i + 1}`}
                          disabled={fields.length === 1}
                          onClick={() => remove(i)}
                        >
                          <Trash2 />
                        </Button>
                      </div>

                      {(anyAi || (p && Number(line?.amount) > 0)) && (
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                          <span>
                            {anyAi
                              ? `Read from ${line.receipt} — check the highlighted fields before submitting.`
                              : line?.receipt
                                ? `Receipt ${line.receipt}`
                                : null}
                          </span>
                          <ExpensePolicyCheck category={line.category} amount={Number(line.amount)} />
                        </div>
                      )}
                      {dup && <DuplicateReceiptWarning dup={dup} />}
                      {excess > 0 && p && (
                        <p
                          role="alert"
                          className="mt-2 flex items-start gap-1.5 border-t border-warning/30 pt-2 text-[11px] text-warning-fg"
                        >
                          <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
                          <span>
                            Over the {line.category} cap of <strong>{inr(p.limit, { decimals: false })}</strong> (
                            {p.basis}) by <strong>{inr(excess, { decimals: false })}</strong>. You can still submit,
                            but it will need a written exception.
                          </span>
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-subtle px-3 py-2">
                <span className="text-xs font-semibold">
                  Claim total · {fields.length} line{fields.length === 1 ? "" : "s"}
                </span>
                <span className="flex items-center gap-2">
                  {overLimit > 0 && (
                    <Badge variant="outline" className="border-warning/40 text-warning-fg">
                      <TriangleAlert className="size-3" aria-hidden /> {overLimit} over limit
                    </Badge>
                  )}
                  <span className="tnum text-sm font-semibold">{inr(total)}</span>
                </span>
              </div>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={requestClose}>
                Cancel
              </Button>
              <Button type="button" variant="outline" onClick={save("draft")}>
                <Save /> Save draft
              </Button>
              <Button type="submit">
                <Check /> Submit claim
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}

function LineError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-[11px] text-destructive-fg">
      {message}
    </p>
  );
}
