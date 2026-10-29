"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Gauge, Layers, Target, Users } from "lucide-react";
import { num } from "@/lib/format";
import { courseById } from "@/mock/growth";
import { DEPARTMENTS, deptName } from "@/mock/org";
import { SKILL_COURSE, SKILL_MATRIX } from "@/mock/engage";
import { mockAction } from "@/components/app-state";
import { AiSuggestionCard } from "@/components/ai";
import { BarCompareChart, HeatmapChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { MiniBar } from "@/components/engage/kit";
import { CardsSkeleton, ChartSkeleton, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { EmptyState } from "@/components/ui/primitives";
import { FilterSelect } from "@/components/ui/overlays";

interface GapRow {
  id: string;
  role: string;
  departmentId: string;
  headcount: number;
  skill: string;
  required: number;
  actual: number;
  gap: number;
}

const ROWS: GapRow[] = SKILL_MATRIX.flatMap((r) =>
  r.skills.map((s) => ({
    id: `${r.role}-${s.skill}`,
    role: r.role,
    departmentId: r.departmentId,
    headcount: r.headcount,
    skill: s.skill,
    required: s.required,
    actual: s.actual,
    gap: Math.round(Math.max(0, s.required - s.actual) * 10) / 10,
  })),
);

const DEPTS_WITH_ROLES = DEPARTMENTS.filter((d) => SKILL_MATRIX.some((r) => r.departmentId === d.id));

const BY_DEPT = DEPTS_WITH_ROLES.map((d) => {
  const rows = ROWS.filter((r) => r.departmentId === d.id);
  return {
    department: d.name,
    avgGap: Math.round((rows.reduce((a, r) => a + r.gap, 0) / Math.max(1, rows.length)) * 100) / 100,
    critical: rows.filter((r) => r.gap >= 1).length,
  };
});

export default function SkillGapPage() {
  const loading = useFakeLoad();
  const [dept, setDept] = React.useState("ENG");
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());
  const [accepted, setAccepted] = React.useState<Set<string>>(new Set());

  const rows = ROWS.filter((r) => dept === "all" || r.departmentId === dept);
  const roles = [...new Set(rows.map((r) => r.role))];
  const skills = [...new Set(rows.map((r) => r.skill))];
  const values = roles.map((role) => skills.map((skill) => rows.find((r) => r.role === role && r.skill === skill)?.gap ?? 0));
  const gaps = rows.filter((r) => r.gap >= 0.5).sort((a, b) => b.gap * b.headcount - a.gap * a.headcount);
  const suggestions = gaps.filter((g) => SKILL_COURSE[g.skill] && !dismissed.has(g.id)).slice(0, 6);
  const people = SKILL_MATRIX.filter((r) => dept === "all" || r.departmentId === dept).reduce((a, r) => a + r.headcount, 0);

  const columns = React.useMemo<ColumnDef<GapRow, unknown>[]>(
    () => [
      { accessorKey: "role", header: "Role", cell: ({ row }) => <span className="text-xs font-medium">{row.original.role}</span> },
      { id: "dept", accessorFn: (r) => deptName(r.departmentId), header: "Department", cell: ({ row }) => <MutedCell>{deptName(row.original.departmentId)}</MutedCell> },
      { accessorKey: "skill", header: "Skill", cell: ({ row }) => <span className="text-xs">{row.original.skill}</span> },
      { accessorKey: "required", header: "Required", cell: ({ row }) => <NumCell>{row.original.required}</NumCell> },
      { accessorKey: "actual", header: "Actual (avg)", cell: ({ row }) => <MiniBar value={row.original.actual} max={5} label={row.original.actual.toFixed(1)} tone={row.original.gap >= 1 ? "danger" : row.original.gap > 0 ? "warning" : "success"} /> },
      { accessorKey: "gap", header: "Gap", cell: ({ row }) => <NumCell>{row.original.gap ? `−${row.original.gap.toFixed(1)}` : "None"}</NumCell> },
      { accessorKey: "headcount", header: "People", cell: ({ row }) => <NumCell>{row.original.headcount}</NumCell> },
    ],
    [],
  );

  return (
    <PageBody>
      <PageHeader
        title="Skill Gap"
        description="Required proficiency for each role against the average assessed proficiency (1–5, from manager assessments in the mid-year review). Gaps feed course recommendations."
        actions={
          <FilterSelect
            label="Department"
            value={dept}
            onValueChange={setDept}
            allLabel="All departments"
            width="w-[200px]"
            options={DEPTS_WITH_ROLES.map((d) => ({ value: d.id, label: d.name }))}
          />
        }
      />

      {loading ? (
        <>
          <CardsSkeleton />
          <ChartSkeleton />
          <TableSkeleton />
        </>
      ) : (
        <>
          <StatRow>
            <StatTile label="Roles profiled" value={num(roles.length)} icon={Layers} hint={`${num(skills.length)} skills tracked`} />
            <StatTile label="People covered" value={num(people)} icon={Users} />
            <StatTile label="Gaps of a full level or more" value={num(rows.filter((r) => r.gap >= 1).length)} icon={Target} tone={rows.some((r) => r.gap >= 1) ? "warning" : "good"} />
            <StatTile label="Average gap" value={(rows.reduce((a, r) => a + r.gap, 0) / Math.max(1, rows.length)).toFixed(2)} icon={Gauge} hint="Levels below required" />
          </StatRow>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <HeatmapChart
              className="xl:col-span-2"
              title="Skill matrix — gap to required level"
              description="Darker cells are bigger gaps. 0 means the role meets or exceeds the requirement."
              rows={roles}
              columns={skills}
              values={values}
              valueFormat={(v) => v.toFixed(1)}
              rowLabelWidth={170}
              scaleLabel="Levels below required"
            />
            <BarCompareChart
              title="Gaps by department"
              description="Average gap across each department's role skills"
              data={BY_DEPT}
              xKey="department"
              series={[{ key: "avgGap", label: "Average gap (levels)" }]}
              valueFormat={(v) => v.toFixed(2)}
              horizontal
              height={260}
            />
          </div>

          <Section title="Recommended courses" description="One suggestion per gap, ranked by gap size × people affected. Accepting adds the course to each person's learning plan as a recommendation — nobody is enrolled automatically.">
            {suggestions.length === 0 ? (
              <EmptyState icon={Target} title="No open gaps to recommend for" description="Every remaining gap has been actioned or dismissed." />
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {suggestions.map((g) => {
                  const rec = SKILL_COURSE[g.skill];
                  const course = courseById(rec.courseId);
                  const done = accepted.has(g.id);
                  return (
                    <AiSuggestionCard
                      key={g.id}
                      title={`${g.skill} for ${g.role}s`}
                      confidence={rec.confidence}
                      body={
                        <>
                          Gap of <span className="tnum font-medium">{g.gap.toFixed(1)}</span> levels (required {g.required}, average {g.actual.toFixed(1)}) across{" "}
                          <span className="tnum font-medium">{g.headcount}</span> people. Recommended:{" "}
                          <Link href={`/learning/courses/${rec.courseId}`} className="font-medium text-primary hover:underline">
                            {course?.title}
                          </Link>
                          {course ? ` · ${course.provider} · ${course.format}` : ""}.
                          {done && <span className="mt-1 block font-medium text-success-fg">Recommended to {g.headcount} people.</span>}
                        </>
                      }
                      acceptLabel={done ? "Recommended" : `Recommend to ${g.headcount}`}
                      onAccept={
                        done
                          ? undefined
                          : () => {
                              setAccepted((s) => new Set(s).add(g.id));
                              mockAction(`Course recommended to ${g.headcount} people`, {
                                description: `${course?.title} now appears in the learning plan of every ${g.role} in ${deptName(g.departmentId)}.`,
                              });
                            }
                      }
                      onDismiss={() => setDismissed((s) => new Set(s).add(g.id))}
                    />
                  );
                })}
              </div>
            )}
          </Section>

          <Section title="Required vs actual" description="Every role and skill in scope">
            <DataTable
              columns={columns}
              data={rows}
              searchKeys={["role", "skill"]}
              searchPlaceholder="Search role or skill…"
              getRowId={(r) => r.id}
              rowTone={(r) => (r.gap >= 1 ? "danger" : undefined)}
              exportName="skill-gap"
              emptyIcon={Layers}
              emptyTitle="No roles profiled here"
              emptyDescription="Pick a department with a skill profile."
              dense
            />
          </Section>
        </>
      )}
    </PageBody>
  );
}
