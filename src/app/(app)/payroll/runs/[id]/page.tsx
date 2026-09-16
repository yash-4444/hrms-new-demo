import { PAY_RUNS, PAY_RUN_HISTORY } from "@/mock/payroll";
import PayRunDetailView from "./view";

/** See employees/[id]/page.tsx for why the shell and the view are split. */
export function generateStaticParams() {
  const ids = new Set([...PAY_RUNS, ...PAY_RUN_HISTORY].map((r) => r.id));
  return [...ids].map((id) => ({ id }));
}

export default function Page() {
  return <PayRunDetailView />;
}
