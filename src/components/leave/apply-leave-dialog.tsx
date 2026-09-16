"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { CalendarOff, FileUp, Paperclip, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { DEMO_TODAY, deptName } from "@/mock/org";
import { employeeByCode, employeeName } from "@/mock/employees";
import {
  LEAVE_TYPES,
  LEAVE_TYPE_BY_CODE,
  applicationDays,
  balancesFor,
  countryOf,
  excludedDays,
  type LeaveApplication,
  type LeaveTypeCode,
} from "@/mock/leave";
import { mockAction } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input, RadioGroup, RadioGroupItem, Switch, Textarea } from "@/components/ui/primitives";
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

/* ============================================================================
   Apply for leave.

   The live "N days will be deducted" figure is the whole point of this form:
   it recomputes on every keystroke from the same deductibleDays() helper the
   ledger was generated with, so the preview and the balance can never drift.
   ========================================================================== */

/** Policy constants this form enforces — mirrored in LEAVE_POLICY_RULES. */
const DOC_THRESHOLD_DAYS = 3;
const SL_DOC_THRESHOLD_DAYS = 2;
const MAX_CONSECUTIVE_DAYS = 15;
const BACKDATED_WINDOW_DAYS = 7;
const MIN_NOTICE_DAYS = 3;

const APPLICABLE_TYPES: LeaveTypeCode[] = ["EL", "CL", "SL", "CO", "ML", "PL", "LOP"];

/** Reference numbers for requests raised during the demo session. */
let draftSequence = 0;

const schema = z
  .object({
    typeCode: z.string().min(1, "Choose a leave type"),
    fromDate: z.string().min(1, "Pick the first day of leave"),
    toDate: z.string().min(1, "Pick the last day of leave"),
    halfDayFirst: z.boolean(),
    halfDaySecond: z.boolean(),
    halfDaySession: z.enum(["first_half", "second_half"]),
    reason: z.string().trim().min(10, "Give your manager at least 10 characters of context"),
    contactNumber: z
      .string()
      .trim()
      .min(10, "Enter a number you can be reached on while you are away"),
    documentName: z.string(),
  })
  .superRefine((v, ctx) => {
    if (!v.fromDate || !v.toDate) return;
    if (v.toDate < v.fromDate) {
      ctx.addIssue({ code: "custom", path: ["toDate"], message: "The last day cannot be before the first day" });
      return;
    }
    if (v.fromDate < format(addDays(parseISO(DEMO_TODAY), -BACKDATED_WINDOW_DAYS), "yyyy-MM-dd")) {
      ctx.addIssue({
        code: "custom",
        path: ["fromDate"],
        message: `Backdated beyond ${BACKDATED_WINDOW_DAYS} days — only HR can regularise this`,
      });
    }
    const days = applicationDays(v.typeCode, v.fromDate, v.toDate, v.halfDayFirst, v.halfDaySecond);
    if (days === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["toDate"],
        message: "Every day in this range is a weekend or a holiday — nothing would be deducted",
      });
    }
    if (days > MAX_CONSECUTIVE_DAYS && v.typeCode !== "ML") {
      ctx.addIssue({
        code: "custom",
        path: ["toDate"],
        message: `Policy caps a single request at ${MAX_CONSECUTIVE_DAYS} days. Split it into two requests.`,
      });
    }
    const threshold = v.typeCode === "SL" ? SL_DOC_THRESHOLD_DAYS : DOC_THRESHOLD_DAYS;
    if (days > threshold && !v.documentName) {
      ctx.addIssue({
        code: "custom",
        path: ["documentName"],
        message: `${LEAVE_TYPE_BY_CODE[v.typeCode]?.name ?? "This leave"} beyond ${threshold} days needs a supporting document`,
      });
    }
  });

type FormValues = z.infer<typeof schema>;

const emptyValues = (): FormValues => ({
  typeCode: "EL",
  fromDate: "",
  toDate: "",
  halfDayFirst: false,
  halfDaySecond: false,
  halfDaySession: "first_half",
  reason: "",
  contactNumber: "",
  documentName: "",
});

