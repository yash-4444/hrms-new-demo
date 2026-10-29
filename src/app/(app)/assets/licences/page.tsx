"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { parseISO, subDays } from "date-fns";
import { AppWindow, CalendarClock, Clock, IndianRupee, Users } from "lucide-react";
import { DEMO_TODAY } from "@/mock/org";
import { fmtDate, inr, inrCompact, num, pct } from "@/lib/format";
import { LICENCES, seatsFor, type Licence, type Seat } from "@/mock/service";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { Progress } from "@/components/ui/primitives";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { AiExplainButton, AiSuggestionCard } from "@/components/ai";
import { ToneChip } from "@/components/service/kit";
import { LicenceSeatsSheet } from "@/components/service/licence-seats-sheet";

export default function LicencesPage() {
  const loading = useFakeLoad();
  const { can, why } = useApp();
  const [seats, setSeats] = React.useState<Record<string, Seat[]>>(() => Object.fromEntries(LICENCES.map((l) => [l.id, seatsFor(l)])));
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [aiDismissed, setAiDismissed] = React.useState(false);

  const licences = React.useMemo<Licence[]>(
    () => LICENCES.map((l) => ({ ...l, seatsAssigned: seats[l.id].length, idle60: seats[l.id].filter((s) => s.idleDays > 60).length })),
    [seats],
  );
  const totals = React.useMemo(() => {
    const idle = licences.reduce((s, l) => s + l.idle60, 0);
    return {
      spend: licences.reduce((s, l) => s + l.seatsPurchased * l.costPerSeat, 0),
      purchased: licences.reduce((s, l) => s + l.seatsPurchased, 0),
      assigned: licences.reduce((s, l) => s + l.seatsAssigned, 0),
      idle,
      saving: licences.reduce((s, l) => s + l.idle60 * l.costPerSeat, 0),
      renewing: licences.filter((l) => l.daysToRenewal <= 60),
    };
  }, [licences]);
  const withIdle = licences.filter((l) => l.idle60 > 0);
  const openLicence = licences.find((l) => l.id === openId) ?? null;

  const reclaimAll = () => {
    if (!can("workplace.licences", "E")) {
      mockAction("You cannot reclaim seats", { description: why("workplace.licences", "E"), tone: "warning" });
      return;
    }
    const n = totals.idle;
    const saving = totals.saving;
    setSeats((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.filter((x) => x.idleDays <= 60)])));
    mockAction(`${n} idle seats reclaimed`, { description: `Saves ${inr(saving, { decimals: false })} a year at the next renewal. Holders were notified.` });
  };

  const columns = React.useMemo<ColumnDef<Licence, unknown>[]>(
    () => [
      { accessorKey: "product", header: "Product", cell: ({ row }) => <span className="flex flex-col"><span className="font-medium">{row.original.product}</span><span className="text-[11px] text-muted-foreground">{row.original.edition} · {row.original.vendor}</span></span> },
      {
        id: "seats",
        header: "Seats used",
        cell: ({ row }) => {
          const l = row.original;
          const used = (l.seatsAssigned / l.seatsPurchased) * 100;
          return (
            <span className="flex w-36 flex-col gap-1">
              <span className="tnum text-xs">{l.seatsAssigned} / {l.seatsPurchased} <span className="text-muted-foreground">· {pct(used, 0)}</span></span>
              <Progress value={used} aria-label={`${l.product} seats used`} tone={used > 95 ? "warning" : "accent"} />
            </span>
          );
        },
      },
      { accessorKey: "costPerSeat", header: "Cost / seat / yr", cell: ({ row }) => <NumCell>{inr(row.original.costPerSeat, { decimals: false })}</NumCell> },
      { id: "annual", header: "Annual cost", accessorFn: (l) => l.seatsPurchased * l.costPerSeat, cell: ({ row }) => <NumCell>{inr(row.original.seatsPurchased * row.original.costPerSeat, { decimals: false })}</NumCell> },
      {
        accessorKey: "idle60",
        header: "Idle 60+ days",
        cell: ({ row }) => (row.original.idle60 > 0 ? <ToneChip tone="warning" icon={Clock}>{row.original.idle60} seats</ToneChip> : <MutedCell>None</MutedCell>),
      },
      {
        accessorKey: "renewal",
        header: "Renewal",
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span className="tnum">{fmtDate(row.original.renewal)}</span>
            {row.original.daysToRenewal <= 60 && <span className="text-[10px] text-warning-fg">in {row.original.daysToRenewal} days</span>}
          </span>
        ),
      },
      { accessorKey: "owner", header: "Owner", cell: ({ row }) => <MutedCell>{row.original.owner}</MutedCell> },
    ],
    [],
  );

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Software licences" description="Loading licences…" />
        <TableSkeleton />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader title="Software licences" description="Every SaaS subscription, who holds a seat, and what idle seats are costing." />

      <StatRow cols={4}>
        <StatTile label="Annual spend" value={inrCompact(totals.spend)} icon={IndianRupee} hint={`${licences.length} products`} />
        <StatTile label="Seats assigned" value={`${num(totals.assigned)} / ${num(totals.purchased)}`} icon={Users} hint={`${num(totals.purchased - totals.assigned)} unassigned`} />
        <StatTile label="Idle 60+ days" value={num(totals.idle)} icon={Clock} tone={totals.idle ? "warning" : "good"} hint={`${inrCompact(totals.saving)} a year`} />
        <StatTile label="Renewing ≤ 60 days" value={num(totals.renewing.length)} icon={CalendarClock} hint={totals.renewing.map((l) => l.product).join(", ") || "None"} />
      </StatRow>

      {!aiDismissed && totals.idle > 0 && (
        <AiSuggestionCard
          title={`${totals.idle} seats unused for 60+ days — reclaim to save ${inr(totals.saving, { decimals: false })}/year`}
          confidence={92}
          body={
            <div className="flex flex-col gap-1.5">
              <p>
                Sign-in logs from single sign-on show no activity on these seats since before{" "}
                {fmtDate(subDays(parseISO(DEMO_TODAY), 60))}. Reclaiming them before the next renewals avoids
                buying them again.
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {withIdle.map((l) => (
                  <li key={l.id}>
                    <button type="button" onClick={() => setOpenId(l.id)} className="rounded-md border border-border bg-card px-1.5 py-0.5 hover:bg-muted">
                      {l.product}: {l.idle60} × {inr(l.costPerSeat, { decimals: false })} = <span className="tnum font-medium">{inr(l.idle60 * l.costPerSeat, { decimals: false })}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <AiExplainButton
                title="How idle seats are found"
                summary="A seat counts as idle when its holder has not signed in to the product for 60 consecutive days."
                drivers={withIdle.map((l) => ({ label: l.product, detail: `${l.idle60} idle seats`, weight: l.idle60 * l.costPerSeat }))}
                footnote="Holders on long leave are excluded. Nothing is reclaimed until you accept."
              />
            </div>
          }
          acceptLabel={`Reclaim ${totals.idle} seats`}
          onAccept={reclaimAll}
          onEdit={() => setOpenId(withIdle[0]?.id ?? null)}
          onDismiss={() => setAiDismissed(true)}
        />
      )}

      <DataTable
        columns={columns}
        data={licences}
        getRowId={(l) => l.id}
        searchKeys={["product", "vendor"]}
        searchPlaceholder="Search product or vendor…"
        exportName="software-licences"
        onRowClick={(l) => setOpenId(l.id)}
        rowTone={(l) => (l.daysToRenewal <= 30 ? "warning" : undefined)}
        emptyIcon={AppWindow}
        emptyTitle="No licences tracked"
        emptyDescription="Add a subscription to start tracking seats and renewals."
      />

      <LicenceSeatsSheet
        licence={openLicence}
        seats={openLicence ? seats[openLicence.id] : []}
        onOpenChange={(o) => !o && setOpenId(null)}
        onAssign={(code) => {
          if (!openLicence) return;
          setSeats((s) => ({ ...s, [openLicence.id]: [{ id: `${openLicence.id}-${code}`, employeeCode: code, assignedOn: DEMO_TODAY, lastActive: DEMO_TODAY, idleDays: 0 }, ...s[openLicence.id]] }));
          mockAction(`${openLicence.product} seat assigned`, { description: `${code} is provisioned at the next SSO sync.` });
        }}
        onUnassign={(seat) => openLicence && setSeats((s) => ({ ...s, [openLicence.id]: s[openLicence.id].filter((x) => x.id !== seat.id) }))}
      />
    </PageBody>
  );
}
