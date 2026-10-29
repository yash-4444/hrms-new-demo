"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isValid, parseISO } from "date-fns";
import { Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import { EMPLOYEES, employeeByCode } from "@/mock/employees";
import type { Asset, AssetCondition } from "@/mock/workplace";
import { Button } from "@/components/ui/button";
import { Avatar, Checkbox, Field, Input, Textarea } from "@/components/ui/primitives";
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
   Allocate asset — RHF + zod, inline errors through <Field>.

   Opened three ways: from a row action (one asset), from the bulk bar (many)
   or from the page header with nothing selected, in which case the form asks
   which piece of stock is going out. The handover acknowledgement is a hard
   gate — an unticked box keeps the dialog open with an inline error.
   ========================================================================== */

export const ASSET_CONDITION_OPTIONS = [
  "New",
  "Excellent",
  "Good",
  "Fair",
  "Needs repair",
] as const satisfies readonly AssetCondition[];

/** Stable empty preselection so the reset effect does not loop. */
export const NO_PRESELECTION: Asset[] = [];

export interface AssetAllocation {
  assetIds: string[];
  employeeCode: string;
  employeeName: string;
  employeeLocation: string;
  allocationDate: string;
  condition: AssetCondition;
  notes: string;
}

const ACTIVE_EMPLOYEES = EMPLOYEES.filter((e) => e.status !== "exited");
const MAX_MATCHES = 40;

const schema = z.object({
  assetId: z.string().min(1, "Pick the asset that is going out"),
  employeeCode: z.string().min(1, "Search for and pick the employee receiving the asset"),
  allocationDate: z
    .string()
    .min(1, "Allocation date is required")
    .refine((v) => isValid(parseISO(v)), "Enter a real calendar date")
    .refine(
      (v) => !isValid(parseISO(v)) || v <= DEMO_TODAY,
      `Handover cannot be dated after ${fmtDate(DEMO_TODAY)}`,
    ),
  condition: z.enum(ASSET_CONDITION_OPTIONS, { message: "Record the condition at handover" }),
  notes: z.string().trim().max(240, "Keep the handover note under 240 characters"),
  acknowledged: z
    .boolean()
    .refine(
      (v) => v,
      "The employee must acknowledge receipt before the asset leaves the store",
    ),
});

type AllocationValues = z.infer<typeof schema>;

export function AssetAllocationDialog({
  open,
  onOpenChange,
  preselected,
  stock,
  onAllocate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Assets carried in from a row action or the bulk bar. Empty = pick one. */
  preselected: Asset[];
  /** Everything still available to hand out, for the picker. */
  stock: Asset[];
  onAllocate: (allocation: AssetAllocation) => void;
}) {
  const [query, setQuery] = React.useState("");

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<AllocationValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      assetId: "",
      employeeCode: "",
      allocationDate: DEMO_TODAY,
      condition: "Good",
      notes: "",
      acknowledged: false,
    },
  });

  /* A fresh form every time the dialog is opened, seeded from the selection. */
  React.useEffect(() => {
    if (!open) return;
    reset({
      assetId: preselected[0]?.id ?? "",
      employeeCode: "",
      allocationDate: DEMO_TODAY,
      condition: preselected[0]?.condition ?? "Good",
      notes: "",
      acknowledged: false,
    });
    setQuery("");
  }, [open, preselected, reset]);

  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);
  /* Typing a search query counts as work in progress too. */
  const { requestClose, guard } = useDiscardGuard(isDirty || query.trim() !== "", close);

  const assetId = watch("assetId");
  const notes = watch("notes") ?? "";

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ACTIVE_EMPLOYEES.slice(0, MAX_MATCHES);
    return ACTIVE_EMPLOYEES.filter((e) =>
      `${e.name} ${e.code} ${e.designation} ${e.location}`.toLowerCase().includes(q),
    );
  }, [query]);

  const shown = matches.slice(0, MAX_MATCHES);
  const targets = preselected.length
    ? preselected
    : stock.filter((a) => a.id === assetId);

  /* Only reached once zod passes — an invalid field keeps the dialog open and
     renders its message inline through <Field error=…>. */
  const onSubmit = (v: AllocationValues) => {
    const holder = employeeByCode(v.employeeCode);
    onAllocate({
      assetIds: (preselected.length ? preselected : stock.filter((a) => a.id === v.assetId)).map(
        (a) => a.id,
      ),
      employeeCode: v.employeeCode,
      employeeName: holder?.name ?? v.employeeCode,
      employeeLocation: holder?.location ?? "Bengaluru",
      allocationDate: v.allocationDate,
      condition: v.condition,
      notes: v.notes.trim(),
    });
    close();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : requestClose())}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>
              {preselected.length > 1
                ? `Allocate ${preselected.length} assets`
                : "Allocate an asset"}
            </DialogTitle>
            <DialogDescription>
              {preselected.length > 1
                ? "All selected assets are handed to the same employee in one movement. The register updates the moment you confirm."
                : "Records a handover against the asset register. The holder shows on the row and in their own My assets tab straight away."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogBody className="flex flex-col gap-3.5">
              {preselected.length > 0 ? (
                <div className="rounded-md border border-border bg-subtle p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Going out
                  </p>
                  <ul className="scrollbar-thin mt-1.5 flex max-h-28 flex-col gap-1 overflow-y-auto">
                    {preselected.map((a) => (
                      <li key={a.id} className="flex items-center gap-2 text-xs">
                        <span className="font-mono font-medium text-foreground">{a.tag}</span>
                        <span className="truncate text-muted-foreground">
                          {a.make} {a.model}
                        </span>
                        <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
                          {a.serial}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <Field
                  label="Asset"
                  required
                  error={errors.assetId?.message}
                  hint={`${stock.length} assets are sitting in stock`}
                >
                  <Controller
                    control={control}
                    name="assetId"
                    render={({ field }) => {
                      const chosen = stock.find((a) => a.id === field.value);
                      return (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger aria-label="Asset" aria-invalid={!!errors.assetId}>
                            <span className="truncate">
                              {chosen
                                ? `${chosen.tag} · ${chosen.make} ${chosen.model}`
                                : "Pick from stock"}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            {stock.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.tag} · {a.make} {a.model} · {a.location}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      );
                    }}
                  />
                </Field>
              )}

              <Field
                label="Allocate to"
                required
                error={errors.employeeCode?.message}
                hint="Search by name, employee code, designation or location"
              >
                <Controller
                  control={control}
                  name="employeeCode"
                  render={({ field }) => {
                    const chosen = employeeByCode(field.value);
                    return (
                      <div className="flex flex-col gap-1.5">
                        <div className="relative">
                          <Search
                            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                            aria-hidden
                          />
                          <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search the active directory…"
                            aria-label="Search employees"
                            className="pl-8"
                          />
                        </div>
                        <ul
                          aria-label="Matching employees"
                          className="scrollbar-thin flex max-h-44 flex-col overflow-y-auto rounded-md border border-border"
                        >
                          {shown.length === 0 && (
                            <li className="px-2.5 py-3 text-center text-xs text-muted-foreground">
                              No active employee matches “{query.trim()}”.
                            </li>
                          )}
                          {shown.map((e) => {
                            const active = field.value === e.code;
                            return (
                              <li key={e.code}>
                                <button
                                  type="button"
                                  onClick={() => field.onChange(e.code)}
                                  aria-pressed={active}
                                  className={cn(
                                    "flex w-full items-center gap-2 border-b border-border px-2.5 py-1.5 text-left last:border-0",
                                    "transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                                    active && "bg-primary-soft/50",
                                  )}
                                >
                                  <Avatar name={e.name} size={24} />
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-xs font-medium text-foreground">
                                      {e.name}
                                    </span>
                                    <span className="block truncate text-xs text-muted-foreground">
                                      {e.code} · {e.designation} · {e.location}
                                    </span>
                                  </span>
                                  {active && (
                                    <Check className="size-3.5 shrink-0 text-primary" aria-hidden />
                                  )}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                        {matches.length > shown.length && (
                          <p className="tnum text-xs text-muted-foreground">
                            Showing {shown.length} of {matches.length} matches — keep typing to narrow
                            it down.
                          </p>
                        )}
                        {chosen && (
                          <p className="text-xs text-muted-foreground">
                            Handing over to{" "}
                            <span className="font-medium text-foreground">{chosen.name}</span> ·{" "}
                            {chosen.designation}, {chosen.location}.
                          </p>
                        )}
                      </div>
                    );
                  }}
                />
              </Field>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  label="Allocation date"
                  htmlFor="al-date"
                  required
                  error={errors.allocationDate?.message}
                >
                  <Input
                    id="al-date"
                    type="date"
                    max={DEMO_TODAY}
                    aria-invalid={!!errors.allocationDate}
                    {...register("allocationDate")}
                  />
                </Field>

                <Field label="Condition at handover" required error={errors.condition?.message}>
                  <Controller
                    control={control}
                    name="condition"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger aria-label="Condition at handover">
                          <span className="truncate">{field.value}</span>
                        </SelectTrigger>
                        <SelectContent>
                          {ASSET_CONDITION_OPTIONS.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
              </div>

              <Field
                label="Location / handover notes"
                htmlFor="al-notes"
                error={errors.notes?.message}
                hint={
                  <span className="tnum">
                    Optional · {notes.length} / 240 characters
                  </span>
                }
              >
                <Textarea
                  id="al-notes"
                  rows={3}
                  placeholder="Collected from the 7F IT store. Charger, 65W adapter and sleeve issued with the machine."
                  aria-invalid={!!errors.notes}
                  {...register("notes")}
                />
              </Field>

              <Field label="Acknowledgement" required error={errors.acknowledged?.message}>
                <Controller
                  control={control}
                  name="acknowledged"
                  render={({ field }) => (
                    <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-subtle p-2.5">
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(v) => field.onChange(v === true)}
                        aria-invalid={!!errors.acknowledged}
                        className="mt-0.5"
                      />
                      <span className="text-xs leading-relaxed text-foreground">
                        The employee has physically received the asset and accepted the
                        acceptable-use policy.
                      </span>
                    </label>
                  )}
                />
              </Field>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={requestClose}>
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting}>
                {targets.length > 1 ? `Allocate ${targets.length} assets` : "Allocate asset"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}
