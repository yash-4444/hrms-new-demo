import { CANDIDATES } from "@/mock/hiring";
import CandidateDetailView from "./view";

/** See employees/[id]/page.tsx for why the shell and the view are split. */
export function generateStaticParams() {
  return CANDIDATES.map((c) => ({ id: c.id }));
}

export default function Page() {
  return <CandidateDetailView />;
}
