import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/teacherAuth";
import { getOrCreateDefaultCourse } from "@/lib/store";
import { deleteWarmupRound, teacherWarmupRoundDetail, WarmupNotFoundError, WarmupStateError } from "@/lib/warmupStore";

/** Full detail for one round: real student identities, vote tallies, feedback. */
export async function GET(request: Request) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();

  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isInteger(id)) return Response.json({ error: "id가 필요합니다" }, { status: 400 });

  const course = await getOrCreateDefaultCourse();
  const detail = await teacherWarmupRoundDetail(id, course.id);
  if (!detail) return Response.json({ error: "라운드를 찾을 수 없습니다" }, { status: 404 });
  return Response.json(detail);
}

/**
 * Deletes a draft/closed round and its submissions/votes/experiences.
 * Irreversible — open rounds are rejected (must be closed first).
 */
export async function DELETE(request: Request) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();

  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isInteger(id)) return Response.json({ error: "id가 필요합니다" }, { status: 400 });

  const course = await getOrCreateDefaultCourse();
  try {
    await deleteWarmupRound(id, course.id);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof WarmupNotFoundError) return Response.json({ error: error.message }, { status: 404 });
    if (error instanceof WarmupStateError) return Response.json({ error: error.message }, { status: 409 });
    throw error;
  }
}
