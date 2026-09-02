import { requireStudentSession, SESSION_ERROR_RESPONSE } from "@/lib/requireStudentSession";
import { getMyWarmupSubmission, getOpenWarmupRound, listBoardSubmissions } from "@/lib/warmupStore";

/** The anonymous board — unlocked only once the caller has submitted to the open round. */
export async function GET(request: Request) {
  const session = await requireStudentSession(request);
  if (!session) return SESSION_ERROR_RESPONSE();

  const round = await getOpenWarmupRound(session.courseId);
  if (!round) return Response.json({ error: "현재 진행 중인 워밍업 라운드가 없습니다" }, { status: 400 });

  const mySubmission = await getMyWarmupSubmission(round.id, session.studentKey);
  if (!mySubmission) {
    return Response.json({ error: "먼저 알고리즘을 제출해야 보드를 볼 수 있습니다" }, { status: 403 });
  }

  const entries = await listBoardSubmissions(round.id, session.studentKey);
  return Response.json({ entries });
}
