import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { warmupAssignmentReassignments, warmupExecutions, warmupExperiences, warmupPeerAssignments, warmupReflections, warmupRounds, warmupSubmissions, warmupTeacherAssessments, warmupVersions, warmupVotes } from "@/db/schema";
import { WARMUP_VOTE_TYPES, type WarmupVoteType } from "@/lib/warmupMeta";
import { listAssignments } from "@/lib/roster";
import { planBalancedReassignment } from "@/lib/peerReassignment";
import { sanitizeCheckedSteps, splitAlgorithmIntoSteps } from "@/lib/warmupSteps";
import {
  assertWarmupRoundDeletable,
  assertWarmupRoundExists,
  WarmupNotFoundError,
  WarmupOwnershipError,
  WarmupStateError,
} from "@/lib/warmupRoundGuards";

export { WarmupNotFoundError, WarmupOwnershipError, WarmupStateError };

const REQUIRED_PEER_REVIEWS = 3;

function fullyExecutedStudentKeys(rows: { executorStudentKey: string; submissionId: number }[]) {
  const byStudent = new Map<string, Set<number>>();
  for (const row of rows) {
    const set = byStudent.get(row.executorStudentKey) ?? new Set<number>();
    set.add(row.submissionId);
    byStudent.set(row.executorStudentKey, set);
  }
  return [...byStudent].filter(([, ids]) => ids.size >= REQUIRED_PEER_REVIEWS).map(([studentKey]) => studentKey);
}

// ---------------------------------------------------------------------------
// Teacher: round lifecycle
// ---------------------------------------------------------------------------

