import { requireStudentSession, SESSION_ERROR_RESPONSE } from "@/lib/requireStudentSession";
import { resolveWarmupSandboxProblemType } from "@/lib/warmupProblems";
import { getMyWarmupSubmission, getOpenWarmupRound } from "@/lib/warmupStore";

/** Current open round for the student's course, plus their own submission (if any). */
export async function GET(request: Request) {
  const session = await requireStudentSession(request);
  if (!session) return SESSION_ERROR_RESPONSE();

  const round = await getOpenWarmupRound(session.courseId);
  if (!round) return Response.json({ studentKey: session.studentKey, round: null, mySubmission: null });

  const mySubmission = await getMyWarmupSubmission(round.id, session.studentKey);
  return Response.json({
    studentKey: session.studentKey,
    round: {
      id: round.id,
      title: round.title,
      prompt: round.prompt,
      status: round.status,
      reviewOpenedAt: round.reviewOpenedAt,
      problemType: resolveWarmupSandboxProblemType(round),
    },
    mySubmission: mySubmission
      ? {
          id: mySubmission.id,
          algorithmText: mySubmission.algorithmText,
          createdAt: mySubmission.createdAt,
          updatedAt: mySubmission.updatedAt,
        }
      : null,
  });
}
