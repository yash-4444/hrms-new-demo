"use client";

import { ConsoleGuard } from "@/components/console/guard";
import { ConsoleShell } from "@/components/console/shell";

/* The Platform Console: the SaaS vendor's own shell, outside every tenant.
   The guard runs first so a tenant persona never sees the console's chrome. */
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConsoleGuard>
      <ConsoleShell>{children}</ConsoleShell>
    </ConsoleGuard>
  );
}
