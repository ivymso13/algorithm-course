import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  attempts,
  roster as rosterTable,
  sessions,
  students,
  submissions,
  warmupExperiences,
  warmupSubmissions,
  warmupVotes,
} from "@/db/schema";
import { comboForSortOrder, DEFAULT_ROSTER, studentKeyOf, type Assignment } from "@/lib/assignments";
import {
  assertNoDuplicateStudentId,
  assertRosterEntryExists,
  decideDeleteMode,
  planStudentIdentityChange,
  RosterDuplicateError,
  RosterNotFoundError,
  type StudentDataCounts,
} from "@/lib/rosterGuards";

export { RosterDuplicateError, RosterNotFoundError };

type Db = Awaited<ReturnType<typeof getDb>>;
type RosterRow = typeof rosterTable.$inferSelect;

function toAssignment(row: RosterRow): Assignment {
  const { write, execute } = comboForSortOrder(row.sortOrder);
  return {
    id: row.id,
    studentId: row.studentId,
    name: row.name,
    school: row.school,
    studentKey: row.studentKey,
    write,
    execute,
  };
}

/**
 * Seeds a course's roster from DEFAULT_ROSTER. Called by
 * `getOrCreateDefaultCourse` exactly once per course — guarded there by the
 * `courses.rosterSeededAt` flag, not by this table's row count, so a teacher
 * later deleting every student can never cause a silent reseed. The count
 * check here is just a defensive no-op guard against a double call.
 */
export async function seedRosterForCourse(courseId: number): Promise<void> {
  const db = await getDb();
  const [{ value: existingCount }] = await db
    .select({ value: sql<number>`count(*)` })
    .from(rosterTable)
    .where(eq(rosterTable.courseId, courseId));
  if (existingCount > 0) return;

  const now = new Date().toISOString();
  await db.insert(rosterTable).values(
    DEFAULT_ROSTER.map((student, index) => ({
      courseId,
      school: student.school,
      studentId: student.studentId,
      name: student.name,
      studentKey: studentKeyOf(student.studentId, student.name),
      sortOrder: index,
      active: true,
      createdAt: now,
      updatedAt: now,
    }))
  ).onConflictDoNothing();
}

/**
 * Every roster row in the course — active AND deactivated — for the
 * duplicate-identity check. Deactivated rows must count: their student ID/
 * studentKey may already own real history (submissions/votes/attempts), and
 * handing that identity to a different row would mix the two students'
 * records or collide with the DB's unique index on (course_id, student_key)/
 * (course_id, student_id).
 */
async function listRosterIdentities(db: Db, courseId: number): Promise<{ id: number; studentId: string; studentKey: string }[]> {
  return db
    .select({ id: rosterTable.id, studentId: rosterTable.studentId, studentKey: rosterTable.studentKey })
    .from(rosterTable)
    .where(eq(rosterTable.courseId, courseId));
}

/**
 * D1/SQLite reports a unique-index conflict as a generic Error whose message
 * contains "UNIQUE constraint failed" — this recognizes that shape so a race
 * that slips past the app-level `assertNoDuplicateStudentId` check (two
 * concurrent adds/edits for the same identity) still surfaces as the same
 * Korean RosterDuplicateError instead of a raw 500.
 */
function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

async function withDuplicateGuard<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new RosterDuplicateError("이미 등록된 학번입니다");
    throw error;
  }
}

/** Active roster, sorted school → student ID → name — the order shown in the teacher roster tab. */
export async function listRoster(courseId: number): Promise<Assignment[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(rosterTable)
    .where(and(eq(rosterTable.courseId, courseId), eq(rosterTable.active, true)));
  return rows
    .map(toAssignment)
    .sort(
      (a, b) =>
        a.school.localeCompare(b.school, "ko") ||
        a.studentId.localeCompare(b.studentId) ||
        a.name.localeCompare(b.name, "ko")
    );
}

/** Same data as `listRoster` — kept as a named alias for call sites migrated from the old static `listAssignments()`. */
export const listAssignments = listRoster;

export async function getAssignment(courseId: number, studentKey: string): Promise<Assignment | undefined> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(rosterTable)
    .where(
      and(eq(rosterTable.courseId, courseId), eq(rosterTable.studentKey, studentKey), eq(rosterTable.active, true))
    );
  return row ? toAssignment(row) : undefined;
}

export type RosterInput = { school: string; studentId: string; name: string };

