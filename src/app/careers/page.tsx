"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Baby,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  FileUp,
  GraduationCap,
  HeartPulse,
  Mail,
  MapPin,
  Paperclip,
  PiggyBank,
  Search,
  Sparkles,
  Timer,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { BRANCHES, DEPARTMENTS, TENANT } from "@/mock/org";
import { JOBS, branchLabel, deptLabel, type JobPosting } from "@/mock/hiring";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Badge,
  Checkbox,
  EmptyState,
  Field,
  Input,
  Textarea,
} from "@/components/ui/primitives";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/overlays";
import { mockAction } from "@/components/app-state";

/* ============================================================================
   /careers — the PUBLIC careers site.

   Deliberately outside the (app) route group: no sidebar, no top bar, no
   breadcrumbs, no RBAC guard. It shares the app's tokens, type scale and
   components so it reads as the same company — just with more air than an
   enterprise grid is allowed.
   ========================================================================== */

const PUBLIC_JOBS = JOBS.filter((j) => j.published);

const OFFICES = BRANCHES.filter((b) => b.country !== null && b.headcount > 10);

const NOTICE_OPTIONS = [
  "Immediate",
  "15 days",
  "30 days",
  "45 days",
  "60 days",
  "90 days",
];

const BENEFITS = [
  {
    icon: HeartPulse,
    title: "Health cover that includes your parents",
    body: "₹10 lakh family floater from day one, parents included by default rather than as a paid add-on. Outpatient consultations and an annual health check are covered, and there is no waiting period for pre-existing conditions.",
  },
  {
    icon: GraduationCap,
    title: "₹75,000 learning budget a year",
    body: "Conferences, certifications, courses and books. No approval chain below ₹25,000 — your manager finds out when the reimbursement lands. Two of our engineers took the budget to a Kubernetes certification last quarter.",
  },
  {
    icon: CalendarDays,
    title: "30 days of leave, and we mean it",
    body: "24 earned days plus 6 casual, on top of 12 to 14 public holidays depending on your office. Earned leave carries forward up to 45 days. Managers are measured on whether their team actually takes it.",
  },
  {
    icon: Baby,
    title: "26 weeks maternity, 6 weeks paternity",
    body: "Above the statutory floor for secondary caregivers, with a phased four-week return at 60% hours on full pay. Creche support is reimbursed for children up to six.",
  },
  {
    icon: Timer,
    title: "Hybrid, written down",
    body: "Two days a week in your office, chosen by your team rather than by a policy document. Fully remote roles exist and are labelled as such in the posting — we do not advertise hybrid and then quietly expect five days.",
  },
  {
    icon: PiggyBank,
    title: "ESOPs at every level",
    body: "Every full-time employee gets an option grant, refreshed at each promotion. We publish the strike price, the current 409A valuation and a plain-language explainer — you should be able to value your own grant.",
  },
];

const LIFE_POINTS = [
  {
    title: "We build for the person doing payroll at 9pm",
    body: "Our users are HR and finance teams running a real pay cycle against a real deadline. That shapes everything: we obsess over table density, keyboard paths and error messages, and we ship the boring correctness work before the demo-friendly work.",
  },
  {
    title: "Written before spoken",
    body: "Design documents and architecture decision records are the default. Meetings start with ten minutes of reading. It makes us slower on day one and considerably faster by month three, and it means people in Newark are not second-class participants.",
  },
  {
    title: "Small teams, real ownership",
    body: "Squads are four to six people with a named owner for each service. You carry the pager for what you build, and you get the time to make that a reasonable thing to ask.",
  },
];

/* --------------------------------------------------------------- apply form */

const applySchema = z
  .object({
    fullName: z.string().trim().min(3, "Tell us your full name"),
    email: z.email("Enter an email address we can reply to"),
    phone: z.string().trim().min(8, "Enter a phone number with the country code"),
    experienceYears: z
      .number({ message: "Enter your years of experience" })
      .min(0, "That cannot be negative")
      .max(50, "Enter years, not months"),
    currentCompany: z.string().trim().optional(),
    noticePeriod: z.string().min(1, "Pick your notice period"),
    portfolio: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || /^https?:\/\/.+\..+/.test(v), {
        message: "Enter a full URL, starting with https://",
      }),
    motivation: z
      .string()
      .trim()
      .min(30, "Thirty characters or more — a sentence about why this role, please"),
    resumeName: z.string().min(1, "Attach your resume"),
    consent: z.boolean(),
  })
  .refine((v) => v.consent, {
    path: ["consent"],
    message: "We need your consent to store the application",
  });

