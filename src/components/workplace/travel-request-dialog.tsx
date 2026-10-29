"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { differenceInCalendarDays, isValid, parseISO } from "date-fns";
import { Check } from "lucide-react";
import { fmtDate, inr } from "@/lib/format";
import { DEMO_TODAY, deptName } from "@/mock/org";
import { employeeByCode, employeeName } from "@/mock/employees";
import type { TravelLeg, TravelMode, TravelRequest } from "@/mock/workplace";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input } from "@/components/ui/primitives";
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
   New travel request — RHF + zod. One leg is enough to raise the request; the
   travel desk adds the return and any connection. The estimate and the per-diem
   update as the dates move, and the advance cannot exceed the estimate.
   ========================================================================== */

const MODES: TravelMode[] = ["Flight", "Train", "Cab", "Bus"];
const PER_DIEM = { Domestic: 2200, International: 6500 } as const;
const HOTEL_CAP = 6500;

const realDate = (v: string) => isValid(parseISO(v));

const schema = z
  .object({
    purpose: z.string().trim().min(6, "Describe the purpose in at least 6 characters — the approver decides on this line"),
    tripType: z.enum(["Domestic", "International"]),
    from: z.string().trim().min(2, "Where does the trip start?"),
    to: z.string().trim().min(2, "Where are you going?"),
    mode: z.enum(["Flight", "Train", "Cab", "Bus"]),
    depart: z
      .string()
      .min(1, "Pick the departure date")
      .refine(realDate, "Enter a real calendar date")
      .refine((v) => !realDate(v) || v >= DEMO_TODAY, `Departure cannot be before ${fmtDate(DEMO_TODAY)}`),
    back: z.string().min(1, "Pick the return date").refine(realDate, "Enter a real calendar date"),
    advance: z
      .string()
      .trim()
      .refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= 0), "Enter an amount of ₹0 or more"),
  })
  .superRefine((v, ctx) => {
    if (v.from.trim() && v.from.trim().toLowerCase() === v.to.trim().toLowerCase()) {
      ctx.addIssue({ code: "custom", path: ["to"], message: "Destination is the same as the origin" });
    }
    if (realDate(v.depart) && realDate(v.back) && v.back < v.depart) {
      ctx.addIssue({ code: "custom", path: ["back"], message: "The return date cannot be before the departure date" });
    }
    const est = estimate(v);
    if (est && Number(v.advance) > est.total) {
      ctx.addIssue({
        code: "custom",
        path: ["advance"],
        message: `An advance cannot exceed the trip estimate of ${inr(est.total, { decimals: false })}`,
      });
    }
  });

type TravelValues = z.infer<typeof schema>;

/** Fare + hotel + per-diem, from the same rates the policy note quotes. */
function estimate(v: Pick<TravelValues, "depart" | "back" | "mode" | "tripType">) {
  if (!realDate(v.depart) || !realDate(v.back) || v.back < v.depart) return null;
  const nights = differenceInCalendarDays(parseISO(v.back), parseISO(v.depart));
  const fare =
    v.tripType === "International"
      ? 95000
      : v.mode === "Flight"
        ? 14000
        : v.mode === "Train"
          ? 2900
          : v.mode === "Cab"
            ? 3600
            : 2600;
  const perDiem = PER_DIEM[v.tripType] * (nights + 1);
  return { nights, fare, perDiem, total: fare + nights * HOTEL_CAP + perDiem };
}

const DEFAULTS: TravelValues = {
  purpose: "",
  tripType: "Domestic",
  from: "Bengaluru",
  to: "",
  mode: "Flight",
  depart: "",
  back: "",
  advance: "",
};

/** Request numbers for trips raised during the demo session. */
let requestSequence = 0;

