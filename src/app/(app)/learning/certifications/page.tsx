"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Award, BellRing, ShieldCheck, TimerReset } from "lucide-react";
import { fmtDate, num, pct } from "@/lib/format";
import { employeeName } from "@/mock/employees";
import { deptName } from "@/mock/org";
import { CERTIFICATES, CERT_COMPLETION_BY_DEPT, CRITICAL_CERTS, type Certificate } from "@/mock/engage";
import type { ExpiryBand } from "@/mock/growth";
import { mockAction, useApp } from "@/components/app-state";
import { BarCompareChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { DataTable, MutedCell } from "@/components/data-table";
import { PersonCell } from "@/components/people/person-cell";
import { CardsSkeleton, ChartSkeleton, Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/primitives";
import { FilterSelect } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";

const BAND_META: Record<ExpiryBand, { label: string; status: string }> = {
  expired: { label: "Expired", status: "expired" },
  expiring: { label: "Expiring ≤ 30 days", status: "due_soon" },
  pending: { label: "Never completed", status: "not_started" },
  valid: { label: "Valid", status: "completed" },
};

export default function CertificationsPage() {
  const loading = useFakeLoad();
  const { can, role, persona } = useApp();
  const seesAll = can("growth.certifications", "E") || role === "auditor";
  const [band, setBand] = React.useState("all");
  const [kind, setKind] = React.useState("all");
  const [name, setName] = React.useState("all");
  const [reminded, setReminded] = React.useState(false);

  const scoped = React.useMemo(
    () => (seesAll ? CERTIFICATES : CERTIFICATES.filter((c) => c.employeeCode === persona.employeeId)),
    [seesAll, persona.employeeId],
  );
  const visible = scoped.filter(
    (c) => (band === "all" || c.band === band) && (kind === "all" || c.kind === kind) && (name === "all" || c.name === name),
  );
  const expired = scoped.filter((c) => c.band === "expired");
  const expiring = scoped.filter((c) => c.band === "expiring");
  const valid = scoped.filter((c) => c.band === "valid" || c.band === "expiring").length;
  const dueForRenewal = expired.length + expiring.length;

  const columns = React.useMemo<ColumnDef<Certificate, unknown>[]>(
    () => [
      {
        id: "employee",
        accessorFn: (r) => employeeName(r.employeeCode),
        header: "Employee",
        cell: ({ row }) => <PersonCell name={employeeName(row.original.employeeCode)} code={row.original.employeeCode} subtitle={deptName(row.original.departmentId)} />,
      },
      {
        accessorKey: "name",
        header: "Certificate",
        cell: ({ row }) => (
          <div className="flex flex-col text-xs">
            <span className="font-medium">{row.original.name}</span>
            <span className="text-muted-foreground">{row.original.issuer}</span>
          </div>
        ),
      },
      { accessorKey: "kind", header: "Type", cell: ({ row }) => <Badge variant={row.original.kind === "Compliance" ? "soft" : "outline"}>{row.original.kind}</Badge> },
      { accessorKey: "issuedOn", header: "Issued", cell: ({ row }) => <MutedCell>{row.original.issuedOn ? fmtDate(row.original.issuedOn) : "—"}</MutedCell> },
      { accessorKey: "expiresOn", header: "Expires", cell: ({ row }) => <span className="text-xs">{row.original.expiresOn ? fmtDate(row.original.expiresOn) : "—"}</span> },
      {
        id: "days",
        accessorFn: (r) => r.daysToExpiry ?? -9999,
        header: "Days left",
        cell: ({ row }) => {
          const d = row.original.daysToExpiry;
          if (d === null) return <MutedCell>—</MutedCell>;
          return <span className={d < 0 ? "tnum text-xs text-destructive-fg" : d <= 30 ? "tnum text-xs text-warning-fg" : "tnum text-xs"}>{d < 0 ? `${-d} overdue` : num(d)}</span>;
        },
      },
      { accessorKey: "band", header: "Status", cell: ({ row }) => <StatusBadge status={BAND_META[row.original.band].status} label={BAND_META[row.original.band].label} /> },
    ],
    [],
  );

  const sendReminders = (rows: Certificate[]) => {
    const people = new Set(rows.map((r) => r.employeeCode)).size;
    setReminded(true);
    mockAction(`Renewal reminders sent to ${num(people)} people`, {
      description: "Email and in-app, with a direct link to the renewal course. Managers are copied on expired compliance certificates.",
    });
  };

  return (
    <PageBody>
      <PageHeader
        title="Certifications"
        description={
          seesAll
            ? "Every certificate issued — compliance-critical and professional — with expiry tracking and renewal reminders."
            : "Your certificates, when they expire, and what to renew next."
        }
      />

      {loading ? (
        <>
          <CardsSkeleton />
          <ChartSkeleton />
          <TableSkeleton />
        </>
      ) : (
        <>
          <StatRow>
            <StatTile label="Certificates on record" value={num(scoped.length)} icon={Award} hint={`${num(scoped.filter((c) => c.kind === "Professional").length)} professional`} />
            <StatTile label="Valid" value={pct((valid / Math.max(1, scoped.length)) * 100, 0)} icon={ShieldCheck} tone="good" hint={`${num(valid)} certificates`} />
            <StatTile label="Expiring in 30 days" value={num(expiring.length)} icon={TimerReset} tone={expiring.length ? "warning" : "neutral"} onClick={() => setBand("expiring")} hint="Click to filter" />
            <StatTile label="Expired" value={num(expired.length)} icon={AlertTriangle} tone={expired.length ? "critical" : "neutral"} onClick={() => setBand("expired")} hint="An audit finding, not a reminder" />
          </StatRow>

          {dueForRenewal > 0 && (
            <Alert
              tone={expired.length ? "danger" : "warning"}
              icon={BellRing}
              title={`${num(dueForRenewal)} certificate${dueForRenewal === 1 ? "" : "s"} need renewal`}
              action={
                <Gated menuKey="growth.certifications" action="E">
                  <Button size="sm" variant="outline" disabled={reminded} onClick={() => sendReminders([...expired, ...expiring])}>
                    <BellRing /> {reminded ? "Reminders sent" : "Send reminders"}
                  </Button>
                </Gated>
              }
            >
              {num(expired.length)} expired and {num(expiring.length)} expiring within 30 days of {fmtDate("2026-09-16")}. Automatic reminders go out 30, 7 and 1 day before expiry.
            </Alert>
          )}

          {seesAll && (
            <BarCompareChart
              title="Compliance-critical completion by department"
              description="Share of each department holding a valid certificate. Target is 100% for all three."
              data={CERT_COMPLETION_BY_DEPT}
              xKey="department"
              series={CRITICAL_CERTS.map((c) => ({ key: c, label: c }))}
              valueFormat={(v) => `${v}%`}
              height={260}
            />
          )}

          <DataTable
            columns={columns}
            data={visible}
            searchKeys={["name", "issuer"]}
            searchPlaceholder="Search certificate or issuer…"
            filters={
              <>
                <FilterSelect label="Status" value={band} onValueChange={setBand} options={Object.entries(BAND_META).map(([value, m]) => ({ value, label: m.label }))} />
                <FilterSelect label="Type" value={kind} onValueChange={setKind} options={[{ value: "Compliance", label: "Compliance" }, { value: "Professional", label: "Professional" }]} />
                <FilterSelect label="Certificate" value={name} onValueChange={setName} width="w-[200px]" options={CRITICAL_CERTS.map((c) => ({ value: c, label: c }))} />
              </>
            }
            enableSelection={seesAll}
            bulkActions={(sel, clear) => (
              <Gated menuKey="growth.certifications" action="E">
                <Button size="sm" onClick={() => { sendReminders(sel); clear(); }}>
                  <BellRing /> Remind {sel.length}
                </Button>
              </Gated>
            )}
            getRowId={(r) => r.id}
            rowTone={(r) => (r.band === "expired" ? "danger" : r.band === "expiring" ? "warning" : undefined)}
            exportName="certifications"
            emptyIcon={Award}
            emptyTitle={seesAll ? "No certificates match" : "No certificates on your record yet"}
            emptyDescription={seesAll ? "Clear the filters to see every certificate." : "Complete a compliance course on Learning and your certificate appears here."}
          />
        </>
      )}
    </PageBody>
  );
}
