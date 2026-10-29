"use client";

import type * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Check, Clock, Play, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, hm, num } from "@/lib/format";
import { employeeName } from "@/mock/employees";
import {
  courseById,
  type ComplianceRecord,
  type ComplianceTraining,
  type Course,
  type Enrolment,
  type ExpiryBand,
} from "@/mock/growth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";

/* ============================================================================
   DataTable columns for /learning — the catalogue table view, My learning
   and the mandatory-training register. The page owns the state; these only
   render it and call back.
   ========================================================================== */

const stop = (e: React.MouseEvent) => e.stopPropagation();

export function catalogueColumns(
  enrolledIds: Set<string>,
  onEnrol: (c: Course) => void,
): ColumnDef<Course, unknown>[] {
  return [
    {
      id: "title",
      header: "Course",
      accessorKey: "title",
      enableHiding: false,
      cell: ({ row }) => (
        <div className="min-w-[220px]">
          <Link
            href={`/learning/courses/${row.original.id}`}
            onClick={stop}
            className="font-medium text-foreground hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {row.original.title}
          </Link>
          <p className="text-[11px] text-muted-foreground">{row.original.provider}</p>
        </div>
      ),
    },
    { id: "category", header: "Category", accessorKey: "category" },
    { id: "format", header: "Format", accessorKey: "format" },
    { id: "level", header: "Level", accessorKey: "level" },
    {
      id: "duration",
      header: "Duration",
      accessorKey: "durationMins",
      cell: ({ row }) => <span className="tnum whitespace-nowrap">{hm(row.original.durationMins)}</span>,
    },
    {
      id: "rating",
      header: "Rating",
      accessorKey: "rating",
      cell: ({ row }) => (
        <span className="tnum flex items-center gap-1 whitespace-nowrap">
          <Star className="size-3 fill-[var(--warning)] text-[var(--warning)]" aria-hidden />
          {row.original.rating.toFixed(1)}
          <span className="text-muted-foreground">({num(row.original.ratingCount)})</span>
        </span>
      ),
    },
    {
      id: "enrolments",
      header: "Enrolled",
      accessorKey: "enrolments",
      cell: ({ row }) => <span className="tnum block text-right">{num(row.original.enrolments)}</span>,
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const enrolled = enrolledIds.has(row.original.id);
        return (
          <span className="flex justify-end" onClick={stop}>
            <Button
              size="sm"
              variant={enrolled ? "outline" : "default"}
              disabled={enrolled}
              onClick={() => onEnrol(row.original)}
            >
              {enrolled ? (
                <>
                  <Check /> Enrolled
                </>
              ) : (
                "Enrol"
              )}
            </Button>
          </span>
        );
      },
    },
  ];
}

