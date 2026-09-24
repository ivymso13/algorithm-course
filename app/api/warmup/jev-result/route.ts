import { requireStudentSession, SESSION_ERROR_RESPONSE } from "@/lib/requireStudentSession";
import { getLatestJevResultForStudent } from "@/lib/jevStore";

export async function GET(request: Request) {
  const session = await requireStudentSession(request);
  if (!session) return SESSION_ERROR_RESPONSE();
  const result = await getLatestJevResultForStudent(session.courseId, session.studentKey);
  return Response.json({ result }, { headers: { "Cache-Control": "no-store" } });
}
