/**
 * Pure computation of which students have "fully evaluated" a warm-up
 * round's peer-review board — cast at least one recommendation vote on
 * every submission besides their own. Mandatory once the teacher opens the
 * round's review phase (see `warmupRounds.reviewOpenedAt` in db/schema.ts
 * and app/write/explore/page.tsx). No `@/db` import, so — like
 * lib/warmupRoundGuards.ts — this is unit-tested directly, without a D1
 * runtime.
 *
 * Callers pass only real submissions (see lib/warmupStore.ts's isDemo
 * filters) — there's no seeded demo content on the board anymore.
 */

export type EvaluationSubmissionLike = { id: number; studentKey: string };
export type EvaluationVoteLike = { submissionId: number; voterStudentKey: string };

/** Student keys of submitters who have voted on every other submission in the round. */
export function fullyEvaluatedStudentKeys(
  submissions: readonly EvaluationSubmissionLike[],
  votes: readonly EvaluationVoteLike[]
): string[] {
  const allIds = submissions.map((s) => s.id);

  const votedByVoter = new Map<string, Set<number>>();
  for (const vote of votes) {
    let voted = votedByVoter.get(vote.voterStudentKey);
    if (!voted) {
      voted = new Set();
      votedByVoter.set(vote.voterStudentKey, voted);
    }
    voted.add(vote.submissionId);
  }

  return submissions
    .filter((submitter) => {
      const peerIds = allIds.filter((id) => id !== submitter.id);
      if (peerIds.length === 0) return false; // nothing to evaluate yet — not "complete"
      const voted = votedByVoter.get(submitter.studentKey) ?? new Set<number>();
      return peerIds.every((id) => voted.has(id));
    })
    .map((s) => s.studentKey);
}
