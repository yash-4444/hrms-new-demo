"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isValid, parseISO } from "date-fns";
import { fmtDate, inr } from "@/lib/format";
import { DEMO_TODAY, GRADES, branchById, deptById } from "@/mock/org";
import { employeeByCode } from "@/mock/employees";
import {
  HIRING_BRANCHES,
  HIRING_DEPARTMENTS,
  RECRUITERS,
  REQUISITIONS,
  type Requisition,
} from "@/mock/hiring";
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
} from "@/components/ui/overlays";

/* ============================================================================
   Raise requisition — RHF + zod, inline errors through <Field>.

   Numeric fields are carried as strings and validated with refines (the same
   pattern the Add employee dialog uses) so the resolver's input and output
   types stay identical and there is no coercion typing to fight.
   ========================================================================== */

const DEPT_IDS = HIRING_DEPARTMENTS.map((d) => d.value) as [string, ...string[]];
const BRANCH_IDS = HIRING_BRANCHES.map((b) => b.value) as [string, ...string[]];
const GRADE_IDS = GRADES.map((g) => g.id) as [string, ...string[]];
const PRIORITIES = ["Critical", "High", "Normal"] as [string, ...string[]];

/** Only people who already hold a hiring-manager seat, plus the TA team. */
export const MANAGER_OPTIONS = Array.from(
  new Set(REQUISITIONS.map((r) => r.hiringManagerCode)),
).map((code) => ({
  value: code,
  label: `${employeeByCode(code)?.name ?? code} · ${employeeByCode(code)?.designation ?? ""}`,
}));

const MANAGER_IDS = MANAGER_OPTIONS.map((m) => m.value) as [string, ...string[]];
const RECRUITER_IDS = RECRUITERS.map((r) => r.code) as [string, ...string[]];

const digits = (v: string) => v.replace(/[,\s₹]/g, "");

const schema = z
  .object({
    role: z.string().trim().min(3, "Enter the role title (at least 3 characters)"),
    departmentId: z.enum(DEPT_IDS, { message: "Pick a department" }),
    branchId: z.enum(BRANCH_IDS, { message: "Pick a branch" }),
    gradeId: z.enum(GRADE_IDS, { message: "Pick a grade band" }),
    priority: z.enum(PRIORITIES, { message: "Pick a priority" }),
    headcount: z
      .string()
      .trim()
      .min(1, "Headcount is required")
      .refine((v) => /^\d+$/.test(v), "Enter a whole number")
      .refine((v) => Number(v) >= 1 && Number(v) <= 10, "Headcount must be between 1 and 10"),
    hiringManagerCode: z.enum(MANAGER_IDS, { message: "Pick a hiring manager" }),
    recruiterCode: z.enum(RECRUITER_IDS, { message: "Pick a recruiter" }),
    targetCloseDate: z
      .string()
      .min(1, "Target close date is required")
      .refine((v) => isValid(parseISO(v)), "Enter a real calendar date")
      .refine(
        (v) => !isValid(parseISO(v)) || v > DEMO_TODAY,
        `Target close date must be after ${fmtDate(DEMO_TODAY)}`,
      ),
    budgetMin: z
      .string()
      .trim()
      .min(1, "Minimum of the band is required")
      .refine((v) => /^\d+$/.test(digits(v)), "Enter digits only — no symbol, no decimals")
      .refine((v) => Number(digits(v)) >= 300000, "Minimum CTC must be at least ₹3,00,000"),
    budgetMax: z
      .string()
      .trim()
      .min(1, "Maximum of the band is required")
      .refine((v) => /^\d+$/.test(digits(v)), "Enter digits only — no symbol, no decimals"),
    justification: z
      .string()
      .trim()
      .min(20, "Give the approver a real reason — at least 20 characters"),
  })
  .superRefine((v, ctx) => {
    const min = Number(digits(v.budgetMin));
    const max = Number(digits(v.budgetMax));
    if (Number.isFinite(min) && Number.isFinite(max) && max <= min) {
      ctx.addIssue({
        code: "custom",
        path: ["budgetMax"],
        message: "Maximum of the band must be higher than the minimum",
      });
    }
  });

type RequisitionValues = z.infer<typeof schema>;

