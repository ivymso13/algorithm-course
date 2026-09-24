import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/teacherAuth";
import { getOrCreateDefaultCourse } from "@/lib/store";
import { getWarmupRound } from "@/lib/warmupStore";
import { resolveWarmupSandboxProblemType } from "@/lib/warmupProblems";
import { advanceJevJob, cancelJevJob, createJevJob, getJevJob, listJevJobs, resumeJevJob } from "@/lib/jevJobs";
import { JevRequestError, jevErrorResponse, positiveId, readJevBody, validateTrials } from "@/lib/jevRequest";

const headers = { "Cache-Control": "no-store" };
export async function GET(request: Request) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();
  try {
    const course = await getOrCreateDefaultCourse();
    return Response.json({ jobs: await listJevJobs(course.id) }, { headers });
  } catch (error) { return jevErrorResponse(error); }
}
export async function POST(request: Request) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();
  try {
    const body = await readJevBody(request);
    const course = await getOrCreateDefaultCourse();
    const action = body.action ?? "start";
    if (action === "start") {
      const roundId = positiveId(body.roundId);
      const trials = validateTrials(body.trials);
      const round = await getWarmupRound(roundId);
      if (!round || round.courseId !== course.id) throw new JevRequestError("라운드를 찾을 수 없습니다.", 404);
      if (round.status !== "closed") throw new JevRequestError("종료된 라운드에서만 실행할 수 있습니다.", 409);
      if (resolveWarmupSandboxProblemType(round) !== "maxbox") throw new JevRequestError("현재 상자 문제만 AI 실행을 지원합니다.");
      return Response.json({ job: await createJevJob(course.id, roundId, trials) }, { status: 202, headers });
    }
    const id = positiveId(body.jobId);
    await getJevJob(course.id, id);
    const job = action === "advance" ? await advanceJevJob(course.id, id)
      : action === "cancel" ? await cancelJevJob(course.id, id)
      : action === "resume" ? await resumeJevJob(course.id, id) : null;
    if (!job) throw new JevRequestError("지원하지 않는 작업입니다.");
    return Response.json({ job }, { headers });
  } catch (error) { return jevErrorResponse(error); }
}
