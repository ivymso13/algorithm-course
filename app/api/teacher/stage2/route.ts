import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/teacherAuth";
import { activateStage2, getStage2Active } from "@/lib/store";

export async function POST(request: Request) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();

  await activateStage2();
  const stage2Active = await getStage2Active();
  return Response.json({ stage2Active });
}
