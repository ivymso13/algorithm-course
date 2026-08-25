import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/teacherAuth";
import { getStage2Active, teacherDashboard } from "@/lib/store";

export async function GET(request: Request) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();

  const [students, stage2Active] = await Promise.all([teacherDashboard(), getStage2Active()]);
  return Response.json({ students, stage2Active });
}
