import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/teacherAuth";
import { getOrCreateDefaultCourse } from "@/lib/store";
import { openWarmupReview, WarmupNotFoundError, WarmupStateError } from "@/lib/warmupStore";

/** Manually opens the round's peer-review board — see openWarmupReview. */
export async function POST(request: Request) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();

  const body = (await request.json().catch(() => ({}))) as { roundId?: number };
  const roundId = Number(body.roundId);
  if (!Number.isInteger(roundId)) return Response.json({ error: "roundId가 필요합니다" }, { status: 400 });

  const course = await getOrCreateDefaultCourse();
  try {
    const round = await openWarmupReview(roundId, course.id);
    return Response.json({ round });
  } catch (error) {
    if (error instanceof WarmupNotFoundError) return Response.json({ error: error.message }, { status: 404 });
    if (error instanceof WarmupStateError) return Response.json({ error: error.message }, { status: 409 });
    throw error;
  }
}
