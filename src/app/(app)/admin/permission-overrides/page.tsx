"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, KeyRound, Plus, ShieldMinus, ShieldPlus, Trash2 } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { ACTION_LABEL, MENU_META, personaById, type MenuKey } from "@/lib/rbac";
import { employeeName } from "@/mock/employees";
import { OVERRIDE_SUBJECTS, PERMISSION_OVERRIDES, type PermissionOverride } from "@/mock/platform";
import { mockAction } from "@/components/app-state";
import { DataTable, MutedCell } from "@/components/data-table";
import { PersonCell } from "@/components/people/person-cell";
import { Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/overlays";
import { TonePill, ReasonDialog } from "@/components/platform/kit";
import { EffectivePermissions, isOverrideExpired } from "@/components/platform/effective-permissions";
import { OverrideDialog } from "@/components/platform/override-dialog";

const menuLabel = (k: MenuKey) => {
  const m = MENU_META.find((x) => x.key === k);
  return m ? `${m.module} › ${m.label}` : k;
};

const isExpired = isOverrideExpired;

export default function PermissionOverridesPage() {
  const loading = useFakeLoad();
  const [rows, setRows] = React.useState<PermissionOverride[]>(PERMISSION_OVERRIDES);
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [subject, setSubject] = React.useState<string>("STL-0017");
  const [revoking, setRevoking] = React.useState<PermissionOverride | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);

  const data = React.useMemo(
    () =>
      rows.filter((o) => {
        if (statusFilter === "active") return !isExpired(o);
        if (statusFilter === "expired") return isExpired(o);
        return true;
      }),
    [rows, statusFilter],
  );

  const columns = React.useMemo<ColumnDef<PermissionOverride, unknown>[]>(
    () => [
      {
        accessorKey: "employeeCode",
        header: "Employee",
        cell: ({ row }) => (
          <PersonCell name={employeeName(row.original.employeeCode)} code={row.original.employeeCode} subtitle={personaById(row.original.role).role} />
        ),
      },
      { accessorKey: "menuKey", header: "Menu", cell: ({ row }) => <span className="text-xs">{menuLabel(row.original.menuKey)}</span> },
      {
        id: "change",
        header: "Change",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.grant.map((a) => (
              <TonePill key={`g${a}`} tone="success" icon={ShieldPlus}>+ {ACTION_LABEL[a]}</TonePill>
            ))}
            {row.original.revoke.map((a) => (
              <TonePill key={`r${a}`} tone="danger" icon={ShieldMinus}>− {ACTION_LABEL[a]}</TonePill>
            ))}
          </div>
        ),
      },
      { accessorKey: "reason", header: "Reason", cell: ({ row }) => <p className="max-w-[320px] text-xs text-muted-foreground">{row.original.reason}</p> },
      {
        accessorKey: "expiresAt",
        header: "Expires",
        cell: ({ row }) =>
          !row.original.expiresAt ? (
            <MutedCell>Permanent</MutedCell>
          ) : isExpired(row.original) ? (
            <TonePill tone="neutral">Expired {fmtDate(row.original.expiresAt)}</TonePill>
          ) : (
            <span className="tnum text-xs">{fmtDate(row.original.expiresAt)}</span>
          ),
      },
      {
        accessorKey: "grantedBy",
        header: "Granted by",
        cell: ({ row }) => (
          <div className="text-xs">
            <p>{row.original.grantedBy}</p>
            <p className="text-[11px] text-muted-foreground">{fmtDate(row.original.grantedAt)}</p>
          </div>
        ),
      },
      {
        id: "__a",
        header: "",
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon-sm" aria-label="Show effective permissions" onClick={() => setSubject(row.original.employeeCode)}>
              <Eye />
            </Button>
            <Gated menuKey="admin.overrides" action="E">
              <Button variant="ghost" size="icon-sm" aria-label="Revoke override" onClick={() => setRevoking(row.original)}>
                <Trash2 />
              </Button>
            </Gated>
          </div>
        ),
      },
    ],
    [],
  );

  const subjectRole = OVERRIDE_SUBJECTS.find((s) => s.code === subject)?.role ?? "employee";

  return (
    <PageBody>
      <PageHeader
        title="Permission Overrides"
        description="Employee-level grants and revocations that win over the role baseline. Every override needs a reason, is audited, and should carry an expiry — permanent overrides are flagged in the quarterly access review."
        actions={
          <Gated menuKey="admin.overrides" action="C">
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus /> Add override
            </Button>
          </Gated>
        }
      />

      {loading ? (
        <TableSkeleton rows={6} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data}
            searchKeys={["employeeCode", "reason", "grantedBy"]}
            searchPlaceholder="Search overrides…"
            filters={
              <FilterSelect
                label="Status"
                value={statusFilter}
                onValueChange={setStatusFilter}
                options={[
                  { value: "active", label: "Active" },
                  { value: "expired", label: "Expired" },
                ]}
              />
            }
            onRowClick={(o) => setSubject(o.employeeCode)}
            rowTone={(o) => (isExpired(o) ? undefined : !o.expiresAt ? "warning" : undefined)}
            exportName="permission-overrides"
            emptyIcon={KeyRound}
            emptyTitle="No overrides"
            emptyDescription="Everyone has exactly their role's baseline permissions."
          />

          <Section
            title="Effective permissions"
            description="Role baseline merged with this employee's active overrides. Highlighted cells differ from the baseline."
            actions={
              <FilterSelect
                label="Employee"
                value={subject}
                onValueChange={(v) => v !== "all" && setSubject(v)}
                allLabel="Pick an employee"
                width="w-[260px]"
                options={OVERRIDE_SUBJECTS.map((s) => ({ value: s.code, label: `${employeeName(s.code)} · ${personaById(s.role).role}` }))}
              />
            }
          >
            <EffectivePermissions role={subjectRole} overrides={rows.filter((o) => o.employeeCode === subject && !isExpired(o))} />
          </Section>
        </>
      )}

      <OverrideDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreate={(o) => {
          setRows((prev) => [o, ...prev]);
          setSubject(o.employeeCode);
        }}
      />

      <ReasonDialog
        open={!!revoking}
        onOpenChange={(v) => !v && setRevoking(null)}
        title="Revoke this override?"
        description={revoking ? `${employeeName(revoking.employeeCode)} returns to the ${personaById(revoking.role).role} baseline on ${menuLabel(revoking.menuKey)}. Their open sessions pick this up on the next request.` : undefined}
        confirmLabel="Revoke override"
        onConfirm={(comment) => {
          if (!revoking) return;
          setRows((prev) => prev.filter((o) => o.id !== revoking.id));
          mockAction("Override revoked", { description: `Reason recorded: “${comment}”`, tone: "warning" });
        }}
      />
    </PageBody>
  );
}
