import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/teacherAuth";
import { getOrCreateDefaultCourse } from "@/lib/store";
import { openWarmupStage, WarmupNotFoundError, WarmupStateError } from "@/lib/warmupStore";

export async function POST(request: Request) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();
  const body = await request.json().catch(() => ({})) as { roundId?: number; stage?: number };
  const roundId = Number(body.roundId);
  const stage = Number(body.stage);
  if (!Number.isInteger(roundId) || (stage !== 2 && stage !== 4)) return Response.json({ error: "roundId와 단계가 필요합니다" }, { status: 400 });
  const course = await getOrCreateDefaultCourse();
  try { return Response.json({ round: await openWarmupStage(roundId, course.id, stage as 2 | 4) }); }
  catch (error) {
    if (error instanceof WarmupNotFoundError) return Response.json({ error: error.message }, { status: 404 });
    if (error instanceof WarmupStateError) return Response.json({ error: error.message }, { status: 409 });
    throw error;
  }
}
