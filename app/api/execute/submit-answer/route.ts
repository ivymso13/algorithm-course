import { getAttemptAlgorithmText, sanitizeAttempt, submitFinalAnswer } from "@/lib/store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    attemptId?: number;
    finalAnswer?: number;
  };
  const attemptId = Number(body.attemptId);
  const finalAnswer = Number(body.finalAnswer);
  if (!Number.isInteger(attemptId) || !Number.isFinite(finalAnswer)) {
    return Response.json({ error: "attemptId, finalAnswer가 필요합니다" }, { status: 400 });
  }

  try {
    const attempt = await submitFinalAnswer(attemptId, finalAnswer);
    const algorithmText = await getAttemptAlgorithmText(attempt);
    return Response.json({
      attempt: sanitizeAttempt(attempt, algorithmText, { revealAnswer: true }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "제출할 수 없습니다";
    return Response.json({ error: message }, { status: 400 });
  }
}
