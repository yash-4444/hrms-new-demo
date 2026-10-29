import { PAY_RUNS, payRunRows } from "@/mock/payroll";
import PayslipBreakdownView from "./view";

/**
 * Traced breakdowns are pre-rendered for the two live runs only — August 2026
 * (paid) and September 2026 (calculated) — one page per employee each run
 * actually pays (joiners and leavers differ between the two). Generating
 * them for all twelve historical periods would be ~3,700 pages of payroll
 * computation for months that exist only as list context.
 *
 * The run detail screen reads the same `PAY_RUNS` list and only offers the
 * Breakdown link for runs that are covered here, so this never produces a dead
 * link. See docs/09-deployment.md.
 */
export function generateStaticParams() {
  return PAY_RUNS.flatMap((run) =>
    payRunRows(run.id).map((r) => ({ id: run.id, eid: r.employeeCode })),
  );
}

export default function Page() {
  return <PayslipBreakdownView />;
}
