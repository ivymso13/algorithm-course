import { requireStudentSession, SESSION_ERROR_RESPONSE } from "@/lib/requireStudentSession";
import { isWarmupVoteType } from "@/lib/warmupMeta";
import {
  getMyWarmupSubmission,
  getOpenWarmupRound,
  toggleWarmupVote,
  WarmupOwnershipError,
  WarmupStateError,
} from "@/lib/warmupStore";

export async function POST(request: Request) {
  const session = await requireStudentSession(request);
  if (!session) return SESSION_ERROR_RESPONSE();

  const body = (await request.json().catch(() => ({}))) as {
    submissionId?: number;
    voteType?: string;
  };
  const submissionId = Number(body.submissionId);
  if (!Number.isInteger(submissionId) || !isWarmupVoteType(body.voteType)) {
    return Response.json({ error: "submissionId, voteType이 필요합니다" }, { status: 400 });
  }

  const round = await getOpenWarmupRound(session.courseId);
  if (!round) return Response.json({ error: "현재 진행 중인 워밍업 라운드가 없습니다" }, { status: 400 });

  const mySubmission = await getMyWarmupSubmission(round.id, session.studentKey);
  if (!mySubmission) {
    return Response.json({ error: "먼저 알고리즘을 제출해야 투표할 수 있습니다" }, { status: 403 });
  }

  try {
    const result = await toggleWarmupVote({
      submissionId,
      voterStudentKey: session.studentKey,
      voterCourseId: session.courseId,
      voteType: body.voteType,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof WarmupOwnershipError) return Response.json({ error: error.message }, { status: 403 });
    if (error instanceof WarmupStateError) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ error: "not found" }, { status: 404 });
  }
}
