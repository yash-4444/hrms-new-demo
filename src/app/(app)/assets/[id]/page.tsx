import { ASSETS } from "@/mock/workplace";
import AssetDetailView from "./view";

/** Static export: one page per asset tag in the register; the view is a client component. */
export function generateStaticParams() {
  return ASSETS.map((a) => ({ id: a.id }));
}

export default function Page() {
  return <AssetDetailView />;
}