export async function createWarmupRound(courseId: number, title: string, prompt: string, problemId: string | null) {
  const db = await getDb();
  const [row] = await db
    .insert(warmupRounds)
    .values({ courseId, title, prompt, problemId, status: "draft", createdAt: new Date().toISOString() })
    .returning();
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
 * submitted to it, and which have fully evaluated the peer-review board
 * (see `fullyEvaluatedStudentKeys`) — the roster tab's only need from the
 * warm-up domain, kept separate from `teacherWarmupRoundDetail` (which also
 * loads full algorithm text/per-submission feedback, unnecessary for a
 * submitted/evaluated status column).
 */
export async function getOpenWarmupRoundWithSubmitters(courseId: number) {
  const round = await getOpenWarmupRound(courseId);
  if (!round) return null;

  const db = await getDb();
  const [submissionRows, executionRows] = await Promise.all([
    db
      .select({ id: warmupSubmissions.id, studentKey: warmupSubmissions.studentKey })
      .from(warmupSubmissions)
      .where(and(eq(warmupSubmissions.roundId, round.id), eq(warmupSubmissions.isDemo, false))),
    db.select({ submissionId: warmupExecutions.submissionId, executorStudentKey: warmupExecutions.executorStudentKey })
      .from(warmupExecutions).where(eq(warmupExecutions.roundId, round.id)),
  ]);

  return {
    id: round.id,
    title: round.title,
    reviewOpenedAt: round.reviewOpenedAt,
    submittedStudentKeys: submissionRows.map((r) => r.studentKey),
    evaluatedStudentKeys: fullyExecutedStudentKeys(executionRows),
  };
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
  const [submissionRows, voteRows, experienceRows, executionRows] = await Promise.all([
    db
      .select({
        roundId: warmupSubmissions.roundId,
        id: warmupSubmissions.id,
        studentKey: warmupSubmissions.studentKey,
      })
      .from(warmupSubmissions)
      .where(and(inArray(warmupSubmissions.roundId, ids), eq(warmupSubmissions.isDemo, false))),
    db
      .select({
        roundId: warmupVotes.roundId,
        submissionId: warmupVotes.submissionId,
        voterStudentKey: warmupVotes.voterStudentKey,
      })
      .from(warmupVotes)
      .where(inArray(warmupVotes.roundId, ids)),
    db
      .select({ roundId: warmupExperiences.roundId })
      .from(warmupExperiences)
      .where(inArray(warmupExperiences.roundId, ids)),
    db.select({ roundId: warmupExecutions.roundId, submissionId: warmupExecutions.submissionId, executorStudentKey: warmupExecutions.executorStudentKey })
      .from(warmupExecutions).where(inArray(warmupExecutions.roundId, ids)),
  ]);
  const submissionCounts = countByRound(submissionRows);
  const voteCounts = countByRound(voteRows);
  const experienceCounts = countByRound(experienceRows);

  return rounds.map((round) => {
    return {
      ...round,
      submissionCount: submissionCounts.get(round.id) ?? 0,
      voteCount: voteCounts.get(round.id) ?? 0,
      experienceCount: experienceCounts.get(round.id) ?? 0,
      evaluatedCount: fullyExecutedStudentKeys(executionRows.filter((row) => row.roundId === round.id)).length,
    };
  });
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
 * Manually opens the round's peer-review board for everyone who's
 * submitted — a teacher action taken after eyeballing the roster's
 * submission status, not an automatic "everyone submitted" trigger. Once
 * open it stays open (idempotent: a second call is a no-op) until the round
 * itself closes.
 */
export async function openWarmupReview(id: number, courseId: number) {
  const round = assertWarmupRoundExists(await getWarmupRound(id), courseId);
  if (round.status !== "open") throw new WarmupStateError("진행 중인 라운드만 평가 단계를 열 수 있습니다");
  if (!round.writingOpenedAt) throw new WarmupStateError("먼저 알고리즘 작성 단계를 시작하세요");
  if (round.reviewOpenedAt) return round;

  const db = await getDb();
  const submissions = await db.select().from(warmupSubmissions).where(and(eq(warmupSubmissions.roundId, id), eq(warmupSubmissions.isDemo, false))).orderBy(warmupSubmissions.id);
  if (submissions.length < 4) throw new WarmupStateError("3명씩 배정하려면 최소 4명의 제출이 필요합니다");
  const assignedAt = new Date().toISOString();
  const assignments = submissions.flatMap((submission, authorIndex) => [1, 2, 3].map((offset) => ({ roundId: id, submissionId: submission.id, evaluatorStudentKey: submissions[(authorIndex + offset) % submissions.length].studentKey, createdAt: assignedAt })));
  await db.batch(assignments.map((assignment) => db.insert(warmupPeerAssignments).values(assignment).onConflictDoNothing()));
  const [updated] = await db
    .update(warmupRounds)
    .set({ reviewOpenedAt: new Date().toISOString() })
    .where(eq(warmupRounds.id, id))
    .returning();
  return updated;
}

export async function reassignPendingPeerAssignments(input: { roundId:number; courseId:number; fromEvaluatorStudentKey:string }) {
  if (!input.fromEvaluatorStudentKey) throw new WarmupStateError("결석 학생을 선택하세요");
  const round = assertWarmupRoundExists(await getWarmupRound(input.roundId), input.courseId);
  if (round.status !== "open" || !round.reviewOpenedAt) throw new WarmupStateError("동료 평가 진행 중에만 재배정할 수 있습니다");
  if (round.selfReviewOpenedAt) throw new WarmupStateError("자기 평가가 시작된 뒤에는 평가자를 바꿀 수 없습니다");
  const rosterRows = await listAssignments(input.courseId);
  if (!rosterRows.some(row=>row.studentKey===input.fromEvaluatorStudentKey)) throw new WarmupNotFoundError("학생을 찾을 수 없습니다");
  const db = await getDb();
  const assignments = await db.select().from(warmupPeerAssignments).where(eq(warmupPeerAssignments.roundId,input.roundId));
  const completed = await db.select({submissionId:warmupExecutions.submissionId}).from(warmupExecutions).where(and(eq(warmupExecutions.roundId,input.roundId),eq(warmupExecutions.executorStudentKey,input.fromEvaluatorStudentKey)));
  const completedIds = new Set(completed.map(row=>row.submissionId));
  const submissions = await db.select({id:warmupSubmissions.id,studentKey:warmupSubmissions.studentKey}).from(warmupSubmissions).where(eq(warmupSubmissions.roundId,input.roundId));
  const authorBySubmission = new Map(submissions.map(row=>[row.id,row.studentKey]));
  const participantKeys=submissions.map(row=>row.studentKey).filter(key=>key!==input.fromEvaluatorStudentKey);
  const plan=planBalancedReassignment({absentStudentKey:input.fromEvaluatorStudentKey,participantStudentKeys:participantKeys,assignments,completedSubmissionIds:completedIds,authorBySubmission});
  if (!plan.pendingCount) throw new WarmupStateError("재배정할 미완료 평가가 없습니다");
  if (plan.unresolved.length) throw new WarmupStateError(`서로 다른 평가자 3명을 유지할 수 있는 학생이 부족합니다. 미배정 ${plan.unresolved.length}개`);
  const now = new Date().toISOString();
  await db.batch(plan.plans.flatMap(item=>[
    db.update(warmupPeerAssignments).set({evaluatorStudentKey:item.toEvaluatorStudentKey}).where(eq(warmupPeerAssignments.id,item.assignmentId)),
    db.insert(warmupAssignmentReassignments).values({roundId:input.roundId,assignmentId:item.assignmentId,submissionId:item.submissionId,fromEvaluatorStudentKey:input.fromEvaluatorStudentKey,toEvaluatorStudentKey:item.toEvaluatorStudentKey,createdAt:now}),
  ]));
  return { moved:plan.plans.length, replacements:new Set(plan.plans.map(item=>item.toEvaluatorStudentKey)).size };
}

export async function openWarmupStage(id: number, courseId: number, stage: 2 | 4) {
  const round = assertWarmupRoundExists(await getWarmupRound(id), courseId);
  if (round.status !== "open") throw new WarmupStateError("진행 중인 라운드만 단계를 시작할 수 있습니다");
  const db = await getDb();
  const now = new Date().toISOString();
  if (stage === 2) {
    if (round.writingOpenedAt) return round;
    const [updated] = await db.update(warmupRounds).set({ writingOpenedAt: now }).where(eq(warmupRounds.id, id)).returning();
    return updated;
  }
  if (!round.reviewOpenedAt) throw new WarmupStateError("먼저 동료 평가 단계를 시작하세요");
  if (round.selfReviewOpenedAt) return round;
  const submissions = await db.select({ id: warmupSubmissions.id }).from(warmupSubmissions).where(and(eq(warmupSubmissions.roundId, id), eq(warmupSubmissions.isDemo, false)));
  const versionRows = await db.select({ id: warmupVersions.id, submissionId: warmupVersions.submissionId, version: warmupVersions.version }).from(warmupVersions).where(eq(warmupVersions.roundId, id));
  const v1Ids = new Set(versionRows.filter((version) => version.version === 1).map((version) => version.id));
  const executionRows = await db.select({ versionId: warmupExecutions.versionId, submissionId: warmupExecutions.submissionId }).from(warmupExecutions).where(eq(warmupExecutions.roundId, id));
  const completedSubmissionIds = new Set<number>();
  for (const submission of submissions) {
    const count = executionRows.filter((execution) => execution.submissionId === submission.id && v1Ids.has(execution.versionId)).length;
    if (count >= REQUIRED_PEER_REVIEWS) completedSubmissionIds.add(submission.id);
  }
  if (completedSubmissionIds.size !== submissions.length) {
    throw new WarmupStateError(`모든 학생이 동료 평가 3개를 받은 뒤 4단계를 시작할 수 있습니다 (${completedSubmissionIds.size}/${submissions.length}명 완료)`);
  }
  const [updated] = await db.update(warmupRounds).set({ selfReviewOpenedAt: now }).where(eq(warmupRounds.id, id)).returning();
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
  const childSubmissions = await db.select({ id: warmupSubmissions.id }).from(warmupSubmissions).where(eq(warmupSubmissions.roundId, id));
  const childIds = childSubmissions.map((row) => row.id);
  await db.batch([
    db.delete(warmupAssignmentReassignments).where(eq(warmupAssignmentReassignments.roundId,id)),
    db.delete(warmupTeacherAssessments).where(childIds.length ? inArray(warmupTeacherAssessments.submissionId, childIds) : eq(warmupTeacherAssessments.id, -1)),
    db.delete(warmupReflections).where(childIds.length ? inArray(warmupReflections.submissionId, childIds) : eq(warmupReflections.id, -1)),
    db.delete(warmupPeerAssignments).where(eq(warmupPeerAssignments.roundId, id)),
    db.delete(warmupExecutions).where(eq(warmupExecutions.roundId, id)),
    db.delete(warmupVersions).where(eq(warmupVersions.roundId, id)),
    db.delete(warmupVotes).where(eq(warmupVotes.roundId, id)),
    db.delete(warmupExperiences).where(eq(warmupExperiences.roundId, id)),
    db.delete(warmupSubmissions).where(eq(warmupSubmissions.roundId, id)),
    db.delete(warmupRounds).where(eq(warmupRounds.id, id)),
  ]);
}

/**
 * Deletes one student's (or demo's) submission and everything that hangs off
 * it (votes, experiences) — the teacher's tool for pulling a stray or wrong
 * entry off a round's board without deleting the whole round. Works
 * regardless of round status (unlike `deleteWarmupRound`, which requires the
 * round to be closed first): a single-row cleanup like this doesn't carry
 * the same "students lose everything" risk.
 */
export async function deleteWarmupSubmission(submissionId: number, courseId: number): Promise<void> {
  const db = await getDb();
  const [submission] = await db.select().from(warmupSubmissions).where(eq(warmupSubmissions.id, submissionId));
  if (!submission) throw new WarmupNotFoundError("제출을 찾을 수 없습니다");

  const round = await getWarmupRound(submission.roundId);
  if (!round || round.courseId !== courseId) throw new WarmupNotFoundError("제출을 찾을 수 없습니다");

  await db.batch([
    db.delete(warmupAssignmentReassignments).where(eq(warmupAssignmentReassignments.submissionId, submissionId)),
    db.delete(warmupTeacherAssessments).where(eq(warmupTeacherAssessments.submissionId, submissionId)),
    db.delete(warmupPeerAssignments).where(eq(warmupPeerAssignments.submissionId, submissionId)),
    db.delete(warmupReflections).where(eq(warmupReflections.submissionId, submissionId)),
    db.delete(warmupExecutions).where(eq(warmupExecutions.submissionId, submissionId)),
    db.delete(warmupVersions).where(eq(warmupVersions.submissionId, submissionId)),
    db.delete(warmupVotes).where(eq(warmupVotes.submissionId, submissionId)),
    db.delete(warmupExperiences).where(eq(warmupExperiences.submissionId, submissionId)),
    db.delete(warmupSubmissions).where(eq(warmupSubmissions.id, submissionId)),
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

  const [votes, experiences, assignments, versions, executions, reflections, teacherAssessments] = await Promise.all([
    submissionIds.length
      ? db.select().from(warmupVotes).where(inArray(warmupVotes.submissionId, submissionIds))
      : Promise.resolve([]),
    submissionIds.length
      ? db.select().from(warmupExperiences).where(inArray(warmupExperiences.submissionId, submissionIds))
      : Promise.resolve([]),
    listAssignments(courseId),
    submissionIds.length ? db.select().from(warmupVersions).where(inArray(warmupVersions.submissionId, submissionIds)) : Promise.resolve([]),
    submissionIds.length ? db.select().from(warmupExecutions).where(inArray(warmupExecutions.submissionId, submissionIds)) : Promise.resolve([]),
    submissionIds.length ? db.select().from(warmupReflections).where(inArray(warmupReflections.submissionId, submissionIds)) : Promise.resolve([]),
    submissionIds.length ? db.select().from(warmupTeacherAssessments).where(inArray(warmupTeacherAssessments.submissionId, submissionIds)) : Promise.resolve([]),
  ]);

  const realSubmissions = submissions.filter((submission) => !submission.isDemo);
  const evaluatedKeys = new Set(fullyExecutedStudentKeys(executions));
  const submissionByStudent = new Map(realSubmissions.map((submission) => [submission.studentKey, submission]));
  const assignmentByStudent = new Map(assignments.map((assignment) => [assignment.studentKey, assignment]));

  const participants = assignments.map((assignment) => {
    const submission = submissionByStudent.get(assignment.studentKey);
    const studentVersions = submission ? versions.filter((version) => version.submissionId === submission.id) : [];
    const v1 = studentVersions.find((version) => version.version === 1);
    const finalVersion = studentVersions.find((version) => version.isFinal);
    const receivedCount = v1 ? executions.filter((execution) => execution.versionId === v1.id).length : 0;
    const assessmentCount = [v1, finalVersion].filter(Boolean).filter((version) => teacherAssessments.some((assessment) => assessment.versionId === version!.id)).length;
    return {
      studentKey: assignment.studentKey,
      studentId: assignment.studentId,
      studentName: assignment.name,
      school: assignment.school,
      submissionId: submission?.id ?? null,
      evaluated: evaluatedKeys.has(assignment.studentKey),
      peerReviewsGiven: new Set(executions.filter((execution) => execution.executorStudentKey === assignment.studentKey).map((execution) => execution.submissionId)).size,
      peerReviewsReceived: receivedCount,
      reflectionCompleted: submission ? reflections.some((reflection) => reflection.submissionId === submission.id) : false,
      finalSubmitted: Boolean(finalVersion),
      teacherAssessmentCount: assessmentCount,
    };
  });

  const items = submissions.map((submission) => ({
    submission,
    voteCounts: tallyVotes(votes.filter((v) => v.submissionId === submission.id)),
    votes: votes
      .filter((vote) => vote.submissionId === submission.id)
      .map((vote) => {
        const voter = assignmentByStudent.get(vote.voterStudentKey);
        return {
          voterStudentKey: vote.voterStudentKey,
          voterStudentId: voter?.studentId ?? "",
          voterStudentName: voter?.name ?? "알 수 없음",
          voteType: vote.voteType,
        };
      }),
    experiences: experiences.filter((e) => e.submissionId === submission.id),
    versions: versions.filter((v) => v.submissionId === submission.id).sort((a,b) => a.version - b.version),
    executions: executions.filter((e) => e.submissionId === submission.id),
    reflections: reflections.filter((r) => r.submissionId === submission.id),
    teacherAssessments: teacherAssessments.filter((assessment) => assessment.submissionId === submission.id),
  }));

  return { round, participants, items };
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
  revisionReason?: string;
  finalSubmission?: boolean;
}) {
  const round = await getWarmupRound(input.roundId);
  if (!round || round.status !== "open") {
    throw new WarmupStateError("현재 진행 중인 라운드가 아닙니다");
  }
  if (!round.writingOpenedAt) throw new WarmupStateError("아직 알고리즘 작성 단계가 시작되지 않았습니다");

  const db = await getDb();
  const now = new Date().toISOString();
  const existing = await getMyWarmupSubmission(input.roundId, input.studentKey);
  if (existing) {
    const [latest] = await db.select().from(warmupVersions).where(eq(warmupVersions.submissionId, existing.id)).orderBy(desc(warmupVersions.version));
    if (latest?.isFinal) throw new WarmupStateError("최종 제출이 완료되어 더 이상 수정할 수 없습니다");
    if (latest && latest.algorithmText === input.algorithmText) return existing;
    if (latest) {
      const executions = await db.select().from(warmupExecutions).where(eq(warmupExecutions.versionId, latest.id)).orderBy(warmupExecutions.id);
      if (input.finalSubmission === true && executions.length < REQUIRED_PEER_REVIEWS) throw new WarmupStateError("동료 평가 3개가 모두 도착한 뒤 최종 제출할 수 있습니다");
      if (input.finalSubmission === true && !round.selfReviewOpenedAt) throw new WarmupStateError("아직 자기 평가 단계가 시작되지 않았습니다");
      const [reflection] = await db.select().from(warmupReflections).where(eq(warmupReflections.versionId, latest.id));
      if (!reflection) throw new WarmupStateError("실행 결과 3개를 확인하고 먼저 자기 평가를 작성하세요");
      if (!input.revisionReason?.trim()) throw new WarmupStateError("수정 이유를 입력하세요");
    }
    const [updated] = await db
      .update(warmupSubmissions)
      .set({ algorithmText: input.algorithmText, updatedAt: now })
      .where(eq(warmupSubmissions.id, existing.id))
      .returning();
    await db.insert(warmupVersions).values({
      submissionId: existing.id,
      roundId: input.roundId,
      version: (latest?.version ?? 0) + 1,
      algorithmText: input.algorithmText,
      revisionReason: input.revisionReason?.trim() || null,
      isFinal: input.finalSubmission === true,
      createdAt: now,
    });
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
  await db.insert(warmupVersions).values({ submissionId: created.id, roundId: input.roundId, version: 1, algorithmText: input.algorithmText, isFinal: false, createdAt: now });
  return created;
}

export async function getResearchCycle(submissionId: number, studentKey: string, courseId: number) {
  const db = await getDb();
  const [submission] = await db.select().from(warmupSubmissions).where(eq(warmupSubmissions.id, submissionId));
  if (!submission) throw new WarmupNotFoundError("제출을 찾을 수 없습니다");
  const round = await getWarmupRound(submission.roundId);
  if (!round || round.courseId !== courseId) throw new WarmupNotFoundError("제출을 찾을 수 없습니다");
  const versions = await db.select().from(warmupVersions).where(eq(warmupVersions.submissionId, submissionId)).orderBy(warmupVersions.version);
  const executions = await db.select().from(warmupExecutions).where(eq(warmupExecutions.submissionId, submissionId)).orderBy(warmupExecutions.id);
  const reflections = await db.select().from(warmupReflections).where(eq(warmupReflections.submissionId, submissionId)).orderBy(warmupReflections.id);
  return { submission, versions, executions, reflections, isAuthor: submission.studentKey === studentKey };
}

export async function recordVersionExecution(input: { versionId: number; executorStudentKey: string; executorId: string; executorName: string; courseId: number; result: string; solvedStatus: string; problemLocation?: string; executionNote: string }) {
  const db = await getDb();
  const [version] = await db.select().from(warmupVersions).where(eq(warmupVersions.id, input.versionId));
  if (!version) throw new WarmupNotFoundError("버전을 찾을 수 없습니다");
  const [submission] = await db.select().from(warmupSubmissions).where(eq(warmupSubmissions.id, version.submissionId));
  const round = await getWarmupRound(version.roundId);
  if (!submission || !round || round.courseId !== input.courseId) throw new WarmupNotFoundError("버전을 찾을 수 없습니다");
  if (submission.studentKey === input.executorStudentKey) throw new WarmupOwnershipError("본인 알고리즘은 실행할 수 없습니다");
  const [assignment] = await db.select().from(warmupPeerAssignments).where(and(eq(warmupPeerAssignments.roundId, version.roundId), eq(warmupPeerAssignments.submissionId, version.submissionId), eq(warmupPeerAssignments.evaluatorStudentKey, input.executorStudentKey)));
  if (!assignment) throw new WarmupOwnershipError("배정되지 않은 알고리즘은 평가할 수 없습니다");
  const [existing] = await db.select().from(warmupExecutions).where(and(eq(warmupExecutions.versionId, input.versionId), eq(warmupExecutions.executorStudentKey, input.executorStudentKey)));
  if (existing) return existing;
  const [created] = await db.insert(warmupExecutions).values({ versionId: version.id, submissionId: version.submissionId, roundId: version.roundId, executorStudentKey: input.executorStudentKey, executorId: input.executorId, executorName: input.executorName, result: input.result, solvedStatus: input.solvedStatus, problemLocation: input.problemLocation?.trim() || null, executionNote: input.executionNote.trim(), createdAt: new Date().toISOString() }).returning();
  return created;
}

export async function recordAuthorReflection(input: { submissionId: number; studentKey: string; courseId: number; expectedMatch: string; problemLocation?: string; cause: string; plannedRevision: string }) {
  const db = await getDb();
  const [submission] = await db.select().from(warmupSubmissions).where(eq(warmupSubmissions.id, input.submissionId));
  if (!submission) throw new WarmupNotFoundError("제출을 찾을 수 없습니다");
  const round = await getWarmupRound(submission.roundId);
  if (!submission || !round || round.courseId !== input.courseId || submission.studentKey !== input.studentKey) throw new WarmupOwnershipError("작성자만 생각해보기를 기록할 수 있습니다");
  if (!round.selfReviewOpenedAt) throw new WarmupStateError("아직 자기 평가 단계가 시작되지 않았습니다");
  const [sourceVersion] = await db.select().from(warmupVersions).where(and(eq(warmupVersions.submissionId, submission.id), eq(warmupVersions.version, 1)));
  if (!sourceVersion) throw new WarmupNotFoundError("최초 알고리즘을 찾을 수 없습니다");
  const executions = await db.select().from(warmupExecutions).where(eq(warmupExecutions.versionId, sourceVersion.id)).orderBy(warmupExecutions.id);
  if (executions.length < REQUIRED_PEER_REVIEWS) throw new WarmupStateError("동료 평가 3개가 모두 도착한 뒤 자기 평가를 작성할 수 있습니다");
  const sourceExecutions = executions.slice(0, REQUIRED_PEER_REVIEWS);
  const [existing] = await db.select().from(warmupReflections).where(eq(warmupReflections.versionId, sourceVersion.id));
  if (existing) return existing;
  const [created] = await db.insert(warmupReflections).values({ executionId: sourceExecutions[0].id, versionId: sourceVersion.id, submissionId: submission.id, sourceExecutionIds: sourceExecutions.map((execution) => execution.id), peerFeedbackCount: sourceExecutions.length, expectedMatch: input.expectedMatch, problemLocation: input.problemLocation?.trim() || null, cause: input.cause.trim(), plannedRevision: input.plannedRevision.trim(), createdAt: new Date().toISOString() }).returning();
  return created;
}

export async function upsertTeacherAssessment(input: { versionId: number; courseId: number; clarity: number; completeness: number; accuracy: number; executability: number; solvedStatus: string; comment?: string }) {
  const scores = [input.clarity, input.completeness, input.accuracy, input.executability];
  if (scores.some((score) => !Number.isInteger(score) || score < 1 || score > 4)) throw new WarmupStateError("평가 점수는 각 항목 1~4점이어야 합니다");
  if (!["solved", "partial", "not_solved"].includes(input.solvedStatus)) throw new WarmupStateError("문제 해결 여부를 선택하세요");
  const db = await getDb();
  const [version] = await db.select().from(warmupVersions).where(eq(warmupVersions.id, input.versionId));
  if (!version) throw new WarmupNotFoundError("버전을 찾을 수 없습니다");
  const round = await getWarmupRound(version.roundId);
  if (!round || round.courseId !== input.courseId) throw new WarmupNotFoundError("버전을 찾을 수 없습니다");
  const now = new Date().toISOString();
  const values = { versionId: version.id, submissionId: version.submissionId, roundId: version.roundId, clarity: input.clarity, completeness: input.completeness, accuracy: input.accuracy, executability: input.executability, solvedStatus: input.solvedStatus, comment: input.comment?.trim() || null, updatedAt: now };
  const [existing] = await db.select().from(warmupTeacherAssessments).where(eq(warmupTeacherAssessments.versionId, version.id));
  if (existing) {
    const [updated] = await db.update(warmupTeacherAssessments).set(values).where(eq(warmupTeacherAssessments.id, existing.id)).returning();
    return updated;
  }
  const [created] = await db.insert(warmupTeacherAssessments).values({ ...values, createdAt: now }).returning();
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
  evaluated: boolean;
};

export async function listBoardSubmissions(roundId: number, viewerStudentKey: string): Promise<BoardEntry[]> {
  const db = await getDb();
  const assigned = await db.select({ submissionId: warmupPeerAssignments.submissionId }).from(warmupPeerAssignments).where(and(eq(warmupPeerAssignments.roundId, roundId), eq(warmupPeerAssignments.evaluatorStudentKey, viewerStudentKey)));
  const assignedIds = assigned.map((row) => row.submissionId);
  if (assignedIds.length === 0) return [];
  const rows = await db
    .select()
    .from(warmupSubmissions)
    .where(
      and(
        eq(warmupSubmissions.roundId, roundId),
        ne(warmupSubmissions.studentKey, viewerStudentKey),
        eq(warmupSubmissions.isDemo, false),
        inArray(warmupSubmissions.id, assignedIds)
      )
    )
    .orderBy(warmupSubmissions.id);
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const [allVotes, allExperiences, allExecutions] = await Promise.all([
    db.select().from(warmupVotes).where(inArray(warmupVotes.submissionId, ids)),
    db
      .select({
        submissionId: warmupExperiences.submissionId,
        executorStudentKey: warmupExperiences.executorStudentKey,
      })
      .from(warmupExperiences)
      .where(inArray(warmupExperiences.submissionId, ids)),
    db.select({ submissionId: warmupExecutions.submissionId, executorStudentKey: warmupExecutions.executorStudentKey })
      .from(warmupExecutions).where(inArray(warmupExecutions.submissionId, ids)),
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
      evaluated: allExecutions.some((execution) => execution.submissionId === row.id && execution.executorStudentKey === viewerStudentKey),
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
  if (!round.reviewOpenedAt) throw new WarmupStateError("아직 평가 단계가 시작되지 않았습니다");

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
  const [assignment] = await db.select().from(warmupPeerAssignments).where(and(eq(warmupPeerAssignments.roundId, row.roundId), eq(warmupPeerAssignments.submissionId, row.id), eq(warmupPeerAssignments.evaluatorStudentKey, viewerStudentKey)));
  if (!assignment) throw new WarmupOwnershipError("배정되지 않은 알고리즘은 평가할 수 없습니다");

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
  if (!round.reviewOpenedAt) throw new WarmupStateError("아직 평가 단계가 시작되지 않았습니다");

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
