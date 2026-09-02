import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/teacherAuth";
import { getOrCreateDefaultCourse } from "@/lib/store";
import { publishWarmupRound, WarmupStateError } from "@/lib/warmupStore";

export async function POST(request: Request) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();

  const body = (await request.json().catch(() => ({}))) as { roundId?: number };
  const roundId = Number(body.roundId);
  if (!Number.isInteger(roundId)) return Response.json({ error: "roundId가 필요합니다" }, { status: 400 });

  const course = await getOrCreateDefaultCourse();
  try {
    const round = await publishWarmupRound(roundId, course.id);
    return Response.json({ round });
  } catch (error) {
    if (error instanceof WarmupStateError) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ error: "라운드를 찾을 수 없습니다" }, { status: 404 });
  }
}
