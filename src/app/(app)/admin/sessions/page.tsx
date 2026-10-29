"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, LogOut, MonitorSmartphone, MoreHorizontal, ShieldCheck, ShieldOff, Users } from "lucide-react";
import { fmtAgo, fmtTime } from "@/lib/format";
import { ACTIVE_SESSIONS, type ActiveSession } from "@/mock/platform";
import { mockAction } from "@/components/app-state";
import { DataTable } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { PersonCell } from "@/components/people/person-cell";
import { CardsSkeleton, Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import {
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  FilterSelect,
} from "@/components/ui/overlays";
import { TonePill } from "@/components/platform/kit";

type Pending = { kind: "one" | "user" | "bulk"; ids: string[]; userCode?: string; label: string; clear?: () => void };

export default function SessionsPage() {
  const loading = useFakeLoad();
  const [sessions, setSessions] = React.useState<ActiveSession[]>(ACTIVE_SESSIONS);
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [mfaFilter, setMfaFilter] = React.useState("all");
  const [flagFilter, setFlagFilter] = React.useState("all");

  const data = React.useMemo(
    () =>
      sessions.filter((s) => {
        if (mfaFilter === "yes" && !s.mfa) return false;
        if (mfaFilter === "no" && s.mfa) return false;
        if (flagFilter === "flagged" && !s.suspicious) return false;
        return true;
      }),
    [sessions, mfaFilter, flagFilter],
  );

  const suspicious = sessions.filter((s) => s.suspicious);
  const users = new Set(sessions.map((s) => s.userCode)).size;

  const revoke = (p: Pending) => {
    const hit = sessions.filter((s) => (p.userCode ? s.userCode === p.userCode : p.ids.includes(s.id)));
    setSessions((prev) => prev.filter((s) => !hit.includes(s)));
    p.clear?.();
    mockAction(`${hit.length} session${hit.length === 1 ? "" : "s"} revoked`, {
      description: `${p.label} must sign in again. Refresh tokens were invalidated and the event is in the audit log.`,
      tone: "warning",
    });
  };

  const columns = React.useMemo<ColumnDef<ActiveSession, unknown>[]>(
    () => [
      {
        accessorKey: "userName",
        header: "User",
        cell: ({ row }) => <PersonCell name={row.original.userName} code={row.original.userCode} subtitle={row.original.roleLabel} />,
      },
      {
        accessorKey: "device",
        header: "Device",
        cell: ({ row }) => (
          <div className="flex flex-col gap-1 text-xs">
            <span>{row.original.device}</span>
            {row.original.suspicious && (
              <TonePill tone="danger" icon={AlertTriangle}>
                Suspicious
              </TonePill>
            )}
          </div>
        ),
      },
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
      { accessorKey: "startedAt", header: "Started", cell: ({ row }) => <span className="tnum text-xs">{fmtTime(row.original.startedAt)}</span> },
      {
        accessorKey: "lastActiveAt",
        header: "Last active",
        cell: ({ row }) => <span className="tnum text-xs text-muted-foreground">{fmtAgo(row.original.lastActiveAt)}</span>,
      },
      {
        accessorKey: "mfa",
        header: "MFA",
        cell: ({ row }) =>
          row.original.mfa ? (
            <span className="inline-flex items-center gap-1 text-xs text-success-fg">
              <ShieldCheck className="size-3.5" aria-hidden /> Yes
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-destructive-fg">
              <ShieldOff className="size-3.5" aria-hidden /> No
            </span>
          ),
      },
      {
        id: "__a",
        header: "",
        enableHiding: false,
        cell: ({ row }) => {
          const s = row.original;
          return (
            <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
              <Gated menuKey="admin.sessions" action="D">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Session actions for ${s.userName}`}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>{s.userName}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem destructive onSelect={() => setPending({ kind: "one", ids: [s.id], label: s.userName })}>
                      <LogOut /> Revoke this session
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      destructive
                      onSelect={() =>
                        setPending({ kind: "user", ids: [], userCode: s.userCode, label: s.userName })
                      }
                    >
                      <Users /> Revoke all sessions for user
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </Gated>
            </div>
          );
        },
      },
    ],
    [],
  );

  return (
    <PageBody>
      <PageHeader
        title="Active Sessions"
        description="Everyone signed in right now, on which device and from where. Revoking a session invalidates its refresh token; the user is signed out on their next request."
      />

      {loading ? (
        <>
          <CardsSkeleton />
          <TableSkeleton />
        </>
      ) : (
        <>
          <StatRow>
            <StatTile label="Active sessions" value={sessions.length} icon={MonitorSmartphone} hint={`${users} distinct users`} />
            <StatTile label="Without MFA" value={sessions.filter((s) => !s.mfa).length} icon={ShieldOff} tone={sessions.some((s) => !s.mfa) ? "warning" : "neutral"} hint="SSO without step-up" onClick={() => setMfaFilter("no")} />
            <StatTile label="Flagged suspicious" value={suspicious.length} icon={AlertTriangle} tone={suspicious.length ? "critical" : "neutral"} onClick={() => setFlagFilter("flagged")} hint="Impossible travel, new country" />
            <StatTile label="Session timeout" value="30 min idle" icon={LogOut} hint="12-hour absolute · Tenant Settings" />
          </StatRow>

          {suspicious.map((s) => (
            <Alert
              key={s.id}
              tone="danger"
              icon={AlertTriangle}
              title={`Suspicious session — ${s.userName} from ${s.city}`}
              action={
                <Gated menuKey="admin.sessions" action="D">
                  <Button size="sm" variant="destructive" onClick={() => setPending({ kind: "one", ids: [s.id], label: s.userName })}>
                    Revoke
                  </Button>
                </Gated>
              }
            >
              {s.suspicious} IP {s.ip}.
            </Alert>
          ))}

          <DataTable
            columns={columns}
            data={data}
            searchKeys={["userName", "userCode", "ip", "city", "device"]}
            searchPlaceholder="Search user, IP, city…"
            filters={
              <>
                <FilterSelect label="MFA" value={mfaFilter} onValueChange={setMfaFilter} options={[{ value: "yes", label: "With MFA" }, { value: "no", label: "Without MFA" }]} />
                <FilterSelect label="Risk" value={flagFilter} onValueChange={setFlagFilter} options={[{ value: "flagged", label: "Suspicious only" }]} />
              </>
            }
            rowTone={(s) => (s.suspicious ? "danger" : undefined)}
            enableSelection
            bulkActions={(sel, clear) => (
              <Gated menuKey="admin.sessions" action="D">
                <Button size="sm" variant="destructive" onClick={() => setPending({ kind: "bulk", ids: sel.map((s) => s.id), label: `${new Set(sel.map((s) => s.userCode)).size} user(s)`, clear })}>
                  <LogOut /> Revoke {sel.length}
                </Button>
              </Gated>
            )}
            getRowId={(s) => s.id}
            exportName="active-sessions"
            emptyIcon={MonitorSmartphone}
            emptyTitle="No sessions match"
            emptyDescription="Clear the filters to see everyone who is signed in."
          />
        </>
      )}

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(v) => !v && setPending(null)}
        title={pending?.kind === "user" ? `Sign ${pending.label} out everywhere?` : `Revoke ${pending?.ids.length ?? 0} session${pending?.ids.length === 1 ? "" : "s"}?`}
        description="Unsaved work in those browser tabs will be lost. If the account is compromised, also reset the password from Users."
        confirmLabel="Revoke"
        destructive
        onConfirm={() => pending && revoke(pending)}
      />
    </PageBody>
  );
}
