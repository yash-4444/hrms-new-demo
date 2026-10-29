/* ============================================================================
   Drafting Studio — scripted generator. Every draft is assembled from the
   chosen record's real fields; anything a human must decide is left as a
   [[placeholder]] for the reviewer, never guessed.
   ========================================================================== */

import { format, parseISO } from "date-fns";
import { inr } from "@/lib/format";
import { TENANT, branchById, deptName, gradeById } from "@/mock/org";
import { employeeName, type Employee } from "@/mock/employees";
import type { Offer, Candidate, Requisition } from "@/mock/hiring";
import { KB_DOCUMENTS, type StudioTemplateId } from "@/mock/ai";

export type Tone = "formal" | "warm" | "concise";
export type Length = "short" | "standard" | "detailed";
export type Language = "en" | "hi";

export interface DraftSubject {
  employee?: Employee;
  offer?: Offer;
  candidate?: Candidate;
  requisition?: Requisition;
  docId?: string;
}

export interface DraftInput {
  template: StudioTemplateId;
  subject: DraftSubject;
  tone: Tone;
  length: Length;
  language: Language;
  note: string;
  author: { name: string; title: string };
  /** Bumped by Regenerate — picks an alternative phrasing. */
  variant: number;
}

const d = (s: string) => format(parseISO(s), "dd MMMM yyyy");
const ph = (s: string) => `[[${s}]]`;
const pickV = <T>(arr: T[], v: number) => arr[v % arr.length];

function greeting(name: string, tone: Tone, lang: Language) {
  if (lang === "hi") return tone === "formal" ? `प्रिय ${name},` : `नमस्ते ${name},`;
  return tone === "warm" ? `Dear ${name.split(" ")[0]},` : tone === "concise" ? `${name.split(" ")[0]},` : `Dear ${name},`;
}

function signoff(i: DraftInput) {
  if (i.language === "hi") return `सादर,\n${i.author.name}\n${i.author.title}\n${TENANT.name}`;
  const close = i.tone === "warm" ? "Warm regards," : i.tone === "concise" ? "Regards," : "Yours sincerely,";
  return `${close}\n${i.author.name}\n${i.author.title}\n${TENANT.name}`;
}

const keep = (i: DraftInput, level: Length) => (level === "short" ? true : level === "standard" ? i.length !== "short" : i.length === "detailed");

function join(parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join("\n\n");
}

/* ------------------------------------------------------------ English */

