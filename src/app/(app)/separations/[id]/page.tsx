import { SEPARATIONS } from "@/mock/lifecycle";
import SeparationDetailView from "./view";

/** Static export: one page per fixture separation; the view reads the id client-side. */
export function generateStaticParams() {
  return SEPARATIONS.map((s) => ({ id: s.id }));
}

export default function Page() {
  return <SeparationDetailView />;
}
