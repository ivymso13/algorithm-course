import { getAssignment } from "@/lib/assignments";
import { requireStudentSession, SESSION_ERROR_RESPONSE } from "@/lib/requireStudentSession";
import { ValidationError, validateWarmupFeedback } from "@/lib/validation";
import {
  getBoardSubmissionForViewer,
  getMyWarmupSubmission,
  getMyWarmupExperience,
  upsertWarmupExperience,
  WarmupOwnershipError,
  WarmupStateError,
} from "@/lib/warmupStore";

export async function POST(request: Request) {
  const session = await requireStudentSession(request);
  if (!session) return SESSION_ERROR_RESPONSE();

  const body = (await request.json().catch(() => ({}))) as {
    submissionId?: number;
    checkedSteps?: unknown;
    executable?: unknown;
    feedback?: string;
  };
  const submissionId = Number(body.submissionId);
  if (!Number.isInteger(submissionId) || typeof body.executable !== "boolean") {
    return Response.json({ error: "submissionId, executable이 필요합니다" }, { status: 400 });
  }

  let feedback: string;
  try {
    feedback = validateWarmupFeedback(body.feedback);
  } catch (error) {
    if (error instanceof ValidationError) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }

  const assignment = getAssignment(session.studentKey);
  if (!assignment) return Response.json({ error: "알 수 없는 학생입니다" }, { status: 404 });

  try {
    const target = await getBoardSubmissionForViewer(submissionId, session.studentKey, session.courseId);
    if (target.roundStatus !== "open") throw new WarmupStateError("현재 진행 중인 라운드가 아닙니다");
    const mine = await getMyWarmupSubmission(target.roundId, session.studentKey);
    if (!mine) return Response.json({ error: "먼저 알고리즘을 제출하세요" }, { status: 403 });

    const experience = await upsertWarmupExperience({
      submissionId,
      executorStudentKey: session.studentKey,
      executorCourseId: session.courseId,
      executorId: assignment.studentId,
      executorName: assignment.name,
      checkedSteps: body.checkedSteps,
      executable: body.executable,
      feedback,
    });
    return Response.json({ experience });
  } catch (error) {
    if (error instanceof WarmupOwnershipError) return Response.json({ error: error.message }, { status: 403 });
    if (error instanceof WarmupStateError) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ error: "not found" }, { status: 404 });
  }
}

export async function GET(request: Request) {
  const session = await requireStudentSession(request);
  if (!session) return SESSION_ERROR_RESPONSE();

  const url = new URL(request.url);
  const submissionId = Number(url.searchParams.get("submissionId"));
  if (!Number.isInteger(submissionId)) {
    return Response.json({ error: "submissionId가 필요합니다" }, { status: 400 });
  }

  try {
    const target = await getBoardSubmissionForViewer(submissionId, session.studentKey, session.courseId);
    if (target.roundStatus !== "open") throw new WarmupStateError("현재 진행 중인 라운드가 아닙니다");
    const mine = await getMyWarmupSubmission(target.roundId, session.studentKey);
    if (!mine) return Response.json({ error: "먼저 알고리즘을 제출하세요" }, { status: 403 });
    const experience = await getMyWarmupExperience(submissionId, session.studentKey);
    return Response.json({ experience });
  } catch (error) {
    if (error instanceof WarmupOwnershipError) return Response.json({ error: error.message }, { status: 403 });
    if (error instanceof WarmupStateError) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ error: "not found" }, { status: 404 });
  }
}
