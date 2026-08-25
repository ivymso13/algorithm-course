import { getAssignment } from "@/lib/assignments";
import {
  getAttempt,
  getAttemptAlgorithmText,
  sanitizeAttempt,
  submitEvaluation,
  type EvaluationResponses,
} from "@/lib/store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    attemptId?: number;
    couldFollowFully?: boolean;
    unexecutablePoint?: string;
    hadAmbiguity?: boolean;
    ambiguityNote?: string;
    consideredCorrect?: boolean;
    correctnessReason?: string;
  };
  const attemptId = Number(body.attemptId);
  if (!Number.isInteger(attemptId)) {
    return Response.json({ error: "attemptId가 필요합니다" }, { status: 400 });
  }

  const evaluation: EvaluationResponses = {
    couldFollowFully: Boolean(body.couldFollowFully),
    unexecutablePoint: body.unexecutablePoint?.trim() ?? "",
    hadAmbiguity: Boolean(body.hadAmbiguity),
    ambiguityNote: body.ambiguityNote?.trim() ?? "",
    consideredCorrect: Boolean(body.consideredCorrect),
    correctnessReason: body.correctnessReason?.trim() ?? "",
  };

  try {
    const attempt = await submitEvaluation(attemptId, evaluation);
    const algorithmText = await getAttemptAlgorithmText(attempt);

    const assignment = getAssignment(attempt.executorKey);
    const remaining = assignment
      ? assignment.execute.filter((t) => t !== attempt.problemType)
      : [];
    // remaining still needs its own completion check; the client should call
    // /api/execute/assign again to find out if that other type is done too.

    return Response.json({
      attempt: sanitizeAttempt(attempt, algorithmText, { revealAnswer: true }),
      remainingTypes: remaining,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "평가를 제출할 수 없습니다";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const attemptId = Number(url.searchParams.get("attemptId"));
  if (!Number.isInteger(attemptId)) {
    return Response.json({ error: "attemptId가 필요합니다" }, { status: 400 });
  }
  const attempt = await getAttempt(attemptId);
  if (!attempt) return Response.json({ error: "not found" }, { status: 404 });
  const algorithmText = await getAttemptAlgorithmText(attempt);
  return Response.json({
    attempt: sanitizeAttempt(attempt, algorithmText, { revealAnswer: attempt.status !== "in_progress" }),
  });
}
