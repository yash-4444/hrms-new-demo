"use client";

import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";

/** Shown for a slug that no published role answers to — closed, renamed or mistyped. */
export function RoleNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="This role is no longer open"
      description="The posting may have been filled or renamed since the link was shared. Every role we are hiring for right now is listed on the careers page."
      action={
        <Button asChild size="sm">
          <Link href="/careers">
            <ArrowLeft />
            See all open roles
          </Link>
        </Button>
      }
    />
  );
}
