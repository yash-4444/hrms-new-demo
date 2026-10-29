"use client";

import { Sidebar } from "@/components/shell/sidebar";
import { Breadcrumbs, Topbar } from "@/components/shell/topbar";
import { RouteGuard } from "@/components/shell/page";
import { CopilotProvider } from "@/components/ai";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    /* One Copilot for the whole shell: the top-bar launcher and ⌘J share it. */
    <CopilotProvider>
      <div className="flex h-dvh overflow-hidden bg-background">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <Breadcrumbs />
          <main id="main" className="scrollbar-thin min-w-0 flex-1 overflow-y-auto p-3 lg:p-4">
            <RouteGuard>{children}</RouteGuard>
          </main>
        </div>
      </div>
    </CopilotProvider>
  );
}
