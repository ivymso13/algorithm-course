import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/teacherAuth";
import { getOrCreateDefaultCourse } from "@/lib/store";
import { getWarmupRound, listWarmupSubmissionsForRound } from "@/lib/warmupStore";
import { resolveWarmupSandboxProblemType } from "@/lib/warmupProblems";
import { parseAlgorithmSteps } from "@/lib/algorithmSteps";
import {
  JEV_EXECUTION_THRESHOLD,
  JevService,
  MockJevService,
  batchEvaluate,
  type IJevService,
} from "@/lib/jev";
import { maxBoxProblem, type MaxBoxInput } from "@/lib/problems/maxbox";
import { saveJevBatchEvaluation } from "@/lib/jevStore";

const MAX_TRIALS_PER_STUDENT = 50;
const DEFAULT_TRIALS = 20;
// Matches lib/jev/problems/max-finding.json's own problemId — the Jev
// execution schema's id, distinct from the warm-up problem bank's "max-box"
// and the roster ProblemType union's "maxbox".
const JEV_PROBLEM_ID = "max-finding";

/**
 * Teacher-triggered: runs Jev's batch evaluation against every student's
 * final (peer-reviewed) submission in a closed round, all at once. Students
 * never trigger this themselves — see components/jev/JevResultCard.tsx for
 * the read-only result they see afterward on /write.
 */
export async function POST(request: Request) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();

  const body = (await request.json().catch(() => ({}))) as { roundId?: number; trials?: number };
  const roundId = Number(body.roundId);
  if (!Number.isInteger(roundId)) {
    return Response.json({ error: "roundId가 필요합니다" }, { status: 400 });
  }
  const trials = Math.min(Math.max(Math.trunc(Number(body.trials)) || DEFAULT_TRIALS, 1), MAX_TRIALS_PER_STUDENT);

  const course = await getOrCreateDefaultCourse();
  const round = await getWarmupRound(roundId);
  if (!round || round.courseId !== course.id) {
    return Response.json({ error: "라운드를 찾을 수 없습니다" }, { status: 404 });
  }
  if (round.status !== "closed") {
    return Response.json({ error: "종료된 라운드에서만 AI 실행을 할 수 있습니다" }, { status: 409 });
  }
  if (resolveWarmupSandboxProblemType(round) !== "maxbox") {
    return Response.json({ error: "이 문제는 아직 AI 실행을 지원하지 않습니다" }, { status: 400 });
  }

  const submissions = await listWarmupSubmissionsForRound(roundId);

  const useMock = process.env.USE_JEV_MOCK === "true" || !process.env.TYPESAFE_API_KEY;
  const service: IJevService =
    !useMock && process.env.TYPESAFE_API_KEY ? new JevService(process.env.TYPESAFE_API_KEY) : new MockJevService();

  const generateBoxInstance = () => {
    const instance = maxBoxProblem.generate();
    const input = instance.input as MaxBoxInput;
    return { numbers: input.counts, correctAnswer: instance.correctAnswer as number };
  };

  let ran = 0;
  let skipped = 0;

  // Sequential across students, not Promise.all — each student's own batch
  // already runs `trials` instances at concurrency 20 internally. Firing
  // every student's batch at once would multiply that far past what's been
  // safely tested against the real Jev API (a whole-class run is expected to
  // take a while; this trades speed for staying within known-safe limits).
  for (const submission of submissions) {
    const steps = parseAlgorithmSteps(submission.algorithmText);
    if (steps.length === 0) {
      skipped += 1;
      continue;
    }

    const summary = await batchEvaluate(steps, trials, generateBoxInstance, {
      threshold: JEV_EXECUTION_THRESHOLD,
      service,
      concurrency: 20,
    });

    await saveJevBatchEvaluation({
      courseId: course.id,
      roundId,
      studentKey: submission.studentKey,
      studentId: submission.studentId,
      studentName: submission.studentName,
      problemId: JEV_PROBLEM_ID,
      algorithmSteps: steps,
      summary,
    });
    ran += 1;
  }

  return Response.json({ totalSubmissions: submissions.length, ran, skipped });
}
