"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateTime, num } from "@/lib/format";
import { MY_TENANTS } from "@/mock/self-service";
import { mockAction } from "@/components/app-state";
import { Badge } from "@/components/ui/primitives";
import { AuthShell } from "@/components/self-service/auth-shell";

export default function SelectTenantPage() {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  return (
    <AuthShell
      title="Choose an organisation"
      description="Your account belongs to more than one organisation. Data never crosses between them."
      pitchTitle="One login, many organisations."
      pitch="Group companies, regional entities and sandboxes each get their own tenant — their own policies, payroll and audit trail — while you keep a single identity."
      points={["Row-level tenant isolation", "Per-tenant roles and permissions", "Switch organisation without signing out"]}
    >
      <ul className="flex flex-col gap-2">
        {MY_TENANTS.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => {
                setBusy(t.id);
                setTimeout(() => {
                  mockAction(`Signed in to ${t.name}`, { description: `${t.role} · ${t.region}` });
                  router.push("/dashboard");
                }, 400);
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-md border border-border bg-card p-3 text-left shadow-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                busy === t.id && "border-primary",
              )}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-soft-foreground">
                <Building2 className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold">{t.name}</span>
                  <Badge variant="muted" className="text-[10px]">
                    {t.plan}
                  </Badge>
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {t.role} · {t.region} · {num(t.employees)} employees
                </span>
                <span className="tnum block text-[10px] text-muted-foreground">Last used {fmtDateTime(t.lastUsed)}</span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <Link href="/register" className="mt-4 inline-flex items-center gap-1 text-xs text-primary hover:underline">
        <Plus className="size-3" aria-hidden /> Create a new organisation
      </Link>
    </AuthShell>
  );
}
