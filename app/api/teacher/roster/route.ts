import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/teacherAuth";
import {
  addRosterStudent,
  deleteRosterStudent,
  RosterDuplicateError,
  RosterNotFoundError,
  updateRosterStudent,
} from "@/lib/roster";
import { getOrCreateDefaultCourse } from "@/lib/store";
import { ValidationError, validateName, validateSchool, validateStudentId } from "@/lib/validation";

function parseRosterInput(body: { school?: string; studentId?: string; name?: string }) {
  return {
    school: validateSchool(body.school),
    studentId: validateStudentId(body.studentId),
    name: validateName(body.name),
  };
}

/** Roster row ids are autoincrement PKs — 0/negative/non-integer values can only ever be malformed input. */
function parsePositiveId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Adds a student to the roster. */
export async function POST(request: Request) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();

  const body = (await request.json().catch(() => ({}))) as {
    school?: string;
    studentId?: string;
    name?: string;
  };

  try {
    const input = parseRosterInput(body);
    const course = await getOrCreateDefaultCourse();
    const student = await addRosterStudent(course.id, input);
    return Response.json({ student });
  } catch (error) {
    if (error instanceof ValidationError) return Response.json({ error: error.message }, { status: 400 });
    if (error instanceof RosterDuplicateError) return Response.json({ error: error.message }, { status: 409 });
    throw error;
  }
}

/**
 * Edits a student's school/student ID/name. Changing the student ID and/or
 * name renames the student's identity everywhere it's stored (see
 * `lib/roster.ts`'s `updateRosterStudent`) so existing submissions/votes/
 * attempts stay attached instead of being orphaned.
 */
export async function PATCH(request: Request) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();

  const body = (await request.json().catch(() => ({}))) as {
    id?: number;
    school?: string;
    studentId?: string;
    name?: string;
  };
  const id = parsePositiveId(body.id);
  if (id === null) return Response.json({ error: "id가 필요합니다" }, { status: 400 });

  try {
    const input = parseRosterInput(body);
    const course = await getOrCreateDefaultCourse();
    const student = await updateRosterStudent(course.id, id, input);
    return Response.json({ student });
  } catch (error) {
    if (error instanceof ValidationError) return Response.json({ error: error.message }, { status: 400 });
    if (error instanceof RosterNotFoundError) return Response.json({ error: error.message }, { status: 404 });
    if (error instanceof RosterDuplicateError) return Response.json({ error: error.message }, { status: 409 });
    throw error;
  }
}

/**
 * Removes a student from the roster. A student with no submissions/votes/
 * attempts/login history is deleted outright; one with any such history is
 * deactivated instead so nothing already recorded is lost or orphaned (see
 * `lib/roster.ts`'s `deleteRosterStudent`) — the response's `mode` tells the
 * caller which one happened.
 */
export async function DELETE(request: Request) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();

  const url = new URL(request.url);
  const id = parsePositiveId(url.searchParams.get("id"));
  if (id === null) return Response.json({ error: "id가 필요합니다" }, { status: 400 });

  const course = await getOrCreateDefaultCourse();
  try {
    const result = await deleteRosterStudent(course.id, id);
    return Response.json(result);
  } catch (error) {
    if (error instanceof RosterNotFoundError) return Response.json({ error: error.message }, { status: 404 });
    throw error;
  }
}
