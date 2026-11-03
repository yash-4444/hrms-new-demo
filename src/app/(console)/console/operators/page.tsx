"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { KeyRound, MailCheck, MoreHorizontal, Play, ShieldAlert, ShieldCheck, ShieldOff, UserCog, UserMinus, UserPlus, Users } from "lucide-react";
import { fmtAgo, fmtDateTime, num } from "@/lib/format";
import { PLATFORM_PERSONA } from "@/lib/rbac";
import { OPERATORS, PLATFORM_ROLE_LABEL, type Operator, type OperatorStatus, type PlatformRole } from "@/mock/console-operators";
import { demoNowMs, mockAction } from "@/components/app-state";
import { recordConsoleAudit } from "@/components/console/console-audit-trail";
import { ChangeRoleDialog, InviteOperatorDialog } from "@/components/console/operators-dialogs";
import { OperatorsMatrix } from "@/components/console/operators-matrix";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { DataTable } from "@/components/data-table";
import { CardsSkeleton, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { ReasonDialog, TonePill, type PTone } from "@/components/platform/kit";
import { Button } from "@/components/ui/button";
import { Alert, Avatar } from "@/components/ui/primitives";
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

const ROLE_TONE: Record<PlatformRole, PTone> = { super_admin: "danger", support_engineer: "accent", billing_manager: "info", auditor: "neutral" };
const STATUS_TONE: Record<OperatorStatus, { tone: PTone; label: string }> = {
  active: { tone: "success", label: "Active" },
  invited: { tone: "info", label: "Invited" },
  deactivated: { tone: "neutral", label: "Deactivated" },
};

type Pending = { kind: "role" | "deactivate" | "mfa" | "reactivate"; op: Operator };

const audit = (action: string, op: Operator, reason?: string, before?: Record<string, string>, after?: Record<string, string>) =>
  recordConsoleAudit({ action, category: "operator", target: { kind: "operator", id: op.id, label: op.name }, reason, before, after });

export default function OperatorsPage() {
  const loading = useFakeLoad();
  const [ops, setOps] = React.useState<Operator[]>(OPERATORS);
  const [inviting, setInviting] = React.useState(false);
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [role, setRole] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const me = PLATFORM_PERSONA.name;

  const patch = (id: string, p: Partial<Operator>) => setOps((os) => os.map((o) => (o.id === id ? { ...o, ...p } : o)));

  const active = ops.filter((o) => o.status === "active");
  const noMfa = active.filter((o) => !o.mfa.enrolled);
  const data = ops.filter((o) => (role === "all" || o.role === role) && (status === "all" || o.status === status));

  const columns = React.useMemo<ColumnDef<Operator, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Operator",
        cell: ({ row }) => (
          <span className="flex items-center gap-2">
            <Avatar name={row.original.name} size={26} />
            <span className="min-w-0">
              <span className="block truncate font-medium">
                {row.original.name}
                {row.original.name === me && <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">(you)</span>}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">{row.original.email}</span>
            </span>
          </span>
        ),
      },
      { accessorKey: "role", header: "Platform role", cell: ({ row }) => <TonePill tone={ROLE_TONE[row.original.role]}>{PLATFORM_ROLE_LABEL[row.original.role]}</TonePill> },
      {
        id: "mfa",
        header: "MFA",
        accessorFn: (o) => (o.mfa.enrolled ? "Enrolled" : "Not enrolled"),
        cell: ({ row }) => {
          const o = row.original;
          if (o.mfa.enrolled) return <TonePill tone="success" icon={ShieldCheck}>{o.mfa.method}</TonePill>;
          return o.status === "invited" ? <TonePill tone="neutral">At first sign-in</TonePill> : <TonePill tone="danger" icon={ShieldAlert}>Not enrolled</TonePill>;
        },
      },
      {
        accessorKey: "lastSignInAt",
        header: "Last sign-in",
        cell: ({ row }) =>
          row.original.lastSignInAt ? (
            <div className="text-xs">
              <p className="whitespace-nowrap">{fmtAgo(row.original.lastSignInAt)}</p>
              <p className="font-mono text-[11px] text-muted-foreground">{row.original.lastSignInIp}</p>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Never — invited {row.original.invitedAt ? fmtAgo(row.original.invitedAt) : ""}</span>
          ),
      },
      {
        id: "ips",
        header: "IP allow-list",
        accessorFn: (o) => o.ipAllowList.join(", "),
        cell: ({ row }) => (
          <span className="flex flex-col font-mono text-[11px]">
            {row.original.ipAllowList.map((ip) => (
              <span key={ip}>{ip}</span>
            ))}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <TonePill tone={STATUS_TONE[row.original.status].tone}>{STATUS_TONE[row.original.status].label}</TonePill>
            {row.original.deactivatedReason && <span className="max-w-[180px] truncate text-[11px] text-muted-foreground">{row.original.deactivatedReason}</span>}
          </div>
        ),
      },
      {
        id: "__a",
        header: "",
        enableHiding: false,
        cell: ({ row }) => {
          const o = row.original;
          const self = o.name === me;
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${o.name}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{self ? `${o.name} (you)` : o.name}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled={self || o.status === "deactivated"} onSelect={() => setPending({ kind: "role", op: o })}>
                    <UserCog /> Change role{self ? " — not your own" : ""}
                  </DropdownMenuItem>
                  {o.status === "invited" ? (
                    <DropdownMenuItem
                      onSelect={() => {
                        audit("operator.invite_resend", o);
                        mockAction(`Invitation re-sent to ${o.email}`, { description: "The new link expires in 72 hours; the old one no longer works." });
                      }}
                    >
                      <MailCheck /> Resend invitation
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem disabled={self || o.status !== "active" || !o.mfa.enrolled} onSelect={() => setPending({ kind: "mfa", op: o })}>
                      <KeyRound /> Reset MFA
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {o.status === "deactivated" ? (
                    <DropdownMenuItem onSelect={() => setPending({ kind: "reactivate", op: o })}>
                      <Play /> Reactivate
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem destructive disabled={self} onSelect={() => setPending({ kind: "deactivate", op: o })}>
                      <UserMinus /> {self ? "You cannot deactivate yourself" : o.status === "invited" ? "Revoke invitation" : "Deactivate"}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [me],
  );

  const p = pending?.op;

  return (
    <PageBody>
      <PageHeader
        title="Operators"
        description="Vendor staff with access to the Platform Console. Every operator signs in with MFA from an allow-listed network; none of them belongs to a tenant."
        actions={
          <Button size="sm" onClick={() => setInviting(true)}>
            <UserPlus /> Invite operator
          </Button>
        }
      />

      {loading ? (
        <>
          <CardsSkeleton count={4} />
          <TableSkeleton rows={8} />
        </>
      ) : (
        <>
          {noMfa.length > 0 && (
            <Alert tone="danger" icon={ShieldOff} title={`${noMfa.map((o) => o.name).join(", ")} ${noMfa.length === 1 ? "has" : "have"} no MFA factor enrolled`}>
              MFA is enforced for every operator: until a factor is enrolled, every action that needs step-up verification is refused. Ask them to enrol, or deactivate the account.
            </Alert>
          )}
          <StatRow cols={4}>
            <StatTile label="Active operators" value={num(active.length)} icon={Users} onClick={() => setStatus("active")} />
            <StatTile label="Super Admins" value={num(active.filter((o) => o.role === "super_admin").length)} icon={ShieldAlert} hint="Can delete tenants and manage operators" onClick={() => setRole("super_admin")} />
            <StatTile label="MFA not enrolled" value={num(noMfa.length)} icon={ShieldOff} tone={noMfa.length ? "critical" : "good"} hint="Target is 0 — MFA is enforced" />
            <StatTile label="Pending invitations" value={num(ops.filter((o) => o.status === "invited").length)} icon={MailCheck} onClick={() => setStatus("invited")} />
          </StatRow>

          <Section title="Console access" bodyClassName="p-4">
            <DataTable
              columns={columns}
              data={data}
              searchKeys={["name", "email", "id"]}
              searchPlaceholder="Search name or email…"
              getRowId={(o) => o.id}
              rowTone={(o) => (o.status === "active" && !o.mfa.enrolled ? "danger" : undefined)}
              exportName="platform-operators"
              canExport
              emptyIcon={Users}
              emptyTitle="No operators match"
              emptyDescription="Clear the role or status filter."
              filters={
                <>
                  <FilterSelect label="Role" value={role} onValueChange={setRole} width="w-[190px]" options={(Object.keys(PLATFORM_ROLE_LABEL) as PlatformRole[]).map((r) => ({ value: r, label: PLATFORM_ROLE_LABEL[r] }))} />
                  <FilterSelect label="Status" value={status} onValueChange={setStatus} options={(Object.keys(STATUS_TONE) as OperatorStatus[]).map((s) => ({ value: s, label: STATUS_TONE[s].label }))} />
                </>
              }
            />
          </Section>

          <OperatorsMatrix />
        </>
      )}

      {inviting && (
        <InviteOperatorDialog
          existingEmails={ops.map((o) => o.email.toLowerCase())}
          onOpenChange={setInviting}
          onInvite={(o) => {
            const op: Operator = { ...o, id: `OP-0${11 + ops.length - OPERATORS.length}`, status: "invited", mfa: { enrolled: false }, invitedAt: format(new Date(demoNowMs()), "yyyy-MM-dd'T'HH:mm:ss"), invitedBy: me };
            setOps((os) => [...os, op]);
            audit("operator.invite", op, undefined, undefined, { role: o.role, email: o.email, ipAllowList: o.ipAllowList.join(", ") });
            mockAction(`Invitation sent to ${o.email}`, { description: `${PLATFORM_ROLE_LABEL[o.role]} · expires in 72 hours.` });
            setInviting(false);
          }}
        />
      )}

      {pending?.kind === "role" && p && (
        <ChangeRoleDialog
          operator={p}
          onOpenChange={(v) => !v && setPending(null)}
          onConfirm={(r, reason) => {
            patch(p.id, { role: r });
            audit("operator.role_change", p, reason, { role: p.role }, { role: r });
            mockAction(`${p.name} is now ${PLATFORM_ROLE_LABEL[r]}`, { description: `Was ${PLATFORM_ROLE_LABEL[p.role]}. ${p.name.split(" ")[0]} has been emailed.`, undo: () => patch(p.id, { role: p.role }) });
            setPending(null);
          }}
        />
      )}

      <ReasonDialog
        open={pending?.kind === "deactivate"}
        onOpenChange={(v) => !v && setPending(null)}
        title={p?.status === "invited" ? `Revoke ${p.name}'s invitation?` : `Deactivate ${p?.name ?? "operator"}?`}
        description="Signs them out of the console everywhere and ends any support session they have open. The account and its audit history are kept."
        confirmLabel={p?.status === "invited" ? "Revoke invitation" : "Deactivate"}
        commentPlaceholder="e.g. Moved to the sales team on 30 Sep."
        onConfirm={(reason) => {
          if (!p) return;
          patch(p.id, { status: "deactivated", deactivatedReason: reason });
          audit("operator.deactivate", p, reason, { status: p.status }, { status: "deactivated" });
          mockAction(`${p.name} deactivated`, { description: "Console sessions revoked.", tone: "warning", undo: () => patch(p.id, { status: p.status, deactivatedReason: undefined }) });
        }}
      />

      <ConfirmDialog
        open={pending?.kind === "mfa"}
        onOpenChange={(v) => !v && setPending(null)}
        title={`Reset MFA for ${p?.name ?? "operator"}?`}
        description={`Removes their ${p?.mfa.method?.toLowerCase() ?? "factor"}. They are signed out and must enrol a new factor at the next sign-in; until then step-up actions are refused. Verify their identity out of band first.`}
        confirmLabel="Reset MFA"
        destructive
        comment={{ label: "How identity was verified", placeholder: "e.g. Video call with ID, ticket IT-2211." }}
        onConfirm={(reason) => {
          if (!p) return;
          patch(p.id, { mfa: { enrolled: false } });
          audit("operator.mfa_reset", p, reason, { mfa: "enrolled" }, { mfa: "not_enrolled" });
          mockAction(`MFA reset for ${p.name}`, { description: "Enrolment link emailed; it expires in 24 hours.", tone: "warning" });
        }}
      />

      <ConfirmDialog
        open={pending?.kind === "reactivate"}
        onOpenChange={(v) => !v && setPending(null)}
        title={`Reactivate ${p?.name ?? "operator"}?`}
        description={`Restores console access as ${p ? PLATFORM_ROLE_LABEL[p.role] : ""}. ${p?.lastSignInAt ? `Last signed in ${fmtDateTime(p.lastSignInAt)}.` : ""} Review the role before confirming.`}
        confirmLabel="Reactivate"
        comment={{ label: "Reason" }}
        onConfirm={(reason) => {
          if (!p) return;
          patch(p.id, { status: "active", deactivatedReason: undefined });
          audit("operator.reactivate", p, reason, { status: "deactivated" }, { status: "active" });
          mockAction(`${p.name} reactivated`, { description: "They can sign in to the console again." });
        }}
      />
    </PageBody>
  );
}
