"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Clock, Copy, Globe, Lock, Plus, RefreshCw, ShieldAlert, Trash2, XCircle } from "lucide-react";
import { fmtAgo, fmtDate } from "@/lib/format";
import { CUSTOM_DOMAINS, type CustomDomain, type DnsRecord } from "@/mock/platform";
import { mockAction } from "@/components/app-state";
import { Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState, Field, Input } from "@/components/ui/primitives";
import {
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/overlays";
import { TonePill, useDirtyGuard, useSimulatedTask } from "@/components/platform/kit";

const schema = z.object({
  host: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/, "Enter a hostname like people.stellartech.in")
    .refine((v) => v.endsWith(".stellartech.in"), "The domain must be a sub-domain of stellartech.in (verified in your DNS)"),
  purpose: z.string().trim().min(3, "Describe what the domain is for"),
});
type Values = z.infer<typeof schema>;

function DomainStatus({ d }: { d: CustomDomain }) {
  if (d.status === "verified") return <TonePill tone="success" icon={CheckCircle2}>Verified</TonePill>;
  if (d.status === "failed") return <TonePill tone="danger" icon={XCircle}>Verification failed</TonePill>;
  return <TonePill tone="warning" icon={Clock}>Pending DNS</TonePill>;
}

function SslStatus({ d }: { d: CustomDomain }) {
  if (d.ssl === "active")
    return <TonePill tone="success" icon={Lock}>SSL active{d.sslExpiresAt ? ` · renews ${fmtDate(d.sslExpiresAt)}` : ""}</TonePill>;
  if (d.ssl === "pending") return <TonePill tone="neutral" icon={Clock}>SSL issues after DNS verifies</TonePill>;
  return <TonePill tone="neutral">No certificate</TonePill>;
}

