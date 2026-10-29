"use client";

import { Clock, Gift, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateTime, num } from "@/lib/format";
import { COMPANY_VALUES, type Kudos, type Reward } from "@/mock/engage";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AvatarStack, Badge, Hint } from "@/components/ui/primitives";
import { nameOf } from "./kit";

const valueName = (id: string) => COMPANY_VALUES.find((v) => v.id === id)?.name ?? id;

export function KudosCard({ kudos, cheered, onCheer }: { kudos: Kudos; cheered: boolean; onCheer: () => void }) {
  const names = kudos.toCodes.map(nameOf);
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-center gap-2">
        <AvatarStack names={names} size={28} />
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="font-semibold">{names.join(", ")}</span>
            <span className="text-muted-foreground"> from </span>
            <span className="font-medium">{nameOf(kudos.fromCode)}</span>
          </p>
          <p className="text-[11px] text-muted-foreground">{fmtDateTime(kudos.at)}</p>
        </div>
        <Badge variant="soft" className="tnum shrink-0">
          +{num(kudos.points)} pts
        </Badge>
      </div>
      <Badge variant="outline" className="w-fit">
        {valueName(kudos.valueId)}
      </Badge>
      <p className="text-sm leading-relaxed text-foreground">{kudos.message}</p>
      <div className="flex items-center gap-2 border-t border-border pt-2">
        {kudos.status === "pending_approval" && (
          <span className="inline-flex items-center gap-1 text-[11px] text-warning-fg">
            <Clock className="size-3" aria-hidden /> Points pending HR approval
          </span>
        )}
        {kudos.status === "rejected" && <span className="text-[11px] text-muted-foreground">Points not approved — the kudos still stands.</span>}
        <button
          type="button"
          aria-pressed={cheered}
          onClick={onCheer}
          className={cn(
            "ml-auto inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs",
            cheered ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border hover:bg-muted",
          )}
        >
          <Heart className={cn("size-3.5", cheered && "fill-current")} aria-hidden />
          <span className="tnum">{kudos.reactions + (cheered ? 1 : 0)}</span>
          <span className="sr-only">cheers</span>
        </button>
      </div>
    </Card>
  );
}

export function RewardsGrid({ rewards, balance, onRedeem }: { rewards: Reward[]; balance: number; onRedeem: (r: Reward) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {rewards.map((r) => {
        const short = balance < r.points;
        const out = r.stock === 0;
        const reason = out ? "Out of stock" : short ? `You need ${num(r.points - balance)} more points` : null;
        return (
          <Card key={r.id} className="flex flex-col gap-2 p-3.5">
            <div className="flex items-start gap-2">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-soft-foreground">
                <Gift className="size-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight">{r.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {r.brand} · {r.category}
                </p>
              </div>
            </div>
            <div className="mt-auto flex items-center justify-between gap-2 pt-1">
              <span className="tnum text-sm font-semibold">{num(r.points)} pts</span>
              {r.stock !== null && <span className="text-[11px] text-muted-foreground">{r.stock} left</span>}
            </div>
            {reason ? (
              <Hint text={reason}>
                <span className="inline-flex">
                  <Button size="sm" variant="outline" className="w-full" disabled>
                    Redeem
                  </Button>
                </span>
              </Hint>
            ) : (
              <Button size="sm" onClick={() => onRedeem(r)}>
                Redeem
              </Button>
            )}
          </Card>
        );
      })}
    </div>
  );
}

