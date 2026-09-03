import { studentKeyOf } from "@/lib/assignments";

/**
 * Pure roster guards/errors — no `@/db` import, so this module (unlike
 * `lib/roster.ts`) can be unit-tested without a D1/Cloudflare Workers
 * runtime.
 */

/** No roster row exists with the given id for the given course — missing id and cross-course access look identical. */
export class RosterNotFoundError extends Error {}
/** A different student in the same course — active or deactivated — already has this student ID/identity. */
export class RosterDuplicateError extends Error {}

/**
 * Shared existence/ownership guard, mirroring the warm-up round guards:
 * missing id and cross-course access must look identical (no ownership
 * leak), so both throw the same RosterNotFoundError.
 */
export function assertRosterEntryExists<T extends { courseId: number }>(row: T | null, courseId: number): T {
  if (!row || row.courseId !== courseId) throw new RosterNotFoundError("학생을 찾을 수 없습니다");
  return row;
}

/**
 * Duplicate check for add/edit: student ID (학번), and separately studentKey,
 * must be unique across *every* roster row in the course — active AND
 * deactivated. Name alone isn't part of the check (two students can never
 * really share one student ID in one class regardless of spelling), but a
 * deactivated row still counts: a student ID/identity that once had real
 * history (submissions/votes/attempts) must never be handed to a different
 * roster row, or the two would look like the same person — old records would
 * either mix into the new student's, or the update-cascade's rename could
 * try to move rows onto an identity another row already owns. `excludeId`
 * lets an edit compare against every OTHER row without tripping on itself.
 */
export function assertNoDuplicateStudentId(
  allRows: { id: number; studentId: string; studentKey: string }[],
  candidate: { studentId: string; studentKey: string },
  excludeId?: number
): void {
  const conflict = allRows.find(
    (row) => row.id !== excludeId && (row.studentId === candidate.studentId || row.studentKey === candidate.studentKey)
  );
  if (conflict) throw new RosterDuplicateError("이미 등록된 학번입니다");
}

export type StudentIdentityChange = {
  changed: boolean;
  oldStudentKey: string;
  newStudentKey: string;
};

/**
 * Whether editing a roster row's studentId/name changes its derived
 * studentKey — the signal for whether an edit needs the cascade rename
 * (see `lib/roster.ts`'s `updateRosterStudent`) or is a plain field update.
 */
export function planStudentIdentityChange(
  current: { studentId: string; name: string },
  next: { studentId: string; name: string }
): StudentIdentityChange {
  const oldStudentKey = studentKeyOf(current.studentId, current.name);
  const newStudentKey = studentKeyOf(next.studentId, next.name);
  return { changed: oldStudentKey !== newStudentKey, oldStudentKey, newStudentKey };
}

/** Per-table row counts used to decide how a roster entry may be removed. */
export type StudentDataCounts = {
  submissions: number;
  executedAttempts: number;
  warmupSubmissions: number;
  warmupVotes: number;
  warmupExperiences: number;
  loginRecords: number;
};

/**
 * Deletion policy: a student with no trace anywhere else in the system can
 * be hard-deleted outright. The moment they have any submission, vote,
 * attempt, or even just a login record, hard-deleting the roster row would
 * make that data harder to explain (a name/school that no longer resolves
 * to anyone) without actually freeing anything — submissions/attempts/
 * warmup_* rows store their own studentId/studentName copies and never
 * reference the roster row, so nothing is technically orphaned either way.
 * We still choose the conservative option and deactivate instead: it keeps
 * the roster row (and thus the school/name context) around, removes the
 * student from future logins/assignment/roster-tab listings, and is
 * trivially reversible by a human with DB access if ever needed — hard
 * deletion of rows with real history is not.
 */
export function decideDeleteMode(counts: StudentDataCounts): "delete" | "deactivate" {
  const hasAnyData = Object.values(counts).some((count) => count > 0);
  return hasAnyData ? "deactivate" : "delete";
}
