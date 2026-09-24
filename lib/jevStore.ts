import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { jevBatchEvaluations, warmupRounds, warmupSubmissions } from "@/db/schema";

/** Only verified teacher/API results belonging to a still-existing submission.
 * Legacy and mock records are never presented as real AI feedback. */
export async function getLatestJevResultForStudent(courseId: number, studentKey: string) {
  const db = await getDb();
  const [row] = await db.select({ result: jevBatchEvaluations, roundTitle: warmupRounds.title })
    .from(jevBatchEvaluations)
    .innerJoin(warmupRounds, eq(jevBatchEvaluations.roundId, warmupRounds.id))
    .innerJoin(warmupSubmissions, eq(jevBatchEvaluations.submissionId, warmupSubmissions.id))
    .where(and(
      eq(jevBatchEvaluations.courseId, courseId), eq(warmupRounds.courseId, courseId),
      eq(jevBatchEvaluations.studentKey, studentKey), eq(warmupSubmissions.studentKey, studentKey),
      eq(jevBatchEvaluations.source, "teacher"), eq(jevBatchEvaluations.mode, "jev-api"),
    )).orderBy(desc(jevBatchEvaluations.id)).limit(1);
  return row ?? null;
}