export function TravelRequestDialog({
  open,
  onOpenChange,
  employeeCode,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employeeCode: string;
  onSubmitted: (r: TravelRequest) => void;
}) {
  const emp = employeeByCode(employeeCode);
  const approverCode = emp?.managerCode ?? "STL-0001";
  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<TravelValues>({
    resolver: zodResolver(schema),
    defaultValues: { ...DEFAULTS, from: emp?.location ?? DEFAULTS.from },
  });

  React.useEffect(() => {
    if (open) reset({ ...DEFAULTS, from: emp?.location ?? DEFAULTS.from });
  }, [open, reset, emp?.location]);

  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);
  const { requestClose, guard } = useDiscardGuard(isDirty, close);

  const tripType = watch("tripType");
  const mode = watch("mode");
  const est = estimate({ depart: watch("depart"), back: watch("back"), mode, tripType });

  const onSubmit = (v: TravelValues) => {
    const e = estimate(v)!;
    const requestNo = `TRV-2026-${String(401 + requestSequence++).padStart(4, "0")}`;
    const advance = Math.round(Number(v.advance) || 0);
    const leg: TravelLeg = {
      id: `${requestNo}-L1`,
      from: v.from.trim(),
      to: v.to.trim(),
      mode: v.mode,
      departDate: v.depart,
      returnDate: v.back,
      bookingStatus: "pending",
      bookingRef: null,
      carrier: v.mode === "Flight" ? "Travel desk to book" : v.mode === "Train" ? "Indian Railways" : "Company cab",
      estimatedCost: e.fare,
    };
    onSubmitted({
      id: requestNo,
      requestNo,
      employeeCode,
      employeeName: emp?.name ?? employeeCode,
      department: deptName(emp?.departmentId ?? ""),
      purpose: v.purpose.trim(),
      tripType: v.tripType,
      startDate: v.depart,
      endDate: v.back,
      nights: e.nights,
      legs: [leg],
      perDiem: e.perDiem,
      estimatedCost: e.total,
      advanceRequested: advance,
      advanceDisbursed: 0,
      advanceSettled: 0,
      advanceOutstanding: 0,
      status: "submitted",
      approverCode,
      approverName: employeeName(approverCode),
      submittedOn: `${DEMO_TODAY}T14:35:00`,
      decidedOn: null,
      decisionNote: null,
      search: `${requestNo} ${emp?.name ?? ""} ${employeeCode} ${v.purpose} ${v.from} ${v.to}`.toLowerCase(),
    });
    close();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : requestClose())}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>New travel request</DialogTitle>
            <DialogDescription>
              One leg is enough to raise the request — the travel desk adds the return and any connection. Routed
              to {employeeName(approverCode)}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
            <DialogBody className="flex flex-col gap-3">
              <Field
                label="Purpose"
                htmlFor="trv-purpose"
                required
                error={errors.purpose?.message}
                hint="e.g. “Customer QBR with Tata Digital, Mumbai”"
              >
                <Input id="trv-purpose" aria-invalid={!!errors.purpose} {...register("purpose")} />
              </Field>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="From" htmlFor="trv-from" required error={errors.from?.message}>
                  <Input id="trv-from" aria-invalid={!!errors.from} {...register("from")} />
                </Field>
                <Field label="To" htmlFor="trv-to" required error={errors.to?.message}>
                  <Input id="trv-to" placeholder="Mumbai" aria-invalid={!!errors.to} {...register("to")} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Trip" required>
                  <Controller
                    control={control}
                    name="tripType"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger aria-label="Trip type">
                          <span className="text-xs">{field.value}</span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Domestic">Domestic</SelectItem>
                          <SelectItem value="International">International</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <Field label="Mode" required>
                  <Controller
                    control={control}
                    name="mode"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger aria-label="Mode">
                          <span className="text-xs">{field.value}</span>
                        </SelectTrigger>
                        <SelectContent>
                          {MODES.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Departure" htmlFor="trv-depart" required error={errors.depart?.message}>
                  <Input id="trv-depart" type="date" min={DEMO_TODAY} aria-invalid={!!errors.depart} {...register("depart")} />
                </Field>
                <Field label="Return" htmlFor="trv-back" required error={errors.back?.message}>
                  <Input id="trv-back" type="date" min={DEMO_TODAY} aria-invalid={!!errors.back} {...register("back")} />
                </Field>
              </div>

              <Field
                label="Advance requested"
                htmlFor="trv-advance"
                error={errors.advance?.message}
                hint={
                  est
                    ? `Estimate ${inr(est.total, { decimals: false })} for ${est.nights} night${est.nights === 1 ? "" : "s"} — settled against bills within 10 days of returning.`
                    : "Optional. Settled against bills within 10 days of returning."
                }
              >
                <Input
                  id="trv-advance"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={500}
                  placeholder="0"
                  className="tnum"
                  aria-invalid={!!errors.advance}
                  {...register("advance")}
                />
              </Field>

              <Alert tone="info">
                Hotel cap is {inr(HOTEL_CAP, { decimals: false })} per night in metro cities; per diem is{" "}
                {inr(PER_DIEM[tripType], { decimals: false })} per day for a {tripType.toLowerCase()} trip. Anything
                above needs a written exception.
              </Alert>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={requestClose}>
                Cancel
              </Button>
              <Button type="submit">
                <Check /> Submit request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}
