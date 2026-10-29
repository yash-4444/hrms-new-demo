import { COURSES } from "@/mock/growth";
import CourseDetailView from "./view";

/** See employees/[id]/page.tsx for why the shell and the view are split. */
export function generateStaticParams() {
  return COURSES.map((c) => ({ id: c.id }));
}

export default function Page() {
  return <CourseDetailView />;
}
