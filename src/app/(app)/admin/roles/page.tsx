"use client";

import * as React from "react";
import Link from "next/link";
import { History, Users } from "lucide-react";
import { ACTIONS, MENU_META, PERSONAS } from "@/lib/rbac";
import { useApp } from "@/components/app-state";
import { PermissionMatrix } from "@/components/admin/permission-matrix";
import { PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";

export default function RolesPage() {
  const loading = useFakeLoad();
  const { persona } = useApp();

  return (
    <PageBody>
      <PageHeader
        title="Roles & Permissions"
        description={
          <>
            {MENU_META.length} capabilities × {PERSONAS.length} roles × {ACTIONS.length} actions — the single
            source of truth for what every screen and every button does. You are signed in as{" "}
            <span className="font-medium text-foreground">{persona.role}</span>, so anything you are not
            granted stays disabled with a reason.
          </>
        }
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/users">
                <Users /> Users holding these roles
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/audit">
                <History /> Permission change log
              </Link>
            </Button>
          </>
        }
      />

      {loading ? <TableSkeleton rows={12} /> : <PermissionMatrix />}
    </PageBody>
  );
}
