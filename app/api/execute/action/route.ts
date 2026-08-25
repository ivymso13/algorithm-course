import { applyActionAndPersist, getAttemptAlgorithmText, sanitizeAttempt } from "@/lib/store";

export async function POST(request: Request) {
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
    const attempt = await applyActionAndPersist(attemptId, action, body.params ?? {});
    const algorithmText = await getAttemptAlgorithmText(attempt);
    return Response.json({ attempt: sanitizeAttempt(attempt, algorithmText) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "행동을 적용할 수 없습니다";
    return Response.json({ error: message }, { status: 400 });
  }
}