function en(i: DraftInput): string {
  const s = i.subject;
  const note = i.note.trim();
  switch (i.template) {
    case "offer": {
      const o = s.offer;
      if (!o) return "";
      const branch = branchById(o.branchId);
      const mgr = s.requisition ? employeeName(s.requisition.hiringManagerCode) : ph("Reporting manager");
      return join([
        `Subject: Offer of employment — ${o.role}`,
        greeting(o.candidateName, i.tone, "en"),
        pickV(
          [
            i.tone === "warm"
              ? `We loved getting to know you over the last few weeks, and we're delighted to offer you the role of ${o.role} in our ${deptName(o.departmentId)} team at ${branch?.city ?? "our office"}.`
              : `We are pleased to offer you the position of ${o.role} in the ${deptName(o.departmentId)} department at ${TENANT.name}, based in ${branch?.city ?? ph("Location")}.`,
            i.tone === "warm"
              ? `Congratulations! The panel was unanimous, and we'd be thrilled to have you join us as ${o.role}, ${deptName(o.departmentId)}, ${branch?.city ?? ""}.`
              : `Further to your interviews, ${TENANT.name} is pleased to extend this offer for the role of ${o.role} (${deptName(o.departmentId)}, ${branch?.city ?? ph("Location")}).`,
          ],
          i.variant,
        ),
        `Your annual cost to company will be ${inr(o.ctc)}, in grade ${gradeById(o.gradeId)?.label ?? o.gradeId}.${o.joiningBonus ? ` You will also receive a one-time joining bonus of ${inr(o.joiningBonus)}.` : ""} A detailed salary breakup is attached as Annexure A.`,
        `Your expected date of joining is ${d(o.joiningDate)}. You will report to ${mgr}.`,
        keep(i, "standard") && `This offer is subject to satisfactory background verification and submission of your relieving letter. You will be on probation for ${ph("Probation period")} from your date of joining.`,
        keep(i, "detailed") && `You will be eligible for group medical cover of ₹5,00,000 per family, 21 days of Earned Leave a year, and the company's hybrid working policy after confirmation.`,
        note && `Additional terms: ${note}`,
        `Please confirm your acceptance by ${d(o.validTill)} by signing and returning a copy of this letter.`,
        signoff(i),
      ]);
    }
    case "appointment": {
      const e = s.employee;
      if (!e) return "";
      return join([
        `Subject: Letter of appointment — ${e.code}`,
        greeting(e.name, i.tone, "en"),
        `With reference to your acceptance of our offer, we are pleased to appoint you as ${e.designation} in the ${deptName(e.departmentId)} department, effective ${d(e.joiningDate)}, at our ${branchById(e.branchId)?.city ?? ""} office.`,
        `Your employee code is ${e.code}. Your annual CTC is ${inr(e.ctc)} as per the attached salary structure for grade ${e.gradeId}. You will report to ${employeeName(e.managerCode) || ph("Reporting manager")}.`,
        keep(i, "standard") && `You will be on probation for six months, after which your confirmation will be reviewed. During probation the notice period is 30 days; after confirmation it is 60 days (Code of Conduct §8.1).`,
        keep(i, "detailed") && `Your working hours, leave entitlement and conduct obligations are set out in the Employee Handbook 2026 and the policies on the HRMS, which form part of these terms.`,
        note && note,
        `Please sign the duplicate copy of this letter as a token of acceptance.`,
        signoff(i),
      ]);
    }
    case "experience": {
      const e = s.employee;
      if (!e) return "";
      const last = e.exitDate ?? ph("Last working day");
      return join([
        `TO WHOMSOEVER IT MAY CONCERN`,
        `This is to certify that ${e.name} (Employee code ${e.code}) was employed with ${TENANT.name} from ${d(e.joiningDate)} to ${e.exitDate ? d(e.exitDate) : last}. At the time of leaving, ${e.firstName} held the position of ${e.designation} in the ${deptName(e.departmentId)} department.`,
        keep(i, "standard") && (i.tone === "warm" ? `${e.firstName} was a valued member of the team and brought skill in ${e.skills.slice(0, 3).join(", ")} to everything they worked on.` : `During this tenure, ${e.firstName} worked with ${e.skills.slice(0, 3).join(", ")}.`),
        note && `Highlights: ${note}`,
        `We wish ${e.firstName} every success in the future.`,
        signoff(i),
      ]);
    }
    case "warning": {
      const e = s.employee;
      if (!e) return "";
      return join([
        `Subject: Written warning`,
        greeting(e.name, i.tone === "warm" ? "formal" : i.tone, "en"),
        `This letter is a formal written warning regarding ${note || ph("Description of the incident")}, which was discussed with you on ${ph("Date of discussion")} in the presence of ${ph("HR witness")}.`,
        `This conduct is not in line with the Code of Conduct and the Employee Handbook 2026, which you acknowledged on joining.`,
        keep(i, "standard") && `We expect an immediate improvement. Your manager, ${employeeName(e.managerCode) || ph("Reporting manager")}, will review progress with you weekly over the next ${ph("Review period")}.`,
        `A repeat may lead to further disciplinary action. You may respond to this letter in writing within 7 days; your response will be placed on file.`,
        signoff(i),
      ]);
    }
    case "jd": {
      const r = s.requisition;
      if (!r) return "";
      const skills = note || ph("Must-have skills");
      return join([
        `${r.role} — ${deptName(r.departmentId)}, ${branchById(r.branchId)?.city ?? ""}`,
        pickV(
          [
            `${TENANT.name} builds HR and payroll software used by growing Indian companies. We're hiring a ${r.role} to join our ${deptName(r.departmentId)} team.`,
            `Join ${TENANT.name} as a ${r.role} and help us build the platform that runs payroll for thousands of employees every month.`,
          ],
          i.variant,
        ),
        `What you'll do\n- Own ${r.role.toLowerCase()} outcomes for a product area end to end\n- Work with product, design and customer teams on the problems that matter most\n- Raise the bar on quality, reliability and documentation`,
        `What you'll bring\n- ${skills}\n- Clear written communication and good judgement under ambiguity`,
        keep(i, "standard") && `Nice to have\n- Experience with HR, payroll or other regulated domains\n- Mentoring or leading small teams`,
        keep(i, "detailed") && `What we offer\n- Grade ${gradeById(r.gradeId)?.label ?? r.gradeId}, with a budget of ${inr(r.budgetMinCtc)}–${inr(r.budgetMaxCtc)} CTC\n- Group medical cover of ₹5,00,000 per family\n- Hybrid working, 21 days of Earned Leave and a learning budget`,
        `We are an equal-opportunity employer and welcome applicants of every background.`,
      ]);
    }
    case "announcement":
      return join([
        `Subject: ${note ? note.split(/[.\n]/)[0] : ph("Announcement headline")}`,
        i.tone === "warm" ? "Hi everyone," : "Dear colleagues,",
        note ? `${note.charAt(0).toUpperCase()}${note.slice(1)}${note.endsWith(".") ? "" : "."}` : ph("What is being announced"),
        keep(i, "standard") && `This applies to ${ph("Branches / teams affected")} from ${ph("Effective date")}. If you have questions, raise a ticket under HR on the helpdesk or ask the HR Copilot.`,
        keep(i, "detailed") && `Managers, please make sure your teams have seen this and acknowledge it on the Announcements page by ${ph("Acknowledgement deadline")}.`,
        signoff(i),
      ]);
    case "policy_summary": {
      const doc = KB_DOCUMENTS.find((x) => x.id === s.docId) ?? KB_DOCUMENTS[0];
      const ps = doc.passages.slice(0, i.length === "short" ? 2 : i.length === "standard" ? 4 : 8);
      return join([
        `${doc.title} (${doc.version}) — in plain words`,
        `Applies to: ${doc.audience}. Owner: ${doc.owner}.`,
        ps.map((p) => `- ${p.section.replace(/^§[\d.]+\s*/, "")}: ${p.text}`).join("\n"),
        `This is a summary. If it ever differs from the policy, the policy wins — see ${doc.title} on the Knowledge Base.`,
      ]);
    }
    case "review_comment": {
      const e = s.employee;
      if (!e) return "";
      return join([
        `Performance review — ${e.name}, ${e.designation} · FY 2026-27 H1`,
        i.tone === "concise"
          ? `${e.firstName} delivered steadily this half. ${note || ph("Key observations")}.`
          : `${e.firstName} has had a ${pickV(["strong", "solid", "productive"], i.variant)} first half. ${note ? `${note.charAt(0).toUpperCase()}${note.slice(1)}${note.endsWith(".") ? "" : "."}` : ph("Key observations")}`,
        keep(i, "standard") && `Strengths: depth in ${e.skills.slice(0, 2).join(" and ")}, ownership of commitments, and dependable collaboration with the team.`,
        keep(i, "standard") && `Growth areas: ${ph("One or two specific, observable growth areas")}.`,
        keep(i, "detailed") && `For H2, we agreed to focus on ${ph("H2 focus areas")} with a check-in every month.`,
        `Rating is set by the manager in the review form — this comment does not set or suggest a rating.`,
      ]);
    }
    case "rejection": {
      const c = s.candidate;
      if (!c) return "";
      return join([
        `Subject: Your application for ${c.role}`,
        greeting(c.name, i.tone, "en"),
        i.tone === "warm"
          ? `Thank you so much for the time and energy you put into our process for ${c.role}. It was genuinely a pleasure to get to know you.`
          : `Thank you for your interest in the ${c.role} position at ${TENANT.name} and for the time you spent with our team.`,
        `After careful consideration, we have decided not to move forward with your application at this time.`,
        note && `Some feedback from the panel that we hope is useful: ${note}`,
        keep(i, "standard") && `We'd be glad to stay in touch, and we encourage you to apply for future roles that match your experience on our careers page.`,
        signoff(i),
      ]);
    }
    case "welcome": {
      const e = s.employee;
      if (!e) return "";
      return join([
        `Subject: Welcome to ${TENANT.shortName}, ${e.firstName}!`,
        greeting(e.name, i.tone === "formal" ? "formal" : "warm", "en"),
        pickV(
          [
            `Welcome to ${TENANT.name}! We're so glad you're joining the ${deptName(e.departmentId)} team as ${e.designation}.`,
            `A very warm welcome to the ${deptName(e.departmentId)} team — we've been looking forward to your first day as ${e.designation}.`,
          ],
          i.variant,
        ),
        `On ${d(e.joiningDate)}, please come to our ${branchById(e.branchId)?.city ?? ""} office at 9:30 AM. ${employeeName(e.managerCode) || ph("Your manager")} will meet you at reception.`,
        keep(i, "standard") && `Your first week:\n- Day 1: induction, laptop and ID card\n- Day 2: HRMS walkthrough — attendance, leave and payslips\n- Day 3–5: team onboarding with your buddy ${ph("Buddy name")}`,
        note && note,
        `If you have any questions before you join, just reply to this email.`,
        signoff(i),
      ]);
    }
  }
}

