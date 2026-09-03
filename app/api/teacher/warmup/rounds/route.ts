import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/teacherAuth";
import { createWarmupRound, listWarmupRoundsForCourse } from "@/lib/warmupStore";
import { getWarmupProblem, WARMUP_PROBLEMS } from "@/lib/warmupProblems";
import { getOrCreateDefaultCourse } from "@/lib/store";

export async function GET(request: Request) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();

  const course = await getOrCreateDefaultCourse();
  const rounds = await listWarmupRoundsForCourse(course.id);
  return Response.json({ rounds, problems: WARMUP_PROBLEMS });
}

export async function POST(request: Request) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();

  const body = (await request.json().catch(() => ({}))) as { problemId?: string };
  const problem = getWarmupProblem(body.problemId);
  if (!problem) return Response.json({ error: "등록된 문제를 선택하세요" }, { status: 400 });

  const course = await getOrCreateDefaultCourse();
  const round = await createWarmupRound(course.id, problem.title, problem.prompt, problem.id);
  return Response.json({ round });
}
