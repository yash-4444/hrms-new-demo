"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Ban,
  CheckCircle2,
  KeyRound,
  MoreHorizontal,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserPlus,
  Users,
  UserRoundCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtAgo, fmtDate, fmtDateTime } from "@/lib/format";
import { PERSONAS, personaById, type RoleId } from "@/lib/rbac";
import { deptName } from "@/mock/org";
import {
  AUDIT_ACTION_LABEL,
  PLATFORM_USERS,
  auditForActor,
  type PlatformUser,
  type PlatformUserStatus,
} from "@/mock/admin";
import { mockAction } from "@/components/app-state";
import { DataTable } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Avatar, Badge, Checkbox, Field, Input, Label, Switch, Textarea } from "@/components/ui/primitives";
import {
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  FilterSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/overlays";

/* --------------------------------------------------------------- schema */

const inviteSchema = z.object({
  name: z.string().min(3, "Enter the person's full name"),
  email: z
    .email("Enter a valid work email address")
    .refine((v) => v.toLowerCase().endsWith("@stellartech.in"), "Use a company address ending in @stellartech.in"),
  employeeCode: z
    .string()
    .trim()
    .refine((v) => v === "" || /^STL-\d{4}$/.test(v), "Employee codes look like STL-0142"),
  roles: z.array(z.string()).min(1, "Assign at least one role"),
  branchId: z.string().min(1, "Pick a work location"),
  sendEmail: z.boolean(),
  note: z.string().max(240, "Keep the note under 240 characters"),
});

type InviteValues = z.infer<typeof inviteSchema>;

const BRANCH_CHOICES = [
  { value: "BLR", label: "Bengaluru HQ" },
  { value: "PNQ", label: "Pune Delivery Centre" },
  { value: "EWR", label: "Newark NJ" },
  { value: "HYD", label: "Hyderabad Satellite" },
];

/* ---------------------------------------------------------------- chips */

function RoleChips({ roles }: { roles: RoleId[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {roles.map((r) => (
        <Badge
          key={r}
          variant={r === "tenant_owner" ? "soft" : "muted"}
          className="px-1.5 py-0 text-[10px] font-medium"
        >
          {personaById(r).role}
        </Badge>
      ))}
    </div>
  );
}

function MfaCell({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        on ? "text-success-fg" : "text-destructive-fg",
      )}
    >
      {on ? <ShieldCheck className="size-3.5" aria-hidden /> : <ShieldOff className="size-3.5" aria-hidden />}
      {on ? "Enabled" : "Not set up"}
    </span>
  );
}

/* ============================================================== the page */

