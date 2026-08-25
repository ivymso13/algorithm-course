import { getAttemptAlgorithmText, recordUnexecutable, sanitizeAttempt } from "@/lib/store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    attemptId?: number;
    reason?: string;
  };
  const attemptId = Number(body.attemptId);
  const reason = body.reason?.trim() ?? "";
  if (!Number.isInteger(attemptId) || !reason) {
    return Response.json({ error: "attemptId, reason이 필요합니다" }, { status: 400 });
  }

  try {
    const attempt = await recordUnexecutable(attemptId, reason);
    const algorithmText = await getAttemptAlgorithmText(attempt);
    return Response.json({ attempt: sanitizeAttempt(attempt, algorithmText) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "기록할 수 없습니다";
    return Response.json({ error: message }, { status: 400 });
  }
}
