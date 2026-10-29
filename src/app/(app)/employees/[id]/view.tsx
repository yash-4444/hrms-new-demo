"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { differenceInMonths, parseISO } from "date-fns";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  Download,
  FileText,
  FileUp,
  GitFork,
  IndianRupee,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  MapPin,
  MoreHorizontal,
  Network,
  Pencil,
  ScrollText,
  Star,
  Target,
  TrendingUp,
  UserPlus,
  UserX,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, inr, inrCompact, num, pct } from "@/lib/format";
import {
  BRANCHES,
  DEMO_TODAY,
  DEPARTMENTS,
  branchById,
  deptById,
  deptName,
  gradeById,
} from "@/mock/org";
import {
  descendantsOf,
  employeeByCode,
  employeeName,
  managerChain,
  reporteesOf,
  type Employee,
} from "@/mock/employees";
import {
  LIFECYCLE_LABEL,
  assetsFor,
  attendanceSummaryFor,
  compensationBreakup,
  compensationHistoryFor,
  documentsFor,
  leaveSummaryFor,
  performanceFor,
  timelineFor,
  type EmployeeDocument,
  type LifecycleKind,
} from "@/mock/people-extras";
import { mockAction, useApp } from "@/components/app-state";
import { TalentSnapshotCard } from "@/components/ai/embed/profile-talent-snapshot";
import { BarCompareChart, DonutChart, ProgressRing, TrendLineChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { DataTable } from "@/components/data-table";
import { DetailList, DetailRow, PersonCell } from "@/components/people/person-cell";
import {
  CardsSkeleton,
  Gated,
  PageBody,
  PageHeader,
  Section,
  TableSkeleton,
  useFakeLoad,
} from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/overlays";
import {
  Alert,
  Avatar,
  Badge,
  EmptyState,
  Field,
  Input,
  Progress,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import type { ColumnDef } from "@tanstack/react-table";

/* ============================================================================
   /employees/[id] — the employee profile.

   Nine tabs. Compensation is masked behind the people.profile · Edit grant:
   HR Admin, Payroll Admin and Tenant Owner see real money, everyone else gets
   a lock state naming the missing grant. No salary figure is rendered into the
   DOM at all when the viewer lacks the grant, and because `can()` is read from
   useApp() during render, switching persona in the top bar flips the tab live.

   The profile is held in local state so edits optimistically
   change what is on screen (exit and lifecycle events hand off to /separations and
   /employees/lifecycle). Nothing persists past a refresh — by design.
   ========================================================================== */

const TODAY = parseISO(DEMO_TODAY);

function tenureLabel(fromIso: string) {
  const months = differenceInMonths(TODAY, parseISO(fromIso));
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest} month${rest === 1 ? "" : "s"}`;
  return `${years} yr${years === 1 ? "" : "s"} ${rest} mo`;
}

/* -------------------------------------------------------- tiny table shell */

interface MiniCol {
  label: string;
  numeric?: boolean;
}

function MiniTable({
  head,
  children,
  caption,
}: {
  head: MiniCol[];
  children: React.ReactNode;
  caption: string;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full text-xs">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-subtle">
            <tr className="border-b border-border">
              {head.map((c, i) => (
                <th
                  key={`${c.label}-${i}`}
                  scope="col"
                  className={cn(
                    "h-8 whitespace-nowrap px-2.5 align-middle font-medium text-muted-foreground",
                    c.numeric ? "text-right" : "text-left",
                  )}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

function Td({
  children,
  numeric,
  className,
}: {
  children?: React.ReactNode;
  numeric?: boolean;
  className?: string;
}) {
  return (
    <td className={cn("px-2.5 py-1.5 align-middle", numeric && "tnum text-right", className)}>
      {children}
    </td>
  );
}

/* ========================================================================== */
/*                                   page                                     */
/* ========================================================================== */

export default function EmployeeProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const loading = useFakeLoad();
  const base = employeeByCode(id);

  if (!base) {
    return (
      <PageBody>
        <PageHeader
          title="Employee not found"
          description="The code in the address bar does not match any record on this tenant."
        />
        <EmptyState
          icon={UserX}
          title={`No employee holds the code ${id || "—"}`}
          description="Stellar Technologies uses codes in the format STL-0001 through STL-0340. The record may have been merged during a bulk import, or the code may simply be mistyped."
          action={
            <Button size="sm" asChild>
              <Link href="/employees">Back to the directory</Link>
            </Button>
          }
        />
      </PageBody>
    );
  }

  if (loading) {
    return (
      <PageBody>
        <CardsSkeleton count={4} height={112} />
        <TableSkeleton rows={8} />
      </PageBody>
    );
  }

  /* key= remounts (and so resets the in-memory edits) when the route changes. */
  return <ProfileView key={base.code} base={base} />;
}

/* ========================================================================== */
/*                            shell + local state                             */
/* ========================================================================== */

function ProfileView({ base }: { base: Employee }) {
  /* The edited profile lives here: the header and the Overview / Job & Org tabs
     render from this state, so a save visibly changes the page. */
  const [employee, setEmployee] = React.useState<Employee>(base);

  return (
    <PageBody>
      <ProfileHeader employee={employee} onChange={setEmployee} />

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="job">Job &amp; Org</TabsTrigger>
          <TabsTrigger value="compensation">Compensation</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab employee={employee} />
        </TabsContent>
        <TabsContent value="job">
          <JobOrgTab employee={employee} />
        </TabsContent>
        <TabsContent value="compensation">
          <CompensationTab employee={employee} />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsTab employee={employee} />
        </TabsContent>
        <TabsContent value="attendance">
          <AttendanceTab employee={employee} />
        </TabsContent>
        <TabsContent value="leave">
          <LeaveTab employee={employee} />
        </TabsContent>
        <TabsContent value="performance">
          <PerformanceTab employee={employee} />
        </TabsContent>
        <TabsContent value="assets">
          <AssetsTab employee={employee} />
        </TabsContent>
        <TabsContent value="timeline">
          <TimelineTab employee={employee} />
        </TabsContent>
      </Tabs>
    </PageBody>
  );
}

/* ========================================================================== */
/*                                  header                                    */
/* ========================================================================== */

function ProfileHeader({
  employee,
  onChange,
}: {
  employee: Employee;
  onChange: React.Dispatch<React.SetStateAction<Employee>>;
}) {
  const { can } = useApp();
  const [editOpen, setEditOpen] = React.useState(false);
  const branch = branchById(employee.branchId);
  const grade = gradeById(employee.gradeId);

  return (
    <>
      <Card className="p-4">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={employee.name} size={56} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                {employee.name}
              </h1>
              <span className="tnum rounded-md border border-border bg-subtle px-1.5 py-0.5 text-xs text-muted-foreground">
                {employee.code}
              </span>
              <StatusBadge status={employee.status} />
            </div>

            <p className="mt-1 text-sm text-foreground">{employee.designation}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {deptName(employee.departmentId)} · {branch?.name ?? employee.branchId} ·{" "}
              {employee.location}
            </p>

            <p className="mt-1.5 text-xs text-muted-foreground">
              Reports to{" "}
              {employee.managerCode ? (
                <Link
                  href={`/employees/${employee.managerCode}`}
                  className="font-medium text-primary hover:underline"
                >
                  {employeeName(employee.managerCode)}
                </Link>
              ) : (
                <span className="font-medium text-foreground">nobody — top of the org</span>
              )}
              {" · "}
              {tenureLabel(employee.joiningDate)} with Stellar
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge variant="muted">{employee.employmentType}</Badge>
              <Badge variant="muted">{employee.workMode}</Badge>
              <Badge variant="muted">{grade?.label ?? employee.gradeId}</Badge>
              <Badge variant="muted">{deptById(employee.departmentId)?.costCentre ?? "—"}</Badge>
              {employee.status === "notice" && employee.exitDate && (
                <Badge variant="outline">Last working day {fmtDate(employee.exitDate)}</Badge>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <Gated menuKey="people.profile" action="E">
              <Button size="sm" onClick={() => setEditOpen(true)}>
                <Pencil /> Edit profile
              </Button>
            </Gated>
            <Button variant="outline" size="sm" asChild>
              <a href={`mailto:${employee.email}`}>
                <Mail /> Email
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/org-chart?focus=${employee.code}`}>
                <Network /> View in org chart
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon-sm" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() =>
                    mockAction("Password reset link sent", {
                      description: `A single-use link was emailed to ${employee.email}. It expires in 30 minutes.`,
                    })
                  }
                >
                  <KeyRound /> Reset password
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    mockAction("Profile exported", {
                      description: `${employee.code}_profile.pdf — in the demo the file is not written to disk.`,
                    })
                  }
                >
                  <Download /> Export profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <Gated menuKey="people.lifecycle" action="C">
                  <DropdownMenuItem asChild>
                    <Link href={`/employees/lifecycle?employee=${employee.code}`}>
                      <GitFork /> Record lifecycle event
                    </Link>
                  </DropdownMenuItem>
                </Gated>
                {can("people.documents") && (
                  <DropdownMenuItem asChild>
                    <Link href="/employees/documents">
                      <FileText /> Documents
                    </Link>
                  </DropdownMenuItem>
                )}
                {can("people.letters") && (
                  <DropdownMenuItem asChild>
                    <Link href="/letters">
                      <ScrollText /> Letters
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {/* The separation workflow (notice, clearance, F&F) lives on /separations. */}
                <Gated menuKey="lifecycle.separations" action="C">
                  <DropdownMenuItem
                    destructive
                    asChild
                    disabled={employee.status === "notice" || employee.status === "exited"}
                  >
                    <Link href="/separations">
                      <LogOut /> Initiate exit
                    </Link>
                  </DropdownMenuItem>
                </Gated>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </Card>

      <EditProfileDialog
        employee={employee}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={onChange}
      />
    </>
  );
}

