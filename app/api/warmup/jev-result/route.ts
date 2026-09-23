import { requireStudentSession, SESSION_ERROR_RESPONSE } from "@/lib/requireStudentSession";
import { getLatestJevResultForStudent } from "@/lib/jevStore";
import { getMyWarmupSubmission, getWarmupRound } from "@/lib/warmupStore";

/**
 * The student's own most recent Jev batch-evaluation result, if a teacher
 * has run one for a round they submitted to — read-only, nothing to
 * trigger here. Returns `result: null` when nothing's been run yet, which
 * the /write page treats as "show nothing" rather than an error.
 */
export async function GET(request: Request) {
  const session = await requireStudentSession(request);
  if (!session) return SESSION_ERROR_RESPONSE();

  const row = await getLatestJevResultForStudent(session.courseId, session.studentKey);
  if (!row) return Response.json({ result: null });

  const round = row.roundId ? await getWarmupRound(row.roundId) : null;
  const mySubmission = row.roundId ? await getMyWarmupSubmission(row.roundId, session.studentKey) : null;

  return Response.json({
    result: {
      roundTitle: round?.title ?? null,
      submissionText: mySubmission?.algorithmText ?? null,
      totalTrials: row.totalTrials,
      correctCount: row.correctCount,
      incorrectCount: row.incorrectCount,
      errorCount: row.errorCount,
      createdAt: row.createdAt,
    },
  });
}