export default function AdminUsersPage() {
  const loading = useFakeLoad();
  const [users, setUsers] = React.useState<PlatformUser[]>(PLATFORM_USERS);

  const [roleFilter, setRoleFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [mfaFilter, setMfaFilter] = React.useState("all");

  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<PlatformUser | null>(null);

  /* pending bulk / row operations, resolved through a confirm dialog */
  const [confirm, setConfirm] = React.useState<{
    kind: "suspend" | "reset" | "remove";
    ids: string[];
    clear?: () => void;
  } | null>(null);
  const [assign, setAssign] = React.useState<{ ids: string[]; clear?: () => void } | null>(null);
  const [assignRole, setAssignRole] = React.useState<RoleId>("manager");

  /* ------------------------------------------------------------ mutate */

  const patch = (ids: string[], fn: (u: PlatformUser) => PlatformUser) =>
    setUsers((prev) => prev.map((u) => (ids.includes(u.id) ? fn(u) : u)));

  const doSuspend = (ids: string[]) => {
    patch(ids, (u) => ({ ...u, status: "suspended", sessions30d: 0 }));
    setDetail((d) => (d && ids.includes(d.id) ? { ...d, status: "suspended", sessions30d: 0 } : d));
    mockAction(`Suspended ${ids.length} account${ids.length === 1 ? "" : "s"}`, {
      description: "Active sessions were revoked. Sign-in is blocked until an admin reactivates the account.",
      tone: "warning",
    });
  };

  const doReactivate = (ids: string[]) => {
    patch(ids, (u) => ({ ...u, status: "active" }));
    setDetail((d) => (d && ids.includes(d.id) ? { ...d, status: "active" } : d));
    mockAction(`Reactivated ${ids.length} account${ids.length === 1 ? "" : "s"}`, {
      description: "The user can sign in again with their existing credentials.",
    });
  };

  const doReset = (ids: string[]) => {
    patch(ids, (u) => ({ ...u, mfaEnabled: false, sessions30d: 0 }));
    setDetail((d) => (d && ids.includes(d.id) ? { ...d, mfaEnabled: false, sessions30d: 0 } : d));
    mockAction(`Password reset sent to ${ids.length} user${ids.length === 1 ? "" : "s"}`, {
      description: "The reset link expires in 24 hours. MFA enrolment has been cleared and must be set up again.",
    });
  };

  const doRemove = (ids: string[]) => {
    setUsers((prev) => prev.filter((u) => !ids.includes(u.id)));
    setDetail((d) => (d && ids.includes(d.id) ? null : d));
    mockAction(`Removed platform access for ${ids.length} user${ids.length === 1 ? "" : "s"}`, {
      description: "The employee record is retained; only the login has been deleted.",
      tone: "warning",
    });
  };

  const doAssign = (ids: string[], role: RoleId) => {
    patch(ids, (u) => (u.roles.includes(role) ? u : { ...u, roles: [...u.roles, role] }));
    setDetail((d) =>
      d && ids.includes(d.id) && !d.roles.includes(role) ? { ...d, roles: [...d.roles, role] } : d,
    );
    mockAction(`Assigned ${personaById(role).role} to ${ids.length} user${ids.length === 1 ? "" : "s"}`, {
      description: "Navigation and available actions change for them on the next page load.",
    });
  };

  /* ------------------------------------------------------ invite form */

  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      name: "",
      email: "",
      employeeCode: "",
      roles: ["employee"],
      branchId: "BLR",
      sendEmail: true,
      note: "",
    },
  });
  const selectedRoles = form.watch("roles");

  const onInvite = form.handleSubmit((values) => {
    const next: PlatformUser = {
      id: `USR-${String(users.length + 1).padStart(3, "0")}-N`,
      employeeCode: values.employeeCode || "—",
      name: values.name,
      email: values.email.toLowerCase(),
      roles: values.roles as RoleId[],
      status: "invited",
      mfaEnabled: false,
      lastLoginAt: null,
      lastLoginIp: null,
      createdAt: "2026-09-16T14:35:00",
      invitedByCode: "STL-0009",
      departmentId: "HR",
      branchId: values.branchId,
      designation: "Pending onboarding",
      sessions30d: 0,
      authMethod: "SSO · Google Workspace",
    };
    setUsers((prev) => [next, ...prev]);
    setInviteOpen(false);
    form.reset();
    mockAction(`Invited ${values.name}`, {
      description: values.sendEmail
        ? `An invitation was emailed to ${values.email}. It expires in 7 days.`
        : `The account was created without sending an email. Share the invite link manually.`,
    });
  });

  /* --------------------------------------------------------- derived */

  const filtered = React.useMemo(
    () =>
      users.filter((u) => {
        if (roleFilter !== "all" && !u.roles.includes(roleFilter as RoleId)) return false;
        if (statusFilter !== "all" && u.status !== statusFilter) return false;
        if (mfaFilter === "on" && !u.mfaEnabled) return false;
        if (mfaFilter === "off" && u.mfaEnabled) return false;
        return true;
      }),
    [users, roleFilter, statusFilter, mfaFilter],
  );

  const stats = React.useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => u.status === "active").length,
      invited: users.filter((u) => u.status === "invited").length,
      suspended: users.filter((u) => u.status === "suspended").length,
      withoutMfa: users.filter((u) => !u.mfaEnabled).length,
    }),
    [users],
  );

  const clearFilters = () => {
    setRoleFilter("all");
    setStatusFilter("all");
    setMfaFilter("all");
  };

  /* ---------------------------------------------------------- columns */

  const columns = React.useMemo<ColumnDef<PlatformUser, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "User",
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2">
            <Avatar name={row.original.name} size={24} />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground">{row.original.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">{row.original.email}</p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "employeeCode",
        header: "Employee",
        cell: ({ row }) => (
          <span className="font-mono text-[11px] text-muted-foreground">{row.original.employeeCode}</span>
        ),
      },
      {
        id: "roles",
        header: "Roles",
        cell: ({ row }) => <RoleChips roles={row.original.roles} />,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "mfaEnabled",
        header: "MFA",
        cell: ({ row }) => <MfaCell on={row.original.mfaEnabled} />,
      },
      {
        accessorKey: "lastLoginAt",
        header: "Last login",
        cell: ({ row }) =>
          row.original.lastLoginAt ? (
            <div>
              <p className="tnum text-xs text-foreground">{fmtDateTime(row.original.lastLoginAt)}</p>
              <p className="text-[11px] text-muted-foreground">
                {fmtAgo(row.original.lastLoginAt)} · {row.original.lastLoginIp}
              </p>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Never signed in</span>
          ),
      },
      {
        accessorKey: "sessions30d",
        header: "Sessions 30d",
        cell: ({ row }) => <span className="tnum block text-right text-xs">{row.original.sessions30d}</span>,
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => <span className="tnum text-xs text-muted-foreground">{fmtDate(row.original.createdAt)}</span>,
      },
      {
        id: "__actions",
        header: "",
        size: 40,
        enableHiding: false,
        cell: ({ row }) => {
          const u = row.original;
          return (
            <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${u.name}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{u.name}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setDetail(u)}>
                    <Users /> View details
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setAssign({ ids: [u.id] })}>
                    <UserRoundCog /> Assign role
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setConfirm({ kind: "reset", ids: [u.id] })}>
                    <KeyRound /> Reset password
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {u.status === "suspended" ? (
                    <DropdownMenuItem onSelect={() => doReactivate([u.id])}>
                      <CheckCircle2 /> Reactivate account
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem destructive onSelect={() => setConfirm({ kind: "suspend", ids: [u.id] })}>
                      <Ban /> Suspend account
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem destructive onSelect={() => setConfirm({ kind: "remove", ids: [u.id] })}>
                    <Trash2 /> Remove access
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /* ------------------------------------------------------------- view */

  return (
    <PageBody>
      <PageHeader
        title="Users"
        description="Every login that can reach this tenant, the roles attached to it, and how each account authenticates. Suspending an account revokes its sessions immediately."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/roles">What can each role do?</Link>
            </Button>
            <Gated menuKey="admin.users" action="C">
              <Button size="sm" onClick={() => setInviteOpen(true)}>
                <UserPlus /> Invite user
              </Button>
            </Gated>
          </>
        }
      />

      {loading ? (
        <>
          <CardsSkeleton />
          <TableSkeleton />
        </>
      ) : (
        <>
          <StatRow>
            <StatTile
              label="Platform users"
              value={stats.total}
              icon={Users}
              hint={`${stats.suspended} suspended`}
              onClick={clearFilters}
              footer="Show every account"
            />
            <StatTile
              label="Active"
              value={stats.active}
              tone="good"
              icon={CheckCircle2}
              hint={`${Math.round((stats.active / Math.max(1, stats.total)) * 100)}% of all accounts`}
              onClick={() => {
                clearFilters();
                setStatusFilter("active");
              }}
              footer="Filter to active accounts"
            />
            <StatTile
              label="Invited — not yet signed in"
              value={stats.invited}
              tone="warning"
              icon={UserPlus}
              hint="Invitations expire after 7 days"
              onClick={() => {
                clearFilters();
                setStatusFilter("invited");
              }}
              footer="Filter to pending invitations"
            />
            <StatTile
              label="Without MFA"
              value={stats.withoutMfa}
              tone={stats.withoutMfa > 0 ? "critical" : "good"}
              icon={ShieldOff}
              hint="Breaks the ISO 27001 access control baseline"
              onClick={() => {
                clearFilters();
                setMfaFilter("off");
              }}
              footer="Filter to accounts missing MFA"
            />
          </StatRow>

          <DataTable<PlatformUser>
            columns={columns}
            data={filtered}
            getRowId={(u) => u.id}
            searchKeys={["name", "email", "employeeCode", "designation"]}
            searchPlaceholder="Search name, email or code…"
            exportName="platform-users"
            enableSelection
            onRowClick={(u) => setDetail(u)}
            emptyIcon={Users}
            emptyTitle="No user matches these filters"
            emptyDescription="Clear the role, status or MFA filter to see the rest of the tenant."
            emptyAction={
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            }
            rowTone={(u) => (u.status === "suspended" ? "danger" : !u.mfaEnabled ? "warning" : undefined)}
            filters={
              <>
                <FilterSelect
                  label="Role"
                  value={roleFilter}
                  onValueChange={setRoleFilter}
                  allLabel="All roles"
                  width="w-[168px]"
                  options={PERSONAS.map((p) => ({ value: p.id, label: p.role }))}
                />
                <FilterSelect
                  label="Status"
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                  allLabel="All statuses"
                  width="w-[150px]"
                  options={[
                    { value: "active", label: "Active" },
                    { value: "invited", label: "Invited" },
                    { value: "suspended", label: "Suspended" },
                  ]}
                />
                <FilterSelect
                  label="MFA"
                  value={mfaFilter}
                  onValueChange={setMfaFilter}
                  allLabel="Any"
                  width="w-[128px]"
                  options={[
                    { value: "on", label: "Enabled" },
                    { value: "off", label: "Not set up" },
                  ]}
                />
                {(roleFilter !== "all" || statusFilter !== "all" || mfaFilter !== "all") && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear
                  </Button>
                )}
              </>
            }
            bulkActions={(rows, clear) => (
              <>
                <Gated menuKey="admin.users" action="E">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAssign({ ids: rows.map((r) => r.id), clear })}
                  >
                    <UserRoundCog /> Assign role
                  </Button>
                </Gated>
                <Gated menuKey="admin.users" action="E">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirm({ kind: "reset", ids: rows.map((r) => r.id), clear })}
                  >
                    <KeyRound /> Reset password
                  </Button>
                </Gated>
                <Gated menuKey="admin.users" action="E">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirm({ kind: "suspend", ids: rows.map((r) => r.id), clear })}
                  >
                    <Ban /> Suspend
                  </Button>
                </Gated>
              </>
            )}
          />
        </>
      )}

      {/* ------------------------------------------------ invite dialog */}
      <Dialog
        open={inviteOpen}
        onOpenChange={(v) => {
          setInviteOpen(v);
          if (!v) form.reset();
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Invite a user</DialogTitle>
            <DialogDescription>
              The invitation is sent to a company address and expires after 7 days. Roles can be changed at any
              time from this screen.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onInvite}>
            <DialogBody className="flex flex-col gap-3.5">
              <div className="grid gap-3.5 sm:grid-cols-2">
                <Field label="Full name" htmlFor="inv-name" required error={form.formState.errors.name?.message}>
                  <Input
                    id="inv-name"
                    placeholder="Kavya Iyer"
                    aria-invalid={!!form.formState.errors.name}
                    {...form.register("name")}
                  />
                </Field>
                <Field label="Work email" htmlFor="inv-email" required error={form.formState.errors.email?.message}>
                  <Input
                    id="inv-email"
                    type="email"
                    placeholder="kavya.iyer@stellartech.in"
                    aria-invalid={!!form.formState.errors.email}
                    {...form.register("email")}
                  />
                </Field>
                <Field
                  label="Employee code"
                  htmlFor="inv-code"
                  error={form.formState.errors.employeeCode?.message}
                  hint="Leave blank for a contractor or an external auditor."
                >
                  <Input
                    id="inv-code"
                    placeholder="STL-0142"
                    aria-invalid={!!form.formState.errors.employeeCode}
                    {...form.register("employeeCode")}
                  />
                </Field>
                <Field label="Work location" required error={form.formState.errors.branchId?.message}>
                  <Select
                    value={form.watch("branchId")}
                    onValueChange={(v) => form.setValue("branchId", v, { shouldDirty: true })}
                  >
                    <SelectTrigger aria-label="Work location">
                      <span>{BRANCH_CHOICES.find((b) => b.value === form.watch("branchId"))?.label}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {BRANCH_CHOICES.map((b) => (
                        <SelectItem key={b.value} value={b.value}>
                          {b.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field
                label="Roles"
                required
                error={form.formState.errors.roles?.message}
                hint="A user may hold more than one role. Grants are the union of every role held."
              >
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {PERSONAS.map((p) => {
                    const checked = selectedRoles.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-2 rounded-md border p-2 transition-colors",
                          checked ? "border-primary/40 bg-primary-soft/40" : "border-border hover:bg-muted/60",
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) =>
                            form.setValue(
                              "roles",
                              v ? [...selectedRoles, p.id] : selectedRoles.filter((r) => r !== p.id),
                              { shouldValidate: true, shouldDirty: true },
                            )
                          }
                          aria-label={p.role}
                          className="mt-0.5"
                        />
                        <span className="min-w-0">
                          <span className="block text-xs font-medium text-foreground">{p.role}</span>
                          <span className="block text-[11px] leading-snug text-muted-foreground">
                            {p.description}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </Field>

              <Field
                label="Note to include in the invitation"
                htmlFor="inv-note"
                error={form.formState.errors.note?.message}
              >
                <Textarea
                  id="inv-note"
                  placeholder="Welcome aboard — your first-day checklist is in the Onboarding space."
                  aria-invalid={!!form.formState.errors.note}
                  {...form.register("note")}
                />
              </Field>

              <label className="flex items-center gap-2 rounded-md border border-border p-2">
                <Switch
                  checked={form.watch("sendEmail")}
                  onCheckedChange={(v) => form.setValue("sendEmail", v, { shouldDirty: true })}
                  aria-label="Send the invitation email now"
                />
                <span>
                  <span className="block text-xs font-medium">Send the invitation email now</span>
                  <span className="block text-[11px] text-muted-foreground">
                    Turn this off to create the account and share the link yourself.
                  </span>
                </span>
              </label>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                <UserPlus /> Send invitation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------- assign role dialog */}
      <Dialog open={!!assign} onOpenChange={(v) => !v && setAssign(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Assign a role</DialogTitle>
            <DialogDescription>
              {assign?.ids.length === 1
                ? "The role is added to the user's existing roles."
                : `The role is added to ${assign?.ids.length ?? 0} selected users, on top of the roles they already hold.`}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3">
            <Field label="Role" hint={personaById(assignRole).description}>
              <Select value={assignRole} onValueChange={(v) => setAssignRole(v as RoleId)}>
                <SelectTrigger aria-label="Role to assign">
                  <span>{personaById(assignRole).role}</span>
                </SelectTrigger>
                <SelectContent>
                  {PERSONAS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssign(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (assign) {
                  doAssign(assign.ids, assignRole);
                  assign.clear?.();
                }
                setAssign(null);
              }}
            >
              Assign role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------------------------------------- confirm dialogs */}
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        destructive={confirm?.kind !== "reset"}
        title={
          confirm?.kind === "reset"
            ? `Send a password reset to ${confirm.ids.length} user${confirm.ids.length === 1 ? "" : "s"}?`
            : confirm?.kind === "remove"
              ? `Remove platform access for ${confirm.ids.length} user${confirm.ids.length === 1 ? "" : "s"}?`
              : `Suspend ${confirm?.ids.length ?? 0} account${confirm?.ids.length === 1 ? "" : "s"}?`
        }
        description={
          confirm?.kind === "reset"
            ? "Their current password stops working and MFA enrolment is cleared. The reset link is valid for 24 hours."
            : confirm?.kind === "remove"
              ? "The login is deleted and the row disappears from this list. The employee record itself is untouched."
              : "Active sessions are revoked immediately and sign-in is blocked until an admin reactivates the account."
        }
        confirmLabel={
          confirm?.kind === "reset" ? "Send reset link" : confirm?.kind === "remove" ? "Remove access" : "Suspend"
        }
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.kind === "reset") doReset(confirm.ids);
          else if (confirm.kind === "remove") doRemove(confirm.ids);
          else doSuspend(confirm.ids);
          confirm.clear?.();
          setConfirm(null);
        }}
      />

      {/* ----------------------------------------------- detail drawer */}
      <Sheet open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <SheetContent width="sm:max-w-lg">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2.5">
                  <Avatar name={detail.name} size={32} />
                  <span className="min-w-0">
                    <span className="block truncate">{detail.name}</span>
                    <span className="block truncate text-xs font-normal text-muted-foreground">
                      {detail.designation} · {deptName(detail.departmentId)}
                    </span>
                  </span>
                </SheetTitle>
              </SheetHeader>
              <SheetBody className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={detail.status} />
                  <MfaCell on={detail.mfaEnabled} />
                  <Badge variant="outline" className="text-[10px]">
                    {detail.authMethod}
                  </Badge>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-md border border-border p-3 text-xs">
                  {[
                    ["Login email", detail.email],
                    ["Employee code", detail.employeeCode],
                    ["User ID", detail.id],
                    ["Work location", BRANCH_CHOICES.find((b) => b.value === detail.branchId)?.label ?? detail.branchId],
                    ["Last sign-in", detail.lastLoginAt ? fmtDateTime(detail.lastLoginAt) : "Never signed in"],
                    ["Last sign-in IP", detail.lastLoginIp ?? "—"],
                    ["Sessions (30 days)", String(detail.sessions30d)],
                    ["Account created", fmtDate(detail.createdAt)],
                    ["Invited by", detail.invitedByCode ?? "Tenant provisioning"],
                  ].map(([k, v]) => (
                    <div key={k} className="min-w-0">
                      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</dt>
                      <dd className="truncate text-xs text-foreground">{v}</dd>
                    </div>
                  ))}
                </dl>

                <div>
                  <p className="mb-1.5 text-xs font-semibold">Assigned roles</p>
                  <div className="flex flex-col gap-1.5">
                    {detail.roles.map((r) => (
                      <div key={r} className="flex items-start gap-2 rounded-md border border-border p-2">
                        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                        <div className="min-w-0">
                          <p className="text-xs font-medium">{personaById(r).role}</p>
                          <p className="text-[11px] text-muted-foreground">{personaById(r).description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-semibold">Recent activity in the audit log</p>
                  {auditForActor(detail.employeeCode, 6).length ? (
                    <ul className="flex flex-col gap-1.5">
                      {auditForActor(detail.employeeCode, 6).map((e) => (
                        <li key={e.id} className="rounded-md border border-border p-2">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {AUDIT_ACTION_LABEL[e.action]}
                            </span>
                            <span className="tnum shrink-0 text-[10px] text-muted-foreground">
                              {fmtDateTime(e.at)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-foreground">{e.summary}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                      No audit entries recorded for this account in the last 45 days.
                    </p>
                  )}
                  <Button variant="link" size="sm" className="mt-1 px-0" asChild>
                    <Link href="/admin/audit">Open the full audit log</Link>
                  </Button>
                </div>
              </SheetBody>
              <SheetFooter>
                <Gated menuKey="admin.users" action="E">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirm({ kind: "reset", ids: [detail.id] })}
                  >
                    <KeyRound /> Reset password
                  </Button>
                </Gated>
                <Gated menuKey="admin.users" action="E">
                  <Button variant="outline" size="sm" onClick={() => setAssign({ ids: [detail.id] })}>
                    <UserRoundCog /> Assign role
                  </Button>
                </Gated>
                {detail.status === "suspended" ? (
                  <Gated menuKey="admin.users" action="E">
                    <Button size="sm" onClick={() => doReactivate([detail.id])}>
                      <CheckCircle2 /> Reactivate
                    </Button>
                  </Gated>
                ) : (
                  <Gated menuKey="admin.users" action="E">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setConfirm({ kind: "suspend", ids: [detail.id] })}
                    >
                      <Ban /> Suspend
                    </Button>
                  </Gated>
                )}
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </PageBody>
  );
}
