import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { attempts, stageState, submissions } from "@/db/schema";
import { getAssignment, listAssignments, type ProblemType } from "@/lib/assignments";
import { applyProblemAction, generateInstance, publicInputFor } from "@/lib/problems";
import type { LogEntry } from "@/lib/problems/types";

const STAGE_ROW_ID = 1;

// ---------------------------------------------------------------------------
// Stage 2 gate
// ---------------------------------------------------------------------------

export async function getStage2Active(): Promise<boolean> {
  const db = await getDb();
  const [row] = await db.select().from(stageState).where(eq(stageState.id, STAGE_ROW_ID));
  return row?.stage2Active ?? false;
}

export async function activateStage2(): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db
    .insert(stageState)
    .values({ id: STAGE_ROW_ID, stage2Active: true, activatedAt: now })
    .onConflictDoUpdate({
      target: stageState.id,
      set: { stage2Active: true, activatedAt: now },
    });
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

export async function assignExecuteAttempt(studentKey: string): Promise<AssignExecuteResult> {
  const stage2Active = await getStage2Active();
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
  action: string,
  params: Record<string, unknown>
) {
  const attempt = await getAttempt(attemptId);
  if (!attempt) throw new Error("attempt not found");
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

export async function recordUnexecutable(attemptId: number, reason: string) {
  const attempt = await getAttempt(attemptId);
  if (!attempt) throw new Error("attempt not found");
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

export async function submitFinalAnswer(attemptId: number, finalAnswer: number) {
  const attempt = await getAttempt(attemptId);
  if (!attempt) throw new Error("attempt not found");
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
};

export async function submitEvaluation(attemptId: number, evaluation: EvaluationResponses) {
  const attempt = await getAttempt(attemptId);
  if (!attempt) throw new Error("attempt not found");
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
