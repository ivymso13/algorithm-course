import { getAssignment } from "@/lib/assignments";
import { generateInstance } from "@/lib/problems";
import { requireStudentSession, SESSION_ERROR_RESPONSE } from "@/lib/requireStudentSession";
import { upsertSubmission, writePhaseSnapshot } from "@/lib/store";
import { ValidationError, validateAlgorithmText } from "@/lib/validation";

export async function POST(request: Request) {
  const session = await requireStudentSession(request);
  if (!session) return SESSION_ERROR_RESPONSE();

  const body = (await request.json().catch(() => ({}))) as {
    problemType?: string;
    algorithmText?: string;
  };
  const problemType = body.problemType?.trim() ?? "";

  let algorithmText: string;
  try {
    algorithmText = validateAlgorithmText(body.algorithmText);
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  if (!problemType) {
    return Response.json({ error: "problemType이 필요합니다" }, { status: 400 });
  }

  const assignment = getAssignment(session.studentKey);
  if (!assignment) {
    return Response.json({ error: "알 수 없는 학생입니다" }, { status: 404 });
  }
  if (!assignment.write.includes(problemType as (typeof assignment.write)[number])) {
    return Response.json(
      { error: "이 학생에게 배정되지 않은 문제 유형입니다" },
      { status: 400 }
    );
  }

  const { input: exampleInput } = generateInstance(
    problemType as (typeof assignment.write)[number]
  );

  await upsertSubmission({
    studentKey: session.studentKey,
    studentId: assignment.studentId,
    studentName: assignment.name,
    problemType: problemType as (typeof assignment.write)[number],
    algorithmText,
    exampleInput,
  });

  const snapshot = await writePhaseSnapshot(session.studentKey);
  return Response.json({ ok: true, studentKey: session.studentKey, ...snapshot });
}