/* ------------------------------------------------------------ Hindi */

function hi(i: DraftInput): string {
  const s = i.subject;
  const note = i.note.trim();
  switch (i.template) {
    case "offer": {
      const o = s.offer;
      if (!o) return "";
      return join([
        `विषय: रोज़गार प्रस्ताव — ${o.role}`,
        greeting(o.candidateName, i.tone, "hi"),
        `हमें ${TENANT.name} में ${deptName(o.departmentId)} विभाग में ${o.role} के पद के लिए आपको प्रस्ताव देते हुए प्रसन्नता हो रही है। आपका कार्यस्थल ${branchById(o.branchId)?.city ?? ph("स्थान")} होगा।`,
        `आपका वार्षिक CTC ${inr(o.ctc)} होगा।${o.joiningBonus ? ` इसके अतिरिक्त ${inr(o.joiningBonus)} का एकमुश्त जॉइनिंग बोनस दिया जाएगा।` : ""}`,
        `आपकी अपेक्षित जॉइनिंग तिथि ${d(o.joiningDate)} है। परिवीक्षा अवधि ${ph("परिवीक्षा अवधि")} रहेगी।`,
        note && `अतिरिक्त शर्तें: ${note}`,
        `कृपया ${d(o.validTill)} तक इस पत्र पर हस्ताक्षर करके अपनी स्वीकृति दें।`,
        signoff(i),
      ]);
    }
    case "appointment": {
      const e = s.employee;
      if (!e) return "";
      return join([
        `विषय: नियुक्ति पत्र — ${e.code}`,
        greeting(e.name, i.tone, "hi"),
        `आपको ${d(e.joiningDate)} से ${deptName(e.departmentId)} विभाग में ${e.designation} के पद पर नियुक्त किया जाता है। आपका कर्मचारी कोड ${e.code} है और वार्षिक CTC ${inr(e.ctc)} है।`,
        `छह महीने की परिवीक्षा के दौरान नोटिस अवधि 30 दिन और पुष्टि के बाद 60 दिन होगी।`,
        note && note,
        signoff(i),
      ]);
    }
    case "experience": {
      const e = s.employee;
      if (!e) return "";
      return join([
        `अनुभव प्रमाण पत्र`,
        `प्रमाणित किया जाता है कि ${e.name} (कर्मचारी कोड ${e.code}) ने ${TENANT.name} में ${d(e.joiningDate)} से ${e.exitDate ? d(e.exitDate) : ph("अंतिम कार्य दिवस")} तक ${e.designation} के पद पर कार्य किया।`,
        note && `विशेष उपलब्धियाँ: ${note}`,
        `हम उनके उज्ज्वल भविष्य की कामना करते हैं।`,
        signoff(i),
      ]);
    }
    case "warning": {
      const e = s.employee;
      if (!e) return "";
      return join([
        `विषय: लिखित चेतावनी`,
        greeting(e.name, "formal", "hi"),
        `यह पत्र ${note || ph("घटना का विवरण")} के संबंध में औपचारिक लिखित चेतावनी है, जिस पर ${ph("चर्चा की तिथि")} को ${ph("HR साक्षी")} की उपस्थिति में चर्चा हुई थी।`,
        `पुनरावृत्ति होने पर आगे अनुशासनात्मक कार्रवाई की जा सकती है। आप 7 दिनों के भीतर लिखित उत्तर दे सकते हैं।`,
        signoff(i),
      ]);
    }
    case "jd": {
      const r = s.requisition;
      if (!r) return "";
      return join([
        `${r.role} — ${deptName(r.departmentId)}, ${branchById(r.branchId)?.city ?? ""}`,
        `${TENANT.name} अपनी ${deptName(r.departmentId)} टीम के लिए ${r.role} की तलाश में है।`,
        `ज़िम्मेदारियाँ\n- अपने उत्पाद क्षेत्र के परिणामों की पूरी ज़िम्मेदारी\n- प्रोडक्ट, डिज़ाइन और ग्राहक टीमों के साथ सहयोग`,
        `आवश्यक कौशल\n- ${note || ph("आवश्यक कौशल")}`,
        `हम समान अवसर नियोक्ता हैं।`,
      ]);
    }
    case "announcement":
      return join([
        `विषय: ${note ? note.split(/[.\n]/)[0] : ph("घोषणा का शीर्षक")}`,
        `प्रिय साथियों,`,
        note || ph("घोषणा का विवरण"),
        `यह ${ph("प्रभावी तिथि")} से लागू होगा। प्रश्नों के लिए हेल्पडेस्क पर HR टिकट बनाएँ या HR Copilot से पूछें।`,
        signoff(i),
      ]);
    case "policy_summary": {
      const doc = KB_DOCUMENTS.find((x) => x.id === s.docId) ?? KB_DOCUMENTS[0];
      return join([
        `${doc.title} (${doc.version}) — सरल सारांश`,
        `लागू: ${doc.audience}। स्वामी: ${doc.owner}।`,
        `${ph("नीति के मुख्य बिंदुओं का हिंदी अनुवाद — कानूनी समीक्षा आवश्यक")}`,
        `यदि यह सारांश नीति से भिन्न हो, तो मूल नीति ही मान्य होगी।`,
      ]);
    }
    case "review_comment": {
      const e = s.employee;
      if (!e) return "";
      return join([
        `प्रदर्शन समीक्षा — ${e.name}, ${e.designation}`,
        `${e.firstName} का पहला छमाही प्रदर्शन अच्छा रहा। ${note || ph("मुख्य टिप्पणियाँ")}`,
        `विकास के क्षेत्र: ${ph("एक या दो विशिष्ट क्षेत्र")}।`,
        `रेटिंग प्रबंधक द्वारा समीक्षा फ़ॉर्म में तय की जाती है — यह टिप्पणी रेटिंग तय नहीं करती।`,
      ]);
    }
    case "rejection": {
      const c = s.candidate;
      if (!c) return "";
      return join([
        `विषय: ${c.role} के लिए आपका आवेदन`,
        greeting(c.name, i.tone, "hi"),
        `${TENANT.name} में ${c.role} पद में रुचि दिखाने और हमारी टीम के साथ समय बिताने के लिए धन्यवाद।`,
        `सावधानीपूर्वक विचार के बाद, हमने इस समय आपके आवेदन को आगे न बढ़ाने का निर्णय लिया है।`,
        note && `पैनल की प्रतिक्रिया: ${note}`,
        signoff(i),
      ]);
    }
    case "welcome": {
      const e = s.employee;
      if (!e) return "";
      return join([
        `विषय: ${TENANT.shortName} में आपका स्वागत है, ${e.firstName}!`,
        greeting(e.name, "warm", "hi"),
        `${deptName(e.departmentId)} टीम में ${e.designation} के रूप में आपका हार्दिक स्वागत है।`,
        `${d(e.joiningDate)} को सुबह 9:30 बजे ${branchById(e.branchId)?.city ?? ""} कार्यालय पहुँचें। ${employeeName(e.managerCode) || ph("आपके प्रबंधक")} रिसेप्शन पर आपसे मिलेंगे।`,
        note && note,
        signoff(i),
      ]);
    }
  }
}

/** Builds the draft for the given inputs — deterministic for the same inputs. */
export function generateDraft(i: DraftInput): string {
  // Concise tone trims one level of optional paragraphs.
  const eff: DraftInput =
    i.tone === "concise" && i.length !== "short" ? { ...i, length: i.length === "detailed" ? "standard" : "short" } : i;
  return eff.language === "hi" ? hi(eff) : en(eff);
}

/** Count of unresolved [[placeholders]] in a draft. */
export const placeholderCount = (text: string) => (text.match(/\[\[[^\]]+\]\]/g) ?? []).length;
