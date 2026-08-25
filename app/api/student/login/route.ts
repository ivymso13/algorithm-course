import { getAssignment, studentKeyOf } from "@/lib/assignments";
import { writePhaseSnapshot } from "@/lib/store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    studentId?: string;
    name?: string;
  };
  const studentId = body.studentId?.trim() ?? "";
  const name = body.name?.trim() ?? "";
  if (!studentId || !name) {
    return Response.json({ error: "학번과 이름을 모두 입력하세요" }, { status: 400 });
  }

  const studentKey = studentKeyOf(studentId, name);
  const assignment = getAssignment(studentKey);
  if (!assignment) {
    return Response.json(
      { error: "학번+이름이 배정 목록에 없습니다. 교사에게 문의하세요." },
      { status: 404 }
    );
  }

  const snapshot = await writePhaseSnapshot(studentKey);
  return Response.json({ studentKey, assignment, ...snapshot });
}
