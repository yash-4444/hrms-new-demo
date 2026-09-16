"use client";

import * as React from "react";
import Link from "next/link";
import { Building2, Mail, MapPin, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { branchById, deptName } from "@/mock/org";
import type { Employee } from "@/mock/employees";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";

/* ============================================================================
   Shared People presentation bits. Used by the directory, the profile header
   and the org chart so a person looks identical wherever they appear.
   ========================================================================== */

/** Avatar + name + code, the standard way a person appears inside a table row. */
export function PersonCell({
  name,
  code,
  subtitle,
  size = 26,
  href,
  className,
}: {
  name: string;
  code?: string;
  subtitle?: string;
  size?: number;
  href?: string;
  className?: string;
}) {
  const body = (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <Avatar name={name} size={size} />
      <span className="min-w-0">
        <span className="block truncate font-medium text-foreground">{name}</span>
        {(code || subtitle) && (
          <span className="tnum block truncate text-[11px] text-muted-foreground">
            {subtitle ?? code}
          </span>
        )}
      </span>
    </span>
  );

  if (!href) return body;
  return (
    <Link
      href={href}
      onClick={(e) => e.stopPropagation()}
      className="rounded hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {body}
    </Link>
  );
}

/** Directory card-grid tile. */
export function EmployeeCard({ employee, managerName }: { employee: Employee; managerName: string }) {
  const branch = branchById(employee.branchId);
  return (
    <Card className="group flex flex-col p-0 transition-colors hover:border-primary/40">
      <Link
        href={`/employees/${employee.code}`}
        className="flex flex-col gap-2.5 rounded-md p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-start gap-2.5">
          <Avatar name={employee.name} size={38} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight text-foreground">{employee.name}</p>
            <p className="truncate text-xs text-muted-foreground">{employee.designation}</p>
            <p className="tnum mt-0.5 text-[11px] text-muted-foreground">{employee.code}</p>
          </div>
          <StatusBadge status={employee.status} />
        </div>

        <dl className="flex flex-col gap-1 border-t border-border pt-2 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Building2 className="size-3 shrink-0" aria-hidden />
            <dt className="sr-only">Department</dt>
            <dd className="truncate">{deptName(employee.departmentId)}</dd>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="size-3 shrink-0" aria-hidden />
            <dt className="sr-only">Branch</dt>
            <dd className="truncate">
              {branch?.city ?? employee.branchId} · {employee.workMode}
            </dd>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Mail className="size-3 shrink-0" aria-hidden />
            <dt className="sr-only">Email</dt>
            <dd className="truncate">{employee.email}</dd>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Phone className="size-3 shrink-0" aria-hidden />
            <dt className="sr-only">Phone</dt>
            <dd className="tnum truncate">{employee.phone}</dd>
          </div>
        </dl>

        <div className="flex items-center justify-between gap-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
          <span className="truncate">Reports to {managerName}</span>
          <span className="tnum shrink-0">Joined {fmtDate(employee.joiningDate)}</span>
        </div>
      </Link>
    </Card>
  );
}

/** Label / value row used across the profile tabs. */
export function DetailRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 py-1.5", className)}>
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-xs font-medium text-foreground">{children}</dd>
    </div>
  );
}

/** Two-column definition grid for the Overview / Job & Org tabs. */
export function DetailList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dl className={cn("divide-y divide-border", className)}>{children}</dl>;
}
