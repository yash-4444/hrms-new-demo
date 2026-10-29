"use client";

import * as React from "react";
import Link from "next/link";
import {
  Briefcase,
  Building2,
  Camera,
  CalendarDays,
  GraduationCap,
  HeartHandshake,
  Mail,
  MapPin,
  PencilLine,
  Phone,
  Star,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDateTime, fmtMonth, inr } from "@/lib/format";
import { DEMO_NOW, branchById, deptName, gradeById } from "@/mock/org";
import { employeeByCode, employeeName } from "@/mock/employees";
import {
  maskId,
  myChangeRequests,
  profileExtras,
  type ApprovalChainStep,
  type ProfileField,
} from "@/mock/self-service";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, Badge, EmptyState, Hint, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { DetailList, DetailRow } from "@/components/people/person-cell";
import { CardsSkeleton, Gated, PageBody, PageHeader, Section, useFakeLoad } from "@/components/shell/page";
import { ApprovalChainTimeline } from "@/components/self-service/bits";
import { RequestChangeDialog } from "@/components/self-service/request-change";

interface MyRequest {
  id: string;
  field: string;
  oldValue: string;
  newValue: string;
  document: string | null;
  at: string;
  chain: ApprovalChainStep[];
}

export default function MyProfilePage() {
  const { persona } = useApp();
  return <MyProfile key={persona.employeeId} />;
}