type ApplyValues = {
  fullName: string;
  email: string;
  phone: string;
  experienceYears: number;
  currentCompany?: string;
  noticePeriod: string;
  portfolio?: string;
  motivation: string;
  resumeName: string;
  consent: boolean;
};

const emptyApply = (): ApplyValues => ({
  fullName: "",
  email: "",
  phone: "",
  experienceYears: 0,
  currentCompany: "",
  noticePeriod: "",
  portfolio: "",
  motivation: "",
  resumeName: "",
  consent: false,
});

function ApplyDialog({
  job,
  open,
  onOpenChange,
}: {
  job: JobPosting | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ApplyValues>({
    resolver: zodResolver(applySchema),
    defaultValues: emptyApply(),
    mode: "onSubmit",
  });

  React.useEffect(() => {
    if (open) reset(emptyApply());
  }, [open, reset]);

  const motivation = watch("motivation") ?? "";
  const resumeName = watch("resumeName");
  const notice = watch("noticePeriod");
  const consent = watch("consent");

  if (!job) return null;

  const onSubmit = handleSubmit((values) => {
    onOpenChange(false);
    mockAction(`Application received for ${job.title}`, {
      description: `Thanks, ${values.fullName.split(" ")[0]}. Our talent team reads every application and will come back to you at ${values.email} within five working days.`,
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Apply — {job.title}</DialogTitle>
          <DialogDescription>
            {job.location} · {job.workMode} · {job.employmentType} · {job.experience}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate>
          <DialogBody className="flex flex-col gap-3.5">
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field
                label="Full name"
                htmlFor="apply-name"
                required
                error={errors.fullName?.message}
              >
                <Input
                  id="apply-name"
                  placeholder="Ananya Rao"
                  autoComplete="name"
                  aria-invalid={!!errors.fullName}
                  {...register("fullName")}
                />
              </Field>
              <Field label="Email" htmlFor="apply-email" required error={errors.email?.message}>
                <Input
                  id="apply-email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  {...register("email")}
                />
              </Field>
              <Field label="Phone" htmlFor="apply-phone" required error={errors.phone?.message}>
                <Input
                  id="apply-phone"
                  type="tel"
                  placeholder="+91 98450 00000"
                  autoComplete="tel"
                  aria-invalid={!!errors.phone}
                  {...register("phone")}
                />
              </Field>
              <Field
                label="Years of experience"
                htmlFor="apply-exp"
                required
                error={errors.experienceYears?.message}
              >
                <Input
                  id="apply-exp"
                  type="number"
                  step={0.5}
                  min={0}
                  className="tnum"
                  aria-invalid={!!errors.experienceYears}
                  {...register("experienceYears", { valueAsNumber: true })}
                />
              </Field>
              <Field
                label="Current company"
                htmlFor="apply-company"
                error={errors.currentCompany?.message}
                hint="Optional — leave blank if you are between roles."
              >
                <Input
                  id="apply-company"
                  placeholder="Razorpay"
                  autoComplete="organization"
                  {...register("currentCompany")}
                />
              </Field>
              <Field
                label="Notice period"
                htmlFor="apply-notice"
                required
                error={errors.noticePeriod?.message}
              >
                <Select
                  value={notice}
                  onValueChange={(v) =>
                    setValue("noticePeriod", v, { shouldValidate: true })
                  }
                >
                  <SelectTrigger id="apply-notice" aria-label="Notice period">
                    <SelectValue placeholder="How soon can you start?" />
                  </SelectTrigger>
                  <SelectContent>
                    {NOTICE_OPTIONS.map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field
              label="LinkedIn, GitHub or portfolio"
              htmlFor="apply-portfolio"
              error={errors.portfolio?.message}
              hint="Optional, but it genuinely helps."
            >
              <Input
                id="apply-portfolio"
                type="url"
                placeholder="https://linkedin.com/in/…"
                aria-invalid={!!errors.portfolio}
                {...register("portfolio")}
              />
            </Field>

            <Field
              label="Resume"
              htmlFor="apply-resume"
              required
              error={errors.resumeName?.message}
            >
              <div
                className={cn(
                  "flex items-center justify-between gap-3 rounded-md border border-dashed px-3 py-3 transition-colors",
                  resumeName ? "border-primary/40 bg-primary-soft/40" : "border-input bg-subtle",
                )}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  {resumeName ? (
                    <Paperclip className="size-4 shrink-0 text-primary" aria-hidden />
                  ) : (
                    <FileUp className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">
                      {resumeName || "PDF or DOCX, up to 5 MB"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {resumeName
                        ? "Attached — this demo does not upload the file anywhere."
                        : "We read the whole thing. No keyword filter sits in front of a human here."}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {resumeName && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove attached resume"
                      onClick={() => {
                        setValue("resumeName", "", { shouldValidate: false });
                        if (fileRef.current) fileRef.current.value = "";
                      }}
                    >
                      <X />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                  >
                    {resumeName ? "Replace" : "Choose file"}
                  </Button>
                </div>
                <input
                  ref={fileRef}
                  id="apply-resume"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="sr-only"
                  onChange={(e) => {
                    const name = e.target.files?.[0]?.name ?? "";
                    setValue("resumeName", name, { shouldValidate: !!name });
                  }}
                />
              </div>
            </Field>

            <Field
              label="Why Stellar, and why this role?"
              htmlFor="apply-why"
              required
              error={errors.motivation?.message}
              hint={
                <span className="tnum">
                  {motivation.trim().length} / 30 characters minimum
                </span>
              }
            >
              <Textarea
                id="apply-why"
                rows={4}
                placeholder="What drew you to this role, and what you would want to own in the first ninety days."
                aria-invalid={!!errors.motivation}
                {...register("motivation")}
              />
            </Field>

            <div className="flex flex-col gap-1.5">
              <label className="flex items-start gap-2.5 text-xs text-muted-foreground">
                <Checkbox
                  checked={consent}
                  onCheckedChange={(v) =>
                    setValue("consent", v === true, { shouldValidate: true })
                  }
                  aria-label="Consent to store this application"
                  className="mt-0.5"
                />
                <span>
                  I agree that {TENANT.shortName} may store this application and the attached
                  resume for up to 12 months, and may contact me about this and comparable roles.
                </span>
              </label>
              {errors.consent?.message && (
                <p role="alert" className="text-xs text-destructive-fg">
                  {errors.consent.message}
                </p>
              )}
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Submit application</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------- role row */

function RoleRow({ job, onApply }: { job: JobPosting; onApply: (j: JobPosting) => void }) {
  const [open, setOpen] = React.useState(false);

  return (
    <Card className="overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              {job.title}
            </h3>
            <ul className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <li className="flex items-center gap-1">
                <Building2 className="size-3.5" aria-hidden />
                {deptLabel(job.departmentId)}
              </li>
              <li className="flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden />
                {job.location}
              </li>
              <li>{job.workMode}</li>
              <li>{job.employmentType}</li>
              <li>{job.experience}</li>
              <li className="tnum">Posted {fmtDate(job.postedDate)}</li>
            </ul>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" aria-expanded={open}>
                {open ? "Hide details" : "View details"}
                <ChevronDown
                  className={cn("transition-transform", open && "rotate-180")}
                  aria-hidden
                />
              </Button>
            </CollapsibleTrigger>
            <Button size="sm" onClick={() => onApply(job)}>
              Apply
            </Button>
          </div>
        </div>

        <CollapsibleContent>
          <div className="border-t border-border bg-subtle/60 px-4 py-4">
            <p className="max-w-3xl text-sm leading-relaxed text-foreground">{job.summary}</p>

            <div className="mt-4 grid gap-5 lg:grid-cols-2">
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  What you will do
                </h4>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {job.responsibilities.map((r) => (
                    <li key={r} className="flex gap-2 text-xs leading-relaxed text-foreground">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  What we are looking for
                </h4>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {job.requirements.map((r) => (
                    <li key={r} className="flex gap-2 text-xs leading-relaxed text-foreground">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => onApply(job)}>
                Apply for this role
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Collapse
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

/* --------------------------------------------------------------------- page */

export default function CareersPage() {
  const [query, setQuery] = React.useState("");
  const [dept, setDept] = React.useState("all");
  const [location, setLocation] = React.useState("all");
  const [applyJob, setApplyJob] = React.useState<JobPosting | null>(null);
  const [applyOpen, setApplyOpen] = React.useState(false);

  const deptOptions = React.useMemo(
    () =>
      Array.from(new Set(PUBLIC_JOBS.map((j) => j.departmentId))).map((id) => ({
        value: id,
        label: deptLabel(id),
      })),
    [],
  );

  const locationOptions = React.useMemo(
    () =>
      Array.from(new Set(PUBLIC_JOBS.map((j) => j.branchId))).map((id) => ({
        value: id,
        label: branchLabel(id),
      })),
    [],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return PUBLIC_JOBS.filter(
      (j) =>
        (dept === "all" || j.departmentId === dept) &&
        (location === "all" || j.branchId === location) &&
        (!q ||
          j.title.toLowerCase().includes(q) ||
          j.summary.toLowerCase().includes(q) ||
          deptLabel(j.departmentId).toLowerCase().includes(q) ||
          j.location.toLowerCase().includes(q)),
    );
  }, [query, dept, location]);

  const filtersActive = query.trim() !== "" || dept !== "all" || location !== "all";

  const clearFilters = () => {
    setQuery("");
    setDept("all");
    setLocation("all");
  };

  const openApply = (job: JobPosting) => {
    setApplyJob(job);
    setApplyOpen(true);
  };

  /* Smooth in-page navigation without losing the anchor for keyboard users. */
  const jumpTo = (id: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.focus({ preventScroll: true });
    window.history.replaceState(null, "", `#${id}`);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* ------------------------------------------------------------ header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href="/careers" className="flex items-center gap-2" aria-label="Stellar careers, home">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              H
            </span>
            <span className="text-sm font-semibold tracking-tight">{TENANT.shortName}</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">Careers</span>
          </Link>

          <nav aria-label="Careers sections" className="ml-2 hidden items-center gap-1 md:flex">
            <a
              href="#openings"
              onClick={jumpTo("openings")}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              Open roles
            </a>
            <a
              href="#life"
              onClick={jumpTo("life")}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              Life at Stellar
            </a>
            <a
              href="#benefits"
              onClick={jumpTo("benefits")}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              Benefits
            </a>
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">
                <ArrowLeft /> Back to HRMS
              </Link>
            </Button>
            <Button size="sm" asChild>
              <a href="#openings" onClick={jumpTo("openings")}>
                See {PUBLIC_JOBS.length} open roles
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* -------------------------------------------------------------- hero */}
        <section className="border-b border-border bg-card">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <Badge variant="soft" className="mb-4">
              <Sparkles className="size-3" aria-hidden />
              Hiring across engineering, product, design and go-to-market
            </Badge>
            <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
              We build the HR software Indian companies actually run on.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Payroll that gets PF, ESI, PT and TDS right on the first pass. Attendance that
              works on a weak connection in a factory. Hiring, performance and compliance under
              one permission model. Nine hundred customers, three offices, and a product where
              being wrong by one rupee is a real incident — which is exactly why the work is
              interesting.
            </p>

            <dl className="mt-10 grid max-w-3xl grid-cols-2 gap-6 sm:grid-cols-4">
              {[
                [String(TENANT.headcount), "employees"],
                [String(OFFICES.length), "offices"],
                [String(PUBLIC_JOBS.length), "open roles"],
                [String(DEPARTMENTS.length), "teams"],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="tnum text-2xl font-semibold tracking-tight text-foreground">
                    {v}
                  </dt>
                  <dd className="mt-0.5 text-xs text-muted-foreground">{l}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-8 flex flex-wrap items-center gap-2">
              <Button asChild>
                <a href="#openings" onClick={jumpTo("openings")}>
                  Browse open roles
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="#life" onClick={jumpTo("life")}>
                  How we work
                </a>
              </Button>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- life */}
        <section
          id="life"
          tabIndex={-1}
          className="scroll-mt-16 border-b border-border focus-visible:outline-none"
        >
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Life at {TENANT.shortName}
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
              Three things that are true here, and that you can hold us to in an interview.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {LIFE_POINTS.map((p) => (
                <Card key={p.title} className="p-5">
                  <h3 className="text-sm font-semibold tracking-tight text-foreground">
                    {p.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{p.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------- benefits */}
        <section
          id="benefits"
          tabIndex={-1}
          className="scroll-mt-16 border-b border-border bg-card focus-visible:outline-none"
        >
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Benefits</h2>
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
              We publish the specifics rather than the adjectives. Everything below applies from
              your first day, not after probation.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {BENEFITS.map((b) => {
                const Icon = b.icon;
                return (
                  <div
                    key={b.title}
                    className="rounded-md border border-border bg-background p-5"
                  >
                    <span className="flex size-8 items-center justify-center rounded-md bg-primary-soft text-primary-soft-foreground">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <h3 className="mt-3 text-sm font-semibold tracking-tight text-foreground">
                      {b.title}
                    </h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {b.body}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------- openings */}
        <section
          id="openings"
          tabIndex={-1}
          className="scroll-mt-16 focus-visible:outline-none"
        >
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  Open roles
                </h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  <span className="tnum font-medium text-foreground">{filtered.length}</span>{" "}
                  {filtered.length === 1 ? "role" : "roles"}
                  {filtersActive ? ` of ${PUBLIC_JOBS.length}` : ""} across{" "}
                  {new Set(filtered.map((j) => j.branchId)).size || 0} locations.
                </p>
              </div>
              {filtersActive && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X /> Clear filters
                </Button>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search roles…"
                  aria-label="Search open roles"
                  className="w-[220px] pl-8"
                />
                {query && (
                  <button
                    type="button"
                    aria-label="Clear the search box"
                    onClick={() => setQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              <Select value={dept} onValueChange={setDept}>
                <SelectTrigger aria-label="Filter by department" className="w-[190px]">
                  <span className="truncate">
                    <span className="text-muted-foreground">Team: </span>
                    {dept === "all"
                      ? "All teams"
                      : (deptOptions.find((o) => o.value === dept)?.label ?? dept)}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All teams</SelectItem>
                  {deptOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={location} onValueChange={setLocation}>
                <SelectTrigger aria-label="Filter by location" className="w-[190px]">
                  <span className="truncate">
                    <span className="text-muted-foreground">Location: </span>
                    {location === "all"
                      ? "All locations"
                      : (locationOptions.find((o) => o.value === location)?.label ?? location)}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  {locationOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="mt-5 flex flex-col gap-3">
              {filtered.length ? (
                filtered.map((job) => (
                  <RoleRow key={job.id} job={job} onApply={openApply} />
                ))
              ) : (
                <EmptyState
                  icon={Search}
                  title="No roles match that search"
                  description="We open new roles most months. Clear the filters to see everything that is live today, or write to us and we will keep you in mind."
                  action={
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Button variant="outline" size="sm" onClick={clearFilters}>
                        Clear filters
                      </Button>
                      <Button size="sm" asChild>
                        <a href={`mailto:${TENANT.supportEmail}?subject=Speculative%20application`}>
                          <Mail /> Send a speculative application
                        </a>
                      </Button>
                    </div>
                  }
                />
              )}
            </div>

            <Card className="mt-6 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-foreground">
                  Nothing here fits?
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Write to us with what you would want to own. We read every one, and we have
                  opened roles off the back of a good speculative note before.
                </p>
              </div>
              <Button variant="outline" size="sm" asChild className="shrink-0">
                <a href={`mailto:${TENANT.supportEmail}?subject=Speculative%20application`}>
                  <Mail /> {TENANT.supportEmail}
                </a>
              </Button>
            </Card>
          </div>
        </section>
      </main>

      {/* ------------------------------------------------------------ footer */}
      <footer className="border-t border-border bg-card">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:justify-between">
            <div className="max-w-sm">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
                  H
                </span>
                <span className="text-sm font-semibold tracking-tight">{TENANT.shortName}</span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {TENANT.legalName}
                <br />
                CIN {TENANT.cin}
                <br />
                Incorporated {fmtDate(TENANT.founded)} · {TENANT.website}
              </p>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Offices
              </h4>
              <ul className="mt-2 flex flex-col gap-1.5">
                {OFFICES.map((b) => (
                  <li key={b.id} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{b.city}</span>
                    <span className="block max-w-[260px]">{b.address}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Get in touch
              </h4>
              <ul className="mt-2 flex flex-col gap-1.5 text-xs">
                <li>
                  <a
                    href={`mailto:${TENANT.supportEmail}`}
                    className="text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {TENANT.supportEmail}
                  </a>
                </li>
                <li>
                  <a
                    href="#openings"
                    onClick={jumpTo("openings")}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Open roles
                  </a>
                </li>
                <li>
                  <Link
                    href="/dashboard"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Employee sign-in
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <p className="mt-8 border-t border-border pt-5 text-[11px] leading-relaxed text-muted-foreground">
            {TENANT.shortName} is an equal opportunity employer. We hire on evidence of ability
            and do not discriminate on the basis of caste, religion, gender, gender identity,
            sexual orientation, disability, age, marital status or place of origin. If you need
            an adjustment at any stage of the process — extra time, a different format, an
            interpreter — tell your recruiter and we will arrange it without it counting against
            you.
          </p>
        </div>
      </footer>

      <ApplyDialog job={applyJob} open={applyOpen} onOpenChange={setApplyOpen} />
    </div>
  );
}