function RecordRow({ r }: { r: DnsRecord }) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2 pr-3 font-mono text-xs">{r.type}</td>
      <td className="py-2 pr-3 font-mono text-xs">{r.host}</td>
      <td className="py-2 pr-3">
        <div className="flex items-center gap-1">
          <code className="break-all font-mono text-xs">{r.value}</code>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Copy ${r.type} value`}
            onClick={() => {
              void navigator.clipboard?.writeText(r.value);
              mockAction("Copied to clipboard", { description: r.value, tone: "info" });
            }}
          >
            <Copy />
          </Button>
        </div>
      </td>
      <td className="py-2 text-right">
        {r.status === "verified" ? (
          <TonePill tone="success">Found</TonePill>
        ) : r.status === "failed" ? (
          <TonePill tone="danger">Mismatch</TonePill>
        ) : (
          <TonePill tone="warning">Not found yet</TonePill>
        )}
      </td>
    </tr>
  );
}

export default function DomainsPage() {
  const loading = useFakeLoad();
  const [domains, setDomains] = React.useState<CustomDomain[]>(CUSTOM_DOMAINS);
  const [removing, setRemoving] = React.useState<CustomDomain | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [checks, setChecks] = React.useState<Record<string, number>>({});
  const task = useSimulatedTask(2200);

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { host: "", purpose: "" } });
  const close = () => {
    setAddOpen(false);
    form.reset();
  };
  const { onOpenChange, guard } = useDirtyGuard(form.formState.isDirty, close);

  const verify = (d: CustomDomain) => {
    const attempt = (checks[d.id] ?? 0) + 1;
    setChecks((c) => ({ ...c, [d.id]: attempt }));
    task.start(d.id, () => {
      /* The careers CNAME "propagates" on the second check, so the demo shows both outcomes. */
      const passes = d.status === "verified" || attempt >= 2;
      setDomains((prev) =>
        prev.map((x) =>
          x.id !== d.id
            ? x
            : passes
              ? { ...x, status: "verified", ssl: "active", sslExpiresAt: "2026-12-15", lastCheckedAt: "2026-09-16T14:35:00", records: x.records.map((r) => ({ ...r, status: "verified" })) }
              : { ...x, lastCheckedAt: "2026-09-16T14:35:00" },
        ),
      );
      if (passes)
        mockAction(`${d.host} verified`, { description: "CNAME and TXT records found. A Let's Encrypt certificate was issued and auto-renews every 60 days." });
      else
        mockAction(`CNAME for ${d.host} not found yet`, {
          description: "The TXT record matches but the CNAME has not propagated. DNS changes can take up to 48 hours — try again shortly.",
          tone: "warning",
        });
    });
  };

  const onAdd = form.handleSubmit((v) => {
    const label = v.host.replace(/\.stellartech\.in$/, "");
    const token = Array.from(v.host).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7).toString(16).padStart(8, "0");
    setDomains((prev) => [
      ...prev,
      {
        id: `DOM-${prev.length + 1}`,
        host: v.host,
        purpose: v.purpose,
        status: "pending_dns",
        ssl: "pending",
        sslExpiresAt: null,
        addedAt: "2026-09-16",
        addedBy: "You",
        lastCheckedAt: "2026-09-16T14:35:00",
        records: [
          { type: "CNAME", host: label, value: "stellar.edge.hrms-cloud.in", status: "pending" },
          { type: "TXT", host: `_hrms-verify.${label}`, value: `hrms-site-verification=${token}`, status: "pending" },
        ],
      },
    ]);
    mockAction(`${v.host} added`, { description: "Create the two DNS records shown, then press Verify." });
    close();
  });

  return (
    <PageBody>
      <PageHeader
        title="Custom Domains"
        description="Serve the HRMS and the careers site from your own domain. Each domain is proven with a TXT record, routed with a CNAME, and gets an automatically renewed TLS certificate."
        actions={
          <Gated menuKey="admin.domains" action="C">
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus /> Add domain
            </Button>
          </Gated>
        }
      />

      {loading ? (
        <TableSkeleton rows={4} />
      ) : domains.length === 0 ? (
        <EmptyState icon={Globe} title="No custom domains" description="Employees reach you at stellar.hrms-cloud.in until you add one." />
      ) : (
        domains.map((d) => {
          const running = task.runningKey === d.id;
          return (
            <Section
              key={d.id}
              title={d.host}
              description={`${d.purpose} · added ${fmtDate(d.addedAt)} by ${d.addedBy} · last checked ${fmtAgo(d.lastCheckedAt)}`}
              actions={
                <>
                  <Gated menuKey="admin.domains" action="E">
                    <Button size="sm" variant="outline" onClick={() => verify(d)} disabled={running}>
                      <RefreshCw className={running ? "animate-spin" : undefined} /> {running ? `Checking DNS… ${task.progress}%` : d.status === "verified" ? "Re-check" : "Verify"}
                    </Button>
                  </Gated>
                  <Gated menuKey="admin.domains" action="D">
                    <Button size="sm" variant="ghost" aria-label={`Remove ${d.host}`} onClick={() => setRemoving(d)}>
                      <Trash2 />
                    </Button>
                  </Gated>
                </>
              }
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <DomainStatus d={d} />
                <SslStatus d={d} />
              </div>
              {d.status !== "verified" && (
                <Alert tone="warning" icon={ShieldAlert} className="mb-3" title="Add these records at your DNS provider">
                  Log in to the registrar for stellartech.in and create both records exactly as shown. TTL 300 seconds is recommended.
                </Alert>
              )}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-xs">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-1.5 pr-3 font-medium">Type</th>
                      <th className="py-1.5 pr-3 font-medium">Host</th>
                      <th className="py-1.5 pr-3 font-medium">Value</th>
                      <th className="py-1.5 text-right font-medium">Check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.records.map((r) => (
                      <RecordRow key={r.type} r={r} />
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          );
        })
      )}

      <Dialog open={addOpen} onOpenChange={onOpenChange}>
        <DialogContent size="sm">
          <form onSubmit={onAdd} noValidate>
            <DialogHeader>
              <DialogTitle>Add a custom domain</DialogTitle>
              <DialogDescription>We will give you a CNAME and a TXT record to create.</DialogDescription>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-3">
              <Field label="Hostname" htmlFor="dom-host" required error={form.formState.errors.host?.message}>
                <Input id="dom-host" placeholder="people.stellartech.in" {...form.register("host")} aria-invalid={!!form.formState.errors.host} />
              </Field>
              <Field label="Used for" htmlFor="dom-purpose" required error={form.formState.errors.purpose?.message}>
                <Input id="dom-purpose" placeholder="Employee app for the Pune office" {...form.register("purpose")} aria-invalid={!!form.formState.errors.purpose} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Add domain</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard}

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(v) => !v && setRemoving(null)}
        title={`Remove ${removing?.host ?? ""}?`}
        description="The certificate is revoked and requests to this host stop resolving immediately. Bookmarks and emailed links that use it will break."
        confirmLabel="Remove domain"
        destructive
        onConfirm={() => {
          if (!removing) return;
          setDomains((prev) => prev.filter((x) => x.id !== removing.id));
          mockAction(`${removing.host} removed`, { description: "You can remove its DNS records now.", tone: "warning" });
        }}
      />
    </PageBody>
  );
}
