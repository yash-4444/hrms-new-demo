"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, SearchX } from "lucide-react";
import { TENANT } from "@/mock/org";
import { SAMPLE_TRACKING, findApplication } from "@/mock/lifecycle-public";
import { PublicShell } from "@/components/lifecycle/public-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Field, Input } from "@/components/ui/primitives";
import { TrackResult } from "./track-result";

/* ============================================================================
   /careers/track — candidate self-service status, by token or email.
   ========================================================================== */

const schema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "Enter your tracking token or the email you applied with")
    .refine((v) => v.includes("@") || /^STL-[A-Z0-9]{6}$/i.test(v), {
      message: "Tokens look like STL-7QK2MD — or use your email address",
    }),
});
type Values = z.infer<typeof schema>;

export default function TrackView() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get("token") ?? "";

  const [searched, setSearched] = React.useState<string>(initial.trim());
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { query: initial } });

  const lookup = (q: string) => {
    const query = q.trim();
    setSearched(query);
    router.replace(`/careers/track/?token=${encodeURIComponent(query)}`, { scroll: false });
  };

  const candidate = searched ? findApplication(searched) : undefined;

  return (
    <PublicShell subtitle="Application tracker">
      <header className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Track your application</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          See where your application stands, what is coming next and which documents we still need — without waiting
          for an email.
        </p>
      </header>

      <Card className="p-5">
        <form onSubmit={handleSubmit((v) => lookup(v.query))} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <Field
            label="Tracking token or email"
            htmlFor="track-query"
            error={errors.query?.message}
            hint="Your token is in the confirmation email we sent when you applied."
            className="flex-1"
          >
            <Input
              id="track-query"
              placeholder="STL-7QK2MD or you@example.com"
              autoComplete="email"
              aria-invalid={!!errors.query}
              {...register("query")}
            />
          </Field>
          <Button type="submit" className="sm:mt-[22px]">
            <Search />
            Look up
          </Button>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">Try a demo token:</span>
          {SAMPLE_TRACKING.map((s) => (
            <button
              key={s.token}
              type="button"
              onClick={() => {
                setValue("query", s.token, { shouldValidate: true });
                lookup(s.token);
              }}
              className="tnum inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Use demo token ${s.token} for ${s.name}`}
            >
              {s.token}
              <span className="font-sans text-muted-foreground">· {s.name.split(" ")[0]}</span>
            </button>
          ))}
        </div>
      </Card>

      <div className="mt-6" aria-live="polite">
        {!searched ? null : candidate ? (
          <TrackResult key={candidate.id} candidate={candidate} />
        ) : (
          <EmptyState
            icon={SearchX}
            title="We could not find that application"
            description={`Check the token for typos, or use the email address you applied with. If you applied in the last few minutes, your application appears here once a recruiter opens it — usually within one working day.`}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href="/careers">Browse open roles</Link>
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <a href={`mailto:${TENANT.supportEmail}`}>Email the talent team</a>
                </Button>
              </div>
            }
          />
        )}
      </div>
    </PublicShell>
  );
}
