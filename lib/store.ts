import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { attempts, courses, sessions, students, submissions } from "@/db/schema";
import { getAssignment, listAssignments, type ProblemType } from "@/lib/assignments";
import { applyProblemAction, generateInstance, publicInputFor } from "@/lib/problems";
import type { LogEntry } from "@/lib/problems/types";
import {
  expiresAtFromNow,
  generateSessionToken,
  hashSessionToken,
  isExpired,
} from "@/lib/session";

/** Thrown when a caller tries to act on an attempt/submission they don't own. */
export class OwnershipError extends Error {}

// ---------------------------------------------------------------------------
// Course — the class this deployment is currently running. Public deploys
// have no ChatGPT/GitHub login, so `code` is the only gate keeping strangers
// off the roster; `stage2Active` replaces the old singleton `stage_state`.
// ---------------------------------------------------------------------------

const CODE_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — avoids ambiguity on a whiteboard

function generateCourseCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_CHARSET[b % CODE_CHARSET.length]).join("");
}

/** Ensures at least one course exists and returns the earliest-created one. */
export async function getOrCreateDefaultCourse() {
  const db = await getDb();
  const [existing] = await db.select().from(courses).orderBy(courses.id).limit(1);
  if (existing) return existing;

  const seedCode = process.env.COURSE_CODE?.trim().toUpperCase() || generateCourseCode();
  const [created] = await db
    .insert(courses)
    .values({ code: seedCode, createdAt: new Date().toISOString() })
    .returning();
  return created;
}

export async function getCourseByCode(code: string) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(courses)
    .where(eq(courses.code, code.toUpperCase()));
  return row ?? null;
}

export async function getCourseById(courseId: number) {
  const db = await getDb();
  const [row] = await db.select().from(courses).where(eq(courses.id, courseId));
  return row ?? null;
}

export async function regenerateCourseCode(courseId: number) {
  const db = await getDb();
  const [updated] = await db
    .update(courses)
    .set({ code: generateCourseCode() })
    .where(eq(courses.id, courseId))
    .returning();
  return updated ?? null;
}

export async function getStage2Active(courseId: number): Promise<boolean> {
  const course = await getCourseById(courseId);
  return course?.stage2Active ?? false;
}

export async function activateStage2(courseId: number): Promise<void> {
  const db = await getDb();
  await db
    .update(courses)
    .set({ stage2Active: true, activatedAt: new Date().toISOString() })
    .where(eq(courses.id, courseId));
}

// ---------------------------------------------------------------------------
// Students & sessions
// ---------------------------------------------------------------------------

/**
 * Records (or refreshes) a login. The roster/assignment check itself still
 * happens via `getAssignment` in lib/assignments.ts before this is called —
 * this only persists the consent + login-history record for a roster member
 * who is actually joining this course for the first time (or again).
 */
export async function findOrCreateStudent(input: {
  courseId: number;
  studentId: string;
  name: string;
  studentKey: string;
}) {
  const db = await getDb();
  const now = new Date().toISOString();
  const [existing] = await db
    .select()
    .from(students)
    .where(and(eq(students.courseId, input.courseId), eq(students.studentKey, input.studentKey)));

  if (existing) {
    const [updated] = await db
      .update(students)
      .set({ lastLoginAt: now })
      .where(eq(students.id, existing.id))
      .returning();
    return updated ?? existing;
  }

  const [created] = await db
    .insert(students)
    .values({
      courseId: input.courseId,
      studentId: input.studentId,
      name: input.name,
      studentKey: input.studentKey,
      consentAt: now,
      createdAt: now,
      lastLoginAt: now,
    })
    .returning();
  return created;
}

export type ActiveSession = {
  id: number;
  studentId: number;
  courseId: number;
  studentKey: string;
  expiresAt: string;
};

/** Issues a new session and returns the raw token (never persisted as-is). */
export async function createSession(input: {
  studentDbId: number;
  courseId: number;
  studentKey: string;
}): Promise<{ token: string; expiresAt: string }> {
  const db = await getDb();
  const token = generateSessionToken();
  const tokenHash = await hashSessionToken(token);
  const expiresAt = expiresAtFromNow();
  const now = new Date().toISOString();
  await db.insert(sessions).values({
    tokenHash,
    studentId: input.studentDbId,
    courseId: input.courseId,
    studentKey: input.studentKey,
    createdAt: now,
    expiresAt,
    lastSeenAt: now,
  });
  return { token, expiresAt };
}