/* ------------------------------------------------------------ edit dialog */

const WORK_MODES = ["On-site", "Hybrid", "Remote"] as const;

const editSchema = z.object({
  designation: z.string().min(2, "Designation must be at least 2 characters."),
  departmentId: z.string().min(1, "Pick a department."),
  branchId: z.string().min(1, "Pick a branch."),
  workMode: z.enum(WORK_MODES),
  phone: z.string().min(8, "Enter a contact number we can actually reach."),
  managerCode: z
    .string()
    .refine((v) => v === "" || /^STL-\d{4}$/.test(v), "Manager code must look like STL-0031.")
    .refine(
      (v) => v === "" || Boolean(employeeByCode(v)),
      "No employee on this tenant holds that code.",
    ),
});

type EditValues = z.infer<typeof editSchema>;

function EditProfileDialog({
  employee,
  open,
  onOpenChange,
  onSave,
}: {
  employee: Employee;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: React.Dispatch<React.SetStateAction<Employee>>;
}) {
  const [discardOpen, setDiscardOpen] = React.useState(false);

  const defaults = React.useMemo<EditValues>(
    () => ({
      designation: employee.designation,
      departmentId: employee.departmentId,
      branchId: employee.branchId,
      workMode: employee.workMode,
      phone: employee.phone,
      managerCode: employee.managerCode ?? "",
    }),
    [employee],
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: defaults,
  });

  /* Re-seed the form every time the dialog opens, so a discarded edit does not
     leak into the next open. */
  React.useEffect(() => {
    if (open) reset(defaults);
  }, [open, defaults, reset]);

  const discardAndClose = () => {
    reset(defaults);
    setDiscardOpen(false);
    onOpenChange(false);
  };

  const requestClose = () => {
    if (isDirty) setDiscardOpen(true);
    else onOpenChange(false);
  };

  const onSubmit = (values: EditValues) => {
    const changed: string[] = [];
    if (values.designation !== defaults.designation)
      changed.push(`designation → ${values.designation}`);
    if (values.departmentId !== defaults.departmentId)
      changed.push(`department → ${deptName(values.departmentId)}`);
    if (values.branchId !== defaults.branchId)
      changed.push(`branch → ${branchById(values.branchId)?.name ?? values.branchId}`);
    if (values.workMode !== defaults.workMode) changed.push(`work mode → ${values.workMode}`);
    if (values.phone !== defaults.phone) changed.push("mobile updated");
    if (values.managerCode !== defaults.managerCode)
      changed.push(`manager → ${values.managerCode ? employeeName(values.managerCode) : "none"}`);

    /* Optimistic: the header and the Overview / Job & Org tabs re-render from
       this state immediately. */
    onSave((prev) => ({
      ...prev,
      designation: values.designation,
      departmentId: values.departmentId,
      branchId: values.branchId,
      workMode: values.workMode,
      phone: values.phone,
      managerCode: values.managerCode === "" ? null : values.managerCode,
      location: branchById(values.branchId)?.city ?? prev.location,
    }));

    mockAction("Profile updated", {
      description: changed.length
        ? `${employee.code} · ${changed.join(" · ")}. An audit entry was written against the signed-in user.`
        : `${employee.code} saved with no field changes.`,
    });
    onOpenChange(false);
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          /* Cancel, the X, Esc and the overlay all route through here. */
          if (!v) requestClose();
          else onOpenChange(true);
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Edit {employee.name}</DialogTitle>
            <DialogDescription>
              Changes are held in memory only — this build has no backend. Compensation is edited
              from the payroll screens, never from the profile.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
            <DialogBody>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  label="Designation"
                  htmlFor="designation"
                  required
                  error={errors.designation?.message}
                  className="sm:col-span-2"
                >
                  <Input
                    id="designation"
                    aria-invalid={!!errors.designation}
                    {...register("designation")}
                  />
                </Field>

                <Controller
                  control={control}
                  name="departmentId"
                  render={({ field }) => (
                    <Field label="Department" required error={errors.departmentId?.message}>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger aria-label="Department">
                          <SelectValue placeholder="Pick a department" />
                        </SelectTrigger>
                        <SelectContent>
                          {DEPARTMENTS.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />

                <Controller
                  control={control}
                  name="branchId"
                  render={({ field }) => (
                    <Field label="Branch" required error={errors.branchId?.message}>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger aria-label="Branch">
                          <SelectValue placeholder="Pick a branch" />
                        </SelectTrigger>
                        <SelectContent>
                          {BRANCHES.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />

                <Controller
                  control={control}
                  name="workMode"
                  render={({ field }) => (
                    <Field label="Work mode" required error={errors.workMode?.message}>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger aria-label="Work mode">
                          <SelectValue placeholder="Pick a work mode" />
                        </SelectTrigger>
                        <SelectContent>
                          {WORK_MODES.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />

                <Field label="Mobile" htmlFor="phone" required error={errors.phone?.message}>
                  <Input id="phone" aria-invalid={!!errors.phone} {...register("phone")} />
                </Field>

                <Field
                  label="Reporting manager code"
                  htmlFor="managerCode"
                  error={errors.managerCode?.message}
                  hint="Leave blank only for the top of the org."
                  className="sm:col-span-2"
                >
                  <Input
                    id="managerCode"
                    placeholder="STL-0031"
                    aria-invalid={!!errors.managerCode}
                    {...register("managerCode")}
                  />
                </Field>
              </div>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={requestClose}>
                Cancel
              </Button>
              <Button type="submit">Save changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        destructive
        title="Discard unsaved changes?"
        description="You have edited this profile but not saved it. Closing now throws those edits away."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        onConfirm={discardAndClose}
      />
    </>
  );
}

/* ========================================================================== */
/*                              1 · Overview                                  */
/* ========================================================================== */

function OverviewTab({ employee }: { employee: Employee }) {
  const branch = branchById(employee.branchId);

  return (
    <div className="flex flex-col gap-4">
      {/* Renders nothing unless the viewer may see it (never the employee themself). */}
      <TalentSnapshotCard employee={employee} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Personal details" description="Identity and contact record on file.">
          <DetailList>
            <DetailRow label="Gender">{employee.gender}</DetailRow>
            <DetailRow label="Date of birth">{fmtDate(employee.dob)}</DetailRow>
            <DetailRow label="Mobile">
              <span className="tnum">{employee.phone}</span>
            </DetailRow>
            <DetailRow label="Work email">
              <a href={`mailto:${employee.email}`} className="text-primary hover:underline">
                {employee.email}
              </a>
            </DetailRow>
            <DetailRow label="Location">
              {employee.location} · {branch?.countryName ?? "—"}
            </DetailRow>
            <DetailRow label="PAN">
              <span className="tnum font-mono">{employee.pan}</span>
            </DetailRow>
            <DetailRow label="UAN">
              <span className="tnum font-mono">{employee.uan}</span>
            </DetailRow>
            <DetailRow label="Bank account">
              {employee.hasBankDetails ? (
                <span className="tnum font-mono">••••&nbsp;{employee.bankAccountLast4}</span>
              ) : (
                <span className="text-destructive-fg">Not on file</span>
              )}
            </DetailRow>
          </DetailList>

          {!employee.hasBankDetails && (
            <Alert
              tone="warning"
              icon={AlertTriangle}
              title="No bank details on file"
              className="mt-3"
            >
              The next pay run will raise a blocking exception for {employee.code}. Net pay cannot
              be disbursed until an account number and IFSC are captured.
            </Alert>
          )}
        </Section>

        <Section title="Employment" description="Contract, grade and cost attribution.">
          <DetailList>
            <DetailRow label="Joining date">{fmtDate(employee.joiningDate)}</DetailRow>
            <DetailRow label="Confirmation date">
              {employee.confirmationDate ? (
                fmtDate(employee.confirmationDate)
              ) : (
                <span className="text-warning-fg">Not confirmed — on probation</span>
              )}
            </DetailRow>
            <DetailRow label="Tenure">{tenureLabel(employee.joiningDate)}</DetailRow>
            <DetailRow label="Employment type">{employee.employmentType}</DetailRow>
            <DetailRow label="Work mode">{employee.workMode}</DetailRow>
            <DetailRow label="Grade">
              {gradeById(employee.gradeId)?.label ?? employee.gradeId}
            </DetailRow>
            <DetailRow label="Cost centre">
              <span className="tnum font-mono">
                {deptById(employee.departmentId)?.costCentre ?? "—"}
              </span>
            </DetailRow>
            <DetailRow label="Branch">{branch?.name ?? employee.branchId}</DetailRow>
          </DetailList>

          {employee.status === "notice" && (
            <Alert tone="warning" icon={LogOut} title="Serving notice period" className="mt-3">
              Reason recorded: {employee.exitReason ?? "Personal reasons"}. Last working day{" "}
              {employee.exitDate ? fmtDate(employee.exitDate) : "to be confirmed"}. Exit clearance
              is tracked on the workplace helpdesk.
            </Alert>
          )}
        </Section>
      </div>

      <Section
        title="Skills"
        description="Captured at onboarding and refreshed at every appraisal cycle."
      >
        {employee.skills.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {employee.skills.map((s) => (
              <li key={s}>
                <Badge variant="muted">{s}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            No skills recorded yet. Skills are captured on the onboarding form and at each review.
          </p>
        )}
      </Section>
    </div>
  );
}

/* ========================================================================== */
/*                            2 · Job & Org                                   */
/* ========================================================================== */

function JobOrgTab({ employee }: { employee: Employee }) {
  /* Built from the LOCAL manager code, so re-pointing the reporting line in the
     edit dialog re-draws this chain immediately. */
  const chain = React.useMemo(() => {
    if (!employee.managerCode) return [];
    return [employee.managerCode, ...managerChain(employee.managerCode)].reverse();
  }, [employee.managerCode]);

  const reportees = React.useMemo(() => reporteesOf(employee.code), [employee.code]);
  const descendants = React.useMemo(() => descendantsOf(employee.code), [employee.code]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
      <Section
        title="Reporting chain"
        description="Resolved from the reporting hierarchy, chief executive first."
      >
        {chain.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Top of the organisation"
            description={`${employee.name} has no reporting line above this record — every other chain in the tenant terminates here.`}
          />
        ) : (
          <ol className="flex flex-col">
            {chain.map((code, i) => {
              const m = employeeByCode(code);
              return (
                <li key={code} className="relative pl-5">
                  <span className="absolute left-[7px] top-0 h-full w-px bg-border" aria-hidden />
                  <span
                    className="absolute left-1 top-4 size-1.5 rounded-full bg-muted-foreground"
                    aria-hidden
                  />
                  <div className="py-2">
                    <PersonCell
                      name={m?.name ?? code}
                      subtitle={`${m?.designation ?? "Unknown role"} · level ${i}`}
                      href={`/employees/${code}`}
                      size={24}
                    />
                  </div>
                </li>
              );
            })}
            <li className="relative pl-5">
              <span className="absolute left-[7px] top-0 h-4 w-px bg-border" aria-hidden />
              <span className="absolute left-1 top-4 size-1.5 rounded-full bg-primary" aria-hidden />
              <div className="my-1 rounded-md border border-primary/30 bg-primary-soft/40 p-2">
                <PersonCell
                  name={employee.name}
                  subtitle={`${employee.designation} · this profile`}
                  size={24}
                />
              </div>
            </li>
          </ol>
        )}
      </Section>

      <Section title="Org position" description="Span of control across the whole sub-tree.">
        <StatRow cols={3}>
          <StatTile
            compact
            label="Direct reportees"
            value={num(reportees.length)}
            icon={Users}
            hint="People reporting straight to this profile"
          />
          <StatTile
            compact
            label="Total org below"
            value={num(descendants.length)}
            icon={GitFork}
            hint="Everyone at any depth beneath this profile"
          />
          <StatTile
            compact
            label="Org depth"
            value={`Level ${employee.level}`}
            icon={Building2}
            hint="0 is the chief executive, 3 is an individual contributor"
          />
        </StatRow>

        <div className="mt-3">
          {reportees.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No direct reportees"
              description={`${employee.name} is an individual contributor. To move people onto this manager, edit their profile or run a bulk import with the manager code column mapped.`}
              action={
                <Button size="sm" variant="outline" asChild>
                  <Link href="/employees/import">Open bulk import</Link>
                </Button>
              }
            />
          ) : (
            <MiniTable
              caption={`Direct reportees of ${employee.name}`}
              head={[
                { label: "Employee" },
                { label: "Designation" },
                { label: "Branch" },
                { label: "Status" },
                { label: "Joined", numeric: true },
              ]}
            >
              {reportees.map((r) => (
                <tr key={r.code} className="border-b border-border last:border-0">
                  <Td>
                    <PersonCell
                      name={r.name}
                      code={r.code}
                      href={`/employees/${r.code}`}
                      size={22}
                    />
                  </Td>
                  <Td>{r.designation}</Td>
                  <Td>{branchById(r.branchId)?.city ?? r.branchId}</Td>
                  <Td>
                    <StatusBadge status={r.status} />
                  </Td>
                  <Td numeric>{fmtDate(r.joiningDate)}</Td>
                </tr>
              ))}
            </MiniTable>
          )}
        </div>
      </Section>
    </div>
  );
}

/* ========================================================================== */
/*                          3 · Compensation (masked)                         */
/* ========================================================================== */

function CompensationTab({ employee }: { employee: Employee }) {
  /* Read during render — switching persona in the top bar flips this live. */
  const { can, why } = useApp();

  if (!can("people.profile", "E")) {
    return <CompensationLock reason={why("people.profile", "E")} />;
  }
  return <CompensationDetail employee={employee} />;
}

function CompensationLock({ reason }: { reason: string }) {
  return (
    <Card className="mx-auto flex max-w-xl flex-col items-center p-8 text-center">
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-warning-soft text-warning-fg">
        <Lock className="size-5" aria-hidden />
      </div>
      <h2 className="text-base font-semibold text-foreground">Compensation is restricted</h2>
      <p className="mt-1.5 max-w-md text-xs text-muted-foreground">
        Salary, CTC breakup and revision history are visible only to roles holding the{" "}
        <span className="font-medium text-foreground">Employee Profile · Edit</span> grant — HR
        Admin, Payroll Admin and the Tenant Owner. No figure for this employee has been loaded
        into the page.
      </p>

      <div className="mt-3 w-full rounded-md border border-border bg-subtle p-2.5 text-left font-mono text-xs text-foreground">
        {reason}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Switch persona from the top bar to Priya Menon (HR Admin), Rahul Desai (Payroll Admin) or
        Arjun Kapoor (Tenant Owner) and this tab fills in without a reload.
      </p>
      <div className="mt-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/roles">View the role matrix</Link>
        </Button>
      </div>
    </Card>
  );
}

function CompensationDetail({ employee }: { employee: Employee }) {
  const breakup = compensationBreakup(employee.ctc, employee.gradeId);
  const history = compensationHistoryFor(employee.code) ?? [];

  const lines = [
    { label: "Basic", value: breakup.basic, note: "40% of CTC" },
    { label: "House rent allowance", value: breakup.hra, note: "50% of basic" },
    { label: "Leave travel allowance", value: breakup.lta, note: "8.33% of basic" },
    { label: "Special allowance", value: breakup.specialAllowance, note: "Balancing figure" },
    { label: "Variable pay", value: breakup.variablePay, note: "10% of CTC at G4 and above" },
    {
      label: "Employer PF",
      value: breakup.employerPf,
      note: "12% of basic, capped at ₹1,800 a month",
    },
    { label: "Gratuity", value: breakup.gratuity, note: "4.81% of basic" },
  ];
  const total = lines.reduce((a, l) => a + l.value, 0);

  const ctcSeries = history
    .slice()
    .reverse()
    .map((r) => ({ effectiveFrom: r.effectiveFrom, ctc: r.newCtc }));

  const latest = history[0];

  return (
    <div className="flex flex-col gap-4">
      <StatRow cols={4}>
        <StatTile
          compact
          label="Annual CTC"
          value={inr(employee.ctc, { decimals: false })}
          icon={IndianRupee}
          hint={gradeById(employee.gradeId)?.label ?? employee.gradeId}
        />
        <StatTile
          compact
          label="Monthly gross"
          value={inr(breakup.grossMonthly, { decimals: false })}
          hint="Basic + HRA + LTA + special allowance"
        />
        <StatTile
          compact
          label="Last revision"
          value={latest ? fmtDate(latest.effectiveFrom) : "—"}
          hint={latest?.reason ?? "No revision on record"}
        />
        <StatTile
          compact
          label="Last hike"
          value={latest && latest.hikePct > 0 ? pct(latest.hikePct) : "—"}
          hint={latest ? `Approved by ${latest.approvedBy}` : "Joining offer only"}
        />
      </StatRow>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section
          title="Current compensation"
          description={`Effective ${fmtDate(latest?.effectiveFrom ?? employee.joiningDate)}. Annual figures, Indian CTC convention.`}
        >
          <MiniTable
            caption={`CTC breakup for ${employee.name}`}
            head={[{ label: "Component" }, { label: "Basis" }, { label: "Annual", numeric: true }]}
          >
            {lines.map((l) => (
              <tr key={l.label} className="border-b border-border last:border-0">
                <Td>{l.label}</Td>
                <Td className="text-muted-foreground">{l.note}</Td>
                <Td numeric>{inr(l.value, { decimals: false })}</Td>
              </tr>
            ))}
            <tr className="border-t border-border bg-subtle font-semibold">
              <Td>Total cost to company</Td>
              <Td className="text-muted-foreground">Sum of all components</Td>
              <Td numeric>{inr(total, { decimals: false })}</Td>
            </tr>
          </MiniTable>
          <p className="mt-2 text-xs text-muted-foreground">
            Special allowance is the balancing figure, so the column reconciles to the annual CTC
            of {inr(employee.ctc, { decimals: false })} to the rupee. Monthly gross of{" "}
            {inr(breakup.grossMonthly, { decimals: false })} excludes employer PF, gratuity and
            variable pay — those are retirals and pay-out components, not monthly earnings.
          </p>
        </Section>

        <TrendLineChart
          title="Cost to company over time"
          description={`Every revision on ${employee.name}'s record, from the joining offer to the current band.`}
          data={ctcSeries}
          xKey="effectiveFrom"
          series={[{ key: "ctc", label: "Annual CTC" }]}
          valueFormat={inrCompact}
          xLabelFormat={(v) => fmtDate(v)}
          height={260}
          footnote={`${ctcSeries.length} revision${ctcSeries.length === 1 ? "" : "s"} on record. Figures are annual CTC, not take-home.`}
        />
      </div>

      <Section
        title="Revision history"
        description="Newest first. Every row went through the compensation approval workflow."
      >
        <MiniTable
          caption={`Compensation revisions for ${employee.name}`}
          head={[
            { label: "Effective from" },
            { label: "Reason" },
            { label: "Previous CTC", numeric: true },
            { label: "New CTC", numeric: true },
            { label: "Hike", numeric: true },
            { label: "Approved by" },
            { label: "Note" },
          ]}
        >
          {history.map((r) => (
            <tr key={r.id} className="border-b border-border last:border-0">
              <Td className="tnum whitespace-nowrap">{fmtDate(r.effectiveFrom)}</Td>
              <Td>
                <Badge variant={r.reason === "Promotion" ? "soft" : "muted"}>{r.reason}</Badge>
              </Td>
              <Td numeric>{r.previousCtc ? inr(r.previousCtc, { decimals: false }) : "—"}</Td>
              <Td numeric>{inr(r.newCtc, { decimals: false })}</Td>
              <Td numeric>{r.hikePct > 0 ? pct(r.hikePct) : "—"}</Td>
              <Td>{r.approvedBy}</Td>
              <Td className="text-muted-foreground">{r.note}</Td>
            </tr>
          ))}
        </MiniTable>
      </Section>
    </div>
  );
}

/* ========================================================================== */
/*                             4 · Documents                                  */
/* ========================================================================== */

function DocumentsTab({ employee }: { employee: Employee }) {
  const [uploadOpen, setUploadOpen] = React.useState(false);
  /* Uploads are optimistic and live for the session only. */
  const [extra, setExtra] = React.useState<EmployeeDocument[]>([]);

  const docs = React.useMemo(
    () => [...extra, ...(documentsFor(employee.code) ?? [])],
    [extra, employee.code],
  );
  const expired = docs.filter((d) => d.status === "expired");

  const columns = React.useMemo<ColumnDef<EmployeeDocument, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Document",
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => <Badge variant="muted">{row.original.category}</Badge>,
      },
      {
        accessorKey: "fileName",
        header: "File",
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.fileName}</span>,
      },
      {
        accessorKey: "sizeKb",
        header: "Size",
        cell: ({ row }) => (
          <span className="tnum block text-right">{num(row.original.sizeKb)} KB</span>
        ),
      },
      {
        accessorKey: "uploadedOn",
        header: "Uploaded",
        cell: ({ row }) => <span className="tnum">{fmtDate(row.original.uploadedOn)}</span>,
      },
      {
        accessorKey: "expiresOn",
        header: "Expires",
        cell: ({ row }) => (
          <span className="tnum">
            {row.original.expiresOn ? fmtDate(row.original.expiresOn) : "—"}
          </span>
        ),
      },
      { accessorKey: "uploadedBy", header: "Uploaded by" },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "__actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Download ${row.original.name}`}
              onClick={(e) => {
                e.stopPropagation();
                mockAction("Download started", {
                  description: `${row.original.fileName} — in the demo the file is not written to disk.`,
                });
              }}
            >
              <Download />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-3">
      {expired.length > 0 && (
        <Alert
          tone="warning"
          icon={AlertTriangle}
          title={`${expired.length} document${expired.length === 1 ? " has" : "s have"} expired`}
        >
          {expired.map((d) => d.name).join(", ")} — renewal is overdue. Expired compliance
          acknowledgements stay on the compliance calendar until they are re-signed.
        </Alert>
      )}

      <Section
        title="Document locker"
        description={`${docs.length} file${docs.length === 1 ? "" : "s"} on record for ${employee.name}.`}
        actions={
          <Gated menuKey="people.profile" action="E">
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <FileUp /> Upload document
            </Button>
          </Gated>
        }
        bodyClassName="p-3"
      >
        {docs.length === 0 ? (
          <EmptyState
            icon={FileUp}
            title="No documents uploaded"
            description="Identity, education and compliance documents are usually captured during onboarding. Upload the first one to start the locker."
            action={
              <Gated menuKey="people.profile" action="E">
                <Button size="sm" onClick={() => setUploadOpen(true)}>
                  <FileUp /> Upload document
                </Button>
              </Gated>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={docs}
            searchKeys={["name", "category", "fileName", "uploadedBy"]}
            searchPlaceholder="Search documents…"
            getRowId={(d) => d.id}
            pageSize={10}
            exportName={`${employee.code}_documents`}
            dense
            emptyTitle="No documents match this search"
            emptyDescription="Clear the search box to see the full locker."
            rowTone={(d) => (d.status === "expired" ? "warning" : undefined)}
          />
        )}
      </Section>

      <UploadDocumentDialog
        employee={employee}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={(doc) =>
          setExtra((prev) => [
            { ...doc, id: `${employee.code}-DOC-NEW-${prev.length + 1}` },
            ...prev,
          ])
        }
      />
    </div>
  );
}

const UPLOAD_CATEGORIES = ["Identity", "Education", "Employment", "Compliance", "Payroll"] as const;

function UploadDocumentDialog({
  employee,
  open,
  onOpenChange,
  onUploaded,
}: {
  employee: Employee;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUploaded: (doc: EmployeeDocument) => void;
}) {
  const [category, setCategory] = React.useState<(typeof UPLOAD_CATEGORIES)[number]>("Identity");
  const [picked, setPicked] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setPicked(null);
      setCategory("Identity");
    }
  }, [open]);

  const submit = () => {
    if (!picked) return;
    onUploaded({
      /* the parent re-stamps a unique id so repeat uploads never collide */
      id: `${employee.code}-DOC-NEW`,
      employeeCode: employee.code,
      name: "Address proof — rental agreement",
      category,
      fileName: picked,
      sizeKb: 1240,
      uploadedOn: DEMO_TODAY,
      expiresOn: null,
      status: "pending",
      uploadedBy: employee.name,
      verifiedBy: null,
    });
    mockAction("Document uploaded", {
      description: `${picked} filed under ${category} for ${employee.code}. Awaiting HR verification.`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Upload a document</DialogTitle>
          <DialogDescription>
            PDF, JPG or PNG up to 10 MB. Nothing leaves the browser in this demo.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-3">
            <Field label="Category">
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as (typeof UPLOAD_CATEGORIES)[number])}
              >
                <SelectTrigger aria-label="Document category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UPLOAD_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <button
              type="button"
              onClick={() => setPicked(`${employee.code}_address_proof.pdf`)}
              className="flex flex-col items-center gap-1.5 rounded-md border border-dashed border-border px-4 py-7 text-center transition-colors hover:border-primary/40 hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <FileUp className="size-5 text-muted-foreground" aria-hidden />
              <span className="text-xs font-medium text-foreground">
                {picked ?? "Drop a file here, or click to choose one"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {picked ? "1.2 MB · ready to upload" : "PDF, JPG or PNG · max 10 MB"}
              </span>
            </button>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!picked} onClick={submit}>
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ========================================================================== */
/*                             5 · Attendance                                 */
/* ========================================================================== */

function AttendanceTab({ employee }: { employee: Employee }) {
  const summary = attendanceSummaryFor(employee.code);

  if (!summary) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="No attendance on record"
        description="Attendance is generated from the punch log. Nothing has been captured for this employee yet."
      />
    );
  }

  const chartData = summary.months.map((m) => ({
    label: m.label,
    present: m.present,
    leave: m.leave,
    absent: m.absent,
  }));

  return (
    <div className="flex flex-col gap-4">
      <StatRow cols={4}>
        <StatTile
          compact
          label="Present"
          value={pct(summary.presentPct)}
          tone={summary.presentPct >= 92 ? "good" : "warning"}
          hint="Share of working days marked present, last six months"
        />
        <StatTile
          compact
          label="Punctuality"
          value={pct(summary.punctualityPct)}
          tone={summary.punctualityPct >= 90 ? "good" : "warning"}
          hint="Present days without a late mark"
        />
        <StatTile
          compact
          label="Late marks"
          value={num(summary.totalLateMarks)}
          hint="Arrivals past the grace window"
        />
        <StatTile
          compact
          label="Overtime"
          value={`${num(summary.totalOvertimeHours)} h`}
          hint="Approved hours beyond the standard shift"
        />
      </StatRow>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section
          title="Month by month"
          description="Finalised attendance exactly as it reaches the payroll input sheet."
          bodyClassName="p-3"
        >
          <MiniTable
            caption={`Monthly attendance summary for ${employee.name}`}
            head={[
              { label: "Month" },
              { label: "Working", numeric: true },
              { label: "Present", numeric: true },
              { label: "Leave", numeric: true },
              { label: "Absent", numeric: true },
              { label: "Late", numeric: true },
              { label: "OT hrs", numeric: true },
              { label: "Avg hrs", numeric: true },
            ]}
          >
            {summary.months.map((m) => (
              <tr key={m.month} className="border-b border-border last:border-0">
                <Td>{m.label}</Td>
                <Td numeric>{m.workingDays}</Td>
                <Td numeric>{m.present}</Td>
                <Td numeric>{m.leave}</Td>
                <Td numeric className={m.absent > 0 ? "text-destructive-fg" : undefined}>
                  {m.absent}
                </Td>
                <Td numeric>{m.lateMarks}</Td>
                <Td numeric>{m.overtimeHours}</Td>
                <Td numeric>{m.avgHours.toFixed(1)}</Td>
              </tr>
            ))}
          </MiniTable>
          <p className="mt-2 text-xs text-muted-foreground">
            Loss-of-pay days over the period:{" "}
            <span className="tnum font-medium text-foreground">{summary.lopDays}</span>. These flow
            straight into the monthly payroll input as unpaid days.
          </p>
        </Section>

        <BarCompareChart
          stacked
          title="Attendance mix, last six months"
          description="Every working day resolves to exactly one state, so each stack is the month's working-day count."
          data={chartData}
          xKey="label"
          series={[
            { key: "present", label: "Present" },
            { key: "leave", label: "Leave" },
            { key: "absent", label: "Absent" },
          ]}
          valueFormat={(v) => num(v)}
          height={260}
          footnote="Present + leave + absent equals the working days for that month."
        />
      </div>
    </div>
  );
}

/* ========================================================================== */
/*                                6 · Leave                                   */
/* ========================================================================== */

function LeaveTab({ employee }: { employee: Employee }) {
  const summary = leaveSummaryFor(employee.code);

  if (!summary) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="No leave ledger"
        description="A leave ledger is opened when the employee is confirmed. Nothing has accrued yet."
      />
    );
  }

  const monthly = summary.monthly.map((m) => ({ label: m.label, days: m.days }));
  const totals = summary.rows.reduce(
    (a, r) => ({
      opening: a.opening + r.opening,
      accrued: a.accrued + r.accrued,
      used: a.used + r.used,
      available: a.available + r.available,
    }),
    { opening: 0, accrued: 0, used: 0, available: 0 },
  );

  return (
    <div className="flex flex-col gap-4">
      <Section
        title="Balances by leave type"
        description="The leave year runs April to March; accrual is pro-rated to the elapsed months."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {summary.rows.map((r) => {
            const entitlement = r.opening + r.accrued;
            return (
              <div
                key={r.type}
                className="flex items-center gap-3 rounded-md border border-border p-2.5"
              >
                <ProgressRing
                  value={r.used}
                  max={Math.max(entitlement, 0.5)}
                  size={48}
                  thickness={5}
                  label={<span className="tnum">{r.available}</span>}
                  sublabel="left"
                />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">{r.type}</p>
                  <p className="tnum text-[11px] text-muted-foreground">
                    {r.used} used of {entitlement}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section
          title="Leave ledger summary"
          description="Available = opening + accrued − used. Every row reconciles."
          bodyClassName="p-3"
        >
          <MiniTable
            caption={`Leave balances for ${employee.name}`}
            head={[
              { label: "Leave type" },
              { label: "Opening", numeric: true },
              { label: "Accrued", numeric: true },
              { label: "Used", numeric: true },
              { label: "Available", numeric: true },
            ]}
          >
            {summary.rows.map((r) => (
              <tr key={r.type} className="border-b border-border last:border-0">
                <Td>{r.type}</Td>
                <Td numeric>{r.opening}</Td>
                <Td numeric>{r.accrued}</Td>
                <Td numeric>{r.used}</Td>
                <Td numeric className="font-semibold">
                  {r.available}
                </Td>
              </tr>
            ))}
            <tr className="border-t border-border bg-subtle font-semibold">
              <Td>Total</Td>
              <Td numeric>{totals.opening}</Td>
              <Td numeric>{totals.accrued}</Td>
              <Td numeric>{totals.used}</Td>
              <Td numeric>{totals.available}</Td>
            </tr>
          </MiniTable>
        </Section>

        <BarCompareChart
          title="Leave taken by month"
          description="Approved days deducted from the ledger over the last six months, half-days included."
          data={monthly}
          xKey="label"
          series={[{ key: "days", label: "Days taken" }]}
          valueFormat={(v) => `${v} d`}
          height={260}
          footnote={`${summary.totalUsed} days used, ${summary.totalAvailable} still available across all types.`}
        />
      </div>
    </div>
  );
}

/* ========================================================================== */
/*                            7 · Performance                                 */
/* ========================================================================== */

function PerformanceTab({ employee }: { employee: Employee }) {
  const summary = performanceFor(employee.code);

  if (!summary) {
    return (
      <EmptyState
        icon={Star}
        title="No performance record"
        description="Performance history is created when the employee enters their first review cycle."
      />
    );
  }

  const chartData = summary.cycles.map((c) => ({
    cycle: c.cycle,
    selfRating: c.selfRating,
    managerRating: c.managerRating,
    finalRating: c.finalRating,
  }));

  return (
    <div className="flex flex-col gap-4">
      <StatRow cols={3}>
        <StatTile
          compact
          label="Latest final rating"
          value={summary.latestRating !== null ? `${summary.latestRating.toFixed(1)} / 5` : "—"}
          icon={Star}
          hint={summary.cycles.at(-1)?.band ?? "No completed cycle yet"}
        />
        <StatTile
          compact
          label="Goal completion"
          value={`${summary.goalCompletion}%`}
          icon={Target}
          tone={summary.goalCompletion >= 70 ? "good" : "warning"}
          hint="Weighted across all active goals"
        />
        <StatTile
          compact
          label="Completed cycles"
          value={num(summary.cycles.length)}
          hint="Appraisals closed since joining"
        />
      </StatRow>

      {summary.cycles.length === 0 ? (
        <EmptyState
          icon={Star}
          title="No completed review cycle yet"
          description={`${employee.name} joined on ${fmtDate(employee.joiningDate)} and has not yet completed a full appraisal window. The goals below are already tracked and carry into the first cycle.`}
          action={
            <Button size="sm" variant="outline" asChild>
              <Link href="/reviews">Open review cycles</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Section
            title="Review history"
            description="Self, manager and post-calibration final ratings on a five-point scale."
            bodyClassName="p-3"
          >
            <MiniTable
              caption={`Review cycles for ${employee.name}`}
              head={[
                { label: "Cycle" },
                { label: "Self", numeric: true },
                { label: "Manager", numeric: true },
                { label: "Final", numeric: true },
                { label: "Band" },
                { label: "Status" },
              ]}
            >
              {summary.cycles.map((c) => (
                <tr key={c.cycle} className="border-b border-border last:border-0">
                  <Td>{c.cycle}</Td>
                  <Td numeric>{c.selfRating.toFixed(1)}</Td>
                  <Td numeric>{c.managerRating.toFixed(1)}</Td>
                  <Td numeric className="font-semibold">
                    {c.finalRating.toFixed(1)}
                  </Td>
                  <Td>{c.band}</Td>
                  <Td>
                    <StatusBadge status={c.status} />
                  </Td>
                </tr>
              ))}
            </MiniTable>
          </Section>

          <BarCompareChart
            title="Rating by cycle"
            description="Self-assessment against the manager rating and the calibrated final score."
            data={chartData}
            xKey="cycle"
            series={[
              { key: "selfRating", label: "Self" },
              { key: "managerRating", label: "Manager" },
              { key: "finalRating", label: "Final" },
            ]}
            valueFormat={(v) => v.toFixed(1)}
            height={260}
            footnote="Final = 70% manager + 30% self, adjusted at departmental calibration."
          />
        </div>
      )}

      <Section
        title="Current goals"
        description="Weighted objectives for the running cycle. Weightage sums to 100%."
      >
        <ul className="flex flex-col divide-y divide-border">
          {summary.goals.map((g) => (
            <li key={g.title} className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 text-xs font-medium text-foreground">{g.title}</p>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="muted">
                    <span className="tnum">{g.weightage}%</span> weightage
                  </Badge>
                  <StatusBadge status={g.status} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Progress
                  value={g.progress}
                  aria-label={`${g.title}: ${g.progress}% complete`}
                  tone={g.progress >= 65 ? "success" : g.progress >= 40 ? "warning" : "danger"}
                  className="flex-1"
                />
                <span className="tnum w-10 shrink-0 text-right text-xs text-muted-foreground">
                  {g.progress}%
                </span>
              </div>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

/* ========================================================================== */
/*                               8 · Assets                                   */
/* ========================================================================== */

function AssetsTab({ employee }: { employee: Employee }) {
  const assets = React.useMemo(() => assetsFor(employee.code) ?? [], [employee.code]);
  const total = assets.reduce((a, x) => a + x.valueInr, 0);

  const byCategory = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const a of assets) map.set(a.category, (map.get(a.category) ?? 0) + a.valueInr);
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [assets]);

  if (assets.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="No assets allocated"
        description={`Nothing is currently issued to ${employee.name}. Hardware and access are allocated from the asset register.`}
        action={
          <Button size="sm" variant="outline" asChild>
            <Link href="/assets">Open the asset register</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <StatRow cols={3}>
        <StatTile compact label="Assets allocated" value={num(assets.length)} />
        <StatTile compact label="Book value" value={inr(total, { decimals: false })} />
        <StatTile
          compact
          label="Needing attention"
          value={num(assets.filter((a) => a.status === "under_repair").length)}
          tone={assets.some((a) => a.status === "under_repair") ? "warning" : "neutral"}
          hint="Items currently out for repair"
        />
      </StatRow>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Section
          title="Allocated assets"
          description="Issued hardware and access, with the acquisition value carried on the register."
          bodyClassName="p-3"
        >
          <MiniTable
            caption={`Assets allocated to ${employee.name}`}
            head={[
              { label: "Tag" },
              { label: "Category" },
              { label: "Model" },
              { label: "Serial" },
              { label: "Allocated" },
              { label: "Condition" },
              { label: "Value", numeric: true },
              { label: "Status" },
            ]}
          >
            {assets.map((a) => (
              <tr key={a.id} className="border-b border-border last:border-0">
                <Td className="tnum font-mono">{a.tag}</Td>
                <Td>{a.category}</Td>
                <Td>{a.model}</Td>
                <Td className="tnum font-mono text-muted-foreground">{a.serial}</Td>
                <Td className="tnum whitespace-nowrap">{fmtDate(a.allocatedOn)}</Td>
                <Td>{a.condition}</Td>
                <Td numeric>{inr(a.valueInr, { decimals: false })}</Td>
                <Td>
                  <StatusBadge status={a.status} />
                </Td>
              </tr>
            ))}
            <tr className="border-t border-border bg-subtle font-semibold">
              <Td>Total</Td>
              <Td />
              <Td />
              <Td />
              <Td />
              <Td />
              <Td numeric>{inr(total, { decimals: false })}</Td>
              <Td />
            </tr>
          </MiniTable>
        </Section>

        <DonutChart
          title="Allocated value by category"
          description="Where the book value of this employee's issued equipment sits."
          data={byCategory}
          nameKey="name"
          valueKey="value"
          valueFormat={(v) => inr(v, { decimals: false })}
          centreValue={inrCompact(total)}
          centreLabel="Allocated value"
          height={240}
          footnote="Acquisition value, not depreciated book value."
        />
      </div>
    </div>
  );
}

/* ========================================================================== */
/*                              9 · Timeline                                  */
/* ========================================================================== */

const TIMELINE_ICON: Record<LifecycleKind, React.ElementType> = {
  hired: UserPlus,
  confirmed: BadgeCheck,
  promoted: TrendingUp,
  transferred: MapPin,
  appraisal: Star,
  salary_revision: IndianRupee,
  manager_change: GitFork,
  exit_initiated: LogOut,
};

function TimelineTab({ employee }: { employee: Employee }) {
  const events = React.useMemo(() => timelineFor(employee.code) ?? [], [employee.code]);

  return (
    <Section
      title="Lifecycle"
      description={`${events.length} recorded event${events.length === 1 ? "" : "s"} since ${fmtDate(employee.joiningDate)}, newest first.`}
    >
      {events.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="Nothing on the timeline yet"
          description="Lifecycle events appear here as the employee is confirmed, appraised, promoted or transferred."
        />
      ) : (
        <ol className="flex flex-col">
          {events.map((e, i) => {
            const Icon = TIMELINE_ICON[e.kind];
            const last = i === events.length - 1;
            return (
              <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
                {!last && (
                  <span
                    className="absolute left-[13px] top-7 h-[calc(100%-1.25rem)] w-px bg-border"
                    aria-hidden
                  />
                )}
                <span
                  className={cn(
                    "z-[1] flex size-7 shrink-0 items-center justify-center rounded-full border",
                    e.kind === "exit_initiated"
                      ? "border-destructive/25 bg-destructive-soft text-destructive-fg"
                      : e.kind === "promoted"
                        ? "border-success/25 bg-success-soft text-success-fg"
                        : "border-border bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                </span>

                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="muted">{LIFECYCLE_LABEL[e.kind]}</Badge>
                    <p className="text-xs font-medium text-foreground">{e.title}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{e.detail}</p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="tnum text-xs font-medium text-foreground">{fmtDate(e.date)}</p>
                  <p className="text-[11px] text-muted-foreground">{e.actor}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}
