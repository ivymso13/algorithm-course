import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/teacherAuth";
import { getOrCreateDefaultCourse } from "@/lib/store";
import { deleteWarmupSubmission, WarmupNotFoundError } from "@/lib/warmupStore";

/** Deletes one submission (and its votes/experiences) off a round's board. */
export async function DELETE(request: Request) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();

  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isInteger(id)) return Response.json({ error: "id가 필요합니다" }, { status: 400 });

  const course = await getOrCreateDefaultCourse();
  try {
    await deleteWarmupSubmission(id, course.id);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof WarmupNotFoundError) return Response.json({ error: error.message }, { status: 404 });
    throw error;
  }
}
