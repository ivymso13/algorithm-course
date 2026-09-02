import { requireStudentSession, SESSION_ERROR_RESPONSE } from "@/lib/requireStudentSession";
import { getAttemptAlgorithmText, OwnershipError, recordUnexecutable, sanitizeAttempt } from "@/lib/store";
import { ValidationError, validateUnexecutableReason } from "@/lib/validation";

export async function POST(request: Request) {
  const session = await requireStudentSession(request);
  if (!session) return SESSION_ERROR_RESPONSE();

  const body = (await request.json().catch(() => ({}))) as {
    attemptId?: number;
    reason?: string;
  };
  const attemptId = Number(body.attemptId);
  if (!Number.isInteger(attemptId)) {
    return Response.json({ error: "attemptId가 필요합니다" }, { status: 400 });
  }

  let reason: string;
  try {
    reason = validateUnexecutableReason(body.reason);
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  try {
    const attempt = await recordUnexecutable(attemptId, session.studentKey, reason);
    const algorithmText = await getAttemptAlgorithmText(attempt);
    return Response.json({ attempt: sanitizeAttempt(attempt, algorithmText) });
  } catch (error) {
    if (error instanceof OwnershipError) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "기록할 수 없습니다";
    return Response.json({ error: message }, { status: 400 });
  }
}
