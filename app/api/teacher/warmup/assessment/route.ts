import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/teacherAuth";
import { getOrCreateDefaultCourse } from "@/lib/store";
import { upsertTeacherAssessment, WarmupNotFoundError, WarmupStateError } from "@/lib/warmupStore";

export async function POST(request: Request) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const course = await getOrCreateDefaultCourse();
  try {
    const assessment = await upsertTeacherAssessment({
      versionId: Number(body.versionId),
      courseId: course.id,
      clarity: Number(body.clarity),
      completeness: Number(body.completeness),
      accuracy: Number(body.accuracy),
      executability: Number(body.executability),
      solvedStatus: String(body.solvedStatus ?? ""),
      comment: String(body.comment ?? ""),
    });
    return Response.json({ assessment });
  } catch (error) {
    if (error instanceof WarmupNotFoundError) return Response.json({ error: error.message }, { status: 404 });
    if (error instanceof WarmupStateError) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
