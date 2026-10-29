import { FNF_RECORDS } from "@/mock/lifecycle";
import FnfDetailView from "./view";

/** Static export: one page per F&F record; the view reads the id client-side. */
export function generateStaticParams() {
  return FNF_RECORDS.map((f) => ({ id: f.id }));
}

export default function Page() {
  return <FnfDetailView />;
}
