import { getAssignment } from "@/lib/assignments";
import { requireStudentSession, SESSION_ERROR_RESPONSE } from "@/lib/requireStudentSession";
import { ValidationError, validateAlgorithmText } from "@/lib/validation";
import { getOpenWarmupRound, upsertWarmupSubmission, WarmupStateError } from "@/lib/warmupStore";

export async function POST(request: Request) {
  const session = await requireStudentSession(request);
  if (!session) return SESSION_ERROR_RESPONSE();

  const body = (await request.json().catch(() => ({}))) as { algorithmText?: string };
  let algorithmText: string;
  try {
    algorithmText = validateAlgorithmText(body.algorithmText);
  } catch (error) {
    if (error instanceof ValidationError) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }

  const round = await getOpenWarmupRound(session.courseId);
  if (!round) {
    return Response.json({ error: "현재 진행 중인 워밍업 라운드가 없습니다" }, { status: 400 });
  }

  const assignment = getAssignment(session.studentKey);
  if (!assignment) return Response.json({ error: "알 수 없는 학생입니다" }, { status: 404 });

  try {
    const submission = await upsertWarmupSubmission({
      roundId: round.id,
      studentKey: session.studentKey,
      studentId: assignment.studentId,
      studentName: assignment.name,
      algorithmText,
    });
    return Response.json({
      ok: true,
      round: { id: round.id, title: round.title, prompt: round.prompt, status: round.status },
      mySubmission: {
        id: submission.id,
        algorithmText: submission.algorithmText,
        createdAt: submission.createdAt,
        updatedAt: submission.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof WarmupStateError) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
