import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { warmupExperiences, warmupRounds, warmupSubmissions, warmupVotes } from "@/db/schema";
import { ensureDemoSubmissionsForRound } from "@/lib/warmupDemoSubmissions";
import { WARMUP_VOTE_TYPES, type WarmupVoteType } from "@/lib/warmupMeta";
import { sanitizeCheckedSteps, splitAlgorithmIntoSteps } from "@/lib/warmupSteps";
import {
  assertWarmupRoundDeletable,
  assertWarmupRoundExists,
  WarmupNotFoundError,
  WarmupOwnershipError,
  WarmupStateError,
} from "@/lib/warmupRoundGuards";

export { WarmupNotFoundError, WarmupOwnershipError, WarmupStateError };

// ---------------------------------------------------------------------------
// Teacher: round lifecycle
// ---------------------------------------------------------------------------

export async function createWarmupRound(courseId: number, title: string, prompt: string, problemId: string | null) {
  const db = await getDb();
  const [row] = await db
    .insert(warmupRounds)
    .values({ courseId, title, prompt, problemId, status: "draft", createdAt: new Date().toISOString() })
    .returning();
  await ensureDemoSubmissionsForRound(row);
  return row;
}

export async function getWarmupRound(id: number) {
  const db = await getDb();
  const [row] = await db.select().from(warmupRounds).where(eq(warmupRounds.id, id));
  return row ?? null;
}

export async function getOpenWarmupRound(courseId: number) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(warmupRounds)
    .where(and(eq(warmupRounds.courseId, courseId), eq(warmupRounds.status, "open")))
    .orderBy(desc(warmupRounds.id));
  return row ?? null;
}

/**
 * The currently open round (if any) plus which students have already
 * submitted to it — the roster tab's only need from the warm-up domain, kept
 * separate from `teacherWarmupRoundDetail` (which also loads votes/
 * experiences/full algorithm text, unnecessary for a submitted/not-submitted
 * column).
 */
export async function getOpenWarmupRoundWithSubmitters(courseId: number) {
  const round = await getOpenWarmupRound(courseId);
  if (!round) return null;

  const db = await getDb();
  const rows = await db
    .select({ studentKey: warmupSubmissions.studentKey })
    .from(warmupSubmissions)
    .where(and(eq(warmupSubmissions.roundId, round.id), eq(warmupSubmissions.isDemo, false)));

  return { id: round.id, title: round.title, submittedStudentKeys: rows.map((r) => r.studentKey) };
}

function countByRound<T extends { roundId: number }>(rows: T[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const row of rows) map.set(row.roundId, (map.get(row.roundId) ?? 0) + 1);
  return map;
}

export async function listWarmupRoundsForCourse(courseId: number) {
  const db = await getDb();
  const rounds = await db
    .select()
    .from(warmupRounds)
    .where(eq(warmupRounds.courseId, courseId))
    .orderBy(desc(warmupRounds.id));
  if (rounds.length === 0) return [];

  const ids = rounds.map((r) => r.id);
  const [submissionRows, voteRows, experienceRows] = await Promise.all([
    // Demo example cards aren't real student submissions — excluded here so
    // this count keeps meaning "how many students wrote their own algorithm".
    // Votes/experiences a real student casts on a demo card ARE real
    // engagement, so those two counts below are not filtered.
    db
      .select({ roundId: warmupSubmissions.roundId })
      .from(warmupSubmissions)
      .where(and(inArray(warmupSubmissions.roundId, ids), eq(warmupSubmissions.isDemo, false))),
    db.select({ roundId: warmupVotes.roundId }).from(warmupVotes).where(inArray(warmupVotes.roundId, ids)),
    db
      .select({ roundId: warmupExperiences.roundId })
      .from(warmupExperiences)
      .where(inArray(warmupExperiences.roundId, ids)),
  ]);
  const submissionCounts = countByRound(submissionRows);
  const voteCounts = countByRound(voteRows);
  const experienceCounts = countByRound(experienceRows);

  return rounds.map((round) => ({
    ...round,
    submissionCount: submissionCounts.get(round.id) ?? 0,
    voteCount: voteCounts.get(round.id) ?? 0,
    experienceCount: experienceCounts.get(round.id) ?? 0,
  }));
}