export async function getSessionByToken(token: string): Promise<ActiveSession | null> {
  const db = await getDb();
  const tokenHash = await hashSessionToken(token);
  const [row] = await db.select().from(sessions).where(eq(sessions.tokenHash, tokenHash));
  if (!row) return null;
  if (isExpired(row.expiresAt)) {
    await db.delete(sessions).where(eq(sessions.id, row.id));
    return null;
  }
  await db
    .update(sessions)
    .set({ lastSeenAt: new Date().toISOString() })
    .where(eq(sessions.id, row.id));
  return {
    id: row.id,
    studentId: row.studentId,
    courseId: row.courseId,
    studentKey: row.studentKey,
    expiresAt: row.expiresAt,
  };
}

export async function deleteSessionByToken(token: string): Promise<void> {
  const db = await getDb();
  const tokenHash = await hashSessionToken(token);
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

// ---------------------------------------------------------------------------
// Page 1 — write phase
// ---------------------------------------------------------------------------

export async function getSubmission(studentKey: string, problemType: ProblemType) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(submissions)
    .where(and(eq(submissions.studentKey, studentKey), eq(submissions.problemType, problemType)));
  return row ?? null;
}

export async function listSubmissionsByStudent(studentKey: string) {
  const db = await getDb();
  return db.select().from(submissions).where(eq(submissions.studentKey, studentKey));
}

export async function upsertSubmission(input: {
  studentKey: string;
  studentId: string;
  studentName: string;
  problemType: ProblemType;
  algorithmText: string;
  exampleInput: unknown;
}) {
  const db = await getDb();
  const now = new Date().toISOString();
  await db
    .insert(submissions)
    .values({ ...input, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [submissions.studentKey, submissions.problemType],
      set: { algorithmText: input.algorithmText, updatedAt: now },
    });
  return getSubmission(input.studentKey, input.problemType);
}

/** Evaluated attempts run against this author's own submissions, for the page-1 "review card". */
export async function listReviewCardsForAuthor(studentKey: string) {
  const authored = await listSubmissionsByStudent(studentKey);
  if (authored.length === 0) return [];
  const db = await getDb();
  const ids = authored.map((s) => s.id);
  const rows = await db
    .select()
    .from(attempts)
    .where(and(inArray(attempts.submissionId, ids), eq(attempts.status, "evaluated")))
    .orderBy(desc(attempts.evaluatedAt));

  const byId = new Map(authored.map((s) => [s.id, s]));
  return rows.map((attempt) => ({
    attempt,
    submission: byId.get(attempt.submissionId) ?? null,
  }));
}

export async function writePhaseSnapshot(studentKey: string) {
  const assignment = getAssignment(studentKey);
  if (!assignment) return null;

  const existing = await listSubmissionsByStudent(studentKey);
  const byType = new Map(existing.map((s) => [s.problemType, s]));

  const writeStatus = assignment.write.map((problemType) => {
    const submission = byType.get(problemType);
    return {
      problemType,
      submitted: Boolean(submission),
      algorithmText: submission?.algorithmText ?? "",
      submittedAt: submission?.createdAt ?? null,
      updatedAt: submission?.updatedAt ?? null,
    };
  });

  const nextProblemType = writeStatus.find((w) => !w.submitted)?.problemType ?? null;
  const exampleInput = nextProblemType ? generateInstance(nextProblemType).input : null;
  const reviewCards = await listReviewCardsForAuthor(studentKey);

  return { assignment, writeStatus, nextProblemType, exampleInput, reviewCards };
}

// ---------------------------------------------------------------------------
// Page 2 — execute phase
// ---------------------------------------------------------------------------

export async function findInProgressAttempt(executorKey: string) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.executorKey, executorKey), eq(attempts.status, "in_progress")))
    .orderBy(desc(attempts.createdAt));
  return row ?? null;
}

async function completedExecuteTypes(executorKey: string): Promise<ProblemType[]> {
  const db = await getDb();
  const rows = await db
    .select({ problemType: attempts.problemType })
    .from(attempts)
    .where(
      and(
        eq(attempts.executorKey, executorKey),
        inArray(attempts.status, ["submitted", "evaluated"])
      )
    );
  return Array.from(new Set(rows.map((r) => r.problemType as ProblemType)));
}

async function getRandomSubmissionForType(problemType: ProblemType) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(submissions)
    .where(eq(submissions.problemType, problemType))
    .orderBy(sql`RANDOM()`)
    .limit(1);
  return row ?? null;
}

export type AssignExecuteResult =
  | { kind: "waiting" }
  | { kind: "finished" }
  | { kind: "noneAvailable" }
  | { kind: "resumed"; attempt: typeof attempts.$inferSelect; submission: typeof submissions.$inferSelect }
  | { kind: "created"; attempt: typeof attempts.$inferSelect; submission: typeof submissions.$inferSelect };

