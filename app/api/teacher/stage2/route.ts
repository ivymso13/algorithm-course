import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/teacherAuth";
import { activateStage2, getOrCreateDefaultCourse, getStage2Active } from "@/lib/store";

export async function POST(request: Request) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();

  const course = await getOrCreateDefaultCourse();
  await activateStage2(course.id);
  const stage2Active = await getStage2Active(course.id);
  return Response.json({ stage2Active });
}
