import { EMPLOYEES } from "@/mock/employees";
import EmployeeProfileView from "./view";

/**
 * Server shell. The screen itself is a client component (it needs filters,
 * tabs and the persona), and a client component cannot export
 * `generateStaticParams` — so the enumeration lives here and the UI lives in
 * `view.tsx`. This is what lets `output: "export"` pre-render all 340 profiles
 * for the static GitHub Pages build.
 */
export function generateStaticParams() {
  return EMPLOYEES.map((e) => ({ id: e.code }));
}

export default function Page() {
  return <EmployeeProfileView />;
}