export async function assignExecuteAttempt(
  studentKey: string,
  courseId: number
): Promise<AssignExecuteResult> {
  const stage2Active = await getStage2Active(courseId);
  if (!stage2Active) return { kind: "waiting" };

  const assignment = getAssignment(studentKey);
  if (!assignment) return { kind: "finished" };

  const resumable = await findInProgressAttempt(studentKey);
  if (resumable) {
    const db = await getDb();
    const [submission] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, resumable.submissionId));
    if (submission) return { kind: "resumed", attempt: resumable, submission };
  }

  const done = await completedExecuteTypes(studentKey);
  const remaining = assignment.execute.filter((t) => !done.includes(t));
  if (remaining.length === 0) return { kind: "finished" };

  for (const problemType of remaining) {
    const submission = await getRandomSubmissionForType(problemType);
    if (!submission) continue;

    const { input, correctAnswer, referenceActionCount, state } = generateInstance(problemType);
    const db = await getDb();
    const [attempt] = await db
      .insert(attempts)
      .values({
        submissionId: submission.id,
        problemType,
        executorKey: studentKey,
        executorId: assignment.studentId,
        executorName: assignment.name,
        input,
        correctAnswer,
        referenceActionCount,
        state,
        actionLog: [] as LogEntry[],
        actionCount: 0,
        status: "in_progress",
        createdAt: new Date().toISOString(),
      })
      .returning();

    return { kind: "created", attempt, submission };
  }

  return { kind: "noneAvailable" };
}

export async function getAttempt(id: number) {
  const db = await getDb();
  const [row] = await db.select().from(attempts).where(eq(attempts.id, id));
  return row ?? null;
}

/**
 * Same as `getAttempt`, but throws `OwnershipError` if the caller's session
 * studentKey isn't the executor who owns this attempt — the IDOR gate for
 * every execute/* endpoint. attemptId is a small sequential integer, so
 * without this check any logged-in student could read or mutate any other
 * student's in-progress attempt just by guessing/incrementing the id.
 */
export async function getOwnedAttempt(attemptId: number, ownerStudentKey: string) {
  const attempt = await getAttempt(attemptId);
  if (!attempt) throw new Error("attempt not found");
  if (attempt.executorKey !== ownerStudentKey) {
    throw new OwnershipError("본인이 실행 중인 시도가 아닙니다");
  }
  return attempt;
}

export async function getAttemptAlgorithmText(attempt: typeof attempts.$inferSelect) {
  const db = await getDb();
  const [submission] = await db
    .select({ algorithmText: submissions.algorithmText })
    .from(submissions)
    .where(eq(submissions.id, attempt.submissionId));
  return submission?.algorithmText ?? "";
}

export async function applyActionAndPersist(
  attemptId: number,
  ownerStudentKey: string,
  action: string,
  params: Record<string, unknown>
) {
  const attempt = await getOwnedAttempt(attemptId, ownerStudentKey);
  if (attempt.status !== "in_progress") throw new Error("attempt is no longer in progress");

  const outcome = applyProblemAction(
    attempt.problemType as ProblemType,
    attempt.state,
    attempt.input,
    action,
    params
  );

  const entry: LogEntry = {
    at: new Date().toISOString(),
    type: "action",
    action,
    params,
    result: outcome.result,
  };
  const actionLog = [...((attempt.actionLog as LogEntry[]) ?? []), entry];
  const actionCount = attempt.actionCount + (outcome.counted ? 1 : 0);

  const db = await getDb();
  const [updated] = await db
    .update(attempts)
    .set({ state: outcome.state, actionLog, actionCount })
    .where(eq(attempts.id, attemptId))
    .returning();
  return updated;
}

export async function recordUnexecutable(attemptId: number, ownerStudentKey: string, reason: string) {
  const attempt = await getOwnedAttempt(attemptId, ownerStudentKey);
  if (attempt.status !== "in_progress") throw new Error("attempt is no longer in progress");

  const entry: LogEntry = { at: new Date().toISOString(), type: "unexecutable", reason };
  const actionLog = [...((attempt.actionLog as LogEntry[]) ?? []), entry];
  const combinedReason = attempt.unexecutableReason ? `${attempt.unexecutableReason}\n${reason}` : reason;

  const db = await getDb();
  const [updated] = await db
    .update(attempts)
    .set({ actionLog, unexecutableFlag: true, unexecutableReason: combinedReason })
    .where(eq(attempts.id, attemptId))
    .returning();
  return updated;
}

