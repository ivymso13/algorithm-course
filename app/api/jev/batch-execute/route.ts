import {
  JEV_EXECUTION_THRESHOLD,
  JevService,
  MockJevService,
  batchEvaluate,
  type IJevService,
} from "@/lib/jev";
import { maxBoxProblem, type MaxBoxInput } from "@/lib/problems/maxbox";
import { requireStudentSession } from "@/lib/requireStudentSession";
import { getAssignment } from "@/lib/roster";
import { listJevBatchEvaluations, saveJevBatchEvaluation } from "@/lib/jevStore";

const MAX_TRIALS = 200; // safety cap — keeps one request's Jev call volume and wall time bounded
const PROBLEM_ID = "max-finding"; // matches lib/jev/problems/max-finding.json

/** A student's own past batch-evaluation runs, most recent first. */
export async function GET(req: Request) {
  const session = await requireStudentSession(req);
  if (!session) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const rows = await listJevBatchEvaluations(session.studentKey);
  return Response.json({ runs: rows });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { steps?: string[]; trials?: number };
    const steps = Array.isArray(body.steps) ? body.steps : [];
    const trials = Math.min(Math.max(Math.trunc(Number(body.trials)) || 20, 1), MAX_TRIALS);

    // Not logged in is a real, common state for this MVP page (it works
    // without a session for local testing) — that just means this run
    // isn't saved, not that the request should fail.
    const session = await requireStudentSession(req);

    const useMock = process.env.USE_JEV_MOCK === "true" || !process.env.TYPESAFE_API_KEY;
    const service: IJevService =
      !useMock && process.env.TYPESAFE_API_KEY ? new JevService(process.env.TYPESAFE_API_KEY) : new MockJevService();

    // Box-problem-specific instance generator — the one piece of this route
    // that knows about "boxes of apples". A second activity plugs in here
    // with its own generator; batchEvaluate itself doesn't change.
    const generateBoxInstance = () => {
      const instance = maxBoxProblem.generate();
      const input = instance.input as MaxBoxInput;
      return { numbers: input.counts, correctAnswer: instance.correctAnswer as number };
    };

    // Trials are fully independent of each other — only the ~13 Jev calls
    // *within* one trial are forced sequential (each depends on the state
    // the previous one produced). 40 measured cleanly at 0 errors up to 100
    // trials against the real API (no rate-limit signals); this is the
    // lever that actually cuts wall time, not squeezing the per-trial chain.
    const summary = await batchEvaluate(steps, trials, generateBoxInstance, {
      threshold: JEV_EXECUTION_THRESHOLD,
      service,
      concurrency: 40,
    });

    let saved = false;
    if (session) {
      const assignment = await getAssignment(session.courseId, session.studentKey);
      if (assignment) {
        await saveJevBatchEvaluation({
          courseId: session.courseId,
          studentKey: session.studentKey,
          studentId: assignment.studentId,
          studentName: assignment.name,
          problemId: PROBLEM_ID,
          algorithmSteps: steps,
          summary,
        });
        saved = true;
      }
    }

    return Response.json({ ...summary, saved });
  } catch (error) {
    console.error("[Jev Batch Evaluator] Error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "일괄 검증 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