export async function publishWarmupRound(id: number, courseId: number) {
  const round = assertWarmupRoundExists(await getWarmupRound(id), courseId);
  if (round.status === "closed") throw new WarmupStateError("종료된 라운드는 다시 공개할 수 없습니다");
  if (round.status === "open") return round;

  const existingOpen = await getOpenWarmupRound(courseId);
  if (existingOpen && existingOpen.id !== id) {
    throw new WarmupStateError("이미 진행 중인 라운드가 있습니다. 먼저 종료하세요.");
  }

  const db = await getDb();
  const [updated] = await db
    .update(warmupRounds)
    .set({ status: "open", publishedAt: new Date().toISOString() })
    .where(eq(warmupRounds.id, id))
    .returning();
  await ensureDemoSubmissionsForRound(updated);
  return updated;
}

export async function closeWarmupRound(id: number, courseId: number) {
  const round = assertWarmupRoundExists(await getWarmupRound(id), courseId);
  if (round.status !== "open") throw new WarmupStateError("진행 중인 라운드가 아닙니다");

  const db = await getDb();
  const [updated] = await db
    .update(warmupRounds)
    .set({ status: "closed", closedAt: new Date().toISOString() })
    .where(eq(warmupRounds.id, id))
    .returning();
  return updated;
}

/**
 * Deletes a draft/closed round and every row that hangs off it (votes,
 * experiences, submissions). Irreversible, so all four deletes run as one D1
 * batch — atomic (all-or-nothing), instead of risking a partial delete if a
 * later statement fails.
 */
export async function deleteWarmupRound(id: number, courseId: number) {
  const round = await getWarmupRound(id);
  assertWarmupRoundDeletable(round, courseId);

  const db = await getDb();
  await db.batch([
    db.delete(warmupVotes).where(eq(warmupVotes.roundId, id)),
    db.delete(warmupExperiences).where(eq(warmupExperiences.roundId, id)),
    db.delete(warmupSubmissions).where(eq(warmupSubmissions.roundId, id)),
    db.delete(warmupRounds).where(eq(warmupRounds.id, id)),
  ]);
}

export async function teacherWarmupRoundDetail(id: number, courseId: number) {
  const round = await getWarmupRound(id);
  if (!round || round.courseId !== courseId) return null;

  const db = await getDb();
  const submissions = await db
    .select()
    .from(warmupSubmissions)
    .where(eq(warmupSubmissions.roundId, id))
    .orderBy(warmupSubmissions.id);
  const submissionIds = submissions.map((s) => s.id);

  const [votes, experiences] = submissionIds.length
    ? await Promise.all([
        db.select().from(warmupVotes).where(inArray(warmupVotes.submissionId, submissionIds)),
        db.select().from(warmupExperiences).where(inArray(warmupExperiences.submissionId, submissionIds)),
      ])
    : [[], []];

  const items = submissions.map((submission) => ({
    submission,
    voteCounts: tallyVotes(votes.filter((v) => v.submissionId === submission.id)),
    experiences: experiences.filter((e) => e.submissionId === submission.id),
  }));

  return { round, items };
}

