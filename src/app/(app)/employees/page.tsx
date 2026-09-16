"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { differenceInMonths, format, isValid, parseISO, subDays } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowRightLeft,
  Building2,
  Download,
  LayoutGrid,
  List,
  Search,
  Upload,
  UserMinus,
  UserPlus,
  UserSearch,
  X,
} from "lucide-react";

import { fmtDate, inr } from "@/lib/format";
import { mulberry32, randInt } from "@/lib/utils";
import {
  BRANCHES,
  DEMO_TODAY,
  DEPARTMENTS,
  GRADES,
  branchById,
  deptName,
  gradeById,
} from "@/mock/org";
import { EMPLOYEES, type Employee } from "@/mock/employees";
import { ALL_DESIGNATIONS, DIRECTORY_STATS } from "@/mock/people-extras";

import { mockAction } from "@/components/app-state";
import {
  CardsSkeleton,
  Gated,
  PageBody,
  PageHeader,
  TableSkeleton,
  useFakeLoad,
} from "@/components/shell/page";
import { DataTable, NumCell } from "@/components/data-table";
import { BarCompareChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { EmployeeCard, PersonCell } from "@/components/people/person-cell";
import { Button } from "@/components/ui/button";
import { StatusBadge, statusDef } from "@/components/ui/status-badge";
import { EmptyState, Field, Input } from "@/components/ui/primitives";
import {
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FilterSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/overlays";

/* ============================================================================
   /employees — the employee directory.

   The list is held in component state seeded from the fixture, so adding a
   person, re-parenting a team or deactivating a selection changes what is on
   screen immediately. Nothing persists past a refresh — by design.

   Card grid and table are two views of ONE filter state, so switching the
   toggle never loses what you narrowed down to. Every KPI tile drills in by
   pushing a query string, which re-seeds the filters below.
   ========================================================================== */

const TODAY = parseISO(DEMO_TODAY);
const THIS_MONTH = format(TODAY, "yyyy-MM");
const CARD_PAGE = 48;

const STATUS_KEYS = ["active", "probation", "notice", "on_leave", "exited"] as const;

const tenureYears = (e: Employee) => differenceInMonths(TODAY, parseISO(e.joiningDate)) / 12;

/* ------------------------------------------------------------- add form */

const DEPT_IDS = DEPARTMENTS.map((d) => d.id) as [string, ...string[]];
const BRANCH_IDS = BRANCHES.map((b) => b.id) as [string, ...string[]];
const GRADE_IDS = GRADES.map((g) => g.id) as [string, ...string[]];

const EARLIEST_JOIN = subDays(TODAY, 90);

const addEmployeeSchema = z.object({
  name: z.string().trim().min(3, "Enter the employee's full name (at least 3 characters)"),
  email: z
    .email("Enter a valid email address")
    .refine(
      (v) => v.trim().toLowerCase().endsWith("@stellartech.in"),
      "Work email must be on the @stellartech.in domain",
    ),
  departmentId: z.enum(DEPT_IDS, { message: "Pick a department" }),
  branchId: z.enum(BRANCH_IDS, { message: "Pick a branch" }),
  designation: z.string().trim().min(2, "Designation is required"),
  gradeId: z.enum(GRADE_IDS, { message: "Pick a grade band" }),
  joiningDate: z
    .string()
    .min(1, "Joining date is required")
    .refine((v) => isValid(parseISO(v)), "Enter a real calendar date")
    .refine(
      (v) => !isValid(parseISO(v)) || parseISO(v) >= EARLIEST_JOIN,
      `Joining date cannot be earlier than ${fmtDate(EARLIEST_JOIN)} — backdate older hires through Bulk import`,
    ),
  managerCode: z
    .string()
    .trim()
    .refine((v) => v === "" || /^STL-\d{4}$/i.test(v), "Manager code must look like STL-0031")
    .refine(
      (v) => v === "" || EMPLOYEES.some((e) => e.code === v.toUpperCase()),
      "No active employee holds that code",
    ),
  ctc: z
    .string()
    .trim()
    .min(1, "Annual CTC is required")
    .refine((v) => /^\d+$/.test(v.replace(/[,\s]/g, "")), "Enter digits only — no symbol, no decimals")
    .refine((v) => Number(v.replace(/[,\s]/g, "")) >= 300000, "Annual CTC must be at least ₹3,00,000"),
});

type AddEmployeeValues = z.infer<typeof addEmployeeSchema>;

/**
 * Turns the form into a full Employee. Filler fields the form does not ask for
 * (PAN, UAN, phone, DOB) are derived from the new code with a seeded RNG, so
 * the same code always produces the same filler — never Math.random().
 */
function buildEmployee(values: AddEmployeeValues, code: string): Employee {
  const rng = mulberry32(Number(code.replace(/\D/g, "")) || 1);
  const [firstName, ...rest] = values.name.trim().split(/\s+/);
  const branch = branchById(values.branchId);
  const gradeLevel = gradeById(values.gradeId)?.level ?? 2;
  const ctc = Number(values.ctc.replace(/[,\s]/g, ""));

  return {
    id: code,
    code,
    name: values.name.trim(),
    firstName,
    lastName: rest.join(" "),
    email: values.email.trim().toLowerCase(),
    phone:
      branch?.country === "US"
        ? `+1 ${randInt(rng, 201, 989)} ${randInt(rng, 200, 999)} ${String(randInt(rng, 0, 9999)).padStart(4, "0")}`
        : `+91 ${randInt(rng, 70, 99)}${String(randInt(rng, 0, 99999999)).padStart(8, "0")}`,
    gender: "Not disclosed",
    dob: "1996-04-12",
    designation: values.designation.trim(),
    departmentId: values.departmentId,
    branchId: values.branchId,
    gradeId: values.gradeId,
    level: gradeLevel >= 6 ? 1 : gradeLevel >= 5 ? 2 : 3,
    managerCode:
      values.managerCode.trim() !== ""
        ? values.managerCode.trim().toUpperCase()
        : (DEPARTMENTS.find((d) => d.id === values.departmentId)?.headEmployeeCode ?? null),
    joiningDate: values.joiningDate,
    confirmationDate: null,
    status: "probation",
    employmentType: "Full-time",
    workMode: "Hybrid",
    ctc,
    location: branch?.city ?? "Bengaluru",
    bankAccountLast4: String(randInt(rng, 1000, 9999)),
    hasBankDetails: false,
    pan: `${["A", "B", "C", "D", "E"][randInt(rng, 0, 4)]}${["A", "K", "M", "P", "R"][randInt(rng, 0, 4)]}XPS${String(randInt(rng, 1000, 9999))}${["A", "D", "G", "K", "N"][randInt(rng, 0, 4)]}`,
    uan: `1010${String(randInt(rng, 10000000, 99999999))}`,
    skills: [],
  };
}

function AddEmployeeDialog({
  open,
  onOpenChange,
  nextCode,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  nextCode: string;
  onAdd: (employee: Employee) => void;
}) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddEmployeeValues>({
    resolver: zodResolver(addEmployeeSchema),
    defaultValues: {
      name: "",
      email: "",
      departmentId: "ENG",
      branchId: "BLR",
      designation: "",
      gradeId: "G2",
      joiningDate: DEMO_TODAY,
      managerCode: "",
      ctc: "",
    },
  });

  const close = () => {
    reset();
    onOpenChange(false);
  };

  /* Only reached when zod passes — invalid fields keep the dialog open and
     render their message inline through <Field error=…>. */
  const onSubmit = (values: AddEmployeeValues) => {
    onAdd(buildEmployee(values, nextCode));
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Add employee</DialogTitle>
          <DialogDescription>
            Creates a single record. For more than a handful of people, use Bulk import — it
            validates the whole file before anything is written.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Full name" htmlFor="ae-name" required error={errors.name?.message}>
                <Input id="ae-name" placeholder="Meghana Rao" aria-invalid={!!errors.name} {...register("name")} />
              </Field>

              <Field
                label="Work email"
                htmlFor="ae-email"
                required
                error={errors.email?.message}
                hint="Must be on @stellartech.in"
              >
                <Input
                  id="ae-email"
                  type="email"
                  placeholder="meghana.rao@stellartech.in"
                  aria-invalid={!!errors.email}
                  {...register("email")}
                />
              </Field>

              <Field label="Department" required error={errors.departmentId?.message}>
                <Controller
                  control={control}
                  name="departmentId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-label="Department">
                        <span className="truncate">{deptName(field.value)}</span>
                      </SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field label="Branch" required error={errors.branchId?.message}>
                <Controller
                  control={control}
                  name="branchId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-label="Branch">
                        <span className="truncate">{branchById(field.value)?.name ?? field.value}</span>
                      </SelectTrigger>
                      <SelectContent>
                        {BRANCHES.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field label="Designation" htmlFor="ae-designation" required error={errors.designation?.message}>
                <Input
                  id="ae-designation"
                  placeholder="Software Engineer"
                  aria-invalid={!!errors.designation}
                  {...register("designation")}
                />
              </Field>

              <Field label="Grade" required error={errors.gradeId?.message}>
                <Controller
                  control={control}
                  name="gradeId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-label="Grade">
                        <span className="truncate">{gradeById(field.value)?.label ?? field.value}</span>
                      </SelectTrigger>
                      <SelectContent>
                        {GRADES.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field
                label="Joining date"
                htmlFor="ae-joining"
                required
                error={errors.joiningDate?.message}
                hint={`On or after ${fmtDate(EARLIEST_JOIN)}`}
              >
                <Input id="ae-joining" type="date" aria-invalid={!!errors.joiningDate} {...register("joiningDate")} />
              </Field>

              <Field
                label="Reporting manager"
                htmlFor="ae-manager"
                error={errors.managerCode?.message}
                hint="Optional — leave blank to attach to the department head"
              >
                <Input
                  id="ae-manager"
                  placeholder="STL-0031"
                  aria-invalid={!!errors.managerCode}
                  {...register("managerCode")}
                />
              </Field>

              <Field
                label="Annual CTC"
                htmlFor="ae-ctc"
                required
                error={errors.ctc?.message}
                hint="Rupees per year, digits only"
              >
                <Input
                  id="ae-ctc"
                  inputMode="numeric"
                  placeholder="1240000"
                  className="tnum"
                  aria-invalid={!!errors.ctc}
                  {...register("ctc")}
                />
              </Field>

              <Field label="Employee code" hint="Assigned automatically on save">
                <Input value={nextCode} readOnly disabled className="tnum" />
              </Field>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Add employee
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------- bulk action dialogs */

interface BulkTarget {
  kind: "department" | "manager" | "deactivate";
  rows: Employee[];
  clear: () => void;
}

function ChangeDepartmentDialog({
  target,
  onApply,
  onDone,
}: {
  target: BulkTarget | null;
  onApply: (departmentId: string) => void;
  onDone: () => void;
}) {
  const open = target?.kind === "department";
  const [dept, setDept] = React.useState("ENG");
  const count = target?.rows.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onDone()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Change department</DialogTitle>
          <DialogDescription>
            Moves {count} employee{count === 1 ? "" : "s"} to a new department. Cost centre follows
            the department on the next pay run.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Field label="New department" hint="Existing reporting lines are left untouched">
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger aria-label="New department">
                <span className="truncate">{deptName(dept)}</span>
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name} · {d.costCentre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button onClick={() => onApply(dept)}>
            Move {count} employee{count === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChangeManagerDialog({
  target,
  pool,
  onApply,
  onDone,
}: {
  target: BulkTarget | null;
  pool: Employee[];
  onApply: (manager: Employee) => void;
  onDone: () => void;
}) {
  const open = target?.kind === "manager";
  const [query, setQuery] = React.useState("");
  const [picked, setPicked] = React.useState<string | null>(null);
  const count = target?.rows.length ?? 0;

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const found = q
      ? pool.filter(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            m.code.toLowerCase().includes(q) ||
            m.designation.toLowerCase().includes(q),
        )
      : pool;
    return found.slice(0, 40);
  }, [query, pool]);

  const chosen = picked ? pool.find((e) => e.code === picked) : undefined;

  const reset = () => {
    setQuery("");
    setPicked(null);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && reset()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Change reporting manager</DialogTitle>
          <DialogDescription>
            Re-parents {count} employee{count === 1 ? "" : "s"} in the org chart. Pending approvals
            move to the new manager&apos;s inbox.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search managers by name, code or title…"
              aria-label="Search managers"
              className="pl-8"
            />
          </div>

          <ul className="scrollbar-thin mt-2.5 max-h-[280px] overflow-y-auto rounded-md border border-border">
            {matches.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                No manager matches “{query}”.
              </li>
            ) : (
              matches.map((m) => (
                <li key={m.code} className="border-b border-border last:border-0">
                  <button
                    type="button"
                    onClick={() => setPicked(m.code)}
                    aria-pressed={picked === m.code}
                    className={`flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      picked === m.code ? "bg-primary-soft/50" : ""
                    }`}
                  >
                    <PersonCell name={m.name} code={m.code} size={24} />
                    <span className="shrink-0 truncate text-muted-foreground">{m.designation}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={reset}>
            Cancel
          </Button>
          <Button
            disabled={!chosen}
            onClick={() => {
              if (!chosen) return;
              onApply(chosen);
              setQuery("");
              setPicked(null);
            }}
          >
            {chosen ? `Move under ${chosen.name}` : "Pick a manager"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------------------------------------- page */

export default function EmployeesPage() {
  return (
    <React.Suspense fallback={<TableSkeleton />}>
      <EmployeeDirectory />
    </React.Suspense>
  );
}

function EmployeeDirectory() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const spKey = searchParams.toString();
  const loading = useFakeLoad();

  /* The live directory. Seeded from the fixture, mutated in memory only. */
  const [people, setPeople] = React.useState<Employee[]>(() => EMPLOYEES);

  const [view, setView] = React.useState<"cards" | "table">("table");
  const [dept, setDept] = React.useState(() => searchParams.get("dept") ?? "all");
  const [branch, setBranch] = React.useState(() => searchParams.get("branch") ?? "all");
  const [designation, setDesignation] = React.useState(() => searchParams.get("designation") ?? "all");
  const [status, setStatus] = React.useState(() => searchParams.get("status") ?? "all");
  const [joined, setJoined] = React.useState(() => searchParams.get("joined") ?? "all");
  const [sortMode, setSortMode] = React.useState(() => searchParams.get("sort") ?? "name");
  const [cardQuery, setCardQuery] = React.useState("");
  const [cardLimit, setCardLimit] = React.useState(CARD_PAGE);

  const [addOpen, setAddOpen] = React.useState(false);
  const [bulk, setBulk] = React.useState<BulkTarget | null>(null);

  /* A KPI tile drills in by pushing a query string — re-seed the filters. */
  React.useEffect(() => {
    const p = new URLSearchParams(spKey);
    setDept(p.get("dept") ?? "all");
    setBranch(p.get("branch") ?? "all");
    setDesignation(p.get("designation") ?? "all");
    setStatus(p.get("status") ?? "all");
    setJoined(p.get("joined") ?? "all");
    setSortMode(p.get("sort") ?? "name");
  }, [spKey]);

  const nameByCode = React.useMemo(
    () => new Map(people.map((p) => [p.code, p.name])),
    [people],
  );
  const managerName = React.useCallback(
    (code: string | null) => (code && nameByCode.get(code)) || "—",
    [nameByCode],
  );

  const managerPool = React.useMemo(
    () => people.filter((e) => e.level <= 2 && e.status !== "exited"),
    [people],
  );

  const nextCode = React.useMemo(() => {
    const max = people.reduce((a, p) => Math.max(a, Number(p.code.replace(/\D/g, "")) || 0), 0);
    return `STL-${String(max + 1).padStart(4, "0")}`;
  }, [people]);

  /* KPIs recompute off live state, so adding or deactivating moves them. */
  const stats = React.useMemo(() => {
    const active = people.filter((e) => e.status !== "exited");
    const joinersThisMonth = active.filter((e) => e.joiningDate.startsWith(THIS_MONTH)).length;
    const last = DIRECTORY_STATS.joinersLastMonth;
    return {
      headcount: active.length,
      joinersThisMonth,
      joinerDeltaPct: last === 0 ? 0 : ((joinersThisMonth - last) / last) * 100,
      onNotice: active.filter((e) => e.status === "notice").length,
      onProbation: active.filter((e) => e.status === "probation").length,
      avgTenureYears:
        active.reduce((a, e) => a + tenureYears(e), 0) / Math.max(1, active.length),
    };
  }, [people]);

  const headcountByDept = React.useMemo(
    () =>
      DEPARTMENTS.map((d) => ({
        id: d.id,
        name: d.name,
        headcount: people.filter((e) => e.departmentId === d.id && e.status !== "exited").length,
      })),
    [people],
  );

  const designationOptions = React.useMemo(() => {
    const live = new Set(ALL_DESIGNATIONS);
    people.forEach((p) => live.add(p.designation));
    return Array.from(live).sort();
  }, [people]);

  const dirty =
    dept !== "all" ||
    branch !== "all" ||
    designation !== "all" ||
    status !== "all" ||
    joined !== "all" ||
    sortMode !== "name";

  const clearFilters = React.useCallback(() => {
    setDept("all");
    setBranch("all");
    setDesignation("all");
    setStatus("all");
    setJoined("all");
    setSortMode("name");
    setCardQuery("");
    router.replace("/employees");
  }, [router]);

  const filtered = React.useMemo(() => {
    const list = people.filter(
      (e) =>
        (dept === "all" || e.departmentId === dept) &&
        (branch === "all" || e.branchId === branch) &&
        (designation === "all" || e.designation === designation) &&
        (status === "all" || e.status === status) &&
        (joined !== "this-month" || e.joiningDate.startsWith(THIS_MONTH)),
    );
    if (sortMode === "tenure") {
      return [...list].sort((a, b) => a.joiningDate.localeCompare(b.joiningDate));
    }
    return list;
  }, [people, dept, branch, designation, status, joined, sortMode]);

  const cardRows = React.useMemo(() => {
    const q = cardQuery.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.code.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.designation.toLowerCase().includes(q),
    );
  }, [filtered, cardQuery]);

  React.useEffect(() => {
    setCardLimit(CARD_PAGE);
  }, [cardQuery, dept, branch, designation, status, joined]);

  /* ---------------------------------------------------------- mutations */

  const addEmployee = (employee: Employee) => {
    setPeople((ps) => [...ps, employee]);
    /* Drop any filter that would hide the person who was just created. */
    setDept("all");
    setBranch("all");
    setDesignation("all");
    setStatus("all");
    setJoined("all");
    setCardQuery("");
    mockAction("Employee added", {
      description: `${employee.code} · ${employee.name} · ${employee.designation}. In the demo the record is not persisted.`,
    });
  };

  const applyDepartment = (departmentId: string) => {
    if (!bulk) return;
    const codes = new Set(bulk.rows.map((r) => r.code));
    setPeople((ps) => ps.map((p) => (codes.has(p.code) ? { ...p, departmentId } : p)));
    mockAction(`Department updated for ${codes.size} employee${codes.size === 1 ? "" : "s"}`, {
      description: `Moved to ${deptName(departmentId)}. Cost centre ${
        DEPARTMENTS.find((d) => d.id === departmentId)?.costCentre ?? "—"
      } applies from the next pay run.`,
    });
    bulk.clear();
    setBulk(null);
  };

  const applyManager = (manager: Employee) => {
    if (!bulk) return;
    const codes = new Set(bulk.rows.map((r) => r.code));
    codes.delete(manager.code); // nobody reports to themselves
    setPeople((ps) => ps.map((p) => (codes.has(p.code) ? { ...p, managerCode: manager.code } : p)));
    mockAction(`Reporting line updated for ${codes.size} employee${codes.size === 1 ? "" : "s"}`, {
      description: `Now reporting to ${manager.name} (${manager.code}). The org chart and approval routing reflect this immediately.`,
    });
    bulk.clear();
    setBulk(null);
  };

  const applyDeactivate = () => {
    if (!bulk) return;
    const codes = new Set(bulk.rows.map((r) => r.code));
    setPeople((ps) =>
      ps.map((p) =>
        codes.has(p.code)
          ? { ...p, status: "exited" as const, exitDate: DEMO_TODAY, exitReason: "Deactivated by HR" }
          : p,
      ),
    );
    mockAction(`Deactivated ${codes.size} employee${codes.size === 1 ? "" : "s"}`, {
      description:
        "Access revoked and leave accrual stopped from today. Records retained for statutory reporting.",
      tone: "warning",
    });
    bulk.clear();
    setBulk(null);
  };

  /* ------------------------------------------------------------ filters */

  const filterRow = (
    <>
      <FilterSelect
        label="Dept"
        value={dept}
        onValueChange={setDept}
        allLabel="All departments"
        options={DEPARTMENTS.map((d) => ({ value: d.id, label: d.name }))}
        width="w-[170px]"
      />
      <FilterSelect
        label="Branch"
        value={branch}
        onValueChange={setBranch}
        allLabel="All branches"
        options={BRANCHES.map((b) => ({ value: b.id, label: b.name }))}
        width="w-[180px]"
      />
      <FilterSelect
        label="Role"
        value={designation}
        onValueChange={setDesignation}
        allLabel="All designations"
        options={designationOptions.map((d) => ({ value: d, label: d }))}
        width="w-[200px]"
      />
      <FilterSelect
        label="Status"
        value={status}
        onValueChange={setStatus}
        allLabel="All statuses"
        options={STATUS_KEYS.map((k) => ({ value: k, label: statusDef(k).label }))}
        width="w-[150px]"
      />
      {joined === "this-month" && (
        <Button variant="soft" size="sm" onClick={() => setJoined("all")}>
          Joined {format(TODAY, "MMM yyyy")}
          <X aria-hidden />
        </Button>
      )}
      {sortMode === "tenure" && (
        <Button variant="soft" size="sm" onClick={() => setSortMode("name")}>
          Longest tenure first
          <X aria-hidden />
        </Button>
      )}
      {dirty && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X aria-hidden /> Clear filters
        </Button>
      )}
      <div className="ml-auto flex items-center rounded-md border border-border p-0.5">
        <Button
          variant={view === "cards" ? "secondary" : "ghost"}
          size="icon-sm"
          aria-label="Card grid view"
          aria-pressed={view === "cards"}
          onClick={() => setView("cards")}
        >
          <LayoutGrid />
        </Button>
        <Button
          variant={view === "table" ? "secondary" : "ghost"}
          size="icon-sm"
          aria-label="Table view"
          aria-pressed={view === "table"}
          onClick={() => setView("table")}
        >
          <List />
        </Button>
      </div>
    </>
  );

  /* ------------------------------------------------------------ columns */

  const columns = React.useMemo<ColumnDef<Employee, unknown>[]>(
    () => [
      {
        id: "employee",
        header: "Employee",
        accessorKey: "name",
        enableHiding: false,
        cell: ({ row }) => (
          <PersonCell
            name={row.original.name}
            code={row.original.code}
            href={`/employees/${row.original.code}`}
          />
        ),
      },
      { id: "designation", header: "Designation", accessorKey: "designation" },
      { id: "department", header: "Department", accessorFn: (e) => deptName(e.departmentId) },
      { id: "branch", header: "Branch", accessorFn: (e) => branchById(e.branchId)?.city ?? e.branchId },
      {
        id: "grade",
        header: "Grade",
        accessorFn: (e) => gradeById(e.gradeId)?.label ?? e.gradeId,
        cell: ({ getValue }) => <span className="whitespace-nowrap">{String(getValue())}</span>,
      },
      { id: "manager", header: "Manager", accessorFn: (e) => managerName(e.managerCode) },
      {
        id: "joiningDate",
        header: "Joined",
        accessorKey: "joiningDate",
        cell: ({ row }) => <span className="tnum">{fmtDate(row.original.joiningDate)}</span>,
      },
      {
        id: "tenure",
        header: "Tenure (yrs)",
        accessorFn: (e) => Math.round(tenureYears(e) * 10) / 10,
        cell: ({ getValue }) => <NumCell>{Number(getValue()).toFixed(1)}</NumCell>,
      },
      {
        id: "ctc",
        header: "Annual CTC",
        accessorKey: "ctc",
        cell: ({ row }) => <NumCell>{inr(row.original.ctc, { decimals: false })}</NumCell>,
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        enableHiding: false,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
    ],
    [managerName],
  );

  const clearButton = (
    <Button variant="outline" size="sm" onClick={clearFilters}>
      <X aria-hidden /> Clear all filters
    </Button>
  );

  /* -------------------------------------------------------------- render */

  return (
    <PageBody>
      <PageHeader
        title="Employee directory"
        description={`${stats.headcount} people across ${DEPARTMENTS.length} departments and ${BRANCHES.length} branches. Switch between the card grid and the table — filters carry across both.`}
        actions={
          <>
            <Gated menuKey="people.import" action="V">
              <Button size="sm" variant="outline" onClick={() => router.push("/employees/import")}>
                <Upload aria-hidden /> Bulk import
              </Button>
            </Gated>
            <Gated menuKey="people.directory" action="C">
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <UserPlus aria-hidden /> Add employee
              </Button>
            </Gated>
          </>
        }
      />

      {loading ? (
        <CardsSkeleton />
      ) : (
        <StatRow cols={4}>
          <StatTile
            label="Headcount"
            value={stats.headcount}
            hint="Active, probation, notice and on-leave"
            icon={UserSearch}
            href="/employees?status=all"
          />
          <StatTile
            label={`Joiners in ${format(TODAY, "MMM yyyy")}`}
            value={stats.joinersThisMonth}
            deltaValue={stats.joinerDeltaPct}
            deltaLabel="vs last month"
            goodDirection="up"
            icon={UserPlus}
            href="/employees?joined=this-month"
          />
          <StatTile
            label="On notice"
            value={stats.onNotice}
            tone="warning"
            hint="Serving notice, exit dates confirmed"
            icon={UserMinus}
            href="/employees?status=notice"
          />
          <StatTile
            label="Average tenure"
            value={`${stats.avgTenureYears.toFixed(1)} yrs`}
            hint="Longest-serving people first"
            icon={Building2}
            href="/employees?sort=tenure"
          />
        </StatRow>
      )}

      {loading ? (
        <TableSkeleton />
      ) : view === "table" ? (
        <DataTable<Employee>
          columns={columns}
          data={filtered}
          getRowId={(e) => e.code}
          searchKeys={["name", "code", "email", "designation"]}
          searchPlaceholder="Search name, code, email…"
          filters={filterRow}
          enableSelection
          pageSize={15}
          exportName="employee-directory"
          onRowClick={(e) => router.push(`/employees/${e.code}`)}
          emptyIcon={UserSearch}
          emptyTitle="No employee matches these filters"
          emptyDescription="Nobody in the directory fits every filter at once. Widen the department, branch or status filter and try again."
          emptyAction={clearButton}
          bulkActions={(rows, clear) => (
            <>
              <Gated menuKey="people.directory" action="E">
                <Button variant="outline" size="sm" onClick={() => setBulk({ kind: "department", rows, clear })}>
                  <Building2 aria-hidden /> Change department
                </Button>
              </Gated>
              <Gated menuKey="people.directory" action="E">
                <Button variant="outline" size="sm" onClick={() => setBulk({ kind: "manager", rows, clear })}>
                  <ArrowRightLeft aria-hidden /> Change manager
                </Button>
              </Gated>
              <Gated menuKey="people.directory" action="E">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    mockAction(`Exported ${rows.length} selected employee${rows.length === 1 ? "" : "s"}`, {
                      description:
                        "employee-selection.csv — 10 columns. In the demo the file is not written to disk.",
                    });
                    clear();
                  }}
                >
                  <Download aria-hidden /> Export selected
                </Button>
              </Gated>
              <Gated menuKey="people.directory" action="D">
                <Button variant="destructive" size="sm" onClick={() => setBulk({ kind: "deactivate", rows, clear })}>
                  <UserMinus aria-hidden /> Deactivate
                </Button>
              </Gated>
            </>
          )}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                value={cardQuery}
                onChange={(e) => setCardQuery(e.target.value)}
                placeholder="Search name, code, email…"
                aria-label="Search the employee directory"
                className="h-7 w-[200px] rounded-md border border-input bg-card pl-7 pr-6 text-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
              />
              {cardQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setCardQuery("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
            {filterRow}
          </div>

          {cardRows.length === 0 ? (
            <EmptyState
              icon={UserSearch}
              title="No employee matches these filters"
              description="Nobody in the directory fits every filter at once. Widen the department, branch or status filter and try again."
              action={clearButton}
            />
          ) : (
            <>
              <p className="tnum text-xs text-muted-foreground">
                Showing {Math.min(cardLimit, cardRows.length)} of {cardRows.length} people
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {cardRows.slice(0, cardLimit).map((e) => (
                  <EmployeeCard key={e.code} employee={e} managerName={managerName(e.managerCode)} />
                ))}
              </div>
              {cardLimit < cardRows.length && (
                <div className="flex justify-center">
                  <Button variant="outline" size="sm" onClick={() => setCardLimit((n) => n + CARD_PAGE)}>
                    Show {Math.min(CARD_PAGE, cardRows.length - cardLimit)} more
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <BarCompareChart
        title="Headcount by department"
        description="Active people per department, excluding exits. Click a bar to filter the directory to that department."
        data={headcountByDept}
        xKey="name"
        series={[{ key: "headcount", label: "Headcount" }]}
        horizontal
        height={300}
        onBarClick={(row) => {
          const hit = headcountByDept.find((d) => d.name === row.name);
          if (hit) setDept(hit.id);
        }}
        footnote={`${stats.headcount} people in total · ${stats.onProbation} on probation · ${stats.onNotice} serving notice.`}
      />

      <AddEmployeeDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        nextCode={nextCode}
        onAdd={addEmployee}
      />
      <ChangeDepartmentDialog target={bulk} onApply={applyDepartment} onDone={() => setBulk(null)} />
      <ChangeManagerDialog
        target={bulk}
        pool={managerPool}
        onApply={applyManager}
        onDone={() => setBulk(null)}
      />
      <ConfirmDialog
        open={bulk?.kind === "deactivate"}
        onOpenChange={(v) => !v && setBulk(null)}
        destructive
        title={`Deactivate ${bulk?.rows.length ?? 0} employee${(bulk?.rows.length ?? 0) === 1 ? "" : "s"}?`}
        description={
          <>
            Deactivation revokes application access immediately and stops leave accrual from today.
            Pending approvals are reassigned to the reporting manager. Payroll keeps the record for
            statutory reporting — this is not a delete.
            {bulk?.rows.length ? (
              <span className="mt-2 block text-foreground">
                {bulk.rows
                  .slice(0, 4)
                  .map((r) => r.name)
                  .join(", ")}
                {bulk.rows.length > 4 ? ` and ${bulk.rows.length - 4} more` : ""}.
              </span>
            ) : null}
          </>
        }
        confirmLabel="Deactivate"
        onConfirm={applyDeactivate}
      />
    </PageBody>
  );
}
