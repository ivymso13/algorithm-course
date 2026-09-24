import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/teacherAuth";

/** Retire the prototype that accepted arbitrary student-authored batch runs. */
function retired(request: Request) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();
  return Response.json({ error: "교사 화면에서 종료된 라운드의 AI 실행을 시작하세요." }, { status: 410 });
}
export const GET = retired;
export const POST = retired;
