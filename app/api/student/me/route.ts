import { requireStudentSession, SESSION_ERROR_RESPONSE } from "@/lib/requireStudentSession";
import { getAssignment } from "@/lib/roster";

/** Lightweight "who am I" check, driven only by the session cookie. Used by
 * client pages on mount to decide whether to show the login form. */
export async function GET(request: Request) {
  const session = await requireStudentSession(request);
  if (!session) return SESSION_ERROR_RESPONSE();

  const assignment = await getAssignment(session.courseId, session.studentKey);
  if (!assignment) return Response.json({ error: "알 수 없는 학생입니다" }, { status: 404 });

  return Response.json({ studentKey: session.studentKey, assignment });
}
