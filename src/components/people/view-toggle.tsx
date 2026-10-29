"use client";

import type * as React from "react";
import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ListView = "cards" | "table";

/**
 * Cards / Table switch for lists that have both a card layout (a catalogue,
 * a feed, an expandable goal sheet) and the shared DataTable — the table is
 * where sort, column visibility, selection, bulk actions and Export live.
 */
export function ViewToggle({
  view,
  onChange,
  cardsLabel = "Card view",
  cardsIcon: CardsIcon = LayoutGrid,
}: {
  view: ListView;
  onChange: (v: ListView) => void;
  cardsLabel?: string;
  cardsIcon?: React.ElementType;
}) {
  return (
    <div role="group" aria-label="Layout" className="flex items-center rounded-md border border-border p-0.5">
      <Button
        variant={view === "cards" ? "secondary" : "ghost"}
        size="icon-sm"
        aria-label={cardsLabel}
        aria-pressed={view === "cards"}
        onClick={() => onChange("cards")}
      >
        <CardsIcon />
      </Button>
      <Button
        variant={view === "table" ? "secondary" : "ghost"}
        size="icon-sm"
        aria-label="Table view"
        aria-pressed={view === "table"}
        onClick={() => onChange("table")}
      >
        <List />
      </Button>
    </div>
  );
}
