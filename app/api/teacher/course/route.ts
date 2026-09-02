import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/teacherAuth";
import { getOrCreateDefaultCourse, regenerateCourseCode } from "@/lib/store";

export async function GET(request: Request) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();

  const course = await getOrCreateDefaultCourse();
  return Response.json({
    course: { code: course.code, name: course.name, retentionDays: course.retentionDays },
  });
}

/** Rotates the course access code. Existing sessions are unaffected (they key off courseId, not the code). */
export async function POST(request: Request) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();

  const course = await getOrCreateDefaultCourse();
  const updated = await regenerateCourseCode(course.id);
  if (!updated) return Response.json({ error: "수업을 찾을 수 없습니다" }, { status: 404 });
  return Response.json({
    course: { code: updated.code, name: updated.name, retentionDays: updated.retentionDays },
  });
}
