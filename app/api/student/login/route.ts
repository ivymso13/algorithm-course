import { getAssignment, studentKeyOf } from "@/lib/assignments";
import { buildSessionCookie } from "@/lib/session";
import { jsonWithCookie } from "@/lib/http";
import { createSession, findOrCreateStudent, getCourseByCode, writePhaseSnapshot } from "@/lib/store";
import {
  ValidationError,
  validateConsent,
  validateCourseCode,
  validateName,
  validateStudentId,
} from "@/lib/validation";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    courseCode?: string;
    studentId?: string;
    name?: string;
    consent?: boolean;
  };

  let courseCode: string;
  let studentId: string;
  let name: string;
  try {
    courseCode = validateCourseCode(body.courseCode);
    studentId = validateStudentId(body.studentId);
    name = validateName(body.name);
    validateConsent(body.consent);
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const course = await getCourseByCode(courseCode);
  if (!course) {
    return Response.json({ error: "수업 코드가 올바르지 않습니다. 교사에게 문의하세요." }, { status: 404 });
  }

  const studentKey = studentKeyOf(studentId, name);
  const assignment = getAssignment(studentKey);
  if (!assignment) {
    return Response.json(
      { error: "학번+이름이 배정 목록에 없습니다. 교사에게 문의하세요." },
      { status: 404 }
    );
  }

  const student = await findOrCreateStudent({ courseId: course.id, studentId, name, studentKey });
  const { token } = await createSession({
    studentDbId: student.id,
    courseId: course.id,
    studentKey,
  });

  const snapshot = await writePhaseSnapshot(studentKey);
  return jsonWithCookie({ studentKey, assignment, ...snapshot }, buildSessionCookie(token));
}
