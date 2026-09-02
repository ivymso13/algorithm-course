import { requireStudentSession, SESSION_ERROR_RESPONSE } from "@/lib/requireStudentSession";
import {
  getBoardSubmissionForViewer,
  getMyWarmupSubmission,
  WarmupOwnershipError,
  WarmupStateError,
} from "@/lib/warmupStore";

/** One anonymous board entry, for the generic step-check experience page. */
export async function GET(request: Request) {
  const session = await requireStudentSession(request);
  if (!session) return SESSION_ERROR_RESPONSE();

  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isInteger(id)) return Response.json({ error: "id가 필요합니다" }, { status: 400 });

  try {
    const submission = await getBoardSubmissionForViewer(id, session.studentKey, session.courseId);
    if (submission.roundStatus !== "open") {
      throw new WarmupStateError("현재 진행 중인 라운드가 아닙니다");
    }
    const mine = await getMyWarmupSubmission(submission.roundId, session.studentKey);
    if (!mine) return Response.json({ error: "먼저 알고리즘을 제출하세요" }, { status: 403 });
    return Response.json({ submission });
  } catch (error) {
    if (error instanceof WarmupOwnershipError) return Response.json({ error: error.message }, { status: 403 });
    if (error instanceof WarmupStateError) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ error: "not found" }, { status: 404 });
  }
}
