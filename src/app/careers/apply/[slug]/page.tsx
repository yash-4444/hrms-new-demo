import { PUBLIC_JOBS, jobSlug } from "@/mock/lifecycle-public";
import ApplyView from "./view";

/** Thin server shell so the static export can enumerate every published role. */
export function generateStaticParams() {
  return PUBLIC_JOBS.map((j) => ({ slug: jobSlug(j) }));
}

export default function Page() {
  return <ApplyView />;
}
