import { getDb } from "@/db";
import { warmupSubmissions } from "@/db/schema";
import {
  demoStudentKey,
  getDemoAlgorithmsForProblem,
  resolveDemoProblemId,
  WARMUP_DEMO_SUBMISSIONS_ENABLED,
} from "@/lib/warmupDemoAlgorithms";

export {
  demoStudentKey,
  getDemoAlgorithmsForProblem,
  isDemoStudentKey,
  WARMUP_DEMO_SUBMISSIONS_ENABLED,
} from "@/lib/warmupDemoAlgorithms";

/**
 * Idempotently seeds the round's 3 example submissions, if its source
 * problem has a demo set and they don't already exist. Safe to call
 * repeatedly (on round create, on publish, and lazily on first board load)
 * and safe under concurrent calls: each row is inserted with
 * `onConflictDoNothing`, relying on the (round_id, student_key) unique index
 * — the same index real submissions rely on — so two simultaneous callers
 * can never create duplicates.
 */
export async function ensureDemoSubmissionsForRound(round: {
  id: number;
  problemId: string | null;
  title?: string;
  prompt?: string;
}): Promise<void> {
  if (!WARMUP_DEMO_SUBMISSIONS_ENABLED) return;
  const problemId = resolveDemoProblemId(round);
  const examples = getDemoAlgorithmsForProblem(problemId);
  if (!examples) return;

  const db = await getDb();
  const now = new Date().toISOString();
  await db.batch(
    examples.map((example) =>
      db
        .insert(warmupSubmissions)
        .values({
          roundId: round.id,
          studentKey: demoStudentKey(problemId as string, example.label),
          studentId: "DEMO",
          studentName: `예시 ${example.label}`,
          anonLabel: `예시 ${example.label}`,
          algorithmText: example.algorithmText,
          isDemo: true,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing()
    )
  );
}
