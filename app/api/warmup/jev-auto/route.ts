import { requireStudentSession, SESSION_ERROR_RESPONSE } from "@/lib/requireStudentSession";
import { getWarmupRound } from "@/lib/warmupStore";
import { advanceAutoRuns, getOwnAutoRun, retryOwnAutoRun } from "@/lib/jevAuto";
import { JevRequestError, jevErrorResponse, positiveId, readJevBody } from "@/lib/jevRequest";

const headers = { "Cache-Control": "no-store" };

async function ownRound(courseId: number, value: unknown) {
  const roundId = positiveId(value);
  const round = await getWarmupRound(roundId);
  if (!round || round.courseId !== courseId) throw new JevRequestError("라운드를 찾을 수 없습니다.", 404);
  return roundId;
}

/** The signed-in student's automatic grading status for their latest revision only. */
export async function GET(request: Request) {
  const session = await requireStudentSession(request);
  if (!session) return SESSION_ERROR_RESPONSE();
  try {
    const roundId = await ownRound(session.courseId, new URL(request.url).searchParams.get("roundId"));
    return Response.json({ run: await getOwnAutoRun(session.courseId, roundId, session.studentKey) }, { headers });
  } catch (error) { return jevErrorResponse(error); }
}

/**
 * `advance` runs one bounded wave of trials in this request (own run first,
 * then other queued runs of the same course, whose results are never
 * returned here). `retry` requeues the caller's own run after it gave up.
 */
export async function POST(request: Request) {
  const session = await requireStudentSession(request);
  if (!session) return SESSION_ERROR_RESPONSE();
  try {
    const body = await readJevBody(request);
    const roundId = await ownRound(session.courseId, body.roundId);
    const action = body.action ?? "advance";
    if (action !== "advance" && action !== "retry") throw new JevRequestError("지원하지 않는 작업입니다.");
    if (action === "retry") await retryOwnAutoRun(session.courseId, roundId, session.studentKey);
    const own = await getOwnAutoRun(session.courseId, roundId, session.studentKey);
    let serviceUnavailable = false;
    if (own && ["queued", "running", "retrying"].includes(own.status)) {
      try {
        await advanceAutoRuns({ courseId: session.courseId, preferRunId: own.runId });
      } catch (error) {
        if (!(error instanceof Error && error.name === "JevConfigurationError")) throw error;
        serviceUnavailable = true;
      }
    }
    const run = await getOwnAutoRun(session.courseId, roundId, session.studentKey);
    return Response.json({ run, serviceUnavailable }, { headers });
  } catch (error) { return jevErrorResponse(error); }
}