export function myLearningColumns(onAdvance: (enrolmentId: string) => void): ColumnDef<Enrolment, unknown>[] {
  return [
    {
      id: "course",
      header: "Course",
      accessorFn: (e) => courseById(e.courseId)?.title ?? e.courseId,
      enableHiding: false,
      cell: ({ row }) => {
        const c = courseById(row.original.courseId);
        return (
          <div className="min-w-[220px]">
            <Link
              href={`/learning/courses/${row.original.courseId}`}
              onClick={stop}
              className="font-medium text-foreground hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {c?.title ?? row.original.courseId}
            </Link>
            <p className="text-[11px] text-muted-foreground">
              {c?.provider} · {c?.format}
            </p>
          </div>
        );
      },
    },
    {
      id: "progress",
      header: "Progress",
      accessorKey: "progress",
      cell: ({ row }) => {
        const e = row.original;
        return (
          <div className="flex min-w-[150px] items-center gap-2">
            <Progress
              value={e.progress}
              className="flex-1"
              tone={e.status === "completed" ? "success" : e.status === "at_risk" ? "warning" : "accent"}
              aria-label="Course progress"
            />
            <span className="tnum w-9 text-right">{e.progress}%</span>
          </div>
        );
      },
    },
    {
      id: "time",
      header: "Time done",
      accessorKey: "minutesDone",
      cell: ({ row }) => (
        <span className="tnum whitespace-nowrap">
          {hm(row.original.minutesDone)} of {hm(courseById(row.original.courseId)?.durationMins ?? 0)}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "due",
      header: "Due / completed",
      accessorFn: (e) => e.completedOn ?? e.dueOn,
      cell: ({ row }) => (
        <span className="tnum whitespace-nowrap text-muted-foreground">
          {row.original.completedOn
            ? `Completed ${fmtDate(row.original.completedOn)}`
            : `Due ${fmtDate(row.original.dueOn)}`}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const e = row.original;
        const done = e.status === "completed";
        return (
          <span className="flex justify-end" onClick={stop}>
            <Button size="sm" variant={done ? "outline" : "default"} disabled={done} onClick={() => onAdvance(e.id)}>
              {done ? (
                <>
                  <Check /> Done
                </>
              ) : (
                <>
                  <Play /> {e.progress === 0 ? "Start" : "Continue"}
                </>
              )}
            </Button>
          </span>
        );
      },
    },
  ];
}

/* ----------------------------------------------------- compliance register */

export const BAND_META: Record<ExpiryBand, { label: string; status: string; tone: string }> = {
  expired: { label: "Expired", status: "expired", tone: "text-destructive-fg" },
  expiring: { label: "Expiring soon", status: "due_soon", tone: "text-warning-fg" },
  pending: { label: "Never completed", status: "not_started", tone: "text-muted-foreground" },
  valid: { label: "Valid", status: "completed", tone: "text-success-fg" },
};

export type ComplianceRow = { record: ComplianceRecord; band: ExpiryBand; training: ComplianceTraining };

export function complianceColumns(onAction: (row: ComplianceRow) => void): ColumnDef<ComplianceRow, unknown>[] {
  return [
    {
      id: "training",
      header: "Training",
      accessorFn: (r) => r.training.name,
      enableHiding: false,
      cell: ({ row }) => {
        const { band, training } = row.original;
        const Icon = band === "valid" ? Check : band === "pending" ? Clock : AlertTriangle;
        return (
          <div className="flex min-w-[240px] items-center gap-2">
            <Icon className={cn("size-3.5 shrink-0", BAND_META[band].tone)} aria-hidden />
            <div className="min-w-0">
              <p className="font-medium text-foreground">{training.name}</p>
              <p className="text-[11px] text-muted-foreground">{training.mandate}</p>
            </div>
          </div>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (r) => BAND_META[r.band].label,
      cell: ({ row }) => (
        <StatusBadge status={BAND_META[row.original.band].status} label={BAND_META[row.original.band].label} />
      ),
    },
    {
      id: "expires",
      header: "Expires",
      accessorFn: (r) => r.record.expiresOn ?? "",
      cell: ({ row }) => {
        const r = row.original.record;
        return (
          <span className="tnum whitespace-nowrap">
            {r.expiresOn ? fmtDate(r.expiresOn) : <span className="text-muted-foreground">No record on file</span>}
          </span>
        );
      },
    },
    {
      id: "daysLeft",
      header: "Days left",
      accessorFn: (r) => r.record.daysToExpiry ?? "",
      cell: ({ row }) => {
        const d = row.original.record.daysToExpiry;
        return (
          <span className={cn("tnum block text-right", BAND_META[row.original.band].tone)}>
            {d === null ? "—" : d < 0 ? `${-d}d overdue` : `${d}d`}
          </span>
        );
      },
    },
    {
      id: "validity",
      header: "Validity",
      accessorFn: (r) => r.training.validityMonths,
      cell: ({ row }) => <span className="tnum">{row.original.training.validityMonths} months</span>,
    },
    { id: "owner", header: "Owner", accessorFn: (r) => employeeName(r.training.ownerCode) },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const band = row.original.band;
        return (
          <span className="flex justify-end" onClick={stop}>
            <Button size="sm" variant={band === "valid" ? "outline" : "default"} onClick={() => onAction(row.original)}>
              {band === "valid" ? "Certificate" : band === "pending" ? "Start" : "Renew now"}
            </Button>
          </span>
        );
      },
    },
  ];
}