export function RaiseRequisitionDialog({
  open,
  onOpenChange,
  nextCode,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  nextCode: string;
  onCreate: (req: Requisition) => void;
}) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RequisitionValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      role: "",
      departmentId: "ENG",
      branchId: "BLR",
      gradeId: "G3",
      priority: "High",
      headcount: "1",
      hiringManagerCode: MANAGER_OPTIONS[0]?.value ?? "STL-0031",
      recruiterCode: RECRUITERS[0]?.code ?? "STL-0058",
      targetCloseDate: "",
      budgetMin: "",
      budgetMax: "",
      justification: "",
    },
  });

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const justification = watch("justification") ?? "";
  const bMin = Number(digits(watch("budgetMin") ?? ""));
  const bMax = Number(digits(watch("budgetMax") ?? ""));

  /* Only reached when zod passes — invalid fields keep the dialog open and
     render their message inline through <Field error=…>. */
  const onSubmit = (v: RequisitionValues) => {
    onCreate({
      id: nextCode,
      code: nextCode,
      role: v.role.trim(),
      departmentId: v.departmentId,
      branchId: v.branchId,
      gradeId: v.gradeId,
      headcount: Number(v.headcount),
      filled: 0,
      hiringManagerCode: v.hiringManagerCode,
      recruiterCode: v.recruiterCode,
      approvalStatus: "pending",
      status: "open",
      raisedDate: DEMO_TODAY,
      targetCloseDate: v.targetCloseDate,
      budgetMinCtc: Number(digits(v.budgetMin)),
      budgetMaxCtc: Number(digits(v.budgetMax)),
      priority: v.priority as Requisition["priority"],
      replacementFor: null,
      justification: v.justification.trim(),
    });
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Raise a requisition</DialogTitle>
          <DialogDescription>
            Creates {nextCode} in <span className="font-medium text-foreground">Pending</span>{" "}
            approval. It reaches the careers site only once the hiring manager, HR and Finance
            have signed off.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                label="Role title"
                htmlFor="rq-role"
                required
                error={errors.role?.message}
                className="sm:col-span-2"
              >
                <Input
                  id="rq-role"
                  placeholder="Senior Backend Engineer"
                  aria-invalid={!!errors.role}
                  {...register("role")}
                />
              </Field>

              <Field label="Department" required error={errors.departmentId?.message}>
                <Controller
                  control={control}
                  name="departmentId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-label="Department">
                        <span className="truncate">
                          {deptById(field.value)?.name ?? field.value}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {HIRING_DEPARTMENTS.map((d) => (
                          <SelectItem key={d.value} value={d.value}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field label="Branch" required error={errors.branchId?.message}>
                <Controller
                  control={control}
                  name="branchId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-label="Branch">
                        <span className="truncate">
                          {branchById(field.value)?.name ?? field.value}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {HIRING_BRANCHES.map((b) => (
                          <SelectItem key={b.value} value={b.value}>
                            {branchById(b.value)?.name ?? b.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field label="Grade band" required error={errors.gradeId?.message}>
                <Controller
                  control={control}
                  name="gradeId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-label="Grade band">
                        <span className="truncate">
                          {GRADES.find((g) => g.id === field.value)?.label ?? field.value}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {GRADES.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field
                label="Headcount"
                htmlFor="rq-headcount"
                required
                error={errors.headcount?.message}
                hint="Positions to fill against this requisition"
              >
                <Input
                  id="rq-headcount"
                  inputMode="numeric"
                  aria-invalid={!!errors.headcount}
                  {...register("headcount")}
                />
              </Field>

              <Field label="Hiring manager" required error={errors.hiringManagerCode?.message}>
                <Controller
                  control={control}
                  name="hiringManagerCode"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-label="Hiring manager">
                        <span className="truncate">
                          {employeeByCode(field.value)?.name ?? field.value}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {MANAGER_OPTIONS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field label="Recruiter" required error={errors.recruiterCode?.message}>
                <Controller
                  control={control}
                  name="recruiterCode"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-label="Recruiter">
                        <span className="truncate">
                          {employeeByCode(field.value)?.name ?? field.value}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {RECRUITERS.map((r) => (
                          <SelectItem key={r.code} value={r.code}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field label="Priority" required error={errors.priority?.message}>
                <Controller
                  control={control}
                  name="priority"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-label="Priority">
                        <span className="truncate">{field.value}</span>
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field
                label="Target close date"
                htmlFor="rq-target"
                required
                error={errors.targetCloseDate?.message}
              >
                <Input
                  id="rq-target"
                  type="date"
                  min={DEMO_TODAY}
                  aria-invalid={!!errors.targetCloseDate}
                  {...register("targetCloseDate")}
                />
              </Field>

              <Field
                label="Budget CTC — minimum"
                htmlFor="rq-min"
                required
                error={errors.budgetMin?.message}
                hint={Number.isFinite(bMin) && bMin > 0 ? inr(bMin, { decimals: false }) : "Annual, in rupees"}
              >
                <Input
                  id="rq-min"
                  inputMode="numeric"
                  placeholder="1800000"
                  aria-invalid={!!errors.budgetMin}
                  {...register("budgetMin")}
                />
              </Field>

              <Field
                label="Budget CTC — maximum"
                htmlFor="rq-max"
                required
                error={errors.budgetMax?.message}
                hint={Number.isFinite(bMax) && bMax > 0 ? inr(bMax, { decimals: false }) : "Annual, in rupees"}
              >
                <Input
                  id="rq-max"
                  inputMode="numeric"
                  placeholder="2400000"
                  aria-invalid={!!errors.budgetMax}
                  {...register("budgetMax")}
                />
              </Field>

              <Field
                label="Justification"
                htmlFor="rq-why"
                required
                error={errors.justification?.message}
                hint={
                  <span className="tnum">
                    {justification.trim().length} / 20 characters minimum
                  </span>
                }
                className="sm:col-span-2"
              >
                <Textarea
                  id="rq-why"
                  rows={4}
                  placeholder="What breaks if this role is not filled? Name the workload, the risk and the date it bites."
                  aria-invalid={!!errors.justification}
                  {...register("justification")}
                />
              </Field>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Raise requisition
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
