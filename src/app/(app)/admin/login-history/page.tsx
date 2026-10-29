"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, History, Lock, LockOpen, ShieldAlert, XCircle } from "lucide-react";
import { fmtDateTime, fmtTime, pct } from "@/lib/format";
import { LOCKED_ACCOUNTS, LOGIN_EVENTS, LOGIN_REASON_LABEL, type LockedAccount, type LoginEvent } from "@/mock/platform";
import { mockAction } from "@/components/app-state";
import { DataTable, MutedCell } from "@/components/data-table";
import { BarCompareChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, ChartSkeleton, Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { ConfirmDialog, FilterSelect } from "@/components/ui/overlays";
import { TonePill } from "@/components/platform/kit";

const DAYS = ["2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13", "2026-09-14", "2026-09-15", "2026-09-16"];

export default function LoginHistoryPage() {
  const loading = useFakeLoad();
  const [locked, setLocked] = React.useState<LockedAccount[]>(LOCKED_ACCOUNTS);
  const [unlocking, setUnlocking] = React.useState<LockedAccount | null>(null);
  const [result, setResult] = React.useState("all");
  const [reason, setReason] = React.useState("all");
  const [method, setMethod] = React.useState("all");
  const [day, setDay] = React.useState("all");

  const data = React.useMemo(
    () =>
      LOGIN_EVENTS.filter((e) => {
        if (result !== "all" && e.result !== result) return false;
        if (reason !== "all" && e.reason !== reason) return false;
        if (method !== "all" && e.method !== method) return false;
        if (day !== "all" && !e.at.startsWith(day)) return false;
        return true;
      }),
    [result, reason, method, day],
  );

  const failures = LOGIN_EVENTS.filter((e) => e.result === "failure");
  const daily = DAYS.map((d) => {
    const evs = LOGIN_EVENTS.filter((e) => e.at.startsWith(d));
    return { day: d.slice(8), success: evs.filter((e) => e.result === "success").length, failure: evs.filter((e) => e.result === "failure").length };
  });

  const columns = React.useMemo<ColumnDef<LoginEvent, unknown>[]>(
    () => [
      { accessorKey: "at", header: "When", cell: ({ row }) => <span className="tnum text-xs">{fmtDateTime(row.original.at)}</span> },
      {
        accessorKey: "userName",
        header: "User",
        cell: ({ row }) => (
          <div className="text-xs">
            <p className="font-medium">{row.original.userName}</p>
            <p className="text-[11px] text-muted-foreground">{row.original.email}</p>
          </div>
        ),
      },
      {
        accessorKey: "result",
        header: "Result",
        cell: ({ row }) =>
          row.original.result === "success" ? (
            <TonePill tone="success" icon={CheckCircle2}>Success</TonePill>
          ) : row.original.reason === "locked_out" ? (
            <TonePill tone="danger" icon={Lock}>Locked out</TonePill>
          ) : (
            <TonePill tone="warning" icon={XCircle}>Failed</TonePill>
          ),
      },
      {
        accessorKey: "reason",
        header: "Reason",
        cell: ({ row }) => (row.original.reason ? <span className="text-xs">{LOGIN_REASON_LABEL[row.original.reason]}</span> : <MutedCell>—</MutedCell>),
      },
      { accessorKey: "method", header: "Method", cell: ({ row }) => <span className="text-xs">{row.original.method}</span> },
      {
        accessorKey: "ip",
        header: "IP · location",
        cell: ({ row }) => (
          <div className="text-xs">
            <p className="font-mono">{row.original.ip}</p>
            <p className="text-[11px] text-muted-foreground">{row.original.city}</p>
          </div>
        ),
      },
      { accessorKey: "device", header: "Device", cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.device}</span> },
    ],
    [],
  );

  return (
    <PageBody>
      <PageHeader
        title="Login History"
        description="Every sign-in attempt for the last 7 days, successful or not. Five consecutive failures lock the account for 30 minutes; an admin can unlock it sooner."
      />

      {loading ? (
        <>
          <CardsSkeleton />
          <ChartSkeleton height={160} />
          <TableSkeleton />
        </>
      ) : (
        <>
          {locked.map((l) => (
            <Alert
              key={l.userCode}
              tone="danger"
              icon={ShieldAlert}
              title={`${l.userName} (${l.userCode}) is locked out`}
              action={
                <Gated menuKey="admin.login_history" action="E">
                  <Button size="sm" variant="outline" onClick={() => setUnlocking(l)}>
                    <LockOpen /> Unlock
                  </Button>
                </Gated>
              }
            >
              {l.attempts} failed attempts — locked at {fmtTime(l.lockedAt)} from {l.lastIp}. Unlocks automatically at {fmtTime(l.unlocksAt)}.
            </Alert>
          ))}

          <StatRow>
            <StatTile label="Sign-ins (7 days)" value={LOGIN_EVENTS.length} icon={History} />
            <StatTile label="Failure rate" value={pct((failures.length / LOGIN_EVENTS.length) * 100)} icon={XCircle} tone="warning" onClick={() => setResult("failure")} hint={`${failures.length} failed attempts`} />
            <StatTile label="MFA rejections" value={failures.filter((f) => f.reason === "mfa_failed").length} icon={ShieldAlert} onClick={() => { setResult("failure"); setReason("mfa_failed"); }} />
            <StatTile label="Locked right now" value={locked.length} icon={Lock} tone={locked.length ? "critical" : "neutral"} />
          </StatRow>

          <BarCompareChart
            title="Sign-ins per day"
            description="September 2026"
            data={daily}
            xKey="day"
            series={[
              { key: "success", label: "Successful" },
              { key: "failure", label: "Failed" },
            ]}
            stacked
            height={160}
            xLabelFormat={(v) => `${v} Sep`}
          />

          <DataTable
            columns={columns}
            data={data}
            searchKeys={["userName", "email", "ip", "city"]}
            searchPlaceholder="Search user, email, IP…"
            filters={
              <>
                <FilterSelect label="Result" value={result} onValueChange={setResult} options={[{ value: "success", label: "Success" }, { value: "failure", label: "Failure" }]} />
                <FilterSelect label="Reason" value={reason} onValueChange={setReason} width="w-[200px]" options={Object.entries(LOGIN_REASON_LABEL).map(([value, label]) => ({ value, label }))} />
                <FilterSelect label="Method" value={method} onValueChange={setMethod} width="w-[180px]" options={["Password + MFA", "Google SSO", "Microsoft SSO", "Password"].map((m) => ({ value: m, label: m }))} />
                <FilterSelect label="Day" value={day} onValueChange={setDay} options={DAYS.map((d) => ({ value: d, label: `${d.slice(8)} Sep` }))} />
              </>
            }
            rowTone={(e) => (e.reason === "locked_out" ? "danger" : e.result === "failure" ? "warning" : undefined)}
            exportName="login-history"
            emptyIcon={History}
            emptyTitle="No sign-ins match"
            emptyDescription="Widen the filters to see more attempts."
          />
        </>
      )}

      <ConfirmDialog
        open={!!unlocking}
        onOpenChange={(v) => !v && setUnlocking(null)}
        title={`Unlock ${unlocking?.userName ?? ""}?`}
        description="Only unlock after confirming with the employee that the failed attempts were theirs. The failed-attempt counter resets to zero."
        confirmLabel="Unlock account"
        onConfirm={() => {
          if (!unlocking) return;
          setLocked((prev) => prev.filter((l) => l.userCode !== unlocking.userCode));
          mockAction(`${unlocking.userName} unlocked`, { description: "They can sign in again immediately. The unlock is recorded in the audit log." });
        }}
      />
    </PageBody>
  );
}
