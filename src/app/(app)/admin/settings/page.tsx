"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, parseISO } from "date-fns";
import { AlertTriangle, Building2, Bell, CalendarRange, Globe2, Palette, Save, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { fyLabel, inr } from "@/lib/format";
import { DEMO_TODAY, TENANT } from "@/mock/org";
import {
  BRAND_ACCENTS,
  COUNTRY_OPTIONS,
  CURRENCY_OPTIONS,
  DATE_FORMAT_OPTIONS,
  LOCALE_OPTIONS,
  TENANT_SETTINGS,
  TIMEZONE_OPTIONS,
  type TenantSettingsValues,
} from "@/mock/admin";
import { mockAction } from "@/components/app-state";
import { Gated, PageBody, PageHeader, Section, useFakeLoad } from "@/components/shell/page";
import { CardsSkeleton } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input, Label, Switch } from "@/components/ui/primitives";
import {
  ConfirmDialog,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/overlays";

/* ---------------------------------------------------------------- schema */

const settingsSchema = z.object({
  name: z.string().trim().min(2, "The display name is required"),
  legalName: z.string().trim().min(2, "The registered legal name is required"),
  shortName: z.string().trim().min(2, "At least 2 characters").max(12, "Keep it under 12 characters"),
  supportEmail: z.email("Enter a valid support email address"),
  website: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i, "Enter a domain such as stellartech.in"),
  accentId: z.string().min(1),
  defaultCountry: z.string().min(1, "Pick a default country"),
  defaultTimezone: z.string().min(1, "Pick a default timezone"),
  fyStartMonth: z.union([z.literal(1), z.literal(4)]),
  locale: z.string().min(1),
  dateFormat: z.string().min(1),
  currency: z.string().min(1),
  weekStart: z.enum(["sunday", "monday"]),
  notifications: z.object({
    leaveApprovals: z.boolean(),
    payrollAlerts: z.boolean(),
    complianceReminders: z.boolean(),
    weeklyDigest: z.boolean(),
    securityAlerts: z.boolean(),
    productUpdates: z.boolean(),
  }),
});

type SettingsValues = z.infer<typeof settingsSchema>;

const NOTIFICATION_ROWS: {
  key: keyof TenantSettingsValues["notifications"];
  label: string;
  description: string;
}[] = [
  {
    key: "leaveApprovals",
    label: "Leave and regularisation approvals",
    description: "Email the approver the moment a request lands, and a reminder after 48 hours.",
  },
  {
    key: "payrollAlerts",
    label: "Pay run alerts",
    description: "Notify payroll admins when a run is calculated, when exceptions appear and when it is locked.",
  },
  {
    key: "complianceReminders",
    label: "Statutory filing reminders",
    description: "Warn the filing owner 10, 5 and 1 day before every due date on the compliance calendar.",
  },
  {
    key: "weeklyDigest",
    label: "Weekly people digest",
    description: "Monday summary for managers: attendance exceptions, pending approvals and upcoming leave.",
  },
  {
    key: "securityAlerts",
    label: "Security alerts",
    description: "New-device sign-ins, failed MFA attempts and every permission change. Cannot be batched.",
  },
  {
    key: "productUpdates",
    label: "Product updates from HRMS-NEW",
    description: "Release notes and new-feature announcements, sent to tenant owners only.",
  },
];

const SAMPLE_DATES = ["2026-04-01", "2026-09-16", "2027-01-05", "2027-03-31"];

/* ============================================================== the page */

