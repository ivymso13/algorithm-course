import { getAssignment } from "@/lib/assignments";
import {
  EvaluationValidationError,
  parseOptionalRating,
  parseOptionalSubjectiveFeedback,
} from "@/lib/evaluationValidation";
import { requireStudentSession, SESSION_ERROR_RESPONSE } from "@/lib/requireStudentSession";
import {
  getAttemptAlgorithmText,
  getOwnedAttempt,
  OwnershipError,
  sanitizeAttempt,
  submitEvaluation,
  type EvaluationResponses,
} from "@/lib/store";

export async function POST(request: Request) {
  const session = await requireStudentSession(request);
  if (!session) return SESSION_ERROR_RESPONSE();

  const body = (await request.json().catch(() => ({}))) as {
    attemptId?: number;
    couldFollowFully?: boolean;
    unexecutablePoint?: string;
    hadAmbiguity?: boolean;
    ambiguityNote?: string;
    consideredCorrect?: boolean;
    correctnessReason?: string;
    clarityRating?: number;
    accuracyRating?: number;
    efficiencyRating?: number;
    subjectiveFeedback?: string;
  };
  const attemptId = Number(body.attemptId);
  if (!Number.isInteger(attemptId)) {
    return Response.json({ error: "attemptId가 필요합니다" }, { status: 400 });
  }

  let clarityRating: number | undefined;
  let accuracyRating: number | undefined;
  let efficiencyRating: number | undefined;
  let subjectiveFeedback: string | undefined;
  try {
    clarityRating = parseOptionalRating(body.clarityRating, "명확성 평점(clarityRating)");
    accuracyRating = parseOptionalRating(body.accuracyRating, "정확성 평점(accuracyRating)");
    efficiencyRating = parseOptionalRating(body.efficiencyRating, "효율성 평점(efficiencyRating)");
    subjectiveFeedback = parseOptionalSubjectiveFeedback(body.subjectiveFeedback);
  } catch (error) {
    if (error instanceof EvaluationValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const evaluation: EvaluationResponses = {
    couldFollowFully: Boolean(body.couldFollowFully),
    unexecutablePoint: body.unexecutablePoint?.trim() ?? "",
    hadAmbiguity: Boolean(body.hadAmbiguity),
    ambiguityNote: body.ambiguityNote?.trim() ?? "",
    consideredCorrect: Boolean(body.consideredCorrect),
    correctnessReason: body.correctnessReason?.trim() ?? "",
    ...(clarityRating !== undefined ? { clarityRating } : {}),
    ...(accuracyRating !== undefined ? { accuracyRating } : {}),
    ...(efficiencyRating !== undefined ? { efficiencyRating } : {}),
    ...(subjectiveFeedback !== undefined ? { subjectiveFeedback } : {}),
  };

  try {
    const attempt = await submitEvaluation(attemptId, session.studentKey, evaluation);
    const algorithmText = await getAttemptAlgorithmText(attempt);

    const assignment = getAssignment(session.studentKey);
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
    if (error instanceof OwnershipError) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "평가를 제출할 수 없습니다";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const session = await requireStudentSession(request);
  if (!session) return SESSION_ERROR_RESPONSE();

  const url = new URL(request.url);
  const attemptId = Number(url.searchParams.get("attemptId"));
  if (!Number.isInteger(attemptId)) {
    return Response.json({ error: "attemptId가 필요합니다" }, { status: 400 });
  }

  try {
    const attempt = await getOwnedAttempt(attemptId, session.studentKey);
    const algorithmText = await getAttemptAlgorithmText(attempt);
    return Response.json({
      attempt: sanitizeAttempt(attempt, algorithmText, { revealAnswer: attempt.status !== "in_progress" }),
    });
  } catch (error) {
    if (error instanceof OwnershipError) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    return Response.json({ error: "not found" }, { status: 404 });
  }
}
