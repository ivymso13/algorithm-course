import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/teacherAuth";
import { getOrCreateDefaultCourse, getStage2Active, teacherDashboard } from "@/lib/store";

export async function GET(request: Request) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();

  const course = await getOrCreateDefaultCourse();
  const [students, stage2Active] = await Promise.all([
    teacherDashboard(),
    getStage2Active(course.id),
  ]);
  return Response.json({
    students,
    stage2Active,
    course: { code: course.code, name: course.name, retentionDays: course.retentionDays },
  });
}
