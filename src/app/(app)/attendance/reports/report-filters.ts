import type { TimeReportPerson } from "@/mock/finance-time";

export interface ReportFilters {
  branch: string;
  dept: string;
  month: string;
  /** null = the persona sees the whole tenant. */
  codes: Set<string> | null;
}

/** Applies the page-level branch / department / team scope to any report row. */
export function applyFilters<T extends TimeReportPerson>(rows: T[], f: ReportFilters): T[] {
  return rows.filter(
    (r) =>
      (f.branch === "all" || r.branchId === f.branch) &&
      (f.dept === "all" || r.departmentId === f.dept) &&
      (!f.codes || f.codes.has(r.code)),
  );
}

/** Export file names carry the filters so a download is self-describing. */
export function exportNameFor(report: string, f: ReportFilters) {
  return [
    `attendance-${report}`,
    f.month,
    f.branch === "all" ? "all-branches" : f.branch.toLowerCase(),
    f.dept === "all" ? "all-depts" : f.dept.toLowerCase(),
    f.codes ? "my-team" : null,
  ]
    .filter(Boolean)
    .join("_");
}
