"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { addHours, format, parseISO } from "date-fns";
import { Check } from "lucide-react";
import { DEMO_NOW } from "@/mock/org";
import { employeeByCode } from "@/mock/employees";
import { SLA_HOURS, TICKET_CATEGORIES, TICKET_PRIORITIES, TICKETS, type Ticket } from "@/mock/workplace";
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
  useDiscardGuard,
} from "@/components/ui/overlays";

/* ============================================================================
   Raise a ticket — RHF + zod. Priority sets the SLA clock; the category routes
   it to the same team that owns that category's existing tickets.
   ========================================================================== */

const schema = z.object({
  subject: z.string().trim().min(8, "Give the ticket a subject of at least 8 characters so it can be triaged"),
  category: z.enum(TICKET_CATEGORIES as [Ticket["category"], ...Ticket["category"][]]),
  priority: z.enum(TICKET_PRIORITIES as [Ticket["priority"], ...Ticket["priority"][]]),
  description: z.string().trim().min(15, "Describe the problem in at least 15 characters — what happens, and where"),
});

type TicketValues = z.infer<typeof schema>;

/** Optional prefill, e.g. from the AI knowledge-base check that ran first. */
export type TicketPrefill = Partial<TicketValues>;

const DEFAULTS: TicketValues = { subject: "", category: "IT", priority: "Medium", description: "" };

/** Ticket numbers for tickets raised during the demo session. */
let ticketSequence = 0;

export function RaiseTicketDialog({
  open,
  onOpenChange,
  employeeCode,
  onRaised,
  prefill,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employeeCode: string;
  onRaised: (t: Ticket) => void;
  prefill?: TicketPrefill | null;
}) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<TicketValues>({ resolver: zodResolver(schema), defaultValues: DEFAULTS });

  React.useEffect(() => {
    if (open) reset({ ...DEFAULTS, ...prefill });
  }, [open, reset, prefill]);

  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);
  const { requestClose, guard } = useDiscardGuard(isDirty, close);
  const priority = watch("priority");

  const onSubmit = (v: TicketValues) => {
    const me = employeeByCode(employeeCode);
    const owner = TICKETS.find((t) => t.category === v.category);
    const hours = SLA_HOURS[v.priority];
    const at = DEMO_NOW;
    const ticketNo = `HD-2026-${String(901 + ticketSequence++).padStart(4, "0")}`;
    onRaised({
      id: ticketNo,
      ticketNo,
      category: v.category,
      priority: v.priority,
      subject: v.subject.trim(),
      description: v.description.trim(),
      requesterCode: employeeCode,
      requesterName: me?.name ?? employeeCode,
      requesterBranch: me?.location ?? "Bengaluru",
      assigneeCode: owner?.assigneeCode ?? "STL-0010",
      assigneeName: owner?.assigneeName ?? "IT Support",
      assigneeTeam: owner?.assigneeTeam ?? `${v.category} Support`,
      createdAt: at,
      updatedAt: at,
      status: "submitted",
      slaHours: hours,
      slaDueAt: format(addHours(parseISO(at), hours), "yyyy-MM-dd'T'HH:mm:ss"),
      slaMinutesRemaining: hours * 60,
      slaState: "sla_ok",
      resolvedAt: null,
      firstResponseMins: 0,
      thread: [
        {
          id: `${ticketNo}-M1`,
          authorCode: employeeCode,
          authorName: me?.name ?? employeeCode,
          authorRole: me?.designation ?? "Employee",
          at,
          body: v.description.trim(),
          internal: false,
        },
      ],
      tags: [v.category.toLowerCase()],
      search: `${ticketNo} ${v.subject} ${me?.name ?? ""} ${v.category}`.toLowerCase(),
    });
    close();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : requestClose())}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Raise a ticket</DialogTitle>
            <DialogDescription>Priority sets the SLA clock: Critical 4h, High 8h, Medium 24h, Low 72h.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
            <DialogBody className="flex flex-col gap-3">
              <Field
                label="Subject"
                htmlFor="tkt-subject"
                required
                error={errors.subject?.message}
                hint="Say what is broken and where, e.g. “VPN drops every 20 minutes on the Pune office Wi-Fi”."
              >
                <Input id="tkt-subject" aria-invalid={!!errors.subject} {...register("subject")} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Category" required>
                  <Controller
                    control={control}
                    name="category"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger aria-label="Category">
                          <span className="text-xs">{field.value}</span>
                        </SelectTrigger>
                        <SelectContent>
                          {TICKET_CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <Field label="Priority" required hint={`${SLA_HOURS[priority]}h SLA`}>
                  <Controller
                    control={control}
                    name="priority"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger aria-label="Priority">
                          <span className="text-xs">{field.value}</span>
                        </SelectTrigger>
                        <SelectContent>
                          {TICKET_PRIORITIES.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p} · {SLA_HOURS[p]}h
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
              </div>

              <Field
                label="Description"
                htmlFor="tkt-body"
                required
                error={errors.description?.message}
                hint="Steps to reproduce, error messages, anything you have already tried."
              >
                <Textarea id="tkt-body" rows={4} aria-invalid={!!errors.description} {...register("description")} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={requestClose}>
                Cancel
              </Button>
              <Button type="submit">
                <Check /> Raise ticket
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}
