import { requireStudentSession, SESSION_ERROR_RESPONSE } from "@/lib/requireStudentSession";
import { applyActionAndPersist, getAttemptAlgorithmText, OwnershipError, sanitizeAttempt } from "@/lib/store";

export async function POST(request: Request) {
  const session = await requireStudentSession(request);
  if (!session) return SESSION_ERROR_RESPONSE();

  const body = (await request.json().catch(() => ({}))) as {
    attemptId?: number;
    action?: string;
    params?: Record<string, unknown>;
  };
  const attemptId = Number(body.attemptId);
  const action = body.action?.trim() ?? "";
  if (!Number.isInteger(attemptId) || !action) {
    return Response.json({ error: "attemptId, action이 필요합니다" }, { status: 400 });
  }

  try {
    const attempt = await applyActionAndPersist(attemptId, session.studentKey, action, body.params ?? {});
    const algorithmText = await getAttemptAlgorithmText(attempt);
    return Response.json({ attempt: sanitizeAttempt(attempt, algorithmText) });
  } catch (error) {
    if (error instanceof OwnershipError) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "행동을 적용할 수 없습니다";
    return Response.json({ error: message }, { status: 400 });
  }
}
