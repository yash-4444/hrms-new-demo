import { CONSOLE_TENANTS } from "@/mock/console-tenants";
import TenantDetailView from "./view";

/** Static export: one page per tenant in the console fixture; the view is a client component. */
export function generateStaticParams() {
  return CONSOLE_TENANTS.map((t) => ({ id: t.id }));
}

export default function Page() {
  return <TenantDetailView />;
}