export async function submitFinalAnswer(
  attemptId: number,
  ownerStudentKey: string,
  finalAnswer: number
) {
  const attempt = await getOwnedAttempt(attemptId, ownerStudentKey);
  if (attempt.status !== "in_progress") throw new Error("attempt is no longer in progress");

  const isCorrect = Number.isInteger(finalAnswer) && finalAnswer === attempt.correctAnswer;
  const db = await getDb();
  const [updated] = await db
    .update(attempts)
    .set({
      finalAnswer,
      isCorrect,
      status: "submitted",
      submittedAt: new Date().toISOString(),
    })
    .where(eq(attempts.id, attemptId))
    .returning();
  return updated;
}

export type EvaluationResponses = {
  couldFollowFully: boolean;
  unexecutablePoint: string;
  hadAmbiguity: boolean;
  ambiguityNote: string;
  consideredCorrect: boolean;
  correctnessReason: string;
  // Additive star-rating + short free-text extension (see
  // lib/evaluationValidation.ts). Optional so that (a) evaluation JSON saved
  // before this extension existed keeps deserializing correctly with these
  // fields simply absent ("별점 없음"), and (b) a submission that omits them
  // — the current execute-page client does not send them yet — still stores
  // a valid record instead of failing.
  clarityRating?: number;
  accuracyRating?: number;
  efficiencyRating?: number;
  subjectiveFeedback?: string;
};

export async function submitEvaluation(
  attemptId: number,
  ownerStudentKey: string,
  evaluation: EvaluationResponses
) {
  const attempt = await getOwnedAttempt(attemptId, ownerStudentKey);
  if (attempt.status !== "submitted") throw new Error("submit a final answer before evaluating");

  const db = await getDb();
  const [updated] = await db
    .update(attempts)
    .set({
      evaluationResponses: evaluation,
      status: "evaluated",
      evaluatedAt: new Date().toISOString(),
    })
    .where(eq(attempts.id, attemptId))
    .returning();
  return updated;
}

/** Executor-facing view of an attempt: hides secret input fields and, until the
 * final answer is graded, the correct answer / reference action count. */
export function sanitizeAttempt(
  attempt: typeof attempts.$inferSelect,
  algorithmText: string,
  options: { revealAnswer?: boolean } = {}
) {
  const base = {
    id: attempt.id,
    problemType: attempt.problemType,
    algorithmText,
    input: publicInputFor(attempt.problemType as ProblemType, attempt.input),
    state: attempt.state,
    actionLog: attempt.actionLog,
    actionCount: attempt.actionCount,
    unexecutableFlag: attempt.unexecutableFlag,
    status: attempt.status,
    finalAnswer: attempt.finalAnswer,
  };
  if (!options.revealAnswer) return base;
  return {
    ...base,
    correctAnswer: attempt.correctAnswer,
    referenceActionCount: attempt.referenceActionCount,
    isCorrect: attempt.isCorrect,
  };
}

// ---------------------------------------------------------------------------
// Teacher views
// ---------------------------------------------------------------------------

export async function teacherDashboard() {
  const db = await getDb();
  const allSubmissions = await db.select().from(submissions);
  const allAttempts = await db.select().from(attempts);

  return listAssignments().map((assignment) => {
    const write = assignment.write.map((problemType) => {
      const submission = allSubmissions.find(
        (s) => s.studentKey === assignment.studentKey && s.problemType === problemType
      );
      return { problemType, submitted: Boolean(submission), submittedAt: submission?.createdAt ?? null };
    });
    const execute = assignment.execute.map((problemType) => {
      const attempt = allAttempts.find(
        (a) =>
          a.executorKey === assignment.studentKey &&
          a.problemType === problemType &&
          (a.status === "submitted" || a.status === "evaluated")
      );
      return {
        problemType,
        executed: Boolean(attempt),
        isCorrect: attempt?.isCorrect ?? null,
        status: attempt?.status ?? null,
      };
    });
    return {
      studentKey: assignment.studentKey,
      studentId: assignment.studentId,
      name: assignment.name,
      write,
      execute,
      writeComplete: write.every((w) => w.submitted),
    };
  });
}

type ReviewItem = {
  submission: typeof submissions.$inferSelect;
  attempts: (typeof attempts.$inferSelect)[];
};

export async function teacherReview() {
  const db = await getDb();
  const allSubmissions = await db.select().from(submissions).orderBy(submissions.problemType);
  const allAttempts = await db.select().from(attempts);

  const byType = new Map<ProblemType, ReviewItem[]>();
  for (const submission of allSubmissions) {
    const problemType = submission.problemType as ProblemType;
    const list = byType.get(problemType) ?? [];
    const relatedAttempts = allAttempts.filter((a) => a.submissionId === submission.id);
    list.push({ submission, attempts: relatedAttempts });
    byType.set(problemType, list);
  }
  return Array.from(byType.entries()).map(([problemType, items]) => ({ problemType, items }));
}
