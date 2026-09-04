/**
 * Pure computation of which students have "fully evaluated" a warm-up
 * round's peer-review board — cast at least one recommendation vote on
 * every submission besides their own. Mandatory once the teacher opens the
 * round's review phase (see `warmupRounds.reviewOpenedAt` in db/schema.ts
 * and app/write/explore/page.tsx). No `@/db` import, so — like
 * lib/warmupRoundGuards.ts — this is unit-tested directly, without a D1
 * runtime.
 */

export type EvaluationSubmissionLike = { id: number; studentKey: string; isDemo: boolean };
export type EvaluationVoteLike = { submissionId: number; voterStudentKey: string };

/**
 * Student keys of real (non-demo) submitters who have voted on every other
 * submission in the round. Demo cards count as peers to evaluate too —
 * students can't tell a demo submission from a real one on the board, so
 * they're expected to evaluate everything they see there.
 */
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
    .filter((s) => !s.isDemo)
    .filter((submitter) => {
      const peerIds = allIds.filter((id) => id !== submitter.id);
      if (peerIds.length === 0) return false; // nothing to evaluate yet — not "complete"
      const voted = votedByVoter.get(submitter.studentKey) ?? new Set<number>();
      return peerIds.every((id) => voted.has(id));
    })
    .map((s) => s.studentKey);
}
