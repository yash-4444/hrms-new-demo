import { SURVEYS } from "@/mock/engage";
import SurveyDetailView from "./view";

/** See employees/[id]/page.tsx for why the shell and the view are split. */
export function generateStaticParams() {
  return SURVEYS.map((s) => ({ id: s.id }));
}

export default function Page() {
  return <SurveyDetailView />;
}
