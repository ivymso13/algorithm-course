import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/teacherAuth";
import { teacherReview } from "@/lib/store";

export async function GET(request: Request) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();

  const groups = await teacherReview();
  return Response.json({ groups });
}