export function ApplyLeaveDialog({
  open,
  onOpenChange,
  employeeCode,
  onSubmitted,
  prefill,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employeeCode: string;
  onSubmitted: (application: LeaveApplication) => void;
  /** Seeds the form when re-applying after a request was sent back or rejected. */
  prefill?: Partial<FormValues> | null;
}) {
  const employee = employeeByCode(employeeCode);
  const country = countryOf(employeeCode);
  const balances = React.useMemo(() => balancesFor(employeeCode), [employeeCode]);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues(),
    mode: "onSubmit",
  });

  // A fresh form every time the dialog opens — no stale half-day toggles.
  React.useEffect(() => {
    if (open) {
      reset({ ...emptyValues(), contactNumber: employee?.phone ?? "", ...prefill });
      setDragging(false);
    }
    // `prefill` is read only at open time, deliberately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reset, employee?.phone]);

  const typeCode = watch("typeCode");
  const fromDate = watch("fromDate");
  const toDate = watch("toDate");
  const halfDayFirst = watch("halfDayFirst");
  const halfDaySecond = watch("halfDaySecond");
  const reason = watch("reason");
  const documentName = watch("documentName");

  const type = LEAVE_TYPE_BY_CODE[typeCode];
  const multiDay = Boolean(fromDate && toDate && toDate > fromDate);
  const halfDayAllowed = !type?.countsCalendarDays;

  const days = React.useMemo(
    () =>
      applicationDays(
        typeCode,
        fromDate,
        toDate,
        halfDayAllowed && halfDayFirst,
        halfDayAllowed && multiDay && halfDaySecond,
        country,
      ),
    [typeCode, fromDate, toDate, halfDayFirst, halfDaySecond, halfDayAllowed, multiDay, country],
  );

  const skipped = React.useMemo(
    () => (type?.countsCalendarDays ? [] : excludedDays(fromDate, toDate, country)),
    [fromDate, toDate, country, type?.countsCalendarDays],
  );

  const balance = balances.find((b) => b.typeCode === typeCode);
  const docThreshold = typeCode === "SL" ? SL_DOC_THRESHOLD_DAYS : DOC_THRESHOLD_DAYS;
  const needsDocument = days > docThreshold;
  const shortNotice =
    Boolean(fromDate) &&
    typeCode !== "SL" &&
    typeCode !== "LOP" &&
    differenceInCalendarDays(parseISO(fromDate), parseISO(DEMO_TODAY)) < MIN_NOTICE_DAYS &&
    fromDate >= DEMO_TODAY;
  const overdrawn = Boolean(balance) && type?.tracksBalance && days > (balance?.available ?? 0);

  // Stop asking for a document the moment the request drops back under the threshold.
  React.useEffect(() => {
    if (!needsDocument && documentName) setValue("documentName", "", { shouldValidate: false });
  }, [needsDocument, documentName, setValue]);

  React.useEffect(() => {
    if (!multiDay && halfDaySecond) setValue("halfDaySecond", false);
  }, [multiDay, halfDaySecond, setValue]);

  const attach = (name: string) => {
    setValue("documentName", name, { shouldValidate: true });
    mockAction("Document attached", { description: `${name} — stored against the request.`, tone: "info" });
  };

  const onSubmit = (values: FormValues) => {
    const finalHalfFirst = halfDayAllowed && values.halfDayFirst;
    const finalHalfSecond = halfDayAllowed && multiDay && values.halfDaySecond;
    const calendarDays = differenceInCalendarDays(parseISO(values.toDate), parseISO(values.fromDate)) + 1;
    const approverCode = employee?.managerCode ?? "STL-0001";
    const application: LeaveApplication = {
      id: `LV-2026-${String(9001 + draftSequence++).padStart(4, "0")}`,
      employeeCode,
      employeeName: employee?.name ?? employeeCode,
      department: deptName(employee?.departmentId ?? ""),
      departmentId: employee?.departmentId ?? "",
      branchId: employee?.branchId ?? "BLR",
      typeCode: values.typeCode as LeaveTypeCode,
      typeName: LEAVE_TYPE_BY_CODE[values.typeCode]?.name ?? values.typeCode,
      fromDate: values.fromDate,
      toDate: values.toDate,
      halfDayFirst: finalHalfFirst,
      halfDaySecond: finalHalfSecond,
      halfDaySession: finalHalfFirst || finalHalfSecond ? values.halfDaySession : null,
      days,
      calendarDays,
      sandwichDays: Math.max(0, calendarDays - days),
      reason: values.reason.trim(),
      status: "pending",
      appliedOn: DEMO_TODAY,
      approverCode,
      approverName: employeeName(approverCode),
      decidedOn: null,
      decisionComment: null,
      documentName: values.documentName || null,
      contactNumber: values.contactNumber.trim(),
      isBackdated: values.fromDate < DEMO_TODAY,
    };
    onSubmitted(application);
    mockAction("Leave application submitted", {
      description: `${application.id} · ${days} day${days === 1 ? "" : "s"} of ${application.typeName}, ${fmtDate(values.fromDate)} to ${fmtDate(values.toDate)}. Sent to ${application.approverName}.`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Apply for leave</DialogTitle>
          <DialogDescription>
            {employee?.name ?? employeeCode} · {employee?.designation ?? "—"} · approver{" "}
            {employeeName(employee?.managerCode ?? "STL-0001")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="flex flex-col gap-3.5">
            <Field label="Leave type" htmlFor="leave-type" error={errors.typeCode?.message} required>
              <Controller
                control={control}
                name="typeCode"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="leave-type" aria-label="Leave type">
                      <SelectValue placeholder="Choose a leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      {APPLICABLE_TYPES.map((code) => {
                        const t = LEAVE_TYPE_BY_CODE[code];
                        const b = balances.find((x) => x.typeCode === code);
                        return (
                          <SelectItem key={code} value={code}>
                            {t.name}
                            {t.tracksBalance ? ` · ${b?.available ?? 0} available` : " · unpaid"}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            {type && (
              <p className="-mt-1.5 text-xs text-muted-foreground">{type.description}</p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="From" htmlFor="from-date" error={errors.fromDate?.message} required>
                <Input
                  id="from-date"
                  type="date"
                  aria-invalid={!!errors.fromDate}
                  {...register("fromDate", {
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                      // Keep the range valid while the user types.
                      if (!toDate || toDate < e.target.value) setValue("toDate", e.target.value);
                    },
                  })}
                />
              </Field>
              <Field label="To" htmlFor="to-date" error={errors.toDate?.message} required>
                <Input id="to-date" type="date" min={fromDate || undefined} aria-invalid={!!errors.toDate} {...register("toDate")} />
              </Field>
            </div>

            {halfDayAllowed ? (
              <div className="rounded-md border border-border bg-subtle p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium">Half day</p>
                    <p className="text-xs text-muted-foreground">
                      Deducts 0.5 instead of a full day on the day you mark.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs">
                    <Controller
                      control={control}
                      name="halfDayFirst"
                      render={({ field }) => (
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          aria-label="First day is a half day"
                        />
                      )}
                    />
                    <span>{multiDay ? "First day" : "This day"}</span>
                  </label>
                  {multiDay && (
                    <label className="flex items-center gap-2 text-xs">
                      <Controller
                        control={control}
                        name="halfDaySecond"
                        render={({ field }) => (
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            aria-label="Last day is a half day"
                          />
                        )}
                      />
                      <span>Last day</span>
                    </label>
                  )}
                </div>
                {(halfDayFirst || halfDaySecond) && (
                  <div className="mt-2.5 border-t border-border pt-2.5">
                    <Controller
                      control={control}
                      name="halfDaySession"
                      render={({ field }) => (
                        <RadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
                          className="flex flex-wrap gap-4"
                          aria-label="Which half of the day"
                        >
                          {[
                            { v: "first_half", l: "First half (09:30 – 13:30)" },
                            { v: "second_half", l: "Second half (13:30 – 18:30)" },
                          ].map((o) => (
                            <label key={o.v} className="flex cursor-pointer items-center gap-2 text-xs">
                              <RadioGroupItem value={o.v} id={`half-${o.v}`} />
                              {o.l}
                            </label>
                          ))}
                        </RadioGroup>
                      )}
                    />
                  </div>
                )}
              </div>
            ) : (
              <Alert tone="info" icon={CalendarOff}>
                {type?.name} is counted in calendar days — weekends and holidays inside the range are
                included and half days are not available.
              </Alert>
            )}

            {/* live deduction preview */}
            <div
              className={cn(
                "rounded-md border p-3",
                overdrawn ? "border-destructive/25 bg-destructive-soft" : "border-primary/25 bg-primary-soft",
              )}
              aria-live="polite"
            >
              <p
                className={cn(
                  "text-sm font-semibold",
                  overdrawn ? "text-destructive-fg" : "text-primary-soft-foreground",
                )}
              >
                <span className="tnum">{days}</span> day{days === 1 ? "" : "s"} will be deducted
                {type?.tracksBalance && balance
                  ? ` — ${Math.round((balance.available - days) * 100) / 100} of ${balance.available} ${type.code} would remain`
                  : type && !type.paid
                    ? " — unpaid, this reduces the month's payable days"
                    : ""}
              </p>
              {skipped.length > 0 && (
                <ul className="mt-1.5 flex flex-col gap-0.5">
                  {skipped.slice(0, 6).map((s) => (
                    <li key={s.date} className="text-xs text-muted-foreground">
                      {fmtDate(s.date)} — not deducted ({s.reason.kind === "weekend" ? s.reason.label : s.reason.label})
                    </li>
                  ))}
                  {skipped.length > 6 && (
                    <li className="text-xs text-muted-foreground">
                      +{skipped.length - 6} more weekend or holiday days excluded
                    </li>
                  )}
                </ul>
              )}
              {!fromDate && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Pick a date range — weekends and gazetted holidays are excluded automatically.
                </p>
              )}
            </div>

            {overdrawn && (
              <Alert tone="danger" icon={TriangleAlert} title="Not enough balance">
                You hold {balance?.available} day{balance?.available === 1 ? "" : "s"} of {type?.name}. The
                shortfall of {Math.round((days - (balance?.available ?? 0)) * 100) / 100} day
                {days - (balance?.available ?? 0) === 1 ? "" : "s"} will be booked as Loss of Pay.
              </Alert>
            )}

            {shortNotice && (
              <Alert tone="warning" icon={TriangleAlert} title="Short notice">
                Policy asks for {MIN_NOTICE_DAYS} days of notice. Your manager will see this request flagged
                as short notice.
              </Alert>
            )}

            <Field
              label="Reason"
              htmlFor="reason"
              error={errors.reason?.message}
              required
              hint={`${reason?.trim().length ?? 0} / 10 characters minimum`}
            >
              <Textarea
                id="reason"
                placeholder="e.g. Sister's wedding in Mysuru — travelling on the 14th"
                aria-invalid={!!errors.reason}
                {...register("reason")}
              />
            </Field>

            <Field
              label="Contact number while away"
              htmlFor="contact"
              error={errors.contactNumber?.message}
              required
            >
              <Input id="contact" inputMode="tel" aria-invalid={!!errors.contactNumber} {...register("contactNumber")} />
            </Field>

            {needsDocument && (
              <Field
                label="Supporting document"
                error={errors.documentName?.message}
                required
                hint={`Required above ${docThreshold} days for ${type?.name ?? "this leave type"}.`}
              >
                {documentName ? (
                  <div className="flex items-center gap-2 rounded-md border border-border bg-subtle px-2.5 py-2">
                    <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-xs">{documentName}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${documentName}`}
                      onClick={() => setValue("documentName", "", { shouldValidate: true })}
                    >
                      <X />
                    </Button>
                  </div>
                ) : (
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="Attach a supporting document"
                    onClick={() => fileRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        fileRef.current?.click();
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragging(false);
                      const f = e.dataTransfer.files?.[0];
                      attach(f?.name ?? "supporting-document.pdf");
                    }}
                    className={cn(
                      "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed px-4 py-6 text-center transition-colors",
                      dragging ? "border-primary bg-primary-soft" : "border-border hover:bg-muted",
                      errors.documentName && "border-destructive",
                    )}
                  >
                    <FileUp className="size-4 text-muted-foreground" aria-hidden />
                    <p className="text-xs font-medium">Drop a file here, or click to browse</p>
                    <p className="text-xs text-muted-foreground">
                      Medical certificate, invitation or booking confirmation · PDF, JPG up to 5 MB
                    </p>
                    <input
                      ref={fileRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) attach(f.name);
                        e.target.value = "";
                      }}
                    />
                  </div>
                )}
              </Field>
            )}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Submit for approval
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
