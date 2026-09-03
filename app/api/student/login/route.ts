import { buildSessionCookie } from "@/lib/session";
import { jsonWithCookie } from "@/lib/http";
import { createSession, findOrCreateStudent, getOrCreateDefaultCourse, writePhaseSnapshot } from "@/lib/store";
import { getAssignmentBySchoolAndStudentId } from "@/lib/roster";
import { ValidationError, validateConsent, validateSchool, validateStudentId } from "@/lib/validation";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    school?: string;
    studentId?: string;
    consent?: boolean;
  };

  let school: string;
  let studentId: string;
  try {
    school = validateSchool(body.school);
    studentId = validateStudentId(body.studentId);
    validateConsent(body.consent);
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  // The site runs a single course — the client never selects or supplies
  // one, so it can't be pointed at a course it doesn't belong to.
  const course = await getOrCreateDefaultCourse();

  // School + student ID is the login identifier — never the client-supplied
  // name (there isn't one). The real name/studentKey always come from the
  // roster row itself, never from the client.
  const assignment = await getAssignmentBySchoolAndStudentId(course.id, school, studentId);
  if (!assignment) {
    return Response.json({ error: "학교와 학번을 확인해주세요" }, { status: 404 });
  }

  const student = await findOrCreateStudent({
    courseId: course.id,
    studentId: assignment.studentId,
    name: assignment.name,
    studentKey: assignment.studentKey,
  });
  const { token } = await createSession({
    studentDbId: student.id,
    courseId: course.id,
    studentKey: assignment.studentKey,
  });

  const snapshot = await writePhaseSnapshot(assignment.studentKey, course.id);
  return jsonWithCookie({ studentKey: assignment.studentKey, assignment, ...snapshot }, buildSessionCookie(token));
}
