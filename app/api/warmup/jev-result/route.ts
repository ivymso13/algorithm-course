import { requireStudentSession, SESSION_ERROR_RESPONSE } from "@/lib/requireStudentSession";
import { getLatestJevResultForStudent } from "@/lib/jevStore";

export async function GET(request: Request) {
  const session = await requireStudentSession(request);
  if (!session) return SESSION_ERROR_RESPONSE();
  const row = await getLatestJevResultForStudent(session.courseId, session.studentKey);
  const headers = { "Cache-Control": "no-store" };
  if (!row) return Response.json({ result: null }, { headers });
  const result = row.result;
  return Response.json({ result: {
    roundTitle: row.roundTitle,
    submissionText: result.submissionText,
    submissionVersion: result.submissionVersion,
    totalTrials: result.totalTrials,
    correctCount: result.correctCount,
    incorrectCount: result.incorrectCount,
    errorCount: result.errorCount,
    examples: result.trials.filter((trial) => trial.correct !== true).slice(0, 3),
    createdAt: result.createdAt,
  } }, { headers });
}