function MyProfile() {
  const loading = useFakeLoad();
  const { persona } = useApp();
  const emp = employeeByCode(persona.employeeId);
  const extras = React.useMemo(() => (emp ? profileExtras(emp) : null), [emp]);
  const [photo, setPhoto] = React.useState<string | undefined>(undefined);
  const [changeOpen, setChangeOpen] = React.useState(false);
  const [changeField, setChangeField] = React.useState<ProfileField | null>(null);
  const [requests, setRequests] = React.useState<MyRequest[]>(() =>
    myChangeRequests(persona.employeeId).map((p) => ({
      id: p.id,
      field: p.field,
      oldValue: p.oldValue,
      newValue: p.newValue,
      document: p.document,
      at: p.requestedAt,
      chain: [
        { step: "Requested", approver: persona.name, role: "Employee", status: "approved", at: p.requestedAt, enteredAt: p.requestedAt, slaHours: null },
        { step: "HR verification", approver: "HR Operations", role: "HR Operations", status: "pending", at: null, enteredAt: p.requestedAt, slaHours: 72 },
        { step: "Record updated", approver: "HRMS", role: "System", status: "waiting", at: null, enteredAt: null, slaHours: null },
      ],
    })),
  );
  const photoRef = React.useRef<HTMLInputElement>(null);

  if (loading || !emp || !extras) {
    return (
      <PageBody>
        <PageHeader title="My profile" description="Loading your record…" />
        <CardsSkeleton count={4} height={120} />
      </PageBody>
    );
  }

  const branch = branchById(emp.branchId);
  const grade = gradeById(emp.gradeId);
  const tenureYears = (new Date(DEMO_NOW).getTime() - new Date(emp.joiningDate).getTime()) / (365.25 * 86400000);

  const current: Record<ProfileField, string> = {
    "Current address": extras.currentAddress,
    "Emergency contact": `${extras.emergencyName} · ${extras.emergencyPhone}`,
    "Personal email": extras.personalEmail,
    "Mobile number": emp.phone,
    "Bank account": `${extras.bankName} ···· ${emp.bankAccountLast4}`,
    "Marital status": extras.maritalStatus,
    "Legal name": emp.name,
  };

  const openChange = (f: ProfileField | null) => {
    setChangeField(f);
    setChangeOpen(true);
  };

  const editBtn = (f: ProfileField) => (
    <Gated menuKey="my.profile" action="E">
      <Button size="sm" variant="ghost" onClick={() => openChange(f)}>
        <PencilLine /> Request change
      </Button>
    </Gated>
  );

  return (
    <PageBody>
      <PageHeader
        title="My profile"
        description="Your employee record as HR sees it. Changes go through a quick approval so payroll and statutory records stay correct."
        actions={
          <Gated menuKey="my.profile" action="E">
            <Button size="sm" onClick={() => openChange(null)}>
              <PencilLine /> Request a change
            </Button>
          </Gated>
        }
      />

      {/* ------------------------------------------------------- header */}
      <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <div className="relative w-fit">
          <Avatar name={emp.name} src={photo} size={72} />
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="Upload a profile photo"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const reader = new FileReader();
              reader.onload = () => {
                setPhoto(String(reader.result));
                mockAction("Profile photo updated", { description: `${f.name} · visible in the directory and org chart.` });
              };
              reader.readAsDataURL(f);
            }}
          />
          <Hint text="Change photo">
            <button
              type="button"
              onClick={() => photoRef.current?.click()}
              aria-label="Change profile photo"
              className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-xs hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Camera className="size-3.5" />
            </button>
          </Hint>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight">{emp.name}</h2>
            <StatusBadge status={emp.status} />
            <Badge variant="muted" className="font-mono">
              {emp.code}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {emp.designation} · {deptName(emp.departmentId)} · {grade?.label ?? emp.gradeId}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Mail className="size-3" aria-hidden /> {emp.email}
            </span>
            <span className="flex items-center gap-1">
              <Phone className="size-3" aria-hidden /> {emp.phone}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="size-3" aria-hidden /> {branch?.name ?? emp.location}
            </span>
            <span className="flex items-center gap-1">
              <CalendarDays className="size-3" aria-hidden /> Joined {fmtDate(emp.joiningDate)} · {tenureYears.toFixed(1)} yrs
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 sm:text-right">
          {[
            ["Manager", employeeName(emp.managerCode) || "—"],
            ["Work mode", emp.workMode],
            ["Type", emp.employmentType],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</p>
              <p className="mt-0.5 text-xs font-medium">{v}</p>
            </div>
          ))}
        </div>
      </Card>

      {requests.length > 0 && (
        <Section title="My change requests" description="Pending changes are applied once HR verifies them.">
          <div className="grid gap-4 lg:grid-cols-2">
            {requests.map((r) => (
              <div key={r.id} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold">{r.field}</p>
                  <StatusBadge status="pending" />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="line-through">{r.oldValue}</span> → <span className="text-foreground">{r.newValue}</span>
                </p>
                {r.document && <p className="mt-1 text-[11px] text-muted-foreground">Proof: {r.document}</p>}
                <div className="mt-3">
                  <ApprovalChainTimeline chain={r.chain} />
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* --------------------------------------------------------- tabs */}
      <Tabs defaultValue="personal">
        <TabsList className="flex-wrap">
          <TabsTrigger value="personal"><UserRound className="size-3.5" aria-hidden /> Personal</TabsTrigger>
          <TabsTrigger value="contact"><Phone className="size-3.5" aria-hidden /> Contact</TabsTrigger>
          <TabsTrigger value="job"><Briefcase className="size-3.5" aria-hidden /> Job</TabsTrigger>
          <TabsTrigger value="bank"><Building2 className="size-3.5" aria-hidden /> Bank</TabsTrigger>
          <TabsTrigger value="family"><HeartHandshake className="size-3.5" aria-hidden /> Family &amp; nominees</TabsTrigger>
          <TabsTrigger value="education"><GraduationCap className="size-3.5" aria-hidden /> Education</TabsTrigger>
          <TabsTrigger value="experience"><Briefcase className="size-3.5" aria-hidden /> Experience</TabsTrigger>
          <TabsTrigger value="skills"><Star className="size-3.5" aria-hidden /> Skills</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-3">
          <Section title="Personal details" actions={editBtn("Legal name")}>
            <DetailList className="grid sm:grid-cols-2 sm:gap-x-8 sm:divide-y-0">
              <DetailRow label="Legal name">{emp.name}</DetailRow>
              <DetailRow label="Date of birth">{fmtDate(emp.dob)}</DetailRow>
              <DetailRow label="Gender">{emp.gender}</DetailRow>
              <DetailRow label="Marital status">{extras.maritalStatus}</DetailRow>
              <DetailRow label="Blood group">{extras.bloodGroup}</DetailRow>
              <DetailRow label="Nationality">{extras.nationality}</DetailRow>
              <DetailRow label="PAN">{maskId(emp.pan)}</DetailRow>
              <DetailRow label="UAN">{maskId(emp.uan)}</DetailRow>
            </DetailList>
          </Section>
        </TabsContent>

        <TabsContent value="contact" className="mt-3">
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Contact" actions={editBtn("Mobile number")}>
              <DetailList>
                <DetailRow label="Work email">{emp.email}</DetailRow>
                <DetailRow label="Personal email">{extras.personalEmail}</DetailRow>
                <DetailRow label="Mobile">{emp.phone}</DetailRow>
                <DetailRow label="Current address">{extras.currentAddress}</DetailRow>
                <DetailRow label="Permanent address">{extras.permanentAddress}</DetailRow>
              </DetailList>
            </Section>
            <Section title="Emergency contact" actions={editBtn("Emergency contact")}>
              <DetailList>
                <DetailRow label="Name">{extras.emergencyName}</DetailRow>
                <DetailRow label="Relation">{extras.emergencyRelation}</DetailRow>
                <DetailRow label="Phone">{extras.emergencyPhone}</DetailRow>
              </DetailList>
            </Section>
          </div>
        </TabsContent>

        <TabsContent value="job" className="mt-3">
          <Section title="Job & organisation" description="Maintained by HR — raise a helpdesk ticket if something is wrong.">
            <DetailList className="grid sm:grid-cols-2 sm:gap-x-8 sm:divide-y-0">
              <DetailRow label="Designation">{emp.designation}</DetailRow>
              <DetailRow label="Department">{deptName(emp.departmentId)}</DetailRow>
              <DetailRow label="Grade">{grade?.label ?? emp.gradeId}</DetailRow>
              <DetailRow label="Reporting manager">{employeeName(emp.managerCode) || "—"}</DetailRow>
              <DetailRow label="Branch">{branch?.name ?? "—"}</DetailRow>
              <DetailRow label="Time zone">{branch?.timezone ?? "—"}</DetailRow>
              <DetailRow label="Date of joining">{fmtDate(emp.joiningDate)}</DetailRow>
              <DetailRow label="Confirmation">{emp.confirmationDate ? fmtDate(emp.confirmationDate) : "On probation"}</DetailRow>
              <DetailRow label="Employment type">{emp.employmentType}</DetailRow>
              <DetailRow label="Annual CTC">{inr(emp.ctc)}</DetailRow>
            </DetailList>
          </Section>
        </TabsContent>

        <TabsContent value="bank" className="mt-3">
          <Section title="Salary account" description="Account numbers are masked everywhere, including for HR." actions={editBtn("Bank account")}>
            <DetailList className="max-w-xl">
              <DetailRow label="Bank">{extras.bankName}</DetailRow>
              <DetailRow label="Account number">
                <span className="font-mono">•••• •••• {emp.bankAccountLast4}</span>
              </DetailRow>
              <DetailRow label="IFSC">{extras.ifsc}</DetailRow>
              <DetailRow label="Verification">
                <StatusBadge status={emp.hasBankDetails ? "approved" : "pending"} label={emp.hasBankDetails ? "Penny-drop verified" : "Not verified"} />
              </DetailRow>
            </DetailList>
          </Section>
        </TabsContent>

        <TabsContent value="family" className="mt-3">
          <Section title="Family & nominees" description="Nominee shares apply to PF, gratuity and group life insurance." actions={editBtn("Marital status")}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Name</th>
                    <th className="py-2 pr-3 font-medium">Relation</th>
                    <th className="py-2 pr-3 font-medium">Date of birth</th>
                    <th className="py-2 pr-3 text-right font-medium">Nominee share</th>
                  </tr>
                </thead>
                <tbody>
                  {extras.family.map((f) => (
                    <tr key={f.name} className="border-b border-border last:border-0">
                      <td className="py-2 pr-3 font-medium">{f.name}</td>
                      <td className="py-2 pr-3">{f.relation}</td>
                      <td className="tnum py-2 pr-3">{fmtDate(f.dob)}</td>
                      <td className="tnum py-2 pr-3 text-right">{f.nominee ? `${f.nomineeShare}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Total nominated: {extras.family.reduce((a, f) => a + f.nomineeShare, 0)}%
            </p>
          </Section>
        </TabsContent>

        <TabsContent value="education" className="mt-3">
          <Section title="Education">
            <ul className="flex flex-col divide-y divide-border">
              {extras.education.map((e) => (
                <li key={e.degree} className="flex items-start justify-between gap-3 py-2">
                  <div>
                    <p className="text-xs font-medium">{e.degree}</p>
                    <p className="text-[11px] text-muted-foreground">{e.institution}</p>
                  </div>
                  <div className="text-right">
                    <p className="tnum text-xs">{e.year}</p>
                    <p className="text-[11px] text-muted-foreground">{e.grade}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        </TabsContent>

        <TabsContent value="experience" className="mt-3">
          <Section title="Experience">
            <ol className="flex flex-col gap-3">
              <li className="flex gap-3">
                <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
                <div>
                  <p className="text-xs font-medium">{emp.designation} · Stellar Technologies</p>
                  <p className="text-[11px] text-muted-foreground">{fmtMonth(emp.joiningDate)} – Present</p>
                </div>
              </li>
              {extras.experience.map((x) => (
                <li key={`${x.company}-${x.from}`} className="flex gap-3">
                  <span className="mt-1 size-2 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden />
                  <div>
                    <p className="text-xs font-medium">
                      {x.title} · {x.company}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {fmtMonth(`${x.from}-01`)} – {fmtMonth(`${x.to}-01`)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            {extras.experience.length === 0 && (
              <p className="mt-3 text-[11px] text-muted-foreground">Stellar is your first employer — no prior experience on record.</p>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="skills" className="mt-3">
          <Section title="Skills" description="Self-rated, endorsed by colleagues. Feeds learning recommendations and internal mobility.">
            {extras.skillLevels.length === 0 ? (
              <EmptyState icon={Star} title="No skills added yet" description="Add skills to get matched to courses and open roles." />
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {extras.skillLevels.map((s) => (
                  <li key={s.skill} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                    <div>
                      <p className="text-xs font-medium">{s.skill}</p>
                      <p className="text-[11px] text-muted-foreground">Endorsed by {s.endorsedBy}</p>
                    </div>
                    <span className="flex gap-0.5" aria-label={`Level ${s.level} of 5`}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <span key={i} className={cn("h-1.5 w-4 rounded-full", i <= s.level ? "bg-primary" : "bg-muted")} />
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </TabsContent>
      </Tabs>

      <p className="text-[11px] text-muted-foreground">
        Looking for your documents or payslips?{" "}
        <Link href="/me/documents" className="text-primary hover:underline">
          My documents
        </Link>{" "}
        ·{" "}
        <Link href="/payslips" className="text-primary hover:underline">
          Payslips
        </Link>
      </p>

      <RequestChangeDialog
        open={changeOpen}
        initialField={changeField}
        currentValues={current}
        onClose={() => setChangeOpen(false)}
        onSubmit={(v) => {
          const at = DEMO_NOW;
          setRequests((rs) => [
            {
              id: `pc-new-${rs.length + 1}`,
              field: v.field,
              oldValue: v.oldValue,
              newValue: v.newValue,
              document: v.document || null,
              at,
              chain: [
                { step: "Requested", approver: persona.name, role: "Employee", status: "approved", at, enteredAt: at, slaHours: null },
                { step: v.field === "Bank account" ? "Penny-drop verification" : "HR verification", approver: v.field === "Bank account" ? "Payroll Admin" : "HR Operations", role: "Verifier", status: "pending", at: null, enteredAt: at, slaHours: 72 },
                { step: "Record updated", approver: "HRMS", role: "System", status: "waiting", at: null, enteredAt: null, slaHours: null },
              ],
            },
            ...rs,
          ]);
          setChangeOpen(false);
          mockAction(`Change request submitted — ${v.field}`, {
            description: `Routed to ${v.field === "Bank account" ? "Payroll" : "HR Operations"} · decision due by ${fmtDateTime("2026-09-19T14:35:00")}.`,
          });
        }}
      />
    </PageBody>
  );
}
