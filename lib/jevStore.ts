import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { jevBatchEvaluations } from "@/db/schema";
import type { BatchEvaluationSummary } from "@/lib/jev/batchEvaluate";

export interface SaveJevBatchEvaluationInput {
  courseId: number;
  roundId?: number;
  studentKey: string;
  studentId: string;
  studentName: string;
  problemId: string;
  algorithmSteps: string[];
  summary: BatchEvaluationSummary;
}

export async function saveJevBatchEvaluation(input: SaveJevBatchEvaluationInput) {
  const db = await getDb();
  const [row] = await db
    .insert(jevBatchEvaluations)
    .values({
      courseId: input.courseId,
      roundId: input.roundId ?? null,
      studentKey: input.studentKey,
      studentId: input.studentId,
      studentName: input.studentName,
      problemId: input.problemId,
      algorithmSteps: input.algorithmSteps,
      totalTrials: input.summary.totalTrials,
      correctCount: input.summary.correctCount,
      incorrectCount: input.summary.incorrectCount,
      errorCount: input.summary.errorCount,
      trials: input.summary.trials,
      createdAt: new Date().toISOString(),
    })
    .returning();
  return row;
}

/** Most recent runs first, for one student's own history view. */
export async function listJevBatchEvaluations(studentKey: string, limit = 20) {
  const db = await getDb();
  return db
    .select()
    .from(jevBatchEvaluations)
    .where(eq(jevBatchEvaluations.studentKey, studentKey))
    .orderBy(desc(jevBatchEvaluations.createdAt))
    .limit(limit);
}

/**
 * The single most recent batch-evaluation row for a student in this course,
 * regardless of which round it came from — drives the read-only "내 결과"
 * card on /write. Teacher-triggered batch runs are the only thing that
 * writes these rows, so a null return just means nothing's been run yet.
 */
export async function getLatestJevResultForStudent(courseId: number, studentKey: string) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(jevBatchEvaluations)
    .where(and(eq(jevBatchEvaluations.courseId, courseId), eq(jevBatchEvaluations.studentKey, studentKey)))
    .orderBy(desc(jevBatchEvaluations.createdAt))
    .limit(1);
  return row ?? null;
}