export default function TenantSettingsPage() {
  const loading = useFakeLoad();
  const router = useRouter();

  const [saved, setSaved] = React.useState<SettingsValues>(TENANT_SETTINGS as SettingsValues);
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [leaveTarget, setLeaveTarget] = React.useState<string | null>(null);

  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: TENANT_SETTINGS as SettingsValues,
    mode: "onBlur",
  });

  const values = form.watch();
  const dirty = form.formState.isDirty;
  const errors = form.formState.errors;

  /* ------------------------------------------------ unsaved-changes guard */

  React.useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  /* In-app navigation: catch the click before Next's router sees it. */
  React.useEffect(() => {
    if (!dirty) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("/") || anchor.target === "_blank") return;
      if (href === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setLeaveTarget(href);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty]);

  /* ------------------------------------------------------------- submit */

  const onSubmit = form.handleSubmit((v) => {
    setSaved(v);
    form.reset(v);
    mockAction("Tenant settings saved", {
      description: `${v.name} · ${v.defaultTimezone} · financial year starting ${
        v.fyStartMonth === 4 ? "April" : "January"
      }. Applied to all 340 employees.`,
    });
  });

  const discard = () => {
    form.reset(saved);
    mockAction("Changes discarded", {
      description: "The form was reset to the last saved tenant configuration.",
      tone: "info",
    });
  };

  /* ------------------------------------------------------------ previews */

  const fyStart = values.fyStartMonth;
  const fyWindow =
    fyStart === 4 ? "01 Apr 2026 – 31 Mar 2027" : "01 Jan 2026 – 31 Dec 2026";

  const dateSample = (() => {
    try {
      return format(parseISO(DEMO_TODAY), values.dateFormat);
    } catch {
      return "—";
    }
  })();

  const moneySample =
    values.currency === "INR"
      ? inr(1234567.89)
      : new Intl.NumberFormat(values.locale || "en-US", {
          style: "currency",
          currency: values.currency,
        }).format(1234567.89);

  const weekDays =
    values.weekStart === "monday"
      ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const accent = BRAND_ACCENTS.find((a) => a.id === values.accentId) ?? BRAND_ACCENTS[0];

  /* ---------------------------------------------------------------- view */

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Tenant Settings" description="Branding, localisation and notification defaults for the whole tenant." />
        <CardsSkeleton count={3} height={220} />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="Tenant Settings"
        description="Branding, localisation, the financial year and notification defaults. Every screen in HRMS-NEW reads these values — changing the financial year re-labels every payroll and reporting period."
        actions={
          <Gated menuKey="admin.settings" action="E">
            <Button size="sm" onClick={onSubmit} disabled={!dirty}>
              <Save /> Save changes
            </Button>
          </Gated>
        }
      />

      {dirty && (
        <Alert
          tone="warning"
          icon={AlertTriangle}
          title="You have unsaved changes"
          action={
            <Button variant="outline" size="sm" onClick={() => setDiscardOpen(true)}>
              Discard
            </Button>
          }
        >
          Navigating away will ask you to confirm. Nothing is applied until you save.
        </Alert>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {/* ------------------------------------------------------ branding */}
        <Section
          title="Branding & identity"
          description="How the tenant appears in the product, in emails and on generated documents."
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Display name" htmlFor="s-name" required error={errors.name?.message}>
                <Input id="s-name" aria-invalid={!!errors.name} {...form.register("name")} />
              </Field>
              <Field
                label="Short name"
                htmlFor="s-short"
                required
                error={errors.shortName?.message}
                hint="Used in the sidebar, the browser tab and email subjects."
              >
                <Input id="s-short" aria-invalid={!!errors.shortName} {...form.register("shortName")} />
              </Field>
              <Field
                label="Registered legal name"
                htmlFor="s-legal"
                required
                error={errors.legalName?.message}
                className="sm:col-span-2"
              >
                <Input id="s-legal" aria-invalid={!!errors.legalName} {...form.register("legalName")} />
              </Field>
              <Field label="Support email" htmlFor="s-support" required error={errors.supportEmail?.message}>
                <Input
                  id="s-support"
                  type="email"
                  aria-invalid={!!errors.supportEmail}
                  {...form.register("supportEmail")}
                />
              </Field>
              <Field label="Website" htmlFor="s-site" required error={errors.website?.message}>
                <Input id="s-site" aria-invalid={!!errors.website} {...form.register("website")} />
              </Field>

              <Field
                label="Accent colour"
                className="sm:col-span-2"
                hint="Applied to primary buttons, links and focus rings across the product."
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  {BRAND_ACCENTS.map((a) => {
                    const active = values.accentId === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        aria-pressed={active}
                        aria-label={`Accent ${a.label}`}
                        onClick={() => form.setValue("accentId", a.id, { shouldDirty: true })}
                        className={cn(
                          "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors",
                          active ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border hover:bg-muted",
                        )}
                      >
                        <span
                          aria-hidden
                          className="size-3 rounded-full border border-black/10"
                          style={{ background: a.hex }}
                        />
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>

            {/* live branding preview */}
            <div className="rounded-md border border-border bg-subtle p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Palette className="size-3" aria-hidden /> Preview
              </p>
              <div className="flex items-center gap-2.5">
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-md text-sm font-bold text-white"
                  style={{ background: accent.hex }}
                  aria-hidden
                >
                  {(values.shortName || "ST").slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{values.name || "—"}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{values.website || "—"}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span
                  className="rounded-md px-2 py-1 text-[11px] font-medium text-white"
                  style={{ background: accent.hex }}
                >
                  Primary action
                </span>
                <span
                  className="rounded-md border px-2 py-1 text-[11px] font-medium"
                  style={{ borderColor: accent.hex, color: accent.hex }}
                >
                  Secondary
                </span>
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Payslips, offer letters and Form 16 cover pages are generated with{" "}
                <span className="font-medium text-foreground">{values.legalName || "—"}</span>.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                onClick={() =>
                  mockAction("Logo upload is not wired up in this demo", {
                    description: "In the product this accepts a 512×512 PNG or SVG and regenerates every document template.",
                    tone: "info",
                  })
                }
              >
                <Upload /> Replace logo
              </Button>
            </div>
          </div>
        </Section>

        {/* -------------------------------------------------- localisation */}
        <Section
          title="Localisation"
          description="Defaults for new employees and for every screen that has no branch-level override."
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Default country" required error={errors.defaultCountry?.message}>
                <Select
                  value={values.defaultCountry}
                  onValueChange={(v) => form.setValue("defaultCountry", v, { shouldDirty: true })}
                >
                  <SelectTrigger aria-label="Default country">
                    <span>{COUNTRY_OPTIONS.find((c) => c.value === values.defaultCountry)?.label ?? "—"}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRY_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Default timezone" required error={errors.defaultTimezone?.message}>
                <Select
                  value={values.defaultTimezone}
                  onValueChange={(v) => form.setValue("defaultTimezone", v, { shouldDirty: true })}
                >
                  <SelectTrigger aria-label="Default timezone">
                    <span className="truncate">
                      {TIMEZONE_OPTIONS.find((t) => t.value === values.defaultTimezone)?.label ?? "—"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Locale" required error={errors.locale?.message}>
                <Select
                  value={values.locale}
                  onValueChange={(v) => form.setValue("locale", v, { shouldDirty: true })}
                >
                  <SelectTrigger aria-label="Locale">
                    <span>{LOCALE_OPTIONS.find((l) => l.value === values.locale)?.label ?? "—"}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {LOCALE_OPTIONS.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Date format" required error={errors.dateFormat?.message}>
                <Select
                  value={values.dateFormat}
                  onValueChange={(v) => form.setValue("dateFormat", v, { shouldDirty: true })}
                >
                  <SelectTrigger aria-label="Date format">
                    <span className="truncate">
                      {DATE_FORMAT_OPTIONS.find((d) => d.value === values.dateFormat)?.label ?? "—"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_FORMAT_OPTIONS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Week starts on"
                className="sm:col-span-2"
                hint="Drives the attendance calendar, the leave calendar and every weekly report."
              >
                <div className="flex gap-1.5">
                  {(["monday", "sunday"] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={values.weekStart === d}
                      onClick={() => form.setValue("weekStart", d, { shouldDirty: true })}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                        values.weekStart === d
                          ? "border-primary bg-primary-soft text-primary-soft-foreground"
                          : "border-border hover:bg-muted",
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            <div className="rounded-md border border-border bg-subtle p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Globe2 className="size-3" aria-hidden /> Live preview
              </p>
              <dl className="flex flex-col gap-2 text-xs">
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Today renders as</dt>
                  <dd className="tnum font-medium text-foreground">{dateSample}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Money renders as</dt>
                  <dd className="tnum font-medium text-foreground">{moneySample}</dd>
                </div>
                <div>
                  <dt className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Calendar header</dt>
                  <dd className="grid grid-cols-7 gap-px overflow-hidden rounded border border-border">
                    {weekDays.map((d) => (
                      <span
                        key={d}
                        className={cn(
                          "bg-card py-1 text-center text-[10px]",
                          d === "Sat" || d === "Sun" ? "text-muted-foreground" : "text-foreground",
                        )}
                      >
                        {d}
                      </span>
                    ))}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </Section>

        {/* ----------------------------------------------- financial year */}
        <Section
          title="Financial year & currency"
          description="The financial year drives payroll periods, Form 16 / W-2 generation and every year-to-date figure in the product."
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="flex flex-col gap-3.5">
              <Field label="Financial year start month" required>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      {
                        v: 4 as const,
                        title: "April – March",
                        sub: "India standard (Income-tax Act, 1961)",
                        detail: "Form 16, 24Q quarters and PF annual returns align to this window.",
                      },
                      {
                        v: 1 as const,
                        title: "January – December",
                        sub: "Calendar year · US and EU standard",
                        detail: "W-2, Form 941 quarters and 401(k) plan years align to this window.",
                      },
                    ]
                  ).map((opt) => {
                    const active = fyStart === opt.v;
                    return (
                      <button
                        key={opt.v}
                        type="button"
                        aria-pressed={active}
                        onClick={() => form.setValue("fyStartMonth", opt.v, { shouldDirty: true })}
                        className={cn(
                          "rounded-md border p-2.5 text-left transition-colors",
                          active ? "border-primary bg-primary-soft/50" : "border-border hover:bg-muted/60",
                        )}
                      >
                        <span className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "flex size-3.5 items-center justify-center rounded-full border",
                              active ? "border-primary" : "border-input",
                            )}
                            aria-hidden
                          >
                            {active && <span className="size-1.5 rounded-full bg-primary" />}
                          </span>
                          <span className="text-xs font-semibold text-foreground">{opt.title}</span>
                        </span>
                        <span className="mt-1 block text-[11px] text-muted-foreground">{opt.sub}</span>
                        <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
                          {opt.detail}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field
                label="Base currency"
                required
                error={errors.currency?.message}
                hint="Branch currencies override this for local payroll; consolidated reporting uses the base currency."
              >
                <Select
                  value={values.currency}
                  onValueChange={(v) => form.setValue("currency", v, { shouldDirty: true })}
                >
                  <SelectTrigger aria-label="Base currency" className="sm:w-[280px]">
                    <span>{CURRENCY_OPTIONS.find((c) => c.value === values.currency)?.label ?? "—"}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="rounded-md border border-border bg-subtle p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <CalendarRange className="size-3" aria-hidden /> Resulting labels
              </p>
              <p className="text-xs text-muted-foreground">Current year window</p>
              <p className="tnum text-sm font-semibold text-foreground">{fyWindow}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Today ({DEMO_TODAY}) falls in{" "}
                <span className="font-semibold text-foreground">{fyLabel(DEMO_TODAY, fyStart)}</span>
              </p>
              <table className="mt-2.5 w-full text-xs">
                <caption className="sr-only">Sample dates and the financial year they resolve to</caption>
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="py-1 text-left font-medium text-muted-foreground">
                      Date
                    </th>
                    <th scope="col" className="py-1 text-right font-medium text-muted-foreground">
                      Period label
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE_DATES.map((d) => (
                    <tr key={d} className="border-b border-border/60 last:border-0">
                      <td className="tnum py-1 text-muted-foreground">{format(parseISO(d), "dd MMM yyyy")}</td>
                      <td className="tnum py-1 text-right font-medium text-foreground">{fyLabel(d, fyStart)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>

        {/* ---------------------------------------------- notifications */}
        <Section
          title="Notification preferences"
          description="Tenant-wide defaults. Individual users can narrow these further from their own profile, but security alerts cannot be switched off per user."
        >
          <ul className="flex flex-col divide-y divide-border">
            {NOTIFICATION_ROWS.map((row) => (
              <li key={row.key} className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <Label htmlFor={`n-${row.key}`} className="text-xs font-medium">
                    {row.label}
                  </Label>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{row.description}</p>
                </div>
                <Switch
                  id={`n-${row.key}`}
                  checked={values.notifications[row.key]}
                  onCheckedChange={(v) =>
                    form.setValue(`notifications.${row.key}` as const, v, { shouldDirty: true })
                  }
                  aria-label={row.label}
                  className="mt-0.5 shrink-0"
                />
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                NOTIFICATION_ROWS.forEach((r) =>
                  form.setValue(`notifications.${r.key}` as const, true, { shouldDirty: true }),
                );
              }}
            >
              <Bell /> Enable all
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                NOTIFICATION_ROWS.forEach((r) =>
                  form.setValue(`notifications.${r.key}` as const, r.key === "securityAlerts", {
                    shouldDirty: true,
                  }),
                );
              }}
            >
              Essential only
            </Button>
          </div>
        </Section>

        {/* ------------------------------------------ statutory identity */}
        <Section
          title="Statutory identifiers"
          description="Read-only. These are verified against the registrar and the tax portals; a change requires a support ticket with the amended certificate."
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                mockAction("Change request raised", {
                  description: "Ticket HD-4821 opened with Stellar support. Attach the amended certificate to proceed.",
                })
              }
            >
              Request a change
            </Button>
          }
        >
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {[
              ["CIN", TENANT.cin],
              ["PAN", TENANT.pan],
              ["TAN", TENANT.tan],
              ["GSTIN", TENANT.gstin],
              ["PF establishment code", TENANT.pfCode],
              ["ESI code", TENANT.esiCode],
              ["Incorporated", TENANT.founded],
              ["Headcount on record", String(TENANT.headcount)],
            ].map(([k, v]) => (
              <div key={k} className="min-w-0 rounded-md border border-border bg-subtle p-2">
                <dt className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <Building2 className="size-3" aria-hidden /> {k}
                </dt>
                <dd className="tnum mt-0.5 truncate font-mono text-[11px] text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </form>

      {/* ----------------------------------------------- sticky save bar */}
      {dirty && (
        <div className="sticky bottom-0 z-30 -mx-3 mt-1 flex flex-wrap items-center gap-2 border-t border-border bg-popover px-3 py-2.5 shadow-lg lg:-mx-4 lg:px-4">
          <span className="flex items-center gap-1.5 text-xs font-medium text-warning-fg">
            <AlertTriangle className="size-3.5" aria-hidden />
            Unsaved changes
          </span>
          <span className="text-xs text-muted-foreground">
            {Object.keys(form.formState.dirtyFields).length} section
            {Object.keys(form.formState.dirtyFields).length === 1 ? "" : "s"} edited
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setDiscardOpen(true)}>
              Discard
            </Button>
            <Gated menuKey="admin.settings" action="E">
              <Button size="sm" onClick={onSubmit}>
                <Save /> Save changes
              </Button>
            </Gated>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        destructive
        title="Discard unsaved changes?"
        description="The form reverts to the last saved tenant configuration. This cannot be undone."
        confirmLabel="Discard changes"
        onConfirm={discard}
      />

      <ConfirmDialog
        open={!!leaveTarget}
        onOpenChange={(v) => !v && setLeaveTarget(null)}
        destructive
        title="Leave without saving?"
        description="You have unsaved tenant settings. Leaving this screen discards them."
        confirmLabel="Leave and discard"
        cancelLabel="Stay on this page"
        onConfirm={() => {
          const target = leaveTarget;
          form.reset(saved);
          setLeaveTarget(null);
          if (target) router.push(target);
        }}
      />
    </PageBody>
  );
}