function tallyVotes(votes: { voteType: string }[]): Record<WarmupVoteType, number> {
  const counts = Object.fromEntries(WARMUP_VOTE_TYPES.map((t) => [t, 0])) as Record<WarmupVoteType, number>;
  for (const vote of votes) {
    if ((WARMUP_VOTE_TYPES as readonly string[]).includes(vote.voteType)) {
      counts[vote.voteType as WarmupVoteType] += 1;
    }
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Students: submit
// ---------------------------------------------------------------------------

export async function getMyWarmupSubmission(roundId: number, studentKey: string) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(warmupSubmissions)
    .where(and(eq(warmupSubmissions.roundId, roundId), eq(warmupSubmissions.studentKey, studentKey)));
  return row ?? null;
}

export async function upsertWarmupSubmission(input: {
  roundId: number;
  studentKey: string;
  studentId: string;
  studentName: string;
  algorithmText: string;
}) {
  const round = await getWarmupRound(input.roundId);
  if (!round || round.status !== "open") {
    throw new WarmupStateError("현재 진행 중인 라운드가 아닙니다");
  }

  const db = await getDb();
  const now = new Date().toISOString();
  const existing = await getMyWarmupSubmission(input.roundId, input.studentKey);
  if (existing) {
    const [updated] = await db
      .update(warmupSubmissions)
      .set({ algorithmText: input.algorithmText, updatedAt: now })
      .where(eq(warmupSubmissions.id, existing.id))
      .returning();
    return updated;
  }

  // Demo example cards are excluded so real participants are still numbered
  // "참가자 1", "참가자 2", ... regardless of how many demo cards exist.
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(warmupSubmissions)
    .where(and(eq(warmupSubmissions.roundId, input.roundId), eq(warmupSubmissions.isDemo, false)));
  const anonLabel = `참가자 ${count + 1}`;

  const [created] = await db
    .insert(warmupSubmissions)
    .values({
      roundId: input.roundId,
      studentKey: input.studentKey,
      studentId: input.studentId,
      studentName: input.studentName,
      anonLabel,
      algorithmText: input.algorithmText,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return created;
}

// ---------------------------------------------------------------------------
// Students: anonymous board + voting
// ---------------------------------------------------------------------------

export type BoardEntry = {
  id: number;
  anonLabel: string;
  algorithmText: string;
  voteCounts: Record<WarmupVoteType, number>;
  myVotes: WarmupVoteType[];
  experienced: boolean;
};

export async function listBoardSubmissions(roundId: number, viewerStudentKey: string): Promise<BoardEntry[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(warmupSubmissions)
    .where(and(eq(warmupSubmissions.roundId, roundId), ne(warmupSubmissions.studentKey, viewerStudentKey)))
    .orderBy(warmupSubmissions.id);
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const [allVotes, allExperiences] = await Promise.all([
    db.select().from(warmupVotes).where(inArray(warmupVotes.submissionId, ids)),
    db
      .select({
        submissionId: warmupExperiences.submissionId,
        executorStudentKey: warmupExperiences.executorStudentKey,
      })
      .from(warmupExperiences)
      .where(inArray(warmupExperiences.submissionId, ids)),
  ]);

  const experiencedIds = new Set(
    allExperiences.filter((e) => e.executorStudentKey === viewerStudentKey).map((e) => e.submissionId)
  );

  return rows.map((row) => {
    const votesForRow = allVotes.filter((v) => v.submissionId === row.id);
    const voteCounts = tallyVotes(votesForRow);
    const myVotes = votesForRow
      .filter((v) => v.voterStudentKey === viewerStudentKey)
      .map((v) => v.voteType as WarmupVoteType);
    return {
      id: row.id,
      anonLabel: row.anonLabel,
      algorithmText: row.algorithmText,
      voteCounts,
      myVotes,
      experienced: experiencedIds.has(row.id),
    };
  });
}

export async function toggleWarmupVote(input: {
  submissionId: number;
  voterStudentKey: string;
  voterCourseId: number;
  voteType: WarmupVoteType;
}): Promise<{ voted: boolean }> {
  const db = await getDb();
  const [submission] = await db
    .select()
    .from(warmupSubmissions)
    .where(eq(warmupSubmissions.id, input.submissionId));
  if (!submission) throw new Error("제출을 찾을 수 없습니다");
  if (submission.studentKey === input.voterStudentKey) {
    throw new WarmupOwnershipError("본인 제출에는 투표할 수 없습니다");
  }

  const round = await getWarmupRound(submission.roundId);
  if (!round || round.courseId !== input.voterCourseId) throw new Error("제출을 찾을 수 없습니다");
  if (round.status !== "open") throw new WarmupStateError("현재 진행 중인 라운드가 아닙니다");

  const [existing] = await db
    .select()
    .from(warmupVotes)
    .where(
      and(
        eq(warmupVotes.submissionId, input.submissionId),
        eq(warmupVotes.voterStudentKey, input.voterStudentKey),
        eq(warmupVotes.voteType, input.voteType)
      )
    );

  if (existing) {
    await db.delete(warmupVotes).where(eq(warmupVotes.id, existing.id));
    return { voted: false };
  }

  await db.insert(warmupVotes).values({
    submissionId: input.submissionId,
    roundId: submission.roundId,
    voterStudentKey: input.voterStudentKey,
    voteType: input.voteType,
    createdAt: new Date().toISOString(),
  });
  return { voted: true };
}

// ---------------------------------------------------------------------------
// Students: generic step-check experience
// ---------------------------------------------------------------------------

export async function getBoardSubmissionForViewer(
  submissionId: number,
  viewerStudentKey: string,
  viewerCourseId: number
) {
  const db = await getDb();
  const [row] = await db.select().from(warmupSubmissions).where(eq(warmupSubmissions.id, submissionId));
  if (!row) throw new Error("제출을 찾을 수 없습니다");

  const round = await getWarmupRound(row.roundId);
  if (!round || round.courseId !== viewerCourseId) throw new Error("제출을 찾을 수 없습니다");
  if (row.studentKey === viewerStudentKey) {
    throw new WarmupOwnershipError("본인 제출은 체험할 수 없습니다");
  }

  return {
    id: row.id,
    anonLabel: row.anonLabel,
    algorithmText: row.algorithmText,
    roundId: row.roundId,
    roundStatus: round.status,
  };
}

export async function upsertWarmupExperience(input: {
  submissionId: number;
  executorStudentKey: string;
  executorCourseId: number;
  executorId: string;
  executorName: string;
  checkedSteps: unknown;
  executable: boolean;
  feedback: string;
}) {
  const db = await getDb();
  const [submission] = await db
    .select()
    .from(warmupSubmissions)
    .where(eq(warmupSubmissions.id, input.submissionId));
  if (!submission) throw new Error("제출을 찾을 수 없습니다");
  if (submission.studentKey === input.executorStudentKey) {
    throw new WarmupOwnershipError("본인 제출은 체험할 수 없습니다");
  }

  const round = await getWarmupRound(submission.roundId);
  if (!round || round.courseId !== input.executorCourseId) throw new Error("제출을 찾을 수 없습니다");
  if (round.status !== "open") throw new WarmupStateError("현재 진행 중인 라운드가 아닙니다");

  const totalSteps = splitAlgorithmIntoSteps(submission.algorithmText).length;
  const checkedSteps = sanitizeCheckedSteps(input.checkedSteps, totalSteps);
  const now = new Date().toISOString();

  const [existing] = await db
    .select()
    .from(warmupExperiences)
    .where(
      and(
        eq(warmupExperiences.submissionId, input.submissionId),
        eq(warmupExperiences.executorStudentKey, input.executorStudentKey)
      )
    );

  if (existing) {
    const [updated] = await db
      .update(warmupExperiences)
      .set({ checkedSteps, totalSteps, executable: input.executable, feedback: input.feedback, updatedAt: now })
      .where(eq(warmupExperiences.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(warmupExperiences)
    .values({
      submissionId: input.submissionId,
      roundId: submission.roundId,
      executorStudentKey: input.executorStudentKey,
      executorId: input.executorId,
      executorName: input.executorName,
      checkedSteps,
      totalSteps,
      executable: input.executable,
      feedback: input.feedback,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return created;
}

export async function getMyWarmupExperience(submissionId: number, executorStudentKey: string) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(warmupExperiences)
    .where(
      and(
        eq(warmupExperiences.submissionId, submissionId),
        eq(warmupExperiences.executorStudentKey, executorStudentKey)
      )
    );
  return row ?? null;
}