export async function addRosterStudent(courseId: number, input: RosterInput): Promise<Assignment> {
  const db = await getDb();
  const studentKey = studentKeyOf(input.studentId, input.name);
  const allRows = await listRosterIdentities(db, courseId);
  assertNoDuplicateStudentId(allRows, { studentId: input.studentId, studentKey });

  const [{ value: maxSortOrder }] = await db
    .select({ value: sql<number>`coalesce(max(${rosterTable.sortOrder}), -1)` })
    .from(rosterTable)
    .where(eq(rosterTable.courseId, courseId));

  const now = new Date().toISOString();
  const [created] = await withDuplicateGuard(() =>
    db
      .insert(rosterTable)
      .values({
        courseId,
        school: input.school,
        studentId: input.studentId,
        name: input.name,
        studentKey,
        sortOrder: maxSortOrder + 1,
        active: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
  );
  return toAssignment(created);
}

/**
 * Updates a roster row. If the edit changes the derived studentKey (student
 * ID and/or name), every other table carrying that identity is cascade-
 * renamed in the same atomic D1 batch — students, sessions, submissions,
 * attempts (as executor), and the three warmup_* tables — so existing
 * submissions/votes/attempts stay attached to the corrected identity instead
 * of silently pointing at a studentKey that no longer resolves to anyone.
 */
export async function updateRosterStudent(courseId: number, id: number, input: RosterInput): Promise<Assignment> {
  const db = await getDb();
  const [existingRow] = await db.select().from(rosterTable).where(eq(rosterTable.id, id));
  const existing = assertRosterEntryExists(existingRow ?? null, courseId);

  const identity = planStudentIdentityChange(existing, input);
  if (identity.changed) {
    const allRows = await listRosterIdentities(db, courseId);
    assertNoDuplicateStudentId(allRows, { studentId: input.studentId, studentKey: identity.newStudentKey }, id);
  }

  const now = new Date().toISOString();

  if (!identity.changed) {
    const [updated] = await db
      .update(rosterTable)
      .set({ school: input.school, updatedAt: now })
      .where(eq(rosterTable.id, id))
      .returning();
    return toAssignment(updated);
  }

  const { oldStudentKey, newStudentKey } = identity;
  const [rosterResult] = await withDuplicateGuard(() =>
    db.batch([
      db
        .update(rosterTable)
        .set({
          school: input.school,
          studentId: input.studentId,
          name: input.name,
          studentKey: newStudentKey,
          updatedAt: now,
        })
        .where(eq(rosterTable.id, id))
        .returning(),
      db
        .update(students)
        .set({ studentId: input.studentId, name: input.name, studentKey: newStudentKey })
        .where(and(eq(students.courseId, courseId), eq(students.studentKey, oldStudentKey))),
      db
        .update(sessions)
        .set({ studentKey: newStudentKey })
        .where(and(eq(sessions.courseId, courseId), eq(sessions.studentKey, oldStudentKey))),
      db
        .update(submissions)
        .set({ studentKey: newStudentKey, studentId: input.studentId, studentName: input.name, updatedAt: now })
        .where(eq(submissions.studentKey, oldStudentKey)),
      db
        .update(attempts)
        .set({ executorKey: newStudentKey, executorId: input.studentId, executorName: input.name })
        .where(eq(attempts.executorKey, oldStudentKey)),
      db
        .update(warmupSubmissions)
        .set({ studentKey: newStudentKey, studentId: input.studentId, studentName: input.name, updatedAt: now })
        .where(eq(warmupSubmissions.studentKey, oldStudentKey)),
      db
        .update(warmupVotes)
        .set({ voterStudentKey: newStudentKey })
        .where(eq(warmupVotes.voterStudentKey, oldStudentKey)),
      db
        .update(warmupExperiences)
        .set({ executorStudentKey: newStudentKey, executorId: input.studentId, executorName: input.name, updatedAt: now })
        .where(eq(warmupExperiences.executorStudentKey, oldStudentKey)),
    ])
  );

  const [updated] = rosterResult as RosterRow[];
  return toAssignment(updated);
}

async function countStudentData(db: Db, courseId: number, studentKey: string): Promise<StudentDataCounts> {
  const [
    [{ value: submissionsCount }],
    [{ value: executedAttemptsCount }],
    [{ value: warmupSubmissionsCount }],
    [{ value: warmupVotesCount }],
    [{ value: warmupExperiencesCount }],
    [{ value: loginRecordsCount }],
  ] = await Promise.all([
    db.select({ value: sql<number>`count(*)` }).from(submissions).where(eq(submissions.studentKey, studentKey)),
    db.select({ value: sql<number>`count(*)` }).from(attempts).where(eq(attempts.executorKey, studentKey)),
    db
      .select({ value: sql<number>`count(*)` })
      .from(warmupSubmissions)
      .where(eq(warmupSubmissions.studentKey, studentKey)),
    db.select({ value: sql<number>`count(*)` }).from(warmupVotes).where(eq(warmupVotes.voterStudentKey, studentKey)),
    db
      .select({ value: sql<number>`count(*)` })
      .from(warmupExperiences)
      .where(eq(warmupExperiences.executorStudentKey, studentKey)),
    db
      .select({ value: sql<number>`count(*)` })
      .from(students)
      .where(and(eq(students.courseId, courseId), eq(students.studentKey, studentKey))),
  ]);

  return {
    submissions: submissionsCount,
    executedAttempts: executedAttemptsCount,
    warmupSubmissions: warmupSubmissionsCount,
    warmupVotes: warmupVotesCount,
    warmupExperiences: warmupExperiencesCount,
    loginRecords: loginRecordsCount,
  };
}

export type DeleteRosterResult = { mode: "delete" | "deactivate" };

/**
 * Removes a roster entry. A student with no submissions/votes/attempts/login
 * history anywhere is hard-deleted outright; the moment any such record
 * exists, the row is deactivated instead (see `decideDeleteMode`) — it drops
 * out of the active roster/assignment/login path immediately, but nothing
 * already recorded is touched, lost, or left pointing at a deleted identity.
 */
export async function deleteRosterStudent(courseId: number, id: number): Promise<DeleteRosterResult> {
  const db = await getDb();
  const [existingRow] = await db.select().from(rosterTable).where(eq(rosterTable.id, id));
  const existing = assertRosterEntryExists(existingRow ?? null, courseId);

  const counts = await countStudentData(db, courseId, existing.studentKey);
  const mode = decideDeleteMode(counts);

  if (mode === "delete") {
    await db.delete(rosterTable).where(eq(rosterTable.id, id));
  } else {
    await db.update(rosterTable).set({ active: false, updatedAt: new Date().toISOString() }).where(eq(rosterTable.id, id));
  }
  return { mode };
}
