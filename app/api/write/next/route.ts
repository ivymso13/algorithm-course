import { requireStudentSession, SESSION_ERROR_RESPONSE } from "@/lib/requireStudentSession";
import { writePhaseSnapshot } from "@/lib/store";

export async function GET(request: Request) {
  const session = await requireStudentSession(request);
  if (!session) return SESSION_ERROR_RESPONSE();

  const snapshot = await writePhaseSnapshot(session.studentKey);
  if (!snapshot) return Response.json({ error: "알 수 없는 학생입니다" }, { status: 404 });
  return Response.json({ studentKey: session.studentKey, ...snapshot });
}
