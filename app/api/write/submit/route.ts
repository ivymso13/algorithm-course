import { getAssignment } from "@/lib/assignments";
import { generateInstance } from "@/lib/problems";
import { upsertSubmission, writePhaseSnapshot } from "@/lib/store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    studentKey?: string;
    problemType?: string;
    algorithmText?: string;
  };
  const studentKey = body.studentKey?.trim() ?? "";
  const problemType = body.problemType?.trim() ?? "";
  const algorithmText = body.algorithmText?.trim() ?? "";

  if (!studentKey || !problemType || !algorithmText) {
    return Response.json(
      { error: "studentKey, problemType, algorithmText가 모두 필요합니다" },
      { status: 400 }
    );
  }

  const assignment = getAssignment(studentKey);
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
    studentKey,
    studentId: assignment.studentId,
    studentName: assignment.name,
    problemType: problemType as (typeof assignment.write)[number],
    algorithmText,
    exampleInput,
  });

  const snapshot = await writePhaseSnapshot(studentKey);
  return Response.json({ ok: true, ...snapshot });
}
