"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDown,
  Bus,
  Car,
  Check,
  Plane,
  Plus,
  Train,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDateShort, inr, inrCompact, num } from "@/lib/format";
import {
  TRAVEL_ADVANCE_SUMMARY,
  TRAVEL_REQUESTS,
  TRAVEL_STATS,
  type TravelLeg,
  type TravelMode,
  type TravelRequest,
} from "@/mock/workplace";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Alert,
  Avatar,
  Badge,
  EmptyState,
  Field,
  Input,
  Progress,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@/components/ui/primitives";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FilterSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { ShareBar } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import {
  Gated,
  PageBody,
  PageHeader,
  Section,
  useFakeLoad,
} from "@/components/shell/page";

const MODE_ICON: Record<TravelMode, React.ElementType> = {
  Flight: Plane,
  Train: Train,
  Cab: Car,
  Bus: Bus,
};

export default function TravelPage() {
  const loading = useFakeLoad();
  const { persona } = useApp();

  const [requests, setRequests] = React.useState<TravelRequest[]>(TRAVEL_REQUESTS);
  const [status, setStatus] = React.useState("all");
  const [tripType, setTripType] = React.useState("all");
  const [selectedId, setSelectedId] = React.useState<string | null>(TRAVEL_REQUESTS[0]?.id ?? null);
  const [composeOpen, setComposeOpen] = React.useState(false);

  /* new-request form */
  const [purpose, setPurpose] = React.useState("");
  const [from, setFrom] = React.useState("Bengaluru");
  const [to, setTo] = React.useState("Mumbai");
  const [mode, setMode] = React.useState<TravelMode>("Flight");
  const [depart, setDepart] = React.useState("2026-10-06");
  const [back, setBack] = React.useState("2026-10-09");
  const [advance, setAdvance] = React.useState(25000);
  const [error, setError] = React.useState<string | null>(null);

  const filtered = React.useMemo(
    () =>
      requests.filter(
        (r) =>
          (status === "all" || r.status === status) && (tripType === "all" || r.tripType === tripType),
      ),
    [requests, status, tripType],
  );

  const selected = filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  /* Advance balance recomputes from the live list, not the frozen fixture. */
  const advanceSummary = React.useMemo(
    () => ({
      requested: requests.reduce((a, b) => a + b.advanceRequested, 0),
      disbursed: requests.reduce((a, b) => a + b.advanceDisbursed, 0),
      settled: requests.reduce((a, b) => a + b.advanceSettled, 0),
      outstanding: requests.reduce((a, b) => a + b.advanceOutstanding, 0),
    }),
    [requests],
  );

  const submit = () => {
    if (purpose.trim().length < 6) {
      setError("Describe the purpose in at least 6 characters — the approver decides on this line.");
      return;
    }
    if (back < depart) {
      setError("The return date cannot be before the departure date.");
      return;
    }
    const nights = Math.max(
      0,
      Math.round((new Date(back).getTime() - new Date(depart).getTime()) / 86400000),
    );
    const estimated = mode === "Flight" ? 14000 + nights * 6500 : 3200 + nights * 5200;
    const leg: TravelLeg = {
      id: `LEG-NEW-${requests.length}`,
      from,
      to,
      mode,
      departDate: depart,
      returnDate: back,
      bookingStatus: "pending",
      bookingRef: null,
      carrier: mode === "Flight" ? "IndiGo" : mode === "Train" ? "Indian Railways" : "Ola Corporate",
      estimatedCost: estimated,
    };
    const req: TravelRequest = {
      id: `TRV-NEW-${requests.length}`,
      requestNo: `TRV-2026-${String(400 + requests.length)}`,
      employeeCode: persona.employeeId,
      employeeName: persona.name,
      department: persona.department,
      purpose: purpose.trim(),
      tripType: "Domestic",
      startDate: depart,
      endDate: back,
      nights,
      legs: [leg],
      perDiem: 1800,
      estimatedCost: estimated + nights * 1800,
      advanceRequested: advance,
      advanceDisbursed: 0,
      advanceSettled: 0,
      advanceOutstanding: advance,
      status: "submitted",
      approverCode: "STL-0031",
      approverName: "Vikram Shah",
      submittedOn: "2026-09-16",
      decidedOn: null,
      decisionNote: null,
      search: [`TRV-2026-${String(400 + requests.length)}`, persona.name, purpose.trim(), from, to]
        .join(" ")
        .toLowerCase(),
    };
    setRequests((rs) => [req, ...rs]);
    setSelectedId(req.id);
    setComposeOpen(false);
    setPurpose("");
    setError(null);
    mockAction(`${req.requestNo} submitted`, {
      description: `${from} → ${to} · ${nights} night${nights === 1 ? "" : "s"} · advance ${inr(advance, { decimals: false })} requested.`,
    });
  };

  const decide = (r: TravelRequest, approve: boolean) => {
    setRequests((rs) =>
      rs.map((x) =>
        x.id === r.id
          ? {
              ...x,
              status: approve ? "approved" : "rejected",
              decidedOn: "2026-09-16",
              decisionNote: approve ? "Approved within the travel policy." : "Not approved — use video conferencing.",
              approverName: persona.name,
              advanceDisbursed: approve ? x.advanceRequested : 0,
              advanceOutstanding: approve ? x.advanceRequested - x.advanceSettled : 0,
            }
          : x,
      ),
    );
    mockAction(approve ? `Approved ${r.requestNo}` : `Rejected ${r.requestNo}`, {
      description: `${r.employeeName} · ${r.legs[0]?.from} → ${r.legs[0]?.to}`,
      tone: approve ? "success" : "warning",
    });
  };

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Travel" description="Loading requests…" />
        <Skeleton className="h-[440px]" />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="Travel"
        description="Trip requests with their full itinerary, and the advance money tied up against them."
        actions={
          <Gated menuKey="my.travel" action="C">
            <Button size="sm" onClick={() => setComposeOpen(true)}>
              <Plus /> New travel request
            </Button>
          </Gated>
        }
      />

      <StatRow cols={4}>
        <StatTile label="Requests" value={num(requests.length)} icon={Plane} hint={`${TRAVEL_STATS.upcoming} upcoming trips`} />
        <StatTile
          label="Awaiting approval"
          value={num(requests.filter((r) => r.status === "submitted").length)}
          icon={Check}
          tone={requests.some((r) => r.status === "submitted") ? "warning" : "good"}
          onClick={() => setStatus("submitted")}
        />
        <StatTile label="Estimated spend" value={inrCompact(TRAVEL_STATS.estimatedSpend)} icon={Wallet} hint="Approved and pending trips" />
        <StatTile
          label="Advance outstanding"
          value={inrCompact(advanceSummary.outstanding)}
          icon={Wallet}
          tone={advanceSummary.outstanding > 0 ? "warning" : "good"}
          hint="Disbursed but not yet settled"
        />
      </StatRow>

      {/* -------------------------------------------- advance balance panel */}
      <Section
        title="Advance balance"
        description="Company money currently in employees' hands. Settlement closes the loop after each trip."
      >
        <ShareBar
          segments={[
            { key: "settled", label: "Settled", value: advanceSummary.settled, status: "good" },
            { key: "outstanding", label: "Outstanding", value: advanceSummary.outstanding, status: "warning" },
            {
              key: "undisbursed",
              label: "Requested, not disbursed",
              value: Math.max(0, advanceSummary.requested - advanceSummary.disbursed),
              status: "serious",
            },
          ]}
          total={Math.max(advanceSummary.requested, 1)}
          valueFormat={(v) => inr(v, { decimals: false })}
          height={10}
        />
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Requested", advanceSummary.requested],
            ["Disbursed", advanceSummary.disbursed],
            ["Settled", advanceSummary.settled],
            ["Outstanding", advanceSummary.outstanding],
          ].map(([k, v]) => (
            <div key={k as string} className="rounded-md border border-border bg-subtle p-2.5">
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{k as string}</dt>
              <dd className="tnum mt-0.5 text-sm font-semibold">
                {inr(v as number, { decimals: false })}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <div className="flex flex-wrap items-center gap-1.5">
        <FilterSelect
          label="Status"
          value={status}
          onValueChange={setStatus}
          allLabel="All statuses"
          width="w-[170px]"
          options={[
            { value: "draft", label: "Draft" },
            { value: "submitted", label: "Submitted" },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
            { value: "completed", label: "Completed" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />
        <FilterSelect
          label="Trip"
          value={tripType}
          onValueChange={setTripType}
          allLabel="All trips"
          width="w-[160px]"
          options={[
            { value: "Domestic", label: "Domestic" },
            { value: "International", label: "International" },
          ]}
        />
        <span className="tnum ml-auto text-xs text-muted-foreground">
          {filtered.length} of {requests.length} requests
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,340px)_1fr]">
        {/* ------------------------------------------------------- list */}
        <Section title="Requests" bodyClassName="p-0">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Plane}
              title="No requests match"
              description="Clear a filter to see the rest."
              className="border-0"
            />
          ) : (
            <ul className="scrollbar-thin max-h-[560px] overflow-y-auto">
              {filtered.map((r) => {
                const active = r.id === selected?.id;
                return (
                  <li key={r.id} className="border-b border-border last:border-0">
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                        active ? "bg-primary-soft" : "hover:bg-muted/60",
                      )}
                    >
                      <Avatar name={r.employeeName} size={26} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium">
                          {r.legs[0]?.from} → {r.legs[0]?.to}
                        </span>
                        <span className="tnum block truncate text-[11px] text-muted-foreground">
                          {r.requestNo} · {r.employeeName} · {fmtDateShort(r.startDate)}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <StatusBadge status={r.status} />
                        <span className="tnum mt-0.5 block text-[10px] text-muted-foreground">
                          {inrCompact(r.estimatedCost)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* ------------------------------------------------ itinerary card */}
        {selected ? (
          <div className="flex flex-col gap-3">
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-subtle p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={selected.employeeName} size={36} />
                  <div>
                    <p className="text-sm font-semibold">{selected.purpose}</p>
                    <p className="text-xs text-muted-foreground">
                      {selected.requestNo} ·{" "}
                      <Link href={`/employees/${selected.employeeCode}`} className="hover:underline">
                        {selected.employeeName}
                      </Link>{" "}
                      · {selected.department}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <Badge variant="muted">{selected.tripType}</Badge>
                      <Badge variant="muted">
                        {selected.nights} night{selected.nights === 1 ? "" : "s"}
                      </Badge>
                      <Badge variant="muted">Per diem {inr(selected.perDiem, { decimals: false })}</Badge>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <StatusBadge status={selected.status} size="md" />
                  <p className="tnum mt-1.5 text-sm font-semibold">
                    {inr(selected.estimatedCost, { decimals: false })}
                  </p>
                  <p className="text-[10px] text-muted-foreground">estimated cost</p>
                </div>
              </div>

              {/* the journey */}
              <div className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Itinerary
                </p>
                <ol className="mt-2.5 flex flex-col">
                  {selected.legs.map((leg, i) => {
                    const Icon = MODE_ICON[leg.mode];
                    return (
                      <li key={leg.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
                            <Icon className="size-3.5" aria-hidden />
                          </span>
                          {i < selected.legs.length - 1 && (
                            <span className="w-px flex-1 bg-border" aria-hidden />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
                            {leg.from}
                            <ArrowDown className="size-3 -rotate-90 text-muted-foreground" aria-hidden />
                            {leg.to}
                            <Badge variant="muted">{leg.mode}</Badge>
                            <StatusBadge status={leg.bookingStatus} />
                          </p>
                          <p className="tnum mt-0.5 text-[11px] text-muted-foreground">
                            {fmtDate(leg.departDate)}
                            {leg.returnDate ? ` – ${fmtDate(leg.returnDate)}` : ""} · {leg.carrier}
                            {leg.bookingRef ? ` · ref ${leg.bookingRef}` : " · not yet booked"} ·{" "}
                            {inr(leg.estimatedCost, { decimals: false })}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>

              {/* advance for this trip */}
              <div className="border-t border-border p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Advance for this trip
                </p>
                <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Requested", selected.advanceRequested],
                    ["Disbursed", selected.advanceDisbursed],
                    ["Settled", selected.advanceSettled],
                    ["Outstanding", selected.advanceOutstanding],
                  ].map(([k, v]) => (
                    <div key={k as string}>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {k as string}
                      </p>
                      <p
                        className={cn(
                          "tnum mt-0.5 text-sm font-semibold",
                          k === "Outstanding" && (v as number) > 0 && "text-warning-fg",
                        )}
                      >
                        {inr(v as number, { decimals: false })}
                      </p>
                    </div>
                  ))}
                </div>
                {selected.advanceRequested > 0 && (
                  <Progress
                    value={(selected.advanceSettled / Math.max(1, selected.advanceRequested)) * 100}
                    className="mt-2.5"
                    tone={selected.advanceOutstanding > 0 ? "warning" : "success"}
                    aria-label="Advance settlement progress"
                  />
                )}
              </div>

              {selected.decisionNote && (
                <p className="border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">{selected.approverName}</span> on{" "}
                  {selected.decidedOn ? fmtDate(selected.decidedOn) : "—"}: {selected.decisionNote}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2.5">
                {selected.status === "submitted" && (
                  <>
                    <Gated menuKey="workplace.travel" action="A">
                      <Button size="sm" onClick={() => decide(selected, true)}>
                        <Check /> Approve
                      </Button>
                    </Gated>
                    <Gated menuKey="workplace.travel" action="A">
                      <Button variant="outline" size="sm" onClick={() => decide(selected, false)}>
                        <X /> Reject
                      </Button>
                    </Gated>
                  </>
                )}
                {selected.advanceOutstanding > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRequests((rs) =>
                        rs.map((x) =>
                          x.id === selected.id
                            ? {
                                ...x,
                                advanceSettled: x.advanceDisbursed,
                                advanceOutstanding: 0,
                                status: "completed",
                              }
                            : x,
                        ),
                      );
                      mockAction(`Advance settled — ${selected.requestNo}`, {
                        description: `${inr(selected.advanceOutstanding, { decimals: false })} reconciled against submitted bills.`,
                      });
                    }}
                  >
                    <Wallet /> Settle advance
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() =>
                    mockAction("Itinerary emailed", {
                      description: `${selected.requestNo} sent to ${selected.employeeName}.`,
                    })
                  }
                >
                  Email itinerary
                </Button>
              </div>
            </Card>
          </div>
        ) : (
          <EmptyState icon={Plane} title="Select a request" description="Pick a trip from the list to see its itinerary." />
        )}
      </div>

      {/* --------------------------------------------------- new request */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>New travel request</DialogTitle>
            <DialogDescription>
              One leg is enough to raise the request — travel desk adds the return and any connection.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3">
            <Field
              label="Purpose"
              htmlFor="trv-purpose"
              required
              error={error && purpose.trim().length < 6 ? error : undefined}
              hint="e.g. “Customer QBR with Tata Digital, Mumbai”"
            >
              <Input
                id="trv-purpose"
                value={purpose}
                onChange={(e) => {
                  setPurpose(e.target.value);
                  setError(null);
                }}
                aria-invalid={!!error && purpose.trim().length < 6}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="From" htmlFor="trv-from" required>
                <Input id="trv-from" value={from} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Field label="To" htmlFor="trv-to" required>
                <Input id="trv-to" value={to} onChange={(e) => setTo(e.target.value)} />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Mode" htmlFor="trv-mode" required>
                <Select value={mode} onValueChange={(v) => setMode(v as TravelMode)}>
                  <SelectTrigger id="trv-mode">
                    <span className="text-xs">{mode}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {(["Flight", "Train", "Cab", "Bus"] as TravelMode[]).map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Departure" htmlFor="trv-depart" required>
                <Input id="trv-depart" type="date" value={depart} onChange={(e) => setDepart(e.target.value)} />
              </Field>
              <Field
                label="Return"
                htmlFor="trv-back"
                required
                error={error && back < depart ? error : undefined}
              >
                <Input
                  id="trv-back"
                  type="date"
                  value={back}
                  onChange={(e) => {
                    setBack(e.target.value);
                    setError(null);
                  }}
                  aria-invalid={!!error && back < depart}
                />
              </Field>
            </div>

            <Field label="Advance requested" htmlFor="trv-advance" hint="Settled against bills within 7 days of returning.">
              <Input
                id="trv-advance"
                type="number"
                step={1000}
                value={advance}
                onChange={(e) => setAdvance(Number(e.target.value) || 0)}
                className="tnum"
              />
            </Field>

            <Alert tone="info">
              Domestic hotel cap is {inr(6500, { decimals: false })} per night for metro cities, and
              per diem is {inr(1800, { decimals: false })} per day. Anything above needs a written
              exception.
            </Alert>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>
              <Check /> Submit request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageBody>
  );
}
